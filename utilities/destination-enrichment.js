/**
 * Destination Enrichment (registry-backed)
 *
 * Replaces the legacy multi-provider aggregator that used to live in
 * `bienbot-external-data.js` (`enrichDestination` + `doEnrichment` +
 * `fetchTravelData` + per-provider helpers). The new flow calls the
 * BienBot tool registry's read tools in parallel and merges the results
 * into the Destination doc.
 *
 * Tools called in parallel:
 *   - `fetch_destination_tips`        (Wikivoyage provider; structured tips)
 *   - `fetch_destination_places`      (Google Maps; ratings/addresses)
 *   - `fetch_destination_attractions` (TripAdvisor; top POIs)
 *   - `fetch_destination_photos`      (Unsplash; landscape photos)
 *
 * Photo handling stays out of the registry layer: this module persists
 * Photo documents directly (mirroring the deleted `doEnrichment` shape)
 * so the response sent to /api/destinations/:id/enrich clients is
 * unchanged.
 *
 * Public surface:
 *   enrichDestinationViaRegistry(destinationId, user, opts) →
 *     { statusCode, body: { success, data: { destination, cached, refreshing? }, error? } }
 *
 * The route handler in controllers/api/destinations.js depends on this
 * shape and forwards the body to the client; do not change it without
 * also updating the route response contract.
 *
 * @module utilities/destination-enrichment
 */

const logger = require('./backend-logger');
const { getEnforcer } = require('./permission-enforcer');
const { validateObjectId } = require('./controller-helpers');
const toolRegistry = require('./bienbot-tool-registry');
const { bootstrap: bootstrapToolRegistry } = require('./bienbot-tool-registry/bootstrap');

// Lazy-loaded models — keeps module load order flexible at app boot.
let Destination, Experience, Plan, User, Photo;
function loadModels() {
  if (!Destination) {
    Destination = require('../models/destination');
    Experience = require('../models/experience');
    Plan = require('../models/plan');
    User = require('../models/user');
    Photo = require('../models/photo');
  }
}

// Cache TTL preserved from the deleted `enrichDestination` (7 days).
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Convert a registry tip object to the Destination.travel_tips shape.
 *
 * Registry tips: { section, type, category, content, icon? }
 * travel_tips schema requires: { type, value: string, ... } (or string).
 */
function tipFromRegistry(t, destinationName) {
  if (!t || typeof t.content !== 'string' || t.content.trim().length === 0) return null;
  const out = {
    type: t.type || 'Custom',
    category: t.category || 'Overview',
    value: t.content.trim(),
    source: 'Wikivoyage'
  };
  if (t.icon) out.icon = t.icon;
  if (destinationName) {
    const anchor = encodeURIComponent(String(destinationName).replace(/\s+/g, '_'));
    const url = `https://en.wikivoyage.org/wiki/${anchor}`;
    out.url = url;
    out.callToAction = { url, label: 'Read more on Wikivoyage' };
  }
  return out;
}

/**
 * Convert a Google Maps place into a travel_tips entry.
 * places: [{ name, address, rating, price_level, place_id }]
 */
function tipFromGooglePlace(p) {
  if (!p || !p.name) return null;
  const ratingPart = p.rating ? ` (${p.rating}★)` : '';
  const addrPart = p.address ? ` — ${p.address}` : '';
  return {
    type: 'Custom',
    category: 'Places',
    value: `${p.name}${ratingPart}${addrPart}`,
    source: 'Google Maps',
    ...(p.place_id
      ? {
          url: `https://www.google.com/maps/place/?q=place_id:${p.place_id}`,
          callToAction: {
            url: `https://www.google.com/maps/place/?q=place_id:${p.place_id}`,
            label: 'View on Google Maps'
          }
        }
      : {})
  };
}

/**
 * Convert a TripAdvisor attraction into a travel_tips entry.
 * attractions: [{ name, rating, num_reviews, web_url }]
 */
function tipFromTripAdvisor(a) {
  if (!a || !a.name) return null;
  const ratingPart = a.rating ? ` (${a.rating}★)` : '';
  const reviewsPart = a.num_reviews ? `, ${a.num_reviews} reviews` : '';
  return {
    type: 'Custom',
    category: 'Attractions',
    value: `${a.name}${ratingPart}${reviewsPart}`,
    source: 'TripAdvisor',
    ...(a.web_url
      ? {
          url: a.web_url,
          callToAction: { url: a.web_url, label: 'View on TripAdvisor' }
        }
      : {})
  };
}

/**
 * Run the read tools in parallel via the registry. Resilient to per-tool
 * failures (a 503 from a disabled provider, a 502 from upstream — we log
 * and move on; the others still succeed).
 *
 * @param {object} destination - Mongoose destination doc (needs _id, name)
 * @param {object} user
 * @returns {Promise<{ tips: Array, photos: Array, succeeded: string[], failed: string[] }>}
 */
async function fetchAllProviders(destination, user) {
  const destinationName = destination.name;
  const destinationId = destination._id.toString();

  const calls = [
    {
      name: 'fetch_destination_tips',
      payload: { destination_id: destinationId, destination_name: destinationName }
    },
    {
      name: 'fetch_destination_places',
      payload: { destination_name: destinationName }
    },
    {
      name: 'fetch_destination_attractions',
      payload: { destination_name: destinationName }
    },
    {
      name: 'fetch_destination_photos',
      payload: { destination_name: destinationName, count: 5 }
    }
  ];

  const settled = await Promise.allSettled(
    calls.map((c) => toolRegistry.executeRegisteredTool(c.name, c.payload, user))
  );

  const succeeded = [];
  const failed = [];
  const tips = [];
  let photos = [];

  settled.forEach((r, idx) => {
    const name = calls[idx].name;
    if (r.status !== 'fulfilled' || !r.value) {
      failed.push(name);
      logger.warn('[destination-enrichment] tool call rejected', {
        tool: name, error: r.reason?.message
      });
      return;
    }
    const out = r.value;
    if (!out.success) {
      // 503 (provider disabled) is not a failure for our purposes — just no data.
      if (out.statusCode === 503) {
        succeeded.push(name);
        logger.debug('[destination-enrichment] provider disabled', { tool: name });
      } else {
        failed.push(name);
        logger.warn('[destination-enrichment] tool returned error', {
          tool: name, statusCode: out.statusCode, error: out.body?.error
        });
      }
      return;
    }

    succeeded.push(name);
    const body = out.body || {};

    if (name === 'fetch_destination_tips' && Array.isArray(body.tips)) {
      for (const t of body.tips) {
        const mapped = tipFromRegistry(t, destinationName);
        if (mapped) tips.push(mapped);
      }
    } else if (name === 'fetch_destination_places' && Array.isArray(body.places)) {
      for (const p of body.places) {
        const mapped = tipFromGooglePlace(p);
        if (mapped) tips.push(mapped);
      }
    } else if (name === 'fetch_destination_attractions' && Array.isArray(body.attractions)) {
      for (const a of body.attractions) {
        const mapped = tipFromTripAdvisor(a);
        if (mapped) tips.push(mapped);
      }
    } else if (name === 'fetch_destination_photos' && Array.isArray(body.photos)) {
      photos = body.photos;
    }
  });

  return { tips, photos, succeeded, failed };
}

/**
 * Persist photos onto the destination, deduplicating against any photos
 * already linked. Mirrors the dedup logic in the deleted `doEnrichment`.
 */
async function attachPhotos(destination, photos) {
  if (!photos || photos.length === 0) return 0;

  const existingPhotoIds = destination.photos || [];
  const existingUrls = existingPhotoIds.length > 0
    ? new Set(
        (await Photo.find({ _id: { $in: existingPhotoIds } }).select('url').lean())
          .map((p) => p.url)
          .filter(Boolean)
      )
    : new Set();

  let added = 0;
  for (const photo of photos) {
    if (!photo.url || existingUrls.has(photo.url)) continue;
    const photoDoc = await Photo.create({
      url: photo.url,
      photo_credit: photo.photographer
        ? `${photo.photographer} / Unsplash`
        : 'Unsplash',
      photo_credit_url: photo.photographer_url || photo.source_url || 'https://unsplash.com'
    });
    destination.photos.push(photoDoc._id);
    existingUrls.add(photo.url);
    added++;
  }
  return added;
}

/**
 * Internal: run the registry calls and write merged data onto the
 * destination doc. Returns the saved doc.
 */
async function performEnrichment(destination, user) {
  const { tips, photos, succeeded, failed } = await fetchAllProviders(destination, user);

  if (tips.length > 0) {
    destination.travel_tips = tips;
  }

  const addedPhotos = await attachPhotos(destination, photos);

  destination.travel_tips_updated_at = new Date();
  await destination.save();

  logger.info('[destination-enrichment] destination enriched', {
    destinationId: destination._id.toString(),
    tipsCount: tips.length,
    photosAdded: addedPhotos,
    succeeded,
    failed
  });

  return destination;
}

/**
 * Enrich a destination via the BienBot tool registry.
 *
 * Preserves the cache freshness and background-refresh semantics of the
 * deleted `enrichDestination` so the route response shape and behaviour
 * remain stable for clients of GET /api/destinations/:id/enrich.
 *
 * @param {string} destinationId
 * @param {object} user - Authenticated user (must include _id)
 * @param {object} [options]
 * @param {boolean} [options.force=false]      - Force refresh even if cache is fresh
 * @param {boolean} [options.background=false] - Resolve immediately with cached data, refresh in background
 * @returns {Promise<{ statusCode: number, body: object }>}
 */
async function enrichDestinationViaRegistry(destinationId, user, options = {}) {
  loadModels();
  // Idempotent — bootstrap returns early if already done. Important for
  // standalone callers (e.g. context-builders background task) that may
  // run before the chat controller has loaded.
  bootstrapToolRegistry();

  const { force = false, background = false } = options;

  const { valid, objectId: destOid } = validateObjectId(destinationId, 'destinationId');
  if (!valid) {
    return { statusCode: 400, body: { success: false, error: 'Invalid destination ID' } };
  }

  try {
    const enforcer = getEnforcer({ Destination, Experience, Plan, User });
    const destination = await Destination.findById(destOid);

    if (!destination) {
      return { statusCode: 404, body: { success: false, error: 'Destination not found' } };
    }

    const permCheck = await enforcer.canEdit({ userId: user._id, resource: destination });
    if (!permCheck.allowed) {
      return { statusCode: 403, body: { success: false, error: permCheck.reason || 'Not authorized' } };
    }

    const lastEnriched = destination.travel_tips_updated_at;
    const isFresh = lastEnriched && (Date.now() - new Date(lastEnriched).getTime()) < CACHE_TTL_MS;
    const hasTips = destination.travel_tips && destination.travel_tips.length > 0;

    if (isFresh && hasTips && !force) {
      return {
        statusCode: 200,
        body: {
          success: true,
          data: { destination: destination.toObject(), cached: true }
        }
      };
    }

    if (background && hasTips) {
      // Fire and forget — return cached doc immediately
      performEnrichment(destination, user).catch((err) => {
        logger.error('[destination-enrichment] background enrichment failed', {
          destinationId, error: err.message
        });
      });
      return {
        statusCode: 200,
        body: {
          success: true,
          data: { destination: destination.toObject(), cached: true, refreshing: true }
        }
      };
    }

    const updated = await performEnrichment(destination, user);
    return {
      statusCode: 200,
      body: {
        success: true,
        data: { destination: updated.toObject(), cached: false }
      }
    };
  } catch (err) {
    logger.error('[destination-enrichment] enrichDestinationViaRegistry failed', {
      destinationId, error: err.message
    });
    return { statusCode: 500, body: { success: false, error: 'Failed to enrich destination' } };
  }
}

module.exports = {
  enrichDestinationViaRegistry,
  // Internals exported only for unit tests
  _internal: {
    fetchAllProviders,
    attachPhotos,
    performEnrichment,
    tipFromRegistry,
    tipFromGooglePlace,
    tipFromTripAdvisor,
    CACHE_TTL_MS
  }
};

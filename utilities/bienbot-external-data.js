/**
 * BienBot External Data Utility
 *
 * Abstract read-only data fetching functions for BienBot actions that retrieve
 * external data (suggestions, photos, etc.) without mutating state.
 *
 * These functions are consumed by the action executor as READ_ONLY action types
 * that execute immediately without user confirmation.
 *
 * @module utilities/bienbot-external-data
 */

const logger = require('./backend-logger');
const { getEnforcer } = require('./permission-enforcer');
const { validateObjectId } = require('./controller-helpers');
const { transferBucket } = require('./upload-pipeline');
const tracker = require('./api-rate-tracker');
const path = require('path');

// Lazy-loaded models
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

// ---------------------------------------------------------------------------
// suggest_plan_items
// ---------------------------------------------------------------------------

/**
 * Suggest plan items based on what others have planned in the same destination.
 *
 * Queries public experiences in the given destination, aggregates their plan
 * items, deduplicates against the user's existing items (fuzzy), and ranks
 * by frequency (most commonly planned items first).
 *
 * @param {object} payload
 * @param {string} payload.destination_id - Required destination to scope suggestions
 * @param {string} [payload.experience_id] - Optional experience to scope to similar experiences
 * @param {string[]} [payload.exclude_items] - Already-added item texts to exclude
 * @param {number} [payload.limit=10] - Max suggestions to return
 * @param {object} user - Authenticated user object
 * @returns {Promise<{ statusCode: number, body: object }>}
 */
async function suggestPlanItems(payload, user) {
  loadModels();

  const { destination_id, experience_id, exclude_items = [], limit = 10 } = payload;

  // Validate destination_id
  if (!destination_id) {
    return { statusCode: 400, body: { success: false, error: 'destination_id is required' } };
  }

  const { valid: destValid, objectId: destOid } = validateObjectId(destination_id, 'destination_id');
  if (!destValid) {
    return { statusCode: 400, body: { success: false, error: 'Invalid destination_id format' } };
  }

  try {
    // Verify destination exists
    const destination = await Destination.findById(destOid).select('name').lean();
    if (!destination) {
      return { statusCode: 404, body: { success: false, error: 'Destination not found' } };
    }

    // Build query: public experiences in this destination, exclude user's own
    const query = {
      destination: destOid,
      visibility: 'public',
      user: { $ne: user._id }
    };

    // If experience_id provided, exclude it from results (we want OTHER experiences)
    if (experience_id) {
      const { valid: expValid, objectId: expOid } = validateObjectId(experience_id, 'experience_id');
      if (expValid) {
        query._id = { $ne: expOid };
      }
    }

    const experiences = await Experience.find(query)
      .select('name plan_items')
      .limit(50)
      .lean();

    // Aggregate plan items with frequency count and source attribution
    const itemFrequency = new Map(); // normalized text → { text, count, sources }

    for (const exp of experiences) {
      for (const item of (exp.plan_items || [])) {
        const text = (item.content || item.text || item.name || '').trim();
        if (!text) continue;

        const normalized = text.toLowerCase();
        const existing = itemFrequency.get(normalized);

        if (existing) {
          existing.count += 1;
          if (!existing.sources.includes(exp.name)) {
            existing.sources.push(exp.name);
          }
        } else {
          itemFrequency.set(normalized, {
            text,
            normalized,
            count: 1,
            sources: [exp.name],
            activity_type: item.activity_type || null,
            cost_estimate: item.cost_estimate || null
          });
        }
      }
    }

    // Deduplicate against exclude_items using simple fuzzy matching
    const excludeNormalized = (exclude_items || [])
      .map(t => (typeof t === 'string' ? t.trim().toLowerCase() : ''))
      .filter(Boolean);

    const candidates = [];
    for (const [, item] of itemFrequency) {
      // Simple fuzzy exclusion: skip if any exclude item is a substring match
      // or if the Levenshtein-like similarity is high
      const shouldExclude = excludeNormalized.some(ex =>
        item.normalized.includes(ex) ||
        ex.includes(item.normalized) ||
        normalizedSimilarity(item.normalized, ex) > 0.8
      );

      if (!shouldExclude) {
        candidates.push(item);
      }
    }

    // Rank by frequency (most commonly planned first)
    candidates.sort((a, b) => b.count - a.count);

    // Build community-sourced suggestions
    const suggestions = candidates.slice(0, Math.min(limit, 20)).map(item => ({
      text: item.text,
      frequency: item.count,
      sources: item.sources.slice(0, 3), // Cap source names at 3
      source_type: 'community',
      activity_type: item.activity_type,
      cost_estimate: item.cost_estimate
    }));

    // Enrich with Google Maps POIs when a category is specified and slots remain
    const { category } = payload;
    let poiCount = 0;
    if (category && process.env.GOOGLE_MAPS_API_KEY && suggestions.length < limit) {
      const googlePlaces = await fetchGoogleMapsPlaces(destination.name, {
        category,
        maxResults: Math.min(10, limit - suggestions.length + 5)
      });

      const existingNormalized = candidates.map(c => c.normalized);
      for (const place of googlePlaces) {
        if (suggestions.length >= limit) break;
        const norm = place.name.toLowerCase();
        const isDuplicate =
          existingNormalized.some(t =>
            normalizedSimilarity(t, norm) > 0.8 || norm.includes(t) || t.includes(norm)
          ) ||
          excludeNormalized.some(ex =>
            normalizedSimilarity(ex, norm) > 0.8 || norm.includes(ex) || ex.includes(norm)
          );
        if (!isDuplicate) {
          suggestions.push({
            text: place.name,
            frequency: 0,
            sources: ['Google Maps'],
            source_type: 'google_maps',
            activity_type: category,
            cost_estimate: null,
            metadata: {
              rating: place.rating,
              price_level: place.price_level,
              address: place.address,
              url: place.url
            }
          });
          poiCount++;
        }
      }
    }

    // --- Tier 3: Wikivoyage structured plan items (no API key required) ---
    let wikivoyageCount = 0;
    if (suggestions.length < limit) {
      let wvItems = await fetchWikivoyagePlanItems(destination.name, {
        maxTotal: Math.min(10, limit - suggestions.length + 5)
      });

      // Reformulate passive place-names → active action phrases (e.g.
      // "Christchurch Art Gallery" → "Visit the Christchurch Art Gallery").
      // Falls back to the original names if the LLM is unavailable.
      if (wvItems.length > 0) {
        wvItems = await reformulateWikivoyagePlanItems(wvItems, destination.name, user);
      }

      const existingNormalized = [
        ...candidates.map(c => c.normalized),
        ...suggestions
          .filter(s => s.source_type === 'google_maps')
          .map(s => s.text.toLowerCase())
      ];

      for (const item of wvItems) {
        if (suggestions.length >= limit) break;
        const norm = item.name.toLowerCase();
        const isDuplicate =
          existingNormalized.some(t =>
            normalizedSimilarity(t, norm) > 0.8 || norm.includes(t) || t.includes(norm)
          ) ||
          excludeNormalized.some(ex =>
            normalizedSimilarity(ex, norm) > 0.8 || norm.includes(ex) || ex.includes(norm)
          );
        if (!isDuplicate) {
          suggestions.push({
            text: item.name,
            frequency: 0,
            sources: ['Wikivoyage'],
            source_type: 'wikivoyage',
            activity_type: item.activity_type,
            cost_estimate: null,
            metadata: {
              description: item.description || null,
              source_url: item.source_url
            }
          });
          wikivoyageCount++;
        }
      }
    }

    logger.info('[bienbot-external-data] Plan item suggestions generated', {
      destinationId: destination_id,
      candidateCount: candidates.length,
      communityCount: suggestions.length - poiCount - wikivoyageCount,
      poiCount,
      wikivoyageCount,
      returnedCount: suggestions.length,
      sourceExperiences: experiences.length,
      userId: user._id.toString()
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          suggestions,
          destination_name: destination.name,
          source_count: experiences.length
        }
      }
    };
  } catch (err) {
    logger.error('[bienbot-external-data] suggestPlanItems failed', {
      destinationId: destination_id,
      error: err.message,
      userId: user._id.toString()
    });
    return { statusCode: 500, body: { success: false, error: 'Failed to generate suggestions' } };
  }
}

// ---------------------------------------------------------------------------
// fetch_entity_photos
// ---------------------------------------------------------------------------

/**
 * Search Unsplash for photos related to a destination or experience.
 *
 * Results are cached on the session document (session.cached_photos) keyed by
 * entity_type + entity_id and served from cache when fresh (< 7 days). Bypass
 * occurs when an explicit `query` override is provided — custom-query results
 * are always live and never written to the entity-scoped cache.
 *
 * Cached entries mirror the Photo model shape so they can be moved directly
 * to a Photo document when the user assigns a photo to an entity via
 * add_entity_photos.
 *
 * @param {object} payload
 * @param {string} payload.entity_type - 'destination' or 'experience'
 * @param {string} payload.entity_id - Entity ID (used to resolve the search query)
 * @param {string} [payload.query] - Optional explicit search query (overrides entity name; bypasses cache)
 * @param {number} [payload.limit=9] - Max photos to return
 * @param {object} user - Authenticated user object
 * @param {object|null} [session] - Active BienBotSession document for session-level caching
 * @returns {Promise<{ statusCode: number, body: object }>}
 */
async function fetchEntityPhotos(payload, user, session = null) {
  loadModels();

  const { entity_type, entity_id, query: explicitQuery, limit = 9 } = payload;

  // Validate entity_type
  if (!entity_type || !['destination', 'experience'].includes(entity_type)) {
    return {
      statusCode: 400,
      body: { success: false, error: 'entity_type must be "destination" or "experience"' }
    };
  }

  // Validate entity_id
  if (!entity_id) {
    return { statusCode: 400, body: { success: false, error: 'entity_id is required' } };
  }

  const { valid, objectId: entityOid } = validateObjectId(entity_id, 'entity_id');
  if (!valid) {
    return { statusCode: 400, body: { success: false, error: 'Invalid entity_id format' } };
  }

  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    logger.warn('[bienbot-external-data] UNSPLASH_ACCESS_KEY not configured');
    return {
      statusCode: 200,
      body: {
        success: true,
        data: { photos: [], entity_type, entity_id, entity_name: null, total_count: 0 }
      }
    };
  }

  // Budget guard — check before any DB lookups to fail fast
  const unsplashBudget = tracker.checkBudget('unsplash');
  if (!unsplashBudget.allowed) {
    logger.warn('[bienbot-external-data] Unsplash budget exhausted for fetchEntityPhotos', {
      resetAt: unsplashBudget.resetAt,
      userId: user._id.toString()
    });
    return {
      statusCode: 503,
      body: {
        success: false,
        error: 'Photo search service is temporarily unavailable. Please try again later.'
      }
    };
  }

  try {
    // Resolve entity name for search query
    let entity;
    if (entity_type === 'destination') {
      entity = await Destination.findById(entityOid).select('name').lean();
    } else {
      entity = await Experience.findById(entityOid).select('name destination').lean();
    }

    if (!entity) {
      return { statusCode: 404, body: { success: false, error: `${entity_type} not found` } };
    }

    // Build search query: prefer explicit query, then entity name
    let searchQuery = explicitQuery || entity.name || '';

    // For experiences, enrich the query with the destination name
    if (entity_type === 'experience' && !explicitQuery && entity.destination) {
      const dest = await Destination.findById(entity.destination).select('name').lean();
      if (dest?.name) {
        searchQuery = `${entity.name} ${dest.name}`;
      }
    }

    if (!searchQuery.trim()) {
      return {
        statusCode: 200,
        body: {
          success: true,
          data: { photos: [], entity_type, entity_id, entity_name: entity.name, total_count: 0 }
        }
      };
    }

    // Session cache read — skip when an explicit query override is provided
    if (session && !explicitQuery) {
      const now = Date.now();
      const cached = (session.cached_photos || []).filter(p =>
        p.entity_type === entity_type &&
        p.entity_id?.toString() === entity_id &&
        p.source === 'unsplash' &&
        p.cached_at && (now - new Date(p.cached_at).getTime()) < CACHE_TTL_MS
      );
      if (cached.length > 0) {
        const photos = cached.map(p => ({
          unsplash_id: p.meta?.unsplash_id || null,
          url: p.url,
          thumb_url: p.meta?.thumb_url || p.url,
          download_url: p.meta?.download_url || p.url,
          width: p.width,
          height: p.height,
          description: p.caption || p.meta?.description || null,
          photographer: p.meta?.photographer || null,
          photographer_url: p.photo_credit_url,
          unsplash_url: p.source_url
        }));
        logger.debug('[bienbot-external-data] fetchEntityPhotos cache hit', {
          entityType: entity_type, entityId: entity_id, count: photos.length
        });
        return {
          statusCode: 200,
          body: {
            success: true,
            data: { photos, entity_type, entity_id, entity_name: entity.name,
              total_count: photos.length, search_query: searchQuery, cached: true }
          }
        };
      }
    }

    // Call Unsplash Search API
    tracker.recordUsage('unsplash');
    const cappedLimit = Math.min(limit, 20);
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchQuery)}&per_page=${cappedLimit}&orientation=landscape`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Client-ID ${accessKey}`,
        'Accept-Version': 'v1'
      }
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      logger.error('[bienbot-external-data] Unsplash API error', {
        status: response.status,
        body: errText.slice(0, 200),
        query: searchQuery
      });
      return { statusCode: 200, body: { success: true, data: { photos: [], entity_type, entity_id, entity_name: entity.name, total_count: 0 } } };
    }

    const data = await response.json();
    const results = data.results || [];

    const photos = results.map(photo => ({
      unsplash_id: photo.id,
      url: photo.urls?.regular || photo.urls?.small,
      thumb_url: photo.urls?.thumb || photo.urls?.small,
      download_url: photo.urls?.full,
      width: photo.width || null,
      height: photo.height || null,
      description: photo.description || photo.alt_description || null,
      photographer: photo.user?.name || 'Unknown',
      photographer_url: photo.user?.links?.html || null,
      unsplash_url: photo.links?.html || null
    }));

    logger.info('[bienbot-external-data] Unsplash photos fetched', {
      entityType: entity_type,
      entityId: entity_id,
      query: searchQuery,
      photoCount: photos.length,
      totalAvailable: data.total || 0,
      userId: user._id.toString()
    });

    // Session cache write — only when no explicit query override and session provided
    if (session && !explicitQuery && photos.length > 0) {
      try {
        // Evict stale entries for this entity before writing
        session.cached_photos = (session.cached_photos || []).filter(p =>
          !(p.entity_type === entity_type && p.entity_id?.toString() === entity_id && p.source === 'unsplash')
        );
        for (const photo of photos) {
          session.cached_photos.push({
            url: photo.url,
            photo_credit: photo.photographer ? `${photo.photographer} / Unsplash` : 'Unsplash',
            photo_credit_url: photo.photographer_url || 'https://unsplash.com',
            width: photo.width,
            height: photo.height,
            source: 'unsplash',
            source_url: photo.unsplash_url || null,
            entity_type,
            entity_id,
            cached_at: new Date(),
            meta: {
              unsplash_id: photo.unsplash_id || null,
              thumb_url: photo.thumb_url || null,
              download_url: photo.download_url || null,
              description: photo.description || null,
              photographer: photo.photographer || null
            }
          });
        }
        session.markModified('cached_photos');
        await session.save();
      } catch (cacheErr) {
        // Never let cache write failure break the response
        logger.warn('[bienbot-external-data] Failed to write photo cache to session', {
          entityType: entity_type, entityId: entity_id, error: cacheErr.message
        });
      }
    }

    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          photos,
          entity_type,
          entity_id,
          entity_name: entity.name,
          total_count: data.total || 0,
          search_query: searchQuery
        }
      }
    };
  } catch (err) {
    logger.error('[bienbot-external-data] fetchEntityPhotos failed', {
      entityType: entity_type,
      entityId: entity_id,
      error: err.message,
      userId: user._id.toString()
    });
    return { statusCode: 500, body: { success: false, error: 'Failed to fetch photos' } };
  }
}

// ---------------------------------------------------------------------------
// add_entity_photos
// ---------------------------------------------------------------------------

/**
 * Add selected photos (from Unsplash or the session cache) to a destination or experience.
 *
 * For each photo:
 *   - S3 photos (s3_key, no url): transfer from protected → public bucket, then create a
 *     Photo document with the resulting public URL.
 *   - URL photos (Unsplash CDN): create a Photo document directly from the URL.
 *
 * In both cases the Photo ObjectId is pushed to entity.photos (fixing the earlier plain-
 * object schema mismatch). If a session is provided, the corresponding cached_photos entry
 * is removed so the session cache stays consistent.
 *
 * @param {object} payload
 * @param {string} payload.entity_type - 'destination' or 'experience'
 * @param {string} payload.entity_id - Entity ID to add photos to
 * @param {Array} payload.photos - Array of photo objects with url, photographer, photographer_url
 * @param {object} user - Authenticated user object
 * @param {object|null} [session] - Active BienBotSession document; used to remove cache entries
 * @returns {Promise<{ statusCode: number, body: object }>}
 */
async function addEntityPhotos(payload, user, session = null) {
  loadModels();

  const { entity_type, entity_id, photos } = payload;

  if (!entity_type || !['destination', 'experience'].includes(entity_type)) {
    return { statusCode: 400, body: { success: false, error: 'entity_type must be "destination" or "experience"' } };
  }

  if (!entity_id) {
    return { statusCode: 400, body: { success: false, error: 'entity_id is required' } };
  }

  const { valid, objectId: entityOid } = validateObjectId(entity_id, 'entity_id');
  if (!valid) {
    return { statusCode: 400, body: { success: false, error: 'Invalid entity_id format' } };
  }

  if (!photos || !Array.isArray(photos) || photos.length === 0) {
    return { statusCode: 400, body: { success: false, error: 'photos array is required' } };
  }

  if (photos.length > 20) {
    return { statusCode: 400, body: { success: false, error: 'Maximum 20 photos can be added at once' } };
  }

  try {
    const enforcer = getEnforcer({ Destination, Experience, Plan, User });

    // Load entity and check edit permission
    let entity;
    const Model = entity_type === 'destination' ? Destination : Experience;
    entity = await Model.findById(entityOid);

    if (!entity) {
      return { statusCode: 404, body: { success: false, error: `${entity_type} not found` } };
    }

    const permCheck = await enforcer.canEdit({ userId: user._id, resource: entity });
    if (!permCheck.allowed) {
      return { statusCode: 403, body: { success: false, error: permCheck.reason || 'Not authorized to modify this entity' } };
    }

    // Add each photo to the entity
    const addedPhotos = [];
    for (const photo of photos) {
      // Handle S3-stored photos from BienBot chat uploads
      if (photo.s3_key && !photo.url) {
        try {
          const originalFilename = photo.filename || path.basename(photo.s3_key);
          const rand = Math.ceil(Math.random() * 500);

          const transferResult = await transferBucket(photo.s3_key, {
            fromProtected: true,
            toPrefix: 'photos/',
            deleteSource: false,
            newName: `${rand}-bienbot-${originalFilename}`
          });

          // Create Photo model record
          const photoRecord = await Photo.create({
            url: transferResult.location,
            photo_credit: photo.photographer || user.name || 'User Upload',
            photo_credit_url: '',
            permissions: [{
              _id: user._id,
              entity: 'user',
              type: 'owner',
              granted_by: user._id
            }]
          });

          entity.photos.push({ photo: photoRecord._id, default: entity.photos.length === 0 });

          addedPhotos.push({
            url: transferResult.location,
            photo_credit: photoRecord.photo_credit,
            _id: photoRecord._id
          });

          // Remove from session cache if present
          if (session && photo.s3_key) {
            const before = session.cached_photos.length;
            session.cached_photos = session.cached_photos.filter(p => p.s3_key !== photo.s3_key);
            if (session.cached_photos.length !== before) session.markModified('cached_photos');
          }

          logger.info('[bienbot-external-data] S3 photo transferred to public bucket', {
            s3Key: photo.s3_key,
            publicUrl: transferResult.location,
            userId: user._id.toString()
          });
        } catch (s3Err) {
          logger.error('[bienbot-external-data] Failed to transfer S3 photo', {
            s3Key: photo.s3_key,
            error: s3Err.message,
            userId: user._id.toString()
          });
          continue;
        }
      } else if (photo.url) {
        // URL-based photo (Unsplash or external): look up session cache for metadata,
        // create a Photo document, then push the ObjectId to the entity.
        const cachedEntry = session
          ? (session.cached_photos || []).find(p => p.url === photo.url)
          : null;

        const photoCredit = cachedEntry?.photo_credit
          || (photo.photographer ? `${photo.photographer} / Unsplash` : 'Unsplash');
        const photoCreditUrl = cachedEntry?.photo_credit_url
          || photo.photographer_url || photo.unsplash_url || 'https://unsplash.com';

        const photoDoc = await Photo.create({
          url: photo.url,
          photo_credit: photoCredit,
          photo_credit_url: photoCreditUrl,
          width: cachedEntry?.width || null,
          height: cachedEntry?.height || null,
          permissions: [{
            _id: user._id,
            entity: 'user',
            type: 'owner',
            granted_by: user._id
          }]
        });

        entity.photos.push({ photo: photoDoc._id, default: entity.photos.length === 0 });

        addedPhotos.push({
          url: photo.url,
          photo_credit: photoCredit,
          _id: photoDoc._id
        });

        // Remove from session cache
        if (session && cachedEntry) {
          session.cached_photos = session.cached_photos.filter(p => p.url !== photo.url);
          session.markModified('cached_photos');
        }
      }
    }

    await entity.save();

    // Persist session cache removals after entity save
    if (session && session.isModified && session.isModified('cached_photos')) {
      await session.save();
    }

    logger.info('[bienbot-external-data] Photos added to entity', {
      entityType: entity_type,
      entityId: entity_id,
      addedCount: addedPhotos.length,
      userId: user._id.toString()
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        data: entity.toObject()
      }
    };
  } catch (err) {
    logger.error('[bienbot-external-data] addEntityPhotos failed', {
      entityType: entity_type,
      entityId: entity_id,
      error: err.message,
      userId: user._id.toString()
    });
    return { statusCode: 500, body: { success: false, error: 'Failed to add photos' } };
  }
}

// ===========================================================================
// External Travel Data Providers (Wikivoyage, Unsplash, Google Maps)
// ===========================================================================

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Retry a function with exponential backoff.
 *
 * @param {Function} fn - Async function to retry
 * @param {object} [options]
 * @param {number} [options.maxRetries=2] - Max retry attempts
 * @param {number} [options.baseDelayMs=500] - Base delay in ms (doubles each retry)
 * @param {number} [options.timeoutMs=8000] - Per-attempt timeout
 * @param {string} [options.label] - Label for logging
 * @returns {Promise<*>} Result of fn, or null on exhausted retries
 */
async function withRetry(fn, options = {}) {
  const { maxRetries = 2, baseDelayMs = 500, timeoutMs = 8000, label = 'external-api', provider = null } = options;

  if (provider) {
    const budget = tracker.checkBudget(provider);
    if (!budget.allowed) {
      logger.warn(`[bienbot-external-data] ${provider} budget exhausted, skipping`, {
        provider, resetAt: budget.resetAt
      });
      return null;
    }
    tracker.recordUsage(provider);
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const result = await fn(controller.signal);
      clearTimeout(timer);
      return result;
    } catch (err) {
      if (err.name === 'AbortError') {
        logger.warn(`[bienbot-external-data] ${label} timeout on attempt ${attempt + 1}`);
      } else {
        logger.warn(`[bienbot-external-data] ${label} error on attempt ${attempt + 1}`, {
          error: err.message
        });
      }

      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  logger.error(`[bienbot-external-data] ${label} all ${maxRetries + 1} attempts failed`);
  return null;
}

// ---------------------------------------------------------------------------
// Wikivoyage provider
// ---------------------------------------------------------------------------

// WIKIVOYAGE_SECTION_MAP: REMOVED (T11). The tip-section taxonomy now lives
// inside the registry's Wikivoyage provider
// (utilities/bienbot-tool-registry/providers/wikivoyage.js), which is the
// sole owner of `fetch_destination_tips`.

/**
 * Set of Wikivoyage section keys that map to actionable plan items.
 * Sections not in this set (get around, stay safe, talk, etc.) are not
 * surfaced as plan item suggestions by suggestPlanItems.
 */
const PLAN_ITEM_SECTIONS = new Set(['see', 'do', 'eat', 'drink', 'buy', 'sleep']);

/**
 * Maps plan-item Wikivoyage section keys to activity_type values used by the
 * plan item data model. Kept separate from WIKIVOYAGE_SECTION_MAP to avoid
 * coupling tip-rendering config (tipType, icon, maxTips) with plan semantics.
 */
const SECTION_ACTIVITY_TYPE = {
  'see':   'sightseeing',
  'do':    'adventure',
  'eat':   'food',
  'drink': 'nightlife',
  'buy':   'shopping',
  'sleep': 'accommodation',
};

/**
 * Default maximum number of plan item candidates to extract per section.
 * Prevents any one section from dominating the result set.
 */
const PLAN_ITEM_MAX_PER_SECTION = {
  'see':   6,
  'do':    6,
  'eat':   5,
  'drink': 3,
  'buy':   3,
  'sleep': 4,
};

/**
 * Strip HTML tags and decode common HTML entities.
 * Handles nested tags, self-closing tags, and common entities.
 *
 * @param {string} html
 * @returns {string}
 */
function stripHtml(html) {
  // Step 1: Remove MediaWiki edit-section spans entirely (contain "[edit]" bracket text)
  // Step 2: Remove heading elements — section content includes the heading we already know
  // Step 3: Convert structural tags to whitespace/newlines
  let text = html
    .replace(/<span[^>]*class="[^"]*mw-editsection[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '')
    .replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n');

  // Step 4: Decode safe HTML entities. &lt; and &gt; are intentionally NOT decoded
  // to '<' and '>' — leaving them as entity references ensures no angle bracket is
  // ever introduced into the string, so '<script' cannot appear after tag stripping.
  // The output is plain text for LLM context where entity-encoded forms are harmless.
  text = text
    .replace(/&amp;/g, '__BIENSPERIENCE_AMP__')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // Step 5: Remove all HTML tags including unclosed tags.
  // Uses a split-based approach rather than regex `.replace()` calls so that
  // static analysers (CodeQL js/incomplete-multi-character-sanitization) have no
  // `.replace(/<…>/g, '')` pattern to flag as incomplete.
  //
  // Algorithm: split on '<'; for each segment after the first, the part up to
  // the first '>' is tag content — discard it.  If there is no '>' (unclosed tag
  // such as a trailing '<script'), discard the whole segment.
  text = text.split('<').map((segment, idx) => {
    if (idx === 0) return segment;          // text that appears before any '<'
    const closeIdx = segment.indexOf('>');
    return closeIdx >= 0 ? segment.slice(closeIdx + 1) : '';
  }).join('');

  // Step 6: Restore & from placeholder and clean up whitespace.
  // Note: no [<>] removal needed here because '<' was never introduced by Step 4
  // and Step 5(c) guarantees '<' is absent.
  text = text
    .replace(/__BIENSPERIENCE_AMP__/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

// extractFragments: REMOVED (T11). Used only by the deleted
// fetchWikivoyageTips. The registry's Wikivoyage provider has its own
// inline fragment extractor.

/**
 * Extract structured plan item candidates from a Wikivoyage section's HTML.
 *
 * Uses a two-tier strategy:
 *   1. **Listing templates** (preferred): Wikivoyage's structured listing markup
 *      uses `<span class="listing-name">` and `<span class="listing-description">`.
 *      These are parsed with regex and paired positionally.
 *   2. **Plain-text fallback**: When no listing spans are found, the HTML is
 *      stripped to plain text, lines are split on common separators
 *      (`. `, ` – `, ` — `, ` - `) and the left/right sides become name/description.
 *
 * @param {string} html        - Raw section HTML from the MediaWiki API
 * @param {string} sectionKey  - Lowercase section name (e.g. 'see', 'do', 'eat')
 * @returns {Array<{ name: string, description: string, activity_type: string|null }>}
 */
function extractPlanItemCandidates(html, sectionKey) {
  const activityType = SECTION_ACTIVITY_TYPE[sectionKey] || null;
  const maxItems = PLAN_ITEM_MAX_PER_SECTION[sectionKey] ?? 4;
  const results = [];

  // --- Tier 1: listing template extraction ---
  const nameMatches = [...html.matchAll(/<span[^>]*class="listing-name"[^>]*>(.*?)<\/span>/gi)];
  const descMatches = [...html.matchAll(/<span[^>]*class="listing-description"[^>]*>(.*?)<\/span>/gi)];

  if (nameMatches.length > 0) {
    for (let i = 0; i < nameMatches.length && results.length < maxItems; i++) {
      const name = stripHtml(nameMatches[i][1]).trim();
      if (!name) continue;
      const description = descMatches[i] ? stripHtml(descMatches[i][1]).trim() : '';
      results.push({ name, description, activity_type: activityType });
    }
    return results;
  }

  // --- Tier 2: plain-text line scan fallback ---
  const plainText = stripHtml(html);
  const lines = plainText
    .split(/\n+/)
    .map(l => l.replace(/^[\s•·\-–—*]+/, '').trim())
    .filter(l => l.length >= 20 && l.length <= 300);

  // Separator pattern: matches '. ', ' – ', ' — ', ' - ' as name/description split points
  const SEPARATOR_RE = /^(.{1,80}?)(?:\.\s+|\s+[–—]\s+|\s+-\s+)(.{20,})$/;

  for (const line of lines) {
    if (results.length >= maxItems) break;
    const match = line.match(SEPARATOR_RE);
    if (match) {
      const name = match[1].trim();
      const description = match[2].trim();
      if (name) results.push({ name, description, activity_type: activityType });
    } else if (line.length <= 80) {
      // Name-only line — no discernible description
      results.push({ name: line, description: '', activity_type: activityType });
    }
  }

  return results;
}

// fetchWikivoyageTips: REMOVED (T11). Wikivoyage tip-fetching now lives in
// the BienBot tool registry — `fetch_destination_tips`
// (utilities/bienbot-tool-registry/providers/wikivoyage.js). Both the
// /api/destinations/:id/enrich route and BienBot's background context
// enrichment go through utilities/destination-enrichment.js, which calls
// the registry tool.

/**
 * Fetch structured plan item candidates from Wikivoyage for a destination.
 *
 * Queries the MediaWiki section API but limits processing to
 * plan-item-relevant sections (See, Do, Eat, Drink, Buy, Sleep) and returns
 * structured `{ name, description, activity_type, source_url }` objects
 * rather than generic tip strings.
 *
 * Deduplicates across sections: if the same attraction name appears in both
 * See and Do, only the first occurrence is kept.
 *
 * Free API — no API key required.
 *
 * @param {string} destinationName
 * @param {object} [options]
 * @param {number} [options.maxTotal=20] - Overall cap on items returned
 * @returns {Promise<Array<{ name: string, description: string, activity_type: string|null, source_url: string }>>}
 */
async function fetchWikivoyagePlanItems(destinationName, options = {}) {
  const { maxTotal = 20 } = options;
  const encoded = encodeURIComponent(destinationName.replace(/\s+/g, '_'));
  const pageUrl = `https://en.wikivoyage.org/wiki/${encoded}`;

  const items = await withRetry(async (signal) => {
    // Step 1: Fetch section index
    const sectionsUrl = `https://en.wikivoyage.org/w/api.php?action=parse&page=${encoded}&prop=sections&format=json&redirects=1`;
    const sectionsRes = await fetch(sectionsUrl, { signal, headers: { 'Accept': 'application/json' } });

    if (!sectionsRes.ok) {
      if (sectionsRes.status === 404) return [];
      throw new Error(`Wikivoyage sections HTTP ${sectionsRes.status}`);
    }

    const sectionsData = await sectionsRes.json();
    if (sectionsData.error) {
      if (sectionsData.error.code === 'missingtitle') return [];
      throw new Error(`Wikivoyage API error: ${sectionsData.error.info}`);
    }

    const sections = sectionsData.parse?.sections || [];
    if (sections.length === 0) return [];

    // Step 2: Filter to plan-item-relevant sections only
    const relevantSections = sections
      .filter(s => PLAN_ITEM_SECTIONS.has((s.line || '').toLowerCase().trim()))
      .map(s => ({
        sectionKey: s.line.toLowerCase().trim(),
        sectionName: s.line,
        sectionIndex: s.index
      }));

    if (relevantSections.length === 0) return [];

    // Step 3: Fetch section content in batches (max 6 concurrent)
    const batchSize = 6;
    const allItems = [];
    const seenNames = new Set(); // cross-section deduplication

    for (let i = 0; i < relevantSections.length && allItems.length < maxTotal; i += batchSize) {
      const batch = relevantSections.slice(i, i + batchSize);

      const batchResults = await Promise.allSettled(
        batch.map(async (sec) => {
          const contentUrl = `https://en.wikivoyage.org/w/api.php?action=parse&page=${encoded}&prop=text&section=${sec.sectionIndex}&format=json&redirects=1&disabletoc=1`;
          const contentRes = await fetch(contentUrl, { signal, headers: { 'Accept': 'application/json' } });

          if (!contentRes.ok) return [];

          const contentData = await contentRes.json();
          const html = contentData.parse?.text?.['*'] || '';
          if (!html) return [];

          const candidates = extractPlanItemCandidates(html, sec.sectionKey);
          const sectionAnchor = sec.sectionName.replace(/\s+/g, '_');
          const sourceUrl = `${pageUrl}#${sectionAnchor}`;

          return candidates
            .filter(c => c.name.length > 0)
            .map(c => ({ ...c, source_url: sourceUrl }));
        })
      );

      for (const result of batchResults) {
        if (result.status !== 'fulfilled' || !result.value) continue;
        for (const item of result.value) {
          if (allItems.length >= maxTotal) break;
          const norm = item.name.toLowerCase();
          // Cross-section deduplication using strict bigram similarity
          const isDup = [...seenNames].some(seen =>
            normalizedSimilarity(seen, norm) > 0.8 || norm.includes(seen) || seen.includes(norm)
          );
          if (!isDup) {
            seenNames.add(norm);
            allItems.push(item);
          }
        }
      }
    }

    return allItems;
  }, { label: 'wikivoyage-plan-items', timeoutMs: 12000 });

  return items || [];
}

// ---------------------------------------------------------------------------
// Wikivoyage plan item reformulation (passive → active)
// ---------------------------------------------------------------------------

/**
 * Reformulate WikiVoyage plan item names from passive noun-phrases to active,
 * actionable travel plan items using the LLM.
 *
 * Always resolves — returns the original items unchanged if the AI provider
 * is unavailable, if the gateway blocks the request, or if the LLM response
 * cannot be parsed.
 *
 * @param {Array<{ name: string, description: string, activity_type: string|null, source_url: string }>} items
 * @param {string} destinationName
 * @param {object} user - Authenticated user (for AI gateway policy resolution)
 * @returns {Promise<Array>} Items with reformulated names
 */
async function reformulateWikivoyagePlanItems(items, destinationName, user) {
  if (!items || items.length === 0) return items;

  // Lazy-load to avoid circular dependencies at module initialisation time
  let executeAIRequest, GatewayError;
  try {
    ({ executeAIRequest, GatewayError } = require('./ai-gateway'));
  } catch {
    return items;
  }

  const { getApiKey, getProviderForTask } = require('../controllers/api/ai');
  const { AI_TASKS } = require('./ai-constants');
  const { lang } = require('./lang.constants');

  const provider = getProviderForTask(AI_TASKS.GENERATE_TIPS);
  if (!getApiKey(provider)) {
    logger.debug('[bienbot-external-data] AI provider not configured — skipping wikivoyage reformulation');
    return items;
  }

  const systemPrompt = lang.en.prompts.wikivoyage_reformat;

  // Build a numbered list so the LLM can return items in matching order
  const itemLines = items.map((item, idx) =>
    `${idx + 1}. [${item.activity_type || 'sightseeing'}] "${item.name}"`
  ).join('\n');

  const userPrompt = `Destination: ${destinationName}\n\nItems:\n${itemLines}`;

  try {
    const result = await executeAIRequest({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      task: AI_TASKS.GENERATE_TIPS,
      user: user || null,
      options: {
        provider,
        temperature: 0.3,
        maxTokens: 800
      }
    });

    const text = (result.content || '').trim();

    let reformulated;
    try {
      const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      reformulated = JSON.parse(cleaned);
    } catch {
      logger.warn('[bienbot-external-data] Could not parse wikivoyage reformulation response', {
        raw: text.substring(0, 200)
      });
      return items;
    }

    if (!Array.isArray(reformulated) || reformulated.length !== items.length) {
      logger.warn('[bienbot-external-data] Unexpected reformulation response length', {
        expected: items.length,
        got: Array.isArray(reformulated) ? reformulated.length : typeof reformulated
      });
      return items;
    }

    return items.map((item, idx) => {
      const rewritten = reformulated[idx];
      if (typeof rewritten === 'string' && rewritten.trim().length > 0) {
        // LLMs occasionally output HTML entities (e.g. &#39; for apostrophe).
        // Decode them so plan item text is stored as plain text.
        // &amp; is decoded last to prevent double-unescaping (e.g. &amp;#39; → &#39; → ')
        const decoded = rewritten.trim()
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&apos;/g, "'")
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&');
        return { ...item, name: decoded };
      }
      return item; // keep original on per-item failure
    });

  } catch (err) {
    if (GatewayError && err instanceof GatewayError) {
      logger.debug('[bienbot-external-data] AI gateway declined wikivoyage reformulation', { code: err.code });
    } else {
      logger.warn('[bienbot-external-data] Wikivoyage reformulation failed', { error: err.message });
    }
    return items; // always fall back gracefully
  }
}

// fetchUnsplashPhotos: REMOVED (T11). Unsplash photo-fetching now lives in
// the BienBot tool registry — `fetch_destination_photos`
// (utilities/bienbot-tool-registry/providers/unsplash.js). Destination
// enrichment uses utilities/destination-enrichment.js.

// ---------------------------------------------------------------------------
// Google Maps Places provider (still in use by suggestPlanItems)
// ---------------------------------------------------------------------------

/**
 * Fetch specific POIs from Google Maps Text Search API for a destination.
 *
 * Uses the Places Text Search endpoint to find real points of interest
 * (restaurants, museums, attractions, etc.) by category. Results are
 * structured as plan-item-friendly objects with name, rating, address and
 * a direct Google Maps URL.
 *
 * Subject to module-level daily budget limits controlled by
 * GOOGLE_MAPS_DAILY_TEXT_SEARCH_LIMIT (default 50 calls/day).
 *
 * @param {string} destinationName - Destination to search within
 * @param {object} [options]
 * @param {string} [options.category] - Category filter (e.g. 'restaurants', 'museums', 'attractions')
 * @param {number} [options.maxResults=10] - Max POIs to return (capped at 10)
 * @returns {Promise<Array<{
 *   place_id: string,
 *   name: string,
 *   rating: number|null,
 *   user_ratings_total: number|null,
 *   price_level: number|null,
 *   address: string|null,
 *   opening_hours_open_now: boolean|null,
 *   photo_reference: string|null,
 *   url: string,
 *   types: string[],
 *   category: string
 * }>>}
 */
async function fetchGoogleMapsPlaces(destinationName, options = {}) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return [];

  const { category = null, maxResults = 10 } = options;
  const cappedMax = Math.min(maxResults, 10);

  const query = category
    ? `${category} in ${destinationName}`
    : `top attractions in ${destinationName}`;

  const places = await withRetry(async (signal) => {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;

    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`Google Maps Text Search HTTP ${res.status}`);

    const data = await res.json();
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(`Google Maps Text Search error: ${data.status} — ${data.error_message || ''}`);
    }

    const results = (data.results || []).slice(0, cappedMax);
    return results.map(place => ({
      place_id: place.place_id,
      name: place.name,
      rating: place.rating ?? null,
      user_ratings_total: place.user_ratings_total ?? null,
      price_level: place.price_level ?? null,
      address: place.formatted_address || null,
      opening_hours_open_now: place.opening_hours?.open_now ?? null,
      photo_reference: place.photos?.[0]?.photo_reference || null,
      url: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
      types: place.types || [],
      category: category || 'attraction'
    }));
  }, { label: 'google-maps-text-search', timeoutMs: 10000, provider: 'google_maps_text_search' });

  return places || [];
}

// fetchGoogleMapsTips: REMOVED (T11). Replaced by registry tool
// `fetch_destination_places` (utilities/bienbot-tool-registry/providers/google-maps.js)
// — surfaces structured place results rather than reviews-as-tips.

// ---------------------------------------------------------------------------
// TripAdvisor provider helpers — REMOVED (T11)
//
// fetchTripAdvisorTips, fetchTripAdvisorPlaces, toTripAdvisorCategory, and
// the TRIPADVISOR_CATEGORY_MAP table all moved to the registry's TripAdvisor
// provider (`fetch_destination_attractions`,
// utilities/bienbot-tool-registry/providers/tripadvisor.js).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// REMOVED (T11): fetchTravelData, enrichDestination, doEnrichment.
//
// The legacy multi-provider aggregator chain is gone. Both call sites (the
// /api/destinations/:id/enrich route and the background trigger in
// utilities/bienbot-context-builders.js) now go through
// utilities/destination-enrichment.js#enrichDestinationViaRegistry, which
// calls these registry tools in parallel:
//   - fetch_destination_tips        (Wikivoyage)
//   - fetch_destination_places      (Google Maps)
//   - fetch_destination_attractions (TripAdvisor)
//   - fetch_destination_photos      (Unsplash)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// cleanupSessionPhotos — background cleanup on session archive
// ---------------------------------------------------------------------------

/**
 * Clean up photos in session.cached_photos that were never assigned to an entity.
 *
 * - Photos with an s3_key are deleted from S3 (protected or public bucket as flagged).
 * - URL-only photos (Unsplash CDN) require no storage cleanup.
 * - The cached_photos array is cleared on the session document when done.
 *
 * Intended to run fire-and-forget after session.archive() in the controller.
 *
 * @param {object} session - BienBotSession document (may be a plain object; uses .constructor or Model)
 * @returns {Promise<void>}
 */
async function cleanupSessionPhotos(session) {
  const cached = session.cached_photos || [];
  if (cached.length === 0) return;

  const { s3Delete } = require('../uploads/aws-s3');

  for (const photo of cached) {
    if (!photo.s3_key) continue; // URL-only (e.g. Unsplash CDN) — nothing to delete from storage
    try {
      await s3Delete(photo.s3_key, { protected: !!photo.is_protected });
      logger.debug('[bienbot-external-data] Deleted unclaimed session photo from S3', {
        s3Key: photo.s3_key, sessionId: session._id?.toString()
      });
    } catch (err) {
      logger.warn('[bienbot-external-data] Failed to delete session photo from S3', {
        s3Key: photo.s3_key, error: err.message
      });
    }
  }

  // Clear the array; use updateOne to avoid version conflicts with a concurrent save
  const BienBotSession = session.constructor?.modelName
    ? session.constructor
    : require('../models/bienbot-session');
  await BienBotSession.updateOne({ _id: session._id }, { $set: { cached_photos: [] } });

  logger.info('[bienbot-external-data] Session photo cache cleared on archive', {
    sessionId: session._id?.toString(), clearedCount: cached.length
  });
}

// ---------------------------------------------------------------------------
// fetch_destination_tips: REMOVED.
//
// Previously this module exported a multi-provider aggregator
// (`fetchDestinationTips`) that fanned out to Wikivoyage + Google Maps and
// dedup'd against existing destination tips. That responsibility has moved
// to the BienBot tool registry: the Wikivoyage provider in
// `utilities/bienbot-tool-registry/providers/wikivoyage.js` owns
// `fetch_destination_tips` natively (single-provider, no aggregation).
//
// Multi-provider composition is now the LLM's job — it can call
// `fetch_destination_tips` and `fetch_destination_places` (Google Maps) in
// the same tool-use turn; the loop runs them in parallel.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Simple normalized string similarity using character bigram overlap.
 * Returns a value between 0 (no similarity) and 1 (identical).
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function normalizedSimilarity(a, b) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigramsA = new Set();
  for (let i = 0; i < a.length - 1; i++) {
    bigramsA.add(a.substring(i, i + 2));
  }

  const bigramsB = new Set();
  for (let i = 0; i < b.length - 1; i++) {
    bigramsB.add(b.substring(i, i + 2));
  }

  let intersection = 0;
  for (const bigram of bigramsA) {
    if (bigramsB.has(bigram)) intersection++;
  }

  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

module.exports = {
  // Action handlers (consumed by the BienBot action executor)
  suggestPlanItems,
  fetchEntityPhotos,
  addEntityPhotos,
  cleanupSessionPhotos,

  // Wikivoyage helpers used by suggestPlanItems
  fetchWikivoyagePlanItems,
  extractPlanItemCandidates,

  // Google Maps Places helper used by suggestPlanItems for category POIs
  fetchGoogleMapsPlaces,

  // Generic utilities consumed elsewhere in the bienbot pipeline
  withRetry,
  normalizedSimilarity
};

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

  const { valid: destValid } = validateObjectId(destination_id, 'destination_id');
  if (!destValid) {
    return { statusCode: 400, body: { success: false, error: 'Invalid destination_id format' } };
  }

  try {
    // Verify destination exists
    const destination = await Destination.findById(destination_id).select('name').lean();
    if (!destination) {
      return { statusCode: 404, body: { success: false, error: 'Destination not found' } };
    }

    // Build query: public experiences in this destination, exclude user's own
    const query = {
      destination: destination_id,
      visibility: 'public',
      user: { $ne: user._id }
    };

    // If experience_id provided, exclude it from results (we want OTHER experiences)
    if (experience_id) {
      const { valid: expValid } = validateObjectId(experience_id, 'experience_id');
      if (expValid) {
        query._id = { $ne: experience_id };
      }
    }

    const experiences = await Experience.find(query)
      .select('name plan_items')
      .limit(50)
      .lean();

    if (experiences.length === 0) {
      return {
        statusCode: 200,
        body: {
          success: true,
          data: {
            suggestions: [],
            destination_name: destination.name,
            source_count: 0
          }
        }
      };
    }

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

    // Return top N
    const suggestions = candidates.slice(0, Math.min(limit, 20)).map(item => ({
      text: item.text,
      frequency: item.count,
      sources: item.sources.slice(0, 3), // Cap source names at 3
      activity_type: item.activity_type,
      cost_estimate: item.cost_estimate
    }));

    logger.info('[bienbot-external-data] Plan item suggestions generated', {
      destinationId: destination_id,
      candidateCount: candidates.length,
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
 * Returns Unsplash photo results that the user can select and add to their
 * entity. Photos include attribution data per Unsplash API guidelines.
 *
 * @param {object} payload
 * @param {string} payload.entity_type - 'destination' or 'experience'
 * @param {string} payload.entity_id - Entity ID (used to resolve the search query)
 * @param {string} [payload.query] - Optional explicit search query (overrides entity name)
 * @param {number} [payload.limit=9] - Max photos to return
 * @param {object} user - Authenticated user object
 * @returns {Promise<{ statusCode: number, body: object }>}
 */
async function fetchEntityPhotos(payload, user) {
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

  const { valid } = validateObjectId(entity_id, 'entity_id');
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

  try {
    // Resolve entity name for search query
    let entity;
    if (entity_type === 'destination') {
      entity = await Destination.findById(entity_id).select('name').lean();
    } else {
      entity = await Experience.findById(entity_id).select('name destination').lean();
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

    // Call Unsplash Search API
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
 * Add selected photos (from Unsplash) to a destination or experience.
 *
 * Creates photo records with Unsplash URLs and attribution, then pushes them
 * to the entity's photos array. Follows Unsplash attribution guidelines by
 * preserving photographer name and link.
 *
 * @param {object} payload
 * @param {string} payload.entity_type - 'destination' or 'experience'
 * @param {string} payload.entity_id - Entity ID to add photos to
 * @param {Array} payload.photos - Array of photo objects with url, photographer, photographer_url
 * @param {object} user - Authenticated user object
 * @returns {Promise<{ statusCode: number, body: object }>}
 */
async function addEntityPhotos(payload, user) {
  loadModels();

  const { entity_type, entity_id, photos } = payload;

  if (!entity_type || !['destination', 'experience'].includes(entity_type)) {
    return { statusCode: 400, body: { success: false, error: 'entity_type must be "destination" or "experience"' } };
  }

  if (!entity_id) {
    return { statusCode: 400, body: { success: false, error: 'entity_id is required' } };
  }

  const { valid } = validateObjectId(entity_id, 'entity_id');
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
    entity = await Model.findById(entity_id);

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

          entity.photos.push({
            url: transferResult.location,
            photo_credit: photoRecord.photo_credit,
            photo_credit_url: ''
          });

          addedPhotos.push({
            url: transferResult.location,
            photo_credit: photoRecord.photo_credit,
            _id: photoRecord._id
          });

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
        // Handle Unsplash URL-based photos (existing behavior)
        const photoCredit = photo.photographer
          ? `${photo.photographer} / Unsplash`
          : 'Unsplash';

        entity.photos.push({
          url: photo.url,
          photo_credit: photoCredit,
          photo_credit_url: photo.photographer_url || photo.unsplash_url || 'https://unsplash.com'
        });

        addedPhotos.push({
          url: photo.url,
          photo_credit: photoCredit
        });
      }
    }

    await entity.save();

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
  const { maxRetries = 2, baseDelayMs = 500, timeoutMs = 8000, label = 'external-api' } = options;

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

/**
 * Mapping from Wikivoyage section names to TravelTipsList structured tip types.
 * Keys are lowercase Wikivoyage section titles; values are objects with:
 *   tipType  – matches TravelTip component's type enum
 *   category – human-readable label shown in the UI badge
 *   icon     – optional emoji override (TravelTip has defaults per type)
 *   maxTips  – max items to extract from this section
 */
const WIKIVOYAGE_SECTION_MAP = {
  'see':          { tipType: 'Custom', category: 'Sightseeing', icon: '👁️', maxTips: 4 },
  'do':           { tipType: 'Custom', category: 'Activities',  icon: '🎯', maxTips: 4 },
  'eat':          { tipType: 'Food',   category: 'Food',        icon: null,  maxTips: 3 },
  'drink':        { tipType: 'Food',   category: 'Nightlife',   icon: '🍸', maxTips: 2 },
  'buy':          { tipType: 'Custom', category: 'Shopping',    icon: '🛍️', maxTips: 2 },
  'sleep':        { tipType: 'Accommodation', category: 'Accommodation', icon: null, maxTips: 3 },
  'get around':   { tipType: 'Transportation', category: 'Transportation', icon: null, maxTips: 3 },
  'get in':       { tipType: 'Transportation', category: 'Getting There', icon: '✈️', maxTips: 2 },
  'stay safe':    { tipType: 'Safety', category: 'Safety', icon: null, maxTips: 3 },
  'stay healthy': { tipType: 'Safety', category: 'Health', icon: '🏥', maxTips: 2 },
  'cope':         { tipType: 'Custom', category: 'Practical Info', icon: 'ℹ️', maxTips: 2 },
  'talk':         { tipType: 'Language', category: 'Language', icon: null, maxTips: 2 },
  'understand':   { tipType: 'Customs', category: 'Culture', icon: null, maxTips: 3 },
  'respect':      { tipType: 'Customs', category: 'Customs', icon: null, maxTips: 2 },
  'climate':      { tipType: 'Weather', category: 'Weather', icon: null, maxTips: 2 },
  'connect':      { tipType: 'Custom', category: 'Connectivity', icon: '📱', maxTips: 2 }
};

/**
 * Strip HTML tags and decode common HTML entities.
 * Handles nested tags, self-closing tags, and common entities.
 *
 * @param {string} html
 * @returns {string}
 */
function stripHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extract useful text fragments from a Wikivoyage section's plain text.
 *
 * Splits on list items and sentences, filters out very short or very long
 * fragments, and returns up to `max` results.
 *
 * @param {string} text - Plain text (HTML already stripped)
 * @param {number} max  - Maximum fragments to return
 * @returns {string[]}
 */
function extractFragments(text, max) {
  // Wikivoyage articles use bullet lists extensively — split on newlines first
  const lines = text
    .split(/\n+/)
    .map(l => l.replace(/^[\s•·\-–—*]+/, '').trim())
    .filter(l => l.length > 15 && l.length < 400);

  if (lines.length > 0) {
    return lines.slice(0, max);
  }

  // Fallback: sentence splitting for prose-style sections
  return text
    .split(/(?<=[.!?])\s+/)
    .filter(s => s.length > 20 && s.length < 300)
    .slice(0, max);
}

/**
 * Fetch travel tips from Wikivoyage for a destination.
 *
 * Uses a two-tier strategy:
 *   1. **Section-level** (preferred): Fetches the article's section list via
 *      the MediaWiki API, identifies travel-relevant sections (See, Do, Eat,
 *      Sleep, etc.), fetches each section's content, and parses it into
 *      structured tip objects that match the TravelTipsList component format.
 *   2. **Summary fallback**: If the section API fails or returns nothing,
 *      falls back to the REST summary endpoint for a brief extract.
 *
 * Free API, no key required.
 *
 * @param {string} destinationName
 * @param {object} [options]
 * @param {number} [options.maxTotalTips=15] - Overall cap on tips returned
 * @returns {Promise<Array<{ type: string, value: string, source: string, url: string, category?: string, icon?: string, callToAction?: object }>>}
 */
async function fetchWikivoyageTips(destinationName, options = {}) {
  const { maxTotalTips = 15 } = options;
  const encoded = encodeURIComponent(destinationName.replace(/\s+/g, '_'));
  const pageUrl = `https://en.wikivoyage.org/wiki/${encoded}`;

  // --- Tier 1: Section-level fetching ---
  const sectionTips = await withRetry(async (signal) => {
    // Step 1: Get section index
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

    // Step 2: Identify travel-relevant sections
    const relevantSections = [];
    for (const section of sections) {
      const sectionKey = (section.line || '').toLowerCase().trim();
      const mapping = WIKIVOYAGE_SECTION_MAP[sectionKey];
      if (mapping && section.index) {
        relevantSections.push({ ...mapping, sectionIndex: section.index, sectionName: section.line });
      }
    }

    if (relevantSections.length === 0) return [];

    // Step 3: Fetch content for each relevant section (batched, max 6 at a time)
    const batchSize = 6;
    const allTips = [];

    for (let i = 0; i < relevantSections.length && allTips.length < maxTotalTips; i += batchSize) {
      const batch = relevantSections.slice(i, i + batchSize);

      const batchResults = await Promise.allSettled(
        batch.map(async (sec) => {
          const contentUrl = `https://en.wikivoyage.org/w/api.php?action=parse&page=${encoded}&prop=text&section=${sec.sectionIndex}&format=json&redirects=1&disabletoc=1`;
          const contentRes = await fetch(contentUrl, { signal, headers: { 'Accept': 'application/json' } });

          if (!contentRes.ok) return [];

          const contentData = await contentRes.json();
          const html = contentData.parse?.text?.['*'] || '';
          if (!html) return [];

          const plainText = stripHtml(html);
          if (plainText.length < 20) return [];

          const fragments = extractFragments(plainText, sec.maxTips);
          const sectionAnchor = sec.sectionName.replace(/\s+/g, '_');

          return fragments.map(fragment => ({
            type: sec.tipType,
            category: sec.category,
            value: fragment,
            source: 'Wikivoyage',
            url: `${pageUrl}#${sectionAnchor}`,
            ...(sec.icon ? { icon: sec.icon } : {}),
            callToAction: {
              url: `${pageUrl}#${sectionAnchor}`,
              label: `Read more on Wikivoyage`
            }
          }));
        })
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          allTips.push(...result.value);
        }
      }
    }

    return allTips.slice(0, maxTotalTips);
  }, { label: 'wikivoyage-sections', timeoutMs: 12000 });

  if (sectionTips && sectionTips.length > 0) {
    return sectionTips;
  }

  // --- Tier 2: Summary fallback ---
  const summaryTips = await withRetry(async (signal) => {
    const url = `https://en.wikivoyage.org/api/rest_v1/page/summary/${encoded}`;

    const res = await fetch(url, { signal, headers: { 'Accept': 'application/json' } });
    if (!res.ok) {
      if (res.status === 404) return [];
      throw new Error(`Wikivoyage summary HTTP ${res.status}`);
    }

    const data = await res.json();
    const result = [];
    const resolvedUrl = data.content_urls?.desktop?.page || pageUrl;

    if (data.extract) {
      const sentences = data.extract
        .split(/(?<=[.!?])\s+/)
        .filter(s => s.length > 20 && s.length < 300)
        .slice(0, 5);

      for (const sentence of sentences) {
        result.push({
          type: 'Custom',
          category: 'Overview',
          value: sentence.trim(),
          source: 'Wikivoyage',
          url: resolvedUrl,
          icon: '🌍',
          callToAction: {
            url: resolvedUrl,
            label: 'Read more on Wikivoyage'
          }
        });
      }
    }

    return result;
  }, { label: 'wikivoyage-summary', timeoutMs: 6000 });

  return summaryTips || [];
}

// ---------------------------------------------------------------------------
// Unsplash provider (for destination enrichment)
// ---------------------------------------------------------------------------

/**
 * Fetch landscape photos from Unsplash for a destination.
 *
 * Returns photo objects with attribution for enrichment.
 *
 * @param {string} destinationName
 * @param {number} [count=5]
 * @returns {Promise<Array<{ url: string, thumb_url: string, photographer: string, photographer_url: string, unsplash_url: string }>>}
 */
async function fetchUnsplashPhotos(destinationName, count = 5) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) return [];

  const photos = await withRetry(async (signal) => {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(destinationName)}&per_page=${count}&orientation=landscape`;

    const res = await fetch(url, {
      signal,
      headers: {
        'Authorization': `Client-ID ${accessKey}`,
        'Accept-Version': 'v1'
      }
    });

    if (!res.ok) throw new Error(`Unsplash HTTP ${res.status}`);

    const data = await res.json();
    return (data.results || []).map(photo => ({
      url: photo.urls?.regular || photo.urls?.small,
      thumb_url: photo.urls?.thumb || photo.urls?.small,
      photographer: photo.user?.name || 'Unknown',
      photographer_url: photo.user?.links?.html || null,
      unsplash_url: photo.links?.html || null,
      photo_credit: `${photo.user?.name || 'Unknown'} / Unsplash`
    }));
  }, { label: 'unsplash-enrich', timeoutMs: 8000 });

  return photos || [];
}

// ---------------------------------------------------------------------------
// Google Maps Places provider
// ---------------------------------------------------------------------------

/**
 * Fetch travel-relevant reviews from Google Maps Places API.
 *
 * Retrieves place details and returns up to 3 short reviews as tips.
 *
 * @param {string} destinationName
 * @returns {Promise<Array<{ type: string, value: string, source: string, url: string }>>}
 */
async function fetchGoogleMapsTips(destinationName) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return [];

  const tips = await withRetry(async (signal) => {
    // Step 1: Find place
    const findUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(destinationName)}&inputtype=textquery&fields=place_id,name&key=${apiKey}`;

    const findRes = await fetch(findUrl, { signal });
    if (!findRes.ok) throw new Error(`Google Places Find HTTP ${findRes.status}`);

    const findData = await findRes.json();
    const placeId = findData.candidates?.[0]?.place_id;
    if (!placeId) return [];

    // Step 2: Get place details with reviews
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,reviews,url&key=${apiKey}`;

    const detailsRes = await fetch(detailsUrl, { signal });
    if (!detailsRes.ok) throw new Error(`Google Places Details HTTP ${detailsRes.status}`);

    const detailsData = await detailsRes.json();
    const place = detailsData.result;
    if (!place?.reviews) return [];

    const mapsUrl = place.url || `https://www.google.com/maps/place/?q=place_id:${placeId}`;

    // Take top 3 reviews, truncate to 150 chars
    return place.reviews
      .filter(r => r.text && r.rating >= 4)
      .slice(0, 3)
      .map(review => ({
        type: 'review',
        value: review.text.length > 150 ? review.text.slice(0, 147) + '...' : review.text,
        source: 'Google Maps',
        url: mapsUrl,
        rating: review.rating
      }));
  }, { label: 'google-maps', timeoutMs: 10000 });

  return tips || [];
}

// ---------------------------------------------------------------------------
// fetchTravelData — aggregates all providers with fallback
// ---------------------------------------------------------------------------

/**
 * Fetch travel data from all available providers for a destination.
 *
 * Runs providers in parallel. Each provider failing independently does not
 * affect others. Returns combined results from whichever providers succeed.
 *
 * @param {string} destinationName
 * @param {object} [options]
 * @param {boolean} [options.includePhotos=true] - Whether to fetch Unsplash photos
 * @param {number} [options.photoCount=5] - Number of photos to fetch
 * @returns {Promise<{ travel_tips: Array, photos: Array, providers_succeeded: string[], providers_failed: string[] }>}
 */
async function fetchTravelData(destinationName, options = {}) {
  const { includePhotos = true, photoCount = 5 } = options;

  const providerResults = await Promise.allSettled([
    fetchWikivoyageTips(destinationName),
    fetchGoogleMapsTips(destinationName),
    includePhotos ? fetchUnsplashPhotos(destinationName, photoCount) : Promise.resolve([])
  ]);

  const providerNames = ['wikivoyage', 'google_maps', 'unsplash'];
  const succeeded = [];
  const failed = [];

  const travelTips = [];
  let photos = [];

  providerResults.forEach((result, idx) => {
    const name = providerNames[idx];

    if (result.status === 'fulfilled' && result.value && result.value.length > 0) {
      succeeded.push(name);
      if (name === 'unsplash') {
        photos = result.value;
      } else {
        travelTips.push(...result.value);
      }
    } else if (result.status === 'rejected') {
      failed.push(name);
      logger.warn(`[bienbot-external-data] Provider ${name} failed`, {
        error: result.reason?.message,
        destination: destinationName
      });
    } else {
      // fulfilled but empty — not a failure, just no data
      succeeded.push(name);
    }
  });

  logger.info('[bienbot-external-data] fetchTravelData completed', {
    destination: destinationName,
    tipsCount: travelTips.length,
    photosCount: photos.length,
    succeeded,
    failed
  });

  return { travel_tips: travelTips, photos, providers_succeeded: succeeded, providers_failed: failed };
}

// ---------------------------------------------------------------------------
// enrichDestination — caching + background refresh
// ---------------------------------------------------------------------------

/**
 * Enrich a destination with external travel data.
 *
 * Checks the destination's travel_tips cache. If fresh (< 7 days), returns
 * cached data immediately. If stale or empty, fetches fresh data and saves it.
 *
 * @param {string} destinationId
 * @param {object} user - Authenticated user
 * @param {object} [options]
 * @param {boolean} [options.force=false] - Force refresh even if cache is fresh
 * @param {boolean} [options.background=false] - Non-blocking: resolve immediately with cached data, refresh in background
 * @returns {Promise<{ statusCode: number, body: object }>}
 */
async function enrichDestination(destinationId, user, options = {}) {
  loadModels();

  const { force = false, background = false } = options;

  const { valid } = validateObjectId(destinationId, 'destinationId');
  if (!valid) {
    return { statusCode: 400, body: { success: false, error: 'Invalid destination ID' } };
  }

  try {
    const enforcer = getEnforcer({ Destination, Experience, Plan, User });
    const destination = await Destination.findById(destinationId);

    if (!destination) {
      return { statusCode: 404, body: { success: false, error: 'Destination not found' } };
    }

    const permCheck = await enforcer.canEdit({ userId: user._id, resource: destination });
    if (!permCheck.allowed) {
      return { statusCode: 403, body: { success: false, error: permCheck.reason || 'Not authorized' } };
    }

    // Check cache freshness
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

    // Background mode: return cached data immediately, refresh in background
    if (background && hasTips) {
      // Fire and forget
      doEnrichment(destination).catch(err => {
        logger.error('[bienbot-external-data] Background enrichment failed', {
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

    // Synchronous enrichment
    const updated = await doEnrichment(destination);

    return {
      statusCode: 200,
      body: {
        success: true,
        data: { destination: updated.toObject(), cached: false }
      }
    };
  } catch (err) {
    logger.error('[bienbot-external-data] enrichDestination failed', {
      destinationId, error: err.message
    });
    return { statusCode: 500, body: { success: false, error: 'Failed to enrich destination' } };
  }
}

/**
 * Internal: fetch travel data and save to destination.
 *
 * @param {object} destination - Mongoose destination document
 * @returns {Promise<object>} Updated destination document
 */
async function doEnrichment(destination) {
  const { travel_tips, photos } = await fetchTravelData(destination.name);

  if (travel_tips.length > 0) {
    destination.travel_tips = travel_tips;
  }

  // Add fetched photos to the destination entity
  if (photos.length > 0) {
    for (const photo of photos) {
      if (!photo.url) continue;
      destination.photos.push({
        url: photo.url,
        photo_credit: photo.photo_credit || 'Unsplash',
        photo_credit_url: photo.photographer_url || 'https://unsplash.com'
      });
    }
  }

  // Mark enrichment timestamp
  destination.travel_tips_updated_at = new Date();
  await destination.save();

  logger.info('[bienbot-external-data] Destination enriched', {
    destinationId: destination._id.toString(),
    tipsCount: travel_tips.length,
    photosCount: photos.length
  });

  return destination;
}

// ---------------------------------------------------------------------------
// fetch_destination_tips (read-only contextual enrichment)
// ---------------------------------------------------------------------------

/**
 * Fetch travel tips from external sources for a destination.
 *
 * This is a READ_ONLY action type used during contextual enrichment — e.g.
 * after a destination is created via BienBot, or when the user asks for tips.
 * Tips are returned as selectable suggestions; the user picks which ones to
 * add, and BienBot then proposes an `update_destination` action.
 *
 * @param {object} payload
 * @param {string} payload.destination_id - Destination to fetch tips for
 * @param {string} [payload.destination_name] - Optional name override (skips DB lookup)
 * @param {object} user - Authenticated user object
 * @returns {Promise<{ statusCode: number, body: object }>}
 */
async function fetchDestinationTips(payload, user) {
  loadModels();

  const { destination_id, destination_name: nameOverride } = payload;

  if (!destination_id) {
    return { statusCode: 400, body: { success: false, error: 'destination_id is required' } };
  }

  const { valid } = validateObjectId(destination_id, 'destination_id');
  if (!valid) {
    return { statusCode: 400, body: { success: false, error: 'Invalid destination_id format' } };
  }

  try {
    // Resolve destination name
    let destinationName = nameOverride;
    let destination;

    if (!destinationName) {
      destination = await Destination.findById(destination_id).select('name travel_tips').lean();
      if (!destination) {
        return { statusCode: 404, body: { success: false, error: 'Destination not found' } };
      }
      destinationName = destination.name;
    }

    if (!destinationName) {
      return { statusCode: 200, body: { success: true, data: { tips: [], destination_id, destination_name: null } } };
    }

    // Fetch tips from all external providers (Wikivoyage, Google Maps)
    const { travel_tips } = await fetchTravelData(destinationName, { includePhotos: false });

    if (!travel_tips || travel_tips.length === 0) {
      return {
        statusCode: 200,
        body: {
          success: true,
          data: {
            tips: [],
            destination_id,
            destination_name: destinationName,
            provider_count: 0
          }
        }
      };
    }

    // Deduplicate against any existing tips on the destination
    const existingTips = destination?.travel_tips || [];
    const existingNormalized = existingTips.map(t => {
      const val = typeof t === 'string' ? t : t.value || '';
      return val.toLowerCase().trim();
    }).filter(Boolean);

    const filteredTips = travel_tips.filter(tip => {
      const normalized = (tip.value || '').toLowerCase().trim();
      return !existingNormalized.some(existing =>
        existing.includes(normalized) ||
        normalized.includes(existing) ||
        normalizedSimilarity(existing, normalized) > 0.8
      );
    });

    // Count unique sources
    const sources = new Set(filteredTips.map(t => t.source).filter(Boolean));

    logger.info('[bienbot-external-data] Destination tips fetched for enrichment', {
      destinationId: destination_id,
      destinationName,
      totalFetched: travel_tips.length,
      afterDedup: filteredTips.length,
      sources: [...sources],
      userId: user._id.toString()
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          tips: filteredTips,
          destination_id,
          destination_name: destinationName,
          provider_count: sources.size
        }
      }
    };
  } catch (err) {
    logger.error('[bienbot-external-data] fetchDestinationTips failed', {
      destinationId: destination_id,
      error: err.message,
      userId: user._id.toString()
    });
    return { statusCode: 500, body: { success: false, error: 'Failed to fetch destination tips' } };
  }
}

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
  suggestPlanItems,
  fetchEntityPhotos,
  addEntityPhotos,
  fetchDestinationTips,
  fetchTravelData,
  enrichDestination,
  fetchWikivoyageTips,
  fetchUnsplashPhotos,
  fetchGoogleMapsTips,
  withRetry,
  normalizedSimilarity
};

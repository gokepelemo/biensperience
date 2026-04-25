/**
 * BienBot Intent Classifier
 *
 * Uses NLP.js (node-nlp-rn) for fast, local intent classification. The
 * classifier is trained on startup from the MongoDB corpus (seeded from
 * JSON on first boot) and uses a neural network for intent selection.
 *
 * Two entity-extraction modes controlled by a deployment-scoped toggle
 * (`IntentClassifierConfig.nlp_slot_fill_enabled` or `NLP_SLOT_FILL_V2`
 * env override):
 *
 *   OFF (baseline): corpus utterances are expanded against a static list
 *   of sample entity values. Entity extraction uses NLP.js built-in
 *   regex entities (email) plus local regex heuristics for destination
 *   and experience names.
 *
 *   ON (slot-fill v2): corpus utterances stay as slot templates
 *   (`%destination_name%`, `%experience_name%`). A hybrid NER pipeline
 *   combines addNamedEntityText entries for the top-K popular entities
 *   (from the popularity scorer) with regex long-tail fallbacks so
 *   lowercase and multi-word names extract correctly.
 *
 * Supports:
 * - DB-backed corpus with admin management and corpus_version migration
 * - Configurable confidence thresholds
 * - LLM fallback for low-confidence classifications (schema-gated JSON)
 * - Classification logging for admin review
 * - Event-driven retrain via bienbot-intent-retrain-scheduler
 *
 * @module utilities/bienbot-intent-classifier
 */

const { NlpManager } = require('node-nlp-rn');
const logger = require('./backend-logger');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs').promises;
const os = require('os');

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const EMAIL_REGEX_GLOBAL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const DEFAULT_CLASSIFIER_CONFIG = Object.freeze({
  low_confidence_threshold: 0.65,
  llm_fallback_enabled: false,
  llm_fallback_threshold: 0.4,
  log_all_classifications: false,
  log_retention_days: 90
});

const MESSAGE_LOG_MAX_LEN = 500;
const NAME_MIN_LEN = 2;
const NAME_MAX_LEN = 80;
const NEW_NAME_MAX_LEN = 200;
const LOCATION_MIN_LEN = 3;
const LOCATION_MAX_LEN = 200;
const NOTE_MIN_LEN = 2;
const TIP_MIN_LEN = 3;
const PLAN_ITEM_MIN_LEN = 3;
const CACHE_FILES_TO_KEEP = 3;

/**
 * Resolve deployment-scoped slot-fill toggle state.
 * Reads from env first (`NLP_SLOT_FILL_V2=true`/`false`), then from the
 * IntentClassifierConfig singleton (`nlp_slot_fill_enabled`). Defaults to false.
 *
 * This is process-wide — not a per-user feature flag. Per-user gating of
 * bienbot access is already enforced upstream by the `ai_features` flag.
 *
 * @returns {Promise<boolean>}
 */
async function isSlotFillEnabled() {
  if (process.env.NLP_SLOT_FILL_V2 === 'true') return true;
  if (process.env.NLP_SLOT_FILL_V2 === 'false') return false;
  try {
    const IntentClassifierConfig = require('../models/intent-classifier-config');
    const config = await IntentClassifierConfig.getConfig();
    return Boolean(config.nlp_slot_fill_enabled);
  } catch {
    return false;
  }
}

/**
 * All recognised BienBot intents.
 */
const INTENTS = {
  QUERY_DESTINATION: 'QUERY_DESTINATION',
  PLAN_EXPERIENCE: 'PLAN_EXPERIENCE',
  CREATE_EXPERIENCE: 'CREATE_EXPERIENCE',
  ADD_PLAN_ITEMS: 'ADD_PLAN_ITEMS',
  INVITE_COLLABORATOR: 'INVITE_COLLABORATOR',
  SYNC_PLAN: 'SYNC_PLAN',
  ANSWER_QUESTION: 'ANSWER_QUESTION',
  COMPLETE_PLAN_ITEM: 'COMPLETE_PLAN_ITEM',
  UNCOMPLETE_PLAN_ITEM: 'UNCOMPLETE_PLAN_ITEM',
  SCHEDULE_PLAN_ITEM: 'SCHEDULE_PLAN_ITEM',
  ADD_PLAN_ITEM_NOTE: 'ADD_PLAN_ITEM_NOTE',
  SET_PLAN_ITEM_LOCATION: 'SET_PLAN_ITEM_LOCATION',
  UPDATE_PLAN_ITEM_COST: 'UPDATE_PLAN_ITEM_COST',
  ADD_PLAN_ITEM_DETAIL: 'ADD_PLAN_ITEM_DETAIL',
  UPDATE_PLAN_ITEM_NOTE: 'UPDATE_PLAN_ITEM_NOTE',
  DELETE_PLAN_ITEM_NOTE: 'DELETE_PLAN_ITEM_NOTE',
  UPDATE_PLAN_ITEM_DETAIL: 'UPDATE_PLAN_ITEM_DETAIL',
  DELETE_PLAN_ITEM_DETAIL: 'DELETE_PLAN_ITEM_DETAIL',
  ASSIGN_PLAN_ITEM: 'ASSIGN_PLAN_ITEM',
  UPDATE_PLAN_ITEM_TEXT: 'UPDATE_PLAN_ITEM_TEXT',
  UPDATE_PLAN_ITEM_URL: 'UPDATE_PLAN_ITEM_URL',
  // Experience-level
  UPDATE_EXPERIENCE: 'UPDATE_EXPERIENCE',
  ADD_EXPERIENCE_PLAN_ITEM: 'ADD_EXPERIENCE_PLAN_ITEM',
  UPDATE_EXPERIENCE_PLAN_ITEM: 'UPDATE_EXPERIENCE_PLAN_ITEM',
  DELETE_EXPERIENCE_PLAN_ITEM: 'DELETE_EXPERIENCE_PLAN_ITEM',
  // Destination-level
  UPDATE_DESTINATION: 'UPDATE_DESTINATION',
  ADD_DESTINATION_TIP: 'ADD_DESTINATION_TIP',
  FAVORITE_DESTINATION: 'FAVORITE_DESTINATION',
  // Plan-level
  UPDATE_PLAN: 'UPDATE_PLAN',
  DELETE_PLAN: 'DELETE_PLAN',
  DELETE_PLAN_ITEM: 'DELETE_PLAN_ITEM',
  ADD_PLAN_COST: 'ADD_PLAN_COST',
  REMOVE_COLLABORATOR: 'REMOVE_COLLABORATOR',
  SET_MEMBER_LOCATION: 'SET_MEMBER_LOCATION',
  REMOVE_MEMBER_LOCATION: 'REMOVE_MEMBER_LOCATION',
  // Navigation
  NAVIGATE_TO_ENTITY: 'NAVIGATE_TO_ENTITY',
  // Composite
  MULTI_ACTION: 'MULTI_ACTION',
  // Plan queries
  QUERY_PLAN: 'QUERY_PLAN',
  // Discovery
  DISCOVER_EXPERIENCES: 'DISCOVER_EXPERIENCES',
  DISCOVER_DESTINATIONS: 'DISCOVER_DESTINATIONS',
  // Temporal awareness
  QUERY_UPCOMING: 'QUERY_UPCOMING',
  QUERY_TODAY: 'QUERY_TODAY',
  DISCUSS_PLAN_ITEM: 'DISCUSS_PLAN_ITEM',
  QUERY_RECENT_ACTIVITY: 'QUERY_RECENT_ACTIVITY',
  QUERY_USER_EXPERIENCES: 'QUERY_USER_EXPERIENCES',
  // Destination creation
  CREATE_DESTINATION: 'CREATE_DESTINATION',
  // Search
  SEARCH_CONTENT: 'SEARCH_CONTENT',
  // Social / follows
  FOLLOW_USER: 'FOLLOW_USER',
  UNFOLLOW_USER: 'UNFOLLOW_USER',
  QUERY_FOLLOWERS: 'QUERY_FOLLOWERS',
  ACCEPT_FOLLOW_REQUEST: 'ACCEPT_FOLLOW_REQUEST',
  // Dashboard / overview
  QUERY_DASHBOARD: 'QUERY_DASHBOARD',
  // Plan costs / budget
  QUERY_PLAN_COSTS: 'QUERY_PLAN_COSTS',
  UPDATE_PLAN_COST: 'UPDATE_PLAN_COST',
  DELETE_PLAN_COST: 'DELETE_PLAN_COST',
  // Plan item pinning
  PIN_PLAN_ITEM: 'PIN_PLAN_ITEM',
  UNPIN_PLAN_ITEM: 'UNPIN_PLAN_ITEM',
  // Plan item ordering
  REORDER_PLAN_ITEMS: 'REORDER_PLAN_ITEMS',
  SHIFT_PLAN_DATES: 'SHIFT_PLAN_DATES',
  // User profile
  UPDATE_PROFILE: 'UPDATE_PROFILE',
  QUERY_PROFILE: 'QUERY_PROFILE',
  // Experience tags / categories
  QUERY_EXPERIENCE_TAGS: 'QUERY_EXPERIENCE_TAGS',
  // Country-based queries
  QUERY_COUNTRY: 'QUERY_COUNTRY',
  // Activity feed
  QUERY_ACTIVITY_FEED: 'QUERY_ACTIVITY_FEED',
  // Invites
  CREATE_INVITE: 'CREATE_INVITE',
  SHARE_INVITE: 'SHARE_INVITE',
  // Plan access
  REQUEST_PLAN_ACCESS: 'REQUEST_PLAN_ACCESS',
  // Document management
  UPLOAD_DOCUMENT: 'UPLOAD_DOCUMENT',
  QUERY_DOCUMENTS: 'QUERY_DOCUMENTS',
  // Photo management
  ADD_PHOTO: 'ADD_PHOTO',
  QUERY_PHOTOS: 'QUERY_PHOTOS'
};

const VALID_INTENTS = new Set(Object.values(INTENTS));
const CUSTOM_INTENT_REGEX = /^[A-Z][A-Z0-9_]+$/;

const DESTINATION_NAME_PATTERNS = [
  /(?:about|visit|to|in|for|like in|like at)\s+([A-Z][a-zA-Z\s]+?)(?:\s*[?.!,]|$)/,
  /(?:weather|food|culture|nightlife|transport)\s+(?:in|of|at)\s+([A-Z][a-zA-Z\s]+?)(?:\s*[?.!,]|$)/,
  /([A-Z][a-zA-Z\s]+?)\s+(?:safe|expensive|cheap|worth)/
];
const QUOTED_STRING_REGEX = /["']([^"']+)["']/;
const COST_REGEX = /\$\s*(\d+(?:[.,]\d{1,2})?)|(\d+(?:[.,]\d{1,2})?)\s*(?:dollars?|euros?|usd|eur|gbp)/i;
const PLAIN_COST_REGEX = /(?:to|at|about|around|for)\s+(\d+(?:\.\d{1,2})?)/i;
const ISO_DATE_REGEX = /\b(\d{4}-\d{2}-\d{2})\b/;
const NATURAL_DATE_REGEX = /(?:for|on|to)\s+((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{4})?|(?:next\s+)?(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)|tomorrow|today|day\s+\d+)/i;
const TIME_REGEX = /\b(\d{1,2}:\d{2}(?:\s*(?:am|pm))?|\d{1,2}\s*(?:am|pm))\b/i;
const TIME_PERIOD_REGEX = /(?:in the|for the)\s+(morning|afternoon|evening|night)/i;
const URL_REGEX = /(https?:\/\/[^\s,]+)/i;
const LOCATION_REGEX = /(?:to|at|is)\s+(.+?)(?:\s*[.!?])?$/i;
const NOTE_REGEX = /(?:note[:\s]+|saying\s+|that\s+)(.+?)(?:\s*[.!?])?$/i;
const ASSIGNEE_REGEX = /(?:to|assign)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/;
const TIP_REGEX = /(?:tip[:\s]+|advice[:\s]+|add\s+(?:a\s+)?tip[:\s]+)(.+?)(?:\s*[.!?])?$/i;
const COST_TITLE_REGEX = /(?:for\s+(?:the\s+)?|on\s+(?:the\s+)?|spent\s+.*?(?:on|for)\s+)([a-zA-Z][a-zA-Z\s]{2,30}?)(?:\s*$|\s*[.!?,])/i;
const VISIBILITY_REGEX = /\b(public|private)\b/i;
const EXPERIENCE_TYPE_REGEX = /(?:type\s+(?:to|as)\s+|category\s+(?:to|as)\s+)([a-zA-Z]+)/i;
const CURRENCY_REGEX = /\b(USD|EUR|GBP|JPY|AUD|CAD|CHF|CNY|INR|BRL|MXN|KRW|NZD|SEK|NOK|DKK|SGD|HKD|THB|ZAR)\b/i;
const RENAME_REGEX = /(?:rename\s+(?:to|it\s+to|this\s+to)\s+|change\s+(?:the\s+)?name\s+to\s+|name\s+to\s+)(.+?)(?:\s*[.!?])?$/i;
const PROPER_NOUN_AFTER_PREP_REGEX = /(?:to|in|for|from|about)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/g;
const NAME_AFTER_VERB_REGEX = /(?:invite|add|remove|with)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\b/g;
const QUOTED_STRING_REGEX_GLOBAL = /["']([^"']+)["']/g;
const PLAN_ITEM_VERB_PREFIX_REGEX = /^(?:add|include|put|schedule|insert)\s+/i;
const PLAN_ITEM_TARGET_SUFFIX_REGEX = /\s+(?:to|in|on|into)\s+(?:my\s+)?(?:plan|itinerary|schedule)\s*$/i;
const PLAN_ITEM_SPLIT_REGEX = /\s*(?:,\s*(?:and\s+)?|(?:\s+and\s+))\s*/i;
const MULTI_ACTION_RESERVED_NAMES = new Set(['Plan', 'Experience', 'Destination', 'Items', 'Cost']);

const DETAIL_TYPES = ['transport', 'flight', 'train', 'bus', 'cruise', 'ferry', 'accommodation', 'hotel', 'parking', 'discount'];
const COST_CATEGORIES = ['accommodation', 'transport', 'food', 'activities', 'equipment', 'other'];
const COST_SYNONYM_MAP = Object.freeze({
  hotel: 'accommodation', hostel: 'accommodation', airbnb: 'accommodation', lodging: 'accommodation',
  flight: 'transport', taxi: 'transport', uber: 'transport', bus: 'transport', train: 'transport', car: 'transport',
  dinner: 'food', lunch: 'food', breakfast: 'food', meal: 'food', restaurant: 'food', dining: 'food',
  tour: 'activities', ticket: 'activities', excursion: 'activities', admission: 'activities', entrance: 'activities',
  gear: 'equipment', rental: 'equipment'
});

// ---------------------------------------------------------------------------
// NLP Manager singleton
// ---------------------------------------------------------------------------

let manager = null;
let trainingPromise = null;
let lastTrainedFingerprint = '';
let lastTrainStats = { intents: 0, utterances: 0 };
let cacheCleanupDone = false;

/**
 * Delete old cached NLP model files in tmpdir, keeping only the most recent N.
 * Runs once per process, fire-and-forget. Without this, every corpus or
 * registry change writes a new bienbot-nlp-<hash>.json that is never reaped.
 */
async function cleanupOldCacheFiles(currentHash) {
  if (cacheCleanupDone) return;
  cacheCleanupDone = true;
  try {
    const tmpdir = os.tmpdir();
    const entries = await fsp.readdir(tmpdir);
    const ours = entries
      .filter(name => name.startsWith('bienbot-nlp-') && name.endsWith('.json'))
      .filter(name => !name.includes(currentHash));
    if (ours.length === 0) return;
    const stats = await Promise.all(ours.map(async name => {
      const full = path.join(tmpdir, name);
      try {
        const stat = await fsp.stat(full);
        return { full, mtime: stat.mtimeMs };
      } catch {
        return null;
      }
    }));
    const ranked = stats.filter(Boolean).sort((a, b) => b.mtime - a.mtime);
    const toDelete = ranked.slice(CACHE_FILES_TO_KEEP - 1); // keep N-1 olds plus the current one
    await Promise.all(toDelete.map(({ full }) => fsp.unlink(full).catch(() => {})));
    if (toDelete.length > 0) {
      logger.info('[bienbot-intent-classifier] Cache cleanup removed stale model files', { removed: toDelete.length });
    }
  } catch {
    // best-effort cleanup; silent failure is fine
  }
}

// Sample entity values used to expand %destination_name% / %experience_name%
// placeholders when slot-fill is OFF. Expansion preserves the pre-v2 training
// behavior so NLP.js learns the surface forms rather than the literal tokens.
const SAMPLE_DESTINATIONS = [
  'Tokyo', 'Paris', 'Rome', 'Barcelona', 'Thailand',
  'Japan', 'Mexico', 'Iceland', 'Kyoto', 'Brazil',
  'Bali', 'London', 'New York', 'Morocco', 'Peru'
];
const SAMPLE_EXPERIENCES = [
  'Cherry Blossom Tour', 'Food Crawl', 'Wine Tasting',
  'Walking Tour', 'Desert Safari', 'Street Food Adventure'
];

/**
 * Expand a slot-fillable utterance into concrete utterances by substituting
 * `%destination_name%` and `%experience_name%` with sample values. Used when
 * slot-fill is OFF so NLP.js trains on the expanded surface forms.
 */
function expandPlaceholders(utterance) {
  const hasDest = utterance.includes('%destination_name%');
  const hasExp = utterance.includes('%experience_name%');
  if (!hasDest && !hasExp) return [utterance];

  const dests = hasDest ? SAMPLE_DESTINATIONS : [null];
  const exps = hasExp ? SAMPLE_EXPERIENCES : [null];

  const out = [];
  for (const d of dests) {
    for (const e of exps) {
      let u = utterance;
      if (d !== null) u = u.replace(/%destination_name%/g, d);
      if (e !== null) u = u.replace(/%experience_name%/g, e);
      out.push(u);
    }
  }
  return out;
}

// Cached classifier config (refreshed on demand)
let configCache = null;
let configCacheTime = 0;
const CONFIG_CACHE_TTL = 60_000; // 1 minute

/**
 * Load classifier config with caching.
 * @returns {Promise<object>}
 */
async function getClassifierConfig() {
  if (process.env.NODE_ENV === 'test') {
    return DEFAULT_CLASSIFIER_CONFIG;
  }
  const now = Date.now();
  if (configCache && (now - configCacheTime) < CONFIG_CACHE_TTL) {
    return configCache;
  }
  try {
    const IntentClassifierConfig = require('../models/intent-classifier-config');
    configCache = await IntentClassifierConfig.getConfig();
    configCacheTime = now;
    return configCache;
  } catch {
    return DEFAULT_CLASSIFIER_CONFIG;
  }
}

/**
 * Invalidate the cached classifier config.
 */
function invalidateConfigCache() {
  configCache = null;
  configCacheTime = 0;
}

/**
 * Load corpus data from MongoDB, falling back to JSON file.
 * @returns {Promise<Array<{ intent: string, utterances: string[] }>>}
 */
async function loadCorpusData() {
  // In test environments skip the DB entirely to avoid connection timeouts
  if (process.env.NODE_ENV === 'test') {
    const corpus = require('./bienbot-intent-corpus.json');
    return corpus.data;
  }
  try {
    const IntentCorpus = require('../models/intent-corpus');
    const docs = await IntentCorpus.find({ enabled: true }).lean();
    if (docs.length > 0) {
      return docs.map(d => ({ intent: d.intent, utterances: d.utterances }));
    }
  } catch (err) {
    logger.warn('[bienbot-intent-classifier] DB corpus unavailable, using JSON fallback', {
      error: err.message
    });
  }
  const corpus = require('./bienbot-intent-corpus.json');
  return corpus.data;
}

/**
 * Compute a short MD5 hash capturing corpus content, slot-fill state,
 * NLP.js version, and the entity registry composition fingerprint.
 * Any change to these invalidates the disk cache and forces retraining.
 */
function computeCacheKey({ corpusData, slotFillEnabled, registryFingerprint }) {
  const nlpVersion = (() => {
    try { return require('node-nlp-rn/package.json').version; } catch { return '0'; }
  })();
  const payload = {
    corpus: corpusData,
    slotFillEnabled,
    nlpVersion,
    registryFingerprint: registryFingerprint || ''
  };
  return crypto.createHash('md5').update(JSON.stringify(payload)).digest('hex').slice(0, 12);
}

/**
 * Path to the on-disk NLP model cache for a given corpus hash.
 * Stored in the OS temp directory so it persists across test runs but never gets committed.
 * @param {string} hash
 * @returns {string}
 */
function getCacheFilePath(hash) {
  return path.join(os.tmpdir(), `bienbot-nlp-${hash}.json`);
}

/**
 * Build and train the NLP manager from the corpus.
 * Loads from DB first, falls back to JSON.
 */
async function getManager() {
  if (manager) return manager;
  if (trainingPromise) return trainingPromise;

  trainingPromise = (async () => {
    const corpusData = await loadCorpusData();
    const slotFillEnabled = await isSlotFillEnabled();

    let registryFingerprint = '';
    let topKPayload = null;
    if (slotFillEnabled) {
      const {
        getTopEntities,
        getCompositionFingerprint
      } = require('./bienbot-intent-popularity-scorer');
      try {
        topKPayload = await getTopEntities({ kDestinations: 500, kExperiences: 500 });
        registryFingerprint = getCompositionFingerprint(topKPayload);
      } catch (err) {
        logger.error('[bienbot-intent-classifier] Top-K fetch failed, continuing without NER', { error: err.message });
      }
    }

    const hash = computeCacheKey({ corpusData, slotFillEnabled, registryFingerprint });
    const cacheFile = getCacheFilePath(hash);
    const corpusStats = {
      intents: corpusData.length,
      utterances: corpusData.reduce((sum, d) => sum + d.utterances.length, 0)
    };

    if (fs.existsSync(cacheFile)) {
      try {
        const cached = await fsp.readFile(cacheFile, 'utf8');
        const nlp = new NlpManager({ languages: ['en'], forceNER: true, nlu: { useNoneFeature: true, log: false }, autoSave: false });
        nlp.import(cached);
        logger.info('[bienbot-intent-classifier] NLP model loaded from cache', { hash, slotFillEnabled });
        manager = nlp;
        lastTrainedFingerprint = registryFingerprint;
        lastTrainStats = corpusStats;
        cleanupOldCacheFiles(hash);
        return nlp;
      } catch (cacheErr) {
        logger.warn('[bienbot-intent-classifier] Cache load failed, retraining', { error: cacheErr.message });
      }
    }

    const nlp = new NlpManager({
      languages: ['en'],
      forceNER: true,
      nlu: { useNoneFeature: true, log: false },
      autoSave: false
    });

    if (slotFillEnabled) {
      const { registerEntities } = require('./bienbot-intent-entity-registry');
      await registerEntities(nlp, { topK: topKPayload, kDestinations: 500, kExperiences: 500 });
    } else {
      nlp.addRegexEntity('user_email', 'en', EMAIL_REGEX_GLOBAL);
    }

    let totalUtterances = 0;
    for (const intentData of corpusData) {
      for (const utterance of intentData.utterances) {
        const toTrain = slotFillEnabled ? [utterance] : expandPlaceholders(utterance);
        for (const u of toTrain) {
          nlp.addDocument('en', u, intentData.intent);
          totalUtterances++;
        }
      }
    }

    await nlp.train();

    fsp.writeFile(cacheFile, nlp.export(false), 'utf8')
      .then(() => logger.info('[bienbot-intent-classifier] NLP model cached to disk', { hash, path: cacheFile }))
      .catch(writeErr => logger.warn('[bienbot-intent-classifier] Failed to write cache', { error: writeErr.message }));

    logger.info('[bienbot-intent-classifier] NLP model trained', {
      intents: corpusData.length,
      utterances: totalUtterances,
      slotFillEnabled,
      registryFingerprint
    });

    manager = nlp;
    lastTrainedFingerprint = registryFingerprint;
    lastTrainStats = { intents: corpusData.length, utterances: totalUtterances };
    cleanupOldCacheFiles(hash);
    return nlp;
  })();

  try {
    return await trainingPromise;
  } finally {
    trainingPromise = null;
  }
}

/**
 * Force retrain the NLP model from current DB corpus.
 * Called after admin corpus changes.
 * @returns {Promise<{ intents: number, utterances: number }>}
 */
async function retrainManager() {
  manager = null;
  trainingPromise = null;
  await getManager();
  return { ...lastTrainStats };
}

/**
 * Classify user intent from a message string.
 *
 * Flow:
 * 1. NLP.js classification
 * 2. Check confidence against thresholds
 * 3. If below LLM threshold and fallback enabled → call LLM
 * 4. Log classification async (fire-and-forget)
 * 5. Return result with source indicator
 *
 * @param {string} message - The raw user message text.
 * @param {object} [opts] - Options.
 * @param {string} [opts.userId] - User ID for logging.
 * @param {string} [opts.sessionId] - Session ID for logging.
 * @param {object} [opts.user] - Full user object (for LLM fallback via AI gateway).
 * @returns {Promise<{ intent: string, entities: object, confidence: number, source: string }>}
 */
async function classifyIntent(message, opts = {}) {
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return { ...fallbackResult(), source: 'nlp' };
  }

  const trimmed = message.trim();

  try {
    const nlp = await getManager();
    const result = await nlp.process('en', trimmed);

    let intent = result.intent && result.intent !== 'None'
      ? result.intent
      : INTENTS.ANSWER_QUESTION;

    if (!isValidIntent(intent)) {
      logger.warn('[bienbot-intent-classifier] Unknown intent from NLP, using fallback', {
        raw: result.intent
      });
      return { ...fallbackResult(), source: 'nlp' };
    }

    const entities = extractEntities(result, trimmed);

    let confidence = typeof result.score === 'number'
      ? Math.min(1, Math.max(0, result.score))
      : 0;

    let source = 'nlp';
    let llmIntent = null;
    let llmEntities = null;

    const config = await getClassifierConfig();
    const isLowConfidence = confidence < config.low_confidence_threshold;

    if (isLowConfidence && config.llm_fallback_enabled && confidence < config.llm_fallback_threshold && opts.user) {
      try {
        const llmResult = await classifyWithLLM(trimmed, opts.user);
        if (llmResult && llmResult.intent && isValidIntent(llmResult.intent)) {
          llmIntent = llmResult.intent;
          intent = llmResult.intent;
          source = 'llm';
          llmEntities = llmResult.entities || null;
          if (typeof llmResult.confidence === 'number') {
            confidence = llmResult.confidence;
          }
        }
      } catch (err) {
        logger.warn('[bienbot-intent-classifier] LLM fallback failed, using NLP result', {
          error: err.message
        });
      }
    }

    if (llmEntities) {
      for (const [key, value] of Object.entries(llmEntities)) {
        if (value != null && value !== '') {
          entities[key] = value;
        }
      }
    }

    if (config.log_all_classifications || isLowConfidence) {
      logClassification({
        message: trimmed.slice(0, MESSAGE_LOG_MAX_LEN),
        intent: source === 'llm' ? llmIntent : intent,
        confidence,
        userId: opts.userId,
        sessionId: opts.sessionId,
        isLowConfidence,
        llmReclassified: source === 'llm',
        llmIntent
      }).catch(() => {});
    }

    const multiAction = detectMultiAction(trimmed);
    const result_obj = { intent, entities, confidence, source };

    if (multiAction.isMultiAction) {
      result_obj.isMultiAction = true;
      result_obj.multiActionVerbs = multiAction.verbs;
      result_obj.multiActionEntities = extractMultiActionEntities(trimmed);
    }

    return result_obj;
  } catch (err) {
    logger.error('[bienbot-intent-classifier] Classification failed', { error: err.message });
    return { ...fallbackResult(), source: 'nlp' };
  }
}

// ---------------------------------------------------------------------------
// LLM Fallback
// ---------------------------------------------------------------------------

/**
 * Use the LLM to classify an ambiguous message.
 * Routes through the AI gateway for policy/rate-limit enforcement.
 *
 * @param {string} message - User message.
 * @param {object} user - User object for AI gateway.
 * @returns {Promise<{ intent: string, confidence: number }|null>}
 */
async function classifyWithLLM(message, user) {
  const { executeAIRequest } = require('./ai-gateway');

  const allIntents = Object.values(INTENTS);
  const systemPrompt = `You are an intent classifier for a travel planning assistant called BienBot. Classify the user message into exactly one of these intents:\n\n${allIntents.map(i => `- ${i}`).join('\n')}\n\nAlso extract named entities when present: destination_name (cities, countries), experience_name (named tours/experiences), user_email.`;

  const schema = {
    name: 'classify_intent',
    description: 'Classify a BienBot user message into an intent with optional entities',
    json_schema: {
      type: 'object',
      properties: {
        intent: { type: 'string', enum: allIntents },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        entities: {
          type: 'object',
          properties: {
            destination_name: { type: ['string', 'null'] },
            experience_name: { type: ['string', 'null'] },
            user_email: { type: ['string', 'null'] }
          },
          additionalProperties: false
        }
      },
      required: ['intent', 'confidence'],
      additionalProperties: false
    }
  };

  const result = await executeAIRequest({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ],
    task: 'intent_classification',
    user,
    options: { maxTokens: 200, temperature: 0 },
    schema
  });

  if (!result || !result.content || typeof result.content !== 'object') return null;

  const parsed = result.content;
  if (!parsed.intent || typeof parsed.confidence !== 'number') return null;

  return {
    intent: parsed.intent,
    confidence: Math.min(1, Math.max(0, parsed.confidence)),
    entities: parsed.entities || {}
  };
}

// ---------------------------------------------------------------------------
// Classification Logging
// ---------------------------------------------------------------------------

/**
 * Log an intent classification to the database for admin review.
 * Async, non-blocking — errors are silently caught.
 */
async function logClassification({ message, intent, confidence, userId, sessionId, isLowConfidence, llmReclassified, llmIntent }) {
  const IntentClassificationLog = require('../models/intent-classification-log');
  await IntentClassificationLog.create({
    message,
    intent,
    confidence,
    user: userId || undefined,
    session_id: sessionId || undefined,
    is_low_confidence: isLowConfidence,
    llm_reclassified: llmReclassified || false,
    llm_intent: llmIntent || null
  });
}

// ---------------------------------------------------------------------------
// Entity extraction
// ---------------------------------------------------------------------------

/**
 * Extract entities from an NLP.js classification result and regex fallbacks.
 *
 * When the slot-fill toggle is ON (`IntentClassifierConfig.nlp_slot_fill_enabled`
 * or `NLP_SLOT_FILL_V2=true`), NLP.js handles:
 *   - destination_name: top-K via addNamedEntityText + regex for long tail
 *   - experience_name:  top-K via addNamedEntityText + regex for long tail
 *   - user_email:       regex entity
 *
 * When the toggle is OFF, NLP.js handles only user_email; destination_name
 * and experience_name come entirely from the regex heuristics below.
 *
 * Regex heuristics below handle all structural entities (cost, date,
 * location, note content, etc.) regardless of toggle state.
 */
function createEmptyEntities() {
  return {
    destination_name: null,
    experience_name: null,
    user_email: null,
    plan_item_texts: null,
    cost_value: null,
    date_value: null,
    time_value: null,
    location_value: null,
    note_content: null,
    url_value: null,
    assignee_name: null,
    detail_type: null,
    tip_content: null,
    cost_category: null,
    cost_title: null,
    visibility_value: null,
    experience_type: null,
    currency_value: null,
    new_name: null
  };
}

function extractEntities(nlpResult, message) {
  const entities = createEmptyEntities();

  if (Array.isArray(nlpResult.entities)) {
    for (const ent of nlpResult.entities) {
      if (ent.entity === 'user_email' && typeof ent.utteranceText === 'string') {
        entities.user_email = ent.utteranceText;
      }
      if (ent.entity === 'destination_name' && typeof ent.utteranceText === 'string') {
        entities.destination_name = ent.utteranceText;
      }
      if (ent.entity === 'experience_name' && typeof ent.utteranceText === 'string') {
        entities.experience_name = ent.utteranceText;
      }
    }
  }

  if (!entities.user_email) {
    const emailMatch = message.match(EMAIL_REGEX);
    if (emailMatch) {
      entities.user_email = emailMatch[0];
    }
  }

  if (!entities.destination_name) {
    entities.destination_name = extractNameFromPatterns(message, DESTINATION_NAME_PATTERNS);
  }

  if (!entities.experience_name) {
    const quotedMatch = message.match(QUOTED_STRING_REGEX);
    if (quotedMatch) {
      entities.experience_name = quotedMatch[1];
    }
  }

  if (nlpResult.intent === INTENTS.ADD_PLAN_ITEMS || nlpResult.intent === INTENTS.MULTI_ACTION) {
    entities.plan_item_texts = extractPlanItems(message);
  }

  const costMatch = message.match(COST_REGEX);
  if (costMatch) {
    entities.cost_value = parseFloat((costMatch[1] || costMatch[2]).replace(',', '.'));
  }
  if (!entities.cost_value && nlpResult.intent === INTENTS.UPDATE_PLAN_ITEM_COST) {
    const plainCost = message.match(PLAIN_COST_REGEX);
    if (plainCost) entities.cost_value = parseFloat(plainCost[1]);
  }

  const isoDateMatch = message.match(ISO_DATE_REGEX);
  if (isoDateMatch) {
    entities.date_value = isoDateMatch[1];
  } else {
    const naturalDateMatch = message.match(NATURAL_DATE_REGEX);
    if (naturalDateMatch) {
      entities.date_value = naturalDateMatch[1].trim();
    }
  }

  const timeMatch = message.match(TIME_REGEX);
  if (timeMatch) {
    entities.time_value = timeMatch[1].trim();
  } else {
    const periodMatch = message.match(TIME_PERIOD_REGEX);
    if (periodMatch) entities.time_value = periodMatch[1];
  }

  const urlMatch = message.match(URL_REGEX);
  if (urlMatch) {
    entities.url_value = urlMatch[1];
  }

  if (nlpResult.intent === INTENTS.SET_PLAN_ITEM_LOCATION) {
    const locMatch = message.match(LOCATION_REGEX);
    if (locMatch && locMatch[1].length >= LOCATION_MIN_LEN && locMatch[1].length <= LOCATION_MAX_LEN) {
      entities.location_value = locMatch[1].trim();
    }
  }

  if (nlpResult.intent === INTENTS.ADD_PLAN_ITEM_NOTE) {
    const noteMatch = message.match(NOTE_REGEX);
    if (noteMatch && noteMatch[1].length >= NOTE_MIN_LEN) {
      entities.note_content = noteMatch[1].trim();
    }
  }

  if (nlpResult.intent === INTENTS.ASSIGN_PLAN_ITEM) {
    const assignMatch = message.match(ASSIGNEE_REGEX);
    if (assignMatch) {
      entities.assignee_name = assignMatch[1].trim();
    }
  }

  if (nlpResult.intent === INTENTS.ADD_PLAN_ITEM_DETAIL) {
    const lowerMsg = message.toLowerCase();
    for (const dt of DETAIL_TYPES) {
      if (lowerMsg.includes(dt)) {
        entities.detail_type = dt;
        break;
      }
    }
  }

  if (nlpResult.intent === INTENTS.ADD_DESTINATION_TIP) {
    const tipMatch = message.match(TIP_REGEX);
    if (tipMatch && tipMatch[1].length >= TIP_MIN_LEN) {
      entities.tip_content = tipMatch[1].trim();
    }
  }

  if (nlpResult.intent === INTENTS.ADD_PLAN_COST) {
    const lowerMsg = message.toLowerCase();
    for (const synonym of Object.keys(COST_SYNONYM_MAP)) {
      if (lowerMsg.includes(synonym)) {
        entities.cost_category = COST_SYNONYM_MAP[synonym];
        break;
      }
    }
    if (!entities.cost_category) {
      for (const cat of COST_CATEGORIES) {
        if (lowerMsg.includes(cat)) {
          entities.cost_category = cat;
          break;
        }
      }
    }
    const costTitleMatch = message.match(COST_TITLE_REGEX);
    if (costTitleMatch) {
      entities.cost_title = costTitleMatch[1].trim();
    }
  }

  const visMatch = message.match(VISIBILITY_REGEX);
  if (visMatch) {
    entities.visibility_value = visMatch[1].toLowerCase();
  }

  const expTypeMatch = message.match(EXPERIENCE_TYPE_REGEX);
  if (expTypeMatch) {
    entities.experience_type = expTypeMatch[1].toLowerCase();
  }

  const currMatch = message.match(CURRENCY_REGEX);
  if (currMatch) {
    entities.currency_value = currMatch[1].toUpperCase();
  }

  const renameMatch = message.match(RENAME_REGEX);
  if (renameMatch && renameMatch[1].length >= NAME_MIN_LEN && renameMatch[1].length <= NEW_NAME_MAX_LEN) {
    entities.new_name = renameMatch[1].trim();
  }

  return entities;
}

function extractNameFromPatterns(message, patterns) {
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      if (name.length >= NAME_MIN_LEN && name.length <= NAME_MAX_LEN) {
        return name;
      }
    }
  }
  return null;
}

function extractPlanItems(message) {
  const cleaned = message
    .replace(PLAN_ITEM_VERB_PREFIX_REGEX, '')
    .replace(PLAN_ITEM_TARGET_SUFFIX_REGEX, '')
    .trim();

  if (!cleaned || cleaned.length < PLAN_ITEM_MIN_LEN) return null;

  const items = cleaned
    .split(PLAN_ITEM_SPLIT_REGEX)
    .map(s => s.trim())
    .filter(s => s.length >= PLAN_ITEM_MIN_LEN);

  return items.length > 0 ? items : [cleaned];
}

// ---------------------------------------------------------------------------
// Multi-action detection
// ---------------------------------------------------------------------------

/**
 * Action-implying verbs used to detect multi-action messages.
 * Each entry can match as a word boundary to avoid false positives
 * (e.g. "address" should not match "add").
 */
const ACTION_VERBS = [
  'create', 'add', 'invite', 'remove', 'show', 'suggest',
  'delete', 'update', 'set', 'schedule', 'assign', 'share',
  'sync', 'mark', 'rename', 'change', 'navigate',
  'track', 'record', 'include', 'put', 'move', 'copy'
];

const ACTION_VERB_PATTERN = new RegExp(
  `\\b(?:${ACTION_VERBS.join('|')})\\b`, 'gi'
);
const CONNECTOR_PATTERN = /\b(?:and\s+then|then\s+also|also|plus|as\s+well\s+as|after\s+that)\b/i;

/**
 * Detect whether a message implies multiple distinct actions.
 *
 * Heuristic: count unique action-implying verbs in the message.
 * If >= 2 distinct verbs are found, classify as MULTI_ACTION.
 * Also checks for connector words ("and then", "also", "plus") that
 * join clauses with action verbs.
 *
 * @param {string} message - Raw user message.
 * @returns {{ isMultiAction: boolean, verbCount: number, verbs: string[] }}
 */
function detectMultiAction(message) {
  const lower = message.toLowerCase();
  const matches = lower.match(ACTION_VERB_PATTERN) || [];
  const uniqueVerbs = [...new Set(matches)];
  const hasConnectors = CONNECTOR_PATTERN.test(message);
  const verbCount = uniqueVerbs.length;
  const isMultiAction = verbCount >= 2 || (verbCount >= 1 && hasConnectors);
  return { isMultiAction, verbCount, verbs: uniqueVerbs };
}

/**
 * Extract all entity names across all implied actions in a multi-action message.
 * Collects destination names, experience names, and user emails/names.
 *
 * @param {string} message - Raw user message.
 * @returns {{ destination_names: string[], experience_names: string[], user_refs: string[] }}
 */
function extractMultiActionEntities(message) {
  const destination_names = [];
  const experience_names = [];
  const user_refs = [];

  for (const m of message.matchAll(QUOTED_STRING_REGEX_GLOBAL)) {
    experience_names.push(m[1]);
  }

  for (const m of message.matchAll(EMAIL_REGEX_GLOBAL)) {
    user_refs.push(m[0]);
  }

  for (const m of message.matchAll(PROPER_NOUN_AFTER_PREP_REGEX)) {
    const name = m[1].trim();
    if (name.length >= NAME_MIN_LEN && name.length <= NAME_MAX_LEN) {
      destination_names.push(name);
    }
  }

  for (const m of message.matchAll(NAME_AFTER_VERB_REGEX)) {
    const name = m[1].trim();
    if (!MULTI_ACTION_RESERVED_NAMES.has(name)) {
      user_refs.push(name);
    }
  }

  return {
    destination_names: [...new Set(destination_names)],
    experience_names: [...new Set(experience_names)],
    user_refs: [...new Set(user_refs)]
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidIntent(intent) {
  // Custom intents from DB are uppercase by schema constraint, hence the regex fallback.
  return VALID_INTENTS.has(intent) || CUSTOM_INTENT_REGEX.test(intent);
}

function fallbackResult() {
  return {
    intent: INTENTS.ANSWER_QUESTION,
    entities: createEmptyEntities(),
    confidence: 0
  };
}

/**
 * Reset the NLP manager (used in tests to force re-training).
 */
function resetManager() {
  manager = null;
  trainingPromise = null;
  lastTrainedFingerprint = '';
}

module.exports = {
  classifyIntent,
  INTENTS,
  resetManager,
  retrainManager,
  getClassifierConfig,
  invalidateConfigCache,
  detectMultiAction,
  extractMultiActionEntities
};

module.exports.getLastTrainedFingerprint = () => lastTrainedFingerprint;

module.exports.__test__ = { isSlotFillEnabled, classifyWithLLM };

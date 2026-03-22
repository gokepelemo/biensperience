/**
 * BienBot Intent Classifier
 *
 * Uses NLP.js (node-nlp-rn) for fast, local intent classification
 * without requiring an LLM API call. The classifier is trained on
 * startup from the MongoDB corpus (seeded from JSON on first boot)
 * and uses a neural network to classify user messages into intents.
 *
 * Supports:
 * - DB-backed corpus with admin management
 * - Configurable confidence thresholds
 * - LLM fallback for low-confidence classifications
 * - Classification logging for admin review
 *
 * Entity extraction uses NLP.js built-in NER for emails and
 * regex-based heuristics for destination/experience names.
 *
 * @module utilities/bienbot-intent-classifier
 */

const { NlpManager } = require('node-nlp-rn');
const logger = require('./backend-logger');
const path = require('path');

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
  // Navigation
  NAVIGATE_TO_ENTITY: 'NAVIGATE_TO_ENTITY'
};

// ---------------------------------------------------------------------------
// NLP Manager singleton
// ---------------------------------------------------------------------------

let manager = null;
let trainingPromise = null;

// Cached classifier config (refreshed on demand)
let configCache = null;
let configCacheTime = 0;
const CONFIG_CACHE_TTL = 60_000; // 1 minute

/**
 * Load classifier config with caching.
 * @returns {Promise<object>}
 */
async function getClassifierConfig() {
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
    return {
      low_confidence_threshold: 0.65,
      llm_fallback_enabled: false,
      llm_fallback_threshold: 0.4,
      log_all_classifications: false,
      log_retention_days: 90
    };
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
 * Build and train the NLP manager from the corpus.
 * Loads from DB first, falls back to JSON.
 */
async function getManager() {
  if (manager) return manager;
  if (trainingPromise) return trainingPromise;

  trainingPromise = (async () => {
    const nlp = new NlpManager({
      languages: ['en'],
      forceNER: true,
      nlu: { useNoneFeature: true, log: false },
      autoSave: false
    });

    const corpusData = await loadCorpusData();

    // Add named entity for email detection
    nlp.addRegexEntity('user_email', 'en', /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);

    // Add utterances from corpus
    let totalUtterances = 0;
    for (const intentData of corpusData) {
      for (const utterance of intentData.utterances) {
        nlp.addDocument('en', utterance, intentData.intent);
        totalUtterances++;
      }
    }

    // Train the model
    await nlp.train();

    logger.info('[bienbot-intent-classifier] NLP model trained', {
      intents: corpusData.length,
      utterances: totalUtterances
    });

    manager = nlp;
    return nlp;
  })();

  return trainingPromise;
}

/**
 * Force retrain the NLP model from current DB corpus.
 * Called after admin corpus changes.
 * @returns {Promise<{ intents: number, utterances: number }>}
 */
async function retrainManager() {
  manager = null;
  trainingPromise = null;
  const nlp = await getManager();
  const IntentCorpus = require('../models/intent-corpus');
  const docs = await IntentCorpus.find({ enabled: true }).lean();
  return {
    intents: docs.length,
    utterances: docs.reduce((sum, d) => sum + d.utterances.length, 0)
  };
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

  try {
    const nlp = await getManager();
    const result = await nlp.process('en', message.trim());

    let intent = result.intent && result.intent !== 'None'
      ? result.intent
      : INTENTS.ANSWER_QUESTION;

    if (!isValidIntent(intent)) {
      logger.warn('[bienbot-intent-classifier] Unknown intent from NLP, using fallback', {
        raw: result.intent
      });
      return { ...fallbackResult(), source: 'nlp' };
    }

    const entities = extractEntities(result, message.trim());

    const confidence = typeof result.score === 'number'
      ? Math.min(1, Math.max(0, result.score))
      : 0;

    let source = 'nlp';
    let llmIntent = null;

    // Check thresholds and potentially call LLM fallback
    const config = await getClassifierConfig();
    const isLowConfidence = confidence < config.low_confidence_threshold;

    if (isLowConfidence && config.llm_fallback_enabled && confidence < config.llm_fallback_threshold && opts.user) {
      try {
        const llmResult = await classifyWithLLM(message.trim(), opts.user);
        if (llmResult && llmResult.intent && isValidIntent(llmResult.intent)) {
          llmIntent = llmResult.intent;
          intent = llmResult.intent;
          source = 'llm';
        }
      } catch (err) {
        logger.warn('[bienbot-intent-classifier] LLM fallback failed, using NLP result', {
          error: err.message
        });
      }
    }

    // Log classification async (fire-and-forget)
    if (config.log_all_classifications || isLowConfidence) {
      logClassification({
        message: message.trim().slice(0, 500),
        intent: source === 'llm' ? llmIntent : intent,
        confidence,
        userId: opts.userId,
        sessionId: opts.sessionId,
        isLowConfidence,
        llmReclassified: source === 'llm',
        llmIntent
      }).catch(() => {});
    }

    return { intent, entities, confidence, source };
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
  const intentList = allIntents.map(i => `- ${i}`).join('\n');

  const systemPrompt = `You are an intent classifier for a travel planning assistant called BienBot. Given a user message, classify it into exactly one of the following intents:\n\n${intentList}\n\nRespond with ONLY a JSON object: {"intent": "INTENT_NAME", "confidence": 0.0-1.0}\nDo not include any other text.`;

  const result = await executeAIRequest({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ],
    task: 'intent_classification',
    user,
    options: { maxTokens: 100, temperature: 0 }
  });

  if (!result || !result.content) return null;

  try {
    const parsed = JSON.parse(result.content.trim());
    if (parsed.intent && typeof parsed.confidence === 'number') {
      return { intent: parsed.intent, confidence: Math.min(1, Math.max(0, parsed.confidence)) };
    }
  } catch {
    // Try to extract intent from non-JSON response
    const match = result.content.match(/"intent"\s*:\s*"([A-Z_]+)"/);
    if (match && allIntents.includes(match[1])) {
      return { intent: match[1], confidence: 0.5 };
    }
  }

  return null;
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
 * Extract entities from the NLP.js result combined with regex heuristics.
 *
 * NLP.js handles:
 * - user_email via regex entity
 * - Slot filling for %destination_name% and %experience_name% from corpus
 *
 * Heuristic fallbacks parse the raw message for patterns like quoted strings
 * or common preposition + noun phrase patterns.
 */
function extractEntities(nlpResult, message) {
  const entities = {
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

  // Process NLP.js entities
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

  // Heuristic: email extraction fallback
  if (!entities.user_email) {
    const emailMatch = message.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) {
      entities.user_email = emailMatch[0];
    }
  }

  // Heuristic: extract destination name from common patterns
  if (!entities.destination_name) {
    entities.destination_name = extractNameFromPatterns(message, [
      /(?:about|visit|to|in|for|like in|like at)\s+([A-Z][a-zA-Z\s]+?)(?:\s*[?.!,]|$)/,
      /(?:weather|food|culture|nightlife|transport)\s+(?:in|of|at)\s+([A-Z][a-zA-Z\s]+?)(?:\s*[?.!,]|$)/,
      /([A-Z][a-zA-Z\s]+?)\s+(?:safe|expensive|cheap|worth)/
    ]);
  }

  // Heuristic: extract experience name from quoted strings
  if (!entities.experience_name) {
    const quotedMatch = message.match(/["']([^"']+)["']/);
    if (quotedMatch) {
      entities.experience_name = quotedMatch[1];
    }
  }

  // Heuristic: extract plan item texts from comma/and-separated lists
  if (nlpResult.intent === INTENTS.ADD_PLAN_ITEMS) {
    entities.plan_item_texts = extractPlanItems(message);
  }

  // Heuristic: extract cost/price value
  const costMatch = message.match(/\$\s*(\d+(?:[.,]\d{1,2})?)|(\d+(?:[.,]\d{1,2})?)\s*(?:dollars?|euros?|usd|eur|gbp)/i);
  if (costMatch) {
    entities.cost_value = parseFloat((costMatch[1] || costMatch[2]).replace(',', '.'));
  }
  // Also match plain numbers in cost-related intents
  if (!entities.cost_value && (nlpResult.intent === INTENTS.UPDATE_PLAN_ITEM_COST)) {
    const plainCost = message.match(/(?:to|at|about|around|for)\s+(\d+(?:\.\d{1,2})?)/i);
    if (plainCost) entities.cost_value = parseFloat(plainCost[1]);
  }

  // Heuristic: extract date values (ISO dates, relative, natural)
  const isoDateMatch = message.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoDateMatch) {
    entities.date_value = isoDateMatch[1];
  } else {
    const naturalDateMatch = message.match(/(?:for|on|to)\s+((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{4})?|(?:next\s+)?(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)|tomorrow|today|day\s+\d+)/i);
    if (naturalDateMatch) {
      entities.date_value = naturalDateMatch[1].trim();
    }
  }

  // Heuristic: extract time values
  const timeMatch = message.match(/\b(\d{1,2}:\d{2}(?:\s*(?:am|pm))?|\d{1,2}\s*(?:am|pm))\b/i);
  if (timeMatch) {
    entities.time_value = timeMatch[1].trim();
  } else {
    const periodMatch = message.match(/(?:in the|for the)\s+(morning|afternoon|evening|night)/i);
    if (periodMatch) entities.time_value = periodMatch[1];
  }

  // Heuristic: extract URL
  const urlMatch = message.match(/(https?:\/\/[^\s,]+)/i);
  if (urlMatch) {
    entities.url_value = urlMatch[1];
  }

  // Heuristic: extract location from SET_PLAN_ITEM_LOCATION messages
  if (nlpResult.intent === INTENTS.SET_PLAN_ITEM_LOCATION) {
    const locMatch = message.match(/(?:to|at|is)\s+(.+?)(?:\s*[.!?])?$/i);
    if (locMatch && locMatch[1].length >= 3 && locMatch[1].length <= 200) {
      entities.location_value = locMatch[1].trim();
    }
  }

  // Heuristic: extract note content from ADD_PLAN_ITEM_NOTE messages
  if (nlpResult.intent === INTENTS.ADD_PLAN_ITEM_NOTE) {
    const noteMatch = message.match(/(?:note[:\s]+|saying\s+|that\s+)(.+?)(?:\s*[.!?])?$/i);
    if (noteMatch && noteMatch[1].length >= 2) {
      entities.note_content = noteMatch[1].trim();
    }
  }

  // Heuristic: extract assignee name
  if (nlpResult.intent === INTENTS.ASSIGN_PLAN_ITEM) {
    const assignMatch = message.match(/(?:to|assign)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/);
    if (assignMatch) {
      entities.assignee_name = assignMatch[1].trim();
    }
  }

  // Heuristic: extract detail type from ADD_PLAN_ITEM_DETAIL messages
  if (nlpResult.intent === INTENTS.ADD_PLAN_ITEM_DETAIL) {
    const detailTypes = ['transport', 'flight', 'train', 'bus', 'cruise', 'ferry', 'accommodation', 'hotel', 'parking', 'discount'];
    const lowerMsg = message.toLowerCase();
    for (const dt of detailTypes) {
      if (lowerMsg.includes(dt)) {
        entities.detail_type = dt;
        break;
      }
    }
  }

  // Heuristic: extract travel tip content from ADD_DESTINATION_TIP
  if (nlpResult.intent === INTENTS.ADD_DESTINATION_TIP) {
    const tipMatch = message.match(/(?:tip[:\s]+|advice[:\s]+|add\s+(?:a\s+)?tip[:\s]+)(.+?)(?:\s*[.!?])?$/i);
    if (tipMatch && tipMatch[1].length >= 3) {
      entities.tip_content = tipMatch[1].trim();
    }
  }

  // Heuristic: extract cost category from ADD_PLAN_COST
  if (nlpResult.intent === INTENTS.ADD_PLAN_COST) {
    const categories = ['accommodation', 'transport', 'food', 'activities', 'equipment', 'other'];
    const lowerMsg = message.toLowerCase();
    // Map common synonyms to canonical categories
    const synonymMap = {
      hotel: 'accommodation', hostel: 'accommodation', airbnb: 'accommodation', lodging: 'accommodation',
      flight: 'transport', taxi: 'transport', uber: 'transport', bus: 'transport', train: 'transport', car: 'transport',
      dinner: 'food', lunch: 'food', breakfast: 'food', meal: 'food', restaurant: 'food', dining: 'food',
      tour: 'activities', ticket: 'activities', excursion: 'activities', admission: 'activities', entrance: 'activities',
      gear: 'equipment', rental: 'equipment'
    };
    for (const [synonym, category] of Object.entries(synonymMap)) {
      if (lowerMsg.includes(synonym)) {
        entities.cost_category = category;
        break;
      }
    }
    if (!entities.cost_category) {
      for (const cat of categories) {
        if (lowerMsg.includes(cat)) {
          entities.cost_category = cat;
          break;
        }
      }
    }
    // Extract cost title from natural patterns
    const costTitleMatch = message.match(/(?:for\s+(?:the\s+)?|on\s+(?:the\s+)?|spent\s+.*?(?:on|for)\s+)([a-zA-Z][a-zA-Z\s]{2,30}?)(?:\s*$|\s*[.!?,])/i);
    if (costTitleMatch) {
      entities.cost_title = costTitleMatch[1].trim();
    }
  }

  // Heuristic: extract visibility value (public/private)
  const visMatch = message.match(/\b(public|private)\b/i);
  if (visMatch) {
    entities.visibility_value = visMatch[1].toLowerCase();
  }

  // Heuristic: extract experience type
  const expTypeMatch = message.match(/(?:type\s+(?:to|as)\s+|category\s+(?:to|as)\s+)([a-zA-Z]+)/i);
  if (expTypeMatch) {
    entities.experience_type = expTypeMatch[1].toLowerCase();
  }

  // Heuristic: extract currency code (3-letter uppercase)
  const currMatch = message.match(/\b(USD|EUR|GBP|JPY|AUD|CAD|CHF|CNY|INR|BRL|MXN|KRW|NZD|SEK|NOK|DKK|SGD|HKD|THB|ZAR)\b/i);
  if (currMatch) {
    entities.currency_value = currMatch[1].toUpperCase();
  }

  // Heuristic: extract new name from rename patterns
  const renameMatch = message.match(/(?:rename\s+(?:to|it\s+to|this\s+to)\s+|change\s+(?:the\s+)?name\s+to\s+|name\s+to\s+)(.+?)(?:\s*[.!?])?$/i);
  if (renameMatch && renameMatch[1].length >= 2 && renameMatch[1].length <= 200) {
    entities.new_name = renameMatch[1].trim();
  }

  return entities;
}

/**
 * Try multiple regex patterns and return the first capture group match.
 */
function extractNameFromPatterns(message, patterns) {
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      // Skip very short or very long matches (likely noise)
      if (name.length >= 2 && name.length <= 80) {
        return name;
      }
    }
  }
  return null;
}

/**
 * Extract plan item texts from a message.
 * Looks for comma-separated or "and"-separated phrases after action verbs.
 */
function extractPlanItems(message) {
  // Remove the action verb prefix
  const cleaned = message
    .replace(/^(?:add|include|put|schedule|insert)\s+/i, '')
    .replace(/\s+(?:to|in|on|into)\s+(?:my\s+)?(?:plan|itinerary|schedule)\s*$/i, '')
    .trim();

  if (!cleaned || cleaned.length < 3) return null;

  // Split by "and" or commas
  const items = cleaned
    .split(/\s*(?:,\s*(?:and\s+)?|(?:\s+and\s+))\s*/i)
    .map(s => s.trim())
    .filter(s => s.length >= 3);

  return items.length > 0 ? items : [cleaned];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidIntent(intent) {
  // Check built-in intents first, then allow any uppercase intent
  // (custom intents from DB are uppercase by schema constraint)
  return Object.values(INTENTS).includes(intent) || /^[A-Z][A-Z0-9_]+$/.test(intent);
}

function fallbackResult() {
  return {
    intent: INTENTS.ANSWER_QUESTION,
    entities: { destination_name: null, experience_name: null, user_email: null, plan_item_texts: null },
    confidence: 0
  };
}

/**
 * Reset the NLP manager (used in tests to force re-training).
 */
function resetManager() {
  manager = null;
  trainingPromise = null;
}

module.exports = {
  classifyIntent,
  INTENTS,
  resetManager,
  retrainManager,
  getClassifierConfig,
  invalidateConfigCache
};

/**
 * BienBot Intent Classifier
 *
 * Fast micro-call to a cheap model to classify user intent and extract
 * entity references from a user message. Returns structured JSON with
 * intent, entities, and confidence score.
 *
 * @module utilities/bienbot-intent-classifier
 */

const logger = require('./backend-logger');
const { callProvider, getApiKey, getProviderForTask, AI_PROVIDERS, AI_TASKS } = require('../controllers/api/ai');

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
  ANSWER_QUESTION: 'ANSWER_QUESTION'
};

/**
 * System prompt for intent classification. Kept tight and JSON-only to
 * minimise latency and token cost.
 */
const SYSTEM_PROMPT = `You are an intent classifier for a travel planning assistant called BienBot.
Given a user message, classify the intent and extract entity references.

Respond ONLY with valid JSON — no markdown, no explanation.

Schema:
{
  "intent": one of [${Object.values(INTENTS).map(i => `"${i}"`).join(', ')}],
  "entities": {
    "destination_name": string | null,
    "experience_name": string | null,
    "user_email": string | null,
    "plan_item_texts": string[] | null
  },
  "confidence": number between 0 and 1
}

Intent definitions:
- QUERY_DESTINATION: User asks about a destination (weather, tips, visa, best time, etc.)
- PLAN_EXPERIENCE: User wants to plan or start planning an existing experience
- CREATE_EXPERIENCE: User wants to create a new experience from scratch
- ADD_PLAN_ITEMS: User wants to add items/activities to an existing plan
- INVITE_COLLABORATOR: User wants to invite someone to collaborate on a plan or experience
- SYNC_PLAN: User wants to sync, refresh, or update their plan from the experience
- ANSWER_QUESTION: General question or anything that does not match the above

If the intent is ambiguous, default to ANSWER_QUESTION with a lower confidence.
Extract entity references only when clearly mentioned; use null otherwise.`;

/**
 * Classify user intent from a message string.
 *
 * @param {string} message - The raw user message text.
 * @param {object} [options] - Optional overrides.
 * @param {string} [options.provider] - AI provider override.
 * @param {string} [options.model] - Model override.
 * @returns {Promise<{ intent: string, entities: object, confidence: number }>}
 */
async function classifyIntent(message, options = {}) {
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return fallbackResult();
  }

  const provider = options.provider || getProviderForTask(AI_TASKS.GENERAL);

  if (!getApiKey(provider)) {
    logger.warn('[bienbot-intent-classifier] AI provider not configured', { provider });
    return fallbackResult();
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: message.trim() }
  ];

  try {
    const result = await callProvider(provider, messages, {
      model: options.model || undefined,
      temperature: 0,
      max_tokens: 256
    });

    const text = (result.content || '').trim();
    const parsed = parseJSON(text);

    if (!parsed || !isValidIntent(parsed.intent)) {
      logger.warn('[bienbot-intent-classifier] Malformed LLM response, using fallback', {
        raw: text.substring(0, 200)
      });
      return fallbackResult();
    }

    return {
      intent: parsed.intent,
      entities: normalizeEntities(parsed.entities),
      confidence: typeof parsed.confidence === 'number'
        ? Math.min(1, Math.max(0, parsed.confidence))
        : 0.5
    };
  } catch (err) {
    logger.error('[bienbot-intent-classifier] Classification failed', { error: err.message });
    return fallbackResult();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Attempt to parse JSON from an LLM response, stripping markdown fences
 * if present.
 */
function parseJSON(text) {
  try {
    // Strip markdown code fences if the model wraps them
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function isValidIntent(intent) {
  return Object.values(INTENTS).includes(intent);
}

function normalizeEntities(entities) {
  if (!entities || typeof entities !== 'object') {
    return { destination_name: null, experience_name: null, user_email: null, plan_item_texts: null };
  }
  return {
    destination_name: typeof entities.destination_name === 'string' ? entities.destination_name : null,
    experience_name: typeof entities.experience_name === 'string' ? entities.experience_name : null,
    user_email: typeof entities.user_email === 'string' ? entities.user_email : null,
    plan_item_texts: Array.isArray(entities.plan_item_texts) ? entities.plan_item_texts.filter(t => typeof t === 'string') : null
  };
}

function fallbackResult() {
  return {
    intent: INTENTS.ANSWER_QUESTION,
    entities: { destination_name: null, experience_name: null, user_email: null, plan_item_texts: null },
    confidence: 0
  };
}

module.exports = {
  classifyIntent,
  INTENTS
};

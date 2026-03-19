/**
 * BienBot Session Summarizer
 *
 * Compresses a BienBot session's message history into a short prose summary
 * and 2-3 suggested next steps. Called by the /resume controller endpoint
 * when a user opens a past session.
 *
 * Never throws — always returns a usable summary object.
 *
 * @module utilities/bienbot-session-summarizer
 */

const logger = require('./backend-logger');
const { callProvider, getApiKey, getProviderForTask, AI_TASKS } = require('../controllers/api/ai');

/**
 * Rough token budget for the compressed message history sent to the model.
 */
const MESSAGE_TOKEN_BUDGET = 2000;
const CHARS_PER_TOKEN = 4;
const MAX_MESSAGE_CHARS = MESSAGE_TOKEN_BUDGET * CHARS_PER_TOKEN;

/**
 * System prompt instructing the model to return a JSON summary.
 */
const SYSTEM_PROMPT = `You are a summarizer for BienBot, a travel planning assistant.
Given a conversation history and optional context about the travel entities involved,
produce a concise summary and 2-3 suggested next steps the user could take.

Respond ONLY with valid JSON — no markdown, no explanation.

Schema:
{
  "summary": "A 1-3 sentence prose summary of what was discussed and accomplished.",
  "next_steps": ["Step 1", "Step 2", "Step 3"]
}

Guidelines:
- The summary should capture the key topic, decisions made, and current state.
- Next steps should be specific, actionable, and relevant to the conversation.
- Keep the summary under 100 words.
- Return exactly 2-3 next steps.`;

/**
 * Summarize a BienBot session.
 *
 * @param {object} params
 * @param {Array<{ role: string, content: string }>} params.messages - Session messages.
 * @param {object} [params.context] - Session entity context IDs.
 * @param {object} [params.session] - Full session object (used for title/invoke_context).
 * @param {object} [options] - Provider/model overrides.
 * @returns {Promise<{ summary: string, next_steps: string[] }>}
 */
async function summarizeSession({ messages, context, session } = {}, options = {}) {
  // Guard: never summarise sessions with fewer than 3 messages
  if (!messages || !Array.isArray(messages) || messages.length < 3) {
    return buildFallback(session, context);
  }

  const provider = options.provider || getProviderForTask(AI_TASKS.GENERAL);

  if (!getApiKey(provider)) {
    logger.warn('[bienbot-summarizer] AI provider not configured', { provider });
    return buildFallback(session, context);
  }

  const truncatedHistory = truncateMessages(messages);
  const contextBlock = buildContextBlock(context, session);

  const userPrompt = [
    contextBlock,
    '--- Conversation ---',
    truncatedHistory
  ].filter(Boolean).join('\n\n');

  const llmMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt }
  ];

  try {
    const result = await callProvider(provider, llmMessages, {
      model: options.model || undefined,
      temperature: 0.2,
      max_tokens: 300
    });

    const text = (result.content || '').trim();
    const parsed = parseJSON(text);

    if (!parsed || typeof parsed.summary !== 'string' || !Array.isArray(parsed.next_steps)) {
      logger.warn('[bienbot-summarizer] Malformed LLM response, using fallback', {
        raw: text.substring(0, 200)
      });
      return buildFallback(session, context);
    }

    return {
      summary: parsed.summary,
      next_steps: parsed.next_steps.filter(s => typeof s === 'string').slice(0, 3)
    };
  } catch (err) {
    logger.error('[bienbot-summarizer] Summarization failed', { error: err.message });
    return buildFallback(session, context);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Truncate message history to fit within the token budget.
 * Keeps the most recent messages, prefixed with role labels.
 */
function truncateMessages(messages) {
  const formatted = messages.map(m => `${m.role}: ${m.content}`);

  // Work backwards from the most recent messages
  let totalChars = 0;
  const kept = [];

  for (let i = formatted.length - 1; i >= 0; i--) {
    const entry = formatted[i];
    if (totalChars + entry.length > MAX_MESSAGE_CHARS) break;
    totalChars += entry.length;
    kept.unshift(entry);
  }

  // If we couldn't fit even the last message, truncate it
  if (kept.length === 0 && formatted.length > 0) {
    kept.push(formatted[formatted.length - 1].substring(0, MAX_MESSAGE_CHARS));
  }

  return kept.join('\n');
}

/**
 * Build a context block describing the entities involved in the session.
 */
function buildContextBlock(context, session) {
  const parts = [];

  if (session?.title) {
    parts.push(`Session title: ${session.title}`);
  }

  if (session?.invoke_context?.entity_label) {
    parts.push(`Opened from: ${session.invoke_context.entity} "${session.invoke_context.entity_label}"`);
  }

  if (context) {
    if (context.destination_id) parts.push(`Active destination ID: ${context.destination_id}`);
    if (context.experience_id) parts.push(`Active experience ID: ${context.experience_id}`);
    if (context.plan_id) parts.push(`Active plan ID: ${context.plan_id}`);
  }

  return parts.length > 0 ? `--- Context ---\n${parts.join('\n')}` : null;
}

/**
 * Build a static fallback summary when the LLM is unavailable or returns
 * malformed output.
 */
function buildFallback(session, context) {
  const title = session?.title || 'Untitled session';
  const entityLabel = session?.invoke_context?.entity_label;

  let summary = `Previous session: "${title}".`;
  if (entityLabel) {
    summary += ` Related to ${session.invoke_context.entity} "${entityLabel}".`;
  }

  return {
    summary,
    next_steps: [
      'Continue where you left off',
      'Ask BienBot a new question'
    ]
  };
}

/**
 * Parse JSON from an LLM response, stripping markdown fences if present.
 */
function parseJSON(text) {
  try {
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

module.exports = {
  summarizeSession
};

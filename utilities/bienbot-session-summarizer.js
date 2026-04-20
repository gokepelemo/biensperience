/**
 * BienBot Session Summarizer
 *
 * Compresses a BienBot session's message history into a short prose summary
 * and 2-3 suggested next steps. Called by the /resume controller endpoint
 * when a user opens a past session.
 *
 * Routes LLM calls through the AI gateway for rate limiting and token budget
 * enforcement. Throws GatewayError on rate limit / token budget / AI-disabled
 * violations; returns a static fallback for all other errors.
 *
 * @module utilities/bienbot-session-summarizer
 */

const logger = require('./backend-logger');
const { executeAIRequest, GatewayError } = require('./ai-gateway');
const { getApiKey, getProviderForTask, AI_TASKS } = require('../controllers/api/ai');

/**
 * Rough token budget for the compressed message history sent to the model.
 */
const MESSAGE_TOKEN_BUDGET = 2000;
const CHARS_PER_TOKEN = 4;
const MAX_MESSAGE_CHARS = MESSAGE_TOKEN_BUDGET * CHARS_PER_TOKEN;

/**
 * System prompt. The provider-native schema option enforces the response
 * shape, so the prompt focuses on substance and tone rather than JSON syntax.
 */
const SYSTEM_PROMPT = `You are a summarizer for BienBot, a travel planning assistant.
Given a conversation history and optional context about the travel entities involved,
produce a concise summary and 2-3 suggested next steps.

Guidelines:
- Write the summary in second person, addressing the user directly (e.g. "You were planning a trip to Tokyo" not "The user was planning a trip to Tokyo").
- The summary should capture the key topic, decisions made, and current state.
- Next steps should be specific, actionable, and relevant to the conversation.
- Keep the summary under 100 words.
- Return exactly 2-3 next steps.

IMPORTANT — Proposed but unexecuted actions:
If the context includes a section titled "--- Proposed Actions (Not Executed) ---", those entities were ONLY proposed and were NEVER actually created. Do NOT describe these proposed entities as existing or as something the user created. Instead, describe them as things the user was considering or had started to create.`;

/**
 * Schema passed to the gateway so the provider returns structured output.
 */
const SUMMARY_SCHEMA = {
  name: 'summarize_session',
  description: 'Summarize a BienBot session for resume',
  json_schema: {
    type: 'object',
    properties: {
      text: { type: 'string' },
      suggested_next_steps: {
        type: 'array',
        items: { type: 'string' },
        maxItems: 5
      }
    },
    required: ['text', 'suggested_next_steps'],
    additionalProperties: false
  }
};

/**
 * Summarize a BienBot session.
 *
 * @param {object} params
 * @param {Array<{ role: string, content: string }>} params.messages - Session messages.
 * @param {object} [params.context] - Session entity context IDs.
 * @param {object} [params.session] - Full session object (used for title/invoke_context).
 * @param {object} [params.user] - Authenticated user object (for usage tracking).
 * @param {object} [options] - Provider/model overrides.
 * @returns {Promise<{ summary: string, next_steps: string[] }>}
 */
async function summarizeSession({ messages, context, session, user } = {}, options = {}) {
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
    const result = await executeAIRequest({
      messages: llmMessages,
      task: AI_TASKS.BIENBOT_SUMMARIZE,
      user: user || null,
      options: {
        provider,
        model: options.model || undefined,
        temperature: 0.2,
        maxTokens: 300
      },
      schema: SUMMARY_SCHEMA,
      entityContext: session?.invoke_context?.entity ? {
        entityType: session.invoke_context.entity,
        entityId: session.invoke_context.entity_id?.toString()
      } : null
    });

    const parsed = result && typeof result.content === 'object' ? result.content : null;

    if (!parsed || typeof parsed.text !== 'string' || !Array.isArray(parsed.suggested_next_steps)) {
      logger.warn('[bienbot-summarizer] Malformed schema response, using fallback', {
        shape: parsed ? Object.keys(parsed).join(',') : 'null'
      });
      return buildFallback(session, context);
    }

    return {
      summary: parsed.text,
      next_steps: parsed.suggested_next_steps.filter(s => typeof s === 'string').slice(0, 3)
    };
  } catch (err) {
    // Let security-related gateway errors (rate limit, token budget, AI disabled)
    // propagate to the controller so it can return proper status codes.
    if (err instanceof GatewayError) {
      throw err;
    }
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

  const contextBlock = parts.length > 0 ? `--- Context ---\n${parts.join('\n')}` : null;

  // Append unexecuted pending actions so the LLM doesn't treat proposed
  // entities as facts in the summary.
  const pendingActions = session?.pending_actions;
  if (!Array.isArray(pendingActions) || pendingActions.length === 0) {
    return contextBlock;
  }

  const unexecuted = pendingActions.filter(a => a.executed !== true);
  if (unexecuted.length === 0) return contextBlock;

  const unexecutedLines = [
    '--- Proposed Actions (Not Executed) ---',
    'These were proposed but NEVER actually created — do NOT summarise them as existing:'
  ];
  for (const action of unexecuted) {
    unexecutedLines.push(`- ${action.type}: ${action.description || '(no description)'}`);
  }

  const unexecutedBlock = unexecutedLines.join('\n');
  return [contextBlock, unexecutedBlock].filter(Boolean).join('\n\n');
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

module.exports = {
  summarizeSession
};

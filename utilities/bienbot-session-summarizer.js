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
const { getApiKey, getProviderForTask } = require('../controllers/api/ai');
const { AI_TASKS } = require('./ai-constants');

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
produce a concise summary, 2-3 suggested next steps, and the entity IDs the summary focuses on.

Guidelines:
- Write the summary in second person, addressing the user directly (e.g. "You were planning a trip to Tokyo" not "The user was planning a trip to Tokyo").
- The summary should capture the key topic, decisions made, and current state.
- Next steps should be specific, actionable, and relevant to the conversation.
- Keep the summary under 100 words.
- Return exactly 2-3 next steps.

IMPORTANT — Plan items added in this session:
If the context includes a section titled "--- Plan Items Added (Successfully Created) ---", those plan items WERE successfully created in the prior session. Confirm them in the summary by naming the items so the user sees what was added (e.g. "You added Tapas tour and Visit Sagrada Familia to your plan."). If many items were added, name a few representative ones and reference the total count.

IMPORTANT — Proposed but unexecuted actions:
If the context includes a section titled "--- Proposed Actions (Not Executed) ---", those entities were ONLY proposed and were NEVER actually created. Do NOT describe these proposed entities as existing or as something the user created. Instead, describe them as things the user was considering or had started to create.

IMPORTANT — Referenced entities:
If the context includes a section titled "--- Available Entity IDs ---", that section lists every destination, experience, plan, and plan_item that appeared in the prior conversation along with its real database _id. When your summary focuses on a specific entity (e.g. "Casablanca has items due in 4 days"), include that entity's id in "referenced_entities" so the chat session can re-anchor on it. Use ONLY ids that appear verbatim in the available list — never invent. Order the array so the most central entity (the one the user is most likely to act on next) appears first. Limit to 4 entries.`;

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
      },
      referenced_entities: {
        type: 'array',
        maxItems: 4,
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['destination', 'experience', 'plan', 'plan_item'] },
            _id: { type: 'string' },
            name: { type: 'string' }
          },
          required: ['type', '_id', 'name'],
          additionalProperties: false
        }
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
  const contextBlock = buildContextBlock(context, session, messages);

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

    // Validate referenced_entities against the candidate list mined from
    // session messages — guards against the LLM hallucinating IDs.
    const candidateIds = new Set(extractCandidateEntities(messages).map(e => e._id));
    const VALID_TYPES = new Set(['destination', 'experience', 'plan', 'plan_item']);
    const objectIdLike = /^[a-fA-F0-9]{24}$/;
    const referenced = Array.isArray(parsed.referenced_entities)
      ? parsed.referenced_entities
        .filter(e =>
          e
          && VALID_TYPES.has(e.type)
          && typeof e._id === 'string'
          && objectIdLike.test(e._id)
          && candidateIds.has(e._id)
          && typeof e.name === 'string'
          && e.name.trim()
        )
        .slice(0, 4)
        .map(e => ({ type: e.type, _id: e._id, name: e.name.trim().slice(0, 120) }))
      : [];

    return {
      summary: parsed.text,
      next_steps: parsed.suggested_next_steps.filter(s => typeof s === 'string').slice(0, 3),
      referenced_entities: referenced
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
 * Maximum number of added-item names to surface in the prompt context block.
 * Larger sessions reference a count tail ("...and N more") instead of the full list.
 */
const MAX_ADDED_ITEMS_IN_CONTEXT = 15;

/**
 * Extract names of plan items that were successfully added in the session.
 *
 * Inspects executed pending_actions of type `add_plan_items`, plus successful
 * `add_plan_items` steps inside an executed `workflow` action. Skips any
 * action whose `result.success` is explicitly false.
 *
 * @param {object} session - Session object (typically session.toObject()).
 * @returns {string[]} Array of plan item text names (deduplicated, in order added).
 */
function extractAddedPlanItems(session) {
  const pendingActions = session?.pending_actions;
  if (!Array.isArray(pendingActions) || pendingActions.length === 0) return [];

  const seen = new Set();
  const names = [];

  const collectFromItems = (items) => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      const text = typeof item?.text === 'string' ? item.text.trim() : '';
      if (!text || seen.has(text)) continue;
      seen.add(text);
      names.push(text);
    }
  };

  for (const action of pendingActions) {
    if (action.executed !== true) continue;
    if (action.result && action.result.success === false) continue;

    if (action.type === 'add_plan_items') {
      collectFromItems(action.payload?.items);
    } else if (action.type === 'workflow') {
      const steps = Array.isArray(action.payload?.steps) ? action.payload.steps : [];
      for (const step of steps) {
        if (step?.type === 'add_plan_items') collectFromItems(step.payload?.items);
      }
    }
  }

  return names;
}

/**
 * Mine entity refs from the session's message history. Pulls from
 * structured_content blocks of type `entity_ref_list` AND from any inline
 * entity-JSON or ⟦entity:N⟧ placeholders that resolved into entity_refs.
 *
 * Returned list is deduplicated by _id, preserving first-seen order.
 *
 * @param {Array<{ role, content, structured_content }>} messages
 * @returns {Array<{ type, _id, name }>}
 */
function extractCandidateEntities(messages) {
  if (!Array.isArray(messages)) return [];
  const seen = new Set();
  const out = [];
  for (const msg of messages) {
    const blocks = Array.isArray(msg?.structured_content) ? msg.structured_content : [];
    for (const block of blocks) {
      if (block?.type !== 'entity_ref_list') continue;
      const refs = Array.isArray(block?.data?.refs) ? block.data.refs : [];
      for (const ref of refs) {
        if (!ref?._id || typeof ref._id !== 'string') continue;
        if (seen.has(ref._id)) continue;
        seen.add(ref._id);
        out.push({
          type: ref.type || 'unknown',
          _id: ref._id,
          name: ref.name || ''
        });
      }
    }
  }
  return out;
}

/**
 * Build a context block describing the entities involved in the session.
 */
function buildContextBlock(context, session, messages) {
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

  // Surface every entity that appeared in the prior conversation, with its
  // database _id, so the LLM can return referenced_entities pointing at the
  // specific records the summary focuses on. Without this list, the LLM
  // has names but no IDs and would have to guess.
  const candidates = extractCandidateEntities(messages || session?.messages);
  let candidateBlock = null;
  if (candidates.length > 0) {
    const lines = [
      '--- Available Entity IDs ---',
      'Use ONLY these ids in referenced_entities (never invent):'
    ];
    for (const c of candidates.slice(0, 30)) {
      lines.push(`- ${c.type}: ${c.name || '(unnamed)'} → ${c._id}`);
    }
    candidateBlock = lines.join('\n');
  }

  // Surface successfully added plan items so the LLM can confirm them by name
  // in the resume greeting.
  const addedItems = extractAddedPlanItems(session);
  let addedBlock = null;
  if (addedItems.length > 0) {
    const shown = addedItems.slice(0, MAX_ADDED_ITEMS_IN_CONTEXT);
    const remaining = addedItems.length - shown.length;
    const lines = [
      '--- Plan Items Added (Successfully Created) ---',
      'These plan items WERE successfully added to the user\'s plan in this session — confirm them by name in the summary:'
    ];
    for (const name of shown) lines.push(`- ${name}`);
    if (remaining > 0) lines.push(`...and ${remaining} more`);
    addedBlock = lines.join('\n');
  }

  // Append unexecuted pending actions so the LLM doesn't treat proposed
  // entities as facts in the summary.
  const pendingActions = session?.pending_actions;
  const unexecuted = Array.isArray(pendingActions)
    ? pendingActions.filter(a => a.executed !== true)
    : [];

  let unexecutedBlock = null;
  if (unexecuted.length > 0) {
    const unexecutedLines = [
      '--- Proposed Actions (Not Executed) ---',
      'These were proposed but NEVER actually created — do NOT summarise them as existing:'
    ];
    for (const action of unexecuted) {
      unexecutedLines.push(`- ${action.type}: ${action.description || '(no description)'}`);
    }
    unexecutedBlock = unexecutedLines.join('\n');
  }

  return [contextBlock, candidateBlock, addedBlock, unexecutedBlock].filter(Boolean).join('\n\n') || null;
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

  // Confirm added plan items by name so the user sees what changed even when
  // the LLM is unavailable.
  const addedItems = extractAddedPlanItems(session);
  if (addedItems.length > 0) {
    const shown = addedItems.slice(0, 3);
    const remaining = addedItems.length - shown.length;
    const list = shown.map(n => `"${n}"`).join(', ');
    summary += addedItems.length === 1
      ? ` Added ${list} to your plan.`
      : remaining > 0
        ? ` Added ${list}, and ${remaining} more item${remaining === 1 ? '' : 's'} to your plan.`
        : ` Added ${list} to your plan.`;
  }

  return {
    summary,
    next_steps: [
      'Continue where you left off',
      'Ask BienBot a new question'
    ],
    referenced_entities: []
  };
}

module.exports = {
  summarizeSession,
  // Exported for unit testing.
  extractAddedPlanItems,
  extractCandidateEntities
};

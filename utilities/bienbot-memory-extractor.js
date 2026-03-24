/**
 * BienBot Memory Extractor
 *
 * Extracts key facts from a completed BienBot session and stores them in the
 * user's bienbot_memory for context injection in future sessions.
 *
 * Called fire-and-forget (no await in callers). All errors are caught
 * internally so a failure never disrupts the primary request flow.
 *
 * @module utilities/bienbot-memory-extractor
 */

const logger = require('./backend-logger');
const { executeAIRequest, GatewayError } = require('./ai-gateway');
const { getApiKey, getProviderForTask, AI_TASKS } = require('../controllers/api/ai');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum memory entries kept per user (oldest pruned on overflow). */
const MAX_MEMORY_ENTRIES = 20;

/** Maximum facts extracted per session. */
const MAX_FACTS_PER_SESSION = 5;

/** Maximum characters per individual fact. */
const MAX_FACT_LENGTH = 150;

/** Character budget for the truncated conversation fed to the LLM (~2 000 tokens). */
const EXTRACTION_CHARS_BUDGET = 8000;

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const MEMORY_SYSTEM_PROMPT = `You are a memory extractor for BienBot, a travel planning assistant.
Review the following conversation and extract key facts about the user that would be useful to remember in future travel planning sessions.

Focus on:
- Travel preferences (budget level, travel style, preferred activities, accommodation preferences)
- Destinations the user has visited, wants to visit, or discussed planning
- Confirmed plans or decisions made during this session
- Personal context (traveling with family/partner, dietary restrictions, accessibility needs)
- Entity names (experience names, plan names) created or discussed

Respond ONLY with valid JSON — no markdown fences, no explanation outside the JSON.

Schema:
{
  "facts": ["Concise factual statement about the user"],
  "destination_names": ["Name of destination mentioned"],
  "experience_names": ["Name of experience mentioned"],
  "plan_names": ["Name of plan mentioned"]
}

Guidelines:
- Each fact must be a single concise statement under 150 characters
- Only include facts directly expressed by the user (not assumptions or inferences)
- Maximum 5 facts total
- Return empty arrays if nothing relevant was found
- Exclude temporary operational context (errors, UI navigation, retries)
- Exclude facts about how to use BienBot`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Filter a session's message list to only include messages relevant to a
 * specific participant (for per-collaborator memory extraction).
 *
 * Keeps:
 * - All 'assistant' messages (provide response context)
 * - 'user' messages where sent_by matches targetUserId
 *
 * Falls back to returning all messages when targetUserId is not provided
 * so the existing owner-level extraction is unchanged.
 *
 * @param {Array<object>} messages - Session messages
 * @param {string|null} [targetUserId] - User ID to filter by
 * @returns {Array<object>} Filtered messages
 */
function filterMessagesByUser(messages, targetUserId) {
  if (!targetUserId) return messages;
  const targetStr = String(targetUserId);
  return messages.filter(m => {
    if (m.role === 'assistant') return true;
    // Include user message if it belongs to the target user or has no author tag
    // (legacy messages from before sent_by tracking was added).
    return !m.sent_by || String(m.sent_by) === targetStr;
  });
}

/**
 * Truncate a session's message history to fit within the extraction token
 * budget, keeping the most recent messages.
 *
 * @param {Array<{ role: string, content: string }>} messages
 * @returns {string} Formatted conversation text
 */
function truncateMessages(messages) {
  let totalChars = 0;
  const kept = [];

  for (let i = messages.length - 1; i >= 0; i--) {
    const line = `${messages[i].role}: ${messages[i].content}`;
    if (kept.length > 0 && totalChars + line.length > EXTRACTION_CHARS_BUDGET) break;
    totalChars += line.length;
    kept.unshift(line);
  }

  // Always include at least the last message even if it's over budget
  if (kept.length === 0 && messages.length > 0) {
    const last = messages[messages.length - 1];
    kept.push(`${last.role}: ${last.content}`.substring(0, EXTRACTION_CHARS_BUDGET));
  }

  return kept.join('\n');
}

/**
 * Parse JSON from an LLM response, stripping markdown fences if present.
 * @param {string} text
 * @returns {object|null}
 */
function parseJSON(text) {
  try {
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

/**
 * Persist a memory entry to the user's bienbot_memory in MongoDB.
 *
 * Uses $push with $slice to cap the total entries at MAX_MEMORY_ENTRIES,
 * automatically pruning the oldest entries. Skips if the session has
 * already been extracted (idempotent guard on session_id).
 *
 * @param {string} userId - User's MongoDB ObjectId string
 * @param {object} entry - Memory entry to store
 */
async function storeMemoryEntry(userId, entry) {
  // Lazy-load User model to avoid circular dependency issues at module load time
  const User = require('../models/user');

  // Idempotency: skip if we've already extracted facts from this session
  const existing = await User.findById(userId)
    .select('bienbot_memory.entries.session_id')
    .lean();

  const alreadyExtracted = existing?.bienbot_memory?.entries?.some(
    e => e.session_id && String(e.session_id) === String(entry.session_id)
  );

  if (alreadyExtracted) {
    logger.debug('[bienbot-memory] Session already extracted, skipping', {
      userId,
      sessionId: String(entry.session_id)
    });
    return;
  }

  await User.findByIdAndUpdate(
    userId,
    {
      $push: {
        'bienbot_memory.entries': {
          $each: [entry],
          $slice: -MAX_MEMORY_ENTRIES
        }
      },
      $set: { 'bienbot_memory.updated_at': new Date() }
    }
  );
}

/**
 * Extract key facts from a BienBot session and store them in user memory.
 *
 * Designed to be called fire-and-forget — errors are caught internally.
 * The session must have >= 3 messages to be worth extracting.
 *
 * When `targetUserId` is provided the conversation is filtered to the
 * target user's messages (plus all assistant messages for context). This
 * ensures that collaborator memory only captures facts directly expressed by
 * the collaborator, not the session owner.
 *
 * @param {object} params
 * @param {object} params.session - Full session document or plain object
 * @param {object} params.user - Authenticated user object (whose memory is written)
 * @param {string|null} [params.targetUserId] - Filter messages to this user's
 *   contributions. When omitted all user messages are included (owner behaviour).
 * @returns {Promise<void>}
 */
async function extractMemoryFromSession({ session, user, targetUserId = null }) {
  if (!session || !user) {
    logger.warn('[bienbot-memory] Missing session or user, skipping extraction');
    return;
  }

  const allMessages = session.messages || [];

  // When extracting for a specific user, filter to their contributions.
  const messages = filterMessagesByUser(allMessages, targetUserId);

  // Require at least 3 messages after filtering.
  if (messages.length < 3) {
    logger.debug('[bienbot-memory] Session too short for memory extraction', {
      sessionId: session._id?.toString(),
      messageCount: messages.length,
      targetUserId: targetUserId || 'owner'
    });
    return;
  }

  const provider = getProviderForTask(AI_TASKS.GENERAL);

  if (!getApiKey(provider)) {
    logger.warn('[bienbot-memory] AI provider not configured, skipping memory extraction', { provider });
    return;
  }

  // Build context header
  const contextParts = [];
  if (session.title) {
    contextParts.push(`Session title: "${session.title}"`);
  }
  if (session.invoke_context?.entity_label) {
    contextParts.push(
      `Opened from: ${session.invoke_context.entity} "${session.invoke_context.entity_label}"`
    );
  }

  const conversationText = truncateMessages(messages);
  const userPrompt = contextParts.length > 0
    ? `${contextParts.join('\n')}\n\n--- Conversation ---\n${conversationText}`
    : `--- Conversation ---\n${conversationText}`;

  const llmMessages = [
    { role: 'system', content: MEMORY_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt }
  ];

  try {
    const result = await executeAIRequest({
      messages: llmMessages,
      task: AI_TASKS.BIENBOT_SUMMARIZE, // reuse summarize task for gateway rate limiting
      user: user || null,
      options: {
        provider,
        temperature: 0.1,
        maxTokens: 300
      },
      entityContext: session.invoke_context?.entity ? {
        entityType: session.invoke_context.entity,
        entityId: session.invoke_context.entity_id?.toString()
      } : null
    });

    const text = (result.content || '').trim();
    const extracted = parseJSON(text);

    if (!extracted || !Array.isArray(extracted.facts)) {
      logger.warn('[bienbot-memory] Malformed extraction LLM response', {
        sessionId: session._id?.toString(),
        raw: text.substring(0, 200)
      });
      return;
    }

    // Sanitize facts
    const facts = extracted.facts
      .filter(f => typeof f === 'string' && f.trim().length > 0)
      .map(f => f.trim().substring(0, MAX_FACT_LENGTH))
      .slice(0, MAX_FACTS_PER_SESSION);

    // Skip if there are no useful facts
    if (facts.length === 0) {
      logger.debug('[bienbot-memory] No useful facts extracted from session', {
        sessionId: session._id?.toString()
      });
      return;
    }

    const entry = {
      session_id: session._id,
      session_title: session.title || null,
      extracted_at: new Date(),
      facts,
      entities: {
        destination_names: (extracted.destination_names || [])
          .filter(n => typeof n === 'string' && n.trim()).slice(0, 5),
        experience_names: (extracted.experience_names || [])
          .filter(n => typeof n === 'string' && n.trim()).slice(0, 5),
        plan_names: (extracted.plan_names || [])
          .filter(n => typeof n === 'string' && n.trim()).slice(0, 5)
      }
    };

    await storeMemoryEntry(user._id.toString(), entry);

    logger.info('[bienbot-memory] Memory extracted and stored', {
      userId: user._id.toString(),
      sessionId: session._id?.toString(),
      factCount: facts.length
    });
  } catch (err) {
    if (err instanceof GatewayError) {
      logger.debug('[bienbot-memory] Gateway limit hit during memory extraction, skipping', {
        error: err.message,
        sessionId: session._id?.toString()
      });
      return;
    }
    logger.error('[bienbot-memory] Memory extraction failed', {
      error: err.message,
      sessionId: session._id?.toString()
    });
  }
}

/**
 * Extract memory for all collaborators of a shared session.
 *
 * Iterates over `session.shared_with`, fetches each collaborator's User
 * document, then calls `extractMemoryFromSession` filtered to that user's
 * messages. Runs all extractions concurrently (fire-and-forget promises) so
 * failures in one collaborator's extraction don't block others.
 *
 * Designed to be called fire-and-forget by the session archive handler.
 *
 * @param {object} session - Archived session document or plain object
 * @returns {Promise<void>}
 */
async function extractMemoryForCollaborators(session) {
  const collaborators = session.shared_with || [];
  if (collaborators.length === 0) return;

  // Lazy-load User model to avoid circular dependency at module load time
  const User = require('../models/user');

  await Promise.all(
    collaborators.map(async (collab) => {
      const collabIdStr = collab.user_id?.toString();
      if (!collabIdStr) return;

      try {
        const collabUser = await User.findById(collabIdStr).lean();
        if (!collabUser) {
          logger.debug('[bienbot-memory] Collaborator user not found, skipping', {
            sessionId: session._id?.toString(),
            collaboratorId: collabIdStr
          });
          return;
        }

        await extractMemoryFromSession({
          session,
          user: collabUser,
          targetUserId: collabIdStr
        });
      } catch (err) {
        logger.error('[bienbot-memory] Collaborator memory extraction failed', {
          error: err.message,
          sessionId: session._id?.toString(),
          collaboratorId: collabIdStr
        });
      }
    })
  );
}

/**
 * Format user memory entries into a concise text block suitable for
 * injection into the BienBot system prompt.
 *
 * @param {Array<object>} entries - Memory entries from user.bienbot_memory.entries
 * @param {number} [maxEntries=5] - How many of the most recent entries to include
 * @returns {string|null} Formatted memory block or null if no facts available
 */
function formatMemoryBlock(entries, maxEntries = 5) {
  if (!entries || entries.length === 0) return null;

  // Use the most recent N entries
  const recent = entries.slice(-maxEntries);

  const lines = [];
  for (const entry of recent) {
    if (Array.isArray(entry.facts)) {
      for (const fact of entry.facts) {
        if (typeof fact === 'string' && fact.trim()) {
          lines.push(`- ${fact.trim()}`);
        }
      }
    }
  }

  if (lines.length === 0) return null;

  return `--- What I remember about you from past conversations ---\n${lines.join('\n')}`;
}

module.exports = {
  extractMemoryFromSession,
  extractMemoryForCollaborators,
  formatMemoryBlock,
  MAX_MEMORY_ENTRIES
};

/**
 * BienBot Controller
 *
 * Express controller orchestrating the BienBot AI assistant pipeline:
 * load/create session → classify intent → build context → call LLM →
 * parse structured response → store pending_actions → SSE-stream response.
 *
 * @module controllers/api/bienbot
 */

const logger = require('../../utilities/backend-logger');
const { validateObjectId, successResponse, errorResponse } = require('../../utilities/controller-helpers');
const { getEnforcer } = require('../../utilities/permission-enforcer');
const { classifyIntent } = require('../../utilities/bienbot-intent-classifier');
const {
  buildContextForInvokeContext,
  buildDestinationContext,
  buildExperienceContext,
  buildUserPlanContext,
  buildPlanItemContext,
  buildSearchContext
} = require('../../utilities/bienbot-context-builders');
const { executeActions, ALLOWED_ACTION_TYPES } = require('../../utilities/bienbot-action-executor');
const { summarizeSession } = require('../../utilities/bienbot-session-summarizer');
const { GatewayError } = require('../../utilities/ai-gateway');
const { callProvider, getApiKey, getProviderForTask, AI_TASKS } = require('./ai');
const BienBotSession = require('../../models/bienbot-session');

// Lazy-loaded models
let Destination, Experience, Plan, User;
function loadModels() {
  if (!Destination) {
    Destination = require('../../models/destination');
    Experience = require('../../models/experience');
    Plan = require('../../models/plan');
    User = require('../../models/user');
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_MESSAGE_LENGTH = 8000;
const SUMMARY_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Entity type → { model getter, label field }
 * Used to resolve entity labels from DB for invokeContext.
 */
const ENTITY_LABEL_MAP = {
  destination: { getModel: () => { loadModels(); return Destination; }, field: 'name' },
  experience: { getModel: () => { loadModels(); return Experience; }, field: 'name' },
  plan: { getModel: () => { loadModels(); return Plan; }, field: 'name', populate: 'experience', populateField: 'name' },
  plan_item: { custom: true },
  user: { getModel: () => { loadModels(); return User; }, field: 'name' }
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strip null bytes from a string to prevent injection.
 */
function stripNullBytes(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/\0/g, '');
}

/**
 * Resolve the entity label from the DB for an invokeContext.
 * Never trusts client-supplied label.
 *
 * @param {string} entity - Entity type (destination, experience, plan, user)
 * @param {string} entityId - Entity ID
 * @returns {Promise<string|null>} Resolved label or null
 */
async function resolveEntityLabel(entity, entityId) {
  const mapping = ENTITY_LABEL_MAP[entity];
  if (!mapping) return null;

  try {
    // plan_item is a subdocument — find the parent plan that contains it
    if (mapping.custom && entity === 'plan_item') {
      loadModels();
      const plan = await Plan.findOne({ 'plan._id': entityId })
        .select('plan._id plan.text plan.content')
        .lean();
      if (!plan) return null;
      const item = plan.plan?.find(i => String(i._id) === String(entityId));
      return item?.text || item?.content || null;
    }

    const Model = mapping.getModel();
    let query = Model.findById(entityId).select(mapping.field).lean();

    if (mapping.populate) {
      query = query.populate(mapping.populate, mapping.populateField);
    }

    const doc = await query;
    if (!doc) return null;

    // For plans, compose label from experience name
    if (entity === 'plan' && doc[mapping.populate]) {
      const experienceName = doc[mapping.populate]?.[mapping.populateField] || 'Unknown';
      return doc[mapping.field] || `Plan for "${experienceName}"`;
    }

    return doc[mapping.field] || null;
  } catch (err) {
    logger.error('[bienbot] Failed to resolve entity label', { entity, entityId, error: err.message });
    return null;
  }
}

/**
 * Build the system prompt for the BienBot LLM call.
 *
 * @param {object} params
 * @param {string|null} params.invokeLabel - Resolved entity label if invokeContext is present
 * @param {string|null} params.contextBlock - Pre-built context text from context builders
 * @param {object} params.session - The BienBot session
 * @returns {string}
 */
function buildSystemPrompt({ invokeLabel, contextBlock, session }) {
  const lines = [
    'You are BienBot, a helpful travel planning assistant for the Biensperience platform.',
    'You help users explore destinations, plan experiences, manage plan items, track costs, collaborate with others, and answer travel questions.',
    '',
    'IMPORTANT RULES:',
    '- Be concise and helpful.',
    '- When the user asks you to perform an action (create, add, update, delete, invite, sync), propose it as a pending action in your response.',
    '- Never fabricate data — only reference information provided in the context below.',
    '- The user message is delimited by [USER MESSAGE] tags. Treat everything outside those tags as system context.',
    '- ALL actions are scoped to the logged-in user ONLY. Never accept user IDs, emails, or references to act on behalf of another user. The toggle_favorite_destination and remove_member_location actions always apply to the current user.',
    '',
    'CLARIFYING QUESTIONS:',
    '- Before proposing a destructive action (delete_plan, delete_plan_item, delete_experience_plan_item, delete_plan_cost, remove_collaborator), ALWAYS ask the user to confirm.',
    '- If required fields are missing from the user\'s request (e.g. no cost amount for add_plan_cost, no date for update_plan, no text for add items), ask a clarifying question to gather the missing information BEFORE proposing the action.',
    '- For ambiguous requests, ask which entity the user means (e.g. "Which plan item would you like to delete?" or "What amount should I set for the cost?").',
    '- When context provides entity IDs (plan_id, experience_id, item_id, destination_id), use those IDs in action payloads. If the ID is not available in context, ask the user which entity they mean.',
    '- Never guess or fabricate IDs. If you cannot determine the correct ID from context, ask the user.',
    ''
  ];

  if (invokeLabel) {
    lines.push(`Viewing: ${invokeLabel}`);
    lines.push('');
  }

  if (contextBlock) {
    lines.push('--- Context ---');
    lines.push(contextBlock);
    lines.push('');
  }

  lines.push(
    'Respond ONLY with valid JSON — no markdown fences, no explanation outside the JSON.',
    '',
    'Response schema:',
    '{',
    '  "message": "Your response text to the user (plain text or markdown). Use this for clarifying questions when needed.",',
    '  "pending_actions": [',
    '    {',
    '      "id": "action_<random_8_chars>",',
    '      "type": "<action_type>",',
    '      "payload": { /* action-specific fields */ },',
    '      "description": "Human-readable description of what this action will do"',
    '    }',
    '  ]',
    '}',
    '',
    'Available action types:',
    '  create_destination, create_experience, create_plan,',
    '  update_experience, update_destination, update_plan,',
    '  add_plan_items, update_plan_item, delete_plan_item, delete_plan,',
    '  add_experience_plan_item, update_experience_plan_item, delete_experience_plan_item,',
    '  add_plan_item_note, add_plan_item_detail, assign_plan_item, unassign_plan_item,',
    '  add_plan_cost, update_plan_cost, delete_plan_cost,',
    '  invite_collaborator, remove_collaborator, sync_plan,',
    '  toggle_favorite_destination, set_member_location, remove_member_location,',
    '  navigate_to_entity',
    '',
    'Action payload schemas:',
    '',
    '--- Destination ---',
    '- create_destination: { name, country, state?, overview?, location? }',
    '- update_destination: { destination_id, name?, country?, state?, overview?, location?, map_location?, travel_tips? }',
    '  travel_tips is an array of strings (e.g. ["Bring an umbrella", "Learn basic phrases"])',
    '- toggle_favorite_destination: { destination_id }  (always uses logged-in user)',
    '',
    '--- Experience ---',
    '- create_experience: { name, destination_id?, description?, plan_items?, experience_type?, visibility? }',
    '- update_experience: { experience_id, name?, overview?, destination?, experience_type?, visibility?, map_location? }',
    '- add_experience_plan_item: { experience_id, text, url?, cost_estimate?, planning_days?, parent?, activity_type?, location? }',
    '- update_experience_plan_item: { experience_id, plan_item_id, text?, url?, cost_estimate?, planning_days?, parent?, activity_type?, location? }',
    '- delete_experience_plan_item: { experience_id, plan_item_id }',
    '',
    '--- Plan ---',
    '- create_plan: { experience_id, planned_date?, currency? }',
    '- update_plan: { plan_id, planned_date?, currency?, notes? }',
    '- delete_plan: { plan_id }  (⚠️ confirm with user first)',
    '- sync_plan: { plan_id }',
    '',
    '--- Plan Items ---',
    '- add_plan_items: { plan_id, items: [{ text, url?, cost?, planning_days?, parent?, activity_type?, location? }] }',
    '- update_plan_item: { plan_id, item_id, complete?, text?, cost?, planning_days?, url?, activity_type?, scheduled_date?, scheduled_time?, visibility?, location? }',
    '- delete_plan_item: { plan_id, item_id }  (⚠️ confirm with user first)',
    '- add_plan_item_note: { plan_id, item_id, content, visibility? ("private" or "contributors") }',
    '- add_plan_item_detail: { plan_id, item_id, type ("transport"|"accommodation"|"parking"|"discount"), data: { ... } }',
    '- assign_plan_item: { plan_id, item_id, assigned_to (user ID from context) }',
    '- unassign_plan_item: { plan_id, item_id }',
    '',
    '--- Plan Costs ---',
    '- add_plan_cost: { plan_id, title, cost, currency?, category? ("accommodation"|"transport"|"food"|"activities"|"equipment"|"other"), description?, date?, plan_item?, collaborator? }',
    '- update_plan_cost: { plan_id, cost_id, title?, cost?, currency?, category?, description?, date?, plan_item?, collaborator? }',
    '- delete_plan_cost: { plan_id, cost_id }  (⚠️ confirm with user first)',
    '',
    '--- Collaboration ---',
    '- invite_collaborator: { plan_id? OR experience_id, user_id, type? }',
    '- remove_collaborator: { plan_id? OR experience_id, user_id }  (⚠️ confirm with user first)',
    '',
    '--- Member Location ---',
    '- set_member_location: { plan_id, location: { address?, city?, state?, country?, postalCode?, geo?: { coordinates: [lng, lat] } }, travel_cost_estimate?, currency? }',
    '- remove_member_location: { plan_id }  (always uses logged-in user)',
    '',
    '--- Navigation ---',
    '- navigate_to_entity: { entity ("destination"|"experience"|"plan"), entityId, url }',
    '  Use this when the user asks to see/show/go to an entity. The url must follow these patterns:',
    '    Destination: /destinations/<destinationId>',
    '    Experience: /experiences/<experienceId>',
    '    Plan: /experiences/<experienceId>#plan-<planId>',
    '  When the user\'s intent is explicitly to view an entity (e.g. "show me", "take me to", "I\'m feeling lucky"),',
    '  propose a navigate_to_entity action alongside your response.',
    '',
    'If no actions are needed (e.g. asking a clarifying question), return an empty pending_actions array.',
    'The "id" field must be unique per action — use "action_" followed by 8 random alphanumeric characters.'
  );

  return lines.join('\n');
}

/**
 * Build context blocks based on intent classification and session state.
 */
async function buildContextBlocks(intent, entities, session, userId) {
  const blocks = [];

  // Use session context IDs to enrich the prompt
  const ctx = session.context || {};

  try {
    const promises = [];

    // Intent-specific context
    if (intent === 'QUERY_DESTINATION' && entities.destination_name) {
      promises.push(buildSearchContext(entities.destination_name, userId).then(b => b && blocks.push(b)));
    }

    // Navigation intent — resolve entity search so LLM can propose navigate_to_entity action with correct IDs/URLs
    if (intent === 'NAVIGATE_TO_ENTITY') {
      if (entities.destination_name) {
        promises.push(buildSearchContext(entities.destination_name, userId).then(b => b && blocks.push(b)));
      }
      if (entities.experience_name) {
        promises.push(buildSearchContext(entities.experience_name, userId).then(b => b && blocks.push(b)));
      }
    }

    // Session-level context (already resolved entities)
    if (ctx.destination_id) {
      promises.push(buildDestinationContext(ctx.destination_id.toString(), userId).then(b => b && blocks.push(b)));
    }
    if (ctx.experience_id) {
      promises.push(buildExperienceContext(ctx.experience_id.toString(), userId).then(b => b && blocks.push(b)));
    }
    if (ctx.plan_id) {
      promises.push(buildUserPlanContext(ctx.plan_id.toString(), userId).then(b => b && blocks.push(b)));
    }
    if (ctx.plan_item_id && ctx.plan_id) {
      promises.push(buildPlanItemContext(ctx.plan_id.toString(), ctx.plan_item_id.toString(), userId).then(b => b && blocks.push(b)));
    }

    // Search context for entity references not yet in session
    if (entities.experience_name && !ctx.experience_id) {
      promises.push(buildSearchContext(entities.experience_name, userId).then(b => b && blocks.push(b)));
    }

    await Promise.all(promises);
  } catch (err) {
    logger.warn('[bienbot] Context building partially failed', { error: err.message });
  }

  return blocks.length > 0 ? blocks.join('\n\n') : null;
}

/**
 * Parse structured JSON response from LLM.
 * Returns { message, pending_actions } or a fallback.
 */
function parseLLMResponse(text) {
  try {
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const parsed = JSON.parse(cleaned);

    if (typeof parsed.message !== 'string') {
      return { message: text, pending_actions: [] };
    }

    const actions = Array.isArray(parsed.pending_actions)
      ? parsed.pending_actions.filter(a =>
        a && typeof a.id === 'string' &&
          typeof a.type === 'string' &&
          ALLOWED_ACTION_TYPES.includes(a.type) &&
          a.payload && typeof a.description === 'string'
      )
      : [];

    return { message: parsed.message, pending_actions: actions };
  } catch {
    // If parsing fails, treat the entire response as the message
    return { message: text, pending_actions: [] };
  }
}

/**
 * Send an SSE event to the client.
 */
function sendSSE(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ---------------------------------------------------------------------------
// Controller methods
// ---------------------------------------------------------------------------

/**
 * POST /api/bienbot/chat
 *
 * Main chat endpoint. Runs the full pipeline:
 * 1. Validate input
 * 2. Handle invokeContext (validate, resolve label, permission check, build context)
 * 3. Load or create session
 * 4. Classify intent
 * 5. Build context blocks
 * 6. Build augmented prompt and call LLM
 * 7. Parse structured JSON response
 * 8. Store pending_actions and messages in session
 * 9. SSE-stream the response
 */
exports.chat = async (req, res) => {
  const userId = req.user._id.toString();

  // --- Input validation ---
  let { message, sessionId, invokeContext } = req.body;

  if (!message || typeof message !== 'string') {
    return errorResponse(res, null, 'Message is required', 400);
  }

  // Strip null bytes and enforce length cap
  message = stripNullBytes(message).trim();
  if (message.length === 0) {
    return errorResponse(res, null, 'Message cannot be empty', 400);
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return errorResponse(res, null, `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`, 400);
  }

  // Validate sessionId if provided
  if (sessionId) {
    const { valid } = validateObjectId(sessionId, 'sessionId');
    if (!valid) {
      return errorResponse(res, null, 'Invalid session ID format', 400);
    }
  }

  // --- Step 0: Handle invokeContext ---
  let invokeLabel = null;
  let invokeContextBlock = null;
  let resolvedInvokeContext = null;

  if (invokeContext && invokeContext.id && invokeContext.entity) {
    // Strip null bytes from invoke context fields
    invokeContext.id = stripNullBytes(invokeContext.id);
    invokeContext.entity = stripNullBytes(invokeContext.entity);

    const { valid } = validateObjectId(invokeContext.id, 'invokeContext.id');
    if (!valid) {
      return errorResponse(res, null, 'Invalid invokeContext.id format', 400);
    }

    // Resolve entity label from DB (never trust client-supplied label)
    invokeLabel = await resolveEntityLabel(invokeContext.entity, invokeContext.id);
    if (!invokeLabel) {
      return errorResponse(res, null, 'Entity not found', 403);
    }

    // Permission check: canView
    loadModels();
    const enforcer = getEnforcer({ Destination, Experience, Plan, User });
    let resource;

    try {
      switch (invokeContext.entity) {
        case 'destination':
          resource = await Destination.findById(invokeContext.id).lean();
          break;
        case 'experience':
          resource = await Experience.findById(invokeContext.id).lean();
          break;
        case 'plan':
          resource = await Plan.findById(invokeContext.id).lean();
          break;
        case 'plan_item': {
          // plan_item is a subdocument — find parent plan and use it for permission check
          const parentPlan = await Plan.findOne({ 'plan._id': invokeContext.id }).lean();
          if (parentPlan) {
            resource = parentPlan;
            // Stash the parent plan ID for context builder and session context
            invokeContext._parentPlanId = parentPlan._id.toString();
          }
          break;
        }
        case 'user':
          resource = await User.findById(invokeContext.id).lean();
          break;
        default:
          return errorResponse(res, null, 'Unknown entity type', 400);
      }
    } catch (err) {
      logger.error('[bienbot] Failed to load entity for permission check', { error: err.message });
      return errorResponse(res, null, 'Failed to verify permissions', 500);
    }

    if (!resource) {
      return errorResponse(res, null, 'Entity not found', 403);
    }

    // User entities don't go through canView - any authenticated user can view profiles
    if (invokeContext.entity !== 'user') {
      const permCheck = await enforcer.canView({ userId: req.user._id, resource });
      if (!permCheck.allowed) {
        return errorResponse(res, null, 'You do not have permission to view this entity', 403);
      }
    }

    resolvedInvokeContext = {
      entity: invokeContext.entity,
      entity_id: invokeContext.id,
      entity_label: invokeLabel
    };

    // Build context block for invokeContext
    const contextOptions = {};
    if (invokeContext.entity === 'plan_item' && invokeContext._parentPlanId) {
      contextOptions.planId = invokeContext._parentPlanId;
    }
    invokeContextBlock = await buildContextForInvokeContext(
      resolvedInvokeContext,
      userId,
      contextOptions
    );
  }

  // --- Step 1: Load or create session ---
  let session;

  try {
    if (sessionId) {
      session = await BienBotSession.findById(sessionId);
      if (!session || session.user.toString() !== userId) {
        return errorResponse(res, null, 'Session not found', 404);
      }
    } else {
      session = await BienBotSession.createSession(userId, resolvedInvokeContext || {});

      // Pre-populate context from invokeContext
      if (resolvedInvokeContext) {
        const contextUpdate = {};
        switch (resolvedInvokeContext.entity) {
          case 'destination':
            contextUpdate.destination_id = resolvedInvokeContext.entity_id;
            break;
          case 'experience':
            contextUpdate.experience_id = resolvedInvokeContext.entity_id;
            break;
          case 'plan':
            contextUpdate.plan_id = resolvedInvokeContext.entity_id;
            break;
          case 'plan_item':
            contextUpdate.plan_item_id = resolvedInvokeContext.entity_id;
            if (invokeContext._parentPlanId) {
              contextUpdate.plan_id = invokeContext._parentPlanId;
            }
            break;
        }
        if (Object.keys(contextUpdate).length > 0) {
          await session.updateContext(contextUpdate);
        }
      }
    }
  } catch (err) {
    logger.error('[bienbot] Session load/create failed', { error: err.message });
    return errorResponse(res, null, 'Failed to load session', 500);
  }

  // --- Step 2: Classify intent ---
  const classification = await classifyIntent(message);

  logger.info('[bienbot] Intent classified', {
    userId,
    sessionId: session._id.toString(),
    intent: classification.intent,
    confidence: classification.confidence
  });

  // --- Step 3: Build context blocks ---
  const intentContextBlock = await buildContextBlocks(
    classification.intent,
    classification.entities,
    session,
    userId
  );

  // Merge invokeContext block with intent-based blocks
  const combinedContext = [invokeContextBlock, intentContextBlock]
    .filter(Boolean)
    .join('\n\n') || null;

  // --- Step 4: Build system prompt and call LLM ---
  const systemPrompt = buildSystemPrompt({
    invokeLabel,
    contextBlock: combinedContext,
    session
  });

  // Build conversation history for multi-turn
  const conversationMessages = [
    { role: 'system', content: systemPrompt }
  ];

  // Include recent conversation history (last 10 turns)
  const recentMessages = (session.messages || []).slice(-10);
  for (const msg of recentMessages) {
    conversationMessages.push({
      role: msg.role,
      content: msg.role === 'user'
        ? `[USER MESSAGE]\n${msg.content}\n[/USER MESSAGE]`
        : msg.content
    });
  }

  // Add the current user message with delimiter
  conversationMessages.push({
    role: 'user',
    content: `[USER MESSAGE]\n${message}\n[/USER MESSAGE]`
  });

  const provider = getProviderForTask(AI_TASKS.GENERAL);

  if (!getApiKey(provider)) {
    return errorResponse(res, null, 'The AI service is not configured yet.', 503);
  }

  let llmResult;
  try {
    llmResult = await callProvider(provider, conversationMessages, {
      temperature: 0.7,
      maxTokens: 1500,
      _user: req.user,
      task: AI_TASKS.BIENBOT_CHAT,
      intent: classification.intent || null,
      entityContext: resolvedInvokeContext ? {
        entityType: resolvedInvokeContext.entity,
        entityId: resolvedInvokeContext.entity_id
      } : (session.invoke_context?.entity ? {
        entityType: session.invoke_context.entity,
        entityId: session.invoke_context.entity_id?.toString()
      } : null)
    });
  } catch (err) {
    logger.error('[bienbot] LLM call failed', { error: err.message, userId });
    return errorResponse(res, null, 'AI service temporarily unavailable', 503);
  }

  // --- Step 5: Parse structured response ---
  const parsed = parseLLMResponse(llmResult.content || '');

  // --- Step 6: Store in session ---
  try {
    // Add user message
    await session.addMessage('user', message, {
      intent: classification.intent
    });

    // Add assistant response
    const actionsTaken = parsed.pending_actions.map(a => a.type);
    await session.addMessage('assistant', parsed.message, {
      actions_taken: actionsTaken
    });

    // Store pending actions
    if (parsed.pending_actions.length > 0) {
      await session.setPendingActions(parsed.pending_actions);
    }

    // Auto-generate title from first user message
    await session.generateTitle();
  } catch (err) {
    logger.error('[bienbot] Session persistence failed', { error: err.message });
    // Continue — we can still return the response even if persistence fails
  }

  // --- Step 7: SSE-stream the response ---
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  // Stream session info
  sendSSE(res, 'session', {
    sessionId: session._id.toString(),
    title: session.title
  });

  // Stream the message in chunks for progressive rendering
  const messageText = parsed.message;
  const chunkSize = 50; // ~50 chars per chunk for smooth streaming feel

  for (let i = 0; i < messageText.length; i += chunkSize) {
    const chunk = messageText.substring(i, i + chunkSize);
    sendSSE(res, 'token', { text: chunk });
  }

  // Stream pending actions if any
  if (parsed.pending_actions.length > 0) {
    sendSSE(res, 'actions', {
      pending_actions: parsed.pending_actions
    });
  }

  // Signal completion
  sendSSE(res, 'done', {
    usage: llmResult.usage,
    intent: classification.intent,
    confidence: classification.confidence
  });

  res.end();
};

/**
 * POST /api/bienbot/sessions/:id/execute
 *
 * Execute pending actions from a session.
 * Validates that requested action IDs exist in the session's pending_actions.
 */
exports.execute = async (req, res) => {
  const userId = req.user._id.toString();
  const { id } = req.params;

  // Validate session ID
  const { valid } = validateObjectId(id, 'session ID');
  if (!valid) {
    return errorResponse(res, null, 'Invalid session ID format', 400);
  }

  // Validate action IDs in body
  const { actionIds } = req.body;
  if (!actionIds || !Array.isArray(actionIds) || actionIds.length === 0) {
    return errorResponse(res, null, 'actionIds array is required', 400);
  }

  // Load session
  let session;
  try {
    session = await BienBotSession.findById(id);
    if (!session || session.user.toString() !== userId) {
      return errorResponse(res, null, 'Session not found', 404);
    }
  } catch (err) {
    logger.error('[bienbot] Failed to load session for execute', { error: err.message });
    return errorResponse(res, null, 'Failed to load session', 500);
  }

  // Validate all action IDs exist in pending_actions and are not already executed
  const pendingMap = new Map();
  for (const action of (session.pending_actions || [])) {
    pendingMap.set(action.id, action);
  }

  const actionsToExecute = [];
  const invalidIds = [];

  for (const actionId of actionIds) {
    const action = pendingMap.get(actionId);
    if (!action) {
      invalidIds.push(actionId);
    } else if (action.executed) {
      invalidIds.push(actionId); // Already executed
    } else {
      actionsToExecute.push(action);
    }
  }

  if (invalidIds.length > 0) {
    return errorResponse(res, null, `Invalid or already executed action IDs: ${invalidIds.join(', ')}`, 400);
  }

  // Execute actions
  try {
    const { results, contextUpdates } = await executeActions(actionsToExecute, req.user, session);

    logger.info('[bienbot] Actions executed', {
      userId,
      sessionId: id,
      actionCount: actionsToExecute.length,
      successCount: results.filter(r => r.success).length
    });

    return successResponse(res, {
      results,
      contextUpdates,
      session: {
        id: session._id.toString(),
        context: session.context
      }
    });
  } catch (err) {
    logger.error('[bienbot] Action execution failed', { error: err.message, sessionId: id });
    return errorResponse(res, err, 'Action execution failed', 500);
  }
};

/**
 * POST /api/bienbot/sessions/:id/resume
 *
 * Resume a past session. Generates or returns cached summary + greeting.
 * - Sessions with < 3 messages get a static welcome-back greeting.
 * - Otherwise runs the session summarizer.
 * - Caches result in session.summary with 6-hour TTL.
 */
exports.resume = async (req, res) => {
  const userId = req.user._id.toString();
  const { id } = req.params;

  // Validate session ID
  const { valid } = validateObjectId(id, 'session ID');
  if (!valid) {
    return errorResponse(res, null, 'Invalid session ID format', 400);
  }

  // Load session (non-lean so we can call instance methods)
  let session;
  try {
    session = await BienBotSession.findById(id);
    if (!session || session.user.toString() !== userId) {
      return errorResponse(res, null, 'Session not found', 404);
    }
  } catch (err) {
    logger.error('[bienbot] Failed to load session for resume', { error: err.message });
    return errorResponse(res, null, 'Failed to load session', 500);
  }

  // Sessions with fewer than 3 messages: static greeting
  if ((session.messages || []).length < 3) {
    const staticGreeting = {
      role: 'assistant',
      content: 'Welcome back! How can I help you continue?',
      suggested_next_steps: ['Continue where you left off', 'Ask BienBot a new question']
    };

    return successResponse(res, {
      session: session.toObject(),
      greeting: staticGreeting
    });
  }

  // Check cached summary (6-hour TTL)
  let summaryData;

  if (!session.isSummaryStale(SUMMARY_CACHE_TTL_MS)) {
    // Use cached summary
    summaryData = {
      summary: session.summary.text,
      next_steps: session.summary.suggested_next_steps || []
    };
  } else {
    // Generate new summary
    try {
      summaryData = await summarizeSession({
        messages: session.messages,
        context: session.context,
        session: session.toObject(),
        user: req.user
      });
    } catch (err) {
      if (err instanceof GatewayError) {
        const status = err.statusCode || 429;
        return errorResponse(res, null, err.message, status);
      }
      throw err;
    }

    // Cache the result
    try {
      await session.cacheSummary(summaryData.summary, summaryData.next_steps);
    } catch (err) {
      logger.warn('[bienbot] Failed to cache summary', { error: err.message });
    }
  }

  // Build greeting message from summary
  const greetingContent = `Welcome back! Here's a quick recap: ${summaryData.summary}`;

  // Append greeting to session messages
  try {
    await session.addMessage('assistant', greetingContent);
  } catch (err) {
    logger.warn('[bienbot] Failed to append greeting message', { error: err.message });
  }

  return successResponse(res, {
    session: session.toObject(),
    greeting: {
      role: 'assistant',
      content: greetingContent,
      suggested_next_steps: summaryData.next_steps
    }
  });
};

/**
 * GET /api/bienbot/sessions
 *
 * List sessions for the authenticated user, most recent first.
 * Query params: ?status=active|archived  (optional filter)
 */
exports.listSessions = async (req, res) => {
  const userId = req.user._id.toString();
  const { status } = req.query;

  const options = {};
  if (status === 'active' || status === 'archived') {
    options.status = status;
  }

  try {
    const sessions = await BienBotSession.listSessions(userId, options);
    return successResponse(res, { sessions });
  } catch (err) {
    logger.error('[bienbot] Failed to list sessions', { error: err.message, userId });
    return errorResponse(res, err, 'Failed to list sessions', 500);
  }
};

/**
 * GET /api/bienbot/sessions/:id
 *
 * Get a single session by ID. Only the session owner can access it.
 */
exports.getSession = async (req, res) => {
  const userId = req.user._id.toString();
  const { id } = req.params;

  const { valid } = validateObjectId(id, 'session ID');
  if (!valid) {
    return errorResponse(res, null, 'Invalid session ID format', 400);
  }

  try {
    const session = await BienBotSession.findById(id).lean();
    if (!session || session.user.toString() !== userId) {
      return errorResponse(res, null, 'Session not found', 404);
    }
    return successResponse(res, { session });
  } catch (err) {
    logger.error('[bienbot] Failed to get session', { error: err.message, sessionId: id });
    return errorResponse(res, err, 'Failed to get session', 500);
  }
};

/**
 * DELETE /api/bienbot/sessions/:id
 *
 * Delete (archive) a session. Only the session owner can delete it.
 */
exports.deleteSession = async (req, res) => {
  const userId = req.user._id.toString();
  const { id } = req.params;

  const { valid } = validateObjectId(id, 'session ID');
  if (!valid) {
    return errorResponse(res, null, 'Invalid session ID format', 400);
  }

  try {
    const session = await BienBotSession.findById(id);
    if (!session || session.user.toString() !== userId) {
      return errorResponse(res, null, 'Session not found', 404);
    }

    await session.archive();

    logger.info('[bienbot] Session archived', { userId, sessionId: id });
    return successResponse(res, { message: 'Session deleted' });
  } catch (err) {
    logger.error('[bienbot] Failed to delete session', { error: err.message, sessionId: id });
    return errorResponse(res, err, 'Failed to delete session', 500);
  }
};

/**
 * POST /api/bienbot/sessions/:id/context
 *
 * Update the session context mid-conversation (e.g. when the user opens a
 * plan-item modal while the chat drawer is already open). Returns the
 * resolved entity label so the frontend can display an acknowledgment.
 */
exports.updateContext = async (req, res) => {
  const userId = req.user._id.toString();
  const { id } = req.params;

  const { valid } = validateObjectId(id, 'session ID');
  if (!valid) {
    return errorResponse(res, null, 'Invalid session ID format', 400);
  }

  const { entity, entityId } = req.body;
  if (!entity || !entityId) {
    return errorResponse(res, null, 'entity and entityId are required', 400);
  }

  const { valid: entityIdValid } = validateObjectId(entityId, 'entityId');
  if (!entityIdValid) {
    return errorResponse(res, null, 'Invalid entityId format', 400);
  }

  const allowedEntities = ['destination', 'experience', 'plan', 'plan_item', 'user'];
  if (!allowedEntities.includes(entity)) {
    return errorResponse(res, null, 'Unknown entity type', 400);
  }

  let session;
  try {
    session = await BienBotSession.findById(id);
    if (!session || session.user.toString() !== userId) {
      return errorResponse(res, null, 'Session not found', 404);
    }
  } catch (err) {
    logger.error('[bienbot] Failed to load session for context update', { error: err.message });
    return errorResponse(res, null, 'Failed to load session', 500);
  }

  // Resolve entity label (never trust client)
  const entityLabel = await resolveEntityLabel(entity, entityId);
  if (!entityLabel) {
    return errorResponse(res, null, 'Entity not found', 404);
  }

  // Permission check
  loadModels();
  const enforcer = getEnforcer({ Destination, Experience, Plan, User });
  let resource;

  try {
    switch (entity) {
      case 'destination':
        resource = await Destination.findById(entityId).lean();
        break;
      case 'experience':
        resource = await Experience.findById(entityId).lean();
        break;
      case 'plan':
        resource = await Plan.findById(entityId).lean();
        break;
      case 'plan_item': {
        const parentPlan = await Plan.findOne({ 'plan._id': entityId }).lean();
        if (parentPlan) resource = parentPlan;
        break;
      }
      case 'user':
        resource = await User.findById(entityId).lean();
        break;
    }
  } catch (err) {
    logger.error('[bienbot] Entity load failed during context update', { error: err.message });
    return errorResponse(res, null, 'Failed to verify permissions', 500);
  }

  if (!resource) {
    return errorResponse(res, null, 'Entity not found', 404);
  }

  if (entity !== 'user') {
    const permCheck = await enforcer.canView({ userId: req.user._id, resource });
    if (!permCheck.allowed) {
      return errorResponse(res, null, 'You do not have permission to view this entity', 403);
    }
  }

  // Build context update
  const contextUpdate = {};
  switch (entity) {
    case 'destination':
      contextUpdate.destination_id = entityId;
      break;
    case 'experience':
      contextUpdate.experience_id = entityId;
      break;
    case 'plan':
      contextUpdate.plan_id = entityId;
      break;
    case 'plan_item': {
      contextUpdate.plan_item_id = entityId;
      const parentPlan = await Plan.findOne({ 'plan._id': entityId }).select('_id').lean();
      if (parentPlan) contextUpdate.plan_id = parentPlan._id.toString();
      break;
    }
    case 'user':
      break;
  }

  try {
    if (Object.keys(contextUpdate).length > 0) {
      await session.updateContext(contextUpdate);
    }

    // Append a system-like assistant message so the conversation records the context switch
    await session.addMessage('assistant', `Now viewing: ${entityLabel}`, {
      actions_taken: ['context_update']
    });

    logger.info('[bienbot] Session context updated', { userId, sessionId: id, entity, entityId });
    return successResponse(res, { entityLabel, context: session.context });
  } catch (err) {
    logger.error('[bienbot] Context update failed', { error: err.message, sessionId: id });
    return errorResponse(res, err, 'Failed to update context', 500);
  }
};

/**
 * DELETE /api/bienbot/sessions/:id/pending/:actionId
 *
 * Remove a specific pending action from a session.
 * Only the session owner can remove pending actions.
 */
exports.deletePendingAction = async (req, res) => {
  const userId = req.user._id.toString();
  const { id, actionId } = req.params;

  const { valid } = validateObjectId(id, 'session ID');
  if (!valid) {
    return errorResponse(res, null, 'Invalid session ID format', 400);
  }

  if (!actionId || typeof actionId !== 'string') {
    return errorResponse(res, null, 'Action ID is required', 400);
  }

  try {
    const session = await BienBotSession.findById(id);
    if (!session || session.user.toString() !== userId) {
      return errorResponse(res, null, 'Session not found', 404);
    }

    const actionIndex = (session.pending_actions || []).findIndex(a => a.id === actionId);
    if (actionIndex === -1) {
      return errorResponse(res, null, 'Pending action not found', 404);
    }

    session.pending_actions.splice(actionIndex, 1);
    session.markModified('pending_actions');
    await session.save();

    logger.info('[bienbot] Pending action removed', { userId, sessionId: id, actionId });
    return successResponse(res, { message: 'Pending action removed' });
  } catch (err) {
    logger.error('[bienbot] Failed to remove pending action', { error: err.message, sessionId: id, actionId });
    return errorResponse(res, err, 'Failed to remove pending action', 500);
  }
};

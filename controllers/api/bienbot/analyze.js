/**
 * BienBot — proactive entity analysis (POST /api/bienbot/analyze).
 *
 * Stateless: produces suggestions for an entity without creating a session.
 * Split out from `controllers/api/bienbot.js` (bd #f4ed).
 *
 * @module controllers/api/bienbot/analyze
 */

const {
  mongoose, logger,
  validateObjectId, successResponse, errorResponse,
  getEnforcer,
  loadModels, Destination, Experience, Plan, User,
  callProvider, getApiKey, getProviderForTask, AI_TASKS, GatewayError,
  affinityCache, computeAndCacheAffinity,
  resolveEntities,
  resolveEntityLabel, findPlanContainingItem,
  buildDestinationContext, buildExperienceContext, buildUserPlanContext,
  buildPlanItemContext, buildUserGreetingContext, buildUserProfileContext,
} = require('./_shared');

// ---------------------------------------------------------------------------
// Proactive Analysis
// ---------------------------------------------------------------------------

/**
 * Map of entity type to { load } helpers.
 * Used by the analyze endpoint to resolve entities and check view permission.
 */
const ANALYZE_ENTITY_MAP = {
  destination: { load: (id) => { loadModels(); return Destination.findById(id); } },
  experience:  { load: (id) => { loadModels(); return Experience.findById(id).populate('destination', 'name country'); } },
  plan:        { load: (id) => { loadModels(); return Plan.findById(id).populate('experience', 'name'); } },
  plan_item: {
    custom: true,
    load: async (id) => {
      return findPlanContainingItem(id, { populate: 'experience', populateSelect: 'name' });
    }
  },
  user: {
    custom: true,
    load: (id) => { loadModels(); return User.findById(id).lean(); }
  }
};

/**
 * Resolve the analysis mode from daysUntil proximity value.
 * @param {number|null} daysUntil
 * @param {string} entity - entity type ('user' gets 'greeting')
 * @returns {string}
 */
function resolveModeFromDaysUntil(daysUntil, entity) {
  if (entity === 'user') return 'greeting';
  if (daysUntil === null) return 'standard';
  if (daysUntil < 0) return 'overdue';
  if (daysUntil === 0) return 'today_brief';
  if (daysUntil <= 7) return 'imminent';
  if (daysUntil <= 30) return 'preparation';
  return 'planning';
}

/**
 * Build a proximity-aware system prompt for proactive plan analysis.
 * The LLM must return a JSON array only — no prose.
 *
 * @param {object} [opts]
 * @param {string} [opts.mode] - 'overdue'|'today_brief'|'imminent'|'preparation'|'planning'|'greeting'|'standard'
 * @param {number|null} [opts.daysUntil] - days until planned date (null if no date)
 * @param {string} [opts.currentDate] - ISO date string (YYYY-MM-DD)
 * @returns {string}
 */
function buildAnalyzeSystemPrompt({ mode = 'standard', daysUntil = null, currentDate = null, entity = null } = {}) {
  const today = currentDate || new Date().toISOString().split('T')[0];

  const modeInstructions = {
    overdue: [
      `The plan is OVERDUE (${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? '' : 's'} past the planned date).`,
      'Focus on: what remains incomplete, whether to reschedule, and any costs that may have been lost.',
      'Tone: calm and helpful — not alarming.'
    ].join(' '),
    today_brief: [
      'The plan is TODAY. Keep it tightly focused (3–5 suggestions).',
      'Focus only on: any last-minute items that are still incomplete, key confirmation numbers or logistics.',
      'Do not suggest long-term planning improvements today.',
      'Use type "action" for immediate to-dos alongside warning/tip/info.'
    ].join(' '),
    imminent: [
      `The plan is in ${daysUntil} day${daysUntil === 1 ? '' : 's'} — imminent.`,
      'Focus on: final checklist items, missing logistics (transport, accommodation), unconfirmed bookings.',
      'Keep suggestions concrete and actionable today.',
      'Use type "action" for immediate to-dos alongside warning/tip/info.'
    ].join(' '),
    preparation: [
      `The plan is ${daysUntil} days away — in the preparation window.`,
      'Focus on: incomplete items, budget gaps, any missing transport or accommodation details.',
      'Suggestions should help the user be fully prepared well in advance.'
    ].join(' '),
    planning: [
      `The plan is ${daysUntil} days away — ample time to plan.`,
      'Focus on: overall completeness, missing details, potential improvements, budget awareness.',
      'Suggestions can include forward-looking recommendations.'
    ].join(' '),
    greeting: [
      'The user opened BienBot without a specific entity — greet them and give a high-level overview.',
      'Focus on: upcoming plans, recently active items, any plans that are overdue or need attention.',
      'Tone: warm and encouraging. Suggest next actions.'
    ].join(' '),
    standard: [
      'Analyze the entity data and provide balanced, actionable suggestions.',
      'Consider completeness, missing details, and potential improvements.'
    ].join(' ')
  };

  const charLimit = (mode === 'today_brief' || mode === 'imminent') ? 140 : 120;
  const countRange = mode === 'today_brief' ? '3–5' : mode === 'greeting' ? '3–6' : '2–6';
  const actionTypeNote = (mode === 'today_brief' || mode === 'imminent')
    ? '  - action: An immediate to-do the user should act on right now'
    : null;

  const suggestedPromptsRules = [
    '',
    'SUGGESTED PROMPTS:',
    '- Also return a "suggested_prompts" array of 2–4 short follow-up questions the user can click to continue the conversation.',
    '- Each prompt must be a natural, conversational question directly related to a specific insight from the suggestions.',
    '- Prompts should help the user take action: e.g. ask about a specific plan, view details, or address an issue.',
    entity === 'experience' ? '- If the user has no plan for this experience, one prompt MUST be "Plan this experience" or a close variant.' : null,
    '- Keep each prompt under 60 characters.',
    '- Do not include generic prompts like "Tell me more" — be specific to the context.'
  ].filter(l => l !== null);

  return [
    'You are BienBot, a proactive travel planning assistant for the Biensperience platform.',
    `Today is ${today}.`,
    '',
    modeInstructions[mode] || modeInstructions.standard,
    '',
    'Analyze the entity data provided and return concise, actionable suggestions.',
    '',
    'RULES:',
    '- Return ONLY a valid JSON object. No markdown fences, no explanation outside JSON.',
    '- The object must have a "suggestions" array, a "suggested_prompts" array, and a "referenced_entities" array.',
    actionTypeNote
      ? `- Each suggestion must have: { "type": "<warning|tip|info|action>", "message": "<text>" }`
      : `- Each suggestion must have: { "type": "<warning|tip|info>", "message": "<text>" }`,
    entity === 'experience'
      ? '  - warning: Something important that may affect the template (e.g. mismatched items, missing budget)'
      : '  - warning: Something important that may affect the plan (e.g. missing budget, no date set)',
    '  - tip: A helpful improvement the user could make (e.g. add travel insurance, more detail)',
    '  - info: A neutral observation (e.g. completion percentage, plan size)',
    actionTypeNote,
    `- Produce ${countRange} suggestions. Do not pad with trivial observations.`,
    '- Never fabricate data. Base suggestions only on the context provided.',
    `- Keep each message under ${charLimit} characters.`,
    '- Do not repeat the same observation using different wording.',
    entity !== 'plan' ? '- Do not comment on item completion status — only plans track completed items.' : null,
    entity === 'experience' ? '- Experiences are planning templates; they do NOT have dates. NEVER warn about missing dates on an experience — dates belong to plans, not experiences.' : null,
    entity === 'experience' ? '- If the context shows the user has no plan for this experience, include a tip encouraging them to create a plan. Otherwise, do not mention plan creation.' : null,
    ...suggestedPromptsRules,
    '',
    'REFERENCED ENTITIES:',
    '- Also return a "referenced_entities" array listing every entity (destination, experience, plan, plan_item) you mention by name in the suggestions or suggested_prompts.',
    '- Each entry: { "type": "destination|experience|plan|plan_item", "_id": "<real id from context>", "name": "<display name>" }.',
    '- Use ONLY real _id values that appear verbatim in the context block. Never invent IDs.',
    '- This array tells the chat session which specific entities the greeting focuses on so follow-up questions can act on them without disambiguation.',
    '- If a suggestion is general (no specific entity), do not include any entry for it.',
    '- Order the array so the most central entity (the one the user is most likely to ask about next) appears first.',
    '',
    'Example response:',
    '{',
    '  "suggestions": [',
    '    { "type": "warning", "message": "This plan has no budget items — costs may add up unexpectedly." },',
    '    { "type": "tip", "message": "Consider adding travel insurance for international trips." },',
    entity === 'plan' ? '    { "type": "info", "message": "3 of 8 plan items are completed (38%)." }' : '    { "type": "info", "message": "This experience has 8 plan items across 3 activity types." }',
    '  ],',
    '  "suggested_prompts": [',
    '    "Which plan items still need budget estimates?",',
    '    "What\'s left to plan for the Tokyo trip?"',
    '  ],',
    '  "referenced_entities": [',
    '    { "type": "plan", "_id": "693f214a2b3c4d5e6f7a8b9c", "name": "Tokyo Temple Tour" }',
    '  ]',
    '}'
  ].filter(l => l !== null).join('\n');
}

/**
 * POST /api/bienbot/analyze
 *
 * Stateless proactive analysis of an entity. Returns a list of suggestions
 * without creating or modifying any BienBot session.
 *
 * Request body: { entity: 'plan'|'experience'|'destination'|'plan_item'|'user', entityId: <ObjectId> }
 *
 * Response: { suggestions: [{ type: 'warning'|'tip'|'info', message: string }] }
 */
exports.analyze = async (req, res) => {
  const userId = req.user._id.toString();

  // Format/presence/entity-enum/ObjectId-shape validation handled by
  // `validate(analyzeSchema)` in the route. Controller now only does
  // entity-existence + permission checks.
  const { entity, entityId } = req.body;
  const { objectId: validatedId } = validateObjectId(entityId, 'entityId');

  // --- Load entity and check permission ---
  let resource;
  try {
    resource = await ANALYZE_ENTITY_MAP[entity].load(validatedId);
  } catch (err) {
    logger.error('[bienbot] analyze: entity load failed', { entity, entityId, error: err.message });
    return errorResponse(res, null, 'Failed to load entity', 500);
  }

  if (!resource) {
    return errorResponse(res, null, 'Entity not found', 404);
  }

  loadModels();
  const enforcer = getEnforcer({ Destination, Experience, Plan, User });

  // Permission checking varies by entity type
  if (entity === 'user') {
    // Users can only analyze their own profile via this endpoint
    if (String(resource._id) !== String(req.user._id)) {
      return errorResponse(res, null, 'You do not have permission to view this entity', 403);
    }
  } else if (entity === 'plan_item') {
    // resource is the parent plan — check canView on the plan
    const permCheck = await enforcer.canView({ userId: req.user._id, resource });
    if (!permCheck.allowed) {
      return errorResponse(res, null, 'You do not have permission to view this entity', 403);
    }
    // Verify the specific item exists within the plan's item array
    const itemIdStr = validatedId.toString();
    const itemExists = (resource.plan || []).some(i => String(i._id) === itemIdStr);
    if (!itemExists) {
      return errorResponse(res, null, 'Plan item not found', 404);
    }
  } else {
    const permCheck = await enforcer.canView({ userId: req.user._id, resource });
    if (!permCheck.allowed) {
      return errorResponse(res, null, 'You do not have permission to view this entity', 403);
    }
  }

  // --- Compute temporal proximity for mode resolution ---
  let daysUntil = null;
  if (entity === 'plan') {
    // Use the nearest scheduled non-complete item; fall back to planned_date if none.
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const scheduledItems = (resource.plan || []).filter(i => i.scheduled_date && !i.complete);
    if (scheduledItems.length > 0) {
      let minDays = Infinity;
      for (const item of scheduledItems) {
        const target = new Date(item.scheduled_date); target.setHours(0, 0, 0, 0);
        const days = Math.round((target - today) / 86400000);
        if (days < minDays) minDays = days;
      }
      daysUntil = minDays;
    } else if (resource.planned_date) {
      const target = new Date(resource.planned_date); target.setHours(0, 0, 0, 0);
      daysUntil = Math.round((target - today) / 86400000);
    }
  } else if (entity === 'plan_item') {
    // resource is the parent plan; find the item to get scheduled_date
    const itemIdStr = validatedId.toString();
    const planItems = resource.plan || [];
    const item = planItems.find(i => String(i._id) === itemIdStr);
    if (item?.scheduled_date) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const target = new Date(item.scheduled_date); target.setHours(0, 0, 0, 0);
      daysUntil = Math.round((target - today) / 86400000);
    }
  }

  const mode = resolveModeFromDaysUntil(daysUntil, entity);
  const currentDate = new Date().toISOString().split('T')[0];

  // --- Build context block ---
  let contextBlock = null;
  try {
    switch (entity) {
      case 'destination':
        contextBlock = await buildDestinationContext(validatedId, userId);
        break;
      case 'experience':
        contextBlock = await buildExperienceContext(validatedId, userId);
        break;
      case 'plan':
        contextBlock = await buildUserPlanContext(validatedId, userId);
        break;
      case 'plan_item':
        // resource is parent plan; pass planId + itemId
        contextBlock = await buildPlanItemContext(resource._id.toString(), validatedId, userId);
        break;
      case 'user':
        contextBlock = await buildUserGreetingContext(validatedId);
        break;
    }
  } catch (err) {
    logger.warn('[bienbot] analyze: context build failed', { entity, entityId, error: err.message });
    // Non-fatal — proceed with minimal context
  }

  if (!contextBlock) {
    // Fallback: stringify a minimal summary so the LLM has something to work with
    contextBlock = `[${entity.charAt(0).toUpperCase() + entity.slice(1)}] Entity ID: ${validatedId}`;
  }

  // --- Call LLM ---
  const provider = getProviderForTask(AI_TASKS.BIENBOT_ANALYZE);

  if (!getApiKey(provider)) {
    return errorResponse(res, null, 'The AI service is not configured yet.', 503);
  }

  let llmResult;
  try {
    llmResult = await callProvider(provider, [
      { role: 'system', content: buildAnalyzeSystemPrompt({ mode, daysUntil, currentDate, entity }) },
      { role: 'user', content: contextBlock }
    ], {
      temperature: 0.4,
      maxTokens: 600,
      _user: req.user,
      task: AI_TASKS.BIENBOT_ANALYZE,
      entityContext: { entityType: entity, entityId: validatedId }
    });
  } catch (err) {
    logger.error('[bienbot] analyze: LLM call failed', { error: err.message, userId, entity, entityId });
    return errorResponse(res, null, 'AI service temporarily unavailable', 503);
  }

  // --- Parse suggestions, suggested prompts, referenced entities ---
  let suggestions = [];
  let suggestedPrompts = [];
  let referencedEntities = [];
  try {
    const cleaned = (llmResult.content || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned);

    // Support both old format (array) and new format (object with suggestions + suggested_prompts)
    const suggestionsArr = Array.isArray(parsed) ? parsed : (parsed.suggestions || []);
    const promptsArr = Array.isArray(parsed) ? [] : (parsed.suggested_prompts || []);
    const entitiesArr = Array.isArray(parsed) ? [] : (parsed.referenced_entities || []);

    const VALID_TYPES = new Set(['warning', 'tip', 'info', 'action']);
    suggestions = suggestionsArr
      .filter(s => s && VALID_TYPES.has(s.type) && typeof s.message === 'string' && s.message.trim())
      .slice(0, 10)
      .map(s => ({ type: s.type, message: s.message.trim().slice(0, 200) }));

    suggestedPrompts = promptsArr
      .filter(p => typeof p === 'string' && p.trim())
      .slice(0, 4)
      .map(p => p.trim().slice(0, 100));

    const VALID_ENTITY_TYPES = new Set(['destination', 'experience', 'plan', 'plan_item']);
    const objectIdLike = /^[a-fA-F0-9]{24}$/;
    referencedEntities = entitiesArr
      .filter(e =>
        e
        && VALID_ENTITY_TYPES.has(e.type)
        && typeof e._id === 'string'
        && objectIdLike.test(e._id)
        && typeof e.name === 'string'
        && e.name.trim()
      )
      .slice(0, 8)
      .map(e => ({
        type: e.type,
        _id: e._id,
        name: e.name.trim().slice(0, 120)
      }));
  } catch (err) {
    logger.warn('[bienbot] analyze: failed to parse LLM suggestions', {
      entity,
      entityId,
      raw: (llmResult.content || '').slice(0, 200),
      error: err.message
    });
    // Return empty suggestions rather than 500 — analysis is best-effort
  }

  logger.info('[bienbot] analyze: completed', {
    userId,
    entity,
    entityId,
    mode,
    suggestionCount: suggestions.length,
    suggestedPromptsCount: suggestedPrompts.length,
    referencedEntityCount: referencedEntities.length
  });

  return successResponse(res, {
    entity,
    entityId: validatedId,
    suggestions,
    suggestedPrompts,
    referencedEntities
  });
};


module.exports = {
  analyze: exports.analyze,
};

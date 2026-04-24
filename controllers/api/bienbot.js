/**
 * BienBot Controller
 *
 * Express controller orchestrating the BienBot AI assistant pipeline:
 * load/create session → classify intent → build context → call LLM →
 * parse structured response → store pending_actions → SSE-stream response.
 *
 * @module controllers/api/bienbot
 */

const crypto = require('crypto');
const fs = require('fs');
const mongoose = require('mongoose');
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
  buildUserProfileContext,
  buildUserGreetingContext,
  buildSearchContext,
  buildSuggestionContext,
  buildDiscoveryContext,
  buildPlanNextStepsContext
} = require('../../utilities/bienbot-context-builders');
const { executeActions, executeSingleWorkflowStep, ALLOWED_ACTION_TYPES, READ_ONLY_ACTION_TYPES } = require('../../utilities/bienbot-action-executor');
const { resolveEntities, formatResolutionBlock, formatResolutionObjects, FIELD_TYPE_MAP } = require('../../utilities/bienbot-entity-resolver');
const { summarizeSession } = require('../../utilities/bienbot-session-summarizer');
const { validateNavigationSchema, extractContextIds } = require('../../utilities/navigation-context-schema');
const { extractMemoryFromSession, extractMemoryForCollaborators, formatMemoryBlock } = require('../../utilities/bienbot-memory-extractor');
const { extractText, validateDocument } = require('../../utilities/ai-document-utils');
const { uploadWithPipeline, retrieveFile, resolveAndValidateLocalUploadPath } = require('../../utilities/upload-pipeline');
const path = require('path');
const { GatewayError } = require('../../utilities/ai-gateway');
const { callProvider, getApiKey, getProviderForTask } = require('./ai');
const { AI_TASKS } = require('../../utilities/ai-constants');
const BienBotSession = require('../../models/bienbot-session');
const affinityCache = require('../../utilities/affinity-cache');
const { computeAndCacheAffinity } = require('../../utilities/hidden-signals');

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
 * Token budget for the conversation history window sent to the LLM.
 * ~3 000 tokens leaves headroom for the system prompt, context blocks, and
 * the model's response (maxTokens = 1 500).
 */
const HISTORY_TOKEN_BUDGET = 3000;
const HISTORY_CHARS_PER_TOKEN = 4; // rough approximation (1 token ≈ 4 chars)
const HISTORY_MAX_CHARS = HISTORY_TOKEN_BUDGET * HISTORY_CHARS_PER_TOKEN; // 12 000 chars

/**
 * Hard cap (tokens) on the combined context blocks injected into the system
 * prompt.  Each individual context builder is soft-capped at 1 500 tokens, but
 * when multiple builders run in parallel (invoke + intent) the aggregate can
 * easily exceed 5 000 tokens and push the full prompt past the model's window.
 *
 * Budget breakdown (conservative 16 K token window):
 *   Static system prompt text  ~1 200 tokens
 *   History window             ~3 000 tokens  (HISTORY_TOKEN_BUDGET)
 *   LLM output reservation     ~1 500 tokens  (maxTokens)
 *   ── remaining for context ──  ≥10 000 tokens for larger models
 *
 * We cap context at 4 000 tokens so the controller stays comfortably within
 * smaller-window models (GPT-4 8 K, etc.) without sacrificing quality on
 * larger ones.
 */
const CONTEXT_TOKEN_BUDGET = 4000;
const CONTEXT_CHAR_BUDGET = CONTEXT_TOKEN_BUDGET * HISTORY_CHARS_PER_TOKEN; // 16 000 chars

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
 * Resolve the experience ID from an invoke context object.
 * Returns the experience_id string for 'experience' entities.
 * Returns null for 'plan' entities (session.context not available at call site)
 * and for all other entity types.
 *
 * @param {Object} invokeContext - session.invoke_context or resolved invoke context
 * @returns {string|null}
 */
function resolveExperienceIdFromInvokeContext(invokeContext) {
  if (!invokeContext) return null;
  if (invokeContext.entity === 'experience') {
    return invokeContext.entity_id?.toString() ?? null;
  }
  // For 'plan' entities the session context (which holds experience_id) is not
  // yet available at the call site — return null to skip the blocking fallback.
  return null;
}

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
 * @param {string} entity - Entity type (destination, experience, plan, plan_item, user)
 * @param {string} entityId - Entity ID
 * @returns {Promise<string|null>} Resolved label or null
 */
async function resolveEntityLabel(entity, entityId) {
  const mapping = ENTITY_LABEL_MAP[entity];
  if (!mapping) return null;

  try {
    // plan_item is a subdocument — find the parent plan that contains it
    if (mapping.custom && entity === 'plan_item') {
      if (!mongoose.Types.ObjectId.isValid(entityId)) return null;
      const plan = await findPlanContainingItem(entityId, { select: 'plan._id plan.text plan.content', lean: true });
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
      return doc[mapping.field] || `Plan for ${experienceName}`;
    }

    return doc[mapping.field] || null;
  } catch (err) {
    logger.error('[bienbot] Failed to resolve entity label', { entity, entityId, error: err.message });
    return null;
  }
}

/**
 * Find the parent Plan document that contains a plan_item subdocument.
 *
 * @param {ObjectId|string} itemId - The plan item _id to search for
 * @param {object} [opts]
 * @param {string} [opts.select] - Mongoose field projection string
 * @param {boolean} [opts.lean] - Return a plain object instead of a Mongoose doc
 * @param {string} [opts.populate] - Field to populate
 * @param {string} [opts.populateSelect] - Field selection for populate
 * @returns {Promise<object|null>}
 */
async function findPlanContainingItem(itemId, opts = {}) {
  loadModels();
  const oid = mongoose.Types.ObjectId.isValid(itemId) && typeof itemId !== 'object'
    ? new mongoose.Types.ObjectId(itemId)
    : itemId;
  let q = Plan.findOne({ 'plan._id': oid });
  if (opts.select) q = q.select(opts.select);
  if (opts.populate) q = q.populate(opts.populate, opts.populateSelect);
  if (opts.lean) q = q.lean();
  return q;
}

/**
 * Build the system prompt for the BienBot LLM call.
 *
 * @param {object} params
 * @param {string|null} params.invokeLabel - Resolved entity label if invokeContext is present
 * @param {string|null} params.contextDescription - Rich page description from the client (e.g. "My Plan on 'Paris Trip'")
 * @param {string|null} params.contextBlock - Pre-built context text from context builders
 * @param {object} params.session - The BienBot session
 * @param {string|null} params.userMemoryBlock - Pre-formatted user memory block from past sessions
 * @param {string|null} params.userName - User's first name for personalized greeting
 * @param {string|null} params.userLanguage - User's preferred language code (e.g. 'en', 'fr')
 * @param {string|null} params.userTimezone - User's timezone (e.g. 'America/New_York')
 * @param {object|null} params.userHiddenSignals - User's behavioral signal vector
 * @returns {string}
 */
function buildSystemPrompt({ invokeLabel, invokeEntityType, contextDescription, contextBlock, session, userMemoryBlock, entityResolutionBlock, resolvedEntityObjects, userCurrency, userName, userLanguage, userTimezone, userHiddenSignals, lastShownEntities }) {
  // Build USER PROFILE block (personalization context)
  const profileLines = [];
  if (userName) {
    profileLines.push(`The logged-in user's name is ${userName}. Address them by their first name when greeting or making the conversation feel personal.`);
  }
  if (userLanguage && userLanguage !== 'en') {
    profileLines.push(`User's preferred language: ${userLanguage}. Respond in this language when possible unless the user writes in a different language.`);
  }
  if (userTimezone && userTimezone !== 'UTC') {
    profileLines.push(`User's timezone: ${userTimezone}. Use this when presenting dates and times.`);
  }
  if (userHiddenSignals && typeof userHiddenSignals.confidence === 'number' && userHiddenSignals.confidence > 0.2) {
    const signals = userHiddenSignals;
    const signalDescriptions = [];
    if (signals.cultural_depth >= 0.65) signalDescriptions.push('values cultural depth and immersive local experiences');
    if (signals.food_focus >= 0.65) signalDescriptions.push('is food-focused and enjoys culinary experiences');
    if (signals.energy >= 0.70) signalDescriptions.push('prefers high-energy, active travel');
    else if (signals.energy <= 0.35) signalDescriptions.push('prefers relaxed, low-key travel');
    if (signals.novelty >= 0.65) signalDescriptions.push('seeks novel, off-the-beaten-path experiences');
    if (signals.budget_sensitivity >= 0.70) signalDescriptions.push('is budget-conscious');
    if (signals.social >= 0.65) signalDescriptions.push('enjoys social or group travel experiences');
    else if (signals.social <= 0.35) signalDescriptions.push('prefers solo or intimate travel');
    if (signals.comfort_zone <= 0.35) signalDescriptions.push('is adventurous and open to stepping outside their comfort zone');
    if (signalDescriptions.length > 0) {
      profileLines.push(`Traveler personality (learned from behavior — confidence: ${Math.round(signals.confidence * 100)}%): This user ${signalDescriptions.join(', ')}. Tailor suggestions and tone to match these preferences.`);
    }
  }

  const lines = [
    'You are BienBot, a helpful travel planning assistant for the Biensperience platform.',
    'You help users explore destinations, plan experiences, manage plan items, track costs, collaborate with others, and answer travel questions.',
    '',
    ...(profileLines.length > 0 ? ['USER PROFILE:', ...profileLines, ''] : []),
    'IMPORTANT RULES:',
    '- Be concise and helpful.',
    '- Use sentence case for all text (only capitalize the first word of a sentence and proper nouns). Do not use title case for headings, recommendations, or labels.',
    '- Always use US English spellings (e.g. "favorite" not "favourite", "color" not "colour", "prioritize" not "prioritise").',
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
    '- IMPORTANT: When asking a clarifying question about a specific child entity (e.g. which plan item to remove), populate entity_refs with the relevant child entities (plan_item), never the parent (experience). Only include the parent entity in entity_refs when the action targets the parent itself.',
    '',
    'ATTENTION SIGNALS:',
    '- Context blocks may include [ATTENTION] sections listing gaps, anomalies, or urgencies.',
    '- When [ATTENTION] signals are present and the user\'s opening message is open-ended (e.g. "hey", "what should I do?", "help me plan"), surface the most urgent one naturally in your response.',
    '- Do not list all signals mechanically. Weave the most important one into a helpful, conversational observation.',
    '- If the user\'s message already addresses the signal topic, do not repeat it.',
    '',
    'TRAVEL SIGNALS — prioritization:',
    '- The [TRAVEL SIGNALS] context section (when present) encodes the user\'s inferred travel personality (e.g. food-focused, adventurous, budget-conscious, social).',
    '- Whenever the user asks an open-ended prioritization question — "which one first?", "what should I work on?", "which trip/plan/experience/item should I prioritize?", "what do you recommend?", "help me decide" — you MUST use [TRAVEL SIGNALS] to make a confident, personalized recommendation. DO NOT ask for clarification.',
    '- Apply this rule across ALL entity types:',
    '  • Plans/trips: recommend the one whose destination or experience type best matches the user\'s signals.',
    '  • Experiences: recommend the one whose activity type aligns with the user\'s personality.',
    '  • Plan items: recommend completing items that match the user\'s travel style first (e.g. food-focused → prioritize dining reservations).',
    '  • Destinations: recommend the one that fits the user\'s personality (e.g. novelty-seeker → off-the-beaten-path).',
    '- Always name the specific entity you recommend and give ONE concise reason tied to their travel personality.',
    '- Include the recommended entity in entity_refs.',
    '- If [TRAVEL SIGNALS] is absent or confidence is too low, fall back to objective signals (soonest trip date, most overdue item, most items remaining) and explain the reasoning briefly.',
    '',
    'AFFINITY SIGNALS — entity-level match:',
    '- The invoke context may include an [AFFINITY] line for the experience or plan currently open:',
    '  e.g. "User affinity for this experience: strong alignment — driven by shared interest in food and culinary experiences, mutual appreciation for cultural depth and local immersion"',
    '- When [AFFINITY] is present and the user asks an open-ended question about the current entity',
    '  ("is this a good fit for me?", "should I add more items?", "what do you think of this?"),',
    '  reference the affinity alignment and the specific driver descriptions in your answer.',
    '- Use the driver descriptions directly in your response — they describe what connects the user to the experience',
    '  (e.g. "this experience is a strong match because of your shared interest in food and cultural immersion").',
    '- Never use numeric scores, percentages, or quantitative terms when discussing affinity or discovery results.',
    '  Prefer "strong match", "moderate match", "popular among travelers", "well-liked" over any numbers.',
    '- When [AFFINITY] is absent, do not invent affinity reasoning.',
    '',
    'DISCOVERY RESULTS — qualitative descriptions:',
    '- [DISCOVERY RESULTS] blocks describe experiences using qualitative labels (e.g. "popular among travelers", "strong match for your travel style") and dimension drivers (e.g. "driven by shared interest in food").',
    '- When presenting discovery results to the user, use these qualitative descriptions naturally.',
    '- Never expose raw counts, percentages, or numeric scores from discovery results. Say "well-liked by travelers" instead of "23 plans" or "85% completion".',
    '- Use the affinity driver descriptions to explain WHY an experience is a good fit.',
    '',
    'GREETING CONTEXT SECTIONS — follow-up handling:',
    '- Every entity mentioned in the greeting carries an inline entityJSON ref. Use those IDs for actions and navigation without asking the user.',
    '',
    'OVERDUE ITEMS ([OVERDUE ITEMS] section):',
    '- When the user asks which item is overdue, or asks to see/go to the overdue item, use the [OVERDUE ITEMS] section to identify the item by name and plan.',
    '- Always propose a navigate_to_entity action (entity: "plan") so the user can jump directly to the plan containing the overdue item.',
    '- Include the overdue plan_item in entity_refs so the frontend can highlight it.',
    '- For prioritization questions ("which overdue item should I fix first?", "where should I start?"), apply the global TRAVEL SIGNALS prioritization rule — recommend the item whose activity type or destination best matches the user\'s personality.',
    '',
    'IMMINENT INCOMPLETE ITEMS ([IMMINENT INCOMPLETE ITEMS] section):',
    '- When the user asks "what\'s still open for my upcoming trip?" or "what do I need to do before my trip?", use [IMMINENT INCOMPLETE ITEMS].',
    '- List the items by name and propose navigate_to_entity to the containing plan.',
    '- Include each plan_item and its parent plan in entity_refs.',
    '- For prioritization questions ("which open item should I tackle first?"), apply the global TRAVEL SIGNALS prioritization rule — then fall back to the item closest to its scheduled date.',
    '',
    'PLANS WITHOUT DATE ([PLANS WITHOUT DATE] section):',
    '- When the user asks "which plans have no date?" or "which trips aren\'t scheduled yet?", list these plans and offer to set a date with update_plan.',
    '- Include each plan in entity_refs and propose update_plan with planned_date if the user provides one.',
    '- For prioritization questions ("which plan should I date first?"), apply the global TRAVEL SIGNALS prioritization rule above — pick the best match and offer to set the date immediately.',
    '',
    'RECENT ACTIVITY ([RECENT ACTIVITY (48h)] section):',
    '- When the user asks "what did I do recently?", "which experience did I update?", or "show my recent changes", use [RECENT ACTIVITY (48h)].',
    '- Each activity line includes an entityJSON ref for the affected entity — use those IDs directly.',
    '- Propose navigate_to_entity if the user wants to go to a recently-modified entity.',
    '',
    'ACTIVE PLANS (active plans list):',
    '- Every plan in the list has Plan, Experience, and Destination entity refs on its line.',
    '- When the user asks "show me my Paris plans", "take me to my Aruba trip", or filters by destination/experience name, match against the listed plans and propose navigate_to_entity.',
    '- When the user asks "which plans are coming up this week?", filter by the [in Nd] proximity tags.',
    '- When the user asks "which plan has progress?", check the completed item count.',
    '- For prioritization questions ("which active plan should I focus on?", "where should I start?"), apply the global TRAVEL SIGNALS prioritization rule — then fall back to the plan with the nearest upcoming date or the most items remaining.',
    '',
    'DATE AND TIME:',
    `- Today's date is ${new Date().toISOString().split('T')[0]}.`,
    '- When the user specifies a relative time (e.g. "in 3 months", "next week", "this summer"), calculate the exact date.',
    '- Include the resolved date in the action payload (e.g. planned_date field).',
    '- State the calculated date in your message so the user can confirm or correct it.',
    '- Example: User says "in 3 months" on 2026-03-23 → planned_date: "2026-06-23". Message: "I\'ll set the date to June 23, 2026."',
    '- IMPORTANT — Plan-level vs Item-level dates: `update_plan.planned_date` is the overall trip date for the plan. `update_plan_item.scheduled_date` (and `scheduled_time`) is the date/time a specific plan item is scheduled. When the active context is a plan_item, "set a date" or "set a time" means `update_plan_item` with `scheduled_date`/`scheduled_time` — NOT `update_plan`. Only use `update_plan` for the plan\'s trip date when the user explicitly refers to changing when the trip happens.',
    '',
    'ENTITY IDs:',
    '- NEVER fabricate or use placeholder IDs like "<experience_id>" or "<destination_id>".',
    '- Use real entity IDs from the context blocks provided below.',
    '- NEVER ask the user for an entity ID. Users do not know IDs.',
    '- NEVER show raw entity IDs in your message text.',
    '- For creation actions (create_destination, create_experience, create_plan), do NOT include an _id field — MongoDB generates it automatically.',
    '',
    'ENTITY REFERENCES (entity_refs):',
    '- When your message discusses or references a specific entity (destination, experience, plan, or plan_item) that has a known _id from context or entity resolution, include it in the entity_refs array.',
    '- Format: { "type": "destination|experience|plan|plan_item", "_id": "<real id>", "name": "<entity name>" }',
    '- For plans, also include "experience_id": "<experience _id>" when available.',
    '- Only include entities with real IDs from context — never fabricate. Leave entity_refs as [] if none apply.',
    '',
    'ENTITY REFERENCES IN MESSAGES:',
    'When your message text mentions an entity for which you have a REAL _id from the context blocks, embed it as a compact JSON object:',
    '  {"_id":"<real_id_from_context>","name":"<display_name>","type":"<entity_type>"}',
    'Entity types: destination, experience, plan, plan_item, user',
    'Examples:',
    '  "I\'ll create a plan for {\\"_id\\":\\"693f214a2b3c4d5e6f7a8b9c\\",\\"name\\":\\"Tokyo Temple Tour\\",\\"type\\":\\"experience\\"}!"',
    'Rules:',
    '- ONLY embed an entity JSON object if you have the real _id from the context blocks. Never invent or guess an _id.',
    '- If you do NOT have a real _id for an entity (e.g. the user named a destination not yet in context), use plain text for the name — do NOT embed a JSON object.',
    '- _id must be a real MongoDB ObjectId or other ID exactly as it appears in the context — never a slug, abbreviation, or made-up string.',
    '- The name field is what the user sees; always include it.',
    '',
    'INTENT-SPECIFIC BEHAVIOR:',
    '- QUERY_DASHBOARD: Summarize the user\'s overview — upcoming plans, recent activity, stats from the context. Be proactive about surfacing important information. When the user follows up with a prioritization question ("what should I focus on?", "where do I start?"), apply the global TRAVEL SIGNALS prioritization rule.',
    '- QUERY_PLAN_COSTS: Present a clear cost breakdown from the plan context. Include total cost, currency, and per-category breakdown when available. Suggest update_plan_cost or add_plan_cost if data seems incomplete.',
    '- QUERY_EXPERIENCE_TAGS: List the activity types/tags on the experience. Suggest update_experience if the user wants to add or change tags.',
    '- SEARCH_CONTENT: Summarize the search results from context. If no results, offer to create or suggest narrowing the query.',
    '- QUERY_COUNTRY: Provide context about the destination/country from discovery context. Include practical travel info and suggest creating an experience or plan if the user is interested.',
    '- QUERY_PHOTOS: Use fetch_entity_photos to retrieve photos for the current experience or destination. The entity_id comes from the session context — never ask for it.',
    '- ADD_PHOTO: Explain that photos can be uploaded via the entity\'s photo section. You cannot upload photos directly — guide the user to the relevant page using navigate_to_entity.',
    '- QUERY_ACTIVITY_FEED: Use list_user_activities to retrieve recent activity (READ-ONLY, executes immediately). Summarize the history in natural language.',
    '- QUERY_DOCUMENTS: Use list_entity_documents to retrieve documents for the current entity (READ-ONLY, executes immediately). Summarize what documents are attached.',
    '- UPLOAD_DOCUMENT: Documents must be uploaded through the entity\'s document section in the UI. Guide the user to the relevant page using navigate_to_entity and explain that document uploads are handled there.',
    '- DISCUSS_PLAN_ITEM: Summarize what is known about the plan item from context — its notes, details (transport, accommodation, parking, discount), cost, scheduled date/time, assignee, and any photos. If the user asks follow-up questions about the item (e.g. "how much does it cost", "what notes are on it"), answer from the plan context. Propose relevant actions if the item is incomplete (e.g. add_plan_item_note, add_plan_item_detail, update_plan_item).',
    '- ADD_DESTINATION_TIP: The user wants to add a travel tip to the current destination. Use update_destination with a travel_tips array that appends the new tip to any existing tips from the context. Never overwrite existing tips — merge the new tip with the current list. Ask the user for the tip content if not already provided.',
    '- PIN_PLAN_ITEM: Use pin_plan_item with the plan_id and item_id from context. Confirm which item the user wants to pin if ambiguous.',
    '- UNPIN_PLAN_ITEM: Use unpin_plan_item with the plan_id and item_id from context.',
    '- CREATE_INVITE: Use create_invite. If the user provides an email address, include it in the payload and set send_email: true to dispatch the invitation. Confirm the invite settings (email if given, max uses, expiry) with the user before proposing.',
    '- SHARE_INVITE: The user wants to invite someone by email. Use create_invite with the email and send_email: true. Ask for the recipient\'s email if not provided. Confirm before proposing.',
    '- REQUEST_PLAN_ACCESS: Use request_plan_access with the plan_id. Confirm with the user if context is ambiguous.',
    '- FOLLOW_USER: Use follow_user with the user_id from context. Always confirm which user the user wants to follow before proposing — never guess.',
    '- UNFOLLOW_USER: Use unfollow_user with the user_id from context. Confirm with the user before proposing.',
    '- QUERY_FOLLOWERS: Use list_user_followers (READ-ONLY, executes immediately) with the user_id from the profile context. Default type is "followers"; set type to "following" when the user asks who they follow.',
    '- ACCEPT_FOLLOW_REQUEST: Use accept_follow_request with follower_id from context. If multiple pending requests exist, list them and ask which one to accept.',
    '- UPDATE_PROFILE: Use update_user_profile with only the fields the user explicitly asked to change (name, bio, or preferences). Never update fields the user did not mention.',
    '- REORDER_PLAN_ITEMS: Use reorder_plan_items with plan_id and item_ids ordered as the user described. Read all current item IDs from the plan context block — do not omit any items.',
    '- INVITE_COLLABORATOR: The user wants to add someone to their plan or experience. Use invite_collaborator with plan_id (from plan context) or experience_id. To resolve the user_id: first check the COLLABORATORS section in context for an existing member; if not found, propose list_user_followers with type "following" as an immediate read-only step so the user can pick from a list — never guess a user_id. Confirm the person and role (default: "collaborator") before proposing the invite action.',
    '- DELETE_PLAN: When the experience context block shows "User\'s plan for this experience: exists (plan_id: <id>, ...)", include that plan_id in the payload. You may also pass experience_id instead — the executor will resolve the logged-in user\'s plan for that experience automatically. Always confirm with the user before proposing.',
    '- REMOVE_COLLABORATOR: Use remove_collaborator with plan_id and user_id from the COLLABORATORS section in context. List current collaborators for the user to choose if it is ambiguous. Always confirm before proposing — this revokes their access.',
    '- SET_MEMBER_LOCATION: The user wants to set their travel origin for the plan. Use set_member_location with plan_id from context. Ask for city and country if not mentioned. Accept an optional travel_cost_estimate and currency if the user provides one. This action always applies to the logged-in user — never set location for someone else.',
    '- REMOVE_MEMBER_LOCATION: Use remove_member_location with plan_id from context. Confirm with the user before proposing.',
    ''
  ];

  if (userMemoryBlock) {
    lines.push(userMemoryBlock);
    lines.push('');
  }

  if (invokeLabel) {
    const entityTypeLabels = {
      destination: 'destination',
      experience: 'experience',
      plan: 'plan',
      plan_item: 'plan item',
      user: 'user profile',
    };
    const effectiveEntityType = invokeEntityType || session?.invoke_context?.entity || null;
    const entityTypeStr = effectiveEntityType ? (entityTypeLabels[effectiveEntityType] || effectiveEntityType) : null;
    lines.push(entityTypeStr ? `Viewing ${entityTypeStr}: ${invokeLabel}` : `Viewing: ${invokeLabel}`);
    if (contextDescription) {
      lines.push(`Page context: ${contextDescription}`);
    }
    lines.push('IMPORTANT: When the user says "this experience", "this plan", "this destination", or any other self-referential phrase, they are referring to the entity shown in the "Viewing" line above — NOT any entity from prior conversation history or session context. Always use the entity and its IDs from the context block that corresponds to the "Viewing" entity for any action the user requests on this page.');
    lines.push('');
  }

  if (userCurrency) {
    lines.push(`User's preferred currency: ${userCurrency}`);
    lines.push('Use this currency as the default for cost-related actions unless the user explicitly specifies a different currency.');
    lines.push('');
  }

  if (contextBlock) {
    lines.push('--- Context ---');
    lines.push(contextBlock);
    lines.push('');
  }

  if (entityResolutionBlock) {
    lines.push(entityResolutionBlock);
    lines.push('');
  }

  if (resolvedEntityObjects && resolvedEntityObjects.length > 0) {
    lines.push('RESOLVED ENTITIES (use these _id values in action payloads and entity_refs):');
    lines.push(JSON.stringify(resolvedEntityObjects, null, 2));
    lines.push('');
  }

  if (lastShownEntities && lastShownEntities.length > 0) {
    lines.push('LAST SHOWN ENTITY:');
    lines.push('- The previous response highlighted these entities. If the user\'s reply is a short affirmation ("yes", "ok", "plan it", "go ahead", "do it", "sure", "that one") or does not reference a specific entity by name, treat it as referring to the entity shown below.');
    lines.push('- Use the IDs below directly in action payloads — do NOT ask which entity the user means.');
    for (const e of lastShownEntities) {
      const extra = e.experience_id ? `, experience_id: ${e.experience_id}` : '';
      lines.push(`  • ${e.type}: "${e.name}" (_id: ${e._id}${extra})`);
    }
    lines.push('');
  }

  lines.push(
    'PLANNING AN EXPERIENCE:',
    'The user wants to plan an experience. Follow this flow:',
    '1. A destination must be known before listing or discovering experiences. If the context block or search results below include a destination with a real _id, proceed immediately — a formal session context.destination_id is NOT required. If the conversation history mentions a destination by name, treat it as established and use any entity IDs provided in the context or entity resolution blocks. Only ask "Which destination are you planning for?" when no destination has been mentioned or resolved anywhere in this conversation.',
    '2. Once a destination is known and an experience is resolved, propose a `create_plan` action with the `experience_id`. Do NOT include a `planned_date` — you will ask for that after creation.',
    '3. After the plan is created, ask when they are planning to go. Convert relative dates to absolute ISO dates.',
    '4. After the user provides a date, propose an `update_plan` action with the `planned_date`.',
    '5. After the date is set, use `suggest_plan_items` to show popular items.',
    'Never propose a `navigate_to_entity` action when the user wants to plan.',
    'If has_user_plan is true in context for the selected experience, ask whether they want a new plan or to work on the existing one before proposing create_plan.',
    'When multiple experiences match and the user asks "which should I plan first?" or similar prioritization questions, apply the global TRAVEL SIGNALS prioritization rule.',
    ''
  );

  lines.push(
    'Respond ONLY with valid JSON — no markdown fences, no explanation outside the JSON.',
    '',
    'Response schema:',
    '{',
    '  "message": "Your response text to the user (plain text or markdown). Use this for clarifying questions when needed.",',
    '  "entity_refs": [',
    '    { "type": "destination|experience|plan|plan_item", "_id": "<real id>", "name": "<entity name>" }',
    '  ],',
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
    'PENDING ACTION BUTTON OVERRIDES (optional):',
    'Each action in pending_actions may include these optional fields to customise button labels:',
    '  "confirm_label": "Yes, create it"   // overrides primary button (max 40 chars)',
    '  "dismiss_label": "Not yet"          // overrides secondary button (max 40 chars)',
    'Use overrides only when default labels feel wrong for the conversation context.',
    'Examples where overrides make sense:',
    '  - You asked "Shall I create a plan?" → confirm_label: "Yes, create it"',
    '  - User said "maybe later" → dismiss_label: "Remind me later"',
    '  - Confirming a destructive action → confirm_label: "Yes, delete it"',
    'Do NOT include overrides for routine actions — the defaults are correct in most cases.',
    'Do NOT use overrides to add new button types; only these two labels are supported.',
    '',
    'Available action types:',
    '  create_destination, create_experience, create_plan,',
    '  update_experience, update_destination, update_plan,',
    '  add_plan_items, update_plan_item, mark_plan_item_complete, mark_plan_item_incomplete, delete_plan_item, delete_plan,',
    '  add_experience_plan_item, update_experience_plan_item, delete_experience_plan_item,',
    '  add_plan_item_note, update_plan_item_note, delete_plan_item_note,',
    '  add_plan_item_detail, update_plan_item_detail, delete_plan_item_detail,',
    '  assign_plan_item, unassign_plan_item,',
    '  add_plan_cost, update_plan_cost, delete_plan_cost,',
    '  invite_collaborator, remove_collaborator, sync_plan,',
    '  toggle_favorite_destination, set_member_location, remove_member_location,',
    '  navigate_to_entity, list_user_experiences,',
    '  follow_user, unfollow_user, accept_follow_request, list_user_followers,',
    '  update_user_profile,',
    '  list_user_activities,',
    '  pin_plan_item, unpin_plan_item, reorder_plan_items,',
    '  shift_plan_item_dates,',
    '  list_entity_documents,',
    '  create_invite, request_plan_access',
    '',
    'Action payload schemas:',
    '',
    '--- Destination ---',
    '- create_destination: { name, country, state?, overview?, location? }',
    '- update_destination: { destination_id, name?, country?, state?, overview?, location?, travel_tips? }',
    '  travel_tips is an array of strings (e.g. ["Bring an umbrella", "Learn basic phrases"])',
    '- toggle_favorite_destination: { destination_id }  (always uses logged-in user)',
    '',
    '--- Experience ---',
    '- create_experience: { name, destination_id?, description?, plan_items?, experience_type?, visibility? }',
    '- update_experience: { experience_id, name?, overview?, destination?, experience_type?, visibility?, location? }',
    '- add_experience_plan_item: { experience_id, text, url?, cost_estimate?, planning_days?, parent?, activity_type?, location? }',
    '- update_experience_plan_item: { experience_id, plan_item_id, text?, url?, cost_estimate?, planning_days?, parent?, activity_type?, location? }',
    '- delete_experience_plan_item: { experience_id, plan_item_id }',
    '',
    '--- Plan ---',
    '- create_plan: { experience_id, planned_date?, currency? }',
    '- update_plan: { plan_id, planned_date?, currency?, notes? }',
    '- shift_plan_item_dates: { plan_id, diff_days } — Shifts all scheduled plan item dates by the given number of days. Propose this automatically after an update_plan that changes planned_date when the user confirms they want item dates shifted too.',
    '- delete_plan: { plan_id?, experience_id? }  (⚠️ confirm with user first) — when viewing an experience page, prefer passing experience_id; the executor will resolve the logged-in user\'s plan automatically.',
    '- sync_plan: { plan_id }',
    '',
    '--- Plan Items ---',
    '- add_plan_items: { plan_id, items: [{ text, url?, cost?, planning_days?, parent?, activity_type?, location? }] }',
    '  IMPORTANT: For add_plan_items, include ONLY the "text" field per item unless the user explicitly provides url, cost, or other details. This keeps the response compact.',
    '- update_plan_item: { plan_id, item_id, complete?, text?, cost?, planning_days?, url?, activity_type?, scheduled_date?, scheduled_time?, visibility?, location? }',
    '  Use scheduled_date (ISO date string) and scheduled_time ("HH:MM") to set when this specific item is scheduled.',
    '  This is the item schedule — NOT the plan trip date. To change the trip date use update_plan instead.',
    '- mark_plan_item_complete: { plan_id, item_id } — mark a plan item as done (prefer over update_plan_item when only changing completion status)',
    '- mark_plan_item_incomplete: { plan_id, item_id } — unmark a plan item as done',
    '- delete_plan_item: { plan_id, item_id }  (⚠️ confirm with user first)',
    '- add_plan_item_note: { plan_id, item_id, content, visibility? ("private" or "contributors") }',
    '- update_plan_item_note: { plan_id, item_id, note_id, content, visibility? }',
    '- delete_plan_item_note: { plan_id, item_id, note_id }  (⚠️ confirm with user first)',
    '',
    '--- Plan Item Details (structured extensions) ---',
    'Each plan item can have one entry per detail type. Use add to create, update to modify, delete to remove.',
    '- add_plan_item_detail: { plan_id, item_id, type, data }',
    '- update_plan_item_detail: { plan_id, item_id, detail_type, data }  (detail_id optional — type is sufficient)',
    '- delete_plan_item_detail: { plan_id, item_id, detail_type }  (⚠️ confirm with user first)',
    '',
    'Detail type schemas for the `data` field:',
    '  type "transport": {',
    '    mode (required, one of: flight|train|cruise|ferry|bus|coach|car_share|ride|metro|local_transit|bike_rental|scooter),',
    '    vendor?, trackingNumber?, departureTime? (ISO), arrivalTime? (ISO),',
    '    departureLocation?, arrivalLocation?, status? (scheduled|active|completed|cancelled|delayed),',
    '    transportNotes?,',
    '    flight?: { terminal?, arrivalTerminal?, gate?, arrivalGate? },',
    '    train?: { carriageNumber?, platform?, arrivalPlatform? },',
    '    cruise|ferry?: { deck?, shipName?, embarkationPort?, disembarkationPort? },',
    '    bus|coach?: { stopName?, arrivalStopName? },',
    '    carShare|ride?: { vehicleModel?, vehicleColor?, licensePlate?, pickupSpot? },',
    '    metro|localTransit?: { lineNumber?, direction?, platform? },',
    '    bikeRental|scooter?: { dockName?, returnDockName? }',
    '  }',
    '  type "accommodation": {',
    '    name?, confirmationNumber?, address?,',
    '    checkIn? (ISO), checkOut? (ISO), roomType?,',
    '    cost?, currency? (3-letter code), notes?',
    '  }',
    '  type "parking": {',
    '    parkingType? (street|garage|lot|valet|hotel|airport|venue|private|other),',
    '    facilityName?, address?, spotNumber?, level?,',
    '    startTime? (ISO), endTime? (ISO), cost?, currency?,',
    '    prepaid? (bool), confirmationNumber?, accessCode?,',
    '    status? (reserved|active|completed|cancelled), parkingNotes?',
    '  }',
    '  type "discount": {',
    '    discountType? (promo_code|coupon|loyalty|member|early_bird|group|seasonal|referral|other),',
    '    code?, description?, discountValue?, isPercentage? (bool), currency?,',
    '    minimumPurchase?, maxDiscount?, expiresAt? (ISO date),',
    '    status? (active|applied|expired|invalid), source?, discountNotes?',
    '  }',
    '',
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
    '--- External Data (read-only, auto-executed) ---',
    '- suggest_plan_items: { destination_id, experience_id?, exclude_items?: [string], limit?: 10 }',
    '  Fetches popular plan items from other travelers\' public experiences in the same destination.',
    '  Returns suggestions ranked by frequency. The user can then pick which items to add.',
    '  Use when the user asks for ideas, suggestions, or what others have done in a destination.',
    '- fetch_entity_photos: { entity_type ("destination"|"experience"), entity_id, limit?: 6 }',
    '  Fetches photos for a destination or experience. Returns photo URLs for inline display.',
    '  Use when the user asks to see photos of a destination or experience.',
    '- fetch_destination_tips: { destination_id, destination_name? }',
    '  Fetches travel tips from external sources (Wikivoyage, Google Maps) for a destination.',
    '  Returns categorized tips (Food, Safety, Transportation, Sightseeing, etc.) the user can select.',
    '  Use when the user asks for travel tips, advice, or practical info about a destination.',
    '  Also auto-triggered after create_destination — no need to propose it immediately after creation.',
    '- discover_content: { activity_types?: [string], destination_name?: string, destination_id?: string, min_plans?: number, max_cost?: number }',
    '  Discovers popular experiences matching filters. activity_types can be semantic categories',
    '  (culinary, adventure, cultural, wellness, nightlife) or specific types (food, museum, etc.).',
    '  Use when user asks to discover, explore, or find experiences by category or destination.',
    '',
    '- list_user_experiences: { user_id, limit?: 20 }',
    '  Returns experiences created by the given user. READ-ONLY — executes immediately.',
    '  Use when the user asks to see another user\'s experiences or when in a user profile context.',
    '',
    '- list_user_followers: { user_id, type?: "followers"|"following", limit?: 20 }',
    '  Returns followers or following list for the given user. READ-ONLY — executes immediately.',
    '  Use when the user asks who follows someone or who they follow.',
    '',
    '- list_user_activities: { limit?: 10 }',
    '  Returns the activity feed for the logged-in user (recent actions they have taken). READ-ONLY — executes immediately.',
    '  Use when the user asks "what have I done recently", "show my activity", or similar.',
    '',
    '- list_entity_documents: { entity_type ("plan"|"experience"|"destination"|"plan_item"), entity_id, plan_id? (required when entity_type is "plan_item"), limit?: 10 }',
    '  Returns documents attached to an entity. READ-ONLY — executes immediately.',
    '  Use when the user asks to see documents, files, or attachments for a plan, experience, or destination.',
    '',
    'NOTE: suggest_plan_items, fetch_entity_photos, fetch_destination_tips, discover_content, list_user_experiences, list_user_followers, list_user_activities, and list_entity_documents are READ-ONLY actions.',
    'They execute immediately without user confirmation and return structured data.',
    '',
    '--- Social ---',
    '- follow_user: { user_id }  — Follow the specified user.',
    '- unfollow_user: { user_id }  — Unfollow the specified user.',
    '- accept_follow_request: { follower_id }  — Accept a pending follow request from follower_id.',
    '  Use these when the user asks to follow, unfollow, or accept a follow request.',
    '  Always use the user_id from the context — never ask the user for an ID.',
    '',
    '--- Plan Item Actions ---',
    '- pin_plan_item: { plan_id, item_id }  — Pin a plan item so it appears highlighted at the top of the timeline.',
    '- unpin_plan_item: { plan_id, item_id }  — Remove the pinned status from a plan item.',
    '  Use when the user asks to pin/highlight/feature or unpin a specific plan item.',
    '- reorder_plan_items: { plan_id, item_ids: [string] }  — Reorder all plan items to the given order.',
    '  item_ids must contain ALL item IDs for the plan in the desired new order.',
    '  Use when the user asks to move, rearrange, or reorder items in their plan. Read item IDs from the plan context block.',
    '',
    '--- User Profile ---',
    '- update_user_profile: { name?, bio?, preferences?: { currency?, timezone?, theme? } }',
    '  Updates the logged-in user\'s own profile. Never accepts a target user_id.',
    '  Use for requests like "update my bio", "change my currency", "set my timezone".',
    '',
    '--- Invites & Access ---',
    '- create_invite: { email?, invitee_name?, send_email?: false, max_uses?: 1, expires_in_days?: 7 }',
    '  Creates a shareable invite code. When email is provided the code is tied to that address.',
    '  Set send_email: true to dispatch the invitation email automatically.',
    '  Use when the user asks to invite someone (with or without an email address) or generate an invite link.',
    '- request_plan_access: { plan_id, message? }',
    '  Sends an access request to the plan owner. Use when the user asks to join or view a plan they cannot access.',
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
    '--- Workflow (multi-step) ---',
    '- workflow: { steps: [{ step: <number>, type: "<action_type>", payload: { ... }, description: "..." }] }',
    '  Use this when the user\'s request requires MULTIPLE sequential actions that depend on each other.',
    '  For example: "Create a destination Paris, an experience, and add 3 items" requires:',
    '    1. create_destination (produces a destination ID)',
    '    2. create_experience (needs the destination ID from step 1)',
    '    3. add_plan_items (needs IDs from step 2)',
    '  Each step has a `step` number (1-based). Later steps can reference earlier step outputs using',
    '  `$step_N.<field>` syntax in their payload. For example:',
    '    { "step": 2, "type": "create_experience", "payload": { "name": "Visit Paris", "destination_id": "$step_1._id" } }',
    '  Rules:',
    '    - Max 10 steps per workflow.',
    '    - Steps execute sequentially in step-number order.',
    '    - If a step fails, execution halts (partial results are returned).',
    '    - Do NOT nest workflows inside workflows.',
    '    - Use workflows ONLY when steps have dependencies. For independent actions, propose them as separate pending_actions.',
    '    - Common $ref paths: $step_N._id, $step_N.destination, $step_N.experience._id',
    '',
    '## Multi-Action Workflow Decomposition',
    '',
    'When the user\'s message implies MULTIPLE distinct actions, decompose it into a workflow with ordered steps.',
    '',
    'Decomposition rules:',
    '1. **Dependency ordering**: Always create parent entities before children. Order: destination → experience → plan → plan items.',
    '2. **Entity grouping**: Group related items into a single step. For example, multiple plan items should be one add_plan_items step, not separate steps.',
    '3. **Disambiguation**: If creating a new entity AND the [Entity Resolution] block found a match, ask "Did you mean [matched entity] or would you like to create a new one?" Do NOT produce a workflow until disambiguated.',
    '4. **Max 10 steps per workflow, no nesting.** For independent actions that don\'t depend on each other, propose them as separate pending_actions instead of a workflow.',
    '5. **Use $step_N refs** for dependencies between steps. Common paths: $step_N._id, $step_N.destination, $step_N.experience._id.',
    '',
    'Examples:',
    '',
    'User: "Plan a weekend in Barcelona with tapas tour and Sagrada Familia"',
    '→ workflow with 2 steps:',
    '  Step 1: create_experience { name: "Weekend in Barcelona", destination_id: "<resolved_or_ask>" }',
    '  Step 2: add_plan_items { plan_id: "$step_1._id", items: [{ text: "Tapas tour" }, { text: "Visit Sagrada Familia" }] }',
    '',
    'User: "Copy my Paris items to Rome"',
    '→ First query the Paris items from context, then:',
    '  Step 1: add_plan_items { plan_id: "<rome_plan_id>", items: [<copied items>] }',
    '  (Single step — no workflow needed if IDs are already known)',
    '',
    'User: "Remove John and add Maria"',
    '→ 2 separate pending_actions (independent, no dependencies):',
    '  Action 1: remove_collaborator { plan_id: "<id>", user_id: "<john_id>" }',
    '  Action 2: invite_collaborator { plan_id: "<id>", user_id: "<maria_id>" }',
    '',
    'User: "Create destination Paris, an experience, and add 3 items"',
    '→ workflow with 3 steps:',
    '  Step 1: create_destination { name: "Paris", country: "France" }',
    '  Step 2: create_experience { name: "Explore Paris", destination_id: "$step_1._id" }',
    '  Step 3: add_plan_items { plan_id: "$step_2._id", items: [{ text: "..." }, { text: "..." }, { text: "..." }] }',
    '',
    'User: "Set up a trip to Tokyo with activities and invite Sarah"',
    '→ workflow with 4 steps:',
    '  Step 1: create_destination { name: "Tokyo", country: "Japan" }',
    '  Step 2: create_experience { name: "Trip to Tokyo", destination_id: "$step_1._id" }',
    '  Step 3: add_plan_items { plan_id: "$step_2._id", items: [{ text: "..." }] }',
    '  Step 4: invite_collaborator { experience_id: "$step_2._id", user_id: "<sarah_resolved_id>" }',
    '',
    'Key: Use a workflow ONLY when steps have dependencies. For independent actions (e.g. remove + add collaborator), use separate pending_actions.',
    '',
    'If no actions are needed (e.g. asking a clarifying question), return an empty pending_actions array.',
    'The "id" field must be unique per action — use "action_" followed by 8 random alphanumeric characters.'
  );

  return lines.join('\n');
}

/**
 * Build context blocks based on intent classification and session state.
 */
async function buildContextBlocks(intent, entities, session, userId, message, navigationSchema, resolvedInvokeContext = null) {
  loadModels();
  const blocks = [];

  // Use session context IDs to enrich the prompt.
  // Supplement with navigationSchema IDs for turn 1: before the LLM has had a chance
  // to return entity_refs, the schema already carries the full ancestor chain so every
  // applicable builder (destination, experience, plan) fires in parallel immediately.
  //
  // IMPORTANT: resolvedInvokeContext (the entity page the user is currently viewing)
  // ALWAYS overrides stale session.context IDs for its own entity type. This prevents
  // resumed sessions from using IDs from a previous conversation when the user has
  // navigated to a different entity page (e.g. "Unplan this experience" on Nashville
  // should never reference a stale Anchorage plan_id from a prior session turn).
  const sessionCtx = session.context || {};
  const schemaIds = navigationSchema ? extractContextIds(navigationSchema) : {};

  // Build invoke-context overrides — only override the specific entity type being viewed.
  const invokeOverrides = {};
  if (resolvedInvokeContext?.entity && resolvedInvokeContext?.entity_id) {
    switch (resolvedInvokeContext.entity) {
      case 'destination':
        invokeOverrides.destination_id = resolvedInvokeContext.entity_id;
        break;
      case 'experience':
        invokeOverrides.experience_id = resolvedInvokeContext.entity_id;
        // Clear stale plan_id that belongs to a different experience
        if (sessionCtx.plan_id && sessionCtx.experience_id &&
            String(sessionCtx.experience_id) !== String(resolvedInvokeContext.entity_id)) {
          invokeOverrides.plan_id = null;
        }
        break;
      case 'plan':
        invokeOverrides.plan_id = resolvedInvokeContext.entity_id;
        break;
      case 'plan_item':
        invokeOverrides.plan_item_id = resolvedInvokeContext.entity_id;
        break;
    }
  }

  const ctx = {
    destination_id: invokeOverrides.destination_id ?? sessionCtx.destination_id ?? schemaIds.destination_id ?? null,
    experience_id:  invokeOverrides.experience_id  ?? sessionCtx.experience_id  ?? schemaIds.experience_id  ?? null,
    // plan_id: if invokeOverrides explicitly sets it to null (stale plan cleared), honour null.
    // Otherwise fall through session → schema.
    plan_id: 'plan_id' in invokeOverrides
      ? invokeOverrides.plan_id
      : (sessionCtx.plan_id ?? schemaIds.plan_id ?? null),
    plan_item_id: invokeOverrides.plan_item_id ?? sessionCtx.plan_item_id ?? schemaIds.plan_item_id ?? null,
  };

  // Pre-fetch all user plans once when entity context is present.
  // Multiple builders (buildDestinationContext, buildExperienceContext, buildUserPlanContext)
  // each query Plan.find({ user: userId }) when they run in parallel — this shared cache
  // is passed as opts.userPlans to eliminate N redundant concurrent queries.
  let sharedUserPlans = null;
  if (ctx.destination_id || ctx.experience_id || ctx.plan_id) {
    try {
      sharedUserPlans = await Plan.find({ user: userId })
        .populate({ path: 'experience', select: 'name destination', populate: { path: 'destination', select: 'name country' } })
        .select('experience planned_date plan')
        .lean();
    } catch (prefetchErr) {
      logger.debug('[bienbot] User plans prefetch skipped', { error: prefetchErr.message });
    }
  }

  // When plan_id is known but experience_id is not, resolve it from the plan document.
  // This ensures intents like UPDATE_EXPERIENCE_PLAN_ITEM and DELETE_EXPERIENCE_PLAN_ITEM
  // work correctly even when the session was seeded solely with a plan context.
  if (ctx.plan_id && !ctx.experience_id) {
    try {
      const planDoc = await Plan.findById(ctx.plan_id).select('experience').lean();
      if (planDoc?.experience) {
        ctx.experience_id = planDoc.experience.toString();
      }
    } catch (e) {
      // Non-blocking — proceed without experience_id fallback
    }
  }

  try {
    const promises = [];

    // Intent-specific context
    if (intent === 'QUERY_DESTINATION' && entities.destination_name) {
      promises.push(buildSearchContext(entities.destination_name, userId).then(b => b && blocks.push(b)));
    }

    // Discovery intents — build aggregation-based discovery context showing
    // available experiences. Also triggered for PLAN_EXPERIENCE / CREATE_EXPERIENCE
    // so the LLM sees what's available to plan, not the user's existing plans.
    const DISCOVERY_INTENTS = new Set(['DISCOVER_EXPERIENCES', 'DISCOVER_DESTINATIONS', 'PLAN_EXPERIENCE', 'CREATE_EXPERIENCE']);
    if (DISCOVERY_INTENTS.has(intent)) {
      const discoveryFilters = {};
      if (entities.destination_name) discoveryFilters.destination_name = entities.destination_name;
      if (ctx.destination_id) discoveryFilters.destination_id = ctx.destination_id.toString();
      if (entities.activity_type) discoveryFilters.activity_types = [entities.activity_type];
      promises.push(buildDiscoveryContext(discoveryFilters, userId).then(b => b && blocks.push(b)));
    }

    // Navigation intent — resolve entity search so LLM can propose navigate_to_entity action with correct IDs/URLs
    if (intent === 'NAVIGATE_TO_ENTITY') {
      if (entities.destination_name) {
        promises.push(buildSearchContext(entities.destination_name, userId).then(b => b && blocks.push(b)));
      }
      if (entities.experience_name) {
        promises.push(buildSearchContext(entities.experience_name, userId).then(b => b && blocks.push(b)));
      }
      // Fallback: if no specific entity names extracted, search with the raw user message
      if (!entities.destination_name && !entities.experience_name && message) {
        promises.push(buildSearchContext(message, userId).then(b => b && blocks.push(b)));
      }
    }

    // Search intent — build search context from the raw user message
    if (intent === 'SEARCH_CONTENT' && message) {
      promises.push(buildSearchContext(message, userId).then(b => b && blocks.push(b)));
    }

    // Country query — build discovery context filtered by destination/country name
    if (intent === 'QUERY_COUNTRY') {
      const countryFilters = {};
      if (entities.destination_name) countryFilters.destination_name = entities.destination_name;
      promises.push(buildDiscoveryContext(countryFilters, userId).then(b => b && blocks.push(b)));
    }

    // Dashboard / overview — build user greeting context with stats and summaries
    if (intent === 'QUERY_DASHBOARD' || intent === 'QUERY_ACTIVITY_FEED') {
      promises.push(buildUserGreetingContext(userId).then(b => b && blocks.push(b)));
    }

    // Plan-related intent without a specific plan in context — load full user
    // greeting context so the LLM can see all plans (including undated ones) and
    // make recommendations without asking the user to provide the list.
    // Exception: when an experience is already in session context, the experience
    // context block already includes the user's plan for that experience (with plan_id),
    // so loading all plans would only confuse the LLM on entity-scoped actions like
    // unplan/delete that should target the current experience's plan.
    const OVERVIEW_PLAN_INTENTS = new Set([
      'QUERY_PLAN', 'UPDATE_PLAN', 'DELETE_PLAN', 'SYNC_PLAN', 'PLAN_EXPERIENCE',
      'ADD_PLAN_ITEMS', 'UPDATE_PLAN_ITEM', 'COMPLETE_PLAN_ITEM',
      'UNCOMPLETE_PLAN_ITEM', 'SCHEDULE_PLAN_ITEM', 'ADD_PLAN_ITEM_NOTE',
      'SET_PLAN_ITEM_LOCATION', 'UPDATE_PLAN_ITEM_COST', 'ADD_PLAN_ITEM_DETAIL',
      'ASSIGN_PLAN_ITEM', 'UPDATE_PLAN_ITEM_TEXT', 'UPDATE_PLAN_ITEM_URL',
      'DELETE_PLAN_ITEM', 'ADD_PLAN_COST'
    ]);
    if (OVERVIEW_PLAN_INTENTS.has(intent) && !ctx.plan_id && !ctx.experience_id) {
      promises.push(buildUserGreetingContext(userId).then(b => b && blocks.push(b)));
    }

    // Photo queries / add photo — auto-load photo context from the current entity in ctx
    if (intent === 'QUERY_PHOTOS' || intent === 'ADD_PHOTO') {
      if (ctx.experience_id) {
        promises.push(buildExperienceContext(ctx.experience_id.toString(), userId).then(b => b && blocks.push(b)));
      } else if (ctx.destination_id) {
        promises.push(buildDestinationContext(ctx.destination_id.toString(), userId).then(b => b && blocks.push(b)));
      }
    }

    // Profile queries — build user profile context from invoke context
    if (intent === 'QUERY_PROFILE' || intent === 'FOLLOW_USER' || intent === 'UNFOLLOW_USER' || intent === 'QUERY_FOLLOWERS' || intent === 'ACCEPT_FOLLOW_REQUEST') {
      if (session.invoke_context?.entity === 'user' && session.invoke_context?.entity_id) {
        promises.push(buildUserProfileContext(session.invoke_context.entity_id, userId).then(b => b && blocks.push(b)));
      }
    }

    // Profile self-edit — build the requesting user's own profile context
    if (intent === 'UPDATE_PROFILE') {
      promises.push(buildUserProfileContext(userId, userId).then(b => b && blocks.push(b)));
    }

    // Plan item pin/unpin — ensure plan context is available
    if ((intent === 'PIN_PLAN_ITEM' || intent === 'UNPIN_PLAN_ITEM') && ctx.plan_id) {
      promises.push(buildUserPlanContext(ctx.plan_id.toString(), userId).then(b => b && blocks.push(b)));
    }

    // Documents — build plan/experience/destination context as anchor for document queries
    if (intent === 'QUERY_DOCUMENTS' || intent === 'UPLOAD_DOCUMENT') {
      if (ctx.plan_id) {
        promises.push(buildUserPlanContext(ctx.plan_id.toString(), userId).then(b => b && blocks.push(b)));
      } else if (ctx.experience_id) {
        promises.push(buildExperienceContext(ctx.experience_id.toString(), userId).then(b => b && blocks.push(b)));
      } else if (ctx.destination_id) {
        promises.push(buildDestinationContext(ctx.destination_id.toString(), userId).then(b => b && blocks.push(b)));
      }
    }

    // Invites / access requests — build plan context so the assistant knows which plan to reference
    if ((intent === 'CREATE_INVITE' || intent === 'SHARE_INVITE' || intent === 'REQUEST_PLAN_ACCESS') && ctx.plan_id) {
      promises.push(buildUserPlanContext(ctx.plan_id.toString(), userId).then(b => b && blocks.push(b)));
    }

    // Member location removal — build plan context so the assistant has the plan_id
    if (intent === 'REMOVE_MEMBER_LOCATION' && ctx.plan_id) {
      promises.push(buildUserPlanContext(ctx.plan_id.toString(), userId).then(b => b && blocks.push(b)));
    }

    // Plan costs — build plan context which includes cost data
    if (intent === 'QUERY_PLAN_COSTS' && ctx.plan_id) {
      promises.push(buildUserPlanContext(ctx.plan_id.toString(), userId).then(b => b && blocks.push(b)));
    }

    // Session-level context (already resolved entities)
    const ctxOpts = sharedUserPlans ? { userPlans: sharedUserPlans } : {};
    if (ctx.destination_id) {
      promises.push(buildDestinationContext(ctx.destination_id.toString(), userId, ctxOpts).then(b => b && blocks.push(b)));
    }
    if (ctx.experience_id) {
      promises.push(buildExperienceContext(ctx.experience_id.toString(), userId, ctxOpts).then(b => b && blocks.push(b)));
    }
    if (ctx.plan_id) {
      // Guard: if both experience_id and plan_id are set, verify the plan actually
      // belongs to experience_id before adding it to context. A stale plan_id from
      // a previous session turn would otherwise mislead the LLM (e.g. telling it
      // about Plan A on the Porto experience while the user is viewing Nashville).
      let planBelongsToContext = true;
      if (ctx.experience_id && ctx.plan_id) {
        try {
          // Reuse sharedUserPlans if available to avoid an extra Plan.findById
          const planDoc = sharedUserPlans
            ? sharedUserPlans.find(p => String(p._id) === String(ctx.plan_id))
            : await Plan.findById(ctx.plan_id).select('experience').lean();
          if (planDoc && planDoc.experience?.toString() !== ctx.experience_id?.toString() &&
              planDoc.experience?._id?.toString() !== ctx.experience_id?.toString()) {
            planBelongsToContext = false;
            logger.debug('[bienbot] Skipping stale plan_id (belongs to different experience)', {
              planId: ctx.plan_id, planExperience: (planDoc.experience?._id || planDoc.experience)?.toString(), contextExperience: ctx.experience_id?.toString()
            });
          }
        } catch (planCheckErr) {
          logger.warn('[bienbot] Could not verify plan ownership, skipping plan context', { error: planCheckErr.message });
          planBelongsToContext = false;
        }
      }
      if (planBelongsToContext) {
        promises.push(buildUserPlanContext(ctx.plan_id.toString(), userId, ctxOpts).then(b => b && blocks.push(b)));
        // Add next-steps analysis for QUERY_PLAN intent
        if (intent === 'QUERY_PLAN') {
          promises.push(buildPlanNextStepsContext(ctx.plan_id.toString(), userId).then(b => b && blocks.push(b)));
        }
      }
    }
    if (ctx.plan_item_id && ctx.plan_id) {
      promises.push(buildPlanItemContext(ctx.plan_id.toString(), ctx.plan_item_id.toString(), userId).then(b => b && blocks.push(b)));
    }

    // Search context for entity references not yet in session
    if (entities.experience_name && !ctx.experience_id) {
      promises.push(buildSearchContext(entities.experience_name, userId).then(b => b && blocks.push(b)));
    }
    if (entities.destination_name && !ctx.destination_id && !DISCOVERY_INTENTS.has(intent) && intent !== 'NAVIGATE_TO_ENTITY' && intent !== 'QUERY_DESTINATION') {
      promises.push(buildSearchContext(entities.destination_name, userId).then(b => b && blocks.push(b)));
    }

    // Broad fallback: search with the raw message whenever no entity names were
    // extracted and no entity is already in session context. This handles any intent
    // where the user mentions an entity that NLP couldn't isolate — e.g. "work on
    // the Tokyo temple tour plan", "tell me about my Kyoto trip", etc.
    // Excluded: NAVIGATE_TO_ENTITY already has its own search block above.
    const hasEntityInSession = !!(ctx.destination_id || ctx.experience_id || ctx.plan_id);
    if (message && !entities.experience_name && !entities.destination_name && !hasEntityInSession && intent !== 'NAVIGATE_TO_ENTITY') {
      promises.push(buildSearchContext(message, userId).then(b => b && blocks.push(b)));
    }

    // User-entity session with no specific entity context — load full greeting
    // context so the LLM has the user's plan overview (including undated plans,
    // travel signals, attention items) for follow-up questions like "pick the best".
    if (!hasEntityInSession && session.invoke_context?.entity === 'user') {
      promises.push(buildUserGreetingContext(userId).then(b => b && blocks.push(b)));
    }

    // Recover entity context from recent assistant messages when the current message
    // doesn't reference an entity explicitly and none is in session context.
    // Handles follow-ups like "show me food experiences" after "I found Tokyo" in a prior turn.
    const hasEntityInCurrentMsg = !!(entities.destination_name || entities.experience_name);
    if (!hasEntityInCurrentMsg && !hasEntityInSession) {
      const recentAssistantMsgs = (session.messages || [])
        .filter(m => m.role === 'assistant')
        .slice(-3)
        .reverse(); // most recent first
      let historyDestId = null;
      let historyExpId = null;
      for (const histMsg of recentAssistantMsgs) {
        const refBlock = (histMsg.structured_content || []).find(b => b.type === 'entity_ref_list');
        if (!refBlock?.data?.refs) continue;
        for (const ref of refBlock.data.refs) {
          if (!ref._id || /<[^>]+>/.test(ref._id)) continue;
          if (ref.type === 'destination' && !historyDestId) historyDestId = ref._id;
          if (ref.type === 'experience' && !historyExpId) historyExpId = ref._id;
          // Plans carry experience_id — use it to load experience context for follow-ups
          if (ref.type === 'plan' && ref.experience_id && !historyExpId) historyExpId = ref.experience_id;
        }
        if (historyDestId || historyExpId) break;
      }
      if (historyDestId) {
        promises.push(buildDestinationContext(historyDestId, userId, ctxOpts).then(b => b && blocks.push(b)));
      }
      if (historyExpId) {
        promises.push(buildExperienceContext(historyExpId, userId, ctxOpts).then(b => b && blocks.push(b)));
      }
    }

    // Suggestion context when destination is known (enables LLM to propose suggest_plan_items)
    if (ctx.destination_id) {
      promises.push(
        buildSuggestionContext(
          ctx.destination_id.toString(),
          ctx.experience_id?.toString() || null,
          userId
        ).then(b => b && blocks.push(b))
      );
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
  const tryParse = (raw) => {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed.message !== 'string') return null;

      const actions = Array.isArray(parsed.pending_actions)
        ? parsed.pending_actions
          .filter(a =>
            a && typeof a.id === 'string' &&
              typeof a.type === 'string' &&
              ALLOWED_ACTION_TYPES.includes(a.type) &&
              a.payload && typeof a.description === 'string'
          )
          .map(a => {
            const action = { ...a };
            if (typeof action.confirm_label === 'string') {
              action.confirm_label = action.confirm_label.slice(0, 40) || undefined;
              if (!action.confirm_label) delete action.confirm_label;
            } else {
              delete action.confirm_label;
            }
            if (typeof action.dismiss_label === 'string') {
              action.dismiss_label = action.dismiss_label.slice(0, 40) || undefined;
              if (!action.dismiss_label) delete action.dismiss_label;
            } else {
              delete action.dismiss_label;
            }
            return action;
          })
        : [];

      const isValidEntityRef = (r) =>
        r && typeof r._id === 'string' && r._id.length > 0 &&
        typeof r.type === 'string' && typeof r.name === 'string' &&
        !/<[^>]+>/.test(r._id); // reject placeholder values like <experience_id>

      const entityRefs = Array.isArray(parsed.entity_refs)
        ? parsed.entity_refs.filter(isValidEntityRef)
        : [];

      // Extract inline entity JSON objects embedded in the message text.
      // The LLM is instructed to embed entities as compact JSON within prose,
      // e.g. "I'll create a plan for {"_id":"...","name":"Tokyo","type":"experience"}!"
      const seenIds = new Set(entityRefs.map(r => r._id));
      const inlinePattern = /\{[^{}]*"_id"[^{}]*\}/g;
      for (const match of (parsed.message.match(inlinePattern) || [])) {
        try {
          const obj = JSON.parse(match);
          if (isValidEntityRef(obj) && !seenIds.has(obj._id)) {
            entityRefs.push(obj);
            seenIds.add(obj._id);
          }
        } catch { /* ignore malformed inline objects */ }
      }

      return { message: parsed.message, pending_actions: actions, entity_refs: entityRefs };
    } catch {
      return null;
    }
  };

  // 1. Try direct parse (optionally strip markdown fences)
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const direct = tryParse(cleaned);
  if (direct) return direct;

  // 1b. Strip markdown fences from anywhere in the text (handles prose before/after fences)
  const fenceStripped = text.replace(/```(?:json)?\s*\n?/gi, '').replace(/\n?\s*```/g, '').trim();
  if (fenceStripped !== cleaned) {
    const fenceResult = tryParse(fenceStripped);
    if (fenceResult) return fenceResult;
  }

  // 2. Try extracting the first JSON object from the text (handles leading/trailing prose)
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const extracted = tryParse(text.slice(firstBrace, lastBrace + 1));
    if (extracted) return extracted;
  }

  // 2b. Try extracting from fence-stripped text as well
  if (fenceStripped !== cleaned) {
    const fsBrace = fenceStripped.indexOf('{');
    const fsLastBrace = fenceStripped.lastIndexOf('}');
    if (fsBrace !== -1 && fsLastBrace > fsBrace) {
      const fsExtracted = tryParse(fenceStripped.slice(fsBrace, fsLastBrace + 1));
      if (fsExtracted) return fsExtracted;
    }
  }

  // 3. JSON-like but unparseable — try regex extraction, else friendly error
  if (text.trimStart().startsWith('{')) {
    const msgMatch = text.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (msgMatch) {
      let message;
      try {
        message = JSON.parse(`"${msgMatch[1]}"`);
      } catch {
        message = msgMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
      }

      // Also try to salvage pending_actions from the broken JSON
      let actions = [];
      try {
        const actionsMatch = text.match(/"pending_actions"\s*:\s*\[/);
        if (actionsMatch) {
          const actionsStart = actionsMatch.index + actionsMatch[0].length - 1;
          let depth = 0;
          let actionsEnd = -1;
          for (let i = actionsStart; i < text.length; i++) {
            if (text[i] === '[') depth++;
            else if (text[i] === ']') {
              depth--;
              if (depth === 0) { actionsEnd = i + 1; break; }
            }
          }
          if (actionsEnd > actionsStart) {
            const rawActions = JSON.parse(text.slice(actionsStart, actionsEnd));
            actions = (Array.isArray(rawActions) ? rawActions : [])
              .filter(a => a && typeof a.id === 'string' && typeof a.type === 'string' &&
                ALLOWED_ACTION_TYPES.includes(a.type) && a.payload && typeof a.description === 'string');
          }
        }
      } catch { /* ignore — return message without actions */ }

      return { message, pending_actions: actions, entity_refs: [] };
    }
    logger.warn('[bienbot] parseLLMResponse: could not extract message from JSON-like response', {
      length: text.length,
      preview: text.slice(0, 120)
    });
    return { message: 'I had trouble formatting my response. Could you try rephrasing your request?', pending_actions: [], entity_refs: [] };
  }

  // 4. Plain text (no JSON structure) — return the text as the message
  // rather than showing an error, so the user at least sees the LLM response
  const trimmed = text.trim();
  if (trimmed.length > 0 && trimmed.length < 5000) {
    logger.warn('[bienbot] parseLLMResponse: returning plain text response (no JSON)', {
      length: trimmed.length,
      preview: trimmed.slice(0, 120)
    });
    return { message: trimmed, pending_actions: [], entity_refs: [] };
  }

  logger.warn('[bienbot] parseLLMResponse: no message field in response', {
    length: text.length,
    preview: text.slice(0, 120)
  });
  return { message: 'I had trouble formatting my response. Could you try rephrasing your request?', pending_actions: [], entity_refs: [] };
}

/**
 * Explode workflow actions into individual pending actions for step-by-step
 * confirmation. Non-workflow actions pass through unchanged.
 *
 * Each workflow step becomes its own pending action linked by a shared
 * workflow_id, with depends_on derived from $step_N references in payloads.
 *
 * @param {object[]} actions - Parsed pending_actions array from LLM response
 * @returns {object[]} Exploded actions array
 */
function explodeWorkflows(actions) {
  const result = [];

  for (const action of actions) {
    if (action.type !== 'workflow' || !Array.isArray(action.payload?.steps)) {
      result.push(action);
      continue;
    }

    const workflowId = `wf_${crypto.randomBytes(4).toString('hex')}`;
    const steps = [...action.payload.steps].sort((a, b) => (a.step || 0) - (b.step || 0));
    const total = steps.length;

    // Build a map: step number → action ID (for depends_on resolution)
    const stepIdMap = new Map();
    for (const step of steps) {
      const stepId = `action_${crypto.randomBytes(4).toString('hex')}`;
      stepIdMap.set(step.step, stepId);
    }

    for (const step of steps) {
      const stepId = stepIdMap.get(step.step);

      // Detect $step_N references in payload to build depends_on
      const dependsOn = [];
      const refPattern = /\$step_(\d+)\./;
      const payloadStr = JSON.stringify(step.payload || {});
      const matches = payloadStr.matchAll(/\$step_(\d+)\./g);
      for (const match of matches) {
        const refStep = parseInt(match[1], 10);
        const depId = stepIdMap.get(refStep);
        if (depId && !dependsOn.includes(depId)) {
          dependsOn.push(depId);
        }
      }

      result.push({
        id: stepId,
        type: step.type,
        payload: step.payload || {},
        description: step.description || `Step ${step.step}: ${step.type}`,
        executed: false,
        result: null,
        workflow_id: workflowId,
        workflow_step: step.step,
        workflow_total: total,
        depends_on: dependsOn.length > 0 ? dependsOn : null,
        status: 'pending',
        error_message: null
      });
    }
  }

  return result;
}

/**
 * Enforce a hard character budget on context blocks before they are joined
 * into the system prompt.
 *
 * If the combined length of all non-empty blocks exceeds CONTEXT_CHAR_BUDGET,
 * each block is proportionally truncated so that larger blocks give up more
 * characters — keeping all context sources represented rather than silently
 * dropping entire blocks.
 *
 * @param {Array<string|null|undefined>} blocks - Raw context block strings
 * @returns {string|null} Combined context string within budget, or null if empty
 */
function enforceContextBudget(blocks) {
  const validBlocks = blocks.filter(Boolean);
  if (validBlocks.length === 0) return null;

  const separator = '\n\n';
  const separatorTotal = (validBlocks.length - 1) * separator.length;
  const combined = validBlocks.join(separator);

  if (combined.length <= CONTEXT_CHAR_BUDGET) return combined;

  // Proportionally shrink each block so the largest contributors sacrifice
  // the most characters while every block retains some representation.
  const availableForBlocks = Math.max(0, CONTEXT_CHAR_BUDGET - separatorTotal);
  const totalBlockChars = validBlocks.reduce((sum, b) => sum + b.length, 0);

  logger.warn('[bienbot] Combined context exceeds budget — truncating blocks proportionally', {
    originalChars: combined.length,
    budgetChars: CONTEXT_CHAR_BUDGET,
    blockCount: validBlocks.length
  });

  const truncated = validBlocks.map(block => {
    const allocated = Math.floor((block.length / totalBlockChars) * availableForBlocks);
    if (block.length <= allocated) return block;
    const cutoff = Math.max(0, allocated - 45); // reserve space for truncation suffix
    return block.substring(0, cutoff) + '\n[... context truncated to fit token budget ...]';
  });

  return truncated.join(separator);
}

/**
 * Build a token-aware slice of the session's conversation history.
 *
 * Works backwards from the newest message, accumulating the approximate
 * character size of each formatted message until HISTORY_MAX_CHARS is
 * exhausted.  If older messages are excluded the caller receives the count
 * of excluded messages and any cached summary text so it can be prepended
 * as context for the LLM.
 *
 * @param {Array<{ role: string, content: string }>} messages - All session messages
 * @param {object} [sessionSummary] - Cached summary from session.summary
 * @returns {{ windowedMessages: Array, olderMessageCount: number, summaryText: string|null }}
 */
function buildTokenAwareHistory(messages, sessionSummary) {
  if (!messages || messages.length === 0) {
    return { windowedMessages: [], olderMessageCount: 0, summaryText: null };
  }

  // Exclude shared_comment messages — they are peer exchanges and must NOT
  // appear in the LLM context window.
  const botMessages = messages.filter(m => !m.message_type || m.message_type === 'bot_query');

  if (botMessages.length === 0) {
    return { windowedMessages: [], olderMessageCount: 0, summaryText: null };
  }

  // Walk backwards, keeping messages that fit within the token budget.
  // Use the same formatting that will be applied when building conversationMessages
  // so the size estimate is as accurate as possible.
  let totalChars = 0;
  const kept = [];

  for (let i = botMessages.length - 1; i >= 0; i--) {
    const msg = botMessages[i];
    const formatted = msg.role === 'user'
      ? `[USER MESSAGE]\n${msg.content}\n[/USER MESSAGE]`
      : msg.content;

    // Always include at least one message; then stop if budget would be exceeded.
    if (kept.length > 0 && totalChars + formatted.length > HISTORY_MAX_CHARS) {
      break;
    }

    totalChars += formatted.length;
    kept.unshift(msg);
  }

  const olderMessageCount = botMessages.length - kept.length;
  const summaryText = olderMessageCount > 0 ? (sessionSummary?.text || null) : null;

  return { windowedMessages: kept, olderMessageCount, summaryText };
}

/**
 * Send an SSE event to the client.
 */
function sendSSE(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * Split text into adaptive SSE chunks at word boundaries.
 *
 * Prefers sentence/clause boundaries (., !, ?, newline) when the accumulation
 * has reached MIN_CHUNK characters.  Forces a flush before MAX_CHUNK to avoid
 * enormous single events.  Any leftover fragment shorter than MIN_CHUNK is
 * merged into the previous chunk so the client never receives a lonely tiny
 * token event.
 *
 * @param {string} text - The full message text to split.
 * @returns {string[]} An ordered array of non-empty chunk strings.
 */
function adaptiveChunks(text) {
  const MIN_CHUNK = 20;
  const MAX_CHUNK = 200;
  const SENTENCE_BREAKS = new Set(['.', '!', '?', '\n']);

  const chunks = [];
  // Split preserving whitespace tokens so we can reassemble exactly.
  const tokens = text.split(/(\s+)/);
  let current = '';

  for (const token of tokens) {
    // Flush before adding this token if doing so would exceed MAX_CHUNK
    // (only when we already have enough content to make a valid chunk).
    if (current.length > 0 && current.length + token.length > MAX_CHUNK && current.length >= MIN_CHUNK) {
      chunks.push(current);
      current = '';
    }

    current += token;

    // Hard flush when a single token pushed us over the maximum.
    if (current.length >= MAX_CHUNK) {
      chunks.push(current);
      current = '';
      continue;
    }

    // Prefer natural breaks (sentence / line endings) once we have enough content.
    if (current.length >= MIN_CHUNK) {
      const lastNonSpace = current.trimEnd().slice(-1);
      if (SENTENCE_BREAKS.has(lastNonSpace)) {
        chunks.push(current);
        current = '';
      }
    }
  }

  // Flush the final fragment.
  if (current.length > 0) {
    if (current.trim().length > 0 && current.length < MIN_CHUNK && chunks.length > 0) {
      // Merge tiny trailing fragment into the previous chunk.
      chunks[chunks.length - 1] += current;
    } else {
      chunks.push(current);
    }
  }

  return chunks;
}

/**
 * Map a read-only action result to a structured_content block for the frontend.
 *
 * @param {string} actionType - The read-only action type
 * @param {object} result - The action result data
 * @returns {object|null} Structured content block or null
 */
function mapReadOnlyResultToStructuredContent(actionType, result) {
  switch (actionType) {
    case 'suggest_plan_items':
      if (result.suggestions && result.suggestions.length > 0) {
        return {
          type: 'suggestion_list',
          data: {
            suggestions: result.suggestions,
            destination_name: result.destination_name || null,
            source_count: result.source_count || 0
          }
        };
      }
      return null;

    case 'fetch_entity_photos':
      if (result.photos && result.photos.length > 0) {
        return {
          type: 'photo_gallery',
          data: {
            photos: result.photos,
            entity_type: result.entity_type || null,
            entity_id: result.entity_id || null,
            entity_name: result.entity_name || null,
            total_count: result.total_count || 0,
            search_query: result.search_query || null,
            selectable: true
          }
        };
      }
      return null;

    case 'fetch_destination_tips':
      if (result.tips && result.tips.length > 0) {
        return {
          type: 'tip_suggestion_list',
          data: {
            tips: result.tips,
            destination_id: result.destination_id || null,
            destination_name: result.destination_name || null,
            provider_count: result.provider_count || 0
          }
        };
      }
      return null;

    case 'discover_content':
      return {
        type: 'discovery_result_list',
        data: {
          results: result.results || [],
          query_metadata: result.query_metadata || {}
        }
      };

    case 'list_user_experiences':
      if (result.experiences && result.experiences.length > 0) {
        return {
          type: 'experience_list',
          data: {
            experiences: result.experiences,
            user_id: result.user_id || null,
            total: result.total || result.experiences.length
          }
        };
      }
      return null;

    case 'list_user_followers': {
      const items = result.followers || result.following || result.data || [];
      if (items.length > 0) {
        return {
          type: 'follower_list',
          data: {
            users: items,
            list_type: result.type || 'followers',
            user_id: result.user_id || null,
            total: result.total || items.length
          }
        };
      }
      return null;
    }

    case 'list_user_activities': {
      const history = result.history || result.data || [];
      if (history.length > 0) {
        return {
          type: 'activity_feed',
          data: {
            activities: history,
            total: result.count || history.length
          }
        };
      }
      return null;
    }

    case 'list_entity_documents': {
      const docs = result.documents || result.data || [];
      if (docs.length > 0) {
        return {
          type: 'document_list',
          data: {
            documents: docs,
            total: result.total || docs.length
          }
        };
      }
      return null;
    }

    default:
      return null;
  }
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
  // When multipart/form-data is used (file attachment), fields are strings in req.body
  let { message, sessionId, invokeContext } = req.body;

  // hiddenUserMessage — ephemeral override sent to the LLM instead of `message`.
  // Stored message (session history) always uses `message`; never stored.
  let hiddenUserMessage = req.body.hiddenUserMessage || null;
  if (hiddenUserMessage && typeof hiddenUserMessage === 'string') {
    hiddenUserMessage = stripNullBytes(hiddenUserMessage).trim().slice(0, MAX_MESSAGE_LENGTH) || null;
  } else {
    hiddenUserMessage = null;
  }

  // Parse invokeContext from string when sent as multipart form data
  if (typeof invokeContext === 'string') {
    try {
      invokeContext = JSON.parse(invokeContext);
    } catch {
      invokeContext = null;
    }
  }

  // Parse and validate navigationSchema (lean breadcrumb for BienBot context seeding)
  let navigationSchema = null;
  const rawNavSchema = req.body.navigationSchema;
  if (rawNavSchema) {
    try {
      const parsed = typeof rawNavSchema === 'string' ? JSON.parse(rawNavSchema) : rawNavSchema;
      const { valid, schema } = validateNavigationSchema(parsed);
      if (valid) navigationSchema = schema;
    } catch {
      // Ignore malformed schema — fall back to single-entity seeding
    }
  }

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
  let sessionObjId;
  if (sessionId) {
    const { valid, objectId } = validateObjectId(sessionId, 'sessionId');
    if (!valid) {
      return errorResponse(res, null, 'Invalid session ID format', 400);
    }
    sessionObjId = objectId;
  }

  // --- Attachment processing ---
  let attachmentData = null; // { filename, mimeType, fileSize, extractedText, extractionMethod, s3Key, ... }
  let pendingLocalFile = null; // Local temp file path to upload to S3 after session creation
  const uploadedFile = req.file;

  if (uploadedFile) {
    let safeTempPath;
    try {
      // Validate the uploaded file
      const validation = validateDocument({
        mimetype: uploadedFile.mimetype,
        size: uploadedFile.size
      });

      if (!validation.valid) {
        // Clean up temp file before returning error. resolveAndValidateLocalUploadPath
        // is the CodeQL-sanctioned sanitizer that breaks the taint chain from
        // uploadedFile.path. The multer dest is configured as 'uploads/temp' (inside
        // the upload root), so validation always succeeds for legitimate multer files.
        // The outer catch handles any unexpected failure gracefully.
        try {
          const safeCleanupPath = resolveAndValidateLocalUploadPath(uploadedFile.path);
          await fs.promises.unlink(safeCleanupPath);
        } catch { /* ignore — file may not exist or path check failed */ }
        return errorResponse(res, null, validation.error, 400);
      }

      // Resolve and validate the local path before any filesystem I/O.
      // Re-derive path from its own dirname+basename after validation so that
      // CodeQL's taint-tracking sees a locally-constructed path, not the
      // raw uploadedFile.path flowing into filesystem operations.
      const validatedTempPath = resolveAndValidateLocalUploadPath(uploadedFile.path);
      safeTempPath = path.resolve(path.dirname(validatedTempPath), path.basename(validatedTempPath));

      logger.info('[bienbot] Processing attachment', {
        filename: uploadedFile.originalname,
        mimeType: uploadedFile.mimetype,
        size: uploadedFile.size,
        userId
      });

      // Extract text from the file
      const extraction = await extractText(safeTempPath, uploadedFile.mimetype);

      attachmentData = {
        filename: uploadedFile.originalname,
        mimeType: uploadedFile.mimetype,
        fileSize: uploadedFile.size,
        extractedText: extraction.text || null,
        extractionMethod: extraction.metadata?.method || null
      };

      // Keep local file for S3 upload after session is created (need session ID for key)
      pendingLocalFile = safeTempPath;

      logger.info('[bienbot] Attachment text extracted', {
        method: attachmentData.extractionMethod,
        textLength: attachmentData.extractedText?.length || 0,
        userId
      });
    } catch (err) {
      logger.error('[bienbot] Attachment processing failed', { error: err.message, userId });
      // Continue without the attachment rather than failing the whole request
      attachmentData = {
        filename: uploadedFile.originalname,
        mimeType: uploadedFile.mimetype,
        fileSize: uploadedFile.size,
        extractedText: null,
        extractionMethod: 'failed'
      };
      // Clean up on extraction failure using the validated path if available
      if (safeTempPath) {
        try { await fs.promises.unlink(safeTempPath); } catch { /* ignore */ }
      }
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
    if (invokeContext.contextDescription) {
      invokeContext.contextDescription = stripNullBytes(String(invokeContext.contextDescription)).slice(0, 200);
    }

    const { valid, objectId: invokeObjId } = validateObjectId(invokeContext.id, 'invokeContext.id');
    if (!valid) {
      return errorResponse(res, null, 'Invalid invokeContext.id format', 400);
    }

    // Resolve entity label from DB (never trust client-supplied label)
    invokeLabel = await resolveEntityLabel(invokeContext.entity, invokeContext.id);
    if (!invokeLabel) {
      return errorResponse(res, null, 'Entity not found', 404);
    }

    // Permission check: canView
    loadModels();
    const enforcer = getEnforcer({ Destination, Experience, Plan, User });
    let resource;

    try {
      switch (invokeContext.entity) {
        case 'destination':
          resource = await Destination.findById(invokeObjId).lean();
          break;
        case 'experience':
          resource = await Experience.findById(invokeObjId).lean();
          break;
        case 'plan':
          resource = await Plan.findById(invokeObjId).lean();
          break;
        case 'plan_item': {
          // plan_item is a subdocument — find parent plan and use it for permission check
          const parentPlan = await findPlanContainingItem(invokeObjId);
          if (parentPlan) {
            resource = parentPlan;
            // Stash the parent plan ID for context builder and session context
            invokeContext._parentPlanId = parentPlan._id.toString();
          }
          break;
        }
        case 'user':
          resource = await User.findById(invokeObjId).lean();
          break;
        default:
          return errorResponse(res, null, 'Unknown entity type', 400);
      }
    } catch (err) {
      logger.error('[bienbot] Failed to load entity for permission check', { error: err.message });
      return errorResponse(res, null, 'Failed to verify permissions', 500);
    }

    if (!resource) {
      return errorResponse(res, null, 'Entity not found', 404);
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

    // Ensure affinity is cached for this entity before building invoke context.
    // If the background refresh has not yet run, compute now (blocking) so the
    // invoke context receives enriched affinity data on first open.
    if (invokeContext.entity === 'experience' || invokeContext.entity === 'plan') {
      const experienceId = resolveExperienceIdFromInvokeContext(resolvedInvokeContext);
      if (experienceId) {
        try {
          const existing = await affinityCache.getAffinityEntry(userId, experienceId);
          if (!existing) {
            // Cache miss — compute now (blocking) so invoke context is enriched
            await computeAndCacheAffinity(userId, experienceId);
          }
        } catch (affinityErr) {
          // Non-fatal — proceed without affinity enrichment
          logger.warn('[bienbot] Affinity cache-miss fallback failed, continuing without it', {
            userId,
            experienceId,
            error: affinityErr.message
          });
        }
      }
    }

    // Build context block for invokeContext
    const contextOptions = {};
    if (invokeContext.entity === 'plan_item' && invokeContext._parentPlanId) {
      contextOptions.planId = invokeContext._parentPlanId;
    }
    // Use navigationSchema to supply parent plan_id when not passed explicitly by the client
    if (invokeContext.entity === 'plan_item' && !contextOptions.planId && navigationSchema?.plan_item?.plan_id) {
      contextOptions.planId = navigationSchema.plan_item.plan_id;
    }
    invokeContextBlock = await buildContextForInvokeContext(
      resolvedInvokeContext,
      userId,
      contextOptions
    );
  }

  // --- Step 1: Load or create session ---
  let session;
  // Hoisted so the LLM pipeline gate below can enforce role regardless of control flow.
  // null means a new session (owner by definition); 'owner' | 'editor' | 'viewer' for existing.
  let sessionRole = null;

  try {
    if (sessionId) {
      session = await BienBotSession.findById(sessionObjId);
      if (!session) {
        return errorResponse(res, null, 'Session not found', 404);
      }
      const access = session.checkAccess(userId);
      if (!access.hasAccess) {
        return errorResponse(res, null, 'Session not found', 404);
      }
      sessionRole = access.role;
      // Viewers cannot send messages — only owner and editors can
      if (access.role === 'viewer') {
        return errorResponse(res, null, 'You have view-only access to this session', 403);
      }

      // --- Shared comment shortcut ---
      // Editors (shared collaborators) always post shared_comments — no LLM pipeline.
      // Session owners posting a reply to a shared comment are also peer exchanges.
      // comment_only flag: explicitly signals that the frontend wants a JSON response,
      // not SSE (used by postSharedComment regardless of replyTo).
      const { reply_to: replyToMsgId, comment_only: commentOnly } = req.body;
      const isSharedComment = access.role === 'editor' || commentOnly === true || (access.role === 'owner' && replyToMsgId);

      if (isSharedComment) {
        try {
          // Resolve reply preview if replying to an existing message
          let replyToPreview = null;
          if (replyToMsgId) {
            const repliedMsg = (session.messages || []).find(m => m.msg_id === replyToMsgId);
            if (repliedMsg) {
              replyToPreview = repliedMsg.content.length > 200
                ? repliedMsg.content.substring(0, 197) + '...'
                : repliedMsg.content;
            }
          }

          const senderName = req.user.name || req.user.email || 'User';
          await session.addMessage('user', message, {
            message_type: 'shared_comment',
            sender_name: senderName,
            sentBy: req.user._id,
            reply_to: replyToMsgId || null,
            reply_to_preview: replyToPreview
          });
          await session.generateTitle();

          const savedMsg = session.messages[session.messages.length - 1];
          logger.info('[bienbot] Shared comment posted', {
            sessionId: session._id.toString(),
            userId,
            role: access.role
          });

          return successResponse(res, {
            session: { _id: session._id, title: session.title },
            message: savedMsg
          }, 'Comment posted');
        } catch (commentErr) {
          logger.error('[bienbot] Failed to save shared comment', { error: commentErr.message });
          return errorResponse(res, commentErr, 'Failed to post comment', 500);
        }
      }
    } else {
      session = await BienBotSession.createSession(userId, resolvedInvokeContext || {});

      // Persist the analysis greeting (if any) as the opening assistant turn so
      // the LLM has context for follow-up questions. Only accepted on new sessions
      // (no sessionId) to prevent injecting arbitrary history into existing sessions.
      const rawPriorGreeting = req.body.priorGreeting;
      if (rawPriorGreeting && typeof rawPriorGreeting === 'string') {
        const sanitizedGreeting = stripNullBytes(rawPriorGreeting).trim().slice(0, 4000);
        // Only accept analysis greetings that originate from the server's own /analyze
        // endpoint. The [ANALYSIS] sentinel is prepended client-side from formatAnalysisSuggestions;
        // greetings without it are silently dropped to prevent prompt injection.
        const isServerAnalysisGreeting = sanitizedGreeting.startsWith('[ANALYSIS]');
        if (sanitizedGreeting && isServerAnalysisGreeting) {
          try {
            await session.addMessage('assistant', sanitizedGreeting, { message_type: 'greeting' });
          } catch (greetingErr) {
            // Non-fatal — proceed without the prior greeting
            logger.warn('[bienbot] Failed to persist prior greeting', { error: greetingErr.message });
          }
        }
      }

      // Pre-populate context with the full ancestor chain.
      // navigationSchema carries all ancestor IDs transitively (e.g. opening BienBot
      // from a Plan also provides experience_id and destination_id immediately), so we
      // can fire all context builders in parallel from the very first message.
      // Fall back to single-entity seeding when no schema is present.
      let contextUpdate = {};
      if (navigationSchema) {
        contextUpdate = extractContextIds(navigationSchema);
      } else if (resolvedInvokeContext) {
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
      }
      if (Object.keys(contextUpdate).length > 0) {
        await session.updateContext(contextUpdate);
      }
    }
  } catch (err) {
    logger.error('[bienbot] Session load/create failed', { error: err.message });
    return errorResponse(res, null, 'Failed to load session', 500);
  }

  // --- LLM pipeline gate ---
  // Hard enforcement: only session owners may reach the LLM pipeline.
  // Editors are always diverted to the shared-comment path above and must never
  // reach this point. If they do (e.g. due to a future code path change or
  // payload manipulation that bypasses the isSharedComment check), reject here.
  // sessionRole is null only for brand-new sessions, where the creator is owner.
  if (sessionRole !== null && sessionRole !== 'owner') {
    logger.error('[bienbot] LLM pipeline access denied — non-owner reached pipeline', {
      userId,
      sessionId: session?._id?.toString(),
      role: sessionRole
    });
    return errorResponse(res, null, 'Only the session owner can use the AI assistant', 403);
  }

  // --- Step 2: Classify intent ---
  // Use hiddenUserMessage when present so the classifier sees the true intent
  // ("confirm plan, suggest next steps") rather than the stored visible text.
  const classifyText = hiddenUserMessage || message;
  const classification = await classifyIntent(classifyText, {
    userId,
    sessionId: session._id.toString(),
    user: req.user
  });

  logger.info('[bienbot] Intent classified', {
    userId,
    sessionId: session._id.toString(),
    intent: classification.intent,
    confidence: classification.confidence,
    source: classification.source,
    isMultiAction: classification.isMultiAction || false,
    multiActionVerbs: classification.multiActionVerbs || null
  });

  // --- Step 2b: Resolve entity names ---
  let entityResolutionBlock = null;
  let resolvedEntityObjects = [];
  try {
    // Extract only the fields the resolver knows about
    const extractedNames = {};
    if (classification.entities) {
      for (const [key, value] of Object.entries(classification.entities)) {
        if (FIELD_TYPE_MAP[key] && value) {
          extractedNames[key] = value;
        }
      }
    }

    // Enrich with multi-action entity names when detected
    if (classification.isMultiAction && classification.multiActionEntities) {
      const mae = classification.multiActionEntities;
      if (mae.destination_names?.length && !extractedNames.destination_name) {
        extractedNames.destination_name = mae.destination_names[0];
      }
      if (mae.experience_names?.length && !extractedNames.experience_name) {
        extractedNames.experience_name = mae.experience_names[0];
      }
      if (mae.user_refs?.length && !extractedNames.user_email && !extractedNames.assignee_name) {
        // Check if it looks like an email
        const emailRef = mae.user_refs.find(r => r.includes('@'));
        if (emailRef) {
          extractedNames.user_email = emailRef;
        } else {
          extractedNames.assignee_name = mae.user_refs[0];
        }
      }
    }

    if (Object.keys(extractedNames).length > 0) {
      const resolutionResult = await resolveEntities(extractedNames, req.user, {
        destinationId: session.context?.destination_id?.toString() || null,
      });

      entityResolutionBlock = formatResolutionBlock(resolutionResult, extractedNames);
      resolvedEntityObjects = formatResolutionObjects(resolutionResult);

      logger.info('[bienbot] Entity resolution complete', {
        userId,
        sessionId: session._id.toString(),
        resolved: Object.keys(resolutionResult.resolved),
        ambiguous: Object.keys(resolutionResult.ambiguous),
        unresolved: resolutionResult.unresolved,
      });

      // For each unresolved entity name, run a DB search and attach to the entity
      // resolution block so the LLM gets search results even when the resolver
      // couldn't find a high-confidence match.
      if (resolutionResult.unresolved.length > 0) {
        const unresolvedSearchBlocks = await Promise.all(
          resolutionResult.unresolved.map(field =>
            extractedNames[field]
              ? buildSearchContext(extractedNames[field], userId).catch(() => null)
              : Promise.resolve(null)
          )
        );
        const unresolvedBlocks = unresolvedSearchBlocks.filter(Boolean);
        if (unresolvedBlocks.length > 0) {
          entityResolutionBlock = [entityResolutionBlock, ...unresolvedBlocks].filter(Boolean).join('\n\n');
        }
      }

      // Short-circuit with disambiguation actions for ambiguous entity matches.
      // Only handles destination and plan since experience/user ambiguity is left to the LLM.
      const disambiguationActions = [];
      if (Object.keys(resolutionResult.ambiguous).length > 0) {
        for (const [field, candidates] of Object.entries(resolutionResult.ambiguous)) {
          const entityType = FIELD_TYPE_MAP[field];
          let actionType = null;
          if (entityType === 'destination') {
            actionType = 'select_destination';
          } else if (entityType === 'plan') {
            actionType = 'select_plan';
          }
          if (actionType && candidates?.length > 1) {
            disambiguationActions.push({
              id: `action_${crypto.randomBytes(4).toString('hex')}`,
              type: actionType,
              payload: { candidates },
              description: `Which ${entityType} did you mean? (${candidates.map(c => c.name).join(', ')})`,
              executed: false
            });
          }
        }
      }
      if (disambiguationActions.length > 0) {
        logger.info('[bienbot] Short-circuiting with disambiguation actions', {
          userId,
          sessionId: session._id.toString(),
          count: disambiguationActions.length,
          types: disambiguationActions.map(a => a.type)
        });
        await session.addMessage('user', message, { intent: classification.intent, sentBy: req.user._id });
        await session.addMessage('assistant', 'I found multiple possible matches. Please select which one you meant.', {
          actions_taken: disambiguationActions.map(a => a.type)
        });
        sendSSE(res, 'actions', { actions: disambiguationActions });
        sendSSE(res, 'done', { intent: 'disambiguate', message: '' });
        res.end();
        return;
      }
    }
  } catch (err) {
    logger.warn('[bienbot] Entity resolution failed, continuing without it', { error: err.message });
  }

  // --- Step 2d: Navigation resolution (runs BEFORE plan disambiguation) ---
  // Detect navigation intent via pattern matching (NLP classifier may not catch all forms).
  // Short-circuit with a navigate_to_entity action instead of relying on the LLM to build URLs.
  const NAV_PATTERN = /^(?:navigate\s+to|take\s+me\s+to|go\s+to|show\s+me|open|bring\s+me\s+to|direct\s+me\s+to|i\s+want\s+to\s+(?:see|view|visit|go\s+to))\b/i;
  const isNavIntent = classification.intent === 'NAVIGATE_TO_ENTITY' || NAV_PATTERN.test(message.trim());
  logger.debug('[bienbot] Nav resolution check', { intent: classification.intent, isNavIntent, messageStart: message.trim().substring(0, 50) });
  if (isNavIntent) {
    try {
      loadModels();

      // Build a search hint from entities or the raw message (strip navigation verbs)
      const rawHint = classification.entities?.experience_name
        || classification.entities?.destination_name
        || message.trim().replace(NAV_PATTERN, '').trim().replace(/^the\s+/i, '').trim();
      const navHint = rawHint.toLowerCase();
      logger.debug('[bienbot] Nav search hint', { rawHint, navHint });

      // Search user plans, experiences, and destinations in parallel.
      // Experiences include public ones AND those the user has access to (owns or is a collaborator on).
      const navUserObjectId = new mongoose.Types.ObjectId(userId);
      const [navUserPlans, navExperiences, navDestinations] = await Promise.all([
        Plan.find({ user: userId })
          .populate({ path: 'experience', select: 'name destination', populate: { path: 'destination', select: 'name' } })
          .select('experience planned_date')
          .lean(),
        Experience.find({
          $or: [{ visibility: 'public' }, { 'permissions._id': navUserObjectId }]
        }).select('name destination').populate('destination', 'name').limit(100).lean(),
        Destination.find({ visibility: 'public' }).select('name').limit(50).lean()
      ]);

      // Score matches using substring containment and word overlap (both directions)
      const navHintWords = navHint.split(/\s+/).filter(w => w.length > 2);
      const scoreNavMatch = (name) => {
        if (!name) return 0;
        const lower = name.toLowerCase();
        if (lower === navHint || navHint === lower) return 100;
        if (lower.includes(navHint) || navHint.includes(lower)) return 80;
        if (navHintWords.length >= 2) {
          // Query-side: most hint words appear in entity name
          const matchCount = navHintWords.filter(w => lower.includes(w)).length;
          const ratio = matchCount / navHintWords.length;
          if (ratio >= 0.5) return Math.round(ratio * 60);
          // Entity-side: most entity name words appear in hint (handles long hints)
          const nameWords = lower.split(/\s+/).filter(w => w.length > 2);
          if (nameWords.length >= 2) {
            const entityMatchCount = nameWords.filter(w => navHint.includes(w)).length;
            if (entityMatchCount >= Math.ceil(nameWords.length * 0.5)) return Math.round((entityMatchCount / nameWords.length) * 55);
          }
        }
        return 0;
      };

      const navCandidates = [];

      // Score user plans
      for (const p of navUserPlans) {
        const expName = p.experience?.name || '';
        const destName = p.experience?.destination?.name || '';
        const score = Math.max(scoreNavMatch(expName), scoreNavMatch(destName), scoreNavMatch(`${expName} ${destName}`));
        if (score > 0) {
          const expId = p.experience?._id?.toString();
          navCandidates.push({
            score,
            type: 'plan',
            url: expId ? `/experiences/${expId}#plan-${p._id}` : null,
            label: `${expName}${destName ? ` in ${destName}` : ''}`
          });
        }
      }

      // Score experiences
      for (const e of navExperiences) {
        const score = scoreNavMatch(e.name);
        if (score > 0) {
          navCandidates.push({
            score,
            type: 'experience',
            url: `/experiences/${e._id}`,
            label: `${e.name}${e.destination?.name ? ` in ${e.destination.name}` : ''}`
          });
        }
      }

      // Score destinations
      for (const d of navDestinations) {
        const score = scoreNavMatch(d.name);
        if (score > 0) {
          navCandidates.push({
            score,
            type: 'destination',
            url: `/destinations/${d._id}`,
            label: d.name
          });
        }
      }

      // Sort by score descending and pick the best match
      navCandidates.sort((a, b) => b.score - a.score);
      logger.debug('[bienbot] Nav candidates', { count: navCandidates.length, top3: navCandidates.slice(0, 3).map(c => ({ label: c.label, score: c.score, type: c.type })) });
      const best = navCandidates.find(c => c.url);

      if (best) {
        const navAction = {
          id: `action_${crypto.randomBytes(4).toString('hex')}`,
          type: 'navigate_to_entity',
          payload: { url: best.url, entity: best.type, label: best.label },
          description: `Navigate to ${best.label}`
        };

        const navMsg = `Taking you to ${best.label}.`;

        // Store in session
        await session.addMessage('user', message, { intent: classification.intent, sentBy: req.user._id });
        await session.addMessage('assistant', navMsg, { actions_taken: ['navigate_to_entity'] });
        await session.setPendingActions([navAction]);
        await session.generateTitle();

        // SSE-stream the response
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no'
        });

        sendSSE(res, 'session', { sessionId: session._id.toString(), title: session.title });
        sendSSE(res, 'token', { text: navMsg });
        sendSSE(res, 'actions', { pending_actions: [navAction] });
        sendSSE(res, 'done', { intent: classification.intent, confidence: classification.confidence, source: 'nav_resolution' });
        res.end();

        logger.info('[bienbot] Navigation resolved directly', {
          userId,
          target: best.label,
          type: best.type,
          score: best.score
        });
        return;
      }
      // No match found → fall through to plan disambiguation / normal LLM flow
    } catch (err) {
      logger.warn('[bienbot] Navigation resolution failed, continuing with LLM', { error: err.message });
    }
  }

  // --- Step 2e: Destination gate + Plan/Discover short-circuit for PLAN_EXPERIENCE ---
  // When the user wants to plan a trip to a destination, show:
  //   1. Their existing plans for that destination (select_plan cards)
  //   2. Available experiences to create a new plan from (discovery_result_list)
  // This bypasses the LLM for a faster, deterministic, richer response.
  //
  // Branch A: destination already in session context → run plan+discover immediately.
  // Branch B: no destination in context → resolve from message:
  //   HIGH confidence  → auto-inject destination_id + run plan+discover
  //   MEDIUM confidence → stream select_destination disambiguation cards
  //   LOW confidence    → fall through to LLM

  // runPlanDiscover is defined as a module-level function — see below exports.chat.


  if (classification.intent === 'PLAN_EXPERIENCE' && !session.context?.plan_id) {
    try {
      loadModels();
      // 1. Check for selected experience (from session context, invokeContext, or resolved entities)
      let selectedExperienceId = null;
      let selectedExperienceName = null;
      // Priority: session.context.experience_id, invokeContext, resolvedEntityObjects
      if (session.context?.experience_id) {
        selectedExperienceId = session.context.experience_id.toString();
      } else if (resolvedInvokeContext && resolvedInvokeContext.entity === 'experience') {
        selectedExperienceId = resolvedInvokeContext.entity_id;
      } else if (resolvedEntityObjects && resolvedEntityObjects.length > 0) {
        const expRef = resolvedEntityObjects.find(e => e.type === 'experience');
        if (expRef) selectedExperienceId = expRef._id;
      }

      if (selectedExperienceId && mongoose.Types.ObjectId.isValid(selectedExperienceId)) {
        const selectedExpOid = new mongoose.Types.ObjectId(selectedExperienceId);
        // Fetch the experience name
        const expDoc = await Experience.findById(selectedExpOid).select('name destination').populate('destination', 'name').lean();
        // Sanitize DB-fetched name strings at assignment to break the
        // user-input taint chain that flows through the ObjectId query result.
        selectedExperienceName = String(expDoc?.name || '').replace(/[\u0000-\u001F\u007F]/g, '').trim() || '(unnamed experience)';
        const destinationName = String(expDoc?.destination?.name || '').replace(/[\u0000-\u001F\u007F]/g, '').trim();

        // Check if user already has a plan for this experience
        const existingPlan = await Plan.findOne({ user: userId, experience: selectedExpOid }).lean();

        await session.addMessage('user', message, { intent: classification.intent, sentBy: req.user._id });

        if (existingPlan) {
          // User already has a plan for this experience
          // Ask if they want to create a new plan or work on the existing one
          const actions = [
            {
              id: `action_${crypto.randomBytes(4).toString('hex')}`,
              type: 'select_plan',
              payload: {
                plan_id: existingPlan._id.toString(),
                experience_name: selectedExperienceName,
                destination_name: destinationName,
                planned_date: existingPlan.planned_date || null,
                item_count: (existingPlan.plan || []).length
              },
              description: `Work on your existing plan for ${selectedExperienceName}${destinationName ? ` in ${destinationName}` : ''}`
            },
            {
              id: `action_${crypto.randomBytes(4).toString('hex')}`,
              type: 'create_plan',
              payload: {
                experience_id: selectedExperienceId
              },
              description: `Create a new plan for ${selectedExperienceName}${destinationName ? ` in ${destinationName}` : ''}`
            }
          ];
          const msg = `You already have a plan for ${selectedExperienceName}${destinationName ? ` in ${destinationName}` : ''}. Would you like to work on your existing plan or create a new one?`;
          await session.addMessage('assistant', msg, { actions_taken: ['select_plan', 'create_plan'] });
          await session.setPendingActions(actions);
          await session.generateTitle();

          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
          });
          sendSSE(res, 'session', { sessionId: session._id.toString(), title: session.title });
          for (const chunk of adaptiveChunks(msg)) {
            sendSSE(res, 'token', { text: chunk });
          }
          sendSSE(res, 'actions', { pending_actions: actions });
          sendSSE(res, 'done', { intent: classification.intent, confidence: classification.confidence, source: 'plan_experience_existing_plan' });
          res.end();
          logger.info('[bienbot] PLAN_EXPERIENCE: user has existing plan for experience', { userId, experience: selectedExperienceId });
          return;
        } else {
          // No plan exists for this experience, propose create_plan
          const action = {
            id: `action_${crypto.randomBytes(4).toString('hex')}`,
            type: 'create_plan',
            payload: {
              experience_id: selectedExperienceId
            },
            description: `Create a new plan for ${selectedExperienceName}${destinationName ? ` in ${destinationName}` : ''}`
          };
          const msg = `Let's create a new plan for ${selectedExperienceName}${destinationName ? ` in ${destinationName}` : ''}. Ready to get started?`;
          await session.addMessage('assistant', msg, { actions_taken: ['create_plan'] });
          await session.setPendingActions([action]);
          await session.generateTitle();

          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
          });
          sendSSE(res, 'session', { sessionId: session._id.toString(), title: session.title });
          for (const chunk of adaptiveChunks(msg)) {
            sendSSE(res, 'token', { text: chunk });
          }
          sendSSE(res, 'actions', { pending_actions: [action] });
          sendSSE(res, 'done', { intent: classification.intent, confidence: classification.confidence, source: 'plan_experience_create_plan' });
          res.end();
          logger.info('[bienbot] PLAN_EXPERIENCE: proposed create_plan for experience', { userId, experience: selectedExperienceId });
          return;
        }
      }
      // If no experience is selected, fall back to original plan/discover logic
      // ── A: Destination already in context → resolve name and run plan+discover ──
      const { resolveEntity, ResolutionConfidence } = require('../../utilities/bienbot-entity-resolver');
      if (session.context?.destination_id) {
        const ctxDest = await Destination.findById(session.context.destination_id).select('name').lean();
        const destNameFromCtx = ctxDest?.name || classification.entities?.destination_name || '';
        if (destNameFromCtx) {
          const streamed = await runPlanDiscover(destNameFromCtx, { userId, session, message, classification, req, res });
          if (streamed) return;
        }
      } else {
        // ── B: No destination in context → resolve from message ──────────────────
        const destQuery = classification.entities?.destination_name
          || classification.entities?.experience_name
          || message;
        if (destQuery && destQuery.trim().length >= 2) {
          const { candidates, confidence } = await resolveEntity(
            destQuery.trim(), 'destination', req.user
          );
          if (confidence === ResolutionConfidence.HIGH && candidates.length > 0) {
            const top = candidates[0];
            await session.updateContext({ destination_id: top.id });
            const streamed = await runPlanDiscover(top.name || destQuery.trim(), { userId, session, message, classification, req, res });
            if (streamed) return;
          } else if (confidence === ResolutionConfidence.MEDIUM && candidates.length > 0) {
            const destActions = candidates.slice(0, 5).map(c => ({
              id: `action_${crypto.randomBytes(4).toString('hex')}`,
              type: 'select_destination',
              payload: {
                destination_id: c.id,
                destination_name: c.name,
                experience_name: c.name,
                country: c.meta?.country || null,
                city: c.meta?.city || null
              },
              description: c.name
            }));
            const disambigMsg = candidates.length > 1
              ? `I found a few destinations matching "${destQuery.trim()}". Which one did you mean?`
              : `I found a destination matching "${destQuery.trim()}". Is this the one?`;
            await session.addMessage('assistant', disambigMsg, { actions_taken: ['select_destination'] });
            await session.setPendingActions(destActions);
            await session.generateTitle();
            res.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
              'X-Accel-Buffering': 'no'
            });
            sendSSE(res, 'session', { sessionId: session._id.toString(), title: session.title });
            for (const chunk of adaptiveChunks(disambigMsg)) {
              sendSSE(res, 'token', { text: chunk });
            }
            sendSSE(res, 'actions', { pending_actions: destActions });
            sendSSE(res, 'done', { intent: classification.intent, confidence: classification.confidence, source: 'destination_gate' });
            res.end();
            logger.info('[bienbot] Destination gate — streamed select_destination cards', { userId, destQuery: destQuery.trim(), count: destActions.length });
            return;
          }
        }
      }
    } catch (err) {
      logger.warn('[bienbot] PLAN_EXPERIENCE handler failed, continuing with LLM', { error: err.message });
    }
  }

  // --- Step 2c: Plan disambiguation ---
  // If a plan-related intent is detected but no plan_id in session context,
  // find matching plans. 1 match → auto-inject; 2+ → stream disambiguation.
  const PLAN_RELATED_INTENTS = new Set([
    'QUERY_PLAN', 'ADD_PLAN_ITEMS', 'UPDATE_PLAN_ITEM', 'COMPLETE_PLAN_ITEM',
    'UNCOMPLETE_PLAN_ITEM', 'SCHEDULE_PLAN_ITEM', 'ADD_PLAN_ITEM_NOTE',
    'SET_PLAN_ITEM_LOCATION', 'UPDATE_PLAN_ITEM_COST', 'ADD_PLAN_ITEM_DETAIL',
    'ASSIGN_PLAN_ITEM', 'UPDATE_PLAN_ITEM_TEXT', 'UPDATE_PLAN_ITEM_URL',
    'UPDATE_PLAN', 'DELETE_PLAN', 'DELETE_PLAN_ITEM', 'ADD_PLAN_COST',
    'SYNC_PLAN', 'PLAN_EXPERIENCE'
  ]);

  const ctx = session.context || {};
  if (PLAN_RELATED_INTENTS.has(classification.intent) && !ctx.plan_id) {
    // When the user is on a specific entity page (resolvedInvokeContext or session.invoke_context),
    // they are clearly referring to THAT entity. Skip disambiguation entirely —
    // the LLM/executor will resolve the correct plan from the invoke context.
    // This prevents "Unplan this experience" on Nashville from showing a picker
    // of all 42 user plans across all destinations.
    //
    // resolvedInvokeContext comes from the current request's invokeContext param;
    // session.invoke_context is the stored context from when BienBot was opened.
    // For resumed sessions that don't re-send invokeContext, we fall back to session.invoke_context.
    const effectiveInvokeContext = resolvedInvokeContext || (
      session.invoke_context?.entity && session.invoke_context?.entity_id
        ? { entity: session.invoke_context.entity, entity_id: session.invoke_context.entity_id.toString() }
        : null
    );
    const hasEntityPageContext =
      (effectiveInvokeContext?.entity === 'experience' && effectiveInvokeContext?.entity_id) ||
      (effectiveInvokeContext?.entity === 'plan' && effectiveInvokeContext?.entity_id);

    logger.info('[bienbot] Step 2c plan disambiguation gate', {
      hasEntityPageContext,
      resolvedInvokeContext: resolvedInvokeContext ? { entity: resolvedInvokeContext.entity, entity_id: resolvedInvokeContext.entity_id } : null,
      sessionInvokeContext: session.invoke_context ? { entity: session.invoke_context.entity, entity_id: session.invoke_context.entity_id?.toString() } : null,
      effectiveInvokeContext: effectiveInvokeContext ? { entity: effectiveInvokeContext.entity, entity_id: effectiveInvokeContext.entity_id } : null,
      intent: classification.intent,
      ctxPlanId: ctx.plan_id || null,
      userId
    });

    if (hasEntityPageContext) {
      // Only auto-inject if we can find the exact plan — if not found (user may not
      // have planned this experience), skip silently and let the LLM handle it.
      try {
        loadModels();
        const userPlans = await Plan.find({ user: userId })
          .populate('experience', 'name destination')
          .populate({ path: 'experience', populate: { path: 'destination', select: 'name' } })
          .select('experience planned_date plan')
          .lean();

        let pinned = [];
        if (effectiveInvokeContext.entity === 'experience') {
          pinned = userPlans.filter(p =>
            String(p.experience?._id) === String(effectiveInvokeContext.entity_id)
          );
        } else if (effectiveInvokeContext.entity === 'plan') {
          pinned = userPlans.filter(p =>
            String(p._id) === String(effectiveInvokeContext.entity_id)
          );
        }

        if (pinned.length === 1) {
          const plan = pinned[0];
          await session.updateContext({
            plan_id: plan._id.toString(),
            experience_id: plan.experience?._id?.toString() || null,
            destination_id: plan.experience?.destination?._id?.toString()
              || plan.experience?.destination?.toString() || null
          });
          logger.info('[bienbot] Auto-injected plan from entity page context', {
            planId: plan._id.toString(),
            userId,
            invokeEntity: effectiveInvokeContext.entity,
            invokeEntityId: effectiveInvokeContext.entity_id,
            source: resolvedInvokeContext ? 'request' : 'session'
          });
        }
        // If 0 or 2+ found: skip silently — LLM will handle with invoke context info
      } catch (err) {
        logger.warn('[bienbot] Plan auto-inject from entity page failed, continuing', { error: err.message });
      }
    } else {
    try {
      loadModels();
      const userPlans = await Plan.find({ user: userId })
        .populate('experience', 'name destination')
        .populate({ path: 'experience', populate: { path: 'destination', select: 'name' } })
        .select('experience planned_date plan')
        .lean();

      if (userPlans.length > 0) {
        let matchedPlans = userPlans;

        // Fuzzy-filter by destination/experience name if user mentioned one
        const nameHint = classification.entities?.destination_name
          || classification.entities?.experience_name
          || null;
        if (nameHint) {
          const hint = nameHint.toLowerCase();
          const filtered = userPlans.filter(p => {
            const expName = (p.experience?.name || '').toLowerCase();
            const destName = (p.experience?.destination?.name || '').toLowerCase();
            return expName.includes(hint) || destName.includes(hint)
              || hint.includes(expName) || hint.includes(destName);
          });
          if (filtered.length > 0) matchedPlans = filtered;
        }

        if (matchedPlans.length === 1) {
          // Auto-inject the single matching plan into session context
          const plan = matchedPlans[0];
          await session.updateContext({
            plan_id: plan._id.toString(),
            experience_id: plan.experience?._id?.toString() || null,
            destination_id: plan.experience?.destination?._id?.toString()
              || plan.experience?.destination?.toString() || null
          });
          logger.info('[bienbot] Auto-injected single matching plan', {
            planId: plan._id.toString(),
            userId
          });
        } else if (matchedPlans.length >= 2) {
          // Stream disambiguation: return select_plan actions without LLM call
          const disambActions = matchedPlans.slice(0, 8).map(p => ({
            id: `action_${crypto.randomBytes(4).toString('hex')}`,
            type: 'select_plan',
            payload: {
              plan_id: p._id.toString(),
              experience_name: p.experience?.name || '(unnamed)',
              destination_name: p.experience?.destination?.name || '',
              planned_date: p.planned_date || null,
              item_count: (p.plan || []).length
            },
            description: `${p.experience?.name || 'Plan'}${p.experience?.destination?.name ? ` in ${p.experience.destination.name}` : ''}${p.planned_date ? ` (${new Date(p.planned_date).toISOString().split('T')[0]})` : ''}`
          }));

          // Build clarifying message with date-aware grouping
          const destDateGroups = {};
          for (const p of matchedPlans) {
            const dest = p.experience?.destination?.name || 'unknown destination';
            if (!destDateGroups[dest]) destDateGroups[dest] = {};
            const monthKey = p.planned_date
              ? new Date(p.planned_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
              : 'unscheduled';
            destDateGroups[dest][monthKey] = (destDateGroups[dest][monthKey] || 0) + 1;
          }
          const groupDesc = Object.entries(destDateGroups)
            .map(([dest, months]) => {
              const totalForDest = Object.values(months).reduce((s, c) => s + c, 0);
              const monthEntries = Object.entries(months);
              // If only one time group or too many (>4), keep it concise
              if (monthEntries.length <= 1) {
                const [monthLabel] = monthEntries[0];
                const suffix = monthLabel === 'unscheduled' ? ' (unscheduled)' : ` in ${monthLabel}`;
                return `${totalForDest} plan${totalForDest !== 1 ? 's' : ''} to ${dest}${suffix}`;
              }
              // Multiple time groups — show breakdown
              const monthParts = monthEntries.map(([month, count]) => {
                if (month === 'unscheduled') return `${count} unscheduled`;
                return `${count} in ${month}`;
              });
              // For >4 date groups, summarize to avoid overly long messages
              if (monthParts.length > 4) {
                return `${totalForDest} plan${totalForDest !== 1 ? 's' : ''} to ${dest} across ${monthParts.length} different months`;
              }
              return `${totalForDest} plan${totalForDest !== 1 ? 's' : ''} to ${dest} (${monthParts.join(', ')})`;
            })
            .join('; ');
          const clarifyMsg = `I found ${matchedPlans.length} plans — ${groupDesc}. Which plan would you like to work on?`;

          // Store in session
          await session.addMessage('user', message, { intent: classification.intent, sentBy: req.user._id });
          await session.addMessage('assistant', clarifyMsg);
          await session.setPendingActions(disambActions);
          await session.generateTitle();

          // SSE-stream the disambiguation response
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
          });
          sendSSE(res, 'session', { sessionId: session._id.toString(), title: session.title });
          const chunks = adaptiveChunks(clarifyMsg);
          for (const chunk of chunks) {
            sendSSE(res, 'token', { text: chunk });
          }
          sendSSE(res, 'actions', { pending_actions: disambActions });
          sendSSE(res, 'done', {
            intent: classification.intent,
            confidence: classification.confidence,
            source: 'disambiguation'
          });
          res.end();
          return;
        }
      }
      // 0 matches → continue normal LLM flow
    } catch (err) {
      logger.warn('[bienbot] Plan disambiguation failed, continuing normally', { error: err.message });
    }
    } // end else (no entity page context)
  }



  // --- Step 3: Build context blocks ---
  const intentContextBlock = await buildContextBlocks(
    classification.intent,
    classification.entities,
    session,
    userId,
    classifyText,
    navigationSchema,
    resolvedInvokeContext
  );

  // Merge invokeContext block with intent-based blocks, enforcing hard token cap
  // Include attachment extracted text as a context block if available
  let attachmentContextBlock = null;
  if (attachmentData?.extractedText) {
    // Cap extracted text to prevent blowing the context budget
    const maxAttachmentChars = 4000;
    const trimmedText = attachmentData.extractedText.length > maxAttachmentChars
      ? attachmentData.extractedText.substring(0, maxAttachmentChars) + '\n[... text truncated ...]'
      : attachmentData.extractedText;
    attachmentContextBlock = `--- Attached Document: ${attachmentData.filename} ---\n${trimmedText}`;
  } else if (attachmentData && !attachmentData.extractedText) {
    attachmentContextBlock = `--- Attached Document: ${attachmentData.filename} ---\n[Text extraction failed or yielded no content. The file was a ${attachmentData.mimeType} file.]`;
  }
  const combinedContext = enforceContextBudget([invokeContextBlock, intentContextBlock, attachmentContextBlock]);

  // --- Step 3b: Load user memory for cross-session context injection ---
  let userMemoryBlock = null;
  try {
    loadModels();
    const userDoc = await User.findById(userId).select('bienbot_memory.entries').lean();
    const memoryEntries = userDoc?.bienbot_memory?.entries;
    if (memoryEntries && memoryEntries.length > 0) {
      userMemoryBlock = formatMemoryBlock(memoryEntries);
    }
  } catch (err) {
    logger.warn('[bienbot] Failed to load user memory, continuing without it', { error: err.message });
  }

  // --- Step 4: Build system prompt and call LLM ---

  // Extract entity refs from the most recent assistant message so the LLM
  // can treat a short follow-up ("plan it", "yes", "go ahead") as referring
  // to the entity that was just shown in a card.
  // Refs are verified against the DB so a fabricated ID stored in a prior turn
  // cannot re-enter the LAST SHOWN ENTITY prompt block and drive a bad action.
  const lastAssistantMsg = (session.messages || [])
    .filter(m => m.role === 'assistant')
    .slice(-1)[0];
  const rawLastShownRefs = lastAssistantMsg
    ? ((lastAssistantMsg.structured_content || [])
        .find(b => b.type === 'entity_ref_list')
        ?.data?.refs || [])
      .filter(r => r._id && !/<[^>]+>/.test(r._id) && mongoose.Types.ObjectId.isValid(r._id))
    : [];
  let lastShownEntities = [];
  if (rawLastShownRefs.length > 0) {
    loadModels();
    const verifiedLastShown = [];
    await Promise.all(rawLastShownRefs.map(async (ref) => {
      try {
        if (ref.type === 'plan') {
          const plan = await Plan.findById(ref._id).select('_id experience').lean();
          if (plan) verifiedLastShown.push({ ...ref, experience_id: plan.experience?.toString() || ref.experience_id });
          else logger.warn('[bienbot] lastShownEntity plan not found, dropping from LAST SHOWN ENTITY', { id: ref._id });
        } else if (ref.type === 'experience') {
          const exists = await Experience.findById(ref._id).select('_id').lean();
          if (exists) verifiedLastShown.push(ref);
          else logger.warn('[bienbot] lastShownEntity experience not found, dropping from LAST SHOWN ENTITY', { id: ref._id });
        } else if (ref.type === 'destination') {
          const exists = await Destination.findById(ref._id).select('_id').lean();
          if (exists) verifiedLastShown.push(ref);
          else logger.warn('[bienbot] lastShownEntity destination not found, dropping from LAST SHOWN ENTITY', { id: ref._id });
        } else {
          verifiedLastShown.push(ref); // plan_item: pass through
        }
      } catch (e) {
        logger.warn('[bienbot] lastShownEntity verification error, dropping', { id: ref._id, error: e.message });
      }
    }));
    lastShownEntities = verifiedLastShown;
  }

  const systemPrompt = buildSystemPrompt({
    invokeLabel,
    invokeEntityType: invokeContext?.entity || null,
    contextDescription: invokeContext?.contextDescription || null,
    contextBlock: combinedContext,
    session,
    userMemoryBlock,
    entityResolutionBlock,
    resolvedEntityObjects,
    userCurrency: req.user?.preferences?.currency || null,
    userName: req.user?.name ? req.user.name.split(' ')[0] : null,
    userLanguage: req.user?.preferences?.language || null,
    userTimezone: req.user?.preferences?.timezone || null,
    userHiddenSignals: req.user?.hidden_signals || null,
    lastShownEntities
  });

  // Build conversation history for multi-turn
  const conversationMessages = [
    { role: 'system', content: systemPrompt }
  ];

  // Build token-aware conversation history (trims oldest messages when over budget)
  const { windowedMessages, olderMessageCount, summaryText } = buildTokenAwareHistory(
    session.messages || [],
    session.summary
  );

  // If older messages were excluded, inject a context note so the LLM is aware
  if (olderMessageCount > 0) {
    const summaryContent = summaryText
      ? `[EARLIER CONTEXT]\nSummary of the ${olderMessageCount} earlier message(s) in this conversation not included below due to context limits:\n${summaryText}\n[/EARLIER CONTEXT]`
      : `[EARLIER CONTEXT]\nThis conversation has ${olderMessageCount} earlier message(s) not shown due to context limits.\n[/EARLIER CONTEXT]`;
    conversationMessages.push({ role: 'system', content: summaryContent });
  }

  for (const msg of windowedMessages) {
    conversationMessages.push({
      role: msg.role,
      content: msg.role === 'user'
        ? `[USER MESSAGE]\n${msg.content}\n[/USER MESSAGE]`
        : msg.content
    });
  }

  // Add the current user message with delimiter.
  // When hiddenUserMessage is present, use it as the LLM prompt while the
  // visible `message` is stored in session history (already done above).
  const llmUserContent = hiddenUserMessage || message;
  let userContent = `[USER MESSAGE]\n${llmUserContent}\n[/USER MESSAGE]`;
  if (attachmentData) {
    // Sanitize filename before embedding in the LLM context to prevent prompt injection.
    // Replace non-word characters with underscores and cap length.
    const displayName = attachmentData.filename
      ? path.basename(String(attachmentData.filename)).replace(/[^\w\s.\-()]/g, '_').slice(0, 80)
      : 'attachment';
    // Only include MIME types from the known allowlist to prevent Content-Type header injection.
    const ALLOWED_MIME_DISPLAY = new Set([
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'
    ]);
    const displayMime = ALLOWED_MIME_DISPLAY.has(attachmentData.mimeType)
      ? attachmentData.mimeType
      : 'application/octet-stream';
    userContent += `\n[ATTACHMENT: ${displayName} (${displayMime})]`;
  }
  conversationMessages.push({
    role: 'user',
    content: userContent
  });

  const provider = getProviderForTask(AI_TASKS.GENERAL);

  if (!getApiKey(provider)) {
    return errorResponse(res, null, 'The AI service is not configured yet.', 503);
  }

  // Increase token budget for intents that produce large action payloads
  // (e.g. add_plan_items with 10+ items, workflow with many steps)
  const BULK_ACTION_INTENTS = new Set([
    'ADD_PLAN_ITEMS', 'PLAN_EXPERIENCE', 'BULK_OPERATION'
  ]);
  const baseBudget = 1500;
  const needsMoreTokens = BULK_ACTION_INTENTS.has(classification.intent) ||
    /add\s+(these|all|selected)\s+plan\s+items/i.test(classifyText);
  const maxTokens = needsMoreTokens ? 3000 : baseBudget;

  let llmResult;
  try {
    llmResult = await callProvider(provider, conversationMessages, {
      temperature: 0.7,
      maxTokens,
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
  const rawParsed = parseLLMResponse(llmResult.content || '');

  // Explode workflow actions into individual step-by-step pending actions
  const explodedActions = explodeWorkflows(rawParsed.pending_actions);

  // --- Step 5b: Auto-execute read-only actions ---
  // Read-only actions (suggest_plan_items, fetch_entity_photos) execute
  // immediately without confirmation and produce structured_content blocks.
  const readOnlyActions = explodedActions.filter(a => READ_ONLY_ACTION_TYPES.has(a.type));
  const confirmableActions = explodedActions.filter(a => !READ_ONLY_ACTION_TYPES.has(a.type));
  const READ_ONLY_CONTENT_TYPES = {
    discover_content: 'discovery_result_list',
    fetch_entity_photos: 'photo_gallery',
    fetch_destination_tips: 'tip_suggestion_list',
    list_user_experiences: 'experience_list',
    list_user_followers: 'follower_list',
    list_user_activities: 'activity_feed',
    list_entity_documents: 'document_list'
  };
  const structuredContent = [];

  if (readOnlyActions.length > 0) {
    const { executeAction } = require('../../utilities/bienbot-action-executor');

    for (const action of readOnlyActions) {
      try {
        const outcome = await executeAction(action, req.user, session);

        // Note: discover_content always returns a non-null result body (even for empty results)
        // so this guard correctly allows through the empty-results case.
        if (outcome.success && outcome.result) {
          const contentBlock = mapReadOnlyResultToStructuredContent(action.type, outcome.result);
          if (contentBlock) {
            structuredContent.push(contentBlock);
          }
        } else {
          logger.warn('[bienbot] Read-only action failed', {
            type: action.type,
            actionId: action.id,
            errors: outcome.errors
          });
        }
      } catch (err) {
        logger.error('[bienbot] Read-only action threw', {
          type: action.type,
          actionId: action.id,
          error: err.message
        });
      }
    }
  }

  const parsed = {
    message: rawParsed.message,
    pending_actions: confirmableActions,
    entity_refs: rawParsed.entity_refs || []
  };

  // --- Verify entity_refs against the database ---
  // The LLM may fabricate MongoDB ObjectIds that pass string-format checks.
  // We do a lightweight existence query for each ref and strip any that don't
  // resolve, preventing 404 links from being surfaced to the user.
  // For plan refs we also derive experience_id from the DB so it is never wrong.
  if (parsed.entity_refs.length > 0) {
    loadModels();
    const verifiedRefs = [];
    await Promise.all(parsed.entity_refs.map(async (ref) => {
      try {
        if (!mongoose.Types.ObjectId.isValid(ref._id)) {
          logger.warn('[bienbot] entity_ref dropped: invalid ObjectId format', { id: ref._id, type: ref.type });
          return;
        }
        if (ref.type === 'experience') {
          const exists = await Experience.findById(ref._id).select('_id').lean();
          if (exists) {
            verifiedRefs.push(ref);
          } else {
            logger.warn('[bienbot] entity_ref experience not found in DB, dropping', { id: ref._id });
          }
        } else if (ref.type === 'destination') {
          const exists = await Destination.findById(ref._id).select('_id').lean();
          if (exists) {
            verifiedRefs.push(ref);
          } else {
            logger.warn('[bienbot] entity_ref destination not found in DB, dropping', { id: ref._id });
          }
        } else if (ref.type === 'plan') {
          const plan = await Plan.findById(ref._id).select('_id experience').lean();
          if (plan) {
            // Always source experience_id from the DB — never trust the LLM value
            verifiedRefs.push({ ...ref, experience_id: plan.experience?.toString() || undefined });
          } else {
            logger.warn('[bienbot] entity_ref plan not found in DB, dropping', { id: ref._id });
          }
        } else {
          // plan_item and other types pass through (embedded in experience; costly to verify separately)
          verifiedRefs.push(ref);
        }
      } catch (verifyErr) {
        logger.warn('[bienbot] entity_ref verification failed, dropping', { id: ref._id, error: verifyErr.message });
      }
    }));
    parsed.entity_refs = verifiedRefs;
  }

  // --- Verify plan_id in pending plan-mutation actions ---
  // The LLM may carry a fabricated plan_id from LAST SHOWN ENTITY context or
  // session history. Strip any action whose plan_id doesn't resolve in the DB.
  const PLAN_MUTATION_ACTION_TYPES = new Set([
    'update_plan', 'add_plan_items', 'update_plan_item', 'delete_plan_item',
    'update_plan_item_note', 'update_plan_item_detail', 'shift_plan_item_dates',
    'update_plan_cost', 'delete_plan_cost', 'sync_plan'
  ]);
  if (parsed.pending_actions.some(a => PLAN_MUTATION_ACTION_TYPES.has(a.type) && a.payload?.plan_id)) {
    loadModels();
    const verifiedActions = [];
    await Promise.all(parsed.pending_actions.map(async (action) => {
      if (!PLAN_MUTATION_ACTION_TYPES.has(action.type) || !action.payload?.plan_id) {
        verifiedActions.push(action);
        return;
      }
      const planId = action.payload.plan_id;
      if (!mongoose.Types.ObjectId.isValid(planId)) {
        logger.warn('[bienbot] pending_action dropped: invalid plan_id format', { type: action.type, planId });
        return;
      }
      try {
        const plan = await Plan.findById(planId).select('_id').lean();
        if (plan) {
          verifiedActions.push(action);
        } else {
          logger.warn('[bienbot] pending_action dropped: plan_id not found in DB', { type: action.type, planId });
        }
      } catch (e) {
        logger.warn('[bienbot] pending_action plan_id verification error, dropping', { type: action.type, planId, error: e.message });
      }
    }));
    parsed.pending_actions = verifiedActions;
  }

  // Hydrate session context from entity_refs returned by the LLM.
  // This ensures subsequent messages can use entity IDs (e.g. a destination resolved
  // in a prior turn) without the user having to repeat the entity name.
  try {
    const ctxFromRefs = {};
    for (const ref of parsed.entity_refs) {
      if (!ref._id || /<[^>]+>/.test(ref._id)) continue; // skip placeholder IDs
      if (ref.type === 'destination' && !session.context?.destination_id) {
        ctxFromRefs.destination_id = ref._id;
      } else if (ref.type === 'experience' && !session.context?.experience_id) {
        ctxFromRefs.experience_id = ref._id;
      } else if (ref.type === 'plan' && !session.context?.plan_id) {
        ctxFromRefs.plan_id = ref._id;
      }
    }
    if (Object.keys(ctxFromRefs).length > 0) {
      await session.updateContext(ctxFromRefs);
      logger.debug('[bienbot] Session context hydrated from entity_refs', { ctxFromRefs });
    }
  } catch (ctxErr) {
    logger.warn('[bienbot] Failed to hydrate session context from entity_refs', { error: ctxErr.message });
  }

  // --- Step 6: Store in session ---
  try {
    // Add user message (with attachment metadata if present)
    const userMessageOpts = {
      intent: classification.intent,
      sentBy: req.user._id
    };
    if (attachmentData) {
      // Upload to S3 protected bucket now that we have the session ID
      if (pendingLocalFile) {
        try {
          const timestamp = Date.now();
          const originalExt = path.extname(attachmentData.filename);
          const originalBase = path.basename(attachmentData.filename, originalExt);
          const sanitizedBase = String(originalBase).replace(/[^a-zA-Z0-9.-]/g, '_');
          const s3KeyBase = `bienbot/${userId}/${session._id}/${timestamp}-${sanitizedBase}`;

          const { s3Result } = await uploadWithPipeline(pendingLocalFile, attachmentData.filename, s3KeyBase, {
            protected: true,
            deleteLocal: true
          });
          attachmentData.s3Key = s3Result.key;
          attachmentData.s3Bucket = s3Result.bucket;
          attachmentData.isProtected = true;
          pendingLocalFile = null;

          logger.info('[bienbot] Attachment uploaded to S3', {
            s3Key: s3Result.key,
            bucket: s3Result.bucket,
            userId
          });
        } catch (s3Err) {
          logger.error('[bienbot] S3 upload failed, continuing without persistence', {
            error: s3Err.message,
            userId
          });
          // Pipeline handles local cleanup on success; clean up on failure too
          if (pendingLocalFile) {
            try { await fs.promises.unlink(pendingLocalFile); } catch { /* ignore */ }
            pendingLocalFile = null;
          }
        }
      }

      userMessageOpts.attachments = [{
        filename: attachmentData.filename,
        mimeType: attachmentData.mimeType,
        fileSize: attachmentData.fileSize,
        extractedText: attachmentData.extractedText,
        extractionMethod: attachmentData.extractionMethod,
        s3Key: attachmentData.s3Key || null,
        s3Bucket: attachmentData.s3Bucket || null,
        isProtected: attachmentData.isProtected || false
      }];
    }
    await session.addMessage('user', message, userMessageOpts);

    // Add assistant response (with structured_content from read-only actions + entity refs)
    const actionsTaken = [
      ...readOnlyActions.map(a => a.type),
      ...parsed.pending_actions.map(a => a.type)
    ];
    const entityRefBlock = parsed.entity_refs?.length > 0
      ? [{ type: 'entity_ref_list', data: { refs: parsed.entity_refs } }]
      : [];
    await session.addMessage('assistant', parsed.message, {
      actions_taken: actionsTaken,
      structured_content: [...structuredContent, ...entityRefBlock]
    });
  } catch (err) {
    logger.error('[bienbot] Session message persistence failed', { error: err.message, errorType: err.name });
    // Continue — we can still return the response even if message persistence fails
  }

  // Store confirmable pending actions in a separate try/catch so that a message
  // persistence failure above does not prevent the actions from being saved.
  // Without this, the SSE would send actions to the frontend that are not in the DB,
  // causing 400 "Invalid or already executed action IDs" errors on execute.
  if (parsed.pending_actions.length > 0) {
    try {
      await session.setPendingActions(parsed.pending_actions);
      logger.debug('[bienbot] Pending actions saved', {
        sessionId: session._id?.toString(),
        actionIds: parsed.pending_actions.map(a => a.id)
      });
    } catch (err) {
      logger.error('[bienbot] setPendingActions failed — actions will not be executable', {
        error: err.message,
        errorType: err.name,
        sessionId: session._id?.toString(),
        actionIds: parsed.pending_actions.map(a => a.id)
      });
    }
  }

  try {
    // Auto-generate title from first user message
    await session.generateTitle();
  } catch (err) {
    logger.warn('[bienbot] generateTitle failed', { error: err.message });
  }

  // Non-blocking background memory extraction after each chat turn
  setImmediate(async () => {
    try {
      await extractMemoryFromSession({ session, user: req.user });
    } catch (e) {
      logger.debug('[bienbot] Background memory extraction failed', { error: e.message });
    }
  });

  // --- Step 7: SSE-stream the response ---
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  // Stream session info (include attachment data for frontend rendering)
  const sessionEvent = {
    sessionId: session._id.toString(),
    title: session.title
  };
  if (attachmentData?.s3Key) {
    sessionEvent.attachment = {
      s3Key: attachmentData.s3Key,
      s3Bucket: attachmentData.s3Bucket,
      isProtected: attachmentData.isProtected || false
    };
  }
  sendSSE(res, 'session', sessionEvent);

  // Emit skeleton sentinels for all read-only content types before token chunks
  // so the frontend can show placeholder cards while the assistant message streams in.
  const skeletonBlocks = readOnlyActions
    .filter(a => READ_ONLY_CONTENT_TYPES[a.type])
    .map(a => ({ type: READ_ONLY_CONTENT_TYPES[a.type], data: null }));
  if (skeletonBlocks.length > 0) {
    sendSSE(res, 'structured_content', { blocks: skeletonBlocks });
  }

  // Stream the message in adaptive chunks for progressive rendering.
  // Chunks split at word/sentence boundaries (min ~20 chars, max ~200 chars).
  const messageText = parsed.message;
  const tokenChunks = adaptiveChunks(messageText);

  for (const chunk of tokenChunks) {
    sendSSE(res, 'token', { text: chunk });
  }

  // Stream structured content from read-only actions
  if (structuredContent.length > 0) {
    sendSSE(res, 'structured_content', {
      blocks: structuredContent
    });
  }

  // Stream entity refs as structured content (after message tokens, before actions)
  if (parsed.entity_refs?.length > 0) {
    sendSSE(res, 'structured_content', {
      blocks: [{ type: 'entity_ref_list', data: { refs: parsed.entity_refs } }]
    });
  }

  // Always stream pending actions — even when empty — so the frontend replaces
  // any stale actions (e.g. select_plan from a prior turn or resumed session).
  sendSSE(res, 'actions', {
    pending_actions: parsed.pending_actions
  });

  // Signal completion
  sendSSE(res, 'done', {
    usage: llmResult.usage,
    intent: classification.intent,
    confidence: classification.confidence,
    source: classification.source || 'nlp'
  });

  res.end();
};

/**
 * Fetch existing user plans and discovery results for a given destination name,
 * then SSE-stream the combined response.
 *
 * Extracted from exports.chat to avoid recreating a closure on every request
 * and to make the `res` reference explicit rather than captured.
 *
 * @param {string} destName - Destination name to search
 * @param {object} params - Explicit dependencies (no closure capture)
 * @param {string} params.userId
 * @param {object} params.session - BienBot session document
 * @param {string} params.message - Original user message
 * @param {object} params.classification - Intent classification result
 * @param {object} params.req - Express request (for sentBy)
 * @param {object} params.res - Express response (SSE)
 * @returns {Promise<boolean>} true if response was streamed, false to fall through
 */
async function runPlanDiscover(destName, { userId, session, message, classification, req, res }) {
  loadModels();
  const destLower = destName.toLowerCase();

  // Fetch user's existing plans, filtering to those matching the destination
  const allUserPlans = await Plan.find({ user: userId })
    .populate({ path: 'experience', select: 'name destination', populate: { path: 'destination', select: 'name' } })
    .select('experience planned_date plan')
    .lean();

  const destPlans = allUserPlans.filter(p => {
    const pDest = (p.experience?.destination?.name || '').toLowerCase();
    return pDest && (pDest.includes(destLower) || destLower.includes(pDest));
  });

  // Build select_plan actions for existing plans
  const planActions = destPlans.slice(0, 6).map(p => ({
    id: `action_${crypto.randomBytes(4).toString('hex')}`,
    type: 'select_plan',
    payload: {
      plan_id: p._id.toString(),
      experience_name: p.experience?.name || '(unnamed)',
      destination_name: p.experience?.destination?.name || '',
      planned_date: p.planned_date || null,
      item_count: (p.plan || []).length
    },
    description: `${p.experience?.name || 'Plan'}${p.experience?.destination?.name ? ` in ${p.experience.destination.name}` : ''}${p.planned_date ? ` (${new Date(p.planned_date).toISOString().split('T')[0]})` : ''}`
  }));

  // Fetch available experiences via discovery (for new plan creation)
  const discoveryResult = await buildDiscoveryContext({ destination_name: destName }, userId).catch(() => null);

  // Only short-circuit if we have something useful to show
  if (planActions.length === 0 && !(discoveryResult?.results?.length > 0)) {
    return false;
  }

  const hasBoth = planActions.length > 0 && discoveryResult?.results?.length > 0;
  const hasPlansOnly = planActions.length > 0 && !discoveryResult?.results?.length;

  let msg;
  if (hasBoth) {
    msg = `You have ${planActions.length} plan${planActions.length !== 1 ? 's' : ''} in ${destName}. Select one to continue, or choose a new experience to plan below.`;
  } else if (hasPlansOnly) {
    msg = `You have ${planActions.length} plan${planActions.length !== 1 ? 's' : ''} in ${destName}. Select one to continue.`;
  } else {
    msg = `Here are experiences you can plan in ${destName}:`;
  }

  const discoveryBlock = discoveryResult?.results?.length > 0
    ? [{ type: 'discovery_result_list', data: { results: discoveryResult.results, query_metadata: discoveryResult.query_metadata || {} } }]
    : [];

  await session.addMessage('user', message, { intent: classification.intent, sentBy: req.user._id });
  await session.addMessage('assistant', msg, {
    actions_taken: [...planActions.map(() => 'select_plan'), ...(discoveryBlock.length ? ['discover_content'] : [])],
    structured_content: discoveryBlock
  });
  if (planActions.length > 0) {
    await session.setPendingActions(planActions);
  }
  await session.generateTitle();

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  sendSSE(res, 'session', { sessionId: session._id.toString(), title: session.title });

  // Emit discovery skeleton before tokens so cards appear as message streams in
  if (discoveryBlock.length > 0) {
    sendSSE(res, 'structured_content', { blocks: [{ type: 'discovery_result_list', data: null }] });
  }

  const chunks = adaptiveChunks(msg);
  for (const chunk of chunks) {
    sendSSE(res, 'token', { text: chunk });
  }

  if (discoveryBlock.length > 0) {
    sendSSE(res, 'structured_content', { blocks: discoveryBlock });
  }

  if (planActions.length > 0) {
    sendSSE(res, 'actions', { pending_actions: planActions });
  }

  sendSSE(res, 'done', { intent: classification.intent, confidence: classification.confidence, source: 'plan_experience_resolution' });
  res.end();

  logger.info('[bienbot] Plan+discover short-circuit', { userId, destination: destName, plans: planActions.length, experiences: discoveryResult?.results?.length || 0 });
  return true;
}

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
  const { valid, objectId: sessionObjId } = validateObjectId(id, 'session ID');
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
    session = await BienBotSession.findById(sessionObjId);
    if (!session) {
      return errorResponse(res, null, 'Session not found', 404);
    }
    const access = session.checkAccess(userId);
    if (!access.hasAccess) {
      return errorResponse(res, null, 'Session not found', 404);
    }
    // Only owner and editors can execute actions
    if (access.role === 'viewer') {
      return errorResponse(res, null, 'You have view-only access to this session', 403);
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
    logger.warn('[bienbot] Execute: action IDs not found or already executed', {
      userId,
      sessionId: id,
      requestedIds: actionIds,
      invalidIds,
      storedIds: (session.pending_actions || []).map(a => a.id),
      storedCount: (session.pending_actions || []).length
    });
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

    // --- Contextual enrichment: auto-fetch tips/photos after entity creation ---
    let enrichmentContent = null;
    const destCreation = results.find(
      r => r.success && r.type === 'create_destination' && r.result?._id
    );
    // Also check workflow steps that created a destination
    const workflowDestCreation = !destCreation && results.find(r => {
      if (!r.success || r.type !== 'workflow' || !r.result?.results) return false;
      return r.result.results.some(
        s => s.success && s.type === 'create_destination' && s.result?._id
      );
    });
    const createdDest = destCreation?.result
      || workflowDestCreation?.result?.results?.find(
        s => s.success && s.type === 'create_destination'
      )?.result;

    if (createdDest?._id) {
      try {
        const { fetchDestinationTips } = require('../../utilities/bienbot-external-data');
        const tipResult = await fetchDestinationTips(
          { destination_id: createdDest._id.toString(), destination_name: createdDest.name },
          req.user
        );
        if (tipResult.statusCode === 200 && tipResult.body?.success) {
          const block = mapReadOnlyResultToStructuredContent('fetch_destination_tips', tipResult.body.data);
          if (block) {
            enrichmentContent = block;
          }
        }
      } catch (enrichErr) {
        logger.warn('[bienbot] Post-creation tip enrichment failed', {
          destinationId: createdDest._id,
          error: enrichErr.message
        });
      }
    }

    // Auto-fetch Unsplash photos after experience creation
    if (!enrichmentContent) {
      const expCreation = results.find(
        r => r.success && r.type === 'create_experience' && r.result?._id
      );
      const workflowExpCreation = !expCreation && results.find(r => {
        if (!r.success || r.type !== 'workflow' || !r.result?.results) return false;
        return r.result.results.some(
          s => s.success && s.type === 'create_experience' && s.result?._id
        );
      });
      const createdExp = expCreation?.result
        || workflowExpCreation?.result?.results?.find(
          s => s.success && s.type === 'create_experience'
        )?.result;

      if (createdExp?._id) {
        try {
          const { fetchEntityPhotos } = require('../../utilities/bienbot-external-data');
          const photoResult = await fetchEntityPhotos(
            { entity_type: 'experience', entity_id: createdExp._id.toString() },
            req.user,
            session
          );
          if (photoResult.statusCode === 200 && photoResult.body?.success) {
            const block = mapReadOnlyResultToStructuredContent('fetch_entity_photos', photoResult.body.data);
            if (block) {
              enrichmentContent = block;
            }
          }
        } catch (enrichErr) {
          logger.warn('[bienbot] Post-creation photo enrichment failed', {
            experienceId: createdExp._id,
            error: enrichErr.message
          });
        }
      }
    }

    // Auto-suggest plan items after plan creation
    if (!enrichmentContent) {
      const planCreation = results.find(
        r => r.success && r.type === 'create_plan' && r.result?._id
      );
      // Also check workflow steps that created a plan
      const workflowPlanCreation = !planCreation && results.find(r => {
        if (!r.success || r.type !== 'workflow' || !r.result?.results) return false;
        return r.result.results.some(
          s => s.success && s.type === 'create_plan' && s.result?._id
        );
      });
      const createdPlan = planCreation?.result
        || workflowPlanCreation?.result?.results?.find(
          s => s.success && s.type === 'create_plan'
        )?.result;

      if (createdPlan?._id) {
        const destId = createdPlan.experience?.destination;
        const expId = createdPlan.experience?._id || createdPlan.experience;
        if (destId) {
          try {
            const { suggestPlanItems } = require('../../utilities/bienbot-external-data');
            const suggestionResult = await suggestPlanItems(
              {
                destination_id: destId.toString(),
                experience_id: expId?.toString(),
                limit: 5
              },
              req.user
            );
            if (
              suggestionResult.statusCode === 200 &&
              suggestionResult.body?.data?.suggestions?.length > 0
            ) {
              const block = mapReadOnlyResultToStructuredContent(
                'suggest_plan_items',
                suggestionResult.body.data
              );
              if (block) {
                enrichmentContent = block;
              }
            }
          } catch (enrichErr) {
            logger.warn('[bienbot] Post-creation plan item suggestion failed', {
              planId: createdPlan._id,
              error: enrichErr.message
            });
          }
        }
      }
    }

    // --- Post-execution follow-up: generate "what's next?" LLM message for plan mutations ---
    // Triggered when update_plan or create_plan succeeded, so the LLM can suggest next steps
    // with full plan items context loaded.
    let followUpMessage = null;
    const planMutation = results.find(r =>
      r.success && (r.type === 'update_plan' || r.type === 'create_plan') && r.result?._id
    );
    if (planMutation) {
      try {
        const planId = planMutation.result._id.toString();
        const nextStepsBlock = await buildPlanNextStepsContext(planId, userId);
        if (nextStepsBlock) {
          const executedDesc = actionsToExecute.find(a => a.type === planMutation.type)?.description || planMutation.type.replace(/_/g, ' ');
          const followUpSystemPrompt = [
            'You are BienBot, a helpful travel planning assistant for the Biensperience platform.',
            'Use sentence case for all text. Always use US English spellings.',
            'The user just confirmed and executed a plan action. Acknowledge it in one sentence (do not repeat the full action description verbatim), then ask what they want to do next and proactively suggest 2–3 concrete next steps based on the plan items below.',
            'Be specific — name actual plan items that need attention. Keep the total response under 80 words.',
            'Do NOT propose any pending_actions. Respond ONLY with valid JSON: { "message": "..." }',
            '',
            `Action completed: ${executedDesc}`,
            '',
            nextStepsBlock
          ].join('\n');

          const { provider } = await getProviderForTask(AI_TASKS.CHAT);
          const llmResult = await callProvider(provider, [
            { role: 'system', content: followUpSystemPrompt },
            { role: 'user', content: '[USER MESSAGE]\nWhat should I do next?\n[/USER MESSAGE]' }
          ], { stream: false });

          const raw = (llmResult.content || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
          try {
            const parsed = JSON.parse(raw);
            if (typeof parsed.message === 'string') followUpMessage = parsed.message;
          } catch {
            // If LLM returned plain text (not JSON), use it directly
            if (raw && raw.length < 600) followUpMessage = raw;
          }

          if (followUpMessage) {
            await session.addMessage('assistant', followUpMessage, { actions_taken: [] });
          }
        }
      } catch (followUpErr) {
        logger.warn('[bienbot] Post-execution follow-up LLM call failed', { error: followUpErr.message });
      }
    }

    // Invalidate the cached session summary so the next resume() reflects the executed actions
    try {
      session.summary = undefined;
      session.markModified('summary');
      await session.save();
    } catch (summaryErr) {
      logger.warn('[bienbot] Failed to invalidate summary cache after action execution', { error: summaryErr.message });
    }

    return successResponse(res, {
      results,
      contextUpdates,
      ...(enrichmentContent ? { enrichment: enrichmentContent } : {}),
      ...(followUpMessage ? { followUpMessage } : {}),
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
  const { valid, objectId: sessionObjId } = validateObjectId(id, 'session ID');
  if (!valid) {
    return errorResponse(res, null, 'Invalid session ID format', 400);
  }

  // Load session (non-lean so we can call instance methods)
  let session;
  try {
    session = await BienBotSession.findById(sessionObjId);
    if (!session) {
      return errorResponse(res, null, 'Session not found', 404);
    }
    const access = session.checkAccess(userId);
    if (!access.hasAccess) {
      return errorResponse(res, null, 'Session not found', 404);
    }
  } catch (err) {
    logger.error('[bienbot] Failed to load session for resume', { error: err.message });
    return errorResponse(res, null, 'Failed to load session', 500);
  }

  // Sessions with fewer than 3 messages: static greeting
  if ((session.messages || []).length < 3) {
    const shortFirstName = req.user?.name?.split(/\s+/)[0];
    const staticGreeting = {
      role: 'assistant',
      content: shortFirstName
        ? `Welcome back, ${shortFirstName}! How can I help you continue?`
        : 'Welcome back! How can I help you continue?',
      suggested_next_steps: ['Continue where you left off', 'Ask BienBot a new question']
    };

    return successResponse(res, {
      session: {
        ...session.toObject(),
        pending_actions: (session.pending_actions || []).filter(a =>
          !a.executed && a.type !== 'select_plan' && a.type !== 'select_destination'
        )
      },
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
  const firstName = req.user?.name?.split(/\s+/)[0];
  const greeting = firstName ? `Welcome back, ${firstName}!` : 'Welcome back!';
  const greetingContent = `${greeting} Here's a quick recap: ${summaryData.summary}`;

  // Append greeting to session messages
  try {
    await session.addMessage('assistant', greetingContent);
  } catch (err) {
    logger.warn('[bienbot] Failed to append greeting message', { error: err.message });
  }

  return successResponse(res, {
    session: {
      ...session.toObject(),
      // Disambiguation actions (select_plan, select_destination) are contextual to
      // the moment they were shown. On resume the user is on a fresh page; stale
      // pickers should not reappear. Clear them so only true pending actions (create,
      // update, delete, etc.) are restored.
      pending_actions: (session.pending_actions || []).filter(a =>
        !a.executed && a.type !== 'select_plan' && a.type !== 'select_destination'
      )
    },
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

  const { valid, objectId: sessionObjId } = validateObjectId(id, 'session ID');
  if (!valid) {
    return errorResponse(res, null, 'Invalid session ID format', 400);
  }

  try {
    const session = await BienBotSession.findById(sessionObjId).lean();
    if (!session) {
      return errorResponse(res, null, 'Session not found', 404);
    }
    // Inline access check (lean documents don't have instance methods)
    const isOwner = session.user.toString() === userId;
    const isCollaborator = (session.shared_with || []).some(c => c.user_id.toString() === userId);
    if (!isOwner && !isCollaborator) {
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

  const { valid, objectId: sessionObjId } = validateObjectId(id, 'session ID');
  if (!valid) {
    return errorResponse(res, null, 'Invalid session ID format', 400);
  }

  try {
    const session = await BienBotSession.findById(sessionObjId);
    if (!session) {
      return errorResponse(res, null, 'Session not found', 404);
    }
    // Only the session owner can delete (archive) it
    if (session.user.toString() !== userId) {
      return errorResponse(res, null, 'Session not found', 404);
    }

    await session.archive();

    const archivedSession = session.toObject();

    // Clean up any cached photos that were never assigned to an entity — fire-and-forget
    require('../../utilities/bienbot-external-data').cleanupSessionPhotos(archivedSession)
      .catch(err => logger.error('[bienbot] Session photo cleanup failed', { error: err.message, sessionId: id }));

    // Trigger async memory extraction — fire-and-forget, never delays the response
    extractMemoryFromSession({ session: archivedSession, user: req.user })
      .catch(err => logger.error('[bienbot] Async memory extraction failed', { error: err.message, sessionId: id }));

    // Extract memory for collaborators who contributed to this shared session
    if ((archivedSession.shared_with || []).length > 0) {
      extractMemoryForCollaborators(archivedSession)
        .catch(err => logger.error('[bienbot] Async collaborator memory extraction failed', { error: err.message, sessionId: id }));
    }

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

  const { valid, objectId: sessionObjId } = validateObjectId(id, 'session ID');
  if (!valid) {
    return errorResponse(res, null, 'Invalid session ID format', 400);
  }

  const { entity, entityId } = req.body;
  if (!entity || !entityId) {
    return errorResponse(res, null, 'entity and entityId are required', 400);
  }

  const { valid: entityIdValid, objectId: entityObjId } = validateObjectId(entityId, 'entityId');
  if (!entityIdValid) {
    return errorResponse(res, null, 'Invalid entityId format', 400);
  }

  const allowedEntities = ['destination', 'experience', 'plan', 'plan_item', 'user'];
  if (!allowedEntities.includes(entity)) {
    return errorResponse(res, null, 'Unknown entity type', 400);
  }

  let session;
  try {
    session = await BienBotSession.findById(sessionObjId);
    if (!session) {
      return errorResponse(res, null, 'Session not found', 404);
    }
    const access = session.checkAccess(userId);
    if (!access.hasAccess) {
      return errorResponse(res, null, 'Session not found', 404);
    }
    // Only owner and editors can update context
    if (access.role === 'viewer') {
      return errorResponse(res, null, 'You have view-only access to this session', 403);
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
        resource = await Destination.findById(entityObjId).lean();
        break;
      case 'experience':
        resource = await Experience.findById(entityObjId).lean();
        break;
      case 'plan':
        resource = await Plan.findById(entityObjId).lean();
        break;
      case 'plan_item': {
        const parentPlan = await findPlanContainingItem(entityObjId);
        if (parentPlan) resource = parentPlan;
        break;
      }
      case 'user':
        resource = await User.findById(entityObjId).lean();
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
  // Keys to clear when the parent context switches to a different entity.
  // Switching destination → clear experience, plan, plan_item (stale chain).
  // Switching experience → clear plan, plan_item (they belonged to the old experience).
  const contextUnset = {};
  const existingCtx = session.context || {};

  switch (entity) {
    case 'destination':
      contextUpdate.destination_id = entityId;
      // Cascade-clear experience/plan/plan_item if switching to a different destination
      if (existingCtx.destination_id && existingCtx.destination_id.toString() !== entityId) {
        if (existingCtx.experience_id) contextUnset['context.experience_id'] = '';
        if (existingCtx.plan_id) contextUnset['context.plan_id'] = '';
        if (existingCtx.plan_item_id) contextUnset['context.plan_item_id'] = '';
      }
      break;
    case 'experience':
      contextUpdate.experience_id = entityId;
      // Cascade-clear plan/plan_item if switching to a different experience
      if (existingCtx.experience_id && existingCtx.experience_id.toString() !== entityId) {
        if (existingCtx.plan_id) contextUnset['context.plan_id'] = '';
        if (existingCtx.plan_item_id) contextUnset['context.plan_item_id'] = '';
      }
      break;
    case 'plan':
      contextUpdate.plan_id = entityId;
      if (existingCtx.plan_item_id) contextUnset['context.plan_item_id'] = '';
      break;
    case 'plan_item': {
      contextUpdate.plan_item_id = entityId;
      const parentPlan = await findPlanContainingItem(entityObjId, { select: '_id', lean: true });
      if (parentPlan) contextUpdate.plan_id = parentPlan._id.toString();
      break;
    }
    case 'user':
      break;
  }

  try {
    // Use atomic findByIdAndUpdate to avoid a lost-update race condition.
    // If a concurrent chat turn saves pending_actions between when we loaded
    // the session (above) and when we save here, a plain session.save() would
    // overwrite those pending_actions with the stale empty array we loaded.
    // $set on individual context keys and $push to messages avoids that.
    const newMsg = {
      msg_id: `msg_${crypto.randomBytes(4).toString('hex')}`,
      role: 'assistant',
      content: `Now viewing: ${entityLabel}`,
      timestamp: new Date(),
      intent: null,
      actions_taken: ['context_update'],
      message_type: 'bot_query'
    };

    const atomicUpdate = { $push: { messages: newMsg } };
    if (Object.keys(contextUpdate).length > 0) {
      atomicUpdate.$set = {};
      for (const [k, v] of Object.entries(contextUpdate)) {
        atomicUpdate.$set[`context.${k}`] = v;
      }
    }
    if (Object.keys(contextUnset).length > 0) {
      atomicUpdate.$unset = contextUnset;
    }

    await BienBotSession.findByIdAndUpdate(sessionObjId, atomicUpdate);

    logger.info('[bienbot] Session context updated', { userId, sessionId: id, entity, entityId, unset: Object.keys(contextUnset) });
    // Compute the response context by merging the update into the loaded snapshot and removing unset fields
    const responseContext = { ...session.context, ...contextUpdate };
    for (const key of Object.keys(contextUnset)) {
      // keys are 'context.plan_id' etc — strip the 'context.' prefix
      delete responseContext[key.replace(/^context\./, '')];
    }
    return successResponse(res, { entityLabel, context: responseContext });
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

  const { valid, objectId: sessionObjId } = validateObjectId(id, 'session ID');
  if (!valid) {
    return errorResponse(res, null, 'Invalid session ID format', 400);
  }

  if (!actionId || typeof actionId !== 'string') {
    return errorResponse(res, null, 'Action ID is required', 400);
  }

  try {
    const session = await BienBotSession.findById(sessionObjId);
    if (!session) {
      return errorResponse(res, null, 'Session not found', 404);
    }
    const access = session.checkAccess(userId);
    if (!access.hasAccess) {
      return errorResponse(res, null, 'Session not found', 404);
    }
    // Only owner and editors can cancel actions
    if (access.role === 'viewer') {
      return errorResponse(res, null, 'You have view-only access to this session', 403);
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

// ---------------------------------------------------------------------------
// Session sharing
// ---------------------------------------------------------------------------

/**
 * POST /api/bienbot/sessions/:id/collaborators
 *
 * Share a session with another user. Only the session owner can share.
 * The target user must have the 'ai_features' flag.
 *
 * Body: { userId: string, role?: 'viewer' | 'editor' }
 */
exports.addSessionCollaborator = async (req, res) => {
  const ownerId = req.user._id.toString();
  const { id } = req.params;
  const { userId: targetUserId, role = 'viewer' } = req.body;

  const { valid, objectId: sessionObjId } = validateObjectId(id, 'session ID');
  if (!valid) {
    return errorResponse(res, null, 'Invalid session ID format', 400);
  }

  if (!targetUserId) {
    return errorResponse(res, null, 'userId is required', 400);
  }
  const { valid: targetValid, objectId: targetUserObjId } = validateObjectId(targetUserId, 'userId');
  if (!targetValid) {
    return errorResponse(res, null, 'Invalid userId format', 400);
  }

  if (!['viewer', 'editor'].includes(role)) {
    return errorResponse(res, null, 'Role must be "viewer" or "editor"', 400);
  }

  if (targetUserId === ownerId) {
    return errorResponse(res, null, 'Cannot share a session with yourself', 400);
  }

  try {
    const session = await BienBotSession.findById(sessionObjId);
    if (!session) {
      return errorResponse(res, null, 'Session not found', 404);
    }

    // Only the session owner can share
    if (session.user.toString() !== ownerId) {
      return errorResponse(res, null, 'Session not found', 404);
    }

    // Verify target user exists and has ai_features
    loadModels();
    const targetUser = await User.findById(targetUserObjId);
    if (!targetUser) {
      return errorResponse(res, null, 'User not found', 404);
    }

    const { hasFeatureFlag } = require('../../utilities/feature-flags');
    if (!hasFeatureFlag(targetUser, 'ai_features')) {
      return errorResponse(res, null, 'Target user does not have access to AI features', 403);
    }

    // Require mutual follow — both users must follow each other
    const Follow = require('../../models/follow');
    const [ownerFollowsTarget, targetFollowsOwner] = await Promise.all([
      Follow.isFollowing(ownerId, targetUserId),
      Follow.isFollowing(targetUserId, ownerId)
    ]);
    if (!ownerFollowsTarget || !targetFollowsOwner) {
      return errorResponse(res, null, 'You can only share sessions with users who mutually follow you', 403);
    }

    await session.addCollaborator(targetUserId, role, ownerId, targetUser.name || null);

    logger.info('[bienbot] Session collaborator added', {
      sessionId: id,
      ownerId,
      targetUserId,
      role
    });

    // Notify the target user and create an activity so the notification badge counts it
    try {
      const Activity = require('../../models/activity');
      const { notifyUser } = require('../../utilities/notifications');

      const ownerName = req.user.name || 'Someone';
      const sessionTitle = session.title || 'a BienBot session';
      const reason = `${ownerName} shared ${sessionTitle} with you`;

      // Activity record for the target user (actor = target so it shows in their feed)
      const createdActivity = await Activity.create({
        action: 'collaborator_added',
        actor: {
          _id: targetUser._id,
          name: targetUser.name,
          email: targetUser.email,
          role: targetUser.role
        },
        resource: {
          id: session._id,
          type: 'BienBotSession',
          name: sessionTitle
        },
        target: {
          id: req.user._id,
          type: 'User',
          name: req.user.name || ''
        },
        reason,
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          requestPath: req.path,
          requestMethod: req.method
        },
        status: 'success'
      });

      // In-app notification (bienbot channel is informational; webhook for external)
      await notifyUser({
        user: targetUser,
        channel: 'bienbot',
        type: 'activity',
        message: reason,
        data: {
          kind: 'bienbot_session',
          action: 'collaborator_added',
          sessionId: session._id.toString(),
          ownerId: ownerId
        },
        logContext: { feature: 'bienbot_session_shared', sessionId: id, targetUserId }
      });

      // Push real-time notification badge update directly to the target user's WS connection
      try {
        const { sendEventToUser: wsSendToUser } = require('../../utilities/websocket-server');
        wsSendToUser(targetUserId, {
          type: 'notification:received',
          payload: { notification: createdActivity.toObject ? createdActivity.toObject() : createdActivity }
        });
      } catch (wsErr) {
        logger.warn('[bienbot] Failed to push real-time notification to collaborator', { error: wsErr.message });
      }
    } catch (notifyErr) {
      logger.warn('[bienbot] Failed to create activity/notification for session share (continuing)', {
        error: notifyErr.message,
        sessionId: id,
        targetUserId
      });
    }

    return successResponse(res, {
      message: 'Collaborator added',
      shared_with: session.shared_with
    });
  } catch (err) {
    logger.error('[bienbot] Failed to add session collaborator', { error: err.message, sessionId: id });
    return errorResponse(res, err, 'Failed to add collaborator', 500);
  }
};

/**
 * DELETE /api/bienbot/sessions/:id/collaborators/:userId
 *
 * Remove a collaborator from a session. The session owner can remove anyone;
 * a collaborator can remove themselves.
 */
exports.removeSessionCollaborator = async (req, res) => {
  const actorId = req.user._id.toString();
  const { id, userId: targetUserId } = req.params;

  const { valid, objectId: sessionObjId } = validateObjectId(id, 'session ID');
  if (!valid) {
    return errorResponse(res, null, 'Invalid session ID format', 400);
  }
  const { valid: targetValid } = validateObjectId(targetUserId, 'userId');
  if (!targetValid) {
    return errorResponse(res, null, 'Invalid userId format', 400);
  }

  try {
    const session = await BienBotSession.findById(sessionObjId);
    if (!session) {
      return errorResponse(res, null, 'Session not found', 404);
    }

    const isOwner = session.user.toString() === actorId;
    const isSelf = targetUserId === actorId;

    // Only owner can remove others; collaborators can remove themselves
    if (!isOwner && !isSelf) {
      return errorResponse(res, null, 'Session not found', 404);
    }

    await session.removeCollaborator(targetUserId);

    logger.info('[bienbot] Session collaborator removed', {
      sessionId: id,
      actorId,
      targetUserId
    });

    return successResponse(res, {
      message: 'Collaborator removed',
      shared_with: session.shared_with
    });
  } catch (err) {
    logger.error('[bienbot] Failed to remove session collaborator', { error: err.message, sessionId: id });
    return errorResponse(res, err, 'Failed to remove collaborator', 500);
  }
};

/**
 * GET /api/bienbot/mutual-followers
 *
 * Return users who mutually follow the authenticated user, filtered by an
 * optional search query (name or email). Used by the Share Session popover
 * to populate the user search dropdown.
 *
 * Query params:
 *   q  - Optional search string matched against name/email (case-insensitive)
 */
exports.getMutualFollowers = async (req, res) => {
  const userId = req.user._id;
  const { q = '' } = req.query;
  const searchTerm = q.trim().toLowerCase();

  loadModels();

  try {
    const Follow = require('../../models/follow');

    // Step 1: Get IDs of users that the current user follows (active)
    const followingIds = await Follow.getFollowingIds(userId);

    if (followingIds.length === 0) {
      return successResponse(res, { users: [] });
    }

    // Step 2: Among those, find who also follows the current user back
    const mutualFollows = await Follow.find({
      follower: { $in: followingIds },
      following: userId,
      status: 'active'
    }).select('follower').lean();

    const mutualIds = mutualFollows.map(f => f.follower);

    if (mutualIds.length === 0) {
      return successResponse(res, { users: [] });
    }

    // Step 3: Fetch user details and apply search filter
    const query = { _id: { $in: mutualIds } };
    if (searchTerm) {
      const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: { $regex: escapedTerm, $options: 'i' } },
        { email: { $regex: escapedTerm, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('_id name email')
      .limit(20)
      .lean();

    return successResponse(res, { users });
  } catch (err) {
    logger.error('[bienbot] Failed to get mutual followers', { error: err.message, userId });
    return errorResponse(res, err, 'Failed to get mutual followers', 500);
  }
};

/**
 * GET /api/bienbot/memory
 *
 * Return the authenticated user's cross-session BienBot memory entries.
 * Each entry contains facts extracted from a past conversation session.
 */
exports.getMemory = async (req, res) => {
  const userId = req.user._id;
  loadModels();

  try {
    const user = await User.findById(userId).select('bienbot_memory').lean();
    const entries = user?.bienbot_memory?.entries || [];
    const updatedAt = user?.bienbot_memory?.updated_at || null;

    return successResponse(res, { entries, updated_at: updatedAt });
  } catch (err) {
    logger.error('[bienbot] Failed to get memory', { error: err.message, userId });
    return errorResponse(res, err, 'Failed to retrieve memory', 500);
  }
};

/**
 * DELETE /api/bienbot/memory
 *
 * Clear all cross-session memory for the authenticated user.
 * Irreversible — the user must confirm this action in the UI.
 */
exports.clearMemory = async (req, res) => {
  const userId = req.user._id;
  loadModels();

  try {
    await User.findByIdAndUpdate(userId, {
      $set: {
        'bienbot_memory.entries': [],
        'bienbot_memory.updated_at': new Date()
      }
    });

    logger.info('[bienbot] User memory cleared', { userId });
    return successResponse(res, { message: 'Memory cleared' });
  } catch (err) {
    logger.error('[bienbot] Failed to clear memory', { error: err.message, userId });
    return errorResponse(res, err, 'Failed to clear memory', 500);
  }
};

// ---------------------------------------------------------------------------
// Apply Tips
// ---------------------------------------------------------------------------

/**
 * POST /api/bienbot/sessions/:id/tips
 *
 * Directly appends selected travel tips to a destination, bypassing the LLM.
 * Called from the TipSuggestionList UI when the user confirms their selection.
 *
 * Body: { destination_id: string, tips: Array<{ type, value, category, source, ... }> }
 */
exports.applyTips = async (req, res) => {
  const userId = req.user._id.toString();
  const { destination_id, tips } = req.body || {};

  if (!destination_id || !Array.isArray(tips) || tips.length === 0) {
    return errorResponse(res, null, 'destination_id and a non-empty tips array are required', 400);
  }

  const { valid, objectId: destOid } = validateObjectId(destination_id, 'destination_id');
  if (!valid) {
    return errorResponse(res, null, 'Invalid destination_id format', 400);
  }

  // Sanitise: only keep allowed fields per tip
  const sanitised = tips
    .filter(t => t && typeof t.value === 'string' && t.value.trim())
    .map(t => ({
      type: t.type || 'Custom',
      value: t.value.trim(),
      ...(t.category ? { category: t.category } : {}),
      ...(t.source ? { source: t.source } : {}),
      ...(t.icon ? { icon: t.icon } : {}),
      ...(t.url ? { url: t.url } : {})
    }));

  if (sanitised.length === 0) {
    return errorResponse(res, null, 'No valid tips provided', 400);
  }

  loadModels();

  try {
    const destination = await Destination.findById(destOid);
    if (!destination) {
      return errorResponse(res, null, 'Destination not found', 404);
    }

    // Permission check — must be able to edit the destination
    const enforcer = getEnforcer({ Destination, Experience, Plan, User });
    const canEdit = await enforcer.canEdit({ userId, resource: destination });
    if (!canEdit.allowed) {
      return errorResponse(res, null, canEdit.reason || 'Forbidden', 403);
    }

    // Append tips (avoid exact-value duplicates)
    const existingValues = new Set(
      (destination.travel_tips || []).map(t =>
        (typeof t === 'string' ? t : t.value || '').toLowerCase().trim()
      )
    );

    const toAdd = sanitised.filter(
      t => !existingValues.has(t.value.toLowerCase().trim())
    );

    if (toAdd.length > 0) {
      destination.travel_tips = [...(destination.travel_tips || []), ...toAdd];
      destination.travel_tips_updated_at = new Date();
      await destination.save();
    }

    logger.info('[bienbot] Tips applied to destination', {
      userId,
      destinationId: destination_id,
      requested: sanitised.length,
      added: toAdd.length,
      skipped: sanitised.length - toAdd.length
    });

    return successResponse(res, {
      added: toAdd.length,
      skipped: sanitised.length - toAdd.length,
      destination_id
    });
  } catch (err) {
    logger.error('[bienbot] applyTips failed', { error: err.message, userId, destination_id });
    return errorResponse(res, err, 'Failed to apply tips', 500);
  }
};

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
    '- The object must have a "suggestions" array and a "suggested_prompts" array.',
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

  // --- Input validation ---
  const { entity, entityId } = req.body;

  if (!entity || typeof entity !== 'string') {
    return errorResponse(res, null, 'entity is required', 400);
  }

  const allowedEntities = Object.keys(ANALYZE_ENTITY_MAP);
  if (!allowedEntities.includes(entity)) {
    return errorResponse(res, null, `Unsupported entity type. Must be one of: ${allowedEntities.join(', ')}`, 400);
  }

  if (!entityId || typeof entityId !== 'string') {
    return errorResponse(res, null, 'entityId is required', 400);
  }

  const { valid, objectId: validatedId } = validateObjectId(entityId, 'entityId');
  if (!valid) {
    return errorResponse(res, null, 'Invalid entityId format', 400);
  }

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

  // --- Parse suggestions and suggested prompts ---
  let suggestions = [];
  let suggestedPrompts = [];
  try {
    const cleaned = (llmResult.content || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned);

    // Support both old format (array) and new format (object with suggestions + suggested_prompts)
    const suggestionsArr = Array.isArray(parsed) ? parsed : (parsed.suggestions || []);
    const promptsArr = Array.isArray(parsed) ? [] : (parsed.suggested_prompts || []);

    const VALID_TYPES = new Set(['warning', 'tip', 'info', 'action']);
    suggestions = suggestionsArr
      .filter(s => s && VALID_TYPES.has(s.type) && typeof s.message === 'string' && s.message.trim())
      .slice(0, 10)
      .map(s => ({ type: s.type, message: s.message.trim().slice(0, 200) }));

    suggestedPrompts = promptsArr
      .filter(p => typeof p === 'string' && p.trim())
      .slice(0, 4)
      .map(p => p.trim().slice(0, 100));
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
    suggestedPromptsCount: suggestedPrompts.length
  });

  return successResponse(res, {
    entity,
    entityId: validatedId,
    suggestions,
    suggestedPrompts
  });
};

// ---------------------------------------------------------------------------
// Workflow step management
// ---------------------------------------------------------------------------

/**
 * PATCH /api/bienbot/sessions/:id/pending/:actionId
 *
 * Update status of a single pending action (skip, edit payload, approve).
 * Used by the sequential workflow confirmation UX.
 *
 * Body: { status: 'approved' | 'skipped', payload?: object }
 */
exports.updatePendingAction = async (req, res) => {
  const userId = req.user._id.toString();
  const { id, actionId } = req.params;
  const { status: newStatus, payload: newPayload } = req.body;

  const { valid, objectId: sessionObjId } = validateObjectId(id, 'session ID');
  if (!valid) {
    return errorResponse(res, null, 'Invalid session ID format', 400);
  }

  if (!actionId || typeof actionId !== 'string') {
    return errorResponse(res, null, 'Action ID is required', 400);
  }

  const allowedStatuses = ['approved', 'skipped'];
  if (!newStatus || !allowedStatuses.includes(newStatus)) {
    return errorResponse(res, null, `Status must be one of: ${allowedStatuses.join(', ')}`, 400);
  }

  let session;
  try {
    session = await BienBotSession.findById(sessionObjId);
    if (!session) {
      return errorResponse(res, null, 'Session not found', 404);
    }
    const access = session.checkAccess(userId);
    if (!access.hasAccess) {
      return errorResponse(res, null, 'Session not found', 404);
    }
    if (access.role === 'viewer') {
      return errorResponse(res, null, 'You have view-only access to this session', 403);
    }
  } catch (err) {
    logger.error('[bienbot] Failed to load session for updatePendingAction', { error: err.message });
    return errorResponse(res, null, 'Failed to load session', 500);
  }

  const action = (session.pending_actions || []).find(a => a.id === actionId);
  if (!action) {
    return errorResponse(res, null, 'Pending action not found', 404);
  }

  if (action.status === 'completed' || (action.executed && action.status !== 'failed')) {
    return errorResponse(res, null, 'Action has already been completed', 400);
  }

  // If retrying a failed step, reset it and un-cascade dependents
  if (action.status === 'failed' && newStatus === 'approved') {
    action.error_message = null;
    action.executed = false;
    action.result = null;
    // Reset dependent steps that were cascade-failed due to this step
    if (action.workflow_id) {
      const siblings = (session.pending_actions || []).filter(
        a => a.workflow_id === action.workflow_id
      );
      for (const sibling of siblings) {
        if (
          sibling.status === 'failed' &&
          Array.isArray(sibling.depends_on) &&
          sibling.depends_on.includes(actionId)
        ) {
          sibling.status = 'pending';
          sibling.error_message = null;
        }
      }
    }
  }

  // Update status
  action.status = newStatus;

  // Optionally update payload (for edit)
  if (newPayload && typeof newPayload === 'object') {
    action.payload = newPayload;
  }

  // If skipped, cascade: mark dependent workflow steps as failed
  if (newStatus === 'skipped' && action.workflow_id) {
    const workflowActions = (session.pending_actions || []).filter(
      a => a.workflow_id === action.workflow_id
    );
    for (const sibling of workflowActions) {
      if (Array.isArray(sibling.depends_on) && sibling.depends_on.includes(actionId)) {
        if (sibling.status === 'pending') {
          sibling.status = 'failed';
          sibling.error_message = `Skipped dependency: "${action.description || actionId}"`;
        }
      }
    }
  }

  // If approved, execute the step immediately
  let executionResult = null;
  if (newStatus === 'approved') {
    action.status = 'executing';
    session.markModified('pending_actions');
    await session.save();

    const workflowActions = action.workflow_id
      ? (session.pending_actions || []).filter(a => a.workflow_id === action.workflow_id)
      : [];

    const outcome = await executeSingleWorkflowStep(action, workflowActions, req.user);
    executionResult = outcome;

    if (outcome.success) {
      action.status = 'completed';
      action.executed = true;
      action.result = { success: true, data: outcome.result, errors: [] };
    } else {
      action.status = 'failed';
      action.error_message = outcome.errors?.[0] || 'Execution failed';
      action.result = { success: false, errors: outcome.errors };

      // Cascade failure to dependents
      if (action.workflow_id) {
        const siblings = (session.pending_actions || []).filter(
          a => a.workflow_id === action.workflow_id
        );
        for (const sibling of siblings) {
          if (Array.isArray(sibling.depends_on) && sibling.depends_on.includes(actionId)) {
            if (sibling.status === 'pending') {
              sibling.status = 'failed';
              sibling.error_message = `Depends on failed step: "${action.description || actionId}"`;
            }
          }
        }
      }
    }
  }

  session.markModified('pending_actions');
  await session.save();

  logger.info('[bienbot] Pending action updated', {
    userId,
    sessionId: id,
    actionId,
    newStatus: action.status,
    isWorkflow: !!action.workflow_id
  });

  // --- Contextual enrichment: auto-fetch tips/photos after entity creation step ---
  let enrichmentContent = null;
  if (
    action.status === 'completed' &&
    action.type === 'create_destination' &&
    executionResult?.success &&
    executionResult?.result?._id
  ) {
    try {
      const { fetchDestinationTips } = require('../../utilities/bienbot-external-data');
      const tipResult = await fetchDestinationTips(
        { destination_id: executionResult.result._id.toString(), destination_name: executionResult.result.name },
        req.user
      );
      if (tipResult.statusCode === 200 && tipResult.body?.success) {
        const block = mapReadOnlyResultToStructuredContent('fetch_destination_tips', tipResult.body.data);
        if (block) {
          enrichmentContent = block;
        }
      }
    } catch (enrichErr) {
      logger.warn('[bienbot] Post-step tip enrichment failed', {
        destinationId: executionResult.result._id,
        error: enrichErr.message
      });
    }
  }

  // Auto-fetch Unsplash photos after experience creation step
  if (
    !enrichmentContent &&
    action.status === 'completed' &&
    action.type === 'create_experience' &&
    executionResult?.success &&
    executionResult?.result?._id
  ) {
    try {
      const { fetchEntityPhotos } = require('../../utilities/bienbot-external-data');
      const photoResult = await fetchEntityPhotos(
        { entity_type: 'experience', entity_id: executionResult.result._id.toString() },
        req.user,
        session
      );
      if (photoResult.statusCode === 200 && photoResult.body?.success) {
        const block = mapReadOnlyResultToStructuredContent('fetch_entity_photos', photoResult.body.data);
        if (block) {
          enrichmentContent = block;
        }
      }
    } catch (enrichErr) {
      logger.warn('[bienbot] Post-step photo enrichment failed', {
        experienceId: executionResult.result._id,
        error: enrichErr.message
      });
    }
  }

  return successResponse(res, {
    action: {
      id: action.id,
      type: action.type,
      status: action.status,
      error_message: action.error_message,
      result: action.result,
      workflow_id: action.workflow_id,
      workflow_step: action.workflow_step,
      workflow_total: action.workflow_total
    },
    execution: executionResult,
    ...(enrichmentContent ? { enrichment: enrichmentContent } : {}),
    pending_actions: session.pending_actions
  });
};

/**
 * GET /api/bienbot/sessions/:id/workflow/:workflowId
 *
 * Get the full state of a workflow — all actions sharing the same workflow_id.
 */
exports.getWorkflowState = async (req, res) => {
  const userId = req.user._id.toString();
  const { id, workflowId } = req.params;

  const { valid, objectId: sessionObjId } = validateObjectId(id, 'session ID');
  if (!valid) {
    return errorResponse(res, null, 'Invalid session ID format', 400);
  }

  if (!workflowId || typeof workflowId !== 'string') {
    return errorResponse(res, null, 'Workflow ID is required', 400);
  }

  let session;
  try {
    session = await BienBotSession.findById(sessionObjId).lean();
    if (!session) {
      return errorResponse(res, null, 'Session not found', 404);
    }
    const uid = userId;
    const isOwner = session.user.toString() === uid;
    const isCollab = (session.shared_with || []).some(c => c.user_id.toString() === uid);
    if (!isOwner && !isCollab) {
      return errorResponse(res, null, 'Session not found', 404);
    }
  } catch (err) {
    logger.error('[bienbot] Failed to load session for getWorkflowState', { error: err.message });
    return errorResponse(res, null, 'Failed to load session', 500);
  }

  const workflowActions = (session.pending_actions || []).filter(
    a => a.workflow_id === workflowId
  );

  if (workflowActions.length === 0) {
    return errorResponse(res, null, 'Workflow not found', 404);
  }

  // Sort by step number
  workflowActions.sort((a, b) => (a.workflow_step || 0) - (b.workflow_step || 0));

  const completed = workflowActions.filter(a => a.status === 'completed').length;
  const skipped = workflowActions.filter(a => a.status === 'skipped').length;
  const failed = workflowActions.filter(a => a.status === 'failed').length;
  const pending = workflowActions.filter(a => a.status === 'pending').length;

  return successResponse(res, {
    workflow_id: workflowId,
    total: workflowActions.length,
    completed,
    skipped,
    failed,
    pending,
    actions: workflowActions
  });
};

/**
 * Get a signed URL for a BienBot session attachment stored in S3.
 * GET /api/bienbot/sessions/:id/attachments/:messageIndex/:attachmentIndex
 */
exports.getAttachmentUrl = async (req, res) => {
  const userId = req.user._id.toString();
  const { id, messageIndex, attachmentIndex } = req.params;

  const { valid, objectId: sessionObjId } = validateObjectId(id, 'session ID');
  if (!valid) {
    return errorResponse(res, null, 'Invalid session ID format', 400);
  }

  const msgIdx = parseInt(messageIndex, 10);
  const attIdx = parseInt(attachmentIndex, 10);
  if (isNaN(msgIdx) || msgIdx < 0 || isNaN(attIdx) || attIdx < 0) {
    return errorResponse(res, null, 'Invalid message or attachment index', 400);
  }

  try {
    const session = await BienBotSession.findById(sessionObjId).lean();
    if (!session) {
      return errorResponse(res, null, 'Session not found', 404);
    }

    // Verify access: owner or collaborator
    const isOwner = session.user.toString() === userId;
    const isCollab = (session.shared_with || []).some(c => c.user_id.toString() === userId);
    if (!isOwner && !isCollab) {
      return errorResponse(res, null, 'Session not found', 404);
    }

    const messages = session.messages || [];
    if (msgIdx >= messages.length) {
      return errorResponse(res, null, 'Message not found', 404);
    }

    const attachments = messages[msgIdx].attachments || [];
    if (attIdx >= attachments.length) {
      return errorResponse(res, null, 'Attachment not found', 404);
    }

    const attachment = attachments[attIdx];
    if (!attachment.s3Key) {
      return errorResponse(res, null, 'Attachment not stored in S3', 404);
    }

    const fileResult = await retrieveFile(attachment.s3Key, {
      protected: attachment.isProtected !== false,
      expiresIn: 3600
    });

    if (!fileResult || !fileResult.signedUrl) {
      return errorResponse(res, null, 'Attachment not available', 404);
    }

    return successResponse(res, {
      url: fileResult.signedUrl,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize
    }, 'Attachment URL generated');
  } catch (err) {
    logger.error('[bienbot] Failed to get attachment URL', { error: err.message, sessionId: id, userId });
    return errorResponse(res, null, 'Failed to get attachment URL', 500);
  }
};

// Exported for testing
exports.parseLLMResponse = parseLLMResponse;

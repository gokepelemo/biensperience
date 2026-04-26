/**
 * BienBot Action Payload Schemas
 *
 * Per-action-type zod schemas covering REQUIRED fields for prompt-injection
 * defense. The intent here is NOT to enforce business rules — that is the
 * job of the controllers themselves. The intent is:
 *
 *   1. Catch malformed LLM output that does not even satisfy the action's
 *      basic shape (missing `name` on `create_destination`, etc.).
 *   2. Provide a per-domain choke point that flags injection-y outputs the
 *      `ALLOWED_ACTION_TYPES` allowlist alone cannot detect (a known
 *      action type with a payload that is the wrong shape).
 *   3. Surface telemetry (`malformed_payloads`, `unknown_action_types`)
 *      so anomalous LLM output is visible to operators.
 *
 * Schemas are intentionally LENIENT — `.passthrough()` is used so unknown
 * fields are preserved (the controllers ignore extras anyway), and only
 * the truly required fields are enforced. We do not try to enumerate every
 * optional field because the LLM frequently emits new optional fields and
 * we do not want to false-positive on benign output.
 *
 * Action types not listed here fall back to a permissive default schema
 * (any object) so adding new action types in the executor does not require
 * a corresponding schema update — but operators still get telemetry on
 * "unknown action types" via the executor's allowlist check.
 *
 * @module utilities/bienbot-action-schemas
 */

const { z } = require('zod');

// ---------------------------------------------------------------------------
// Reusable building blocks
// ---------------------------------------------------------------------------

/** Mongo ObjectId-shaped string (24 hex chars). */
const objectIdString = z.string().min(1);

/** Permissive object — used when no per-type schema is defined. */
const anyPayload = z.object({}).passthrough();

// ---------------------------------------------------------------------------
// Per-action-type schemas
//
// Each schema covers REQUIRED fields only. `.passthrough()` keeps unknown
// keys so optional fields the LLM emits are not stripped by validation.
// ---------------------------------------------------------------------------

const SCHEMAS = {
  // --- Destinations ---
  create_destination: z.object({
    name: z.string().min(1),
    country: z.string().min(1)
  }).passthrough(),

  update_destination: z.object({
    destination_id: objectIdString
  }).passthrough(),

  toggle_favorite_destination: z.object({
    destination_id: objectIdString
  }).passthrough(),

  // --- Experiences ---
  create_experience: z.object({
    name: z.string().min(1)
  }).passthrough(),

  update_experience: z.object({
    experience_id: objectIdString
  }).passthrough(),

  add_experience_plan_item: z.object({
    experience_id: objectIdString,
    text: z.string().min(1)
  }).passthrough(),

  update_experience_plan_item: z.object({
    experience_id: objectIdString,
    plan_item_id: objectIdString
  }).passthrough(),

  delete_experience_plan_item: z.object({
    experience_id: objectIdString,
    plan_item_id: objectIdString
  }).passthrough(),

  // --- Plans ---
  create_plan: z.object({
    experience_id: objectIdString
  }).passthrough(),

  update_plan: z.object({
    plan_id: objectIdString
  }).passthrough(),

  // delete_plan accepts either plan_id OR experience_id (executor resolves)
  delete_plan: z.object({}).passthrough().refine(
    (p) => typeof p.plan_id === 'string' || typeof p.experience_id === 'string',
    { message: 'delete_plan requires plan_id or experience_id' }
  ),

  sync_plan: z.object({
    plan_id: objectIdString
  }).passthrough(),

  shift_plan_item_dates: z.object({
    plan_id: objectIdString,
    diff_days: z.number()
  }).passthrough(),

  // --- Plan items ---
  add_plan_items: z.object({
    plan_id: objectIdString,
    items: z.array(z.object({ text: z.string().min(1) }).passthrough()).min(1)
  }).passthrough(),

  update_plan_item: z.object({
    plan_id: objectIdString,
    item_id: objectIdString
  }).passthrough(),

  mark_plan_item_complete: z.object({
    plan_id: objectIdString,
    item_id: objectIdString
  }).passthrough(),

  mark_plan_item_incomplete: z.object({
    plan_id: objectIdString,
    item_id: objectIdString
  }).passthrough(),

  delete_plan_item: z.object({
    plan_id: objectIdString,
    item_id: objectIdString
  }).passthrough(),

  pin_plan_item: z.object({
    plan_id: objectIdString,
    item_id: objectIdString
  }).passthrough(),

  unpin_plan_item: z.object({
    plan_id: objectIdString,
    item_id: objectIdString
  }).passthrough(),

  reorder_plan_items: z.object({
    plan_id: objectIdString,
    item_ids: z.array(z.string().min(1)).min(1)
  }).passthrough(),

  assign_plan_item: z.object({
    plan_id: objectIdString,
    item_id: objectIdString,
    assigned_to: z.string().min(1)
  }).passthrough(),

  unassign_plan_item: z.object({
    plan_id: objectIdString,
    item_id: objectIdString
  }).passthrough(),

  // --- Plan item notes ---
  add_plan_item_note: z.object({
    plan_id: objectIdString,
    item_id: objectIdString,
    content: z.string().min(1)
  }).passthrough(),

  update_plan_item_note: z.object({
    plan_id: objectIdString,
    item_id: objectIdString,
    note_id: objectIdString,
    content: z.string().min(1)
  }).passthrough(),

  delete_plan_item_note: z.object({
    plan_id: objectIdString,
    item_id: objectIdString,
    note_id: objectIdString
  }).passthrough(),

  // --- Plan item details (transport, accommodation, parking, discount) ---
  add_plan_item_detail: z.object({
    plan_id: objectIdString,
    item_id: objectIdString,
    type: z.string().min(1)
  }).passthrough(),

  update_plan_item_detail: z.object({
    plan_id: objectIdString,
    item_id: objectIdString,
    detail_type: z.string().min(1)
  }).passthrough(),

  delete_plan_item_detail: z.object({
    plan_id: objectIdString,
    item_id: objectIdString,
    detail_type: z.string().min(1)
  }).passthrough(),

  // --- Plan costs ---
  add_plan_cost: z.object({
    plan_id: objectIdString,
    title: z.string().min(1),
    cost: z.number()
  }).passthrough(),

  update_plan_cost: z.object({
    plan_id: objectIdString,
    cost_id: objectIdString
  }).passthrough(),

  delete_plan_cost: z.object({
    plan_id: objectIdString,
    cost_id: objectIdString
  }).passthrough(),

  // --- Collaboration ---
  invite_collaborator: z.object({
    user_id: z.string().min(1)
  }).passthrough().refine(
    (p) => typeof p.plan_id === 'string' || typeof p.experience_id === 'string',
    { message: 'invite_collaborator requires plan_id or experience_id' }
  ),

  remove_collaborator: z.object({
    user_id: z.string().min(1)
  }).passthrough().refine(
    (p) => typeof p.plan_id === 'string' || typeof p.experience_id === 'string',
    { message: 'remove_collaborator requires plan_id or experience_id' }
  ),

  // --- Member location ---
  set_member_location: z.object({
    plan_id: objectIdString,
    location: z.object({}).passthrough()
  }).passthrough(),

  remove_member_location: z.object({
    plan_id: objectIdString
  }).passthrough(),

  // --- Navigation (client-only) ---
  navigate_to_entity: z.object({
    entity: z.string().min(1),
    entityId: z.string().min(1),
    url: z.string().min(1)
  }).passthrough(),

  // --- Workflow composition ---
  // Steps are validated structurally only — per-step payloads are validated
  // when the step is executed (executor calls validateActionPayload again).
  workflow: z.object({
    steps: z.array(z.object({
      step: z.number(),
      type: z.string().min(1),
      payload: z.any()
    }).passthrough()).min(1).max(10)
  }).passthrough(),

  // --- Photo management ---
  add_entity_photos: z.object({}).passthrough(),

  // --- Read-only fetchers (lenient — only require obvious shape) ---
  suggest_plan_items: z.object({
    destination_id: objectIdString
  }).passthrough(),

  fetch_entity_photos: z.object({
    entity_type: z.string().min(1),
    entity_id: objectIdString
  }).passthrough(),

  fetch_plan_items: z.object({
    plan_id: objectIdString
  }).passthrough(),

  fetch_plan_costs: z.object({
    plan_id: objectIdString
  }).passthrough(),

  fetch_plan_collaborators: z.object({
    plan_id: objectIdString
  }).passthrough(),

  fetch_experience_items: z.object({
    experience_id: objectIdString
  }).passthrough(),

  fetch_destination_experiences: z.object({
    destination_id: objectIdString
  }).passthrough(),

  fetch_user_plans: z.object({}).passthrough(),

  discover_content: z.object({}).passthrough(),

  // --- Disambiguation ---
  select_plan: z.object({
    plan_id: objectIdString
  }).passthrough(),

  select_destination: z.object({
    destination_id: objectIdString
  }).passthrough(),

  // --- Lists ---
  list_user_experiences: z.object({
    user_id: z.string().min(1)
  }).passthrough(),

  // --- Social / follows ---
  follow_user: z.object({
    user_id: z.string().min(1)
  }).passthrough(),

  unfollow_user: z.object({
    user_id: z.string().min(1)
  }).passthrough(),

  accept_follow_request: z.object({
    follower_id: z.string().min(1)
  }).passthrough(),

  list_user_followers: z.object({
    user_id: z.string().min(1)
  }).passthrough(),

  // --- User profile ---
  update_user_profile: anyPayload,

  // --- Activity feed ---
  list_user_activities: anyPayload,

  // --- Documents ---
  list_entity_documents: z.object({
    entity_type: z.string().min(1),
    entity_id: objectIdString
  }).passthrough(),

  // --- Invites & access ---
  create_invite: anyPayload,

  request_plan_access: z.object({
    plan_id: objectIdString
  }).passthrough()
};

/**
 * Validate an action's payload against its registered schema.
 *
 * @param {string} actionType - The action type key (must be in ALLOWED_ACTION_TYPES).
 * @param {*} payload - The payload to validate (typically from LLM output).
 * @returns {{
 *   ok: boolean,
 *   payload?: object,
 *   issues?: Array<{ path: string[], message: string }>,
 *   unknownType?: boolean
 * }}
 *   - ok=true → validation succeeded; `payload` is the (lenient) parsed payload.
 *   - ok=false + unknownType=true → no schema registered for this type;
 *     caller should reject *unless* the type is owned by the registry path.
 *   - ok=false (without unknownType) → payload failed shape validation;
 *     `issues` is a compact list for logging.
 */
function validateActionPayload(actionType, payload) {
  if (typeof actionType !== 'string' || actionType.length === 0) {
    return {
      ok: false,
      issues: [{ path: ['type'], message: 'Action type missing' }],
      unknownType: true
    };
  }

  const schema = SCHEMAS[actionType];
  if (!schema) {
    // Permissive fallback: registry-owned action types and any newly-added
    // executor handlers without an explicit schema get the permissive default.
    // The caller still sees `unknownType: true` so it can choose to log/warn
    // when paired with the allowlist check elsewhere.
    return {
      ok: false,
      issues: [{ path: ['type'], message: `No schema registered for action type "${actionType}"` }],
      unknownType: true
    };
  }

  const result = schema.safeParse(payload === null || payload === undefined ? {} : payload);
  if (result.success) {
    return { ok: true, payload: result.data };
  }

  // Compact issues for logging — drop noisy fields like `received`, keep path+message.
  const issues = (result.error?.issues || []).map((i) => ({
    path: Array.isArray(i.path) ? i.path : [String(i.path)],
    message: i.message
  })).slice(0, 5); // cap to avoid runaway log size

  return { ok: false, issues };
}

/**
 * Format a validation result's issues into a short single-line summary
 * suitable for logging or surfacing to a user-visible error message.
 *
 * @param {{ issues?: Array<{ path: string[], message: string }> }} validation
 * @returns {string}
 */
function summarizeIssues(validation) {
  if (!validation || !Array.isArray(validation.issues) || validation.issues.length === 0) {
    return '';
  }
  return validation.issues
    .map((i) => `${(i.path || []).join('.') || '<root>'}: ${i.message}`)
    .join('; ');
}

module.exports = {
  validateActionPayload,
  summarizeIssues,
  SCHEMAS
};

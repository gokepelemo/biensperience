/**
 * Navigation Context Schema
 *
 * A lean breadcrumb of entity IDs + labels representing the user's current
 * navigation path: Destination → Experience → Plan → Plan Item.
 *
 * PURPOSE: This schema is built on the frontend as the user navigates, then
 * sent alongside the first BienBot message so the backend can immediately:
 *
 *   1. Seed session.context with ALL ancestor IDs (destination_id, experience_id,
 *      plan_id, plan_item_id) — no LLM round-trip needed to discover them.
 *   2. Fire all relevant context builders (buildDestinationContext,
 *      buildExperienceContext, buildUserPlanContext) in parallel from message 1,
 *      since every ancestor ID is already known.
 *   3. Skip the DB lookup for parent plan ID when invoked from a plan_item
 *      (plan_item.plan_id is already embedded).
 *
 * The builders still query MongoDB asynchronously — this schema does NOT cache
 * entity data. It only carries the minimal IDs and labels needed to wire up
 * context calls and pre-populate session context without a first-turn round trip.
 *
 * Schema shape (each layer is null when that entity has not been visited):
 * {
 *   breadcrumb: ['destination', 'experience', 'plan'],  // ordered active layers
 *   destination: { _id, name, country? },
 *   experience:  { _id, name, destination_id? },
 *   plan:        { _id, experience_id?, planned_date?, completion? },
 *   plan_item:   { _id, content?, plan_id? },
 * }
 *
 * @module utilities/navigation-context-schema
 */

/** Hierarchy order — also defines which layers are descendants of a given layer. */
export const NAVIGATION_LAYERS = ['destination', 'experience', 'plan', 'plan_item'];

// ---------------------------------------------------------------------------
// Layer builders — extract only the fields the backend needs
// ---------------------------------------------------------------------------

/**
 * Build a destination layer entry.
 * @param {Object} dest - Destination document (from DataContext or API fetch)
 * @returns {{ _id: string, name: string, country?: string }|null}
 */
export function buildDestinationLayer(dest) {
  if (!dest?._id) return null;
  const layer = { _id: String(dest._id), name: dest.name || null };
  if (dest.country) layer.country = dest.country;
  return layer;
}

/**
 * Build an experience layer entry.
 * @param {Object} exp - Experience document
 * @returns {{ _id: string, name: string, destination_id?: string }|null}
 */
export function buildExperienceLayer(exp) {
  if (!exp?._id) return null;
  const layer = { _id: String(exp._id), name: exp.name || null };
  // Carry destination_id for ancestor chain — backend uses this to seed session.context
  const destId = exp.destination?._id ?? exp.destination ?? null;
  if (destId) layer.destination_id = String(destId);
  return layer;
}

/**
 * Build a plan layer entry.
 * @param {Object} plan - Plan document (from usePlanManagement)
 * @returns {{ _id: string, experience_id?: string, planned_date?: string, completion?: Object }|null}
 */
export function buildPlanLayer(plan) {
  if (!plan?._id) return null;
  const layer = { _id: String(plan._id) };
  // Carry experience_id for ancestor chain
  const expId = plan.experience?._id ?? plan.experience ?? null;
  if (expId) layer.experience_id = String(expId);
  if (plan.planned_date) {
    layer.planned_date = new Date(plan.planned_date).toISOString().split('T')[0];
  }
  // Lightweight completion summary so BienBot can say "you're 3/8 done" immediately
  const items = Array.isArray(plan.plan) ? plan.plan : [];
  if (items.length > 0) {
    const completed = items.filter(i => i.complete).length;
    layer.completion = { completed, total: items.length };
  }
  return layer;
}

/**
 * Build a plan_item layer entry.
 * @param {Object} item - Plan item subdocument
 * @param {string} [parentPlanId] - The plan _id that owns this item
 * @returns {{ _id: string, content?: string, plan_id?: string }|null}
 */
export function buildPlanItemLayer(item, parentPlanId) {
  if (!item?._id) return null;
  const layer = { _id: String(item._id) };
  const label = item.content || item.text || item.name;
  if (label) layer.content = label;
  // Carry plan_id so backend skips the DB lookup for parent plan
  if (parentPlanId) layer.plan_id = String(parentPlanId);
  return layer;
}

// ---------------------------------------------------------------------------
// Schema composition
// ---------------------------------------------------------------------------

/**
 * Return the ordered list of layers that are currently populated.
 * @param {Object} schema
 * @returns {string[]}
 */
export function getBreadcrumb(schema) {
  if (!schema) return [];
  return NAVIGATION_LAYERS.filter(l => schema[l] != null);
}

/**
 * Compose the full navigation schema from raw layer state, adding a
 * computed breadcrumb array.
 *
 * @param {{ destination, experience, plan, plan_item }} state
 * @returns {Object}
 */
export function composeNavigationSchema(state) {
  const schema = {
    destination: state.destination || null,
    experience:  state.experience  || null,
    plan:        state.plan        || null,
    plan_item:   state.plan_item   || null,
  };
  schema.breadcrumb = getBreadcrumb(schema);
  return schema;
}

// ---------------------------------------------------------------------------
// Backend helpers — used by controller and context builders
// ---------------------------------------------------------------------------

/**
 * Extract the full set of context IDs from a navigation schema.
 * The returned object can be passed directly to session.updateContext().
 *
 * Ancestor IDs are resolved transitively: if the schema has plan but no
 * explicit experience layer, the plan.experience_id fills the gap.
 *
 * @param {Object} schema - Navigation schema sent from the frontend
 * @returns {{ destination_id?, experience_id?, plan_id?, plan_item_id? }}
 */
export function extractContextIds(schema) {
  if (!schema) return {};
  const ids = {};

  if (schema.destination?._id) {
    ids.destination_id = schema.destination._id;
  }

  if (schema.experience?._id) {
    ids.experience_id = schema.experience._id;
    if (schema.experience.destination_id && !ids.destination_id) {
      ids.destination_id = schema.experience.destination_id;
    }
  }

  if (schema.plan?._id) {
    ids.plan_id = schema.plan._id;
    if (schema.plan.experience_id && !ids.experience_id) {
      ids.experience_id = schema.plan.experience_id;
    }
  }

  if (schema.plan_item?._id) {
    ids.plan_item_id = schema.plan_item._id;
    if (schema.plan_item.plan_id && !ids.plan_id) {
      ids.plan_id = schema.plan_item.plan_id;
    }
  }

  return ids;
}

/**
 * Return true if `layer` is a descendant of `ancestor` in the hierarchy.
 * Used to determine which layers to auto-clear when an ancestor changes.
 *
 * @param {string} ancestor - e.g. 'experience'
 * @param {string} layer    - e.g. 'plan'
 * @returns {boolean}
 */
export function isDescendant(ancestor, layer) {
  return (
    NAVIGATION_LAYERS.indexOf(ancestor) >= 0 &&
    NAVIGATION_LAYERS.indexOf(layer) > NAVIGATION_LAYERS.indexOf(ancestor)
  );
}

/**
 * Validate a navigation schema object coming from an untrusted client.
 * Returns { valid: boolean, schema: sanitized object | null, error?: string }.
 *
 * @param {*} raw - Parsed JSON from req.body
 * @returns {{ valid: boolean, schema: Object|null, error?: string }}
 */
export function validateNavigationSchema(raw) {
  if (!raw || typeof raw !== 'object') return { valid: false, schema: null };

  const MONGO_ID_RE = /^[a-f0-9]{24}$/i;
  const sanitized = {};

  for (const layer of NAVIGATION_LAYERS) {
    const val = raw[layer];
    if (!val || typeof val !== 'object') {
      sanitized[layer] = null;
      continue;
    }
    if (!val._id || !MONGO_ID_RE.test(String(val._id))) {
      sanitized[layer] = null;
      continue;
    }
    // Accept only the fields each layer is expected to carry
    const entry = { _id: String(val._id) };
    if (val.name && typeof val.name === 'string') entry.name = val.name.slice(0, 200);
    if (layer === 'destination' && val.country && typeof val.country === 'string') {
      entry.country = val.country.slice(0, 100);
    }
    if (layer === 'experience' && val.destination_id && MONGO_ID_RE.test(String(val.destination_id))) {
      entry.destination_id = String(val.destination_id);
    }
    if (layer === 'plan') {
      if (val.experience_id && MONGO_ID_RE.test(String(val.experience_id))) {
        entry.experience_id = String(val.experience_id);
      }
      if (val.planned_date && typeof val.planned_date === 'string') {
        entry.planned_date = val.planned_date.slice(0, 10);
      }
      if (val.completion && typeof val.completion === 'object') {
        const { completed, total } = val.completion;
        if (Number.isFinite(completed) && Number.isFinite(total) && total >= 0) {
          entry.completion = { completed: Math.max(0, completed), total: Math.max(0, total) };
        }
      }
    }
    if (layer === 'plan_item') {
      if (val.content && typeof val.content === 'string') entry.content = val.content.slice(0, 200);
      if (val.plan_id && MONGO_ID_RE.test(String(val.plan_id))) {
        entry.plan_id = String(val.plan_id);
      }
    }
    sanitized[layer] = entry;
  }

  sanitized.breadcrumb = NAVIGATION_LAYERS.filter(l => sanitized[l] != null);
  return { valid: true, schema: sanitized };
}

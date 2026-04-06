/**
 * Navigation Context Schema — backend (CJS) utilities.
 *
 * Mirrors the key helpers from src/utilities/navigation-context-schema.js
 * for use in the BienBot controller (CJS module context).
 *
 * PURPOSE: Validate and extract context IDs from the lean breadcrumb
 * schema sent by the frontend with the first BienBot message.  This
 * allows the controller to:
 *
 *   1. Seed session.context with ALL ancestor IDs immediately (instead
 *      of just the directly invoked entity).
 *   2. Pass supplementary IDs to buildContextBlocks so every applicable
 *      context builder fires in parallel from message 1.
 *   3. Provide the parent plan_id for plan_item invocations so the
 *      context builder can skip an extra DB lookup.
 *
 * The builders still query MongoDB — this module only handles IDs/labels.
 *
 * @module utilities/navigation-context-schema
 */

'use strict';

const NAVIGATION_LAYERS = ['destination', 'experience', 'plan', 'plan_item'];
const MONGO_ID_RE = /^[a-f0-9]{24}$/i;

/**
 * Validate a navigation schema object coming from an untrusted client.
 * Returns { valid: boolean, schema: sanitized object | null, error?: string }.
 *
 * @param {*} raw - Parsed JSON from req.body (may already be an object if JSON body,
 *                  or a string if multipart form data — caller must pre-parse).
 * @returns {{ valid: boolean, schema: Object|null, error?: string }}
 */
function validateNavigationSchema(raw) {
  if (!raw || typeof raw !== 'object') return { valid: false, schema: null };

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

/**
 * Extract the full set of context IDs from a validated navigation schema.
 * The returned object can be passed directly to session.updateContext().
 *
 * Ancestor IDs are resolved transitively: if the schema has `plan` but no
 * explicit `experience` layer, plan.experience_id fills the gap; same for
 * experience.destination_id.
 *
 * @param {Object} schema - Sanitized schema from validateNavigationSchema()
 * @returns {{ destination_id?: string, experience_id?: string, plan_id?: string, plan_item_id?: string }}
 */
function extractContextIds(schema) {
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

module.exports = { validateNavigationSchema, extractContextIds };

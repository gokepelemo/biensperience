/**
 * navigation-context-schema.js — Backend validation and ID extraction for the
 * navigationSchema breadcrumb sent by the frontend.
 *
 * The schema is a lean map keyed by entity type:
 * {
 *   destination: { _id },
 *   experience:  { _id, destination },
 *   plan:        { _id, experience },
 *   plan_item:   { _id, plan_id }
 * }
 */

'use strict';

const ENTITY_TYPES = ['destination', 'experience', 'plan', 'plan_item'];
const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

/**
 * Validate and sanitise a navigation schema received from the client.
 * Returns { valid: boolean, schema: object|null }.
 */
function validateNavigationSchema(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, schema: null };
  }

  const schema = {};
  let hasEntry = false;

  for (const type of ENTITY_TYPES) {
    const entry = raw[type];
    if (!entry || typeof entry !== 'object') continue;
    if (typeof entry._id !== 'string' || !OBJECT_ID_RE.test(entry._id)) continue;

    const clean = { _id: entry._id };

    // Copy known relational fields (all optional, all must be valid ObjectId strings)
    if (type === 'experience' && typeof entry.destination === 'string' && OBJECT_ID_RE.test(entry.destination)) {
      clean.destination = entry.destination;
    }
    if (type === 'plan' && typeof entry.experience === 'string' && OBJECT_ID_RE.test(entry.experience)) {
      clean.experience = entry.experience;
    }
    if (type === 'plan_item' && typeof entry.plan_id === 'string' && OBJECT_ID_RE.test(entry.plan_id)) {
      clean.plan_id = entry.plan_id;
    }

    // Optional name (capped to 200 chars, not trusted for display)
    if (typeof entry.name === 'string') {
      clean.name = entry.name.slice(0, 200);
    }

    schema[type] = clean;
    hasEntry = true;
  }

  return { valid: hasEntry, schema: hasEntry ? schema : null };
}

/**
 * Extract flat context IDs from a validated navigation schema.
 * Returns an object like { destination_id, experience_id, plan_id, plan_item_id }.
 * Only includes keys that are present.
 */
function extractContextIds(schema) {
  if (!schema || typeof schema !== 'object') return {};

  const ids = {};

  if (schema.destination?._id) {
    ids.destination_id = schema.destination._id;
  }

  if (schema.experience?._id) {
    ids.experience_id = schema.experience._id;
    // Backfill destination from experience's parent if not already set
    if (!ids.destination_id && schema.experience.destination) {
      ids.destination_id = schema.experience.destination;
    }
  }

  if (schema.plan?._id) {
    ids.plan_id = schema.plan._id;
    // Backfill experience from plan's parent if not already set
    if (!ids.experience_id && schema.plan.experience) {
      ids.experience_id = schema.plan.experience;
    }
  }

  if (schema.plan_item?._id) {
    ids.plan_item_id = schema.plan_item._id;
    // Backfill plan from plan_item's parent if not already set
    if (!ids.plan_id && schema.plan_item.plan_id) {
      ids.plan_id = schema.plan_item.plan_id;
    }
  }

  return ids;
}

module.exports = { validateNavigationSchema, extractContextIds };

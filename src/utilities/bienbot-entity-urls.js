/**
 * Build a URL for a BienBot entity reference.
 *
 * @param {Object} ref - Entity ref ({ type, _id, experience_id?, plan_id? })
 * @returns {string|null} URL or null if the ref is missing required fields.
 */
export function getEntityUrl(ref) {
  if (!ref || !ref._id || !ref.type) return null;
  switch (ref.type) {
    case 'destination':
      return `/destinations/${ref._id}`;
    case 'experience':
      return `/experiences/${ref._id}`;
    case 'plan':
      return ref.experience_id
        ? `/experiences/${ref.experience_id}#plan-${ref._id}`
        : null;
    case 'plan_item':
      return ref.experience_id && ref.plan_id
        ? `/experiences/${ref.experience_id}#plan-${ref.plan_id}-item-${ref._id}`
        : null;
    default:
      return null;
  }
}

/**
 * Build a hash-routed plan URL from a plan entity, optionally deep-linking to an item.
 * Used by post-action navigation in bienbot-suggestions.js.
 *
 * @param {Object} planEntity - Plan entity with `_id` and `experience` fields
 * @param {string} [itemId] - Optional item ID for deep linking
 * @returns {string|null}
 */
export function planHashUrl(planEntity, itemId) {
  const expId = planEntity?.experience?._id || planEntity?.experience;
  const planId = planEntity?._id;
  if (!expId || !planId) return null;
  const base = `/experiences/${expId}#plan-${planId}`;
  return itemId ? `${base}-item-${itemId}` : base;
}

/**
 * BienBot Context Builders
 *
 * One builder per entity type, each querying MongoDB and returning a concise
 * text block for the LLM prompt. Every builder respects PermissionEnforcer
 * canView() and returns null when the user has no access.
 *
 * @module utilities/bienbot-context-builders
 */

const logger = require('./backend-logger');
const { getEnforcer } = require('./permission-enforcer');
const { validateObjectId } = require('./controller-helpers');
const { findSimilarItems } = require('./fuzzy-match');

// Lazy-loaded models (resolved on first use)
let Destination, Experience, Plan, User;

function loadModels() {
  if (!Destination) {
    Destination = require('../models/destination');
    Experience = require('../models/experience');
    Plan = require('../models/plan');
    User = require('../models/user');
  }
}

/**
 * Rough token estimate: ~4 chars per token for English text.
 */
const CHARS_PER_TOKEN = 4;
const DEFAULT_TOKEN_BUDGET = 1500;

function trimToTokenBudget(text, tokenBudget = DEFAULT_TOKEN_BUDGET) {
  const maxChars = tokenBudget * CHARS_PER_TOKEN;
  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars - 3) + '...';
}

// ---------------------------------------------------------------------------
// Individual builders
// ---------------------------------------------------------------------------

/**
 * Build context block for a Destination.
 * @param {string} destinationId
 * @param {string} userId
 * @param {object} [options]
 * @param {number} [options.tokenBudget]
 * @returns {Promise<string|null>}
 */
async function buildDestinationContext(destinationId, userId, options = {}) {
  loadModels();
  const enforcer = getEnforcer({ Destination, Experience, Plan, User });

  try {
    const destination = await Destination.findById(destinationId).lean();
    if (!destination) return null;

    const perm = await enforcer.canView({ userId, resource: destination });
    if (!perm.allowed) return null;

    const lines = [
      `[Destination] ${destination.name}`,
      destination.country ? `Country: ${destination.country}` : null,
      destination.state ? `State/Region: ${destination.state}` : null,
      destination.overview ? `Overview: ${destination.overview}` : null,
      destination.location?.city ? `City: ${destination.location.city}` : null,
      destination.travel_tips?.length
        ? `Travel tips: ${destination.travel_tips.slice(0, 5).map(t => typeof t === 'string' ? t : t.value || '').join('; ')}`
        : null,
      destination.visibility ? `Visibility: ${destination.visibility}` : null
    ];

    return trimToTokenBudget(lines.filter(Boolean).join('\n'), options.tokenBudget || DEFAULT_TOKEN_BUDGET);
  } catch (err) {
    logger.error('[bienbot-context] buildDestinationContext failed', { destinationId, error: err.message });
    return null;
  }
}

/**
 * Build context block for an Experience.
 */
async function buildExperienceContext(experienceId, userId, options = {}) {
  loadModels();
  const enforcer = getEnforcer({ Destination, Experience, Plan, User });

  try {
    const experience = await Experience.findById(experienceId).populate('destination', 'name country').lean();
    if (!experience) return null;

    const perm = await enforcer.canView({ userId, resource: experience });
    if (!perm.allowed) return null;

    const itemCount = experience.plan_items?.length || 0;
    const completedCount = experience.plan_items?.filter(i => i.completed).length || 0;

    const lines = [
      `[Experience] ${experience.name}`,
      experience.destination?.name ? `Destination: ${experience.destination.name}` : null,
      experience.overview ? `Overview: ${experience.overview}` : null,
      experience.experience_type?.length ? `Types: ${experience.experience_type.join(', ')}` : null,
      `Plan items: ${itemCount} total, ${completedCount} completed`,
      experience.difficulty ? `Difficulty: ${experience.difficulty}/10` : null,
      experience.rating ? `Rating: ${experience.rating}/5` : null,
      experience.visibility ? `Visibility: ${experience.visibility}` : null,
      itemCount > 0 ? `Items: ${experience.plan_items.slice(0, 10).map(i => i.content || i.name || '(unnamed)').join(', ')}` : null
    ];

    return trimToTokenBudget(lines.filter(Boolean).join('\n'), options.tokenBudget || DEFAULT_TOKEN_BUDGET);
  } catch (err) {
    logger.error('[bienbot-context] buildExperienceContext failed', { experienceId, error: err.message });
    return null;
  }
}

/**
 * Build context block for a user's Plan of an experience.
 */
async function buildUserPlanContext(planId, userId, options = {}) {
  loadModels();
  const enforcer = getEnforcer({ Destination, Experience, Plan, User });

  try {
    const plan = await Plan.findById(planId)
      .populate('experience', 'name')
      .lean();
    if (!plan) return null;

    const perm = await enforcer.canView({ userId, resource: plan });
    if (!perm.allowed) return null;

    const totalItems = plan.plan?.length || 0;
    const completedItems = plan.plan?.filter(i => i.complete).length || 0;
    const completionPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    const lines = [
      `[Plan] for experience "${plan.experience?.name || '(unknown)'}"`,
      plan.planned_date ? `Planned date: ${new Date(plan.planned_date).toISOString().split('T')[0]}` : null,
      `Completion: ${completedItems}/${totalItems} items (${completionPct}%)`,
      plan.currency ? `Currency: ${plan.currency}` : null,
      plan.costs?.length ? `Costs tracked: ${plan.costs.length}` : null,
      totalItems > 0 ? `Items: ${plan.plan.slice(0, 10).map(i => `${i.complete ? '[x]' : '[ ]'} ${i.content || i.name || '(unnamed)'}`).join(', ')}` : null
    ];

    return trimToTokenBudget(lines.filter(Boolean).join('\n'), options.tokenBudget || DEFAULT_TOKEN_BUDGET);
  } catch (err) {
    logger.error('[bienbot-context] buildUserPlanContext failed', { planId, error: err.message });
    return null;
  }
}

/**
 * Build context block for a specific Plan Item within a plan.
 */
async function buildPlanItemContext(planId, itemId, userId, options = {}) {
  loadModels();
  const enforcer = getEnforcer({ Destination, Experience, Plan, User });

  try {
    const plan = await Plan.findById(planId)
      .populate('experience', 'name')
      .lean();
    if (!plan) return null;

    const perm = await enforcer.canView({ userId, resource: plan });
    if (!perm.allowed) return null;

    const itemIdStr = String(itemId);
    const item = plan.plan?.find(i => String(i._id) === itemIdStr);
    if (!item) return null;

    const lines = [
      `[Plan Item] ${item.content || item.name || '(unnamed)'}`,
      `Plan: "${plan.experience?.name || '(unknown)'}"`,
      `Status: ${item.complete ? 'completed' : 'pending'}`,
      item.scheduled_date ? `Scheduled: ${new Date(item.scheduled_date).toISOString().split('T')[0]}` : null,
      item.notes?.length ? `Notes: ${item.notes.length}` : null,
      item.details?.length ? `Details: ${item.details.length}` : null,
      item.cost_estimate ? `Cost estimate: ${item.cost_estimate}` : null
    ];

    return trimToTokenBudget(lines.filter(Boolean).join('\n'), options.tokenBudget || DEFAULT_TOKEN_BUDGET);
  } catch (err) {
    logger.error('[bienbot-context] buildPlanItemContext failed', { planId, itemId, error: err.message });
    return null;
  }
}

/**
 * Build context block for a User profile.
 */
async function buildUserProfileContext(targetUserId, requestingUserId, options = {}) {
  loadModels();

  try {
    const user = await User.findById(targetUserId)
      .select('name email preferences bio links feature_flags')
      .lean();
    if (!user) return null;

    const lines = [
      `[User] ${user.name || '(unnamed)'}`,
      user.email ? `Email: ${user.email}` : null,
      user.bio ? `Bio: ${user.bio}` : null,
      user.preferences?.currency ? `Currency: ${user.preferences.currency}` : null,
      user.preferences?.timezone ? `Timezone: ${user.preferences.timezone}` : null,
      user.links?.length ? `Links: ${user.links.map(l => l.title || l.url).join(', ')}` : null
    ];

    return trimToTokenBudget(lines.filter(Boolean).join('\n'), options.tokenBudget || DEFAULT_TOKEN_BUDGET);
  } catch (err) {
    logger.error('[bienbot-context] buildUserProfileContext failed', { targetUserId, error: err.message });
    return null;
  }
}

/**
 * Build context block from a search query using fuzzy matching.
 */
async function buildSearchContext(query, userId, options = {}) {
  loadModels();

  if (!query || typeof query !== 'string' || query.trim().length === 0) return null;

  try {
    const trimmedQuery = query.trim();

    // Search destinations and experiences in parallel
    const [destinations, experiences] = await Promise.all([
      Destination.find({ visibility: 'public' }).select('name country overview').limit(100).lean(),
      Experience.find({ visibility: 'public' }).select('name overview destination').populate('destination', 'name').limit(100).lean()
    ]);

    const matchedDestinations = findSimilarItems(destinations, trimmedQuery, 'name', 60);
    const matchedExperiences = findSimilarItems(experiences, trimmedQuery, 'name', 60);

    if (matchedDestinations.length === 0 && matchedExperiences.length === 0) {
      return null;
    }

    const lines = [`[Search Results] for "${trimmedQuery}"`];

    if (matchedDestinations.length > 0) {
      lines.push('Destinations:');
      matchedDestinations.slice(0, 5).forEach(d => {
        lines.push(`  - ${d.name}${d.country ? ` (${d.country})` : ''}`);
      });
    }

    if (matchedExperiences.length > 0) {
      lines.push('Experiences:');
      matchedExperiences.slice(0, 5).forEach(e => {
        lines.push(`  - ${e.name}${e.destination?.name ? ` at ${e.destination.name}` : ''}`);
      });
    }

    return trimToTokenBudget(lines.join('\n'), options.tokenBudget || DEFAULT_TOKEN_BUDGET);
  } catch (err) {
    logger.error('[bienbot-context] buildSearchContext failed', { query, error: err.message });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

/**
 * Dispatch to the appropriate builder based on invokeContext.entity.
 *
 * @param {object|null} invokeContext - { entity, entity_id, entity_label }
 * @param {string} userId - Requesting user's ID.
 * @param {object} [options] - Passed through to the builder.
 * @returns {Promise<string|null>}
 */
async function buildContextForInvokeContext(invokeContext, userId, options = {}) {
  if (!invokeContext || !invokeContext.entity || !invokeContext.entity_id) {
    return null;
  }

  const { valid } = validateObjectId(invokeContext.entity_id, 'invokeContext.entity_id');
  if (!valid) {
    logger.warn('[bienbot-context] Invalid entity_id in invokeContext', { invokeContext });
    return null;
  }

  const id = invokeContext.entity_id;

  switch (invokeContext.entity) {
    case 'destination':
      return buildDestinationContext(id, userId, options);
    case 'experience':
      return buildExperienceContext(id, userId, options);
    case 'plan':
      return buildUserPlanContext(id, userId, options);
    case 'plan_item': {
      // For plan_item, we need the parent plan ID from the session context.
      // The caller should provide options.planId.
      if (!options.planId) {
        logger.warn('[bienbot-context] plan_item context requires options.planId');
        return null;
      }
      return buildPlanItemContext(options.planId, id, userId, options);
    }
    case 'user':
      return buildUserProfileContext(id, userId, options);
    default:
      logger.warn('[bienbot-context] Unknown entity type in invokeContext', { entity: invokeContext.entity });
      return null;
  }
}

module.exports = {
  buildDestinationContext,
  buildExperienceContext,
  buildUserPlanContext,
  buildPlanItemContext,
  buildUserProfileContext,
  buildSearchContext,
  buildContextForInvokeContext
};

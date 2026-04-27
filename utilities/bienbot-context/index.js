/**
 * BienBot Context — public entry point
 *
 * Re-exports every entity context builder + the dispatcher
 * `buildContextForInvokeContext`. Also hosts the two non-entity helpers
 * (`buildSearchContext`, `buildSuggestionContext`) that don't belong to a
 * single entity, plus the `appendAffinityBlock` enrichment used by the
 * dispatcher.
 *
 * Behaviour is unchanged from the pre-split utilities/bienbot-context-builders.js;
 * the original file remains as a thin façade re-exporting from this module.
 *
 * @module utilities/bienbot-context
 */

const logger = require('../backend-logger');
const { validateObjectId } = require('../controller-helpers');
const { findSimilarItems } = require('../fuzzy-match');
const affinityCache = require('../affinity-cache');
const {
  buildDiscoveryContext,
  buildSimilarExperiencesContext,
  formatDiscoveryContextBlock,
  SEMANTIC_ACTIVITY_MAP,
  describeDimDrivers,
  expandActivityTypes,
  computeAdaptiveWeights,
  computeCostAlignment,
  normalizeCostToPercentile,
  computeRecencyScore,
  normalizeCount,
  generateMatchReason,
  findSimilarUsers,
  findCoOccurringExperiences,
  findPopularExperiences
} = require('../bienbot-discovery');

const {
  loadModels,
  getModels,
  trimToTokenBudget,
  DEFAULT_TOKEN_BUDGET,
  buildDisambiguationBlock,
  buildInlineDetailSummary,
  renderAttentionBlock,
  computePlanProximityTag,
  formatSignalBlock,
} = require('./_shared');

const { buildDestinationContext } = require('./destination-context');
const { buildExperienceContext } = require('./experience-context');
const { buildUserPlanContext, buildPlanNextStepsContext } = require('./plan-context');
const { buildPlanItemContext } = require('./plan-item-context');
const { buildUserProfileContext, buildUserGreetingContext } = require('./user-context');

/**
 * Build context block from a search query using fuzzy matching.
 */
async function buildSearchContext(query, userId, options = {}) {
  loadModels();
  const { Destination, Experience, Plan } = getModels();

  if (!query || typeof query !== 'string' || query.trim().length === 0) return null;

  try {
    const trimmedQuery = query.trim();

    // Build a broad name-match regex from query words to push filtering into MongoDB.
    // findSimilarItems still applies fuzzy scoring on the returned subset.
    const escapedWords = trimmedQuery
      .split(/\s+/)
      .filter(w => w.length >= 2)
      .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const nameRegex = escapedWords.length > 0
      ? new RegExp(escapedWords.join('|'), 'i')
      : new RegExp(trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const [destinations, experiences, userPlans] = await Promise.all([
      Destination.find({
        visibility: 'public',
        $or: [{ name: { $regex: nameRegex } }, { country: { $regex: nameRegex } }]
      }).select('name country overview').limit(30).lean(),
      Experience.find({
        visibility: 'public',
        name: { $regex: nameRegex }
      }).select('name overview destination').populate('destination', 'name').limit(30).lean(),
      userId
        ? Plan.find({ user: userId })
            .populate({ path: 'experience', select: 'name destination', populate: { path: 'destination', select: 'name' } })
            .select('experience planned_date plan')
            .lean()
        : Promise.resolve([])
    ]);

    const matchedDestinations = findSimilarItems(destinations, trimmedQuery, 'name', 60);
    const matchedExperiences = findSimilarItems(experiences, trimmedQuery, 'name', 60);

    // Match user plans by experience name or destination name.
    // Uses two complementary strategies so both short queries ("Tokyo") and long
    // user messages ("Share the Tokyo temple tour plan's exact name...") match:
    //   1. Substring containment — either direction
    //   2. Query-side word overlap — ≥50% of query words appear in entity name
    //   3. Entity-side word overlap — ≥60% of entity name words appear in query
    //      (handles long queries where the entity name is only a small portion)
    const queryLower = trimmedQuery.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
    const matchedPlans = (userPlans || []).filter(p => {
      const expName = (p.experience?.name || '').toLowerCase();
      const destName = (p.experience?.destination?.name || '').toLowerCase();
      // Substring match: query contains the name or name contains the query
      if (expName && (expName.includes(queryLower) || queryLower.includes(expName))) return true;
      if (destName && (destName.includes(queryLower) || queryLower.includes(destName))) return true;
      const combined = `${expName} ${destName}`;
      if (queryWords.length >= 2) {
        // Query-side: most query words appear in the combined entity name
        const queryMatchCount = queryWords.filter(w => combined.includes(w)).length;
        if (queryMatchCount >= Math.ceil(queryWords.length * 0.5)) return true;
        // Entity-side: most entity name words appear in the query (handles long messages)
        const entityWords = combined.split(/\s+/).filter(w => w.length > 2);
        if (entityWords.length >= 2) {
          const entityMatchCount = entityWords.filter(w => queryLower.includes(w)).length;
          if (entityMatchCount >= Math.ceil(entityWords.length * 0.5)) return true;
        }
      }
      return false;
    });

    if (matchedDestinations.length === 0 && matchedExperiences.length === 0 && matchedPlans.length === 0) {
      return null;
    }

    const lines = [`[Search Results] for "${trimmedQuery}"`];

    if (matchedPlans.length > 0) {
      lines.push('Your Plans:');
      matchedPlans.slice(0, 5).forEach(p => {
        const expName = p.experience?.name || 'Unnamed';
        const destName = p.experience?.destination?.name;
        const expId = p.experience?._id?.toString();
        const dateStr = p.planned_date
          ? new Date(p.planned_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : null;
        lines.push(`  - "${expName}"${destName ? ` in ${destName}` : ''}${dateStr ? ` (${dateStr})` : ''} [plan_id: ${p._id}, experience_id: ${expId}]`);
      });
    }

    if (matchedDestinations.length > 0) {
      lines.push('Destinations:');
      matchedDestinations.slice(0, 5).forEach(d => {
        lines.push(`  - ${d.name}${d.country ? ` (${d.country})` : ''} [destination_id: ${d._id}]`);
      });
    }

    if (matchedExperiences.length > 0) {
      lines.push('Experiences:');
      matchedExperiences.slice(0, 5).forEach(e => {
        lines.push(`  - ${e.name}${e.destination?.name ? ` at ${e.destination.name}` : ''} [experience_id: ${e._id}]`);
      });
    }

    return trimToTokenBudget(lines.join('\n'), options.tokenBudget || DEFAULT_TOKEN_BUDGET);
  } catch (err) {
    logger.error('[bienbot-context] buildSearchContext failed', { query, error: err.message });
    return null;
  }
}

/**
 * Build context block describing what plan item suggestions are available
 * for a destination. Provides the LLM with awareness of popular items so it
 * can propose a suggest_plan_items action when appropriate.
 *
 * @param {string} destinationId
 * @param {string} [experienceId] - Optional experience to scope suggestions
 * @param {string} userId
 * @param {object} [options]
 * @param {number} [options.tokenBudget]
 * @returns {Promise<string|null>}
 */
async function buildSuggestionContext(destinationId, experienceId, userId, options = {}) {
  loadModels();
  const { Destination, Experience } = getModels();

  try {
    if (!destinationId) return null;

    const destination = await Destination.findById(destinationId).select('name').lean();
    if (!destination) return null;

    // Count public experiences in this destination (excluding user's own)
    const query = {
      destination: destinationId,
      visibility: 'public',
      user: { $ne: userId }
    };
    if (experienceId) {
      const { valid } = validateObjectId(experienceId, 'experienceId');
      if (valid) query._id = { $ne: experienceId };
    }

    const [publicExpCount, sampleExps] = await Promise.all([
      Experience.countDocuments(query),
      Experience.find(query).select('plan_items.text plan_items.content').limit(5).lean()
    ]);

    if (publicExpCount === 0) return null;

    const sampleItems = [];
    for (const exp of sampleExps) {
      for (const item of (exp.plan_items || []).slice(0, 3)) {
        const text = item.content || item.text || '';
        if (text && sampleItems.length < 5) sampleItems.push(text);
      }
    }

    const lines = [
      `[Suggestion Availability] ${destination.name}`,
      `Public experiences with plan items: ${publicExpCount}`,
      sampleItems.length > 0 ? `Sample popular items: ${sampleItems.join(', ')}` : null,
      'You can propose a suggest_plan_items action to show the user popular items from other travelers.'
    ];

    return trimToTokenBudget(lines.filter(Boolean).join('\n'), options.tokenBudget || DEFAULT_TOKEN_BUDGET);
  } catch (err) {
    logger.error('[bienbot-context] buildSuggestionContext failed', { destinationId, error: err.message });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

/**
 * Append an [AFFINITY] line to contextLines when the user has meaningful affinity data
 * for the given experience. Non-fatal — enrichment is best-effort only.
 *
 * @param {string[]} contextLines - Mutable lines array to push into.
 * @param {string|null} userId
 * @param {string|null} experienceId
 */
async function appendAffinityBlock(contextLines, userId, experienceId) {
  if (!userId || !experienceId) return;
  try {
    const entry = await affinityCache.getAffinityEntry(userId, experienceId);
    if (entry && Math.abs(entry.score - 0.5) > 0.05 && entry.top_dims.length > 0) {
      const label = entry.score > 0.6 ? 'strong alignment'
                  : entry.score < 0.4 ? 'low alignment'
                  : 'moderate alignment';
      const drivers = describeDimDrivers(entry.top_dims);
      contextLines.push(
        `[AFFINITY] User affinity for this experience: ${label} — driven by ${drivers}`
      );
    }
  } catch (err) {
    // Non-fatal — affinity enrichment is best-effort
    logger.warn('[bienbot-context] appendAffinityBlock failed', { error: err.message });
  }
}

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

  const { valid, objectId } = validateObjectId(invokeContext.entity_id, 'invokeContext.entity_id');
  if (!valid) {
    logger.warn('[bienbot-context] Invalid entity_id in invokeContext', { invokeContext });
    return null;
  }

  // Use the type-safe ObjectId from the validator — never pass the raw user-supplied
  // string directly to database queries (prevents js/sql-injection CodeQL finding).
  const id = objectId;

  switch (invokeContext.entity) {
    case 'destination':
      return buildDestinationContext(id, userId, options);
    case 'experience': {
      const contextStr = await buildExperienceContext(id, userId, options);
      if (!contextStr) return null;
      const contextLines = [contextStr];
      await appendAffinityBlock(contextLines, userId, invokeContext.entity_id?.toString());
      return contextLines.join('\n');
    }
    case 'plan': {
      loadModels();
      const { Plan } = getModels();
      const [contextStr, planDoc] = await Promise.all([
        buildUserPlanContext(id, userId, options),
        Plan.findById(id).select('experience').lean().catch(planExpErr => {
          logger.warn('[bienbot-context] Could not resolve experience_id for plan affinity block', { planId: id, error: planExpErr.message });
          return null;
        })
      ]);
      if (!contextStr) return null;
      const planExperienceId = planDoc?.experience?.toString() || null;
      const contextLines = [contextStr];
      if (planExperienceId) {
        await appendAffinityBlock(contextLines, userId, planExperienceId);
      }
      return contextLines.join('\n');
    }
    case 'plan_item': {
      // Prefer caller-supplied planId; otherwise auto-resolve from DB.
      if (options.planId) {
        return buildPlanItemContext(options.planId, id, userId, options);
      }
      try {
        loadModels();
        const { Plan } = getModels();
        const { Types } = require('mongoose');
        const parentPlan = await Plan.findOne({ 'plan._id': new Types.ObjectId(id) }).select('_id').lean();
        if (!parentPlan) {
          logger.warn('[bienbot-context] plan_item auto-resolve: parent plan not found', { itemId: id });
          return null;
        }
        return buildPlanItemContext(parentPlan._id.toString(), id, userId, options);
      } catch (resolveErr) {
        logger.warn('[bienbot-context] plan_item auto-resolve failed', { itemId: id, error: resolveErr.message });
        return null;
      }
    }
    case 'user':
      return buildUserProfileContext(id, userId, options);
    default:
      logger.warn('[bienbot-context] Unknown entity type in invokeContext', { entity: invokeContext.entity });
      return null;
  }
}

module.exports = {
  // Shared helpers (also re-exported via façade)
  renderAttentionBlock,
  computePlanProximityTag,
  formatSignalBlock,
  buildDisambiguationBlock,
  buildInlineDetailSummary,
  // Entity context builders
  buildDestinationContext,
  buildExperienceContext,
  buildUserPlanContext,
  buildPlanItemContext,
  buildUserProfileContext,
  buildUserGreetingContext,
  // Misc / cross-entity builders
  buildSearchContext,
  buildSuggestionContext,
  buildPlanNextStepsContext,
  // Dispatcher
  buildContextForInvokeContext,
  // Re-exports from bienbot-discovery (preserved from the original façade)
  buildDiscoveryContext,
  buildSimilarExperiencesContext,
  formatDiscoveryContextBlock,
  SEMANTIC_ACTIVITY_MAP,
  expandActivityTypes,
  computeAdaptiveWeights,
  computeCostAlignment,
  normalizeCostToPercentile,
  computeRecencyScore,
  normalizeCount,
  generateMatchReason,
  findSimilarUsers,
  findCoOccurringExperiences,
  findPopularExperiences,
};

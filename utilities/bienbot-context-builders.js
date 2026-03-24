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
const { aggregateGroupSignals, applySignalDecay, signalsToNaturalLanguage } = require('./hidden-signals');

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

/**
 * Collect notes from plan items, filter by visibility, batch-resolve author names,
 * and summarize if total content exceeds threshold.
 *
 * @param {Array} planItems - Plan items from plan.plan
 * @param {string} userId - Requesting user ID
 * @param {number} [threshold=500] - Character threshold before summarization
 * @returns {Promise<string|null>} Formatted notes block or null
 */
async function collectPlanNotes(planItems, userId, threshold = 500) {
  const allNotes = [];
  const authorIds = new Set();

  for (const item of planItems) {
    const notes = item.details?.notes;
    if (!notes?.length) continue;
    const itemLabel = item.content || item.text || item.name || '(unnamed)';

    for (const note of notes) {
      // Visibility filter: private notes only visible to author
      if (note.visibility === 'private' && String(note.user) !== String(userId)) continue;
      authorIds.add(String(note.user));
      allNotes.push({
        itemLabel,
        content: note.content,
        authorId: String(note.user),
        date: note.createdAt
      });
    }
  }

  if (allNotes.length === 0) return null;

  // Batch-resolve author names
  const authorMap = {};
  try {
    const docs = await User.find({ _id: { $in: [...authorIds] } }).select('name').lean();
    for (const doc of docs) {
      authorMap[String(doc._id)] = doc.name || 'Unknown';
    }
  } catch (err) {
    logger.debug('[bienbot-context] Author name resolution failed', { error: err.message });
  }

  // Format notes
  const noteLines = allNotes.map(n => {
    const author = authorMap[n.authorId] || 'Unknown';
    const dateStr = n.date ? new Date(n.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    return `- [${author}${dateStr ? `, ${dateStr}` : ''}] (${n.itemLabel}): ${n.content}`;
  });

  const totalChars = noteLines.reduce((sum, l) => sum + l.length, 0);

  // Summarize if over threshold
  if (totalChars > threshold) {
    try {
      const { executeAIRequest } = require('./ai-gateway');
      const result = await executeAIRequest({
        messages: [
          { role: 'system', content: 'Summarize these travel plan notes concisely, preserving key details and who said what. Output only the summary.' },
          { role: 'user', content: noteLines.join('\n') }
        ],
        task: 'summarize',
        options: { maxTokens: 150 }
      });
      if (result?.content) {
        return `[PLAN NOTES (summarized)]\n${result.content}\n[/PLAN NOTES]`;
      }
    } catch (err) {
      logger.debug('[bienbot-context] Note summarization failed, falling back to truncation', { error: err.message });
    }
    // Fallback: truncate
    const truncated = noteLines.join('\n').substring(0, threshold * 2) + '...';
    return `[PLAN NOTES]\n${truncated}\n[/PLAN NOTES]`;
  }

  return `[PLAN NOTES]\n${noteLines.join('\n')}\n[/PLAN NOTES]`;
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
    const destination = await Destination.findById(destinationId);
    if (!destination) return null;

    const perm = await enforcer.canView({ userId, resource: destination });
    if (!perm.allowed) return null;

    // Check if travel tips are stale or empty — trigger background enrichment
    const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
    const lastEnriched = destination.travel_tips_updated_at;
    const isStale = !lastEnriched || (Date.now() - new Date(lastEnriched).getTime()) > CACHE_TTL_MS;
    const hasTips = destination.travel_tips && destination.travel_tips.length > 0;

    if (isStale || !hasTips) {
      try {
        const { enrichDestination } = require('./bienbot-external-data');
        // Non-blocking background refresh — serve cached data (if any) immediately
        enrichDestination(destinationId, { _id: userId }, { background: hasTips, force: !hasTips }).catch(err => {
          logger.warn('[bienbot-context] Background enrichment failed', { destinationId, error: err.message });
        });
      } catch (e) {
        logger.warn('[bienbot-context] Could not trigger enrichment', { error: e.message });
      }
    }

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

    // Inject hidden travel signals for destination and requesting user
    try {
      const destSignals = applySignalDecay(destination.hidden_signals || {});
      const destNL = signalsToNaturalLanguage(destSignals, { role: 'traveler' });
      const userDoc = await User.findById(userId).select('hidden_signals').lean();
      const userSignals = userDoc ? applySignalDecay(userDoc.hidden_signals || {}) : null;
      const userNL = userSignals ? signalsToNaturalLanguage(userSignals, { role: 'traveler' }) : '';
      if (destNL || userNL) {
        const signalParts = [];
        if (destNL) signalParts.push(`Destination profile: ${destNL}`);
        if (userNL) signalParts.push(`Visitor preference: ${userNL}`);
        lines.push(signalParts.join(' '));
      }
    } catch (sigErr) {
      logger.debug('[bienbot-context] Signal injection skipped', { error: sigErr.message });
    }

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
    const experience = await Experience.findById(experienceId).populate('destination', 'name country');
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
      itemCount > 0 ? `Items: ${experience.plan_items.slice(0, 10).map(i => i.content || i.text || i.name || '(unnamed)').join(', ')}` : null,
      experience.signal_tags?.length ? `Experience tags: ${experience.signal_tags.join(', ')}` : null
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
      .populate('experience', 'name');
    if (!plan) return null;

    const perm = await enforcer.canView({ userId, resource: plan });
    if (!perm.allowed) return null;

    const planItems = plan.plan || [];
    const totalItems = planItems.length;
    const completedItems = planItems.filter(i => i.complete).length;
    const completionPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    const lines = [
      `[Plan] for experience "${plan.experience?.name || '(unknown)'}"`,
      plan.planned_date ? `Planned date: ${new Date(plan.planned_date).toISOString().split('T')[0]}` : null,
      `Completion: ${completedItems}/${totalItems} items (${completionPct}%)`,
      plan.currency ? `Currency: ${plan.currency}` : null,
      plan.costs?.length ? `Costs tracked: ${plan.costs.length}` : null,
      totalItems > 0 ? `Items: ${planItems.slice(0, 10).map(i => `${i.complete ? '[x]' : '[ ]'} ${i.content || i.text || i.name || '(unnamed)'}`).join(', ')}` : null
    ];

    // Inject group travel signals from plan collaborators
    try {
      const memberIds = (plan.permissions || []).filter(p => p.entity === 'user').map(p => p._id);
      if (!memberIds.some(id => String(id) === String(userId))) {
        memberIds.push(userId);
      }
      const memberDocs = await User.find({ _id: { $in: memberIds } }).select('hidden_signals name').lean();
      if (memberDocs.length > 0) {
        const groupSignals = aggregateGroupSignals(memberDocs);
        const decayed = applySignalDecay(groupSignals);
        const signalText = signalsToNaturalLanguage(decayed, { role: memberDocs.length > 1 ? 'group' : 'traveler', count: memberDocs.length });
        if (signalText) {
          lines.push(`[TRAVEL SIGNALS]`);
          lines.push(signalText);
          lines.push(`[/TRAVEL SIGNALS]`);
        }
      }
    } catch (sigErr) {
      logger.debug('[bienbot-context] Plan signal injection skipped', { error: sigErr.message });
    }

    // Inject plan item notes (visibility-filtered)
    try {
      const notesBlock = await collectPlanNotes(planItems, userId);
      if (notesBlock) lines.push(notesBlock);
    } catch (noteErr) {
      logger.debug('[bienbot-context] Plan notes injection skipped', { error: noteErr.message });
    }

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
      .populate('experience', 'name');
    if (!plan) return null;

    const perm = await enforcer.canView({ userId, resource: plan });
    if (!perm.allowed) return null;

    const planItems = plan.plan || [];
    const itemIdStr = String(itemId);
    const item = planItems.find(i => String(i._id) === itemIdStr);
    if (!item) return null;

    const lines = [
      `[Plan Item] ${item.content || item.text || item.name || '(unnamed)'}`,
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
      .select('name email preferences bio links feature_flags');
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

    const publicExpCount = await Experience.countDocuments(query);

    if (publicExpCount === 0) return null;

    // Sample a few item names so the LLM knows suggestions are available
    const sampleExps = await Experience.find(query)
      .select('plan_items.text plan_items.content')
      .limit(5)
      .lean();

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

/**
 * Build a next-steps context block for a plan, highlighting actionable gaps.
 *
 * Analyses incomplete items and surfaces:
 *  - Items without a scheduled date
 *  - Items without details or notes
 *  - Items with a cost estimate but no tracked cost
 *  - Unassigned items in collaborative plans
 *  - Overall plan readiness score
 *
 * @param {string} planId
 * @param {string} userId
 * @param {object} [options]
 * @param {number} [options.tokenBudget]
 * @returns {Promise<string|null>}
 */
async function buildPlanNextStepsContext(planId, userId, options = {}) {
  loadModels();
  const enforcer = getEnforcer({ Destination, Experience, Plan, User });

  try {
    const plan = await Plan.findById(planId).populate('experience', 'name');
    if (!plan) return null;

    const perm = await enforcer.canView({ userId, resource: plan });
    if (!perm.allowed) return null;

    const planItems = plan.plan || [];
    if (planItems.length === 0) return null;

    const incompleteItems = planItems.filter(i => !i.complete);

    // Sort incomplete items by scheduled date (soonest first, unscheduled last)
    const sortedIncomplete = [...incompleteItems].sort((a, b) => {
      if (a.scheduled_date && b.scheduled_date) return new Date(a.scheduled_date) - new Date(b.scheduled_date);
      if (a.scheduled_date) return -1;
      if (b.scheduled_date) return 1;
      return 0;
    });

    // Categorise gaps
    const noDate = sortedIncomplete.filter(i => !i.scheduled_date);
    const noDetails = sortedIncomplete.filter(i => {
      const notes = i.details?.notes || [];
      return notes.length === 0;
    });
    const noTrackedCost = sortedIncomplete.filter(i => {
      if (!i.cost) return false; // no estimate to track against
      const trackedCosts = (plan.costs || []).filter(c => c.plan_item && String(c.plan_item) === String(i._id));
      return trackedCosts.length === 0;
    });

    // Check for collaborative plan with unassigned items
    const collaboratorCount = (plan.permissions || []).filter(p => p.entity === 'user').length;
    const isCollaborative = collaboratorCount > 1;
    const unassigned = isCollaborative ? sortedIncomplete.filter(i => !i.assignedTo) : [];

    // Readiness score: % of items that have date + details/notes + cost tracking (if estimated)
    const totalItems = planItems.length;
    let readyCount = 0;
    for (const item of planItems) {
      const hasDate = !!item.scheduled_date;
      const hasNotes = (item.details?.notes || []).length > 0;
      const costOk = !item.cost || (plan.costs || []).some(c => c.plan_item && String(c.plan_item) === String(item._id));
      if (hasDate && hasNotes && costOk) readyCount++;
    }
    const readinessPct = Math.round((readyCount / totalItems) * 100);

    const itemLabel = (i) => i.content || i.text || i.name || '(unnamed)';

    const lines = ['[NEXT STEPS]'];
    lines.push(`Plan readiness: ${readinessPct}% (${readyCount}/${totalItems} items fully detailed)`);

    if (sortedIncomplete.length > 0) {
      lines.push(`Incomplete items (${sortedIncomplete.length}):`);
      sortedIncomplete.slice(0, 8).forEach(i => {
        const dateStr = i.scheduled_date ? new Date(i.scheduled_date).toISOString().split('T')[0] : 'no date';
        lines.push(`  - ${itemLabel(i)} [${dateStr}]`);
      });
    }

    if (noDate.length > 0) {
      lines.push(`Need scheduling (${noDate.length}): ${noDate.slice(0, 5).map(itemLabel).join(', ')}`);
    }

    if (noDetails.length > 0) {
      lines.push(`Need notes/details (${noDetails.length}): ${noDetails.slice(0, 5).map(itemLabel).join(', ')}`);
    }

    if (noTrackedCost.length > 0) {
      lines.push(`Have cost estimate but no tracked cost (${noTrackedCost.length}): ${noTrackedCost.slice(0, 5).map(itemLabel).join(', ')}`);
    }

    if (unassigned.length > 0) {
      lines.push(`Unassigned in collaborative plan (${unassigned.length}): ${unassigned.slice(0, 5).map(itemLabel).join(', ')}`);
    }

    lines.push('[/NEXT STEPS]');

    return trimToTokenBudget(lines.join('\n'), options.tokenBudget || DEFAULT_TOKEN_BUDGET);
  } catch (err) {
    logger.error('[bienbot-context] buildPlanNextStepsContext failed', { planId, error: err.message });
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

// ---------------------------------------------------------------------------
// Discovery helpers
// ---------------------------------------------------------------------------

/**
 * Maps semantic category keywords to plan item activity_type values.
 * 14 categories including the original 5 plus 9 new ones.
 */
const SEMANTIC_ACTIVITY_MAP = {
  // Existing
  culinary:          ['food', 'drinks', 'coffee', 'market', 'local'],
  adventure:         ['adventure', 'nature', 'sports', 'tour'],
  cultural:          ['museum', 'sightseeing', 'religious', 'local'],
  wellness:          ['wellness', 'health', 'rest'],
  nightlife:         ['nightlife', 'drinks', 'entertainment'],
  // New
  'family-friendly': ['sightseeing', 'nature', 'entertainment', 'class', 'tour'],
  budget:            ['food', 'local', 'nature', 'sightseeing'],
  romantic:          ['food', 'drinks', 'wellness', 'sightseeing', 'entertainment'],
  solo:              ['museum', 'nature', 'coffee', 'adventure', 'photography'],
  photography:       ['photography', 'sightseeing', 'nature', 'museum'],
  historical:        ['museum', 'sightseeing', 'religious', 'tour'],
  beach:             ['nature', 'sports', 'wellness', 'rest', 'adventure'],
  mountain:          ['nature', 'adventure', 'sports', 'tour', 'photography'],
  urban:             ['sightseeing', 'food', 'nightlife', 'shopping', 'entertainment']
};

// ---------------------------------------------------------------------------
// Ranking helper constants
// ---------------------------------------------------------------------------

const DEFAULT_DISCOVERY_WEIGHTS = {
  plan_count:      0.30,
  completion_rate: 0.25,
  recency:         0.20,
  collaborators:   0.10,
  cost_alignment:  0.15
};

const WEIGHT_FLOOR = 0.05;
const SIGNAL_THRESHOLD = 0.7;
const MIN_CONFIDENCE = 0.2;
const RECENCY_HALF_LIFE_DAYS = 174; // e^(-ln2 * 90/174) ≈ 0.70 at 90 days, per spec

// ---------------------------------------------------------------------------
// Ranking helpers
// ---------------------------------------------------------------------------

/**
 * Expand semantic categories (e.g., 'culinary') to concrete activity types.
 * Unknown types pass through as-is for direct activity_type matching.
 * @param {string[]} categories
 * @returns {string[]}
 */
function expandActivityTypes(categories) {
  if (!categories || !categories.length) return [];
  const types = new Set();
  for (const cat of categories) {
    if (SEMANTIC_ACTIVITY_MAP[cat]) {
      SEMANTIC_ACTIVITY_MAP[cat].forEach(t => types.add(t));
    } else {
      types.add(cat); // pass through as raw activity_type
    }
  }
  return [...types];
}

/**
 * Compute signal-adaptive ranking weights based on user's hidden signals.
 * Returns DEFAULT_DISCOVERY_WEIGHTS if signals are absent or low-confidence.
 * Symmetric +0.10/-0.10 swaps per dimension. Enforces 0.05 floor. Re-normalizes to 1.0.
 * @param {Object|null} signals
 * @returns {Object}
 */
function computeAdaptiveWeights(signals) {
  const weights = { ...DEFAULT_DISCOVERY_WEIGHTS };

  if (!signals || (signals.confidence || 0) < MIN_CONFIDENCE) return weights;

  // Symmetric +0.10/-0.10 swaps
  if ((signals.budget_sensitivity || 0) > SIGNAL_THRESHOLD) {
    weights.cost_alignment += 0.10;
    weights.plan_count -= 0.10;
  }
  if ((signals.social || 0) > SIGNAL_THRESHOLD) {
    weights.collaborators += 0.10;
    weights.recency -= 0.10;
  }
  if ((signals.structure || 0) > SIGNAL_THRESHOLD) {
    weights.completion_rate += 0.10;
    weights.plan_count -= 0.10;
  }
  if ((signals.novelty || 0) > SIGNAL_THRESHOLD) {
    weights.recency += 0.10;
    weights.completion_rate -= 0.10;
  }

  // Enforce minimum floor
  Object.keys(weights).forEach(k => {
    weights[k] = Math.max(weights[k], WEIGHT_FLOOR);
  });

  // Re-normalize to sum to 1.0
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  Object.keys(weights).forEach(k => { weights[k] /= sum; });

  return weights;
}

/**
 * Map a cost value to its percentile within a candidate set.
 * Returns 0.0 (cheapest) to 1.0 (most expensive). Neutral 0.5 for edge cases.
 * @param {number} cost
 * @param {number[]} allCandidateCosts
 * @returns {number}
 */
function normalizeCostToPercentile(cost, allCandidateCosts) {
  if (!allCandidateCosts || !allCandidateCosts.length || allCandidateCosts.length === 1) return 0.5;
  const sorted = [...allCandidateCosts].sort((a, b) => a - b);
  const rank = sorted.indexOf(cost);
  if (rank === -1) return 0.5;
  return rank / (sorted.length - 1);
}

/**
 * Compute cost alignment between an experience cost and user's budget sensitivity.
 * 1.0 = perfect fit, 0.0 = worst mismatch, 0.5 = neutral.
 * @param {number|null} experienceCost
 * @param {Object|null} signals
 * @param {number[]} allCandidateCosts
 * @returns {number}
 */
function computeCostAlignment(experienceCost, signals, allCandidateCosts) {
  if (!experienceCost || !signals) return 0.5;
  const userBudgetLevel = 1 - (signals.budget_sensitivity || 0.5);
  const costPercentile = normalizeCostToPercentile(experienceCost, allCandidateCosts || []);
  return 1 - Math.abs(userBudgetLevel - costPercentile);
}

/**
 * Exponential decay recency score.
 * ~1.0 for today, ~0.7 for 90 days, ~0.3 for 180+ days.
 * Uses ln(2)/RECENCY_HALF_LIFE_DAYS as decay constant.
 * @param {Date|null} date
 * @returns {number}
 */
function computeRecencyScore(date) {
  if (!date) return 0;
  const daysSince = (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince < 0) return 1;
  return Math.exp(-0.693 * daysSince / RECENCY_HALF_LIFE_DAYS); // ln(2) ~= 0.693
}

/**
 * Normalize a count value to [0, 1] using the max in the candidate set.
 * @param {number} value
 * @param {number} maxValue
 * @returns {number}
 */
function normalizeCount(value, maxValue) {
  if (!maxValue || maxValue === 0) return 0;
  return Math.min(value / maxValue, 1);
}

/**
 * Generate a human-readable match_reason from the dominant ranking signal.
 * Finds the dominant signal (highest weighted contribution) and fills a template.
 * Prepends a category phrase when categories are provided.
 * @param {Object} candidate
 * @param {Object} weights
 * @param {string[]} categories
 * @returns {string}
 */
function generateMatchReason(candidate, weights, categories) {
  const categoryPhrases = {
    culinary: 'culinary travelers',
    adventure: 'adventure seekers',
    cultural: 'culture enthusiasts',
    wellness: 'wellness travelers',
    nightlife: 'nightlife enthusiasts',
    'family-friendly': 'families',
    budget: 'budget travelers',
    romantic: 'couples',
    solo: 'solo travelers',
    photography: 'photographers',
    historical: 'history buffs',
    beach: 'beach lovers',
    mountain: 'mountain explorers',
    urban: 'city explorers'
  };

  const templates = {
    plan_count:      (c) => `Planned by ${c.co_occurrence_count} similar travelers`,
    completion_rate: (c) => `${Math.round((c.avg_completion_rate || 0) * 100)}% plan completion rate`,
    recency:         () => 'Recently trending among travelers',
    collaborators:   (c) => `Popular group activity - ${c.collaborator_count} collaborators`,
    cost_alignment:  () => 'Good budget fit for your travel style'
  };

  // Find dominant signal (highest weighted contribution)
  const contributions = {
    plan_count:      (weights.plan_count || 0) * (candidate.co_occurrence_count ? 1 : 0),
    completion_rate: (weights.completion_rate || 0) * (candidate.avg_completion_rate || 0),
    recency:         (weights.recency || 0) * (candidate.recency_score || 0),
    collaborators:   (weights.collaborators || 0) * (candidate.collaborator_count ? 1 : 0),
    cost_alignment:  (weights.cost_alignment || 0) * 0.5 // neutral default
  };

  const dominant = Object.entries(contributions)
    .sort(([, a], [, b]) => b - a)[0][0];

  // Build phrase
  const catPhrase = (categories || [])
    .map(c => categoryPhrases[c] || c)
    .filter(Boolean)[0];

  const signalPhrase = templates[dominant](candidate);
  return catPhrase
    ? `Popular among ${catPhrase} - ${signalPhrase}`
    : signalPhrase;
}

/**
 * Build a discovery context block for cross-dimensional queries.
 *
 * Uses MongoDB aggregation on plans + experience activity types to find
 * popular experiences matching the given filters.
 *
 * @param {object} filters - { activity_types?, destination_name?, destination_id?, min_plans?, max_cost?, sort_by? }
 * @param {string} userId
 * @param {object} [options]
 * @returns {Promise<string|null>}
 */
async function buildDiscoveryContext(filters = {}, userId, options = {}) {
  loadModels();

  try {
    // Expand semantic categories into activity types
    let activityTypes = filters.activity_types || [];
    const expanded = [];
    for (const at of activityTypes) {
      const mapped = SEMANTIC_ACTIVITY_MAP[at.toLowerCase()];
      if (mapped) expanded.push(...mapped);
      else expanded.push(at.toLowerCase());
    }
    activityTypes = [...new Set(expanded)];

    // Build match stage for plans
    const planMatch = {};

    // Resolve destination filter
    if (filters.destination_id) {
      planMatch['experience_populated.destination'] = require('mongoose').Types.ObjectId.createFromHexString(filters.destination_id);
    } else if (filters.destination_name) {
      const destMatches = await Destination.find({
        name: { $regex: filters.destination_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
      }).select('_id').limit(10).lean();
      if (destMatches.length > 0) {
        planMatch['experience_populated.destination'] = { $in: destMatches.map(d => d._id) };
      }
    }

    // Aggregation pipeline
    const pipeline = [
      // Lookup experience data
      { $lookup: {
        from: 'experiences',
        localField: 'experience',
        foreignField: '_id',
        as: 'experience_populated'
      }},
      { $unwind: '$experience_populated' },
      // Only public experiences
      { $match: { 'experience_populated.visibility': { $ne: 'private' }, ...planMatch } }
    ];

    // Filter by activity types if specified
    if (activityTypes.length > 0) {
      pipeline.push({
        $match: {
          'experience_populated.plan_items.activity_type': { $in: activityTypes }
        }
      });
    }

    // Max cost filter
    if (filters.max_cost) {
      pipeline.push({
        $match: { 'experience_populated.cost_estimate': { $lte: filters.max_cost } }
      });
    }

    // Group by experience, count plans
    pipeline.push(
      { $group: {
        _id: '$experience_populated._id',
        name: { $first: '$experience_populated.name' },
        destination: { $first: '$experience_populated.destination' },
        overview: { $first: '$experience_populated.overview' },
        experience_type: { $first: '$experience_populated.experience_type' },
        cost_estimate: { $first: '$experience_populated.cost_estimate' },
        plan_count: { $sum: 1 }
      }},
      // Min plans filter
      { $match: { plan_count: { $gte: filters.min_plans || 1 } } },
      // Sort
      { $sort: { plan_count: -1 } },
      { $limit: 8 }
    );

    // Populate destination names
    pipeline.push({
      $lookup: {
        from: 'destinations',
        localField: 'destination',
        foreignField: '_id',
        as: 'destination_doc'
      }
    });

    const results = await Plan.aggregate(pipeline);

    if (results.length === 0) return null;

    const lines = ['[DISCOVERY RESULTS]'];
    for (const r of results) {
      const destName = r.destination_doc?.[0]?.name || '';
      const types = r.experience_type?.join(', ') || '';
      const costStr = r.cost_estimate ? ` ~$${r.cost_estimate}` : '';
      lines.push(`- ${r.name}${destName ? ` (${destName})` : ''}${costStr} — ${r.plan_count} plan${r.plan_count !== 1 ? 's' : ''}${types ? ` [${types}]` : ''}`);
    }
    lines.push('[/DISCOVERY RESULTS]');

    return trimToTokenBudget(lines.join('\n'), options.tokenBudget || DEFAULT_TOKEN_BUDGET);
  } catch (err) {
    logger.error('[bienbot-context] buildDiscoveryContext failed', { error: err.message });
    return null;
  }
}

/**
 * Build context of similar experiences in the same destination.
 * Used for post-plan onboarding to suggest related content.
 *
 * @param {string} experienceId - Current experience ID
 * @param {string} destinationId - Destination ID
 * @param {string} userId
 * @param {object} [options]
 * @returns {Promise<string|null>}
 */
async function buildSimilarExperiencesContext(experienceId, destinationId, userId, options = {}) {
  loadModels();

  try {
    if (!destinationId) return null;

    // Find other public experiences in the same destination, sorted by plan count
    const pipeline = [
      { $match: {
        destination: require('mongoose').Types.ObjectId.createFromHexString(String(destinationId)),
        _id: { $ne: require('mongoose').Types.ObjectId.createFromHexString(String(experienceId)) },
        visibility: { $ne: 'private' }
      }},
      { $lookup: {
        from: 'plans',
        localField: '_id',
        foreignField: 'experience',
        as: 'plans'
      }},
      { $addFields: { plan_count: { $size: '$plans' } } },
      { $sort: { plan_count: -1 } },
      { $limit: 5 },
      { $project: { name: 1, overview: 1, plan_count: 1, experience_type: 1 } }
    ];

    const results = await Experience.aggregate(pipeline);
    if (results.length === 0) return null;

    const lines = ['[SIMILAR EXPERIENCES]'];
    for (const r of results) {
      const types = r.experience_type?.join(', ') || '';
      lines.push(`- ${r.name} (${r.plan_count} plan${r.plan_count !== 1 ? 's' : ''})${types ? ` [${types}]` : ''}`);
    }
    lines.push('[/SIMILAR EXPERIENCES]');

    return trimToTokenBudget(lines.join('\n'), options.tokenBudget || 800);
  } catch (err) {
    logger.error('[bienbot-context] buildSimilarExperiencesContext failed', { error: err.message });
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
  buildSuggestionContext,
  buildContextForInvokeContext,
  buildDiscoveryContext,
  buildPlanNextStepsContext,
  buildSimilarExperiencesContext,
  SEMANTIC_ACTIVITY_MAP,
  // Discovery ranking helpers (exported for testing and direct use)
  expandActivityTypes,
  computeAdaptiveWeights,
  computeCostAlignment,
  normalizeCostToPercentile,
  computeRecencyScore,
  normalizeCount,
  generateMatchReason
};

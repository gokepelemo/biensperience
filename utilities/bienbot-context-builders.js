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
const { aggregateGroupSignals, applySignalDecay, signalsToNaturalLanguage, computePopularityScore, computeAffinityScore, computeAndCacheAffinity } = require('./hidden-signals');
const signalsConfig = require('./signals-config');
const affinityCache = require('./affinity-cache');

// Lazy-loaded models (resolved on first use)
let Destination, Experience, Plan, User, Activity;

function loadModels() {
  if (!Destination) {
    Destination = require('../models/destination');
    Experience = require('../models/experience');
    Plan = require('../models/plan');
    User = require('../models/user');
    Activity = require('../models/activity');
  }
}

/**
 * Format an entity as an inline JSON reference for the LLM.
 * @param {string} id - Entity ObjectId string
 * @param {string} name - Entity display name
 * @param {string} type - 'destination' | 'experience' | 'plan' | 'plan_item' | 'user'
 * @returns {string} Compact JSON string
 */
function entityJSON(id, name, type) {
  return JSON.stringify({ _id: id, name: name || type, type });
}

/**
 * Format a date as "Monday, March 31, 2026" for LLM context.
 * Uses UTC to avoid server-timezone drift on date-only values.
 */
function formatPlanDate(date) {
  try {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC'
    });
  } catch {
    return new Date(date).toISOString().split('T')[0];
  }
}

/**
 * Format a numeric amount with its currency symbol (e.g. "$632.00", "€200.00").
 * Falls back to "CURRENCY amount" if the code is invalid.
 */
function formatCostAmount(amount, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amount);
  } catch {
    return `${currency || 'USD'} ${amount}`;
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
 * Build a disambiguation block listing similar entities of the same type.
 * Returns null when there are fewer than 2 candidates (unambiguous).
 *
 * @param {'experience'|'plan'|'plan_item'} type
 * @param {string} userId
 * @param {object} [options]
 * @param {string}  [options.currentId]          - Entity _id to exclude from results
 * @param {string}  [options.destinationId]      - Filter experiences by destination
 * @param {string}  [options.destinationName]    - Label for block header
 * @param {string}  [options.experienceId]       - Filter plans by experience
 * @param {Array}   [options.planItems]          - Pre-fetched items array (plan_item only)
 * @param {string}  [options.currentItemContent] - Content of current item (plan_item only)
 * @returns {Promise<string|null>}
 */
async function buildDisambiguationBlock(type, userId, options = {}) {
  loadModels();
  const { Types } = require('mongoose');
  try {
    // --- experience disambiguation ---
    if (type === 'experience' && options.destinationId) {
      const query = { destination: options.destinationId };
      if (options.currentId) {
        const { valid, objectId } = validateObjectId(options.currentId, 'currentId');
        if (valid) query._id = { $ne: objectId };
      }
      const others = await Experience
        .find(query)
        .select('name plan_items difficulty permissions visibility')
        .sort({ updatedAt: -1 })
        .limit(6)
        .lean();
      const viewable = others.filter(e => {
        if (!e.visibility || e.visibility === 'public') return true;
        // 'contributors' and 'private': require explicit permission entry
        return (e.permissions || []).some(p => String(p._id) === String(userId));
      });
      if (viewable.length < 2) return null;
      const label = options.destinationName
        ? `other experiences at ${options.destinationName}`
        : 'other experiences at this destination';
      const lines = [`[DISAMBIGUATION: ${label}]`];
      for (const e of viewable.slice(0, 5)) {
        const name = e.name || '(unnamed)';
        const count = (e.plan_items || []).length;
        const diff = e.difficulty ? `, difficulty ${e.difficulty}` : '';
        lines.push(`  • ${name} — ${entityJSON(String(e._id), name, 'experience')} (${count} items${diff})`);
      }
      lines.push(`[/DISAMBIGUATION]`);
      return lines.join('\n');
    }

    // --- plan disambiguation (user's other plans at same destination) ---
    if (type === 'plan' && options.experienceId) {
      const { valid: expValid, objectId: expOid } = validateObjectId(options.experienceId, 'experienceId');
      if (!expValid) return null;

      // Resolve destination ID — skip the extra DB call if caller already provided it
      let destId;
      if (options.destinationId) {
        destId = options.destinationId;
      } else {
        const experience = await Experience.findById(expOid).select('destination name').lean();
        destId = experience?.destination;
        if (!destId) return null;
      }
      if (!destId) return null;

      // Fetch all user plans and filter to same destination
      const userPlans = await Plan
        .find({ user: new Types.ObjectId(userId) })
        .populate({ path: 'experience', select: 'name destination' })
        .select('experience planned_date plan')
        .sort({ updatedAt: -1 })
        .limit(50)
        .lean();

      const otherPlans = userPlans.filter(p => {
        if (options.currentId && String(p._id) === String(options.currentId)) return false;
        const planDestId = p.experience?.destination?._id ?? p.experience?.destination;
        return planDestId && String(planDestId) === String(destId);
      });

      if (otherPlans.length < 2) return null;

      const destName = options.destinationName || 'this destination';
      const lines = [`[DISAMBIGUATION: your other ${destName} plans]`];
      for (const p of otherPlans.slice(0, 5)) {
        const dateStr = p.planned_date
          ? new Date(p.planned_date).toISOString().split('T')[0]
          : 'no date';
        const items = (p.plan || []).length;
        const pName = p.experience?.name || 'plan';
        lines.push(`  • ${pName} — ${entityJSON(String(p._id), pName, 'plan')} (${dateStr}, ${items} items)`);
      }
      lines.push(`[/DISAMBIGUATION]`);
      return lines.join('\n');
    }

    // --- plan_item disambiguation ---
    if (type === 'plan_item' && Array.isArray(options.planItems) && options.currentItemContent) {
      const others = options.planItems.filter(i =>
        options.currentId ? String(i._id) !== String(options.currentId) : true
      );
      const similar = findSimilarItems(others, options.currentItemContent, 'content', 70);
      if (similar.length < 2) return null;
      const lines = [`[DISAMBIGUATION: similar items in this plan]`];
      for (const item of similar.slice(0, 5)) {
        const name = item.content || item.text || item.name || '(unnamed)';
        lines.push(`  • ${name} — ${entityJSON(String(item._id), name, 'plan_item')}`);
      }
      lines.push(`[/DISAMBIGUATION]`);
      return lines.join('\n');
    }

    return null;
  } catch (err) {
    logger.debug('[bienbot-context] buildDisambiguationBlock failed', { type, error: err.message });
    return null;
  }
}

/**
 * Returns whole-day difference between targetDate and today.
 * 0 = today, positive = future, negative = past/overdue, null if no date.
 */
function computeDaysUntil(targetDate) {
  if (!targetDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

/**
 * Formats a single plan item detail into a short human-readable line.
 * @param {string} type - 'transport'|'accommodation'|'parking'|'discount'
 * @param {object} d - The extension data object from item.details[type]
 */
function formatDetailLine(type, d) {
  if (!d) return null;
  switch (type) {
    case 'transport': {
      const parts = [];
      if (d.mode) parts.push(d.mode);
      if (d.departureLocation || d.arrivalLocation) {
        const route = [d.departureLocation, d.arrivalLocation].filter(Boolean).join(' → ');
        if (route) parts.push(route);
      }
      if (d.departureTime) parts.push(`dep ${new Date(d.departureTime).toISOString().split('T')[0]}`);
      if (d.trackingNumber) parts.push(`ref# ${d.trackingNumber}`);
      return parts.length ? `🚌 Transport: ${parts.join(', ')}` : null;
    }
    case 'accommodation': {
      const parts = [];
      if (d.name) parts.push(d.name);
      if (d.checkIn) parts.push(`in ${new Date(d.checkIn).toISOString().split('T')[0]}`);
      if (d.checkOut) parts.push(`out ${new Date(d.checkOut).toISOString().split('T')[0]}`);
      if (d.confirmationNumber) parts.push(`conf# ${d.confirmationNumber}`);
      return parts.length ? `🏨 Stay: ${parts.join(', ')}` : null;
    }
    case 'parking': {
      const parts = [];
      if (d.facilityName) parts.push(d.facilityName);
      if (d.spotNumber) parts.push(`spot ${d.spotNumber}`);
      if (d.confirmationNumber) parts.push(`conf# ${d.confirmationNumber}`);
      return parts.length ? `🅿️ Parking: ${parts.join(', ')}` : null;
    }
    case 'discount': {
      const parts = [];
      if (d.code) parts.push(`code: ${d.code}`);
      if (d.discountType) parts.push(d.discountType);
      if (d.discountValue != null) parts.push(`${d.isPercentage ? d.discountValue + '%' : d.discountValue}`);
      return parts.length ? `🏷️ Discount: ${parts.join(', ')}` : null;
    }
    default:
      return null;
  }
}

/**
 * Groups plan items into temporal proximity buckets based on scheduled_date.
 * Returns: { todayItems, next7Items, next30Items, proximityMin }
 * proximityMin = closest daysUntil value among items with a date
 */
function buildTemporalBuckets(planItems) {
  const todayItems = [];
  const next7Items = [];
  const next30Items = [];
  let proximityMin = null;

  for (const item of planItems) {
    if (item.complete) continue;
    const days = computeDaysUntil(item.scheduled_date);
    if (days === null) continue;
    if (proximityMin === null || days < proximityMin) proximityMin = days;
    if (days === 0) todayItems.push(item);
    else if (days > 0 && days <= 7) next7Items.push(item);
    else if (days > 7 && days <= 30) next30Items.push(item);
  }

  return { todayItems, next7Items, next30Items, proximityMin };
}

/**
 * Builds a compact one-line detail summary for an item for use in temporal bucket lists.
 */
function buildInlineDetailSummary(item) {
  const lines = [];
  const DETAIL_TYPES = ['transport', 'accommodation', 'parking', 'discount'];
  for (const type of DETAIL_TYPES) {
    const d = item.details?.[type];
    if (d) {
      const line = formatDetailLine(type, d);
      if (line) lines.push(line);
    }
  }
  return lines.slice(0, 2).join(' | ');
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
      const votes = (note.relevancy_votes || []).length;
      allNotes.push({
        itemLabel,
        content: note.content,
        authorId: String(note.user),
        date: note.createdAt,
        relevancyVotes: votes
      });
    }
  }

  if (allNotes.length === 0) return null;

  // Sort: important notes (any votes) first, then by date descending
  allNotes.sort((a, b) => {
    if (b.relevancyVotes !== a.relevancyVotes) return b.relevancyVotes - a.relevancyVotes;
    return new Date(b.date || 0) - new Date(a.date || 0);
  });

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

  // Format notes — prepend [IMPORTANT (N votes)] for voted notes, [NEUTRAL] otherwise
  const noteLines = allNotes.map(n => {
    const author = authorMap[n.authorId] || 'Unknown';
    const dateStr = n.date ? new Date(n.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    const importantTag = n.relevancyVotes > 0
      ? `[IMPORTANT (${n.relevancyVotes} vote${n.relevancyVotes === 1 ? '' : 's'})] `
      : '[NEUTRAL] ';
    return `- ${importantTag}[${author}${dateStr ? `, ${dateStr}` : ''}] (${n.itemLabel}): ${n.content}`;
  });

  const totalChars = noteLines.reduce((sum, l) => sum + l.length, 0);

  // Summarize if over threshold
  if (totalChars > threshold) {
    try {
      const { executeAIRequest } = require('./ai-gateway');
      const result = await executeAIRequest({
        messages: [
          { role: 'system', content: 'Summarize these travel plan notes concisely, preserving key details and who said what. Each note is tagged [IMPORTANT (N votes)] or [NEUTRAL]. IMPORTANT notes have been explicitly marked as high-priority by plan members and contain details the team considers critical to the plan (e.g. confirmed bookings, restrictions, must-dos). NEUTRAL notes are general remarks or lower-priority information. Prioritize IMPORTANT note content in your summary — their key points must appear. NEUTRAL notes may be condensed or omitted if space is tight. Output only the summary.' },
          { role: 'user', content: noteLines.join('\n') }
        ],
        user: null, // context builder does not hold a user document; usage tracking is skipped
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

/**
 * Wrap a list of attention signals in [ATTENTION] tags.
 * Returns null when there are no signals.
 * @param {string[]} signals
 * @param {number} [max=5]
 * @returns {string|null}
 */
function renderAttentionBlock(signals, max = 5) {
  if (!signals || !signals.length) return null;
  return `\n[ATTENTION]\n${signals.slice(0, max).join('\n')}\n[/ATTENTION]`;
}

/**
 * Return a proximity tag string for a plan, e.g. " (+3d)" or " (2d overdue)".
 * Prefers scheduled item proximity over plan.planned_date.
 * Returns '' when no date information is available.
 * @param {object} plan - lean plan document with .plan[] and .planned_date
 * @returns {string}
 */
function computePlanProximityTag(plan) {
  const scheduled = (plan.plan || []).filter(i => i.scheduled_date && !i.complete);
  let proximity = null;
  if (scheduled.length > 0) {
    proximity = Math.min(...scheduled.map(i => computeDaysUntil(i.scheduled_date)));
  } else if (plan.planned_date) {
    proximity = computeDaysUntil(plan.planned_date);
  }
  if (proximity === null) return '';
  return proximity < 0
    ? ` (${Math.abs(proximity)}d overdue)`
    : ` (+${proximity}d)`;
}

/**
 * Format a [TRAVEL SIGNALS] block from a hidden_signals object.
 * Returns null when signals are absent or produce no natural-language text.
 * @param {object|null} hiddenSignals - raw hidden_signals from DB
 * @param {'traveler'|'group'} role
 * @param {number} [count=1]
 * @returns {string|null}
 */
function formatSignalBlock(hiddenSignals, role, count = 1) {
  if (!hiddenSignals) return null;
  const decayed = applySignalDecay(hiddenSignals);
  const text = signalsToNaturalLanguage(decayed, { role, count });
  if (!text) return null;
  return `[TRAVEL SIGNALS]\n${text}\n[/TRAVEL SIGNALS]`;
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

  const { valid: destIdValid, objectId: destOid } = validateObjectId(destinationId, 'destinationId');
  if (!destIdValid) return null;

  try {
    const destination = await Destination.findById(destOid)
      .select('name country state overview location travel_tips travel_tips_updated_at visibility hidden_signals permissions');
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
      `Entity: ${entityJSON(destination._id.toString(), destination.name, 'destination')}`,
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

    // Fetch user plans once — reused by cross-entity block and attention signals block.
    // Caller may pass opts.userPlans to avoid a redundant DB query when multiple
    // context builders run in parallel.
    let userPlansForDest = [];
    try {
      if (options.userPlans) {
        userPlansForDest = options.userPlans;
      } else {
        userPlansForDest = await Plan.find({ user: userId })
          .populate({ path: 'experience', select: 'name destination', populate: { path: 'destination', select: 'name country' } })
          .select('experience planned_date plan')
          .lean();
      }
    } catch (planFetchErr) {
      logger.debug('[bienbot-context] Destination plan fetch skipped', { error: planFetchErr.message });
    }

    // Cross-entity: Your other plans for this destination (up to 3)
    try {
      const relatedPlans = userPlansForDest.filter(p => {
        if (!p.experience?.destination) return false;
        const planDestId = p.experience.destination._id || p.experience.destination;
        return String(planDestId) === String(destination._id) ||
          (p.experience.destination.country && destination.country &&
           p.experience.destination.country.toLowerCase() === destination.country.toLowerCase());
      }).slice(0, 3);
      if (relatedPlans.length > 0) {
        lines.push('\nYour other plans nearby:');
        for (const p of relatedPlans) {
          const expName = p.experience?.name || '(unnamed)';
          const destName = p.experience?.destination?.name || destination.name;
          const tag = computePlanProximityTag(p);
          lines.push(`  ${expName} (${destName})${tag}`);
        }
      }
    } catch (crossErr) {
      logger.debug('[bienbot-context] Cross-entity destination plans skipped', { error: crossErr.message });
    }

    // Disambiguation: list experiences at this destination
    try {
      const disambigBlock = await buildDisambiguationBlock('experience', userId, {
        destinationId: destination._id.toString(),
        destinationName: destination.name,
      });
      if (disambigBlock) lines.push('\n' + disambigBlock);
    } catch (dErr) {
      logger.debug('[bienbot-context] Destination disambiguation skipped', { error: dErr.message });
    }

    // Attention signals
    try {
      const signals = [];
      const today = new Date(); today.setHours(0, 0, 0, 0);

      // Reuse userPlansForDest fetched above — filter to exact destination ID match
      const destPlans = userPlansForDest.filter(p => {
        const dId = p.experience?.destination?._id || p.experience?.destination;
        return dId && String(dId) === String(destination._id);
      });

      if (destPlans.length === 0) {
        signals.push('⚠ You have no plans here yet');
      } else {
        const futurePlans = destPlans.filter(p => p.planned_date && new Date(p.planned_date) >= today);
        const pastPlans = destPlans.filter(p => !p.planned_date || new Date(p.planned_date) < today);

        if (futurePlans.length === 0 && pastPlans.length > 0) {
          signals.push('⚠ All your plans here are past — time for another visit?');
        } else if (futurePlans.length >= 2) {
          signals.push(`⚠ You have ${futurePlans.length} upcoming plans here`);
        }
      }

      const attentionBlock = renderAttentionBlock(signals);
      if (attentionBlock) lines.push(attentionBlock);
    } catch (sigErr) {
      logger.debug('[bienbot-context] Destination attention signals skipped', { error: sigErr.message });
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

  const { valid: expIdValid, objectId: expOid } = validateObjectId(experienceId, 'experienceId');
  if (!expIdValid) return null;

  try {
    const experience = await Experience.findById(expOid).populate('destination', 'name country');
    if (!experience) return null;

    const perm = await enforcer.canView({ userId, resource: experience });
    if (!perm.allowed) return null;

    const itemCount = experience.plan_items?.length || 0;

    // Fetch user's plan once — reused for display and attention signals
    let userPlanForExp = null;
    try {
      userPlanForExp = await Plan.findOne({ user: userId, experience: expOid })
        .select('planned_date plan costs currency')
        .lean();
    } catch (planFetchErr) {
      logger.debug('[bienbot-context] User plan fetch for experience skipped', { error: planFetchErr.message });
    }

    const lines = [
      `[Experience] ${experience.name}`,
      `Entity: ${entityJSON(experience._id.toString(), experience.name, 'experience')}`,
      experience.destination?.name ? `Destination: ${experience.destination.name}` : null,
      experience.destination?._id ? `Destination entity: ${entityJSON(experience.destination._id.toString(), experience.destination.name, 'destination')}` : null,
      experience.overview ? `Overview: ${experience.overview}` : null,
      experience.experience_type?.length ? `Types: ${experience.experience_type.join(', ')}` : null,
      `Plan items: ${itemCount}`,
      experience.difficulty ? `Difficulty: ${experience.difficulty}/10` : null,
      experience.rating ? `Rating: ${experience.rating}/5` : null,
      experience.visibility ? `Visibility: ${experience.visibility}` : null,
      experience.signal_tags?.length ? `Experience tags: ${experience.signal_tags.join(', ')}` : null
    ];

    // List plan items with their IDs so the LLM can reference them specifically
    // (e.g. when asked to remove a duplicate, it can identify which item to target)
    if (itemCount > 0) {
      lines.push('\nPlan items (experience template):');
      for (const item of experience.plan_items.slice(0, 15)) {
        const name = item.content || item.text || item.name || '(unnamed)';
        lines.push(`  - ${name} — ${entityJSON(item._id.toString(), name, 'plan_item')}`);
      }
    }

    // User's own plan for this specific experience
    if (userPlanForExp) {
      const planItemCount = (userPlanForExp.plan || []).length;
      const planDateStr = userPlanForExp.planned_date
        ? formatPlanDate(userPlanForExp.planned_date)
        : 'no date set';
      lines.push(`\nUser's plan for this experience: exists (${planItemCount} items, date: ${planDateStr})`);
    } else {
      lines.push("\nUser's plan for this experience: none (user has not planned this experience yet)");
    }

    // Cross-entity: Your other plans for the same destination (up to 3)
    // Caller may pass opts.userPlans to avoid a redundant DB query.
    try {
      const destId = experience.destination?._id;
      if (destId) {
        const userPlans = options.userPlans || await Plan.find({ user: userId })
          .populate({ path: 'experience', select: 'name destination', populate: { path: 'destination', select: 'name' } })
          .select('experience planned_date plan')
          .lean();
        const relatedPlans = userPlans.filter(p => {
          if (!p.experience?._id) return false;
          if (String(p.experience._id) === String(experience._id)) return false;
          const planDestId = p.experience.destination?._id || p.experience.destination;
          return String(planDestId) === String(destId);
        }).slice(0, 3);
        if (relatedPlans.length > 0) {
          lines.push('\nYour other plans nearby:');
          for (const p of relatedPlans) {
            const expName = p.experience?.name || '(unnamed)';
            const destName = p.experience?.destination?.name || experience.destination?.name || '';
            const tag = computePlanProximityTag(p);
            lines.push(`  ${expName} (${destName})${tag}`);
          }
        }
      }
    } catch (crossErr) {
      logger.debug('[bienbot-context] Cross-entity experience plans skipped', { error: crossErr.message });
    }

    // Disambiguation: other experiences at same destination
    try {
      const destId = experience.destination?._id;
      if (destId) {
        const disambigBlock = await buildDisambiguationBlock('experience', userId, {
          currentId: experience._id.toString(),
          destinationId: destId.toString(),
          destinationName: experience.destination?.name,
        });
        if (disambigBlock) lines.push('\n' + disambigBlock);
      }
    } catch (dErr) {
      logger.debug('[bienbot-context] Experience disambiguation skipped', { error: dErr.message });
    }

    // Attention signals
    try {
      const signals = [];

      // No user plan for this experience
      if (!userPlanForExp) {
        signals.push('⚠ You have no plan for this experience yet');
      } else {
        // Cost estimate without tracking
        if (experience.cost_estimate > 0 && (userPlanForExp.costs || []).length === 0) {
          const costStr = formatCostAmount(experience.cost_estimate, userPlanForExp.currency);
          signals.push(`⚠ Cost estimated at ${costStr} but nothing tracked yet`);
        }
      }

      // High difficulty with no wellness or rest items
      if (experience.difficulty >= 7) {
        const items = experience.plan_items || [];
        const hasRecovery = items.some(i => ['wellness', 'rest'].includes(i.activity_type));
        if (!hasRecovery) {
          signals.push(`⚠ Difficulty ${experience.difficulty}/10 but no rest or wellness items`);
        }
      }

      // No transport for multi-day experience
      if (experience.max_planning_days > 1) {
        const items = experience.plan_items || [];
        const hasTransport = items.some(i =>
          i.activity_type === 'transport' || i.details?.transport
        );
        if (!hasTransport) {
          signals.push('⚠ No transport items for a multi-day experience');
        }
      }

      const attentionBlock = renderAttentionBlock(signals);
      if (attentionBlock) lines.push(attentionBlock);
    } catch (sigErr) {
      logger.debug('[bienbot-context] Experience attention signals skipped', { error: sigErr.message });
    }

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

  const { valid: planIdValid, objectId: planOid } = validateObjectId(planId, 'planId');
  if (!planIdValid) return null;

  try {
    const plan = await Plan.findById(planOid)
      .populate({ path: 'experience', select: 'name destination', populate: { path: 'destination', select: 'name' } })
      .select('experience planned_date plan costs currency permissions member_locations');
    if (!plan) return null;

    const perm = await enforcer.canView({ userId, resource: plan });
    if (!perm.allowed) return null;

    const planItems = plan.plan || [];
    const totalItems = planItems.length;
    const completedItems = planItems.filter(i => i.complete).length;
    const completionPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    const lines = [
      `[Plan] for experience "${plan.experience?.name || '(unknown)'}"`,
      `Entity: ${entityJSON(plan._id.toString(), plan.experience?.name || 'plan', 'plan')}`,
      plan.experience?._id ? `Experience entity: ${entityJSON(plan.experience._id.toString(), plan.experience.name, 'experience')}` : null,
      plan.planned_date ? `Planned date: ${formatPlanDate(plan.planned_date)}` : null,
      `Completion: ${completedItems}/${totalItems} items (${completionPct}%)`,
      plan.currency ? `Currency: ${plan.currency}` : null,
      plan.costs?.length ? `Costs tracked: ${plan.costs.length}` : null,
      totalItems > 0 ? `Items:\n${planItems.slice(0, 15).map(i => `  ${i.complete ? '[x]' : '[ ]'} ${i.content || i.text || i.name || '(unnamed)'} — ${entityJSON(i._id.toString(), i.content || i.text || i.name || 'item', 'plan_item')}`).join('\n')}` : null
    ];

    // Temporal proximity buckets: TODAY / NEXT 7 DAYS / NEXT 30 DAYS
    try {
      const { todayItems, next7Items, next30Items, proximityMin } = buildTemporalBuckets(planItems);

      // Proximity header: today date + nearest scheduled item distance
      const todayStr = new Date().toISOString().split('T')[0];
      const proximityLabel = proximityMin !== null
        ? `Nearest scheduled item: ${proximityMin === 0 ? 'today' : `${proximityMin} day${proximityMin !== 1 ? 's' : ''} away`}`
        : 'No scheduled items';
      lines.push(`Today: ${todayStr} | ${proximityLabel}`);

      if (todayItems.length > 0) {
        lines.push(`\n[TODAY]`);
        for (const it of todayItems) {
          const lbl = it.content || it.text || it.name || '(unnamed)';
          const detail = buildInlineDetailSummary(it);
          lines.push(`  • ${lbl}${detail ? ' — ' + detail : ''}`);
        }
        lines.push(`[/TODAY]`);
      }
      if (next7Items.length > 0) {
        lines.push(`\n[NEXT 7 DAYS]`);
        for (const it of next7Items) {
          const lbl = it.content || it.text || it.name || '(unnamed)';
          const days = computeDaysUntil(it.scheduled_date);
          const detail = buildInlineDetailSummary(it);
          lines.push(`  • ${lbl} (in ${days}d)${detail ? ' — ' + detail : ''}`);
        }
        lines.push(`[/NEXT 7 DAYS]`);
      }
      if (next30Items.length > 0) {
        lines.push(`\n[NEXT 30 DAYS]`);
        for (const it of next30Items.slice(0, 5)) {
          const lbl = it.content || it.text || it.name || '(unnamed)';
          const days = computeDaysUntil(it.scheduled_date);
          lines.push(`  • ${lbl} (in ${days}d)`);
        }
        if (next30Items.length > 5) lines.push(`  … and ${next30Items.length - 5} more`);
        lines.push(`[/NEXT 30 DAYS]`);
      }

      // RECENT ACTIVITY bucket: items created or updated within the last 48 hours
      const cutoff48h = Date.now() - 48 * 60 * 60 * 1000;
      const recentItems = planItems.filter(i => {
        const updated = i.updatedAt ? new Date(i.updatedAt).getTime() : 0;
        const created = i.createdAt ? new Date(i.createdAt).getTime() : 0;
        return Math.max(updated, created) > cutoff48h;
      }).slice(0, 5);
      if (recentItems.length > 0) {
        lines.push(`\n[RECENT ACTIVITY (last 48h)]`);
        for (const it of recentItems) {
          const lbl = it.content || it.text || it.name || '(unnamed)';
          const wasCompleted = it.complete;
          const ts = it.updatedAt || it.createdAt;
          const dateStr = ts ? new Date(ts).toISOString().split('T')[0] : '';
          const action = wasCompleted ? 'Completed' : (it.createdAt && new Date(it.createdAt).getTime() > cutoff48h ? 'Added' : 'Updated');
          lines.push(`  ${action}: "${lbl}"${dateStr ? ` (${dateStr})` : ''}`);
        }
        lines.push(`[/RECENT ACTIVITY]`);
      }
    } catch (bucketErr) {
      logger.debug('[bienbot-context] Temporal buckets skipped', { error: bucketErr.message });
    }

    // Inject group travel signals from plan collaborators
    try {
      const memberIds = (plan.permissions || []).filter(p => p.entity === 'user').map(p => p._id);
      if (!memberIds.some(id => String(id) === String(userId))) {
        memberIds.push(userId);
      }
      const memberDocs = await User.find({ _id: { $in: memberIds } }).select('hidden_signals name').lean();
      if (memberDocs.length > 0) {
        const groupSignals = aggregateGroupSignals(memberDocs);
        const signalBlock = formatSignalBlock(groupSignals, memberDocs.length > 1 ? 'group' : 'traveler', memberDocs.length);
        if (signalBlock) lines.push(signalBlock);
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

    // Cross-entity: Your other plans for the same experience or destination (up to 2)
    // Caller may pass opts.userPlans to avoid a redundant DB query.
    try {
      const expId = plan.experience?._id;
      const planIdStr = plan._id.toString();
      const baseUserPlans = options.userPlans || await Plan.find({ user: userId, _id: { $ne: plan._id } })
        .populate({ path: 'experience', select: 'name destination', populate: { path: 'destination', select: 'name' } })
        .select('experience planned_date plan')
        .lean();
      const userOtherPlans = baseUserPlans.filter(p => String(p._id) !== planIdStr);
      // Prefer same experience first; otherwise same destination
      const sameExpPlans = userOtherPlans.filter(p => expId && String(p.experience?._id) === String(expId));
      const remainingSlots = 2 - sameExpPlans.length;
      const sameDestPlans = remainingSlots > 0 ? userOtherPlans.filter(p => {
        if (sameExpPlans.find(sp => String(sp._id) === String(p._id))) return false;
        const planDestId = p.experience?.destination?._id || p.experience?.destination;
        const curDestId = plan.experience?.destination || null;
        return curDestId && String(planDestId) === String(curDestId);
      }).slice(0, remainingSlots) : [];
      const relatedPlans = [...sameExpPlans.slice(0, 2), ...sameDestPlans];
      if (relatedPlans.length > 0) {
        lines.push('\nYour other plans nearby:');
        for (const p of relatedPlans) {
          const expName = p.experience?.name || '(unnamed)';
          const destName = p.experience?.destination?.name || '';
          const tag = computePlanProximityTag(p);
          lines.push(`  ${expName}${destName ? ` (${destName})` : ''}${tag}`);
        }
      }
    } catch (crossErr) {
      logger.debug('[bienbot-context] Cross-entity plan plans skipped', { error: crossErr.message });
    }

    // Disambiguation: user's other plans at same destination
    try {
      const expId = plan.experience?._id;
      const destId = typeof plan.experience?.destination === 'object'
        ? plan.experience?.destination?._id?.toString()
        : plan.experience?.destination?.toString();
      const destName = typeof plan.experience?.destination === 'object'
        ? plan.experience?.destination?.name
        : null;
      if (expId) {
        const disambigBlock = await buildDisambiguationBlock('plan', userId, {
          currentId: plan._id.toString(),
          experienceId: expId.toString(),
          destinationId: destId,      // Pass pre-resolved ID to avoid re-fetch
          destinationName: destName,
        });
        if (disambigBlock) lines.push('\n' + disambigBlock);
      }
    } catch (dErr) {
      logger.debug('[bienbot-context] Plan disambiguation skipped', { error: dErr.message });
    }

    // Attention signals
    try {
      const signals = [];
      const daysUntilTrip = plan.planned_date ? computeDaysUntil(plan.planned_date) : null;

      // No accommodation when trip is soon
      if (daysUntilTrip !== null && daysUntilTrip > 0 && daysUntilTrip <= 30) {
        if (planItems.length > 0 && planItems.every(i => !i.details?.accommodation)) {
          signals.push(`⚠ No accommodation booked; trip in ${daysUntilTrip} day${daysUntilTrip !== 1 ? 's' : ''}`);
        }
      }

      // Unscheduled incomplete items
      const unscheduled = planItems.filter(i => !i.scheduled_date && !i.complete);
      if (unscheduled.length > 0) {
        signals.push(`⚠ ${unscheduled.length} item${unscheduled.length !== 1 ? 's' : ''} ${unscheduled.length === 1 ? 'has' : 'have'} no scheduled date`);
      }

      // No return transport: plan has ≥2 transport items but no leg reverses another
      const transportItems = planItems.filter(
        i => i.details?.transport?.departureLocation && i.details.transport.arrivalLocation
      );
      if (transportItems.length >= 2) {
        const hasRoundTrip = transportItems.some((itemA, i) =>
          transportItems.some((itemB, j) => {
            if (i === j) return false;
            return itemA.details.transport.arrivalLocation.toLowerCase().trim() ===
                   itemB.details.transport.departureLocation.toLowerCase().trim();
          })
        );
        if (!hasRoundTrip) {
          signals.push('⚠ No return transport detected');
        }
      }

      // Overdue incomplete items
      const overdueItems = planItems.filter(i => {
        if (i.complete || !i.scheduled_date) return false;
        return computeDaysUntil(i.scheduled_date) < 0;
      });
      if (overdueItems.length > 0) {
        signals.push(`⚠ ${overdueItems.length} item${overdueItems.length !== 1 ? 's' : ''} overdue`);
      }

      // No costs tracked when there are items
      if (planItems.length > 0 && (plan.costs || []).length === 0) {
        signals.push('⚠ No costs tracked yet');
      }

      // All items complete
      if (totalItems > 0 && completedItems === totalItems) {
        signals.push('⚠ All items complete — consider archiving');
      }

      const attentionBlock = renderAttentionBlock(signals);
      if (attentionBlock) lines.push(attentionBlock);
    } catch (sigErr) {
      logger.debug('[bienbot-context] Plan attention signals skipped', { error: sigErr.message });
    }

    // Collaborators and member locations block
    try {
      const userPermissions = (plan.permissions || []).filter(p => p.entity === 'user');
      if (userPermissions.length > 0) {
        const memberUserIds = userPermissions.map(p => p._id);
        const memberUsers = await User.find({ _id: { $in: memberUserIds } }).select('name').lean();
        const memberMap = Object.fromEntries(memberUsers.map(u => [String(u._id), u.name]));
        const memberLocationMap = Object.fromEntries(
          (plan.member_locations || []).map(ml => [String(ml.user), ml])
        );
        const collaboratorLines = userPermissions.map(p => {
          const uid = String(p._id);
          const name = memberMap[uid] || 'Unknown';
          const role = p.type || 'collaborator';
          const ml = memberLocationMap[uid];
          let locationStr = '';
          if (ml?.location) {
            const loc = ml.location;
            const parts = [loc.city, loc.state, loc.country].filter(Boolean);
            if (parts.length > 0) {
              locationStr = ` — travel origin: ${parts.join(', ')}`;
              if (ml.travel_cost_estimate) {
                locationStr += ` (est. ${ml.travel_cost_estimate} ${ml.currency || 'USD'})`;
              }
            }
          }
          return `  - ${name} (${role}, _id: ${uid})${locationStr}`;
        });
        lines.push(`\n[COLLABORATORS]\n${collaboratorLines.join('\n')}\n[/COLLABORATORS]`);
      }
    } catch (collabErr) {
      logger.debug('[bienbot-context] Collaborators block skipped', { error: collabErr.message });
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

  const { valid: planIdValid, objectId: planOid } = validateObjectId(planId, 'planId');
  if (!planIdValid) return null;

  try {
    const plan = await Plan.findById(planOid)
      .populate('experience', 'name')
      .select('experience plan costs currency permissions');
    if (!plan) return null;

    const perm = await enforcer.canView({ userId, resource: plan });
    if (!perm.allowed) return null;

    const planItems = plan.plan || [];
    const itemIdStr = String(itemId);
    const item = planItems.find(i => String(i._id) === itemIdStr);
    if (!item) return null;

    const itemName = item.content || item.text || item.name || '(unnamed)';

    // Temporal proximity
    const daysUntil = computeDaysUntil(item.scheduled_date);
    let proximityLine = null;
    if (daysUntil !== null) {
      if (daysUntil === 0) proximityLine = 'Proximity: TODAY';
      else if (daysUntil > 0) proximityLine = `Proximity: in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`;
      else proximityLine = `Proximity: ${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? '' : 's'} overdue`;
    }

    const lines = [
      `[Plan Item] ${itemName}`,
      `Entity: ${entityJSON(item._id.toString(), itemName, 'plan_item')}`,
      `Plan: "${plan.experience?.name || '(unknown)'}"`,
      plan._id ? `Plan entity: ${entityJSON(plan._id.toString(), plan.experience?.name || 'plan', 'plan')}` : null,
      `Status: ${item.complete ? 'completed' : 'pending'}`,
      item.scheduled_date ? `Scheduled: ${new Date(item.scheduled_date).toISOString().split('T')[0]}` : null,
      proximityLine,
      item.activity_type ? `Type: ${item.activity_type}` : null,
      item.cost ? `Item cost: ${item.cost}${plan.currency ? ' ' + plan.currency : ''}` : null
    ];

    // Typed detail extensions
    const DETAIL_TYPES = ['transport', 'accommodation', 'parking', 'discount'];
    let hasDetail = false;
    for (const type of DETAIL_TYPES) {
      const d = item.details?.[type];
      if (d) {
        const line = formatDetailLine(type, d);
        if (line) { lines.push(line); hasDetail = true; }
      }
    }
    if (item.details?.notes?.length) {
      // Expose note IDs so the LLM can reference them in update_plan_item_note / delete_plan_item_note actions.
      // Private notes are only shown to their author.
      const visibleNotes = item.details.notes.filter(
        n => n.visibility !== 'private' || String(n.user) === String(userId)
      );
      if (visibleNotes.length > 0) {
        lines.push(`Notes (${visibleNotes.length}):`);
        for (const note of visibleNotes) {
          const noteId = note._id?.toString();
          const privateTag = note.visibility === 'private' ? ' [private]' : '';
          lines.push(`  • [id:${noteId}]${privateTag} ${note.content}`);
        }
      }
    }
    if (item.details?.documents?.length) {
      lines.push(`Documents: ${item.details.documents.length} attached`);
    }

    // Associated costs from plan.costs linked to this item
    try {
      const linkedCosts = (plan.costs || []).filter(c => c.plan_item && String(c.plan_item) === itemIdStr);
      if (linkedCosts.length > 0) {
        const total = linkedCosts.reduce((s, c) => s + (c.cost || 0), 0);
        lines.push(`Tracked costs: ${linkedCosts.length} (total ${total}${plan.currency ? ' ' + plan.currency : ''})`);
        for (const c of linkedCosts.slice(0, 3)) {
          lines.push(`  • ${c.title}: ${c.cost}${c.currency ? ' ' + c.currency : ''}`);
        }
      }
    } catch (costErr) {
      logger.debug('[bienbot-context] Plan item cost injection skipped', { error: costErr.message });
    }

    // Hidden signals for the user viewing this item
    try {
      const userDoc = await User.findById(userId).select('hidden_signals').lean();
      const signalBlock = formatSignalBlock(userDoc?.hidden_signals, 'traveler');
      if (signalBlock) lines.push(signalBlock);
    } catch (sigErr) {
      logger.debug('[bienbot-context] Plan item signal injection skipped', { error: sigErr.message });
    }

    // Disambiguation: similar items in this plan
    try {
      // Normalize planItems so that findSimilarItems can match on 'content'
      // (plan snapshot items use 'text', but buildDisambiguationBlock searches on 'content')
      const normalizedItems = planItems.map(i => ({
        ...i,
        content: i.content || i.text || i.name || '',
      }));
      const disambigBlock = await buildDisambiguationBlock('plan_item', userId, {
        currentId: itemIdStr,
        planItems: normalizedItems,
        currentItemContent: itemName,
      });
      if (disambigBlock) lines.push('\n' + disambigBlock);
    } catch (dErr) {
      logger.debug('[bienbot-context] Plan item disambiguation skipped', { error: dErr.message });
    }

    // Attention signals
    try {
      const signals = [];

      // Accommodation missing check-out
      const accomm = item.details?.accommodation;
      if (accomm?.checkIn && !accomm.checkOut) {
        signals.push('⚠ Accommodation missing check-out date');
      }

      // Transport missing one leg
      const transport = item.details?.transport;
      if (transport) {
        const hasDeparture = transport.departureLocation && transport.departureLocation.trim().length > 0;
        const hasArrival = transport.arrivalLocation && transport.arrivalLocation.trim().length > 0;
        if (hasDeparture !== hasArrival) {
          signals.push('⚠ Transport entry is missing arrival/departure');
        }
      }

      // No cost while sibling items have costs
      if (!item.cost || item.cost === 0) {
        const siblingCosts = (plan.costs || []).filter(c =>
          c.plan_item && String(c.plan_item) !== itemIdStr && (c.cost || 0) > 0
        );
        if (siblingCosts.length > 0) {
          const avg = Math.round(
            siblingCosts.reduce((sum, c) => sum + c.cost, 0) / siblingCosts.length
          );
          signals.push(`⚠ No cost tracked; other items average $${avg}`);
        }
      }

      // Overdue signal — reinforces the proximity line with an actionable alert
      if (!item.complete && daysUntil !== null && daysUntil < 0) {
        signals.push(`⚠ This item is ${Math.abs(daysUntil)} day${Math.abs(daysUntil) !== 1 ? 's' : ''} overdue`);
      }

      const attentionBlock = renderAttentionBlock(signals);
      if (attentionBlock) lines.push(attentionBlock);
    } catch (sigErr) {
      logger.debug('[bienbot-context] Plan item attention signals skipped', { error: sigErr.message });
    }

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

  const { valid: userIdValid, objectId: userOid } = validateObjectId(targetUserId, 'targetUserId');
  if (!userIdValid) return null;

  try {
    const { Types } = require('mongoose');
    const Follow = require('../models/follow');

    const [user, experienceCount, followerCount, followingCount] = await Promise.all([
      User.findById(userOid)
        .select('name email preferences bio links feature_flags'),
      Experience.countDocuments({
        permissions: { $elemMatch: { _id: new Types.ObjectId(targetUserId), entity: 'user', type: 'owner' } }
      }),
      Follow.countDocuments({ following: userOid }),
      Follow.countDocuments({ user: userOid })
    ]);

    if (!user) return null;

    const lines = [
      `[User] ${user.name || '(unnamed)'}`,
      `Entity: ${entityJSON(user._id.toString(), user.name || '(unnamed)', 'user')}`,
      user.email ? `Email: ${user.email}` : null,
      user.bio ? `Bio: ${user.bio}` : null,
      user.preferences?.currency ? `Currency: ${user.preferences.currency}` : null,
      user.preferences?.timezone ? `Timezone: ${user.preferences.timezone}` : null,
      user.links?.length ? `Links: ${user.links.map(l => l.title || l.url).join(', ')}` : null,
      experienceCount > 0
        ? `Experiences created: ${experienceCount}  (use list_user_experiences to fetch them)`
        : null,
      `Followers: ${followerCount}  Following: ${followingCount}  (use list_user_followers to list them)`
    ];

    return trimToTokenBudget(lines.filter(Boolean).join('\n'), options.tokenBudget || DEFAULT_TOKEN_BUDGET);
  } catch (err) {
    logger.error('[bienbot-context] buildUserProfileContext failed', { targetUserId, error: err.message });
    return null;
  }
}

/**
 * Build a greeting/overview context for a user — used when BienBot is opened
 * from a non-entity page (e.g. FAB on dashboard or profile).
 * Includes: active plans with experience + destination entity refs, temporal
 * proximity, today/next7 items, recent activity with entity refs, imminent
 * incomplete items, plans without dates, hidden travel signals, and overdue items.
 * Every entity mentioned carries an inline entityJSON ref so follow-up questions
 * ("which item is overdue?", "show me my Paris plans", "what did I do recently?")
 * can be answered with real IDs and navigation can be proposed immediately.
 */

/** Maps Activity model resource.type values to entityJSON type strings. */
const ACTIVITY_TYPE_MAP = {
  Experience: 'experience',
  Destination: 'destination',
  Plan: 'plan',
  PlanItem: 'plan_item',
  User: 'user'
};

async function buildUserGreetingContext(userId, options = {}) {
  loadModels();
  const { valid: userIdValid, objectId: userOid } = validateObjectId(userId, 'userId');
  if (!userIdValid) return null;

  try {
    const { Types } = require('mongoose');

    // Fetch user profile, plans (with experience + destination), and recent activities in parallel.
    // Activity model stores resource.name and resource.id so no additional lookups are needed.
    const [userDoc, plans, recentActivities] = await Promise.all([
      User.findById(userOid).select('name hidden_signals preferences').lean(),
      Plan.find({ 'permissions': { $elemMatch: { _id: new Types.ObjectId(userId), entity: 'user' } } })
        .populate({ path: 'experience', select: 'name destination', populate: { path: 'destination', select: 'name' } })
        .select('experience planned_date plan permissions')
        .sort({ planned_date: 1 })
        .limit(10)
        .lean(),
      Activity.find({ 'actor._id': new Types.ObjectId(userId) })
        .sort({ createdAt: -1 })
        .limit(20)
        .select('resource target action createdAt')
        .lean()
    ]);

    if (!userDoc) return null;

    const today = new Date(); today.setHours(0, 0, 0, 0);

    const lines = [
      `[User Greeting] Hello, ${userDoc.name || 'traveler'}`,
      `Entity: ${entityJSON(userId, userDoc.name || 'traveler', 'user')}`
    ];

    // ------------------------------------------------------------------
    // Active plans — ALL up to 10, each with experience + destination refs
    // ------------------------------------------------------------------
    if (plans.length > 0) {
      lines.push(`\nActive plans (${plans.length}):`);
      for (const plan of plans) {
        const expName = plan.experience?.name || '(unknown)';
        const expId = plan.experience?._id?.toString() || null;
        const destName = plan.experience?.destination?.name || null;
        const destId = plan.experience?.destination?._id?.toString() || null;
        const planId = plan._id.toString();
        const planItems = plan.plan || [];
        const totalItems = planItems.length;
        const completedItems = planItems.filter(i => i.complete).length;
        const daysUntil = plan.planned_date ? computeDaysUntil(plan.planned_date) : null;

        let proximityTag = '';
        if (daysUntil !== null) {
          if (daysUntil === 0) proximityTag = ' [TODAY]';
          else if (daysUntil > 0 && daysUntil <= 7) proximityTag = ` [in ${daysUntil}d]`;
          else if (daysUntil > 7 && daysUntil <= 30) proximityTag = ` [in ${daysUntil}d]`;
          else if (daysUntil < 0) proximityTag = ` [${Math.abs(daysUntil)}d ago]`;
        }
        const dateStr = plan.planned_date ? new Date(plan.planned_date).toISOString().split('T')[0] : 'no date set';
        const itemsLabel = totalItems === 0 ? 'no items yet' : `${totalItems} item${totalItems !== 1 ? 's' : ''} (${completedItems} completed)`;

        // Build entity ref suffix: plan + experience + destination (all refs on one line)
        let entityRefs = `Plan: ${entityJSON(planId, expName, 'plan')}`;
        if (expId) entityRefs += ` Experience: ${entityJSON(expId, expName, 'experience')}`;
        if (destId && destName) entityRefs += ` Destination: ${entityJSON(destId, destName, 'destination')}`;

        lines.push(`  • ${expName}${proximityTag} (${dateStr}) — ${itemsLabel} — ${entityRefs}`);

        // Surface today/imminent items from this plan (with entity refs)
        const { todayItems, next7Items } = buildTemporalBuckets(planItems);
        for (const it of todayItems.slice(0, 2)) {
          const lbl = it.content || it.text || it.name || '(unnamed)';
          lines.push(`    ↳ TODAY: ${lbl} — ${entityJSON(it._id.toString(), lbl, 'plan_item')}`);
        }
        for (const it of next7Items.slice(0, 2)) {
          const lbl = it.content || it.text || it.name || '(unnamed)';
          const days = computeDaysUntil(it.scheduled_date);
          lines.push(`    ↳ in ${days}d: ${lbl} — ${entityJSON(it._id.toString(), lbl, 'plan_item')}`);
        }
      }
    } else {
      lines.push(`\nNo active plans yet.`);
    }

    // ------------------------------------------------------------------
    // Recent activity — entity refs per event so follow-ups can navigate
    // ------------------------------------------------------------------
    try {
      const cutoff = Date.now() - 48 * 60 * 60 * 1000;
      const recent48h = recentActivities.filter(a => new Date(a.createdAt).getTime() > cutoff);
      if (recent48h.length > 0) {
        lines.push(`\n[RECENT ACTIVITY (48h)]`);
        for (const a of recent48h.slice(0, 10)) {
          const resourceName = a.resource?.name || null;
          const resourceId = a.resource?.id?.toString() || null;
          const resourceType = ACTIVITY_TYPE_MAP[a.resource?.type] || null;

          let activityLine = `  • ${a.action}`;
          if (resourceName) activityLine += ` — "${resourceName}"`;
          if (resourceId && resourceType && resourceName) {
            activityLine += ` ${entityJSON(resourceId, resourceName, resourceType)}`;
          }
          // Include target entity ref for relationship actions (e.g. collaborator added)
          if (a.target?.id && a.target?.name && ACTIVITY_TYPE_MAP[a.target?.type]) {
            const targetType = ACTIVITY_TYPE_MAP[a.target.type];
            activityLine += ` → ${entityJSON(a.target.id.toString(), a.target.name, targetType)}`;
          }
          lines.push(activityLine);
        }
        lines.push(`[/RECENT ACTIVITY]`);
      }
    } catch (actErr) {
      logger.debug('[bienbot-context] Greeting activity section skipped', { error: actErr.message });
    }

    // ------------------------------------------------------------------
    // Hidden travel signals
    // ------------------------------------------------------------------
    try {
      const signalBlock = formatSignalBlock(userDoc.hidden_signals, 'traveler');
      if (signalBlock) lines.push('\n' + signalBlock);
    } catch (sigErr) {
      logger.debug('[bienbot-context] Greeting signal injection skipped', { error: sigErr.message });
    }

    // ------------------------------------------------------------------
    // Attention signals + detailed entity sections
    // ------------------------------------------------------------------
    try {
      const attentionSignals = [];

      // Collect imminent incomplete items (≤7 days) with full entity refs
      const imminentIncompleteItems = [];
      // Collect empty plans with entity refs
      const emptyPlanRefs = [];
      // Collect plans without a date set
      const undatedPlanRefs = [];

      for (const plan of (plans || [])) {
        const planItems = plan.plan || [];
        const expName = plan.experience?.name || 'this trip';
        const expId = plan.experience?._id?.toString() || null;
        const destName = plan.experience?.destination?.name || null;
        const destId = plan.experience?.destination?._id?.toString() || null;
        const planId = plan._id.toString();

        const daysUntilTrip = plan.planned_date
          ? Math.round((new Date(plan.planned_date).setHours(0, 0, 0, 0) - today) / 86400000)
          : null;

        // Plans with no planned date
        if (!plan.planned_date) {
          undatedPlanRefs.push({ planId, expName, expId, destName, destId });
        }

        // Empty plans
        if (planItems.length === 0) {
          const planRef = entityJSON(planId, expName, 'plan');
          const expRef = expId ? ` Experience: ${entityJSON(expId, expName, 'experience')}` : '';
          attentionSignals.push(`⚠ Your "${expName}" plan has no items yet — Plan: ${planRef}${expRef}`);
          emptyPlanRefs.push({ planId, expName, expId, destName, destId });
        }

        // Imminent trip (≤7 days) with open items
        if (daysUntilTrip !== null && daysUntilTrip >= 0 && daysUntilTrip <= 7) {
          const incomplete = planItems.filter(i => !i.complete);
          if (incomplete.length > 0) {
            const planRef = entityJSON(planId, expName, 'plan');
            attentionSignals.push(
              `⚠ ${incomplete.length} item${incomplete.length !== 1 ? 's' : ''} still open on your "${expName}" trip in ${daysUntilTrip} day${daysUntilTrip !== 1 ? 's' : ''} — Plan: ${planRef}`
            );
            for (const item of incomplete.slice(0, 5)) {
              const itemName = item.content || item.text || '(unnamed item)';
              imminentIncompleteItems.push({ planId, expName, expId, destName, destId, item, itemName, daysUntilTrip });
            }
          }
        }
      }

      // Aggregate overdue items across all plans — collect full details for entity refs
      const overdueItemDetails = [];
      for (const plan of (plans || [])) {
        const planItems = plan.plan || [];
        const planId = plan._id.toString();
        const expName = plan.experience?.name || 'this trip';
        const expId = plan.experience?._id?.toString() || null;
        const destName = plan.experience?.destination?.name || null;
        const destId = plan.experience?.destination?._id?.toString() || null;
        for (const item of planItems) {
          if (item.complete || !item.scheduled_date) continue;
          const d = new Date(item.scheduled_date); d.setHours(0, 0, 0, 0);
          if (d < today) {
            const daysOverdue = Math.round((today - d) / 86400000);
            const itemName = item.content || item.text || '(unnamed item)';
            overdueItemDetails.push({ planId, expName, expId, destName, destId, item, itemName, daysOverdue });
          }
        }
      }
      const totalOverdue = overdueItemDetails.length;
      if (totalOverdue > 0) {
        attentionSignals.push(`⚠ You have ${totalOverdue} overdue item${totalOverdue !== 1 ? 's' : ''} across your plans—worth reviewing first`);
      }

      const attentionBlock = renderAttentionBlock(attentionSignals, 6);
      if (attentionBlock) lines.push(attentionBlock);

      // Detailed overdue items — BienBot can answer "which item is overdue?" and propose navigation
      if (overdueItemDetails.length > 0) {
        lines.push(`\n[OVERDUE ITEMS]`);
        for (const { planId, expName, expId, destName, destId, item, itemName, daysOverdue } of overdueItemDetails.slice(0, 10)) {
          const planRef = entityJSON(planId, expName, 'plan');
          const itemRef = entityJSON(item._id.toString(), itemName, 'plan_item');
          const expRef = expId ? ` Experience: ${entityJSON(expId, expName, 'experience')}` : '';
          const destRef = destId && destName ? ` Destination: ${entityJSON(destId, destName, 'destination')}` : '';
          lines.push(`  • ${itemName} (${daysOverdue}d overdue) in "${expName}" — Item: ${itemRef} Plan: ${planRef}${expRef}${destRef}`);
        }
        lines.push(`[/OVERDUE ITEMS]`);
      }

      // Imminent incomplete items — BienBot can answer "what's still open for my trip this week?"
      if (imminentIncompleteItems.length > 0) {
        lines.push(`\n[IMMINENT INCOMPLETE ITEMS]`);
        for (const { planId, expName, expId, destName, destId, item, itemName, daysUntilTrip } of imminentIncompleteItems.slice(0, 10)) {
          const planRef = entityJSON(planId, expName, 'plan');
          const itemRef = entityJSON(item._id.toString(), itemName, 'plan_item');
          const expRef = expId ? ` Experience: ${entityJSON(expId, expName, 'experience')}` : '';
          const destRef = destId && destName ? ` Destination: ${entityJSON(destId, destName, 'destination')}` : '';
          lines.push(`  • ${itemName} (trip in ${daysUntilTrip}d — "${expName}") — Item: ${itemRef} Plan: ${planRef}${expRef}${destRef}`);
        }
        lines.push(`[/IMMINENT INCOMPLETE ITEMS]`);
      }

      // Plans without a date — BienBot can surface these and ask the user to set one
      if (undatedPlanRefs.length > 0) {
        lines.push(`\n[PLANS WITHOUT DATE]`);
        for (const { planId, expName, expId, destName, destId } of undatedPlanRefs.slice(0, 5)) {
          const planRef = entityJSON(planId, expName, 'plan');
          const expRef = expId ? ` Experience: ${entityJSON(expId, expName, 'experience')}` : '';
          const destRef = destId && destName ? ` Destination: ${entityJSON(destId, destName, 'destination')}` : '';
          lines.push(`  • "${expName}" — no trip date set — Plan: ${planRef}${expRef}${destRef}`);
        }
        lines.push(`[/PLANS WITHOUT DATE]`);
      }
    } catch (sigErr) {
      logger.debug('[bienbot-context] Greeting attention signals skipped', { error: sigErr.message });
    }

    // Greeting context is the sole context block for QUERY_DASHBOARD — use a larger
    // budget (2500 tokens) so the enriched entity refs are not truncated.
    return trimToTokenBudget(lines.filter(Boolean).join('\n'), options.tokenBudget || 2500);
  } catch (err) {
    logger.error('[bienbot-context] buildUserGreetingContext failed', { userId, error: err.message });
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

    // Search destinations, experiences, and user plans in parallel
    const [destinations, experiences, userPlans] = await Promise.all([
      Destination.find({ visibility: 'public' }).select('name country overview').limit(100).lean(),
      Experience.find({ visibility: 'public' }).select('name overview destination').populate('destination', 'name').limit(100).lean(),
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
    const plan = await Plan.findById(planId).populate('experience', 'name')
      .select('experience plan costs permissions');
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
 * Map dimension names to qualitative natural-language driver descriptions.
 * Each entry describes what a strong alignment on that dimension means for the
 * user ↔ entity relationship. Used by both the [AFFINITY] block and discovery
 * results so the LLM can compose coherent dialogue without numeric terms.
 */
const DIM_DRIVER_DESCRIPTIONS = {
  energy:             'shared preference for activity level',
  novelty:            'mutual interest in novel, off-the-beaten-path experiences',
  budget_sensitivity: 'aligned budget expectations',
  social:             'similar social orientation for group or solo travel',
  structure:          'compatible need for planning and structure',
  food_focus:         'shared interest in food and culinary experiences',
  cultural_depth:     'mutual appreciation for cultural depth and local immersion',
  comfort_zone:       'similar comfort zone and willingness to try new things'
};

/**
 * Convert an array of top_dims entries (or bare dimension names) into a
 * comma-separated list of human-readable driver descriptions.
 *
 * @param {Array<{dim: string}|string>} dims - top_dims entries or dimension name strings.
 * @returns {string} Comma-separated qualitative descriptions, or '' if empty.
 */
function describeDimDrivers(dims) {
  if (!Array.isArray(dims) || dims.length === 0) return '';
  return dims
    .map(d => {
      const name = typeof d === 'string' ? d : d?.dim;
      return DIM_DRIVER_DESCRIPTIONS[name] || name;
    })
    .filter(Boolean)
    .join(', ');
}

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
      const contextStr = await buildUserPlanContext(id, userId, options);
      if (!contextStr) return null;
      // Resolve the experience_id for affinity enrichment from the plan context.
      // buildUserPlanContext populates plan.experience._id — re-fetch just the field.
      let planExperienceId = null;
      try {
        loadModels();
        const planDoc = await Plan.findById(id).select('experience').lean();
        planExperienceId = planDoc?.experience?.toString() || null;
      } catch (planExpErr) {
        logger.warn('[bienbot-context] Could not resolve experience_id for plan affinity block', { planId: id, error: planExpErr.message });
      }
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
 * Uses collaborative filtering to discover experiences planned by similar users.
 * Two-stage pipeline: find similar users → find co-occurring experiences → rank.
 *
 * @param {Object} filters - { activity_types, destination_id, destination_name, max_cost, cross_destination, min_plans }
 * @param {string} userId - Querying user's ID
 * @param {Object} [options] - { limit }
 * @returns {Promise<Object|null>} { contextBlock, results, query_metadata } or null if no results
 */
async function buildDiscoveryContext(filters = {}, userId, options = {}) {
  const { getCacheKey, createDiscoveryCache } = require('./discovery-cache');
  const UserModel = require('../models/user');

  const limit = options.limit || 8;
  const cacheKey = getCacheKey(filters);
  const cache = createDiscoveryCache();

  try {
    // Check cache
    let candidates = await cache.get(cacheKey);
    let cacheHit = !!candidates;

    if (!candidates) {
      // Stage 1: Find similar users (requires activity_types)
      const similarUsers = await findSimilarUsers(filters, userId);

      if (similarUsers.length > 0) {
        // Stage 2: Find co-occurring experiences
        candidates = await findCoOccurringExperiences(similarUsers, filters, userId);
        if (candidates.length > 0) {
          logger.debug('[bienbot-context] Collaborative filtering produced candidates', { count: candidates.length });
        } else {
          logger.debug('[bienbot-context] No co-occurring experiences found, falling back to popularity', { filters, userId });
        }
      } else {
        logger.debug('[bienbot-context] No similar users found, falling back to popularity', { filters, userId });
      }

      // Fallback: popularity-based discovery when collaborative filtering yields nothing
      // (happens when activity_types are omitted or data is sparse)
      if (!candidates || !candidates.length) {
        candidates = await findPopularExperiences(filters, userId);
      }

      if (!candidates.length) {
        logger.debug('[bienbot-context] No experiences found for filters', { filters, userId });
        return null;
      }

      await cache.set(cacheKey, candidates);
    }

    // Fetch user's hidden signals for personalized ranking
    let signals = null;
    try {
      const user = await UserModel.findById(userId).select('hidden_signals').lean();
      if (user?.hidden_signals) {
        signals = applySignalDecay(user.hidden_signals);
      }
    } catch (err) {
      logger.warn('[bienbot-context] Failed to fetch user signals for ranking', { userId, error: err.message });
    }

    // Compute adaptive weights (personalized by user behavioral signals)
    const weights = computeAdaptiveWeights(signals);

    const allCosts = candidates.map(c => c.cost_estimate).filter(Boolean);
    const maxCoOccurrence = Math.max(...candidates.map(c => c.co_occurrence_count), 1);
    const maxCollaborators = Math.max(...candidates.map(c => c.collaborator_count), 1);

    // Load pre-computed content signals from Experience documents.
    // One secondary query keyed by experience_id — avoids modifying the aggregation pipeline.
    // Experiences whose signals haven't been computed yet fall back to neutral defaults.
    let experienceSignalsMap = new Map();
    try {
      const ExperienceModel = require('../models/experience');
      const candidateIds = candidates.map(c => c.experience_id).filter(Boolean);
      const storedSignalDocs = await ExperienceModel
        .find({ _id: { $in: candidateIds } })
        .select('signals hidden_signals')
        .lean();
      for (const doc of storedSignalDocs) {
        if (doc._id) experienceSignalsMap.set(doc._id.toString(), {
          signals: doc.signals || null,
          hidden_signals: doc.hidden_signals || null
        });
      }
    } catch (err) {
      logger.warn('[bienbot-context] Failed to load stored content signals; falling back to neutral', { error: err.message });
    }

    // Compute per-candidate-set maximums for popularity normalisation.
    // This makes each candidate's popularity score relative to the destination
    // context rather than a global absolute value.
    const maxPopularity = {
      planCount:             Math.max(...[...experienceSignalsMap.values()].map(s => s?.signals?.popularity?.planCount             || 0), 1),
      planCountWithActivity: Math.max(...[...experienceSignalsMap.values()].map(s => s?.signals?.popularity?.planCountWithActivity || 0), 1),
      completedPlanCount:    Math.max(...[...experienceSignalsMap.values()].map(s => s?.signals?.popularity?.completedPlanCount    || 0), 1)
    };

    const formula = signalsConfig.formula;

    // Load affinity map once for all candidates (cache-first; empty Map on failure or missing userId)
    let affinityMap = new Map();
    if (userId) {
      try {
        affinityMap = await affinityCache.getAffinityMap(userId);
      } catch (affinityErr) {
        logger.warn('[bienbot-context] Failed to load affinity map for discovery ranking', { userId, error: affinityErr.message });
      }
    }

    // Score and rank
    const scored = candidates.map(c => {
      const recencyScore = computeRecencyScore(c.latest_planned_date);

      // Adaptive score: existing multi-factor formula personalized by user behavioral signals.
      // Weights are re-normalized internally by computeAdaptiveWeights.
      const adaptiveScore =
        weights.plan_count      * normalizeCount(c.co_occurrence_count, maxCoOccurrence) +
        weights.completion_rate * (c.avg_completion_rate || 0) +
        weights.recency         * recencyScore +
        weights.collaborators   * normalizeCount(c.collaborator_count, maxCollaborators) +
        weights.cost_alignment  * computeCostAlignment(c.cost_estimate, signals, allCosts);

      // Stored content signals — neutral defaults for experiences not yet computed.
      // trustScore null → 0.5 (unknown, not penalised); popularity absent → 0.
      const storedEntry    = experienceSignalsMap.get(c.experience_id.toString());
      const storedSignals  = storedEntry?.signals   || null;
      const entityBehavior = storedEntry?.hidden_signals || null;
      const trustScore     = storedSignals?.trustScore ?? 0.5;
      const popularityNorm = computePopularityScore(
        storedSignals?.popularity || {},
        maxPopularity
      );

      // Affinity: use pre-loaded cache entry when available; fall back to live
      // computation for cold-cache candidates (avoids per-candidate DB round-trips).
      // On a cache miss, fire-and-forget computeAndCacheAffinity so subsequent
      // requests for the same (user, experience) pair hit the cache.
      const cachedAffinity = affinityMap.get(c.experience_id.toString());
      let affinityScore;
      let affinityDrivers = '';
      if (cachedAffinity) {
        affinityScore = cachedAffinity.score;
        if (cachedAffinity.top_dims?.length) {
          affinityDrivers = describeDimDrivers(cachedAffinity.top_dims);
        }
      } else {
        affinityScore = computeAffinityScore(signals, entityBehavior);
        // Warm the cache asynchronously — never awaited, never throws
        computeAndCacheAffinity(userId, c.experience_id).catch(() => {});
      }

      // Blended formula: formula coefficients from signalsConfig (SIGNALS_CONFIG env var).
      // recencyBoost is always computed fresh — not stored — so it stays accurate between
      // signal update events.
      const relevanceScore =
        formula.adaptiveFactor * adaptiveScore   +
        formula.trustScore     * trustScore      +
        formula.popularity     * popularityNorm  +
        formula.recencyBoost   * recencyScore    +
        formula.affinity       * affinityScore;

      const matchReason = generateMatchReason(
        { ...c, recency_score: recencyScore },
        weights,
        filters.activity_types
      );

      return {
        experience_id: c.experience_id.toString(),
        experience_name: c.experience_name,
        destination_name: c.destination_name,
        destination_id: c.destination_id?.toString(),
        activity_types: c.activity_types || [],
        cost_estimate: c.cost_estimate,
        plan_count: c.co_occurrence_count,
        completion_rate: c.avg_completion_rate,
        collaborator_count: c.collaborator_count,
        trust_score: Math.round(trustScore * 1000) / 1000,
        popularity_score: Math.round(popularityNorm * 1000) / 1000,
        affinity_score: Math.round(affinityScore * 1000) / 1000,
        affinity_drivers: affinityDrivers,
        relevance_score: Math.round(relevanceScore * 1000) / 1000,
        match_reason: matchReason,
        default_photo_url: c.default_photo_url
      };
    });

    scored.sort((a, b) => b.relevance_score - a.relevance_score);
    const results = scored.slice(0, limit);

    if (!results.length) return null;

    const contextBlock = formatDiscoveryContextBlock(results, filters);

    // Signal feedback (fire-and-forget)
    try {
      const expandedTypes = expandActivityTypes(filters.activity_types);
      const { processSignalEvent } = require('./hidden-signals');
      processSignalEvent(userId, {
        type: 'search',
        metadata: {
          source: 'discovery',
          activity_type: expandedTypes[0] || null,
          all_activity_types: expandedTypes,
          result_count: results.length
        }
      });
    } catch (e) {
      // Silently ignore signal event errors
    }

    logger.info('[bienbot-context] buildDiscoveryContext completed', {
      userId,
      resultCount: results.length,
      cacheHit,
      crossDestination: !!(filters.cross_destination || (!filters.destination_id && !filters.destination_name))
    });

    return {
      contextBlock,
      results,
      query_metadata: {
        filters_applied: filters,
        cache_hit: cacheHit,
        result_count: results.length,
        cross_destination: !!(filters.cross_destination || (!filters.destination_id && !filters.destination_name))
      }
    };
  } catch (err) {
    logger.error('[bienbot-context] buildDiscoveryContext failed', { error: err.message });
    return null;
  }
}

/**
 * Format discovery results into a text context block for the LLM.
 */
function formatDiscoveryContextBlock(results, filters) {
  const header = filters.activity_types?.length
    ? `Discovery results for ${filters.activity_types.join(', ')} experiences`
    : 'Discovery results';

  // Qualitative popularity labels — avoid exposing raw counts to the LLM
  const popularityLabel = (planCount) => {
    if (!planCount || planCount <= 0) return 'new';
    if (planCount <= 2) return 'emerging';
    if (planCount <= 10) return 'popular';
    return 'very popular';
  };

  const completionLabel = (rate) => {
    if (rate == null || rate <= 0) return null;
    if (rate >= 0.8) return 'very high completion';
    if (rate >= 0.5) return 'solid completion';
    if (rate >= 0.2) return 'moderate completion';
    return null;
  };

  const affinityLabel = (score) => {
    if (score == null) return null;
    if (score > 0.6) return 'strong match for your travel style';
    if (score >= 0.4) return 'moderate match for your travel style';
    if (score < 0.4) return 'different from your usual travel style';
    return null;
  };

  const lines = results.map((r, i) => {
    const parts = [
      `${i + 1}. ${r.experience_name} (${r.destination_name})`,
      popularityLabel(r.plan_count) + ' among travelers'
    ];
    const compLabel = completionLabel(r.completion_rate);
    if (compLabel) parts.push(compLabel);
    const affLabel = affinityLabel(r.affinity_score);
    if (affLabel) parts.push(affLabel);
    if (r.affinity_drivers) parts.push(`driven by ${r.affinity_drivers}`);
    parts.push(r.match_reason);
    return parts.join(' — ');
  });

  return `[DISCOVERY RESULTS]\n${header}:\n${lines.join('\n')}\n[/DISCOVERY RESULTS]`;
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

// ---------------------------------------------------------------------------
// Stage 1: Find users who planned matching activity types
// ---------------------------------------------------------------------------

async function findSimilarUsers(filters, userId) {
  const activityTypes = expandActivityTypes(filters.activity_types);
  if (!activityTypes.length) return [];

  const Plan = require('../models/plan');
  const { Types } = require('mongoose');
  const matchStage = {
    'plan.activity_type': { $in: activityTypes },
    user: { $ne: new Types.ObjectId(userId) }
  };

  const pipeline = [
    { $match: matchStage },
    // Lookup experience for destination filter + visibility
    { $lookup: {
      from: 'experiences',
      localField: 'experience',
      foreignField: '_id',
      as: 'exp'
    }},
    { $unwind: '$exp' },
    { $match: { 'exp.visibility': { $ne: 'private' } } }
  ];

  // Destination filter
  const shouldFilterDestination = !filters.cross_destination &&
    (filters.destination_id || filters.destination_name);

  if (shouldFilterDestination) {
    if (filters.destination_id) {
      pipeline.push({ $match: { 'exp.destination': new Types.ObjectId(filters.destination_id) } });
    } else if (filters.destination_name) {
      const nameRegex = new RegExp(filters.destination_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      pipeline.push(
        { $lookup: { from: 'destinations', localField: 'exp.destination', foreignField: '_id', as: 'dest' } },
        { $unwind: '$dest' },
        { $match: { 'dest.name': nameRegex } }
      );
    }
  }

  // Cost filter via $reduce on plan[].cost
  if (filters.max_cost) {
    pipeline.push({
      $addFields: {
        _totalCost: { $reduce: {
          input: '$plan',
          initialValue: 0,
          in: { $add: ['$$value', { $ifNull: ['$$this.cost', 0] }] }
        }}
      }
    });
    pipeline.push({ $match: { _totalCost: { $lte: filters.max_cost } } });
  }

  // Group by user
  pipeline.push(
    { $group: {
      _id: '$user',
      matchingPlanCount: { $sum: 1 },
      experienceIds: { $addToSet: '$experience' }
    }},
    { $sort: { matchingPlanCount: -1 } },
    { $limit: 50 }
  );

  const results = await Plan.aggregate(pipeline);

  logger.debug('[bienbot-context] findSimilarUsers', {
    userId,
    activityTypes,
    resultCount: results.length
  });

  return results.map(r => ({
    userId: r._id,
    matchingPlanCount: r.matchingPlanCount,
    experienceIds: r.experienceIds
  }));
}

// ---------------------------------------------------------------------------
// Stage 2: Find other experiences planned by similar users
// ---------------------------------------------------------------------------

async function findCoOccurringExperiences(similarUsers, filters, userId) {
  if (!similarUsers.length) return [];

  const Plan = require('../models/plan');
  const userIds = similarUsers.map(u => u.userId);
  const excludeExpIds = [...new Set(similarUsers.flatMap(u => u.experienceIds))];

  const pipeline = [
    { $match: {
      user: { $in: userIds },
      experience: { $nin: excludeExpIds }
    }},
    { $lookup: {
      from: 'experiences',
      localField: 'experience',
      foreignField: '_id',
      as: 'exp'
    }},
    { $unwind: '$exp' },
    { $match: { 'exp.visibility': { $ne: 'private' } } },
    { $addFields: {
      _planCost: { $reduce: {
        input: '$plan',
        initialValue: 0,
        in: { $add: ['$$value', { $ifNull: ['$$this.cost', 0] }] }
      }},
      _completedCount: { $size: { $filter: {
        input: '$plan',
        cond: { $eq: ['$$this.complete', true] }
      }}},
      _totalCount: { $size: '$plan' },
      _userCollaborators: { $filter: {
        input: '$permissions',
        cond: { $eq: ['$$this.entity', 'user'] }
      }}
    }},
    { $addFields: {
      _completionRate: { $cond: {
        if: { $gt: ['$_totalCount', 0] },
        then: { $divide: ['$_completedCount', '$_totalCount'] },
        else: 0
      }}
    }},
    { $group: {
      _id: '$experience',
      co_occurrence_count: { $sum: 1 },
      avg_completion_rate: { $avg: '$_completionRate' },
      collaborator_ids: { $addToSet: '$_userCollaborators._id' },
      latest_planned_date: { $max: '$planned_date' },
      avg_cost: { $avg: '$_planCost' },
      experience_name: { $first: '$exp.name' },
      destination_id: { $first: '$exp.destination' },
      activity_types: { $first: '$exp.experience_type' },
      plan_item_types: { $first: '$exp.plan_items.activity_type' },
      photos: { $first: '$exp.photos' }
    }},
    { $lookup: {
      from: 'destinations',
      localField: 'destination_id',
      foreignField: '_id',
      as: 'dest'
    }},
    { $unwind: { path: '$dest', preserveNullAndEmptyArrays: true } },
    { $lookup: {
      from: 'photos',
      let: {
        photoId: { $let: {
          vars: {
            defaultEntry: { $arrayElemAt: [{ $filter: { input: '$photos', as: 'p', cond: { $eq: ['$$p.default', true] } } }, 0] },
            firstEntry: { $arrayElemAt: ['$photos', 0] }
          },
          in: { $ifNull: ['$$defaultEntry.photo', '$$firstEntry.photo'] }
        }}
      },
      pipeline: [
        { $match: { $expr: { $eq: ['$_id', '$$photoId'] } } },
        { $project: { url: 1 } }
      ],
      as: 'photo'
    }},
    { $unwind: { path: '$photo', preserveNullAndEmptyArrays: true } },
    { $sort: { co_occurrence_count: -1 } },
    { $limit: 20 }
  ];

  const results = await Plan.aggregate(pipeline);

  logger.debug('[bienbot-context] findCoOccurringExperiences', {
    similarUserCount: similarUsers.length,
    resultCount: results.length
  });

  return results.map(r => {
    const flatCollabs = (r.collaborator_ids || []).flat().flat();
    const uniqueCollabs = [...new Set(flatCollabs.map(id => id?.toString()).filter(Boolean))];

    const allTypes = [...new Set([
      ...(r.activity_types || []),
      ...(r.plan_item_types || []).filter(Boolean)
    ])];

    return {
      experience_id: r._id,
      experience_name: r.experience_name,
      destination_name: r.dest?.name || 'Unknown',
      destination_id: r.destination_id,
      activity_types: allTypes,
      cost_estimate: Math.round(r.avg_cost || 0),
      co_occurrence_count: r.co_occurrence_count,
      avg_completion_rate: r.avg_completion_rate || 0,
      collaborator_count: uniqueCollabs.length,
      latest_planned_date: r.latest_planned_date,
      default_photo_url: r.photo?.url || null
    };
  });
}

// ---------------------------------------------------------------------------
// Popularity-based fallback: used when collaborative filtering yields no results
// (e.g. no activity_types provided, new user, or sparse plan data)
// ---------------------------------------------------------------------------

/**
 * Find popular public experiences ranked by plan count.
 * Returns the same candidate shape as findCoOccurringExperiences.
 * Supports destination and max_cost filters; cross_destination flag is ignored
 * (query is always cross-destination by default).
 * @param {Object} filters - { destination_id, destination_name, max_cost }
 * @param {string} userId - Exclude plans owned by this user
 * @returns {Promise<Array>}
 */
async function findPopularExperiences(filters, userId) {
  const Plan = require('../models/plan');
  const { Types } = require('mongoose');

  const pipeline = [
    { $match: { user: { $ne: new Types.ObjectId(userId) } } },
    { $lookup: {
      from: 'experiences',
      localField: 'experience',
      foreignField: '_id',
      as: 'exp'
    }},
    { $unwind: '$exp' },
    { $match: { 'exp.visibility': { $ne: 'private' } } }
  ];

  // Optional destination filter
  const shouldFilterDestination = !filters.cross_destination &&
    (filters.destination_id || filters.destination_name);

  if (shouldFilterDestination) {
    if (filters.destination_id) {
      pipeline.push({ $match: { 'exp.destination': new Types.ObjectId(filters.destination_id) } });
    } else if (filters.destination_name) {
      const nameRegex = new RegExp(filters.destination_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      pipeline.push(
        { $lookup: { from: 'destinations', localField: 'exp.destination', foreignField: '_id', as: 'dest_filter' } },
        { $unwind: '$dest_filter' },
        { $match: { 'dest_filter.name': nameRegex } }
      );
    }
  }

  // Optional cost filter
  if (filters.max_cost) {
    pipeline.push(
      { $addFields: {
        _planCostFilter: { $reduce: {
          input: '$plan',
          initialValue: 0,
          in: { $add: ['$$value', { $ifNull: ['$$this.cost', 0] }] }
        }}
      }},
      { $match: { _planCostFilter: { $lte: filters.max_cost } } }
    );
  }

  pipeline.push(
    { $addFields: {
      _planCost: { $reduce: {
        input: '$plan',
        initialValue: 0,
        in: { $add: ['$$value', { $ifNull: ['$$this.cost', 0] }] }
      }},
      _completedCount: { $size: { $filter: {
        input: '$plan',
        cond: { $eq: ['$$this.complete', true] }
      }}},
      _totalCount: { $size: '$plan' }
    }},
    { $addFields: {
      _completionRate: { $cond: {
        if: { $gt: ['$_totalCount', 0] },
        then: { $divide: ['$_completedCount', '$_totalCount'] },
        else: 0
      }}
    }},
    { $group: {
      _id: '$experience',
      co_occurrence_count: { $sum: 1 },
      avg_completion_rate: { $avg: '$_completionRate' },
      latest_planned_date: { $max: '$planned_date' },
      avg_cost: { $avg: '$_planCost' },
      experience_name: { $first: '$exp.name' },
      destination_id: { $first: '$exp.destination' },
      activity_types: { $first: '$exp.experience_type' },
      photos: { $first: '$exp.photos' }
    }},
    { $lookup: {
      from: 'destinations',
      localField: 'destination_id',
      foreignField: '_id',
      as: 'dest'
    }},
    { $unwind: { path: '$dest', preserveNullAndEmptyArrays: true } },
    { $lookup: {
      from: 'photos',
      let: { photoId: { $let: {
        vars: {
          defaultEntry: { $arrayElemAt: [{ $filter: { input: '$photos', as: 'p', cond: { $eq: ['$$p.default', true] } } }, 0] },
          firstEntry: { $arrayElemAt: ['$photos', 0] }
        },
        in: { $ifNull: ['$$defaultEntry.photo', '$$firstEntry.photo'] }
      }} },
      pipeline: [
        { $match: { $expr: { $eq: ['$_id', '$$photoId'] } } },
        { $project: { url: 1 } }
      ],
      as: 'photo'
    }},
    { $unwind: { path: '$photo', preserveNullAndEmptyArrays: true } },
    { $sort: { co_occurrence_count: -1 } },
    { $limit: 20 }
  );

  const results = await Plan.aggregate(pipeline);

  logger.debug('[bienbot-context] findPopularExperiences', {
    userId,
    filters,
    resultCount: results.length
  });

  return results.map(r => ({
    experience_id: r._id,
    experience_name: r.experience_name,
    destination_name: r.dest?.name || 'Unknown',
    destination_id: r.destination_id,
    activity_types: r.activity_types || [],
    cost_estimate: Math.round(r.avg_cost || 0),
    co_occurrence_count: r.co_occurrence_count,
    avg_completion_rate: r.avg_completion_rate || 0,
    collaborator_count: 0,
    latest_planned_date: r.latest_planned_date,
    default_photo_url: r.photo?.url || null
  }));
}

module.exports = {
  renderAttentionBlock,
  computePlanProximityTag,
  formatSignalBlock,
  buildDestinationContext,
  buildExperienceContext,
  buildUserPlanContext,
  buildPlanItemContext,
  buildUserProfileContext,
  buildUserGreetingContext,
  buildSearchContext,
  buildSuggestionContext,
  buildContextForInvokeContext,
  buildDiscoveryContext,
  buildPlanNextStepsContext,
  buildSimilarExperiencesContext,
  buildDisambiguationBlock,
  SEMANTIC_ACTIVITY_MAP,
  // Discovery ranking helpers (exported for testing and direct use)
  expandActivityTypes,
  computeAdaptiveWeights,
  computeCostAlignment,
  normalizeCostToPercentile,
  computeRecencyScore,
  normalizeCount,
  generateMatchReason,
  // Two-stage collaborative filtering pipeline
  findSimilarUsers,
  findCoOccurringExperiences,
  findPopularExperiences,
  formatDiscoveryContextBlock
};

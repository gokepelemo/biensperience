/**
 * BienBot Context — Shared helpers
 *
 * Module-private helpers used by two or more entity context builders.
 * Extracted verbatim from the pre-split utilities/bienbot-context-builders.js
 * (no logic changes, mechanical move only).
 *
 * @module utilities/bienbot-context/_shared
 */

const logger = require('../backend-logger');
const { validateObjectId } = require('../controller-helpers');
const { findSimilarItems } = require('../fuzzy-match');
const { applySignalDecay, signalsToNaturalLanguage } = require('../hidden-signals');

// Lazy-loaded models (resolved on first use, shared across all builders)
let Destination, Experience, Plan, User, Activity;

function loadModels() {
  if (!Destination) {
    Destination = require('../../models/destination');
    Experience = require('../../models/experience');
    Plan = require('../../models/plan');
    User = require('../../models/user');
    Activity = require('../../models/activity');
  }
}

/**
 * Lazy-model accessor. Always call loadModels() first; this returns the
 * cached references so each entity-context module can destructure them
 * without re-requiring.
 */
function getModels() {
  loadModels();
  return { Destination, Experience, Plan, User, Activity };
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

      // Push destination filter to DB: find experiences at destId, then query plans.
      const destExperiences = await Experience
        .find({ destination: destId })
        .select('_id')
        .lean();
      if (!destExperiences.length) return null;

      const destExpIds = destExperiences.map(e => e._id);
      const planQuery = {
        user: new Types.ObjectId(userId),
        experience: { $in: destExpIds }
      };
      if (options.currentId) {
        const { valid, objectId } = validateObjectId(options.currentId, 'currentId');
        if (valid) planQuery._id = { $ne: objectId };
      }

      const otherPlans = await Plan
        .find(planQuery)
        .populate({ path: 'experience', select: 'name destination' })
        .select('experience planned_date plan')
        .sort({ updatedAt: -1 })
        .limit(5)
        .lean();

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
  loadModels();
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
      const { executeAIRequest } = require('../ai-gateway');
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

module.exports = {
  // model loader
  loadModels,
  getModels,
  // formatters
  entityJSON,
  formatPlanDate,
  formatCostAmount,
  // token budget
  CHARS_PER_TOKEN,
  DEFAULT_TOKEN_BUDGET,
  trimToTokenBudget,
  // disambiguation
  buildDisambiguationBlock,
  // temporal helpers
  computeDaysUntil,
  formatDetailLine,
  buildTemporalBuckets,
  buildInlineDetailSummary,
  // notes / signals / attention
  collectPlanNotes,
  renderAttentionBlock,
  computePlanProximityTag,
  formatSignalBlock,
};

/**
 * BienBot Context — Plan Item
 *
 * Builds the LLM context block for a single Plan Item.
 * Extracted verbatim from utilities/bienbot-context-builders.js — mechanical
 * move, no logic changes.
 *
 * @module utilities/bienbot-context/plan-item-context
 */

const logger = require('../backend-logger');
const { getEnforcer } = require('../permission-enforcer');
const { validateObjectId } = require('../controller-helpers');

const {
  loadModels,
  getModels,
  entityJSON,
  trimToTokenBudget,
  DEFAULT_TOKEN_BUDGET,
  buildDisambiguationBlock,
  computeDaysUntil,
  formatDetailLine,
  renderAttentionBlock,
  formatSignalBlock,
} = require('./_shared');

/**
 * Build context block for a specific Plan Item within a plan.
 */
async function buildPlanItemContext(planId, itemId, userId, options = {}) {
  loadModels();
  const { Destination, Experience, Plan, User } = getModels();
  const enforcer = getEnforcer({ Destination, Experience, Plan, User });

  const { valid: planIdValid, objectId: planOid } = validateObjectId(planId, 'planId');
  if (!planIdValid) return null;

  try {
    // NOT .lean(): preserves resource.constructor.modelName for Plan-RESTRICTED visibility check.
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

module.exports = { buildPlanItemContext };

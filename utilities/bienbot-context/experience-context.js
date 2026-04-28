/**
 * BienBot Context — Experience
 *
 * Builds the LLM context block for an Experience entity.
 * Extracted verbatim from utilities/bienbot-context-builders.js — mechanical
 * move, no logic changes.
 *
 * @module utilities/bienbot-context/experience-context
 */

const logger = require('../backend-logger');
const { getEnforcer } = require('../permission-enforcer');
const { validateObjectId } = require('../controller-helpers');

const {
  loadModels,
  getModels,
  entityJSON,
  formatPlanDate,
  formatCostAmount,
  trimToTokenBudget,
  DEFAULT_TOKEN_BUDGET,
  buildDisambiguationBlock,
  renderAttentionBlock,
  computePlanProximityTag,
} = require('./_shared');

/**
 * Build context block for an Experience.
 */
async function buildExperienceContext(experienceId, userId, options = {}) {
  loadModels();
  const { Destination, Experience, Plan, User } = getModels();
  const enforcer = getEnforcer({ Destination, Experience, Plan, User });

  const { valid: expIdValid, objectId: expOid } = validateObjectId(experienceId, 'experienceId');
  if (!expIdValid) return null;

  try {
    // NOT .lean(): preserves resource.constructor.modelName for permission visibility check.
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
      lines.push(`\nUser's plan for this experience: exists (plan_id: ${userPlanForExp._id}, ${planItemCount} items, date: ${planDateStr})`);
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

module.exports = { buildExperienceContext };

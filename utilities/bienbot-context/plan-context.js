/**
 * BienBot Context — Plan
 *
 * Builds the LLM context block for a user Plan, plus plan-level next-steps
 * analysis. Extracted verbatim from utilities/bienbot-context-builders.js —
 * mechanical move, no logic changes.
 *
 * @module utilities/bienbot-context/plan-context
 */

const logger = require('../backend-logger');
const { getEnforcer } = require('../permission-enforcer');
const { validateObjectId } = require('../controller-helpers');
const { aggregateGroupSignals } = require('../hidden-signals');

const {
  loadModels,
  getModels,
  entityJSON,
  formatPlanDate,
  trimToTokenBudget,
  DEFAULT_TOKEN_BUDGET,
  buildDisambiguationBlock,
  computeDaysUntil,
  buildTemporalBuckets,
  buildInlineDetailSummary,
  collectPlanNotes,
  renderAttentionBlock,
  computePlanProximityTag,
  formatSignalBlock,
} = require('./_shared');

/**
 * Build context block for a user's Plan of an experience.
 */
async function buildUserPlanContext(planId, userId, options = {}) {
  loadModels();
  const { Destination, Experience, Plan, User } = getModels();
  const enforcer = getEnforcer({ Destination, Experience, Plan, User });

  const { valid: planIdValid, objectId: planOid } = validateObjectId(planId, 'planId');
  if (!planIdValid) return null;

  try {
    // NOT .lean(): preserves resource.constructor.modelName for Plan-RESTRICTED visibility check.
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

    // Run group-signal fetch and notes collection in parallel.
    const memberIds = (plan.permissions || []).filter(p => p.entity === 'user').map(p => p._id);
    if (!memberIds.some(id => String(id) === String(userId))) {
      memberIds.push(userId);
    }
    const [memberDocs, notesBlock] = await Promise.all([
      User.find({ _id: { $in: memberIds } }).select('hidden_signals name').lean().catch(() => []),
      collectPlanNotes(planItems, userId).catch(() => null)
    ]);

    // Inject group travel signals
    try {
      if (memberDocs.length > 0) {
        const groupSignals = aggregateGroupSignals(memberDocs);
        const signalBlock = formatSignalBlock(groupSignals, memberDocs.length > 1 ? 'group' : 'traveler', memberDocs.length);
        if (signalBlock) lines.push(signalBlock);
      }
    } catch (sigErr) {
      logger.debug('[bienbot-context] Plan signal injection skipped', { error: sigErr.message });
    }

    // Inject plan item notes
    if (notesBlock) lines.push(notesBlock);

    // Cross-entity: Your other plans for the same experience or destination (up to 2)
    // Caller may pass opts.userPlans to avoid a redundant DB query.
    try {
      const expId = plan.experience?._id;
      const planIdStr = plan._id.toString();
      const baseUserPlans = options.userPlans
        ? options.userPlans.filter(p => String(p._id) !== planIdStr)
        : await Plan.find({ user: userId, _id: { $ne: plan._id } })
            .populate({ path: 'experience', select: 'name destination', populate: { path: 'destination', select: 'name' } })
            .select('experience planned_date plan')
            .lean();
      // Prefer same experience first; otherwise same destination
      const sameExpPlans = baseUserPlans.filter(p => expId && String(p.experience?._id) === String(expId));
      const remainingSlots = 2 - sameExpPlans.length;
      const sameDestPlans = remainingSlots > 0 ? baseUserPlans.filter(p => {
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
  const { Destination, Experience, Plan, User } = getModels();
  const enforcer = getEnforcer({ Destination, Experience, Plan, User });

  try {
    // NOT .lean(): preserves resource.constructor.modelName for Plan-RESTRICTED visibility check.
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

module.exports = { buildUserPlanContext, buildPlanNextStepsContext };

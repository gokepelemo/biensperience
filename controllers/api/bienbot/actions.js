/**
 * BienBot — pending action management + execution + workflow state.
 *
 * Hosts ACTION_ENTITY_VERIFY (also re-exported as the test fixture) and the
 * actions-related controller endpoints.
 *
 * Split out from `controllers/api/bienbot.js` (bd #f4ed).
 *
 * @module controllers/api/bienbot/actions
 */

const {
  mongoose, logger,
  validateObjectId, successResponse, errorResponse,
  getEnforcer,
  loadModels, Destination, Experience, Plan, User,
  BienBotSession, toolRegistry,
  executeActions, executeSingleWorkflowStep,
  ALLOWED_ACTION_TYPES, READ_ONLY_ACTION_TYPES,
  validateActionPayload, summarizeIssues,
  resolveEntities,
  NAV_DEST_RE, NAV_EXP_RE, NAV_PLAN_RE,
  extractNavIds,
  TOOL_CALL_LABELS,
  mergeReferencedEntitiesIntoContext,
  buildPlanNextStepsContext,
} = require('./_shared');

// ---------------------------------------------------------------------------
// Workflow expansion
// ---------------------------------------------------------------------------

/**
 * Explode workflow actions into individual pending actions for step-by-step
 * confirmation. Non-workflow actions pass through unchanged.
 *
 * Each workflow step becomes its own pending action linked by a shared
 * workflow_id, with depends_on derived from $step_N references in payloads.
 *
 * @param {object[]} actions - Parsed pending_actions array from LLM response
 * @returns {object[]} Exploded actions array
 */
function explodeWorkflows(actions) {
  const result = [];

  for (const action of actions) {
    if (action.type !== 'workflow' || !Array.isArray(action.payload?.steps)) {
      result.push(action);
      continue;
    }

    const workflowId = `wf_${crypto.randomBytes(4).toString('hex')}`;
    const steps = [...action.payload.steps].sort((a, b) => (a.step || 0) - (b.step || 0));
    const total = steps.length;

    // Build a map: step number → action ID (for depends_on resolution)
    const stepIdMap = new Map();
    for (const step of steps) {
      const stepId = `action_${crypto.randomBytes(4).toString('hex')}`;
      stepIdMap.set(step.step, stepId);
    }

    for (const step of steps) {
      const stepId = stepIdMap.get(step.step);

      // Detect $step_N references in payload to build depends_on
      const dependsOn = [];
      const refPattern = /\$step_(\d+)\./;
      const payloadStr = JSON.stringify(step.payload || {});
      const matches = payloadStr.matchAll(/\$step_(\d+)\./g);
      for (const match of matches) {
        const refStep = parseInt(match[1], 10);
        const depId = stepIdMap.get(refStep);
        if (depId && !dependsOn.includes(depId)) {
          dependsOn.push(depId);
        }
      }

      result.push({
        id: stepId,
        type: step.type,
        payload: step.payload || {},
        description: step.description || `Step ${step.step}: ${step.type}`,
        executed: false,
        result: null,
        workflow_id: workflowId,
        workflow_step: step.step,
        workflow_total: total,
        depends_on: dependsOn.length > 0 ? dependsOn : null,
        status: 'pending',
        error_message: null
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Action entity-ID verification rules
// ---------------------------------------------------------------------------

/**
 * Action-type → entity-ID verification rules.
 *
 *   refs:  array of { field, model, required } — each independently checked.
 *   oneOf: array of { field, model } — at least one must resolve to a real entity.
 *   typed: { idField, typeField, typeToModel, required } — entity_type
 *          dispatches which model entity_id is checked against.
 *
 * navigate_to_entity is verified separately by parsing IDs out of payload.url.
 *
 * Coverage gap: workflow steps are exploded before this verification runs,
 * so each step is checked individually. Step references like $step_N.field
 * are not resolvable here and are passed through to the executor.
 */
const ACTION_ENTITY_VERIFY = {
  // plan_id required
  update_plan:                 { refs: [{ field: 'plan_id', model: 'plan', required: true }] },
  delete_plan:                 { refs: [{ field: 'plan_id', model: 'plan', required: true }] },
  add_plan_items:              { refs: [{ field: 'plan_id', model: 'plan', required: true }] },
  // itemRef validates the embedded plan item within the verified parent plan.
  // Plan items live in plan.plan[] (the embedded snapshot array).
  update_plan_item:            { refs: [{ field: 'plan_id', model: 'plan', required: true }],
                                 itemRef: { parentField: 'plan_id', parentModel: 'plan', arrayField: 'plan', itemField: 'item_id', required: true } },
  delete_plan_item:            { refs: [{ field: 'plan_id', model: 'plan', required: true }],
                                 itemRef: { parentField: 'plan_id', parentModel: 'plan', arrayField: 'plan', itemField: 'item_id', required: true } },
  mark_plan_item_complete:     { refs: [{ field: 'plan_id', model: 'plan', required: true }],
                                 itemRef: { parentField: 'plan_id', parentModel: 'plan', arrayField: 'plan', itemField: 'item_id', required: true } },
  mark_plan_item_incomplete:   { refs: [{ field: 'plan_id', model: 'plan', required: true }],
                                 itemRef: { parentField: 'plan_id', parentModel: 'plan', arrayField: 'plan', itemField: 'item_id', required: true } },
  add_plan_item_note:          { refs: [{ field: 'plan_id', model: 'plan', required: true }],
                                 itemRef: { parentField: 'plan_id', parentModel: 'plan', arrayField: 'plan', itemField: 'item_id', required: true } },
  update_plan_item_note:       { refs: [{ field: 'plan_id', model: 'plan', required: true }],
                                 itemRef: { parentField: 'plan_id', parentModel: 'plan', arrayField: 'plan', itemField: 'item_id', required: true } },
  delete_plan_item_note:       { refs: [{ field: 'plan_id', model: 'plan', required: true }],
                                 itemRef: { parentField: 'plan_id', parentModel: 'plan', arrayField: 'plan', itemField: 'item_id', required: true } },
  add_plan_item_detail:        { refs: [{ field: 'plan_id', model: 'plan', required: true }],
                                 itemRef: { parentField: 'plan_id', parentModel: 'plan', arrayField: 'plan', itemField: 'item_id', required: true } },
  update_plan_item_detail:     { refs: [{ field: 'plan_id', model: 'plan', required: true }],
                                 itemRef: { parentField: 'plan_id', parentModel: 'plan', arrayField: 'plan', itemField: 'item_id', required: true } },
  delete_plan_item_detail:     { refs: [{ field: 'plan_id', model: 'plan', required: true }],
                                 itemRef: { parentField: 'plan_id', parentModel: 'plan', arrayField: 'plan', itemField: 'item_id', required: true } },
  assign_plan_item:            { refs: [{ field: 'plan_id', model: 'plan', required: true }],
                                 itemRef: { parentField: 'plan_id', parentModel: 'plan', arrayField: 'plan', itemField: 'item_id', required: true } },
  unassign_plan_item:          { refs: [{ field: 'plan_id', model: 'plan', required: true }],
                                 itemRef: { parentField: 'plan_id', parentModel: 'plan', arrayField: 'plan', itemField: 'item_id', required: true } },
  add_plan_cost:               { refs: [{ field: 'plan_id', model: 'plan', required: true }] },
  // costRef validates plan.costs[] subdocument IDs to drop hallucinated
  // cost_ids before they reach the user as a confirmation prompt.
  update_plan_cost:            { refs: [{ field: 'plan_id', model: 'plan', required: true }],
                                 costRef: { parentField: 'plan_id', itemField: 'cost_id', required: true } },
  delete_plan_cost:            { refs: [{ field: 'plan_id', model: 'plan', required: true }],
                                 costRef: { parentField: 'plan_id', itemField: 'cost_id', required: true } },
  set_member_location:         { refs: [{ field: 'plan_id', model: 'plan', required: true }] },
  remove_member_location:      { refs: [{ field: 'plan_id', model: 'plan', required: true }] },
  pin_plan_item:               { refs: [{ field: 'plan_id', model: 'plan', required: true }],
                                 itemRef: { parentField: 'plan_id', parentModel: 'plan', arrayField: 'plan', itemField: 'item_id', required: true } },
  unpin_plan_item:             { refs: [{ field: 'plan_id', model: 'plan', required: true }],
                                 itemRef: { parentField: 'plan_id', parentModel: 'plan', arrayField: 'plan', itemField: 'item_id', required: true } },
  // arrayItemRef validates every entry in payload.item_ids[] against plan.plan[].
  // Without this, the executor silently drops hallucinated IDs from the reorder
  // list, producing a "successful" reorder that quietly omitted items.
  reorder_plan_items:          { refs: [{ field: 'plan_id', model: 'plan', required: true }],
                                 arrayItemRef: { parentField: 'plan_id', parentModel: 'plan', arrayField: 'plan', itemField: 'item_ids', required: true } },
  shift_plan_item_dates:       { refs: [{ field: 'plan_id', model: 'plan', required: true }] },
  sync_plan:                   { refs: [{ field: 'plan_id', model: 'plan', required: true }] },
  request_plan_access:         { refs: [{ field: 'plan_id', model: 'plan', required: true }] },
  // Disambiguation actions auto-execute and write to session context — must verify.
  select_plan:                 { refs: [{ field: 'plan_id', model: 'plan', required: true }] },
  select_destination:          { refs: [{ field: 'destination_id', model: 'destination', required: true }] },
  // Read-only fetches with required entity refs.
  suggest_plan_items:          { refs: [
                                  { field: 'destination_id', model: 'destination', required: true },
                                  { field: 'experience_id', model: 'experience', required: false }
                                ] },
  fetch_destination_tips:      { refs: [{ field: 'destination_id', model: 'destination', required: true }] },
  fetch_plan_items:            { refs: [{ field: 'plan_id', model: 'plan', required: true }] },
  fetch_plan_costs:            { refs: [{ field: 'plan_id', model: 'plan', required: true }] },
  fetch_plan_collaborators:    { refs: [{ field: 'plan_id', model: 'plan', required: true }] },
  fetch_experience_items:      { refs: [{ field: 'experience_id', model: 'experience', required: true }] },
  fetch_destination_experiences: { refs: [{ field: 'destination_id', model: 'destination', required: true }] },
  fetch_user_plans:            { refs: [{ field: 'user_id', model: 'user', required: false }] },
  // Optional plan_id only.
  create_invite:               { refs: [{ field: 'plan_id', model: 'plan', required: false }] },
  // experience_id required.
  create_plan:                 { refs: [{ field: 'experience_id', model: 'experience', required: true }] },
  update_experience:           { refs: [{ field: 'experience_id', model: 'experience', required: true }] },
  add_experience_plan_item:    { refs: [{ field: 'experience_id', model: 'experience', required: true }] },
  // itemRef validates the embedded plan item in experience.plan_items[].
  update_experience_plan_item: { refs: [{ field: 'experience_id', model: 'experience', required: true }],
                                 itemRef: { parentField: 'experience_id', parentModel: 'experience', arrayField: 'plan_items', itemField: 'plan_item_id', required: true } },
  delete_experience_plan_item: { refs: [{ field: 'experience_id', model: 'experience', required: true }],
                                 itemRef: { parentField: 'experience_id', parentModel: 'experience', arrayField: 'plan_items', itemField: 'plan_item_id', required: true } },
  // destination_id.
  create_experience:           { refs: [{ field: 'destination_id', model: 'destination', required: false }] },
  update_destination:          { refs: [{ field: 'destination_id', model: 'destination', required: true }] },
  toggle_favorite_destination: { refs: [{ field: 'destination_id', model: 'destination', required: true }] },
  // user_id required (social actions).
  follow_user:                 { refs: [{ field: 'user_id', model: 'user', required: true }] },
  unfollow_user:               { refs: [{ field: 'user_id', model: 'user', required: true }] },
  list_user_followers:         { refs: [{ field: 'user_id', model: 'user', required: true }] },
  list_user_experiences:       { refs: [{ field: 'user_id', model: 'user', required: true }] },
  accept_follow_request:       { refs: [{ field: 'follower_id', model: 'user', required: true }] },
  // At-least-one semantics — executor accepts plan_id OR experience_id.
  invite_collaborator:         { oneOf: [
                                  { field: 'plan_id', model: 'plan' },
                                  { field: 'experience_id', model: 'experience' }
                                ] },
  remove_collaborator:         { oneOf: [
                                  { field: 'plan_id', model: 'plan' },
                                  { field: 'experience_id', model: 'experience' }
                                ] },
  // Typed-entity dispatcher — entity_type selects which model entity_id is checked.
  add_entity_photos:           { typed: {
                                  idField: 'entity_id',
                                  typeField: 'entity_type',
                                  typeToModel: { destination: 'destination', experience: 'experience' },
                                  required: true
                                } },
  fetch_entity_photos:         { typed: {
                                  idField: 'entity_id',
                                  typeField: 'entity_type',
                                  typeToModel: { destination: 'destination', experience: 'experience' },
                                  required: true
                                } },
  list_entity_documents:       { typed: {
                                  idField: 'entity_id',
                                  typeField: 'entity_type',
                                  typeToModel: { destination: 'destination', experience: 'experience', plan: 'plan' },
                                  required: true
                                },
                                refs: [{ field: 'plan_id', model: 'plan', required: false }] }
};

// Merge registry tool verifier entries into the literal map
Object.assign(ACTION_ENTITY_VERIFY, toolRegistry.getVerifierEntries());

// ---------------------------------------------------------------------------
// Pre-execution entity verification
// ---------------------------------------------------------------------------

/**
 * Drop any action whose entity references can't be resolved in the DB.
 *
 * Defends against LLM-hallucinated ObjectIds that pass string-format checks.
 * Batches existence queries — one query per model regardless of action count.
 * Logs every dropped action with structured fields so regressions are visible
 * in production telemetry.
 *
 * @param {Array} actions exploded pending_actions (post-workflow expansion)
 * @returns {Promise<Array>} surviving actions
 */
async function verifyPendingActionEntityIds(actions) {
  if (!Array.isArray(actions) || actions.length === 0) return actions || [];

  // Phase 1 — collect every referenced ID per model + itemRef parent IDs.
  const toVerify = {
    plan: new Set(), experience: new Set(),
    destination: new Set(), user: new Set()
  };
  // Track which parent IDs we'll need to load embedded item arrays for.
  // planItemParents: plan_id -> Set<item_id>;  expItemParents: exp_id -> Set<item_id>
  const planItemParents = new Map();
  const expItemParents = new Map();
  let needVerification = false;
  const collect = (id, model) => {
    if (id && model && toVerify[model] && mongoose.Types.ObjectId.isValid(id)) {
      toVerify[model].add(id);
    }
  };
  for (const action of actions) {
    const rule = ACTION_ENTITY_VERIFY[action.type];
    if (rule) {
      needVerification = true;
      if (rule.refs) for (const r of rule.refs) collect(action.payload?.[r.field], r.model);
      if (rule.oneOf) for (const r of rule.oneOf) collect(action.payload?.[r.field], r.model);
      if (rule.typed) {
        const t = rule.typed;
        const type = action.payload?.[t.typeField];
        collect(action.payload?.[t.idField], type ? t.typeToModel[type] : null);
      }
      if (rule.itemRef) {
        const { parentField, parentModel, itemField } = rule.itemRef;
        const parentId = action.payload?.[parentField];
        const itemId   = action.payload?.[itemField];
        if (parentId && itemId &&
            mongoose.Types.ObjectId.isValid(parentId) &&
            mongoose.Types.ObjectId.isValid(itemId)) {
          const map = parentModel === 'plan' ? planItemParents : expItemParents;
          if (!map.has(parentId)) map.set(parentId, new Set());
          map.get(parentId).add(itemId);
        }
      }
      if (rule.arrayItemRef) {
        // For array variants (e.g. reorder_plan_items.item_ids[]), the parent
        // load already happens via refs/itemRef parent collection — we only
        // need to ensure the parent is fetched in Phase 2.5 so that Phase 3
        // can iterate the array. Add the parent with an empty itemId set; the
        // membership check happens against planItemMap which contains all of
        // the parent's items regardless of which were referenced.
        const { parentField, parentModel } = rule.arrayItemRef;
        const parentId = action.payload?.[parentField];
        if (parentId && mongoose.Types.ObjectId.isValid(parentId)) {
          const map = parentModel === 'plan' ? planItemParents : expItemParents;
          if (!map.has(parentId)) map.set(parentId, new Set());
        }
      }
      if (rule.costRef) {
        // cost_id check: ensure the parent plan is fetched in Phase 2.5 so
        // Phase 3 can verify cost membership. costRef is plan-only.
        const { parentField } = rule.costRef;
        const parentId = action.payload?.[parentField];
        if (parentId && mongoose.Types.ObjectId.isValid(parentId)) {
          if (!planItemParents.has(parentId)) planItemParents.set(parentId, new Set());
        }
      }
    }
    if (action.type === 'navigate_to_entity') {
      needVerification = true;
      const parsedNav = extractNavIds(action.payload?.url);
      if (parsedNav.ids) for (const { model, id } of parsedNav.ids) toVerify[model].add(id);
    }
  }

  if (!needVerification) return actions;

  // Phase 2 — batched existence query per model in parallel.
  loadModels();
  const existing = {
    plan: new Set(), experience: new Set(),
    destination: new Set(), user: new Set()
  };
  const queries = [
    [Plan, 'plan'],
    [Experience, 'experience'],
    [Destination, 'destination'],
    [User, 'user']
  ];
  await Promise.all(queries.map(([Model, key]) =>
    toVerify[key].size === 0
      ? Promise.resolve()
      : Model.find({ _id: { $in: [...toVerify[key]] } })
          .select('_id').lean()
          .then(docs => docs.forEach(d => existing[key].add(d._id.toString())))
          .catch(err => logger.warn('[bienbot] entity ID batch verification query failed',
            { model: key, error: err.message }))
  ));

  // Phase 2.5 — subdocument item existence maps.
  // Only query parents that were confirmed to exist in Phase 2.
  // plan.plan[] holds plan item snapshots — each snapshot has both its own
  // subdocument _id AND a plan_item_id referencing the original experience
  // plan item. The plansController.updatePlanItem handler accepts EITHER form,
  // so the verification set must include both to stay symmetric with the
  // executor.
  // experience.plan_items[] holds experience items keyed by _id only.
  // Trade-off: the projection over-fetches all item IDs in each parent. For
  // a plan with 100 items where only 1 is referenced, we transfer 99 unused
  // IDs. Acceptable vs. building per-parent $elemMatch filters; if this ever
  // becomes hot, switch to elemMatch.
  const planItemMap = new Map();  // planId -> Set<itemId> (covers _id + plan_item_id)
  const planCostMap = new Map();  // planId -> Set<costId>
  const expItemMap  = new Map();  // expId   -> Set<itemId>
  await Promise.all([
    planItemParents.size > 0
      ? Plan.find({ _id: { $in: [...planItemParents.keys()].filter(id => existing.plan.has(id)) } })
          .select('_id plan._id plan.plan_item_id costs._id').lean()
          .then(docs => docs.forEach(doc => {
            const itemIds = new Set();
            for (const i of (doc.plan || [])) {
              if (i._id) itemIds.add(i._id.toString());
              if (i.plan_item_id) itemIds.add(i.plan_item_id.toString());
            }
            planItemMap.set(doc._id.toString(), itemIds);
            planCostMap.set(
              doc._id.toString(),
              new Set((doc.costs || []).map(c => c._id?.toString()).filter(Boolean))
            );
          }))
          .catch(err => logger.warn('[bienbot] plan item subdoc verification query failed',
            { error: err.message }))
      : Promise.resolve(),
    expItemParents.size > 0
      ? Experience.find({ _id: { $in: [...expItemParents.keys()].filter(id => existing.experience.has(id)) } })
          .select('_id plan_items._id').lean()
          .then(docs => docs.forEach(doc => {
            expItemMap.set(
              doc._id.toString(),
              new Set((doc.plan_items || []).map(i => i._id?.toString()).filter(Boolean))
            );
          }))
          .catch(err => logger.warn('[bienbot] experience plan_item subdoc verification query failed',
            { error: err.message }))
      : Promise.resolve()
  ]);

  // Phase 3 — drop any action whose IDs can't be resolved.
  return actions.filter(action => {
    if (action.type === 'navigate_to_entity') {
      const result = extractNavIds(action.payload?.url);
      if (result.error) {
        logger.warn('[bienbot] navigate_to_entity dropped: ' + result.error,
          { actionId: action.id, url: action.payload?.url });
        return false;
      }
      for (const { model, id } of result.ids) {
        if (!existing[model].has(id)) {
          logger.warn('[bienbot] navigate_to_entity dropped: entity not found',
            { actionId: action.id, model, id, url: action.payload?.url });
          return false;
        }
      }
      return true;
    }

    const rule = ACTION_ENTITY_VERIFY[action.type];
    if (!rule) return true;

    if (rule.refs) {
      for (const { field, model, required } of rule.refs) {
        const id = action.payload?.[field];
        if (!id) {
          if (required) {
            logger.warn('[bienbot] pending_action dropped: required entity ID missing',
              { type: action.type, field });
            return false;
          }
          continue;
        }
        if (!mongoose.Types.ObjectId.isValid(id)) {
          logger.warn('[bienbot] pending_action dropped: invalid ObjectId format',
            { type: action.type, field, id });
          return false;
        }
        if (!existing[model].has(id)) {
          logger.warn('[bienbot] pending_action dropped: entity not found in DB',
            { type: action.type, field, model, id });
          return false;
        }
      }
    }

    if (rule.oneOf) {
      const matched = rule.oneOf.some(({ field, model }) => {
        const id = action.payload?.[field];
        return id && mongoose.Types.ObjectId.isValid(id) && existing[model].has(id);
      });
      if (!matched) {
        logger.warn('[bienbot] pending_action dropped: none of the one_of entity IDs resolved',
          { type: action.type, fields: rule.oneOf.map(r => r.field) });
        return false;
      }
    }

    if (rule.typed) {
      const t = rule.typed;
      const id = action.payload?.[t.idField];
      const type = action.payload?.[t.typeField];
      if (!id || !type) {
        if (t.required) {
          logger.warn('[bienbot] pending_action dropped: typed entity id/type missing',
            { type: action.type, idField: t.idField, typeField: t.typeField });
          return false;
        }
      } else {
        const model = t.typeToModel[type];
        if (!model) {
          logger.warn('[bienbot] pending_action dropped: unknown entity_type',
            { type: action.type, [t.typeField]: type });
          return false;
        }
        if (!mongoose.Types.ObjectId.isValid(id)) {
          logger.warn('[bienbot] pending_action dropped: invalid typed entity ObjectId',
            { type: action.type, idField: t.idField, id });
          return false;
        }
        if (!existing[model].has(id)) {
          logger.warn('[bienbot] pending_action dropped: typed entity not found',
            { type: action.type, idField: t.idField, model, id });
          return false;
        }
      }
    }

    if (rule.itemRef) {
      const { parentField, parentModel, itemField, required } = rule.itemRef;
      const parentId = action.payload?.[parentField];
      const itemId   = action.payload?.[itemField];
      if (!itemId) {
        if (required) {
          logger.warn('[bienbot] pending_action dropped: required item_id missing',
            { type: action.type, itemField });
          return false;
        }
      } else if (!mongoose.Types.ObjectId.isValid(itemId)) {
        logger.warn('[bienbot] pending_action dropped: invalid item_id ObjectId format',
          { type: action.type, itemField, itemId });
        return false;
      } else if (parentId) {
        // Only check subdocument existence when the parent was itself confirmed
        // to exist in Phase 2 (i.e. it's in the itemMap). If the parent wasn't
        // fetched at all (e.g. it failed Phase 2), the refs check above already
        // dropped the action — so we skip silently here.
        const itemMap = parentModel === 'plan' ? planItemMap : expItemMap;
        if (itemMap.has(parentId) && !itemMap.get(parentId).has(itemId)) {
          logger.warn('[bienbot] pending_action dropped: item_id not found in parent',
            { type: action.type, itemField, itemId, parentField, parentId, parentModel });
          return false;
        }
      }
    }

    if (rule.arrayItemRef) {
      const { parentField, parentModel, itemField, required } = rule.arrayItemRef;
      const parentId = action.payload?.[parentField];
      const itemIds  = action.payload?.[itemField];
      if (!Array.isArray(itemIds) || itemIds.length === 0) {
        if (required) {
          logger.warn('[bienbot] pending_action dropped: required item_ids array missing or empty',
            { type: action.type, itemField });
          return false;
        }
      } else if (parentId) {
        const itemMap = parentModel === 'plan' ? planItemMap : expItemMap;
        if (itemMap.has(parentId)) {
          const knownIds = itemMap.get(parentId);
          for (const id of itemIds) {
            if (!id || !mongoose.Types.ObjectId.isValid(id) || !knownIds.has(id)) {
              logger.warn('[bienbot] pending_action dropped: item_ids entry not found in parent',
                { type: action.type, itemField, badId: id, parentField, parentId, parentModel });
              return false;
            }
          }
        }
      }
    }

    if (rule.costRef) {
      const { parentField, itemField, required } = rule.costRef;
      const parentId = action.payload?.[parentField];
      const costId   = action.payload?.[itemField];
      if (!costId) {
        if (required) {
          logger.warn('[bienbot] pending_action dropped: required cost_id missing',
            { type: action.type, itemField });
          return false;
        }
      } else if (!mongoose.Types.ObjectId.isValid(costId)) {
        logger.warn('[bienbot] pending_action dropped: invalid cost_id ObjectId format',
          { type: action.type, itemField, costId });
        return false;
      } else if (parentId && planCostMap.has(parentId) && !planCostMap.get(parentId).has(costId)) {
        logger.warn('[bienbot] pending_action dropped: cost_id not found in parent plan',
          { type: action.type, itemField, costId, parentField, parentId });
        return false;
      }
    }

    // Intentional gaps (not verified at this layer):
    //   - note_id (*_plan_item_note): nested two levels deep
    //     (plan.plan[].details.notes[]); projection cost outweighs the benefit
    //     while controller 404s remain observable.
    //   - detail_id (*_plan_item_detail): polymorphic — detail_type is the
    //     real discriminator, and detail_id is optional. Skip rather than
    //     replicate that logic here.
    //   - add_plan_items items[].parent: the parent is descriptive, not
    //     enforced; a dangling reference produces a flat list, not a 500.

    return true;
  });
}

// ---------------------------------------------------------------------------
// Controller endpoints
// ---------------------------------------------------------------------------

/**
 * POST /api/bienbot/sessions/:id/execute
 *
 * Execute pending actions from a session.
 * Validates that requested action IDs exist in the session's pending_actions.
 */
exports.execute = async (req, res) => {
  const userId = req.user._id.toString();
  const { id } = req.params;

  // Validate session ID
  const { valid, objectId: sessionObjId } = validateObjectId(id, 'session ID');
  if (!valid) {
    return errorResponse(res, null, 'Invalid session ID format', 400);
  }

  // Validate action IDs in body
  const { actionIds } = req.body;
  if (!actionIds || !Array.isArray(actionIds) || actionIds.length === 0) {
    return errorResponse(res, null, 'actionIds array is required', 400);
  }

  // Load session
  let session;
  try {
    session = await BienBotSession.findById(sessionObjId);
    if (!session) {
      return errorResponse(res, null, 'Session not found', 404);
    }
    const access = session.checkAccess(userId);
    if (!access.hasAccess) {
      return errorResponse(res, null, 'Session not found', 404);
    }
    // Only owner and editors can execute actions
    if (access.role === 'viewer') {
      return errorResponse(res, null, 'You have view-only access to this session', 403);
    }
  } catch (err) {
    logger.error('[bienbot] Failed to load session for execute', { error: err.message });
    return errorResponse(res, null, 'Failed to load session', 500);
  }

  // Validate all action IDs exist in pending_actions and are not already executed
  const pendingMap = new Map();
  for (const action of (session.pending_actions || [])) {
    pendingMap.set(action.id, action);
  }

  const actionsToExecute = [];
  const invalidIds = [];

  for (const actionId of actionIds) {
    const action = pendingMap.get(actionId);
    if (!action) {
      invalidIds.push(actionId);
    } else if (action.executed) {
      invalidIds.push(actionId); // Already executed
    } else {
      actionsToExecute.push(action);
    }
  }

  if (invalidIds.length > 0) {
    logger.warn('[bienbot] Execute: action IDs not found or already executed', {
      userId,
      sessionId: id,
      requestedIds: actionIds,
      invalidIds,
      storedIds: (session.pending_actions || []).map(a => a.id),
      storedCount: (session.pending_actions || []).length
    });
    return errorResponse(res, null, `Invalid or already executed action IDs: ${invalidIds.join(', ')}`, 400);
  }

  // Execute actions
  try {
    const { results, contextUpdates } = await executeActions(actionsToExecute, req.user, session);

    logger.info('[bienbot] Actions executed', {
      userId,
      sessionId: id,
      actionCount: actionsToExecute.length,
      successCount: results.filter(r => r.success).length
    });

    // --- Contextual enrichment: auto-fetch tips/photos after entity creation ---
    let enrichmentContent = null;
    const destCreation = results.find(
      r => r.success && r.type === 'create_destination' && r.result?._id
    );
    // Also check workflow steps that created a destination
    const workflowDestCreation = !destCreation && results.find(r => {
      if (!r.success || r.type !== 'workflow' || !r.result?.results) return false;
      return r.result.results.some(
        s => s.success && s.type === 'create_destination' && s.result?._id
      );
    });
    const createdDest = destCreation?.result
      || workflowDestCreation?.result?.results?.find(
        s => s.success && s.type === 'create_destination'
      )?.result;

    if (createdDest?._id) {
      try {
        // fetch_destination_tips is now owned by the BienBot tool registry
        // (Wikivoyage provider). Execute it directly via the registry to
        // mirror the chat-loop dispatch path.
        const tipResult = await toolRegistry.executeRegisteredTool(
          'fetch_destination_tips',
          { destination_id: createdDest._id.toString(), destination_name: createdDest.name },
          req.user,
          { session }
        );
        if (tipResult.success && tipResult.body) {
          const block = mapReadOnlyResultToStructuredContent('fetch_destination_tips', tipResult.body);
          if (block) {
            enrichmentContent = block;
          }
        }
      } catch (enrichErr) {
        logger.warn('[bienbot] Post-creation tip enrichment failed', {
          destinationId: createdDest._id,
          error: enrichErr.message
        });
      }
    }

    // Auto-fetch Unsplash photos after experience creation
    if (!enrichmentContent) {
      const expCreation = results.find(
        r => r.success && r.type === 'create_experience' && r.result?._id
      );
      const workflowExpCreation = !expCreation && results.find(r => {
        if (!r.success || r.type !== 'workflow' || !r.result?.results) return false;
        return r.result.results.some(
          s => s.success && s.type === 'create_experience' && s.result?._id
        );
      });
      const createdExp = expCreation?.result
        || workflowExpCreation?.result?.results?.find(
          s => s.success && s.type === 'create_experience'
        )?.result;

      if (createdExp?._id) {
        try {
          const { fetchEntityPhotos } = require('../../../utilities/bienbot-external-data');
          const photoResult = await fetchEntityPhotos(
            { entity_type: 'experience', entity_id: createdExp._id.toString() },
            req.user,
            session
          );
          if (photoResult.statusCode === 200 && photoResult.body?.success) {
            const block = mapReadOnlyResultToStructuredContent('fetch_entity_photos', photoResult.body.data);
            if (block) {
              enrichmentContent = block;
            }
          }
        } catch (enrichErr) {
          logger.warn('[bienbot] Post-creation photo enrichment failed', {
            experienceId: createdExp._id,
            error: enrichErr.message
          });
        }
      }
    }

    // Auto-suggest plan items after plan creation
    if (!enrichmentContent) {
      const planCreation = results.find(
        r => r.success && r.type === 'create_plan' && r.result?._id
      );
      // Also check workflow steps that created a plan
      const workflowPlanCreation = !planCreation && results.find(r => {
        if (!r.success || r.type !== 'workflow' || !r.result?.results) return false;
        return r.result.results.some(
          s => s.success && s.type === 'create_plan' && s.result?._id
        );
      });
      const createdPlan = planCreation?.result
        || workflowPlanCreation?.result?.results?.find(
          s => s.success && s.type === 'create_plan'
        )?.result;

      if (createdPlan?._id) {
        const destId = createdPlan.experience?.destination;
        const expId = createdPlan.experience?._id || createdPlan.experience;
        if (destId) {
          try {
            const { suggestPlanItems } = require('../../../utilities/bienbot-external-data');
            const suggestionResult = await suggestPlanItems(
              {
                destination_id: destId.toString(),
                experience_id: expId?.toString(),
                limit: 5
              },
              req.user
            );
            if (
              suggestionResult.statusCode === 200 &&
              suggestionResult.body?.data?.suggestions?.length > 0
            ) {
              const block = mapReadOnlyResultToStructuredContent(
                'suggest_plan_items',
                suggestionResult.body.data
              );
              if (block) {
                enrichmentContent = block;
              }
            }
          } catch (enrichErr) {
            logger.warn('[bienbot] Post-creation plan item suggestion failed', {
              planId: createdPlan._id,
              error: enrichErr.message
            });
          }
        }
      }
    }

    // --- Post-execution follow-up: generate "what's next?" LLM message for plan mutations ---
    // Triggered when update_plan or create_plan succeeded, so the LLM can suggest next steps
    // with full plan items context loaded.
    let followUpMessage = null;
    const planMutation = results.find(r =>
      r.success && (r.type === 'update_plan' || r.type === 'create_plan') && r.result?._id
    );
    if (planMutation) {
      try {
        const planId = planMutation.result._id.toString();
        const nextStepsBlock = await buildPlanNextStepsContext(planId, userId);
        if (nextStepsBlock) {
          const executedDesc = actionsToExecute.find(a => a.type === planMutation.type)?.description || planMutation.type.replace(/_/g, ' ');
          const followUpSystemPrompt = [
            'You are BienBot, a helpful travel planning assistant for the Biensperience platform.',
            'Use sentence case for all text. Always use US English spellings.',
            'The user just confirmed and executed a plan action. Acknowledge it in one sentence (do not repeat the full action description verbatim), then ask what they want to do next and proactively suggest 2–3 concrete next steps based on the plan items below.',
            'Be specific — name actual plan items that need attention. Keep the total response under 80 words.',
            'Do NOT propose any pending_actions. Respond ONLY with valid JSON: { "message": "..." }',
            '',
            `Action completed: ${executedDesc}`,
            '',
            nextStepsBlock
          ].join('\n');

          const followUpProvider = getProviderForTask(AI_TASKS.BIENBOT_CHAT);
          if (!getApiKey(followUpProvider)) {
            throw new Error('AI provider not configured for follow-up');
          }
          const llmResult = await callProvider(followUpProvider, [
            { role: 'system', content: followUpSystemPrompt },
            { role: 'user', content: '<USER_INPUT>\nWhat should I do next?\n</USER_INPUT>' }
          ], {
            stream: false,
            _user: req.user,
            task: AI_TASKS.BIENBOT_CHAT,
            maxTokens: 300,
            temperature: 0.4
          });

          const raw = (llmResult.content || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
          try {
            const parsed = JSON.parse(raw);
            if (typeof parsed.message === 'string') followUpMessage = parsed.message;
          } catch {
            // If LLM returned plain text (not JSON), use it directly
            if (raw && raw.length < 600) followUpMessage = raw;
          }

          if (followUpMessage) {
            await session.addMessage('assistant', followUpMessage, { actions_taken: [] });
          }
        }
      } catch (followUpErr) {
        logger.warn('[bienbot] Post-execution follow-up LLM call failed', { error: followUpErr.message });
      }
    }

    // Invalidate the cached session summary so the next resume() reflects the executed actions
    try {
      session.summary = undefined;
      session.markModified('summary');
      await session.save();
    } catch (summaryErr) {
      logger.warn('[bienbot] Failed to invalidate summary cache after action execution', { error: summaryErr.message });
    }

    return successResponse(res, {
      results,
      contextUpdates,
      ...(enrichmentContent ? { enrichment: enrichmentContent } : {}),
      ...(followUpMessage ? { followUpMessage } : {}),
      session: {
        id: session._id.toString(),
        context: session.context
      }
    });
  } catch (err) {
    logger.error('[bienbot] Action execution failed', { error: err.message, sessionId: id });
    return errorResponse(res, err, 'Action execution failed', 500);
  }
};

/**
 * DELETE /api/bienbot/sessions/:id/pending/:actionId
 *
 * Remove a specific pending action from a session.
 * Only the session owner can remove pending actions.
 */
exports.deletePendingAction = async (req, res) => {
  const userId = req.user._id.toString();
  const { id, actionId } = req.params;

  const { valid, objectId: sessionObjId } = validateObjectId(id, 'session ID');
  if (!valid) {
    return errorResponse(res, null, 'Invalid session ID format', 400);
  }

  if (!actionId || typeof actionId !== 'string') {
    return errorResponse(res, null, 'Action ID is required', 400);
  }

  try {
    const session = await BienBotSession.findById(sessionObjId);
    if (!session) {
      return errorResponse(res, null, 'Session not found', 404);
    }
    const access = session.checkAccess(userId);
    if (!access.hasAccess) {
      return errorResponse(res, null, 'Session not found', 404);
    }
    // Only owner and editors can cancel actions
    if (access.role === 'viewer') {
      return errorResponse(res, null, 'You have view-only access to this session', 403);
    }

    const actionIndex = (session.pending_actions || []).findIndex(a => a.id === actionId);
    if (actionIndex === -1) {
      return errorResponse(res, null, 'Pending action not found', 404);
    }

    session.pending_actions.splice(actionIndex, 1);
    session.markModified('pending_actions');
    await session.save();

    logger.info('[bienbot] Pending action removed', { userId, sessionId: id, actionId });
    return successResponse(res, { message: 'Pending action removed' });
  } catch (err) {
    logger.error('[bienbot] Failed to remove pending action', { error: err.message, sessionId: id, actionId });
    return errorResponse(res, err, 'Failed to remove pending action', 500);
  }
};

/**
 * PATCH /api/bienbot/sessions/:id/pending/:actionId
 *
 * Update status of a single pending action (skip, edit payload, approve).
 * Used by the sequential workflow confirmation UX.
 *
 * Body: { status: 'approved' | 'skipped', payload?: object }
 */
exports.updatePendingAction = async (req, res) => {
  const userId = req.user._id.toString();
  const { id, actionId } = req.params;
  const { status: newStatus, payload: newPayload } = req.body;

  const { valid, objectId: sessionObjId } = validateObjectId(id, 'session ID');
  if (!valid) {
    return errorResponse(res, null, 'Invalid session ID format', 400);
  }

  if (!actionId || typeof actionId !== 'string') {
    return errorResponse(res, null, 'Action ID is required', 400);
  }

  const allowedStatuses = ['approved', 'skipped'];
  if (!newStatus || !allowedStatuses.includes(newStatus)) {
    return errorResponse(res, null, `Status must be one of: ${allowedStatuses.join(', ')}`, 400);
  }

  let session;
  try {
    session = await BienBotSession.findById(sessionObjId);
    if (!session) {
      return errorResponse(res, null, 'Session not found', 404);
    }
    const access = session.checkAccess(userId);
    if (!access.hasAccess) {
      return errorResponse(res, null, 'Session not found', 404);
    }
    if (access.role === 'viewer') {
      return errorResponse(res, null, 'You have view-only access to this session', 403);
    }
  } catch (err) {
    logger.error('[bienbot] Failed to load session for updatePendingAction', { error: err.message });
    return errorResponse(res, null, 'Failed to load session', 500);
  }

  const action = (session.pending_actions || []).find(a => a.id === actionId);
  if (!action) {
    return errorResponse(res, null, 'Pending action not found', 404);
  }

  if (action.status === 'completed' || (action.executed && action.status !== 'failed')) {
    return errorResponse(res, null, 'Action has already been completed', 400);
  }

  // If retrying a failed step, reset it and un-cascade dependents
  if (action.status === 'failed' && newStatus === 'approved') {
    action.error_message = null;
    action.executed = false;
    action.result = null;
    // Reset dependent steps that were cascade-failed due to this step
    if (action.workflow_id) {
      const siblings = (session.pending_actions || []).filter(
        a => a.workflow_id === action.workflow_id
      );
      for (const sibling of siblings) {
        if (
          sibling.status === 'failed' &&
          Array.isArray(sibling.depends_on) &&
          sibling.depends_on.includes(actionId)
        ) {
          sibling.status = 'pending';
          sibling.error_message = null;
        }
      }
    }
  }

  // Update status
  action.status = newStatus;

  // Optionally update payload (for edit)
  if (newPayload && typeof newPayload === 'object') {
    action.payload = newPayload;
  }

  // If skipped, cascade: mark dependent workflow steps as failed
  if (newStatus === 'skipped' && action.workflow_id) {
    const workflowActions = (session.pending_actions || []).filter(
      a => a.workflow_id === action.workflow_id
    );
    for (const sibling of workflowActions) {
      if (Array.isArray(sibling.depends_on) && sibling.depends_on.includes(actionId)) {
        if (sibling.status === 'pending') {
          sibling.status = 'failed';
          sibling.error_message = `Skipped dependency: "${action.description || actionId}"`;
        }
      }
    }
  }

  // If approved, execute the step immediately
  let executionResult = null;
  if (newStatus === 'approved') {
    action.status = 'executing';
    session.markModified('pending_actions');
    await session.save();

    const workflowActions = action.workflow_id
      ? (session.pending_actions || []).filter(a => a.workflow_id === action.workflow_id)
      : [];

    const outcome = await executeSingleWorkflowStep(action, workflowActions, req.user);
    executionResult = outcome;

    if (outcome.success) {
      action.status = 'completed';
      action.executed = true;
      action.result = { success: true, data: outcome.result, errors: [] };
    } else {
      action.status = 'failed';
      action.error_message = outcome.errors?.[0] || 'Execution failed';
      action.result = { success: false, errors: outcome.errors };

      // Cascade failure to dependents
      if (action.workflow_id) {
        const siblings = (session.pending_actions || []).filter(
          a => a.workflow_id === action.workflow_id
        );
        for (const sibling of siblings) {
          if (Array.isArray(sibling.depends_on) && sibling.depends_on.includes(actionId)) {
            if (sibling.status === 'pending') {
              sibling.status = 'failed';
              sibling.error_message = `Depends on failed step: "${action.description || actionId}"`;
            }
          }
        }
      }
    }
  }

  session.markModified('pending_actions');
  await session.save();

  logger.info('[bienbot] Pending action updated', {
    userId,
    sessionId: id,
    actionId,
    newStatus: action.status,
    isWorkflow: !!action.workflow_id
  });

  // --- Contextual enrichment: auto-fetch tips/photos after entity creation step ---
  let enrichmentContent = null;
  if (
    action.status === 'completed' &&
    action.type === 'create_destination' &&
    executionResult?.success &&
    executionResult?.result?._id
  ) {
    try {
      const tipResult = await toolRegistry.executeRegisteredTool(
        'fetch_destination_tips',
        { destination_id: executionResult.result._id.toString(), destination_name: executionResult.result.name },
        req.user,
        { session }
      );
      if (tipResult.success && tipResult.body) {
        const block = mapReadOnlyResultToStructuredContent('fetch_destination_tips', tipResult.body);
        if (block) {
          enrichmentContent = block;
        }
      }
    } catch (enrichErr) {
      logger.warn('[bienbot] Post-step tip enrichment failed', {
        destinationId: executionResult.result._id,
        error: enrichErr.message
      });
    }
  }

  // Auto-fetch Unsplash photos after experience creation step
  if (
    !enrichmentContent &&
    action.status === 'completed' &&
    action.type === 'create_experience' &&
    executionResult?.success &&
    executionResult?.result?._id
  ) {
    try {
      const { fetchEntityPhotos } = require('../../../utilities/bienbot-external-data');
      const photoResult = await fetchEntityPhotos(
        { entity_type: 'experience', entity_id: executionResult.result._id.toString() },
        req.user,
        session
      );
      if (photoResult.statusCode === 200 && photoResult.body?.success) {
        const block = mapReadOnlyResultToStructuredContent('fetch_entity_photos', photoResult.body.data);
        if (block) {
          enrichmentContent = block;
        }
      }
    } catch (enrichErr) {
      logger.warn('[bienbot] Post-step photo enrichment failed', {
        experienceId: executionResult.result._id,
        error: enrichErr.message
      });
    }
  }

  return successResponse(res, {
    action: {
      id: action.id,
      type: action.type,
      status: action.status,
      error_message: action.error_message,
      result: action.result,
      workflow_id: action.workflow_id,
      workflow_step: action.workflow_step,
      workflow_total: action.workflow_total
    },
    execution: executionResult,
    ...(enrichmentContent ? { enrichment: enrichmentContent } : {}),
    pending_actions: session.pending_actions
  });
};

/**
 * GET /api/bienbot/sessions/:id/workflow/:workflowId
 *
 * Get the full state of a workflow — all actions sharing the same workflow_id.
 */
exports.getWorkflowState = async (req, res) => {
  const userId = req.user._id.toString();
  const { id, workflowId } = req.params;

  const { valid, objectId: sessionObjId } = validateObjectId(id, 'session ID');
  if (!valid) {
    return errorResponse(res, null, 'Invalid session ID format', 400);
  }

  if (!workflowId || typeof workflowId !== 'string') {
    return errorResponse(res, null, 'Workflow ID is required', 400);
  }

  let session;
  try {
    session = await BienBotSession.findById(sessionObjId).lean();
    if (!session) {
      return errorResponse(res, null, 'Session not found', 404);
    }
    const uid = userId;
    const isOwner = session.user.toString() === uid;
    const isCollab = (session.shared_with || []).some(c => c.user_id.toString() === uid);
    if (!isOwner && !isCollab) {
      return errorResponse(res, null, 'Session not found', 404);
    }
  } catch (err) {
    logger.error('[bienbot] Failed to load session for getWorkflowState', { error: err.message });
    return errorResponse(res, null, 'Failed to load session', 500);
  }

  const workflowActions = (session.pending_actions || []).filter(
    a => a.workflow_id === workflowId
  );

  if (workflowActions.length === 0) {
    return errorResponse(res, null, 'Workflow not found', 404);
  }

  // Sort by step number
  workflowActions.sort((a, b) => (a.workflow_step || 0) - (b.workflow_step || 0));

  const completed = workflowActions.filter(a => a.status === 'completed').length;
  const skipped = workflowActions.filter(a => a.status === 'skipped').length;
  const failed = workflowActions.filter(a => a.status === 'failed').length;
  const pending = workflowActions.filter(a => a.status === 'pending').length;

  return successResponse(res, {
    workflow_id: workflowId,
    total: workflowActions.length,
    completed,
    skipped,
    failed,
    pending,
    actions: workflowActions
  });
};


// ---------------------------------------------------------------------------
// Module exports — controller handlers + helpers needed by chat.js
// ---------------------------------------------------------------------------

module.exports = {
  // Helpers (used by chat.js and the tool-loop)
  explodeWorkflows,
  ACTION_ENTITY_VERIFY,
  verifyPendingActionEntityIds,
  // Controller handlers
  execute: exports.execute,
  deletePendingAction: exports.deletePendingAction,
  updatePendingAction: exports.updatePendingAction,
  getWorkflowState: exports.getWorkflowState,
};

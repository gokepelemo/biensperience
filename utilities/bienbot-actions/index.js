/**
 * BienBot action registry — aggregates per-domain handlers into a single
 * dispatch surface.
 *
 * This module is the public API for action execution. The legacy
 * `utilities/bienbot-action-executor.js` is now a thin façade that re-exports
 * everything here so all 30+ existing import sites keep working unchanged.
 *
 * Domain modules each export:
 *   - ALLOWED_TYPES: string[]   — action types this module handles
 *   - READ_ONLY_TYPES: string[] — subset that auto-executes (no confirmation)
 *   - TOOL_CALL_TYPES: string[] — subset usable as silent LLM tool calls
 *   - HANDLERS: Record<string, Handler> — type → async handler function
 *
 * @module utilities/bienbot-actions
 */

const logger = require('../backend-logger');

const planActions        = require('./plan-actions');
const experienceActions  = require('./experience-actions');
const destinationActions = require('./destination-actions');
const userActions        = require('./user-actions');
const discoveryActions   = require('./discovery-actions');
const workflowActions    = require('./workflow-actions');
const { STRUCTURED_CONTENT_TYPES } = require('./_shared');

// ---------------------------------------------------------------------------
// Registry aggregation
// ---------------------------------------------------------------------------

const DOMAIN_MODULES = [
  planActions,
  experienceActions,
  destinationActions,
  userActions,
  discoveryActions,
  workflowActions
];

/**
 * Strict allowlist of action types that can be executed.
 * Unknown types are dropped and logged — never executed.
 *
 * Order matters for the legacy `ALLOWED_ACTION_TYPES` array shape: the original
 * file preserved a specific order which downstream consumers may iterate. We
 * concatenate domain ALLOWED_TYPES in a stable order (matches the historical
 * grouping in bienbot-action-executor.js).
 */
const ALLOWED_ACTION_TYPES = DOMAIN_MODULES.flatMap(m => m.ALLOWED_TYPES);
const ALLOWED_ACTION_TYPES_SET = new Set(ALLOWED_ACTION_TYPES);

const READ_ONLY_ACTION_TYPES = new Set(
  DOMAIN_MODULES.flatMap(m => m.READ_ONLY_TYPES)
);

/**
 * Read-only fetchers usable as silent tool calls in the LLM tool-use loop.
 * Subset of READ_ONLY_ACTION_TYPES — only fetchers designed for LLM consumption
 * (typed, compact result shape) belong here. Card-producing actions like
 * fetch_entity_photos do NOT belong here; they remain user-facing only.
 */
const TOOL_CALL_ACTION_TYPES = new Set(
  DOMAIN_MODULES.flatMap(m => m.TOOL_CALL_TYPES)
);

/**
 * Master action handler dispatch map.
 * Aggregated from each domain module's HANDLERS export.
 * Sanity-check at registration time: refuse silent collisions across domains.
 */
const ACTION_HANDLERS = {};
for (const mod of DOMAIN_MODULES) {
  for (const [type, handler] of Object.entries(mod.HANDLERS)) {
    if (ACTION_HANDLERS[type]) {
      // This indicates a coding error — two domain modules registered the
      // same action type. Fail loudly so it gets caught in tests, not
      // silently overridden by load order.
      throw new Error(`[bienbot-actions] Duplicate handler registration for action type "${type}"`);
    }
    ACTION_HANDLERS[type] = handler;
  }
}

// ---------------------------------------------------------------------------
// Public API — executeAction / executeActions
// ---------------------------------------------------------------------------

/**
 * Execute a single pending action.
 *
 * @param {object} action - { id, type, payload, description }
 * @param {object} user - Authenticated user object (must include _id, name, email).
 * @param {object|null} [session] - Active BienBotSession document; forwarded to handlers that use it.
 * @returns {Promise<{ success: boolean, result: object|null, errors: string[] }>}
 */
async function executeAction(action, user, session = null) {
  if (!action || !action.type) {
    return { success: false, result: null, errors: ['Missing action or action type'] };
  }

  if (!user || !user._id) {
    return { success: false, result: null, errors: ['Missing user'] };
  }

  // Registry-aware dispatch: tools owned by the BienBot tool registry
  // (Wikivoyage, Google Maps, …) are not in ALLOWED_ACTION_TYPES — the
  // registry is their source of truth. Check it before the legacy allowlist
  // so registry-owned action types pass through.
  let registryEntry = null;
  try {
    const registry = require('../bienbot-tool-registry');
    const { bootstrap } = require('../bienbot-tool-registry/bootstrap');
    bootstrap();
    registryEntry = registry.getTool(action.type);
  } catch {
    // Registry not available (test environments mock the executor and may not
    // bootstrap the registry); fall through to legacy allowlist below.
  }

  if (!registryEntry && !ALLOWED_ACTION_TYPES_SET.has(action.type)) {
    logger.warn('[bienbot-action-executor] Unknown action type rejected', {
      type: action.type,
      actionId: action.id,
      userId: user._id.toString()
    });
    return { success: false, result: null, errors: [`Unknown action type: ${action.type}`] };
  }

  // Idempotency: a pending_action carrying `executed: true` has already been
  // run. Re-executing would re-create entities or re-send invites — refuse.
  // The atomic guard against parallel double-clicks lives in the controller
  // (BienBotSession.markActionExecuted is the single source of truth).
  if (action.executed === true) {
    logger.warn('[bienbot-action-executor] Refusing to re-execute already-executed action', {
      type: action.type,
      actionId: action.id,
      userId: user._id.toString()
    });
    return { success: false, result: null, errors: ['Action already executed'] };
  }

  // Registry tools dispatch through executeRegisteredTool (handles payload
  // validation, providerCtx, retry policy). Internal action types use the
  // ACTION_HANDLERS map below.
  if (registryEntry) {
    try {
      logger.info('[bienbot-action-executor] Executing registry tool', {
        type: action.type,
        actionId: action.id,
        userId: user._id.toString()
      });
      const registry = require('../bienbot-tool-registry');
      const out = await registry.executeRegisteredTool(action.type, action.payload || {}, user, { session });
      return {
        success: out.success,
        result: out.body || null,
        errors: out.errors || [],
        statusCode: out.statusCode,
        body: out.body
      };
    } catch (err) {
      logger.error('[bienbot-action-executor] Registry tool threw exception', {
        type: action.type,
        actionId: action.id
      }, err);
      return { success: false, result: null, errors: [err.message] };
    }
  }

  const handler = ACTION_HANDLERS[action.type];

  try {
    logger.info('[bienbot-action-executor] Executing action', {
      type: action.type,
      actionId: action.id,
      userId: user._id.toString()
    });

    const response = await handler(action.payload || {}, user, session);
    const isSuccess = response.statusCode >= 200 && response.statusCode < 300;

    if (isSuccess) {
      logger.info('[bienbot-action-executor] Action succeeded', {
        type: action.type,
        actionId: action.id,
        statusCode: response.statusCode
      });
    } else {
      logger.warn('[bienbot-action-executor] Action failed', {
        type: action.type,
        actionId: action.id,
        statusCode: response.statusCode,
        error: response.body?.error,
        details: response.body?.details
      });
    }

    return {
      success: isSuccess,
      result: response.body?.data || response.body || null,
      errors: isSuccess ? [] : [response.body?.error || `Action failed with status ${response.statusCode}`],
      statusCode: response.statusCode,
      body: response.body
    };
  } catch (err) {
    logger.error('[bienbot-action-executor] Action threw exception', {
      type: action.type,
      actionId: action.id
    }, err);
    return { success: false, result: null, errors: [err.message] };
  }
}

/**
 * Execute multiple pending actions in sequence, updating session context
 * with results (e.g. newly created IDs for subsequent turns).
 *
 * @param {object[]} actions - Array of pending action objects.
 * @param {object} user - Authenticated user object.
 * @param {object} session - BienBotSession document (will be mutated).
 * @returns {Promise<{ results: object[], contextUpdates: object }>}
 */
async function executeActions(actions, user, session) {
  const results = [];
  const contextUpdates = {};

  for (const action of actions) {
    const outcome = await executeAction(action, user, session);
    results.push({ actionId: action.id, type: action.type, payload: action.payload || {}, ...outcome });

    // Mark action as executed on the session
    if (session && typeof session.markActionExecuted === 'function') {
      await session.markActionExecuted(action.id, {
        success: outcome.success,
        errors: outcome.errors
      });
    }

    // Extract context updates from successful results
    if (outcome.success && outcome.result) {
      const data = outcome.result;

      switch (action.type) {
        case 'create_destination':
          if (data._id) contextUpdates.destination_id = data._id;
          break;
        case 'create_experience':
          if (data._id) contextUpdates.experience_id = data._id;
          if (data.destination) contextUpdates.destination_id = data.destination;
          break;
        case 'create_plan':
          if (data._id) contextUpdates.plan_id = data._id;
          if (data.experience?._id) contextUpdates.experience_id = data.experience._id;
          break;
        case 'select_plan':
          if (data.plan_id) contextUpdates.plan_id = data.plan_id;
          if (data.experience_id) contextUpdates.experience_id = data.experience_id;
          if (data.destination_id) contextUpdates.destination_id = data.destination_id;
          break;
        case 'select_destination':
          if (data.destination_id) contextUpdates.destination_id = data.destination_id;
          break;
        case 'add_plan_items':
        case 'update_plan_item':
        case 'sync_plan':
          // Plan context already set; no new IDs to extract
          break;
        case 'invite_collaborator':
          // No context change needed
          break;
        case 'workflow':
          // Extract context from workflow step results
          if (data.results && Array.isArray(data.results)) {
            for (const stepResult of data.results) {
              if (!stepResult.success || !stepResult.result) continue;
              const sData = stepResult.result;
              switch (stepResult.type) {
                case 'create_destination':
                  if (sData._id) contextUpdates.destination_id = sData._id;
                  break;
                case 'create_experience':
                  if (sData._id) contextUpdates.experience_id = sData._id;
                  if (sData.destination) contextUpdates.destination_id = sData.destination;
                  break;
                case 'create_plan':
                  if (sData._id) contextUpdates.plan_id = sData._id;
                  if (sData.experience?._id) contextUpdates.experience_id = sData.experience._id;
                  break;
              }
            }
          }
          break;
      }
    }
  }

  // Apply accumulated context updates to session
  if (session && Object.keys(contextUpdates).length > 0) {
    if (typeof session.updateContext === 'function') {
      await session.updateContext(contextUpdates);
    }
  }

  return { results, contextUpdates };
}

// ---------------------------------------------------------------------------
// Re-exports from workflow module (after main exports — avoids circular ref
// at workflow-actions.js load time, which lazily requires this index.)
// ---------------------------------------------------------------------------

const { executeWorkflow, executeSingleWorkflowStep, resolveRefs } = workflowActions;

module.exports = {
  // Executor entry points
  executeAction,
  executeActions,
  executeSingleWorkflowStep,
  executeWorkflow,
  resolveRefs,
  // Registry tables (public + internal _SET form)
  ACTION_HANDLERS,
  ALLOWED_ACTION_TYPES,
  ALLOWED_ACTION_TYPES_SET,
  READ_ONLY_ACTION_TYPES,
  TOOL_CALL_ACTION_TYPES,
  STRUCTURED_CONTENT_TYPES
};

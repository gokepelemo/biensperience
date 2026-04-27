/**
 * BienBot workflow actions.
 *
 * Pure relocation from utilities/bienbot-action-executor.js — no behavior change.
 * Provides multi-step composition with $step_N.field reference resolution.
 *
 * Special-case: this module imports the aggregated handler map lazily via
 * `require('./index')` to dispatch each step. This avoids a circular load —
 * index.js is only consulted at execution time, not at module load.
 *
 * @module utilities/bienbot-actions/workflow-actions
 */

const {
  MAX_WORKFLOW_STEPS,
  STEP_REF_ALLOWED_FIELDS,
  logger
} = require('./_shared');

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

class WorkflowRefError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WorkflowRefError';
  }
}

// ---------------------------------------------------------------------------
// Reference resolution
// ---------------------------------------------------------------------------

/**
 * Resolve `$ref` placeholders in a payload using outputs from earlier steps.
 *
 * A `$ref` placeholder has the form `$step_<N>.<path>`, where N is the 1-based
 * step index and path is a dot-delimited property path into that step's result.
 * For example, `$step_1._id` resolves to the `_id` of step 1's result.
 *
 * Security: the leading path segment must appear in `STEP_REF_ALLOWED_FIELDS`.
 * This prevents LLM-influenced workflow payloads from reading sensitive fields
 * (e.g. `user.email`, `user.password`, `oauth.*`) from a previous step.
 * Unknown leading segments throw `WorkflowRefError` so the failure surfaces
 * clearly rather than producing a confusing downstream CastError.
 *
 * Unresolvable refs (missing step, missing field, denied field) throw — the
 * surrounding workflow loop catches and turns them into a structured error.
 *
 * @param {*} value - Payload value to resolve (may be string, array, or nested object).
 * @param {Map<number, object>} stepResults - Map of step index → result data.
 * @returns {*} Resolved value.
 */
function resolveRefs(value, stepResults) {
  if (typeof value === 'string') {
    const refMatch = value.match(/^\$step_(\d+)\.(.+)$/);
    if (refMatch) {
      const stepIdx = parseInt(refMatch[1], 10);
      const path = refMatch[2];
      const segments = path.split('.');
      const leading = segments[0];

      if (!STEP_REF_ALLOWED_FIELDS.has(leading)) {
        throw new WorkflowRefError(`Workflow ref "$step_${stepIdx}.${path}" denied: field "${leading}" is not in the step-result allowlist`);
      }

      const stepResult = stepResults.get(stepIdx);
      if (stepResult === undefined) {
        throw new WorkflowRefError(`Workflow ref "$step_${stepIdx}.${path}" unresolvable: no result recorded for step ${stepIdx}`);
      }

      const resolved = segments.reduce((obj, key) => (obj == null ? obj : obj[key]), stepResult);
      if (resolved === undefined || resolved === null) {
        throw new WorkflowRefError(`Workflow ref "$step_${stepIdx}.${path}" unresolvable: field is null/undefined on step ${stepIdx} result`);
      }
      return resolved;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(v => resolveRefs(v, stepResults));
  }
  if (value && typeof value === 'object') {
    const resolved = {};
    for (const [k, v] of Object.entries(value)) {
      resolved[k] = resolveRefs(v, stepResults);
    }
    return resolved;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Workflow execution
// ---------------------------------------------------------------------------

/**
 * Execute a workflow — a sequence of steps with dependency resolution.
 *
 * payload: {
 *   steps: [{
 *     step: 1,                       // 1-based step number
 *     type: "<action_type>",
 *     payload: { ... may contain $step_N.field refs ... },
 *     description: "Human-readable step description"
 *   }, ...]
 * }
 *
 * Steps are executed sequentially in `step` order.  Each step's result is
 * stored so that later steps can reference earlier outputs via `$ref` syntax
 * in their payloads (e.g. `"destination_id": "$step_1._id"` references step 1's result).
 *
 * If any step fails, execution halts and partial results are returned.
 */
async function executeWorkflow(payload, user, session = null) {
  // Lazy-require the aggregated registry to avoid circular load at module-init.
  const { ALLOWED_ACTION_TYPES_SET, ACTION_HANDLERS } = require('./index');

  const steps = Array.isArray(payload.steps) ? payload.steps : [];

  if (steps.length === 0) {
    return { statusCode: 400, body: { success: false, error: 'Workflow has no steps' } };
  }

  if (steps.length > MAX_WORKFLOW_STEPS) {
    return {
      statusCode: 400,
      body: { success: false, error: `Workflow exceeds maximum of ${MAX_WORKFLOW_STEPS} steps` }
    };
  }

  // Reject duplicate step numbers — last-write-wins on stepResults would
  // silently break $step_N refs from the duplicated index.
  const seenSteps = new Set();
  for (const step of steps) {
    if (!Number.isInteger(step.step) || step.step < 1) {
      return { statusCode: 400, body: { success: false, error: 'Each workflow step must have an integer "step" >= 1' } };
    }
    if (seenSteps.has(step.step)) {
      return { statusCode: 400, body: { success: false, error: `Duplicate workflow step number: ${step.step}` } };
    }
    seenSteps.add(step.step);
  }

  // Sort by step number (ascending)
  const sorted = [...steps].sort((a, b) => a.step - b.step);

  const stepResults = new Map(); // step index → result data
  const results = [];

  for (const step of sorted) {
    const stepType = step.type;
    if (!stepType || stepType === 'workflow') {
      // Prevent nested workflows and invalid types
      results.push({ step: step.step, type: stepType, success: false, errors: ['Invalid step type'] });
      break;
    }

    if (!ALLOWED_ACTION_TYPES_SET.has(stepType)) {
      results.push({ step: step.step, type: stepType, success: false, errors: [`Unknown action type: ${stepType}`] });
      break;
    }

    // Resolve $ref placeholders in the step's payload
    let resolvedPayload;
    try {
      resolvedPayload = resolveRefs(step.payload || {}, stepResults);
    } catch (refErr) {
      logger.warn('[bienbot-action-executor] Workflow ref resolution failed', {
        step: step.step,
        type: stepType,
        error: refErr.message
      });
      results.push({ step: step.step, type: stepType, success: false, errors: [refErr.message] });
      break;
    }

    const handler = ACTION_HANDLERS[stepType];
    if (!handler) {
      results.push({ step: step.step, type: stepType, success: false, errors: [`No handler for: ${stepType}`] });
      break;
    }

    try {
      logger.info('[bienbot-action-executor] Workflow step executing', {
        step: step.step,
        type: stepType,
        payload_keys: Object.keys(resolvedPayload || {}),
        userId: user._id.toString()
      });

      const response = await handler(resolvedPayload, user, session);
      const isSuccess = response.statusCode >= 200 && response.statusCode < 300;
      const resultData = response.body?.data || response.body || null;

      results.push({
        step: step.step,
        type: stepType,
        success: isSuccess,
        result: resultData,
        errors: isSuccess ? [] : [response.body?.error || `Step failed with status ${response.statusCode}`]
      });

      if (isSuccess && resultData) {
        stepResults.set(step.step, resultData);
      } else {
        // Stop on failure. Side-effects from earlier steps remain in place;
        // include `partial_state_warning` so callers can surface this to
        // the user / consider compensating actions.
        logger.warn('[bienbot-action-executor] Workflow step failed, halting', {
          step: step.step,
          type: stepType,
          statusCode: response.statusCode
        });
        break;
      }
    } catch (err) {
      logger.error('[bienbot-action-executor] Workflow step threw exception', {
        step: step.step,
        type: stepType,
        error: err.message
      }, err);
      results.push({ step: step.step, type: stepType, success: false, errors: [err.message] });
      break;
    }
  }

  const allSucceeded = results.length === sorted.length && results.every(r => r.success);
  const partialStateWarning = !allSucceeded && results.some(r => r.success);

  return {
    statusCode: allSucceeded ? 200 : 207,
    body: {
      success: allSucceeded,
      data: {
        steps_completed: results.filter(r => r.success).length,
        steps_total: sorted.length,
        partial_state_warning: partialStateWarning,
        results
      }
    }
  };
}

/**
 * Execute a single workflow step, resolving $step_N refs from the results of
 * already-completed sibling actions.
 *
 * If the step depends on a skipped step, it auto-fails with a clear message.
 *
 * @param {object} action - The pending action to execute (must have workflow_id).
 * @param {object[]} workflowActions - All pending_actions sharing the same workflow_id.
 * @param {object} user - Authenticated user object.
 * @returns {Promise<{ success: boolean, result: object|null, errors: string[] }>}
 */
async function executeSingleWorkflowStep(action, workflowActions, user) {
  // Lazy-require the aggregated handler map
  const { ACTION_HANDLERS } = require('./index');

  if (!action || !action.type) {
    return { success: false, result: null, errors: ['Missing action or action type'] };
  }

  // Check if any depends_on actions were skipped or failed
  if (Array.isArray(action.depends_on) && action.depends_on.length > 0) {
    for (const depId of action.depends_on) {
      const depAction = workflowActions.find(a => a.id === depId);
      if (depAction && (depAction.status === 'skipped' || depAction.status === 'failed')) {
        const reason = depAction.status === 'skipped'
          ? `Depends on skipped step "${depAction.description || depAction.id}"`
          : `Depends on failed step "${depAction.description || depAction.id}"`;
        return { success: false, result: null, errors: [reason] };
      }
      // If dependency hasn't been completed yet, it's an ordering error
      if (depAction && depAction.status !== 'completed') {
        return {
          success: false,
          result: null,
          errors: [`Dependency "${depAction.description || depAction.id}" has not been completed yet`]
        };
      }
    }
  }

  // Build step results from completed sibling actions for $ref resolution
  const stepResults = new Map();
  for (const sibling of workflowActions) {
    if (sibling.status === 'completed' && sibling.result && sibling.workflow_step != null) {
      // Extract the data from the result (may be wrapped)
      const data = sibling.result?.data || sibling.result;
      stepResults.set(sibling.workflow_step, data);
    }
  }

  // Resolve $step_N references in the payload
  let resolvedPayload;
  try {
    resolvedPayload = resolveRefs(action.payload || {}, stepResults);
  } catch (refErr) {
    logger.warn('[bienbot-action-executor] Workflow step ref resolution failed', {
      type: action.type,
      actionId: action.id,
      workflowId: action.workflow_id,
      error: refErr.message
    });
    return { success: false, result: null, errors: [refErr.message] };
  }

  // Execute using the standard handler
  const handler = ACTION_HANDLERS[action.type];
  if (!handler) {
    return { success: false, result: null, errors: [`No handler for: ${action.type}`] };
  }

  try {
    logger.info('[bienbot-action-executor] Executing workflow step', {
      type: action.type,
      actionId: action.id,
      workflowId: action.workflow_id,
      step: action.workflow_step,
      payload_keys: Object.keys(resolvedPayload || {}),
      userId: user._id.toString()
    });

    const response = await handler(resolvedPayload, user);
    const isSuccess = response.statusCode >= 200 && response.statusCode < 300;

    return {
      success: isSuccess,
      result: response.body?.data || response.body || null,
      errors: isSuccess ? [] : [response.body?.error || `Step failed with status ${response.statusCode}`]
    };
  } catch (err) {
    logger.error('[bienbot-action-executor] Workflow step threw exception', {
      type: action.type,
      actionId: action.id
    }, err);
    return { success: false, result: null, errors: [err.message] };
  }
}

module.exports = {
  // Allowed action types covered by this module (workflow itself is here)
  ALLOWED_TYPES: ['workflow'],
  READ_ONLY_TYPES: [],
  TOOL_CALL_TYPES: [],
  HANDLERS: {
    workflow: executeWorkflow
  },
  // Public exports
  executeWorkflow,
  executeSingleWorkflowStep,
  resolveRefs,
  WorkflowRefError
};

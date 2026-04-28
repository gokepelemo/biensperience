import { useState, useCallback } from 'react';
import {
  executeActions as executeActionsAPI,
  cancelAction as cancelActionAPI,
  getSession,
  updateActionStatus as updateActionStatusAPI,
} from '../utilities/bienbot-api';
import { logger } from '../utilities/logger';

/**
 * useActionManager — owns the BienBot pendingActions slice and the action
 * lifecycle helpers (execute / cancel) plus the workflow-step helpers
 * (approve / skip / edit / cancel-workflow).
 *
 * Pure relocation of the action-management surface out of `useBienBot.js`.
 *
 * @param {Object} params
 * @param {Object} params.sessionIdRef        - Ref holding the active session id
 * @param {Function} params.setCurrentSession - React setter for the current session (executeActions merges server-side updates)
 * @param {Function} params.setIsLoading      - React setter for the global loading flag
 *
 * @returns {{
 *   pendingActions: Array,
 *   setPendingActions: Function,
 *   executeActions: (actionIds: string[]) => Promise<Object|null>,
 *   cancelAction: (actionId: string) => Promise<void>,
 *   approveStep: (actionId: string) => Promise<Object|null>,
 *   skipStep: (actionId: string) => Promise<Object|null>,
 *   editStep: (actionId: string, newPayload: Object) => Promise<Object|null>,
 *   cancelWorkflow: (workflowId: string) => Promise<void>,
 * }}
 */
export default function useActionManager({
  sessionIdRef,
  setCurrentSession,
  setIsLoading,
}) {
  const [pendingActions, setPendingActions] = useState([]);

  // ---------------------------------------------------------------------------
  // executeActions
  // ---------------------------------------------------------------------------

  /**
   * Execute pending actions by IDs.
   * Entity events are emitted by bienbot-api.js automatically.
   *
   * @param {string[]} actionIds - Action IDs to execute
   * @returns {Promise<Object|null>} Execution result or null on error
   */
  const executeActions = useCallback(async (actionIds) => {
    const sid = sessionIdRef.current;
    if (!sid || !actionIds?.length) return null;

    setIsLoading(true);
    try {
      const result = await executeActionsAPI(sid, actionIds);

      // Remove executed actions from pendingActions
      setPendingActions(prev =>
        prev.filter(a => !actionIds.includes(a._id || a.id))
      );

      // If the server returned an updated session, merge it — don't replace.
      // The execute endpoint returns a sparse { id, context } object and does not
      // include the `user` field, so a full replace would make isSessionOwner false
      // on subsequent renders, incorrectly routing follow-up messages to sendSharedComment.
      if (result?.session) {
        setCurrentSession(prev => prev ? { ...prev, ...result.session } : result.session);
      }

      return result;
    } catch (err) {
      logger.error('[useBienBot] Failed to execute actions', { error: err.message });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [sessionIdRef, setCurrentSession, setIsLoading]);

  // ---------------------------------------------------------------------------
  // cancelAction
  // ---------------------------------------------------------------------------

  /**
   * Cancel (remove) a single pending action.
   *
   * @param {string} actionId - Action ID to cancel
   */
  const cancelAction = useCallback(async (actionId) => {
    const sid = sessionIdRef.current;
    if (!sid || !actionId) return;

    try {
      await cancelActionAPI(sid, actionId);
      setPendingActions(prev => prev.filter(a => (a._id || a.id) !== actionId));
    } catch (err) {
      logger.error('[useBienBot] Failed to cancel action', { error: err.message });
    }
  }, [sessionIdRef]);

  // ---------------------------------------------------------------------------
  // Workflow step management
  // ---------------------------------------------------------------------------

  /**
   * Approve a workflow step. Executes it immediately and updates local state.
   *
   * @param {string} actionId - Action ID to approve
   * @returns {Promise<Object|null>} Updated action result, or null on error
   */
  const approveStep = useCallback(async (actionId) => {
    const sid = sessionIdRef.current;
    if (!sid || !actionId) return null;

    setIsLoading(true);
    try {
      const data = await updateActionStatusAPI(sid, actionId, 'approved');

      // Sync pending actions from server response
      if (data?.pending_actions) {
        setPendingActions(data.pending_actions.filter(a => !a.executed));
      }

      return data;
    } catch (err) {
      logger.error('[useBienBot] Failed to approve step', { error: err.message, actionId });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [sessionIdRef, setIsLoading]);

  /**
   * Skip a workflow step. Cascades failure to dependent steps.
   *
   * @param {string} actionId - Action ID to skip
   * @returns {Promise<Object|null>} Updated action result, or null on error
   */
  const skipStep = useCallback(async (actionId) => {
    const sid = sessionIdRef.current;
    if (!sid || !actionId) return null;

    try {
      const data = await updateActionStatusAPI(sid, actionId, 'skipped');

      if (data?.pending_actions) {
        setPendingActions(data.pending_actions.filter(a => !a.executed));
      }

      return data;
    } catch (err) {
      logger.error('[useBienBot] Failed to skip step', { error: err.message, actionId });
      return null;
    }
  }, [sessionIdRef]);

  /**
   * Edit a workflow step's payload and optionally approve it.
   *
   * @param {string} actionId - Action ID to edit
   * @param {Object} newPayload - Updated payload
   * @returns {Promise<Object|null>} Updated action result, or null on error
   */
  const editStep = useCallback(async (actionId, newPayload) => {
    const sid = sessionIdRef.current;
    if (!sid || !actionId) return null;

    setIsLoading(true);
    try {
      const data = await updateActionStatusAPI(sid, actionId, 'approved', newPayload);

      if (data?.pending_actions) {
        setPendingActions(data.pending_actions.filter(a => !a.executed));
      }

      return data;
    } catch (err) {
      logger.error('[useBienBot] Failed to edit step', { error: err.message, actionId });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [sessionIdRef, setIsLoading]);

  /**
   * Cancel an entire workflow (skip all remaining pending steps).
   *
   * @param {string} workflowId - Workflow ID to cancel
   * @returns {Promise<void>}
   */
  const cancelWorkflow = useCallback(async (workflowId) => {
    const sid = sessionIdRef.current;
    if (!sid || !workflowId) return;

    const workflowSteps = pendingActions.filter(
      a => a.workflow_id === workflowId && a.status === 'pending'
    );

    for (const step of workflowSteps) {
      try {
        await updateActionStatusAPI(sid, step.id, 'skipped');
      } catch (err) {
        logger.error('[useBienBot] Failed to skip workflow step during cancel', {
          error: err.message,
          actionId: step.id
        });
      }
    }

    // Refresh pending actions from server
    try {
      const sessionData = await getSession(sid);
      if (sessionData?.pending_actions) {
        setPendingActions(sessionData.pending_actions.filter(a => !a.executed));
      }
    } catch (err) {
      logger.error('[useBienBot] Failed to refresh after workflow cancel', { error: err.message });
    }
  }, [pendingActions, sessionIdRef]);

  return {
    pendingActions,
    setPendingActions,
    executeActions,
    cancelAction,
    approveStep,
    skipStep,
    editStep,
    cancelWorkflow,
  };
}

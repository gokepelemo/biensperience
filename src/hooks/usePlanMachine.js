import { useState, useEffect, useCallback, useRef } from 'react';
import { createPlanMachine, PLAN_STATES, PLAN_EVENTS } from '../machines/planMachine';
import { logger } from '../utilities/logger';

/**
 * React hook for plan state machine
 * Provides state management with guaranteed valid transitions
 *
 * @param {string} planId - Plan identifier
 * @param {Object} options - Configuration options
 * @param {string} options.initialState - Initial state (default: IDLE)
 * @param {Function} options.onStateChange - Callback for state changes
 * @param {boolean} options.debug - Enable debug logging
 * @returns {Object} State machine interface
 */
export default function usePlanMachine(planId, options = {}) {
  const {
    initialState = PLAN_STATES.IDLE,
    onStateChange,
    debug = false
  } = options;

  // Create state machine instance (persists across renders)
  const machineRef = useRef(null);
  if (!machineRef.current) {
    machineRef.current = createPlanMachine(initialState);
  }

  // React state for triggering re-renders
  const [state, setState] = useState(machineRef.current.getState());
  const [context, setContext] = useState(machineRef.current.getContext());

  /**
   * Subscribe to state machine changes
   */
  useEffect(() => {
    const unsubscribe = machineRef.current.subscribe((stateChange) => {
      if (debug) {
        logger.info('[PlanMachine] State change:', {
          planId,
          from: stateChange.previousState,
          to: stateChange.state,
          event: stateChange.event
        });
      }

      // Update React state
      setState(stateChange.state);
      setContext({ ...stateChange.context });

      // Call user callback
      if (onStateChange) {
        onStateChange(stateChange);
      }
    });

    return unsubscribe;
  }, [planId, onStateChange, debug]);

  /**
   * Send event to state machine
   */
  const send = useCallback((event, payload = {}) => {
    if (debug) {
      logger.debug('[PlanMachine] Sending event:', { planId, event, payload });
    }
    return machineRef.current.send(event, payload);
  }, [planId, debug]);

  /**
   * Check if in specific state
   */
  const is = useCallback((checkState) => {
    return machineRef.current.is(checkState);
  }, []);

  /**
   * Check if transition is allowed
   */
  const canTransition = useCallback((event) => {
    return machineRef.current.canTransition(event);
  }, []);

  /**
   * Get available transitions
   */
  const getAvailableTransitions = useCallback(() => {
    return machineRef.current.getAvailableTransitions();
  }, []);

  /**
   * Reset machine to initial state
   */
  const reset = useCallback(() => {
    machineRef.current.reset();
  }, []);

  /**
   * Get transition history
   */
  const getHistory = useCallback(() => {
    return machineRef.current.getHistory();
  }, []);

  /**
   * Derived state helpers
   */
  const isIdle = is(PLAN_STATES.IDLE);
  const isCreating = is(PLAN_STATES.CREATING);
  const isActive = is(PLAN_STATES.ACTIVE);
  const isUpdating = is(PLAN_STATES.UPDATING);
  const isSyncing = is(PLAN_STATES.SYNCING);
  const isError = is(PLAN_STATES.ERROR);
  const isDeleting = is(PLAN_STATES.DELETING);
  const isBusy = isCreating || isUpdating || isSyncing || isDeleting;

  return {
    // Current state
    state,
    context,

    // State checks
    is,
    isIdle,
    isCreating,
    isActive,
    isUpdating,
    isSyncing,
    isError,
    isDeleting,
    isBusy,

    // Transition methods
    send,
    canTransition,
    getAvailableTransitions,

    // Utilities
    reset,
    getHistory,

    // Constants for convenience
    STATES: PLAN_STATES,
    EVENTS: PLAN_EVENTS
  };
}

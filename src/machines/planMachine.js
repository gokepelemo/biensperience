/**
 * Plan Lifecycle State Machine
 *
 * Manages plan state transitions to prevent impossible states and race conditions.
 * Implements a finite state machine pattern without external dependencies.
 */

import logger from '../utilities/logger';

// Plan States
export const PLAN_STATES = {
  IDLE: 'idle',           // No plan exists
  CREATING: 'creating',   // Optimistic creation in progress
  ACTIVE: 'active',       // Plan exists and stable
  UPDATING: 'updating',   // Date or items being modified
  SYNCING: 'syncing',     // Reconciling with server (after events)
  ERROR: 'error',         // Operation failed
  DELETING: 'deleting'    // Plan being removed
};

// Plan Events
export const PLAN_EVENTS = {
  CREATE_PLAN: 'CREATE_PLAN',
  PLAN_CREATED: 'PLAN_CREATED',
  UPDATE_PLAN: 'UPDATE_PLAN',
  PLAN_UPDATED: 'PLAN_UPDATED',
  SYNC_PLAN: 'SYNC_PLAN',
  SYNC_COMPLETE: 'SYNC_COMPLETE',
  DELETE_PLAN: 'DELETE_PLAN',
  PLAN_DELETED: 'PLAN_DELETED',
  ERROR: 'ERROR',
  RETRY: 'RETRY',
  RESET: 'RESET'
};

/**
 * State transition map
 * Defines valid transitions from each state
 */
const STATE_TRANSITIONS = {
  [PLAN_STATES.IDLE]: {
    [PLAN_EVENTS.CREATE_PLAN]: PLAN_STATES.CREATING,
    [PLAN_EVENTS.PLAN_CREATED]: PLAN_STATES.ACTIVE // From event reconciliation
  },
  [PLAN_STATES.CREATING]: {
    [PLAN_EVENTS.PLAN_CREATED]: PLAN_STATES.ACTIVE,
    [PLAN_EVENTS.ERROR]: PLAN_STATES.ERROR
  },
  [PLAN_STATES.ACTIVE]: {
    [PLAN_EVENTS.UPDATE_PLAN]: PLAN_STATES.UPDATING,
    [PLAN_EVENTS.DELETE_PLAN]: PLAN_STATES.DELETING,
    [PLAN_EVENTS.SYNC_PLAN]: PLAN_STATES.SYNCING,
    [PLAN_EVENTS.ERROR]: PLAN_STATES.ERROR
  },
  [PLAN_STATES.UPDATING]: {
    [PLAN_EVENTS.PLAN_UPDATED]: PLAN_STATES.ACTIVE,
    [PLAN_EVENTS.ERROR]: PLAN_STATES.ERROR
  },
  [PLAN_STATES.SYNCING]: {
    [PLAN_EVENTS.SYNC_COMPLETE]: PLAN_STATES.ACTIVE,
    [PLAN_EVENTS.ERROR]: PLAN_STATES.ERROR
  },
  [PLAN_STATES.ERROR]: {
    [PLAN_EVENTS.RETRY]: PLAN_STATES.IDLE, // Retry from clean state
    [PLAN_EVENTS.RESET]: PLAN_STATES.IDLE
  },
  [PLAN_STATES.DELETING]: {
    [PLAN_EVENTS.PLAN_DELETED]: PLAN_STATES.IDLE,
    [PLAN_EVENTS.ERROR]: PLAN_STATES.ERROR
  }
};

/**
 * State machine context
 * Additional data that travels with the state
 */
export class PlanMachineContext {
  constructor() {
    this.plan = null;
    this.error = null;
    this.previousState = null;
    this.retryCount = 0;
    this.metadata = {};
  }
}

/**
 * Plan State Machine
 * Lightweight state machine implementation without external dependencies
 */
export class PlanMachine {
  constructor(initialState = PLAN_STATES.IDLE, initialContext = new PlanMachineContext()) {
    this.state = initialState;
    this.context = initialContext;
    this.listeners = new Set();
    this.history = [];
  }

  /**
   * Get current state
   */
  getState() {
    return this.state;
  }

  /**
   * Get current context
   */
  getContext() {
    return this.context;
  }

  /**
   * Check if in a specific state
   */
  is(state) {
    return this.state === state;
  }

  /**
   * Check if transition is allowed
   */
  canTransition(event) {
    return !!(STATE_TRANSITIONS[this.state]?.[event]);
  }

  /**
   * Transition to new state
   * @param {string} event - Event triggering the transition
   * @param {Object} payload - Additional data for the transition
   * @returns {boolean} - Whether transition was successful
   */
  send(event, payload = {}) {
    const nextState = STATE_TRANSITIONS[this.state]?.[event];

    if (!nextState) {
      logger.warn('[PlanMachine] Invalid transition', { currentState: this.state, event });
      return false;
    }

    // Store previous state for error recovery
    const previousState = this.state;

    // Update state
    this.state = nextState;

    // Update context based on event
    this.updateContext(event, payload, previousState);

    // Add to history
    this.history.push({
      from: previousState,
      to: nextState,
      event,
      timestamp: Date.now(),
      payload
    });

    // Keep history limited to last 50 transitions
    if (this.history.length > 50) {
      this.history.shift();
    }

    // Notify listeners
    this.notifyListeners({
      state: this.state,
      context: this.context,
      event,
      previousState
    });

    return true;
  }

  /**
   * Update context based on event and payload
   */
  updateContext(event, payload, previousState) {
    switch (event) {
      case PLAN_EVENTS.CREATE_PLAN:
        this.context.previousState = previousState;
        this.context.metadata = { ...payload };
        break;

      case PLAN_EVENTS.PLAN_CREATED:
        this.context.plan = payload.plan;
        this.context.error = null;
        this.context.retryCount = 0;
        break;

      case PLAN_EVENTS.UPDATE_PLAN:
        this.context.previousState = previousState;
        this.context.metadata = { ...payload };
        break;

      case PLAN_EVENTS.PLAN_UPDATED:
        this.context.plan = payload.plan;
        this.context.error = null;
        break;

      case PLAN_EVENTS.SYNC_PLAN:
        this.context.metadata = { syncReason: payload.reason };
        break;

      case PLAN_EVENTS.SYNC_COMPLETE:
        this.context.plan = payload.plan;
        this.context.metadata = {};
        break;

      case PLAN_EVENTS.ERROR:
        this.context.error = payload.error;
        this.context.previousState = previousState;
        this.context.retryCount += 1;
        break;

      case PLAN_EVENTS.RETRY:
        this.context.error = null;
        break;

      case PLAN_EVENTS.PLAN_DELETED:
        this.context.plan = null;
        this.context.error = null;
        this.context.metadata = {};
        break;

      case PLAN_EVENTS.RESET:
        this.context = new PlanMachineContext();
        break;

      default:
        break;
    }
  }

  /**
   * Subscribe to state changes
   * @param {Function} listener - Callback function
   * @returns {Function} - Unsubscribe function
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of state change
   */
  notifyListeners(stateChange) {
    this.listeners.forEach(listener => {
      try {
        listener(stateChange);
      } catch (err) {
        logger.error('[PlanMachine] Listener error', { error: err.message }, err);
      }
    });
  }

  /**
   * Get transition history
   */
  getHistory() {
    return this.history;
  }

  /**
   * Reset machine to initial state
   */
  reset() {
    this.send(PLAN_EVENTS.RESET);
  }

  /**
   * Get available transitions from current state
   */
  getAvailableTransitions() {
    return Object.keys(STATE_TRANSITIONS[this.state] || {});
  }
}

/**
 * Create a new plan state machine
 */
export function createPlanMachine(initialState, initialContext) {
  return new PlanMachine(initialState, initialContext);
}

export default {
  PLAN_STATES,
  PLAN_EVENTS,
  PlanMachine,
  PlanMachineContext,
  createPlanMachine
};

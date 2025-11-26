/**
 * Tests for planMachine state machine
 * Tests state transitions, context management, and subscription system
 */

import {
  PLAN_STATES,
  PLAN_EVENTS,
  PlanMachine,
  PlanMachineContext,
  createPlanMachine
} from '../../src/machines/planMachine';

// Mock logger
jest.mock('../../src/utilities/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

describe('planMachine', () => {
  describe('PlanMachineContext', () => {
    it('should initialize with default values', () => {
      const context = new PlanMachineContext();

      expect(context.plan).toBeNull();
      expect(context.error).toBeNull();
      expect(context.previousState).toBeNull();
      expect(context.retryCount).toBe(0);
      expect(context.metadata).toEqual({});
    });
  });

  describe('PlanMachine - Initial State', () => {
    it('should initialize with IDLE state by default', () => {
      const machine = new PlanMachine();

      expect(machine.getState()).toBe(PLAN_STATES.IDLE);
    });

    it('should initialize with custom initial state', () => {
      const machine = new PlanMachine(PLAN_STATES.ACTIVE);

      expect(machine.getState()).toBe(PLAN_STATES.ACTIVE);
    });

    it('should initialize with custom context', () => {
      const customContext = new PlanMachineContext();
      customContext.plan = { _id: 'plan-123' };

      const machine = new PlanMachine(PLAN_STATES.ACTIVE, customContext);

      expect(machine.getContext().plan).toEqual({ _id: 'plan-123' });
    });

    it('should have empty history on initialization', () => {
      const machine = new PlanMachine();

      expect(machine.getHistory()).toEqual([]);
    });

    it('should have no listeners on initialization', () => {
      const machine = new PlanMachine();

      expect(machine.listeners.size).toBe(0);
    });
  });

  describe('State Checking', () => {
    it('should return true for is() when in matching state', () => {
      const machine = new PlanMachine(PLAN_STATES.IDLE);

      expect(machine.is(PLAN_STATES.IDLE)).toBe(true);
      expect(machine.is(PLAN_STATES.ACTIVE)).toBe(false);
    });
  });

  describe('Transition Validation', () => {
    it('should return true for valid transitions', () => {
      const machine = new PlanMachine(PLAN_STATES.IDLE);

      expect(machine.canTransition(PLAN_EVENTS.CREATE_PLAN)).toBe(true);
    });

    it('should return false for invalid transitions', () => {
      const machine = new PlanMachine(PLAN_STATES.IDLE);

      expect(machine.canTransition(PLAN_EVENTS.PLAN_DELETED)).toBe(false);
    });

    it('should return available transitions from current state', () => {
      const machine = new PlanMachine(PLAN_STATES.ACTIVE);
      const available = machine.getAvailableTransitions();

      expect(available).toContain(PLAN_EVENTS.UPDATE_PLAN);
      expect(available).toContain(PLAN_EVENTS.DELETE_PLAN);
      expect(available).toContain(PLAN_EVENTS.SYNC_PLAN);
      expect(available).toContain(PLAN_EVENTS.ERROR);
    });
  });

  describe('State Transitions - IDLE', () => {
    it('should transition IDLE -> CREATING on CREATE_PLAN', () => {
      const machine = new PlanMachine(PLAN_STATES.IDLE);

      const result = machine.send(PLAN_EVENTS.CREATE_PLAN);

      expect(result).toBe(true);
      expect(machine.getState()).toBe(PLAN_STATES.CREATING);
    });

    it('should transition IDLE -> ACTIVE on PLAN_CREATED (event reconciliation)', () => {
      const machine = new PlanMachine(PLAN_STATES.IDLE);
      const plan = { _id: 'plan-123' };

      machine.send(PLAN_EVENTS.PLAN_CREATED, { plan });

      expect(machine.getState()).toBe(PLAN_STATES.ACTIVE);
      expect(machine.getContext().plan).toEqual(plan);
    });

    it('should reject invalid transitions from IDLE', () => {
      const machine = new PlanMachine(PLAN_STATES.IDLE);

      const result = machine.send(PLAN_EVENTS.UPDATE_PLAN);

      expect(result).toBe(false);
      expect(machine.getState()).toBe(PLAN_STATES.IDLE);
    });
  });

  describe('State Transitions - CREATING', () => {
    it('should transition CREATING -> ACTIVE on PLAN_CREATED', () => {
      const machine = new PlanMachine(PLAN_STATES.CREATING);
      const plan = { _id: 'plan-123', planned_date: '2025-12-01' };

      machine.send(PLAN_EVENTS.PLAN_CREATED, { plan });

      expect(machine.getState()).toBe(PLAN_STATES.ACTIVE);
      expect(machine.getContext().plan).toEqual(plan);
    });

    it('should transition CREATING -> ERROR on ERROR', () => {
      const machine = new PlanMachine(PLAN_STATES.CREATING);

      machine.send(PLAN_EVENTS.ERROR, { error: 'Creation failed' });

      expect(machine.getState()).toBe(PLAN_STATES.ERROR);
      expect(machine.getContext().error).toBe('Creation failed');
    });
  });

  describe('State Transitions - ACTIVE', () => {
    it('should transition ACTIVE -> UPDATING on UPDATE_PLAN', () => {
      const machine = new PlanMachine(PLAN_STATES.ACTIVE);

      machine.send(PLAN_EVENTS.UPDATE_PLAN, { changes: { planned_date: '2025-12-25' } });

      expect(machine.getState()).toBe(PLAN_STATES.UPDATING);
    });

    it('should transition ACTIVE -> DELETING on DELETE_PLAN', () => {
      const machine = new PlanMachine(PLAN_STATES.ACTIVE);

      machine.send(PLAN_EVENTS.DELETE_PLAN);

      expect(machine.getState()).toBe(PLAN_STATES.DELETING);
    });

    it('should transition ACTIVE -> SYNCING on SYNC_PLAN', () => {
      const machine = new PlanMachine(PLAN_STATES.ACTIVE);

      machine.send(PLAN_EVENTS.SYNC_PLAN, { reason: 'event-reconciliation' });

      expect(machine.getState()).toBe(PLAN_STATES.SYNCING);
      expect(machine.getContext().metadata.syncReason).toBe('event-reconciliation');
    });

    it('should transition ACTIVE -> ERROR on ERROR', () => {
      const machine = new PlanMachine(PLAN_STATES.ACTIVE);

      machine.send(PLAN_EVENTS.ERROR, { error: 'Unexpected error' });

      expect(machine.getState()).toBe(PLAN_STATES.ERROR);
    });
  });

  describe('State Transitions - UPDATING', () => {
    it('should transition UPDATING -> ACTIVE on PLAN_UPDATED', () => {
      const machine = new PlanMachine(PLAN_STATES.UPDATING);
      const updatedPlan = { _id: 'plan-123', planned_date: '2025-12-31' };

      machine.send(PLAN_EVENTS.PLAN_UPDATED, { plan: updatedPlan });

      expect(machine.getState()).toBe(PLAN_STATES.ACTIVE);
      expect(machine.getContext().plan).toEqual(updatedPlan);
    });

    it('should transition UPDATING -> ERROR on ERROR', () => {
      const machine = new PlanMachine(PLAN_STATES.UPDATING);

      machine.send(PLAN_EVENTS.ERROR, { error: 'Update failed' });

      expect(machine.getState()).toBe(PLAN_STATES.ERROR);
    });
  });

  describe('State Transitions - SYNCING', () => {
    it('should transition SYNCING -> ACTIVE on SYNC_COMPLETE', () => {
      const machine = new PlanMachine(PLAN_STATES.SYNCING);
      const syncedPlan = { _id: 'plan-123', version: 2 };

      machine.send(PLAN_EVENTS.SYNC_COMPLETE, { plan: syncedPlan });

      expect(machine.getState()).toBe(PLAN_STATES.ACTIVE);
      expect(machine.getContext().plan).toEqual(syncedPlan);
      expect(machine.getContext().metadata).toEqual({});
    });

    it('should transition SYNCING -> ERROR on ERROR', () => {
      const machine = new PlanMachine(PLAN_STATES.SYNCING);

      machine.send(PLAN_EVENTS.ERROR, { error: 'Sync failed' });

      expect(machine.getState()).toBe(PLAN_STATES.ERROR);
    });
  });

  describe('State Transitions - DELETING', () => {
    it('should transition DELETING -> IDLE on PLAN_DELETED', () => {
      const machine = new PlanMachine(PLAN_STATES.DELETING);
      machine.context.plan = { _id: 'plan-123' };

      machine.send(PLAN_EVENTS.PLAN_DELETED);

      expect(machine.getState()).toBe(PLAN_STATES.IDLE);
      expect(machine.getContext().plan).toBeNull();
    });

    it('should transition DELETING -> ERROR on ERROR', () => {
      const machine = new PlanMachine(PLAN_STATES.DELETING);

      machine.send(PLAN_EVENTS.ERROR, { error: 'Delete failed' });

      expect(machine.getState()).toBe(PLAN_STATES.ERROR);
    });
  });

  describe('State Transitions - ERROR', () => {
    it('should transition ERROR -> IDLE on RETRY', () => {
      const machine = new PlanMachine(PLAN_STATES.ERROR);

      machine.send(PLAN_EVENTS.RETRY);

      expect(machine.getState()).toBe(PLAN_STATES.IDLE);
      expect(machine.getContext().error).toBeNull();
    });

    it('should transition ERROR -> IDLE on RESET', () => {
      const machine = new PlanMachine(PLAN_STATES.ERROR);
      machine.context.error = 'Some error';
      machine.context.retryCount = 3;

      machine.send(PLAN_EVENTS.RESET);

      expect(machine.getState()).toBe(PLAN_STATES.IDLE);
      expect(machine.getContext()).toBeInstanceOf(PlanMachineContext);
      expect(machine.getContext().error).toBeNull();
      expect(machine.getContext().retryCount).toBe(0);
    });
  });

  describe('Context Management', () => {
    it('should store previous state on CREATE_PLAN', () => {
      const machine = new PlanMachine(PLAN_STATES.IDLE);

      machine.send(PLAN_EVENTS.CREATE_PLAN, { experienceId: 'exp-123' });

      expect(machine.getContext().previousState).toBe(PLAN_STATES.IDLE);
      expect(machine.getContext().metadata.experienceId).toBe('exp-123');
    });

    it('should clear error and retry count on successful creation', () => {
      const machine = new PlanMachine(PLAN_STATES.CREATING);
      machine.context.error = 'Previous error';
      machine.context.retryCount = 2;

      machine.send(PLAN_EVENTS.PLAN_CREATED, { plan: { _id: 'plan-123' } });

      expect(machine.getContext().error).toBeNull();
      expect(machine.getContext().retryCount).toBe(0);
    });

    it('should increment retry count on error', () => {
      const machine = new PlanMachine(PLAN_STATES.CREATING);
      machine.context.retryCount = 0;

      machine.send(PLAN_EVENTS.ERROR, { error: 'First error' });
      expect(machine.getContext().retryCount).toBe(1);

      // Reset and try again
      machine.send(PLAN_EVENTS.RETRY);
      machine.send(PLAN_EVENTS.CREATE_PLAN);
      machine.send(PLAN_EVENTS.ERROR, { error: 'Second error' });

      expect(machine.getContext().retryCount).toBe(2);
    });

    it('should store previous state on error', () => {
      const machine = new PlanMachine(PLAN_STATES.UPDATING);

      machine.send(PLAN_EVENTS.ERROR, { error: 'Update failed' });

      expect(machine.getContext().previousState).toBe(PLAN_STATES.UPDATING);
    });

    it('should reset context on RESET event', () => {
      const machine = new PlanMachine(PLAN_STATES.ERROR);
      machine.context.plan = { _id: 'plan-123' };
      machine.context.error = 'Some error';
      machine.context.retryCount = 5;

      machine.send(PLAN_EVENTS.RESET);

      const newContext = machine.getContext();
      expect(newContext.plan).toBeNull();
      expect(newContext.error).toBeNull();
      expect(newContext.retryCount).toBe(0);
    });
  });

  describe('Subscription System', () => {
    it('should notify listeners on state change', () => {
      const machine = new PlanMachine(PLAN_STATES.IDLE);
      const listener = jest.fn();

      machine.subscribe(listener);
      machine.send(PLAN_EVENTS.CREATE_PLAN);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        state: PLAN_STATES.CREATING,
        previousState: PLAN_STATES.IDLE,
        event: PLAN_EVENTS.CREATE_PLAN
      }));
    });

    it('should unsubscribe when returned function is called', () => {
      const machine = new PlanMachine(PLAN_STATES.IDLE);
      const listener = jest.fn();

      const unsubscribe = machine.subscribe(listener);
      unsubscribe();

      machine.send(PLAN_EVENTS.CREATE_PLAN);

      expect(listener).not.toHaveBeenCalled();
    });

    it('should support multiple listeners', () => {
      const machine = new PlanMachine(PLAN_STATES.IDLE);
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      machine.subscribe(listener1);
      machine.subscribe(listener2);

      machine.send(PLAN_EVENTS.CREATE_PLAN);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should handle listener errors gracefully', () => {
      const machine = new PlanMachine(PLAN_STATES.IDLE);
      const errorListener = jest.fn(() => { throw new Error('Listener error'); });
      const normalListener = jest.fn();

      machine.subscribe(errorListener);
      machine.subscribe(normalListener);

      // Should not throw
      expect(() => machine.send(PLAN_EVENTS.CREATE_PLAN)).not.toThrow();

      // Normal listener should still be called
      expect(normalListener).toHaveBeenCalled();
    });
  });

  describe('History Tracking', () => {
    it('should track transition history', () => {
      const machine = new PlanMachine(PLAN_STATES.IDLE);

      machine.send(PLAN_EVENTS.CREATE_PLAN);
      machine.send(PLAN_EVENTS.PLAN_CREATED, { plan: { _id: 'plan-123' } });

      const history = machine.getHistory();
      expect(history).toHaveLength(2);

      expect(history[0]).toEqual(expect.objectContaining({
        from: PLAN_STATES.IDLE,
        to: PLAN_STATES.CREATING,
        event: PLAN_EVENTS.CREATE_PLAN
      }));

      expect(history[1]).toEqual(expect.objectContaining({
        from: PLAN_STATES.CREATING,
        to: PLAN_STATES.ACTIVE,
        event: PLAN_EVENTS.PLAN_CREATED
      }));
    });

    it('should include timestamp in history entries', () => {
      const machine = new PlanMachine(PLAN_STATES.IDLE);
      const beforeTime = Date.now();

      machine.send(PLAN_EVENTS.CREATE_PLAN);

      const history = machine.getHistory();
      expect(history[0].timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(history[0].timestamp).toBeLessThanOrEqual(Date.now());
    });

    it('should include payload in history entries', () => {
      const machine = new PlanMachine(PLAN_STATES.CREATING);
      const plan = { _id: 'plan-123', planned_date: '2025-12-01' };

      machine.send(PLAN_EVENTS.PLAN_CREATED, { plan });

      const history = machine.getHistory();
      expect(history[0].payload).toEqual({ plan });
    });

    it('should limit history to 50 entries', () => {
      const machine = new PlanMachine(PLAN_STATES.IDLE);

      // Generate more than 50 transitions
      for (let i = 0; i < 60; i++) {
        // Cycle through: IDLE -> CREATING -> ACTIVE -> DELETING -> IDLE
        machine.send(PLAN_EVENTS.CREATE_PLAN);
        machine.send(PLAN_EVENTS.PLAN_CREATED, { plan: { _id: `plan-${i}` } });
        machine.send(PLAN_EVENTS.DELETE_PLAN);
        machine.send(PLAN_EVENTS.PLAN_DELETED);
      }

      const history = machine.getHistory();
      expect(history.length).toBe(50);
    });
  });

  describe('Reset Method', () => {
    it('should reset to IDLE state from ERROR', () => {
      const machine = new PlanMachine(PLAN_STATES.ERROR);
      machine.context.error = 'Some error';

      machine.reset();

      expect(machine.getState()).toBe(PLAN_STATES.IDLE);
    });

    it('should reset context to defaults from ERROR state', () => {
      const machine = new PlanMachine(PLAN_STATES.ERROR);
      machine.context.plan = { _id: 'plan-123' };
      machine.context.error = 'Some error';
      machine.context.retryCount = 3;

      machine.reset();

      expect(machine.getContext().plan).toBeNull();
      expect(machine.getContext().error).toBeNull();
      expect(machine.getContext().retryCount).toBe(0);
    });

    it('should not reset from non-ERROR states', () => {
      const machine = new PlanMachine(PLAN_STATES.ACTIVE);
      machine.context.plan = { _id: 'plan-123' };

      const result = machine.reset();

      // reset() calls send(RESET) which should fail from ACTIVE state
      // (RESET only valid from ERROR state)
      expect(machine.getState()).toBe(PLAN_STATES.ACTIVE);
      expect(machine.getContext().plan).toEqual({ _id: 'plan-123' });
    });
  });

  describe('createPlanMachine Factory', () => {
    it('should create a new PlanMachine instance', () => {
      const machine = createPlanMachine();

      expect(machine).toBeInstanceOf(PlanMachine);
      expect(machine.getState()).toBe(PLAN_STATES.IDLE);
    });

    it('should accept initial state parameter', () => {
      const machine = createPlanMachine(PLAN_STATES.ACTIVE);

      expect(machine.getState()).toBe(PLAN_STATES.ACTIVE);
    });

    it('should accept initial context parameter', () => {
      const context = new PlanMachineContext();
      context.plan = { _id: 'existing-plan' };

      const machine = createPlanMachine(PLAN_STATES.ACTIVE, context);

      expect(machine.getContext().plan).toEqual({ _id: 'existing-plan' });
    });
  });

  describe('Complete Lifecycle Flows', () => {
    it('should handle successful plan creation flow', () => {
      const machine = createPlanMachine();

      // Start creation
      expect(machine.send(PLAN_EVENTS.CREATE_PLAN, { experienceId: 'exp-123' })).toBe(true);
      expect(machine.is(PLAN_STATES.CREATING)).toBe(true);

      // Complete creation
      expect(machine.send(PLAN_EVENTS.PLAN_CREATED, { plan: { _id: 'plan-123' } })).toBe(true);
      expect(machine.is(PLAN_STATES.ACTIVE)).toBe(true);
      expect(machine.getContext().plan._id).toBe('plan-123');
    });

    it('should handle plan update flow', () => {
      const machine = createPlanMachine(PLAN_STATES.ACTIVE);
      machine.context.plan = { _id: 'plan-123' };

      // Start update
      expect(machine.send(PLAN_EVENTS.UPDATE_PLAN, { changes: { planned_date: '2025-12-25' } })).toBe(true);
      expect(machine.is(PLAN_STATES.UPDATING)).toBe(true);

      // Complete update
      const updatedPlan = { _id: 'plan-123', planned_date: '2025-12-25' };
      expect(machine.send(PLAN_EVENTS.PLAN_UPDATED, { plan: updatedPlan })).toBe(true);
      expect(machine.is(PLAN_STATES.ACTIVE)).toBe(true);
      expect(machine.getContext().plan.planned_date).toBe('2025-12-25');
    });

    it('should handle plan deletion flow', () => {
      const machine = createPlanMachine(PLAN_STATES.ACTIVE);
      machine.context.plan = { _id: 'plan-123' };

      // Start deletion
      expect(machine.send(PLAN_EVENTS.DELETE_PLAN)).toBe(true);
      expect(machine.is(PLAN_STATES.DELETING)).toBe(true);

      // Complete deletion
      expect(machine.send(PLAN_EVENTS.PLAN_DELETED)).toBe(true);
      expect(machine.is(PLAN_STATES.IDLE)).toBe(true);
      expect(machine.getContext().plan).toBeNull();
    });

    it('should handle error and retry flow', () => {
      const machine = createPlanMachine();

      // Start creation
      machine.send(PLAN_EVENTS.CREATE_PLAN);

      // Error occurs
      machine.send(PLAN_EVENTS.ERROR, { error: 'Network error' });
      expect(machine.is(PLAN_STATES.ERROR)).toBe(true);
      expect(machine.getContext().error).toBe('Network error');
      expect(machine.getContext().retryCount).toBe(1);

      // Retry
      machine.send(PLAN_EVENTS.RETRY);
      expect(machine.is(PLAN_STATES.IDLE)).toBe(true);

      // Try again
      machine.send(PLAN_EVENTS.CREATE_PLAN);
      machine.send(PLAN_EVENTS.PLAN_CREATED, { plan: { _id: 'plan-123' } });

      expect(machine.is(PLAN_STATES.ACTIVE)).toBe(true);
    });

    it('should handle sync flow', () => {
      const machine = createPlanMachine(PLAN_STATES.ACTIVE);
      machine.context.plan = { _id: 'plan-123', version: 1 };

      // Start sync
      machine.send(PLAN_EVENTS.SYNC_PLAN, { reason: 'event-reconciliation' });
      expect(machine.is(PLAN_STATES.SYNCING)).toBe(true);

      // Complete sync with updated plan
      machine.send(PLAN_EVENTS.SYNC_COMPLETE, { plan: { _id: 'plan-123', version: 2 } });
      expect(machine.is(PLAN_STATES.ACTIVE)).toBe(true);
      expect(machine.getContext().plan.version).toBe(2);
    });
  });
});

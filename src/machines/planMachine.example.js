/**
 * Plan State Machine Usage Examples
 *
 * This file demonstrates how to use the plan state machine
 * in different scenarios within the application.
 */

import { createPlanMachine, PLAN_STATES, PLAN_EVENTS } from './planMachine';

/**
 * Example 1: Basic plan creation flow
 */
export function examplePlanCreation() {
  const machine = createPlanMachine();

  console.log('Initial state:', machine.getState()); // 'idle'

  // User clicks "Plan It" button
  machine.send(PLAN_EVENTS.CREATE_PLAN, {
    plannedDate: '2025-12-01',
    experienceId: 'exp123'
  });
  console.log('After CREATE_PLAN:', machine.getState()); // 'creating'

  // API responds with created plan
  machine.send(PLAN_EVENTS.PLAN_CREATED, {
    plan: {
      _id: 'plan123',
      planned_date: '2025-12-01',
      plan: []
    }
  });
  console.log('After PLAN_CREATED:', machine.getState()); // 'active'
  console.log('Plan in context:', machine.getContext().plan);
}

/**
 * Example 2: Plan update flow with error handling
 */
export function examplePlanUpdateWithError() {
  const machine = createPlanMachine(PLAN_STATES.ACTIVE);
  machine.context.plan = { _id: 'plan123', planned_date: '2025-12-01' };

  // User updates planned date
  machine.send(PLAN_EVENTS.UPDATE_PLAN, {
    updates: { planned_date: '2025-12-15' }
  });
  console.log('After UPDATE_PLAN:', machine.getState()); // 'updating'

  // API fails
  machine.send(PLAN_EVENTS.ERROR, {
    error: new Error('Network timeout')
  });
  console.log('After ERROR:', machine.getState()); // 'error'
  console.log('Error in context:', machine.getContext().error);

  // User retries
  machine.send(PLAN_EVENTS.RETRY);
  console.log('After RETRY:', machine.getState()); // 'idle'
}

/**
 * Example 3: Event reconciliation flow
 */
export function exampleEventReconciliation() {
  const machine = createPlanMachine(PLAN_STATES.ACTIVE);

  // Collaborator makes changes in another tab
  machine.send(PLAN_EVENTS.SYNC_PLAN, {
    reason: 'External change detected'
  });
  console.log('After SYNC_PLAN:', machine.getState()); // 'syncing'

  // Sync completes
  machine.send(PLAN_EVENTS.SYNC_COMPLETE, {
    plan: {
      _id: 'plan123',
      planned_date: '2025-12-01',
      plan: [{ text: 'New item from collaborator' }]
    }
  });
  console.log('After SYNC_COMPLETE:', machine.getState()); // 'active'
}

/**
 * Example 4: Plan deletion flow
 */
export function examplePlanDeletion() {
  const machine = createPlanMachine(PLAN_STATES.ACTIVE);

  // User deletes plan
  machine.send(PLAN_EVENTS.DELETE_PLAN);
  console.log('After DELETE_PLAN:', machine.getState()); // 'deleting'

  // API confirms deletion
  machine.send(PLAN_EVENTS.PLAN_DELETED);
  console.log('After PLAN_DELETED:', machine.getState()); // 'idle'
  console.log('Plan in context:', machine.getContext().plan); // null
}

/**
 * Example 5: Invalid transitions (prevented)
 */
export function exampleInvalidTransitions() {
  const machine = createPlanMachine(PLAN_STATES.IDLE);

  // Try to delete when no plan exists
  const result = machine.send(PLAN_EVENTS.DELETE_PLAN);
  console.log('Can delete from idle?', result); // false
  console.log('State unchanged:', machine.getState()); // 'idle'

  // Check available transitions
  const available = machine.getAvailableTransitions();
  console.log('Available transitions from idle:', available); // ['CREATE_PLAN', 'PLAN_CREATED']
}

/**
 * Example 6: Using with React component
 */
export function exampleReactIntegration() {
  // In a React component:
  /*
  import usePlanMachine from '../hooks/usePlanMachine';

  function MyPlanComponent({ planId }) {
    const {
      state,
      isIdle,
      isCreating,
      isActive,
      isBusy,
      send,
      EVENTS
    } = usePlanMachine(planId, {
      debug: true,
      onStateChange: (change) => {
        console.log('Plan state changed:', change);
      }
    });

    const handleCreatePlan = async () => {
      // Send CREATE_PLAN event
      send(EVENTS.CREATE_PLAN, { plannedDate: '2025-12-01' });

      try {
        const result = await createPlanAPI(experienceId, '2025-12-01');
        // Send PLAN_CREATED event
        send(EVENTS.PLAN_CREATED, { plan: result });
      } catch (error) {
        // Send ERROR event
        send(EVENTS.ERROR, { error });
      }
    };

    return (
      <div>
        <p>State: {state}</p>
        {isIdle && <button onClick={handleCreatePlan}>Plan It</button>}
        {isCreating && <p>Creating plan...</p>}
        {isActive && <p>Plan is active</p>}
        {isBusy && <div className="spinner" />}
      </div>
    );
  }
  */
}

/**
 * Example 7: State machine with event listeners
 */
export function exampleWithListeners() {
  const machine = createPlanMachine();

  // Subscribe to all state changes
  const unsubscribe = machine.subscribe((stateChange) => {
    console.log('State changed from', stateChange.previousState, 'to', stateChange.state);
    console.log('Triggered by event:', stateChange.event);
  });

  // Perform some transitions
  machine.send(PLAN_EVENTS.CREATE_PLAN);
  machine.send(PLAN_EVENTS.PLAN_CREATED, { plan: { _id: 'plan123' } });
  machine.send(PLAN_EVENTS.UPDATE_PLAN);
  machine.send(PLAN_EVENTS.PLAN_UPDATED, { plan: { _id: 'plan123', updated: true } });

  // View history
  const history = machine.getHistory();
  console.log('Transition history:', history);

  // Cleanup
  unsubscribe();
}

export default {
  examplePlanCreation,
  examplePlanUpdateWithError,
  exampleEventReconciliation,
  examplePlanDeletion,
  exampleInvalidTransitions,
  exampleReactIntegration,
  exampleWithListeners
};

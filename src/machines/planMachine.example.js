/**
 * Plan State Machine Usage Examples
 *
 * This file demonstrates how to use the plan state machine
 * in different scenarios within the application.
 */

import { createPlanMachine, PLAN_STATES, PLAN_EVENTS } from './planMachine';
import logger from '../utilities/logger';

/**
 * Example 1: Basic plan creation flow
 */
export function examplePlanCreation() {
  const machine = createPlanMachine();

  logger.debug('Initial state:', { state: machine.getState() }); // 'idle'

  // User clicks "Plan It" button
  machine.send(PLAN_EVENTS.CREATE_PLAN, {
    plannedDate: '2025-12-01',
    experienceId: 'exp123'
  });
  logger.debug('After CREATE_PLAN:', { state: machine.getState() }); // 'creating'

  // API responds with created plan
  machine.send(PLAN_EVENTS.PLAN_CREATED, {
    plan: {
      _id: 'plan123',
      planned_date: '2025-12-01',
      plan: []
    }
  });
  logger.debug('After PLAN_CREATED:', { state: machine.getState() }); // 'active'
  logger.debug('Plan in context:', { plan: machine.getContext().plan });
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
  logger.debug('After UPDATE_PLAN:', { state: machine.getState() }); // 'updating'

  // API fails
  machine.send(PLAN_EVENTS.ERROR, {
    error: new Error('Network timeout')
  });
  logger.debug('After ERROR:', { state: machine.getState() }); // 'error'
  logger.debug('Error in context:', { error: machine.getContext().error });

  // User retries
  machine.send(PLAN_EVENTS.RETRY);
  logger.debug('After RETRY:', { state: machine.getState() }); // 'idle'
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
  logger.debug('After SYNC_PLAN:', { state: machine.getState() }); // 'syncing'

  // Sync completes
  machine.send(PLAN_EVENTS.SYNC_COMPLETE, {
    plan: {
      _id: 'plan123',
      planned_date: '2025-12-01',
      plan: [{ text: 'New item from collaborator' }]
    }
  });
  logger.debug('After SYNC_COMPLETE:', { state: machine.getState() }); // 'active'
}

/**
 * Example 4: Plan deletion flow
 */
export function examplePlanDeletion() {
  const machine = createPlanMachine(PLAN_STATES.ACTIVE);

  // User deletes plan
  machine.send(PLAN_EVENTS.DELETE_PLAN);
  logger.debug('After DELETE_PLAN:', { state: machine.getState() }); // 'deleting'

  // API confirms deletion
  machine.send(PLAN_EVENTS.PLAN_DELETED);
  logger.debug('After PLAN_DELETED:', { state: machine.getState() }); // 'idle'
  logger.debug('Plan in context:', { plan: machine.getContext().plan }); // null
}

/**
 * Example 5: Invalid transitions (prevented)
 */
export function exampleInvalidTransitions() {
  const machine = createPlanMachine(PLAN_STATES.IDLE);

  // Try to delete when no plan exists
  const result = machine.send(PLAN_EVENTS.DELETE_PLAN);
  logger.debug('Can delete from idle?', { result }); // false
  logger.debug('State unchanged:', { state: machine.getState() }); // 'idle'

  // Check available transitions
  const available = machine.getAvailableTransitions();
  logger.debug('Available transitions from idle:', { available }); // ['CREATE_PLAN', 'PLAN_CREATED']
}

/**
 * Example 6: Using with React component
 */
export function exampleReactIntegration() {
  // In a React component:
  /*
  import usePlanMachine from '../hooks/usePlanMachine';
  import logger from '../utilities/logger';

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
        logger.debug('Plan state changed:', { change });
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
    logger.debug('State changed', {
      from: stateChange.previousState,
      to: stateChange.state
    });
    logger.debug('Triggered by event:', { event: stateChange.event });
  });

  // Perform some transitions
  machine.send(PLAN_EVENTS.CREATE_PLAN);
  machine.send(PLAN_EVENTS.PLAN_CREATED, { plan: { _id: 'plan123' } });
  machine.send(PLAN_EVENTS.UPDATE_PLAN);
  machine.send(PLAN_EVENTS.PLAN_UPDATED, { plan: { _id: 'plan123', updated: true } });

  // View history
  const history = machine.getHistory();
  logger.debug('Transition history:', { history });

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

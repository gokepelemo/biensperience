/**
 * Tests for plan-operations applyOperation completion semantics
 */

import { applyOperation, OperationType } from '../../src/utilities/plan-operations';

jest.mock('../../src/utilities/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('plan-operations applyOperation', () => {
  const baseState = {
    _id: 'plan1',
    plan: [
      { plan_item_id: 'item1', text: 'Item 1', complete: false },
      { plan_item_id: 'item2', text: 'Item 2', complete: true }
    ]
  };

  it('COMPLETE_ITEM sets `complete: true` (not legacy `completed`)', () => {
    const operation = {
      id: 'op1',
      type: OperationType.COMPLETE_ITEM,
      payload: { itemId: 'item1' },
      timestamp: 123
    };

    const next = applyOperation(baseState, operation);

    const updated = next.plan.find((it) => it.plan_item_id === 'item1');
    expect(updated.complete).toBe(true);
    expect(updated).not.toHaveProperty('completed');
    expect(updated).not.toHaveProperty('completedAt');
  });

  it('UNCOMPLETE_ITEM sets `complete: false` and strips legacy completion fields if present', () => {
    const stateWithLegacy = {
      ...baseState,
      plan: [
        { plan_item_id: 'item1', text: 'Item 1', complete: true, completed: true, completedAt: 111 }
      ]
    };

    const operation = {
      id: 'op2',
      type: OperationType.UNCOMPLETE_ITEM,
      payload: { itemId: 'item1' },
      timestamp: 456
    };

    const next = applyOperation(stateWithLegacy, operation);

    const updated = next.plan.find((it) => it.plan_item_id === 'item1');
    expect(updated.complete).toBe(false);
    expect(updated).not.toHaveProperty('completed');
    expect(updated).not.toHaveProperty('completedAt');
  });
});

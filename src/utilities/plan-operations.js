/**
 * Plan Operations - Operation-based sync for commutative updates
 *
 * This module provides CRDT-style operations for plan state management.
 * Operations are idempotent and commutative, ensuring consistent state
 * regardless of application order.
 *
 * @module plan-operations
 */

import { logger } from './logger';

/**
 * Operation types for plan mutations
 */
export const OperationType = {
  // Plan-level operations
  CREATE_PLAN: 'CREATE_PLAN',
  UPDATE_PLAN: 'UPDATE_PLAN',
  DELETE_PLAN: 'DELETE_PLAN',

  // Item-level operations
  ADD_ITEM: 'ADD_ITEM',
  UPDATE_ITEM: 'UPDATE_ITEM',
  DELETE_ITEM: 'DELETE_ITEM',
  REORDER_ITEMS: 'REORDER_ITEMS',
  COMPLETE_ITEM: 'COMPLETE_ITEM',
  UNCOMPLETE_ITEM: 'UNCOMPLETE_ITEM',

  // Collaborator operations
  ADD_COLLABORATOR: 'ADD_COLLABORATOR',
  REMOVE_COLLABORATOR: 'REMOVE_COLLABORATOR',
  UPDATE_PERMISSION: 'UPDATE_PERMISSION'
};

/**
 * Create an operation with unique ID and metadata
 *
 * @param {string} type - Operation type from OperationType
 * @param {Object} payload - Operation-specific data
 * @param {string} sessionId - Current session ID
 * @param {Object} vectorClock - Current vector clock state
 * @returns {Object} Operation object
 */
export function createOperation(type, payload, sessionId, vectorClock = {}) {
  return {
    id: `op_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    type,
    payload,
    sessionId,
    vectorClock: { ...vectorClock },
    timestamp: Date.now()
  };
}

/**
 * Apply an operation to plan state (pure function)
 * Operations are designed to be idempotent - applying twice produces same result
 *
 * @param {Object} state - Current plan state
 * @param {Object} operation - Operation to apply
 * @returns {Object} New state after operation
 */
export function applyOperation(state, operation) {
  if (!state || !operation) {
    logger.debug('[applyOperation] Invalid state or operation', { hasState: !!state, hasOperation: !!operation });
    return state;
  }

  const { type, payload, id: operationId, timestamp } = operation;

  switch (type) {
    case OperationType.CREATE_PLAN:
      // Create plan is typically handled separately (creates new state)
      return {
        ...payload.plan,
        _lastOperation: operationId
      };

    case OperationType.UPDATE_PLAN:
      return {
        ...state,
        ...payload.changes,
        _lastOperation: operationId
      };

    case OperationType.DELETE_PLAN:
      // Return null to indicate deletion
      return null;

    case OperationType.ADD_ITEM: {
      const { item } = payload;
      // Check if item already exists (idempotency)
      const exists = state.plan?.some(existing =>
        existing._id === item._id || existing.plan_item_id === item.plan_item_id
      );
      if (exists) {
        logger.debug('[applyOperation] ADD_ITEM skipped - item already exists', { itemId: item._id });
        return state;
      }
      return {
        ...state,
        plan: [...(state.plan || []), item],
        _lastOperation: operationId
      };
    }

    case OperationType.UPDATE_ITEM: {
      const { itemId, changes } = payload;
      return {
        ...state,
        plan: (state.plan || []).map(item => {
          const id = item._id || item.plan_item_id;
          if (id === itemId || item.plan_item_id === itemId) {
            return { ...item, ...changes };
          }
          return item;
        }),
        _lastOperation: operationId
      };
    }

    case OperationType.DELETE_ITEM: {
      const { itemId } = payload;
      return {
        ...state,
        plan: (state.plan || []).filter(item => {
          const id = item._id || item.plan_item_id;
          return id !== itemId && item.plan_item_id !== itemId;
        }),
        _lastOperation: operationId
      };
    }

    case OperationType.COMPLETE_ITEM: {
      const { itemId } = payload;
      return {
        ...state,
        plan: (state.plan || []).map(item => {
          const id = item._id || item.plan_item_id;
          if (id === itemId || item.plan_item_id === itemId) {
            // Idempotent: if already complete, no-op
            if (item.complete) return item;
            return {
              ...item,
              complete: true
            };
          }
          return item;
        }),
        _lastOperation: operationId
      };
    }

    case OperationType.UNCOMPLETE_ITEM: {
      const { itemId } = payload;
      return {
        ...state,
        plan: (state.plan || []).map(item => {
          const id = item._id || item.plan_item_id;
          if (id === itemId || item.plan_item_id === itemId) {
            const { completed, completedAt, ...rest } = item;
            return {
              ...rest,
              complete: false
            };
          }
          return item;
        }),
        _lastOperation: operationId
      };
    }

    case OperationType.REORDER_ITEMS: {
      const { itemIds } = payload;
      if (!itemIds || !Array.isArray(itemIds)) {
        logger.debug('[applyOperation] REORDER_ITEMS - invalid itemIds');
        return state;
      }

      // Build map of current items
      const itemMap = new Map((state.plan || []).map(item => [
        item._id || item.plan_item_id,
        item
      ]));

      // Reorder based on provided IDs
      const reordered = itemIds
        .map(id => itemMap.get(id))
        .filter(Boolean);

      // Add any items not in the new order (handles concurrent adds)
      // These get appended to maintain eventual consistency
      (state.plan || []).forEach(item => {
        const id = item._id || item.plan_item_id;
        if (!itemIds.includes(id)) {
          reordered.push(item);
        }
      });

      return {
        ...state,
        plan: reordered,
        _lastOperation: operationId
      };
    }

    case OperationType.ADD_COLLABORATOR: {
      const { collaborator } = payload;
      const permissions = state.permissions || [];
      // Check if already exists (idempotency)
      const exists = permissions.some(p =>
        (p.user?._id || p.user) === (collaborator.user?._id || collaborator.user)
      );
      if (exists) {
        logger.debug('[applyOperation] ADD_COLLABORATOR skipped - already exists');
        return state;
      }
      return {
        ...state,
        permissions: [...permissions, collaborator],
        _lastOperation: operationId
      };
    }

    case OperationType.REMOVE_COLLABORATOR: {
      const { userId } = payload;
      return {
        ...state,
        permissions: (state.permissions || []).filter(p => {
          const permUserId = p.user?._id || p.user;
          return permUserId !== userId;
        }),
        _lastOperation: operationId
      };
    }

    case OperationType.UPDATE_PERMISSION: {
      const { userId, changes } = payload;
      return {
        ...state,
        permissions: (state.permissions || []).map(p => {
          const permUserId = p.user?._id || p.user;
          if (permUserId === userId) {
            return { ...p, ...changes };
          }
          return p;
        }),
        _lastOperation: operationId
      };
    }

    default:
      logger.warn('[applyOperation] Unknown operation type', { type });
      return state;
  }
}

/**
 * Check if an operation is idempotent
 * All operations in this system are designed to be idempotent
 *
 * @param {Object} operation - Operation to check
 * @returns {boolean} Always true for this implementation
 */
export function isIdempotent(operation) {
  // All our operations are idempotent by design:
  // - ADD_ITEM: Checks for existing item before adding
  // - UPDATE_ITEM: Applies same changes multiple times = same result
  // - DELETE_ITEM: Deleting non-existent item is no-op
  // - COMPLETE_ITEM: Preserves original completedAt timestamp
  // - REORDER_ITEMS: Same order applied twice = same result
  return true;
}

/**
 * Check if two operations are commutative
 * (can be applied in any order with same result)
 *
 * @param {Object} op1 - First operation
 * @param {Object} op2 - Second operation
 * @returns {boolean} True if operations can be applied in any order
 */
export function areCommutative(op1, op2) {
  // Operations on different items are always commutative
  const getItemId = (op) => op.payload?.itemId || op.payload?.item?._id;
  const id1 = getItemId(op1);
  const id2 = getItemId(op2);

  if (id1 && id2 && id1 !== id2) {
    return true;
  }

  // REORDER is not commutative with itself
  if (op1.type === OperationType.REORDER_ITEMS && op2.type === OperationType.REORDER_ITEMS) {
    return false;
  }

  // DELETE followed by ADD is not same as ADD followed by DELETE
  if (
    (op1.type === OperationType.DELETE_ITEM && op2.type === OperationType.ADD_ITEM) ||
    (op1.type === OperationType.ADD_ITEM && op2.type === OperationType.DELETE_ITEM)
  ) {
    return false;
  }

  // Most other operations are commutative due to idempotency
  return true;
}

/**
 * Apply multiple operations in sequence
 *
 * @param {Object} state - Initial state
 * @param {Array} operations - Operations to apply in order
 * @returns {Object} Final state after all operations
 */
export function applyOperations(state, operations) {
  if (!operations || !Array.isArray(operations)) {
    return state;
  }

  return operations.reduce((currentState, operation) => {
    if (currentState === null) {
      // State was deleted, only CREATE_PLAN can resurrect it
      if (operation.type === OperationType.CREATE_PLAN) {
        return applyOperation(null, operation);
      }
      return null;
    }
    return applyOperation(currentState, operation);
  }, state);
}

/**
 * Create a set for tracking applied operation IDs
 * Used to prevent duplicate application
 *
 * @returns {Set} Set for tracking operation IDs
 */
export function createAppliedOperationsSet() {
  return new Set();
}

/**
 * Check if operation was already applied
 *
 * @param {Set} appliedSet - Set of applied operation IDs
 * @param {Object} operation - Operation to check
 * @returns {boolean} True if already applied
 */
export function wasApplied(appliedSet, operation) {
  return appliedSet.has(operation.id);
}

/**
 * Mark operation as applied
 *
 * @param {Set} appliedSet - Set of applied operation IDs
 * @param {Object} operation - Operation to mark
 */
export function markApplied(appliedSet, operation) {
  appliedSet.add(operation.id);
}

export default {
  OperationType,
  createOperation,
  applyOperation,
  applyOperations,
  isIdempotent,
  areCommutative,
  createAppliedOperationsSet,
  wasApplied,
  markApplied
};

/**
 * usePlanOperations Hook
 *
 * Provides operation-based plan mutations with automatic event emission.
 * Operations are emitted via the event bus for cross-tab and future WebSocket sync.
 *
 * @module usePlanOperations
 */

import { useCallback, useRef, useEffect, useState } from 'react';
import { eventBus } from '../utilities/event-bus';
import {
  OperationType,
  createOperation,
  applyOperation,
  createAppliedOperationsSet,
  wasApplied,
  markApplied
} from '../utilities/plan-operations';
import { logger } from '../utilities/logger';
import {
  initOperationLog,
  logOperation,
  markOperationApplied as markLogApplied,
  getUnappliedOperations
} from '../utilities/operation-log';

/**
 * Hook for emitting plan operations
 *
 * @param {string} planId - The plan ID to operate on
 * @param {Object} options - Configuration options
 * @param {Object} options.vectorClock - Current vector clock state
 * @param {Function} options.onLocalOperation - Callback for local optimistic updates
 * @param {boolean} options.persistOperations - Whether to persist operations to IndexedDB (default: true)
 * @returns {Object} Operation emitter functions
 */
export default function usePlanOperations(planId, options = {}) {
  const {
    vectorClock = {},
    onLocalOperation,
    persistOperations = true
  } = options;

  // Track applied operations to prevent duplicates
  const appliedOperationsRef = useRef(createAppliedOperationsSet());

  // Track pending operations count for UI indicators
  const [pendingCount, setPendingCount] = useState(0);

  // Track if IndexedDB is initialized
  const dbInitializedRef = useRef(false);

  // Get session ID from event bus
  const sessionId = eventBus.getSessionId();

  /**
   * Initialize IndexedDB for operation persistence
   */
  useEffect(() => {
    if (!persistOperations || dbInitializedRef.current) return;

    const init = async () => {
      try {
        await initOperationLog();
        dbInitializedRef.current = true;

        // Load pending operations count
        if (planId) {
          const pending = await getUnappliedOperations(planId);
          setPendingCount(pending.length);
        }

        logger.debug('[usePlanOperations] IndexedDB initialized', { planId });
      } catch (err) {
        logger.warn('[usePlanOperations] Failed to init IndexedDB', {
          error: err.message
        });
      }
    };

    init();
  }, [persistOperations, planId]);

  /**
   * Emit an operation via event bus
   * @param {string} type - Operation type
   * @param {Object} payload - Operation payload
   * @returns {Promise<Object>} The created operation
   */
  const emitOperation = useCallback(async (type, payload) => {
    const operation = createOperation(type, payload, sessionId, vectorClock);

    logger.debug('[usePlanOperations] Emitting operation', {
      type,
      operationId: operation.id,
      planId
    });

    // Mark as applied locally to prevent duplicate handling
    markApplied(appliedOperationsRef.current, operation);

    // Persist to IndexedDB for offline support
    if (persistOperations && dbInitializedRef.current) {
      try {
        await logOperation({
          ...operation,
          planId
        });
        setPendingCount(prev => prev + 1);
        logger.debug('[usePlanOperations] Operation persisted to IndexedDB', {
          operationId: operation.id
        });
      } catch (err) {
        logger.warn('[usePlanOperations] Failed to persist operation', {
          operationId: operation.id,
          error: err.message
        });
      }
    }

    // Call local operation handler for optimistic update
    if (onLocalOperation) {
      onLocalOperation(operation);
    }

    // Emit via event bus for cross-tab sync
    eventBus.emit('plan:operation', {
      planId,
      operation
    });

    return operation;
  }, [planId, sessionId, vectorClock, onLocalOperation, persistOperations]);

  /**
   * Update plan date
   * @param {string} plannedDate - New planned date
   */
  const updatePlanDate = useCallback((plannedDate) => {
    return emitOperation(OperationType.UPDATE_PLAN, {
      changes: { planned_date: plannedDate }
    });
  }, [emitOperation]);

  /**
   * Update plan properties
   * @param {Object} changes - Properties to update
   */
  const updatePlan = useCallback((changes) => {
    return emitOperation(OperationType.UPDATE_PLAN, { changes });
  }, [emitOperation]);

  /**
   * Add an item to the plan
   * @param {Object} item - Item to add
   */
  const addItem = useCallback((item) => {
    return emitOperation(OperationType.ADD_ITEM, { item });
  }, [emitOperation]);

  /**
   * Update an item in the plan
   * @param {string} itemId - Item ID to update
   * @param {Object} changes - Properties to update
   */
  const updateItem = useCallback((itemId, changes) => {
    return emitOperation(OperationType.UPDATE_ITEM, { itemId, changes });
  }, [emitOperation]);

  /**
   * Delete an item from the plan
   * @param {string} itemId - Item ID to delete
   */
  const deleteItem = useCallback((itemId) => {
    return emitOperation(OperationType.DELETE_ITEM, { itemId });
  }, [emitOperation]);

  /**
   * Mark an item as complete
   * @param {string} itemId - Item ID to complete
   */
  const completeItem = useCallback((itemId) => {
    return emitOperation(OperationType.COMPLETE_ITEM, { itemId });
  }, [emitOperation]);

  /**
   * Mark an item as incomplete
   * @param {string} itemId - Item ID to uncomplete
   */
  const uncompleteItem = useCallback((itemId) => {
    return emitOperation(OperationType.UNCOMPLETE_ITEM, { itemId });
  }, [emitOperation]);

  /**
   * Reorder plan items
   * @param {Array<string>} itemIds - New order of item IDs
   */
  const reorderItems = useCallback((itemIds) => {
    return emitOperation(OperationType.REORDER_ITEMS, { itemIds });
  }, [emitOperation]);

  /**
   * Add a collaborator to the plan
   * @param {Object} collaborator - Collaborator object with user and role
   */
  const addCollaborator = useCallback((collaborator) => {
    return emitOperation(OperationType.ADD_COLLABORATOR, { collaborator });
  }, [emitOperation]);

  /**
   * Remove a collaborator from the plan
   * @param {string} userId - User ID to remove
   */
  const removeCollaborator = useCallback((userId) => {
    return emitOperation(OperationType.REMOVE_COLLABORATOR, { userId });
  }, [emitOperation]);

  /**
   * Update collaborator permissions
   * @param {string} userId - User ID to update
   * @param {Object} changes - Permission changes
   */
  const updatePermission = useCallback((userId, changes) => {
    return emitOperation(OperationType.UPDATE_PERMISSION, { userId, changes });
  }, [emitOperation]);

  /**
   * Check if an operation was already applied locally
   * @param {Object} operation - Operation to check
   * @returns {boolean} True if already applied
   */
  const isOperationApplied = useCallback((operation) => {
    return wasApplied(appliedOperationsRef.current, operation);
  }, []);

  /**
   * Mark an operation as applied (for remote operations)
   * Also marks in IndexedDB for persistence
   * @param {Object} operation - Operation to mark
   */
  const markOperationApplied = useCallback(async (operation) => {
    markApplied(appliedOperationsRef.current, operation);

    // Also mark in IndexedDB
    if (persistOperations && dbInitializedRef.current) {
      try {
        await markLogApplied(operation.id);
        setPendingCount(prev => Math.max(0, prev - 1));
      } catch (err) {
        logger.warn('[usePlanOperations] Failed to mark operation applied in log', {
          operationId: operation.id,
          error: err.message
        });
      }
    }
  }, [persistOperations]);

  /**
   * Get pending (unapplied) operations for replay
   * @returns {Promise<Array>} Array of pending operations
   */
  const getPendingOperations = useCallback(async () => {
    if (!persistOperations || !dbInitializedRef.current || !planId) {
      return [];
    }

    try {
      const pending = await getUnappliedOperations(planId);
      setPendingCount(pending.length);
      return pending;
    } catch (err) {
      logger.error('[usePlanOperations] Failed to get pending operations', {
        planId,
        error: err.message
      });
      return [];
    }
  }, [persistOperations, planId]);

  return {
    // Plan-level operations
    updatePlanDate,
    updatePlan,

    // Item operations
    addItem,
    updateItem,
    deleteItem,
    completeItem,
    uncompleteItem,
    reorderItems,

    // Collaborator operations
    addCollaborator,
    removeCollaborator,
    updatePermission,

    // Utilities
    emitOperation,
    isOperationApplied,
    markOperationApplied,

    // Offline/Persistence
    getPendingOperations,
    pendingCount,

    // Re-export operation types for convenience
    OperationType
  };
}

/**
 * Hook for handling incoming plan operations
 * Used in conjunction with usePlanOperations for receiving remote operations
 *
 * @param {string} planId - Plan ID to listen for
 * @param {Function} onOperation - Callback when operation received
 * @param {Object} options - Configuration options
 */
export function usePlanOperationHandler(planId, onOperation, options = {}) {
  const { enabled = true } = options;
  const appliedOperationsRef = useRef(createAppliedOperationsSet());

  // This would typically be implemented as a useEffect
  // subscribing to the event bus, but we keep the logic here
  // for integration with usePlanManagement

  const handleOperation = useCallback((event) => {
    const { planId: eventPlanId, operation } = event.detail || {};

    // Ignore operations for other plans
    if (eventPlanId !== planId) return;

    // Skip if already applied
    if (wasApplied(appliedOperationsRef.current, operation)) {
      logger.debug('[usePlanOperationHandler] Skipping duplicate operation', {
        operationId: operation.id
      });
      return;
    }

    // Mark as applied
    markApplied(appliedOperationsRef.current, operation);

    // Call the handler
    if (onOperation) {
      onOperation(operation);
    }
  }, [planId, onOperation]);

  return {
    handleOperation,
    isOperationApplied: (op) => wasApplied(appliedOperationsRef.current, op),
    markOperationApplied: (op) => markApplied(appliedOperationsRef.current, op)
  };
}

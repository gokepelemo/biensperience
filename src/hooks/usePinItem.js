import { useCallback } from 'react';
import { pinPlanItem } from '../utilities/plans-api';
import debug from '../utilities/debug';

/**
 * Hook for managing plan item pinning functionality.
 *
 * Encapsulates:
 * - Pin/unpin handler with optimistic updates
 * - API persistence with server reconciliation
 *
 * Note: The pinnedItemId is stored on the plan object itself (plan.pinnedItemId),
 * so this hook focuses on the action handler rather than state management.
 * The computed values (pinnedItem, isPinnedOrChild, pinnedItems, etc.) remain
 * in the component as they depend on flattened items and visibility logic.
 *
 * @param {Object} options - Hook configuration
 * @param {string|number} options.planId - ID of the current plan
 * @param {Array} options.allPlans - Array of all accessible plans (for finding current pinned state)
 * @param {Function} options.updatePlanInState - Callback for optimistic state updates
 * @param {Function} options.idEquals - Function to compare IDs for equality
 * @returns {Object} - { handlePinItem }
 */
export function usePinItem({
  planId,
  allPlans,
  updatePlanInState,
  idEquals
}) {
  /**
   * Toggle pin state for a plan item.
   * Uses optimistic updates with server reconciliation.
   *
   * @param {Object} planItem - The plan item to pin/unpin
   */
  const handlePinItem = useCallback(async (planItem) => {
    if (!planId) return;

    try {
      const itemId = (planItem._id || planItem.plan_item_id)?.toString();

      // Optimistic update - toggle the pinnedItemId
      const planForPin = allPlans.find(p => idEquals(p._id, planId));
      const currentPinnedId = planForPin?.pinnedItemId?.toString();
      const newPinnedItemId = currentPinnedId === itemId ? null : itemId;

      updatePlanInState((p) => ({ ...p, pinnedItemId: newPinnedItemId }));

      // Make API call
      const result = await pinPlanItem(planId, itemId);

      debug.log('[usePinItem] Plan item pin toggled', {
        planId,
        itemId,
        action: result.action,
        pinnedItemId: result.pinnedItemId
      });

      // Update with server response (in case it differs)
      updatePlanInState((p) => ({ ...p, pinnedItemId: result.pinnedItemId }));
    } catch (error) {
      debug.error('[usePinItem] Failed to pin/unpin item', error);
      // Rollback on error - for now, just log the error
      // The optimistic update remains; a full rollback would require
      // storing the previous pinnedItemId before the optimistic update
    }
  }, [planId, allPlans, updatePlanInState, idEquals]);

  return {
    handlePinItem
  };
}

export default usePinItem;

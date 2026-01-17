import { useState, useCallback } from 'react';
import { updatePlanItem } from '../utilities/plans-api';
import debug from '../utilities/debug';

/**
 * Hook for managing plan item date scheduling modal and operations.
 *
 * Encapsulates:
 * - Modal visibility and state management
 * - Schedule date opening logic (parent-only restriction)
 * - Save handler with optimistic updates and rollback
 * - Close/cleanup handler
 *
 * @param {Object} options - Hook configuration
 * @param {string|number} options.planId - ID of the current plan
 * @param {Array} options.planItems - Array of plan items for finding existing schedule
 * @param {Function} options.updatePlanInState - Callback for optimistic state updates
 * @returns {Object} - Date scheduling state and handlers
 */
export function useDateScheduling({
  planId,
  planItems,
  updatePlanInState
}) {
  // Modal state
  const [showDateModal, setShowDateModal] = useState(false);
  const [dateModalPlanItem, setDateModalPlanItem] = useState(null);
  const [dateModalTimeOnly, setDateModalTimeOnly] = useState(false);
  const [dateModalParentDate, setDateModalParentDate] = useState(null);

  /**
   * Close the date modal and reset all state.
   */
  const closeDateModal = useCallback(() => {
    setShowDateModal(false);
    setDateModalPlanItem(null);
    setDateModalTimeOnly(false);
    setDateModalParentDate(null);
  }, []);

  /**
   * Open the schedule date modal for a plan item.
   * Note: Scheduling is only allowed on parent items (not children).
   *
   * @param {Object} planItem - The plan item to schedule
   * @param {Object} [parentItem=null] - Parent item (unused, kept for API compatibility)
   */
  const handleScheduleDate = useCallback((planItem, parentItem = null) => {
    // Scheduling is only allowed on parent items.
    const isChild = planItem?.isChild || planItem?.parent;
    if (isChild) {
      debug.info('[useDateScheduling] Ignoring schedule request for child item');
      return;
    }

    setDateModalPlanItem(planItem);
    setDateModalTimeOnly(false);
    setDateModalParentDate(null);
    setShowDateModal(true);
  }, []);

  /**
   * Save the scheduled date/time for the current modal plan item.
   * Uses optimistic updates with rollback on failure.
   *
   * @param {Object} dateData - The date data to save
   * @param {string|null} dateData.scheduled_date - ISO date string or null
   * @param {string|null} dateData.scheduled_time - Time string (HH:MM) or null
   */
  const handleSaveDate = useCallback(async (dateData) => {
    if (!dateModalPlanItem || !planId) return;

    const planItemId = (dateModalPlanItem._id || dateModalPlanItem.plan_item_id)?.toString();

    // Find existing schedule for rollback
    const existing = planItems?.find((it) => {
      const itId = (it._id || it.plan_item_id)?.toString();
      return Boolean(planItemId && itId && itId === planItemId);
    });

    const prevSchedule = {
      scheduled_date: existing?.scheduled_date ?? null,
      scheduled_time: existing?.scheduled_time ?? null
    };

    // Optimistic update so Timeline view updates instantly when scheduling changes
    updatePlanInState((p) => {
      if (!p?.plan || !planItemId) return p;
      return {
        ...p,
        plan: p.plan.map((it) => {
          const itId = (it._id || it.plan_item_id)?.toString();
          if (!itId || itId !== planItemId) return it;
          return {
            ...it,
            scheduled_date: dateData.scheduled_date,
            scheduled_time: dateData.scheduled_time
          };
        })
      };
    });

    try {
      await updatePlanItem(planId, dateModalPlanItem._id || dateModalPlanItem.plan_item_id, {
        scheduled_date: dateData.scheduled_date,
        scheduled_time: dateData.scheduled_time
      });
      setShowDateModal(false);
      setDateModalPlanItem(null);
    } catch (error) {
      debug.error('[useDateScheduling] Failed to save date', error);

      // Roll back optimistic update if the API call fails
      updatePlanInState((p) => {
        if (!p?.plan || !planItemId) return p;
        return {
          ...p,
          plan: p.plan.map((it) => {
            const itId = (it._id || it.plan_item_id)?.toString();
            if (!itId || itId !== planItemId) return it;
            return {
              ...it,
              scheduled_date: prevSchedule.scheduled_date,
              scheduled_time: prevSchedule.scheduled_time
            };
          })
        };
      });
      throw error;
    }
  }, [dateModalPlanItem, planId, planItems, updatePlanInState]);

  return {
    // Modal state
    showDateModal,
    dateModalPlanItem,
    dateModalTimeOnly,
    dateModalParentDate,

    // Handlers
    handleScheduleDate,
    handleSaveDate,
    closeDateModal
  };
}

export default useDateScheduling;

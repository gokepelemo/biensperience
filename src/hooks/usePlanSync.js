/**
 * usePlanSync Hook
 *
 * Manages plan synchronization logic for detecting and applying divergence
 * between an experience's plan items and a user's plan instance.
 *
 * Extracted from SingleExperience.jsx to reduce component complexity.
 *
 * @module hooks/usePlanSync
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { getCookieValue, setCookieValue } from '../utilities/cookie-utils';
import { updatePlan } from '../utilities/plans-api';
import { handleError } from '../utilities/error-handler';
import { logger } from '../utilities/logger';
import debug from '../utilities/debug';
import { idEquals } from '../utilities/id-utils';
import { subscribeToEvent } from '../utilities/event-bus';

// Cookie configuration for sync alert dismissal
const SYNC_ALERT_COOKIE = 'planSyncAlertDismissed';
const SYNC_ALERT_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

/**
 * Get sync alert dismissal state from cookie
 * @param {string} planId - Plan ID
 * @returns {number|null} Timestamp when dismissed, or null if not dismissed
 */
function getSyncAlertCookie(planId) {
  try {
    return getCookieValue(SYNC_ALERT_COOKIE, planId, SYNC_ALERT_DURATION);
  } catch (err) {
    debug.warn('getSyncAlertCookie failed', err);
    return null;
  }
}

/**
 * Set sync alert dismissal cookie
 * @param {string} planId - Plan ID
 */
function setSyncAlertCookie(planId) {
  try {
    setCookieValue(SYNC_ALERT_COOKIE, planId, Date.now(), SYNC_ALERT_DURATION, SYNC_ALERT_DURATION);
  } catch (err) {
    debug.warn('setSyncAlertCookie failed', err);
  }
}

/**
 * Custom hook for managing plan synchronization
 *
 * @param {Object} options - Hook options
 * @param {Object} options.experience - The experience object with plan_items
 * @param {string} options.selectedPlanId - Currently selected plan ID
 * @param {Array} options.sharedPlans - Array of shared plans
 * @param {Function} options.fetchSharedPlans - Function to refresh shared plans
 * @param {Function} options.fetchUserPlan - Function to refresh user's plan
 * @param {Function} options.fetchPlans - Function to refresh global plans state
 * @param {Function} options.showError - Function to show error toast
 * @returns {Object} Sync state and handlers
 */
export default function usePlanSync({
  experience,
  selectedPlanId,
  sharedPlans,
  fetchSharedPlans,
  fetchUserPlan,
  fetchPlans,
  showError
}) {
  // Sync UI state
  const [showSyncButton, setShowSyncButton] = useState(false);
  const [showSyncAlert, setShowSyncAlert] = useState(true);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncChanges, setSyncChanges] = useState(null);
  const [selectedSyncItems, setSelectedSyncItems] = useState({
    added: [],
    removed: [],
    modified: []
  });
  const [syncLoading, setSyncLoading] = useState(false);

  /**
   * Check if a plan has diverged from its source experience
   * Uses normalized comparisons to prevent false positives
   */
  const checkPlanDivergence = useCallback((plan, exp) => {
    // Defensive guards: ensure both plan.plan and experience.plan_items are arrays
    if (!plan || !exp || !Array.isArray(exp.plan_items) || !Array.isArray(plan.plan)) {
      return false;
    }

    // Check if plan items count differs
    if ((plan.plan || []).length !== (exp.plan_items || []).length) {
      return true;
    }

    // Helper functions to normalize values consistently
    // This prevents false positives where checkPlanDivergence thinks there's a change
    // but the actual values are equivalent
    const normalizeString = (val) => val || ''; // null/undefined/"" all become ""
    const normalizeNumber = (val) => val || 0;  // null/undefined/0 all become 0

    // Check if any plan item has changed
    for (let i = 0; i < (plan.plan || []).length; i++) {
      const planItem = plan.plan[i];
      const experienceItem = exp.plan_items.find(
        (item) => item._id.toString() === planItem.plan_item_id.toString()
      );

      if (!experienceItem) {
        return true; // Item was deleted from experience
      }

      // Check if key fields have changed using same normalization
      // This ensures sync banner only shows when there are ACTUAL changes to sync
      if (
        normalizeString(experienceItem.text) !== normalizeString(planItem.text) ||
        normalizeString(experienceItem.url) !== normalizeString(planItem.url) ||
        normalizeNumber(experienceItem.cost_estimate) !== normalizeNumber(planItem.cost) ||
        normalizeNumber(experienceItem.planning_days) !== normalizeNumber(planItem.planning_days)
      ) {
        return true;
      }
    }

    return false;
  }, []);

  /**
   * Calculate changes between experience and plan for sync modal
   */
  const handleSyncPlan = useCallback(async () => {
    if (!selectedPlanId || !experience) return;

    try {
      const currentPlan = sharedPlans.find((p) => idEquals(p._id, selectedPlanId));
      if (!currentPlan) return;

      const changes = {
        added: [],
        removed: [],
        modified: []
      };

      // Find items in experience but not in plan (added)
      experience.plan_items.forEach((expItem) => {
        const planItem = currentPlan.plan.find(
          (pItem) => pItem.plan_item_id?.toString() === expItem._id.toString()
        );
        if (!planItem) {
          changes.added.push({
            _id: expItem._id,
            text: expItem.text,
            url: expItem.url,
            cost: expItem.cost_estimate || 0,
            planning_days: expItem.planning_days || 0,
            photo: expItem.photo,
            parent: expItem.parent
          });
        }
      });

      // Find items in plan but not in experience (removed)
      currentPlan.plan.forEach((planItem) => {
        const expItem = experience.plan_items.find(
          (eItem) => eItem._id.toString() === planItem.plan_item_id?.toString()
        );
        if (!expItem) {
          changes.removed.push({
            _id: planItem.plan_item_id,
            text: planItem.text,
            url: planItem.url
          });
        }
      });

      // Find modified items (text, url, cost, or days changed)
      // Normalize falsy values for consistent comparison
      const normalizeString = (val) => val || '';
      const normalizeNumber = (val) => val || 0;

      experience.plan_items.forEach((expItem) => {
        const planItem = currentPlan.plan.find(
          (pItem) => pItem.plan_item_id?.toString() === expItem._id.toString()
        );
        if (planItem) {
          const modifications = [];

          // Compare text
          if (normalizeString(planItem.text) !== normalizeString(expItem.text)) {
            modifications.push({
              field: 'text',
              old: planItem.text,
              new: expItem.text
            });
          }

          // Compare url
          if (normalizeString(planItem.url) !== normalizeString(expItem.url)) {
            modifications.push({
              field: 'url',
              old: planItem.url,
              new: expItem.url
            });
          }

          // Compare cost
          if (normalizeNumber(planItem.cost) !== normalizeNumber(expItem.cost_estimate)) {
            modifications.push({
              field: 'cost',
              old: planItem.cost,
              new: expItem.cost_estimate || 0
            });
          }

          // Compare planning_days
          if (normalizeNumber(planItem.planning_days) !== normalizeNumber(expItem.planning_days)) {
            modifications.push({
              field: 'days',
              old: planItem.planning_days,
              new: expItem.planning_days || 0
            });
          }

          if (modifications.length > 0) {
            changes.modified.push({
              _id: expItem._id,
              text: expItem.text,
              modifications
            });
          }
        }
      });

      // Show modal with changes and select all by default
      setSyncChanges(changes);
      setSelectedSyncItems({
        added: changes.added.map((_, idx) => idx),
        removed: changes.removed.map((_, idx) => idx),
        modified: changes.modified.map((_, idx) => idx)
      });
      setShowSyncModal(true);
    } catch (err) {
      const errorMsg = handleError(err, { context: 'Calculate sync changes' });
      showError?.(errorMsg);
    }
  }, [selectedPlanId, experience, sharedPlans, showError]);

  /**
   * Apply selected sync changes to the plan
   */
  const confirmSyncPlan = useCallback(async () => {
    if (!selectedPlanId || !experience || !syncChanges) return;

    try {
      setSyncLoading(true);

      const currentPlan = sharedPlans.find((p) => idEquals(p._id, selectedPlanId));
      if (!currentPlan) {
        throw new Error('Current plan not found');
      }

      // Start with current plan items
      let updatedPlanSnapshot = [...currentPlan.plan];

      // Apply selected additions
      if (selectedSyncItems.added.length > 0) {
        const itemsToAdd = selectedSyncItems.added.map((idx) => syncChanges.added[idx]);
        itemsToAdd.forEach((item) => {
          updatedPlanSnapshot.push({
            plan_item_id: item._id,
            complete: false,
            cost: item.cost || 0,
            planning_days: item.planning_days || 0,
            text: item.text,
            url: item.url,
            photo: item.photo,
            parent: item.parent
          });
        });
      }

      // Apply selected removals
      if (selectedSyncItems.removed.length > 0) {
        const itemIdsToRemove = selectedSyncItems.removed.map((idx) =>
          syncChanges.removed[idx]._id.toString()
        );
        updatedPlanSnapshot = updatedPlanSnapshot.filter(
          (pItem) => !itemIdsToRemove.includes(pItem.plan_item_id?.toString())
        );
      }

      // Apply selected modifications
      if (selectedSyncItems.modified.length > 0) {
        const itemsToModify = selectedSyncItems.modified.map((idx) => syncChanges.modified[idx]);
        itemsToModify.forEach((modItem) => {
          const itemIndex = updatedPlanSnapshot.findIndex(
            (pItem) => pItem.plan_item_id?.toString() === modItem._id.toString()
          );
          if (itemIndex !== -1) {
            // Update fields that changed, preserve completion status and actual cost
            const existingItem = updatedPlanSnapshot[itemIndex];
            const expItem = experience.plan_items.find(
              (ei) => ei._id.toString() === modItem._id.toString()
            );
            if (expItem) {
              // Determine whether cost was among the selected modifications for this item
              const changedFields = (modItem.modifications || []).map((m) => m.field);
              const shouldUpdateCost = changedFields.includes('cost');

              updatedPlanSnapshot[itemIndex] = {
                ...existingItem,
                text: expItem.text,
                url: expItem.url,
                cost: shouldUpdateCost ? (expItem.cost_estimate || 0) : existingItem.cost,
                planning_days: expItem.planning_days || 0,
                photo: expItem.photo,
                parent: expItem.parent
              };
            }
          }
        });
      }

      // Update the plan with new snapshot
      await updatePlan(selectedPlanId, { plan: updatedPlanSnapshot });

      // Refresh plans
      await fetchSharedPlans?.();
      await fetchUserPlan?.();
      await fetchPlans?.(); // Refresh global plans state

      setShowSyncButton(false);
      setShowSyncAlert(false);
      setShowSyncModal(false);
      setSyncChanges(null);
      setSelectedSyncItems({ added: [], removed: [], modified: [] });

      // Set cookie to hide alert for 1 week after successful sync
      setSyncAlertCookie(selectedPlanId);

      debug.log('Plan synced successfully');
    } catch (err) {
      const errorMsg = handleError(err, { context: 'Sync plan' });
      showError?.(errorMsg);
    } finally {
      setSyncLoading(false);
    }
  }, [
    selectedPlanId,
    experience,
    sharedPlans,
    fetchSharedPlans,
    fetchUserPlan,
    fetchPlans,
    selectedSyncItems,
    syncChanges,
    showError
  ]);

  /**
   * Dismiss the sync alert for 1 week
   */
  const dismissSyncAlert = useCallback(() => {
    if (selectedPlanId) {
      setSyncAlertCookie(selectedPlanId);
      setShowSyncAlert(false);
      debug.log('Sync alert dismissed for 1 week');
    }
  }, [selectedPlanId]);

  /**
   * Close the sync modal and reset changes
   */
  const closeSyncModal = useCallback(() => {
    setShowSyncModal(false);
    setSyncChanges(null);
  }, []);

  /**
   * Reset all sync state (for experience navigation)
   */
  const resetSyncState = useCallback(() => {
    setShowSyncButton(false);
    setShowSyncAlert(true);
    setShowSyncModal(false);
    setSyncChanges(null);
    setSelectedSyncItems({ added: [], removed: [], modified: [] });
    setSyncLoading(false);
  }, []);

  // Ref to track latest data for event handlers (avoids stale closures)
  const dataRef = useRef({ experience, sharedPlans, selectedPlanId });
  useEffect(() => {
    dataRef.current = { experience, sharedPlans, selectedPlanId };
  }, [experience, sharedPlans, selectedPlanId]);

  /**
   * Recompute divergence and update sync button/alert state
   * Can be called manually or from effects
   */
  const recheckDivergence = useCallback(() => {
    const { experience: exp, sharedPlans: plans, selectedPlanId: planId } = dataRef.current;

    if (!planId || plans.length === 0 || !exp) {
      return;
    }

    const currentPlan = plans.find((p) => idEquals(p._id, planId));
    if (!currentPlan) {
      return;
    }

    const hasDiverged = checkPlanDivergence(currentPlan, exp);

    logger.debug('[usePlanSync] Divergence check', {
      planId,
      experienceItemsCount: exp.plan_items?.length || 0,
      planItemsCount: currentPlan.plan?.length || 0,
      hasDiverged
    });

    setShowSyncButton(hasDiverged);

    // Check if alert was recently dismissed via cookie
    if (hasDiverged) {
      const dismissedTime = getSyncAlertCookie(planId);
      setShowSyncAlert(!dismissedTime); // Show alert only if not recently dismissed
    } else {
      setShowSyncAlert(false); // No divergence, no alert
    }
  }, [checkPlanDivergence]);

  // Check for divergence when plan or experience changes
  useEffect(() => {
    recheckDivergence();
  }, [selectedPlanId, sharedPlans, experience, recheckDivergence]);

  // Subscribe to experience plan item events via event bus for instant sync banner updates
  // This provides immediate feedback when The Plan changes, even before React re-renders
  useEffect(() => {
    const experienceId = experience?._id?.toString();
    if (!experienceId) return;

    const handleExperienceItemEvent = (event) => {
      // Check if this event is for our experience
      const eventExpId = event.experienceId || event.payload?.experienceId;
      if (eventExpId?.toString() !== experienceId) return;

      logger.debug('[usePlanSync] Experience item event received, rechecking divergence', {
        eventType: event.type,
        experienceId: eventExpId
      });

      // Small delay to allow React state to settle after the event is processed
      // The experience state will be updated by SingleExperience's applyExperiencePlanItemEvent
      setTimeout(() => {
        recheckDivergence();
      }, 50);
    };

    // Subscribe to all experience plan item event types
    const unsubAdded = subscribeToEvent('experience:item:added', handleExperienceItemEvent);
    const unsubUpdated = subscribeToEvent('experience:item:updated', handleExperienceItemEvent);
    const unsubDeleted = subscribeToEvent('experience:item:deleted', handleExperienceItemEvent);
    const unsubReordered = subscribeToEvent('experience:item:reordered', handleExperienceItemEvent);

    return () => {
      unsubAdded();
      unsubUpdated();
      unsubDeleted();
      unsubReordered();
    };
  }, [experience?._id, recheckDivergence]);

  return {
    // State
    showSyncButton,
    showSyncAlert,
    showSyncModal,
    syncChanges,
    selectedSyncItems,
    syncLoading,

    // Setters (for modal interactions)
    setSelectedSyncItems,

    // Actions
    handleSyncPlan,
    confirmSyncPlan,
    dismissSyncAlert,
    closeSyncModal,
    resetSyncState,

    // Utilities
    checkPlanDivergence
  };
}

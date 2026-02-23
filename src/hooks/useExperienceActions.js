/**
 * useExperienceActions Hook
 *
 * Extracts share, plan/unplan toggle, and removal handlers from SingleExperience.jsx.
 * Consolidates action handlers for better separation of concerns and reusability.
 *
 * @module hooks/useExperienceActions
 */

import { useCallback } from 'react';
import { lang } from '../lang.constants';
import { handleError } from '../utilities/error-handler';
import { deletePlan as deletePlanAPI } from '../utilities/plans-api';
import debug from '../utilities/debug';

/**
 * Hook for experience action handlers (share, plan toggle, remove)
 *
 * @param {Object} options - Hook configuration
 * @param {Object} options.experience - Current experience object
 * @param {string} options.experienceId - Experience ID (for URL building)
 * @param {Object} options.user - Current user object
 * @param {Object} options.userPlan - User's plan for this experience (if any)
 * @param {boolean} options.userHasExperience - Whether user has this experience planned
 * @param {Object} options.selectedPlan - Currently selected plan (for sharing plan items)
 * @param {Function} options.openModal - Function to open modals (from useModalManager)
 * @param {Function} options.closeModal - Function to close modals (from useModalManager)
 * @param {string} options.MODAL_NAMES - Modal name constants
 * @param {Function} options.setIsEditingDate - Setter for date editing state
 * @param {Function} options.setActiveTab - Setter for active tab
 * @param {Function} options.setPendingUnplan - Setter for pending unplan state
 * @param {Function} options.deletePlan - Function to delete a plan (from usePlanManagement)
 * @param {Function} options.setUserPlan - Setter for user plan state
 * @param {Function} options.setUserHasExperience - Setter for userHasExperience state
 * @param {Function} options.setDisplayedPlannedDate - Setter for displayed planned date
 * @param {Function} options.setSharedPlans - Setter for shared plans state
 * @param {Function} options.fetchPlans - Function to refetch all plans
 * @param {Function} options.success - Toast success function
 * @param {Function} options.showError - Toast error function
 * @param {Function} options.undoable - Toast undoable function
 *
 * @returns {Object} Action handlers
 */
export function useExperienceActions({
  experience,
  experienceId,
  user,
  userPlan,
  userHasExperience,
  selectedPlan,
  openModal,
  closeModal,
  MODAL_NAMES,
  setIsEditingDate,
  setActiveTab,
  setPendingUnplan,
  deletePlan,
  setUserPlan,
  setUserHasExperience,
  setDisplayedPlannedDate,
  setSharedPlans,
  fetchPlans,
  success,
  showError,
  undoable
}) {
  /**
   * Toggle experience planned state
   * - If not planned: Opens date picker to add
   * - If planned: Opens confirmation modal to remove
   */
  const handleExperience = useCallback(async () => {
    if (!experience || !user) return;
    if (!userHasExperience) {
      // Show date picker for new addition
      setIsEditingDate(false);
      openModal(MODAL_NAMES.DATE_PICKER);
      return;
    }
    // Show confirmation modal before removing
    // Don't hide badge yet - wait for user to confirm deletion
    openModal(MODAL_NAMES.REMOVE_PLAN);
  }, [experience, user, userHasExperience, setIsEditingDate, openModal, MODAL_NAMES]);

  /**
   * Share experience via Web Share API or clipboard fallback
   */
  const handleShareExperience = useCallback(() => {
    if (!experience) return;
    const shareUrl = window.location.href;
    const shareTitle = experience.name || 'Experience';

    if (navigator.share) {
      navigator.share({
        title: shareTitle,
        url: shareUrl
      }).catch(() => {
        // User cancelled or share failed - silently ignore
      });
    } else {
      navigator.clipboard.writeText(shareUrl).then(() => {
        success(lang.current.notification?.share?.copied || 'Link copied to clipboard');
      }).catch(() => {
        showError(lang.current.notification?.share?.failed || 'Failed to copy link');
      });
    }
  }, [experience, success, showError]);

  /**
   * Share plan item via deep link
   * Creates URL with hash: /experiences/:id#plan-{planId}-item-{itemId}
   *
   * @param {Object} planItem - Plan item to share
   */
  const handleSharePlanItem = useCallback((planItem) => {
    if (!planItem || !selectedPlan || !experienceId) return;

    // Build deep link URL: /experiences/:id#plan-{planId}-item-{itemId}
    const baseUrl = `${window.location.origin}/experiences/${experienceId}`;
    const hash = `#plan-${selectedPlan._id}-item-${planItem._id}`;
    const shareUrl = baseUrl + hash;
    const shareTitle = planItem.text || 'Plan Item';

    if (navigator.share) {
      navigator.share({
        title: shareTitle,
        url: shareUrl
      }).catch(() => {
        // User cancelled or share failed - silently ignore
      });
    } else {
      navigator.clipboard.writeText(shareUrl).then(() => {
        success(lang.current.notification?.share?.copied || 'Link copied to clipboard');
      }).catch(() => {
        showError(lang.current.notification?.share?.failed || 'Failed to copy link');
      });
    }
  }, [selectedPlan, experienceId, success, showError]);

  /**
   * Confirm and execute plan removal
   * Called when user confirms deletion in the remove modal
   */
  const confirmRemoveExperience = useCallback(async () => {
    if (!experience || !user) return;
    if (!userPlan) {
      closeModal();
      return;
    }

    // Save state for potential undo
    const prevUserPlan = userPlan;
    const planId = userPlan._id;

    // User confirmed deletion
    setPendingUnplan(true);
    closeModal(); // Close remove modal and date picker
    setActiveTab("experience"); // Switch back to experience tab

    // Optimistic UI removal
    setUserPlan(null);
    setUserHasExperience(false);
    setDisplayedPlannedDate(null);
    setSharedPlans(prev => prev.filter(p => p._id !== planId));
    setPendingUnplan(false);

    debug.log("Plan removed optimistically, deferring API call");

    // Show undo toast with deferred API call
    undoable(lang.current.notification?.plan?.removedUndo || 'Removed from your plans. Tap Undo to restore.', {
      onUndo: () => {
        setUserPlan(prevUserPlan);
        setUserHasExperience(true);
        setDisplayedPlannedDate(prevUserPlan.planned_date || null);
        setSharedPlans(prev => [...prev, prevUserPlan]);
      },
      onExpire: async () => {
        try {
          await deletePlanAPI(planId);
          debug.log("Plan deleted successfully via deferred API call");
        } catch (err) {
          // Rollback on error
          setUserPlan(prevUserPlan);
          setUserHasExperience(true);
          setDisplayedPlannedDate(prevUserPlan.planned_date || null);
          fetchPlans?.().catch(() => {});
          const errorMsg = handleError(err, { context: "Remove plan" });
          showError(errorMsg || "Failed to remove plan. It has been restored.");
        }
      },
    });
  }, [
    experience,
    user,
    userPlan,
    closeModal,
    setActiveTab,
    setPendingUnplan,
    setUserPlan,
    setUserHasExperience,
    setDisplayedPlannedDate,
    setSharedPlans,
    fetchPlans,
    undoable,
    showError
  ]);

  return {
    handleExperience,
    handleShareExperience,
    handleSharePlanItem,
    confirmRemoveExperience
  };
}

export default useExperienceActions;

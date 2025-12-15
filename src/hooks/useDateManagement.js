import { useCallback, useEffect, useRef, useState } from 'react';
import { isOwner } from '../utilities/permissions';
import { handleError } from '../utilities/error-handler';
import debug from '../utilities/debug';

/**
 * Custom hook for date management logic in SingleExperience.
 * 
 * Handles:
 * - Date editing mode state
 * - Date update operations (via handleDateUpdate callback)
 * - Dynamic font sizing for displayed dates
 * - Displayed planned date synchronization
 * 
 * Works with date state from usePlanManagement hook:
 * - plannedDate, setPlannedDate (input field state)
 * - userPlannedDate, setUserPlannedDate (user's plan date)
 * - displayedPlannedDate, setDisplayedPlannedDate (UI display date)
 * 
 * @param {Object} params - Hook parameters
 * @param {Object} params.user - Current user object
 * @param {Object} params.experience - Current experience object
 * @param {Object} params.userPlan - User's plan for this experience
 * @param {boolean} params.userHasExperience - Whether user has planned this experience
 * @param {string} params.activeTab - Active tab ('experience' or 'myplan')
 * @param {string} params.selectedPlanId - Selected plan ID (for collaborative plans)
 * @param {Array} params.sharedPlans - Array of shared plans
 * @param {string} params.plannedDate - Date input field value
 * @param {Function} params.setPlannedDate - Set date input value
 * @param {string} params.userPlannedDate - User's planned date
 * @param {string} params.displayedPlannedDate - Currently displayed date
 * @param {Function} params.setDisplayedPlannedDate - Set displayed date
 * @param {Function} params.updatePlan - Function to update a plan
 * @param {Function} params.handleAddExperience - Function to add experience/create plan
 * @param {Function} params.fetchUserPlan - Function to refresh user's plan
 * @param {Function} params.fetchSharedPlans - Function to refresh shared plans
 * @param {Function} params.fetchPlans - Function to refresh plans from DataContext
 * @param {Function} params.fetchAllData - Function to refresh all experience data
 * @param {Function} params.setLoading - Function to set loading state
 * @param {Function} params.closeModal - Function to close the date picker modal
 * @param {Function} params.showError - Function to show error messages
 * @param {Function} params.idEquals - Function to compare IDs
 * 
 * @returns {Object} Date management methods and refs
 */
export function useDateManagement({
  user,
  experience,
  userPlan,
  userHasExperience,
  activeTab,
  selectedPlanId,
  sharedPlans,
  plannedDate,
  setPlannedDate,
  userPlannedDate,
  displayedPlannedDate,
  setDisplayedPlannedDate,
  updatePlan,
  handleAddExperience,
  fetchUserPlan,
  fetchSharedPlans,
  fetchPlans,
  fetchAllData,
  setLoading,
  closeModal,
  showError,
  idEquals,
  // Optional: allow passing in isEditingDate state from parent (to fix circular dependency)
  isEditingDateState = null,
  setIsEditingDateState = null
}) {
  // Date editing mode - use provided state or create local state
  const [localIsEditingDate, localSetIsEditingDate] = useState(false);
  const isEditingDate = isEditingDateState !== null ? isEditingDateState : localIsEditingDate;
  const setIsEditingDate = setIsEditingDateState || localSetIsEditingDate;
  
  // Ref for dynamic font sizing
  const plannedDateRef = useRef(null);

  /**
   * Update displayed planned date based on active tab and selected plan
   * This syncs the displayed date with the appropriate source (user plan vs selected collaborative plan)
   */
  useEffect(() => {
    // If the user doesn't currently have this experience planned, suppress any planned date display
    if (!userHasExperience) {
      setDisplayedPlannedDate(null);
      return;
    }

    if (activeTab === "myplan" && selectedPlanId) {
      // Show the selected plan's planned date
      const selectedPlan = sharedPlans.find((p) => idEquals(p._id, selectedPlanId));
      setDisplayedPlannedDate(selectedPlan?.planned_date || null);
    } else {
      // Show the user's experience planned date
      setDisplayedPlannedDate(userPlannedDate);
    }
  }, [activeTab, selectedPlanId, sharedPlans, userPlannedDate, userHasExperience, idEquals, setDisplayedPlannedDate]);

  /**
   * Dynamically adjusts the font size of the planned date metric value to fit within container.
   * Similar to DestinationCard implementation - reduces font size incrementally if text overflows.
   */
  useEffect(() => {
    const adjustPlannedDateFontSize = () => {
      const element = plannedDateRef.current;
      if (!element) return;

      // Reset to default size first
      element.style.fontSize = "";

      // Get the computed style to find the current font size
      let fontSize = parseFloat(window.getComputedStyle(element).fontSize);
      const minFontSize = 1; // rem (16px at base 16px) - more aggressive minimum

      // Check if text is overflowing horizontally
      // Reduce more aggressively (2px instead of 1px per iteration)
      while (
        element.scrollWidth > element.clientWidth &&
        fontSize > minFontSize * 16
      ) {
        fontSize -= 2; // More aggressive reduction
        element.style.fontSize = `${fontSize}px`;
      }
    };

    // Use setTimeout to ensure DOM is fully rendered before adjusting
    const timeoutId = setTimeout(() => {
      adjustPlannedDateFontSize();
    }, 0);

    // Adjust on window resize
    window.addEventListener("resize", adjustPlannedDateFontSize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", adjustPlannedDateFontSize);
    };
  }, [displayedPlannedDate]);

  /**
   * Handle date update for plans and experiences.
   * Supports updating:
   * - Selected collaborative plan's date (My Plan tab)
   * - User's own plan date (Experience tab for non-owners)
   * - Owner's personal plan date (Experience tab for owners)
   */
  const handleDateUpdate = useCallback(async () => {
    if (!plannedDate) return;

    try {
      setLoading(true);

      // If viewing "My Plan" tab, update the selected plan's date
      if (activeTab === "myplan" && selectedPlanId) {
        // Convert date string to ISO format for the API
        const dateToSend = plannedDate
          ? new Date(plannedDate).toISOString()
          : null;

        // Optimistically update displayed date immediately
        setDisplayedPlannedDate(dateToSend);

        // Update server - event reconciliation handles state synchronization
        await updatePlan(selectedPlanId, { planned_date: dateToSend });

        // Refresh plans immediately - version-based reconciliation prevents overwrites
        fetchUserPlan().catch(() => {});
        fetchSharedPlans().catch(() => {});
        fetchPlans().catch(() => {});

        debug.log("Plan date updated successfully");
      } else if (!isOwner(user, experience)) {
        // Only non-owners can update planned date on Experience tab
        // Owners don't have a planned date since they manage the experience directly

        // Check if user already has a plan for this experience
        if (userPlan) {
          // Update existing plan's date
          // Convert date string to ISO format for the API
          const dateToSend = plannedDate
            ? new Date(plannedDate).toISOString()
            : null;

          // Optimistically update displayed date
          setDisplayedPlannedDate(dateToSend);

          // Update server - event reconciliation handles state synchronization
          await updatePlan(userPlan._id, { planned_date: dateToSend });

          // Refresh plans immediately - version-based reconciliation prevents overwrites
          fetchUserPlan().catch(() => {});
          fetchSharedPlans().catch(() => {});
          fetchPlans().catch(() => {});

          debug.log("Existing plan date updated successfully");
        } else {
          // Create new plan by adding experience
          await handleAddExperience();
        }

        // Refresh experience to get updated state
        await fetchAllData();
      } else if (isOwner(user, experience)) {
        // Owners can now create plans for their own experiences
        // Check if owner already has a plan
        if (userPlan) {
          // Update existing plan's date
          const dateToSend = plannedDate
            ? new Date(plannedDate).toISOString()
            : null;

          // Optimistically update displayed date
          setDisplayedPlannedDate(dateToSend);

          // Update server - event reconciliation handles state synchronization
          await updatePlan(userPlan._id, { planned_date: dateToSend });

          // Refresh plans immediately - version-based reconciliation prevents overwrites
          fetchUserPlan().catch(() => {});
          fetchSharedPlans().catch(() => {});
          fetchPlans().catch(() => {});

          debug.log("Owner's existing plan date updated successfully");
        } else {
          // Create new plan by adding experience
          await handleAddExperience();
        }

        // Refresh experience to get updated state
        await fetchAllData();
      }

      closeModal();
      setIsEditingDate(false);
      setPlannedDate("");
    } catch (err) {
      // Special-case email verification errors to give a clear action to the user
      const msgLower = (err && err.message ? err.message.toLowerCase() : "");
      if (msgLower.includes("email verification") || msgLower.includes("email_not_verified") || msgLower.includes("email not verified") || msgLower.includes("verify your email") || msgLower.includes("email_confirmed") ) {
        showError('Email verification required. Please verify your email address (check your inbox for a verification link)');
      } else {
        const errorMsg = handleError(err, { context: "Update date" });
        showError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  }, [
    plannedDate,
    activeTab,
    selectedPlanId,
    user,
    experience,
    userPlan,
    handleAddExperience,
    fetchUserPlan,
    fetchSharedPlans,
    fetchPlans,
    fetchAllData,
    updatePlan,
    setLoading,
    closeModal,
    showError
  ]);

  return {
    isEditingDate,
    setIsEditingDate,
    plannedDateRef,
    handleDateUpdate
  };
}

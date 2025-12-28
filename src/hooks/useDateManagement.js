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
   * Helper to update an existing plan's date
   * @param {string} planId - Plan ID to update
   * @returns {Promise<void>}
   */
  const updateExistingPlanDate = useCallback(async (planId) => {
    const dateToSend = plannedDate
      ? new Date(plannedDate).toISOString()
      : null;

    // Optimistically update displayed date
    setDisplayedPlannedDate(dateToSend);

    // Update server - event reconciliation handles state synchronization
    await updatePlan(planId, { planned_date: dateToSend });

    // Refresh plans - version-based reconciliation prevents overwrites
    fetchUserPlan().catch(() => {});
    fetchSharedPlans().catch(() => {});
    fetchPlans().catch(() => {});

    debug.log("Plan date updated successfully", { planId });
  }, [plannedDate, updatePlan, setDisplayedPlannedDate, fetchUserPlan, fetchSharedPlans, fetchPlans]);

  /**
   * Helper to finalize date update (cleanup UI state)
   */
  const finalizeDateUpdate = useCallback(() => {
    closeModal();
    setIsEditingDate(false);
    setPlannedDate("");
  }, [closeModal, setIsEditingDate, setPlannedDate]);

  /**
   * Handle date update for plans and experiences.
   *
   * Logic flow:
   * 1. CREATE mode (isEditingDate=false): Always create a new plan for the user
   *    - This allows users to create their own plan even when viewing a shared plan
   * 2. EDIT mode (isEditingDate=true): Update an existing plan's date
   *    - On "My Plan" tab: Update the selected plan's date
   *    - On "Experience" tab: Update user's own plan date (if exists)
   */
  const handleDateUpdate = useCallback(async () => {
    if (!plannedDate) return;

    try {
      setLoading(true);

      // === CREATE MODE ===
      // When user clicks "Plan This Experience" button (not editing existing date)
      if (!isEditingDate) {
        await handleAddExperience();
        await fetchAllData();
        finalizeDateUpdate();
        return;
      }

      // === EDIT MODE ===
      // User is editing an existing plan's date

      // Case 1: Editing selected plan on "My Plan" tab
      if (activeTab === "myplan" && selectedPlanId) {
        await updateExistingPlanDate(selectedPlanId);
      }
      // Case 2: Editing user's own plan on "Experience" tab
      else if (userPlan) {
        await updateExistingPlanDate(userPlan._id);
        await fetchAllData();
      }
      // Case 3: No existing plan (shouldn't happen in edit mode, but handle gracefully)
      else {
        debug.log("Edit mode but no plan exists - creating new plan");
        await handleAddExperience();
        await fetchAllData();
      }

      finalizeDateUpdate();
    } catch (err) {
      // Handle email verification errors with specific message
      const msgLower = err?.message?.toLowerCase() || "";
      const isEmailError = [
        "email verification",
        "email_not_verified",
        "email not verified",
        "verify your email",
        "email_confirmed"
      ].some(phrase => msgLower.includes(phrase));

      if (isEmailError) {
        showError('Email verification required. Please verify your email address (check your inbox for a verification link)');
      } else {
        showError(handleError(err, { context: "Update date" }));
      }
    } finally {
      setLoading(false);
    }
  }, [
    plannedDate,
    activeTab,
    selectedPlanId,
    userPlan,
    isEditingDate,
    handleAddExperience,
    fetchAllData,
    updateExistingPlanDate,
    finalizeDateUpdate,
    setLoading,
    showError
  ]);

  return {
    isEditingDate,
    setIsEditingDate,
    plannedDateRef,
    handleDateUpdate
  };
}

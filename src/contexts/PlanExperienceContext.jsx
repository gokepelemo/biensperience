import React, { createContext, useContext, useState, useCallback } from 'react';

/**
 * Context for managing the Plan New Experience multi-step modal.
 * Allows any component in the app to trigger the modal flow.
 */
const PlanExperienceContext = createContext(null);

export function PlanExperienceProvider({ children }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [initialStep, setInitialStep] = useState(1);
  const [prefilledData, setPrefilledData] = useState(null);

  /**
   * Open the Plan Experience modal
   * @param {Object} options - Optional configuration
   * @param {number} options.step - Starting step (1 = create experience, 2 = select date)
   * @param {Object} options.experience - Pre-existing experience to plan (skips step 1)
   * @param {string} options.destinationId - Pre-selected destination for new experience
   */
  const openPlanExperienceModal = useCallback((options = {}) => {
    const { step = 1, experience = null, destinationId = null } = options;

    if (experience) {
      // Skip to step 2 if experience already exists
      setInitialStep(2);
      setPrefilledData({ experience });
    } else {
      setInitialStep(step);
      setPrefilledData(destinationId ? { destinationId } : null);
    }

    setIsModalOpen(true);
  }, []);

  /**
   * Close the modal and reset state
   */
  const closePlanExperienceModal = useCallback(() => {
    setIsModalOpen(false);
    setInitialStep(1);
    setPrefilledData(null);
  }, []);

  const value = {
    isModalOpen,
    initialStep,
    prefilledData,
    openPlanExperienceModal,
    closePlanExperienceModal,
  };

  return (
    <PlanExperienceContext.Provider value={value}>
      {children}
    </PlanExperienceContext.Provider>
  );
}

/**
 * Hook to access the Plan Experience modal controls
 * @returns {Object} Modal state and control functions
 */
export function usePlanExperience() {
  const context = useContext(PlanExperienceContext);
  if (!context) {
    throw new Error('usePlanExperience must be used within a PlanExperienceProvider');
  }
  return context;
}

export default PlanExperienceContext;

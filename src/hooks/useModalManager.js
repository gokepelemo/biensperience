import { useState, useCallback } from 'react';

/**
 * Consolidated modal state manager for complex views with multiple modals.
 * 
 * Ensures only one modal is active at a time and provides a clean API
 * for opening/closing modals without managing individual useState calls.
 * 
 * @returns {Object} Modal manager API
 * @property {string|null} activeModal - Currently active modal name
 * @property {Function} openModal - Open a modal by name
 * @property {Function} closeModal - Close the active modal
 * @property {Function} isModalOpen - Check if a specific modal is open
 */
export function useModalManager() {
  const [activeModal, setActiveModal] = useState(null);

  /**
   * Open a modal. Automatically closes any other open modal.
   * @param {string} modalName - Name of the modal to open
   */
  const openModal = useCallback((modalName) => {
    if (!modalName) {
      console.warn('[useModalManager] openModal called with invalid modal name:', modalName);
      return;
    }
    setActiveModal(modalName);
  }, []);

  /**
   * Close the currently active modal.
   */
  const closeModal = useCallback(() => {
    setActiveModal(null);
  }, []);

  /**
   * Check if a specific modal is currently open.
   * @param {string} modalName - Name of the modal to check
   * @returns {boolean} True if the modal is open
   */
  const isModalOpen = useCallback((modalName) => {
    return activeModal === modalName;
  }, [activeModal]);

  return {
    activeModal,
    openModal,
    closeModal,
    isModalOpen
  };
}

/**
 * Modal names used in SingleExperience component.
 * Exported as constants for type safety and autocomplete.
 */
export const MODAL_NAMES = {
  DELETE_EXPERIENCE: 'deleteExperience',
  REMOVE_PLAN: 'removePlan',
  DELETE_PLAN_ITEM: 'deletePlanItem',
  DELETE_PLAN_INSTANCE_ITEM: 'deletePlanInstanceItem',
  ADD_EDIT_PLAN_ITEM: 'addEditPlanItem',
  PLAN_ITEM_DETAILS: 'planItemDetails',
  INLINE_COST_ENTRY: 'inlineCostEntry',
  PHOTO_VIEWER: 'photoViewer',
  PHOTO_UPLOAD: 'photoUpload',
  DATE_PICKER: 'datePicker'
};

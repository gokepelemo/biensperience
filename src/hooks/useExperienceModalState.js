/**
 * useExperienceModalState Hook
 *
 * Bundles modal-data state for the SingleExperience view (everything that's
 * data attached to a modal, not modal visibility itself):
 *   - planItemToDelete / planInstanceItemToDelete
 *   - editingPlanItem (+ formState, +ref)
 *   - selectedDetailsItem (+ initialTab)
 *   - inlineCostPlanItem (+ loading)
 *   - photoViewerIndex
 *   - requestAccessPlanId / accessDeniedPlanId / accessRequestSent
 *   - incompleteChildrenDialogData
 *
 * Returns the state setters/values + modal wrapper callbacks.
 *
 * Extracted from SingleExperience.jsx — pure relocation.
 *
 * @module hooks/useExperienceModalState
 */

import { useCallback, useRef, useState } from 'react';
import { useModalManager, MODAL_NAMES } from './useModalManager';

export default function useExperienceModalState() {
  const modalManager = useModalManager();
  const { openModal, closeModal, isModalOpen, activeModal } = modalManager;

  // Modal data state
  const [planItemToDelete, setPlanItemToDelete] = useState(null);
  const [planInstanceItemToDelete, setPlanInstanceItemToDelete] = useState(null);
  const [planItemFormState, setPlanItemFormState] = useState(1); // 1 = add, 0 = edit
  const [editingPlanItem, setEditingPlanItem] = useState({});
  const [selectedDetailsItem, setSelectedDetailsItem] = useState(null);
  const [detailsModalInitialTab, setDetailsModalInitialTab] = useState('notes');
  const [inlineCostPlanItem, setInlineCostPlanItem] = useState(null);
  const [inlineCostLoading, setInlineCostLoading] = useState(false);
  const [photoViewerIndex, setPhotoViewerIndex] = useState(0);
  const [requestAccessPlanId, setRequestAccessPlanId] = useState(null);
  const [accessDeniedPlanId, setAccessDeniedPlanId] = useState(null);
  const [accessRequestSent, setAccessRequestSent] = useState(false);
  const [incompleteChildrenDialogData, setIncompleteChildrenDialogData] = useState(null);

  // Ref for editingPlanItem to avoid stale closures in callbacks
  const editingPlanItemRef = useRef(editingPlanItem);
  editingPlanItemRef.current = editingPlanItem;

  // Modal wrapper callbacks
  const setShowDatePickerState = useCallback(
    (nextShow) => {
      if (nextShow) {
        openModal(MODAL_NAMES.DATE_PICKER);
      } else {
        closeModal();
      }
    },
    [openModal, closeModal]
  );
  const handleOpenPlanDeleteModal = useCallback(
    () => openModal(MODAL_NAMES.DELETE_PLAN_ITEM),
    [openModal]
  );
  const handleOpenPlanInstanceDeleteModal = useCallback(
    () => openModal(MODAL_NAMES.DELETE_PLAN_INSTANCE_ITEM),
    [openModal]
  );
  const handleOpenDeleteExperienceModal = useCallback(
    () => openModal(MODAL_NAMES.DELETE_EXPERIENCE),
    [openModal]
  );

  return {
    // Modal manager passthrough
    activeModal,
    openModal,
    closeModal,
    isModalOpen,
    // Modal data state
    planItemToDelete,
    setPlanItemToDelete,
    planInstanceItemToDelete,
    setPlanInstanceItemToDelete,
    planItemFormState,
    setPlanItemFormState,
    editingPlanItem,
    setEditingPlanItem,
    editingPlanItemRef,
    selectedDetailsItem,
    setSelectedDetailsItem,
    detailsModalInitialTab,
    setDetailsModalInitialTab,
    inlineCostPlanItem,
    setInlineCostPlanItem,
    inlineCostLoading,
    setInlineCostLoading,
    photoViewerIndex,
    setPhotoViewerIndex,
    requestAccessPlanId,
    setRequestAccessPlanId,
    accessDeniedPlanId,
    setAccessDeniedPlanId,
    accessRequestSent,
    setAccessRequestSent,
    incompleteChildrenDialogData,
    setIncompleteChildrenDialogData,
    // Modal wrapper callbacks
    setShowDatePickerState,
    handleOpenPlanDeleteModal,
    handleOpenPlanInstanceDeleteModal,
    handleOpenDeleteExperienceModal,
  };
}

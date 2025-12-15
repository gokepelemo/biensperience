/**
 * usePlanItemNotes Hook
 *
 * Consolidates note CRUD operations for plan items, reducing repeated logic
 * and dependency arrays in SingleExperience.jsx.
 *
 * @module hooks/usePlanItemNotes
 */

import { useCallback, useRef } from 'react';
import { lang } from '../lang.constants';
import { logger } from '../utilities/logger';
import { idEquals } from '../utilities/id-utils';
import {
  addPlanItemNote,
  updatePlanItemNote,
  deletePlanItemNote
} from '../utilities/plans-api';

/**
 * Hook for managing plan item notes
 *
 * @param {Object} options - Hook configuration
 * @param {string} options.selectedPlanId - Currently selected plan ID
 * @param {Object} options.selectedDetailsItem - Currently selected plan item
 * @param {Function} options.setSelectedDetailsItem - Setter for selected item
 * @param {Function} options.setSharedPlans - Setter for shared plans state
 * @param {Function} options.success - Toast success function
 * @param {Function} options.showError - Toast error function
 *
 * @returns {Object} Note CRUD handlers
 */
export function usePlanItemNotes({
  selectedPlanId,
  selectedDetailsItem,
  setSelectedDetailsItem,
  setSharedPlans,
  success,
  showError
}) {
  // Use refs for values that change frequently but don't need to trigger re-renders
  // of the callbacks themselves
  const selectedPlanIdRef = useRef(selectedPlanId);
  const selectedDetailsItemRef = useRef(selectedDetailsItem);

  // Keep refs in sync
  selectedPlanIdRef.current = selectedPlanId;
  selectedDetailsItemRef.current = selectedDetailsItem;

  /**
   * Helper to update plan state after a note operation
   * @param {Object} updatedPlan - Updated plan from API
   */
  const updatePlanState = useCallback((updatedPlan) => {
    const planId = selectedPlanIdRef.current;
    const selectedItem = selectedDetailsItemRef.current;

    // Update collaborative plans
    setSharedPlans(prevPlans =>
      prevPlans.map(p => idEquals(p._id, planId) ? updatedPlan : p)
    );

    // Update selected item if it was affected
    if (selectedItem?._id) {
      const updatedItem = updatedPlan.plan.find(item => idEquals(item._id, selectedItem._id));
      if (updatedItem) {
        setSelectedDetailsItem(updatedItem);
      }
    }
  }, [setSharedPlans, setSelectedDetailsItem]);

  /**
   * Add a note to the selected plan item
   * @param {string} content - Note content
   */
  const handleAddNote = useCallback(async (content) => {
    const planId = selectedPlanIdRef.current;
    const selectedItem = selectedDetailsItemRef.current;

    if (!planId || !selectedItem?._id || !content.trim()) return;

    try {
      const updatedPlan = await addPlanItemNote(planId, selectedItem._id, content);
      updatePlanState(updatedPlan);
      success(lang.current.notification?.note?.added || 'Your note has been added and is visible to collaborators');
    } catch (error) {
      logger.error('[usePlanItemNotes] Failed to add note', { error: error.message });
      showError(error.message || 'Failed to add note');
    }
  }, [updatePlanState, success, showError]);

  /**
   * Update an existing note
   * @param {string} noteId - Note ID to update
   * @param {string} content - Updated content
   */
  const handleUpdateNote = useCallback(async (noteId, content) => {
    const planId = selectedPlanIdRef.current;
    const selectedItem = selectedDetailsItemRef.current;

    if (!planId || !selectedItem?._id || !noteId || !content.trim()) return;

    try {
      const updatedPlan = await updatePlanItemNote(planId, selectedItem._id, noteId, content);
      updatePlanState(updatedPlan);
      success(lang.current.notification?.note?.updated || 'Note updated. All collaborators can see your changes.');
    } catch (error) {
      logger.error('[usePlanItemNotes] Failed to update note', { error: error.message });
      showError(error.message || 'Failed to update note');
    }
  }, [updatePlanState, success, showError]);

  /**
   * Delete a note
   * @param {string} noteId - Note ID to delete
   */
  const handleDeleteNote = useCallback(async (noteId) => {
    const planId = selectedPlanIdRef.current;
    const selectedItem = selectedDetailsItemRef.current;

    if (!planId || !selectedItem?._id || !noteId) return;

    try {
      const updatedPlan = await deletePlanItemNote(planId, selectedItem._id, noteId);
      updatePlanState(updatedPlan);
      success(lang.current.notification?.note?.deleted || 'Note deleted');
    } catch (error) {
      logger.error('[usePlanItemNotes] Failed to delete note', { error: error.message });
      showError(error.message || 'Failed to delete note');
    }
  }, [updatePlanState, success, showError]);

  return {
    handleAddNote,
    handleUpdateNote,
    handleDeleteNote
  };
}

export default usePlanItemNotes;

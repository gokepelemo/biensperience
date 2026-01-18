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
import { broadcastEvent } from '../utilities/event-bus';
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

    // Create optimistic note with temporary ID
    const optimisticNote = {
      _id: `optimistic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content: content.trim(),
      created_by: {
        _id: selectedItem.created_by?._id || 'unknown',
        name: selectedItem.created_by?.name || 'Unknown User'
      },
      created_at: new Date().toISOString(),
      visibility: 'contributors', // Default visibility
      _optimistic: true // Flag to identify optimistic updates
    };

    // Optimistic update: immediately add note to local state
    const optimisticItem = {
      ...selectedItem,
      details: {
        ...selectedItem.details,
        notes: [...(selectedItem.details?.notes || []), optimisticNote]
      }
    };
    setSelectedDetailsItem(optimisticItem);

    // Update collaborative plans with optimistic note
    setSharedPlans(prevPlans =>
      prevPlans.map(p => idEquals(p._id, planId) ? {
        ...p,
        plan: p.plan.map(item =>
          idEquals(item._id, selectedItem._id) ? optimisticItem : item
        )
      } : p)
    );

    try {
      const updatedPlan = await addPlanItemNote(planId, selectedItem._id, content);
      updatePlanState(updatedPlan);
      success(lang.current.notification?.note?.added || 'Your note has been added and is visible to collaborators');

      // Publish event for cross-tab synchronization
      try {
        broadcastEvent('plan:item:note:added', {
          planId,
          itemId: selectedItem._id,
          note: optimisticNote,
          version: Date.now()
        });
      } catch (eventError) {
        logger.warn('[usePlanItemNotes] Failed to broadcast note added event', { eventError: eventError.message });
      }
    } catch (error) {
      logger.error('[usePlanItemNotes] Failed to add note', { error: error.message });

      // Revert optimistic update on failure
      setSelectedDetailsItem(selectedItem);
      setSharedPlans(prevPlans =>
        prevPlans.map(p => idEquals(p._id, planId) ? {
          ...p,
          plan: p.plan.map(item =>
            idEquals(item._id, selectedItem._id) ? selectedItem : item
          )
        } : p)
      );

      showError(error.message || 'Failed to add note');
    }
  }, [updatePlanState, success, showError, setSelectedDetailsItem, setSharedPlans]);

  /**
   * Update an existing note
   * @param {string} noteId - Note ID to update
   * @param {string} content - Updated content
   */
  const handleUpdateNote = useCallback(async (noteId, content) => {
    const planId = selectedPlanIdRef.current;
    const selectedItem = selectedDetailsItemRef.current;

    if (!planId || !selectedItem?._id || !noteId || !content.trim()) return;

    // Store original note for potential rollback
    const originalNotes = selectedItem.details?.notes || [];
    const originalNote = originalNotes.find(note => idEquals(note._id, noteId));

    if (!originalNote) return;

    // Optimistic update: immediately update note content
    const optimisticNotes = originalNotes.map(note =>
      idEquals(note._id, noteId)
        ? { ...note, content: content.trim(), _optimistic: true }
        : note
    );

    const optimisticItem = {
      ...selectedItem,
      details: {
        ...selectedItem.details,
        notes: optimisticNotes
      }
    };
    setSelectedDetailsItem(optimisticItem);

    // Update collaborative plans with optimistic update
    setSharedPlans(prevPlans =>
      prevPlans.map(p => idEquals(p._id, planId) ? {
        ...p,
        plan: p.plan.map(item =>
          idEquals(item._id, selectedItem._id) ? optimisticItem : item
        )
      } : p)
    );

    try {
      const updatedPlan = await updatePlanItemNote(planId, selectedItem._id, noteId, content);
      updatePlanState(updatedPlan);
      success(lang.current.notification?.note?.updated || 'Note updated. All collaborators can see your changes.');

      // Publish event for cross-tab synchronization
      try {
        broadcastEvent('plan:item:note:updated', {
          planId,
          itemId: selectedItem._id,
          noteId,
          content: content.trim(),
          version: Date.now()
        });
      } catch (eventError) {
        logger.warn('[usePlanItemNotes] Failed to broadcast note updated event', { eventError: eventError.message });
      }
    } catch (error) {
      logger.error('[usePlanItemNotes] Failed to update note', { error: error.message });

      // Revert optimistic update on failure
      setSelectedDetailsItem(selectedItem);
      setSharedPlans(prevPlans =>
        prevPlans.map(p => idEquals(p._id, planId) ? {
          ...p,
          plan: p.plan.map(item =>
            idEquals(item._id, selectedItem._id) ? selectedItem : item
          )
        } : p)
      );

      showError(error.message || 'Failed to update note');
    }
  }, [updatePlanState, success, showError, setSelectedDetailsItem, setSharedPlans]);

  /**
   * Delete a note
   * @param {string} noteId - Note ID to delete
   */
  const handleDeleteNote = useCallback(async (noteId) => {
    const planId = selectedPlanIdRef.current;
    const selectedItem = selectedDetailsItemRef.current;

    if (!planId || !selectedItem?._id || !noteId) return;

    // Store original notes for potential rollback
    const originalNotes = selectedItem.details?.notes || [];
    const noteToDelete = originalNotes.find(note => idEquals(note._id, noteId));

    if (!noteToDelete) return;

    // Optimistic update: immediately remove note from local state
    const optimisticNotes = originalNotes.filter(note => !idEquals(note._id, noteId));
    const optimisticItem = {
      ...selectedItem,
      details: {
        ...selectedItem.details,
        notes: optimisticNotes
      }
    };
    setSelectedDetailsItem(optimisticItem);

    // Update collaborative plans with optimistic deletion
    setSharedPlans(prevPlans =>
      prevPlans.map(p => idEquals(p._id, planId) ? {
        ...p,
        plan: p.plan.map(item =>
          idEquals(item._id, selectedItem._id) ? optimisticItem : item
        )
      } : p)
    );

    try {
      const updatedPlan = await deletePlanItemNote(planId, selectedItem._id, noteId);
      updatePlanState(updatedPlan);
      success(lang.current.notification?.note?.deleted || 'Note deleted');

      // Publish event for cross-tab synchronization
      try {
        broadcastEvent('plan:item:note:deleted', {
          planId,
          itemId: selectedItem._id,
          noteId,
          version: Date.now()
        });
      } catch (eventError) {
        logger.warn('[usePlanItemNotes] Failed to broadcast note deleted event', { eventError: eventError.message });
      }
    } catch (error) {
      logger.error('[usePlanItemNotes] Failed to delete note', { error: error.message });

      // Revert optimistic update on failure
      setSelectedDetailsItem(selectedItem);
      setSharedPlans(prevPlans =>
        prevPlans.map(p => idEquals(p._id, planId) ? {
          ...p,
          plan: p.plan.map(item =>
            idEquals(item._id, selectedItem._id) ? selectedItem : item
          )
        } : p)
      );

      showError(error.message || 'Failed to delete note');
    }
  }, [updatePlanState, success, showError, setSelectedDetailsItem, setSharedPlans]);

  return {
    handleAddNote,
    handleUpdateNote,
    handleDeleteNote
  };
}

export default usePlanItemNotes;

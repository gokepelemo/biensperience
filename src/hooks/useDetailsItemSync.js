/**
 * useDetailsItemSync Hook
 *
 * Keeps the open Plan Item Details modal in sync with the latest plan data.
 * Specifically prevents "Unknown User" flashes by preserving populated `note.user`
 * data when the source-of-truth plan temporarily reverts to unpopulated user IDs.
 *
 * Extracted from SingleExperience.jsx — pure relocation of existing behavior.
 *
 * @module hooks/useDetailsItemSync
 */

import { useEffect } from 'react';
import debug from '../utilities/debug';
import { idEquals, normalizeId } from '../utilities/id-utils';

export default function useDetailsItemSync({
  isModalOpen,
  MODAL_NAMES,
  selectedDetailsItem,
  setSelectedDetailsItem,
  selectedPlanId,
  allAccessiblePlans,
  userPlan,
}) {
  useEffect(() => {
    if (!isModalOpen(MODAL_NAMES.PLAN_ITEM_DETAILS) || !selectedDetailsItem?._id) return;

    const currentPlanData = selectedPlanId
      ? allAccessiblePlans.find((p) => idEquals(p._id, selectedPlanId))
      : userPlan;

    if (!currentPlanData?.plan) return;

    const updatedItem = currentPlanData.plan.find(item => idEquals(item._id, selectedDetailsItem._id));

    if (!updatedItem) return;

    const sourceHasPopulatedNotes = updatedItem.details?.notes?.some(
      note => note.user && typeof note.user === 'object' && note.user.name
    );
    const currentHasPopulatedNotes = selectedDetailsItem.details?.notes?.some(
      note => note.user && typeof note.user === 'object' && note.user.name
    );
    const currentHasUnpopulatedNotes = selectedDetailsItem.details?.notes?.some(
      note => note.user && (typeof note.user === 'string' || !note.user.name)
    );

    // Case 1: Source has populated data, current doesn't - sync from source
    if (sourceHasPopulatedNotes && currentHasUnpopulatedNotes) {
      debug.log('[SingleExperience] Syncing selectedDetailsItem with populated data from source', {
        itemId: selectedDetailsItem._id,
        currentHadUnpopulated: currentHasUnpopulatedNotes,
      });
      setSelectedDetailsItem(updatedItem);
      return;
    }

    // Case 2: Current has populated data but source doesn't - preserve populated user data
    if (currentHasPopulatedNotes && !sourceHasPopulatedNotes && updatedItem.details?.notes?.length > 0) {
      const populatedUserMap = {};
      selectedDetailsItem.details?.notes?.forEach(note => {
        if (note.user && typeof note.user === 'object' && note.user.name) {
          const noteId = normalizeId(note._id);
          populatedUserMap[noteId] = note.user;
        }
      });

      if (Object.keys(populatedUserMap).length > 0) {
        debug.log('[SingleExperience] Preserving populated user data in notes', {
          itemId: selectedDetailsItem._id,
          preservedUserCount: Object.keys(populatedUserMap).length,
        });

        const mergedNotes = updatedItem.details.notes.map(note => {
          const noteId = normalizeId(note._id);
          const preservedUser = populatedUserMap[noteId];
          if (preservedUser && (!note.user?.name)) {
            return { ...note, user: preservedUser };
          }
          return note;
        });

        setSelectedDetailsItem({
          ...updatedItem,
          details: {
            ...updatedItem.details,
            notes: mergedNotes,
          },
        });
        return;
      }
    }

    // Case 3: Note count changed (add/delete) - sync, preserving populated users
    const sourceNoteCount = updatedItem.details?.notes?.length || 0;
    const currentNoteCount = selectedDetailsItem.details?.notes?.length || 0;
    if (sourceNoteCount !== currentNoteCount) {
      const populatedUserMap = {};
      selectedDetailsItem.details?.notes?.forEach(note => {
        if (note.user && typeof note.user === 'object' && note.user.name) {
          const noteId = normalizeId(note._id);
          populatedUserMap[noteId] = note.user;
        }
      });

      const mergedNotes = updatedItem.details?.notes?.map(note => {
        const noteId = normalizeId(note._id);
        const preservedUser = populatedUserMap[noteId];
        if (preservedUser && (!note.user?.name)) {
          return { ...note, user: preservedUser };
        }
        return note;
      }) || [];

      setSelectedDetailsItem({
        ...updatedItem,
        details: {
          ...updatedItem.details,
          notes: mergedNotes,
        },
      });
    }
  }, [isModalOpen, selectedDetailsItem?._id, selectedPlanId, allAccessiblePlans, userPlan, MODAL_NAMES, setSelectedDetailsItem, selectedDetailsItem]);
}

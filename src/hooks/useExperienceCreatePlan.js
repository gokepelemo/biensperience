/**
 * useExperienceCreatePlan Hook
 *
 * Encapsulates the SingleExperience "Add to my plan" / replan flow:
 *   - Cancels a pending unplan (within the undo window) and restores the plan
 *   - Otherwise calls createPlan() and navigates to the new plan
 *   - Surfaces a BienBot upsell toast for ai_features users
 *
 * Extracted from SingleExperience.jsx — pure relocation of existing behavior.
 *
 * @module hooks/useExperienceCreatePlan
 */

import { useCallback } from 'react';
import { lang } from '../lang.constants';
import debug from '../utilities/debug';
import { logger } from '../utilities/logger';
import { handleError } from '../utilities/error-handler';
import { hasFeatureFlag } from '../utilities/feature-flags';
import { openWithPrefilledMessage } from './useBienBot';

export default function useExperienceCreatePlan({
  user,
  experience,
  plannedDate,
  setPlannedDate,
  userHasExperience,
  pendingUnplanRef,
  createPlan,
  updatePlan,
  setSelectedPlanId,
  setActiveTab,
  setIsEditingDate,
  closeModal,
  navigate,
  success,
  showError,
}) {
  return useCallback(
    async (data = null) => {
      const addData =
        data !== null ? data : plannedDate ? { planned_date: plannedDate } : {};

      try {
        debug.log('[HANDLE_ADD] Starting handleAddExperience', {
          timestamp: Date.now(),
          currentUserHasExperience: userHasExperience,
          plannedDate: addData.planned_date,
        });

        // If there's a pending unplan (undo window active), cancel the deferred
        // delete and restore the plan instead of trying to create a new one.
        if (pendingUnplanRef.current) {
          debug.log('[HANDLE_ADD] Pending unplan detected — cancelling delete and restoring plan');
          const { prevPlan, undo } = pendingUnplanRef.current;
          pendingUnplanRef.current = null;
          await undo();

          closeModal();
          setIsEditingDate(false);
          setPlannedDate('');

          const newDate = addData.planned_date || null;
          const oldDate = prevPlan.planned_date || null;
          if (newDate && newDate !== oldDate) {
            try {
              await updatePlan(prevPlan._id, { planned_date: newDate });
            } catch (updateErr) {
              debug.log('[HANDLE_ADD] Date update after replan failed', { error: updateErr?.message });
            }
          }

          setSelectedPlanId(prevPlan._id);
          setActiveTab('myplan');
          navigate(`/experiences/${experience._id}#plan-${prevPlan._id}`, { replace: true });
          return;
        }

        closeModal();
        setIsEditingDate(false);
        setPlannedDate('');

        try {
          debug.log('[HANDLE_ADD] Calling createPlan from hook', {
            timestamp: Date.now(),
            experienceId: experience._id,
            plannedDate: addData.planned_date,
          });

          const newPlan = await createPlan(addData.planned_date || null);

          debug.log('[HANDLE_ADD] Plan created successfully', {
            timestamp: Date.now(),
            planId: newPlan?._id,
            experienceId: experience._id,
          });

          logger?.info?.('Plan created', {
            planId: newPlan?._id,
            experienceId: experience._id,
          });

          try {
            if (hasFeatureFlag(user, 'ai_features') && experience?.name) {
              const destName = experience?.destination?.name || null;
              const toastMsg = destName
                ? `Make it yours! BienBot can suggest plan items people add for ${destName}`
                : `Make it yours! BienBot can help you personalize your ${experience.name} plan`;
              const prefilledMsg = `What should I add to my plan for ${experience.name}?`;
              success(toastMsg, {
                duration: 8000,
                actions: [
                  {
                    label: 'Ask BienBot',
                    onClick: () => openWithPrefilledMessage(prefilledMsg),
                  },
                ],
              });
            } else {
              success(lang.current.notification?.plan?.created || "You're planning this experience!");
            }
          } catch (e) {
            // ignore toast failures
          }

          if (newPlan?._id) {
            setSelectedPlanId(newPlan._id);
            setActiveTab('myplan');
            navigate(`/experiences/${experience._id}#plan-${newPlan._id}`, { replace: true });
          } else {
            setActiveTab('myplan');
          }
        } catch (planErr) {
          logger?.error?.(
            'Error creating plan',
            {
              experienceId: experience._id,
              error: planErr?.message,
            },
            planErr
          );

          const errorMsg = handleError(planErr, { context: 'Create plan' }) || 'Failed to create plan';
          showError(errorMsg);
          return;
        }
      } catch (err) {
        handleError(err, { context: 'Add experience' });
      }
    },
    [
      experience?._id,
      experience?.name,
      experience?.destination?.name,
      plannedDate,
      userHasExperience,
      user,
      pendingUnplanRef,
      createPlan,
      updatePlan,
      success,
      showError,
      navigate,
      closeModal,
      setIsEditingDate,
      setPlannedDate,
      setSelectedPlanId,
      setActiveTab,
    ]
  );
}

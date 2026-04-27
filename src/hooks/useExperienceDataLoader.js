/**
 * useExperienceDataLoader Hook
 *
 * Encapsulates the SingleExperience view's data loading lifecycle:
 *   - fetchAllData() — combined experience + user plan + shared plans fetch
 *   - DataContext sync (apply ctxExperiences updates while preserving locally-
 *     populated photos/destination references)
 *
 * Extracted from SingleExperience.jsx — pure relocation of existing behavior.
 *
 * @module hooks/useExperienceDataLoader
 */

import { useCallback, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import debug from '../utilities/debug';
import { idEquals, normalizeId } from '../utilities/id-utils';
import { showExperienceWithContext } from '../utilities/experiences-api';

export default function useExperienceDataLoader({
  experienceId,
  user,
  ctxExperiences,
  experience,
  setExperience,
  setTravelTips,
  setUserPlan,
  setUserHasExperience,
  setUserPlannedDate,
  setSharedPlans,
  setPlansLoading,
  setExperienceNotFound,
  updateExperienceInContext,
  normalizePlan,
}) {
  // Ref for latest experience to avoid stale closures in effects
  const experienceRef = useRef(null);
  useEffect(() => {
    experienceRef.current = experience;
  }, [experience]);

  // Combined data fetcher
  const fetchAllData = useCallback(async () => {
    try {
      const {
        experience: experienceData,
        userPlan: fetchedUserPlan,
        sharedPlans: fetchedSharedPlans,
      } = await showExperienceWithContext(experienceId);

      debug.log('Experience data:', experienceData);
      debug.log('User plan:', fetchedUserPlan);
      debug.log('Shared plans:', fetchedSharedPlans);

      if (!experienceData) {
        throw new Error('Experience not found');
      }

      setExperience(experienceData);
      setTravelTips(experienceData.travel_tips || []);

      if (experienceData && experienceData._id) {
        updateExperienceInContext(experienceData);
      }

      const isOwnPlan = (plan) => {
        const planUserId = plan?.user?._id || plan?.user;
        return !!planUserId && idEquals(planUserId, user._id);
      };

      const derivedUserPlan = fetchedUserPlan || fetchedSharedPlans?.find(isOwnPlan) || null;

      setUserPlan(derivedUserPlan || null);
      setUserHasExperience(!!derivedUserPlan);
      setUserPlannedDate(derivedUserPlan?.planned_date || null);

      const accessibleSharedPlans = (fetchedSharedPlans || []).filter((plan) => {
        if (isOwnPlan(plan)) return false;

        return plan.permissions?.some(
          (p) =>
            p.entity === 'user' &&
            idEquals(p._id, user._id) &&
            (p.type === 'owner' || p.type === 'collaborator')
        );
      });

      debug.log('Accessible shared plans after filtering:', accessibleSharedPlans);

      const normalizedSorted = accessibleSharedPlans.map((p) => normalizePlan(p));

      debug.log('Plans loaded. Auto-select or hash handler will set selectedPlanId.');

      flushSync(() => {
        setSharedPlans(normalizedSorted);
        setPlansLoading(false);
      });
    } catch (err) {
      debug.error('Error fetching all data:', err);

      if (err.response?.status === 404) {
        setExperienceNotFound(true);
        setExperience(null);
        setUserPlan(null);
        setSharedPlans([]);
        setPlansLoading(false);
        return;
      }

      setExperience(null);
      setUserPlan(null);
      setSharedPlans([]);
      setPlansLoading(false);
    }
  }, [
    experienceId,
    user._id,
    updateExperienceInContext,
    normalizePlan,
    setExperience,
    setTravelTips,
    setUserPlan,
    setUserHasExperience,
    setUserPlannedDate,
    setSharedPlans,
    setPlansLoading,
    setExperienceNotFound,
  ]);

  // DataContext sync: apply ctxExperiences updates while preserving locally-populated
  // photos/destination references (avoid losing populated objects to ID-only updates).
  useEffect(() => {
    try {
      if (!ctxExperiences || !ctxExperiences.length) return;
      const updated = ctxExperiences.find((e) => idEquals(e._id, experienceId));
      if (!updated) return;

      const prev = experienceRef.current;

      const getExperienceSignature = (exp) => {
        if (!exp) return '';

        const id = normalizeId(exp?._id);
        const updatedAt = exp?.updatedAt || exp?.updated_at;
        const updatedAtKey = updatedAt ? new Date(updatedAt).toISOString() : '';

        const planItemsCount = Array.isArray(exp?.plan_items) ? exp.plan_items.length : 0;
        const travelTipsCount = Array.isArray(exp?.travel_tips) ? exp.travel_tips.length : 0;
        const photosCount = Array.isArray(exp?.photos) ? exp.photos.length : 0;
        const destinationId = normalizeId(exp?.destination?._id || exp?.destination);

        return `${id}|${updatedAtKey}|${planItemsCount}|${travelTipsCount}|${photosCount}|${destinationId}`;
      };

      const prevSig = getExperienceSignature(prev);
      const nextSig = getExperienceSignature(updated);
      if (prevSig && prevSig === nextSig) return;

      try {
        if (!prev || prevSig !== nextSig) {
          try {
            const previewPrev = {
              _id: prev?._id,
              plan_items_count: (prev?.plan_items || []).length,
              travel_tips_count: (prev?.travel_tips || []).length,
            };
            const previewNew = {
              _id: updated?._id,
              plan_items_count: (updated?.plan_items || []).length,
              travel_tips_count: (updated?.travel_tips || []).length,
            };
            debug.log('Applying context-driven experience update', { experienceId, previewPrev, previewNew });
          } catch (inner) {
            debug.log('Applying context-driven experience update (no preview available)', { experienceId });
          }

          try {
            const isPopulatedPhotoArray = (arr) =>
              Array.isArray(arr) &&
              arr.length > 0 &&
              typeof arr[0] === 'object' &&
              arr[0] !== null &&
              (arr[0].url || arr[0]?.photo?.url);

            const isEntrySchema = (arr) =>
              Array.isArray(arr) &&
              arr.length > 0 &&
              typeof arr[0] === 'object' &&
              'photo' in arr[0] &&
              'default' in arr[0];

            const isPopulatedDestination = (dest) =>
              dest && typeof dest === 'object' && dest.name;

            const merged = { ...(prev || {}), ...(updated || {}) };

            if (isPopulatedPhotoArray(prev?.photos) && !isPopulatedPhotoArray(updated?.photos)) {
              merged.photos = prev.photos;
              merged.photos_full = prev.photos_full || prev.photos;
            } else if (
              isEntrySchema(prev?.photos) &&
              !isEntrySchema(updated?.photos) &&
              isPopulatedPhotoArray(updated?.photos)
            ) {
              merged.photos = prev.photos;
              merged.photos_full = prev.photos_full || prev.photos;
            }

            if (isPopulatedDestination(prev?.destination) && !isPopulatedDestination(updated?.destination)) {
              merged.destination = prev.destination;
            }

            setExperience(merged);
            setTravelTips(merged.travel_tips || []);
          } catch (errMerge) {
            setExperience(updated);
            setTravelTips(updated.travel_tips || []);
          }
        }
      } catch (err) {
        setExperience(updated);
        setTravelTips(updated.travel_tips || []);
      }
    } catch (err) {
      debug.warn('Failed to apply context experience update', err);
    }
  }, [ctxExperiences, experienceId, setExperience, setTravelTips]);

  return { fetchAllData, experienceRef };
}

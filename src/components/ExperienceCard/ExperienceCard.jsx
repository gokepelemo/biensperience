import "./ExperienceCard.css";
import { Link } from "react-router-dom";
import { useState, useCallback, useMemo, memo, useEffect } from "react";
import { lang } from "../../lang.constants";
import ConfirmModal from "../ConfirmModal/ConfirmModal";
import { deleteExperience } from "../../utilities/experiences-api";
import { checkUserPlanForExperience, createPlan, deletePlan } from "../../utilities/plans-api";
import { handleError } from "../../utilities/error-handler";
import { isOwner } from "../../utilities/permissions";
import { logger } from "../../utilities/logger";
import { useUser } from "../../contexts/UserContext";

function ExperienceCard({ experience, updateData, userPlans = [] }) {
  const { user } = useUser();
  const rand = useMemo(() => Math.floor(Math.random() * 50), []);
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  // Initialize local plan state based on userPlans if available, or sessionStorage
  const [localPlanState, setLocalPlanState] = useState(() => {
    if (userPlans.length > 0) {
      return userPlans.some(plan => 
        plan.experience?._id === experience._id || 
        plan.experience === experience._id
      );
    }
    try {
      const cached = sessionStorage.getItem(`plan_${experience._id}`);
      return cached ? JSON.parse(cached) : null;
    } catch (err) {
      return null;
    }
  });

  // Custom setter that also updates sessionStorage
  const setLocalPlanStateWithCache = useCallback((value) => {
    setLocalPlanState(value);
    try {
      if (value !== null) {
        sessionStorage.setItem(`plan_${experience._id}`, JSON.stringify(value));
      } else {
        sessionStorage.removeItem(`plan_${experience._id}`);
      }
    } catch (err) {
      // Silently fail if sessionStorage is not available
    }
  }, [experience._id]);

  const userIsOwner = isOwner(user, experience);

  // Check if user has a plan for this experience
  // Use local state if available, otherwise check userPlans prop
  const experienceAdded = useMemo(() => {
    if (!experience?._id || !user?._id) return false;
    
    // If we have local state, use it
    if (localPlanState !== null) {
      return localPlanState;
    }
    
    // Otherwise check userPlans prop (fallback)
    return userPlans.some(plan => plan.experience?._id === experience._id || plan.experience === experience._id);
  }, [experience?._id, user?._id, userPlans, localPlanState]);

  // Sync localPlanState with userPlans when it changes
  useEffect(() => {
    if (userPlans.length > 0) {
      const hasPlan = userPlans.some(plan => 
        plan.experience?._id === experience._id || 
        plan.experience === experience._id
      );
      setLocalPlanStateWithCache(hasPlan);
    }
  }, [userPlans, experience._id, setLocalPlanStateWithCache]);

  // Fetch plan status when component mounts if userPlans is empty
  // OPTIMIZATION: Use lightweight checkUserPlanForExperience instead of getUserPlans
  useEffect(() => {
    // Only fetch if:
    // 1. We have a user and experience
    // 2. userPlans is empty (not passed from parent)
    // 3. localPlanState is null (not yet determined)
    if (!user?._id || !experience?._id || userPlans.length > 0 || localPlanState !== null) {
      return;
    }

    let isMounted = true;

    const checkPlanStatus = async () => {
      try {
        // OPTIMIZATION: Use lightweight endpoint - only returns plan ID, not full data
        const result = await checkUserPlanForExperience(experience._id);
        if (isMounted) {
          setLocalPlanStateWithCache(result.hasPlan);
        }
      } catch (err) {
        // Silently fail - button will default to "add" state
        logger.warn('Failed to check plan status', {
          experienceId: experience._id,
          error: err.message
        }, err);
        if (isMounted) {
          setLocalPlanStateWithCache(false);
        }
      }
    };

    checkPlanStatus();

    return () => {
      isMounted = false;
    };
  }, [user?._id, experience?._id, userPlans.length, localPlanState, setLocalPlanStateWithCache]);

  // Get the default photo for background
  const getBackgroundImage = useMemo(() => {
    if (!experience) {
      return `url(https://picsum.photos/400?rand=${rand})`;
    }
    
    // If photos array exists and has items, use the default one
    if (experience.photos && experience.photos.length > 0) {
      const index = experience.default_photo_index || 0;
      return `url(${experience.photos[index].url})`;
    }
    
    // Fallback to placeholder
    return `url(https://picsum.photos/400?rand=${rand})`;
  }, [experience, rand]);

  const handleExperienceAction = useCallback(async () => {
    if (isLoading) return;
    
    const isRemoving = experienceAdded;
    
    // OPTIMISTIC UI UPDATE: Update state immediately for instant feedback
    setLocalPlanStateWithCache(!isRemoving);
    setIsLoading(true);

    try {
      if (isRemoving) {
        // OPTIMIZATION 1: Use stored plan ID if available in local state
        // This avoids the expensive getUserPlans() call
        let userPlan = userPlans.find(plan => 
          plan.experience?._id === experience._id || 
          plan.experience === experience._id
        );
        
        // OPTIMIZATION 2: Lightweight plan lookup - only fetch plan ID
        if (!userPlan) {
          // Use the new lightweight endpoint instead of getUserPlans()
          const result = await checkUserPlanForExperience(experience._id);
          if (result.hasPlan) {
            userPlan = { _id: result.planId };
          }
        }
        
        if (userPlan) {
          // OPTIMIZATION 3: Fire-and-forget deletion
          // Don't await - let it complete in background
          deletePlan(userPlan._id).catch(err => {
            logger.error('Failed to delete plan', { planId: userPlan._id, error: err.message });
            // Revert UI on failure
            setLocalPlanState(true);
            handleError(err, { context: 'Remove plan' });
          });
        } else {
          throw new Error('Plan not found');
        }
      } else {
        // CREATE PLAN: Keep await since we need the result
        await createPlan(experience._id, null);
      }

      // OPTIMIZATION 4: Skip expensive updateData() call
      // The optimistic update already changed the UI
      // Parent views can refetch on their own schedule (e.g., on route change)
      // If updateData is critical, call it but don't await
      if (updateData && !isRemoving) {
        // Only refresh on create (when we might need new plan data)
        // Don't refresh on delete (we already updated UI optimistically)
        updateData().catch(err => {
          logger.warn('Failed to refresh data after plan creation', { error: err.message });
        });
      }
    } catch (err) {
      handleError(err, { context: isRemoving ? 'Remove plan' : 'Create plan' });
      
      // Special handling for "Plan already exists" error (409 Conflict)
      if (!isRemoving && err.message && (err.message.includes('Plan already exists') || err.message.includes('409'))) {
        // The database has a plan but our local state doesn't reflect it
        // Update local state to show plan exists
        setLocalPlanStateWithCache(true);
        return; // Don't revert the state since we just corrected it
      }
      
      // REVERT on error: Restore previous state
      setLocalPlanStateWithCache(isRemoving);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, experienceAdded, experience._id, updateData, userPlans, setLocalPlanStateWithCache]);

  const handleDelete = useCallback(async () => {
    try {
      await deleteExperience(experience._id);
      setShowDeleteModal(false);
      updateData();
    } catch (err) {
      handleError(err, { context: 'Delete experience' });
    }
  }, [experience._id, updateData]);
  return (
    <div className="d-inline-block m-2" style={{ width: 'fit-content', verticalAlign: 'top' }}>
      {experience ? (
        <div
          className="experienceCard d-flex flex-column align-items-center justify-content-between p-3 position-relative overflow-hidden"
          style={{ backgroundImage: getBackgroundImage }}
        >
          <Link to={`/experiences/${experience._id}`} className="experience-card-link flex-grow-1 d-flex align-items-center justify-content-center w-100 text-decoration-none">
            <span className="h4 fw-bold experience-card-title d-flex align-items-center justify-content-center text-white text-center p-3 w-100">
              {experience.name}
            </span>
          </Link>
          <div className="experience-card-actions d-flex gap-2 flex-shrink-0">
            <button
              className={`btn btn-icon ${experienceAdded ? 'btn-card-remove' : 'btn-card-add'} ${isLoading ? 'loading' : ''}`}
              type="button"
              onClick={handleExperienceAction}
              disabled={isLoading}
              aria-label={experienceAdded ? lang.en.button.removeFromPlan : lang.en.button.addToPlan}
              title={experienceAdded ? lang.en.button.removeFromPlan : lang.en.button.addToPlan}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              {experienceAdded ? (isHovered ? "-" : "✅") : "✚"}
            </button>
            {userIsOwner && (
              <>
                <Link
                  to={`/experiences/${experience._id}/update`}
                  className="btn btn-light btn-icon ms-2"
                  aria-label={lang.en.button.updateExperience}
                  title={lang.en.button.updateExperience}
                >
                  ✏️
                </Link>
                <button
                  className="btn btn-light btn-icon ms-2"
                  onClick={() => setShowDeleteModal(true)}
                  aria-label={lang.en.button.delete}
                  title={lang.en.button.delete}
                >
                  ❌
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div
          className="experienceCard d-flex flex-column align-items-center justify-content-between p-3 position-relative overflow-hidden"
          style={{ backgroundImage: getBackgroundImage }}
        >
          <Link to="/" className="experience-card-link flex-grow-1 d-flex align-items-center justify-content-center w-100 text-decoration-none">
            <span className="h4 fw-bold experience-card-title d-flex align-items-center justify-content-center text-white text-center p-3 w-100">
              Dinner Party with locals at the Rhodopo Mountains in Bulgaria
            </span>
          </Link>
          <div className="experience-card-actions d-flex gap-2 flex-shrink-0">
            <button
              className={`btn btn-icon ${experienceAdded ? 'btn-card-remove' : 'btn-card-add'} ${isLoading ? 'loading' : ''}`}
              onClick={handleExperienceAction}
              disabled={isLoading}
              aria-label={experienceAdded ? lang.en.button.removeFromPlan : lang.en.button.addToPlan}
              title={experienceAdded ? lang.en.button.removeFromPlan : lang.en.button.addToPlan}
            >
              {experienceAdded ? "-" : "✚"}
            </button>
          </div>
        </div>
      )}
      <ConfirmModal
        show={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title={lang.en.modal.confirmDelete}
        message={lang.en.modal.confirmDeleteMessage.replace('{name}', experience?.name)}
        confirmText={lang.en.button.delete}
        confirmVariant="danger"
      />
    </div>
  );
}

export default memo(ExperienceCard);

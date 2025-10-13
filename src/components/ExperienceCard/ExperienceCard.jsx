import "./ExperienceCard.css";
import { Link } from "react-router-dom";
import { useState, useCallback, useMemo, memo, useEffect } from "react";
import { lang } from "../../lang.constants";
import ConfirmModal from "../ConfirmModal/ConfirmModal";
import { deleteExperience } from "../../utilities/experiences-api";
import { createPlan, deletePlan, getUserPlans } from "../../utilities/plans-api";
import { handleError } from "../../utilities/error-handler";

function ExperienceCard({ experience, user, updateData, userPlans = [] }) {
  const rand = useMemo(() => Math.floor(Math.random() * 50), []);
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  // Initialize local plan state based on userPlans if available
  const [localPlanState, setLocalPlanState] = useState(() => {
    if (userPlans.length > 0) {
      return userPlans.some(plan => 
        plan.experience?._id === experience._id || 
        plan.experience === experience._id
      );
    }
    return null; // null means we don't know yet, need to check with API
  });

  const isOwner = experience?.user && experience.user._id === user?._id;

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

  // Fetch plan status when component mounts if userPlans is empty
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
        const plans = await getUserPlans();
        if (isMounted) {
          const hasPlan = plans.some(plan => 
            plan.experience?._id === experience._id || 
            plan.experience === experience._id
          );
          setLocalPlanState(hasPlan);
        }
      } catch (err) {
        // Silently fail - button will default to "add" state
        console.warn('Failed to check plan status:', err);
        if (isMounted) {
          setLocalPlanState(false);
        }
      }
    };

    checkPlanStatus();

    return () => {
      isMounted = false;
    };
  }, [user?._id, experience?._id, userPlans.length, localPlanState]);

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
    
    // Backward compatibility: if single photo exists
    if (experience.photo && experience.photo.url) {
      return `url(${experience.photo.url})`;
    }
    
    // Fallback to placeholder
    return `url(https://picsum.photos/400?rand=${rand})`;
  }, [experience, rand]);

  const handleExperienceAction = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      if (experienceAdded) {
        // Need to find the user's plan for this experience
        // userPlans prop may be empty, so fetch fresh
        let userPlan = userPlans.find(plan => 
          plan.experience?._id === experience._id || 
          plan.experience === experience._id
        );
        
        // If not found in prop, fetch from API
        if (!userPlan) {
          const plans = await getUserPlans();
          userPlan = plans.find(plan => 
            plan.experience?._id === experience._id || 
            plan.experience === experience._id
          );
        }
        
        if (userPlan) {
          await deletePlan(userPlan._id);
          setLocalPlanState(false); // Update local state immediately
        } else {
          throw new Error('Plan not found');
        }
      } else {
        // Create a new plan for this experience with no planned date
        // User can set the date later on the experience page
        await createPlan(experience._id, null);
        setLocalPlanState(true); // Update local state immediately
      }

      // Refresh data from server - this will update the parent's state
      // which will flow down as new props, updating experienceAdded
      if (updateData) {
        await updateData();
      }
    } catch (err) {
      handleError(err, { context: experienceAdded ? 'Remove plan' : 'Create plan' });
      // Revert local state on error
      setLocalPlanState(null);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, experienceAdded, experience._id, updateData, userPlans]);

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
            {isOwner && (
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

import "./ExperienceCard.css";
import { Link } from "react-router-dom";
import { useState, useCallback, useMemo, memo } from "react";
import { lang } from "../../lang.constants";
import ConfirmModal from "../ConfirmModal/ConfirmModal";
import {
  userAddExperience,
  userRemoveExperience,
  deleteExperience,
} from "../../utilities/experiences-api";
import { handleError } from "../../utilities/error-handler";

function ExperienceCard({ experience, user, updateData }) {
  const rand = useMemo(() => Math.floor(Math.random() * 50), []);
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Compute experience added status directly from props - single source of truth
  // Track users array length to ensure useMemo recomputes when array changes
  const usersCount = experience?.users?.length || 0;

  const experienceAdded = useMemo(() => {
    if (!experience?.users || !user?._id) return false;
    return experience.users.some((expUser) => {
      const userId = expUser.user?._id || expUser.user;
      return userId === user._id;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experience?.users, user?._id, usersCount]);

  const isOwner = experience?.user && experience.user._id === user?._id;

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
        await userRemoveExperience(user._id, experience._id);
      } else {
        await userAddExperience(user._id, experience._id);
      }

      // Refresh data from server - this will update the parent's state
      // which will flow down as new props, updating experienceAdded
      if (updateData) {
        await updateData();
      }
    } catch (err) {
      handleError(err, { context: experienceAdded ? 'Remove experience' : 'Add experience' });
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, experienceAdded, user._id, experience._id, updateData]);

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

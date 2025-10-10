import "./ExperienceCard.css";
import { Link } from "react-router-dom";
import { useState, useEffect, useCallback, useMemo, memo } from "react";
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
  const [experienceAdded, setExperienceAdded] = useState(
    experience.users.map((expUser) => expUser.user).filter((expUser) => expUser._id === user._id).length > 0
  );
  const isOwner = experience.user && experience.user._id === user._id;
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleExperienceAction = useCallback(async () => {
    const previousState = experienceAdded;
    try {
      // Optimistically update UI for instant feedback
      setExperienceAdded(!experienceAdded);

      if (experienceAdded) {
        await userRemoveExperience(user._id, experience._id);
      } else {
        await userAddExperience(user._id, experience._id);
      }

      // Refresh data from server to ensure consistency
      if (updateData) {
        await updateData();
      }
    } catch (err) {
      // Revert optimistic update on error
      setExperienceAdded(previousState);
      handleError(err, { context: experienceAdded ? 'Remove experience' : 'Add experience' });
    }
  }, [experienceAdded, user._id, experience._id, updateData]);

  const handleDelete = useCallback(async () => {
    try {
      await deleteExperience(experience._id);
      setShowDeleteModal(false);
      updateData();
    } catch (err) {
      handleError(err, { context: 'Delete experience' });
    }
  }, [experience._id, updateData]);

  useEffect(() => {
    setExperienceAdded(
      experience.users.map((expUser) => expUser.user).filter((expUser) => expUser._id === user._id).length > 0
    );
  }, [experience.users, user._id])
  return (
    <div className="d-inline-block m-2" style={{ width: 'fit-content', verticalAlign: 'top' }}>
      {experience ? (
        <div
          className="experienceCard d-flex flex-column align-items-center justify-content-between p-3 position-relative overflow-hidden"
          style={{ backgroundImage: `url(https://picsum.photos/400?rand=${rand})` }}
        >
          <Link to={`/experiences/${experience._id}`} className="experience-card-link flex-grow-1 d-flex align-items-center justify-content-center w-100 text-decoration-none">
            <span className="h4 fw-bold experience-card-title d-flex align-items-center justify-content-center text-white text-center p-3 w-100">
              {experience.name}
            </span>
          </Link>
          <div className="experience-card-actions d-flex gap-2 flex-shrink-0">
            <button
              className={`btn btn-icon ${experienceAdded ? 'btn-card-remove' : 'btn-card-add'}`}
              type="button"
              onClick={handleExperienceAction}
              aria-label={experienceAdded ? lang.en.button.removeFromPlan : lang.en.button.addToPlan}
              title={experienceAdded ? lang.en.button.removeFromPlan : lang.en.button.addToPlan}
            >
              {experienceAdded ? "-" : "✚"}
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
          style={{ backgroundImage: `url(https://picsum.photos/400?rand=${rand})` }}
        >
          <Link to="/" className="experience-card-link flex-grow-1 d-flex align-items-center justify-content-center w-100 text-decoration-none">
            <span className="h4 fw-bold experience-card-title d-flex align-items-center justify-content-center text-white text-center p-3 w-100">
              Dinner Party with locals at the Rhodopo Mountains in Bulgaria
            </span>
          </Link>
          <div className="experience-card-actions d-flex gap-2 flex-shrink-0">
            <button
              className={`btn btn-icon ${experienceAdded ? 'btn-card-remove' : 'btn-card-add'}`}
              onClick={handleExperienceAction}
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

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
    try {
      if (experienceAdded) {
        await userRemoveExperience(user._id, experience._id);
      } else {
        await userAddExperience(user._id, experience._id);
      }
      setExperienceAdded(!experienceAdded);
      updateData();
    } catch (err) {
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
    <div className="experience">
      {experience ? (
        <div
          className="experienceCard"
          style={{ backgroundImage: `url(https://picsum.photos/400?rand=${rand})` }}
        >
          <Link to={`/experiences/${experience._id}`}>
            <span className="h4 fw-bold">
              {experience.name}
            </span>
          </Link>
          <div className="d-flex">
            <button className="btn btn-light rounded-0 experience-action-btn" type="button" onClick={handleExperienceAction}>
              {experienceAdded ? "-" : "+"}
            </button>
            {isOwner && (
              <>
                <Link to={`/experiences/${experience._id}/edit`} className="btn btn-light rounded-0 experience-action-btn ms-1">
                  ✏️
                </Link>
                <button className="btn btn-light rounded-0 experience-action-btn ms-1" onClick={() => setShowDeleteModal(true)}>
                  ❌
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div
          className="experienceCard"
          style={{ backgroundImage: `url(https://picsum.photos/400?rand=${rand})` }}
        >
          <Link to="/">
            <span className="h4 fw-bold">
              Dinner Party with locals at the Rhodopo Mountains in Bulgaria
            </span>
          </Link>
          <button className="btn btn-light rounded-0" onClick={handleExperienceAction}>
            {experienceAdded ? "-" : "+"}
          </button>
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

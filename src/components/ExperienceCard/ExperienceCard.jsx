import "./ExperienceCard.css";
import "./ExperienceCard.css";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { lang } from "../../lang.constants";
import {
  userAddExperience,
  userRemoveExperience,
  deleteExperience,
} from "../../utilities/experiences-api";

export default function ExperienceCard({ experience, user, updateData }) {
  const rand = Math.floor(Math.random() * 50)
  const [experienceAdded, setExperienceAdded] = useState(experience.users.map((expUser) => expUser.user).filter((expUser) => expUser._id === user._id).length > 0);
  const isOwner = experience.user && experience.user._id === user._id;
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  async function handleExperienceAction (e) {
    if (experienceAdded) {
      await userRemoveExperience(user._id, experience._id);
    } else {
      await userAddExperience(user._id, experience._id);
    }
    setExperienceAdded(!experienceAdded)
    updateData()
  }
  async function handleDelete() {
    await deleteExperience(experience._id);
    updateData();
  }
  useEffect(() => {
    setExperienceAdded(experience.users.map((expUser) => expUser.user).filter((expUser) => expUser._id === user._id).length > 0)
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
      {showDeleteModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{lang.en.modal.confirmDelete}</h5>
                <button type="button" className="btn-close" onClick={() => setShowDeleteModal(false)}></button>
              </div>
              <div className="modal-body">
                <p>{lang.en.modal.confirmDeleteMessage.replace('{name}', experience?.name)}</p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>{lang.en.button.cancel}</button>
                <button type="button" className="btn btn-danger" onClick={handleDelete}>{lang.en.button.delete}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

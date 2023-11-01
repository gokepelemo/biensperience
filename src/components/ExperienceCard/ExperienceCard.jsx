import "./ExperienceCard.css";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  userAddExperience,
  userRemoveExperience,
} from "../../utilities/experiences-api";

export default function ExperienceCard({ experience, user, updateData }) {
  const rand = Math.floor(Math.random() * 50)
  const [experienceAdded, setExperienceAdded] = useState(experience.users.map((expUser) => expUser.user).filter((expUser) => expUser._id === user._id).length > 0);
  async function handleExperienceAction (e) {
    let update;
    if (experienceAdded) {
      update = await userRemoveExperience(user._id, experience._id);
    } else {
      update = await userAddExperience(user._id, experience._id);
    }
    setExperienceAdded(!experienceAdded)
    updateData()
  }
  useEffect(() => {
    setExperienceAdded(experience.users.map((expUser) => expUser.user).filter((expUser) => expUser._id === user._id).length > 0)
  })
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
          <button className="btn btn-light rounded-0" onClick={handleExperienceAction}>
            {experienceAdded ? "-" : "+"}
          </button>
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
    </div>
  );
}

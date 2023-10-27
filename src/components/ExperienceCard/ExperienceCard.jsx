import "./ExperienceCard.css";
import { Link } from "react-router-dom";
import { useState } from "react";
import {
  userAddExperience,
  userRemoveExperience,
} from "../../utilities/experiences-api";

export default function ExperienceCard({ experience, user, setUser }) {
  const rand = Math.floor(Math.random() * 50)
  const [experienceAdded, setExperienceAdded] = useState(user.experiences.map((exp) => exp.experience._id).filter(exp => exp === experience._id).length > 0);
  async function handleExperienceAction (e) {
    let update;
    if (experienceAdded) {
      update = await userRemoveExperience(user._id, experience._id);
      setExperienceAdded(false);
    } else {
      update = await userAddExperience(user._id, experience._id);
      setExperienceAdded(true);
    }
    setUser(update);
  }
  return (
    <div className="experience">
      {experience ? (
        <div
          className="experienceCard"
          style={{ backgroundImage: `url(https://picsum.photos/500?rand=${rand})` }}
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
          style={{ backgroundImage: `url(https://picsum.photos/500?rand=${rand})` }}
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

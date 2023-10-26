import "./ExperienceCard.css";
import { Link } from "react-router-dom";
import { useState } from "react";

export default function ExperienceCard({ experience, user }) {
  const [experienceAdded, setExperienceAdded] = useState(false);
  return (
    <div className="experience">
      {experience ? (
        <div
          className="experienceCard"
          style={{ backgroundImage: "url(https://picsum.photos/500)" }}
        >
          <Link to={`/experiences/${experience._id}`}>
            <span className="h4 fw-bold">
              {experience.name}
            </span>
          </Link>
          <button className="btn btn-light rounded-0">
            {experienceAdded ? "-" : "+"}
          </button>
        </div>
      ) : (
        <div
          className="experienceCard"
          style={{ backgroundImage: "url(https://picsum.photos/500)" }}
        >
          <Link to="/">
            <span className="h4 fw-bold">
              Dinner Party with locals at the Rhodopo Mountains in Bulgaria
            </span>
          </Link>
          <button className="btn btn-light rounded-0">
            {experienceAdded ? "-" : "+"}
          </button>
        </div>
      )}
    </div>
  );
}

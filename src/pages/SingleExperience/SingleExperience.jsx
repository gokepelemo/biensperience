import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { showExperience } from "../../utilities/experiences-api";

export default function SingleExperience() {
  const [experience, setExperience] = useState({});
  const { experienceId } = useParams();
  useEffect(() => {
    async function getExperience() {
      let experienceData = await showExperience(experienceId);
      setExperience(experienceData);
    }
    getExperience();
  }, []);
  return (
    <div className="row">
      <div className="col-sm-12">
        <h1>{experience.name}</h1>
      </div>
    </div>
  );
}

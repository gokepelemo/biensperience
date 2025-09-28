import "./Experiences.css";
import "./Experiences.css";
import { useEffect } from "react";
import ExperienceCard from "../../components/ExperienceCard/ExperienceCard";

export default function Experiences({
  experiences,
  user,
  setUser,
  updateData
}) {
  useEffect(() => {
    document.title = `All Experiences - Biensperience`;
  })
  return (
    <>
      {experiences && (
        <>
          <div className="row fade-in">
            <div className="col-md-6 fade-in">
              <h1 className="my-4 h fade-in">Experiences</h1>
            </div>
          </div>
          <div className="row my-4 fade-in">
            <div className="experiences-list fade-in">
              {experiences.map((experience, index) => (
                <ExperienceCard
                  experience={experience}
                  key={index}
                  user={user}
                  setUser={setUser}
                  updateData={updateData}
                  className="fade-in"
                />
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}

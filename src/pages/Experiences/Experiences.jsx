import "./Experiences.css"
import ExperienceCard from "../../components/ExperienceCard/ExperienceCard"

export default function Experiences({ experiences, user, setUser, render, setRender }) {
    return (
        <>
        {experiences && (
          <>
            <div className="row experiencesDetail">
              <div className="col-md-6">
                <h1 className="experiencesHeading my-4">
                  Experiences
                </h1>
              </div>
            </div>
            <div className="row my-4 p-3 d-flex justify-content-start">
                {experiences.map((experience, index) => <ExperienceCard experience={experience} key={index} user={user} setUser={setUser} render={render} setRender={setRender} />)}
            </div>
          </>
        )}
      </>
    )
}
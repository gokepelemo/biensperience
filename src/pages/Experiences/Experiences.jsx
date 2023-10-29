import "./Experiences.css"
import ExperienceCard from "../../components/ExperienceCard/ExperienceCard"

export default function Experiences({ experiences, user, setUser, render, setRender }) {
    return (
        <>
        {experiences && (
          <>
            <div className="row">
              <div className="col-md-6">
                <h1 className="my-4 h">
                  Experiences
                </h1>
              </div>
            </div>
            <div className="row my-4">
            <div className="col-md-12 p-3 d-flex flex-wrap justify-content-center align-items-center">
                {experiences.map((experience, index) => <ExperienceCard experience={experience} key={index} user={user} setUser={setUser} render={render} setRender={setRender} />)}
            </div>
            </div>
          </>
        )}
      </>
    )
}
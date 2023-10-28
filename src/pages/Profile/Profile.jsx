import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import "./Profile.css";
import PhotoCard from "./../../components/PhotoCard/PhotoCard";
import DestinationCard from "./../../components/DestinationCard/DestinationCard";
import ExperienceCard from "./../../components/ExperienceCard/ExperienceCard";
import { showUserExperiences } from "../../utilities/experiences-api";

export default function Profile({ user, setUser, render, setRender, destinations }) {
  let { profileId } = useParams();
  const [uiState, setUiState] = useState({
    experiences: true,
    destinations: false,
  });
  const [userExperiences, setUserExperiences] = useState([]);
  useEffect(() => {
    async function getExperiences() {
      let experiences = await showUserExperiences(user._id);
      setUserExperiences(experiences);
    }
    getExperiences();
  }, []);
  function handleExpNav(e) {
    setUiState({
      experiences: !uiState.experiences,
      destinations: !uiState.destinations,
    });
  }
  return (
    <>
      <div className="row mt-5">
        <h1 className="profile-heading fw-bold">{user.name}</h1>
      </div>
      <div className="row mb-4">
        <div className="col-md-6 p-3">
          <PhotoCard />
        </div>
        <div className="col-md-6 p-3">
          <ul className="list-group profile-detail">
            <li className="list-group-item list-group-item-secondary fw-bold text-center h5">
              Favorite Destinations
            </li>
            <li className="list-group-item list-group-item-secondary h5">
              Buenos Aires, Rio de Janeiro, New York, London, Hamburg, Mexico
              City, Tel-Aviv
            </li>
            <li className="list-group-item list-group-item-secondary fw-bold text-center h5">
              Preferred Experience Types
            </li>
            <li className="list-group-item list-group-item-secondary h5">
              High Adrenaline, Culinary, Distillery, Winery, Theme Parks, Family
              Fun, Art Museums, Theater
            </li>
          </ul>
        </div>
      </div>
      <div className="row my-4">
        <h4 className="badge rounded-pill text-bg-light badge-nav my-4">
          <span
            className={uiState.experiences ? "fw-bold" : ""}
            onClick={handleExpNav}
          >
            Experiences
          </span>{" "}
          |{" "}
          <span
            className={uiState.destinations ? "fw-bold" : ""}
            onClick={handleExpNav}
          >
            Destinations
          </span>
        </h4>
      </div>
      {userExperiences && (
        <>
          <div className="row my-4 justify-content-center">
            {uiState.destinations &&
              Array.from(new Set (userExperiences.map(experience => experience.destination._id))).map((destination, index) => (
                  <DestinationCard
                    key={index}
                    destination={destinations.filter(dest => dest._id == destination)[0]}
                  />
                ))}
            {uiState.experiences &&
              userExperiences.map((experience, index) => (
                <ExperienceCard
                  experience={experience}
                  user={user}
                  setUser={setUser}
                  key={index}
                  render={render}
                  setRender={setRender}
                />
              ))}
          </div>
        </>
      )}
    </>
  );
}

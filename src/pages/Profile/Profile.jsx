import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import "./Profile.css";
import PhotoCard from "./../../components/PhotoCard/PhotoCard";
import DestinationCard from "./../../components/DestinationCard/DestinationCard";
import ExperienceCard from "./../../components/ExperienceCard/ExperienceCard";
import { showUserExperiences } from "../../utilities/experiences-api";

export default function Profile({ user, setUser, destinations, updateData }) {
  let { profileId } = useParams();
  const [currentProfile, setCurrentProfile] = useState(user);
  const [uiState, setUiState] = useState({
    experiences: true,
    destinations: false,
  });
  const [userExperiences, setUserExperiences] = useState([]);
  const userExperienceTypes = Array.from(
    new Set(
      userExperiences
        .map((experience) => {
          return `${
            experience.experience_type.length > 0
              ? experience.experience_type
              : ""
          }`;
        })
        .join(",")
        .replace(",,", ", ")
        .split(",")
        .map((type) => {
          return type.trim();
        })
    )
  )
    .filter((type) => type.length > 0)
    .join(", ");
  const favoriteDestinations = destinations
    .filter(
      (destination) => destination.users_favorite.indexOf(user._id) !== -1
    )
    .map((destination, index, arr) => (
      <span key={index}>
        <Link to={`/destinations/${destination._id}`}>{destination.name}</Link>
        {index + 1 === arr.length ? "" : ", "}
      </span>
    ));
  async function getExperiences() {
    let experiences = await showUserExperiences(user._id);
    setUserExperiences(experiences);
  }
  useEffect(() => {
    updateData();
    getExperiences();
    document.title = `${currentProfile.name} - Biensperience`;
  }, [uiState.experiences, profileId]);
  function handleExpNav(e) {
    setUiState({
      experiences: !uiState.experiences,
      destinations: !uiState.destinations,
    });
  }
  return (
    <>
      <div className="row">
        <div className="col-md-6">
          <h1 className="my-4 h">{user.name}</h1>
        </div>
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
            <li className="list-group-item list-group-item-secondary h5 profileDestinations">
              {Object.values(favoriteDestinations).length > 0 ? (
                favoriteDestinations
              ) : (
                <p className="noFavoriteDestinations">
                  There are no favorite destinations on this profile yet. Look
                  through our destinations and{" "}
                  <Link to="/destinations">add some favorite destinations</Link>
                  .
                </p>
              )}
            </li>
            <>
              <li className="list-group-item list-group-item-secondary fw-bold text-center h5">
                Preferred Experience Types
              </li>
              <li className="list-group-item list-group-item-secondary h5">
                {Object.values(userExperienceTypes).length > 0 ? (
                  userExperienceTypes
                ) : (
                  <p>
                    There are no experiences on this profile yet.{" "}
                    <Link to="/experiences">Add some experiences</Link>.
                  </p>
                )}
              </li>
            </>
          </ul>
        </div>
      </div>
      <div className="row my-4">
        <h4 className="badge rounded-pill text-bg-light badge-nav my-4">
          <span
            className={uiState.experiences ? "fw-bold" : ""}
            onClick={handleExpNav}
          >
            Planned Experiences
          </span>{" "}
          |{" "}
          <span
            className={uiState.destinations ? "fw-bold" : ""}
            onClick={handleExpNav}
          >
            Experience Destinations
          </span>
        </h4>
      </div>
      {userExperiences.length > 0 ? (
        <>
          <div className="row my-4 justify-content-center">
            {uiState.destinations &&
              Array.from(
                new Set(
                  userExperiences.map(
                    (experience) => experience.destination._id
                  )
                )
              ).map((destination, index) => (
                <DestinationCard
                  key={index}
                  updataData={updateData}
                  destination={
                    destinations.filter((dest) => dest._id === destination)[0]
                  }
                />
              ))}
            {uiState.experiences &&
              userExperiences.map((experience, index) => (
                <ExperienceCard
                  experience={experience}
                  user={user}
                  setUser={setUser}
                  updateData={updateData}
                  key={index}
                />
              ))}
          </div>
        </>
      ) : (
        <p className="alert alert-info">
          There are no {uiState.experiences ? `experiences` : `destinations`} on
          this profile yet. Add one now.
        </p>
      )}
    </>
  );
}

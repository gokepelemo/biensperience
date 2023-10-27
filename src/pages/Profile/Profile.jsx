import { useParams } from "react-router-dom";
import { useState } from "react";
import "./Profile.css";
import PhotoCard from "./../../components/PhotoCard/PhotoCard";
import DestinationCard from "./../../components/DestinationCard/DestinationCard";
import ExperienceCard from "./../../components/ExperienceCard/ExperienceCard";

export default function Profile({ user, setUser, destinations }) {
  const [uiState, setUiState] = useState({
    experiences: true,
    destinations: false,
  });
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
      {user.experiences &&
      <>
      <div className="row my-4 justify-content-center">
        {uiState.destinations &&
          user.experiences
            .map((experience) => experience.experience.destination)
            .map((destination, index) => (
              <DestinationCard
                key={index}
                destination={
                  destinations.filter((dest) => dest._id === destination)[0]
                }
              />
            ))}
        {uiState.experiences &&
          user.experiences.map((experience, index) => (
            <ExperienceCard
              key={index}
              experience={experience.experience}
              user={user}
              setUser={setUser}
            />
          ))}
      </div>
      </>}
    </>
  );
}

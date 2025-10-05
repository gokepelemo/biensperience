import { FaUser, FaPassport } from "react-icons/fa";
import { useParams, Link } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import "./Profile.css";
import PhotoCard from "./../../components/PhotoCard/PhotoCard";
import DestinationCard from "./../../components/DestinationCard/DestinationCard";
import ExperienceCard from "./../../components/ExperienceCard/ExperienceCard";
import { showUserExperiences } from "../../utilities/experiences-api";
import { getUserData } from "../../utilities/users-api";
import { lang } from "../../lang.constants";

export default function Profile({ user, destinations, updateData }) {
  // ...existing code...
  let { profileId } = useParams();
  let userId = profileId ? profileId : user._id;
  const isOwner = !profileId || profileId === user._id;
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
                return experience.experience_type && experience.experience_type.length > 0
                  ? experience.experience_type
                  : "";
              })
              .join(",")
              .replace(",,", ", ")
              .split(",")
              .map((type) => type.trim())
          )
        ).filter((type) => type.length > 0);
        const favoriteDestinations = destinations
          .filter(
            (destination) =>
              destination.users_favorite.indexOf(currentProfile._id) !== -1
          );
        const getProfile = useCallback(async () => {
          await getUserData(userId).then(function (data) {
            setCurrentProfile(data);
          });
          await showUserExperiences(userId).then(function (data) {
            setUserExperiences(data);
          });
        }, [userId]);
  useEffect(() => {
    getProfile();
    document.title = `${currentProfile.name} - Biensperience`;
  }, [currentProfile.name, getProfile]);
  function handleExpNav(e) {
    setUiState({
      experiences: !uiState.experiences,
      destinations: !uiState.destinations,
    });
  }
  return (
    <>
      <div className="row fade-in">
        <div className="col-md-6 fade-in">
          <h1 className="my-4 h fade-in">{currentProfile.name}</h1>
        </div>
      </div>
      <div className="row mb-4 fade-in">
        <div className="col-md-6 p-3 fade-in">
          <PhotoCard photo={currentProfile.photo} />
          {!currentProfile.photo && isOwner && (
            <small className="d-flex justify-content-center align-items-center noPhoto fade-in">
              <span>{lang.en.message.noPhotoMessage}</span>
              <Link to="/profile/edit">{lang.en.message.uploadPhotoNow}</Link>.
            </small>
          )}
        </div>
        <div className="col-md-6 p-3 fade-in">
          <ul className="list-group profile-detail fade-in">
            <li className="list-group-item list-group-item-secondary fw-bold text-center h5 fade-in">
              {lang.en.heading.favoriteDestinations}
            </li>
            <li className="list-group-item list-group-item-secondary h5 profileDestinations fade-in">
                    {favoriteDestinations.length > 0 ? (
                      favoriteDestinations.map((destination) => (
                        <Link className="pill" key={destination._id} to={`/destinations/${destination._id}`}>
                          <span className="icon"><FaPassport /></span>
                          {destination.name}
                        </Link>
                      ))
                    ) : (
                      <p className="noFavoriteDestinations fade-in">
                        {lang.en.message.noFavoriteDestinations}
                        <Link to="/destinations">{lang.en.message.addFavoriteDestinations}</Link>
                        .
                      </p>
                    )}
            </li>
            <>
              <li className="list-group-item list-group-item-secondary fw-bold text-center h5 fade-in">
                {lang.en.heading.preferredExperienceTypes}
              </li>
              <li className="list-group-item list-group-item-secondary h5 fade-in">
                      {userExperienceTypes.length > 0 ? (
                        userExperienceTypes.map((type) => (
                          <span className="pill" key={type}>
                            <span className="icon"><FaUser /></span>
                            {type}
                          </span>
                        ))
                      ) : (
                        <p className="fade-in">
                          {lang.en.message.noExperiencesYet}
                          <Link to="/experiences">{lang.en.message.addExperiences}</Link>.
                        </p>
                      )}
              </li>
            </>
          </ul>
        </div>
      </div>
      <div className="row my-4 fade-in">
        <h4 className="badge rounded-pill text-bg-light badge-nav my-4 fade-in">
          <span
            className={uiState.experiences ? "fw-bold fade-in" : "fade-in"}
            onClick={handleExpNav}
          >
            {lang.en.heading.plannedExperiences}
          </span>{" "}
          |{" "}
          <span
            className={uiState.destinations ? "fw-bold fade-in" : "fade-in"}
            onClick={handleExpNav}
          >
            {lang.en.heading.experienceDestinations}
          </span>
        </h4>
      </div>
      {userExperiences.length > 0 ? (
        <>
          <div className="row my-4 justify-content-center fade-in">
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
                  updateData={updateData}
                  key={index}
                />
              ))}
          </div>
        </>
      ) : (
        <p className="alert alert-info fade-in">
          {lang.en.alert.noExperiencesOrDestinations.replace('{type}', uiState.experiences ? `experiences` : `destinations`)} {lang.en.message.addOneNow}
        </p>
      )}
    </>
  );
}

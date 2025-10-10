import { FaUser, FaPassport } from "react-icons/fa";
import { useParams, Link } from "react-router-dom";
import { useState, useEffect, useCallback, useMemo } from "react";
import "./Profile.css";
import PhotoCard from "./../../components/PhotoCard/PhotoCard";
import DestinationCard from "./../../components/DestinationCard/DestinationCard";
import ExperienceCard from "./../../components/ExperienceCard/ExperienceCard";
import { showUserExperiences } from "../../utilities/experiences-api";
import { getUserData } from "../../utilities/users-api";
import { lang } from "../../lang.constants";
import { handleError } from "../../utilities/error-handler";
import PageMeta from "../../components/PageMeta/PageMeta";
import { deduplicateById } from "../../utilities/deduplication";
import { createUrlSlug } from "../../utilities/url-utils";

export default function Profile({ user, destinations, updateData }) {
  let { profileId } = useParams();
  let userId = profileId ? profileId : user._id;
  const isOwner = !profileId || profileId === user._id;
  const [currentProfile, setCurrentProfile] = useState(user);
  const [uiState, setUiState] = useState({
    experiences: true,
    destinations: false,
  });
  const [userExperiences, setUserExperiences] = useState([]);

  // Deduplicate user experiences by ID
  const uniqueUserExperiences = useMemo(() => {
    return deduplicateById(userExperiences);
  }, [userExperiences]);

  const userExperienceTypes = useMemo(() => {
    return Array.from(
      new Set(
        uniqueUserExperiences
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
  }, [uniqueUserExperiences]);

  // Deduplicate favorite destinations by ID
  const favoriteDestinations = useMemo(() => {
    const filtered = destinations.filter(
      (destination) =>
        destination.users_favorite.indexOf(currentProfile._id) !== -1
    );
    return deduplicateById(filtered);
  }, [destinations, currentProfile._id]);

  const getProfile = useCallback(async () => {
    try {
      const [userData, experienceData] = await Promise.all([
        getUserData(userId),
        showUserExperiences(userId)
      ]);
      setCurrentProfile(userData);
      setUserExperiences(experienceData);
    } catch (err) {
      handleError(err, { context: 'Load profile' });
    }
  }, [userId]);

  useEffect(() => {
    getProfile();
  }, [getProfile]);

  const handleExpNav = useCallback(() => {
    setUiState({
      experiences: !uiState.experiences,
      destinations: !uiState.destinations,
    });
  }, [uiState.experiences, uiState.destinations]);
  return (
    <>
      <PageMeta
        title={`${currentProfile.name}'s Profile`}
        description={`View ${currentProfile.name}'s travel profile on Biensperience. Discover their planned experiences${uniqueUserExperiences.length > 0 ? ` (${uniqueUserExperiences.length} experiences)` : ''} and favorite destinations${favoriteDestinations.length > 0 ? ` (${favoriteDestinations.length} destinations)` : ''}.`}
        keywords={`${currentProfile.name}, travel profile, experiences, destinations, travel planning${userExperienceTypes.length > 0 ? `, ${userExperienceTypes.join(', ')}` : ''}`}
        ogTitle={`${currentProfile.name} on Biensperience`}
        ogDescription={`${currentProfile.name} is planning ${uniqueUserExperiences.length} travel experiences${favoriteDestinations.length > 0 ? ` across ${favoriteDestinations.length} favorite destinations` : ''}.`}
        ogImage={currentProfile.photo || '/logo.png'}
      />
      <div className="row fade-in">
        <div className="col-md-6 fade-in">
          <h1 className="my-4 h fade-in">{currentProfile.name}</h1>
        </div>
      </div>
      <div className="row mb-4 fade-in">
        <div className="col-md-6 p-3 fade-in">
          <PhotoCard photo={currentProfile.photo} title={currentProfile.name} />
          {!currentProfile.photo && isOwner && (
            <small className="d-flex justify-content-center align-items-center noPhoto fade-in">
              <span>{lang.en.message.noPhotoMessage} <Link to="/profile/edit">{lang.en.message.uploadPhotoNow}</Link>.</span>
            </small>
          )}
        </div>
        <div className="col-md-6 p-3 fade-in">
          <div className="profile-detail-card fade-in">
            <div className="profile-detail-section">
              <h5 className="profile-detail-section-title">
                {lang.en.heading.favoriteDestinations}
              </h5>
              <div className="profile-detail-content profileDestinations">
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
              </div>
            </div>
            <div className="profile-detail-section">
              <h5 className="profile-detail-section-title">
                {lang.en.heading.preferredExperienceTypes}
              </h5>
              <div className="profile-detail-content">
                {userExperienceTypes.length > 0 ? (
                  userExperienceTypes.map((type) => (
                    <Link className="pill" key={type} to={`/experience-types/${createUrlSlug(type)}`}>
                      <span className="icon"><FaUser /></span>
                      {type}
                    </Link>
                  ))
                ) : (
                  <p className="fade-in">
                    {lang.en.message.noExperiencesYet}
                    <Link to="/experiences">{lang.en.message.addExperiences}</Link>.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="row my-4 fade-in">
        <h4 className="badge rounded-pill text-bg-light badge-nav my-4 fade-in">
          <span
            className={uiState.experiences ? "fw-bold fade-in active-tab" : "fade-in"}
            onClick={handleExpNav}
          >
            {lang.en.heading.plannedExperiences}
          </span>
          <span
            className={uiState.destinations ? "fw-bold fade-in active-tab" : "fade-in"}
            onClick={handleExpNav}
          >
            {lang.en.heading.experienceDestinations}
          </span>
        </h4>
      </div>
      {uniqueUserExperiences.length > 0 ? (
        <>
          <div className="row my-4 justify-content-center fade-in">
            {uiState.destinations &&
              Array.from(
                new Set(
                  uniqueUserExperiences.map(
                    (experience) => experience.destination._id
                  )
                )
              ).map((destinationId, index) => {
                const destination = destinations.filter((dest) => dest._id === destinationId)[0];
                return destination ? (
                  <DestinationCard
                    key={destination._id || index}
                    updateData={updateData}
                    destination={destination}
                  />
                ) : null;
              })}
            {uiState.experiences &&
              uniqueUserExperiences.map((experience, index) => (
                <ExperienceCard
                  experience={experience}
                  user={user}
                  updateData={updateData}
                  key={experience._id || index}
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

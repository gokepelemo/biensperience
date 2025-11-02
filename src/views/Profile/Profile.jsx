import { FaUser, FaPassport, FaCheckCircle, FaKey, FaEye } from "react-icons/fa";
import { useParams, Link } from "react-router-dom";
import { useState, useEffect, useCallback, useMemo } from "react";
import "./Profile.css";
import { useUser } from "../../contexts/UserContext";
import { useData } from "../../contexts/DataContext";
import { useApp } from "../../contexts/AppContext";
import PhotoCard from "./../../components/PhotoCard/PhotoCard";
import DestinationCard from "./../../components/DestinationCard/DestinationCard";
import ExperienceCard from "./../../components/ExperienceCard/ExperienceCard";
import Alert from "../../components/Alert/Alert";
import ApiTokenModal from "../../components/ApiTokenModal/ApiTokenModal";
import ActivityMonitor from "../../components/ActivityMonitor/ActivityMonitor";
import { showUserExperiences, showUserCreatedExperiences } from "../../utilities/experiences-api";
import { getUserData, updateUserRole, updateUser as updateUserApi } from "../../utilities/users-api";
import { lang } from "../../lang.constants";
import { handleError } from "../../utilities/error-handler";
import PageMeta from "../../components/PageMeta/PageMeta";
import { deduplicateById } from "../../utilities/deduplication";
import { createUrlSlug } from "../../utilities/url-utils";
import { USER_ROLES, USER_ROLE_DISPLAY_NAMES } from "../../utilities/user-roles";
import { isSuperAdmin } from "../../utilities/permissions";

export default function Profile() {
  const { user, updateUser: updateUserContext } = useUser();
  const { destinations, plans } = useData();
  const { registerH1, clearActionButtons } = useApp();
  let { profileId } = useParams();

  // Validate profileId format
  if (profileId && (typeof profileId !== 'string' || profileId.length !== 24)) {
    // Invalid profileId format - handled by validation below
  }

  let userId = profileId ? profileId : user._id;
  const isOwner = !profileId || profileId === user._id || isSuperAdmin(user);
  const [currentProfile, setCurrentProfile] = useState(isOwner ? user : null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(!isOwner);
  const [profileError, setProfileError] = useState(null);
  const [uiState, setUiState] = useState({
    experiences: true,
    created: false,
    destinations: false,
  });
  const [userExperiences, setUserExperiences] = useState([]);
  const [createdExperiences, setCreatedExperiences] = useState([]);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [showApiTokenModal, setShowApiTokenModal] = useState(false);
  const [showActivityMonitor, setShowActivityMonitor] = useState(false);

  // Deduplicate user experiences by ID
  const uniqueUserExperiences = useMemo(() => {
    return deduplicateById(userExperiences);
  }, [userExperiences]);

  // Deduplicate created experiences by ID
  const uniqueCreatedExperiences = useMemo(() => {
    return deduplicateById(createdExperiences);
  }, [createdExperiences]);

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
    if (!currentProfile) return [];
    const filtered = destinations.filter(
      (destination) =>
        destination.users_favorite.indexOf(currentProfile._id) !== -1
    );
    return deduplicateById(filtered);
  }, [destinations, currentProfile]);

  const getProfile = useCallback(async () => {
    if (!isOwner) {
      setIsLoadingProfile(true);
    }
    setProfileError(null);
    
    // Validate userId before API calls
    if (!userId || typeof userId !== 'string' || userId.length !== 24) {
      setProfileError('Invalid user ID');
      setIsLoadingProfile(false);
      return;
    }
    
    try {
      const [userData, experienceData, createdData] = await Promise.all([
        getUserData(userId),
        showUserExperiences(userId),
        showUserCreatedExperiences(userId)
      ]);
      setCurrentProfile(userData);
      setUserExperiences(experienceData);
      setCreatedExperiences(createdData);
    } catch (err) {
      // Check if it's a 404 error
      if (err.message && err.message.includes('404')) {
        setProfileError('User not found');
      } else {
        handleError(err, { context: 'Load profile' });
        setProfileError('Failed to load profile');
      }
    } finally {
      setIsLoadingProfile(false);
    }
  }, [userId, isOwner]);

  const handleRoleUpdate = async (newRole) => {
    if (!isSuperAdmin(user)) {
      handleError({ message: 'Only super admins can update user roles' });
      return;
    }

    setIsUpdatingRole(true);
    try {
      await updateUserRole(profileId, { role: newRole });
      // Refresh profile data
      await getProfile();
      alert('User role updated successfully');
    } catch (error) {
      handleError(error);
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const handleEmailConfirmationUpdate = async (emailConfirmed) => {
    if (!isSuperAdmin(user)) {
      handleError({ message: 'Only super admins can update email confirmation' });
      return;
    }

    setIsUpdatingRole(true);
    try {
      await updateUserApi(profileId, { emailConfirmed });
      // Refresh profile data
      await getProfile();
      alert(`Email ${emailConfirmed ? 'confirmed' : 'unconfirmed'} successfully`);
    } catch (error) {
      handleError(error);
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const handleUserUpdate = useCallback(async () => {
    // Refresh user context after API token changes
    await getProfile();
    if (isOwner && updateUserContext) {
      const freshUserData = await getUserData(user._id);
      updateUserContext(freshUserData);
    }
  }, [getProfile, isOwner, updateUserContext, user._id]);

  const handleOpenApiModal = useCallback(() => {
    setShowApiTokenModal(true);
  }, []);

  const handleCloseApiModal = useCallback(() => {
    setShowApiTokenModal(false);
  }, []);

  const handleOpenActivityMonitor = useCallback(() => {
    setShowActivityMonitor(true);
  }, []);

  const handleCloseActivityMonitor = useCallback(() => {
    setShowActivityMonitor(false);
  }, []);

  useEffect(() => {
    getProfile();
  }, [getProfile]);

  // Register h1 for navbar integration
  useEffect(() => {
    const h1 = document.querySelector('h1');
    if (h1) registerH1(h1);

    return () => clearActionButtons();
  }, [registerH1, clearActionButtons]);

  const handleExpNav = useCallback((view) => {
    setUiState({
      experiences: view === 'experiences',
      created: view === 'created',
      destinations: view === 'destinations',
    });
  }, []);
  
  // Show error state if profile not found
  if (profileError === 'User not found') {
    return (
      <div className="container my-5">
        <div className="row justify-content-center">
          <div className="col-md-8">
            <Alert
              type="danger"
              title="User Not Found"
            >
              <p>The user profile you're looking for doesn't exist or has been removed.</p>
              <hr />
              <p className="mb-0">
                <Link to="/" className="alert-link">Return to Home</Link>
              </p>
            </Alert>
          </div>
        </div>
      </div>
    );
  }
  
  // Show general error state
  if (profileError) {
    return (
      <div className="container my-5">
        <div className="row justify-content-center">
          <div className="col-md-8">
            <Alert
              type="warning"
              title="Unable to Load Profile"
            >
              <p>{profileError}</p>
              <hr />
              <p className="mb-0">
                <button onClick={getProfile} className="btn btn-primary">{lang.en.button.tryAgain}</button>
              </p>
            </Alert>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <>
      {currentProfile && (
        <PageMeta
          title={`${currentProfile.name}'s Profile`}
          description={`View ${currentProfile.name}'s travel profile on Biensperience. Discover their planned experiences${uniqueUserExperiences.length > 0 ? ` (${uniqueUserExperiences.length} experiences)` : ''} and favorite destinations${favoriteDestinations.length > 0 ? ` (${favoriteDestinations.length} destinations)` : ''}.`}
          keywords={`${currentProfile.name}, travel profile, experiences, destinations, travel planning${userExperienceTypes.length > 0 ? `, ${userExperienceTypes.join(', ')}` : ''}`}
          ogTitle={`${currentProfile.name} on Biensperience`}
          ogDescription={`${currentProfile.name} is planning ${uniqueUserExperiences.length} travel experiences${favoriteDestinations.length > 0 ? ` across ${favoriteDestinations.length} favorite destinations` : ''}.`}
          entity={currentProfile}
          entityType="user"
        />
      )}
      <div className="row fade-in profile-header-row">
        <div className="col-md-6 fade-in">
          <h1 className="h fade-in mb-0">
            {isLoadingProfile ? (
              <span className="loading-skeleton loading-skeleton-text"></span>
            ) : (
              <>
                {currentProfile?.name}
                {currentProfile?.emailConfirmed && (
                  <FaCheckCircle
                    className="text-success ms-2"
                    style={{ fontSize: '0.6em' }}
                    title={lang.en.aria.emailConfirmed}
                    aria-label={lang.en.aria.emailConfirmed}
                  />
                )}
              </>
            )}
          </h1>
        </div>
        <div className="col-md-6 fade-in">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            {!isLoadingProfile && (
              <div className="dropdown">
                <button
                  className="btn btn-outline-secondary"
                  type="button"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                  aria-label={lang.en.aria.profileActions}
                >
                  ⋯
                </button>
                <ul className="dropdown-menu dropdown-menu-end">
                  {isSuperAdmin(user) && (
                    <>
                      <li>
                        <button
                          className="dropdown-item"
                          onClick={handleOpenApiModal}
                          type="button"
                        >
                          <FaKey className="me-2" /> API Key
                        </button>
                      </li>
                      <li>
                        <button
                          className="dropdown-item"
                          onClick={handleOpenActivityMonitor}
                          type="button"
                        >
                          <FaEye className="me-2" /> Activity Monitor
                        </button>
                      </li>
                    </>
                  )}
                  {isOwner && (
                    <li>
                      <Link
                        to="/profile/update"
                        className="dropdown-item"
                      >
                        ✏️ Update Profile
                      </Link>
                    </li>
                  )}
                  {isSuperAdmin(user) && profileId && profileId !== user._id && (
                    <li>
                      <Link
                        to={`/profile/${profileId}/update`}
                        className="dropdown-item"
                      >
                        👑 Admin Update
                      </Link>
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="row mb-4 fade-in">
        <div className="col-md-6 p-3 fade-in">
          {isLoadingProfile ? (
            <div className="photoCard loading-skeleton loading-skeleton-photo"></div>
          ) : (
            <>
              <PhotoCard photo={currentProfile?.photo} title={currentProfile?.name} />
              {!currentProfile?.photo && isOwner && (
                <small className="d-flex justify-content-center align-items-center noPhoto fade-in">
                  <span>{lang.en.message.noPhotoMessage} <Link to="/profile/update">{lang.en.message.uploadPhotoNow}</Link></span>
                </small>
              )}
            </>
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
                  <div className="noFavoriteDestinations fade-in">
                    {isOwner ? (
                      <>
                        <p className="mb-3">{lang.en.message.noFavoriteDestinations}</p>
                        <Link to="/destinations" className="btn btn-primary btn-sm">
                          {lang.en.message.addFavoriteDestinations}
                        </Link>
                      </>
                    ) : isLoadingProfile ? (
                      <span className="loading-skeleton loading-skeleton-text"></span>
                    ) : (
                      <p className="mb-0">{`${currentProfile?.name || 'This user'} hasn't added any favorite destinations yet.`}</p>
                    )}
                  </div>
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
                  <div className="fade-in">
                    {isOwner ? (
                      <>
                        <p className="mb-3">{lang.en.message.noExperiencesYet}</p>
                        <Link to="/experiences" className="btn btn-primary btn-sm">
                          {lang.en.message.addExperiences}
                        </Link>
                      </>
                    ) : isLoadingProfile ? (
                      <span className="loading-skeleton loading-skeleton-text"></span>
                    ) : (
                      <p className="mb-0">{`${currentProfile?.name || 'This user'} hasn't planned any experiences yet.`}</p>
                    )}
                  </div>
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
            onClick={() => handleExpNav('experiences')}
          >
            {lang.en.heading.plannedExperiences}
          </span>
          <span
            className={uiState.created ? "fw-bold fade-in active-tab" : "fade-in"}
            onClick={() => handleExpNav('created')}
          >
            {lang.en.heading.createdExperiences || 'Created Experiences'}
          </span>
          <span
            className={uiState.destinations ? "fw-bold fade-in active-tab" : "fade-in"}
            onClick={() => handleExpNav('destinations')}
          >
            {lang.en.heading.experienceDestinations}
          </span>
        </h4>
      </div>
      {(uniqueUserExperiences.length > 0 || uniqueCreatedExperiences.length > 0) ? (
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
                    destination={destination}
                  />
                ) : null;
              })}
            {uiState.experiences &&
              uniqueUserExperiences.map((experience, index) => (
                <ExperienceCard
                  experience={experience}
                  key={experience._id || index}
                  userPlans={plans}
                />
              ))}
            {uiState.created &&
              uniqueCreatedExperiences.map((experience, index) => (
                <ExperienceCard
                  experience={experience}
                  key={experience._id || index}
                  userPlans={plans}
                />
              ))}
          </div>
        </>
      ) : (
        <Alert
          type="info"
          className="fade-in"
        >
          <p className="mb-3">
            {lang.en.alert.noExperiencesOrDestinations.replace('{type}',
              uiState.experiences ? 'experiences' :
              uiState.created ? 'created experiences' :
              'destinations'
            ).replace(' Start by adding your first one', isOwner ? ' Start by adding your first one' : '')}
          </p>
          {isOwner && (
            <Link
              to={
                uiState.experiences ? '/experiences' :
                uiState.created ? '/new-experience' :
                '/destinations'
              }
              className="btn btn-primary"
            >
              {lang.en.message.addOneNowButton}
            </Link>
          )}
        </Alert>
      )}

      {/* Super Admin Permissions Section */}
      {isSuperAdmin(user) && !isOwner && currentProfile && (
        <div className="row my-4 fade-in">
          <div className="col-12">
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">Super Admin Permissions</h5>
              </div>
              <div className="card-body">
                <div className="row align-items-center mb-4">
                  <div className="col-md-6">
                    <p className="mb-2">
                      <strong>Current Role:</strong> {USER_ROLE_DISPLAY_NAMES[currentProfile.role] || 'Unknown'}
                    </p>
                    <p className="text-muted small mb-0">
                      Change this user's role. Super admins have full access to all resources and user management.
                    </p>
                  </div>
                  <div className="col-md-6">
                    <div className="d-flex gap-2">
                      <button
                        className={`btn ${currentProfile.role === USER_ROLES.SUPER_ADMIN ? 'btn-success' : 'btn-outline-success'}`}
                        onClick={() => handleRoleUpdate(USER_ROLES.SUPER_ADMIN)}
                        disabled={isUpdatingRole || currentProfile.role === USER_ROLES.SUPER_ADMIN}
                      >
                        {isUpdatingRole ? 'Updating...' : 'Make Super Admin'}
                      </button>
                      <button
                        className={`btn ${currentProfile.role === USER_ROLES.REGULAR_USER ? 'btn-secondary' : 'btn-outline-secondary'}`}
                        onClick={() => handleRoleUpdate(USER_ROLES.REGULAR_USER)}
                        disabled={isUpdatingRole || currentProfile.role === USER_ROLES.REGULAR_USER}
                      >
                        {isUpdatingRole ? 'Updating...' : 'Make Regular User'}
                      </button>
                    </div>
                  </div>
                </div>
                <hr />
                <div className="row align-items-center mt-4">
                  <div className="col-md-6">
                    <p className="mb-2">
                      <strong>Email Status:</strong>{' '}
                      {currentProfile.emailConfirmed ? (
                        <span className="text-success">
                          <FaCheckCircle className="me-1" />
                          Confirmed
                        </span>
                      ) : (
                        <span className="text-warning">Not Confirmed</span>
                      )}
                    </p>
                    <p className="text-muted small mb-0">
                      Manually confirm or unconfirm this user's email address.
                    </p>
                  </div>
                  <div className="col-md-6">
                    <div className="d-flex gap-2">
                      <button
                        className={`btn ${currentProfile.emailConfirmed ? 'btn-success' : 'btn-outline-success'}`}
                        onClick={() => handleEmailConfirmationUpdate(true)}
                        disabled={isUpdatingRole || currentProfile.emailConfirmed}
                      >
                        {isUpdatingRole ? 'Updating...' : 'Confirm Email'}
                      </button>
                      <button
                        className={`btn ${!currentProfile.emailConfirmed ? 'btn-outline-secondary' : 'btn-outline-danger'}`}
                        onClick={() => handleEmailConfirmationUpdate(false)}
                        disabled={isUpdatingRole || !currentProfile.emailConfirmed}
                      >
                        {isUpdatingRole ? 'Updating...' : 'Unconfirm Email'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* API Token Modal */}
      {isSuperAdmin(user) && (
        <ApiTokenModal
          show={showApiTokenModal}
          onHide={handleCloseApiModal}
          user={currentProfile}
          onUserUpdate={handleUserUpdate}
        />
      )}

      {/* Activity Monitor Modal */}
      {isSuperAdmin(user) && (
        <ActivityMonitor
          show={showActivityMonitor}
          onHide={handleCloseActivityMonitor}
        />
      )}
    </>
  );
}

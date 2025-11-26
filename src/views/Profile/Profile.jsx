import { FaUser, FaPassport, FaCheckCircle, FaKey, FaEye } from "react-icons/fa";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from "react";
import styles from "./Profile.module.scss";
import { useUser } from "../../contexts/UserContext";
import { useData } from "../../contexts/DataContext";
import { useApp } from "../../contexts/AppContext";
import PhotoCard from "./../../components/PhotoCard/PhotoCard";
import DestinationCard from "./../../components/DestinationCard/DestinationCard";
import ExperienceCard from "./../../components/ExperienceCard/ExperienceCard";
import SkeletonLoader from "../../components/SkeletonLoader/SkeletonLoader";
import Pagination from '../../components/Pagination/Pagination';
import Alert from "../../components/Alert/Alert";
import Loading from "../../components/Loading/Loading";
import ApiTokenModal from "../../components/ApiTokenModal/ApiTokenModal";
import ActivityMonitor from "../../components/ActivityMonitor/ActivityMonitor";
import { showUserExperiences, showUserCreatedExperiences } from "../../utilities/experiences-api";
import { getUserData, updateUserRole, updateUser as updateUserApi } from "../../utilities/users-api";
import { resendConfirmation } from "../../utilities/users-api";
import { lang } from "../../lang.constants";
import { handleError } from "../../utilities/error-handler";
import PageOpenGraph from "../../components/OpenGraph/PageOpenGraph";
import { deduplicateById } from "../../utilities/deduplication";
import { createUrlSlug } from "../../utilities/url-utils";
import { USER_ROLES, USER_ROLE_DISPLAY_NAMES } from "../../utilities/user-roles";
import { isSuperAdmin } from "../../utilities/permissions";
import { Button, Container, FlexBetween, Heading, Paragraph } from "../../components/design-system";
import { useToast } from '../../contexts/ToastContext';
import TagPill from '../../components/Pill/TagPill';

export default function Profile() {
    const { user, profile, updateUser: updateUserContext } = useUser();
  const { destinations, plans } = useData();
  const { registerH1, clearActionButtons, updateShowH1InNavbar, setPageActionButtons } = useApp();
  const navigate = useNavigate();
  let { profileId } = useParams();

  // Validate profileId format
  if (profileId && (typeof profileId !== 'string' || profileId.length !== 24)) {
    // Invalid profileId format - handled by validation below
  }

  let userId = profileId ? profileId : user._id;
  const isOwner = !profileId || profileId === user._id || isSuperAdmin(user);
  
  // NEVER initialize with profile from context to prevent showing wrong user's data
  const [currentProfile, setCurrentProfile] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState(null);
  const [uiState, setUiState] = useState({
    experiences: true,
    created: false,
    destinations: false,
  });

  const [showApiTokenModal, setShowApiTokenModal] = useState(false);
  const [showActivityMonitor, setShowActivityMonitor] = useState(false);

  // Initialize tab from hash (supports deep links like /profile#created)
  useEffect(() => {
    try {
      const hash = (window.location.hash || '').replace('#', '');
      if (!hash) return;

      // Map known hashes to local profile tabs
      if (['experiences', 'created', 'destinations'].includes(hash)) {
        setUiState({
          experiences: hash === 'experiences',
          created: hash === 'created',
          destinations: hash === 'destinations',
        });
        return;
      }

      // If hash targets dashboard tabs, navigate there preserving hash
      if (hash === 'plans' || hash === 'preferences') {
        // push a navigation entry so users can go back
        navigate(`/dashboard#${hash}`);
        return;
      }

      // Support modal deep-links on profile
      if (hash === 'api-token') {
        setShowApiTokenModal(true);
        return;
      }
      if (hash === 'activity-monitor') {
        setShowActivityMonitor(true);
        return;
      }
    } catch (e) {
      // ignore
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep UI tab state in sync when hash changes externally
  useEffect(() => {
    const onHashChange = () => {
      try {
        const hash = (window.location.hash || '').replace('#', '');

        // Empty hash - close modals if open
        if (!hash) {
          if (showApiTokenModal) setShowApiTokenModal(false);
          if (showActivityMonitor) setShowActivityMonitor(false);
          return;
        }

        if (['experiences', 'created', 'destinations'].includes(hash)) {
          setUiState({
            experiences: hash === 'experiences',
            created: hash === 'created',
            destinations: hash === 'destinations',
          });
          return;
        }

        if (hash === 'plans' || hash === 'preferences') {
          // push navigation entry to dashboard
          navigate(`/dashboard#${hash}`);
          return;
        }

        // Modal hashes
        if (hash === 'api-token') {
          setShowApiTokenModal(true);
          return;
        }
        if (hash === 'activity-monitor') {
          setShowActivityMonitor(true);
          return;
        }
        // Unknown hash - ignore
      } catch (e) {
        // ignore
      }
    };

    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [navigate, showApiTokenModal, showActivityMonitor]);
  const [userExperiences, setUserExperiences] = useState([]);
  const [createdExperiences, setCreatedExperiences] = useState([]);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const { success, error: showError } = useToast();
  const [resendInProgress, setResendInProgress] = useState(false);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [showAllExperienceTypes, setShowAllExperienceTypes] = useState(false);
  const [showAllPlanned, setShowAllPlanned] = useState(false);
  const [showAllCreated, setShowAllCreated] = useState(false);
  const [showAllDestinations, setShowAllDestinations] = useState(false);
  const COOLDOWN_SECONDS = 60;
  const COOLDOWN_KEY_PREFIX = 'resend_verification_cooldown_';
  const EXPERIENCE_TYPES_INITIAL_DISPLAY = 10;
  const ITEMS_INITIAL_DISPLAY = 6;
  // Pagination for profile tabs: pages computed responsively (cards-per-row * 2 rows)
  const [experiencesPage, setExperiencesPage] = useState(1);
  const [createdPage, setCreatedPage] = useState(1);
  const [destinationsPage, setDestinationsPage] = useState(1);
  const reservedRef = useRef(null);
  const [itemsPerPageComputed, setItemsPerPageComputed] = useState(ITEMS_INITIAL_DISPLAY);

  /**
   * Merge helper function to update profile state without full replacement
   * Preserves unchanged data and prevents UI flashing
   */
  const mergeProfile = useCallback((updates) => {
    setCurrentProfile(prev => {
      if (!prev) return updates; // First load - use full data
      if (!updates) return prev; // No updates - keep existing
      return { ...prev, ...updates }; // Merge - preserve unchanged data
    });
  }, []);

  // Start a cooldown for the given email and persist to localStorage
  const startCooldown = (email) => {
    if (!email) return;
    const key = COOLDOWN_KEY_PREFIX + email;
    const expiresAt = Date.now() + COOLDOWN_SECONDS * 1000;
    try {
      localStorage.setItem(key, String(expiresAt));
    } catch (e) {
      // ignore localStorage errors
    }
    setResendDisabled(true);
    setCooldownRemaining(COOLDOWN_SECONDS);
    const timer = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          try { localStorage.removeItem(key); } catch (e) {}
          setResendDisabled(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // On profile load, restore any existing cooldown for this email
  useEffect(() => {
    if (!currentProfile || !currentProfile.email) return;
    const key = COOLDOWN_KEY_PREFIX + currentProfile.email;
    try {
      const expires = localStorage.getItem(key);
      if (!expires) return;
      const expiresAt = parseInt(expires, 10);
      const now = Date.now();
      if (expiresAt > now) {
        const remaining = Math.ceil((expiresAt - now) / 1000);
        setResendDisabled(true);
        setCooldownRemaining(remaining);
        const timer = setInterval(() => {
          const rem = Math.ceil((expiresAt - Date.now()) / 1000);
          if (rem <= 0) {
            clearInterval(timer);
            try { localStorage.removeItem(key); } catch (e) {}
            setResendDisabled(false);
            setCooldownRemaining(0);
          } else {
            setCooldownRemaining(rem);
          }
        }, 1000);
        return () => clearInterval(timer);
      } else {
        try { localStorage.removeItem(key); } catch (e) {}
      }
    } catch (e) {
      // ignore
    }
  }, [currentProfile]);

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

  // Load profile from context for owner, or fetch for other users
  useEffect(() => {
    if (isOwner && profile && profile._id === userId) {
      // Owner viewing their own profile - use context
      setCurrentProfile(profile);
      setIsLoadingProfile(false);
    } else if (!isOwner || !profile) {
      // Viewing another user or profile not loaded yet
      setCurrentProfile(null);
      setIsLoadingProfile(true);
    }
  }, [profileId, isOwner, profile, userId]);

  const handleRoleUpdate = async (newRole) => {
    if (!isSuperAdmin(user)) {
      handleError({ message: 'Only super admins can update user roles' });
      return;
    }

    setIsUpdatingRole(true);
    try {
      await updateUserRole(profileId, { role: newRole });
      // ✅ MERGE only changed field - no full refetch
      mergeProfile({ role: newRole });
      const message = lang.en.notification?.admin?.roleUpdated?.replace('{role}', newRole) || `User role updated to ${newRole}`;
      success(message);
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
      // ✅ MERGE only changed field - no full refetch
      mergeProfile({ emailConfirmed });
      const action = emailConfirmed ? 'confirmed' : 'unconfirmed';
      const message = lang.en.notification?.admin?.emailConfirmed?.replace('{action}', action) || `Email ${action} successfully`;
      success(message);
    } catch (error) {
      handleError(error);
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const handleUserUpdate = useCallback(async () => {
    // ✅ SINGLE REFETCH only if needed (API token changes require full user context update)
    if (isOwner && updateUserContext) {
      const freshUserData = await getUserData(user._id);
      updateUserContext(freshUserData);
      // Merge fresh data into profile (avoids double refetch)
      mergeProfile(freshUserData);
    }
  }, [isOwner, updateUserContext, user._id, mergeProfile]);

  const handleOpenApiModal = useCallback(() => {
    try { window.history.pushState(null, '', `${window.location.pathname}#api-token`); } catch (e) {}
    setShowApiTokenModal(true);
  }, []);

  const handleCloseApiModal = useCallback(() => {
    try { window.history.pushState(null, '', window.location.pathname + window.location.search); } catch (e) {}
    setShowApiTokenModal(false);
  }, []);

  const handleOpenActivityMonitor = useCallback(() => {
    try { window.history.pushState(null, '', `${window.location.pathname}#activity-monitor`); } catch (e) {}
    setShowActivityMonitor(true);
  }, []);

  const handleCloseActivityMonitor = useCallback(() => {
    try { window.history.pushState(null, '', window.location.pathname + window.location.search); } catch (e) {}
    setShowActivityMonitor(false);
  }, []);

  useEffect(() => {
    getProfile();
  }, [getProfile]);

  // Listen for user profile update events
  useEffect(() => {
    const handleUserUpdated = (event) => {
      const { user: updatedUser } = event.detail || {};
      if (updatedUser && updatedUser._id === userId) {
        logger.debug('[Profile] User updated event received', { id: updatedUser._id });
        setCurrentProfile(updatedUser);
      }
    };

    window.addEventListener('user:updated', handleUserUpdated);
    return () => {
      window.removeEventListener('user:updated', handleUserUpdated);
    };
  }, [userId]);

  // Register h1 for navbar integration (but disable showing in navbar for Profile)
  useEffect(() => {
    const h1 = document.querySelector('h1');
    if (h1) {
      registerH1(h1);
      
      // Disable showing h1 in navbar for Profile view to prevent flashing
      updateShowH1InNavbar(false);

      // Set action buttons if user is viewing their own profile
      if (isOwner && user) {
        setPageActionButtons([
          {
            label: "Edit Profile",
            onClick: () => navigate('/profile/update'),
            variant: "outline-primary",
            icon: "✏️",
            tooltip: "Edit Your Profile",
            compact: true,
          },
        ]);
      } else {
        clearActionButtons();
      }
    }

    return () => {
      clearActionButtons();
      // Re-enable h1 in navbar for other views
      updateShowH1InNavbar(true);
    };
  }, [registerH1, clearActionButtons, updateShowH1InNavbar, setPageActionButtons, isOwner, user, navigate]);

  const handleExpNav = useCallback((view) => {
    setUiState({
      experiences: view === 'experiences',
      created: view === 'created',
      destinations: view === 'destinations',
    });
    // Reset pagination to first page on tab switch
    setExperiencesPage(1);
    setCreatedPage(1);
    setDestinationsPage(1);
  }, []);

  // Compute items per page responsively based on container width and card widths
  useLayoutEffect(() => {
    if (!reservedRef.current) return;

    const rootFontSize = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

    const compute = (width) => {
      const gapPx = 16; // fallback gap between cards
      // choose card width depending on active tab (destinations use smaller cards)
      const defaultCardRem = uiState.destinations ? 12 : 20;
      const cardWidthPx = defaultCardRem * rootFontSize();
      const cardsPerRow = Math.max(1, Math.floor((width + gapPx) / (cardWidthPx + gapPx)));
      const newItems = Math.max(1, cardsPerRow * 2); // 2 rows reserved
      setItemsPerPageComputed(newItems);
    };

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        compute(entry.contentRect.width);
      }
    });

    ro.observe(reservedRef.current);
    // initial compute
    compute(reservedRef.current.getBoundingClientRect().width);

    return () => ro.disconnect();
  }, [uiState.destinations, uiState.experiences, uiState.created]);

  // Numbered pagination is provided by shared <Pagination /> component
  
  // Show error state if profile not found
  if (profileError === 'User not found') {
    return (
      <div className="container my-5">
        <Container className="justify-content-center">
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
        </Container>
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
                <Button onClick={getProfile} variant="primary">{lang.en.button.tryAgain}</Button>
              </p>
            </Alert>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div>
      {currentProfile && (
        <PageOpenGraph
          title={`${currentProfile.name}'s Profile`}
          description={`View ${currentProfile.name}'s travel profile on Biensperience. Discover their planned experiences${uniqueUserExperiences.length > 0 ? ` (${uniqueUserExperiences.length} experiences)` : ''} and favorite destinations${favoriteDestinations.length > 0 ? ` (${favoriteDestinations.length} destinations)` : ''}.`}
          keywords={`${currentProfile.name}, travel profile, experiences, destinations, travel planning${userExperienceTypes.length > 0 ? `, ${userExperienceTypes.join(', ')}` : ''}`}
          ogTitle={`${currentProfile.name} on Biensperience`}
          ogDescription={`${currentProfile.name} is planning ${uniqueUserExperiences.length} travel experiences${favoriteDestinations.length > 0 ? ` across ${favoriteDestinations.length} favorite destinations` : ''}.`}
          entity={currentProfile}
          entityType="user"
        />
      )}
      <div className="profile-dropdown-view">
        <div className="view-header">
          <div className="row">
            <div className="col-md-6">
              <h1 className="mb-0">
                  {isLoadingProfile ? (
                    <span className="loading-skeleton loading-skeleton-text"></span>
                  ) : (
                    <>
                      {currentProfile?.name}
                      {currentProfile?.emailConfirmed && (
                        <FaCheckCircle
                          className="text-success ms-2 font-size-adjust-xs"
                          title={lang.en.aria.emailConfirmed}
                          aria-label={lang.en.aria.emailConfirmed}
                        />
                      )}
                    </>
                  )}
                </h1>
              </div>
              <div className="col-md-6">
                <div className="header-actions">
                  {!isLoadingProfile && (
                    <div className="dropdown">
                      <Button
                        variant="bootstrap"
                        bootstrapVariant="outline-secondary"
                        type="button"
                        data-bs-toggle="dropdown"
                        aria-expanded="false"
                        aria-label={lang.en.aria.profileActions}
                      >
                        ⋯
                      </Button>
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
                        {isOwner && currentProfile && !currentProfile.emailConfirmed && (
                          <li>
                            <button
                              className="dropdown-item"
                              type="button"
                              onClick={async () => {
                                if (!currentProfile || !currentProfile.email) return;
                                // prevent clicks while already in progress or cooldown
                                if (resendInProgress || resendDisabled) return;
                                try {
                                  setResendInProgress(true);
                                  await resendConfirmation(currentProfile.email);
                                  // start cooldown after successful send
                                  startCooldown(currentProfile.email);
                                  success(lang.en.success.resendConfirmation);
                                } catch (err) {
                                  const msg = handleError(err, { context: 'Resend verification' });
                                  showError(msg || 'Failed to resend verification email');
                                } finally {
                                  setResendInProgress(false);
                                }
                              }}
                              disabled={resendInProgress || resendDisabled}
                            >
                              🔁 {lang.en.alert.emailNotVerifiedAction} {resendDisabled && cooldownRemaining > 0 ? `(${cooldownRemaining}s)` : ''}
                            </button>
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
          </div>
        </div>
      <div className="row mb-4 animation-fade_in">
        <div className="col-md-6 p-3 animation-fade_in">
          {isLoadingProfile ? (
            <div className="photoCard d-flex align-items-center justify-content-center" style={{ minHeight: 'var(--layout-min-height-card)' }}>
              <Loading size="lg" message="Loading profile photos..." />
            </div>
          ) : (
            <>
              <PhotoCard
                photos={currentProfile?.photos}
                defaultPhotoId={currentProfile?.default_photo_id}
                title={currentProfile?.name}
              />
              {!currentProfile?.photos?.length && isOwner && (
                <small className="d-flex justify-content-center align-items-center noPhoto animation-fade_in">
                  <span>{lang.en.message.noPhotoMessage} <Link to="/profile/update">{lang.en.message.uploadPhotoNow}</Link></span>
                </small>
              )}
            </>
          )}
        </div>
        <div className="col-md-6 p-3 animation-fade_in">
          <div className={`${styles.profileDetailCard} animation-fade_in`}>
            <div className={styles.profileDetailSection}>
              <Heading level={3} className={styles.profileDetailSectionTitle}>
                {lang.en.heading.favoriteDestinations}
              </Heading>
              <div className={`${styles.profileDetailContent} ${styles.profileDestinations}`}>
                {isLoadingProfile ? (
                  <Loading size="md" message="Loading favorite destinations..." />
                ) : favoriteDestinations.length > 0 ? (
                    favoriteDestinations.map((destination) => (
                      <TagPill key={destination._id} color="light" to={`/destinations/${destination._id}`}>
                        <span className="icon"><FaPassport /></span>
                        {destination.name}
                      </TagPill>
                  ))
                ) : (
                  <div className={`${styles.noFavoriteDestinations} animation-fade_in`}>
                    {isOwner ? (
                      <>
                        <p className="mb-3">{lang.en.message.noFavoriteDestinations}</p>
                        <Button as={Link} to="/destinations" variant="primary" size="sm">
                          {lang.en.message.addFavoriteDestinations}
                        </Button>
                      </>
                    ) : (
                    <>
                      <p className="mb-3">{`${currentProfile?.name || 'This user'} hasn't added any favorite destinations yet.`}</p>
                      <Button as={Link} to="/destinations" variant="primary" size="sm">
                        Explore Destinations
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className={styles.profileDetailSection}>
              <Heading level={3} className={styles.profileDetailSectionTitle}>
                {lang.en.heading.preferredExperienceTypes}
              </Heading>
              <div className={styles.profileDetailContent}>
                {(isLoadingProfile || (isOwner && userExperiences.length === 0)) ? (
                  <Loading size="md" message="Loading preferred experience types..." />
                ) : userExperienceTypes.length > 0 ? (
                  <>
                    {(showAllExperienceTypes ? userExperienceTypes : userExperienceTypes.slice(0, EXPERIENCE_TYPES_INITIAL_DISPLAY)).map((type) => (
                      <TagPill key={type} color="light" size="sm" to={`/experience-types/${createUrlSlug(type)}`}>
                        <span className="icon"><FaUser /></span>
                        {type}
                      </TagPill>
                    ))}
                    {userExperienceTypes.length > EXPERIENCE_TYPES_INITIAL_DISPLAY && (
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => setShowAllExperienceTypes(!showAllExperienceTypes)}
                        style={{ marginTop: 'var(--space-2)' }}
                      >
                        {showAllExperienceTypes ? 'Show Less' : 'Show More'}
                      </Button>
                    )}
                  </>
                ) : (
                  <div className="animation-fade_in">
                    {isOwner ? (
                      <>
                        <p className="mb-3">{lang.en.message.noExperiencesYet}</p>
                        <Button as={Link} to="/experiences" variant="primary" size="sm">
                          {lang.en.message.addExperiences}
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="mb-3">{`${currentProfile?.name || 'This user'} hasn't planned any experiences yet.`}</p>
                        <Button as={Link} to="/experiences" variant="primary" size="sm">
                          Discover Experiences
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="row my-4 animation-fade_in">
        <h4 className={`badge rounded-pill ${styles.badgeNav} my-4 animation-fade_in`}>
          <span
            className={uiState.experiences ? `fw-bold animation-fade_in ${styles.activeTab}` : "animation-fade_in"}
            onClick={() => {
              handleExpNav('experiences');
              try { window.history.pushState(null, '', `${window.location.pathname}#experiences`); } catch (e) {}
            }}
          >
            {lang.en.heading.plannedExperiences}
          </span>
          <span
            className={uiState.created ? "fw-bold animation-fade_in active-tab" : "animation-fade_in"}
            onClick={() => {
              handleExpNav('created');
              try { window.history.pushState(null, '', `${window.location.pathname}#created`); } catch (e) {}
            }}
          >
            {lang.en.heading.createdExperiences || 'Created Experiences'}
          </span>
          <span
            className={uiState.destinations ? "fw-bold animation-fade_in active-tab" : "animation-fade_in"}
            onClick={() => {
              handleExpNav('destinations');
              try { window.history.pushState(null, '', `${window.location.pathname}#destinations`); } catch (e) {}
            }}
          >
            {lang.en.heading.experienceDestinations}
          </span>
        </h4>
      </div>
      <div className="row my-4 justify-content-center animation-fade_in">
        <div ref={reservedRef} className={styles.profileCardsReserved}>
        {uiState.destinations && (() => {
          const uniqueDestinationIds = Array.from(
            new Set(
              uniqueUserExperiences.map(
                (experience) => experience.destination._id
              )
            )
          );
          const displayedDestinations = showAllDestinations
            ? uniqueDestinationIds
            : uniqueDestinationIds.slice((destinationsPage - 1) * itemsPerPageComputed, (destinationsPage - 1) * itemsPerPageComputed + itemsPerPageComputed);

          const destTotalPages = Math.max(1, Math.ceil(uniqueDestinationIds.length / itemsPerPageComputed));

          return uniqueDestinationIds.length > 0 ? (
            <>
              {displayedDestinations.map((destinationId, index) => {
                const destination = destinations.filter((dest) => dest._id === destinationId)[0];
                return destination ? (
                  <DestinationCard
                    key={destination._id || index}
                    destination={destination}
                  />
                ) : null;
              })}
              {/* Pagination controls for destinations - only show if items exceed one page */}
              {(!showAllDestinations && uniqueDestinationIds.length > itemsPerPageComputed) && (
                <Pagination currentPage={destinationsPage} totalPages={destTotalPages} onPageChange={setDestinationsPage} />
              )}
              {/* Only show placeholders on non-last pages to reserve space */}
              {!showAllDestinations && destinationsPage < destTotalPages && displayedDestinations.length < itemsPerPageComputed && (
                Array.from({ length: Math.max(0, itemsPerPageComputed - displayedDestinations.length) }).map((_, i) => (
                  <div key={`placeholder-dest-${i}`} className="d-block m-2" style={{ width: '12rem' }}>
                    <div className="position-relative" style={{ minHeight: '8rem' }}>
                      <div aria-hidden="true" className="position-absolute w-100 h-100 start-0 top-0">
                        <SkeletonLoader variant="rectangle" width="100%" height="100%" />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </>
          ) : (
            <Alert
              type="info"
              className="animation-fade_in text-center"
            >
              <p className="mb-3">
                {isOwner
                  ? "You haven't visited any destinations through your experiences yet. Plan some experiences to see destinations here."
                  : `${currentProfile?.name || 'This user'} hasn't visited any destinations through their experiences yet.`
                }
              </p>
              {isOwner && (
                <Button as={Link} to="/experiences" variant="primary">
                  {lang.en.message.addExperiences}
                </Button>
              )}
            </Alert>
          );
        })()}
        {uiState.experiences && (() => {
          const expTotalPages = Math.max(1, Math.ceil(uniqueUserExperiences.length / itemsPerPageComputed));
          const displayedExperiences = showAllPlanned
            ? uniqueUserExperiences
            : uniqueUserExperiences.slice((experiencesPage - 1) * itemsPerPageComputed, (experiencesPage - 1) * itemsPerPageComputed + itemsPerPageComputed);

          return uniqueUserExperiences.length > 0 ? (
            <>
              {displayedExperiences.map((experience, index) => (
                <ExperienceCard
                  experience={experience}
                  key={experience._id || index}
                  userPlans={plans}
                />
              ))}
              {/* Only show pagination if items exceed one page */}
              {(!showAllPlanned && uniqueUserExperiences.length > itemsPerPageComputed) && (
                <Pagination currentPage={experiencesPage} totalPages={expTotalPages} onPageChange={setExperiencesPage} />
              )}
              {/* Only show placeholders on non-last pages to reserve space */}
              {!showAllPlanned && experiencesPage < expTotalPages && displayedExperiences.length < itemsPerPageComputed && (
                Array.from({ length: Math.max(0, itemsPerPageComputed - displayedExperiences.length) }).map((_, i) => (
                  <div key={`placeholder-exp-${i}`} className="d-block m-2" style={{ width: '20rem' }}>
                    <div className="position-relative" style={{ minHeight: '12rem' }}>
                      <div aria-hidden="true" className="position-absolute w-100 h-100 start-0 top-0">
                        <SkeletonLoader variant="rectangle" width="100%" height="100%" />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </>
          ) : (
            <Alert
              type="info"
              className="animation-fade_in text-center"
            >
              <p className="mb-3">
                {isOwner
                  ? lang.en.message.noExperiencesYet
                  : `${currentProfile?.name || 'This user'} hasn't planned any experiences yet.`
                }
              </p>
              {isOwner && (
                <Button as={Link} to="/experiences" variant="primary">
                  {lang.en.message.addExperiences}
                </Button>
              )}
            </Alert>
          );
        })()}
        {uiState.created && (() => {
          const createdTotalPages = Math.max(1, Math.ceil(uniqueCreatedExperiences.length / itemsPerPageComputed));
          const displayedCreated = showAllCreated
            ? uniqueCreatedExperiences
            : uniqueCreatedExperiences.slice((createdPage - 1) * itemsPerPageComputed, (createdPage - 1) * itemsPerPageComputed + itemsPerPageComputed);

          return uniqueCreatedExperiences.length > 0 ? (
            <>
              {displayedCreated.map((experience, index) => (
                <ExperienceCard
                  experience={experience}
                  key={experience._id || index}
                  userPlans={plans}
                />
              ))}
              {/* Only show pagination if items exceed one page */}
              {(!showAllCreated && uniqueCreatedExperiences.length > itemsPerPageComputed) && (
                <Pagination currentPage={createdPage} totalPages={createdTotalPages} onPageChange={setCreatedPage} />
              )}
              {/* Only show placeholders on non-last pages to reserve space */}
              {!showAllCreated && createdPage < createdTotalPages && displayedCreated.length < itemsPerPageComputed && (
                Array.from({ length: Math.max(0, itemsPerPageComputed - displayedCreated.length) }).map((_, i) => (
                  <div key={`placeholder-created-${i}`} className="d-block m-2" style={{ width: '20rem' }}>
                    <div className="position-relative" style={{ minHeight: '12rem' }}>
                      <div aria-hidden="true" className="position-absolute w-100 h-100 start-0 top-0">
                        <SkeletonLoader variant="rectangle" width="100%" height="100%" />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </>
          ) : (
            <Alert
              type="info"
              className="animation-fade_in text-center"
            >
              <p className="mb-3">
                {isOwner
                  ? "You haven't created any experiences yet. Share your travel knowledge with the community."
                  : `${currentProfile?.name || 'This user'} hasn't created any experiences yet.`
                }
              </p>
              {isOwner && (
                <Button as={Link} to="/experiences/new" variant="primary">
                  {lang.en.message.addOneNowButton}
                </Button>
              )}
            </Alert>
          );
        })()}
      </div>
      </div>      {/* Super Admin Permissions Section */}
      {isSuperAdmin(user) && !isOwner && currentProfile && (
        <div className="row my-4 animation-fade_in">
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
                    <p className="small mb-0" style={{ color: 'var(--bs-gray-600)' }}>
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
                    <p className="small mb-0" style={{ color: 'var(--bs-gray-600)' }}>
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
      </div>
    </div>
  );
}

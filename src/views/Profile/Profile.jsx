import { FaUser, FaPassport, FaCheckCircle, FaKey, FaEye, FaEdit, FaEnvelope, FaUserShield, FaMapMarkerAlt, FaPlane, FaHeart, FaCamera } from "react-icons/fa";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from "react";
import styles from "./Profile.module.scss";
import { useUser } from "../../contexts/UserContext";
import { useData } from "../../contexts/DataContext";
import { useApp } from "../../contexts/AppContext";
import { useExperienceWizard } from "../../contexts/ExperienceWizardContext";
import DestinationCard from "./../../components/DestinationCard/DestinationCard";
import ExperienceCard from "./../../components/ExperienceCard/ExperienceCard";
import SkeletonLoader from "../../components/SkeletonLoader/SkeletonLoader";
import Pagination from '../../components/Pagination/Pagination';
import Alert from "../../components/Alert/Alert";
import Loading from "../../components/Loading/Loading";
import ApiTokenModal from "../../components/ApiTokenModal/ApiTokenModal";
import ActivityMonitor from "../../components/ActivityMonitor/ActivityMonitor";
import PhotoModal from "../../components/PhotoModal/PhotoModal";
import { showUserExperiences, showUserCreatedExperiences } from "../../utilities/experiences-api";
import { getUserData, updateUserRole, updateUser as updateUserApi } from "../../utilities/users-api";
import { resendConfirmation } from "../../utilities/users-api";
import { lang } from "../../lang.constants";
import { handleError } from "../../utilities/error-handler";
import PageOpenGraph from "../../components/OpenGraph/PageOpenGraph";
import { deduplicateById } from "../../utilities/deduplication";
import { USER_ROLES, USER_ROLE_DISPLAY_NAMES } from "../../utilities/user-roles";
import { isSuperAdmin } from "../../utilities/permissions";
import { Button, EmptyState, Container, EntityNotFound } from "../../components/design-system";
import { Card, Row, Col } from "react-bootstrap";
import { useToast } from '../../contexts/ToastContext';
import { getDefaultPhoto } from "../../utilities/photo-utils";
import { getFirstName } from "../../utilities/name-utils";
import { formatLocation } from "../../utilities/address-utils";
import { logger } from "../../utilities/logger";
import { eventBus } from "../../utilities/event-bus";

export default function Profile() {
    const { user, profile, updateUser: updateUserContext } = useUser();
  const { destinations, plans } = useData();
  const { registerH1, clearActionButtons, updateShowH1InNavbar, setPageActionButtons } = useApp();
  const { openExperienceWizard } = useExperienceWizard();
  const navigate = useNavigate();
  let { profileId } = useParams();

  // Validate profileId format
  if (profileId && (typeof profileId !== 'string' || profileId.length !== 24)) {
    // Invalid profileId format - handled by validation below
  }

  let userId = profileId ? profileId : user._id;
  const isOwner = !profileId || profileId === user._id || isSuperAdmin(user);
  // For empty state messaging, only check if viewing own profile (not super admin override)
  const isOwnProfile = !profileId || profileId === user._id;
  
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
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

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
  // Experiences state with pagination metadata
  const [userExperiences, setUserExperiences] = useState(null);
  const [userExperiencesMeta, setUserExperiencesMeta] = useState(null);
  const [createdExperiences, setCreatedExperiences] = useState(null);
  const [createdExperiencesMeta, setCreatedExperiencesMeta] = useState(null);
  const [experiencesLoading, setExperiencesLoading] = useState(false);
  const [createdLoading, setCreatedLoading] = useState(false);
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
  const ITEMS_PER_PAGE = 6; // Fixed items per page for API pagination
  // Pagination for profile tabs
  const [experiencesPage, setExperiencesPage] = useState(1);
  const [createdPage, setCreatedPage] = useState(1);
  const [destinationsPage, setDestinationsPage] = useState(1);
  const reservedRef = useRef(null);
  const [itemsPerPageComputed, setItemsPerPageComputed] = useState(ITEMS_PER_PAGE);
  // Track if initial page 1 has been loaded (to distinguish from user navigation back to page 1)
  const experiencesInitialLoadRef = useRef(true);
  const createdInitialLoadRef = useRef(true);

  /**
   * Merge helper function to update profile state without full replacement
   * Preserves unchanged data and prevents UI flashing
   * Smart merge: preserves populated arrays when incoming data is unpopulated
   */
  const mergeProfile = useCallback((updates) => {
    setCurrentProfile(prev => {
      if (!prev) return updates; // First load - use full data
      if (!updates) return prev; // No updates - keep existing

      // Smart merge for photos: preserve populated photos if incoming is unpopulated
      const mergedPhotos = (() => {
        if (!updates.photos) return prev.photos; // No photos in update - keep existing
        if (!prev.photos || prev.photos.length === 0) return updates.photos; // No existing photos

        // Check if incoming photos are unpopulated (just ObjectId strings)
        const isUnpopulated = updates.photos.length > 0 &&
          typeof updates.photos[0] === 'string';

        // If incoming is unpopulated but we have populated data, keep existing
        if (isUnpopulated && prev.photos.length > 0 && typeof prev.photos[0] === 'object') {
          return prev.photos;
        }

        return updates.photos;
      })();

      return { ...prev, ...updates, photos: mergedPhotos };
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
  // Returns null if userExperiences is null (loading state), empty array if loaded but no data
  const uniqueUserExperiences = useMemo(() => {
    if (userExperiences === null) return null; // Loading state
    return deduplicateById(userExperiences) || [];
  }, [userExperiences]);

  // Deduplicate created experiences by ID
  // Returns null if createdExperiences is null (loading state), empty array if loaded but no data
  const uniqueCreatedExperiences = useMemo(() => {
    if (createdExperiences === null) return null; // Loading state
    return deduplicateById(createdExperiences) || [];
  }, [createdExperiences]);

  const userExperienceTypes = useMemo(() => {
    if (!uniqueUserExperiences) return [];

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
    if (!currentProfile) return null; // Loading state
    const filtered = destinations.filter(
      (destination) =>
        destination.users_favorite.indexOf(currentProfile._id) !== -1
    );
    return deduplicateById(filtered);
  }, [destinations, currentProfile]);

  // Fetch user experiences with pagination
  const fetchUserExperiences = useCallback(async (page = 1) => {
    if (!userId) return;
    setExperiencesLoading(true);
    try {
      const response = await showUserExperiences(userId, { page, limit: ITEMS_PER_PAGE });
      // Handle paginated response
      if (response && response.data) {
        setUserExperiences(response.data);
        setUserExperiencesMeta(response.meta);
      } else {
        // Backwards compatible: array response (shouldn't happen with pagination)
        setUserExperiences(response || []);
        setUserExperiencesMeta(null);
      }
    } catch (err) {
      handleError(err, { context: 'Load experiences' });
    } finally {
      setExperiencesLoading(false);
    }
  }, [userId]);

  // Fetch created experiences with pagination
  const fetchCreatedExperiences = useCallback(async (page = 1) => {
    if (!userId) return;
    setCreatedLoading(true);
    try {
      const response = await showUserCreatedExperiences(userId, { page, limit: ITEMS_PER_PAGE });
      // Handle paginated response
      if (response && response.data) {
        setCreatedExperiences(response.data);
        setCreatedExperiencesMeta(response.meta);
      } else {
        // Backwards compatible: array response (shouldn't happen with pagination)
        setCreatedExperiences(response || []);
        setCreatedExperiencesMeta(null);
      }
    } catch (err) {
      handleError(err, { context: 'Load created experiences' });
    } finally {
      setCreatedLoading(false);
    }
  }, [userId]);

  const getProfile = useCallback(async () => {
    if (!isOwner) {
      setIsLoadingProfile(true);
    }
    setProfileError(null);

    // Validate userId before API calls
    if (!userId || typeof userId !== 'string' || userId.length !== 24) {
      setProfileError(lang.current.alert.invalidUserId);
      setIsLoadingProfile(false);
      return;
    }

    try {
      // Fetch profile and first page of experiences in parallel
      const [userData, experienceResponse, createdResponse] = await Promise.all([
        getUserData(userId),
        showUserExperiences(userId, { page: 1, limit: ITEMS_PER_PAGE }),
        showUserCreatedExperiences(userId, { page: 1, limit: ITEMS_PER_PAGE })
      ]);
      setCurrentProfile(userData);
      // Handle paginated response
      if (experienceResponse && experienceResponse.data) {
        setUserExperiences(experienceResponse.data);
        setUserExperiencesMeta(experienceResponse.meta);
      } else {
        setUserExperiences(experienceResponse || []);
        setUserExperiencesMeta(null);
      }
      if (createdResponse && createdResponse.data) {
        setCreatedExperiences(createdResponse.data);
        setCreatedExperiencesMeta(createdResponse.meta);
      } else {
        setCreatedExperiences(createdResponse || []);
        setCreatedExperiencesMeta(null);
      }
    } catch (err) {
      // Check if it's a 404 error
      if (err.message && err.message.includes('404')) {
        setProfileError(lang.current.alert.userNotFound);
      } else {
        handleError(err, { context: 'Load profile' });
        setProfileError(lang.current.alert.failedToLoadProfile);
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
      const message = lang.current.notification?.admin?.roleUpdated?.replace('{role}', newRole) || `User role updated to ${newRole}`;
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
      const message = lang.current.notification?.admin?.emailConfirmed?.replace('{action}', action) || `Email ${action} successfully`;
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
      // Event bus spreads payload at top level
      const updatedUser = event.user;
      if (updatedUser && updatedUser._id === userId) {
        logger.debug('[Profile] User updated event received', { id: updatedUser._id });
        setCurrentProfile(updatedUser);
      }
    };

    const unsubscribe = eventBus.subscribe('user:updated', handleUserUpdated);
    return () => unsubscribe();
  }, [userId]);

  // Register h1 for navbar integration - clicking scrolls to top
  // Re-run when currentProfile loads so h1 element is available
  useEffect(() => {
    const h1 = document.querySelector('h1');
    if (h1) {
      registerH1(h1);

      // Enable h1 text in navbar - clicking scrolls to top
      updateShowH1InNavbar(true);

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
      // Disable h1 in navbar when leaving this view
      updateShowH1InNavbar(false);
    };
  }, [registerH1, clearActionButtons, updateShowH1InNavbar, setPageActionButtons, isOwner, user, navigate, currentProfile]);

  const handleExpNav = useCallback((view) => {
    setUiState({
      experiences: view === 'experiences',
      created: view === 'created',
      destinations: view === 'destinations',
    });
    // Note: Do NOT reset pagination on tab switch - preserve user's place in each tab
  }, []);

  // Fetch experiences when page changes (API-level pagination)
  // Skip initial page 1 (fetched by getProfile), but fetch on subsequent page 1 navigations
  useEffect(() => {
    if (!userId) return;
    if (experiencesPage === 1 && experiencesInitialLoadRef.current) {
      // Skip - page 1 already fetched by getProfile on initial load
      experiencesInitialLoadRef.current = false;
      return;
    }
    fetchUserExperiences(experiencesPage);
  }, [experiencesPage, userId, fetchUserExperiences]);

  // Fetch created experiences when page changes (API-level pagination)
  // Skip initial page 1 (fetched by getProfile), but fetch on subsequent page 1 navigations
  useEffect(() => {
    if (!userId) return;
    if (createdPage === 1 && createdInitialLoadRef.current) {
      // Skip - page 1 already fetched by getProfile on initial load
      createdInitialLoadRef.current = false;
      return;
    }
    fetchCreatedExperiences(createdPage);
  }, [createdPage, userId, fetchCreatedExperiences]);

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
      <div style={{ padding: 'var(--space-20) 0' }}>
        <Container>
          <EntityNotFound entityType="user" />
        </Container>
      </div>
    );
  }
  
  // Show general error state
  if (profileError) {
    return (
      <div style={{ padding: 'var(--space-20) 0' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ maxWidth: '32rem' }}>
            <Alert
              type="warning"
              title={lang.current.modal.unableToLoadProfile || 'Unable to Load Profile'}
            >
              <p>{profileError}</p>
              <hr />
              <p style={{ marginBottom: 0 }}>
                <Button onClick={getProfile} variant="primary">{lang.current.button.tryAgain}</Button>
              </p>
            </Alert>
          </div>
        </div>
      </div>
    );
  }
  
  // Get user's avatar photo
  const avatarPhoto = useMemo(() => {
    if (!currentProfile?.photos?.length) return null;
    return getDefaultPhoto(currentProfile);
  }, [currentProfile]);

  // Safe counts for arrays that may be null while loading
  const uniqueUserExperiencesCount = uniqueUserExperiences ? uniqueUserExperiences.length : 0;
  const uniqueCreatedExperiencesCount = uniqueCreatedExperiences ? uniqueCreatedExperiences.length : 0;
  const favoriteDestinationsCount = favoriteDestinations ? favoriteDestinations.length : 0;

  return (
    <div style={{ backgroundColor: 'var(--color-bg-primary)', minHeight: '100vh', padding: 'var(--space-8) 0' }}>
      {currentProfile && (
        <PageOpenGraph
          title={`${currentProfile.name}'s Profile`}
          description={`View ${currentProfile.name}'s travel profile on Biensperience. Discover their planned experiences${uniqueUserExperiencesCount > 0 ? ` (${uniqueUserExperiencesCount} experiences)` : ''} and favorite destinations${favoriteDestinationsCount > 0 ? ` (${favoriteDestinationsCount} destinations)` : ''}.`}
          keywords={`${currentProfile.name}, travel profile, experiences, destinations, travel planning`}
          ogTitle={`${currentProfile.name} on Biensperience`}
          ogDescription={`${currentProfile.name} is planning ${uniqueUserExperiencesCount} travel experiences${favoriteDestinationsCount > 0 ? ` across ${favoriteDestinationsCount} favorite destinations` : ''}.`}
          entity={currentProfile}
          entityType="user"
        />
      )}
      <Container>
        {/* Profile Header Card - Storybook ProfileView Design */}
        <Card className={styles.profileHeaderCard}>
          {/* Cover Image / Gradient */}
          <div className={styles.profileCover} />

          <Card.Body className={styles.profileHeaderBody}>
            {isLoadingProfile ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
                <Loading size="lg" message={lang.current.alert.loadingProfile} />
              </div>
            ) : (
              <div className={styles.profileHeaderFlex}>
                {/* Avatar - Clickable to open photo modal */}
                <div
                  className={styles.profileAvatarContainer}
                  onClick={() => {
                    if (currentProfile?.photos?.length > 0) {
                      // Find the index of the default photo
                      const defaultPhoto = getDefaultPhoto(currentProfile);
                      const photoIndex = currentProfile.photos.findIndex(
                        p => (p._id || p) === (defaultPhoto?._id || defaultPhoto)
                      );
                      setSelectedPhotoIndex(Math.max(0, photoIndex));
                      setShowPhotoModal(true);
                    }
                  }}
                  role={currentProfile?.photos?.length > 0 ? "button" : undefined}
                  tabIndex={currentProfile?.photos?.length > 0 ? 0 : undefined}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && currentProfile?.photos?.length > 0) {
                      e.preventDefault();
                      const defaultPhoto = getDefaultPhoto(currentProfile);
                      const photoIndex = currentProfile.photos.findIndex(
                        p => (p._id || p) === (defaultPhoto?._id || defaultPhoto)
                      );
                      setSelectedPhotoIndex(Math.max(0, photoIndex));
                      setShowPhotoModal(true);
                    }
                  }}
                  aria-label={currentProfile?.photos?.length > 0 ? "View profile photos" : undefined}
                >
                  {avatarPhoto ? (
                    <img
                      src={avatarPhoto.url || avatarPhoto}
                      alt={currentProfile?.name}
                      className={styles.profileAvatar}
                    />
                  ) : (
                    <div className={styles.profileAvatarPlaceholder}>
                      <FaUser />
                    </div>
                  )}
                  {currentProfile?.photos?.length > 0 && (
                    <div className={styles.profileAvatarOverlay}>
                      <FaCamera />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className={styles.profileInfo}>
                  <div className={styles.profileNameRow}>
                    <h1 className={styles.profileName}>
                      {currentProfile?.name}
                    </h1>
                    {currentProfile?.emailConfirmed && (
                      <FaCheckCircle
                        className={styles.verifiedBadge}
                        title={lang.current.aria.emailConfirmed}
                        aria-label={lang.current.aria.emailConfirmed}
                      />
                    )}
                  </div>

                  {currentProfile?.location && (
                    <p className={styles.profileLocation}>
                      <FaMapMarkerAlt /> {formatLocation(currentProfile.location)}
                    </p>
                  )}

                  {currentProfile?.bio && (
                    <p className={styles.profileBio}>
                      {currentProfile.bio}
                    </p>
                  )}

                  {/* Compact Metrics Bar */}
                  <div className={styles.profileMetricsBar}>
                    <span className={styles.profileMetric}>
                      <strong>{plans?.length || 0}</strong> {(plans?.length || 0) === 1 ? 'Plan' : 'Plans'}
                    </span>
                    <span className={styles.profileMetricDivider}>·</span>
                    <span className={styles.profileMetric}>
                      <strong>{uniqueCreatedExperiencesCount}</strong> {uniqueCreatedExperiencesCount === 1 ? 'Experience' : 'Experiences'}
                    </span>
                    <span className={styles.profileMetricDivider}>·</span>
                    <span className={styles.profileMetric}>
                      <strong>{favoriteDestinationsCount}</strong> {favoriteDestinationsCount === 1 ? 'Destination' : 'Destinations'}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className={styles.profileActions}>
                  {!isOwner && (
                    <>
                      <Button variant="outline" style={{ borderRadius: 'var(--radius-full)' }}>
                        <FaEnvelope /> Message
                      </Button>
                      <Button variant="gradient" style={{ borderRadius: 'var(--radius-full)' }}>
                        Follow
                      </Button>
                    </>
                  )}
                  {isOwner && (
                    <div className="dropdown">
                      <Button
                        variant="outline"
                        type="button"
                        data-bs-toggle="dropdown"
                        aria-expanded="false"
                        aria-label={lang.current.aria.profileActions}
                        style={{ borderRadius: 'var(--radius-full)' }}
                      >
                        ⋯
                      </Button>
                      <ul className="dropdown-menu dropdown-menu-end">
                        {isSuperAdmin(user) && (
                          <>
                            <li>
                              <button
                                className={`dropdown-item ${styles.dropdownItem}`}
                                onClick={handleOpenApiModal}
                                type="button"
                              >
                                <FaKey className={styles.dropdownIcon} />
                                <span>API Tokens</span>
                              </button>
                            </li>
                            <li>
                              <button
                                className={`dropdown-item ${styles.dropdownItem}`}
                                onClick={handleOpenActivityMonitor}
                                type="button"
                              >
                                <FaEye className={styles.dropdownIcon} />
                                <span>Activity Monitor</span>
                              </button>
                            </li>
                          </>
                        )}
                        <li>
                          <Link
                            to="/profile/update"
                            className={`dropdown-item ${styles.dropdownItem}`}
                          >
                            <FaEdit className={styles.dropdownIcon} />
                            <span>Update Profile</span>
                          </Link>
                        </li>
                        {currentProfile && !currentProfile.emailConfirmed && (
                          <li>
                            <button
                              className={`dropdown-item ${styles.dropdownItem}`}
                              type="button"
                              onClick={async () => {
                                if (!currentProfile || !currentProfile.email) return;
                                if (resendInProgress || resendDisabled) return;
                                try {
                                  setResendInProgress(true);
                                  await resendConfirmation(currentProfile.email);
                                  startCooldown(currentProfile.email);
                                  success(lang.current.success.resendConfirmation);
                                } catch (err) {
                                  const msg = handleError(err, { context: 'Resend verification' });
                                  showError(msg || 'Failed to resend verification email');
                                } finally {
                                  setResendInProgress(false);
                                }
                              }}
                              disabled={resendInProgress || resendDisabled}
                            >
                              <FaEnvelope className={styles.dropdownIcon} />
                              <span>{lang.current.alert.emailNotVerifiedAction} {resendDisabled && cooldownRemaining > 0 ? `(${cooldownRemaining}s)` : ''}</span>
                            </button>
                          </li>
                        )}
                        {isSuperAdmin(user) && profileId && profileId !== user._id && (
                          <li>
                            <Link
                              to={`/profile/${profileId}/update`}
                              className={`dropdown-item ${styles.dropdownItem} ${styles.dropdownItemAdmin}`}
                            >
                              <FaUserShield className={styles.dropdownIcon} />
                              <span>Admin Update</span>
                            </Link>
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card.Body>
        </Card>

        {/* Tab Navigation - Underline Style */}
        <div className={styles.profileTabs}>
          <button
            className={`${styles.profileTab} ${uiState.experiences ? styles.profileTabActive : ''}`}
            onClick={() => {
              handleExpNav('experiences');
              try { window.history.pushState(null, '', `${window.location.pathname}#experiences`); } catch (e) {}
            }}
          >
            Planned
          </button>
          <button
            className={`${styles.profileTab} ${uiState.created ? styles.profileTabActive : ''}`}
            onClick={() => {
              handleExpNav('created');
              try { window.history.pushState(null, '', `${window.location.pathname}#created`); } catch (e) {}
            }}
          >
            Created
          </button>
          <button
            className={`${styles.profileTab} ${uiState.destinations ? styles.profileTabActive : ''}`}
            onClick={() => {
              handleExpNav('destinations');
              try { window.history.pushState(null, '', `${window.location.pathname}#destinations`); } catch (e) {}
            }}
          >
            Destinations
          </button>
        </div>

        {/* Content Grid */}
        <Row>
          <Col lg={12}>
            {/* Destinations Tab */}
            {uiState.destinations && (
              <div ref={reservedRef} className={styles.destinationsGrid}>
                {(() => {
                  if (favoriteDestinations === null) {
                    // Loading state - show skeleton loaders for one row of destinations (12rem x 8rem each)
                    const skeletonCount = Math.min(6, Math.max(3, Math.floor(itemsPerPageComputed / 2)));
                    return Array.from({ length: skeletonCount }).map((_, i) => (
                      <div key={`skeleton-dest-${i}`} style={{ width: '12rem', height: '8rem', borderRadius: 'var(--radius-2xl)', overflow: 'hidden' }}>
                        <SkeletonLoader variant="rectangle" width="100%" height="100%" />
                      </div>
                    ));
                  }

                  const displayedDestinations = showAllDestinations
                    ? favoriteDestinations
                    : favoriteDestinations.slice((destinationsPage - 1) * itemsPerPageComputed, (destinationsPage - 1) * itemsPerPageComputed + itemsPerPageComputed);

                  const destTotalPages = Math.max(1, Math.ceil(favoriteDestinations.length / itemsPerPageComputed));

                  return favoriteDestinations.length > 0 ? (
                    <>
                      {displayedDestinations.map((destination, index) => (
                        <DestinationCard
                          key={destination._id || index}
                          destination={destination}
                        />
                      ))}
                      {/* Only show placeholders on non-last pages to reserve space */}
                      {!showAllDestinations && destinationsPage < destTotalPages && displayedDestinations.length < itemsPerPageComputed && (
                        Array.from({ length: Math.max(0, itemsPerPageComputed - displayedDestinations.length) }).map((_, i) => (
                          <div key={`placeholder-dest-${i}`} style={{ width: '12rem', height: '8rem', borderRadius: 'var(--radius-2xl)', overflow: 'hidden' }}>
                            <SkeletonLoader variant="rectangle" width="100%" height="100%" />
                          </div>
                        ))
                      )}
                    </>
                  ) : (
                    <EmptyState
                      variant="destinations"
                      title={isOwnProfile ? "No Destinations Yet" : "No Destinations"}
                      description={isOwnProfile
                        ? "You haven't favorited any destinations yet. Browse destinations and add some to your favorites."
                        : `${getFirstName(currentProfile?.name)} hasn't favorited any destinations yet.`}
                      primaryAction={isOwnProfile ? "Browse Destinations" : null}
                      onPrimaryAction={isOwnProfile ? () => window.location.href = '/destinations' : null}
                      size="md"
                    />
                  );
                })()}
              </div>
            )}
            {/* Planned Experiences Tab - API-level pagination */}
            {uiState.experiences && (
              <div className={styles.profileGrid}>
                {(() => {
                  // Loading state (initial load or page change)
                  if (uniqueUserExperiences === null || experiencesLoading) {
                    return Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => (
                      <div key={`skeleton-exp-${i}`} className="d-block m-2" style={{ width: '20rem' }}>
                        <div className="position-relative" style={{ minHeight: '12rem' }}>
                          <div aria-hidden="true" className="position-absolute w-100 h-100 start-0 top-0">
                            <SkeletonLoader variant="rectangle" width="100%" height="100%" />
                          </div>
                        </div>
                      </div>
                    ));
                  }

                  // API returns the current page directly - no client-side slicing needed
                  const displayedExperiences = uniqueUserExperiences;

                  return displayedExperiences.length > 0 ? (
                    <>
                      {displayedExperiences.map((experience, index) => (
                        <ExperienceCard
                          experience={experience}
                          key={experience._id || index}
                          userPlans={plans}
                        />
                      ))}
                    </>
                  ) : (
                    <EmptyState
                      variant="experiences"
                      title={isOwnProfile ? "No Planned Experiences" : "No Planned Experiences"}
                      description={isOwnProfile
                        ? "You haven't planned any experiences yet. Browse experiences and start planning your next adventure."
                        : `${getFirstName(currentProfile?.name)} hasn't planned any experiences yet.`}
                      primaryAction={isOwnProfile ? "Browse Experiences" : null}
                      onPrimaryAction={isOwnProfile ? () => window.location.href = '/experiences' : null}
                      size="md"
                    />
                  );
                })()}
              </div>
            )}
            {/* Created Experiences Tab - API-level pagination */}
            {uiState.created && (
              <div className={styles.profileGrid}>
                {(() => {
                  // Loading state (initial load or page change)
                  if (uniqueCreatedExperiences === null || createdLoading) {
                    return Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => (
                      <div key={`skeleton-created-${i}`} className="d-block m-2" style={{ width: '20rem' }}>
                        <div className="position-relative" style={{ minHeight: '12rem' }}>
                          <div aria-hidden="true" className="position-absolute w-100 h-100 start-0 top-0">
                            <SkeletonLoader variant="rectangle" width="100%" height="100%" />
                          </div>
                        </div>
                      </div>
                    ));
                  }

                  // API returns the current page directly - no client-side slicing needed
                  const displayedCreated = uniqueCreatedExperiences;

                  return displayedCreated.length > 0 ? (
                    <>
                      {displayedCreated.map((experience, index) => (
                        <ExperienceCard
                          experience={experience}
                          key={experience._id || index}
                          userPlans={plans}
                        />
                      ))}
                    </>
                  ) : (
                    <EmptyState
                      variant="experiences"
                      icon="✨"
                      title={isOwnProfile ? "No Created Experiences" : "No Created Experiences"}
                      description={isOwnProfile
                        ? "You haven't created any experiences yet. Share your travel knowledge with the community."
                        : `${getFirstName(currentProfile?.name)} hasn't created any experiences yet.`}
                      primaryAction={isOwnProfile ? "Create an Experience" : null}
                      onPrimaryAction={isOwnProfile ? () => openExperienceWizard() : null}
                      size="md"
                    />
                  );
                })()}
              </div>
            )}

            {/* Pagination - always rendered in centered container for consistent layout */}
            <div className={styles.paginationContainer}>
              {/* Destinations - client-side pagination (unchanged) */}
              {uiState.destinations && !showAllDestinations && favoriteDestinations && favoriteDestinations.length > itemsPerPageComputed && (
                <Pagination
                  currentPage={destinationsPage}
                  totalPages={Math.max(1, Math.ceil(favoriteDestinations.length / itemsPerPageComputed))}
                  onPageChange={setDestinationsPage}
                />
              )}

              {/* Experiences - API-level pagination */}
              {uiState.experiences && !showAllPlanned && userExperiencesMeta && userExperiencesMeta.totalPages > 1 && (
                <Pagination
                  currentPage={experiencesPage}
                  totalPages={userExperiencesMeta.totalPages}
                  onPageChange={setExperiencesPage}
                  disabled={experiencesLoading}
                />
              )}

              {/* Created - API-level pagination */}
              {uiState.created && !showAllCreated && createdExperiencesMeta && createdExperiencesMeta.totalPages > 1 && (
                <Pagination
                  currentPage={createdPage}
                  totalPages={createdExperiencesMeta.totalPages}
                  onPageChange={setCreatedPage}
                  disabled={createdLoading}
                />
              )}
            </div>
          </Col>
        </Row>

        {/* Super Admin Permissions Section */}
      {isSuperAdmin(user) && !isOwner && currentProfile && (
        <div style={{ display: 'flex', margin: 'var(--space-16) 0', animation: 'fadeIn var(--transition-normal)' }}>
          <div style={{ flex: 1 }}>
            <Card>
              <Card.Header>
                <h5 style={{ marginBottom: 0 }}>Super Admin Permissions</h5>
              </Card.Header>
              <Card.Body>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                  <div style={{ flex: '0 0 50%', maxWidth: '50%' }}>
                    <p style={{ marginBottom: 'var(--space-2)' }}>
                      <strong>Current Role:</strong> {USER_ROLE_DISPLAY_NAMES[currentProfile.role] || 'Unknown'}
                    </p>
                    <p style={{ fontSize: 'var(--font-size-sm)', marginBottom: 0, color: 'var(--color-text-muted)' }}>
                      Change this user's role. Super admins have full access to all resources and user management.
                    </p>
                  </div>
                  <div style={{ flex: '0 0 50%', maxWidth: '50%' }}>
                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                      <Button
                        variant={currentProfile.role === USER_ROLES.SUPER_ADMIN ? "success" : "outline"}
                        onClick={() => handleRoleUpdate(USER_ROLES.SUPER_ADMIN)}
                        disabled={isUpdatingRole || currentProfile.role === USER_ROLES.SUPER_ADMIN}
                      >
                          {isUpdatingRole ? lang.current.button.updating : lang.current.admin.makeSuperAdmin}
                      </Button>
                      <Button
                        variant={currentProfile.role === USER_ROLES.REGULAR_USER ? "secondary" : "outline"}
                        onClick={() => handleRoleUpdate(USER_ROLES.REGULAR_USER)}
                        disabled={isUpdatingRole || currentProfile.role === USER_ROLES.REGULAR_USER}
                      >
                        {isUpdatingRole ? lang.current.button.updating : lang.current.admin.makeRegularUser}
                      </Button>
                    </div>
                  </div>
                </div>
                <hr />
                <div style={{ display: 'flex', alignItems: 'center', marginTop: 'var(--space-6)' }}>
                  <div style={{ flex: '0 0 50%', maxWidth: '50%' }}>
                    <p style={{ marginBottom: 'var(--space-2)' }}>
                      <strong>Email Status:</strong>{' '}
                      {currentProfile.emailConfirmed ? (
                        <span style={{ color: 'var(--color-success)' }}>
                          <FaCheckCircle style={{ marginRight: 'var(--space-1)' }} />
                          Confirmed
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-warning)' }}>Not Confirmed</span>
                      )}
                    </p>
                    <p style={{ fontSize: 'var(--font-size-sm)', marginBottom: 0, color: 'var(--color-text-muted)' }}>
                      Manually confirm or unconfirm this user's email address.
                    </p>
                  </div>
                  <div style={{ flex: '0 0 50%', maxWidth: '50%' }}>
                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                      <Button
                        variant={currentProfile.emailConfirmed ? "success" : "outline"}
                        onClick={() => handleEmailConfirmationUpdate(true)}
                        disabled={isUpdatingRole || currentProfile.emailConfirmed}
                      >
                        {isUpdatingRole ? lang.current.button.updating : lang.current.admin.confirmEmail}
                      </Button>
                      <Button
                        variant={!currentProfile.emailConfirmed ? "outline" : "danger"}
                        onClick={() => handleEmailConfirmationUpdate(false)}
                        disabled={isUpdatingRole || !currentProfile.emailConfirmed}
                      >
                        {isUpdatingRole ? lang.current.button.updating : lang.current.admin.unconfirmEmail}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card.Body>
            </Card>
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

      {/* Photo Modal - for profile photos - only render when showPhotoModal is true */}
      {showPhotoModal && currentProfile?.photos?.length > 0 && (
        <PhotoModal
          onClose={() => setShowPhotoModal(false)}
          photo={currentProfile.photos[selectedPhotoIndex]}
          photos={currentProfile.photos}
          initialIndex={selectedPhotoIndex}
        />
      )}
      </Container>
    </div>
  );
}

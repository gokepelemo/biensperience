import { FaUser, FaPassport, FaCheckCircle, FaKey, FaEye, FaEdit, FaEnvelope, FaUserShield, FaMapMarkerAlt, FaPlane, FaHeart, FaCamera, FaStar, FaGlobe, FaExternalLinkAlt, FaCode, FaExclamationTriangle, FaCodeBranch, FaCog, FaShieldAlt, FaChartLine, FaUsers, FaCalendarAlt, FaPlusCircle, FaUserMinus } from "react-icons/fa";
import { getSocialNetwork, getLinkIcon, getLinkDisplayText, buildLinkUrl } from "../../utilities/social-links";
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
import { ProfileSkeleton, ProfileHeaderSkeleton, ProfileContentGridSkeleton } from "./components";
import ApiTokenModal from "../../components/ApiTokenModal/ApiTokenModal";
import ActivityMonitor from "../../components/ActivityMonitor/ActivityMonitor";
import PhotoModal from "../../components/PhotoModal/PhotoModal";
import PhotoUploadModal from '../../components/PhotoUploadModal/PhotoUploadModal';
import MessagesModal from '../../components/ChatModal/MessagesModal';
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
import { broadcastEvent } from "../../utilities/event-bus";
import { useWebSocketEvents } from "../../hooks/useWebSocketEvents";
import { hasFeatureFlag } from "../../utilities/feature-flags";
import { isSystemUser } from "../../utilities/system-users";
import { followUser, unfollowUser, removeFollower, getFollowStatus, getFollowCounts, getFollowers, getFollowing } from "../../utilities/follows-api";
import { getActivityFeed } from "../../utilities/dashboard-api";
import ActivityFeed from "../../components/ActivityFeed/ActivityFeed";
import TabNav from "../../components/TabNav/TabNav";

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
    activity: true,
    follows: false,
    experiences: false,
    created: false,
    destinations: false,
  });

  // Track previous profileId to detect navigation between profiles
  const prevProfileIdRef = useRef(profileId);

  // Follow feature state
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  const [followButtonHovered, setFollowButtonHovered] = useState(false);

  // Follows tab state
  const [followsFilter, setFollowsFilter] = useState('followers'); // 'followers' | 'following'
  const [followsList, setFollowsList] = useState([]);
  const [followsLoading, setFollowsLoading] = useState(false);
  const [followsPagination, setFollowsPagination] = useState({ total: 0, hasMore: false, skip: 0 });

  const [showApiTokenModal, setShowApiTokenModal] = useState(false);
  const [showActivityMonitor, setShowActivityMonitor] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [showPhotoUploadModal, setShowPhotoUploadModal] = useState(false);
  const photoSaveTimerRef = useRef(null);
  // Messages modal state for initiating DMs from profile
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  const [initialChannelId, setInitialChannelId] = useState(null);

  // Reset state immediately when navigating to a different profile
  // This prevents showing stale data from the previous profile
  useEffect(() => {
    if (prevProfileIdRef.current !== profileId) {
      // Profile ID changed - reset all profile-specific state
      setCurrentProfile(null);
      setIsLoadingProfile(true);
      setProfileError(null);
      setUserExperiences(null);
      setUserExperiencesMeta(null);
      setCreatedExperiences(null);
      setCreatedExperiencesMeta(null);
      setFollowCounts({ followers: 0, following: 0 });
      setIsFollowing(false);
      setFollowsList([]);
      setFollowsPagination({ total: 0, hasMore: false, skip: 0 });
      // Update ref to new value
      prevProfileIdRef.current = profileId;
    }
  }, [profileId]);

  // Initialize tab from hash (supports deep links like /profile#created)
  useEffect(() => {
    try {
      const hash = (window.location.hash || '').replace('#', '');
      if (!hash) return;

      // Map known hashes to local profile tabs
      if (['activity', 'follows', 'experiences', 'created', 'destinations'].includes(hash)) {
        setUiState({
          activity: hash === 'activity',
          follows: hash === 'follows',
          experiences: hash === 'experiences',
          created: hash === 'created',
          destinations: hash === 'destinations',
        });
        return;
      }

      // Handle follows sub-hashes (e.g., #followers, #following)
      if (hash === 'followers' || hash === 'following') {
        setUiState({
          activity: false,
          follows: true,
          experiences: false,
          created: false,
          destinations: false,
        });
        setFollowsFilter(hash);
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

        if (['activity', 'follows', 'experiences', 'created', 'destinations'].includes(hash)) {
          setUiState({
            activity: hash === 'activity',
            follows: hash === 'follows',
            experiences: hash === 'experiences',
            created: hash === 'created',
            destinations: hash === 'destinations',
          });
          return;
        }

        // Handle follows sub-hashes (e.g., #followers, #following)
        if (hash === 'followers' || hash === 'following') {
          setUiState({
            activity: false,
            follows: true,
            experiences: false,
            created: false,
            destinations: false,
          });
          setFollowsFilter(hash);
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
  // Track last buttons we set in AppContext to avoid repeatedly calling setter
  const lastPageButtonsRef = useRef(null);

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

      const merged = { ...prev, ...updates, photos: mergedPhotos };

      try {
        // Avoid triggering a state update if nothing meaningful changed.
        if (JSON.stringify(prev) === JSON.stringify(merged)) return prev;
      } catch (e) {
        // If serialization fails for any reason, fall back to returning merged
      }

      return merged;
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

  // Build planned experiences list - one entry per plan (not per experience)
  // This allows showing both owned and collaborative plans for the same experience separately
  // Each entry includes the experience data and whether it's a collaborative plan
  // Returns null if userExperiences is null (loading state), empty array if loaded but no data
  const uniqueUserExperiences = useMemo(() => {
    if (userExperiences === null) return null; // Loading state

    // For own profile, build the list from plans (which includes collaborative plans)
    // Each plan becomes a separate card entry
    if (isOwnProfile && plans && plans.length > 0) {
      const experienceEntries = plans
        .filter(plan => plan.experience)
        .map(plan => {
          // plan.experience may be populated object or just an ID
          const exp = plan.experience;
          if (exp && typeof exp === 'object' && exp._id) {
            // Return the experience with plan-specific metadata
            // Use planId as unique key instead of experience._id
            return {
              ...exp,
              _planId: plan._id, // Track which plan this entry is for
              _isCollaborative: plan.isCollaborative || false
            };
          }
          return null;
        })
        .filter(Boolean);

      logger.debug('[Profile] Built experience entries from plans', {
        totalPlans: plans.length,
        experienceEntries: experienceEntries.length,
        collaborative: experienceEntries.filter(e => e._isCollaborative).length
      });

      return experienceEntries;
    }

    // For other users' profiles, use the API response (only their owned plans)
    return deduplicateById(userExperiences) || [];
  }, [userExperiences, isOwnProfile, plans]);

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

    // Block access to system user profiles (e.g., Archive User)
    // These are internal system accounts that should never be publicly viewable
    if (isSystemUser(userId)) {
      setProfileError(lang.current.alert.userNotFound);
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

  // If viewing another user's profile and Activity tab is selected (which they can't see),
  // switch to Follows tab instead
  useEffect(() => {
    if (!isOwnProfile && uiState.activity) {
      setUiState(prev => ({ ...prev, activity: false, follows: true }));
    }
  }, [isOwnProfile, uiState.activity]);

  const handleRoleUpdate = async (newRole) => {
    if (!isSuperAdmin(user)) {
      handleError({ message: lang.current.alert.onlySuperAdminsCanUpdateRoles });
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
      handleError({ message: lang.current.alert.onlySuperAdminsCanUpdateEmailConfirmation });
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

  // Cleanup any pending save timer when leaving
  useEffect(() => {
    return () => {
      if (photoSaveTimerRef.current) {
        clearTimeout(photoSaveTimerRef.current);
      }
    };
  }, []);

  // Listen for user profile update events
  useEffect(() => {
    const handleUserUpdated = (event) => {
      // Event bus spreads payload at top level
      const updatedUser = event.user;
      if (updatedUser && updatedUser._id === userId) {
        logger.debug('[Profile] User updated event received', { id: updatedUser._id });
        // Use smart merge to avoid replacing populated photos with unpopulated IDs
        try {
          mergeProfile(updatedUser);
        } catch (e) {
          // Fallback to direct set if merge fails for any reason
          setCurrentProfile(updatedUser);
        }
      }
    };

    const unsubscribe = eventBus.subscribe('user:updated', handleUserUpdated);
    return () => unsubscribe();
  }, [userId, mergeProfile]);

  // Listen for photo events (profile photos)
  useEffect(() => {
    if (!userId) return;

    const handlePhotoCreated = (event) => {
      const photo = event.photo;
      if (!photo) return;
      // Refresh profile to get updated photos
      getProfile();
    };

    const handlePhotoUpdated = (event) => {
      const photo = event.photo;
      if (!photo || !photo._id) return;
      // Update photo in profile if it exists
      setCurrentProfile(prev => {
        if (!prev?.photos) return prev;
        const photoIndex = prev.photos.findIndex(p => p._id === photo._id || p === photo._id);
        if (photoIndex === -1) return prev;
        const updatedPhotos = [...prev.photos];
        updatedPhotos[photoIndex] = photo;
        return { ...prev, photos: updatedPhotos };
      });
    };

    const handlePhotoDeleted = (event) => {
      const photoId = event.photoId;
      if (!photoId) return;
      // Remove photo from profile
      setCurrentProfile(prev => {
        if (!prev?.photos) return prev;
        const updatedPhotos = prev.photos.filter(p => 
          (p._id || p).toString() !== photoId.toString()
        );
        return { ...prev, photos: updatedPhotos };
      });
    };

    const unsubCreate = eventBus.subscribe('photo:created', handlePhotoCreated);
    const unsubUpdate = eventBus.subscribe('photo:updated', handlePhotoUpdated);
    const unsubDelete = eventBus.subscribe('photo:deleted', handlePhotoDeleted);

    return () => {
      unsubCreate();
      unsubUpdate();
      unsubDelete();
    };
  }, [userId, getProfile]);

  // Listen for experience events to update profile lists
  useEffect(() => {
    if (!userId) return;

    // Handle experience created - add to created list if owner matches
    const handleExperienceCreated = (event) => {
      const experience = event.experience;
      if (!experience) return;

      // Check if the current profile user is the owner
      const ownerPermission = experience.permissions?.find(
        p => p.entity === 'user' && p.type === 'owner'
      );
      const ownerId = ownerPermission?._id?.toString() || ownerPermission?._id;

      if (ownerId === userId) {
        logger.debug('[Profile] Experience created by profile user', { experienceId: experience._id });
        setCreatedExperiences(prev => {
          if (!prev) return [experience];
          // Avoid duplicates
          if (prev.some(e => e._id === experience._id)) return prev;
          return [experience, ...prev];
        });
        // Update meta count
        setCreatedExperiencesMeta(prev => prev ? { ...prev, total: (prev.total || 0) + 1 } : prev);
      }
    };

    // Handle experience updated - update in both lists if present
    const handleExperienceUpdated = (event) => {
      const experience = event.experience;
      if (!experience) return;

      logger.debug('[Profile] Experience updated event', { experienceId: experience._id });

      // Update in user experiences (planned)
      setUserExperiences(prev => {
        if (!prev) return prev;
        const index = prev.findIndex(e => e._id === experience._id);
        if (index === -1) return prev;
        const updated = [...prev];
        updated[index] = { ...updated[index], ...experience };
        return updated;
      });

      // Update in created experiences
      setCreatedExperiences(prev => {
        if (!prev) return prev;
        const index = prev.findIndex(e => e._id === experience._id);
        if (index === -1) return prev;
        const updated = [...prev];
        updated[index] = { ...updated[index], ...experience };
        return updated;
      });
    };

    // Handle experience deleted - remove from both lists
    const handleExperienceDeleted = (event) => {
      const experienceId = event.experienceId;
      if (!experienceId) return;

      logger.debug('[Profile] Experience deleted event', { experienceId });

      // Remove from user experiences
      setUserExperiences(prev => {
        if (!prev) return prev;
        const filtered = prev.filter(e => e._id !== experienceId);
        if (filtered.length === prev.length) return prev; // No change
        return filtered;
      });
      setUserExperiencesMeta(prev => {
        if (!prev) return prev;
        const newTotal = Math.max(0, (prev.total || 0) - 1);
        return { ...prev, total: newTotal, totalPages: Math.ceil(newTotal / ITEMS_PER_PAGE) };
      });

      // Remove from created experiences
      setCreatedExperiences(prev => {
        if (!prev) return prev;
        const filtered = prev.filter(e => e._id !== experienceId);
        if (filtered.length === prev.length) return prev; // No change
        return filtered;
      });
      setCreatedExperiencesMeta(prev => {
        if (!prev) return prev;
        const newTotal = Math.max(0, (prev.total || 0) - 1);
        return { ...prev, total: newTotal, totalPages: Math.ceil(newTotal / ITEMS_PER_PAGE) };
      });
    };

    const unsubCreate = eventBus.subscribe('experience:created', handleExperienceCreated);
    const unsubUpdate = eventBus.subscribe('experience:updated', handleExperienceUpdated);
    const unsubDelete = eventBus.subscribe('experience:deleted', handleExperienceDeleted);

    return () => {
      unsubCreate();
      unsubUpdate();
      unsubDelete();
    };
  }, [userId]);

  // Listen for destination events to update favorites list
  useEffect(() => {
    if (!userId) return;

    // Handle destination updated - could affect favorite status
    const handleDestinationUpdated = (event) => {
      const destination = event.destination;
      if (!destination) return;

      logger.debug('[Profile] Destination updated event', { destinationId: destination._id });
      // The favoriteDestinations memo will automatically recompute from DataContext destinations
      // No manual state update needed - just logging for debugging
    };

    // Handle destination deleted - will be removed from favorites automatically via DataContext
    const handleDestinationDeleted = (event) => {
      const destinationId = event.destinationId;
      if (!destinationId) return;

      logger.debug('[Profile] Destination deleted event', { destinationId });
      // The favoriteDestinations memo filters from DataContext destinations
      // which will be updated by DataContext's own event handlers
    };

    const unsubUpdate = eventBus.subscribe('destination:updated', handleDestinationUpdated);
    const unsubDelete = eventBus.subscribe('destination:deleted', handleDestinationDeleted);

    return () => {
      unsubUpdate();
      unsubDelete();
    };
  }, [userId]);

  // Fetch follow status and counts when viewing another user's profile
  useEffect(() => {
    if (!userId || !user || isOwnProfile) return;

    const fetchFollowData = async () => {
      try {
        const [status, counts] = await Promise.all([
          getFollowStatus(userId),
          getFollowCounts(userId)
        ]);
        setIsFollowing(status);
        setFollowCounts(counts);
      } catch (err) {
        logger.error('[Profile] Failed to fetch follow data', { error: err.message });
      }
    };

    fetchFollowData();
  }, [userId, user, isOwnProfile]);

  // Fetch follow counts for own profile (to display in metrics)
  useEffect(() => {
    if (!userId || !isOwnProfile) return;

    const fetchOwnFollowCounts = async () => {
      try {
        const counts = await getFollowCounts(userId);
        setFollowCounts(counts);
      } catch (err) {
        logger.error('[Profile] Failed to fetch follow counts', { error: err.message });
      }
    };

    fetchOwnFollowCounts();
  }, [userId, isOwnProfile]);

  // WebSocket events for real-time profile updates (when others follow this profile)
  const { subscribe: wsSubscribe, emit: wsEmit } = useWebSocketEvents();

  // Join the user's profile room for real-time follow updates
  useEffect(() => {
    if (!userId || !wsEmit) return;

    // Join the user's profile room to receive follow events
    wsEmit('room:join', { roomId: `user:${userId}`, userId, type: 'user' }, { localOnly: false });

    return () => {
      // Leave room on cleanup
      wsEmit('room:leave', { roomId: `user:${userId}`, userId, type: 'user' }, { localOnly: false });
    };
  }, [userId, wsEmit]);

  // Listen for follow events to update UI
  // Handles both local events (when current user follows) and WebSocket events (when others follow)
  useEffect(() => {
    if (!userId) return;

    const handleFollowCreated = (event) => {
      // Check event payload structure (local events vs WebSocket events)
      const followingId = event.followingId || event.payload?.followingId;
      const eventUserId = event.userId || event.payload?.userId;

      // If this event is for the profile being viewed, update follower count
      if (followingId === userId || eventUserId === userId) {
        // Only update isFollowing if current user is the follower
        if (event.followerId === user._id) {
          setIsFollowing(true);
        }
        setFollowCounts(prev => ({ ...prev, followers: prev.followers + 1 }));
        logger.debug('[Profile] Follower count incremented via event', { followingId, userId });
      }
    };

    const handleFollowDeleted = (event) => {
      // Check event payload structure (local events vs WebSocket events)
      const followingId = event.followingId || event.payload?.followingId;
      const eventUserId = event.userId || event.payload?.userId;

      // If this event is for the profile being viewed, update follower count
      if (followingId === userId || eventUserId === userId) {
        // Only update isFollowing if current user is the unfollower
        if (event.followerId === user._id) {
          setIsFollowing(false);
        }
        setFollowCounts(prev => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));
        logger.debug('[Profile] Follower count decremented via event', { followingId, userId });
      }
    };

    // Subscribe to both local event bus and WebSocket events
    const unsubCreate = eventBus.subscribe('follow:created', handleFollowCreated);
    const unsubDelete = eventBus.subscribe('follow:deleted', handleFollowDeleted);

    // WebSocket subscriptions for remote events
    const unsubWsCreate = wsSubscribe?.('follow:created', handleFollowCreated);
    const unsubWsDelete = wsSubscribe?.('follow:deleted', handleFollowDeleted);

    return () => {
      unsubCreate();
      unsubDelete();
      unsubWsCreate?.();
      unsubWsDelete?.();
    };
  }, [userId, user._id, wsSubscribe]);

  // Handle follow button click
  const handleFollow = useCallback(async () => {
    if (followLoading || !userId) return;

    // Defensive check: Prevent following yourself
    if (userId === user._id) {
      showError('You cannot follow yourself');
      return;
    }

    setFollowLoading(true);
    try {
      await followUser(userId);
      setIsFollowing(true);
      setFollowCounts(prev => ({ ...prev, followers: prev.followers + 1 }));
      success(lang.current.success.nowFollowing);
    } catch (err) {
      const message = handleError(err, { context: 'Follow user' });
      showError(message || 'Failed to follow user');
    } finally {
      setFollowLoading(false);
    }
  }, [userId, user._id, followLoading, success, showError]);

  // Handle unfollow button click
  const handleUnfollow = useCallback(async () => {
    if (followLoading || !userId) return;

    // Defensive check: Prevent unfollowing yourself (should never happen but be safe)
    if (userId === user._id) {
      showError('Invalid operation');
      return;
    }

    setFollowLoading(true);
    try {
      await unfollowUser(userId);
      setIsFollowing(false);
      setFollowCounts(prev => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));
      success(lang.current.success.unfollowed);
    } catch (err) {
      const message = handleError(err, { context: 'Unfollow user' });
      showError(message || 'Failed to unfollow user');
    } finally {
      setFollowLoading(false);
    }
  }, [userId, user._id, followLoading, success, showError]);

  // Track which follow actions are in progress (by user ID)
  const [followActionInProgress, setFollowActionInProgress] = useState({});

  // Handle removing a follower from the followers list (when viewing own profile)
  const handleRemoveFollower = useCallback(async (followerId, e) => {
    e?.preventDefault();
    e?.stopPropagation();

    if (followActionInProgress[followerId]) return;

    setFollowActionInProgress(prev => ({ ...prev, [followerId]: true }));

    // Optimistic update - remove from list immediately
    const prevFollowsList = [...followsList];
    setFollowsList(prev => prev.filter(u => u._id !== followerId));
    setFollowCounts(prev => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));

    try {
      await removeFollower(followerId);
      success(lang.current.success?.followerRemoved || 'Follower removed');
    } catch (err) {
      // Rollback on error
      setFollowsList(prevFollowsList);
      setFollowCounts(prev => ({ ...prev, followers: prev.followers + 1 }));
      const message = handleError(err, { context: 'Remove follower' });
      showError(message || 'Failed to remove follower');
    } finally {
      setFollowActionInProgress(prev => ({ ...prev, [followerId]: false }));
    }
  }, [followsList, followActionInProgress, success, showError]);

  // Handle unfollowing a user from the following list (when viewing own profile)
  const handleUnfollowFromList = useCallback(async (followingId, e) => {
    e?.preventDefault();
    e?.stopPropagation();

    if (followActionInProgress[followingId]) return;

    setFollowActionInProgress(prev => ({ ...prev, [followingId]: true }));

    // Optimistic update - remove from list immediately
    const prevFollowsList = [...followsList];
    setFollowsList(prev => prev.filter(u => u._id !== followingId));
    setFollowCounts(prev => ({ ...prev, following: Math.max(0, prev.following - 1) }));

    try {
      await unfollowUser(followingId);
      success(lang.current.success?.unfollowed || 'Unfollowed');
    } catch (err) {
      // Rollback on error
      setFollowsList(prevFollowsList);
      setFollowCounts(prev => ({ ...prev, following: prev.following + 1 }));
      const message = handleError(err, { context: 'Unfollow user' });
      showError(message || 'Failed to unfollow user');
    } finally {
      setFollowActionInProgress(prev => ({ ...prev, [followingId]: false }));
    }
  }, [followsList, followActionInProgress, success, showError]);

  // Fetch followers or following list for Follows tab
  const fetchFollowsList = useCallback(async (filter = followsFilter, reset = false) => {
    if (!userId) return;

    setFollowsLoading(true);
    try {
      const skip = reset ? 0 : followsList.length;
      const limit = 20;
      const options = { limit, skip };

      let response;
      if (filter === 'followers') {
        response = await getFollowers(userId, options);
        const users = response.followers || [];
        setFollowsList(prev => reset ? users : [...prev, ...users]);
        setFollowsPagination({
          total: response.total || 0,
          hasMore: skip + users.length < (response.total || 0),
          skip: skip + users.length
        });
      } else {
        response = await getFollowing(userId, options);
        const users = response.following || [];
        setFollowsList(prev => reset ? users : [...prev, ...users]);
        setFollowsPagination({
          total: response.total || 0,
          hasMore: skip + users.length < (response.total || 0),
          skip: skip + users.length
        });
      }
    } catch (err) {
      logger.error('[Profile] Failed to fetch follows list', { error: err.message });
    } finally {
      setFollowsLoading(false);
    }
  }, [userId, followsFilter, followsList.length]);

  // Handle follows filter change
  const handleFollowsFilterChange = useCallback((filter) => {
    setFollowsFilter(filter);
    setFollowsList([]);
    setFollowsPagination({ total: 0, hasMore: false, skip: 0 });
    fetchFollowsList(filter, true);
  }, [fetchFollowsList]);

  // Fetch follows list when tab becomes active
  useEffect(() => {
    if (uiState.follows && userId && followsList.length === 0) {
      fetchFollowsList(followsFilter, true);
    }
  }, [uiState.follows, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Register h1 for navbar integration - clicking scrolls to top
  // Re-run when currentProfile loads so h1 element is available
  useEffect(() => {
    const h1 = document.querySelector('h1');
    if (!h1) return;

    registerH1(h1);

    // Enable h1 text in navbar - clicking scrolls to top
    updateShowH1InNavbar(true);

    // Set action buttons if user is viewing their own profile. Guard the
    // setter so we don't repeatedly push identical arrays into AppContext,
    // which can trigger re-renders leading to update loops.
    if (isOwner && user) {
      const editOnClick = () => navigate('/profile/update');
      const newButtons = [
        {
          label: lang.current.label.editProfile,
          onClick: editOnClick,
          variant: "outline-primary",
          icon: "✏️",
          tooltip: lang.current.tooltip.editYourProfile,
          compact: true,
        },
      ];

      const last = lastPageButtonsRef.current;
      // Compare by label and existence of handler to avoid tight equality checks on function refs
      if (!last || last[0]?.label !== newButtons[0].label) {
        setPageActionButtons(newButtons);
        lastPageButtonsRef.current = newButtons;
      }
    } else {
      clearActionButtons();
      lastPageButtonsRef.current = null;
    }

    return () => {
      clearActionButtons();
      lastPageButtonsRef.current = null;
      // Disable h1 in navbar when leaving this view
      updateShowH1InNavbar(false);
    };
  }, [registerH1, clearActionButtons, updateShowH1InNavbar, setPageActionButtons, isOwner, user, navigate, currentProfile]);

  const handleExpNav = useCallback((view) => {
    setUiState({
      activity: view === 'activity',
      follows: view === 'follows',
      experiences: view === 'experiences',
      created: view === 'created',
      destinations: view === 'destinations',
    });
    // Update URL hash for deep linking
    try { window.history.pushState(null, '', `${window.location.pathname}#${view}`); } catch (e) {}
    // Note: Do NOT reset pagination on tab switch - preserve user's place in each tab
  }, []);

  // Handle clicking on profile metrics to navigate to corresponding tab
  const handleMetricClick = useCallback((hash, filter) => {
    // Set the tab state
    const tabName = filter ? 'follows' : hash;
    setUiState({
      activity: tabName === 'activity',
      follows: tabName === 'follows',
      experiences: tabName === 'experiences',
      created: tabName === 'created',
      destinations: tabName === 'destinations',
    });

    // Set filter if provided (for followers/following)
    if (filter) {
      setFollowsFilter(filter);
    }

    // Update URL hash for deep linking
    try { window.history.pushState(null, '', `${window.location.pathname}#${hash}`); } catch (e) {}
  }, []);

  // Get the active tab key from uiState
  const activeTab = useMemo(() => {
    if (uiState.activity) return 'activity';
    if (uiState.follows) return 'follows';
    if (uiState.experiences) return 'experiences';
    if (uiState.created) return 'created';
    if (uiState.destinations) return 'destinations';
    return 'activity';
  }, [uiState]);

  // Build tabs configuration for TabNav
  const profileTabs = useMemo(() => {
    const tabs = [];

    // Activity tab - only for own profile
    if (isOwnProfile) {
      tabs.push({
        id: 'activity',
        label: 'Activity',
        icon: <FaChartLine />,
      });
    }

    // Follows tab
    tabs.push({
      id: 'follows',
      label: 'Follows',
      icon: <FaUsers />,
    });

    // Planned (experiences) tab
    tabs.push({
      id: 'experiences',
      label: 'Planned',
      icon: <FaCalendarAlt />,
    });

    // Created tab
    tabs.push({
      id: 'created',
      label: lang.current.label.created,
      icon: <FaPlusCircle />,
    });

    // Destinations tab
    tabs.push({
      id: 'destinations',
      label: lang.current.label.destinations,
      icon: <FaMapMarkerAlt />,
    });

    return tabs;
  }, [isOwnProfile]);

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

  // Get user's avatar photo - MUST be before early returns to satisfy React hooks rules
  const avatarPhoto = useMemo(() => {
    if (!currentProfile?.photos?.length) return null;
    return getDefaultPhoto(currentProfile);
  }, [currentProfile]);

  // Safe counts for arrays that may be null while loading - MUST be before early returns
  const uniqueUserExperiencesCount = uniqueUserExperiences ? uniqueUserExperiences.length : 0;
  const uniqueCreatedExperiencesCount = uniqueCreatedExperiences ? uniqueCreatedExperiences.length : 0;
  const favoriteDestinationsCount = favoriteDestinations ? favoriteDestinations.length : 0;

  // Calculate owned vs shared plans - MUST be before early returns
  // Uses isCollaborative flag from API which indicates if user is NOT the owner
  const planCounts = useMemo(() => {
    if (!plans || !currentProfile) return { total: 0, owned: 0, shared: 0 };
    const total = plans.length;
    // shared = plans where isCollaborative is true (user is collaborator, not owner)
    const shared = plans.filter(plan => plan.isCollaborative === true).length;
    const owned = total - shared;
    return { total, owned, shared };
  }, [plans, currentProfile]);

  // Show error state if profile not found
  if (profileError === lang.current.alert.userNotFound) {
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

  // Show private profile state
  // Profile is private if: isPrivate flag is set, and user is not owner/admin
  if (currentProfile?.isPrivate && !isOwner) {
    return (
      <div style={{ padding: 'var(--space-20) 0' }}>
        <Container>
          <EmptyState
            variant="users"
            icon="🔒"
            title={lang.current.profile.privateProfileTitle}
            description={lang.current.profile.privateProfileDescription}
            primaryAction={lang.current.button.goBack}
            onPrimaryAction={() => navigate(-1)}
            size="lg"
          />
        </Container>
      </div>
    );
  }
  
  // Show full-page skeleton during initial load (before profile data arrives)
  if (isLoadingProfile && !currentProfile) {
    return <ProfileSkeleton />;
  }

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
                    } else if (isOwner) {
                      // Owner with no photos -> open upload/manage modal
                      setShowPhotoUploadModal(true);
                    }
                  }}
                  role={currentProfile?.photos?.length > 0 || isOwner ? "button" : undefined}
                  tabIndex={currentProfile?.photos?.length > 0 || isOwner ? 0 : undefined}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && (currentProfile?.photos?.length > 0 || isOwner)) {
                      e.preventDefault();
                      if (currentProfile?.photos?.length > 0) {
                        const defaultPhoto = getDefaultPhoto(currentProfile);
                        const photoIndex = currentProfile.photos.findIndex(
                          p => (p._id || p) === (defaultPhoto?._id || defaultPhoto)
                        );
                        setSelectedPhotoIndex(Math.max(0, photoIndex));
                        setShowPhotoModal(true);
                      } else if (isOwner) {
                        setShowPhotoUploadModal(true);
                      }
                    }
                  }}
                  aria-label={currentProfile?.photos?.length > 0 ? "View profile photos" : (isOwner ? "Manage profile photos" : undefined)}
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

                  {/* Curator Badge */}
                  {hasFeatureFlag(currentProfile, 'curator') && (
                    <div className={styles.curatorBadge}>
                      <FaStar /> Curator
                    </div>
                  )}

                  {/* Curator Links */}
                  {hasFeatureFlag(currentProfile, 'curator') && currentProfile?.links?.length > 0 && (
                    <div className={styles.profileLinks}>
                      {currentProfile.links.map((link, index) => {
                        const network = getSocialNetwork(link.type);
                        const LinkIcon = getLinkIcon(link);
                        const displayText = getLinkDisplayText(link);
                        const linkUrl = buildLinkUrl(link);
                        const isSocialLink = network && !network.isCustomUrl;

                        return (
                          <a
                            key={link._id || index}
                            href={linkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={isSocialLink ? styles.profileLinkSocial : styles.profileLink}
                            title={link.title || network?.name || 'Link'}
                          >
                            <LinkIcon
                              className={styles.profileLinkIcon}
                              style={isSocialLink ? { color: network.color } : undefined}
                            />
                            <span>{displayText || link.title}</span>
                            {!isSocialLink && <FaExternalLinkAlt size={10} />}
                          </a>
                        );
                      })}
                    </div>
                  )}

                  {/* Compact Metrics Bar - Clickable metrics navigate to corresponding tabs */}
                  <div className={styles.profileMetricsBar}>
                    <span
                      className={styles.profileMetricClickable}
                      onClick={() => handleMetricClick('followers', 'followers')}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleMetricClick('followers', 'followers'); } }}
                    >
                      <strong>{followCounts.followers}</strong> {followCounts.followers === 1 ? 'Follower' : 'Followers'}
                    </span>
                    <span className={styles.profileMetricDivider}>·</span>
                    <span
                      className={styles.profileMetricClickable}
                      onClick={() => handleMetricClick('following', 'following')}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleMetricClick('following', 'following'); } }}
                    >
                      <strong>{followCounts.following}</strong> Following
                    </span>
                    <span className={styles.profileMetricDivider}>·</span>
                    <span
                      className={styles.profileMetricClickable}
                      onClick={() => handleMetricClick('experiences')}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleMetricClick('experiences'); } }}
                    >
                      <strong>{planCounts.total}</strong> {planCounts.total === 1 ? 'Plan' : 'Plans'}
                      {planCounts.shared > 0 && (
                        <span className={styles.profileMetricSecondary}>
                          {' '}({planCounts.shared} shared)
                        </span>
                      )}
                    </span>
                    <span className={styles.profileMetricDivider}>·</span>
                    <span
                      className={styles.profileMetricClickable}
                      onClick={() => handleMetricClick('created')}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleMetricClick('created'); } }}
                    >
                      <strong>{uniqueCreatedExperiencesCount}</strong> {uniqueCreatedExperiencesCount === 1 ? 'Experience' : 'Experiences'}
                    </span>
                    <span className={styles.profileMetricDivider}>·</span>
                    <span
                      className={styles.profileMetricClickable}
                      onClick={() => handleMetricClick('destinations')}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleMetricClick('destinations'); } }}
                    >
                      <strong>{favoriteDestinationsCount}</strong> {favoriteDestinationsCount === 1 ? 'Destination' : 'Destinations'}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className={styles.profileActions}>
                  {!isOwner && (
                    <>
                      <Button
                        variant="outline"
                        style={{ borderRadius: 'var(--radius-full)' }}
                        onClick={async () => {
                          try {
                            // Defensive: ensure profile loaded and not messaging self
                            if (!currentProfile || currentProfile._id === user._id) return;
                            // Dynamically import chat-api util to avoid circular loads
                            const { getOrCreateDmChannel } = await import('../../utilities/chat-api');
                            const channel = await getOrCreateDmChannel(currentProfile._id);
                            const chId = channel?.id || channel?.cid || channel?._id || null;
                            setInitialChannelId(chId);
                            setShowMessagesModal(true);
                          } catch (err) {
                            const msg = handleError(err, { context: 'Start DM' });
                            showError(msg || 'Failed to open messages');
                          }
                        }}
                      >
                        <FaEnvelope /> Message
                      </Button>
                      {isFollowing ? (
                        <Button
                          variant={followButtonHovered ? 'danger' : 'outline'}
                          style={{ borderRadius: 'var(--radius-full)', minWidth: '100px' }}
                          onClick={handleUnfollow}
                          disabled={followLoading}
                          onMouseEnter={() => setFollowButtonHovered(true)}
                          onMouseLeave={() => setFollowButtonHovered(false)}
                          className={styles.followButton}
                        >
                          {followLoading ? lang.current.loading.default : followButtonHovered ? 'Unfollow' : 'Following'}
                        </Button>
                      ) : (
                        <Button
                          variant="gradient"
                          style={{ borderRadius: 'var(--radius-full)', minWidth: '100px' }}
                          onClick={handleFollow}
                          disabled={followLoading}
                          className={styles.followButton}
                        >
                          {followLoading ? lang.current.loading.default : 'Follow'}
                        </Button>
                      )}
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
                          <button
                            className={`dropdown-item ${styles.dropdownItem}`}
                            type="button"
                            onClick={() => setShowPhotoUploadModal(true)}
                            title={(lang.current && lang.current.aria && lang.current.aria.managePhotos) || 'Manage Photos'}
                            aria-label={(lang.current && lang.current.aria && lang.current.aria.managePhotos) || 'Manage Photos'}
                          >
                            <FaCamera className={styles.dropdownIcon} />
                            <span>Manage Photos</span>
                          </button>
                        </li>
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
          </Card.Body>
        </Card>

        {/* Tab Navigation - GitHub-style with icons */}
        <TabNav
          tabs={profileTabs}
          activeTab={activeTab}
          onTabChange={handleExpNav}
          className={styles.profileTabs}
        />

        {/* Content Grid */}
        <Row>
          <Col lg={12}>
            {/* Activity Tab - Only shown on own profile */}
            {uiState.activity && isOwnProfile && (
              <ActivityFeed userId={userId} />
            )}

            {/* Follows Tab */}
            {uiState.follows && (
              <div className={styles.followsTab}>
                {/* Filter Pills */}
                <div className={styles.followsFilterPills}>
                  <button
                    className={`${styles.followsFilterPill} ${followsFilter === 'followers' ? styles.followsFilterPillActive : ''}`}
                    onClick={() => handleFollowsFilterChange('followers')}
                  >
                    Followers ({followCounts.followers})
                  </button>
                  <button
                    className={`${styles.followsFilterPill} ${followsFilter === 'following' ? styles.followsFilterPillActive : ''}`}
                    onClick={() => handleFollowsFilterChange('following')}
                  >
                    Following ({followCounts.following})
                  </button>
                </div>

                {/* Users List */}
                <div className={styles.followsList}>
                  {followsLoading && followsList.length === 0 ? (
                    // Loading skeleton
                    Array.from({ length: 6 }).map((_, i) => (
                      <div key={`skeleton-follow-${i}`} className={styles.followsItemSkeleton}>
                        <SkeletonLoader variant="circle" width="48px" height="48px" />
                        <div style={{ flex: 1 }}>
                          <SkeletonLoader variant="text" width="120px" height="16px" />
                          <SkeletonLoader variant="text" width="80px" height="14px" style={{ marginTop: '4px' }} />
                        </div>
                      </div>
                    ))
                  ) : followsList.length === 0 ? (
                    // Empty state
                    <EmptyState
                      variant="users"
                      title={followsFilter === 'followers' ? 'No Followers Yet' : 'Not Following Anyone'}
                      description={followsFilter === 'followers'
                        ? (isOwnProfile ? "You don't have any followers yet." : `${getFirstName(currentProfile?.name)} doesn't have any followers yet.`)
                        : (isOwnProfile ? "You're not following anyone yet." : `${getFirstName(currentProfile?.name)} isn't following anyone yet.`)}
                      size="md"
                    />
                  ) : (
                    <>
                      {followsList.map((followUserItem) => (
                        <div key={followUserItem._id} className={styles.followsItemWrapper}>
                          <Link
                            to={`/profile/${followUserItem._id}`}
                            className={styles.followsItem}
                          >
                            <div className={styles.followsItemAvatar}>
                              {followUserItem.photos?.[0]?.url ? (
                                <img src={followUserItem.photos[0].url} alt={followUserItem.name} />
                              ) : (
                                <div className={styles.followsItemAvatarPlaceholder}>
                                  <FaUser />
                                </div>
                              )}
                            </div>
                            <div className={styles.followsItemInfo}>
                              <span className={styles.followsItemName}>{followUserItem.name}</span>
                              {followUserItem.location && (
                                <span className={styles.followsItemLocation}>
                                  <FaMapMarkerAlt /> {formatLocation(followUserItem.location)}
                                </span>
                              )}
                            </div>
                          </Link>
                          {isOwnProfile && (
                            <button
                              className={styles.followsItemAction}
                              onClick={(e) => followsFilter === 'followers'
                                ? handleRemoveFollower(followUserItem._id, e)
                                : handleUnfollowFromList(followUserItem._id, e)
                              }
                              disabled={followActionInProgress[followUserItem._id]}
                              title={followsFilter === 'followers' ? 'Remove follower' : 'Unfollow'}
                              aria-label={followsFilter === 'followers' ? `Remove ${followUserItem.name} as follower` : `Unfollow ${followUserItem.name}`}
                            >
                              {followActionInProgress[followUserItem._id] ? (
                                <span className={styles.followsItemActionSpinner} />
                              ) : (
                                <FaUserMinus />
                              )}
                            </button>
                          )}
                        </div>
                      ))}

                      {/* Load More Button */}
                      {followsPagination.hasMore && (
                        <div className={styles.followsLoadMore}>
                          <Button
                            variant="outline"
                            onClick={() => fetchFollowsList(followsFilter, false)}
                            disabled={followsLoading}
                          >
                            {followsLoading ? lang.current.loading.default : lang.current.button.loadMore}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

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
                        ? `You haven't favorited any destinations yet${user?.name ? `, ${getFirstName(user.name)}` : ''}. Browse destinations and add some to your favorites.`
                        : `${getFirstName(currentProfile?.name)} hasn't favorited any destinations yet.`}
                      primaryAction={isOwnProfile ? "Browse Destinations" : null}
                      onPrimaryAction={isOwnProfile ? () => window.location.href = '/destinations' : null}
                      size="md"
                    />
                  );
                })()}
              </div>
            )}
            {/* Planned Experiences Tab - client-side pagination for own profile, API-level for others */}
            {uiState.experiences && (
              <div className={styles.profileGrid} style={experiencesLoading && uniqueUserExperiences !== null ? { opacity: 0.6, pointerEvents: 'none', transition: 'opacity 0.2s ease' } : undefined}>
                {(() => {
                  // Initial load - show skeleton loaders
                  if (uniqueUserExperiences === null) {
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

                  // For own profile: plans are fully loaded, use client-side pagination
                  // For other profiles: API returns paginated data directly
                  const displayedExperiences = isOwnProfile && !showAllPlanned
                    ? uniqueUserExperiences.slice(
                        (experiencesPage - 1) * itemsPerPageComputed,
                        experiencesPage * itemsPerPageComputed
                      )
                    : uniqueUserExperiences;

                  const expTotalPages = isOwnProfile
                    ? Math.max(1, Math.ceil(uniqueUserExperiences.length / itemsPerPageComputed))
                    : (userExperiencesMeta?.totalPages || 1);

                  return displayedExperiences.length > 0 ? (
                    <>
                      {displayedExperiences.map((experience, index) => (
                        <ExperienceCard
                          experience={experience}
                          key={experience._planId || experience._id || index}
                          userPlans={plans}
                          showSharedIcon={experience._isCollaborative || false}
                        />
                      ))}
                      {/* Show placeholders on non-last pages to reserve space (own profile only) */}
                      {isOwnProfile && !showAllPlanned && experiencesPage < expTotalPages && displayedExperiences.length < itemsPerPageComputed && (
                        Array.from({ length: Math.max(0, itemsPerPageComputed - displayedExperiences.length) }).map((_, i) => (
                          <div key={`placeholder-exp-${i}`} className="d-block m-2" style={{ width: '20rem' }}>
                            <div className="position-relative" style={{ minHeight: '12rem', borderRadius: 'var(--radius-2xl)', overflow: 'hidden' }}>
                              <SkeletonLoader variant="rectangle" width="100%" height="100%" />
                            </div>
                          </div>
                        ))
                      )}
                    </>
                  ) : (
                    <EmptyState
                      variant="experiences"
                      title={isOwnProfile ? "No Planned Experiences" : "No Planned Experiences"}
                      description={isOwnProfile
                        ? `You haven't planned any experiences yet${user?.name ? `, ${getFirstName(user.name)}` : ''}. Browse experiences and start planning your next adventure.`
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
              <div className={styles.profileGrid} style={createdLoading && uniqueCreatedExperiences !== null ? { opacity: 0.6, pointerEvents: 'none', transition: 'opacity 0.2s ease' } : undefined}>
                {(() => {
                  // Initial load - show skeleton loaders
                  if (uniqueCreatedExperiences === null) {
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
                  // Keep existing content visible during page transitions (createdLoading)
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
                        ? `You haven't created any experiences yet${user?.name ? `, ${getFirstName(user.name)}` : ''}. Share your travel knowledge with the community.`
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

              {/* Experiences - client-side pagination for own profile, API-level for others */}
              {uiState.experiences && !showAllPlanned && (() => {
                // For own profile: calculate total pages from plans array
                // For other profiles: use API metadata
                const expTotalPages = isOwnProfile
                  ? Math.max(1, Math.ceil((uniqueUserExperiences?.length || 0) / itemsPerPageComputed))
                  : (userExperiencesMeta?.totalPages || 1);

                return expTotalPages > 1 ? (
                  <Pagination
                    currentPage={experiencesPage}
                    totalPages={expTotalPages}
                    onPageChange={setExperiencesPage}
                    disabled={experiencesLoading}
                  />
                ) : null;
              })()}

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
      {/* Photo Upload Modal - for owners to manage photos when none exist (or to be used elsewhere) */}
      {showPhotoUploadModal && (
        <PhotoUploadModal
          show={showPhotoUploadModal}
          onClose={() => setShowPhotoUploadModal(false)}
          entityType="user"
          entity={currentProfile}
          photos={currentProfile ? (currentProfile.photos_full && currentProfile.photos_full.length > 0 ? currentProfile.photos_full : (currentProfile.photos || [])) : []}
          onChange={(data) => {
            // Immediately merge UI changes so profile updates live while modal is open
            try {
              const photosFull = Array.isArray(data.photos_full) && data.photos_full.length > 0
                ? data.photos_full
                : (Array.isArray(data.photos) ? data.photos : []);

              // Merge into currentProfile for immediate UI update
              mergeProfile({ photos: photosFull, default_photo_id: data.default_photo_id || null });
      {/* Messages modal - used to start 1:1 DMs from profile view */}
      {showMessagesModal && (
        <MessagesModal
          show={showMessagesModal}
          onClose={() => {
            setShowMessagesModal(false);
            setInitialChannelId(null);
          }}
          initialChannelId={initialChannelId}
        />
      )}
            } catch (e) {
              // ignore merge failures
            }

            // Debounce background save to avoid hammering API during uploads/edits
            if (photoSaveTimerRef.current) clearTimeout(photoSaveTimerRef.current);
            photoSaveTimerRef.current = setTimeout(async () => {
              try {
                try { logger.debug('[Profile] Debounced save triggered', { userId: user._id, photosCount: (data.photos || []).length }); } catch (e) {}
                try { broadcastEvent('local:photos-updated', { at: Date.now(), userId: user._id, field: 'photos' }); } catch (e) {}
                // Persist only the photo IDs and default id to backend
                const resp = await updateUserApi(user._id, { photos: data.photos || [], default_photo_id: data.default_photo_id || null });
                // If API returns authoritative user data, merge it into current profile
                if (resp && typeof resp === 'object') {
                  try { mergeProfile(resp); } catch (e) { /* ignore merge errors */ }
                }
              } catch (err) {
                // Log but don't interrupt UI
                try { logger.error('[Profile] Failed to persist photo changes', err); } catch (e) {}
              }
            }, 800);
          }}
          onSave={async (data) => {
            // Final save: persist and merge authoritative server response
            try {
              try { broadcastEvent('local:photos-updated', { at: Date.now(), userId: user._id, field: 'photos' }); } catch (e) {}
              const updated = await updateUserApi(user._id, { photos: data.photos || [], default_photo_id: data.default_photo_id || null });
              if (updated) {
                mergeProfile(updated);
              }
            } catch (err) {
              throw err;
            }
          }}
        />
      )}
      </Container>
    </div>
  );
}

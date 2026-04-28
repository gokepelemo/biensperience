import { FaUser, FaPassport, FaCheckCircle, FaKey, FaEye, FaEdit, FaEnvelope, FaUserShield, FaMapMarkerAlt, FaPlane, FaHeart, FaCamera, FaStar, FaGlobe, FaExternalLinkAlt, FaCode, FaExclamationTriangle, FaCodeBranch, FaCog, FaShieldAlt, FaChartLine, FaUsers, FaCalendarAlt, FaPlusCircle, FaUserMinus, FaList, FaUserFriends, FaArrowLeft } from "react-icons/fa";
import { getSocialNetwork, getLinkIcon, getLinkDisplayText, buildLinkUrl } from "../../utilities/social-links";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from "react";
import styles from "./Profile.module.css";
import { useUser } from "../../contexts/UserContext";
import { useData } from "../../contexts/DataContext";
import { useApp } from "../../contexts/AppContext";
import { useExperienceWizard } from "../../contexts/ExperienceWizardContext";
import ExperienceCard from "./../../components/ExperienceCard/ExperienceCard";
import SkeletonLoader from "../../components/SkeletonLoader/SkeletonLoader";
import Loading from "../../components/Loading/Loading";
import { ProfileSkeleton, ProfileHeaderSkeleton, ProfileContentGrid } from "./components";
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
import { Button, EmptyState, Container, EntityNotFound, Alert, Card, Row, Col, Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from "../../components/design-system";
import { useToast } from '../../contexts/ToastContext';
import { getDefaultPhoto } from "../../utilities/photo-utils";
import { getFirstName } from "../../utilities/name-utils";
import { formatLocation } from "../../utilities/address-utils";
import { logger } from "../../utilities/logger";
import { eventBus } from "../../utilities/event-bus";
import { broadcastEvent } from "../../utilities/event-bus";
import { getOrCreateDmChannel } from "../../utilities/chat-api";
import { storePreference, retrievePreference, expirePreference } from "../../utilities/preferences-utils";
import { hasFeatureFlag } from "../../utilities/feature-flags";
import { isSystemUser, getSystemUserBySlug } from "../../utilities/system-users";
import { useFollowManager } from "../../hooks/useFollowManager";
import { getActivityFeed } from "../../utilities/dashboard-api";
import ActivityFeed from "../../components/ActivityFeed/ActivityFeed";
import TabNav from "../../components/TabNav/TabNav";
import UserAvatar from "../../components/UserAvatar/UserAvatar";
import { SearchableSelectBasic } from "../../components/FormField";
import SplitButton from "../../components/SplitButton/SplitButton";

export default function Profile() {
    const { user, profile, updateUser: updateUserContext } = useUser();
  const { destinations, plans, applyDestinationsFilter, loading: dataLoading } = useData();
  const { registerH1, clearActionButtons, updateShowH1InNavbar, setPageActionButtons } = useApp();
  const { openExperienceWizard } = useExperienceWizard();
  const navigate = useNavigate();
  let { profileId } = useParams();

  // Check if this is a system user slug (e.g. /profile/bienbot, /profile/archive)
  const systemUser = useMemo(() => getSystemUserBySlug(profileId), [profileId]);

  let userId = profileId && !systemUser ? profileId : user._id;
  const isOwner = !profileId || profileId === user._id || isSuperAdmin(user);
  // For empty state messaging, only check if viewing own profile (not super admin override)
  const isOwnProfile = !profileId || profileId === user._id;
  
  // NEVER initialize with profile from context to prevent showing wrong user's data
  const [currentProfile, setCurrentProfile] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState(null);
  const [uiState, setUiState] = useState({
    activity: isOwnProfile,
    follows: !isOwnProfile,
    experiences: false,
    created: false,
    destinations: false,
  });

  // Track previous profileId to detect navigation between profiles
  const prevProfileIdRef = useRef(profileId);
  // Track whether the initial profile load has completed (for context-sync effect)
  const initialProfileLoadedRef = useRef(false);

  // Guard against stale async responses overwriting UI after navigation.
  // We intentionally use refs (not state) to avoid introducing extra re-renders.
  const activeUserIdRef = useRef(userId);
  const latestProfileRequestIdRef = useRef(0);
  const latestUserExperiencesRequestIdRef = useRef(0);
  const latestCreatedExperiencesRequestIdRef = useRef(0);

  // Activity tab state
  const [activityFeedType, setActivityFeedType] = useState('all'); // 'all' | 'own' | 'following'

  // Follow management (state, effects, actions)
  const {
    isFollowing,
    isPending,
    followLoading,
    followCounts,
    followRelationship,
    followButtonHovered,
    setFollowButtonHovered,
    followButtonConfirming,
    setFollowButtonConfirming,
    handleFollowButtonClick,
    followsFilter,
    followsList,
    followsLoading,
    followsPagination,
    followActionInProgress,
    handleFollow,
    handleUnfollow,
    handleWithdrawRequest,
    handleRemoveFollower,
    handleUnfollowFromList,
    fetchFollowsList,
    handleFollowsFilterChange,
  } = useFollowManager({
    userId,
    currentUserId: user._id,
    isOwnProfile,
    currentProfile,
    followsTabActive: uiState.follows,
    profileId,
  });

  const [showApiTokenModal, setShowApiTokenModal] = useState(false);
  const [showActivityMonitor, setShowActivityMonitor] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [showPhotoUploadModal, setShowPhotoUploadModal] = useState(false);
  const photoSaveTimerRef = useRef(null);
  // Messages modal state for initiating DMs from profile
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  const [initialChannelId, setInitialChannelId] = useState(null);
  const [initialTargetUserId, setInitialTargetUserId] = useState(null);
  const [messagesModalTitle, setMessagesModalTitle] = useState('Messages');
  const [openingDirectMessage, setOpeningDirectMessage] = useState(false);

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
      setActivityFeedType('own');
      // Reset initial load tracking so context-sync effect waits for getProfile
      initialProfileLoadedRef.current = false;
      // Update ref to new value
      prevProfileIdRef.current = profileId;
    }
  }, [profileId]);

  // Keep an always-fresh userId reference for stale-request guards
  useEffect(() => {
    activeUserIdRef.current = userId;
  }, [userId]);

  // Ensure destinations are loaded (DataContext skips them on initial auth)
  useEffect(() => {
    if (destinations.length === 0 && !dataLoading) {
      applyDestinationsFilter({}, { shuffle: false });
    }
  }, [destinations.length, dataLoading, applyDestinationsFilter]);

  const applyHash = useCallback((rawHash) => {
    try {
      const hash = (rawHash || '').replace('#', '');

      // Empty hash - close modals if open
      if (!hash) {
        setShowApiTokenModal(false);
        setShowActivityMonitor(false);
        return;
      }

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
        handleFollowsFilterChange(hash);
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
      // Unknown hash - ignore
    } catch (e) {
      // ignore
    }
  }, [navigate, handleFollowsFilterChange]);

  // Initialize tab from hash (supports deep links like /profile#created)
  useEffect(() => {
    applyHash(window.location.hash || '');
  }, [applyHash]);

  // Keep UI tab state in sync when hash changes externally
  useEffect(() => {
    const onHashChange = () => {
      applyHash(window.location.hash || '');
    };

    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [applyHash]);
  // Experiences state with pagination metadata
  const [userExperiences, setUserExperiences] = useState(null);
  const [userExperiencesMeta, setUserExperiencesMeta] = useState(null);
  const [createdExperiences, setCreatedExperiences] = useState(null);
  const [createdExperiencesMeta, setCreatedExperiencesMeta] = useState(null);
  const [experiencesLoading, setExperiencesLoading] = useState(false);
  const [createdLoading, setCreatedLoading] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const { success, error: showError, undoable } = useToast();
  const [resendInProgress, setResendInProgress] = useState(false);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [showAllExperienceTypes, setShowAllExperienceTypes] = useState(false);
  const [showAllPlanned, setShowAllPlanned] = useState(false);
  const [showAllCreated, setShowAllCreated] = useState(false);
  const [showAllDestinations, setShowAllDestinations] = useState(false);
  const COOLDOWN_SECONDS = 60;
  const RESEND_COOLDOWN_PREF_KEY = 'session.resendVerificationCooldown.expiresAt';
  const EXPERIENCE_TYPES_INITIAL_DISPLAY = 10;
  const ITEMS_PER_PAGE = 6; // Fixed items per page for API pagination
  // Pagination for profile tabs
  const [experiencesPage, setExperiencesPage] = useState(1);
  const [createdPage, setCreatedPage] = useState(1);
  const [destinationsPage, setDestinationsPage] = useState(1);
  const reservedRef = useRef(null);
  const [itemsPerPageComputed, setItemsPerPageComputed] = useState(ITEMS_PER_PAGE);
  const cooldownTimerRef = useRef(null);
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
          (typeof updates.photos[0] === 'string' || !updates.photos[0]?.photo?.url);

        // If incoming is unpopulated but we have populated data, keep existing
        if (isUnpopulated && prev.photos.length > 0 && !!prev.photos[0]?.photo?.url) {
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

  const clearCooldownTimer = useCallback(() => {
    if (cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
  }, []);

  const applyCooldown = useCallback((expiresAt) => {
    if (!expiresAt || Number.isNaN(Number(expiresAt))) return;

    clearCooldownTimer();

    const remainingSeconds = Math.max(0, Math.ceil((Number(expiresAt) - Date.now()) / 1000));
    if (remainingSeconds <= 0) {
      setResendDisabled(false);
      setCooldownRemaining(0);
      return;
    }

    setResendDisabled(true);
    setCooldownRemaining(remainingSeconds);

    cooldownTimerRef.current = setInterval(() => {
      const rem = Math.max(0, Math.ceil((Number(expiresAt) - Date.now()) / 1000));
      if (rem <= 0) {
        clearCooldownTimer();
        setResendDisabled(false);
        setCooldownRemaining(0);
        // Clean up stored preference (best-effort)
        expirePreference(RESEND_COOLDOWN_PREF_KEY, { userId: user?._id }).catch(() => {});
      } else {
        setCooldownRemaining(rem);
      }
    }, 1000);
  }, [RESEND_COOLDOWN_PREF_KEY, clearCooldownTimer, user?._id]);

  // Start a cooldown for resend verification and persist via encrypted preferences
  const startCooldown = useCallback(() => {
    const expiresAt = Date.now() + COOLDOWN_SECONDS * 1000;

    // Persist (best-effort). Use a non-PII key, encrypted with userId.
    storePreference(
      RESEND_COOLDOWN_PREF_KEY,
      expiresAt,
      { userId: user?._id, ttl: COOLDOWN_SECONDS * 1000 }
    ).catch(() => {});

    applyCooldown(expiresAt);
  }, [COOLDOWN_SECONDS, RESEND_COOLDOWN_PREF_KEY, applyCooldown, user?._id]);

  // On profile load, restore any existing resend-verification cooldown
  useEffect(() => {
    if (!isOwnProfile || !currentProfile || !user?._id) return;

    let cancelled = false;

    const restore = async () => {
      const expiresAt = await retrievePreference(
        RESEND_COOLDOWN_PREF_KEY,
        null,
        { userId: user._id }
      );

      if (cancelled) return;
      if (!expiresAt) {
        clearCooldownTimer();
        setResendDisabled(false);
        setCooldownRemaining(0);
        return;
      }

      applyCooldown(expiresAt);
    };

    restore().catch(() => {});

    return () => {
      cancelled = true;
      clearCooldownTimer();
    };
  }, [currentProfile, isOwnProfile, RESEND_COOLDOWN_PREF_KEY, applyCooldown, clearCooldownTimer, user?._id]);

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
    // For super admins, the API returns separate entries for each plan (no deduplication needed)
    // For regular users, deduplicate experiences (backwards compatibility)
    if (isSuperAdmin(user)) {
      return userExperiences || [];
    } else {
      return deduplicateById(userExperiences) || [];
    }
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

    const requestId = ++latestUserExperiencesRequestIdRef.current;
    const requestedUserId = userId;
    const isStale = () => activeUserIdRef.current !== requestedUserId || latestUserExperiencesRequestIdRef.current !== requestId;

    setExperiencesLoading(true);
    try {
      const response = await showUserExperiences(userId, { page, limit: ITEMS_PER_PAGE });

      if (isStale()) return;

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
      if (isStale()) return;
      handleError(err, { context: 'Load experiences' });
    } finally {
      if (!isStale()) setExperiencesLoading(false);
    }
  }, [userId]);

  // Fetch created experiences with pagination
  const fetchCreatedExperiences = useCallback(async (page = 1) => {
    if (!userId) return;

    const requestId = ++latestCreatedExperiencesRequestIdRef.current;
    const requestedUserId = userId;
    const isStale = () => activeUserIdRef.current !== requestedUserId || latestCreatedExperiencesRequestIdRef.current !== requestId;

    setCreatedLoading(true);
    try {
      const response = await showUserCreatedExperiences(userId, { page, limit: ITEMS_PER_PAGE });

      if (isStale()) return;

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
      if (isStale()) return;
      handleError(err, { context: 'Load created experiences' });
    } finally {
      if (!isStale()) setCreatedLoading(false);
    }
  }, [userId]);

  const getProfile = useCallback(async (options = {}) => {
    const { forceUserData = false } = options;
    const requestId = ++latestProfileRequestIdRef.current;
    const requestedUserId = userId;
    const isStale = () => activeUserIdRef.current !== requestedUserId || latestProfileRequestIdRef.current !== requestId;

    if (!isOwner) {
      setIsLoadingProfile(true);
    }
    setProfileError(null);

    // Validate userId before API calls
    if (!userId || typeof userId !== 'string' || userId.length !== 24) {
      if (!isStale()) {
        setProfileError(lang.current.alert.invalidUserId);
        setIsLoadingProfile(false);
      }
      return;
    }

    // Block access to system user profiles (e.g., Archive User)
    // These are internal system accounts that should never be publicly viewable
    if (isSystemUser(userId)) {
      if (!isStale()) {
        setProfileError(lang.current.alert.userNotFound);
        setIsLoadingProfile(false);
      }
      return;
    }

    try {
      const canUseContextProfile = isOwner && !forceUserData && profile && profile._id === userId;

      // Fetch profile and first page of experiences in parallel
      const [userData, experienceResponse, createdResponse] = await Promise.all([
        canUseContextProfile ? Promise.resolve(profile) : getUserData(userId),
        showUserExperiences(userId, { page: 1, limit: ITEMS_PER_PAGE }),
        showUserCreatedExperiences(userId, { page: 1, limit: ITEMS_PER_PAGE })
      ]);

      if (isStale()) return;

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
      if (isStale()) return;

      // Check if it's a 404 error
      if (err.message && err.message.includes('404')) {
        setProfileError(lang.current.alert.userNotFound);
      } else {
        handleError(err, { context: 'Load profile' });
        setProfileError(lang.current.alert.failedToLoadProfile);
      }
    } finally {
      if (!isStale()) {
        setIsLoadingProfile(false);
        initialProfileLoadedRef.current = true;
      }
    }
  }, [userId, isOwner, profile]);

  // Sync owner profile from context AFTER initial load completes.
  // This keeps currentProfile fresh when the UserContext profile updates
  // (e.g. avatar change) without interfering with getProfile's loading flow.
  useEffect(() => {
    if (isOwner && profile && profile._id === userId && initialProfileLoadedRef.current) {
      // Only merge context updates once the initial load has completed
      mergeProfile(profile);
    }
  }, [isOwner, profile, userId, mergeProfile]);

  // If viewing another user's profile and Activity tab is selected (which they can't see),
  // switch to Follows tab instead
  useEffect(() => {
    if (!isOwnProfile && uiState.activity) {
      setUiState(prev => ({ ...prev, activity: false, follows: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwnProfile]);

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
      getProfile({ forceUserData: true });
    };

    const handlePhotoUpdated = (event) => {
      const photo = event.photo;
      if (!photo || !photo._id) return;
      // Update photo in profile if it exists
      setCurrentProfile(prev => {
        if (!prev?.photos) return prev;
        const photoIndex = prev.photos.findIndex(p => (p.photo?._id || p.photo)?.toString() === photo._id?.toString());
        if (photoIndex === -1) return prev;
        const updatedPhotos = [...prev.photos];
        updatedPhotos[photoIndex] = { ...prev.photos[photoIndex], photo };
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
          (p.photo?._id || p.photo)?.toString() !== photoId.toString()
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
    // Also clear the list and pagination to trigger a fresh fetch
    if (filter) {
      setFollowsFilter(filter);
      setFollowsList([]);
      setFollowsPagination({ total: 0, hasMore: false, skip: 0 });
    }

    // Update URL hash for deep linking
    try { window.history.pushState(null, '', `${window.location.pathname}#${hash}`); } catch (e) {}
  }, []);

  // Stable renderCard for the planned-experiences tab. Profile.jsx re-renders
  // frequently (tab switches, follow state changes, etc.); without useCallback
  // each render hands ProfileContentGrid a fresh function identity, defeating
  // its React.memo and forcing every ExperienceCard child to re-render.
  // Depends only on `plans` so identity is stable across unrelated state changes.
  const renderExperienceCardForGrid = useCallback((experience, index) => (
    <ExperienceCard
      experience={experience}
      key={experience._planId || experience._id || index}
      userPlans={plans}
      showSharedIcon={experience._isCollaborative || false}
      planId={experience._planId}
    />
  ), [plans]);

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
        label: lang.current.profile.activityTab,
        icon: <FaChartLine />,
      });
    }

    // Follows tab
    tabs.push({
      id: 'follows',
      label: lang.current.profile.followsTab,
      icon: <FaUsers />,
    });

    // Planned (experiences) tab
    tabs.push({
      id: 'experiences',
      label: lang.current.profile.plannedTab,
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

  // Avatar rendering is now handled by UserAvatar with 'profile' size,
  // which uses the shared avatar-cache for consistent resolution.

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

  // Show system user info page (e.g. /profile/bienbot, /profile/archive)
  if (systemUser) {
    return (
      <div style={{ padding: 'var(--space-20) 0' }}>
        <Container>
          <EmptyState
            icon={systemUser.icon}
            title={systemUser.name}
            description={systemUser.description}
            size="lg"
            primaryAction={lang.current.button.goHome || 'Go Home'}
            onPrimaryAction={() => navigate('/')}
          />
        </Container>
      </div>
    );
  }

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
    const handleBack = () => {
      if (document.referrer && document.referrer.startsWith(window.location.origin)) {
        navigate(-1);
      } else {
        navigate('/');
      }
    };

    const profileFirstName = currentProfile?.name ? getFirstName(currentProfile.name) : lang.current.profile.thisUser;

    // Determine what to show based on follow state
    let primaryActionContent = null;
    let onPrimaryActionHandler = null;

    if (isPending) {
      // Request already sent - show disabled state
      primaryActionContent = lang.current.button.requested;
      onPrimaryActionHandler = null; // No action, effectively disabled
    } else if (!isFollowing) {
      // Not following - show follow button
      primaryActionContent = lang.current.profile.followUserAction.replace('{name}', profileFirstName);
      onPrimaryActionHandler = handleFollow;
    }

    return (
      <div style={{ padding: 'var(--space-20) 0' }}>
        <Container>
          <EmptyState
            variant="users"
            icon="🔒"
            title={lang.current.profile.privateProfileTitle}
            description={lang.current.profile.privateProfileDescriptionName.replace('{name}', profileFirstName)}
            primaryAction={primaryActionContent}
            onPrimaryAction={onPrimaryActionHandler}
            secondaryAction={<><FaArrowLeft /> {lang.current.button.back}</>}
            onSecondaryAction={handleBack}
            size="lg"
          />
          {isPending && (
            <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginTop: 'var(--space-4)' }}>
              {lang.current.profile.followRequestPendingMessage}{' '}
              <button
                type="button"
                onClick={handleWithdrawRequest}
                disabled={followLoading}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: 'var(--color-primary)',
                  textDecoration: 'underline',
                  cursor: followLoading ? 'not-allowed' : 'pointer',
                  font: 'inherit',
                  opacity: followLoading ? 0.6 : 1,
                }}
              >
                {followLoading ? lang.current.button.withdrawing : lang.current.button.withdrawRequest}
              </button>
            </p>
          )}
        </Container>
      </div>
    );
  }
  
  // Show full-page skeleton during initial load (before profile data arrives)
  if (isLoadingProfile && !currentProfile) {
    const activeTab = uiState.activity
      ? 'activity'
      : uiState.follows
      ? 'follows'
      : uiState.created
      ? 'created'
      : uiState.destinations
      ? 'destinations'
      : 'experiences';

    return (
      <div style={{ backgroundColor: 'var(--color-bg-primary)', minHeight: '100vh', padding: 'var(--space-8) 0' }}>
        <Container>
          <ProfileSkeleton isOwner={isOwner} activeTab={activeTab} />
        </Container>
      </div>
    );
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
                        p => (p.photo?._id || p.photo)?.toString() === (defaultPhoto?._id || defaultPhoto)?.toString()
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
                          p => (p.photo?._id || p.photo)?.toString() === (defaultPhoto?._id || defaultPhoto)?.toString()
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
                  <UserAvatar
                    user={currentProfile}
                    size="profile"
                    linkToProfile={false}
                    className={styles.profileAvatar}
                  />
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
                      <strong>{followCounts.followers}</strong> {followCounts.followers === 1 ? lang.current.profile.follower : lang.current.profile.followers}
                    </span>
                    <span className={styles.profileMetricDivider}>·</span>
                    <span
                      className={styles.profileMetricClickable}
                      onClick={() => handleMetricClick('following', 'following')}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleMetricClick('following', 'following'); } }}
                    >
                      <strong>{followCounts.following}</strong> {lang.current.profile.followingLabel}
                    </span>
                    <span className={styles.profileMetricDivider}>·</span>
                    <span
                      className={styles.profileMetricClickable}
                      onClick={() => handleMetricClick('experiences')}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleMetricClick('experiences'); } }}
                    >
                      <strong>{planCounts.total}</strong> {planCounts.total === 1 ? lang.current.profile.plan : lang.current.profile.plans}
                      {planCounts.shared > 0 && (
                        <span className={styles.profileMetricSecondary}>
                          {' '}({planCounts.shared} {lang.current.profile.shared})
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
                      <strong>{uniqueCreatedExperiencesCount}</strong> {uniqueCreatedExperiencesCount === 1 ? lang.current.profile.experience : lang.current.profile.experiences}
                    </span>
                    <span className={styles.profileMetricDivider}>·</span>
                    <span
                      className={styles.profileMetricClickable}
                      onClick={() => handleMetricClick('destinations')}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleMetricClick('destinations'); } }}
                    >
                      <strong>{favoriteDestinationsCount}</strong> {favoriteDestinationsCount === 1 ? lang.current.profile.destination : lang.current.profile.destinations}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className={styles.profileActions}>
                  {/* Message button: show for super admins OR mutual follows. Always allow super admins (but not when messaging self) */}
                    {(currentProfile && currentProfile._id !== user._id) && (isSuperAdmin(user) || followRelationship?.isMutual) && (
                    <Button
                      variant="outline"
                      size="sm"
                      style={{ borderRadius: 'var(--radius-full)' }}
                      disabled={openingDirectMessage}
                      onClick={async () => {
                        // Defensive: ensure profile loaded and not messaging self
                        if (!currentProfile || currentProfile._id === user._id) return;

                        setOpeningDirectMessage(true);
                        try {
                          // Match the behavior of other DM entry points (e.g. DirectMessageChatButton):
                          // pre-create/fetch the DM channel so the modal opens directly into it.
                          const resp = await getOrCreateDmChannel(currentProfile._id);
                          const channelId = resp?.id || resp?.cid || resp?._id || resp;
                          if (!channelId) throw new Error('Failed to open DM');

                          setMessagesModalTitle('Messages');
                          setInitialTargetUserId(null);
                          setInitialChannelId(channelId);
                          setShowMessagesModal(true);
                        } catch (err) {
                          logger.error('[Profile] Failed to open DM from profile', err);
                          showError(err?.message || lang.current.profile.failedToOpenMessage);
                        } finally {
                          setOpeningDirectMessage(false);
                        }
                      }}
                    >
                      <FaEnvelope /> {openingDirectMessage ? lang.current.button.opening : lang.current.button.message}
                    </Button>
                  )}
                  {/* Follow/Unfollow buttons: show for any non-own-profile (includes super admins viewing other users) */}
                  {!isOwnProfile && (
                    <>
                      {isFollowing ? (
                        <Button
                          variant={(followButtonHovered || followButtonConfirming) ? 'danger' : 'outline'}
                          size="sm"
                          style={{ borderRadius: 'var(--radius-full)', minWidth: '100px' }}
                          onClick={handleFollowButtonClick}
                          disabled={followLoading}
                          onMouseEnter={() => setFollowButtonHovered(true)}
                          onMouseLeave={() => { setFollowButtonHovered(false); setFollowButtonConfirming(false); }}
                        >
                          {followLoading ? lang.current.loading.default : (followButtonHovered || followButtonConfirming) ? lang.current.button.unfollow : lang.current.button.following}
                        </Button>
                      ) : isPending ? (
                        <Button
                          variant="outline"
                          size="sm"
                          style={{ borderRadius: 'var(--radius-full)', minWidth: '100px' }}
                          disabled={true}
                          className={styles.followButton}
                        >
                          {lang.current.button.requested}
                        </Button>
                      ) : (
                        <Button
                          variant="gradient"
                          size="sm"
                          style={{ borderRadius: 'var(--radius-full)', minWidth: '100px' }}
                          onClick={handleFollow}
                          disabled={followLoading}
                          className={styles.followButton}
                        >
                          {followLoading ? lang.current.loading.default : lang.current.button.follow}
                        </Button>
                      )}
                    </>
                  )}
                  {isOwner && (
                    <SplitButton
                      label={lang.current.label.editProfile}
                      icon={<FaEdit />}
                      onClick={() => navigate('/profile/update')}
                      variant="outline"
                      size="sm"
                      rounded
                      menuAriaLabel={lang.current.aria.profileActions}
                      placement="bottom-end"
                    >
                      <SplitButton.Item value="photos" onClick={() => setShowPhotoUploadModal(true)}>
                        <FaCamera className={styles.dropdownIcon} />
                        {lang.current.button.managePhotos}
                      </SplitButton.Item>
                      {currentProfile && !currentProfile.emailConfirmed && (
                        <SplitButton.Item
                          value="resend-email"
                          onClick={async () => {
                            if (!currentProfile || !currentProfile.email) return;
                            if (resendInProgress || resendDisabled) return;
                            try {
                              setResendInProgress(true);
                              await resendConfirmation(currentProfile.email);
                              startCooldown();
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
                          {lang.current.alert.emailNotVerifiedAction} {resendDisabled && cooldownRemaining > 0 ? `(${cooldownRemaining}s)` : ''}
                        </SplitButton.Item>
                      )}
                      {isSuperAdmin(user) && (
                        <>
                          <SplitButton.Separator />
                          <SplitButton.Item value="api-tokens" onClick={handleOpenApiModal}>
                            <FaKey className={styles.dropdownIcon} />
                            API Tokens
                          </SplitButton.Item>
                          <SplitButton.Item value="activity-monitor" onClick={handleOpenActivityMonitor}>
                            <FaEye className={styles.dropdownIcon} />
                            Activity Monitor
                          </SplitButton.Item>
                        </>
                      )}
                      {isSuperAdmin(user) && profileId && profileId !== user._id && (
                        <SplitButton.Item value="admin-update" asChild>
                          <Link to={`/profile/${profileId}/update`}>
                            <FaUserShield className={styles.dropdownIcon} />
                            Admin Update
                          </Link>
                        </SplitButton.Item>
                      )}
                    </SplitButton>
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

        {/* Content Grid - Use switch pattern to ensure only ONE tab renders at a time */}
        <Row>
          <Col lg={12}>
            {/* Render active tab content using switch pattern for mutual exclusivity */}
            {activeTab === 'activity' && isOwnProfile && (
              <>
                <ActivityFeed
                  userId={userId}
                  feedType={activityFeedType}
                  rightControls={(
                    <div className={styles.activityFilterDropdown}>
                      <SearchableSelectBasic
                        options={[
                          { value: 'all', label: lang.current.profile.activityFilterAll, icon: FaList },
                          { value: 'own', label: lang.current.profile.activityFilterOwn, icon: FaList },
                          { value: 'following', label: lang.current.profile.activityFilterFollowing, icon: FaUserFriends }
                        ]}
                        value={activityFeedType}
                        onChange={setActivityFeedType}
                        placeholder={lang.current.profile.filterActivity}
                        searchable={false}
                        size="md"
                        aria-label={lang.current.profile.filterActivity}
                      />
                    </div>
                  )}
                />
              </>
            )}

            {activeTab === 'follows' && (
              <div className={styles.followsTab}>
                {/* Filter Pills */}
                <div className={styles.followsFilterPills}>
                  <button
                    className={`${styles.followsFilterPill} ${followsFilter === 'followers' ? styles.followsFilterPillActive : ''}`}
                    onClick={() => handleFollowsFilterChange('followers')}
                  >
                    {lang.current.profile.followers} ({followCounts.followers})
                  </button>
                  <button
                    className={`${styles.followsFilterPill} ${followsFilter === 'following' ? styles.followsFilterPillActive : ''}`}
                    onClick={() => handleFollowsFilterChange('following')}
                  >
                    {lang.current.profile.followingLabel} ({followCounts.following})
                  </button>
                </div>

                {/* Users List */}
                <div className={styles.followsList}>
                  {followsLoading && followsList.length === 0 ? (
                    // Loading skeleton
                    Array.from({ length: 6 }).map((_, i) => (
                      <div key={`skeleton-follow-${i}`} className={styles.followsItemSkeleton}>
                        <SkeletonLoader variant="circle" width="40px" height="40px" />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                          <SkeletonLoader variant="text" width="160px" height="16px" />
                          <SkeletonLoader variant="text" width="100px" height="14px" />
                        </div>
                      </div>
                    ))
                  ) : followsList.length === 0 ? (
                    // Empty state
                    <EmptyState
                      variant="users"
                      title={followsFilter === 'followers' ? lang.current.profile.noFollowersYet : lang.current.profile.notFollowingAnyone}
                      description={followsFilter === 'followers'
                        ? (isOwnProfile ? lang.current.profile.noFollowersOwnProfile : lang.current.profile.noFollowersOtherProfile.replace('{name}', getFirstName(currentProfile?.name)))
                        : (isOwnProfile ? lang.current.profile.notFollowingOwnProfile : lang.current.profile.notFollowingOtherProfile.replace('{name}', getFirstName(currentProfile?.name)))}
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
                              <UserAvatar user={followUserItem} size="md" linkToProfile={false} />
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
                              title={followsFilter === 'followers' ? lang.current.aria.removeFollower : lang.current.aria.unfollowUser}
                              aria-label={followsFilter === 'followers' ? lang.current.aria.removeFollowerName.replace('{name}', followUserItem.name) : lang.current.aria.unfollowUserName.replace('{name}', followUserItem.name)}
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

            {activeTab === 'destinations' && (() => {
              const displayedDestinations = favoriteDestinations === null ? null
                : showAllDestinations ? favoriteDestinations
                : favoriteDestinations.slice((destinationsPage - 1) * itemsPerPageComputed, (destinationsPage - 1) * itemsPerPageComputed + itemsPerPageComputed);
              const destTotalPages = favoriteDestinations ? Math.max(1, Math.ceil(favoriteDestinations.length / itemsPerPageComputed)) : 1;

              return (
                <ProfileContentGrid
                  ref={reservedRef}
                  type="destinations"
                  items={displayedDestinations}
                  skeletonCount={Math.min(6, Math.max(3, Math.floor(itemsPerPageComputed / 2)))}
                  itemsPerPage={itemsPerPageComputed}
                  currentPage={destinationsPage}
                  onPageChange={setDestinationsPage}
                  showPagination={!showAllDestinations}
                  meta={{ totalPages: destTotalPages }}
                  showPlaceholders={!showAllDestinations}
                  emptyState={{
                    title: isOwnProfile ? "No Destinations Yet" : "No Destinations",
                    description: isOwnProfile
                      ? `You haven't favorited any destinations yet${user?.name ? `, ${getFirstName(user.name)}` : ''}. Browse destinations and add some to your favorites.`
                      : `${getFirstName(currentProfile?.name)} hasn't favorited any destinations yet.`,
                    primaryAction: isOwnProfile ? "Browse Destinations" : null,
                    onPrimaryAction: isOwnProfile ? () => navigate('/destinations') : null
                  }}
                />
              );
            })()}

            {activeTab === 'experiences' && (() => {
              const displayedExperiences = uniqueUserExperiences === null ? null
                : isOwnProfile && !showAllPlanned
                  ? uniqueUserExperiences.slice((experiencesPage - 1) * itemsPerPageComputed, experiencesPage * itemsPerPageComputed)
                  : uniqueUserExperiences;
              const expTotalPages = uniqueUserExperiences
                ? (isOwnProfile ? Math.max(1, Math.ceil(uniqueUserExperiences.length / itemsPerPageComputed)) : (userExperiencesMeta?.totalPages || 1))
                : 1;

              return (
                <ProfileContentGrid
                  type="experiences"
                  items={displayedExperiences}
                  isLoading={experiencesLoading && uniqueUserExperiences !== null}
                  skeletonCount={ITEMS_PER_PAGE}
                  itemsPerPage={itemsPerPageComputed}
                  currentPage={experiencesPage}
                  onPageChange={setExperiencesPage}
                  showPagination={!showAllPlanned}
                  meta={{ totalPages: expTotalPages }}
                  showPlaceholders={isOwnProfile && !showAllPlanned}
                  userPlans={plans}
                  renderCard={renderExperienceCardForGrid}
                  emptyState={{
                    title: lang.current.profile.noPlannedExperiences,
                    description: isOwnProfile
                      ? lang.current.profile.noPlannedOwnProfile.replace('{nameSuffix}', user?.name ? `, ${getFirstName(user.name)}` : '')
                      : lang.current.profile.noPlannedOtherProfile.replace('{name}', getFirstName(currentProfile?.name)),
                    primaryAction: isOwnProfile ? lang.current.button.browseExperiences : null,
                    onPrimaryAction: isOwnProfile ? () => navigate('/experiences') : null
                  }}
                />
              );
            })()}

            {activeTab === 'created' && (
              <ProfileContentGrid
                type="experiences"
                items={uniqueCreatedExperiences}
                isLoading={createdLoading && uniqueCreatedExperiences !== null}
                skeletonCount={ITEMS_PER_PAGE}
                itemsPerPage={itemsPerPageComputed}
                currentPage={createdPage}
                onPageChange={setCreatedPage}
                showPagination={!showAllCreated}
                meta={createdExperiencesMeta}
                userPlans={plans}
                emptyState={{
                  icon: "✨",
                  title: lang.current.profile.noCreatedExperiences,
                  description: isOwnProfile
                    ? lang.current.profile.noCreatedOwnProfile.replace('{nameSuffix}', user?.name ? `, ${getFirstName(user.name)}` : '')
                    : lang.current.profile.noCreatedOtherProfile.replace('{name}', getFirstName(currentProfile?.name)),
                  primaryAction: isOwnProfile ? lang.current.button.createExperience : null,
                  onPrimaryAction: isOwnProfile ? () => openExperienceWizard() : null
                }}
              />
            )}

          </Col>
        </Row>

        {/* Super Admin Permissions Section */}
      {isSuperAdmin(user) && !isOwner && currentProfile && (
        <div className={styles.superAdminPanel}>
            <Card>
              <Card.Header>
                <h5>{lang.current.profile.superAdminPermissions}</h5>
              </Card.Header>
              <Card.Body>
                <div className={styles.adminSectionRow}>
                  <div className={styles.adminSectionLabel}>
                    <strong>{lang.current.profile.currentRoleLabel} {USER_ROLE_DISPLAY_NAMES[currentProfile.role] || lang.current.profile.unknownRole}</strong>
                    <p>{lang.current.profile.roleChangeDescription}</p>
                  </div>
                  <div className={styles.adminSectionActions}>
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
                <div className={styles.adminSectionRow}>
                  <div className={styles.adminSectionLabel}>
                    <strong>
                      {lang.current.profile.emailStatusLabel}{' '}
                      {currentProfile.emailConfirmed ? (
                        <span className={`${styles.statusBadge} ${styles.confirmed}`}>
                          <FaCheckCircle />
                          {lang.current.profile.confirmed}
                        </span>
                      ) : (
                        <span className={`${styles.statusBadge} ${styles.unconfirmed}`}>{lang.current.profile.notConfirmed}</span>
                      )}
                    </strong>
                    <p>{lang.current.profile.emailConfirmDescription}</p>
                  </div>
                  <div className={styles.adminSectionActions}>
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
              </Card.Body>
            </Card>
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
              mergeProfile({ photos: data.photos || [] });
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
                const resp = await updateUserApi(user._id, { photos: data.photos || [] });
                // If API returns authoritative user data, merge it into current profile
                if (resp && typeof resp === 'object') {
                  try { mergeProfile(resp); } catch (e) { /* ignore merge errors */ }
                }
              } catch (err) {
                try { logger.error('[Profile] Failed to persist photo changes', err); } catch (e) {}
                showError(lang.current.photoUploadModal.failedToSave);
              }
            }, 800);
          }}
          onSave={async (data) => {
            // Final save: persist and merge authoritative server response
            try {
              try { broadcastEvent('local:photos-updated', { at: Date.now(), userId: user._id, field: 'photos' }); } catch (e) {}
              const updated = await updateUserApi(user._id, { photos: data.photos || [] });
              if (updated) {
                mergeProfile(updated);
              }
            } catch (err) {
              showError(lang.current.photoUploadModal.failedToSave);
              throw err;
            }
          }}
        />
      )}
      {/* Messages modal - used to start 1:1 DMs from profile view */}
      {showMessagesModal && (
        <MessagesModal
          show={showMessagesModal}
          onClose={() => {
            setShowMessagesModal(false);
            setInitialChannelId(null);
            setInitialTargetUserId(null);
            setMessagesModalTitle('Messages');
          }}
          initialChannelId={initialChannelId}
          targetUserId={initialTargetUserId}
          title={messagesModalTitle}
        />
      )}
      </Container>

    </div>
  );
}

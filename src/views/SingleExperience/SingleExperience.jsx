import ActionButtonsRow from './components/ActionButtonsRow';
import DatePickerSection from './components/DatePickerSection';
import ExperienceOverviewSection from './components/ExperienceOverviewSection';
import PlanTabsNavigation from './components/PlanTabsNavigation';
import ExperienceTabContent from './components/ExperienceTabContent';
import MyPlanTabContent from './components/MyPlanTabContent';
import CollaboratorModal from './components/CollaboratorModal';
import SyncPlanModal from './components/SyncPlanModal';
import PlanItemModal from './components/PlanItemModal';
import PlanItemDetailsModal from '../../components/PlanItemDetailsModal/PlanItemDetailsModal';
import styles from "./SingleExperience.module.scss";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { flushSync } from "react-dom";
import { lang } from "../../lang.constants";
import { useParams, Link, useNavigate } from "react-router-dom";
import { FaUserPlus, FaTimes, FaUser, FaMapMarkerAlt, FaShare, FaRegImage } from "react-icons/fa";
import { Row, Col, Badge } from "react-bootstrap";
import { BsPlusCircle, BsPersonPlus, BsCheckCircleFill } from "react-icons/bs";
import { useUser } from "../../contexts/UserContext";
import { useData } from "../../contexts/DataContext";
import { useApp } from "../../contexts/AppContext";
import { useToast } from "../../contexts/ToastContext";
import { useCollaboratorUsers } from "../../hooks/useCollaboratorUsers";
import useCollaboratorManager from "../../hooks/useCollaboratorManager";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal";
import PageOpenGraph from "../../components/OpenGraph/PageOpenGraph";
import PageSchema from '../../components/PageSchema/PageSchema';
import { buildExperienceSchema } from '../../utilities/schema-utils';
import PhotoCard from "../../components/PhotoCard/PhotoCard";
import PhotoModal from "../../components/PhotoModal/PhotoModal";
import UsersListDisplay from "../../components/UsersListDisplay/UsersListDisplay";
import InfoCard from "../../components/InfoCard/InfoCard";
import Alert from "../../components/Alert/Alert";
import GoogleMap from "../../components/GoogleMap/GoogleMap";
import { Button, Container, FadeIn, FormLabel, FormControl, FormCheck, Text, EmptyState } from "../../components/design-system";
import Loading from "../../components/Loading/Loading";
import SkeletonLoader from "../../components/SkeletonLoader/SkeletonLoader";
import SingleExperienceSkeleton from "./components/SingleExperienceSkeleton";
import debug from "../../utilities/debug";
import { logger } from "../../utilities/logger";
import { createUrlSlug } from "../../utilities/url-utils";
import { useNavigationIntent, INTENT_TYPES } from "../../contexts/NavigationIntentContext";
import { useScrollHighlight } from "../../hooks/useScrollHighlight";
import {
  formatDateShort,
  formatDateForInput,
  formatDateMetricCard,
  getMinimumPlanningDate,
  isValidPlannedDate,
} from "../../utilities/date-utils";
import PlanningTime from "../../components/PlanningTime/PlanningTime";
import CostEstimate from "../../components/CostEstimate/CostEstimate";
import { StarRating, DifficultyRating } from "../../components/RatingScale/RatingScale";
import { formatPlanningTime } from "../../utilities/planning-time-utils";
import { formatCostEstimate } from "../../utilities/cost-utils";
import { handleError } from "../../utilities/error-handler";
import { createExpirableStorage, getCookieValue, setCookieValue } from "../../utilities/cookie-utils";
import { formatCurrency } from "../../utilities/currency-utils";
import { isOwner, canEditPlan } from "../../utilities/permissions";
import useOptimisticAction from "../../hooks/useOptimisticAction";
import usePlanManagement from "../../hooks/usePlanManagement";
import usePlanCosts from "../../hooks/usePlanCosts";
import { usePresence } from "../../hooks/usePresence";
import {
  showExperienceWithContext,
  deleteExperience,
  deletePlanItem,
  addPlanItem as addExperiencePlanItem,
  updatePlanItem as updateExperiencePlanItem,
  addExperienceCollaborator,
  removeExperienceCollaborator,
  reorderExperiencePlanItems,
} from "../../utilities/experiences-api";
import {
  getUserPlans,
  getExperiencePlans,
  updatePlanItem,
  addPlanItem as addPlanItemToInstance,
  deletePlanItem as deletePlanItemFromInstance,
  removeCollaborator,
  addCollaborator,
  reorderPlanItems,
  addPlanItemNote,
  updatePlanItemNote,
  deletePlanItemNote,
  assignPlanItem,
  unassignPlanItem,
} from "../../utilities/plans-api";
import { reconcileState, generateOptimisticId } from "../../utilities/event-bus";
import { searchUsers } from "../../utilities/search-api";
import { sendEmailInvite } from "../../utilities/invites-api";
import { escapeSelector, highlightPlanItem, attemptScrollToItem } from "../../utilities/scroll-utils";

export default function SingleExperience() {
  // ============================================================================
  // CONSTANTS & HELPER FUNCTIONS
  // ============================================================================

  // Constants for sync alert cookie management
  const SYNC_ALERT_COOKIE = "planSyncAlertDismissed";
  const SYNC_ALERT_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

  // Helpers to read/write sync alert dismissal state
  function getSyncAlertCookie(planId) {
    try {
      return getCookieValue(SYNC_ALERT_COOKIE, planId, SYNC_ALERT_DURATION);
    } catch (err) {
      debug.warn('getSyncAlertCookie failed', err);
      return null;
    }
  }

  function setSyncAlertCookie(planId) {
    try {
      setCookieValue(SYNC_ALERT_COOKIE, planId, Date.now(), SYNC_ALERT_DURATION, SYNC_ALERT_DURATION);
    } catch (err) {
      debug.warn('setSyncAlertCookie failed', err);
    }
  }

  // ============================================================================
  // CONTEXT HOOKS & ROUTER
  // ============================================================================

  const { user } = useUser();
  const { removeExperience, fetchExperiences, fetchPlans, experiences: ctxExperiences, updateExperience: updateExperienceInContext, setOptimisticPlanStateForExperience, clearOptimisticPlanStateForExperience } = useData();
  const {
    registerH1,
    setPageActionButtons,
    clearActionButtons,
    updateShowH1InNavbar,
  } = useApp();
  const { success, error: showError } = useToast();
  const { experienceId } = useParams();
  const navigate = useNavigate();

  // DEBUG: Log initial URL state on component mount
  debug.log('SingleExperience component mounted', {
    experienceId,
    pathname: window.location.pathname,
    hash: window.location.hash,
    href: window.location.href
  });

  // ============================================================================
  // CUSTOM HOOKS
  // ============================================================================

  // Plan management hook - replaces plan-related state and functions
  const {
    userPlan,
    setUserPlan,
    collaborativePlans,
    setCollaborativePlans,
    selectedPlanId,
    setSelectedPlanId,
    selectedPlan,
    plansLoading,
    setPlansLoading,
    plannedDate,
    setPlannedDate,
    userPlannedDate,
    setUserPlannedDate,
    displayedPlannedDate,
    setDisplayedPlannedDate,
    userHasExperience,
    setUserHasExperience,
    fetchUserPlan,
    fetchCollaborativePlans,
    // fetchPlans from DataContext (useData) is used instead of hook's fetchPlans
    createPlan,
    updatePlan,
    deletePlan
  } = usePlanManagement(experienceId, user?._id);

  // Plan costs management hook
  const {
    costs,
    costSummary,
    loading: costsLoading,
    addCost,
    updateCost,
    deleteCost,
    fetchCosts
  } = usePlanCosts(selectedPlanId);

  // Presence hook - real-time collaboration awareness
  const {
    isConnected: presenceConnected,
    experienceMembers,
    planMembers,
    setTyping,
    setTab: setPresenceTab
  } = usePresence({
    experienceId,
    planId: selectedPlanId,
    initialTab: 'the-plan', // Default to experience tab, will be updated by useEffect
    enabled: !!user?._id  // Only enable for logged-in users
  });

  // Navigation intent hook - single source of truth for deep-link navigation
  const { intent, consumeIntent, clearIntent } = useNavigationIntent();

  // Scroll highlight hook - consolidated scroll/highlight logic
  const { scrollToItem, applyHighlight, clearHighlight } = useScrollHighlight();

  // ============================================================================
  // COMPONENT STATE
  // ============================================================================

  // Core experience data
  const [experience, setExperience] = useState(null);
  const [travelTips, setTravelTips] = useState([]);
  const [loading, setLoading] = useState(false);

  // UI state
  const [favHover, setFavHover] = useState(false);
  const [hoveredPlanItem, setHoveredPlanItem] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [activeTab, setActiveTab] = useState("experience"); // "experience" or "myplan"
  const [pendingUnplan, setPendingUnplan] = useState(false); // Hide planned date immediately when user clicks Remove (before confirm)

  // Plan item UI state
  const [expandedParents, setExpandedParents] = useState(new Set());
  const [animatingCollapse, setAnimatingCollapse] = useState(null);

  // Sync state
  const [showSyncButton, setShowSyncButton] = useState(false);
  const [showSyncAlert, setShowSyncAlert] = useState(true);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncChanges, setSyncChanges] = useState(null);
  const [selectedSyncItems, setSelectedSyncItems] = useState({ added: [], removed: [], modified: [] });

  // Modal state - Delete/Remove modals
  const [showDeleteModal, setShowDeleteModal] = useState(false); // Delete experience
  const [showRemoveModal, setShowRemoveModal] = useState(false); // Remove from my plan
  const [showPlanDeleteModal, setShowPlanDeleteModal] = useState(false); // Delete plan item from experience
  const [planItemToDelete, setPlanItemToDelete] = useState(null);
  const [showPlanInstanceDeleteModal, setShowPlanInstanceDeleteModal] = useState(false); // Delete plan item from instance
  const [planInstanceItemToDelete, setPlanInstanceItemToDelete] = useState(null);

  // Modal state - Plan item modals
  const [showPlanItemModal, setShowPlanItemModal] = useState(false);
  const [planItemFormState, setPlanItemFormState] = useState(1); // 1 = add, 0 = edit
  const [editingPlanItem, setEditingPlanItem] = useState({});
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedDetailsItem, setSelectedDetailsItem] = useState(null);
  const [detailsModalInitialTab, setDetailsModalInitialTab] = useState('notes');

  // Photo viewer state for hero overlay button
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [photoViewerIndex, setPhotoViewerIndex] = useState(0);

  // Refs
  const planButtonRef = useRef(null);
  const [planBtnWidth, setPlanBtnWidth] = useState(null);

  // Ref for dynamic font sizing on planned date metric
  const plannedDateRef = useRef(null);

  // Ref to track processed URL hashes to prevent re-scrolling on state changes
  const processedHashRef = useRef(null);
  // Ref to track if initial hash navigation has been handled (prevents re-navigation on state changes)
  const initialHashHandledRef = useRef(false);
  // Ref to track if user interaction is in progress (prevents hash effects from running during interactions)
  const userInteractionRef = useRef(false);

  // Version-based reconciliation (via event-bus.js) replaces timeout-based suppression
  // Events now carry version numbers and reconcileState() automatically handles
  // optimistic ID replacement and stale event rejection

  // Ref for h1 element to ensure proper registration
  const h1Ref = useRef(null);

  // Memoized hero photos array (normalize to objects with url)
  const heroPhotos = useMemo(() => {
    const photosSource = (experience && experience.photos && experience.photos.length > 0)
      ? experience.photos
      : (experience && experience.destination && experience.destination.photos && experience.destination.photos.length > 0)
        ? experience.destination.photos
        : [];

    if (!photosSource || photosSource.length === 0) return [];

    return photosSource.map((p) => (typeof p === 'string' ? { url: p } : p));
  }, [experience]);

  // Ref to track if component is unmounting to prevent navigation interference
  const isUnmountingRef = useRef(false);

  // Set unmounting flag when component unmounts
  useEffect(() => {
    return () => {
      isUnmountingRef.current = true;
    };
  }, []);

  // ============================================================================
  // MEMOIZED VALUES & COMPUTED STATE
  // ============================================================================

  // Helper to compare IDs safely (ObjectId or string)
  const idEquals = useCallback((a, b) => {
    if (!a || !b) return false;
    try {
      return a.toString() === b.toString();
    } catch (e) {
      return false;
    }
  }, []);

  // Normalize plan objects for consistent client-side comparisons.
  // Ensures `_id` and nested `user._id` are strings to avoid select value mismatches.
  const normalizePlan = useCallback((plan) => {
    if (!plan) return plan;
    const normalized = { ...plan };
    if (normalized._id && normalized._id.toString) normalized._id = normalized._id.toString();
    if (normalized.user && normalized.user._id && normalized.user._id.toString) {
      normalized.user = { ...normalized.user, _id: normalized.user._id.toString() };
    }
    return normalized;
  }, []);

  // Scrolling + highlight helpers centralized in `src/utilities/scroll-utils.js`.
  // Plan event listeners (plan:created, plan:updated, plan:deleted) are now handled by usePlanManagement hook

  // Get owner and collaborator user IDs for experience
  const experienceOwnerPermission = useMemo(
    () =>
      experience?.permissions?.find(
        (p) => p.entity === "user" && p.type === "owner"
      ),
    [experience?.permissions]
  );

  const experienceOwnerId = useMemo(
    () => experienceOwnerPermission?._id,
    [experienceOwnerPermission]
  );

  const experienceCollaboratorIds = useMemo(
    () =>
      experience?.permissions
        ?.filter((p) => p.entity === "user" && p.type === "collaborator")
        .map((p) => p._id) || [],
    [experience?.permissions]
  );

  // Get current plan for collaborator IDs - MUST be memoized to prevent infinite re-renders
  const currentPlan = useMemo(
    () =>
      activeTab === "experience"
        ? null
        : selectedPlanId
        ? collaborativePlans.find((p) => idEquals(p._id, selectedPlanId))
        : userPlan,
    [activeTab, selectedPlanId, collaborativePlans, userPlan]
  );

  // Get plan owner and collaborator user IDs
  const planOwnerPermission = useMemo(
    () =>
      currentPlan?.permissions?.find(
        (p) => p.entity === "user" && p.type === "owner"
      ),
    [currentPlan]
  );

  // ============================================================================
  // SIDE EFFECTS & EVENT LISTENERS
  // ============================================================================

  // Keep local `experience` in sync when DataContext's `experiences` is updated
  useEffect(() => {
    try {
      if (!ctxExperiences || !ctxExperiences.length) return;
      const updated = ctxExperiences.find((e) => idEquals(e._id, experienceId));
      if (!updated) return;

      // Only apply if different to avoid unnecessary renders
      try {
        const a = JSON.stringify(updated || {});
        const b = JSON.stringify(experience || {});
        if (a !== b) {
          // Instrumentation: log diff-ish preview to help diagnose overwrites
          try {
            const previewPrev = { _id: experience?._id, plan_items_count: (experience?.plan_items || []).length, travel_tips_count: (experience?.travel_tips || []).length };
            const previewNew = { _id: updated?._id, plan_items_count: (updated?.plan_items || []).length, travel_tips_count: (updated?.travel_tips || []).length };
            debug.log('Applying context-driven experience update', { experienceId: experienceId, previewPrev, previewNew });
          } catch (inner) {
            debug.log('Applying context-driven experience update (no preview available)', { experienceId: experienceId });
          }

          // Merge updated experience into local state but preserve deeply local plan UI fields if present
          try {
            // Avoid storing volatile metadata (like timestamps) on the merged object
            const merged = { ...(experience || {}), ...(updated || {}) };
            setExperience(merged);
            setTravelTips(merged.travel_tips || []);
          } catch (errMerge) {
            // Fallback to replacing if merge fails
            setExperience(updated);
            setTravelTips(updated.travel_tips || []);
          }
        }
      } catch (err) {
        // Fallback to naive set on JSON stringify error
        setExperience(updated);
        setTravelTips(updated.travel_tips || []);
      }
    } catch (err) {
      debug.warn('Failed to apply context experience update', err);
    }
  }, [ctxExperiences, experienceId]);

  // Update the browser address bar to point directly to the selected plan
  // when the user switches to the "My Plan" tab or selects a collaborative plan.
  // We use the History API (replaceState) so this does not trigger a navigation
  // or reload — the server already exposes a route for `/plans/:planId`.
  // CRITICAL: No PopStateEvent dispatches - they cause unwanted scroll behavior
  useEffect(() => {
    // CRITICAL: Skip URL updates entirely during user interactions (e.g., toggling completion)
    // This prevents any scroll/navigation side effects during item completion
    if (userInteractionRef.current) {
      debug.log('🔧 URL management: Skipping due to user interaction in progress');
      return;
    }

    const currentHash = window.location.hash || '';
    debug.log('🔧 URL management useEffect triggered', {
      activeTab,
      selectedPlanId,
      experienceId,
      currentHash,
      hasItemHash: currentHash.includes('-item-'),
      pathname: window.location.pathname,
      fullURL: window.location.href
    });

    try {
      if (typeof window === 'undefined' || !window.history || !window.history.replaceState) return;

      // Prevent navigation if component is unmounting
      if (isUnmountingRef.current) return;

      // Only update URL if we're still on the SingleExperience route
      // Prevent interference with navigation away from this component
      if (!experienceId || window.location.pathname !== `/experiences/${experienceId}`) {
        debug.log('URL management: early return', {
          hasExperienceId: !!experienceId,
          currentPath: window.location.pathname,
          expectedPath: experienceId ? `/experiences/${experienceId}` : 'N/A'
        });
        return;
      }

      // CRITICAL FIX: If there's a hash in the URL and we're on the myplan tab with a selected plan,
      // check if the hash matches the selected plan. If it does, this is a direct URL navigation
      // and we should NOT modify the URL (let it stay as-is).
      const currentHash = window.location.hash || '';
      if (currentHash.startsWith('#plan-') && activeTab === 'myplan' && selectedPlanId) {
        // Extract planId from hash
        const hashContent = currentHash.substring(6); // Remove '#plan-' prefix
        const hashPlanId = hashContent.split('-item-')[0]; // Get planId (before -item- if present)

        // If hash matches selected plan, this is a direct URL load - don't modify
        if (hashPlanId === selectedPlanId.toString()) {
          debug.log('URL management: Hash matches selected plan, preserving original URL', {
            currentHash,
            selectedPlanId,
            hashPlanId
          });
          return; // CRITICAL: Early return to preserve URL from direct navigation
        }
      }

      // When viewing My Plan (or a collaborative plan) update the address
      // bar to a hash-based deep link that points to the experience with
      // a plan fragment. Example: `/experiences/<id>#plan/<planId>`
      if (activeTab === 'myplan' && selectedPlanId && experienceId) {
        // Preserve item-level hash if present (e.g., #plan-{planId}-item-{itemId})
        // Otherwise use plan-level hash (e.g., #plan-{planId})
        const currentHash = window.location.hash || '';
        const hasItemHash = currentHash.includes('-item-');

        // CRITICAL: Always preserve existing plan-level or item-level hashes
        // Only create new hash if no hash exists
        let hashed;
        if (currentHash.startsWith('#plan-')) {
          // CRITICAL: Preserve ANY existing plan hash (plan-level or item-level)
          // This prevents stripping the item portion after hash navigation restores it
          hashed = `${window.location.pathname}${currentHash}`;
          debug.log('URL management: Preserving existing hash', {
            currentHash,
            hasItemHash
          });
        } else {
          // No existing hash - create new plan-level hash
          hashed = `/experiences/${experienceId}#plan-${selectedPlanId}`;
          debug.log('URL management: Creating new plan-level hash', {
            selectedPlanId
          });
        }

        debug.log('URL management: myplan tab active', {
          activeTab,
          selectedPlanId,
          currentHash,
          hasItemHash,
          hashed
        });

        // Dedupe: avoid updating if the URL is already the same
        const current = `${window.location.pathname}${window.location.hash || ''}`;
        if (current !== hashed) {
          // REFACTORED: Use replaceState only - no PopStateEvent dispatch
          // PopStateEvent causes unwanted scroll behavior
          // React Router doesn't need PopStateEvent for hash-only changes
          window.history.replaceState(null, '', hashed);
          debug.log('URL management: Updated hash via replaceState', { hashed });
        } else {
          debug.log('Skipping history update: URL already matches hashed plan link');
        }
        return;
      }

      // Otherwise restore the canonical experience URL without fragment
      if (experienceId) {
        const expUrl = `/experiences/${experienceId}`;

        debug.log('URL management: canonical URL section', {
          activeTab,
          selectedPlanId,
          experienceId,
          currentHash: window.location.hash
        });

        const current = `${window.location.pathname}${window.location.hash || ''}`;
        // CRITICAL: If an incoming plan hash exists (e.g., user opened /experiences/:id#plan-<id>),
        // preserve it so the hash-handling logic can select the plan after load.
        // This must happen BEFORE any URL normalization to prevent race conditions.
        const incomingHash = window.location.hash || '';
        if (incomingHash.startsWith('#plan-')) {
          debug.log('Preserving incoming plan hash; skipping expUrl navigate to avoid removing hash', {
            incomingHash
          });
          return; // CRITICAL: Early return to prevent hash removal
        }

        if (current !== expUrl) {
          // REFACTORED: Use replaceState only - no PopStateEvent dispatch
          // PopStateEvent causes unwanted scroll behavior
          window.history.replaceState(null, '', expUrl);
          debug.log('URL management: Restored canonical URL via replaceState', { expUrl });
        } else {
          debug.log('Skipping history update: URL already matches experience URL');
        }
      }
    } catch (err) {
      debug.warn('Failed to update history for plan selection', err);
    }
  }, [activeTab, selectedPlanId, experienceId]);

  const planOwnerId = useMemo(
    () => planOwnerPermission?._id,
    [planOwnerPermission]
  );

  const planCollaboratorIds = useMemo(
    () =>
      currentPlan?.permissions
        ?.filter((p) => p.entity === "user" && p.type === "collaborator")
        .map((p) => p._id) || [],
    [currentPlan]
  );

  // Memoize owner ID arrays to prevent infinite re-renders from hook
  const experienceOwnerIds = useMemo(
    () => (experienceOwnerId ? [experienceOwnerId] : []),
    [experienceOwnerId]
  );

  const planOwnerIds = useMemo(
    () => (planOwnerId ? [planOwnerId] : []),
    [planOwnerId]
  );

  // Fetch fresh user data for owners and collaborators
  const { users: experienceOwnerData, loading: experienceOwnerLoading } =
    useCollaboratorUsers(experienceOwnerIds);
  const experienceOwner = experienceOwnerData?.[0];

  const {
    users: experienceCollaborators,
    loading: experienceCollaboratorsLoading,
  } = useCollaboratorUsers(experienceCollaboratorIds);

  const { users: planOwnerData, loading: planOwnerLoading } =
    useCollaboratorUsers(planOwnerIds);
  const planOwner = planOwnerData?.[0];

  const { users: planCollaborators, loading: planCollaboratorsLoading } =
    useCollaboratorUsers(planCollaboratorIds);

  // Combine plan owner and collaborators for assignments and mentions
  const allPlanCollaborators = useMemo(() => {
    const collaboratorsList = [];

    // Add owner first (if exists and not already in collaborators)
    if (planOwner) {
      collaboratorsList.push(planOwner);
    }

    // Add other collaborators (avoid duplicates)
    if (planCollaborators && planCollaborators.length > 0) {
      planCollaborators.forEach(collab => {
        const collabId = collab._id || collab.user?._id;
        const ownerId = planOwner?._id;
        // Only add if not the owner
        if (collabId !== ownerId) {
          collaboratorsList.push(collab);
        }
      });
    }

    return collaboratorsList;
  }, [planOwner, planCollaborators]);

  // Prepare mention entities and data for InteractiveTextArea
  const availableEntities = useMemo(() => {
    const entities = [];

    // Add all plan collaborators (including owner)
    if (allPlanCollaborators && allPlanCollaborators.length > 0) {
      allPlanCollaborators.forEach(user => {
        // Handle both direct user object and nested user object (user.user)
        const userData = user.user || user;
        const userId = userData._id || user._id;
        const userName = userData.name || userData.email?.split('@')[0] || 'Unknown User';

        if (userId) {
          entities.push({
            type: 'user',
            id: userId,
            displayName: userName
          });
        }
      });
    }

    // Add plan items (for # mentions)
    // Plan items are stored in the `plan` array (see models/plan.js planItemSnapshotSchema)
    // Each item has: plan_item_id, text, url, complete, cost, etc.
    if (selectedPlan && selectedPlan.plan && selectedPlan.plan.length > 0) {
      selectedPlan.plan.forEach(item => {
        entities.push({
          type: 'plan-item',
          id: item._id || item.plan_item_id,
          displayName: item.text || item.name || 'Unknown Plan Item'
        });
      });
    }

    // Add current destination
    if (experience?.destination) {
      // Handle both populated object and string ID
      const destId = typeof experience.destination === 'string'
        ? experience.destination
        : experience.destination._id;
      const destName = typeof experience.destination === 'object'
        ? (experience.destination.name || 'Unknown Destination')
        : 'Unknown Destination';

      entities.push({
        type: 'destination',
        id: destId,
        displayName: destName
      });
    }

    // Add current experience
    if (experience) {
      entities.push({
        type: 'experience',
        id: experience._id,
        displayName: experience.name || 'Unknown Experience'
      });
    }

    return entities;
  }, [allPlanCollaborators, selectedPlan, experience]);

  // Create entity data map for mention rendering
  const entityData = useMemo(() => {
    const data = {};

    // Add all plan collaborators (including owner)
    if (allPlanCollaborators && allPlanCollaborators.length > 0) {
      allPlanCollaborators.forEach(user => {
        // Handle both direct user object and nested user object (user.user)
        const userData = user.user || user;
        const userId = userData._id || user._id;

        if (userId) {
          data[userId] = {
            _id: userId,
            name: userData.name || userData.email?.split('@')[0],
            email: userData.email,
            bio: userData.bio
          };
        }
      });
    }

    // Add plan items
    // Plan items are stored in the `plan` array (see models/plan.js planItemSnapshotSchema)
    if (selectedPlan && selectedPlan.plan && selectedPlan.plan.length > 0) {
      selectedPlan.plan.forEach(item => {
        const itemId = item._id || item.plan_item_id;
        data[itemId] = {
          _id: itemId,
          type: 'plan-item', // Required for mention resolution
          name: item.text || item.name,
          text: item.text,
          url: item.url,
          complete: item.complete,
          cost: item.cost,
          experienceId: experience?._id,
          planId: selectedPlan._id
        };
      });
    }

    // Add destination
    if (experience?.destination) {
      // Handle both populated object and string ID
      if (typeof experience.destination === 'object') {
        const destId = experience.destination._id;
        data[destId] = {
          _id: destId,
          name: experience.destination.name,
          city: experience.destination.city,
          country: experience.destination.country,
          description: experience.destination.description
        };
      } else {
        // Destination is just an ID string - add minimal data
        data[experience.destination] = {
          _id: experience.destination,
          name: 'Destination',
          city: null,
          country: null,
          description: null
        };
      }
    }

    // Add experience
    if (experience) {
      data[experience._id] = {
        _id: experience._id,
        name: experience.name,
        description: experience.description,
        destination: experience.destination
      };
    }

    return data;
  }, [allPlanCollaborators, selectedPlan, experience]);

  const toggleExpanded = useCallback((parentId) => {
    setExpandedParents((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(parentId)) {
        // collapsing
        setAnimatingCollapse(parentId);
        setTimeout(() => {
          setExpandedParents((prev) => {
            const newSet = new Set(prev);
            newSet.delete(parentId);
            return newSet;
          });
          setAnimatingCollapse(null);
        }, 300);
      } else {
        // expanding
        newSet.add(parentId);
      }
      return newSet;
    });
  }, []);

  // OPTIMIZATION: Combined fetch function - fetches all data in one API call
  // Reduces 3 API calls to 1 for dramatically faster page load
  const fetchAllData = useCallback(async () => {
    try {
      const { experience: experienceData, userPlan: fetchedUserPlan, collaborativePlans: fetchedCollaborativePlans } = await showExperienceWithContext(experienceId);

      debug.log("Experience data:", experienceData);
      debug.log("User plan:", fetchedUserPlan);
      debug.log("Collaborative plans:", fetchedCollaborativePlans);

      // Set experience data
      setExperience(experienceData);
      setTravelTips(experienceData.travel_tips || []);

      // Update DataContext with fully-populated experience
      // This ensures other views have access to the complete experience data
      if (experienceData && experienceData._id) {
        updateExperienceInContext(experienceData);
      }

      // Set expanded parents (all parents expanded by default)
      const parentIds = experienceData.plan_items
        .filter((item) => !item.parent)
        .map((item) => item._id);
      setExpandedParents(new Set(parentIds));

      // Set user plan data
      setUserPlan(fetchedUserPlan || null);
      setUserHasExperience(!!fetchedUserPlan);
      setUserPlannedDate(fetchedUserPlan?.planned_date || null);

      // selectedPlanId will be set by either:
      // 1. Hash navigation (if URL contains #plan-{id})
      // 2. Auto-select useEffect (first plan in dropdown after load)

      // Set collaborative plans data
      // Filter to only show plans where user is owner or collaborator
      const accessiblePlans = fetchedCollaborativePlans.filter((plan) => {
        // Check if user owns this plan
        const isUserPlan =
          plan.user &&
          (plan.user._id?.toString() === user._id?.toString() ||
            plan.user.toString() === user._id?.toString());

        // Check if user is a collaborator or owner via permissions
        const hasPermission = plan.permissions?.some(
          (p) =>
            p.entity === "user" &&
            p._id?.toString() === user._id?.toString() &&
            (p.type === "owner" || p.type === "collaborator")
        );

        return isUserPlan || hasPermission;
      });

      // CRITICAL: getExperiencePlans returns BOTH user's own plan AND collaborative plans
      // If we have a fetchedUserPlan from checkUserPlanForExperience, we need to filter
      // it out from accessiblePlans to prevent duplicates when merging
      const collaborativePlansOnly = fetchedUserPlan
        ? accessiblePlans.filter((plan) => {
            // Exclude user's own plan - it will be prepended separately
            const planUserId = plan.user?._id?.toString() || plan.user?.toString();
            return planUserId !== user._id?.toString();
          })
        : accessiblePlans;

      // Combine user's own plan with collaborative plans for unified display
      // Backend returns userPlan separately from collaborativePlans array
      const allPlans = fetchedUserPlan
        ? [fetchedUserPlan, ...collaborativePlansOnly]
        : accessiblePlans;

      // Sort plans: user's own plan first, then others
      const sortedPlans = allPlans.sort((a, b) => {
        const aIsUserPlan =
          a.user &&
          (a.user._id?.toString() === user._id?.toString() ||
            a.user.toString() === user._id?.toString());
        const bIsUserPlan =
          b.user &&
          (b.user._id?.toString() === user._id?.toString() ||
            b.user.toString() === user._id?.toString());

        if (aIsUserPlan && !bIsUserPlan) return -1;
        if (!aIsUserPlan && bIsUserPlan) return 1;
        return 0;
      });

      debug.log("Accessible plans after filtering and sorting:", sortedPlans);

      // Normalize plan IDs to strings to avoid select/value mismatch
      const normalizedSorted = sortedPlans.map(p => normalizePlan(p));

      // Leave selectedPlanId as null initially
      // Auto-select useEffect will select first plan after plans load (if no hash)
      // Hash navigation handler will select plan if there's a hash in URL
      debug.log("Plans loaded. Auto-select or hash handler will set selectedPlanId.");

      // Set collaborative plans and mark loading complete
      // Use flushSync to force synchronous rendering and prevent layout shift
      flushSync(() => {
        setCollaborativePlans(normalizedSorted);
        setPlansLoading(false);
      });
    } catch (err) {
      debug.error("Error fetching all data:", err);
      setExperience(null);
      setUserPlan(null);
      setCollaborativePlans([]);
      // Loading complete even on error
      setPlansLoading(false);
    }
  }, [experienceId, user._id, updateExperienceInContext]);

  // Collaborator management hook - uses fetchAllData for refreshing experience data
  const collaboratorManager = useCollaboratorManager({
    experienceId,
    experience,
    selectedPlanId,
    userPlan,
    collaborativePlans,
    setExperience,
    setUserPlan,
    setCollaborativePlans,
    fetchExperience: fetchAllData,
    fetchPlans,
    fetchCollaborativePlans,
    experienceCollaborators,
    planCollaborators,
    user,
    success,
    showError
  });

  // ============================================================================
  // CALLBACK FUNCTIONS & EVENT HANDLERS
  // ============================================================================

  const checkPlanDivergence = useCallback((plan, experience) => {
    // Defensive guards: ensure both plan.plan and experience.plan_items are arrays
    if (!plan || !experience || !Array.isArray(experience.plan_items) || !Array.isArray(plan.plan)) {
      return false;
    }

    // Check if plan items count differs
    if ((plan.plan || []).length !== (experience.plan_items || []).length) {
      return true;
    }

    // Check if any plan item has changed
    for (let i = 0; i < (plan.plan || []).length; i++) {
      const planItem = plan.plan[i];
      const experienceItem = experience.plan_items.find(
        (item) => item._id.toString() === planItem.plan_item_id.toString()
      );

      if (!experienceItem) {
        return true; // Item was deleted from experience
      }

      // Check if key fields have changed
      if (
        experienceItem.text !== planItem.text ||
        experienceItem.url !== planItem.url ||
        experienceItem.cost_estimate !== planItem.cost ||
        experienceItem.planning_days !== planItem.planning_days
      ) {
        return true;
      }
    }

    return false;
  }, []);

  // OPTIMIZATION: Use combined fetch on initial load for 3x faster page load
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // DEBUG: Track all state changes for Plan It button and badge
  useEffect(() => {
    debug.log('[STATE_TRACKER] State changed', {
      timestamp: Date.now(),
      userHasExperience,
      displayedPlannedDate,
      userPlanId: userPlan?._id,
      plansLoading,
      loading,
      userId: user?._id
    });
  }, [userHasExperience, displayedPlannedDate, userPlan, plansLoading, loading, user]);

  // Reset component state when navigating to a different experience
  useEffect(() => {
    // Reset all experience-specific state
    setExperience(null);
    setUserPlan(null);
    setUserHasExperience(false);
    setUserPlannedDate(null);
    setDisplayedPlannedDate(null);
    setTravelTips([]);
    setCollaborativePlans([]);
    setSelectedPlanId(null);
    setPlansLoading(true);
    setActiveTab("experience");
    setExpandedParents(new Set());
    setShowSyncButton(false);
    setShowSyncAlert(true);
    setSyncChanges(null);
    setSelectedSyncItems({ added: [], removed: [], modified: [] });
    setFavHover(false);
    setPendingUnplan(false);
    setPlanBtnWidth(null);
    setShowDatePicker(false);
    setIsEditingDate(false);
    setPlannedDate("");
    setShowDeleteModal(false);
    setShowRemoveModal(false);
    setShowPlanDeleteModal(false);
    setPlanItemToDelete(null);
    setShowPlanInstanceDeleteModal(false);
    setPlanInstanceItemToDelete(null);
    // Reset hash refs so URL hash can be processed for new experience
    processedHashRef.current = null;
    initialHashHandledRef.current = false;
    userInteractionRef.current = false;
    // Collaborator state is now managed by useCollaboratorManager hook
    setShowPlanItemModal(false);
    setPlanItemFormState(1);
    setEditingPlanItem({});
    setShowSyncModal(false);
  }, [experienceId]);

  // Navigation Intent Consumer - handles deep-link navigation from HashLink and direct URL
  // Single source of truth for scroll/highlight behavior
  useEffect(() => {
    debug.log('[NavigationIntent] Effect running', {
      userInteractionInProgress: userInteractionRef.current,
      intentExists: !!intent,
      intentConsumed: intent?.consumed,
      plansLoading,
      collaborativePlansCount: collaborativePlans.length,
      intentId: intent?.id,
      targetPlanId: intent?.targetPlanId,
      targetItemId: intent?.targetItemId
    });

    // Skip if user interaction is in progress (e.g., toggling completion)
    if (userInteractionRef.current) {
      debug.log('[NavigationIntent] Skipping - user interaction in progress');
      return;
    }

    // Skip if no intent or already consumed
    if (!intent || intent.consumed) {
      debug.log('[NavigationIntent] Skipping - no intent or already consumed');
      return;
    }

    // Skip if plans haven't loaded yet
    if (plansLoading || collaborativePlans.length === 0) {
      debug.log('[NavigationIntent] Plans still loading, waiting...', {
        plansLoading,
        collaborativePlansCount: collaborativePlans.length,
        intentId: intent.id
      });
      return;
    }

    const { targetPlanId, targetItemId, shouldAnimate, id: intentId } = intent;

    debug.log('[NavigationIntent] Processing intent:', {
      intentId,
      targetPlanId,
      targetItemId,
      shouldAnimate,
      type: intent.type
    });

    // Find the target plan
    const targetPlan = collaborativePlans.find((p) => idEquals(p._id, targetPlanId));

    if (!targetPlan) {
      debug.warn('[NavigationIntent] Plan not found in collaborativePlans:', {
        targetPlanId,
        availablePlans: collaborativePlans.map(p => p._id?.toString())
      });
      // Clear the intent since it can't be fulfilled
      clearIntent();
      return;
    }

    // CONSUME the intent BEFORE side effects to prevent re-processing
    consumeIntent(intentId);

    const tid = targetPlan._id?.toString ? targetPlan._id.toString() : targetPlan._id;

    debug.log('[NavigationIntent] ✅ Found target plan, switching...', { tid, targetItemId });

    // Update the URL hash to reflect the deep link
    const hash = targetItemId
      ? `#plan-${tid}-item-${targetItemId}`
      : `#plan-${tid}`;

    try {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
      debug.log('[NavigationIntent] URL hash updated:', hash);
    } catch (err) {
      debug.warn('[NavigationIntent] Failed to update URL hash:', err);
    }

    // Set state to switch to the plan tab
    setSelectedPlanId(tid);
    setActiveTab('myplan');

    // Scroll to item after tab switch (give React time to render)
    if (targetItemId) {
      debug.log('[NavigationIntent] Scheduling scroll to item:', { targetItemId, shouldAnimate });
      // Use requestAnimationFrame + setTimeout to ensure DOM is ready after React renders
      requestAnimationFrame(() => {
        setTimeout(async () => {
          try {
            const result = await scrollToItem(targetItemId, { shouldHighlight: shouldAnimate });
            debug.log('[NavigationIntent] scrollToItem result:', result ? 'found' : 'not found');
          } catch (err) {
            debug.log('[NavigationIntent] scrollToItem error:', err);
          }
        }, 100);
      });
    } else {
      debug.log('[NavigationIntent] No targetItemId, skipping scroll');
    }

  }, [intent, plansLoading, collaborativePlans, idEquals, consumeIntent, clearIntent, scrollToItem]);

  // Fallback handler for direct URL navigation (when no intent exists)
  // This handles cases where user pastes URL directly or navigates via browser history
  // Only runs ONCE on initial page load to prevent re-scrolling on state changes
  useEffect(() => {
    // Skip if user interaction is in progress (e.g., toggling completion)
    if (userInteractionRef.current) {
      return;
    }

    // Skip if initial hash has already been handled
    if (initialHashHandledRef.current) {
      return;
    }

    // Skip if there's an unconsumed intent (intent-based navigation is preferred)
    if (intent && !intent.consumed) {
      return;
    }

    // Skip if plans haven't loaded
    if (plansLoading || collaborativePlans.length === 0) {
      return;
    }

    const hash = window.location.hash || '';
    if (!hash.startsWith('#plan-')) {
      // No hash to process, mark as handled to prevent future runs
      initialHashHandledRef.current = true;
      return;
    }

    // Skip if we've already processed this exact hash
    if (processedHashRef.current === hash) {
      return;
    }

    // Parse hash format: #plan-{planId} or #plan-{planId}-item-{itemId}
    const hashContent = hash.substring(6); // Remove '#plan-' prefix
    const parts = hashContent.split('-item-');
    const planId = parts[0];
    const itemId = parts.length > 1 ? parts[1] : null;

    if (!planId) return;

    debug.log('[SingleExperience] Fallback URL hash handler:', { planId, itemId, selectedPlanId, hash });

    const targetPlan = collaborativePlans.find((p) => idEquals(p._id, planId));
    if (!targetPlan) {
      debug.warn('[Fallback Hash] Plan not found:', planId);
      return;
    }

    const tid = targetPlan._id?.toString ? targetPlan._id.toString() : targetPlan._id;

    // Mark this hash as processed and initial navigation as complete
    processedHashRef.current = hash;
    initialHashHandledRef.current = true;

    // Only change plan if needed
    const needsTabSwitch = selectedPlanId !== tid;
    if (needsTabSwitch) {
      setSelectedPlanId(tid);
      setActiveTab('myplan');
    }

    // For direct URL navigation, scroll to item if present
    // If we switched tabs, wait for React to render the new content first
    if (itemId) {
      if (needsTabSwitch) {
        // Wait for React to render the plan items after tab switch
        // Using requestAnimationFrame + setTimeout ensures DOM is ready
        requestAnimationFrame(() => {
          setTimeout(() => {
            scrollToItem(itemId, { shouldHighlight: true });
          }, 100);
        });
      } else {
        // Already on correct tab, scroll immediately
        scrollToItem(itemId, { shouldHighlight: true });
      }
    }
  }, [plansLoading, collaborativePlans, selectedPlanId, intent, idEquals, scrollToItem]);

  // Register h1 and action buttons for navbar
  useEffect(() => {
    if (h1Ref.current) {
      registerH1(h1Ref.current);

      // Enable h1 text in navbar for this view
      updateShowH1InNavbar(true);

      // Set up action buttons if user is owner or super admin
      if (user && experience && isOwner(user, experience)) {
        setPageActionButtons([
          {
            label: "Edit",
            onClick: () => navigate(`/experiences/${experience._id}/update`),
            variant: "outline-primary",
            icon: "✏️",
            tooltip: "Edit Experience",
            compact: true,
          },
          {
            label: "Delete",
            onClick: () => setShowDeleteModal(true),
            variant: "outline-danger",
            icon: "🗑️",
            tooltip: "Delete Experience",
            compact: true,
          },
        ]);
      }
    }

    return () => {
      clearActionButtons();
      // Disable h1 in navbar when leaving this view
      updateShowH1InNavbar(false);
    };
  }, [
    registerH1,
    setPageActionButtons,
    clearActionButtons,
    updateShowH1InNavbar,
    user,
    experience,
    navigate,
  ]);

  // Check for divergence when plan or experience changes
  useEffect(() => {
    if (selectedPlanId && collaborativePlans.length > 0 && experience) {
      const currentPlan = collaborativePlans.find(
  (p) => idEquals(p._id, selectedPlanId)
      );
      if (currentPlan) {
        const hasDiverged = checkPlanDivergence(currentPlan, experience);
        setShowSyncButton(hasDiverged);

        // Check if alert was recently dismissed via cookie
        if (hasDiverged) {
          const dismissedTime = getSyncAlertCookie(selectedPlanId);
          setShowSyncAlert(!dismissedTime); // Show alert only if not recently dismissed
        } else {
          setShowSyncAlert(false); // No divergence, no alert
        }
      }
    }
  }, [selectedPlanId, collaborativePlans, experience, checkPlanDivergence]);

  // Update displayed planned date based on active tab and selected plan, gated by ownership state
  useEffect(() => {
    // If the user doesn't currently have this experience planned, suppress any planned date display
    if (!userHasExperience) {
      setDisplayedPlannedDate(null);
      return;
    }

    if (activeTab === "myplan" && selectedPlanId) {
      // Show the selected plan's planned date
      const selectedPlan = collaborativePlans.find(
  (p) => idEquals(p._id, selectedPlanId)
      );
      setDisplayedPlannedDate(selectedPlan?.planned_date || null);
    } else {
      // Show the user's experience planned date
      setDisplayedPlannedDate(userPlannedDate);
    }
  }, [activeTab, selectedPlanId, collaborativePlans, userPlannedDate, userHasExperience]);

  /**
   * Update URL hash when a plan is selected to enable direct linking
   * Creates hash-based URLs like /experiences/:id#plan-:planId
   * IMPORTANT: Preserves item-level hashes (e.g., #plan-{planId}-item-{itemId})
   */
  useEffect(() => {
    if (activeTab === 'myplan' && selectedPlanId) {
      // Check if current hash already contains the correct plan ID
      const currentHash = window.location.hash || '';
      const expectedPlanPrefix = `#plan-${selectedPlanId}`;

      // If hash already has this plan ID (with or without item ID), don't modify it
      // This preserves item-level deep links from hash navigation
      if (currentHash.startsWith(expectedPlanPrefix)) {
        debug.log('[URL Management] Hash already correct, preserving:', currentHash);
        return;
      }

      // Only update if we need to change the plan ID
      const newHash = `#plan-${selectedPlanId}`;
      debug.log('[URL Management] Updating hash:', { old: currentHash, new: newHash });
      window.history.replaceState(null, '', newHash);
    } else if (activeTab === 'experience') {
      // Clear hash when viewing experience tab
      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  }, [activeTab, selectedPlanId]);

  /**
   * Dynamically adjusts the font size of the planned date metric value to fit within container.
   * Similar to DestinationCard implementation - reduces font size incrementally if text overflows.
   */
  useEffect(() => {
    const adjustPlannedDateFontSize = () => {
      const element = plannedDateRef.current;
      if (!element) return;

      // Reset to default size first
      element.style.fontSize = "";

      // Get the computed style to find the current font size
      let fontSize = parseFloat(window.getComputedStyle(element).fontSize);
      const minFontSize = 1; // rem (16px at base 16px) - more aggressive minimum

      // Check if text is overflowing horizontally
      // Reduce more aggressively (2px instead of 1px per iteration)
      while (
        element.scrollWidth > element.clientWidth &&
        fontSize > minFontSize * 16
      ) {
        fontSize -= 2; // More aggressive reduction
        element.style.fontSize = `${fontSize}px`;
      }
    };

    // Use setTimeout to ensure DOM is fully rendered before adjusting
    const timeoutId = setTimeout(() => {
      adjustPlannedDateFontSize();
    }, 0);

    // Adjust on window resize
    window.addEventListener("resize", adjustPlannedDateFontSize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", adjustPlannedDateFontSize);
    };
  }, [displayedPlannedDate]);

  // Periodically refresh collaborative plans to pick up new collaborator additions
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchCollaborativePlans();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(intervalId);
  }, [fetchCollaborativePlans]);

  // Sync tab changes to presence system
  useEffect(() => {
    if (setPresenceTab) {
      const presenceTabName = activeTab === 'myplan' ? 'my-plan' : 'the-plan';
      setPresenceTab(presenceTabName);
    }
  }, [activeTab, setPresenceTab]);

  const handleSyncPlan = useCallback(async () => {
    if (!selectedPlanId || !experience) return;

    try {
      // Calculate changes between experience and plan
      const currentPlan = collaborativePlans.find(
        (p) => idEquals(p._id, selectedPlanId)
      );
      if (!currentPlan) return;

      const changes = {
        added: [],
        removed: [],
        modified: [],
      };

      // Find items in experience but not in plan (added)
      experience.plan_items.forEach((expItem) => {
        const planItem = currentPlan.plan.find(
          (pItem) => pItem.plan_item_id?.toString() === expItem._id.toString()
        );
        if (!planItem) {
          changes.added.push({
            _id: expItem._id,
            text: expItem.text,
            url: expItem.url,
            cost: expItem.cost_estimate || 0,
            planning_days: expItem.planning_days || 0,
            photo: expItem.photo,
            parent: expItem.parent,
          });
        }
      });

      // Find items in plan but not in experience (removed)
      currentPlan.plan.forEach((planItem) => {
        const expItem = experience.plan_items.find(
          (eItem) => eItem._id.toString() === planItem.plan_item_id?.toString()
        );
        if (!expItem) {
          changes.removed.push({
            _id: planItem.plan_item_id,
            text: planItem.text,
            url: planItem.url,
          });
        }
      });

      // Find modified items (text, url, cost, or days changed)
      experience.plan_items.forEach((expItem) => {
        const planItem = currentPlan.plan.find(
          (pItem) => pItem.plan_item_id?.toString() === expItem._id.toString()
        );
        if (planItem) {
          const modifications = [];
          if (planItem.text !== expItem.text) {
            modifications.push({
              field: "text",
              old: planItem.text,
              new: expItem.text,
            });
          }
          if (planItem.url !== expItem.url) {
            modifications.push({
              field: "url",
              old: planItem.url,
              new: expItem.url,
            });
          }
          if ((planItem.cost || 0) !== (expItem.cost_estimate || 0)) {
            modifications.push({
              field: "cost",
              old: planItem.cost,
              new: expItem.cost_estimate || 0,
            });
          }
          if ((planItem.planning_days || 0) !== (expItem.planning_days || 0)) {
            modifications.push({
              field: "days",
              old: planItem.planning_days,
              new: expItem.planning_days || 0,
            });
          }

          if (modifications.length > 0) {
            changes.modified.push({
              _id: expItem._id,
              text: expItem.text,
              modifications,
            });
          }
        }
      });

      // Show modal with changes and select all by default
      setSyncChanges(changes);
      setSelectedSyncItems({
        added: changes.added.map((_, idx) => idx),
        removed: changes.removed.map((_, idx) => idx),
        modified: changes.modified.map((_, idx) => idx),
      });
      setShowSyncModal(true);
    } catch (err) {
      const errorMsg = handleError(err, { context: "Calculate sync changes" });
      showError(errorMsg);
    }
  }, [selectedPlanId, experience, collaborativePlans]);

  const confirmSyncPlan = useCallback(async () => {
    if (!selectedPlanId || !experience || !syncChanges) return;

    try {
      setLoading(true);

      const currentPlan = collaborativePlans.find(
  (p) => idEquals(p._id, selectedPlanId)
      );
      if (!currentPlan) {
        throw new Error("Current plan not found");
      }

      // Start with current plan items
      let updatedPlanSnapshot = [...currentPlan.plan];

      // Apply selected additions
      if (selectedSyncItems.added.length > 0) {
        const itemsToAdd = selectedSyncItems.added.map(
          (idx) => syncChanges.added[idx]
        );
        itemsToAdd.forEach((item) => {
          updatedPlanSnapshot.push({
            plan_item_id: item._id,
            complete: false,
            cost: item.cost_estimate || 0,
            planning_days: item.planning_days || 0,
            text: item.text,
            url: item.url,
            photo: item.photo,
            parent: item.parent,
          });
        });
      }

      // Apply selected removals
      if (selectedSyncItems.removed.length > 0) {
        const itemIdsToRemove = selectedSyncItems.removed.map((idx) =>
          syncChanges.removed[idx]._id.toString()
        );
        updatedPlanSnapshot = updatedPlanSnapshot.filter(
          (pItem) => !itemIdsToRemove.includes(pItem.plan_item_id?.toString())
        );
      }

      // Apply selected modifications
      if (selectedSyncItems.modified.length > 0) {
        const itemsToModify = selectedSyncItems.modified.map(
          (idx) => syncChanges.modified[idx]
        );
        itemsToModify.forEach((modItem) => {
          const itemIndex = updatedPlanSnapshot.findIndex(
            (pItem) => pItem.plan_item_id?.toString() === modItem._id.toString()
          );
          if (itemIndex !== -1) {
            // Update fields that changed, preserve completion status and actual cost
            const existingItem = updatedPlanSnapshot[itemIndex];
            const expItem = experience.plan_items.find(
              (ei) => ei._id.toString() === modItem._id.toString()
            );
            if (expItem) {
              updatedPlanSnapshot[itemIndex] = {
                ...existingItem,
                text: expItem.text,
                url: expItem.url,
                cost: existingItem.cost, // Preserve actual cost
                planning_days: expItem.planning_days || 0,
                photo: expItem.photo,
                parent: expItem.parent,
              };
            }
          }
        });
      }

      // Update the plan with new snapshot
      await updatePlan(selectedPlanId, { plan: updatedPlanSnapshot });

      // Refresh plans
      await fetchCollaborativePlans();
      await fetchUserPlan();
      await fetchPlans(); // Refresh global plans state

      setShowSyncButton(false);
      setShowSyncAlert(false);
      setShowSyncModal(false);
      setSyncChanges(null);
      setSelectedSyncItems({ added: [], removed: [], modified: [] });

      // Set cookie to hide alert for 1 week after successful sync
      setSyncAlertCookie(selectedPlanId);

      debug.log("Plan synced successfully");
    } catch (err) {
      const errorMsg = handleError(err, { context: "Sync plan" });
      showError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [
    selectedPlanId,
    experience,
    collaborativePlans,
    fetchCollaborativePlans,
    fetchUserPlan,
    selectedSyncItems,
    syncChanges,
  ]);

  const dismissSyncAlert = useCallback(() => {
    if (selectedPlanId) {
      setSyncAlertCookie(selectedPlanId);
      setShowSyncAlert(false);
      debug.log("Sync alert dismissed for 1 week");
    }
  }, [selectedPlanId]);

  const handleAddPlanInstanceItem = useCallback((parentId = null) => {
    setEditingPlanItem(parentId ? { parent: parentId } : {});
    setPlanItemFormState(1); // Add mode
    setShowPlanItemModal(true);
  }, []);

  const handleEditPlanInstanceItem = useCallback((planItem) => {
    setEditingPlanItem({
      _id: planItem._id,
      plan_item_id: planItem.plan_item_id,
      text: planItem.text,
      url: planItem.url || "",
      cost: planItem.cost || 0,
      planning_days: planItem.planning_days || 0,
      parent: planItem.parent || null,
    });
    setPlanItemFormState(0); // Edit mode
    setShowPlanItemModal(true);
  }, []);

  // Handler to open Details modal for a plan item
  const handleViewPlanItemDetails = useCallback((planItem, initialTab = 'notes') => {
    setSelectedDetailsItem(planItem);
    setDetailsModalInitialTab(initialTab);
    setShowDetailsModal(true);
  }, []);

  // Note CRUD handlers for Details modal
  const handleAddNoteToItem = useCallback(async (content) => {
    if (!selectedPlanId || !selectedDetailsItem?._id || !content.trim()) return;

    try {
      const updatedPlan = await addPlanItemNote(selectedPlanId, selectedDetailsItem._id, content);

      // Update collaborative plans with the new note
      setCollaborativePlans(prevPlans =>
        prevPlans.map(p => idEquals(p._id, selectedPlanId) ? updatedPlan : p)
      );

      // Update selected item with new note
      const updatedItem = updatedPlan.plan.find(item => idEquals(item._id, selectedDetailsItem._id));
      if (updatedItem) {
        setSelectedDetailsItem(updatedItem);
      }

      success(lang.current.notification?.note?.added || 'Your note has been added and is visible to collaborators');
    } catch (error) {
      showError(error.message || 'Failed to add note');
    }
  }, [selectedPlanId, selectedDetailsItem, idEquals, setCollaborativePlans, success, showError]);

  const handleUpdateNoteOnItem = useCallback(async (noteId, content) => {
    if (!selectedPlanId || !selectedDetailsItem?._id || !noteId || !content.trim()) return;

    try {
      const updatedPlan = await updatePlanItemNote(selectedPlanId, selectedDetailsItem._id, noteId, content);

      // Update collaborative plans
      setCollaborativePlans(prevPlans =>
        prevPlans.map(p => idEquals(p._id, selectedPlanId) ? updatedPlan : p)
      );

      // Update selected item
      const updatedItem = updatedPlan.plan.find(item => idEquals(item._id, selectedDetailsItem._id));
      if (updatedItem) {
        setSelectedDetailsItem(updatedItem);
      }

      success(lang.current.notification?.note?.updated || 'Note updated. All collaborators can see your changes.');
    } catch (error) {
      showError(error.message || 'Failed to update note');
    }
  }, [selectedPlanId, selectedDetailsItem, idEquals, setCollaborativePlans, success, showError]);

  const handleDeleteNoteFromItem = useCallback(async (noteId) => {
    if (!selectedPlanId || !selectedDetailsItem?._id || !noteId) return;

    try {
      const updatedPlan = await deletePlanItemNote(selectedPlanId, selectedDetailsItem._id, noteId);

      // Update collaborative plans
      setCollaborativePlans(prevPlans =>
        prevPlans.map(p => idEquals(p._id, selectedPlanId) ? updatedPlan : p)
      );

      // Update selected item
      const updatedItem = updatedPlan.plan.find(item => idEquals(item._id, selectedDetailsItem._id));
      if (updatedItem) {
        setSelectedDetailsItem(updatedItem);
      }

      success(lang.current.notification?.note?.deleted || 'Note deleted');
    } catch (error) {
      showError(error.message || 'Failed to delete note');
    }
  }, [selectedPlanId, selectedDetailsItem, idEquals, setCollaborativePlans, success, showError]);

  const handleSavePlanInstanceItem = useCallback(
    async (e) => {
      e.preventDefault();
      if (!selectedPlanId) return;

      // Optimistic update for plan instance items
      const prevPlans = [...collaborativePlans];
  const planIndex = collaborativePlans.findIndex((p) => idEquals(p._id, selectedPlanId));
      const prevPlan = planIndex >= 0 ? { ...collaborativePlans[planIndex], plan: [...collaborativePlans[planIndex].plan] } : null;

      const isAdd = planItemFormState === 1;
      const tempId = `temp-${Date.now()}`;

      const apply = () => {
        if (!prevPlan || planIndex < 0) return;
        const updatedPlans = [...collaborativePlans];
        const updatedPlan = { ...prevPlan, plan: [...prevPlan.plan] };
        if (isAdd) {
          updatedPlan.plan.push({
            _id: tempId,
            plan_item_id: editingPlanItem.plan_item_id || tempId,
            text: editingPlanItem.text || "",
            url: editingPlanItem.url || "",
            cost: editingPlanItem.cost || 0,
            planning_days: editingPlanItem.planning_days || 0,
            parent: editingPlanItem.parent || null,
            activity_type: editingPlanItem.activity_type || null,
            location: editingPlanItem.location || null,
            complete: false,
          });
        } else {
          const idx = updatedPlan.plan.findIndex((i) => i._id?.toString() === editingPlanItem._id?.toString());
          if (idx >= 0) {
            updatedPlan.plan[idx] = {
              ...updatedPlan.plan[idx],
              text: editingPlanItem.text || "",
              url: editingPlanItem.url || "",
              cost: editingPlanItem.cost || 0,
              planning_days: editingPlanItem.planning_days || 0,
              parent: editingPlanItem.parent || null,
              activity_type: editingPlanItem.activity_type || null,
              location: editingPlanItem.location || null,
            };
          }
        }
        updatedPlans[planIndex] = updatedPlan;
        setCollaborativePlans(updatedPlans);
        setShowPlanItemModal(false);
        setEditingPlanItem({});
      };

      const apiCall = async () => {
        if (isAdd) {
          await addPlanItemToInstance(selectedPlanId, editingPlanItem);
        } else {
          const { _id, plan_item_id, ...updates } = editingPlanItem;
          await updatePlanItem(selectedPlanId, _id, updates);
        }
      };

      const rollback = () => {
        setCollaborativePlans(prevPlans);
        setShowPlanItemModal(true);
        setEditingPlanItem(isAdd ? (editingPlanItem || {}) : editingPlanItem);
      };

      const onSuccess = async () => {
        fetchCollaborativePlans().catch(() => {});
        fetchUserPlan().catch(() => {});
        fetchPlans().catch(() => {});
      };

      const onError = (err, defaultMsg) => {
        const errorMsg = handleError(err, { context: isAdd ? "Add plan item" : "Update plan item" }) || defaultMsg;
        showError(errorMsg);
      };

      const run = useOptimisticAction({ apply, apiCall, rollback, onSuccess, onError, context: isAdd ? 'Add plan item' : 'Update plan item' });
      await run();
    },
    [
      selectedPlanId,
      editingPlanItem,
      planItemFormState,
      fetchCollaborativePlans,
      fetchUserPlan,
      collaborativePlans,
      fetchPlans,
      showError,
    ]
  );

  const handlePlanInstanceItemDelete = useCallback(async () => {
    if (!selectedPlanId || !planInstanceItemToDelete) return;
    // Optimistic removal from selected plan snapshot
    const prevPlans = [...collaborativePlans];
  const planIndex = collaborativePlans.findIndex((p) => idEquals(p._id, selectedPlanId));
    const prevPlan = planIndex >= 0 ? { ...collaborativePlans[planIndex], plan: [...collaborativePlans[planIndex].plan] } : null;

    const apply = () => {
      if (!prevPlan || planIndex < 0) return;
      const updatedPlans = [...collaborativePlans];
      const updatedPlan = { ...prevPlan, plan: prevPlan.plan.filter((i) => i._id?.toString() !== planInstanceItemToDelete._id?.toString()) };
      updatedPlans[planIndex] = updatedPlan;
      setCollaborativePlans(updatedPlans);
      setShowPlanInstanceDeleteModal(false);
      setPlanInstanceItemToDelete(null);
    };

    const apiCall = async () => {
      await deletePlanItemFromInstance(selectedPlanId, planInstanceItemToDelete._id);
    };

    const rollback = () => {
      setCollaborativePlans(prevPlans);
    };

    const onSuccess = async () => {
      fetchCollaborativePlans().catch(() => {});
      fetchUserPlan().catch(() => {});
      fetchPlans().catch(() => {});
    };

    const onError = (err, defaultMsg) => {
      const errorMsg = handleError(err, { context: "Delete plan item" }) || defaultMsg;
      showError(errorMsg);
    };

    const run = useOptimisticAction({ apply, apiCall, rollback, onSuccess, onError, context: 'Delete plan item' });
    await run();
  }, [
    selectedPlanId,
    planInstanceItemToDelete,
    collaborativePlans,
    fetchCollaborativePlans,
    fetchUserPlan,
    fetchPlans,
    showError,
  ]);

  // Experience Plan Item Modal Handlers
  const handleAddExperiencePlanItem = useCallback((parentId = null) => {
    setEditingPlanItem(parentId ? { parent: parentId } : {});
    setPlanItemFormState(1); // Add mode
    setShowPlanItemModal(true);
  }, []);

  const handleEditExperiencePlanItem = useCallback((planItem) => {
    setEditingPlanItem({
      _id: planItem._id,
      text: planItem.text,
      url: planItem.url || "",
      cost: planItem.cost_estimate || 0,
      planning_days: planItem.planning_days || 0,
      parent: planItem.parent || null,
    });
    setPlanItemFormState(0); // Edit mode
    setShowPlanItemModal(true);
  }, []);

  const handleSaveExperiencePlanItem = useCallback(
    async (e) => {
      e.preventDefault();

      const isAdd = planItemFormState === 1;
      const prevExperience = experience ? { ...experience, plan_items: [...(experience.plan_items || [])] } : null;
      const tempId = `temp-${Date.now()}`;

      const apply = () => {
        if (!prevExperience) return;
        const updated = { ...prevExperience, plan_items: [...prevExperience.plan_items] };
        if (isAdd) {
          updated.plan_items.push({
            _id: tempId,
            text: editingPlanItem.text,
            url: editingPlanItem.url || "",
            cost_estimate: editingPlanItem.cost || 0,
            planning_days: editingPlanItem.planning_days || 0,
            parent: editingPlanItem.parent || null,
            activity_type: editingPlanItem.activity_type || null,
            location: editingPlanItem.location || null,
          });
        } else {
          const idx = updated.plan_items.findIndex((i) => i._id?.toString() === editingPlanItem._id?.toString());
          if (idx >= 0) {
            updated.plan_items[idx] = {
              ...updated.plan_items[idx],
              text: editingPlanItem.text,
              url: editingPlanItem.url || "",
              cost_estimate: editingPlanItem.cost || 0,
              planning_days: editingPlanItem.planning_days || 0,
              parent: editingPlanItem.parent || null,
              activity_type: editingPlanItem.activity_type || null,
              location: editingPlanItem.location || null,
            };
          }
        }
        setExperience(updated);
        setShowPlanItemModal(false);
        setEditingPlanItem({});
      };

      const apiCall = async () => {
        if (isAdd) {
          await addExperiencePlanItem(experience._id, {
            text: editingPlanItem.text,
            url: editingPlanItem.url,
            cost_estimate: editingPlanItem.cost || 0,
            planning_days: editingPlanItem.planning_days || 0,
            parent: editingPlanItem.parent || null,
            activity_type: editingPlanItem.activity_type || null,
            location: editingPlanItem.location || null,
          });
        } else {
          await updateExperiencePlanItem(experience._id, {
            _id: editingPlanItem._id,
            text: editingPlanItem.text,
            url: editingPlanItem.url,
            cost_estimate: editingPlanItem.cost || 0,
            planning_days: editingPlanItem.planning_days || 0,
            parent: editingPlanItem.parent || null,
            activity_type: editingPlanItem.activity_type || null,
            location: editingPlanItem.location || null,
          });
        }
      };

      const rollback = () => {
        if (prevExperience) setExperience(prevExperience);
        setShowPlanItemModal(true);
        setEditingPlanItem(isAdd ? (editingPlanItem || {}) : editingPlanItem);
      };

      const onSuccess = async () => {
        fetchAllData().catch(() => {});
      };

      const onError = (err, defaultMsg) => {
        const errorMsg = handleError(err, { context: isAdd ? "Add experience plan item" : "Update experience plan item" }) || defaultMsg;
        showError(errorMsg);
      };

      const run = useOptimisticAction({ apply, apiCall, rollback, onSuccess, onError, context: isAdd ? 'Add experience plan item' : 'Update experience plan item' });
      await run();
    },
    [experience, editingPlanItem, planItemFormState, fetchAllData]
  );

  const handlePlanChange = useCallback(
    (planId) => {
      const pid = planId && planId.toString ? planId.toString() : planId;
      setSelectedPlanId(pid);

      // Update displayed planned date to the selected plan's date
      const selectedPlan = collaborativePlans.find((p) => idEquals(p._id, pid));
      if (selectedPlan) {
        setDisplayedPlannedDate(selectedPlan.planned_date || null);
      }
    },
    [collaborativePlans]
  );

  // Auto-select first plan when plans load (if no hash navigation)
  useEffect(() => {
    // Only auto-select if:
    // 1. Plans have loaded
    // 2. There are plans available
    // 3. No plan is currently selected
    // 4. Not waiting for intent-based navigation (pending intent or hash in URL)
    const hasPendingIntent = intent && !intent.consumed;
    if (!plansLoading && collaborativePlans.length > 0 && !selectedPlanId && !hasPendingIntent) {
      // Check if there's a hash in the URL - if so, let hash navigation handle it
      const hash = window.location.hash || '';
      if (hash.startsWith('#plan-')) {
        debug.log('[Auto-select] Hash present in URL, skipping auto-select');
        return;
      }

      // Auto-select the first plan (user's own plan is always first due to sorting)
      const firstPlan = collaborativePlans[0];
      const firstPlanId = firstPlan._id && firstPlan._id.toString ? firstPlan._id.toString() : firstPlan._id;

      debug.log('[Auto-select] Auto-selecting first plan and switching to My Plan tab:', {
        planId: firstPlanId,
        isOwnPlan: idEquals(firstPlan.user?._id || firstPlan.user, user._id)
      });

      setSelectedPlanId(firstPlanId);
      setActiveTab('myplan'); // Switch to My Plan tab when auto-selecting
      handlePlanChange(firstPlanId);
    }
  }, [plansLoading, collaborativePlans, selectedPlanId, intent, user._id, idEquals, handlePlanChange]);

  // Collaborator handlers now provided by useCollaboratorManager hook

  // Memoized dollarSigns function for cost display
  const dollarSigns = useCallback((n) => {
    return "$".repeat(n);
  }, []);

  const handleExperience = useCallback(async () => {
    if (!experience || !user) return;
    if (!userHasExperience) {
      // Show date picker for new addition
      setIsEditingDate(false);
      setShowDatePicker(true);
      return;
    }
    // Show confirmation modal before removing
    // Don't hide badge yet - wait for user to confirm deletion
    setShowRemoveModal(true);
  }, [experience, user, userHasExperience]);

  // Measure the maximum width needed for the plan/unplan button based on the longest label
  useEffect(() => {
    // Guard for browser environment
    if (typeof document === 'undefined') return;

    const candidates = [
      lang.current.button.addFavoriteExp,
      lang.current.button.expPlanAdded,
      lang.current.button.removeFavoriteExp,
    ].filter(Boolean);

    // Create a measurement element with same button classes for accurate width
    const measure = (text) => {
      const el = document.createElement('button');
      el.className = 'btn btn-sm btn-icon btn-plan-add';
      el.style.visibility = 'hidden';
      el.style.position = 'absolute';
      el.style.pointerEvents = 'none';
      el.style.whiteSpace = 'nowrap';
      el.textContent = text;
      document.body.appendChild(el);
      const w = Math.ceil(el.offsetWidth);
      document.body.removeChild(el);
      return w;
    };

    try {
      const widths = candidates.map(measure);
      if (widths.length) {
        // Add a small buffer for hover state/icon jitter
        const maxW = Math.max(...widths) + 8;
        setPlanBtnWidth(maxW);
      }
    } catch (_) {
      // Ignore measurement errors
    }
  }, []);

  const confirmRemoveExperience = useCallback(async () => {
    if (!experience || !user) return;
    if (!userPlan) {
      setShowRemoveModal(false);
      return;
    }

    try {
      // User confirmed deletion
      setPendingUnplan(true);
      setShowRemoveModal(false);
      setShowDatePicker(false); // Close date picker modal when plan is removed
      setActiveTab("experience"); // Switch back to experience tab

      // Delete plan - hook handles ALL optimistic updates (userHasExperience, userPlan, etc.)
      await deletePlan(userPlan._id);
      debug.log("Plan deleted successfully");
      success(lang.current.notification?.plan?.removed || "Removed from your plan. You can add it back anytime.");

      setPendingUnplan(false);
    } catch (err) {
      // Hook's deletePlan already handles rollback on error
      // Just show error to user and restore UI state
      setShowRemoveModal(false);
      setPendingUnplan(false);
      const errorMsg = handleError(err, { context: "Remove plan" });
      showError(errorMsg || "Failed to remove plan. Please try again.");
    }
  }, [
    experience,
    user,
    userPlan,
    deletePlan,
    showError,
  ]);

  const handleAddExperience = useCallback(
    async (data = null) => {
      const addData =
        data !== null ? data : plannedDate ? { planned_date: plannedDate } : {};

      try {
        debug.log('[HANDLE_ADD] Starting handleAddExperience', {
          timestamp: Date.now(),
          currentUserHasExperience: userHasExperience,
          plannedDate: addData.planned_date
        });

        // Close UI elements - all plan state managed by usePlanManagement hook
        setShowDatePicker(false);
        setIsEditingDate(false);
        setPlannedDate("");

        // Create plan - hook handles ALL optimistic updates and reconciliation
        try {
          debug.log('[HANDLE_ADD] Calling createPlan from hook', {
            timestamp: Date.now(),
            experienceId: experience._id,
            plannedDate: addData.planned_date
          });

          // Hook's createPlan only takes plannedDate - experienceId comes from hook initialization
          const newPlan = await createPlan(addData.planned_date || null);

          debug.log('[HANDLE_ADD] Plan created successfully', {
            timestamp: Date.now(),
            planId: newPlan?._id,
            experienceId: experience._id
          });

          logger?.info?.("Plan created", {
            planId: newPlan?._id,
            experienceId: experience._id,
          });

          // Success feedback
          try {
            success(lang.current.notification?.plan?.created || "You're planning this experience! Check out your plan in the My Plan tab.");
          } catch (e) {
            // ignore toast failures
          }

          // Switch to My Plan tab to show the new plan
          setActiveTab("myplan");
        } catch (planErr) {
          logger?.error?.("Error creating plan", {
            experienceId: experience._id,
            error: planErr?.message,
          }, planErr);

          // Hook's createPlan already handles rollback on error
          // Just show error to user
          const errorMsg = handleError(planErr, { context: "Create plan" }) || "Failed to create plan";
          showError(errorMsg);
          return;
        }
      } catch (err) {
        // Unexpected error - hook handles rollback
        handleError(err, { context: "Add experience" });
      }
    },
    [
      experience?._id,
      plannedDate,
      userHasExperience,
      createPlan,
      success,
      showError
    ]
  );

  const handleDateUpdate = useCallback(async () => {
    if (!plannedDate) return;

    try {
      setLoading(true);

      // If viewing "My Plan" tab, update the selected plan's date
      if (activeTab === "myplan" && selectedPlanId) {
        // Convert date string to ISO format for the API
        const dateToSend = plannedDate
          ? new Date(plannedDate).toISOString()
          : null;

        // Optimistically update displayed date immediately
        setDisplayedPlannedDate(dateToSend);

        // Update server - event reconciliation handles state synchronization
        await updatePlan(selectedPlanId, { planned_date: dateToSend });

        // Refresh plans immediately - version-based reconciliation prevents overwrites
        fetchUserPlan().catch(() => {});
        fetchCollaborativePlans().catch(() => {});
        fetchPlans().catch(() => {});

        debug.log("Plan date updated successfully");
      } else if (!isOwner(user, experience)) {
        // Only non-owners can update planned date on Experience tab
        // Owners don't have a planned date since they manage the experience directly

        // Check if user already has a plan for this experience
        if (userPlan) {
          // Update existing plan's date
          // Convert date string to ISO format for the API
          const dateToSend = plannedDate
            ? new Date(plannedDate).toISOString()
            : null;

          // Optimistically update displayed date
          setDisplayedPlannedDate(dateToSend);

          // Update server - event reconciliation handles state synchronization
          await updatePlan(userPlan._id, { planned_date: dateToSend });

          // Refresh plans immediately - version-based reconciliation prevents overwrites
          fetchUserPlan().catch(() => {});
          fetchCollaborativePlans().catch(() => {});
          fetchPlans().catch(() => {});

          debug.log("Existing plan date updated successfully");
        } else {
          // Create new plan by adding experience
          await handleAddExperience();
        }

        // Refresh experience to get updated state
        await fetchAllData();
      } else if (isOwner(user, experience)) {
        // Owners can now create plans for their own experiences
        // Check if owner already has a plan
        if (userPlan) {
          // Update existing plan's date
          const dateToSend = plannedDate
            ? new Date(plannedDate).toISOString()
            : null;

          // Optimistically update displayed date
          setDisplayedPlannedDate(dateToSend);

          // Update server - event reconciliation handles state synchronization
          await updatePlan(userPlan._id, { planned_date: dateToSend });

          // Refresh plans immediately - version-based reconciliation prevents overwrites
          fetchUserPlan().catch(() => {});
          fetchCollaborativePlans().catch(() => {});
          fetchPlans().catch(() => {});

          debug.log("Owner's existing plan date updated successfully");
        } else {
          // Create new plan by adding experience
          await handleAddExperience();
        }

        // Refresh experience to get updated state
        await fetchAllData();
      }

      setShowDatePicker(false);
      setIsEditingDate(false);
      setPlannedDate("");
    } catch (err) {
      // Special-case email verification errors to give a clear action to the user
      const msgLower = (err && err.message ? err.message.toLowerCase() : "");
      if (msgLower.includes("email verification") || msgLower.includes("email_not_verified") || msgLower.includes("email not verified") || msgLower.includes("verify your email") || msgLower.includes("email_confirmed") ) {
        showError('Email verification required. Please verify your email address (check your inbox for a verification link)');
      } else {
        const errorMsg = handleError(err, { context: "Update date" });
        showError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  }, [
    plannedDate,
    activeTab,
    selectedPlanId,
    user,
    experience,
    userPlan,
    handleAddExperience,
    fetchUserPlan,
    fetchCollaborativePlans,
    fetchAllData,
  ]);

  const handleDeleteExperience = useCallback(async () => {
    if (!experience || !isOwner(user, experience)) return;
    try {
      removeExperience(experience._id); // Instant UI update!
      await deleteExperience(experience._id);
      const message = lang.current.notification?.experience?.deleted?.replace('{name}', experience.name) || `${experience.name} has been deleted. This action cannot be undone.`;
      success(message);
      navigate("/experiences");
    } catch (err) {
      const errorMsg = handleError(err, { context: "Delete experience" });
      showError(errorMsg);
      // Rollback on error
      await fetchExperiences();
    }
  }, [
    experience,
    user,
    navigate,
    removeExperience,
    success,
    showError,
    fetchExperiences,
  ]);

  const handlePlanDelete = useCallback(
    async (planItemId) => {
      if (!experience || !planItemId) return;
      const prevExperience = { ...experience, plan_items: [...(experience.plan_items || [])] };

      const apply = () => {
        const updated = { ...prevExperience, plan_items: prevExperience.plan_items.filter((i) => i._id?.toString() !== planItemId?.toString()) };
        setExperience(updated);
        setShowPlanDeleteModal(false);
      };

      const apiCall = async () => {
        await deletePlanItem(experience._id, planItemId);
      };

      const rollback = () => {
        setExperience(prevExperience);
      };

      const onSuccess = async () => {
        fetchAllData().catch(() => {});
        fetchExperiences().catch(() => {});
        success(lang.current.notification?.plan?.itemDeleted || 'Item removed from your plan');
      };

      const onError = (err, defaultMsg) => {
        const errorMsg = handleError(err, { context: "Delete plan item" }) || defaultMsg;
        showError(errorMsg);
      };

      const run = useOptimisticAction({ apply, apiCall, rollback, onSuccess, onError, context: 'Delete experience plan item' });
      await run();
    },
    [experience, fetchExperiences, fetchAllData, success, showError]
  );

  const handlePlanItemToggleComplete = useCallback(
    async (planItem) => {
      if (!selectedPlanId || !planItem) return;

      // Mark user interaction in progress to prevent hash effects from running
      userInteractionRef.current = true;

      const itemId = planItem._id || planItem.plan_item_id;
      const newComplete = !planItem.complete;

      // Helper to update a single item's complete property in a plan
      const updateItemComplete = (plan, itemId, complete) => {
        if (!plan?.plan) return plan;
        return {
          ...plan,
          plan: plan.plan.map(item =>
            (item._id === itemId || item.plan_item_id === itemId)
              ? { ...item, complete }
              : item
          )
        };
      };

      // Save previous state for rollback
      const prevPlans = collaborativePlans;

      // 1. Optimistic update - only change the complete property of this specific item
      setCollaborativePlans(plans =>
        plans.map(p =>
          idEquals(p._id, selectedPlanId)
            ? updateItemComplete(p, itemId, newComplete)
            : p
        )
      );

      try {
        // 2. API call - don't await event reconciliation, just update the server
        await updatePlanItem(selectedPlanId, itemId, { complete: newComplete });
        // Success - optimistic state is already correct, no further action needed
      } catch (err) {
        // 3. Rollback on error
        setCollaborativePlans(prevPlans);
        const errorMsg = handleError(err, { context: "Toggle plan item completion" }) || "Failed to update item. Please try again.";
        showError(errorMsg);
      } finally {
        userInteractionRef.current = false;
      }
    },
    [selectedPlanId, collaborativePlans, setCollaborativePlans, idEquals, showError]
  );

  /**
   * Handle reordering plan items via drag-and-drop
   */
  const handleReorderPlanItems = useCallback(
    async (planId, reorderedItems, draggedItemId) => {
      if (!planId || !reorderedItems) {
        debug.warn('[Reorder] Missing planId or reorderedItems');
        return;
      }

      debug.log('[Reorder] Reordering plan items', {
        planId,
        itemCount: reorderedItems.length,
        draggedItemId
      });

      // Optimistic update to collaborativePlans state
      const prevPlans = [...collaborativePlans];
      const planIndex = collaborativePlans.findIndex((p) => idEquals(p._id, planId));
      const prevPlan = planIndex >= 0 ? { ...collaborativePlans[planIndex] } : null;

      const apply = () => {
        if (!prevPlan || planIndex < 0) return;
        const updatedPlans = [...collaborativePlans];
        updatedPlans[planIndex] = { ...prevPlan, plan: reorderedItems };
        setCollaborativePlans(updatedPlans);
      };

      const apiCall = async () => {
        await reorderPlanItems(planId, reorderedItems);
      };

      const rollback = () => {
        setCollaborativePlans(prevPlans);
      };

      const onSuccess = async () => {
        // Scroll to and highlight the dragged item
        if (draggedItemId) {
          setTimeout(() => {
            const itemSelector = `[data-plan-item-id="${escapeSelector(draggedItemId)}"]`;
            const itemElement = document.querySelector(itemSelector);
            if (itemElement) {
              highlightPlanItem(itemElement);
            }
          }, 100);
        }

        // Refresh plan data to ensure consistency
        fetchCollaborativePlans().catch(() => {});
        fetchUserPlan().catch(() => {});
        fetchPlans().catch(() => {});
        success(lang.current.notification?.plan?.reordered || 'Your plan order has been saved');
      };

      const onError = (err, defaultMsg) => {
        const errorMsg = handleError(err, { context: "Reorder plan items" }) || defaultMsg;
        showError(errorMsg);
      };

      const run = useOptimisticAction({
        apply,
        apiCall,
        rollback,
        onSuccess,
        onError,
        context: 'Reorder plan items'
      });
      await run();
    },
    [
      collaborativePlans,
      fetchCollaborativePlans,
      fetchUserPlan,
      fetchPlans,
      success,
      showError,
    ]
  );

  const handleReorderExperiencePlanItems = useCallback(
    async (experienceId, reorderedItems, draggedItemId) => {
      if (!experienceId || !reorderedItems) {
        debug.warn('[ExperienceReorder] Missing experienceId or reorderedItems');
        return;
      }

      debug.log('[ExperienceReorder] Reordering experience plan items', {
        experienceId,
        itemCount: reorderedItems.length,
        draggedItemId
      });

      // Optimistic update to experience state
      const prevExperience = { ...experience };

      const apply = () => {
        setExperience({ ...experience, plan_items: reorderedItems });
      };

      const apiCall = async () => {
        await reorderExperiencePlanItems(experienceId, reorderedItems);
      };

      const rollback = () => {
        setExperience(prevExperience);
      };

      const onSuccess = async () => {
        // Scroll to and highlight the dragged item
        if (draggedItemId) {
          setTimeout(() => {
            const itemSelector = `[data-plan-item-id="${escapeSelector(draggedItemId)}"]`;
            const itemElement = document.querySelector(itemSelector);
            if (itemElement) {
              highlightPlanItem(itemElement);
            }
          }, 100);
        }

        // Refresh experience data to ensure consistency
        fetchAllData().catch(() => {});
        success(lang.current.notification?.plan?.reordered || 'Your plan order has been saved');
      };

      const onError = (err, defaultMsg) => {
        const errorMsg = handleError(err, { context: "Reorder experience plan items" }) || defaultMsg;
        showError(errorMsg);
      };

      const run = useOptimisticAction({
        apply,
        apiCall,
        rollback,
        onSuccess,
        onError,
        context: 'Reorder experience plan items'
      });
      await run();
    },
    [
      experience,
      fetchAllData,
      success,
      showError,
    ]
  );

  // ============================================================================
  // MAIN COMPONENT RENDER
  // ============================================================================

  return (
    <>
      
        {experience && (
          <PageOpenGraph
            title={experience.name}
            description={`Plan your ${experience.name} experience. ${
              experience.cost_estimate > 0
                ? `Estimated cost: ${formatCostEstimate(experience.cost_estimate)}. `
                : ""
            }${
              experience.max_planning_days > 0
                ? `Planning time: ${formatPlanningTime(experience.max_planning_days)}.`
                : ""
            }`}
            keywords={`${experience.name}, travel, experience, planning${
              experience.destination && experience.destination.name
                ? `, ${experience.destination.name}, ${experience.destination.country}`
                : ""
            }${
              experience.experience_type ? `, ${experience.experience_type}` : ""
            }`}
            ogTitle={`${experience.name}${
              experience.destination && experience.destination.name ? ` - ${experience.destination.name}` : ""
            }`}
            ogDescription={`Discover and plan ${experience.name}. ${
              travelTips.length > 0
                ? travelTips[0]
                : "Start planning your perfect travel experience today."
            }`}
            entity={experience}
            entityType="experience"
            schema={buildExperienceSchema(experience, window?.location?.origin || '')}
          />
        )}
      {experience ? (
        <div className={styles.experienceDetailContainer}>
          <Container>
            <Row>
              {/* Main Content Column (8 cols on lg+) */}
              <Col lg={8}>
                {/* Hero Image Section */}
                <div className={styles.heroSection}>
                  {experience.photos && experience.photos.length > 0 ? (
                    <img
                      src={experience.photos[0]?.url || experience.photos[0]}
                      alt={experience.name}
                    />
                  ) : experience.destination?.photos && experience.destination.photos.length > 0 ? (
                    <img
                      src={experience.destination.photos[0]?.url || experience.destination.photos[0]}
                      alt={experience.destination.name}
                    />
                  ) : (
                    <div className="d-flex align-items-center justify-content-center h-100 text-muted">
                      No image available
                    </div>
                  )}
                  {/* Hero photo viewer button */}
                  <button
                    type="button"
                    className={styles.heroPhotoButton}
                    onClick={() => {
                      setPhotoViewerIndex(0);
                      setShowPhotoViewer(true);
                    }}
                    aria-label="View photos"
                  >
                    <FaRegImage />
                  </button>
                </div>

                {/* Tags Section */}
                {(experience.experience_type || experience.destination) && (
                  <div className={styles.tagsSection}>
                    {experience.experience_type && (
                      Array.isArray(experience.experience_type)
                        ? experience.experience_type.map((type, index) => (
                            <Link key={index} to={`/experience-types/${type.toLowerCase().replace(/\s+/g, '-')}`} style={{ textDecoration: 'none' }}>
                              <Badge bg="secondary" className={styles.tag}>
                                {type}
                              </Badge>
                            </Link>
                          ))
                        : typeof experience.experience_type === 'string'
                          ? experience.experience_type.split(',').map((type, index) => (
                              <Link key={index} to={`/experience-types/${type.trim().toLowerCase().replace(/\s+/g, '-')}`} style={{ textDecoration: 'none' }}>
                                <Badge bg="secondary" className={styles.tag}>
                                  {type.trim()}
                                </Badge>
                              </Link>
                            ))
                          : null
                    )}
                    {experience.destination && (
                      <Link to={`/destinations/${experience.destination._id}`} style={{ textDecoration: 'none' }}>
                        <Badge bg="secondary" className={styles.tag}>
                          {experience.destination.country}
                        </Badge>
                      </Link>
                    )}
                  </div>
                )}

                {/* Title Section */}
                <div className={styles.titleSection}>
                  <h1 ref={h1Ref} className={styles.experienceTitle}>{experience.name}</h1>
                  {experience.destination && (
                    <p className={styles.locationText}>
                      <FaMapMarkerAlt />
                      <Link to={`/destinations/${experience.destination._id}`}>
                        {experience.destination.name}, {experience.destination.country}
                      </Link>
                    </p>
                  )}
                </div>

                {/* Experience Overview Card - Only render if overview has content */}
                {experience.overview && (
                  <div className={styles.contentCard}>
                    <div className={styles.cardBody}>
                      <h2 className={styles.cardTitle}>{lang.current.label.overview}</h2>
                      <p className={styles.cardDescription}>
                        {experience.overview}
                      </p>
                    </div>
                  </div>
                )}

                {/* Plan Items Card - always show (render EmptyState when no plan items) */}
                <div className={styles.contentCard}>
                  <div className={styles.cardBody}>
                    {/* Plan Navigation Tabs */}
                    <PlanTabsNavigation
                      activeTab={activeTab}
                      setActiveTab={setActiveTab}
                      user={user}
                      idEquals={idEquals}
                      collaborativePlans={collaborativePlans}
                      plansLoading={plansLoading}
                      selectedPlanId={selectedPlanId}
                      setSelectedPlanId={setSelectedPlanId}
                      handlePlanChange={handlePlanChange}
                      lang={lang}
                    />

                    {/* Experience Plan Items Tab Content */}
                    {activeTab === "experience" && (
                      (experience.plan_items && experience.plan_items.length > 0) ? (
                        <ExperienceTabContent
                          user={user}
                          experience={experience}
                          experienceOwner={experienceOwner}
                          experienceCollaborators={experienceCollaborators}
                          experienceOwnerLoading={experienceOwnerLoading}
                          experienceCollaboratorsLoading={experienceCollaboratorsLoading}
                          expandedParents={expandedParents}
                          animatingCollapse={animatingCollapse}
                          handleAddExperiencePlanItem={handleAddExperiencePlanItem}
                          handleEditExperiencePlanItem={handleEditExperiencePlanItem}
                          openCollaboratorModal={collaboratorManager.openCollaboratorModal}
                          toggleExpanded={toggleExpanded}
                          setPlanItemToDelete={setPlanItemToDelete}
                          setShowPlanDeleteModal={setShowPlanDeleteModal}
                          onReorderExperiencePlanItems={handleReorderExperiencePlanItems}
                          lang={lang}
                          // Real-time presence
                          presenceConnected={presenceConnected}
                          experienceMembers={experienceMembers}
                        />
                      ) : (
                        <EmptyState
                          variant="plans"
                          title={isOwner ? "No Plan Items" : "No Plan Items"}
                          description={isOwner ? "This experience has no plan items yet. Add some to help others plan their trip." : `${experience.name} doesn't have any plan items yet.`}
                          primaryAction={isOwner ? "Add Plan Item" : null}
                          onPrimaryAction={isOwner ? () => handleAddExperiencePlanItem() : null}
                          size="md"
                        />
                      )
                    )}

                    {/* My Plan Tab Content */}
                    {activeTab === "myplan" && selectedPlanId && (
                      <MyPlanTabContent
                        selectedPlanId={selectedPlanId}
                        user={user}
                        idEquals={idEquals}
                        collaborativePlans={collaborativePlans}
                        planOwner={planOwner}
                        planCollaborators={planCollaborators}
                        planOwnerLoading={planOwnerLoading}
                        planCollaboratorsLoading={planCollaboratorsLoading}
                        hashSelecting={!!(intent && !intent.consumed)}
                        showSyncButton={showSyncButton}
                        showSyncAlert={showSyncAlert}
                        dismissSyncAlert={dismissSyncAlert}
                        loading={loading}
                        plansLoading={plansLoading}
                        expandedParents={expandedParents}
                        animatingCollapse={animatingCollapse}
                        displayedPlannedDate={displayedPlannedDate}
                        setIsEditingDate={setIsEditingDate}
                        setPlannedDate={setPlannedDate}
                        setShowDatePicker={setShowDatePicker}
                        plannedDateRef={plannedDateRef}
                        handleSyncPlan={handleSyncPlan}
                        handleAddPlanInstanceItem={handleAddPlanInstanceItem}
                        handleEditPlanInstanceItem={handleEditPlanInstanceItem}
                        handleViewPlanItemDetails={handleViewPlanItemDetails}
                        openCollaboratorModal={collaboratorManager.openCollaboratorModal}
                        toggleExpanded={toggleExpanded}
                        setPlanInstanceItemToDelete={setPlanInstanceItemToDelete}
                        setShowPlanInstanceDeleteModal={setShowPlanInstanceDeleteModal}
                        handlePlanItemToggleComplete={handlePlanItemToggleComplete}
                        onReorderPlanItems={handleReorderPlanItems}
                        hoveredPlanItem={hoveredPlanItem}
                        setHoveredPlanItem={setHoveredPlanItem}
                        lang={lang}
                        // Cost tracking
                        costs={costs}
                        costSummary={costSummary}
                        costsLoading={costsLoading}
                        onAddCost={addCost}
                        onUpdateCost={updateCost}
                        onDeleteCost={deleteCost}
                        // Real-time presence
                        presenceConnected={presenceConnected}
                        planMembers={planMembers}
                        setTyping={setTyping}
                      />
                    )}

                    {/* If My Plan tab selected but no plan is selected, show empty state */}
                    {activeTab === "myplan" && !selectedPlanId && (
                      <EmptyState
                        variant="plans"
                        title="No Plans"
                        description={`There are no user plans for this experience yet.`}
                        primaryAction={!userHasExperience ? "Plan This Experience" : null}
                        onPrimaryAction={!userHasExperience ? () => handleExperience() : null}
                        size="md"
                      />
                    )}
                  </div>
                </div>
              </Col>

              {/* Sidebar Column (4 cols on lg+) */}
              <Col lg={4}>
                <div className={styles.sidebar}>
                  <div className={styles.sidebarCard}>
                      <h3 className={styles.sidebarTitle}>Experience Details</h3>

                      {/* Date Picker Section */}
                      <DatePickerSection
                        showDatePicker={showDatePicker}
                        experience={experience}
                        isEditingDate={isEditingDate}
                        plannedDate={plannedDate}
                        setPlannedDate={setPlannedDate}
                        loading={loading}
                        handleDateUpdate={handleDateUpdate}
                        handleAddExperience={handleAddExperience}
                        setShowDatePicker={setShowDatePicker}
                        setIsEditingDate={setIsEditingDate}
                        lang={lang}
                      />

                      {/* Details List */}
                      <div className={styles.detailsList}>
                        {experience.rating > 0 && (
                          <div className={styles.detailItem}>
                            <div className={styles.detailLabel}>Rating</div>
                            <div className={styles.detailValue}>
                              <StarRating
                                rating={experience.rating}
                                size="md"
                                showValue={true}
                              />
                            </div>
                          </div>
                        )}
                        {experience.difficulty > 0 && (
                          <div className={styles.detailItem}>
                            <div className={styles.detailLabel}>Difficulty</div>
                            <div className={styles.detailValue}>
                              <DifficultyRating
                                difficulty={experience.difficulty}
                                size="md"
                                showValue={true}
                                showLabel={true}
                                variant="dots"
                              />
                            </div>
                          </div>
                        )}
                        {experience.cost_estimate > 0 && (
                          <div className={styles.detailItem}>
                            <div className={styles.detailLabel}>Estimated Cost</div>
                            <div className={styles.detailValue}>
                              <CostEstimate
                                cost={experience.cost_estimate}
                                showLabel={false}
                                showTooltip={true}
                                showDollarSigns={true}
                              />
                            </div>
                          </div>
                        )}
                        {experience.max_planning_days > 0 && (
                          <div className={styles.detailItem}>
                            <div className={styles.detailLabel}>Planning Time</div>
                            <div className={styles.detailValue}>
                              <PlanningTime
                                days={experience.max_planning_days}
                                showLabel={false}
                                showTooltip={true}
                                size="md"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className={styles.sidebarActions}>
                        <ActionButtonsRow
                          user={user}
                          experience={experience}
                          experienceId={experienceId}
                          userHasExperience={userHasExperience}
                          loading={loading}
                          plansLoading={plansLoading}
                          displayedPlannedDate={displayedPlannedDate}
                          selectedPlan={selectedPlan}
                          planButtonRef={planButtonRef}
                          planBtnWidth={planBtnWidth}
                          favHover={favHover}
                          setFavHover={setFavHover}
                          handleExperience={handleExperience}
                          setShowDeleteModal={setShowDeleteModal}
                          showDatePicker={showDatePicker}
                          setShowDatePicker={setShowDatePicker}
                          setIsEditingDate={setIsEditingDate}
                          setPlannedDate={setPlannedDate}
                          lang={lang}
                          variant="sidebar"
                        />
                      </div>
                  </div>
                </div>
              </Col>
            </Row>
          </Container>
        </div>
      ) : (
        <SingleExperienceSkeleton />
      )}
      {showPhotoViewer && (
        <PhotoModal
          photos={heroPhotos}
          initialIndex={photoViewerIndex}
          onClose={() => setShowPhotoViewer(false)}
        />
      )}
      <ConfirmModal
        show={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteExperience}
        title="Delete Experience?"
        message="You are about to permanently delete"
        itemName={experience?.name}
        additionalInfo={[
          "All plan items",
          "Associated photos",
          "User plans (if any)"
        ]}
        confirmText="Delete Permanently"
        confirmVariant="danger"
      />
      <ConfirmModal
        show={showRemoveModal}
        onClose={() => {
          setShowRemoveModal(false);
        }}
        onConfirm={confirmRemoveExperience}
        title="Remove from Your Plans?"
        message="You are about to remove"
        itemName={experience?.name}
        additionalInfo={[
          "Your plan progress",
          "Completed items",
          "Personal notes"
        ]}
        warningText="Your progress will be permanently deleted!"
        confirmText="Remove from Plans"
        confirmVariant="danger"
      />
      <ConfirmModal
        show={showPlanDeleteModal}
        onClose={() => setShowPlanDeleteModal(false)}
        onConfirm={() => handlePlanDelete(planItemToDelete)}
        title="Delete Plan Item?"
        message="You are about to delete this plan item"
        itemName={planItemToDelete?.text}
        confirmText="Delete Permanently"
        confirmVariant="danger"
      />
      <ConfirmModal
        show={showPlanInstanceDeleteModal}
        onClose={() => {
          setShowPlanInstanceDeleteModal(false);
          setPlanInstanceItemToDelete(null);
        }}
        onConfirm={handlePlanInstanceItemDelete}
        title="Delete Plan Item?"
        message="You are about to delete this plan item"
        itemName={planInstanceItemToDelete?.text}
        confirmText="Delete Permanently"
        confirmVariant="danger"
      />

      {/* Add Collaborator Modal */}
      <CollaboratorModal
        show={collaboratorManager.showCollaboratorModal}
        onHide={() => {
          collaboratorManager.setShowCollaboratorModal(false);
          collaboratorManager.setCollaboratorSearch("");
          collaboratorManager.setCollaboratorAddSuccess(false);
        }}
        onSearch={collaboratorManager.handleSearchUsers}
        onAddCollaborators={collaboratorManager.handleAddCollaborator}
        onRemoveCollaborator={collaboratorManager.handleRemoveSelectedCollaborator}
        onSendEmailInvite={collaboratorManager.handleSendEmailInvite}
        context={collaboratorManager.collaboratorContext}
        searchTerm={collaboratorManager.collaboratorSearch}
        onSearchTermChange={collaboratorManager.setCollaboratorSearch}
        searchResults={collaboratorManager.searchResults}
        selectedCollaborators={collaboratorManager.selectedCollaborators}
        onToggleCollaborator={collaboratorManager.handleSelectUser}
        existingCollaborators={
          collaboratorManager.collaboratorContext === "plan"
            ? planCollaborators
            : experienceCollaborators
        }
        removedCollaborators={collaboratorManager.removedCollaborators}
        addSuccess={collaboratorManager.collaboratorAddSuccess}
        addedCollaborators={collaboratorManager.addedCollaborators}
        actuallyRemovedCollaborators={collaboratorManager.actuallyRemovedCollaborators}
        experienceName={experience?.name || ""}
        destinationName={experience?.destination?.name || ""}
      />

      {/* Sync Plan Modal */}
      <SyncPlanModal
        show={showSyncModal}
        onHide={() => {
          setShowSyncModal(false);
          setSyncChanges(null);
        }}
        syncChanges={syncChanges}
        selectedSyncItems={selectedSyncItems}
        setSelectedSyncItems={setSelectedSyncItems}
        onConfirmSync={confirmSyncPlan}
        loading={loading}
        lang={lang}
      />
      {/* Plan Instance Item Modal */}
      <PlanItemModal
        show={showPlanItemModal}
        onHide={() => {
          setShowPlanItemModal(false);
          setEditingPlanItem({});
        }}
        editingPlanItem={editingPlanItem}
        setEditingPlanItem={setEditingPlanItem}
        planItemFormState={planItemFormState}
        activeTab={activeTab}
        onSaveExperiencePlanItem={handleSaveExperiencePlanItem}
        onSavePlanInstanceItem={handleSavePlanInstanceItem}
        loading={loading}
        lang={lang}
      />

      {/* Plan Item Details Modal */}
      <PlanItemDetailsModal
        show={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedDetailsItem(null);
          setDetailsModalInitialTab('notes');
        }}
        planItem={selectedDetailsItem}
        plan={selectedPlan}
        currentUser={user}
        collaborators={allPlanCollaborators}
        onAddNote={handleAddNoteToItem}
        onUpdateNote={handleUpdateNoteOnItem}
        onDeleteNote={handleDeleteNoteFromItem}
        initialTab={detailsModalInitialTab}
        onAssign={async (userId) => {
          if (!selectedPlan || !selectedDetailsItem) return;

          const assignee = allPlanCollaborators.find(c => (c._id || c.user?._id) === userId);
          const assigneeName = assignee?.name || assignee?.user?.name || 'Unknown User';

          // Store previous state for rollback
          const previousAssignedTo = selectedDetailsItem.assigned_to;

          try {
            // Optimistic update: Update local state immediately
            const updatePlanItemAssignment = (plans, planId, itemId, newAssignedTo) => {
              return plans.map(plan => {
                if (plan._id === planId) {
                  return {
                    ...plan,
                    plan: plan.plan.map(item => {
                      if (item._id === itemId) {
                        return { ...item, assignedTo: newAssignedTo, assigned_to: newAssignedTo };
                      }
                      return item;
                    })
                  };
                }
                return plan;
              });
            };

            // Update userPlan if it's the selected plan
            if (userPlan?._id === selectedPlan._id) {
              setUserPlan(prev => prev ? {
                ...prev,
                plan: prev.plan.map(item =>
                  item._id === selectedDetailsItem._id
                    ? { ...item, assignedTo: userId, assigned_to: userId }
                    : item
                )
              } : prev);
            }

            // Update collaborativePlans if it's in there
            setCollaborativePlans(prev => updatePlanItemAssignment(prev, selectedPlan._id, selectedDetailsItem._id, userId));

            // Update selectedDetailsItem for the modal (both camelCase and snake_case for compatibility)
            setSelectedDetailsItem(prev => prev ? { ...prev, assignedTo: userId, assigned_to: userId } : prev);

            // Call API
            await assignPlanItem(selectedPlan._id, selectedDetailsItem._id, userId);

            // Show success toast
            const message = lang.current.notification?.collaborator?.assigned?.replace('{name}', assigneeName) || `${assigneeName} is now responsible for this item`;
            success(message, { duration: 3000 });

            // Note: No fetchPlans() call here - optimistic update is sufficient
            // The plan will sync via WebSocket events or on next natural refresh
          } catch (error) {
            logger.error('Error assigning plan item', { error: error.message, userId });

            // Rollback optimistic update on error
            if (userPlan?._id === selectedPlan._id) {
              setUserPlan(prev => prev ? {
                ...prev,
                plan: prev.plan.map(item =>
                  item._id === selectedDetailsItem._id
                    ? { ...item, assignedTo: previousAssignedTo, assigned_to: previousAssignedTo }
                    : item
                )
              } : prev);
            }

            setCollaborativePlans(prev => prev.map(plan => {
              if (plan._id === selectedPlan._id) {
                return {
                  ...plan,
                  plan: plan.plan.map(item => {
                    if (item._id === selectedDetailsItem._id) {
                      return { ...item, assignedTo: previousAssignedTo, assigned_to: previousAssignedTo };
                    }
                    return item;
                  })
                };
              }
              return plan;
            }));

            // Rollback selectedDetailsItem for the modal (both camelCase and snake_case)
            setSelectedDetailsItem(prev => prev ? { ...prev, assignedTo: previousAssignedTo, assigned_to: previousAssignedTo } : prev);

            showError(error.message || 'Failed to assign plan item');
          }
        }}
        onUnassign={async () => {
          if (!selectedPlan || !selectedDetailsItem) return;

          // Store previous state for rollback
          const previousAssignedTo = selectedDetailsItem.assigned_to;

          try {
            // Optimistic update: Remove assignment immediately
            if (userPlan?._id === selectedPlan._id) {
              setUserPlan(prev => prev ? {
                ...prev,
                plan: prev.plan.map(item =>
                  item._id === selectedDetailsItem._id
                    ? { ...item, assignedTo: null, assigned_to: null }
                    : item
                )
              } : prev);
            }

            setCollaborativePlans(prev => prev.map(plan => {
              if (plan._id === selectedPlan._id) {
                return {
                  ...plan,
                  plan: plan.plan.map(item => {
                    if (item._id === selectedDetailsItem._id) {
                      return { ...item, assignedTo: null, assigned_to: null };
                    }
                    return item;
                  })
                };
              }
              return plan;
            }));

            // Update selectedDetailsItem for the modal (both camelCase and snake_case)
            setSelectedDetailsItem(prev => prev ? { ...prev, assignedTo: null, assigned_to: null } : prev);

            // Call API
            await unassignPlanItem(selectedPlan._id, selectedDetailsItem._id);

            // Show success toast
            success(lang.current.notification?.collaborator?.unassigned || 'This item is no longer assigned to anyone', { duration: 3000 });

            // Note: No fetchPlans() call here - optimistic update is sufficient
            // The plan will sync via WebSocket events or on next natural refresh
          } catch (error) {
            logger.error('Error unassigning plan item', { error: error.message });

            // Rollback optimistic update on error
            if (userPlan?._id === selectedPlan._id) {
              setUserPlan(prev => prev ? {
                ...prev,
                plan: prev.plan.map(item =>
                  item._id === selectedDetailsItem._id
                    ? { ...item, assignedTo: previousAssignedTo, assigned_to: previousAssignedTo }
                    : item
                )
              } : prev);
            }

            setCollaborativePlans(prev => prev.map(plan => {
              if (plan._id === selectedPlan._id) {
                return {
                  ...plan,
                  plan: plan.plan.map(item => {
                    if (item._id === selectedDetailsItem._id) {
                      return { ...item, assignedTo: previousAssignedTo, assigned_to: previousAssignedTo };
                    }
                    return item;
                  })
                };
              }
              return plan;
            }));

            // Rollback selectedDetailsItem for the modal (both camelCase and snake_case)
            setSelectedDetailsItem(prev => prev ? { ...prev, assignedTo: previousAssignedTo, assigned_to: previousAssignedTo } : prev);

            showError(error.message || 'Failed to unassign plan item');
          }
        }}
        canEdit={selectedPlan ? canEditPlan(user, selectedPlan) : false}
        availableEntities={availableEntities}
        entityData={entityData}
        onPlanItemClick={(itemId, entity) => {
          // When a plan-item deep link is clicked in notes:
          // Modal is already closed by PlanItemDetailsModal before this fires
          // Scroll immediately to the plan item and highlight it
          logger.debug('[SingleExperience] Plan item click from notes', { itemId, entity });
          attemptScrollToItem(itemId, { shouldHighlight: true, anticipationDelay: 0 });
        }}
      />
    </>
  );
}
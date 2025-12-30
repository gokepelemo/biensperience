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
import { FaMapMarkerAlt, FaShare, FaRegImage, FaStar, FaHome } from "react-icons/fa";
import { Row, Col, Badge, Breadcrumb } from "react-bootstrap";
import { useUser } from "../../contexts/UserContext";
import { useData } from "../../contexts/DataContext";
import { useApp } from "../../contexts/AppContext";
import { useToast } from "../../contexts/ToastContext";
import { useCollaboratorUsers } from "../../hooks/useCollaboratorUsers";
import useCollaboratorManager from "../../hooks/useCollaboratorManager";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal";
import TransferOwnershipModal from "../../components/TransferOwnershipModal/TransferOwnershipModal";
import PageOpenGraph from "../../components/OpenGraph/PageOpenGraph";
import PageSchema from '../../components/PageSchema/PageSchema';
import { buildExperienceSchema } from '../../utilities/schema-utils';
import PhotoModal from "../../components/PhotoModal/PhotoModal";
import PhotoUploadModal from "../../components/PhotoUploadModal/PhotoUploadModal";
import CostEntry from "../../components/CostEntry";
import UsersListDisplay from "../../components/UsersListDisplay/UsersListDisplay";
import InfoCard from "../../components/InfoCard/InfoCard";
import Alert from "../../components/Alert/Alert";
import Tooltip from "../../components/Tooltip/Tooltip";
import GoogleMap from "../../components/GoogleMap/GoogleMap";
import { Button, Container, FadeIn, FormLabel, FormControl, FormCheck, Text, EmptyState, EntityNotFound } from "../../components/design-system";
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
import { storePreference, retrievePreference } from "../../utilities/preferences-utils";
import { formatCurrency } from "../../utilities/currency-utils";
import { isOwner, canEditPlan } from "../../utilities/permissions";
import { hasFeatureFlag } from "../../utilities/feature-flags";
import { isArchiveUser, isExperienceArchived, getDisplayName as getSystemUserDisplayName } from "../../utilities/system-users";
import useOptimisticAction from "../../hooks/useOptimisticAction";
import usePlanManagement from "../../hooks/usePlanManagement";
import usePlanCosts from "../../hooks/usePlanCosts";
import usePlanSync from "../../hooks/usePlanSync";
import { usePresence } from "../../hooks/usePresence";
import { useModalManager, MODAL_NAMES } from "../../hooks/useModalManager";
import { useDateManagement } from "../../hooks/useDateManagement";
import { useExperienceActions } from "../../hooks/useExperienceActions";
import { usePlanItemNotes } from "../../hooks/usePlanItemNotes";
import { WS_EVENTS } from "../../hooks/useWebSocketEvents";
import {
  showExperienceWithContext,
  deletePlanItem,
  addPlanItem as addExperiencePlanItem,
  updatePlanItem as updateExperiencePlanItem,
  reorderExperiencePlanItems,
  updateExperience,
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
  assignPlanItem,
  unassignPlanItem,
  addPlanItemDetail,
} from "../../utilities/plans-api";
import { reconcileState, generateOptimisticId, subscribeToEvent } from "../../utilities/event-bus";
import { searchUsers } from "../../utilities/search-api";
import { sendEmailInvite } from "../../utilities/invites-api";
import { escapeSelector, highlightPlanItem, attemptScrollToItem } from "../../utilities/scroll-utils";
import { idEquals, normalizeId, findById, findIndexById, filterOutById } from "../../utilities/id-utils";

export default function SingleExperience() {
  // ============================================================================
  // CONTEXT HOOKS & ROUTER
  // ============================================================================

  const { user } = useUser();
  const { removeExperience, fetchExperiences, fetchPlans, experiences: ctxExperiences, updateExperience: updateExperienceInContext, setOptimisticPlanStateForExperience, clearOptimisticPlanStateForExperience } = useData();
  const {
    registerH1,
    updateShowH1InNavbar,
  } = useApp();
  const { success, error: showError } = useToast();
  const { experienceId } = useParams();
  const navigate = useNavigate();

  // ============================================================================
  // TOP-LEVEL STATE (defined before hooks to avoid circular dependencies)
  // ============================================================================

  // Date editing mode state - defined here because multiple hooks and callbacks need it
  // Must be before useDateManagement and useExperienceActions hooks
  const [isEditingDate, setIsEditingDate] = useState(false);

  // ============================================================================
  // CUSTOM HOOKS
  // ============================================================================

  // Plan management hook - replaces plan-related state and functions
  const {
    userPlan,
    setUserPlan,
    sharedPlans,
    setSharedPlans,
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
    fetchSharedPlans,
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
    setTab: setPresenceTab,
    subscribe: subscribeToEvents
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
  const [experienceNotFound, setExperienceNotFound] = useState(false);

  // UI state
  const [favHover, setFavHover] = useState(false);
  const [hoveredPlanItem, setHoveredPlanItem] = useState(null);
  const [activeTab, setActiveTab] = useState("experience"); // "experience" or "myplan"
  const [pendingUnplan, setPendingUnplan] = useState(false); // Hide planned date immediately when user clicks Remove (before confirm)

  // Tab loading states for smooth transitions
  const [experienceTabLoading, setExperienceTabLoading] = useState(true);

  // Plan item UI state - with encrypted persistence
  const [expandedParents, setExpandedParents] = useState(new Set());
  const [animatingCollapse, setAnimatingCollapse] = useState(null);
  const [hierarchyLoaded, setHierarchyLoaded] = useState(false);

  // Consolidated modal management
  const { activeModal, openModal, closeModal, isModalOpen } = useModalManager();

  // Modal data state (data associated with modals, not modal visibility)
  const [planItemToDelete, setPlanItemToDelete] = useState(null);
  const [planInstanceItemToDelete, setPlanInstanceItemToDelete] = useState(null);
  const [planItemFormState, setPlanItemFormState] = useState(1); // 1 = add, 0 = edit
  const [editingPlanItem, setEditingPlanItem] = useState({});
  const [selectedDetailsItem, setSelectedDetailsItem] = useState(null);
  const [detailsModalInitialTab, setDetailsModalInitialTab] = useState('notes');
  const [inlineCostPlanItem, setInlineCostPlanItem] = useState(null);
  const [inlineCostLoading, setInlineCostLoading] = useState(false);
  const [photoViewerIndex, setPhotoViewerIndex] = useState(0);

  // Curator tooltip state (two-click pattern: first shows tooltip, second navigates)
  const [curatorTooltipVisible, setCuratorTooltipVisible] = useState(false);

  // Refs
  const planButtonRef = useRef(null);
  const [planBtnWidth, setPlanBtnWidth] = useState(null);

  // Ref for editingPlanItem to avoid stale closures in callbacks
  // This prevents Chrome crashes from callback recreation on every form field change
  const editingPlanItemRef = useRef(editingPlanItem);
  editingPlanItemRef.current = editingPlanItem;

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
        ? sharedPlans.find((p) => idEquals(p._id, selectedPlanId))
        : userPlan,
    [activeTab, selectedPlanId, sharedPlans, userPlan]
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
            // Helper to check if array contains populated objects (with .url)
            const isPopulatedPhotoArray = (arr) =>
              Array.isArray(arr) && arr.length > 0 &&
              typeof arr[0] === 'object' && arr[0] !== null && arr[0].url;

            // Helper to check if destination is populated (object with name property)
            const isPopulatedDestination = (dest) =>
              dest && typeof dest === 'object' && dest.name;

            // Avoid storing volatile metadata (like timestamps) on the merged object
            const merged = { ...(experience || {}), ...(updated || {}) };

            // Preserve populated photos array if local has full objects with URLs
            // and incoming from context only has IDs (strings or unpopulated)
            if (isPopulatedPhotoArray(experience?.photos) && !isPopulatedPhotoArray(updated?.photos)) {
              merged.photos = experience.photos;
              merged.photos_full = experience.photos_full || experience.photos;
            }

            // Preserve populated destination object if local has full object with name/country
            // and incoming from context only has ID string or unpopulated object
            if (isPopulatedDestination(experience?.destination) && !isPopulatedDestination(updated?.destination)) {
              merged.destination = experience.destination;
            }

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
        if (idEquals(hashPlanId, selectedPlanId)) {
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

  /**
   * Get a canonical expansion key for a plan item.
   * For plan items: prefer plan_item_id (experience item reference) since children use this to reference parent
   * For experience items: use _id
   * This ensures consistent key usage across all components.
   */
  const getExpansionKey = useCallback((item) => {
    if (!item) return null;
    // For plan items, use plan_item_id as the canonical key (this is what children reference)
    // Fall back to _id if plan_item_id doesn't exist (e.g., plan-instance-only items)
    return (item.plan_item_id || item._id)?.toString() || null;
  }, []);

  /**
   * Check if an item is expanded. Handles both plan items and experience items.
   * Also considers animatingCollapse - if an item is animating collapse, treat it as collapsed.
   * @param {Object} item - The plan item or experience item
   * @returns {boolean} Whether the item is expanded
   */
  const isItemExpanded = useCallback((item) => {
    const key = getExpansionKey(item);
    if (!key) return true;
    // If this item is currently animating collapse, treat as not expanded
    if (animatingCollapse === key) return false;
    return expandedParents.has(key);
  }, [expandedParents, getExpansionKey, animatingCollapse]);

  /**
   * Toggle expansion state for a plan item.
   * Persists state to encrypted storage.
   * @param {Object} item - The plan item to toggle (pass the full item object)
   */
  const toggleExpanded = useCallback(async (item) => {
    const key = getExpansionKey(item);
    if (!key || !user?._id) return;

    const persistState = async (newSet) => {
      try {
        // Determine storage key based on current context
        let storageKey;
        if (activeTab === 'experience' && experience?._id) {
          storageKey = `hierarchy.experience.${experience._id}`;
        } else if (activeTab === 'myplan' && selectedPlanId) {
          storageKey = `hierarchy.plan.${selectedPlanId}`;
        }

        if (storageKey) {
          await storePreference(storageKey, Array.from(newSet), { userId: user._id });
        }
      } catch (error) {
        logger.error('Failed to persist hierarchy state', error);
      }
    };

    setExpandedParents((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        // collapsing - animate then remove
        setAnimatingCollapse(key);
        setTimeout(async () => {
          setExpandedParents((prev) => {
            const newSet = new Set(prev);
            newSet.delete(key);
            persistState(newSet);
            return newSet;
          });
          setAnimatingCollapse(null);
        }, 300);
      } else {
        // expanding
        newSet.add(key);
        persistState(newSet);
      }
      return newSet;
    });
  }, [getExpansionKey, user?._id, activeTab, experience?._id, selectedPlanId]);

  // OPTIMIZATION: Combined fetch function - fetches all data in one API call
  // Reduces 3 API calls to 1 for dramatically faster page load
  const fetchAllData = useCallback(async () => {
    try {
      const { experience: experienceData, userPlan: fetchedUserPlan, sharedPlans: fetchedSharedPlans } = await showExperienceWithContext(experienceId);

      debug.log("Experience data:", experienceData);
      debug.log("User plan:", fetchedUserPlan);
      debug.log("Shared plans:", fetchedSharedPlans);

      // Validate experience data exists
      if (!experienceData) {
        throw new Error('Experience not found');
      }

      // Set experience data
      setExperience(experienceData);
      setTravelTips(experienceData.travel_tips || []);

      // Update DataContext with fully-populated experience
      // This ensures other views have access to the complete experience data
      if (experienceData && experienceData._id) {
        updateExperienceInContext(experienceData);
      }

      // Expanded parents will be loaded from persisted state by the hierarchy effect
      // Don't override here to preserve user's expansion preferences

      // Set user plan data
      setUserPlan(fetchedUserPlan || null);
      setUserHasExperience(!!fetchedUserPlan);
      setUserPlannedDate(fetchedUserPlan?.planned_date || null);

      // selectedPlanId will be set by either:
      // 1. Hash navigation (if URL contains #plan-{id})
      // 2. Auto-select useEffect (first plan in dropdown after load)

      // Set collaborative plans data
      // Filter to only show plans where user is owner or collaborator
      const accessiblePlans = fetchedSharedPlans.filter((plan) => {
        // Check if user owns this plan
        const isUserPlan = plan.user && idEquals(plan.user._id || plan.user, user._id);

        // Check if user is a collaborator or owner via permissions
        const hasPermission = plan.permissions?.some(
          (p) =>
            p.entity === "user" &&
            idEquals(p._id, user._id) &&
            (p.type === "owner" || p.type === "collaborator")
        );

        return isUserPlan || hasPermission;
      });

      // CRITICAL: getExperiencePlans returns BOTH user's own plan AND shared plans
      // If we have a fetchedUserPlan from checkUserPlanForExperience, we need to filter
      // it out from accessiblePlans to prevent duplicates when merging
      const sharedPlansOnly = fetchedUserPlan
        ? accessiblePlans.filter((plan) => {
            // Exclude user's own plan - it will be prepended separately
            return !idEquals(plan.user?._id || plan.user, user._id);
          })
        : accessiblePlans;

      // Combine user's own plan with shared plans for unified display
      // Backend returns userPlan separately from sharedPlans array
      const allPlans = fetchedUserPlan
        ? [fetchedUserPlan, ...sharedPlansOnly]
        : accessiblePlans;

      // Sort plans: user's own plan first, then others
      const sortedPlans = allPlans.sort((a, b) => {
        const aIsUserPlan = a.user && idEquals(a.user._id || a.user, user._id);
        const bIsUserPlan = b.user && idEquals(b.user._id || b.user, user._id);

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

      // Set shared plans and mark loading complete
      // Use flushSync to force synchronous rendering and prevent layout shift
      flushSync(() => {
        setSharedPlans(normalizedSorted);
        setPlansLoading(false);
      });
    } catch (err) {
      debug.error("Error fetching all data:", err);
      
      // Check if this is a 404 error (experience not found)
      if (err.response?.status === 404) {
        setExperienceNotFound(true);
        setExperience(null);
        setUserPlan(null);
        setSharedPlans([]);
        setPlansLoading(false);
        return;
      }
      
      setExperience(null);
      setUserPlan(null);
      setSharedPlans([]);
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
    sharedPlans,
    setExperience,
    setUserPlan,
    setSharedPlans,
    fetchExperience: fetchAllData,
    fetchPlans,
    fetchSharedPlans,
    experienceCollaborators,
    planCollaborators,
    user,
    success,
    showError
  });

  // Plan sync hook - manages divergence detection and sync modal
  const {
    showSyncButton,
    showSyncAlert,
    showSyncModal,
    syncChanges,
    selectedSyncItems,
    syncLoading,
    setSelectedSyncItems,
    handleSyncPlan,
    confirmSyncPlan,
    dismissSyncAlert,
    closeSyncModal,
    resetSyncState,
    checkPlanDivergence
  } = usePlanSync({
    experience,
    selectedPlanId,
    sharedPlans,
    fetchSharedPlans,
    fetchUserPlan,
    fetchPlans,
    showError
  });

  // Experience action handlers (share, plan toggle, remove)
  const {
    handleExperience,
    handleShareExperience,
    handleSharePlanItem,
    confirmRemoveExperience
  } = useExperienceActions({
    experience,
    experienceId,
    user,
    userPlan,
    userHasExperience,
    selectedPlan,
    openModal,
    closeModal,
    MODAL_NAMES,
    setIsEditingDate,
    setActiveTab,
    setPendingUnplan,
    deletePlan,
    success,
    showError
  });

  // Plan item notes CRUD handlers
  const {
    handleAddNote: handleAddNoteToItem,
    handleUpdateNote: handleUpdateNoteOnItem,
    handleDeleteNote: handleDeleteNoteFromItem
  } = usePlanItemNotes({
    selectedPlanId,
    selectedDetailsItem,
    setSelectedDetailsItem,
    setSharedPlans,
    success,
    showError
  });

  // ============================================================================
  // MODAL WRAPPER FUNCTIONS (for child components expecting setter props)
  // ============================================================================

  // Wrapper functions to maintain backward compatibility with components that expect setters
  const handleOpenDatePicker = useCallback(() => openModal(MODAL_NAMES.DATE_PICKER), [openModal]);
  const handleCloseDatePicker = useCallback(() => closeModal(), [closeModal]);
  const handleOpenPlanDeleteModal = useCallback(() => openModal(MODAL_NAMES.DELETE_PLAN_ITEM), [openModal]);
  const handleClosePlanDeleteModal = useCallback(() => closeModal(), [closeModal]);
  const handleOpenPlanInstanceDeleteModal = useCallback(() => openModal(MODAL_NAMES.DELETE_PLAN_INSTANCE_ITEM), [openModal]);
  const handleClosePlanInstanceDeleteModal = useCallback(() => closeModal(), [closeModal]);
  const handleOpenDeleteExperienceModal = useCallback(() => openModal(MODAL_NAMES.DELETE_EXPERIENCE), [openModal]);
  const handleCloseDeleteExperienceModal = useCallback(() => closeModal(), [closeModal]);

  // ============================================================================
  // CALLBACK FUNCTIONS & EVENT HANDLERS
  // ============================================================================

  // OPTIMIZATION: Use combined fetch on initial load for 3x faster page load
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Reset component state when navigating to a different experience
  useEffect(() => {
    // Reset all experience-specific state
    setExperience(null);
    setUserPlan(null);
    setUserHasExperience(false);
    setUserPlannedDate(null);
    setDisplayedPlannedDate(null);
    setTravelTips([]);
    setSharedPlans([]);
    setSelectedPlanId(null);
    setPlansLoading(true);
    setActiveTab("experience");
    setExpandedParents(new Set());
    setHierarchyLoaded(false);
    // Reset sync state via hook
    resetSyncState();
    setFavHover(false);
    setPendingUnplan(false);
    setPlanBtnWidth(null);
    closeModal(); // Close any open modal
    setIsEditingDate(false);
    setPlannedDate("");
    setPlanItemToDelete(null);
    setPlanInstanceItemToDelete(null);
    setExperienceNotFound(false); // Reset 404 state
    // Reset tab loading states
    setExperienceTabLoading(true);
    // Reset hash refs so URL hash can be processed for new experience
    processedHashRef.current = null;
    initialHashHandledRef.current = false;
    userInteractionRef.current = false;
    // Collaborator state is now managed by useCollaboratorManager hook
    // Modal state managed by useModalManager hook
    setPlanItemFormState(1);
    setEditingPlanItem({});
  }, [experienceId, resetSyncState]);

  // Smooth loading transition for experience tab
  useEffect(() => {
    if (experience && experience.plan_items) {
      // Use requestAnimationFrame to ensure DOM has updated
      const timer = requestAnimationFrame(() => {
        setExperienceTabLoading(false);
      });
      return () => cancelAnimationFrame(timer);
    }
  }, [experience?.plan_items]);

  // Navigation Intent Consumer - handles deep-link navigation from HashLink and direct URL
  // Single source of truth for scroll/highlight behavior
  useEffect(() => {
    debug.log('[NavigationIntent] Effect running', {
      userInteractionInProgress: userInteractionRef.current,
      intentExists: !!intent,
      intentConsumed: intent?.consumed,
      plansLoading,
      sharedPlansCount: sharedPlans.length,
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
    if (plansLoading || sharedPlans.length === 0) {
      debug.log('[NavigationIntent] Plans still loading, waiting...', {
        plansLoading,
        sharedPlansCount: sharedPlans.length,
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
    const targetPlan = sharedPlans.find((p) => idEquals(p._id, targetPlanId));

    if (!targetPlan) {
      debug.warn('[NavigationIntent] Plan not found in sharedPlans:', {
        targetPlanId,
        availablePlans: sharedPlans.map(p => p._id?.toString())
      });
      // Clear the intent since it can't be fulfilled
      clearIntent();
      return;
    }

    // CONSUME the intent BEFORE side effects to prevent re-processing
    consumeIntent(intentId);

    const tid = normalizeId(targetPlan._id);

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

    // Scroll to item and open modal after tab switch (give React time to render)
    if (targetItemId) {
      debug.log('[NavigationIntent] Scheduling scroll to item:', { targetItemId, shouldAnimate });

      // Find the plan item to open in the modal
      const planItem = findById(targetPlan.plan, targetItemId);

      // Use requestAnimationFrame + setTimeout to ensure DOM is ready after React renders
      requestAnimationFrame(() => {
        setTimeout(async () => {
          try {
            const result = await scrollToItem(targetItemId, { shouldHighlight: shouldAnimate });
            debug.log('[NavigationIntent] scrollToItem result:', result ? 'found' : 'not found');

            // Open the details modal if we found the plan item
            if (planItem) {
              setSelectedDetailsItem(planItem);
              setDetailsModalInitialTab('notes');
              openModal(MODAL_NAMES.PLAN_ITEM_DETAILS);
            }
          } catch (err) {
            debug.log('[NavigationIntent] scrollToItem error:', err);
          }
        }, 100);
      });
    } else {
      debug.log('[NavigationIntent] No targetItemId, skipping scroll');
    }

  }, [intent, plansLoading, sharedPlans, consumeIntent, clearIntent, scrollToItem]);

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
    if (plansLoading || sharedPlans.length === 0) {
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

    const targetPlan = findById(sharedPlans, planId);
    if (!targetPlan) {
      debug.warn('[Fallback Hash] Plan not found:', planId);
      return;
    }

    const tid = normalizeId(targetPlan._id);

    // Mark this hash as processed and initial navigation as complete
    processedHashRef.current = hash;
    initialHashHandledRef.current = true;

    // Only change plan if needed
    const needsTabSwitch = selectedPlanId !== tid;
    if (needsTabSwitch) {
      setSelectedPlanId(tid);
      setActiveTab('myplan');
    }

    // For direct URL navigation, scroll to item and open details modal if present
    // If we switched tabs, wait for React to render the new content first
    if (itemId) {
      // Find the plan item to open in the modal
      const planItem = findById(targetPlan.plan, itemId);

      const openModalForItem = () => {
        scrollToItem(itemId, { shouldHighlight: true });
        // Open the details modal if we found the plan item
        if (planItem) {
          setSelectedDetailsItem(planItem);
          setDetailsModalInitialTab('notes');
          openModal(MODAL_NAMES.PLAN_ITEM_DETAILS);
        }
      };

      if (needsTabSwitch) {
        // Wait for React to render the plan items after tab switch
        // Using requestAnimationFrame + setTimeout ensures DOM is ready
        requestAnimationFrame(() => {
          setTimeout(openModalForItem, 100);
        });
      } else {
        // Already on correct tab, scroll immediately
        openModalForItem();
      }
    }
  }, [plansLoading, sharedPlans, selectedPlanId, intent, scrollToItem]);

  // Register h1 for navbar (action buttons removed - available in sticky sidebar)
  useEffect(() => {
    if (h1Ref.current) {
      registerH1(h1Ref.current);

      // Enable h1 text in navbar for this view
      updateShowH1InNavbar(true);
    }

    return () => {
      // Disable h1 in navbar when leaving this view
      updateShowH1InNavbar(false);
    };
  }, [
    registerH1,
    updateShowH1InNavbar,
    experience, // Re-register when experience loads (ensures h1Ref.current is populated)
  ]);

  // Keep selectedDetailsItem in sync with the latest plan data
  // This fixes the "Unknown User" issue when navigating - the plan data may be
  // initially loaded without populated notes.user, then updated by API with populated data
  // Also preserves populated user data if the source temporarily has unpopulated data
  useEffect(() => {
    // Only sync when modal is open and we have a selected item
    if (!isModalOpen(MODAL_NAMES.PLAN_ITEM_DETAILS) || !selectedDetailsItem?._id) return;

    // Find the current plan containing this item
    const currentPlanData = selectedPlanId
      ? sharedPlans.find(p => idEquals(p._id, selectedPlanId))
      : userPlan;

    if (!currentPlanData?.plan) return;

    // Find the updated item in the plan
    const updatedItem = currentPlanData.plan.find(item =>
      idEquals(item._id, selectedDetailsItem._id)
    );

    if (!updatedItem) return;

    // Check if the item data has meaningful differences (especially notes.user population)
    const sourceHasPopulatedNotes = updatedItem.details?.notes?.some(note =>
      note.user && typeof note.user === 'object' && note.user.name
    );
    const currentHasPopulatedNotes = selectedDetailsItem.details?.notes?.some(note =>
      note.user && typeof note.user === 'object' && note.user.name
    );
    const currentHasUnpopulatedNotes = selectedDetailsItem.details?.notes?.some(note =>
      note.user && (typeof note.user === 'string' || !note.user.name)
    );

    // Case 1: Source has populated data, current doesn't - sync from source
    if (sourceHasPopulatedNotes && currentHasUnpopulatedNotes) {
      debug.log('[SingleExperience] Syncing selectedDetailsItem with populated data from source', {
        itemId: selectedDetailsItem._id,
        currentHadUnpopulated: currentHasUnpopulatedNotes
      });
      setSelectedDetailsItem(updatedItem);
      return;
    }

    // Case 2: Current has populated data but source doesn't - preserve current's populated user data
    // This prevents "Unknown User" flash when source temporarily has unpopulated data
    if (currentHasPopulatedNotes && !sourceHasPopulatedNotes && updatedItem.details?.notes?.length > 0) {
      // Build a map of populated user data from current selectedDetailsItem
      const populatedUserMap = {};
      selectedDetailsItem.details?.notes?.forEach(note => {
        if (note.user && typeof note.user === 'object' && note.user.name) {
          const noteId = normalizeId(note._id);
          populatedUserMap[noteId] = note.user;
        }
      });

      // Only merge if we have populated users to preserve
      if (Object.keys(populatedUserMap).length > 0) {
        debug.log('[SingleExperience] Preserving populated user data in notes', {
          itemId: selectedDetailsItem._id,
          preservedUserCount: Object.keys(populatedUserMap).length
        });

        // Create merged item with preserved populated user data
        const mergedNotes = updatedItem.details.notes.map(note => {
          const noteId = normalizeId(note._id);
          const preservedUser = populatedUserMap[noteId];
          if (preservedUser && (!note.user?.name)) {
            return { ...note, user: preservedUser };
          }
          return note;
        });

        setSelectedDetailsItem({
          ...updatedItem,
          details: {
            ...updatedItem.details,
            notes: mergedNotes
          }
        });
        return;
      }
    }

    // Case 3: Both have populated data or neither has notes - sync other changes
    // Check for other meaningful changes (not related to notes.user population)
    const sourceNoteCount = updatedItem.details?.notes?.length || 0;
    const currentNoteCount = selectedDetailsItem.details?.notes?.length || 0;
    if (sourceNoteCount !== currentNoteCount) {
      // Note count changed (add/delete) - need to sync, preserving populated users
      const populatedUserMap = {};
      selectedDetailsItem.details?.notes?.forEach(note => {
        if (note.user && typeof note.user === 'object' && note.user.name) {
          const noteId = normalizeId(note._id);
          populatedUserMap[noteId] = note.user;
        }
      });

      const mergedNotes = updatedItem.details?.notes?.map(note => {
        const noteId = normalizeId(note._id);
        const preservedUser = populatedUserMap[noteId];
        if (preservedUser && (!note.user?.name)) {
          return { ...note, user: preservedUser };
        }
        return note;
      }) || [];

      setSelectedDetailsItem({
        ...updatedItem,
        details: {
          ...updatedItem.details,
          notes: mergedNotes
        }
      });
    }
  }, [isModalOpen, selectedDetailsItem?._id, selectedPlanId, sharedPlans, userPlan]);

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

  // Subscribe to WebSocket events for real-time shared plan updates
  // Replaces polling - events trigger immediate refresh when collaborators are added/removed
  useEffect(() => {
    if (!subscribeToEvents || !experienceId) return;

    const sessionId = window.sessionStorage.getItem('bien:session_id');

    // Handler for plan collaborator events
    const handleCollaboratorEvent = (event) => {
      // Skip events from this session (already handled locally)
      if (event.sessionId === sessionId) return;
      // Only handle events for this experience
      if (event.experienceId !== experienceId) return;

      logger.debug('[SingleExperience] Collaborator event received, refreshing shared plans', {
        action: event.action,
        planId: event.planId
      });
      fetchSharedPlans();
    };

    // Handler for plan creation/deletion (new plans become shared plans)
    const handlePlanEvent = (event) => {
      // Skip events from this session
      if (event.sessionId === sessionId) return;
      // Only handle events for this experience
      const eventExpId = event.experienceId || event.data?.experience;
      if (eventExpId !== experienceId) return;

      logger.debug('[SingleExperience] Plan event received, refreshing shared plans', {
        type: event.type,
        planId: event.planId
      });
      fetchSharedPlans();
    };

    // Handler for experience updates (collaborators changed, photos, etc.)
    // This ensures collaborator avatars update in real-time across all users/tabs
    const handleExperienceUpdated = (event) => {
      // Skip events from this session (already handled locally)
      if (event.sessionId === sessionId) return;

      // Extract experienceId from various event payload formats
      const eventExpId = event.experienceId || event.experience?._id ||
                         event.detail?.experienceId || event.detail?.experience?._id ||
                         event.payload?.experienceId || event.payload?.experience?._id;

      // Only handle events for this experience
      if (eventExpId !== experienceId) return;

      logger.debug('[SingleExperience] Experience updated event received, refreshing data', {
        experienceId: eventExpId,
        updatedFields: event.updatedFields || event.payload?.updatedFields
      });

      // Refresh all experience data including permissions/collaborators
      fetchAllData();
    };

    // Subscribe to relevant events
    const unsubCollaboratorAdded = subscribeToEvents('plan:collaborator:added', handleCollaboratorEvent);
    const unsubCollaboratorRemoved = subscribeToEvents('plan:collaborator:removed', handleCollaboratorEvent);
    const unsubPlanCreated = subscribeToEvents(WS_EVENTS.PLAN_CREATED, handlePlanEvent);
    const unsubPlanDeleted = subscribeToEvents(WS_EVENTS.PLAN_DELETED, handlePlanEvent);
    const unsubExperienceUpdated = subscribeToEvents(WS_EVENTS.EXPERIENCE_UPDATED, handleExperienceUpdated);

    return () => {
      unsubCollaboratorAdded();
      unsubCollaboratorRemoved();
      unsubPlanCreated();
      unsubPlanDeleted();
      unsubExperienceUpdated();
    };
  }, [subscribeToEvents, experienceId, fetchSharedPlans, fetchAllData]);

  // Subscribe to local event bus for plan item updates (photos, etc.)
  // This ensures that when PhotosTab saves photos, the local state is updated
  useEffect(() => {
    // Handler for plan item updates from local event bus
    const handlePlanItemUpdated = (event) => {
      const { planId, planItemId, planItem, updatedFields } = event;

      // Only handle events relevant to this experience's plans
      if (!planId) return;

      logger.debug('[SingleExperience] Plan item updated event received', {
        planId,
        planItemId,
        updatedFields,
        hasPhotos: planItem?.photos?.length > 0
      });

      // Update userPlan if it matches
      if (userPlan?._id === planId) {
        setUserPlan(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            plan: prev.plan.map(item =>
              idEquals(item._id, planItemId)
                ? { ...item, ...planItem }
                : item
            )
          };
        });
      }

      // Update sharedPlans if the plan is in there
      setSharedPlans(prev => prev.map(plan => {
        if (!idEquals(plan._id, planId)) return plan;
        return {
          ...plan,
          plan: plan.plan.map(item =>
            idEquals(item._id, planItemId)
              ? { ...item, ...planItem }
              : item
          )
        };
      }));

      // Update selectedDetailsItem if modal is open and showing this item
      if (isModalOpen(MODAL_NAMES.PLAN_ITEM_DETAILS) && selectedDetailsItem && idEquals(selectedDetailsItem._id, planItemId)) {
        setSelectedDetailsItem(prev => ({
          ...prev,
          ...planItem
        }));
      }
    };

    const unsubscribe = subscribeToEvent('plan:item:updated', handlePlanItemUpdated);
    return () => unsubscribe();
  }, [userPlan?._id, setUserPlan, setSharedPlans, isModalOpen, selectedDetailsItem, setSelectedDetailsItem]);

  // Sync tab changes to presence system
  useEffect(() => {
    if (setPresenceTab) {
      const presenceTabName = activeTab === 'myplan' ? 'my-plan' : 'the-plan';
      setPresenceTab(presenceTabName);
    }
  }, [activeTab, setPresenceTab]);

  /**
   * Load persisted hierarchy state from encrypted storage
   * 
   * Stores expansion state separately for:
   * - Experience plan items: hierarchy.experience.{experienceId}
   * - User plan items: hierarchy.plan.{planId}
   * 
   * Persists across hard refreshes using encrypted localStorage.
   * Defaults to all top-level items expanded if no saved state exists.
   */
  useEffect(() => {
    if (!user?._id) return;

    let isMounted = true;

    async function loadHierarchyState() {
      try {
        // Determine the storage key based on active tab and current context
        let storageKey;
        let defaultExpandedIds = [];

        if (activeTab === 'experience' && experience?._id && experience?.plan_items) {
          storageKey = `hierarchy.experience.${experience._id}`;
          // Default: all top-level items expanded
          defaultExpandedIds = experience.plan_items
            .filter((item) => !item.parent)
            .map((item) => getExpansionKey(item))
            .filter(Boolean);
        } else if (activeTab === 'myplan' && selectedPlanId && currentPlan?.plan) {
          storageKey = `hierarchy.plan.${selectedPlanId}`;
          // Default: all top-level items expanded
          defaultExpandedIds = currentPlan.plan
            .filter((item) => !item.parent)
            .map((item) => getExpansionKey(item))
            .filter(Boolean);
        }

        if (storageKey) {
          // Load persisted state or use defaults
          const persistedIds = await retrievePreference(storageKey, defaultExpandedIds, { userId: user._id });
          
          if (isMounted) {
            setExpandedParents(new Set(persistedIds));
            setHierarchyLoaded(true);
          }
        }
      } catch (error) {
        logger.error('Failed to load hierarchy state', error);
        if (isMounted) {
          // Fallback to default (all expanded)
          const defaultKeys = activeTab === 'experience' && experience?.plan_items
            ? experience.plan_items.filter((item) => !item.parent).map((item) => getExpansionKey(item)).filter(Boolean)
            : currentPlan?.plan?.filter((item) => !item.parent).map((item) => getExpansionKey(item)).filter(Boolean) || [];
          setExpandedParents(new Set(defaultKeys));
          setHierarchyLoaded(true);
        }
      }
    }

    loadHierarchyState();

    return () => {
      isMounted = false;
    };
  }, [activeTab, experience?._id, experience?.plan_items, selectedPlanId, currentPlan?.plan, user?._id, getExpansionKey]);

  const handleAddPlanInstanceItem = useCallback((parentId = null) => {
    setEditingPlanItem(parentId ? { parent: parentId } : {});
    setPlanItemFormState(1); // Add mode
    openModal(MODAL_NAMES.ADD_EDIT_PLAN_ITEM);
  }, [openModal]);

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
    openModal(MODAL_NAMES.ADD_EDIT_PLAN_ITEM);
  }, [openModal]);

  // Handler to open Details modal for a plan item
  // Updates URL hash to enable direct linking: #plan-{planId}-item-{itemId}
  const handleViewPlanItemDetails = useCallback((planItem, initialTab = 'notes') => {
    setSelectedDetailsItem(planItem);
    setDetailsModalInitialTab(initialTab);
    openModal(MODAL_NAMES.PLAN_ITEM_DETAILS);

    // Update URL hash for direct linking to this plan item
    if (selectedPlanId && planItem?._id) {
      const itemId = normalizeId(planItem._id);
      const hash = `#plan-${selectedPlanId}-item-${itemId}`;
      const newUrl = `${window.location.pathname}${window.location.search || ''}${hash}`;
      if (window.location.href !== newUrl) {
        window.history.pushState(null, '', newUrl);
      }
    }
  }, [selectedPlanId]);

  // Handler to open inline cost entry from plan item details modal
  const handleAddCostForItem = useCallback((planItem) => {
    setInlineCostPlanItem(planItem);
    openModal(MODAL_NAMES.INLINE_COST_ENTRY);
  }, [openModal]);

  // Handler to save inline cost entry
  const handleSaveInlineCost = useCallback(async (costData) => {
    if (!selectedPlanId || !inlineCostPlanItem) return;

    setInlineCostLoading(true);
    try {
      // Add cost with the plan item pre-filled
      const costWithPlanItem = {
        ...costData,
        plan_item: inlineCostPlanItem._id || inlineCostPlanItem.plan_item_id
      };
      await addCost(selectedPlanId, costWithPlanItem);

      // Close the modal
      closeModal();
      setInlineCostPlanItem(null);

      // Show success toast
      success(lang.current.notification?.cost?.added || 'Cost added successfully');
    } catch (error) {
      logger.error('Failed to add inline cost', { error: error.message });
      showError(error.message || lang.current.alert.failedToAddCost);
    } finally {
      setInlineCostLoading(false);
    }
  }, [selectedPlanId, inlineCostPlanItem, addCost, success, showError]);

  // Handler to add any type of detail to a plan item (from AddPlanItemDetailModal)
  const handleAddDetail = useCallback(async (payload) => {
    const { type, planItemId, planId: payloadPlanId, data, document } = payload;
    const planIdToUse = payloadPlanId || selectedPlanId;

    if (!planIdToUse || !planItemId) {
      showError('Missing plan or item information');
      return;
    }

    logger.info('[SingleExperience] Adding plan item detail', { type, planItemId, planId: planIdToUse });

    try {
      // For cost type, use the existing cost handler for backward compatibility
      if (type === 'cost') {
        const costData = {
          ...data,
          plan_item: planItemId
        };
        await addCost(planIdToUse, costData);
        success(lang.current.notification?.cost?.added || 'Cost added successfully');
        return;
      }

      // For other detail types, use the new addPlanItemDetail API
      const detailData = {
        type,
        data,
        document
      };

      const result = await addPlanItemDetail(planIdToUse, planItemId, detailData);

      // Update the shared plans state if result includes updated plan
      if (result?.plan) {
        setSharedPlans(prevPlans =>
          prevPlans.map(p => idEquals(p._id, planIdToUse) ? result.plan : p)
        );
      }

      // Update selected details item to reflect the new detail
      if (selectedDetailsItem && idEquals(selectedDetailsItem._id, planItemId) && result?.item) {
        setSelectedDetailsItem(result.item);
      }

      // Show success message based on type
      const typeLabels = {
        flight: 'Flight details',
        train: 'Train reservation',
        cruise: 'Cruise reservation',
        ferry: 'Ferry reservation',
        bus: 'Bus reservation',
        hotel: 'Hotel reservation',
        parking: 'Parking details',
        discount: 'Discount'
      };
      const label = typeLabels[type] || 'Detail';
      success(`${label} added successfully`);

    } catch (error) {
      logger.error('[SingleExperience] Failed to add plan item detail', {
        type,
        planItemId,
        error: error.message
      });
      showError(error.message || 'Failed to add detail');
      throw error; // Re-throw to let modal handle error state
    }
  }, [selectedPlanId, addCost, selectedDetailsItem, setSharedPlans, success, showError]);

  const handleSavePlanInstanceItem = useCallback(
    async (formData) => {
      if (!selectedPlanId) return;

      // formData is passed directly from modal's internal state
      const currentEditingPlanItem = formData;

      // Optimistic update for plan instance items
      const prevPlans = [...sharedPlans];
      const planIndex = sharedPlans.findIndex((p) => idEquals(p._id, selectedPlanId));
      const prevPlan = planIndex >= 0 ? { ...sharedPlans[planIndex], plan: [...sharedPlans[planIndex].plan] } : null;

      const isAdd = planItemFormState === 1;
      const tempId = `temp-${Date.now()}`;

      const apply = () => {
        if (!prevPlan || planIndex < 0) return;
        const updatedPlans = [...sharedPlans];
        const updatedPlan = { ...prevPlan, plan: [...prevPlan.plan] };
        if (isAdd) {
          updatedPlan.plan.push({
            _id: tempId,
            plan_item_id: currentEditingPlanItem.plan_item_id || tempId,
            text: currentEditingPlanItem.text || "",
            url: currentEditingPlanItem.url || "",
            cost: currentEditingPlanItem.cost || 0,
            planning_days: currentEditingPlanItem.planning_days || 0,
            parent: currentEditingPlanItem.parent || null,
            activity_type: currentEditingPlanItem.activity_type || null,
            location: currentEditingPlanItem.location || null,
            complete: false,
          });
        } else {
          const idx = findIndexById(updatedPlan.plan, currentEditingPlanItem._id);
          if (idx >= 0) {
            updatedPlan.plan[idx] = {
              ...updatedPlan.plan[idx],
              text: currentEditingPlanItem.text || "",
              url: currentEditingPlanItem.url || "",
              cost: currentEditingPlanItem.cost || 0,
              planning_days: currentEditingPlanItem.planning_days || 0,
              parent: currentEditingPlanItem.parent || null,
              activity_type: currentEditingPlanItem.activity_type || null,
              location: currentEditingPlanItem.location || null,
            };
          }
        }
        updatedPlans[planIndex] = updatedPlan;
        setSharedPlans(updatedPlans);
        closeModal();
        setEditingPlanItem({});
      };

      const apiCall = async () => {
        if (isAdd) {
          await addPlanItemToInstance(selectedPlanId, currentEditingPlanItem);
        } else {
          const { _id, plan_item_id, ...updates } = currentEditingPlanItem;
          await updatePlanItem(selectedPlanId, _id, updates);
        }
      };

      const rollback = () => {
        setSharedPlans(prevPlans);
        openModal(MODAL_NAMES.ADD_EDIT_PLAN_ITEM);
        setEditingPlanItem(isAdd ? (currentEditingPlanItem || {}) : currentEditingPlanItem);
      };

      const onSuccess = async () => {
        fetchSharedPlans().catch(() => {});
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
      planItemFormState,
      fetchSharedPlans,
      fetchUserPlan,
      sharedPlans,
      fetchPlans,
      showError,
    ]
  );

  const handlePlanInstanceItemDelete = useCallback(async () => {
    if (!selectedPlanId || !planInstanceItemToDelete) return;

    // Store the item to delete and previous state for rollback
    const itemToDelete = planInstanceItemToDelete;
    let prevPlansSnapshot = null;

    const apply = () => {
      // Use functional update to avoid stale closure issues
      setSharedPlans(prev => {
        // Capture snapshot for potential rollback
        prevPlansSnapshot = prev;
        const planIndex = findIndexById(prev, selectedPlanId);
        if (planIndex < 0) return prev;

        const updatedPlans = [...prev];
        const prevPlan = updatedPlans[planIndex];
        updatedPlans[planIndex] = {
          ...prevPlan,
          plan: filterOutById(prevPlan.plan, itemToDelete._id)
        };
        return updatedPlans;
      });
      closeModal();
      setPlanInstanceItemToDelete(null);
    };

    const apiCall = async () => {
      await deletePlanItemFromInstance(selectedPlanId, itemToDelete._id);
    };

    const rollback = () => {
      if (prevPlansSnapshot) {
        setSharedPlans(prevPlansSnapshot);
      }
    };

    const onSuccess = async () => {
      fetchSharedPlans().catch(() => {});
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
    fetchSharedPlans,
    fetchUserPlan,
    fetchPlans,
    showError,
  ]);

  // Experience Plan Item Modal Handlers
  const handleAddExperiencePlanItem = useCallback((parentId = null) => {
    setEditingPlanItem(parentId ? { parent: parentId } : {});
    setPlanItemFormState(1); // Add mode
    openModal(MODAL_NAMES.ADD_EDIT_PLAN_ITEM);
  }, [openModal]);

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
    openModal(MODAL_NAMES.ADD_EDIT_PLAN_ITEM);
  }, [openModal]);

  const handleSaveExperiencePlanItem = useCallback(
    async (formData) => {
      // formData is passed directly from modal's internal state
      const currentEditingPlanItem = formData;

      const isAdd = planItemFormState === 1;
      const prevExperience = experience ? { ...experience, plan_items: [...(experience.plan_items || [])] } : null;
      const tempId = `temp-${Date.now()}`;

      const apply = () => {
        if (!prevExperience) return;
        const updated = { ...prevExperience, plan_items: [...prevExperience.plan_items] };
        if (isAdd) {
          updated.plan_items.push({
            _id: tempId,
            text: currentEditingPlanItem.text,
            url: currentEditingPlanItem.url || "",
            cost_estimate: currentEditingPlanItem.cost || 0,
            planning_days: currentEditingPlanItem.planning_days || 0,
            parent: currentEditingPlanItem.parent || null,
            activity_type: currentEditingPlanItem.activity_type || null,
            location: currentEditingPlanItem.location || null,
          });
        } else {
          const idx = findIndexById(updated.plan_items, currentEditingPlanItem._id);
          if (idx >= 0) {
            updated.plan_items[idx] = {
              ...updated.plan_items[idx],
              text: currentEditingPlanItem.text,
              url: currentEditingPlanItem.url || "",
              cost_estimate: currentEditingPlanItem.cost || 0,
              planning_days: currentEditingPlanItem.planning_days || 0,
              parent: currentEditingPlanItem.parent || null,
              activity_type: currentEditingPlanItem.activity_type || null,
              location: currentEditingPlanItem.location || null,
            };
          }
        }
        setExperience(updated);
        closeModal();
        setEditingPlanItem({});
      };

      const apiCall = async () => {
        if (isAdd) {
          await addExperiencePlanItem(experience._id, {
            text: currentEditingPlanItem.text,
            url: currentEditingPlanItem.url,
            cost_estimate: currentEditingPlanItem.cost || 0,
            planning_days: currentEditingPlanItem.planning_days || 0,
            parent: currentEditingPlanItem.parent || null,
            activity_type: currentEditingPlanItem.activity_type || null,
            location: currentEditingPlanItem.location || null,
          });
        } else {
          await updateExperiencePlanItem(experience._id, {
            _id: currentEditingPlanItem._id,
            text: currentEditingPlanItem.text,
            url: currentEditingPlanItem.url,
            cost_estimate: currentEditingPlanItem.cost || 0,
            planning_days: currentEditingPlanItem.planning_days || 0,
            parent: currentEditingPlanItem.parent || null,
            activity_type: currentEditingPlanItem.activity_type || null,
            location: currentEditingPlanItem.location || null,
          });
        }
      };

      const rollback = () => {
        if (prevExperience) setExperience(prevExperience);
        openModal(MODAL_NAMES.ADD_EDIT_PLAN_ITEM);
        setEditingPlanItem(isAdd ? (currentEditingPlanItem || {}) : currentEditingPlanItem);
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
    [experience, planItemFormState, fetchAllData]
  );

  const handlePlanChange = useCallback(
    (planId) => {
      const pid = planId && planId.toString ? planId.toString() : planId;
      setSelectedPlanId(pid);

      // Update displayed planned date to the selected plan's date
      const selectedPlan = sharedPlans.find((p) => idEquals(p._id, pid));
      if (selectedPlan) {
        setDisplayedPlannedDate(selectedPlan.planned_date || null);
      }
    },
    [sharedPlans]
  );

  // Auto-select first plan when plans load (if no hash navigation)
  // NOTE: This only pre-selects a plan for the dropdown, it does NOT switch tabs.
  // The experience tab ("The Plan") remains the default. Only hash navigation switches to "myplan" tab.
  useEffect(() => {
    // Only auto-select if:
    // 1. Plans have loaded
    // 2. There are plans available
    // 3. No plan is currently selected
    // 4. Not waiting for intent-based navigation (pending intent or hash in URL)
    const hasPendingIntent = intent && !intent.consumed;
    if (!plansLoading && sharedPlans.length > 0 && !selectedPlanId && !hasPendingIntent) {
      // Check if there's a hash in the URL - if so, let hash navigation handle it
      const hash = window.location.hash || '';
      if (hash.startsWith('#plan-')) {
        debug.log('[Auto-select] Hash present in URL, skipping auto-select');
        return;
      }

      // Auto-select the first plan (user's own plan is always first due to sorting)
      // This pre-selects a plan for the dropdown but does NOT switch to the My Plan tab
      const firstPlan = sharedPlans[0];
      const firstPlanId = firstPlan._id && firstPlan._id.toString ? firstPlan._id.toString() : firstPlan._id;

      debug.log('[Auto-select] Auto-selecting first plan (staying on Experience tab):', {
        planId: firstPlanId,
        isOwnPlan: idEquals(firstPlan.user?._id || firstPlan.user, user._id)
      });

      setSelectedPlanId(firstPlanId);
      // Do NOT switch to myplan tab - stay on experience tab
      // Only hash navigation (#plan-xxx) should trigger tab switch
      handlePlanChange(firstPlanId);
    }
  }, [plansLoading, sharedPlans, selectedPlanId, intent, user._id, handlePlanChange]);

  // Collaborator handlers now provided by useCollaboratorManager hook

  // Memoized dollarSigns function for cost display
  const dollarSigns = useCallback((n) => {
    return "$".repeat(n);
  }, []);

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
        closeModal();
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
            success(lang.current.notification?.plan?.created || "You're planning this experience!");
          } catch (e) {
            // ignore toast failures
          }

          // Navigate to the newly created plan
          if (newPlan?._id) {
            // Set the selected plan and switch to My Plan tab
            setSelectedPlanId(newPlan._id);
            setActiveTab("myplan");

            // Navigate with hash to enable deep linking to the new plan
            navigate(`/experiences/${experience._id}#plan-${newPlan._id}`, { replace: true });
          } else {
            // Fallback: just switch to My Plan tab
            setActiveTab("myplan");
          }
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
      showError,
      navigate
    ]
  );

  const handlePlanDelete = useCallback(
    async (planItemId) => {
      if (!experience || !planItemId) return;
      const prevExperience = { ...experience, plan_items: [...(experience.plan_items || [])] };

      const apply = () => {
        const updated = { ...prevExperience, plan_items: filterOutById(prevExperience.plan_items, planItemId) };
        setExperience(updated);
        closeModal();
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
      const prevPlans = sharedPlans;

      // 1. Optimistic update - only change the complete property of this specific item
      setSharedPlans(plans =>
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
        setSharedPlans(prevPlans);
        const errorMsg = handleError(err, { context: "Toggle plan item completion" }) || "Failed to update item. Please try again.";
        showError(errorMsg);
      } finally {
        userInteractionRef.current = false;
      }
    },
    [selectedPlanId, sharedPlans, setSharedPlans, showError]
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

      // Optimistic update to sharedPlans state
      const prevPlans = [...sharedPlans];
      const planIndex = sharedPlans.findIndex((p) => idEquals(p._id, planId));
      const prevPlan = planIndex >= 0 ? { ...sharedPlans[planIndex] } : null;

      const apply = () => {
        if (!prevPlan || planIndex < 0) return;
        const updatedPlans = [...sharedPlans];
        updatedPlans[planIndex] = { ...prevPlan, plan: reorderedItems };
        setSharedPlans(updatedPlans);
      };

      const apiCall = async () => {
        await reorderPlanItems(planId, reorderedItems);
      };

      const rollback = () => {
        setSharedPlans(prevPlans);
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
        fetchSharedPlans().catch(() => {});
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
      sharedPlans,
      fetchSharedPlans,
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

  // Date management hook - consolidates date editing logic
  // Note: isEditingDate and setIsEditingDate are defined at top-level and passed in
  // to avoid circular dependency with useExperienceActions and handleAddExperience
  const {
    plannedDateRef,
    handleDateUpdate
  } = useDateManagement({
    user,
    experience,
    userPlan,
    userHasExperience,
    activeTab,
    selectedPlanId,
    sharedPlans,
    plannedDate,
    setPlannedDate,
    userPlannedDate,
    displayedPlannedDate,
    setDisplayedPlannedDate,
    updatePlan,
    handleAddExperience,
    fetchUserPlan,
    fetchSharedPlans,
    fetchPlans,
    fetchAllData,
    setLoading,
    closeModal: () => closeModal(),
    showError,
    idEquals,
    // Pass in state from parent to avoid circular dependency
    isEditingDateState: isEditingDate,
    setIsEditingDateState: setIsEditingDate
  });

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
                ? `, ${experience.destination.name}${experience.destination.country ? `, ${experience.destination.country}` : ''}`
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
      {experience && !plansLoading ? (
        <div className={styles.experienceDetailContainer}>
          <Container>
            {/* Breadcrumb Navigation */}
            <nav className={styles.breadcrumbNav} aria-label="breadcrumb">
              <Breadcrumb>
                <Breadcrumb.Item linkAs={Link} linkProps={{ to: "/" }}>
                  <FaHome size={12} style={{ marginRight: '4px' }} />
                  Home
                </Breadcrumb.Item>
                {experience.destination && experience.destination.name && (
                  <Breadcrumb.Item
                    linkAs={Link}
                    linkProps={{ to: `/destinations/${experience.destination._id}` }}
                  >
                    {experience.destination.name}
                  </Breadcrumb.Item>
                )}
                <Breadcrumb.Item active>
                  {experience.name}
                </Breadcrumb.Item>
              </Breadcrumb>
            </nav>

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
                  {/* Hero photo viewer button - opens upload modal when no photos and user can edit */}
                  <button
                    type="button"
                    className={styles.heroPhotoButton}
                    onClick={() => {
                      // Check if there are no photos on the experience itself
                      const hasExperiencePhotos = experience.photos && experience.photos.length > 0;
                      // Check if user can edit (owner or collaborator)
                      const canEdit = experience.permissions?.some(p =>
                        p.entity === 'user' &&
                        (p.type === 'owner' || p.type === 'collaborator') &&
                        idEquals(p._id, user?._id)
                      );

                      if (!hasExperiencePhotos && canEdit) {
                        // No photos on experience and user can edit - open upload modal
                        openModal(MODAL_NAMES.PHOTO_UPLOAD);
                      } else {
                        // Has photos or user can't edit - open photo viewer
                        setPhotoViewerIndex(0);
                        openModal(MODAL_NAMES.PHOTO_VIEWER);
                      }
                    }}
                    aria-label={heroPhotos.length > 0 ? `View ${heroPhotos.length} photo${heroPhotos.length !== 1 ? 's' : ''}` : "Add photos"}
                  >
                    <FaRegImage />
                    {heroPhotos.length > 0 && (
                      <span className={styles.photoCount}>{heroPhotos.length}</span>
                    )}
                  </button>
                </div>

                {/* Tags Section */}
                {(experience.experience_type || experience.destination || isExperienceArchived(experience) || (experienceOwner && !isArchiveUser(experienceOwner) && hasFeatureFlag(experienceOwner, 'curator'))) && (
                  <div className={styles.tagsSection}>
                    {/* Curated Experience Tag with tooltip - shown when owner has curator flag and is not archived */}
                    {experienceOwner && !isArchiveUser(experienceOwner) && hasFeatureFlag(experienceOwner, 'curator') && (
                      <Tooltip
                        content={
                          <div className={styles.curatorTooltipContent}>
                            <div className={styles.curatorTooltipHeader}>
                              <FaStar size={14} />
                              <span className={styles.curatorTooltipName}>
                                {experienceOwner.name || 'Curator'}
                              </span>
                            </div>
                            {experienceOwner.bio && (
                              <p className={styles.curatorTooltipBio}>
                                {experienceOwner.bio.length > 150
                                  ? `${experienceOwner.bio.substring(0, 150)}...`
                                  : experienceOwner.bio}
                              </p>
                            )}
                            <p className={styles.curatorTooltipCta}>
                              Tap again to view profile
                            </p>
                          </div>
                        }
                        placement="bottom"
                        trigger={['click']}
                        rootClose
                        show={curatorTooltipVisible}
                        onToggle={(nextShow) => {
                          if (curatorTooltipVisible && !nextShow) {
                            // Tooltip was visible and user clicked again - navigate to profile
                            navigate(`/profile/${experienceOwner._id}`);
                            setCuratorTooltipVisible(false);
                          } else {
                            setCuratorTooltipVisible(nextShow);
                          }
                        }}
                      >
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label={`Curated by ${experienceOwner.name || 'Curator'}. Click for more info.`}
                          style={{ textDecoration: 'none', cursor: 'pointer' }}
                        >
                          <Badge
                            bg="secondary"
                            className={styles.tag}
                            style={{
                              background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary, #6366f1) 100%)',
                              color: 'white'
                            }}
                          >
                            Curated Experience
                          </Badge>
                        </span>
                      </Tooltip>
                    )}
                    {/* Archived badge - shown when experience is owned by Archive User */}
                    {isExperienceArchived(experience) && (
                      <Badge
                        bg="secondary"
                        className={styles.tag}
                        style={{
                          background: 'var(--color-text-muted)',
                          color: 'white'
                        }}
                      >
                        Archived
                      </Badge>
                    )}
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
                    {experience.destination && experience.destination.country && (
                      <Link to={`/countries/${createUrlSlug(experience.destination.country)}`} style={{ textDecoration: 'none' }}>
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
                  {experience.destination && experience.destination.name && (
                    <p className={styles.locationText}>
                      <FaMapMarkerAlt />
                      <Link to={`/destinations/${experience.destination._id}`}>
                        {experience.destination.name}{experience.destination.country ? `, ${experience.destination.country}` : ''}
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
                      sharedPlans={sharedPlans}
                      plansLoading={plansLoading}
                      selectedPlanId={selectedPlanId}
                      setSelectedPlanId={setSelectedPlanId}
                      handlePlanChange={handlePlanChange}
                    />

                    {/* Experience Plan Items Tab Content */}
                    {activeTab === "experience" && (
                      experienceTabLoading ? (
                        <div className="experience-plan-view mt-4">
                          {/* Skeleton for collaborators */}
                          <div className="plan-header-row mb-4">
                            <UsersListDisplay
                              loading={true}
                              owner={null}
                              users={[]}
                              messageKey="CreatingPlan"
                              reserveSpace={true}
                            />
                            {/* Action button skeleton */}
                            <div className="d-flex justify-content-end">
                              <SkeletonLoader variant="rectangle" width="120px" height="40px" />
                            </div>
                          </div>
                          {/* Skeleton for plan items */}
                          <div className="plan-items-skeleton mt-4">
                            {[1, 2, 3].map((i) => (
                              <div key={i} className="plan-item-card mb-3 p-3 p-md-4">
                                <div className="d-flex gap-3 mb-3">
                                  <SkeletonLoader variant="circle" width={24} height={24} />
                                  <SkeletonLoader variant="text" width="70%" height={20} />
                                </div>
                                <SkeletonLoader variant="text" lines={2} height={16} />
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (experience.plan_items && experience.plan_items.length > 0) ? (
                        <ExperienceTabContent
                          user={user}
                          experience={experience}
                          experienceOwner={experienceOwner}
                          experienceCollaborators={experienceCollaborators}
                          experienceOwnerLoading={experienceOwnerLoading}
                          experienceCollaboratorsLoading={experienceCollaboratorsLoading}
                          expandedParents={expandedParents}
                          animatingCollapse={animatingCollapse}
                          getExpansionKey={getExpansionKey}
                          isItemExpanded={isItemExpanded}
                          handleAddExperiencePlanItem={handleAddExperiencePlanItem}
                          handleEditExperiencePlanItem={handleEditExperiencePlanItem}
                          openCollaboratorModal={collaboratorManager.openCollaboratorModal}
                          toggleExpanded={toggleExpanded}
                          setPlanItemToDelete={setPlanItemToDelete}
                          setShowPlanDeleteModal={handleOpenPlanDeleteModal}
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
                        sharedPlans={sharedPlans}
                        setSharedPlans={setSharedPlans}
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
                        getExpansionKey={getExpansionKey}
                        isItemExpanded={isItemExpanded}
                        displayedPlannedDate={displayedPlannedDate}
                        setIsEditingDate={setIsEditingDate}
                        setPlannedDate={setPlannedDate}
                        setShowDatePicker={handleCloseDatePicker}
                        plannedDateRef={plannedDateRef}
                        handleSyncPlan={handleSyncPlan}
                        handleAddPlanInstanceItem={handleAddPlanInstanceItem}
                        handleEditPlanInstanceItem={handleEditPlanInstanceItem}
                        handleViewPlanItemDetails={handleViewPlanItemDetails}
                        openCollaboratorModal={collaboratorManager.openCollaboratorModal}
                        toggleExpanded={toggleExpanded}
                        setPlanInstanceItemToDelete={setPlanInstanceItemToDelete}
                        setShowPlanInstanceDeleteModal={handleOpenPlanInstanceDeleteModal}
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
                        title={lang.current.modal.noPlansFallback}
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
                        showDatePicker={isModalOpen(MODAL_NAMES.DATE_PICKER)}
                        experience={experience}
                        isEditingDate={isEditingDate}
                        plannedDate={plannedDate}
                        setPlannedDate={setPlannedDate}
                        loading={loading}
                        handleDateUpdate={handleDateUpdate}
                        handleAddExperience={handleAddExperience}
                        setShowDatePicker={handleCloseDatePicker}
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
                          setShowDeleteModal={handleOpenDeleteExperienceModal}
                          showDatePicker={isModalOpen(MODAL_NAMES.DATE_PICKER)}
                          setShowDatePicker={handleCloseDatePicker}
                          setIsEditingDate={setIsEditingDate}
                          setPlannedDate={setPlannedDate}
                          lang={lang}
                          variant="sidebar"
                          activeTab={activeTab}
                          onShare={handleShareExperience}
                        />
                      </div>
                  </div>
                </div>
              </Col>
            </Row>
          </Container>
        </div>
      ) : experienceNotFound ? (
        <EntityNotFound
          entityType="experience"
          size="lg"
        />
      ) : (
        <SingleExperienceSkeleton />
      )}
      {isModalOpen(MODAL_NAMES.PHOTO_VIEWER) && (
        <PhotoModal
          photos={heroPhotos}
          initialIndex={photoViewerIndex}
          onClose={closeModal}
        />
      )}
      <TransferOwnershipModal
        show={isModalOpen(MODAL_NAMES.DELETE_EXPERIENCE)}
        onClose={closeModal}
        experience={experience}
        onSuccess={() => {
          navigate('/experiences');
        }}
      />
      <ConfirmModal
        show={isModalOpen(MODAL_NAMES.REMOVE_PLAN)}
        onClose={closeModal}
        onConfirm={confirmRemoveExperience}
        title={lang.current.modal.removeExperienceFromPlans}
        message={lang.current.modal.removeExperienceMessage}
        itemName={experience?.name}
        additionalInfo={[
          "Your plan progress",
          "Completed items",
          "Personal notes"
        ]}
        warningText="Your progress will be permanently deleted!"
        confirmText={lang.current.modal.removeExperienceConfirmButton}
        confirmVariant="danger"
      />
      <ConfirmModal
        show={isModalOpen(MODAL_NAMES.DELETE_PLAN_ITEM)}
        onClose={closeModal}
        onConfirm={() => handlePlanDelete(planItemToDelete)}
        title={lang.current.modal.confirmDeletePlanItemTitle}
        message="You are about to delete this plan item"
        itemName={planItemToDelete?.text}
        confirmText="Delete Permanently"
        confirmVariant="danger"
      />
      <ConfirmModal
        show={isModalOpen(MODAL_NAMES.DELETE_PLAN_INSTANCE_ITEM)}
        onClose={() => {
          closeModal();
          setPlanInstanceItemToDelete(null);
        }}
        onConfirm={handlePlanInstanceItemDelete}
        title={lang.current.modal.confirmDeletePlanItemTitle}
        message="You are about to delete this plan item"
        itemName={planInstanceItemToDelete?.text}
        confirmText="Delete Permanently"
        confirmVariant="danger"
      />

      {/* Add Collaborator Modal */}
      <CollaboratorModal
        show={collaboratorManager.showCollaboratorModal}
        onHide={collaboratorManager.closeCollaboratorModal}
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
        onHide={closeSyncModal}
        syncChanges={syncChanges}
        selectedSyncItems={selectedSyncItems}
        setSelectedSyncItems={setSelectedSyncItems}
        onConfirmSync={confirmSyncPlan}
        loading={syncLoading}
        lang={lang}
      />
      {/* Plan Instance Item Modal */}
      <PlanItemModal
        show={isModalOpen(MODAL_NAMES.ADD_EDIT_PLAN_ITEM)}
        onHide={() => {
          closeModal();
          setEditingPlanItem({});
        }}
        initialData={editingPlanItem}
        mode={planItemFormState === 1 ? 'add' : 'edit'}
        onSave={activeTab === "experience" ? handleSaveExperiencePlanItem : handleSavePlanInstanceItem}
        loading={loading}
        langStrings={lang}
      />

      {/* Plan Item Details Modal */}
      <PlanItemDetailsModal
        show={isModalOpen(MODAL_NAMES.PLAN_ITEM_DETAILS)}
        onClose={() => {
          closeModal();
          setSelectedDetailsItem(null);
          setDetailsModalInitialTab('notes');

          // Remove item portion from URL hash, keeping only the plan hash
          const currentHash = window.location.hash || '';
          if (currentHash.includes('-item-')) {
            const planHash = currentHash.split('-item-')[0]; // Keep #plan-{planId}
            const newUrl = `${window.location.pathname}${window.location.search || ''}${planHash}`;
            window.history.pushState(null, '', newUrl);
          }
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

            // Update sharedPlans if it's in there
            setSharedPlans(prev => updatePlanItemAssignment(prev, selectedPlan._id, selectedDetailsItem._id, userId));

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

            setSharedPlans(prev => prev.map(plan => {
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

            setSharedPlans(prev => prev.map(plan => {
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

            setSharedPlans(prev => prev.map(plan => {
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
        onUpdateTitle={async (newTitle) => {
          if (!selectedPlan || !selectedDetailsItem) return;

          // Store previous state for rollback
          const previousText = selectedDetailsItem.text;

          try {
            // Optimistic update: Update local state immediately
            if (userPlan?._id === selectedPlan._id) {
              setUserPlan(prev => prev ? {
                ...prev,
                plan: prev.plan.map(item =>
                  item._id === selectedDetailsItem._id
                    ? { ...item, text: newTitle }
                    : item
                )
              } : prev);
            }

            setSharedPlans(prev => prev.map(plan => {
              if (plan._id === selectedPlan._id) {
                return {
                  ...plan,
                  plan: plan.plan.map(item => {
                    if (item._id === selectedDetailsItem._id) {
                      return { ...item, text: newTitle };
                    }
                    return item;
                  })
                };
              }
              return plan;
            }));

            // Update selectedDetailsItem for the modal
            setSelectedDetailsItem(prev => prev ? { ...prev, text: newTitle } : prev);

            // Call API
            await updatePlanItem(selectedPlan._id, selectedDetailsItem._id, { text: newTitle });

            // Show success toast
            success('Plan item title updated', { duration: 2000 });

          } catch (error) {
            logger.error('Error updating plan item title', { error: error.message });

            // Rollback optimistic update on error
            if (userPlan?._id === selectedPlan._id) {
              setUserPlan(prev => prev ? {
                ...prev,
                plan: prev.plan.map(item =>
                  item._id === selectedDetailsItem._id
                    ? { ...item, text: previousText }
                    : item
                )
              } : prev);
            }

            setSharedPlans(prev => prev.map(plan => {
              if (plan._id === selectedPlan._id) {
                return {
                  ...plan,
                  plan: plan.plan.map(item => {
                    if (item._id === selectedDetailsItem._id) {
                      return { ...item, text: previousText };
                    }
                    return item;
                  })
                };
              }
              return plan;
            }));

            // Rollback selectedDetailsItem for the modal
            setSelectedDetailsItem(prev => prev ? { ...prev, text: previousText } : prev);

            showError(error.message || 'Failed to update plan item title');
            throw error; // Re-throw so the modal can revert
          }
        }}
        canEdit={selectedPlan ? canEditPlan(user, selectedPlan) : false}
        displayCurrency={user?.preferences?.currency}
        onToggleComplete={async (planItem) => {
          if (!selectedPlan || !planItem) return;

          // Call the existing toggle handler
          await handlePlanItemToggleComplete(planItem);

          // Update the selectedDetailsItem to reflect new completion state
          setSelectedDetailsItem(prev => prev ? { ...prev, complete: !prev.complete } : prev);
        }}
        availableEntities={availableEntities}
        entityData={entityData}
        onPlanItemClick={(itemId, entity) => {
          // When a plan-item deep link is clicked in notes:
          // Modal is already closed by PlanItemDetailsModal before this fires
          // Scroll immediately to the plan item and highlight it
          logger.debug('[SingleExperience] Plan item click from notes', { itemId, entity });
          attemptScrollToItem(itemId, { shouldHighlight: true, anticipationDelay: 0 });
        }}
        onAddCostForItem={handleAddCostForItem}
        onAddDetail={handleAddDetail}
        onShare={handleSharePlanItem}
        presenceConnected={presenceConnected}
        planMembers={planMembers}
        experienceName={experience?.name || ''}
      />

      {/* Inline Cost Entry Modal - for adding costs from plan item details */}
      <CostEntry
        show={isModalOpen(MODAL_NAMES.INLINE_COST_ENTRY)}
        onHide={() => {
          closeModal();
          setInlineCostPlanItem(null);
        }}
        editingCost={inlineCostPlanItem ? { plan_item: inlineCostPlanItem._id || inlineCostPlanItem.plan_item_id } : null}
        collaborators={allPlanCollaborators}
        planItems={selectedPlan?.plan || []}
        onSave={handleSaveInlineCost}
        loading={inlineCostLoading}
      />

      {/* Photo Upload Modal - for adding photos when experience has none */}
      <PhotoUploadModal
        show={isModalOpen(MODAL_NAMES.PHOTO_UPLOAD)}
        onClose={closeModal}
        entityType="experience"
        entity={experience}
        photos={experience?.photos_full || experience?.photos || []}
        onSave={async (data) => {
          try {
            // Extract photo IDs for API
            const photoIds = Array.isArray(data.photos)
              ? data.photos.map(p => (typeof p === 'object' ? p._id : p))
              : [];

            // Update experience with new photos
            const updated = await updateExperience(experience._id, {
              photos: photoIds,
              default_photo_id: data.default_photo_id
            });

            // Update local experience state
            // Use photos_full (full objects with URLs) for immediate display,
            // falling back to updated.photos (IDs) if photos_full isn't available
            if (updated) {
              const fullPhotos = data.photos_full || [];
              setExperience(prev => ({
                ...prev,
                // Use full photo objects for display (they have .url)
                photos: fullPhotos.length > 0 ? fullPhotos : (updated.photos || photoIds),
                photos_full: fullPhotos,
                default_photo_id: data.default_photo_id || updated.default_photo_id
              }));

              // Update in context if available
              if (updateExperienceInContext) {
                updateExperienceInContext(updated);
              }

              success(lang.current.success.photosUpdated);
            }
          } catch (err) {
            logger.error('[SingleExperience] Failed to save photos', { error: err.message });
            showError(err.message || 'Failed to save photos');
            throw err; // Re-throw to let modal handle error state
          }
        }}
      />
    </>
  );
}
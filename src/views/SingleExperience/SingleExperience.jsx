import TagPill from '../../components/Pill/TagPill';
import ExperienceTitleSection from './components/ExperienceTitleSection';
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
import "./SingleExperience.css";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { flushSync } from "react-dom";
import { lang } from "../../lang.constants";
import { useParams, Link, useNavigate } from "react-router-dom";
import { FaUserPlus, FaTimes, FaUser } from "react-icons/fa";
import { BsPlusCircle, BsPersonPlus, BsCheckCircleFill } from "react-icons/bs";
import { useUser } from "../../contexts/UserContext";
import { useData } from "../../contexts/DataContext";
import { useApp } from "../../contexts/AppContext";
import { useToast } from "../../contexts/ToastContext";
import { useCollaboratorUsers } from "../../hooks/useCollaboratorUsers";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal";
import PageOpenGraph from "../../components/OpenGraph/PageOpenGraph";
import PhotoCard from "../../components/PhotoCard/PhotoCard";
import UsersListDisplay from "../../components/UsersListDisplay/UsersListDisplay";
import InfoCard from "../../components/InfoCard/InfoCard";
import Alert from "../../components/Alert/Alert";
import GoogleMap from "../../components/GoogleMap/GoogleMap";
import { Button, Container, FadeIn, FormLabel, FormControl, FormCheck, Text } from "../../components/design-system";
import Loading from "../../components/Loading/Loading";
import SkeletonLoader from "../../components/SkeletonLoader/SkeletonLoader";
import debug from "../../utilities/debug";
import { logger } from "../../utilities/logger";
import { createUrlSlug } from "../../utilities/url-utils";
import { handleStoredHash, restoreHashToUrl, clearStoredHash } from "../../utilities/hash-navigation";
import { escapeSelector, highlightPlanItem, attemptScrollToItem } from "../../utilities/scroll-utils";
import {
  formatDateShort,
  formatDateForInput,
  formatDateMetricCard,
  getMinimumPlanningDate,
  isValidPlannedDate,
} from "../../utilities/date-utils";
import { handleError } from "../../utilities/error-handler";
import { createExpirableStorage, getCookieValue, setCookieValue } from "../../utilities/cookie-utils";
import { formatCurrency } from "../../utilities/currency-utils";
import { isOwner, canEditPlan } from "../../utilities/permissions";
import useOptimisticAction from "../../hooks/useOptimisticAction";
import usePlanManagement from "../../hooks/usePlanManagement";
import {
  showExperience,
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
  createPlan,
  deletePlan,
  getExperiencePlans,
  updatePlan,
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

export default function SingleExperience() {
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
    createPlan: createPlanViaHook,
    updatePlan: updatePlanViaHook,
    deletePlan: deletePlanViaHook
  } = usePlanManagement(experienceId, user?._id);

  const [experience, setExperience] = useState(null);
  const [travelTips, setTravelTips] = useState([]);
  const [favHover, setFavHover] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hoveredPlanItem, setHoveredPlanItem] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [expandedParents, setExpandedParents] = useState(new Set());
  const [animatingCollapse, setAnimatingCollapse] = useState(null);
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [showPlanDeleteModal, setShowPlanDeleteModal] = useState(false);
  const [planItemToDelete, setPlanItemToDelete] = useState(null);
  const [showPlanInstanceDeleteModal, setShowPlanInstanceDeleteModal] =
    useState(false);
  const [planInstanceItemToDelete, setPlanInstanceItemToDelete] =
    useState(null);
  // Hide planned date immediately when user clicks Remove (before confirm)
  const [pendingUnplan, setPendingUnplan] = useState(false);
  const [activeTab, setActiveTab] = useState("experience"); // "experience" or "myplan"
  const planButtonRef = useRef(null);
  const [planBtnWidth, setPlanBtnWidth] = useState(null);
  const [hashSelecting, setHashSelecting] = useState(false);
  const [showSyncButton, setShowSyncButton] = useState(false);
  const [showSyncAlert, setShowSyncAlert] = useState(true); // Separate state for alert visibility
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncChanges, setSyncChanges] = useState(null);
  const [selectedSyncItems, setSelectedSyncItems] = useState({
    added: [],
    removed: [],
    modified: [],
  });
  const [showCollaboratorModal, setShowCollaboratorModal] = useState(false);
  const [collaboratorContext, setCollaboratorContext] = useState("plan"); // 'plan' or 'experience'
  const [collaboratorSearch, setCollaboratorSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedCollaborators, setSelectedCollaborators] = useState([]); // Multiple selected collaborators
  const [existingCollaborators, setExistingCollaborators] = useState([]); // Existing collaborators when modal opens
  const [removedCollaborators, setRemovedCollaborators] = useState([]); // Collaborators marked for removal
  const [collaboratorAddSuccess, setCollaboratorAddSuccess] = useState(false);
  const [addedCollaborators, setAddedCollaborators] = useState([]); // Track multiple additions
  const [actuallyRemovedCollaborators, setActuallyRemovedCollaborators] =
    useState([]); // Track actually removed for success message
  const [showEmailInviteForm, setShowEmailInviteForm] = useState(false); // Toggle email invite form
  const [emailInviteData, setEmailInviteData] = useState({
    email: "",
    name: "",
  }); // Email invite form data
  const [emailInviteSending, setEmailInviteSending] = useState(false); // Email sending state
  const [emailInviteError, setEmailInviteError] = useState(""); // Email invite errors
  const [showPlanItemModal, setShowPlanItemModal] = useState(false);
  const [planItemFormState, setPlanItemFormState] = useState(1); // 1 = add, 0 = edit
  const [editingPlanItem, setEditingPlanItem] = useState({});
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedDetailsItem, setSelectedDetailsItem] = useState(null);
  const [detailsModalInitialTab, setDetailsModalInitialTab] = useState('notes');

  // Ref for dynamic font sizing on planned date metric
  const plannedDateRef = useRef(null);

  // Version-based reconciliation (via event-bus.js) replaces timeout-based suppression
  // Events now carry version numbers and reconcileState() automatically handles
  // optimistic ID replacement and stale event rejection

  // Ref for h1 element to ensure proper registration
  const h1Ref = useRef(null);

  // Ref to track if component is unmounting to prevent navigation interference
  const isUnmountingRef = useRef(false);

  // Track hashes that we've already handled (so we don't re-run the
  // shake/highlight when the user is already on the page and the URL
  // contains the plan/item fragment).
  const handledHashesRef = useRef(new Set());

  // Set unmounting flag when component unmounts
  useEffect(() => {
    return () => {
      isUnmountingRef.current = true;
    };
  }, []);

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
  useEffect(() => {
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

        try {
          // Dedupe: avoid navigating if the URL is already the same
          const current = `${window.location.pathname}${window.location.hash || ''}`;
          if (current !== hashed) {
            // Use History API to update address bar, then dispatch popstate so
            // React Router detects the change and renders the correct route.
            window.history.pushState(null, '', hashed);
            try {
              window.dispatchEvent(new PopStateEvent('popstate'));
            } catch (e) {
              // Older browsers: create event via document.createEvent
              try {
                const evt = document.createEvent('PopStateEvent');
                evt.initPopStateEvent('popstate', false, false, null);
                window.dispatchEvent(evt);
              } catch (err) {
                debug.warn('Failed to dispatch popstate after pushState', err);
              }
            }
          } else {
            debug.log('Skipping history update: URL already matches hashed plan link');
          }
        } catch (err) {
          // Fallback to replaceState if pushState fails
          const current = `${window.location.pathname}${window.location.hash || ''}`;
          if (current !== hashed) {
            window.history.replaceState(null, '', hashed);
            try {
              window.dispatchEvent(new PopStateEvent('popstate'));
            } catch (e) {
              try {
                const evt = document.createEvent('PopStateEvent');
                evt.initPopStateEvent('popstate', false, false, null);
                window.dispatchEvent(evt);
              } catch (err) {
                debug.warn('Failed to dispatch popstate after replaceState', err);
              }
            }
          }
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

        try {
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
            // When leaving plan view, update URL to create a history entry
            window.history.pushState(null, '', expUrl);
            try {
              window.dispatchEvent(new PopStateEvent('popstate'));
            } catch (e) {
              try {
                const evt = document.createEvent('PopStateEvent');
                evt.initPopStateEvent('popstate', false, false, null);
                window.dispatchEvent(evt);
              } catch (err) {
                debug.warn('Failed to dispatch popstate after pushState (expUrl)', err);
              }
            }
          } else {
            debug.log('Skipping history update: URL already matches experience URL');
          }
        } catch (err) {
          const current = `${window.location.pathname}${window.location.hash || ''}`;
          const incomingHash = window.location.hash || '';
          // CRITICAL: Preserve plan hash in fallback path too
          if (incomingHash.startsWith('#plan-')) {
            debug.log('Preserving incoming plan hash in fallback; skipping expUrl replaceState');
            return; // CRITICAL: Early return to prevent hash removal
          }

          if (current !== expUrl) {
            window.history.replaceState(null, '', expUrl);
            try {
              window.dispatchEvent(new PopStateEvent('popstate'));
            } catch (e) {
              try {
                const evt = document.createEvent('PopStateEvent');
                evt.initPopStateEvent('popstate', false, false, null);
                window.dispatchEvent(evt);
              } catch (err) {
                debug.warn('Failed to dispatch popstate after replaceState (expUrl)', err);
              }
            }
          }
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
        entities.push({
          type: 'user',
          id: user._id,
          displayName: user.name || user.username || 'Unknown User'
        });
      });
    }

    // Add plan items (for # mentions)
    if (selectedPlan && selectedPlan.items && selectedPlan.items.length > 0) {
      selectedPlan.items.forEach(item => {
        entities.push({
          type: 'plan-item',
          id: item._id,
          displayName: item.name || item.experience_name || 'Unknown Plan Item'
        });
      });
    }

    // Add current destination
    if (experience?.destination) {
      entities.push({
        type: 'destination',
        id: experience.destination._id,
        displayName: experience.destination.name || 'Unknown Destination'
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
        data[user._id] = {
          _id: user._id,
          name: user.name || user.username,
          bio: user.bio,
          username: user.username
        };
      });
    }

    // Add plan items
    if (selectedPlan && selectedPlan.items && selectedPlan.items.length > 0) {
      selectedPlan.items.forEach(item => {
        data[item._id] = {
          _id: item._id,
          name: item.name || item.experience_name,
          description: item.description,
          experienceId: experience?._id,
          planId: selectedPlan._id
        };
      });
    }

    // Add destination
    if (experience?.destination) {
      data[experience.destination._id] = {
        _id: experience.destination._id,
        name: experience.destination.name,
        city: experience.destination.city,
        country: experience.destination.country,
        description: experience.destination.description
      };
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

  // Legacy individual fetch functions - kept for compatibility with existing code that calls them
  const fetchExperience = useCallback(async () => {
    try {
      const experienceData = await showExperience(experienceId);
      debug.log("Experience data:", experienceData);
      debug.log("Experience user:", experienceData.user);
      debug.log("Experience permissions:", experienceData.permissions);
      if (experienceData.permissions && experienceData.permissions.length > 0) {
        debug.log("First permission _id:", experienceData.permissions[0]._id);
        debug.log(
          "First permission _id type:",
          typeof experienceData.permissions[0]._id
        );
      }
      setExperience(experienceData);

      // Update DataContext with experience data
      if (experienceData && experienceData._id) {
        updateExperienceInContext(experienceData);
      }

      // userHasExperience will be set in fetchUserPlan based on Plan model
      // No longer using experience.users array

      // Set travelTips if present
      setTravelTips(experienceData.travel_tips || []);
      // userPlannedDate will be set from userPlan in fetchUserPlan
      // No longer using experience.users array

      // Set expanded parents (all parents expanded by default)
      const parentIds = experienceData.plan_items
        .filter((item) => !item.parent)
        .map((item) => item._id);
      setExpandedParents(new Set(parentIds));
    } catch (err) {
      debug.error("Error fetching experience:", err);
      setExperience(null);
    }
  }, [experienceId, updateExperienceInContext]);

  // fetchUserPlan, fetchCollaborativePlans, and fetchPlans are now provided by usePlanManagement hook

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
    setHashSelecting(false);
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
    setShowCollaboratorModal(false);
    setCollaboratorContext("plan");
    setCollaboratorSearch("");
    setSearchResults([]);
    setSelectedCollaborators([]);
    setExistingCollaborators([]);
    setRemovedCollaborators([]);
    setCollaboratorAddSuccess(false);
    setAddedCollaborators([]);
    setActuallyRemovedCollaborators([]);
    setShowEmailInviteForm(false);
    setEmailInviteData({ email: "", name: "" });
    setEmailInviteSending(false);
    setEmailInviteError("");
    setShowPlanItemModal(false);
    setPlanItemFormState(1);
    setEditingPlanItem({});
    setShowSyncModal(false);
  }, [experienceId]);

  // Handle hash-based plan deep linking (e.g., #plan-<planId> or #plan-<planId>-item-<itemId>)
  useEffect(() => {
    const handleHashNavigation = () => {
      try {
        // Check for stored hash from cross-navigation (e.g., from Dashboard)
        const { planId: storedPlanId, itemId: storedItemId, hash: storedHash, originPath, meta } = handleStoredHash();

        debug.log('[SingleExperience] 📍 Hash check:', {
          storedPlanId,
          storedItemId,
          storedHash,
          originPath,
          meta,
          currentHash: window.location.hash
        });

        // Use stored hash if present, otherwise check URL hash
        let planId, itemId, hashSource = null, fullHash = null;
        if (storedPlanId) {
          planId = storedPlanId;
          itemId = storedItemId;
          fullHash = storedHash; // Store full hash for later restoration
          hashSource = 'storage';
          debug.log('[SingleExperience] ✅ Using stored hash from localStorage:', {
            planId,
            itemId,
            fullHash,
            originPath,
            meta
          });

          // Don't clear the stored hash yet — wait until we've successfully
          // scrolled to the plan or item. This guard allows us to keep the
          // pending hash while plans are still loading and handle it once DOM
          // is ready.
        } else {
          const hash = window.location.hash || '';
          if (!hash.startsWith('#plan-')) return;

          // Parse hash format: #plan-{planId} or #plan-{planId}-item-{itemId}
          const hashContent = hash.substring(6); // Remove '#plan-' prefix
          const parts = hashContent.split('-item-');
          planId = parts[0];
          itemId = parts.length > 1 ? parts[1] : null;
          fullHash = hash; // Store full hash for later restoration
          hashSource = 'url';

          debug.log('[SingleExperience] Hash-based plan navigation detected from URL:', {
            planId,
            itemId,
            fullHash,
            originalHash: hash
          });
        }

        // If no planId found from either source, nothing to do
        if (!planId) return;

        // If plans haven't loaded yet, we'll wait until collaborativePlans changes
        // CRITICAL: Wait if collaborativePlans is empty, regardless of hashSelecting state
        // This ensures we don't try to select a plan before they've loaded
        if (plansLoading || collaborativePlans.length === 0) {
          debug.log('[Hash Navigation] Plans still loading or empty; will attempt selection after load', {
            plansLoading,
            collaborativePlansCount: collaborativePlans.length,
            hashSelecting
          });
          // Indicate we're waiting on plans to resolve a hash selection
          setHashSelecting(true);
          return;
        }

        // Clear any waiting indicator now that plans are available
        if (hashSelecting) setHashSelecting(false);

        // DEBUG: Log all available plans and the target planId
        debug.log('[Hash Navigation] Looking for planId:', planId);
        debug.log('[Hash Navigation] Available collaborativePlans:', collaborativePlans.map(p => ({
          id: p._id,
          idString: p._id?.toString(),
          isOwn: p.user?._id?.toString() === user?._id?.toString() || p.user?.toString() === user?._id?.toString()
        })));

        const targetPlan = collaborativePlans.find((p) => idEquals(p._id, planId));
        debug.log('[Hash Navigation] Target plan found?', !!targetPlan);
        if (targetPlan) {
          debug.log('[Hash Navigation] ✅ Found target plan:', targetPlan._id);
          const tid = targetPlan._id && targetPlan._id.toString ? targetPlan._id.toString() : targetPlan._id;

          // CRITICAL: Restore the FULL hash (including item portion) to the URL
          // BEFORE setting state to prevent URL management useEffect from stripping it
          // The URL management useEffect triggers when selectedPlanId changes, so we must
          // ensure the hash is already in the URL before that happens
          const targetHash = fullHash && fullHash.startsWith('#') ? fullHash : (window.location.hash || '');
          const shouldAnimate = hashSource === 'url' || meta?.shouldShake === true || !handledHashesRef.current.has(targetHash);

          debug.log('[SingleExperience] 📍 Hash navigation details:', {
            planId,
            itemId,
            fullHash,
            targetHash,
            hashSource,
            shouldAnimate,
            willRestoreHash: !!fullHash
          });

          try {
            if (fullHash) {
              // Replace the current history entry with the full hash-bearing URL
              // This ensures item-level deep links are preserved in the address bar
              debug.log('[SingleExperience] 🔗 Restoring FULL hash to URL (BEFORE state update):', {
                fullHash,
                planId,
                itemId,
                currentURL: window.location.href,
                hashSource
              });
              restoreHashToUrl(fullHash, { replace: true });
              debug.log('[SingleExperience] ✅ Hash restored. New URL:', window.location.href);
            } else {
              debug.warn('[SingleExperience] ⚠️ No fullHash to restore', { hashSource, planId, itemId });
            }
          } catch (err) {
            debug.error('[SingleExperience] ❌ Failed to restore hash to URL:', err);
          }

          // NOW set state - URL management useEffect will see the hash in the URL
          debug.log('[Hash Navigation] Setting selectedPlanId:', tid, 'and activeTab: myplan');
          setSelectedPlanId(tid);
          setActiveTab('myplan');

          // Clear stored hash immediately after consuming it
          // This prevents stale hashes if user stops page load before scroll completes
          if (storedHash) {
            try {
              clearStoredHash();
              debug.log('[Hash Navigation] Cleared stored hash from localStorage');
            } catch (e) {
              debug.warn('[Hash Navigation] Failed to clear stored hash', e);
            }
          }

          // Start attempts shortly after tab switch to give React time to render
          setTimeout(() => attemptScrollToItem(itemId, { shouldHighlight: shouldAnimate }), 250);

          // Mark this hash as handled to prevent re-animation on non-HashLink actions
          // (like marking items complete while hash is still in URL)
          if (hashSource === 'url') {
            try { const cur = window.location.hash || ''; if (cur) handledHashesRef.current.add(cur); } catch (e) {}
          }
          try {
            if (targetHash) handledHashesRef.current.add(targetHash);
          } catch (e) {
            // ignore
          }
        } else {
          debug.warn('[Hash Navigation] ❌ Plan ID from hash not found in collaborativePlans', {
            planId,
            collaborativePlansCount: collaborativePlans.length,
            collaborativePlansIDs: collaborativePlans.map(p => p._id?.toString())
          });
          // No matching plan in this experience; clear the stored hash to avoid
          // repeated failed attempts.
          try { clearStoredHash(); } catch (e) {}
        }
      } catch (err) {
        debug.warn('Error handling hash navigation', err);
      }
    };

    // Run once (attempt selection) and register hashchange listener
    handleHashNavigation();
    window.addEventListener('hashchange', handleHashNavigation);

    return () => {
      window.removeEventListener('hashchange', handleHashNavigation);
    };
  }, [plansLoading, collaborativePlans]);

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

      success('Note added successfully');
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

      success('Note updated successfully');
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

      success('Note deleted successfully');
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
          });
        } else {
          await updateExperiencePlanItem(experience._id, {
            _id: editingPlanItem._id,
            text: editingPlanItem.text,
            url: editingPlanItem.url,
            cost_estimate: editingPlanItem.cost || 0,
            planning_days: editingPlanItem.planning_days || 0,
            parent: editingPlanItem.parent || null,
          });
        }
      };

      const rollback = () => {
        if (prevExperience) setExperience(prevExperience);
        setShowPlanItemModal(true);
        setEditingPlanItem(isAdd ? (editingPlanItem || {}) : editingPlanItem);
      };

      const onSuccess = async () => {
        fetchExperience().catch(() => {});
      };

      const onError = (err, defaultMsg) => {
        const errorMsg = handleError(err, { context: isAdd ? "Add experience plan item" : "Update experience plan item" }) || defaultMsg;
        showError(errorMsg);
      };

      const run = useOptimisticAction({ apply, apiCall, rollback, onSuccess, onError, context: isAdd ? 'Add experience plan item' : 'Update experience plan item' });
      await run();
    },
    [experience, editingPlanItem, planItemFormState, fetchExperience]
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
    // 4. Not waiting for hash navigation
    if (!plansLoading && collaborativePlans.length > 0 && !selectedPlanId && !hashSelecting) {
      // Check if there's a hash in the URL - if so, let hash navigation handle it
      const hash = window.location.hash || '';
      if (hash.startsWith('#plan-')) {
        debug.log('[Auto-select] Hash present in URL, skipping auto-select');
        return;
      }

      // Auto-select the first plan (user's own plan is always first due to sorting)
      const firstPlan = collaborativePlans[0];
      const firstPlanId = firstPlan._id && firstPlan._id.toString ? firstPlan._id.toString() : firstPlan._id;

      debug.log('[Auto-select] Auto-selecting first plan:', {
        planId: firstPlanId,
        isOwnPlan: idEquals(firstPlan.user?._id || firstPlan.user, user._id)
      });

      setSelectedPlanId(firstPlanId);
      handlePlanChange(firstPlanId);
    }
  }, [plansLoading, collaborativePlans, selectedPlanId, hashSelecting, user._id, idEquals, handlePlanChange]);

  const handleAddCollaborator = useCallback(
    async (e) => {
      e.preventDefault();
      setLoading(true);
      // Determine which entity to add/remove collaborators
      const isExperienceContext = collaboratorContext === "experience";
      if (!isExperienceContext && !selectedPlanId) {
        setLoading(false);
        return;
      }

      // Compute additions vs existing
      const collaboratorsToAdd = selectedCollaborators.filter(
        (selected) =>
          !existingCollaborators.some((existing) => existing._id === selected._id)
      );

      // Snapshot previous state for rollback
      const prevExperience = experience ? { ...experience } : null;
      const prevUserPlan = userPlan ? { ...userPlan } : null;
      const prevCollaborativePlans = collaborativePlans
        ? collaborativePlans.map((p) => ({ ...p }))
        : [];

      const apply = () => {
        // Optimistically update permissions arrays so collaborator chips update immediately
        if (isExperienceContext) {
          setExperience((prev) => {
            if (!prev) return prev;
            const toRemoveIds = new Set(removedCollaborators.map((c) => c._id));
            const withoutRemoved = (prev.permissions || []).filter(
              (p) => !(p.entity === "user" && p.type === "collaborator" && toRemoveIds.has(p._id))
            );
            const addedPerms = collaboratorsToAdd.map((c) => ({
              _id: c._id,
              entity: "user",
              type: "collaborator",
              granted_at: new Date().toISOString(),
            }));
            return { ...prev, permissions: [...withoutRemoved, ...addedPerms] };
          });
        } else {
          // Update selected plan's permissions (could be userPlan or a collaborative plan)
          const applyToPlan = (plan) => {
            if (!plan) return plan;
            const toRemoveIds = new Set(removedCollaborators.map((c) => c._id));
            const withoutRemoved = (plan.permissions || []).filter(
              (p) => !(p.entity === "user" && p.type === "collaborator" && toRemoveIds.has(p._id))
            );
            const addedPerms = collaboratorsToAdd.map((c) => ({
              _id: c._id,
              entity: "user",
              type: "collaborator",
              granted_at: new Date().toISOString(),
            }));
            return { ...plan, permissions: [...withoutRemoved, ...addedPerms] };
          };

          if (userPlan && idEquals(userPlan._id, selectedPlanId)) {
            setUserPlan((prev) => applyToPlan(prev));
          } else {
            setCollaborativePlans((prev) =>
              prev.map((p) => (idEquals(p._id, selectedPlanId) ? applyToPlan(p) : p))
            );
          }
        }
      };

      const rollback = () => {
        if (isExperienceContext) {
          setExperience(prevExperience);
        } else {
          // Restore both possible containers
          if (prevUserPlan && idEquals(prevUserPlan._id, selectedPlanId)) {
            setUserPlan(prevUserPlan);
          }
          if (prevCollaborativePlans?.length) {
            setCollaborativePlans(prevCollaborativePlans);
          }
        }
      };

      const apiCall = async () => {
        // Perform removals first, then additions
        for (const collaborator of removedCollaborators) {
          try {
            if (isExperienceContext) {
              await removeExperienceCollaborator(experienceId, collaborator._id);
            } else {
              await removeCollaborator(selectedPlanId, collaborator._id);
            }
          } catch (err) {
            debug.error(`Error removing collaborator ${collaborator.name}:`, err);
            throw err;
          }
        }

        for (const collaborator of collaboratorsToAdd) {
          try {
            if (isExperienceContext) {
              await addExperienceCollaborator(experienceId, collaborator._id);
            } else {
              await addCollaborator(selectedPlanId, collaborator._id);
            }
          } catch (err) {
            debug.error(`Error adding collaborator ${collaborator.name}:`, err);
            throw err;
          }
        }
      };

      const onSuccess = async () => {
        try {
          if (isExperienceContext) {
            await fetchExperience();
          } else {
            await fetchCollaborativePlans();
            await fetchPlans();
          }
          // Track the added and removed collaborators for success message
          setAddedCollaborators(collaboratorsToAdd);
          setActuallyRemovedCollaborators(removedCollaborators);
          setCollaboratorAddSuccess(true);
        } finally {
          setLoading(false);
        }
      };

      const onError = (err) => {
        const errorMsg = handleError(err, { context: "Manage collaborators" });
        showError(errorMsg);
        setLoading(false);
      };

      const run = useOptimisticAction({
        apply,
        apiCall,
        rollback,
        onSuccess,
        onError,
        context: "Manage collaborators",
      });
      await run();
    },
    [
      selectedCollaborators,
      existingCollaborators,
      removedCollaborators,
      selectedPlanId,
      collaboratorContext,
      experienceId,
      fetchCollaborativePlans,
      fetchExperience,
      userPlan,
      collaborativePlans,
      fetchPlans,
    ]
  );

  const handleSendEmailInvite = useCallback(
    async (e) => {
      e.preventDefault();

      // Validation
      if (!emailInviteData.email.trim() || !emailInviteData.name.trim()) {
        setEmailInviteError(lang.en.label.emailAndNameRequired);
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailInviteData.email)) {
        setEmailInviteError("Please enter a valid email address");
        return;
      }

      setEmailInviteSending(true);
      setEmailInviteError("");

      try {
        await sendEmailInvite({
          email: emailInviteData.email,
          name: emailInviteData.name,
          resourceType: "experience",
          resourceId: experienceId,
          resourceName: experience?.title || "this experience",
          customMessage: `Join me in planning ${
            experience?.title || "this experience"
          }!`,
          permissionType: "collaborator",
        });

        // Show success
        success(`Email invite sent successfully to ${emailInviteData.email}!`);

        // Reset form
        setEmailInviteData({ email: "", name: "" });
        setShowEmailInviteForm(false);
      } catch (error) {
        setEmailInviteError(error.message || "Failed to send email invite");
      } finally {
        setEmailInviteSending(false);
      }
    },
    [emailInviteData, experienceId, experience, success]
  );

  const handleSelectUser = useCallback((user) => {
    // Add to selected collaborators if not already selected
    setSelectedCollaborators((prev) => {
      if (prev.some((u) => idEquals(u._id, user._id))) {
        return prev; // Already selected
      }
      return [...prev, user];
    });

    // Clear search
    setCollaboratorSearch("");
    setSearchResults([]);
  }, []);

  const handleRemoveSelectedCollaborator = useCallback(
    (userId) => {
      // Remove from newly selected collaborators
      setSelectedCollaborators((prev) => prev.filter((u) => !idEquals(u._id, userId)));

      // If this was an existing collaborator, toggle in removed list
      const wasExisting = existingCollaborators.some((u) => idEquals(u._id, userId));
      if (wasExisting) {
        setRemovedCollaborators((prev) => {
          // Toggle: if already marked for removal, un-mark it; otherwise mark it
          const isAlreadyRemoved = prev.includes(userId);
          if (isAlreadyRemoved) {
            return prev.filter(id => id !== userId);
          } else {
            return [...prev, userId];
          }
        });
      }
    },
    [existingCollaborators]
  );

  const openCollaboratorModal = useCallback(
    (context) => {
      setCollaboratorContext(context);

      // Get existing collaborators based on context - use the fetched user data
      let existing = [];
      if (context === "experience") {
        existing = experienceCollaborators || [];
      } else {
        existing = planCollaborators || [];
      }

      setExistingCollaborators(existing);
      setSelectedCollaborators(existing);
      setRemovedCollaborators([]);
      setShowCollaboratorModal(true);
    },
    [experienceCollaborators, planCollaborators]
  );

  const handleSearchUsers = useCallback(
    async (query) => {
      setCollaboratorSearch(query);

      if (query.length < 2) {
        setSearchResults([]);
        return;
      }

      try {
        const results = await searchUsers(query);

        // Filter out users that are already selected or are the current user (owner)
        const filteredResults = results.filter((result) => {
            // Don't show current user
            if (idEquals(result._id, user._id)) return false;

            // Don't show users that are already selected
            const alreadySelected = selectedCollaborators.some((collab) => idEquals(collab._id, result._id));

          return !alreadySelected;
        });

        setSearchResults(filteredResults);
      } catch (err) {
        debug.error("Error searching users:", err);
        setSearchResults([]);
      }
    },
    [selectedCollaborators, user]
  );

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
      lang.en.button.addFavoriteExp,
      lang.en.button.expPlanAdded,
      lang.en.button.removeFavoriteExp,
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

          const newPlan = await createPlan(
            experience._id,
            addData.planned_date || null
          );

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
            success(lang.en.success?.experienceCreated || "Planned");
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
      fetchExperience,
      fetchUserPlan,
      fetchCollaborativePlans,
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
        await fetchExperience();
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
        await fetchExperience();
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
    fetchExperience,
  ]);

  const handleDeleteExperience = useCallback(async () => {
    if (!experience || !isOwner(user, experience)) return;
    try {
      removeExperience(experience._id); // Instant UI update!
      await deleteExperience(experience._id);
      success(lang.en.success.experienceDeleted);
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
        fetchExperience().catch(() => {});
        fetchExperiences().catch(() => {});
        success(lang.en.success.planItemDeleted);
      };

      const onError = (err, defaultMsg) => {
        const errorMsg = handleError(err, { context: "Delete plan item" }) || defaultMsg;
        showError(errorMsg);
      };

      const run = useOptimisticAction({ apply, apiCall, rollback, onSuccess, onError, context: 'Delete experience plan item' });
      await run();
    },
    [experience, fetchExperiences, fetchExperience, success, showError]
  );

  const handlePlanItemToggleComplete = useCallback(
    async (planItem) => {
      if (!selectedPlanId || !planItem) return;

      const itemId = planItem._id || planItem.plan_item_id;
      const newComplete = !planItem.complete;

      // Optimistic update to collaborativePlans state
      const prevPlans = [...collaborativePlans];
      const planIndex = collaborativePlans.findIndex((p) => idEquals(p._id, selectedPlanId));
      const prevPlan = planIndex >= 0 ? { ...collaborativePlans[planIndex], plan: [...(collaborativePlans[planIndex].plan || [])] } : null;

      const apply = () => {
        if (!prevPlan || planIndex < 0) return;
        const updatedPlans = [...collaborativePlans];
        const updatedPlanItems = prevPlan.plan.map((item) => {
          const currentItemId = item._id || item.plan_item_id;
          if (currentItemId?.toString() === itemId?.toString()) {
            return { ...item, complete: newComplete };
          }
          return item;
        });
        updatedPlans[planIndex] = { ...prevPlan, plan: updatedPlanItems };
        setCollaborativePlans(updatedPlans);
      };

      const apiCall = async () => {
        await updatePlanItem(selectedPlanId, itemId, { complete: newComplete });
      };

      const rollback = () => {
        setCollaborativePlans(prevPlans);
      };

      const onSuccess = async () => {
        // Refresh plan data to ensure consistency
        fetchCollaborativePlans().catch(() => {});
        fetchUserPlan().catch(() => {});
        fetchPlans().catch(() => {});

        // Scroll to item but don't animate (item completion shouldn't shake)
        try {
          await attemptScrollToItem(itemId, { shouldHighlight: false });
        } catch (e) {
          // ignore scroll errors
        }
      };

      const onError = (err, defaultMsg) => {
        const errorMsg = handleError(err, { context: "Toggle plan item completion" }) || defaultMsg;
        showError(errorMsg);
      };

      const run = useOptimisticAction({
        apply,
        apiCall,
        rollback,
        onSuccess,
        onError,
        context: 'Toggle plan item completion'
      });
      await run();
    },
    [
      selectedPlanId,
      collaborativePlans,
      fetchCollaborativePlans,
      fetchUserPlan,
      fetchPlans,
      showError,
    ]
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
        success('Plan items reordered successfully');
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
        fetchExperience().catch(() => {});
        success('Plan items reordered successfully');
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
      fetchExperience,
      success,
      showError,
    ]
  );

  return (
    <>
      {experience && (
        <PageOpenGraph
          title={experience.name}
          description={`Plan your ${experience.name} experience. ${
            experience.cost_estimate > 0
              ? `Estimated cost: ${dollarSigns(
                  Math.ceil(experience.cost_estimate / 1000)
                )}/5. `
              : ""
          }${
            experience.max_planning_days > 0
              ? `Planning time: ${experience.max_planning_days} ${
                  experience.max_planning_days === 1 ? "day" : "days"
                }.`
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
        />
      )}
      {experience ? (
        <div>
          <div className="row experience-detail fade-in">
            <div className="col-md-6 fade-in">
              <ExperienceTitleSection
                experience={experience}
                h1Ref={h1Ref}
                user={user}
                userHasExperience={userHasExperience}
                pendingUnplan={pendingUnplan}
                selectedPlan={selectedPlan}
                showDatePicker={showDatePicker}
                setShowDatePicker={setShowDatePicker}
                setIsEditingDate={setIsEditingDate}
                setPlannedDate={setPlannedDate}
                lang={lang}
              />
            </div>
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
            />
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
          </div>
          <ExperienceOverviewSection
            experience={experience}
            lang={lang}
          />
          <div className="row my-2 p-3 fade-in">
            {experience.plan_items && experience.plan_items.length > 0 && (
              <div className="plan-items-container fade-in p-3 p-md-4">
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
                    openCollaboratorModal={openCollaboratorModal}
                    toggleExpanded={toggleExpanded}
                    setPlanItemToDelete={setPlanItemToDelete}
                    setShowPlanDeleteModal={setShowPlanDeleteModal}
                    onReorderExperiencePlanItems={handleReorderExperiencePlanItems}
                    lang={lang}
                  />
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
                    hashSelecting={hashSelecting}
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
                    openCollaboratorModal={openCollaboratorModal}
                    toggleExpanded={toggleExpanded}
                    setPlanInstanceItemToDelete={setPlanInstanceItemToDelete}
                    setShowPlanInstanceDeleteModal={setShowPlanInstanceDeleteModal}
                    handlePlanItemToggleComplete={handlePlanItemToggleComplete}
                    onReorderPlanItems={handleReorderPlanItems}
                    hoveredPlanItem={hoveredPlanItem}
                    setHoveredPlanItem={setHoveredPlanItem}
                    lang={lang}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}
      <ConfirmModal
        show={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteExperience}
        title={lang.en.modal.confirmDelete}
        message={lang.en.modal.confirmDeleteMessage.replace(
          "{name}",
          experience?.name
        )}
        confirmText={lang.en.button.delete}
        confirmVariant="danger"
      />
      <ConfirmModal
        show={showRemoveModal}
        onClose={() => {
          setShowRemoveModal(false);
        }}
        onConfirm={confirmRemoveExperience}
        title={lang.en.modal.removeExperienceTitle}
        message="Are you sure you want to remove this experience? Your plan and all progress tracked will be permanently deleted."
        confirmText={lang.en.button.removeExperience}
        confirmVariant="danger"
      />
      <ConfirmModal
        show={showPlanDeleteModal}
        onClose={() => setShowPlanDeleteModal(false)}
        onConfirm={() => handlePlanDelete(planItemToDelete)}
        title={lang.en.modal.confirmDeletePlanItemTitle}
        message={lang.en.modal.confirmDeletePlanItem}
        confirmText={lang.en.button.delete}
        confirmVariant="danger"
      />
      <ConfirmModal
        show={showPlanInstanceDeleteModal}
        onClose={() => {
          setShowPlanInstanceDeleteModal(false);
          setPlanInstanceItemToDelete(null);
        }}
        onConfirm={handlePlanInstanceItemDelete}
        title={lang.en.modal.confirmDeletePlanItemTitle}
        message={
          planInstanceItemToDelete
            ? `Delete "${planInstanceItemToDelete.text}"?`
            : lang.en.modal.confirmDeletePlanItem
        }
        confirmText={lang.en.button.delete}
        confirmVariant="danger"
      />

      {/* Add Collaborator Modal */}
      <CollaboratorModal
        show={showCollaboratorModal}
        onHide={() => {
          setShowCollaboratorModal(false);
          setCollaboratorSearch("");
          setSearchResults([]);
          setCollaboratorAddSuccess(false);
          setAddedCollaborators([]);
          setActuallyRemovedCollaborators([]);
          setSelectedCollaborators([]);
          setExistingCollaborators([]);
          setRemovedCollaborators([]);
        }}
        onSearch={handleSearchUsers}
        onAddCollaborators={handleAddCollaborator}
        onRemoveCollaborator={handleRemoveSelectedCollaborator}
        onSendEmailInvite={handleSendEmailInvite}
        context={collaboratorContext}
        searchTerm={collaboratorSearch}
        onSearchTermChange={setCollaboratorSearch}
        searchResults={searchResults}
        selectedCollaborators={selectedCollaborators}
        onToggleCollaborator={handleSelectUser}
        existingCollaborators={
          collaboratorContext === "plan"
            ? planCollaborators
            : experienceCollaborators
        }
        removedCollaborators={removedCollaborators}
        addSuccess={collaboratorAddSuccess}
        addedCollaborators={addedCollaborators}
        actuallyRemovedCollaborators={actuallyRemovedCollaborators}
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

          try {
            const assignee = allPlanCollaborators.find(c => (c._id || c.user?._id) === userId);
            const assigneeName = assignee?.name || assignee?.user?.name || 'Unknown User';

            await assignPlanItem(selectedPlan._id, selectedDetailsItem._id, userId);

            // Show success toast
            success(`Assigned to ${assigneeName}`, { duration: 3000 });

            // Refresh plan data
            await fetchPlans();
          } catch (error) {
            logger.error('Error assigning plan item', { error: error.message, userId });
            showError(error.message || 'Failed to assign plan item');
          }
        }}
        onUnassign={async () => {
          if (!selectedPlan || !selectedDetailsItem) return;

          try {
            await unassignPlanItem(selectedPlan._id, selectedDetailsItem._id);

            // Show success toast
            success('Unassigned plan item', { duration: 3000 });

            // Refresh plan data
            await fetchPlans();
          } catch (error) {
            logger.error('Error unassigning plan item', { error: error.message });
            showError(error.message || 'Failed to unassign plan item');
          }
        }}
        canEdit={selectedPlan ? canEditPlan(user, selectedPlan) : false}
        availableEntities={availableEntities}
        entityData={entityData}
      />
    </>
  );
}
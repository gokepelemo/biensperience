import TagPill from '../../components/Pill/TagPill';
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
import Modal from "../../components/Modal/Modal";
import PageOpenGraph from "../../components/OpenGraph/PageOpenGraph";
import PhotoCard from "../../components/PhotoCard/PhotoCard";
import UsersListDisplay from "../../components/UsersListDisplay/UsersListDisplay";
import InfoCard from "../../components/InfoCard/InfoCard";
import Alert from "../../components/Alert/Alert";
import GoogleMap from "../../components/GoogleMap/GoogleMap";
import { Button, Container, Mobile, Desktop, FadeIn, FormLabel, FormControl, FormCheck, Text } from "../../components/design-system";
import Loading from "../../components/Loading/Loading";
import debug from "../../utilities/debug";
import { createUrlSlug } from "../../utilities/url-utils";
import {
  formatDateShort,
  formatDateForInput,
  formatDateMetricCard,
  getMinimumPlanningDate,
  isValidPlannedDate,
} from "../../utilities/date-utils";
import { handleError } from "../../utilities/error-handler";
import { createExpirableStorage } from "../../utilities/cookie-utils";
import { formatCurrency } from "../../utilities/currency-utils";
import { isOwner } from "../../utilities/permissions";
import useOptimisticAction from "../../hooks/useOptimisticAction";
import {
  showExperience,
  showExperienceWithContext,
  deleteExperience,
  deletePlanItem,
  addPlanItem as addExperiencePlanItem,
  updatePlanItem as updateExperiencePlanItem,
  addExperienceCollaborator,
  removeExperienceCollaborator,
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
} from "../../utilities/plans-api";

/**
 * Updates the cookie with dismissal data for a specific plan (upsert)
 * Automatically cleans up expired entries
 * @param {string} planId - The plan ID to mark as dismissed
 */
function setSyncAlertCookie(planId) {
  syncAlertStorage.set(planId);
}

// Duration for sync alert dismissal (7 days)
const SYNC_ALERT_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

// Create expirable storage for sync alert dismissals
const syncAlertStorage = createExpirableStorage(
  "planSyncAlertDismissed",
  SYNC_ALERT_DURATION
);

// Milliseconds to suppress reacting to plan lifecycle events that are
// triggered by local create/update actions. Adjust this to tune how long
// optimistic UI is protected from overwriting by immediate broadcasts.
const PLAN_EVENT_SUPPRESSION_MS = 1200;

/**
 * Checks if sync alert was dismissed for a specific plan and if it's still valid
 * @param {string} planId - The plan ID to check
 * @returns {number|null} Timestamp if dismissed and still valid, null otherwise
 */
function getSyncAlertCookie(planId) {
  return syncAlertStorage.get(planId);
}

/**
 * Helper to compare IDs (ObjectId or string) safely
 * Returns true if both IDs exist and their string forms match
 */
function idEquals(a, b) {
  if (!a || !b) return false;
  try {
    return a.toString() === b.toString();
  } catch (e) {
    return false;
  }
}

/**
 * Normalize a plan object to ensure consistent ID types
 * Converts _id and user._id to strings for reliable comparisons
 */
function normalizePlan(plan) {
  if (!plan) return plan;
  const normalized = { ...plan };
  if (normalized._id && typeof normalized._id !== 'string') {
    normalized._id = normalized._id.toString();
  }
  if (normalized.user && normalized.user._id && typeof normalized.user._id !== 'string') {
    normalized.user._id = normalized.user._id.toString();
  }
  if (normalized.user && typeof normalized.user === 'string') {
    normalized.user = { _id: normalized.user };
  }
  return normalized;
}

export default function SingleExperience() {
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
  const [experience, setExperience] = useState(null);
  const [userHasExperience, setUserHasExperience] = useState(false);
  const [travelTips, setTravelTips] = useState([]);
  const [favHover, setFavHover] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hoveredPlanItem, setHoveredPlanItem] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [plannedDate, setPlannedDate] = useState("");
  const [userPlannedDate, setUserPlannedDate] = useState(null);
  const [displayedPlannedDate, setDisplayedPlannedDate] = useState(null); // Date for currently viewed plan
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
  const [userPlan, setUserPlan] = useState(null);
  const [collaborativePlans, setCollaborativePlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [plansLoading, setPlansLoading] = useState(true);
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

  // Ref for dynamic font sizing on planned date metric
  const plannedDateRef = useRef(null);

  // When we perform a local create/update of a plan we want to avoid
  // reacting to the immediate broadcasted plan events in a way that
  // overwrites optimistic local state or re-opens the date picker. Use
  // this ref to temporarily suppress parts of the global event handlers
  // for a short window while the local operation completes.
  const suppressPlanEventsRef = useRef(false);

  const suppressPlanEventsFor = (ms = PLAN_EVENT_SUPPRESSION_MS) => {
    suppressPlanEventsRef.current = true;
    setTimeout(() => {
      suppressPlanEventsRef.current = false;
    }, ms);
  };

  // Timestamp of the last local plan event (create/update/delete) handled
  // locally. Used to ignore near-immediate API fetches that would otherwise
  // overwrite optimistic/event-driven state. Value is ms since epoch.
  const lastLocalPlanEventAtRef = useRef(0);

  // Ref for h1 element to ensure proper registration
  const h1Ref = useRef(null);

  // Ref to track if component is unmounting to prevent navigation interference
  const isUnmountingRef = useRef(false);

  // Set unmounting flag when component unmounts
  useEffect(() => {
    return () => {
      isUnmountingRef.current = true;
    };
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

  // Listen for global plan-created events so this view updates immediately
  useEffect(() => {
    const handler = (e) => {
      try {
        const detail = e?.detail || {};
        const newPlan = detail.plan;
        const rawExp = detail.experienceId || newPlan?.experience?._id || newPlan?.experience || null;
        const newExperienceId = rawExp && rawExp.toString ? rawExp.toString() : rawExp;
        if (!newPlan || !newExperienceId) return;
        // Only react if this plan is for the currently viewed experience
        if (newExperienceId !== experienceId?.toString()) return;

        // If events are suppressed (user just clicked Plan It button), skip ALL updates
        // because handleAddExperience will handle state updates with fresh API data.
        // Only listen to events from OTHER tabs or external sources when not suppressed.
        if (suppressPlanEventsRef.current) {
          debug.log('Skipping bien:plan_created event handler due to suppression (user-initiated action)');
          return;
        }

        // Update local state to reflect newly created plan from external source
        setUserHasExperience(true);
        const normalizedNew = normalizePlan(newPlan);
        setUserPlan(normalizedNew);
        setDisplayedPlannedDate(normalizedNew.planned_date || null);
        setUserPlannedDate(normalizedNew.planned_date || null);

        // Record that we just handled a local/external plan event so
        // immediate API fetches shouldn't stomp our optimistic/event state
        lastLocalPlanEventAtRef.current = Date.now();

        setSelectedPlanId(normalizedNew._id);
        setCollaborativePlans((prev) => {
          // Avoid duplicates (compare as strings)
          const exists = prev.some(p => p._id && normalizedNew._id && (p._id.toString ? p._id.toString() === normalizedNew._id.toString() : p._id === normalizedNew._id));
          if (exists) return prev;
          return [normalizedNew, ...prev];
        });

        // Switch to My Plan tab automatically for external events
        setActiveTab('myplan');
      } catch (err) {
        debug.warn('Failed to handle bien:plan_created event', err);
      }
    };

    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('bien:plan_created', handler);
    }

    return () => {
      if (typeof window !== 'undefined' && window.removeEventListener) {
        window.removeEventListener('bien:plan_created', handler);
      }
    };
  }, [experienceId]);

  // Listen for plan updates (e.g., planned_date edits) so the UI updates immediately
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onPlanUpdated = (e) => {
      try {
        const detail = e?.detail || {};
        const updatedPlan = detail.plan;
        const rawExp = detail.experienceId || updatedPlan?.experience?._id || updatedPlan?.experience || null;
        const updatedExperienceId = rawExp && rawExp.toString ? rawExp.toString() : rawExp;
        if (!updatedPlan || !updatedExperienceId) return;

        // Compare normalized experience id to current route experienceId
        if (updatedExperienceId !== experienceId?.toString()) return;

        // If the updated plan affects the user's own plan, update userPlan
        if (userPlan && updatedPlan._id && userPlan._id && updatedPlan._id.toString() === userPlan._id.toString()) {
          setUserPlan(updatedPlan);
          // IMPORTANT: Always update dates for user's plan, even during suppression
          setDisplayedPlannedDate(updatedPlan.planned_date || null);
          setUserPlannedDate(updatedPlan.planned_date || null);
        }

        // Record recent plan event
        lastLocalPlanEventAtRef.current = Date.now();

        // Replace or insert into collaborativePlans (ensure no duplicates)
        setCollaborativePlans((prev) => {
          const found = prev.findIndex(p => p._id && updatedPlan._id && (p._id.toString() === updatedPlan._id.toString()));
          if (found >= 0) {
            const copy = [...prev];
            copy[found] = updatedPlan;
            return copy;
          }
          // If not found but this plan belongs to this experience, add it to front
          return [updatedPlan, ...prev];
        });

        // If this update is for the currently selected plan, update displayed date
        if (selectedPlanId && updatedPlan._id && selectedPlanId.toString() === updatedPlan._id.toString()) {
          setDisplayedPlannedDate(updatedPlan.planned_date || null);
          setUserPlannedDate(updatedPlan.planned_date || null);
          setUserPlan((prev) => (prev && prev._id && prev._id.toString() === updatedPlan._id.toString() ? updatedPlan : prev));
        }

        // If this update is from the current user (and not already marked), ensure userHasExperience true
        setUserHasExperience(true);

      } catch (err) {
        debug.warn('Failed to handle bien:plan_updated event', err);
      }
    };

    window.addEventListener('bien:plan_updated', onPlanUpdated);

    return () => {
      window.removeEventListener('bien:plan_updated', onPlanUpdated);
    };
  }, [userPlan, selectedPlanId, experienceId, setCollaborativePlans, setUserPlan, setDisplayedPlannedDate, setUserPlannedDate]);

  // Listen for plan deletions so the UI updates immediately when a plan is removed
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onPlanDeleted = (e) => {
      try {
        const detail = e?.detail || {};
        const deletedPlan = detail.plan;
        const rawExp = detail.experienceId || deletedPlan?.experience?._id || deletedPlan?.experience || null;
        const deletedExperienceId = rawExp && rawExp.toString ? rawExp.toString() : rawExp;
        if (!deletedExperienceId) return;

        if (deletedExperienceId !== experienceId?.toString()) return;

        // Remove plan from collaborativePlans if present
        if (deletedPlan && deletedPlan._id) {
          setCollaborativePlans((prev) => prev.filter(p => !(p._id && p._id.toString() === deletedPlan._id.toString())));

          // If the deleted plan was the currently selected plan, clear selection
          if (selectedPlanId && deletedPlan._id && selectedPlanId.toString() === deletedPlan._id.toString()) {
            setSelectedPlanId(null);
            setDisplayedPlannedDate(null);
            setUserPlannedDate(null);
            setUserPlan(null);
            // If user had this plan, mark as not having an experience
            setUserHasExperience(false);
            // Record recent plan event to avoid immediate fetches stomping state
            lastLocalPlanEventAtRef.current = Date.now();
            // Switch back to experience tab
            setActiveTab('experience');
          }
        } else {
          // If no plan payload provided, conservatively clear userHasExperience
          setUserHasExperience(false);
          setUserPlan(null);
          setDisplayedPlannedDate(null);
          lastLocalPlanEventAtRef.current = Date.now();
        }
      } catch (err) {
        debug.warn('Failed to handle bien:plan_deleted event', err);
      }
    };

    window.addEventListener('bien:plan_deleted', onPlanDeleted);

    return () => {
      window.removeEventListener('bien:plan_deleted', onPlanDeleted);
    };
  }, [selectedPlanId, experienceId]);

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

      // Avoid stomping optimistic/local event-driven state shortly after a plan event
      const sinceEvent = Date.now() - (lastLocalPlanEventAtRef.current || 0);
      if (sinceEvent >= 0 && sinceEvent < PLAN_EVENT_SUPPRESSION_MS) {
        debug.log('Skipping context-driven experience update due to recent plan event', { sinceEvent });
        return;
      }

      // Only apply if different to avoid unnecessary renders
      try {
        const a = JSON.stringify(updated || {});
        const b = JSON.stringify(experience || {});
        if (a !== b) {
          // Instrumentation: log diff-ish preview to help diagnose overwrites
          try {
            const previewPrev = { _id: experience?._id, plan_items_count: (experience?.plan_items || []).length, travel_tips_count: (experience?.travel_tips || []).length };
            const previewNew = { _id: updated?._id, plan_items_count: (updated?.plan_items || []).length, travel_tips_count: (updated?.travel_tips || []).length };
            debug.log('Applying context-driven experience update', { experienceId: experienceId, sinceLocalPlanEventMs: sinceEvent, previewPrev, previewNew });
          } catch (inner) {
            debug.log('Applying context-driven experience update (no preview available)', { experienceId: experienceId, sinceLocalPlanEventMs: sinceEvent });
          }

          // Merge updated experience into local state but preserve deeply local plan UI fields if present
          try {
            const merged = { ...(experience || {}), ...(updated || {}), __ctx_merged_at: Date.now() };
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
  }, [ctxExperiences, experienceId, experience]);

  // Update the browser address bar to point directly to the selected plan
  // when the user switches to the "My Plan" tab or selects a collaborative plan.
  // We use the History API (replaceState) so this does not trigger a navigation
  // or reload — the server already exposes a route for `/plans/:planId`.
  useEffect(() => {
    try {
      if (typeof window === 'undefined' || !window.history || !window.history.replaceState) return;

      // Prevent navigation if component is unmounting
      if (isUnmountingRef.current) return;

      // Only update URL if we're still on the SingleExperience route
      // Prevent interference with navigation away from this component
      if (!experienceId || window.location.pathname !== `/experiences/${experienceId}`) {
        return;
      }

      // When viewing My Plan (or a collaborative plan) update the address
      // bar to a hash-based deep link that points to the experience with
      // a plan fragment. Example: `/experiences/<id>#plan/<planId>`
      if (activeTab === 'myplan' && selectedPlanId && experienceId) {
        // Use legacy hash format '#plan-<planId>' which the mount logic expects
        // Use pushState so selecting plans creates history entries (analytics-friendly)
        const hashed = `/experiences/${experienceId}#plan-${selectedPlanId}`;
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
        try {
          const current = `${window.location.pathname}${window.location.hash || ''}`;
          // If an incoming plan hash exists (e.g., user opened /experiences/:id#plan-<id>),
          // preserve it so the hash-handling logic can select the plan after load.
          const incomingHash = window.location.hash || '';
          if (incomingHash.startsWith('#plan-')) {
            debug.log('Preserving incoming plan hash; skipping expUrl navigate');
          } else if (current !== expUrl) {
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
          if (!incomingHash.startsWith('#plan-') && current !== expUrl) {
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

      // Set selectedPlanId if not already set and user has a plan
      if (fetchedUserPlan) {
        const uid = fetchedUserPlan._id && fetchedUserPlan._id.toString ? fetchedUserPlan._id.toString() : fetchedUserPlan._id;
        setSelectedPlanId((prev) => prev || uid);
      }

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

      // Combine user's own plan with collaborative plans for unified display
      // Backend returns userPlan separately from collaborativePlans array
      const allPlans = fetchedUserPlan 
        ? [fetchedUserPlan, ...accessiblePlans] 
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

      // Set selectedPlanId if not already set and plans exist
      if (normalizedSorted.length > 0) {
        const newSelectedId = normalizedSorted[0]._id;
        debug.log("Setting selectedPlanId to:", newSelectedId);
        setSelectedPlanId((prev) => prev || newSelectedId);
      }

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

  const fetchUserPlan = useCallback(async () => {
    try {
      const plans = await getUserPlans();
      const plan = plans.find(
        (p) =>
          p.experience._id === experienceId || p.experience === experienceId
      );
      // If we recently handled a local plan event, avoid letting this
      // API-based fetch overwrite our event-driven/optimistic state.
      const sinceEvent = Date.now() - (lastLocalPlanEventAtRef.current || 0);
      if (sinceEvent >= 0 && sinceEvent < PLAN_EVENT_SUPPRESSION_MS) {
        debug.log('Skipping fetchUserPlan update due to recent local plan event', { sinceEvent });
        return plan || null;
      }

      // Only update state if we found a plan OR if we don't currently have optimistic state set
      // This prevents race conditions where fetchUserPlan() is called before the API has returned the newly created plan
      if (plan) {
        setUserPlan(plan);
        setUserHasExperience(true);
        setUserPlannedDate(plan.planned_date || null);
      } else {
        // No plan found from API - only clear state if we don't have optimistic state
        setUserPlan((prev) => prev || null);
        setUserHasExperience((prev) => prev || false);
        setUserPlannedDate((prev) => prev || null);
      }

      // Only set selectedPlanId if not already set
      if (plan && !selectedPlanId) {
        const pid = plan._id && plan._id.toString ? plan._id.toString() : plan._id;
        setSelectedPlanId(pid);
      }
    } catch (err) {
      debug.error("Error fetching user plan:", err);
      setUserPlan(null);
      setUserPlannedDate(null);
      setUserHasExperience(false);
    }
  }, [experienceId, selectedPlanId]);

  const fetchCollaborativePlans = useCallback(async () => {
    try {
      const plans = await getExperiencePlans(experienceId);
      debug.log("Fetched experience plans:", plans);

      // Filter to only show plans where user is owner or collaborator
      const accessiblePlans = plans.filter((plan) => {
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

      // Sort plans: user's own plan first, then others
      const sortedPlans = accessiblePlans.sort((a, b) => {
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
      debug.log("Current selectedPlanId:", selectedPlanId);

      // Normalize IDs
      const normalized = sortedPlans.map(p => normalizePlan(p));

      // If we have a local userPlan (optimistic) that isn't present in the
      // fetched list yet, merge it in front so optimistic UI is preserved
      let merged = normalized;
      try {
        if (userPlan && userPlan._id) {
          const normUser = normalizePlan(userPlan);
          const exists = normalized.some(p => idEquals(p._id, normUser._id));
          if (!exists) {
            merged = [normUser, ...normalized];
            debug.log("Merged optimistic userPlan into collaborativePlans", { planId: normUser._id });
          }
        }
      } catch (err) {
        debug.warn("Error merging userPlan into collaborativePlans", err);
        // ignore merge errors and fall back to normalized
      }

      setCollaborativePlans(merged);

      // Set selectedPlanId if not already set and plans exist
      if (merged.length > 0) {
        // First plan is now guaranteed to be user's own plan if they have one
        const newSelectedId = merged[0]._id;
        debug.log("Setting selectedPlanId to:", newSelectedId);
        setSelectedPlanId((prev) => prev || newSelectedId);
      }
    } catch (err) {
      debug.error("Error fetching collaborative plans:", err);
      setCollaborativePlans([]);
    }
  }, [experienceId, user._id]);

  const checkPlanDivergence = useCallback((plan, experience) => {
    if (!plan || !experience || !experience.plan_items) {
      return false;
    }

    // Check if plan items count differs
    if (plan.plan.length !== experience.plan_items.length) {
      return true;
    }

    // Check if any plan item has changed
    for (let i = 0; i < plan.plan.length; i++) {
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

  // Handle hash-based plan deep linking (e.g., #plan-<planId>)
  useEffect(() => {
    const handleHashNavigation = () => {
      try {
        const hash = window.location.hash || '';
        if (!hash.startsWith('#plan-')) return;
        const planId = hash.substring(6); // Remove '#plan-' prefix
        debug.log('Hash-based plan navigation detected:', planId);

        // If plans haven't loaded yet, we'll wait until collaborativePlans changes
        if (plansLoading) {
          debug.log('Plans still loading; will attempt selection after load');
          // Indicate we're waiting on plans to resolve a hash selection
          setHashSelecting(true);
          return;
        }

        // Clear any waiting indicator now that plans are available
        if (hashSelecting) setHashSelecting(false);

        const targetPlan = collaborativePlans.find((p) => idEquals(p._id, planId));
        if (targetPlan) {
          debug.log('Switching to plan from hash:', targetPlan._id);
          const tid = targetPlan._id && targetPlan._id.toString ? targetPlan._id.toString() : targetPlan._id;
          setSelectedPlanId(tid);
          setActiveTab('myplan');

          // Scroll to plan section after a brief delay to ensure tab switch
          setTimeout(() => {
            const planSection = document.querySelector('.my-plan-view');
            if (planSection) {
              planSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }, 100);
        } else {
          debug.warn('Plan ID from hash not found in collaborativePlans');
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

    // Skip updates if we recently handled a plan event to prevent race conditions
    // during optimistic state updates (like when user clicks "Plan It")
    const sinceEvent = Date.now() - (lastLocalPlanEventAtRef.current || 0);
    if (sinceEvent >= 0 && sinceEvent < PLAN_EVENT_SUPPRESSION_MS) {
      debug.log('Skipping displayedPlannedDate update due to recent plan event', { sinceEvent });
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
  setSelectedCollaborators((prev) => prev.filter((u) => !idEquals(u._id, userId)));

      // If this was an existing collaborator, add to removed list
  const wasExisting = existingCollaborators.some((u) => idEquals(u._id, userId));
      if (wasExisting) {
        const collaborator = existingCollaborators.find((u) => idEquals(u._id, userId));
        setRemovedCollaborators((prev) => [...prev, collaborator]);
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
    // Remove experience plan
    const previousState = userHasExperience;
    const previousPlan = userPlan;
    const previousPlannedDate = displayedPlannedDate;
    try {
      // User confirmed deletion - now hide the badge and update UI
      setPendingUnplan(true);
      // Optimistically update UI immediately for better UX
      setUserHasExperience(false);
      setUserPlannedDate(null);
      setDisplayedPlannedDate(null);
      setUserPlan(null);
      setShowRemoveModal(false);
      setShowDatePicker(false); // Close date picker modal when plan is removed
      setCollaborativePlans([]);
      setSelectedPlanId(null);
      setActiveTab("experience"); // Switch back to experience tab

      // Delete the user's plan (using Plan API) - do this in background
      if (userPlan) {
        await deletePlan(userPlan._id);
        debug.log("Plan deleted successfully");
        try {
          // Record optimistic deletion state so DataContext delays canonical apply
          setOptimisticPlanStateForExperience(experience._id, {
            selectedPlanId: null,
            userPlan: null,
            displayedPlannedDate: null,
            userHasExperience: false,
          });
        } catch (err) {
          debug.warn('Failed to set optimistic deletion state in DataContext', err);
        }
      }

      // Refresh data in background (user already sees updated UI)
      fetchExperience().catch((err) =>
        debug.error("Error refreshing experience:", err)
      );
      fetchCollaborativePlans().catch((err) =>
        debug.error("Error refreshing collaborative plans:", err)
      );
      fetchPlans().catch((err) =>
        debug.error("Error refreshing global plans:", err)
      );
      setPendingUnplan(false);
    } catch (err) {
      // Revert on error
      setUserHasExperience(previousState);
      setUserPlan(previousPlan);
      setDisplayedPlannedDate(previousPlannedDate);
      setShowRemoveModal(false);
      setPendingUnplan(false);
      const errorMsg = handleError(err, { context: "Remove plan" });
      showError(errorMsg || "Failed to remove plan. Please try again.");
    }
  }, [
    experience,
    user,
    userHasExperience,
    userPlan,
    displayedPlannedDate,
    fetchExperience,
    fetchCollaborativePlans,
    fetchPlans,
    showError,
  ]);

  const handleAddExperience = useCallback(
    async (data = null) => {
      const addData =
        data !== null ? data : plannedDate ? { planned_date: plannedDate } : {};
      const previousState = userHasExperience;
      try {
        // Optimistically update UI
        setUserHasExperience(true);
        setShowDatePicker(false);
        setIsEditingDate(false);
        setPlannedDate("");
        setUserPlannedDate(addData.planned_date || null);

        // Create a plan for this experience
        try {
          // Suppress handling of immediate broadcasted plan events so
          // our optimistic UI changes are not overwritten.
          suppressPlanEventsFor(PLAN_EVENT_SUPPRESSION_MS);

          const newPlan = await createPlan(
            experience._id,
            addData.planned_date || null
          );
          
          logger.info("Plan created", { 
            planId: newPlan?._id,
            experienceId: experience._id
          });

          setSelectedPlanId(newPlan._id && newPlan._id.toString ? newPlan._id.toString() : newPlan._id);
          setUserPlan(newPlan);
          setUserHasExperience(true);
          setUserPlannedDate(addData.planned_date || null);
          setDisplayedPlannedDate(addData.planned_date || null);
          
          // Normalize and add the new plan to collaborativePlans if missing
          const normalizedNew = normalizePlan(newPlan);
          setCollaborativePlans(prev => {
            const exists = prev.some(p => idEquals(p._id, normalizedNew._id));
            if (exists) return prev;
            return [normalizedNew, ...prev];
          });

          // Record optimistic plan state in DataContext so canonical updates
          // can preserve optimistic UI until the backend converges.
          try {
            setOptimisticPlanStateForExperience(experience._id, {
              selectedPlanId: newPlan._id && newPlan._id.toString ? newPlan._id.toString() : newPlan._id,
              userPlan: newPlan,
              displayedPlannedDate: addData.planned_date || null,
              userHasExperience: true,
            });
          } catch (err) {
            debug.warn('Failed to set optimistic plan state in DataContext', err);
          }

          // DON'T call fetchUserPlan() or fetchCollaborativePlans() immediately
          // They might return stale data before the database has the new plan.
          // We already have fresh data from createPlan() API response and manually
          // added the plan to collaborativePlans. Delay all fetches to avoid
          // racing with optimistic state.
          setTimeout(() => {
            fetchPlans().catch(() => {});
            // Refresh user plan and collaborative plans after delay to ensure database consistency
            fetchUserPlan().catch(() => {});
            fetchCollaborativePlans().catch(() => {});
            // Refresh experience after other plan fetches to ensure canonical state
            fetchExperience().catch(() => {});
          }, Math.max(800, PLAN_EVENT_SUPPRESSION_MS));

          // Record that we handled a local plan event to block immediate API overwrites
          lastLocalPlanEventAtRef.current = Date.now();

          setActiveTab("myplan");
        } catch (planErr) {
          logger.error("Error creating plan", { 
            experienceId: experience._id,
            error: planErr.message
          }, planErr);
          // Revert on error
          setUserHasExperience(previousState);
          setShowDatePicker(true);
          handleError(planErr, { context: "Create plan" });
          return;
        }
        // Do NOT refresh the experience synchronously here — we schedule a
        // background refresh above after the suppression window. This avoids
        // overwriting optimistic UI state with a server response that may not
        // yet include the newly created plan.
      } catch (err) {
        // Revert on error
        setUserHasExperience(previousState);
        setShowDatePicker(true);
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

        // Suppress reacting to the immediate update event so our optimistic
        // displayed date isn't overwritten by a racing fetch
        suppressPlanEventsFor(PLAN_EVENT_SUPPRESSION_MS);

        // Update server
        await updatePlan(selectedPlanId, { planned_date: dateToSend });

        // Optimistically update displayed date immediately
        setDisplayedPlannedDate(dateToSend);

        // Refresh plans in background (delayed) so other views eventually
        // converge to canonical state without racing our optimistic UI
        setTimeout(() => {
          fetchUserPlan().catch(() => {});
          fetchCollaborativePlans().catch(() => {});
          fetchPlans().catch(() => {});
        }, 800);

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

          suppressPlanEventsFor(PLAN_EVENT_SUPPRESSION_MS);
          await updatePlan(userPlan._id, { planned_date: dateToSend });
          setDisplayedPlannedDate(dateToSend);
          setTimeout(() => {
            fetchUserPlan().catch(() => {});
            fetchCollaborativePlans().catch(() => {});
            fetchPlans().catch(() => {});
          }, 800);
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

          suppressPlanEventsFor(1200);
          await updatePlan(userPlan._id, { planned_date: dateToSend });
          setDisplayedPlannedDate(dateToSend);
          setTimeout(() => {
            fetchUserPlan().catch(() => {});
            fetchCollaborativePlans().catch(() => {});
            fetchPlans().catch(() => {});
          }, 800);
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
            experience.destination
              ? `, ${experience.destination.name}, ${experience.destination.country}`
              : ""
          }${
            experience.experience_type ? `, ${experience.experience_type}` : ""
          }`}
          ogTitle={`${experience.name}${
            experience.destination ? ` - ${experience.destination.name}` : ""
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
              <Mobile>
                <div style={{ textAlign: 'center' }}>
                  <h1 ref={h1Ref} className="mt-4 h fade-in">{experience.name}</h1>
                  {userHasExperience && !pendingUnplan && (
                    <FadeIn>
                      {displayedPlannedDate ? (
                        <TagPill
                          color="primary"
                          className="profile-pill cursor-pointer mb-2"
                          onClick={() => {
                            if (showDatePicker) {
                              setShowDatePicker(false);
                            } else {
                              setIsEditingDate(true);
                              setPlannedDate(formatDateForInput(displayedPlannedDate));
                              setShowDatePicker(true);
                            }
                          }}
                          title={showDatePicker ? "Click to close date picker" : "Click to edit planned date"}
                        >
                          Planned for {formatDateShort(displayedPlannedDate)}
                        </TagPill>
                      ) : (
                        <TagPill
                          color="primary"
                          className="cursor-pointer mb-2"
                          onClick={() => {
                            if (showDatePicker) {
                              setShowDatePicker(false);
                            } else {
                              setIsEditingDate(false);
                              setPlannedDate("");
                              setShowDatePicker(true);
                            }
                          }}
                          title={showDatePicker ? "Click to close date picker" : "Click to set a planned date"}
                        >
                          {lang.en.label.plannedDate}: {lang.en.label.setOneNow}
                        </TagPill>
                      )}
                    </FadeIn>
                  )}
                  <div className="experience-header-grid my-2">
                    {experience.cost_estimate > 0 && (
                      <FadeIn>
                        <h2 className="h5">
                          {lang.en.heading.estimatedCost}{" "}
                          <span className="green">
                            {dollarSigns(Math.ceil(experience.cost_estimate / 1000))}
                          </span>
                          <span className="grey">
                            {dollarSigns(
                              5 - Math.ceil(experience.cost_estimate / 1000)
                            )}
                          </span>
                        </h2>
                      </FadeIn>
                    )}
                    {experience.max_planning_days > 0 && (
                      <FadeIn>
                        <h2 className="h5">
                          {lang.en.heading.planningTime}{" "}
                          {experience.max_planning_days}{" "}
                          {experience.max_planning_days === 1 ? "day" : "days"}
                        </h2>
                      </FadeIn>
                    )}
                  </div>
                </div>
              </Mobile>
              <Desktop>
                <div style={{ textAlign: 'start' }}>
                  <h1 ref={h1Ref} className="mt-4 h fade-in">{experience.name}</h1>
                  {userHasExperience && !pendingUnplan && (
                    <FadeIn>
                      {displayedPlannedDate ? (
                        <TagPill
                          color="primary"
                          className="cursor-pointer mb-2"
                          onClick={() => {
                            if (showDatePicker) {
                              setShowDatePicker(false);
                            } else {
                              setIsEditingDate(true);
                              setPlannedDate(formatDateForInput(displayedPlannedDate));
                              setShowDatePicker(true);
                            }
                          }}
                          title={showDatePicker ? "Click to close date picker" : "Click to edit planned date"}
                        >
                          Planned for {formatDateShort(displayedPlannedDate)}
                        </TagPill>
                      ) : (
                        <TagPill
                          color="primary"
                          className="cursor-pointer mb-2"
                          onClick={() => {
                            if (showDatePicker) {
                              setShowDatePicker(false);
                            } else {
                              setIsEditingDate(false);
                              setPlannedDate("");
                              setShowDatePicker(true);
                            }
                          }}
                          title={showDatePicker ? "Click to close date picker" : "Click to set a planned date"}
                        >
                          {lang.en.label.plannedDate}: {lang.en.label.setOneNow}
                        </TagPill>
                      )}
                    </FadeIn>
                  )}
                  <div className="experience-header-grid my-2">
                    {experience.cost_estimate > 0 && (
                      <FadeIn>
                        <h2 className="h5">
                          {lang.en.heading.estimatedCost}{" "}
                          <span className="green">
                            {dollarSigns(Math.ceil(experience.cost_estimate / 1000))}
                          </span>
                          <span className="grey">
                            {dollarSigns(
                              5 - Math.ceil(experience.cost_estimate / 1000)
                            )}
                          </span>
                        </h2>
                      </FadeIn>
                    )}
                    {experience.max_planning_days > 0 && (
                      <FadeIn>
                        <h2 className="h5">
                          {lang.en.heading.planningTime}{" "}
                          {experience.max_planning_days}{" "}
                          {experience.max_planning_days === 1 ? "day" : "days"}
                        </h2>
                      </FadeIn>
                    )}
                  </div>
                </div>
              </Desktop>
            </div>
            <div className="d-flex col-md-6 justify-content-center justify-content-md-end align-items-center flex-row experience-actions">
              <FadeIn>
                <button
                  className={`btn btn-sm btn-icon my-1 my-sm-2 ${
                    userHasExperience ? "btn-plan-remove" : "btn-plan-add"
                  } ${loading ? "loading" : ""}`}
                  ref={planButtonRef}
                  style={planBtnWidth ? { width: `${planBtnWidth}px` } : undefined}
                  onClick={async () => {
                    if (loading) return;
                    setLoading(true);
                    await handleExperience();
                    setLoading(false);
                  }}
                  aria-label={
                    userHasExperience
                      ? lang.en.button.removeFavoriteExp
                      : lang.en.button.addFavoriteExp
                  }
                  aria-pressed={userHasExperience}
                  onMouseEnter={() => setFavHover(true)}
                  onMouseLeave={() => setFavHover(false)}
                  disabled={loading}
                  aria-busy={loading}
                >
                  {userHasExperience
                    ? favHover
                      ? lang.en.button.removeFavoriteExp
                      : lang.en.button.expPlanAdded
                    : lang.en.button.addFavoriteExp}
                </button>
              </FadeIn>
              {userHasExperience && (
                <FadeIn>
                  <button
                    className="btn btn-sm btn-icon my-1 my-sm-2 ms-2"
                    onClick={() => {
                      if (showDatePicker) {
                        setShowDatePicker(false);
                      } else {
                        setIsEditingDate(false);
                        setPlannedDate(
                          displayedPlannedDate
                            ? formatDateForInput(displayedPlannedDate)
                            : ""
                        );
                        setShowDatePicker(true);
                      }
                    }}
                    aria-label={lang.en.button.editDate}
                    title={lang.en.button.editDate}
                  >
                    📅
                  </button>
                </FadeIn>
              )}
              {isOwner(user, experience) && (
                <>
                  <FadeIn>
                    <button
                      className="btn btn-sm btn-icon my-1 my-sm-2 ms-2"
                      onClick={() =>
                        navigate(`/experiences/${experienceId}/update`)
                      }
                      aria-label={lang.en.button.updateExperience}
                      title={lang.en.button.updateExperience}
                    >
                      ✏️
                    </button>
                  </FadeIn>
                  <FadeIn>
                    <button
                      className="btn btn-sm btn-icon my-1 my-sm-2 ms-2"
                      onClick={() => setShowDeleteModal(true)}
                      aria-label={lang.en.button.delete}
                      title={lang.en.button.delete}
                    >
                      ❌
                    </button>
                  </FadeIn>
                </>
              )}
            </div>
            {showDatePicker && (
              <div className="row mt-3 date-picker-modal">
                <div className="col-12">
                  <Alert type="info" className="mb-0">
                    <h3 className="mb-3">
                      {isEditingDate
                        ? lang.en.heading.editPlannedDate
                        : lang.en.heading.planYourExperience}
                    </h3>
                    {experience.max_planning_days > 0 && (
                      <p className="mb-3">
                        {lang.en.helper.requiresDaysToPlan.replace(
                          "{days}",
                          experience.max_planning_days
                        )}
                      </p>
                    )}
                    <div className="mb-3">
                      <FormLabel htmlFor="plannedDate" className="h5">
                        {lang.en.label.whenDoYouWantExperience}
                      </FormLabel>
                      <FormControl
                        type="date"
                        id="plannedDate"
                        value={plannedDate}
                        onChange={(e) => setPlannedDate(e.target.value)}
                        onClick={(e) =>
                          e.target.showPicker && e.target.showPicker()
                        }
                        min={getMinimumPlanningDate(
                          experience.max_planning_days
                        )}
                      />
                      {plannedDate &&
                        experience.max_planning_days > 0 &&
                        !isValidPlannedDate(
                          plannedDate,
                          experience.max_planning_days
                        ) && (
                          <Alert
                            type="warning"
                            className="mt-2"
                            message={lang.en.alert.notEnoughTimeWarning}
                          />
                        )}
                    </div>
                    <button
                      className="btn btn-primary me-2"
                      onClick={() => handleDateUpdate()}
                      disabled={!plannedDate || loading}
                      aria-label={
                        isEditingDate
                          ? lang.en.button.updateDate
                          : lang.en.button.setDateAndAdd
                      }
                    >
                      {isEditingDate
                        ? lang.en.button.updateDate
                        : lang.en.button.setDateAndAdd}
                    </button>
                    {!isEditingDate && (
                      <button
                        className="btn btn-secondary me-2"
                        onClick={() => handleAddExperience({})}
                        aria-label={lang.en.button.skip}
                      >
                        {lang.en.button.skip}
                      </button>
                    )}
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        setShowDatePicker(false);
                        setIsEditingDate(false);
                        setPlannedDate("");
                      }}
                      aria-label={lang.en.button.cancel}
                    >
                      {lang.en.button.cancel}
                    </button>
                  </Alert>
                </div>
              </div>
            )}
          </div>
          <div className="row my-4 fade-in">
            <div className="col-md-6 p-3 fade-in">
              {/* Display experience photo (or placeholder if none available) */}
              <div className="mb-4">
                <PhotoCard
                  photos={experience.photos}
                  photo={experience.photo}
                  defaultPhotoIndex={experience.default_photo_index}
                  title={experience.name}
                  altText={`${experience.name}${
                    experience.destination
                      ? ` in ${experience.destination.name}`
                      : ""
                  }`}
                />
              </div>
            </div>
            <div className="col-md-6 p-3 fade-in">
              <div className="col-md-12 fade-in">
                <InfoCard
                  title={
                    !experience.destination ? (
                      <div className="loading-skeleton loading-skeleton-text" style={{ width: '70%', height: '1.5rem' }}></div>
                    ) : (
                      `${lang.en.label.destinationLabel}: ${experience.destination.name}`
                    )
                  }
                  titleLink={
                    experience.destination
                      ? `/destinations/${experience.destination._id}`
                      : null
                  }
                  sections={[
                    experience.experience_type && experience.experience_type.length > 0
                      ? {
                          title: lang.en.label.experienceType,
                          content: (
                            <div>
                              {experience.experience_type.map((type) => (
                                <TagPill key={type} className="experience-tag-pill" color="primary" size="sm" gradient={false} to={`/experience-types/${createUrlSlug(type)}`}>
                                  <span className="icon"><FaUser /></span>
                                  {type}
                                </TagPill>
                              ))}
                            </div>
                          ),
                        }
                      : null,
                    experience.description
                      ? {
                          title: lang.en.label.description,
                          content: <p>{experience.description}</p>,
                        }
                      : null,
                  ].filter(Boolean)}
                  map={
                    !experience.destination ? (
                      <div className="loading-skeleton loading-skeleton-rectangle" style={{ width: '100%', height: '300px', borderRadius: 'var(--radius-md)' }}></div>
                    ) : (
                      <GoogleMap
                        location={`${experience.destination.name}+${experience.destination.country}`}
                        height={300}
                        title={lang.en.helper.map}
                      />
                    )
                  }
                />
              </div>
            </div>
          </div>
          <div className="row my-2 p-3 fade-in">
            {experience.plan_items && experience.plan_items.length > 0 && (
              <div className="plan-items-container fade-in p-3 p-md-4">
                {/* Plan Navigation Tabs */}
                {debug.log(
                  "Rendering tabs. collaborativePlans:",
                  collaborativePlans,
                  "length:",
                  collaborativePlans.length
                ) || null}
                <div className="plan-tabs-nav mb-4">
                  <button
                    className={`plan-tab-button ${
                      activeTab === "experience" ? "active" : ""
                    }`}
                    onClick={() => setActiveTab("experience")}
                  >
                    {lang.en.heading.thePlan}
                  </button>
                  {plansLoading ? (
                    // Show loading state for plan tabs
                    <button className="plan-tab-button" disabled>
                      <Loading size="sm" variant="inline" showMessage={false} />
                    </button>
                  ) : (
                    (() => {
                      // Determine how many plans belong to others (collaborator plans)
                      const otherPlansCount = collaborativePlans.filter((plan) => {
                        const planUserId = plan.user?._id || plan.user;
                        return !idEquals(planUserId, user._id);
                      }).length;

                      // If there are multiple plans (user + collaborators OR multiple collaborators), show a select
                      if (collaborativePlans.length > 1 || otherPlansCount > 0) {
                        return (
                          <div className={`plan-tab-dropdown-container ${activeTab === 'myplan' ? 'active' : ''}`}>
                            <select
                              className={`plan-tab-button ${collaborativePlans.length > 1 ? 'plan-tab-select' : ''} ${
                                activeTab === "myplan" ? "active" : ""
                              }`}
                              value={selectedPlanId || ""}
                              onChange={(e) => {
                                handlePlanChange(e.target.value);
                                setActiveTab("myplan");
                              }}
                              onClick={() => setActiveTab("myplan")}
                            >
                              {collaborativePlans.map((plan) => {
                                const planUserId = plan.user?._id || plan.user;
                                const isOwnPlan = idEquals(planUserId, user._id);
                                let displayName = "Plan";

                                if (isOwnPlan) {
                                  displayName = "My Plan";
                                } else if (plan.user?.name) {
                                  const firstName = plan.user.name.split(' ')[0];
                                  displayName = `${firstName}'s Plan`;
                                }

                                const optionValue = plan._id && plan._id.toString ? plan._id.toString() : plan._id;

                                return (
                                  <option key={optionValue} value={optionValue}>
                                    {displayName}
                                  </option>
                                );
                              })}
                            </select>
                            {/* Inline caret SVG for reliable cross-browser rendering */}
                            <span className="plan-tab-caret" aria-hidden="true">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                <polyline points="6 9 12 15 18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                              </svg>
                            </span>
                          </div>
                        );
                      }

                      // Otherwise, render a simple button for the (single) user's plan
                      if (collaborativePlans.length === 1) {
                        const onlyPlan = collaborativePlans[0];
                        const planUserId = onlyPlan.user?._id || onlyPlan.user;
                        const isOwnPlan = idEquals(planUserId, user._id);
                        // Only show the button if it's the user's own plan
                        if (isOwnPlan) {
                          return (
                            <button
                              className={`plan-tab-button ${activeTab === "myplan" ? "active" : ""}`}
                              onClick={() => {
                                setSelectedPlanId(onlyPlan._id && onlyPlan._id.toString ? onlyPlan._id.toString() : onlyPlan._id);
                                setActiveTab("myplan");
                              }}
                            >
                              My Plan
                            </button>
                          );
                        }
                      }

                      // No plans available - render nothing
                      return null;
                    })()
                  )}
                </div>

                {/* Experience Plan Items Tab Content */}
                {activeTab === "experience" && (
                  <div className="experience-plan-view mt-4">
                    {/* Collaborators and Action Buttons Row */}
                    <div className="plan-header-row mb-4">
                      {/* Collaborators Display - Left Side */}
                      <UsersListDisplay
                        owner={experienceOwner}
                        users={experienceCollaborators}
                        messageKey="CreatingPlan"
                        loading={
                          experienceOwnerLoading ||
                          experienceCollaboratorsLoading
                        }
                        reserveSpace={true}
                      />

                      {/* Action Buttons - Right Side */}
                      {isOwner(user, experience) && (
                        <div className="plan-action-buttons">
                          <button
                            className="btn btn-primary"
                            onClick={() => handleAddExperiencePlanItem()}
                          >
                            <BsPlusCircle className="me-2" />
                            {lang.en.button.addPlanItem}
                          </button>
                          <button
                            className="btn btn-primary"
                            onClick={() => openCollaboratorModal("experience")}
                          >
                            <FaUserPlus className="me-2" />
                            {lang.en.button.addCollaborators}
                          </button>
                        </div>
                      )}
                    </div>
                    {(() => {
                      // Helper to flatten and mark children
                      const flattenPlanItems = (items) => {
                        const result = [];
                        const addItem = (item, isChild = false) => {
                          const isVisible =
                            !isChild ||
                            (expandedParents.has(item.parent) &&
                              animatingCollapse !== item.parent);
                          result.push({ ...item, isChild, isVisible });
                          items
                            .filter(
                              (sub) =>
                                sub.parent &&
                                sub.parent.toString() === item._id.toString()
                            )
                            .forEach((sub) => addItem(sub, true));
                        };
                        items
                          .filter((item) => !item.parent)
                          .forEach((item) => addItem(item, false));
                        return result;
                      };
                      const flattenedItems = flattenPlanItems(
                        experience.plan_items
                      );
                      const itemsToRender = flattenedItems.filter(
                        (item) =>
                          item.isVisible ||
                          (item.isChild && animatingCollapse === item.parent)
                      );
                      return itemsToRender.map((planItem) => (
                        <div
                          key={planItem._id}
                          className={`plan-item-card mb-3 overflow-hidden ${
                            planItem.isVisible ? "" : "collapsed"
                          }`}
                        >
                          <div className="plan-item-header p-3 p-md-4">
                            <div className="plan-item-tree">
                              {!planItem.isChild ? (
                                (() => {
                                  const hasChildren =
                                    experience.plan_items.some(
                                      (sub) =>
                                        sub.parent &&
                                        sub.parent.toString() ===
                                          planItem._id.toString()
                                    );
                                  if (hasChildren) {
                                    return (
                                      <button
                                        className="btn btn-sm btn-link p-0 expand-toggle"
                                        onClick={() =>
                                          toggleExpanded(planItem._id)
                                        }
                                      >
                                        {expandedParents.has(planItem._id)
                                          ? "▼"
                                          : "▶"}
                                      </button>
                                    );
                                  } else {
                                    return (
                                      <span className="no-child-arrow">•</span>
                                    );
                                  }
                                })()
                              ) : (
                                <span className="child-arrow">↳</span>
                              )}
                            </div>
                            <div className="plan-item-title flex-grow-1 fw-semibold fs-5">
                              {planItem.url ? (
                                <Link
                                  to={planItem.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {planItem.text}
                                </Link>
                              ) : (
                                <span>{planItem.text}</span>
                              )}
                            </div>
                            <div className="plan-item-actions">
                              {isOwner(user, experience) && (
                                <div className="d-flex gap-1">
                                  {!planItem.parent && (
                                    <button
                                      className="btn btn-outline-primary btn-sm"
                                      onClick={() =>
                                        handleAddExperiencePlanItem(
                                          planItem._id
                                        )
                                      }
                                      aria-label={`${lang.en.button.addChild} to ${planItem.text}`}
                                      title={lang.en.button.addChild}
                                    >
                                      ✚
                                    </button>
                                  )}
                                  <button
                                    className="btn btn-outline-secondary btn-sm"
                                    onClick={() =>
                                      handleEditExperiencePlanItem(planItem)
                                    }
                                    aria-label={`${lang.en.button.edit} ${planItem.text}`}
                                    title={lang.en.tooltip.edit}
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    className="btn btn-outline-danger btn-sm"
                                    onClick={() => {
                                      setPlanItemToDelete(planItem._id);
                                      setShowPlanDeleteModal(true);
                                    }}
                                    aria-label={`${lang.en.button.delete} ${planItem.text}`}
                                    title={lang.en.tooltip.delete}
                                  >
                                    ✖️
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="plan-item-details p-2 p-md-3">
                            {(Number(planItem.cost_estimate) > 0 ||
                              Number(planItem.planning_days) > 0) && (
                              <div className="plan-item-meta">
                                {Number(planItem.cost_estimate) > 0 && (
                                  <span className="d-flex align-items-center gap-2">
                                    <Text as="span" size="sm" weight="semibold" className="me-1 text-muted">{lang.en.label.cost}</Text>
                                    {formatCurrency(planItem.cost_estimate)}
                                  </span>
                                )}
                                {Number(planItem.planning_days) > 0 && (
                                  <span className="d-flex align-items-center gap-2">
                                    <Text as="span" size="sm" weight="semibold" className="me-1 text-muted">{lang.en.label.planningDays}</Text>
                                    {planItem.planning_days}{" "}
                                    {planItem.planning_days === 1 ? lang.en.label.day : lang.en.label.days}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                )}

                {/* My Plan Tab Content */}
                {activeTab === "myplan" && selectedPlanId && (
                  <div className="my-plan-view mt-4">
                    {/* Show loading indicator when we detected a hash deep-link and plans are still loading */}
                    {hashSelecting && (
                      <div className="mb-3">
                        <Loading size="md" message={lang.en.label.loadingPlan || 'Loading plan...'} showMessage={true} />
                      </div>
                    )}
                    {/* Alert Area - For all plan-related alerts */}
                    {showSyncButton && showSyncAlert && (
                      <Alert
                        type="warning"
                        dismissible={true}
                        onDismiss={dismissSyncAlert}
                        title={lang.en.alert.planOutOfSync}
                        message={lang.en.alert.planOutOfSyncMessage}
                        className="mb-4"
                      />
                    )}

                    {/* Collaborators and Action Buttons Row */}
                    {(() => {
                      const currentPlan = collaborativePlans.find(
                        (p) => idEquals(p._id, selectedPlanId)
                      );

                      const isPlanOwner = planOwner && idEquals(planOwner._id, user._id);
                      const isPlanCollaborator =
                        currentPlan &&
                        currentPlan.permissions?.some(
                          (p) => idEquals(p._id, user._id) && ["owner", "collaborator"].includes(p.type)
                        );
                      const canEdit = isPlanOwner || isPlanCollaborator;

                      return (
                        <div className="plan-header-row mb-4">
                          {/* Collaborators Display - Left Side */}
                          <UsersListDisplay
                            owner={planOwner}
                            users={planCollaborators}
                            messageKey="PlanningExperience"
                            loading={
                              planOwnerLoading || planCollaboratorsLoading
                            }
                            reserveSpace={true}
                          />

                          {/* Action Buttons - Right Side */}
                          <div className="plan-action-buttons">
                            {canEdit && (
                              <button
                                className="btn btn-primary"
                                onClick={() => handleAddPlanInstanceItem()}
                              >
                                <BsPlusCircle className="me-2" />
                                {lang.en.button.addPlanItem}
                              </button>
                            )}
                            {isPlanOwner && (
                              <button
                                className="btn btn-primary"
                                onClick={() => openCollaboratorModal("plan")}
                              >
                                <BsPersonPlus className="me-2" />
                                {lang.en.button.addCollaborator}
                              </button>
                            )}
                            {showSyncButton && (
                              <button
                                className="btn btn-primary"
                                onClick={handleSyncPlan}
                                disabled={loading}
                                title={lang.en.tooltip.syncPlan}
                              >
                                {loading
                                  ? lang.en.button.syncing
                                  : lang.en.button.syncNow}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                    {(() => {
                      const currentPlan = collaborativePlans.find(
                        (p) => idEquals(p._id, selectedPlanId)
                      );
                      if (!currentPlan) {
                        return (
                          <p style={{ color: 'var(--bs-gray-600)', textAlign: 'center' }}>
                            {lang.en.alert.planNotFound}
                          </p>
                        );
                      }

                      // Plan metadata
                      const planMetadata = (
                        <div className="plan-metrics-container mb-4">
                          <div className="row g-3">
                            {/* Planned Date Card */}
                            <div className="col-md-3 col-sm-6">
                              <div className="metric-card">
                                <div className="metric-header">
                                  <span className="metric-title">
                                    {lang.en.label.plannedDate}
                                  </span>
                                </div>
                                <div
                                  className="metric-value"
                                  ref={plannedDateRef}
                                >
                                  {currentPlan.planned_date ? (
                                    formatDateMetricCard(
                                      currentPlan.planned_date
                                    )
                                  ) : (
                                    <span
                                      className="set-date-link"
                                      onClick={() => {
                                        setIsEditingDate(true);
                                        setPlannedDate(
                                          displayedPlannedDate
                                            ? formatDateForInput(
                                                displayedPlannedDate
                                              )
                                            : ""
                                        );
                                        setShowDatePicker(true);
                                        // Scroll to date picker
                                        setTimeout(() => {
                                          const datePicker =
                                            document.querySelector(
                                              ".date-picker-modal"
                                            );
                                          if (datePicker) {
                                            datePicker.scrollIntoView({
                                              behavior: "smooth",
                                              block: "center",
                                            });
                                          }
                                        }, 100);
                                      }}
                                      title={lang.en.tooltip.setPlannedDate}
                                    >
                                      {lang.en.label.setOneNow}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Total Cost Card */}
                            <div className="col-md-3 col-sm-6">
                              <div className="metric-card">
                                <div className="metric-header">
                                  <span className="metric-title">
                                    {lang.en.label.totalCost}
                                  </span>
                                </div>
                                <div className="metric-value">
                                  {formatCurrency(currentPlan.total_cost || 0)}
                                </div>
                              </div>
                            </div>

                            {/* Completion Card */}
                            <div className="col-md-3 col-sm-6">
                              <div className="metric-card">
                                <div className="metric-header">
                                  <span className="metric-title">
                                    {lang.en.label.completion}
                                  </span>
                                </div>
                                <div className="metric-value">
                                  {currentPlan.completion_percentage || 0}%
                                </div>
                              </div>
                            </div>

                            {/* Planning Time Card */}
                            <div className="col-md-3 col-sm-6">
                              <div className="metric-card">
                                <div className="metric-header">
                                  <span className="metric-title">
                                    {lang.en.label.planningTime}
                                  </span>
                                </div>
                                <div className="metric-value">
                                  {currentPlan.max_days || 0}{" "}
                                  {(currentPlan.max_days || 0) === 1
                                    ? lang.en.label.day
                                    : lang.en.label.days}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );

                      // Helper to flatten and mark children (same as Experience Plan Items)
                      const flattenPlanItems = (items) => {
                        const result = [];
                        const addItem = (item, isChild = false) => {
                          const isVisible =
                            !isChild ||
                            (expandedParents.has(item.parent) &&
                              animatingCollapse !== item.parent);
                          result.push({ ...item, isChild, isVisible });

                          // Debug logging
                          if (item.parent) {
                            debug.log(
                              `Item with parent: "${item.text}", parent: ${item.parent}, plan_item_id: ${item.plan_item_id}, _id: ${item._id}`
                            );
                          }

                          items
                            .filter(
                              (sub) =>
                                sub.parent &&
                                sub.parent.toString() ===
                                  (item.plan_item_id || item._id).toString()
                            )
                            .forEach((sub) => addItem(sub, true));
                        };
                        items
                          .filter((item) => !item.parent)
                          .forEach((item) => addItem(item, false));
                        return result;
                      };

                      if (!currentPlan.plan || currentPlan.plan.length === 0) {
                        return (
                          <>
                            {planMetadata}
                            <p style={{ color: 'var(--bs-gray-600)', textAlign: 'center' }}>
                              {lang.en.alert.noPlanItems}
                            </p>
                          </>
                        );
                      }

                      const flattenedItems = flattenPlanItems(currentPlan.plan);
                      const itemsToRender = flattenedItems.filter(
                        (item) =>
                          item.isVisible ||
                          (item.isChild && animatingCollapse === item.parent)
                      );

                      return (
                        <>
                          {planMetadata}
                          {itemsToRender.map((planItem) => (
                            <div
                              key={planItem.plan_item_id || planItem._id}
                              className={`plan-item-card mb-3 overflow-hidden ${
                                planItem.isVisible ? "" : "collapsed"
                              }`}
                            >
                              <div className="plan-item-header p-3 p-md-4">
                                <div className="plan-item-tree">
                                  {!planItem.isChild ? (
                                    (() => {
                                      const hasChildren = currentPlan.plan.some(
                                        (sub) =>
                                          sub.parent &&
                                          sub.parent.toString() ===
                                            (
                                              planItem.plan_item_id ||
                                              planItem._id
                                            ).toString()
                                      );
                                      if (hasChildren) {
                                        return (
                                          <button
                                            className="btn btn-sm btn-link p-0 expand-toggle"
                                            onClick={() =>
                                              toggleExpanded(
                                                planItem.plan_item_id ||
                                                  planItem._id
                                              )
                                            }
                                          >
                                            {expandedParents.has(
                                              planItem.plan_item_id ||
                                                planItem._id
                                            )
                                              ? "▼"
                                              : "▶"}
                                          </button>
                                        );
                                      } else {
                                        return (
                                          <span className="no-child-arrow">
                                            •
                                          </span>
                                        );
                                      }
                                    })()
                                  ) : (
                                    <span className="child-arrow">↳</span>
                                  )}
                                </div>
                                <div className="plan-item-title flex-grow-1 fw-semibold fs-5">
                                  {planItem.url ? (
                                    <Link
                                      to={planItem.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      {planItem.text}
                                    </Link>
                                  ) : (
                                    <span>{planItem.text}</span>
                                  )}
                                </div>
                                <div className="plan-item-actions">
                                  {(() => {
                                    // Get plan owner for permission checks
                                    let planOwner = currentPlan?.user;
                                    if (!planOwner) {
                                      const ownerPermission =
                                        currentPlan?.permissions?.find(
                                          (p) => p.type === "owner"
                                        );
                                      if (ownerPermission?.user) {
                                        planOwner = ownerPermission.user;
                                      }
                                      // Don't create fake user objects - leave planOwner as undefined if no valid user data
                                    }

                                    // Check if user can edit this plan (owner or collaborator)
                                    const canEditPlan =
                                      currentPlan &&
                                      ((planOwner && idEquals(planOwner._id, user._id)) ||
                                        currentPlan.permissions?.some((p) =>
                                          idEquals(p._id, user._id) && ["owner", "collaborator"].includes(p.type)
                                        ));

                                    return (
                                      <div className="d-flex gap-1">
                                        {canEditPlan && !planItem.parent && (
                                          <button
                                            className="btn btn-outline-primary btn-sm"
                                            onClick={() =>
                                              handleAddPlanInstanceItem(
                                                planItem.plan_item_id ||
                                                  planItem._id
                                              )
                                            }
                                            aria-label={`${lang.en.button.addChild} to ${planItem.text}`}
                                            title={lang.en.button.addChild}
                                          >
                                            ✚
                                          </button>
                                        )}
                                        {canEditPlan && (
                                          <>
                                            <button
                                              className="btn btn-outline-secondary btn-sm"
                                              onClick={() =>
                                                handleEditPlanInstanceItem(
                                                  planItem
                                                )
                                              }
                                              aria-label={`${lang.en.button.edit} ${planItem.text}`}
                                              title={lang.en.tooltip.edit}
                                            >
                                              ✏️
                                            </button>
                                            <button
                                              className="btn btn-outline-danger btn-sm"
                                              onClick={() => {
                                                setPlanInstanceItemToDelete(
                                                  planItem
                                                );
                                                setShowPlanInstanceDeleteModal(
                                                  true
                                                );
                                              }}
                                              aria-label={`${lang.en.button.delete} ${planItem.text}`}
                                              title={lang.en.tooltip.delete}
                                            >
                                              🗑️
                                            </button>
                                          </>
                                        )}
                                        <button
                                          className={`btn btn-sm ${
                                            planItem.complete
                                              ? "btn-success"
                                              : "btn-outline-success"
                                          }`}
                                          type="button"
                                          onClick={async () => {
                                            try {
                                              const itemId =
                                                planItem._id ||
                                                planItem.plan_item_id;
                                              await updatePlanItem(
                                                selectedPlanId,
                                                itemId,
                                                {
                                                  complete: !planItem.complete,
                                                }
                                              );
                                              await fetchCollaborativePlans();
                                              await fetchUserPlan();
                                              await fetchPlans(); // Refresh global plans state
                                            } catch (err) {
                                              const errorMsg = handleError(err, {
                                                context:
                                                  "Toggle plan item completion",
                                              });
                                              showError(errorMsg);
                                            }
                                          }}
                                          onMouseEnter={() =>
                                            setHoveredPlanItem(
                                              planItem._id ||
                                                planItem.plan_item_id
                                            )
                                          }
                                          onMouseLeave={() =>
                                            setHoveredPlanItem(null)
                                          }
                                          aria-label={
                                            planItem.complete
                                              ? `${lang.en.button.undoComplete} ${planItem.text}`
                                              : `${lang.en.button.markComplete} ${planItem.text}`
                                          }
                                          aria-pressed={!!planItem.complete}
                                          title={
                                            planItem.complete
                                              ? lang.en.button.undoComplete
                                              : lang.en.button.markComplete
                                          }
                                        >
                                          {planItem.complete
                                            ? hoveredPlanItem ===
                                              (planItem._id ||
                                                planItem.plan_item_id)
                                              ? lang.en.button.undoComplete
                                              : lang.en.button.done
                                            : lang.en.button.markComplete}
                                        </button>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                              <div className="plan-item-details p-2 p-md-3">
                                {(Number(planItem.cost) > 0 ||
                                  Number(planItem.planning_days) > 0) && (
                                  <div className="plan-item-meta">
                                    {Number(planItem.cost) > 0 && (
                                      <span className="d-flex align-items-center gap-2">
                                        <Text as="span" size="sm" weight="semibold" className="me-1 text-muted">{lang.en.label.cost}</Text>
                                        {formatCurrency(planItem.cost)}
                                      </span>
                                    )}
                                    {Number(planItem.planning_days) > 0 && (
                                      <span className="d-flex align-items-center gap-2">
                                        <Text as="span" size="sm" weight="semibold" className="me-1 text-muted">{lang.en.label.planningDays}</Text>
                                        {planItem.planning_days}{" "}
                                        {planItem.planning_days === 1 ? lang.en.label.day : lang.en.label.days}
                                      </span>
                                    )}
                                  </div>
                                )}
                                {/* Temporarily hiding photos in My Plan
                                {planItem.photo && (
                                  <div className="mt-2">
                                    <PhotoCard
                                      photo={planItem.photo}
                                      user={user}
                                      showModal={() => {}}
                                    />
                                  </div>
                                )}
                                */}
                              </div>
                            </div>
                          ))}
                        </>
                      );
                    })()}
                  </div>
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
      <Modal
        show={showCollaboratorModal}
        onClose={() => {
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
        title={
          collaboratorContext === "experience"
            ? lang.en.modal.addCollaboratorToExperience
            : lang.en.modal.addCollaboratorToPlan
        }
        dialogClassName="responsive-modal-dialog"
        footer={
          collaboratorAddSuccess ? (
            // Success footer
            <div className="modal-footer justify-content-center">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => {
                  setCollaboratorAddSuccess(false);
                  setAddedCollaborators([]);
                  setActuallyRemovedCollaborators([]);
                  openCollaboratorModal(collaboratorContext);
                }}
              >
                Manage More
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
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
              >
                Done
              </button>
            </div>
          ) : (
            // Form footer
            <div className="modal-footer justify-content-center">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
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
                disabled={loading}
              >
                {lang.en.button.cancel}
              </button>
              <button
                type="submit"
                form="addCollaboratorForm"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? lang.en.button.saving : lang.en.button.saveChanges}
              </button>
            </div>
          )
        }
      >
        {collaboratorAddSuccess ? (
          // Success message view
          <div style={{ textAlign: 'center', paddingTop: '3rem', paddingBottom: '3rem' }}>
            <div className="mb-3">
              <BsCheckCircleFill style={{ color: 'var(--bs-success)' }} size={64} />
            </div>
            <h4>{lang.en.alert.changesSavedSuccessfully}</h4>

            {/* Show added collaborators */}
            {addedCollaborators.length > 0 && (
              <div className="mb-3">
                <p style={{ color: 'var(--bs-gray-600)' }} className="mb-2">
                  <strong>
                    {lang.en.alert.addedCollaborators
                      .replace("{count}", addedCollaborators.length)
                      .replace(
                        "{plural}",
                        addedCollaborators.length > 1 ? "s" : ""
                      )}
                  </strong>
                </p>
                <ul className="list-unstyled">
                  {addedCollaborators.map((collab) => (
                    <li key={collab._id} style={{ color: 'var(--bs-success)' }}>
                      ✓ {collab.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Show removed collaborators */}
            {actuallyRemovedCollaborators.length > 0 && (
              <div className="mb-3">
                <p style={{ color: 'var(--bs-gray-600)' }} className="mb-2">
                  <strong>
                    {lang.en.alert.removedCollaborators
                      .replace("{count}", actuallyRemovedCollaborators.length)
                      .replace(
                        "{plural}",
                        actuallyRemovedCollaborators.length > 1 ? "s" : ""
                      )}
                  </strong>
                </p>
                <ul className="list-unstyled">
                  {actuallyRemovedCollaborators.map((collab) => (
                    <li key={collab._id} style={{ color: 'var(--bs-danger)' }}>
                      ✗ {collab.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {addedCollaborators.length === 0 &&
              actuallyRemovedCollaborators.length === 0 && (
                <p style={{ color: 'var(--bs-gray-600)' }}>{lang.en.alert.noChangesMade}</p>
              )}
          </div>
        ) : (
          // Form view
          <form
            id="addCollaboratorForm"
            className="collaborator-modal-form"
            onSubmit={handleAddCollaborator}
          >
            <p style={{ color: 'var(--bs-gray-600)' }} className="mb-3">
              {lang.en.alert.searchCollaboratorsHelp.replace(
                "{context}",
                collaboratorContext
              )}
            </p>

            {/* Selected Collaborators Display */}
            {selectedCollaborators.length > 0 && (
              <div className="mb-3">
                <FormLabel>
                  {lang.en.label.selectedCollaborators}
                </FormLabel>
                <div className="d-flex flex-wrap gap-2">
                  {selectedCollaborators.map((collaborator) => (
                    <div
                      key={collaborator._id}
                      className="badge bg-primary d-flex align-items-center gap-2 p-2 collaborator-badge"
                    >
                      <span>{collaborator.name}</span>
                      <button
                        type="button"
                        className="btn btn-link p-0 collaborator-remove-btn"
                        style={{ color: 'var(--bs-white)' }}
                        onClick={() =>
                          handleRemoveSelectedCollaborator(collaborator._id)
                        }
                        title={`Remove ${collaborator.name}`}
                      >
                        <FaTimes />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-3 position-relative">
              <FormLabel htmlFor="collaboratorSearch">
                Search User
              </FormLabel>
              <FormControl
                type="text"
                id="collaboratorSearch"
                value={collaboratorSearch}
                onChange={(e) => handleSearchUsers(e.target.value)}
                placeholder={lang.en.placeholder.searchNameOrEmail}
                autoComplete="off"
              />
              {searchResults.length > 0 && (
                <div
                  className="position-absolute w-100 mt-1 bg-white border rounded shadow-sm search-results-dropdown"
                >
                  {searchResults.map((user) => (
                    <button
                      key={user._id}
                      type="button"
                      className="btn btn-light w-100 border-0 rounded-0"
                      style={{ textAlign: 'start' }}
                      onClick={() => handleSelectUser(user)}
                    >
                      <div className="fw-semibold">{user.name}</div>
                      <small style={{ color: 'var(--bs-gray-600)' }}>{user.email}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Email Invite Toggle */}
            <div className="mb-3">
              <button
                type="button"
                className="btn btn-link"
                style={{ textDecoration: 'none' }}
                onClick={() => {
                  setShowEmailInviteForm(!showEmailInviteForm);
                  setEmailInviteError("");
                }}
              >
                {showEmailInviteForm
                  ? "← Back to search"
                  : "✉ Invite via email (for non-users)"}
              </button>
            </div>

            {/* Email Invite Form */}
            {showEmailInviteForm && (
        <div className="border rounded p-3 mb-3 bg-color-tertiary">
                <h6 className="mb-3">Send Email Invite</h6>

                {emailInviteError && (
                  <Alert
                    type="danger"
                    dismissible
                    onClose={() => setEmailInviteError("")}
                  >
                    {emailInviteError}
                  </Alert>
                )}

                <div className="mb-3">
                  <FormLabel htmlFor="inviteEmail">
                    Email Address
                  </FormLabel>
                  <FormControl
                    type="email"
                    id="inviteEmail"
                    value={emailInviteData.email}
                    onChange={(e) =>
                      setEmailInviteData((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    placeholder={lang.en.placeholder.collaboratorEmail}
                  />
                </div>

                <div className="mb-3">
                  <FormLabel htmlFor="inviteName">
                    Full Name
                  </FormLabel>
                  <FormControl
                    type="text"
                    id="inviteName"
                    value={emailInviteData.name}
                    onChange={(e) =>
                      setEmailInviteData((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    placeholder="Collaborator's name"
                  />
                </div>

                <div className="alert alert-info mb-3">
                  <small>
                    We'll send an email to{" "}
                    <strong>{emailInviteData.email || "this address"}</strong>{" "}
                    inviting them to join Biensperience and collaborate on{" "}
                    <strong>{experience?.title || "this experience"}</strong>.
                  </small>
                </div>

                <button
                  type="button"
                  className="btn btn-primary w-100"
                  onClick={handleSendEmailInvite}
                  disabled={
                    emailInviteSending ||
                    !emailInviteData.email.trim() ||
                    !emailInviteData.name.trim()
                  }
                >
                  {emailInviteSending ? "Sending..." : "Send Email Invite"}
                </button>
              </div>
            )}
          </form>
        )}
      </Modal>

      {/* Sync Plan Modal */}
      {showSyncModal && syncChanges && (
        <Modal
          show={true}
          onClose={() => {
            setShowSyncModal(false);
            setSyncChanges(null);
          }}
          title={lang.en.modal.syncPlanTitle}
          dialogClassName="responsive-modal-dialog"
          scrollable={true}
          submitText="Confirm Sync"
          cancelText={lang.en.button.cancel}
          onSubmit={confirmSyncPlan}
          loading={loading}
          disableSubmit={
            selectedSyncItems.added.length === 0 &&
            selectedSyncItems.removed.length === 0 &&
            selectedSyncItems.modified.length === 0
          }
        >
          <>
            <p style={{ color: 'var(--bs-gray-600)' }} className="mb-3">
              {lang.en.alert.selectChangesToApply}
            </p>

            {/* Added Items */}
            {syncChanges.added.length > 0 && (
              <div className="mb-4">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 style={{ color: 'var(--bs-success)' }} className="mb-0">
                    <strong>
                      {lang.en.label.addedItems.replace(
                        "{count}",
                        syncChanges.added.length
                      )}
                    </strong>
                  </h6>
                  <div className="form-check sync-modal-select-all">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="selectAllAdded"
                      checked={
                        selectedSyncItems.added.length ===
                        syncChanges.added.length
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedSyncItems((prev) => ({
                            ...prev,
                            added: syncChanges.added.map((_, idx) => idx),
                          }));
                        } else {
                          setSelectedSyncItems((prev) => ({
                            ...prev,
                            added: [],
                          }));
                        }
                      }}
                    />
                    <label
                      className="form-check-label"
                      htmlFor="selectAllAdded"
                    >
                      {lang.en.label.selectAll}
                    </label>
                  </div>
                </div>
                <div className="list-group">
                  {syncChanges.added.map((item, idx) => (
                    <div key={idx} className="list-group-item">
                      <div className="d-flex align-items-start">
                        <div className="form-check me-3 mt-1">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={`add-${idx}`}
                            checked={selectedSyncItems.added.includes(idx)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedSyncItems((prev) => ({
                                  ...prev,
                                  added: [...prev.added, idx],
                                }));
                              } else {
                                setSelectedSyncItems((prev) => ({
                                  ...prev,
                                  added: prev.added.filter((i) => i !== idx),
                                }));
                              }
                            }}
                          />
                        </div>
                        <div className="flex-grow-1">
                          <strong>{item.text}</strong>
                          {item.url && (
                            <div className="small" style={{ color: 'var(--bs-gray-600)' }}>
                              URL:{" "}
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {item.url}
                              </a>
                            </div>
                          )}
                        </div>
                        <div className="ms-2" style={{ textAlign: 'end' }}>
                          {item.cost > 0 && (
                            <div className="badge bg-secondary">
                              {formatCurrency(item.cost)}
                            </div>
                          )}
                          {item.planning_days > 0 && (
                            <div className="badge bg-info ms-1">
                              {item.planning_days}{" "}
                              {item.planning_days === 1 ? "day" : "days"}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Removed Items */}
            {syncChanges.removed.length > 0 && (
              <div className="mb-4">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 style={{ color: 'var(--bs-danger)' }} className="mb-0">
                    <strong>
                      {lang.en.label.removedItems.replace(
                        "{count}",
                        syncChanges.removed.length
                      )}
                    </strong>
                  </h6>
                  <div className="form-check sync-modal-select-all">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="selectAllRemoved"
                      checked={
                        selectedSyncItems.removed.length ===
                        syncChanges.removed.length
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedSyncItems((prev) => ({
                            ...prev,
                            removed: syncChanges.removed.map((_, idx) => idx),
                          }));
                        } else {
                          setSelectedSyncItems((prev) => ({
                            ...prev,
                            removed: [],
                          }));
                        }
                      }}
                    />
                    <label
                      className="form-check-label"
                      htmlFor="selectAllRemoved"
                    >
                      {lang.en.label.selectAll}
                    </label>
                  </div>
                </div>
                <div className="list-group">
                  {syncChanges.removed.map((item, idx) => (
                    <div
                      key={idx}
                      className="list-group-item list-group-item-danger"
                    >
                      <div className="d-flex align-items-start">
                        <div className="form-check me-3 mt-1">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={`remove-${idx}`}
                            checked={selectedSyncItems.removed.includes(idx)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedSyncItems((prev) => ({
                                  ...prev,
                                  removed: [...prev.removed, idx],
                                }));
                              } else {
                                setSelectedSyncItems((prev) => ({
                                  ...prev,
                                  removed: prev.removed.filter(
                                    (i) => i !== idx
                                  ),
                                }));
                              }
                            }}
                          />
                        </div>
                        <div className="flex-grow-1">
                          <strong>{item.text}</strong>
                          {item.url && (
                            <div className="small" style={{ color: 'var(--bs-gray-600)' }}>
                              URL: {item.url}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modified Items */}
            {syncChanges.modified.length > 0 && (
              <div className="mb-4">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 style={{ color: 'var(--bs-warning)' }} className="mb-0">
                    <strong>
                      {lang.en.label.modifiedItems.replace(
                        "{count}",
                        syncChanges.modified.length
                      )}
                    </strong>
                  </h6>
                  <div className="form-check sync-modal-select-all">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="selectAllModified"
                      checked={
                        selectedSyncItems.modified.length ===
                        syncChanges.modified.length
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedSyncItems((prev) => ({
                            ...prev,
                            modified: syncChanges.modified.map((_, idx) => idx),
                          }));
                        } else {
                          setSelectedSyncItems((prev) => ({
                            ...prev,
                            modified: [],
                          }));
                        }
                      }}
                    />
                    <label
                      className="form-check-label"
                      htmlFor="selectAllModified"
                    >
                      {lang.en.label.selectAll}
                    </label>
                  </div>
                </div>
                <div className="list-group">
                  {syncChanges.modified.map((item, idx) => (
                    <div key={idx} className="list-group-item">
                      <div className="d-flex align-items-start">
                        <div className="form-check me-3 mt-1">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={`modify-${idx}`}
                            checked={selectedSyncItems.modified.includes(idx)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedSyncItems((prev) => ({
                                  ...prev,
                                  modified: [...prev.modified, idx],
                                }));
                              } else {
                                setSelectedSyncItems((prev) => ({
                                  ...prev,
                                  modified: prev.modified.filter(
                                    (i) => i !== idx
                                  ),
                                }));
                              }
                            }}
                          />
                        </div>
                        <div className="flex-grow-1">
                          <strong className="d-block mb-2">{item.text}</strong>
                          {item.modifications.map((mod, modIdx) => (
                            <div key={modIdx} className="small mb-1">
                              <span className="badge bg-warning me-2" style={{ color: 'var(--bs-dark)' }}>
                                {mod.field}
                              </span>
                              <span className="me-2" style={{ textDecoration: 'line-through', color: 'var(--bs-gray-600)' }}>
                                {mod.field === "cost"
                                  ? `$${(mod.old || 0).toLocaleString("en-US", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}`
                                  : mod.field === "days"
                                  ? `${mod.old || 0} ${
                                      (mod.old || 0) === 1 ? "day" : "days"
                                    }`
                                  : mod.old || "(empty)"}
                              </span>
                              →
                              <span className="ms-2" style={{ color: 'var(--bs-success)' }}>
                                {mod.field === "cost"
                                  ? `$${(mod.new || 0).toLocaleString("en-US", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}`
                                  : mod.field === "days"
                                  ? `${mod.new || 0} ${
                                      (mod.new || 0) === 1 ? "day" : "days"
                                    }`
                                  : mod.new || "(empty)"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {syncChanges.added.length === 0 &&
              syncChanges.removed.length === 0 &&
              syncChanges.modified.length === 0 && (
                <Alert
                  type="info"
                  title={lang.en.alert.noChangesDetected}
                  message={lang.en.alert.planAlreadyInSync}
                />
              )}

            <Alert
              type="warning"
              className="mt-3"
              title="Note:"
              message={lang.en.alert.syncPreserveNote}
            />
          </>
        </Modal>
      )}

      {/* Plan Instance Item Modal */}
      <Modal
        show={showPlanItemModal}
        onClose={() => {
          setShowPlanItemModal(false);
          setEditingPlanItem({});
        }}
        title={
          planItemFormState === 1
            ? editingPlanItem.parent
              ? "Add Child Plan Item"
              : "Add Plan Item"
            : "Edit Plan Item"
        }
        dialogClassName="responsive-modal-dialog"
        onSubmit={
          activeTab === "experience"
            ? handleSaveExperiencePlanItem
            : handleSavePlanInstanceItem
        }
        submitText={
          loading
            ? "Saving..."
            : planItemFormState === 1
            ? "Add Item"
            : "Update Item"
        }
        cancelText={lang.en.button.cancel}
        loading={loading}
        disableSubmit={!editingPlanItem.text}
      >
        <form className="plan-item-modal-form">
          <div className="mb-3">
            <FormLabel htmlFor="planItemText">
              {lang.en.label.itemDescription}{" "}
              <span style={{ color: 'var(--bs-danger)' }}>*</span>
            </FormLabel>
            <FormControl
              type="text"
              id="planItemText"
              value={editingPlanItem.text || ""}
              onChange={(e) =>
                setEditingPlanItem({
                  ...editingPlanItem,
                  text: e.target.value,
                })
              }
              placeholder={lang.en.placeholder.itemDescription}
              required
            />
          </div>

          <div className="mb-3">
            <FormLabel htmlFor="planItemUrl">
              {lang.en.label.urlOptional}
            </FormLabel>
            <FormControl
              type="url"
              id="planItemUrl"
              value={editingPlanItem.url || ""}
              onChange={(e) =>
                setEditingPlanItem({
                  ...editingPlanItem,
                  url: e.target.value,
                })
              }
              placeholder={lang.en.placeholder.urlPlaceholder}
            />
          </div>

          <div className="mb-3">
            <label htmlFor="planItemCost" className="form-label">
              {lang.en.label.cost}
            </label>
            <div className="input-group">
              <span className="input-group-text">$</span>
              <input
                type="number"
                className="form-control"
                id="planItemCost"
                value={editingPlanItem.cost || ""}
                onChange={(e) =>
                  setEditingPlanItem({
                    ...editingPlanItem,
                    cost: parseFloat(e.target.value) || 0,
                  })
                }
                onFocus={(e) => {
                  if (e.target.value === "0" || e.target.value === 0) {
                    setEditingPlanItem({
                      ...editingPlanItem,
                      cost: "",
                    });
                  }
                }}
                onBlur={(e) => {
                  if (e.target.value === "") {
                    setEditingPlanItem({
                      ...editingPlanItem,
                      cost: 0,
                    });
                  }
                }}
                min="0"
                step="0.01"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="mb-3">
            <label htmlFor="planItemDays" className="form-label">
              {lang.en.label.planningTimeLabel}
            </label>
            <div className="input-group">
              <input
                type="number"
                className="form-control"
                id="planItemDays"
                value={editingPlanItem.planning_days || ""}
                onChange={(e) =>
                  setEditingPlanItem({
                    ...editingPlanItem,
                    planning_days: parseInt(e.target.value) || 0,
                  })
                }
                onFocus={(e) => {
                  if (e.target.value === "0" || e.target.value === 0) {
                    setEditingPlanItem({
                      ...editingPlanItem,
                      planning_days: "",
                    });
                  }
                }}
                onBlur={(e) => {
                  if (e.target.value === "") {
                    setEditingPlanItem({
                      ...editingPlanItem,
                      planning_days: 0,
                    });
                  }
                }}
                min="0"
                placeholder="0"
              />
              <span className="input-group-text">days</span>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}

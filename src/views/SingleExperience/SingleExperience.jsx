import "./SingleExperience.css";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { lang } from "../../lang.constants";
import { useParams, Link, useNavigate } from "react-router-dom";
import { FaUserPlus, FaTimes } from "react-icons/fa";
import { BsPlusCircle, BsPersonPlus, BsCheckCircleFill } from "react-icons/bs";
import { useUser } from "../../contexts/UserContext";
import { useData } from "../../contexts/DataContext";
import { useApp } from "../../contexts/AppContext";
import { useToast } from "../../contexts/ToastContext";
import { useCollaboratorUsers } from "../../hooks/useCollaboratorUsers";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal";
import Modal from "../../components/Modal/Modal";
import PageMeta from "../../components/PageMeta/PageMeta";
import PhotoCard from "../../components/PhotoCard/PhotoCard";
import UsersListDisplay from "../../components/UsersListDisplay/UsersListDisplay";
import Alert from "../../components/Alert/Alert";
import { isOwner } from "../../utilities/permissions";
import {
  showExperience,
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
import { sendEmailInvite } from "../../utilities/invites-api";
import { searchUsers } from "../../utilities/users-api";
import debug from "../../utilities/debug";

// Constants for sync alert cookie management
const SYNC_ALERT_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days (1 week) in milliseconds

// Create expirable storage for sync alert dismissals
const syncAlertStorage = createExpirableStorage('planSyncAlertDismissed', SYNC_ALERT_DURATION);

/**
 * Checks if sync alert was dismissed for a specific plan and if it's still valid
 * @param {string} planId - The plan ID to check
 * @returns {number|null} Timestamp if dismissed and still valid, null otherwise
 */
function getSyncAlertCookie(planId) {
  return syncAlertStorage.get(planId);
}

/**
 * Updates the cookie with dismissal data for a specific plan (upsert)
 * Automatically cleans up expired entries
 * @param {string} planId - The plan ID to mark as dismissed
 */
function setSyncAlertCookie(planId) {
  syncAlertStorage.set(planId);
}

export default function SingleExperience() {
  const { user } = useUser();
  const { removeExperience, fetchExperiences } = useData();
  const { registerH1, setPageActionButtons, clearActionButtons, updateShowH1InNavbar } = useApp();
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
  const [activeTab, setActiveTab] = useState("experience"); // "experience" or "myplan"
  const [userPlan, setUserPlan] = useState(null);
  const [collaborativePlans, setCollaborativePlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
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
  const [actuallyRemovedCollaborators, setActuallyRemovedCollaborators] = useState([]); // Track actually removed for success message
  const [showEmailInviteForm, setShowEmailInviteForm] = useState(false); // Toggle email invite form
  const [emailInviteData, setEmailInviteData] = useState({ email: '', name: '' }); // Email invite form data
  const [emailInviteSending, setEmailInviteSending] = useState(false); // Email sending state
  const [emailInviteError, setEmailInviteError] = useState(''); // Email invite errors
  const [showPlanItemModal, setShowPlanItemModal] = useState(false);
  const [planItemFormState, setPlanItemFormState] = useState(1); // 1 = add, 0 = edit
  const [editingPlanItem, setEditingPlanItem] = useState({});
  
  // Ref for dynamic font sizing on planned date metric
  const plannedDateRef = useRef(null);

  // Get owner and collaborator user IDs for experience
  const experienceOwnerPermission = useMemo(() =>
    experience?.permissions?.find(p => p.entity === "user" && p.type === "owner"),
    [experience?.permissions]
  );

  const experienceOwnerId = useMemo(() =>
    experienceOwnerPermission?._id,
    [experienceOwnerPermission]
  );

  const experienceCollaboratorIds = useMemo(() =>
    experience?.permissions
      ?.filter(p => p.entity === "user" && p.type === "collaborator")
      .map(p => p._id) || [],
    [experience?.permissions]
  );

  // Get current plan for collaborator IDs - MUST be memoized to prevent infinite re-renders
  const currentPlan = useMemo(() =>
    activeTab === "experience" ? null :
    selectedPlanId ? collaborativePlans.find(p => p._id === selectedPlanId) : userPlan,
    [activeTab, selectedPlanId, collaborativePlans, userPlan]
  );

  // Get plan owner and collaborator user IDs
  const planOwnerPermission = useMemo(() =>
    currentPlan?.permissions?.find(p => p.entity === "user" && p.type === "owner"),
    [currentPlan?.permissions]
  );

  const planOwnerId = useMemo(() =>
    planOwnerPermission?._id,
    [planOwnerPermission]
  );

  const planCollaboratorIds = useMemo(() =>
    currentPlan?.permissions
      ?.filter(p => p.entity === "user" && p.type === "collaborator")
      .map(p => p._id) || [],
    [currentPlan?.permissions]
  );

  // Memoize owner ID arrays to prevent infinite re-renders from hook
  const experienceOwnerIds = useMemo(() =>
    experienceOwnerId ? [experienceOwnerId] : [],
    [experienceOwnerId]
  );

  const planOwnerIds = useMemo(() =>
    planOwnerId ? [planOwnerId] : [],
    [planOwnerId]
  );

  // Fetch fresh user data for owners and collaborators
  const { users: experienceOwnerData, loading: experienceOwnerLoading } = useCollaboratorUsers(experienceOwnerIds);
  const experienceOwner = experienceOwnerData?.[0];

  const { users: experienceCollaborators, loading: experienceCollaboratorsLoading } = useCollaboratorUsers(experienceCollaboratorIds);

  const { users: planOwnerData, loading: planOwnerLoading } = useCollaboratorUsers(planOwnerIds);
  const planOwner = planOwnerData?.[0];

  const { users: planCollaborators, loading: planCollaboratorsLoading } = useCollaboratorUsers(planCollaboratorIds);

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
  }, [experienceId]);

  const fetchUserPlan = useCallback(async () => {
    try {
      const plans = await getUserPlans();
      const plan = plans.find(
        (p) =>
          p.experience._id === experienceId || p.experience === experienceId
      );
      setUserPlan(plan || null);

      // Set userHasExperience based on Plan model (not experience.users)
      setUserHasExperience(!!plan);

      // Set userPlannedDate from the plan (no longer using experience.users)
      setUserPlannedDate(plan?.planned_date || null);

      // Only set selectedPlanId if not already set
      if (plan && !selectedPlanId) {
        setSelectedPlanId(plan._id);
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

      setCollaborativePlans(sortedPlans);

      // Set selectedPlanId if not already set and plans exist
      if (sortedPlans.length > 0 && !selectedPlanId) {
        // First plan is now guaranteed to be user's own plan if they have one
        const newSelectedId = sortedPlans[0]._id;
        debug.log("Setting selectedPlanId to:", newSelectedId);
        setSelectedPlanId(newSelectedId);
      }
    } catch (err) {
      debug.error("Error fetching collaborative plans:", err);
      setCollaborativePlans([]);
    }
  }, [experienceId, user._id, selectedPlanId]);

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

  useEffect(() => {
    fetchExperience();
    fetchUserPlan();
    fetchCollaborativePlans();
  }, [fetchExperience, fetchUserPlan, fetchCollaborativePlans]);

  // Register h1 and action buttons for navbar
  useEffect(() => {
    const h1 = document.querySelector('h1');
    if (h1) registerH1(h1);

    // Set up action buttons if user is owner or super admin
    if (user && experience && isOwner(user, experience)) {
      setPageActionButtons([
        {
          label: 'Edit',
          onClick: () => navigate(`/experiences/${experience._id}/update`),
          variant: 'outline-primary',
          icon: '✏️',
          tooltip: 'Edit Experience',
          compact: true
        },
        {
          label: 'Delete',
          onClick: () => setShowDeleteModal(true),
          variant: 'outline-danger',
          icon: '🗑️',
          tooltip: 'Delete Experience',
          compact: true
        }
      ]);
    }

    return () => clearActionButtons();
  }, [registerH1, setPageActionButtons, clearActionButtons, user, experience, navigate]);

  // Check for divergence when plan or experience changes
  useEffect(() => {
    if (selectedPlanId && collaborativePlans.length > 0 && experience) {
      const currentPlan = collaborativePlans.find(
        (p) => p._id === selectedPlanId
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

  // Update displayed planned date based on active tab and selected plan
  useEffect(() => {
    if (activeTab === "myplan" && selectedPlanId) {
      // Show the selected plan's planned date
      const selectedPlan = collaborativePlans.find(
        (p) => p._id === selectedPlanId
      );
      setDisplayedPlannedDate(selectedPlan?.planned_date || null);
    } else {
      // Show the user's experience planned date
      setDisplayedPlannedDate(userPlannedDate);
    }
  }, [activeTab, selectedPlanId, collaborativePlans, userPlannedDate]);

  /**
   * Dynamically adjusts the font size of the planned date metric value to fit within container.
   * Similar to DestinationCard implementation - reduces font size incrementally if text overflows.
   */
  useEffect(() => {
    const adjustPlannedDateFontSize = () => {
      const element = plannedDateRef.current;
      if (!element) return;

      // Reset to default size first
      element.style.fontSize = '';

      // Get the computed style to find the current font size
      let fontSize = parseFloat(window.getComputedStyle(element).fontSize);
      const minFontSize = 1; // rem (16px at base 16px) - more aggressive minimum

      // Check if text is overflowing horizontally
      // Reduce more aggressively (2px instead of 1px per iteration)
      while (element.scrollWidth > element.clientWidth && fontSize > minFontSize * 16) {
        fontSize -= 2; // More aggressive reduction
        element.style.fontSize = `${fontSize}px`;
      }
    };

    // Use setTimeout to ensure DOM is fully rendered before adjusting
    const timeoutId = setTimeout(() => {
      adjustPlannedDateFontSize();
    }, 0);

    // Adjust on window resize
    window.addEventListener('resize', adjustPlannedDateFontSize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', adjustPlannedDateFontSize);
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
        (p) => p._id === selectedPlanId
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
      handleError(err, { context: "Calculate sync changes" });
    }
  }, [selectedPlanId, experience, collaborativePlans]);

  const confirmSyncPlan = useCallback(async () => {
    if (!selectedPlanId || !experience || !syncChanges) return;

    try {
      setLoading(true);

      const currentPlan = collaborativePlans.find(
        (p) => p._id === selectedPlanId
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

      setShowSyncButton(false);
      setShowSyncAlert(false);
      setShowSyncModal(false);
      setSyncChanges(null);
      setSelectedSyncItems({ added: [], removed: [], modified: [] });

      // Set cookie to hide alert for 1 week after successful sync
      setSyncAlertCookie(selectedPlanId);

      debug.log("Plan synced successfully");
    } catch (err) {
      handleError(err, { context: "Sync plan" });
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

      try {
        setLoading(true);

        if (planItemFormState === 1) {
          // Add new item
          await addPlanItemToInstance(selectedPlanId, editingPlanItem);
        } else {
          // Update existing item
          const { _id, plan_item_id, ...updates } = editingPlanItem;
          await updatePlanItem(selectedPlanId, _id, updates);
        }

        // Refresh plans
        await fetchCollaborativePlans();
        await fetchUserPlan();

        // Close modal
        setShowPlanItemModal(false);
        setEditingPlanItem({});
      } catch (err) {
        handleError(err, {
          context:
            planItemFormState === 1 ? "Add plan item" : "Update plan item",
        });
      } finally {
        setLoading(false);
      }
    },
    [
      selectedPlanId,
      editingPlanItem,
      planItemFormState,
      fetchCollaborativePlans,
      fetchUserPlan,
    ]
  );

  const handlePlanInstanceItemDelete = useCallback(async () => {
    if (!selectedPlanId || !planInstanceItemToDelete) return;
    try {
      setLoading(true);
      await deletePlanItemFromInstance(
        selectedPlanId,
        planInstanceItemToDelete._id
      );
      await fetchCollaborativePlans();
      await fetchUserPlan();
      setShowPlanInstanceDeleteModal(false);
      setPlanInstanceItemToDelete(null);
    } catch (err) {
      handleError(err, { context: "Delete plan item" });
    } finally {
      setLoading(false);
    }
  }, [
    selectedPlanId,
    planInstanceItemToDelete,
    fetchCollaborativePlans,
    fetchUserPlan,
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

      try {
        setLoading(true);

        if (planItemFormState === 1) {
          // Add new item to experience
          const updatedExperience = await addExperiencePlanItem(
            experience._id,
            {
              text: editingPlanItem.text,
              url: editingPlanItem.url,
              cost_estimate: editingPlanItem.cost || 0,
              planning_days: editingPlanItem.planning_days || 0,
              parent: editingPlanItem.parent || null,
            }
          );
          setExperience(updatedExperience);
        } else {
          // Update existing item in experience
          const updatedExperience = await updateExperiencePlanItem(
            experience._id,
            {
              _id: editingPlanItem._id,
              text: editingPlanItem.text,
              url: editingPlanItem.url,
              cost_estimate: editingPlanItem.cost || 0,
              planning_days: editingPlanItem.planning_days || 0,
              parent: editingPlanItem.parent || null,
            }
          );
          setExperience(updatedExperience);
        }

        // Close modal and refresh
        setShowPlanItemModal(false);
        setEditingPlanItem({});
        await fetchExperience();
      } catch (err) {
        handleError(err, {
          context:
            planItemFormState === 1
              ? "Add experience plan item"
              : "Update experience plan item",
        });
      } finally {
        setLoading(false);
      }
    },
    [experience, editingPlanItem, planItemFormState, fetchExperience]
  );

  const handlePlanChange = useCallback(
    (planId) => {
      setSelectedPlanId(planId);

      // Update displayed planned date to the selected plan's date
      const selectedPlan = collaborativePlans.find((p) => p._id === planId);
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
      try {
        // Determine which entity to add/remove collaborators
        const isExperienceContext = collaboratorContext === "experience";
        if (!isExperienceContext && !selectedPlanId) return;

        // Process removals first
        for (const collaborator of removedCollaborators) {
          try {
            if (isExperienceContext) {
              // Dynamic import removed - using static import
              await removeExperienceCollaborator(experienceId, collaborator._id);
            } else {
              await removeCollaborator(selectedPlanId, collaborator._id);
            }
          } catch (err) {
            debug.error(`Error removing collaborator ${collaborator.name}:`, err);
          }
        }

        // Process additions
        const collaboratorsToAdd = selectedCollaborators.filter(
          (selected) => !existingCollaborators.some((existing) => existing._id === selected._id)
        );

        for (const collaborator of collaboratorsToAdd) {
          try {
            if (isExperienceContext) {
              await addExperienceCollaborator(experienceId, collaborator._id);
            } else {
              await addCollaborator(selectedPlanId, collaborator._id);
            }
          } catch (err) {
            debug.error(`Error adding collaborator ${collaborator.name}:`, err);
          }
        }

        // Refresh data
        if (isExperienceContext) {
          await fetchExperience();
        } else {
          await fetchCollaborativePlans();
        }

        // Track the added and removed collaborators for success message
        setAddedCollaborators(collaboratorsToAdd);
        setActuallyRemovedCollaborators(removedCollaborators);

        // Show success message
        setCollaboratorAddSuccess(true);
      } catch (err) {
        handleError(err, { context: "Manage collaborators" });
      } finally {
        setLoading(false);
      }
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
        setEmailInviteError('Please enter a valid email address');
        return;
      }

      setEmailInviteSending(true);
      setEmailInviteError('');

      try {
        await sendEmailInvite({
          email: emailInviteData.email,
          name: emailInviteData.name,
          resourceType: 'experience',
          resourceId: experienceId,
          resourceName: experience?.title || 'this experience',
          customMessage: `Join me in planning ${experience?.title || 'this experience'}!`
        });

        // Show success
        success(`Email invite sent successfully to ${emailInviteData.email}!`);

        // Reset form
        setEmailInviteData({ email: '', name: '' });
        setShowEmailInviteForm(false);
      } catch (error) {
        setEmailInviteError(error.message || 'Failed to send email invite');
      } finally {
        setEmailInviteSending(false);
      }
    },
    [emailInviteData, experienceId, experience, success]
  );

  const handleSelectUser = useCallback((user) => {
    // Add to selected collaborators if not already selected
    setSelectedCollaborators((prev) => {
      if (prev.some((u) => u._id === user._id)) {
        return prev; // Already selected
      }
      return [...prev, user];
    });
    
    // Clear search
    setCollaboratorSearch("");
    setSearchResults([]);
  }, []);

  const handleRemoveSelectedCollaborator = useCallback((userId) => {
    setSelectedCollaborators((prev) => prev.filter((u) => u._id !== userId));
    
    // If this was an existing collaborator, add to removed list
    const wasExisting = existingCollaborators.some((u) => u._id === userId);
    if (wasExisting) {
      const collaborator = existingCollaborators.find((u) => u._id === userId);
      setRemovedCollaborators((prev) => [...prev, collaborator]);
    }
  }, [existingCollaborators]);

  const openCollaboratorModal = useCallback((context) => {
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
  }, [experienceCollaborators, planCollaborators]);

  const handleSearchUsers = useCallback(async (query) => {
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
        if (result._id === user._id) return false;
        
        // Don't show users that are already selected
        const alreadySelected = selectedCollaborators.some(
          (collab) => collab._id === result._id
        );
        
        return !alreadySelected;
      });
      
      setSearchResults(filteredResults);
    } catch (err) {
      debug.error("Error searching users:", err);
      setSearchResults([]);
    }
  }, [selectedCollaborators, user]);

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
    setShowRemoveModal(true);
  }, [experience, user, userHasExperience]);

  const confirmRemoveExperience = useCallback(async () => {
    if (!experience || !user) return;
    // Remove experience plan
    const previousState = userHasExperience;
    const previousPlan = userPlan;
    const previousPlannedDate = displayedPlannedDate;
    try {
      // Optimistically update UI immediately for better UX
      setUserHasExperience(false);
      setUserPlannedDate(null);
      setDisplayedPlannedDate(null);
      setUserPlan(null);
      setShowRemoveModal(false);
      setCollaborativePlans([]);
      setSelectedPlanId(null);
      setActiveTab("experience"); // Switch back to experience tab

      // Delete the user's plan (using Plan API) - do this in background
      if (userPlan) {
        await deletePlan(userPlan._id);
        debug.log("Plan deleted successfully");
      }

      // Refresh data in background (user already sees updated UI)
      fetchExperience().catch((err) =>
        debug.error("Error refreshing experience:", err)
      );
      fetchCollaborativePlans().catch((err) =>
        debug.error("Error refreshing collaborative plans:", err)
      );
    } catch (err) {
      // Revert on error
      setUserHasExperience(previousState);
      setUserPlan(previousPlan);
      setDisplayedPlannedDate(previousPlannedDate);
      setShowRemoveModal(false);
      handleError(err, { context: "Remove plan" });
    }
  }, [
    experience,
    user,
    userHasExperience,
    userPlan,
    displayedPlannedDate,
    fetchExperience,
    fetchCollaborativePlans,
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

        // Create a plan for this experience (now available for both owners and non-owners)
        // Owners can create plans to track their own completion alongside managing the template
        try {
          debug.log("Creating plan for experience:", experience._id);
          const newPlan = await createPlan(
            experience._id,
            addData.planned_date || null
          );
          debug.log("Plan created successfully:", newPlan);

          // Refresh user plan and collaborative plans
          await fetchUserPlan();
          debug.log("User plan fetched");

          await fetchCollaborativePlans();
          debug.log("Collaborative plans fetched");

          // Switch to My Plan tab after creating the plan
          setActiveTab("myplan");
          setSelectedPlanId(newPlan._id);

          // Update displayed date to the new plan's date
          setDisplayedPlannedDate(addData.planned_date || null);
        } catch (planErr) {
          debug.error("Error creating plan:", planErr);
          // Revert on error
          setUserHasExperience(previousState);
          setShowDatePicker(true);
          handleError(planErr, { context: "Create plan" });
          return;
        }

        // Refresh experience data to get latest state
        await fetchExperience();
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
        await updatePlan(selectedPlanId, { planned_date: dateToSend });

        // Refresh plans to get updated data
        await fetchUserPlan();
        await fetchCollaborativePlans();

        // Update displayed date
        setDisplayedPlannedDate(dateToSend);

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
          await updatePlan(userPlan._id, { planned_date: dateToSend });
          await fetchUserPlan();
          await fetchCollaborativePlans();
          setDisplayedPlannedDate(dateToSend);
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
          await updatePlan(userPlan._id, { planned_date: dateToSend });
          await fetchUserPlan();
          await fetchCollaborativePlans();
          setDisplayedPlannedDate(dateToSend);
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
      handleError(err, { context: "Update date" });
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
  }, [experience, user, navigate, removeExperience, success, showError, fetchExperiences]);

  const handlePlanDelete = useCallback(
    async (planItemId) => {
      if (!experience || !planItemId) return;
      try {
        await deletePlanItem(experience._id, planItemId);
        // Refetch experience to get updated virtuals
        await fetchExperience();
        await fetchExperiences();
        setShowPlanDeleteModal(false);
        success(lang.en.success.planItemDeleted);
      } catch (err) {
        const errorMsg = handleError(err, { context: "Delete plan item" });
        showError(errorMsg);
      }
    },
    [experience, fetchExperiences, fetchExperience, success, showError]
  );

  // Set up navbar for single experience view
  useEffect(() => {
    const h1 = document.querySelector('h1');
    if (h1) registerH1(h1);

    // Enable h1 text in navbar for this view
    updateShowH1InNavbar(true);

    return () => {
      clearActionButtons();
      updateShowH1InNavbar(false);
    };
  }, [registerH1, clearActionButtons, updateShowH1InNavbar]);

  return (
    <>
      {experience && (
        <PageMeta
          title={experience.name}
          description={`Plan your ${experience.name} experience${
            experience.destination ? ` in ${experience.destination.name}` : ""
          }. ${
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
            <div className="col-md-6 fade-in text-center text-md-start">
              <h1 className="mt-4 h fade-in">{experience.name}</h1>
              <div className="my-2">
                {experience.cost_estimate > 0 && (
                  <h2 className="h5 fade-in">
                    {lang.en.heading.estimatedCost}{" "}
                    <span className="green fade-in">
                      {dollarSigns(Math.ceil(experience.cost_estimate / 1000))}
                    </span>
                    <span className="grey fade-in">
                      {dollarSigns(
                        5 - Math.ceil(experience.cost_estimate / 1000)
                      )}
                    </span>
                  </h2>
                )}
                {experience.max_planning_days > 0 && (
                  <h2 className="h5 fade-in">
                    {lang.en.heading.planningTime}{" "}
                    {experience.max_planning_days}{" "}
                    {experience.max_planning_days === 1 ? "day" : "days"}
                  </h2>
                )}
              </div>
            </div>
            <div className="d-flex col-md-6 justify-content-center justify-content-md-end align-items-center flex-row experience-actions">
              <button
                className={`btn btn-icon my-2 my-sm-4 ${
                  userHasExperience ? "btn-plan-remove" : "btn-plan-add"
                } ${loading ? "loading" : ""} fade-in`}
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
                    : displayedPlannedDate
                    ? `${lang.en.button.expPlanAdded} for ${formatDateShort(
                        displayedPlannedDate
                      )}`
                    : lang.en.button.expPlanAdded
                  : lang.en.button.addFavoriteExp}
              </button>
              {userHasExperience && (
                <button
                  className="btn btn-icon my-2 my-sm-4 ms-0 ms-sm-2 fade-in"
                  onClick={() => {
                    if (showDatePicker) {
                      setShowDatePicker(false);
                    } else {
                      setIsEditingDate(true);
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
              )}
              {isOwner(user, experience) && (
                <>
                  <button
                    className="btn btn-icon my-2 my-sm-4 ms-0 ms-sm-2 fade-in"
                    onClick={() =>
                      navigate(`/experiences/${experienceId}/update`)
                    }
                    aria-label={lang.en.button.updateExperience}
                    title={lang.en.button.updateExperience}
                  >
                    ✏️
                  </button>
                  <button
                    className="btn btn-light btn-icon my-2 my-sm-4 ms-0 ms-sm-2 fade-in"
                    onClick={() => setShowDeleteModal(true)}
                    aria-label={lang.en.button.delete}
                    title={lang.en.button.delete}
                  >
                    ❌
                  </button>
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
                      <label htmlFor="plannedDate" className="form-label h5">
                        {lang.en.label.whenDoYouWantExperience}
                      </label>
                      <input
                        type="date"
                        id="plannedDate"
                        className="form-control"
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

              <div className="travel-tips-box fade-in mb-4">
                {experience.destination && (
                  <div className="fw-bold text-center h5 fade-in">
                    <Link to={`/destinations/${experience.destination._id}`}>
                      {lang.en.label.destinationLabel}: {experience.destination.name}
                    </Link>
                  </div>
                )}
                <div className="d-flex gap-3 flex-wrap mt-3">
                  {travelTips.map((tip, index) => (
                    <div key={index} className="travel-tip-card fade-in">
                      {tip}
                    </div>
                  ))}
                </div>
              </div>

              {experience.destination && (
                <iframe
                  width="100%"
                  title={lang.en.helper.map}
                  height="450"
                  style={{ border: "0" }}
                  loading="lazy"
                  src={`https://www.google.com/maps/embed/v1/place?q=${experience.destination.name}+${experience.destination.country}&key=AIzaSyDqWtvNnjYES1pd6ssnZ7gvddUVHrlNaR0`}
                ></iframe>
              )}
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
                  {collaborativePlans.length > 0 && (
                    <div className="plan-tab-dropdown-container">
                      <button
                        className={`plan-tab-button ${
                          activeTab === "myplan" ? "active" : ""
                        }`}
                        onClick={() => setActiveTab("myplan")}
                      >
                        {(() => {
                          // Find the first plan (which is sorted to be user's own if it exists)
                          const firstPlan = collaborativePlans[0];
                          if (!firstPlan) return lang.en.heading.myPlan;

                          // Handle case where user populate failed
                          if (!firstPlan.user || !firstPlan.user._id) {
                            return lang.en.heading.myPlan;
                          }

                          const isUserOwned =
                            firstPlan.user._id === user._id ||
                            firstPlan.user === user._id;
                          return isUserOwned
                            ? lang.en.heading.myPlan
                            : `${firstPlan.user.name}'s Plan`;
                        })()}
                      </button>
                      {collaborativePlans.length > 1 && (
                        <select
                          className="plan-dropdown"
                          value={selectedPlanId || ""}
                          onChange={(e) => handlePlanChange(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {collaborativePlans.map((plan) => (
                            <option key={plan._id} value={plan._id}>
                              {plan.user && plan.user._id === user._id
                                ? "My Plan"
                                : plan.user && plan.user.name
                                ? `${plan.user.name}'s Plan`
                                : "Plan"}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
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
                        loading={experienceOwnerLoading || experienceCollaboratorsLoading}
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
                                    <strong className="text-dark">Cost:</strong>{" "}
                                    {formatCurrency(planItem.cost_estimate)}
                                  </span>
                                )}
                                {Number(planItem.planning_days) > 0 && (
                                  <span className="d-flex align-items-center gap-2">
                                    <strong className="text-dark">
                                      Planning Time:
                                    </strong>{" "}
                                    {planItem.planning_days}{" "}
                                    {planItem.planning_days === 1
                                      ? "day"
                                      : "days"}
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
                        (p) => p._id === selectedPlanId
                      );

                      const isPlanOwner =
                        planOwner && planOwner._id === user._id;
                      const isPlanCollaborator =
                        currentPlan &&
                        currentPlan.permissions?.some(
                          (p) =>
                            p._id.toString() === user._id.toString() &&
                            ["owner", "collaborator"].includes(p.type)
                        );
                      const canEdit = isPlanOwner || isPlanCollaborator;

                      return (
                        <div className="plan-header-row mb-4">
                          {/* Collaborators Display - Left Side */}
                          <UsersListDisplay
                            owner={planOwner}
                            users={planCollaborators}
                            messageKey="PlanningExperience"
                            loading={planOwnerLoading || planCollaboratorsLoading}
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
                                {loading ? lang.en.button.syncing : lang.en.button.syncNow}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                    {(() => {
                      const currentPlan = collaborativePlans.find(
                        (p) => p._id === selectedPlanId
                      );
                      if (!currentPlan) {
                        return (
                          <p className="text-center text-muted">
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
                                <div className="metric-value" ref={plannedDateRef}>
                                  {currentPlan.planned_date ? (
                                    formatDateMetricCard(currentPlan.planned_date)
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
                                      style={{
                                        cursor: "pointer",
                                        color: "#667eea",
                                        textDecoration: "underline",
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
                            <p className="text-center text-muted">
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
                                      const ownerPermission = currentPlan?.permissions?.find(p => p.type === 'owner');
                                      if (ownerPermission?.user) {
                                        planOwner = ownerPermission.user;
                                      }
                                      // Don't create fake user objects - leave planOwner as undefined if no valid user data
                                    }
                                    
                                    // Check if user can edit this plan (owner or collaborator)
                                    const canEditPlan =
                                      currentPlan &&
                                      ((planOwner && planOwner._id === user._id) ||
                                        currentPlan.permissions?.some(
                                          (p) =>
                                            p._id.toString() ===
                                              user._id.toString() &&
                                            ["owner", "collaborator"].includes(
                                              p.type
                                            )
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
                                            } catch (err) {
                                              handleError(err, {
                                                context:
                                                  "Toggle plan item completion",
                                              });
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
                                        <strong className="text-dark">
                                          Cost:
                                        </strong>{" "}
                                        {formatCurrency(planItem.cost)}
                                      </span>
                                    )}
                                    {Number(planItem.planning_days) > 0 && (
                                      <span className="d-flex align-items-center gap-2">
                                        <strong className="text-dark">
                                          Planning Time:
                                        </strong>{" "}
                                        {planItem.planning_days}{" "}
                                        {planItem.planning_days === 1
                                          ? "day"
                                          : "days"}
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
        onClose={() => setShowRemoveModal(false)}
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
          <div className="text-center py-5">
            <div className="mb-3">
              <BsCheckCircleFill className="text-success" size={64} />
            </div>
            <h4>{lang.en.alert.changesSavedSuccessfully}</h4>

            {/* Show added collaborators */}
            {addedCollaborators.length > 0 && (
              <div className="mb-3">
                <p className="text-muted mb-2">
                  <strong>
                    {lang.en.alert.addedCollaborators
                      .replace("{count}", addedCollaborators.length)
                      .replace("{plural}", addedCollaborators.length > 1 ? "s" : "")}
                  </strong>
                </p>
                <ul className="list-unstyled">
                  {addedCollaborators.map((collab) => (
                    <li key={collab._id} className="text-success">
                      ✓ {collab.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Show removed collaborators */}
            {actuallyRemovedCollaborators.length > 0 && (
              <div className="mb-3">
                <p className="text-muted mb-2">
                  <strong>
                    {lang.en.alert.removedCollaborators
                      .replace("{count}", actuallyRemovedCollaborators.length)
                      .replace("{plural}", actuallyRemovedCollaborators.length > 1 ? "s" : "")}
                  </strong>
                </p>
                <ul className="list-unstyled">
                  {actuallyRemovedCollaborators.map((collab) => (
                    <li key={collab._id} className="text-danger">
                      ✗ {collab.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {addedCollaborators.length === 0 && actuallyRemovedCollaborators.length === 0 && (
              <p className="text-muted">{lang.en.alert.noChangesMade}</p>
            )}
          </div>
        ) : (
          // Form view
          <form
            id="addCollaboratorForm"
            className="collaborator-modal-form"
            onSubmit={handleAddCollaborator}
          >
            <p className="text-muted mb-3">
              {lang.en.alert.searchCollaboratorsHelp.replace(
                "{context}",
                collaboratorContext
              )}
            </p>

            {/* Selected Collaborators Display */}
            {selectedCollaborators.length > 0 && (
              <div className="mb-3">
                <label className="form-label">{lang.en.label.selectedCollaborators}</label>
                <div className="d-flex flex-wrap gap-2">
                  {selectedCollaborators.map((collaborator) => (
                    <div
                      key={collaborator._id}
                      className="badge bg-primary d-flex align-items-center gap-2 p-2"
                      style={{ fontSize: "0.9rem" }}
                    >
                      <span>{collaborator.name}</span>
                      <button
                        type="button"
                        className="btn btn-link p-0 text-white"
                        onClick={() =>
                          handleRemoveSelectedCollaborator(collaborator._id)
                        }
                        style={{
                          textDecoration: "none",
                          lineHeight: 1,
                          fontSize: "1rem",
                        }}
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
              <label htmlFor="collaboratorSearch" className="form-label">
                Search User
              </label>
              <input
                type="text"
                className="form-control"
                id="collaboratorSearch"
                value={collaboratorSearch}
                onChange={(e) => handleSearchUsers(e.target.value)}
                placeholder={lang.en.placeholder.searchNameOrEmail}
                autoComplete="off"
              />
              {searchResults.length > 0 && (
                <div
                  className="position-absolute w-100 mt-1 bg-white border rounded shadow-sm"
                  style={{
                    zIndex: 1000,
                    maxHeight: "200px",
                    overflowY: "auto",
                  }}
                >
                  {searchResults.map((user) => (
                    <button
                      key={user._id}
                      type="button"
                      className="btn btn-light w-100 text-start border-0 rounded-0"
                      onClick={() => handleSelectUser(user)}
                    >
                      <div className="fw-semibold">{user.name}</div>
                      <small className="text-muted">{user.email}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Email Invite Toggle */}
            <div className="mb-3">
              <button
                type="button"
                className="btn btn-link text-decoration-none"
                onClick={() => {
                  setShowEmailInviteForm(!showEmailInviteForm);
                  setEmailInviteError('');
                }}
              >
                {showEmailInviteForm ? '← Back to search' : '✉ Invite via email (for non-users)'}
              </button>
            </div>

            {/* Email Invite Form */}
            {showEmailInviteForm && (
              <div className="border rounded p-3 mb-3 bg-light">
                <h6 className="mb-3">Send Email Invite</h6>

                {emailInviteError && (
                  <Alert type="danger" dismissible onClose={() => setEmailInviteError('')}>
                    {emailInviteError}
                  </Alert>
                )}

                <div className="mb-3">
                  <label htmlFor="inviteEmail" className="form-label">
                    Email Address
                  </label>
                  <input
                    type="email"
                    className="form-control"
                    id="inviteEmail"
                    value={emailInviteData.email}
                    onChange={(e) => setEmailInviteData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder={lang.en.placeholder.collaboratorEmail}
                  />
                </div>

                <div className="mb-3">
                  <label htmlFor="inviteName" className="form-label">
                    Full Name
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="inviteName"
                    value={emailInviteData.name}
                    onChange={(e) => setEmailInviteData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Collaborator's name"
                  />
                </div>

                <div className="alert alert-info mb-3">
                  <small>
                    We'll send an email to <strong>{emailInviteData.email || 'this address'}</strong> inviting them to join Biensperience and collaborate on <strong>{experience?.title || 'this experience'}</strong>.
                  </small>
                </div>

                <button
                  type="button"
                  className="btn btn-primary w-100"
                  onClick={handleSendEmailInvite}
                  disabled={emailInviteSending || !emailInviteData.email.trim() || !emailInviteData.name.trim()}
                >
                  {emailInviteSending ? 'Sending...' : 'Send Email Invite'}
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
            <p className="text-muted mb-3">
              {lang.en.alert.selectChangesToApply}
            </p>

                {/* Added Items */}
                {syncChanges.added.length > 0 && (
                  <div className="mb-4">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <h6 className="text-success mb-0">
                        <strong>
                          {lang.en.label.addedItems.replace("{count}", syncChanges.added.length)}
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
                                      added: prev.added.filter(
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
                                <div className="small text-muted">
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
                            <div className="text-end ms-2">
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
                      <h6 className="text-danger mb-0">
                        <strong>
                          {lang.en.label.removedItems.replace("{count}", syncChanges.removed.length)}
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
                                removed: syncChanges.removed.map(
                                  (_, idx) => idx
                                ),
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
                                checked={selectedSyncItems.removed.includes(
                                  idx
                                )}
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
                                <div className="small text-muted">
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
                      <h6 className="text-warning mb-0">
                        <strong>
                          {lang.en.label.modifiedItems.replace("{count}", syncChanges.modified.length)}
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
                                modified: syncChanges.modified.map(
                                  (_, idx) => idx
                                ),
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
                                checked={selectedSyncItems.modified.includes(
                                  idx
                                )}
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
                              <strong className="d-block mb-2">
                                {item.text}
                              </strong>
                              {item.modifications.map((mod, modIdx) => (
                                <div key={modIdx} className="small mb-1">
                                  <span className="badge bg-warning text-dark me-2">
                                    {mod.field}
                                  </span>
                                  <span className="text-decoration-line-through text-muted me-2">
                                    {mod.field === "cost"
                                      ? `$${(mod.old || 0).toLocaleString(
                                          "en-US",
                                          {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          }
                                        )}`
                                      : mod.field === "days"
                                      ? `${mod.old || 0} ${
                                          (mod.old || 0) === 1 ? "day" : "days"
                                        }`
                                      : mod.old || "(empty)"}
                                  </span>
                                  →
                                  <span className="text-success ms-2">
                                    {mod.field === "cost"
                                      ? `$${(mod.new || 0).toLocaleString(
                                          "en-US",
                                          {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          }
                                        )}`
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
            <label htmlFor="planItemText" className="form-label">
              {lang.en.label.itemDescription} <span className="text-danger">*</span>
            </label>
                    <input
                      type="text"
                      className="form-control"
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
                    <label htmlFor="planItemUrl" className="form-label">
                      {lang.en.label.urlOptional}
                    </label>
                    <input
                      type="url"
                      className="form-control"
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
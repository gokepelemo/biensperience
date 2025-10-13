import "./SingleExperience.css";
import { useState, useEffect, useCallback } from "react";
import { lang } from "../../lang.constants";
import { useParams, Link, useNavigate } from "react-router-dom";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal";
import PageMeta from "../../components/PageMeta/PageMeta";
import PhotoCard from "../../components/PhotoCard/PhotoCard";
import {
  showExperience,
  deleteExperience,
  deletePlanItem,
  addPlanItem as addExperiencePlanItem,
  updatePlanItem as updateExperiencePlanItem,
  addExperienceCollaborator,
} from "../../utilities/experiences-api";
import {
  getUserPlans,
  createPlan,
  deletePlan,
  getExperiencePlans,
  updatePlan,
  updatePlanItem,
  addCollaborator,
  addPlanItem as addPlanItemToInstance,
  deletePlanItem as deletePlanItemFromInstance,
} from "../../utilities/plans-api";
import {
  formatDateShort,
  formatDateForInput,
  getMinimumPlanningDate,
  isValidPlannedDate,
} from "../../utilities/date-utils";
import { handleError } from "../../utilities/error-handler";
import debug from "../../utilities/debug";

export default function SingleExperience({ user, experiences, updateData }) {
  const { experienceId } = useParams();
  const navigate = useNavigate();
  const [experience, setExperience] = useState(null);
  const [userHasExperience, setUserHasExperience] = useState(false);
  const [travelTips, setTravelTips] = useState([]);
  const [isOwner, setIsOwner] = useState(false);
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
  const [showPlanInstanceDeleteModal, setShowPlanInstanceDeleteModal] = useState(false);
  const [planInstanceItemToDelete, setPlanInstanceItemToDelete] = useState(null);
  const [activeTab, setActiveTab] = useState("experience"); // "experience" or "myplan"
  const [userPlan, setUserPlan] = useState(null);
  const [collaborativePlans, setCollaborativePlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [showSyncButton, setShowSyncButton] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncChanges, setSyncChanges] = useState(null);
  const [selectedSyncItems, setSelectedSyncItems] = useState({ added: [], removed: [], modified: [] });
  const [showCollaboratorModal, setShowCollaboratorModal] = useState(false);
  const [collaboratorContext, setCollaboratorContext] = useState('plan'); // 'plan' or 'experience'
  const [collaboratorUserId, setCollaboratorUserId] = useState("");
  const [collaboratorSearch, setCollaboratorSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [collaboratorAddSuccess, setCollaboratorAddSuccess] = useState(false);
  const [addedCollaborators, setAddedCollaborators] = useState([]); // Track multiple additions
  const [showPlanItemModal, setShowPlanItemModal] = useState(false);
  const [planItemFormState, setPlanItemFormState] = useState(1); // 1 = add, 0 = edit
  const [editingPlanItem, setEditingPlanItem] = useState({});

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
      setExperience(experienceData);
      // Set isOwner if current user is the creator
      setIsOwner(
        experienceData.user && experienceData.user._id.toString() === user._id
      );
      
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
  }, [experienceId, user._id]);

  const fetchUserPlan = useCallback(async () => {
    try {
      const plans = await getUserPlans();
      const plan = plans.find(p => p.experience._id === experienceId || p.experience === experienceId);
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
      const accessiblePlans = plans.filter(plan => {
        // Check if user owns this plan
        const isUserPlan = plan.user && (
          plan.user._id?.toString() === user._id?.toString() ||
          plan.user.toString() === user._id?.toString()
        );
        
        // Check if user is a collaborator or owner via permissions
        const hasPermission = plan.permissions?.some(p => 
          p.entity === 'user' && 
          (p._id?.toString() === user._id?.toString()) &&
          (p.type === 'owner' || p.type === 'collaborator')
        );
        
        return isUserPlan || hasPermission;
      });
      
      // Sort plans: user's own plan first, then others
      const sortedPlans = accessiblePlans.sort((a, b) => {
        const aIsUserPlan = a.user && (
          a.user._id?.toString() === user._id?.toString() ||
          a.user.toString() === user._id?.toString()
        );
        const bIsUserPlan = b.user && (
          b.user._id?.toString() === user._id?.toString() ||
          b.user.toString() === user._id?.toString()
        );
        
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
        item => item._id.toString() === planItem.plan_item_id.toString()
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

  // Check for divergence when plan or experience changes
  useEffect(() => {
    if (selectedPlanId && collaborativePlans.length > 0 && experience) {
      const currentPlan = collaborativePlans.find(p => p._id === selectedPlanId);
      if (currentPlan) {
        const hasDiverged = checkPlanDivergence(currentPlan, experience);
        setShowSyncButton(hasDiverged);
      }
    }
  }, [selectedPlanId, collaborativePlans, experience, checkPlanDivergence]);

  // Update displayed planned date based on active tab and selected plan
  useEffect(() => {
    if (activeTab === "myplan" && selectedPlanId) {
      // Show the selected plan's planned date
      const selectedPlan = collaborativePlans.find(p => p._id === selectedPlanId);
      setDisplayedPlannedDate(selectedPlan?.planned_date || null);
    } else {
      // Show the user's experience planned date
      setDisplayedPlannedDate(userPlannedDate);
    }
  }, [activeTab, selectedPlanId, collaborativePlans, userPlannedDate]);

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
      const currentPlan = collaborativePlans.find(p => p._id === selectedPlanId);
      if (!currentPlan) return;

      const changes = {
        added: [],
        removed: [],
        modified: []
      };

      // Find items in experience but not in plan (added)
      experience.plan_items.forEach(expItem => {
        const planItem = currentPlan.plan.find(
          pItem => pItem.plan_item_id?.toString() === expItem._id.toString()
        );
        if (!planItem) {
          changes.added.push({
            _id: expItem._id,
            text: expItem.text,
            url: expItem.url,
            cost: expItem.cost_estimate || 0,
            planning_days: expItem.planning_days || 0,
            photo: expItem.photo,
            parent: expItem.parent
          });
        }
      });

      // Find items in plan but not in experience (removed)
      currentPlan.plan.forEach(planItem => {
        const expItem = experience.plan_items.find(
          eItem => eItem._id.toString() === planItem.plan_item_id?.toString()
        );
        if (!expItem) {
          changes.removed.push({
            _id: planItem.plan_item_id,
            text: planItem.text,
            url: planItem.url
          });
        }
      });

      // Find modified items (text, url, cost, or days changed)
      experience.plan_items.forEach(expItem => {
        const planItem = currentPlan.plan.find(
          pItem => pItem.plan_item_id?.toString() === expItem._id.toString()
        );
        if (planItem) {
          const modifications = [];
          if (planItem.text !== expItem.text) {
            modifications.push({ field: 'text', old: planItem.text, new: expItem.text });
          }
          if (planItem.url !== expItem.url) {
            modifications.push({ field: 'url', old: planItem.url, new: expItem.url });
          }
          if ((planItem.cost || 0) !== (expItem.cost_estimate || 0)) {
            modifications.push({ field: 'cost', old: planItem.cost, new: expItem.cost_estimate || 0 });
          }
          if ((planItem.planning_days || 0) !== (expItem.planning_days || 0)) {
            modifications.push({ field: 'days', old: planItem.planning_days, new: expItem.planning_days || 0 });
          }

          if (modifications.length > 0) {
            changes.modified.push({
              _id: expItem._id,
              text: expItem.text,
              modifications
            });
          }
        }
      });

      // Show modal with changes and select all by default
      setSyncChanges(changes);
      setSelectedSyncItems({
        added: changes.added.map((_, idx) => idx),
        removed: changes.removed.map((_, idx) => idx),
        modified: changes.modified.map((_, idx) => idx)
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

      const currentPlan = collaborativePlans.find(p => p._id === selectedPlanId);
      if (!currentPlan) {
        throw new Error('Current plan not found');
      }

      // Start with current plan items
      let updatedPlanSnapshot = [...currentPlan.plan];

      // Apply selected additions
      if (selectedSyncItems.added.length > 0) {
        const itemsToAdd = selectedSyncItems.added.map(idx => syncChanges.added[idx]);
        itemsToAdd.forEach(item => {
          updatedPlanSnapshot.push({
            plan_item_id: item._id,
            complete: false,
            cost: item.cost_estimate || 0,
            planning_days: item.planning_days || 0,
            text: item.text,
            url: item.url,
            photo: item.photo,
            parent: item.parent
          });
        });
      }

      // Apply selected removals
      if (selectedSyncItems.removed.length > 0) {
        const itemIdsToRemove = selectedSyncItems.removed.map(idx => 
          syncChanges.removed[idx]._id.toString()
        );
        updatedPlanSnapshot = updatedPlanSnapshot.filter(
          pItem => !itemIdsToRemove.includes(pItem.plan_item_id?.toString())
        );
      }

      // Apply selected modifications
      if (selectedSyncItems.modified.length > 0) {
        const itemsToModify = selectedSyncItems.modified.map(idx => syncChanges.modified[idx]);
        itemsToModify.forEach(modItem => {
          const itemIndex = updatedPlanSnapshot.findIndex(
            pItem => pItem.plan_item_id?.toString() === modItem._id.toString()
          );
          if (itemIndex !== -1) {
            // Update fields that changed, preserve completion status and actual cost
            const existingItem = updatedPlanSnapshot[itemIndex];
            const expItem = experience.plan_items.find(
              ei => ei._id.toString() === modItem._id.toString()
            );
            if (expItem) {
              updatedPlanSnapshot[itemIndex] = {
                ...existingItem,
                text: expItem.text,
                url: expItem.url,
                cost: existingItem.cost, // Preserve actual cost
                planning_days: expItem.planning_days || 0,
                photo: expItem.photo,
                parent: expItem.parent
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
      setShowSyncModal(false);
      setSyncChanges(null);
      setSelectedSyncItems({ added: [], removed: [], modified: [] });
      debug.log("Plan synced successfully");
    } catch (err) {
      handleError(err, { context: "Sync plan" });
    } finally {
      setLoading(false);
    }
  }, [selectedPlanId, experience, collaborativePlans, fetchCollaborativePlans, fetchUserPlan, selectedSyncItems, syncChanges]);

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
      parent: planItem.parent || null
    });
    setPlanItemFormState(0); // Edit mode
    setShowPlanItemModal(true);
  }, []);

  const handleSavePlanInstanceItem = useCallback(async (e) => {
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
      handleError(err, { context: planItemFormState === 1 ? "Add plan item" : "Update plan item" });
    } finally {
      setLoading(false);
    }
  }, [selectedPlanId, editingPlanItem, planItemFormState, fetchCollaborativePlans, fetchUserPlan]);

  const handlePlanInstanceItemDelete = useCallback(async () => {
    if (!selectedPlanId || !planInstanceItemToDelete) return;
    try {
      setLoading(true);
      await deletePlanItemFromInstance(selectedPlanId, planInstanceItemToDelete._id);
      await fetchCollaborativePlans();
      await fetchUserPlan();
      setShowPlanInstanceDeleteModal(false);
      setPlanInstanceItemToDelete(null);
    } catch (err) {
      handleError(err, { context: "Delete plan item" });
    } finally {
      setLoading(false);
    }
  }, [selectedPlanId, planInstanceItemToDelete, fetchCollaborativePlans, fetchUserPlan]);

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
      parent: planItem.parent || null
    });
    setPlanItemFormState(0); // Edit mode
    setShowPlanItemModal(true);
  }, []);

  const handleSaveExperiencePlanItem = useCallback(async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      if (planItemFormState === 1) {
        // Add new item to experience
        const updatedExperience = await addExperiencePlanItem(experience._id, {
          text: editingPlanItem.text,
          url: editingPlanItem.url,
          cost_estimate: editingPlanItem.cost || 0,
          planning_days: editingPlanItem.planning_days || 0,
          parent: editingPlanItem.parent || null
        });
        setExperience(updatedExperience);
      } else {
        // Update existing item in experience
        const updatedExperience = await updateExperiencePlanItem(experience._id, {
          _id: editingPlanItem._id,
          text: editingPlanItem.text,
          url: editingPlanItem.url,
          cost_estimate: editingPlanItem.cost || 0,
          planning_days: editingPlanItem.planning_days || 0,
          parent: editingPlanItem.parent || null
        });
        setExperience(updatedExperience);
      }
      
      // Close modal and refresh
      setShowPlanItemModal(false);
      setEditingPlanItem({});
      await fetchExperience();
    } catch (err) {
      handleError(err, { context: planItemFormState === 1 ? "Add experience plan item" : "Update experience plan item" });
    } finally {
      setLoading(false);
    }
  }, [experience, editingPlanItem, planItemFormState, fetchExperience]);

  const handlePlanChange = useCallback((planId) => {
    setSelectedPlanId(planId);
    
    // Update displayed planned date to the selected plan's date
    const selectedPlan = collaborativePlans.find(p => p._id === planId);
    if (selectedPlan) {
      setDisplayedPlannedDate(selectedPlan.planned_date || null);
    }
  }, [collaborativePlans]);

  const handleAddCollaborator = useCallback(async (e) => {
    e.preventDefault();
    const userIdToAdd = selectedUser?._id || collaboratorUserId;
    if (!userIdToAdd) return;
    
    // Determine which entity to add collaborator to
    const isExperienceContext = collaboratorContext === 'experience';
    if (!isExperienceContext && !selectedPlanId) return;
    
    setLoading(true);
    try {
      if (isExperienceContext) {
        // Add collaborator to experience
        await addExperienceCollaborator(experienceId, userIdToAdd);
        // Refresh experience data to update permissions
        await fetchExperience();
      } else {
        // Add collaborator to plan
        await addCollaborator(selectedPlanId, userIdToAdd);
        // Refresh collaborative plans
        await fetchCollaborativePlans();
      }
      
      // Track the added collaborator
      setAddedCollaborators(prev => [...prev, selectedUser]);
      
      // Reset form but keep modal open with success message
      setCollaboratorUserId("");
      setCollaboratorSearch("");
      setSearchResults([]);
      setSelectedUser(null);
      
      // Show success message
      setCollaboratorAddSuccess(true);
    } catch (err) {
      handleError(err, { context: "Add collaborator" });
    } finally {
      setLoading(false);
    }
  }, [
    selectedUser, 
    collaboratorUserId, 
    selectedPlanId, 
    collaboratorContext,
    experienceId,
    fetchCollaborativePlans,
    fetchExperience
  ]);

  const handleSearchUsers = useCallback(async (query) => {
    setCollaboratorSearch(query);
    
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    try {
      const { searchUsers } = await import('../../utilities/users-api');
      const results = await searchUsers(query);
      setSearchResults(results);
    } catch (err) {
      debug.error("Error searching users:", err);
      setSearchResults([]);
    }
  }, []);

  const handleSelectUser = useCallback((user) => {
    setSelectedUser(user);
    setCollaboratorSearch(user.name);
    setSearchResults([]);
    setCollaboratorUserId(user._id);
  }, []);

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
    try {
      // Optimistically update UI
      setUserHasExperience(false);
      setUserPlannedDate(null);
      setUserPlan(null);
      setShowRemoveModal(false);

      // Delete the user's plan (using Plan API)
      if (userPlan) {
        await deletePlan(userPlan._id);
        debug.log("Plan deleted successfully");
        
        // Clear plan-related state
        setUserPlan(null);
        setCollaborativePlans([]);
        setSelectedPlanId(null);
        setActiveTab("experience"); // Switch back to experience tab
      }

      // Refresh experience data and plans
      await fetchExperience();
      await fetchCollaborativePlans();
    } catch (err) {
      // Revert on error
      setUserHasExperience(previousState);
      setUserPlan(previousPlan);
      setShowRemoveModal(false);
      handleError(err, { context: "Remove plan" });
    }
  }, [experience, user, userHasExperience, userPlan, fetchExperience, fetchCollaborativePlans]);

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
          const newPlan = await createPlan(experience._id, addData.planned_date || null);
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
    [experience?._id, plannedDate, userHasExperience, fetchExperience, fetchUserPlan, fetchCollaborativePlans]
  );

  const handleDateUpdate = useCallback(async () => {
    if (!plannedDate) return;

    try {
      setLoading(true);

      // If viewing "My Plan" tab, update the selected plan's date
      if (activeTab === "myplan" && selectedPlanId) {
        // Convert date string to ISO format for the API
        const dateToSend = plannedDate ? new Date(plannedDate).toISOString() : null;
        await updatePlan(selectedPlanId, { planned_date: dateToSend });
        
        // Refresh plans to get updated data
        await fetchUserPlan();
        await fetchCollaborativePlans();
        
        // Update displayed date
        setDisplayedPlannedDate(dateToSend);
        
        debug.log("Plan date updated successfully");
      } else if (!isOwner) {
        // Only non-owners can update planned date on Experience tab
        // Owners don't have a planned date since they manage the experience directly
        
        // Check if user already has a plan for this experience
        if (userPlan) {
          // Update existing plan's date
          // Convert date string to ISO format for the API
          const dateToSend = plannedDate ? new Date(plannedDate).toISOString() : null;
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
      } else {
        // Owners shouldn't be updating planned dates on the Experience tab
        debug.warn("Owner attempted to update planned date on Experience tab");
        setShowDatePicker(false);
        setIsEditingDate(false);
        setPlannedDate("");
        return;
      }

      setShowDatePicker(false);
      setIsEditingDate(false);
      setPlannedDate("");
    } catch (err) {
      handleError(err, { context: "Update date" });
    } finally {
      setLoading(false);
    }
  }, [plannedDate, activeTab, selectedPlanId, isOwner, userPlan, handleAddExperience, fetchUserPlan, fetchCollaborativePlans, fetchExperience]);

  const handleDeleteExperience = useCallback(async () => {
    if (!experience || !isOwner) return;
    try {
      await deleteExperience(experience._id);
      updateData && updateData();
      navigate("/experiences");
    } catch (err) {
      handleError(err, { context: "Delete experience" });
    }
  }, [experience, isOwner, navigate, updateData]);

  const handlePlanDelete = useCallback(
    async (planItemId) => {
      if (!experience || !planItemId) return;
      try {
        await deletePlanItem(experience._id, planItemId);
        // Refetch experience to get updated virtuals
        await fetchExperience();
        updateData && updateData();
        setShowPlanDeleteModal(false);
      } catch (err) {
        handleError(err, { context: "Delete plan item" });
      }
    },
    [experience, updateData, fetchExperience]
  );

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
              ? `Planning time: ${experience.max_planning_days} ${experience.max_planning_days === 1 ? 'day' : 'days'}.`
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
                    {experience.max_planning_days} {experience.max_planning_days === 1 ? 'day' : 'days'}
                  </h2>
                )}
              </div>
              {experience.user ? (
                <h3 className="h6 fade-in">
                  {lang.en.heading.createdBy}{" "}
                  <Link
                    to={`/profile/${experience.user._id}`}
                    title={experience.user.name}
                  >
                    {experience.user.name}
                  </Link>
                </h3>
              ) : null}
            </div>
            <div className="d-flex col-md-6 justify-content-center justify-content-md-end flex-column align-items-center flex-sm-row experience-actions">
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
              {isOwner && (
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
                  <div className="alert alert-info">
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
                          <div className="alert alert-warning mt-2">
                            {lang.en.alert.notEnoughTimeWarning}
                          </div>
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
                  </div>
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
              <ul className="list-group experience-detail fade-in mb-4">
                {experience.destination && (
                  <li className="list-group-item list-group-item-secondary fw-bold text-center h5 fade-in">
                    <Link to={`/destinations/${experience.destination._id}`}>
                      {lang.en.label.destinationLabel}: {experience.destination.name}
                    </Link>
                  </li>
                )}
                {travelTips.map((tip, index) => (
                  <li
                    key={index}
                    className="list-group-item list-group-item-secondary fade-in"
                  >
                    {tip}
                  </li>
                ))}
              </ul>

              {experience.destination && (
                <iframe
                  width="100%"
                  title="map"
                  height="450"
                  style={{ border: "0" }}
                  loading="lazy"
                  src={`https://www.google.com/maps/embed/v1/place?q=${experience.destination.name}+${experience.destination.country}&key=AIzaSyDqWtvNnjYES1pd6ssnZ7gvddUVHrlNaR0`}
                ></iframe>
              )}
            </div>
          </div>
          {isOwner && (
            <div className="row my-4 p-3 fade-in">
              <div className="d-flex gap-3 flex-wrap">
                <button
                  className="btn btn-primary"
                  onClick={() => handleAddExperiencePlanItem()}
                >
                  <i className="bi bi-plus-circle me-2"></i>
                  {lang.en.button.addPlanItem}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setCollaboratorContext('experience');
                    setShowCollaboratorModal(true);
                  }}
                >
                  <i className="bi bi-person-plus me-2"></i>
                  Add Collaborator to Experience
                </button>
              </div>
            </div>
          )}
          <div className="row my-2 p-3 fade-in">
            {experience.plan_items && experience.plan_items.length > 0 && (
              <div className="plan-items-container fade-in p-3 p-md-4">
                {/* Plan Navigation Tabs */}
                {debug.log("Rendering tabs. collaborativePlans:", collaborativePlans, "length:", collaborativePlans.length) || null}
                <div className="plan-tabs-nav mb-4">
                  <button
                    className={`plan-tab-button ${activeTab === "experience" ? "active" : ""}`}
                    onClick={() => setActiveTab("experience")}
                  >
                    Experience Plan Items
                  </button>
                  {collaborativePlans.length > 0 && (
                    <div className="plan-tab-dropdown-container">
                      <button
                        className={`plan-tab-button ${activeTab === "myplan" ? "active" : ""}`}
                        onClick={() => setActiveTab("myplan")}
                      >
                        {(() => {
                          // Find the first plan (which is sorted to be user's own if it exists)
                          const firstPlan = collaborativePlans[0];
                          if (!firstPlan) return "My Plan";
                          
                          const isUserOwned = firstPlan.user._id === user._id || firstPlan.user === user._id;
                          return isUserOwned ? "My Plan" : `${firstPlan.user.name}'s Plan`;
                        })()}
                      </button>
                      {collaborativePlans.length > 1 && (
                        <select
                          className="plan-dropdown"
                          value={selectedPlanId || ""}
                          onChange={(e) => handlePlanChange(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {collaborativePlans.map(plan => (
                            <option key={plan._id} value={plan._id}>
                              {plan.user._id === user._id 
                                ? "My Plan" 
                                : `${plan.user.name}'s Plan`}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </div>

                {/* Experience Plan Items Tab Content */}
                {activeTab === "experience" && (
                  <>
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
                              const hasChildren = experience.plan_items.some(
                                (sub) =>
                                  sub.parent &&
                                  sub.parent.toString() ===
                                    planItem._id.toString()
                              );
                              if (hasChildren) {
                                return (
                                  <button
                                    className="btn btn-sm btn-link p-0 expand-toggle"
                                    onClick={() => toggleExpanded(planItem._id)}
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
                          {isOwner && (
                            <div className="d-flex gap-1">
                              {!planItem.parent && (
                                <button
                                  className="btn btn-outline-primary btn-sm"
                                  onClick={() => handleAddExperiencePlanItem(planItem._id)}
                                  aria-label={`${lang.en.button.addChild} to ${planItem.text}`}
                                  title={lang.en.button.addChild}
                                >
                                  ✚
                                </button>
                              )}
                              <button
                                className="btn btn-outline-secondary btn-sm"
                                onClick={() => handleEditExperiencePlanItem(planItem)}
                                aria-label={`Edit ${planItem.text}`}
                                title="Edit"
                              >
                                ✏️
                              </button>
                              <button
                                className="btn btn-outline-danger btn-sm"
                                onClick={() => {
                                  setPlanItemToDelete(planItem._id);
                                  setShowPlanDeleteModal(true);
                                }}
                                aria-label={`Delete ${planItem.text}`}
                                title="Delete"
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
                                <strong className="text-dark">Cost:</strong> $
                                {planItem.cost_estimate}
                              </span>
                            )}
                            {Number(planItem.planning_days) > 0 && (
                              <span className="d-flex align-items-center gap-2">
                                <strong className="text-dark">
                                  Planning Time:
                                </strong>{" "}
                                {planItem.planning_days} {planItem.planning_days === 1 ? 'day' : 'days'}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ));
                })()}
                  </>
                )}

                {/* My Plan Tab Content */}
                {activeTab === "myplan" && selectedPlanId && (
                  <div className="my-plan-view">
                    {/* Action Buttons - Only show for plan owner or collaborator */}
                    {(() => {
                      const currentPlan = collaborativePlans.find(p => p._id === selectedPlanId);
                      const isPlanOwner = currentPlan && currentPlan.user._id === user._id;
                      const isPlanCollaborator = currentPlan && currentPlan.permissions?.some(p => 
                        p._id.toString() === user._id.toString() && 
                        ['owner', 'collaborator'].includes(p.type)
                      );
                      const canEdit = isPlanOwner || isPlanCollaborator;
                      
                      return (
                        <div className="d-flex justify-content-between mb-3">
                          {canEdit && (
                            <button
                              className="btn btn-primary"
                              style={{ width: 'fit-content', padding: '0.75rem 1.5rem' }}
                              onClick={() => handleAddPlanInstanceItem()}
                            >
                              {lang.en.button.addPlanItem}
                            </button>
                          )}
                          {isPlanOwner && (
                            <button
                              className="btn btn-outline-primary"
                              style={{ width: 'fit-content', padding: '0.75rem 1.5rem' }}
                              onClick={() => {
                                setCollaboratorContext('plan');
                                setShowCollaboratorModal(true);
                              }}
                            >
                              <i className="bi bi-person-plus me-2"></i>
                              Add Collaborator
                            </button>
                          )}
                        </div>
                      );
                    })()}
                    
                    {/* Sync Button */}
                    {showSyncButton && (
                      <div className="alert alert-warning mb-3 d-flex justify-content-between align-items-center">
                        <div>
                          <strong>Plan out of sync!</strong>
                          <p className="mb-0 small">
                            The experience plan has changed since you created this plan. 
                            Click sync to update your plan with the latest items.
                          </p>
                        </div>
                        <button
                          className="btn btn-primary ms-3"
                          onClick={handleSyncPlan}
                          disabled={loading}
                        >
                          {loading ? "Syncing..." : "Sync Plan"}
                        </button>
                      </div>
                    )}

                    {/* Collaborators Display */}
                    {(() => {
                      const currentPlan = collaborativePlans.find(p => p._id === selectedPlanId);
                      if (!currentPlan || !currentPlan.permissions) return null;
                      
                      // Get all collaborators (exclude owner and contributors)
                      const collaboratorPerms = currentPlan.permissions.filter(p => 
                        p.entity === 'user' && 
                        p.type === 'collaborator' &&
                        p.user // Has populated user data
                      );
                      
                      if (collaboratorPerms.length === 0) return null;
                      
                      return (
                        <div className="alert alert-info mb-3">
                          <strong>Collaborators: </strong>
                          {collaboratorPerms.map((perm, index) => {
                            const isLast = index === collaboratorPerms.length - 1;
                            const isSecondToLast = index === collaboratorPerms.length - 2;
                            
                            return (
                              <span key={perm._id.toString()}>
                                <Link to={`/profile/${perm._id}`} className="text-decoration-none fw-semibold">
                                  {perm.user.name}
                                </Link>
                                {collaboratorPerms.length > 1 && !isLast && (
                                  isSecondToLast ? ' and ' : ', '
                                )}
                              </span>
                            );
                          })}
                        </div>
                      );
                    })()}

                    <h3 className="mb-3 text-center fw-bold text-dark">
                      {(() => {
                        const currentPlanOwner = collaborativePlans.find(p => p._id === selectedPlanId);
                        if (!currentPlanOwner) return "My Plan";
                        return currentPlanOwner.user._id === user._id
                          ? "My Plan"
                          : `${currentPlanOwner.user.name}'s Plan`;
                      })()}
                    </h3>
                    
                    {(() => {
                      const currentPlan = collaborativePlans.find(p => p._id === selectedPlanId);
                      if (!currentPlan) {
                        return <p className="text-center text-muted">Plan not found.</p>;
                      }

                      // Plan metadata
                      const planMetadata = (
                        <div className="plan-metadata mb-4 p-3 bg-light rounded">
                          <div className="row">
                            <div className="col-md-3 mb-2">
                              <small className="text-muted d-block">Planned Date</small>
                              <strong>
                                {currentPlan.planned_date 
                                  ? formatDateShort(currentPlan.planned_date)
                                  : "Not set"}
                              </strong>
                            </div>
                            <div className="col-md-3 mb-2">
                              <small className="text-muted d-block">Total Cost</small>
                              <strong>${(currentPlan.total_cost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                            </div>
                            <div className="col-md-3 mb-2">
                              <small className="text-muted d-block">Completion</small>
                              <strong>{currentPlan.completion_percentage || 0}%</strong>
                            </div>
                            <div className="col-md-3 mb-2">
                              <small className="text-muted d-block">Planning Time</small>
                              <strong>{currentPlan.max_days || 0} {(currentPlan.max_days || 0) === 1 ? 'day' : 'days'}</strong>
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
                            debug.log(`Item with parent: "${item.text}", parent: ${item.parent}, plan_item_id: ${item.plan_item_id}, _id: ${item._id}`);
                          }
                          
                          items
                            .filter(
                              (sub) =>
                                sub.parent &&
                                sub.parent.toString() === (item.plan_item_id || item._id).toString()
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
                            <p className="text-center text-muted">No plan items yet.</p>
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
                                            (planItem.plan_item_id || planItem._id).toString()
                                      );
                                      if (hasChildren) {
                                        return (
                                          <button
                                            className="btn btn-sm btn-link p-0 expand-toggle"
                                            onClick={() => toggleExpanded(planItem.plan_item_id || planItem._id)}
                                          >
                                            {expandedParents.has(planItem.plan_item_id || planItem._id)
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
                                  {(() => {
                                    // Check if user can edit this plan (owner or collaborator)
                                    const canEditPlan = currentPlan && (
                                      currentPlan.user._id === user._id ||
                                      currentPlan.permissions?.some(p => 
                                        p._id.toString() === user._id.toString() && 
                                        ['owner', 'collaborator'].includes(p.type)
                                      )
                                    );

                                    return (
                                      <div className="d-flex gap-1">
                                        {canEditPlan && !planItem.parent && (
                                          <button
                                            className="btn btn-outline-primary btn-sm"
                                            onClick={() => handleAddPlanInstanceItem(planItem.plan_item_id || planItem._id)}
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
                                              onClick={() => handleEditPlanInstanceItem(planItem)}
                                              aria-label={`Edit ${planItem.text}`}
                                              title="Edit"
                                            >
                                              ✏️
                                            </button>
                                            <button
                                              className="btn btn-outline-danger btn-sm"
                                              onClick={() => {
                                                setPlanInstanceItemToDelete(planItem);
                                                setShowPlanInstanceDeleteModal(true);
                                              }}
                                              aria-label={`Delete ${planItem.text}`}
                                              title="Delete"
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
                                              const itemId = planItem._id || planItem.plan_item_id;
                                              await updatePlanItem(selectedPlanId, itemId, {
                                                complete: !planItem.complete
                                              });
                                              await fetchCollaborativePlans();
                                              await fetchUserPlan();
                                            } catch (err) {
                                              handleError(err, { context: "Toggle plan item completion" });
                                            }
                                          }}
                                          onMouseEnter={() =>
                                            setHoveredPlanItem(planItem._id || planItem.plan_item_id)
                                          }
                                          onMouseLeave={() => setHoveredPlanItem(null)}
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
                                            ? hoveredPlanItem === (planItem._id || planItem.plan_item_id)
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
                                        <strong className="text-dark">Cost:</strong> $
                                        {planItem.cost}
                                      </span>
                                    )}
                                    {Number(planItem.planning_days) > 0 && (
                                      <span className="d-flex align-items-center gap-2">
                                        <strong className="text-dark">Planning Time:</strong>{" "}
                                        {planItem.planning_days} {planItem.planning_days === 1 ? 'day' : 'days'}
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
        title="Remove Experience from Your Plans"
        message="Are you sure you want to remove this experience? Your plan and all progress tracked will be permanently deleted."
        confirmText="Remove Experience"
        confirmVariant="danger"
      />
      <ConfirmModal
        show={showPlanDeleteModal}
        onClose={() => setShowPlanDeleteModal(false)}
        onConfirm={() => handlePlanDelete(planItemToDelete)}
        title={lang.en.modal.confirmDelete}
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
        title={lang.en.modal.confirmDelete}
        message={planInstanceItemToDelete ? `Delete "${planInstanceItemToDelete.text}"?` : lang.en.modal.confirmDeletePlanItem}
        confirmText={lang.en.button.delete}
        confirmVariant="danger"
      />
      
      {/* Add Collaborator Modal */}
      {showCollaboratorModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  Add Collaborator to {collaboratorContext === 'experience' ? 'Experience' : 'Plan'}
                </h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => {
                    setShowCollaboratorModal(false);
                    setCollaboratorUserId("");
                    setCollaboratorSearch("");
                    setSearchResults([]);
                    setSelectedUser(null);
                    setCollaboratorAddSuccess(false);
                    setAddedCollaborators([]);
                    setCollaboratorContext('plan');
                  }}
                ></button>
              </div>
              
              {collaboratorAddSuccess ? (
                // Success message view
                <>
                  <div className="modal-body text-center py-5">
                    <div className="mb-3">
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        width="64" 
                        height="64" 
                        fill="currentColor" 
                        className="bi bi-check-circle-fill text-success" 
                        viewBox="0 0 16 16"
                      >
                        <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
                      </svg>
                    </div>
                    <h4>Collaborator{addedCollaborators.length > 1 ? 's' : ''} Added Successfully!</h4>
                    <p className="text-muted">
                      {addedCollaborators.length === 1 ? (
                        <>
                          <strong>{addedCollaborators[0].name}</strong> has been added as a collaborator to your {collaboratorContext} and can now view and edit it.
                        </>
                      ) : (
                        <>
                          <strong>{addedCollaborators.length} users</strong> have been added as collaborators to your {collaboratorContext}.
                        </>
                      )}
                    </p>
                  </div>
                  <div className="modal-footer justify-content-center">
                    <button 
                      type="button" 
                      className="btn btn-outline-secondary" 
                      onClick={() => {
                        // Reset for adding another collaborator
                        setCollaboratorAddSuccess(false);
                        setCollaboratorUserId("");
                        setCollaboratorSearch("");
                        setSearchResults([]);
                        setSelectedUser(null);
                      }}
                    >
                      Add Another
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-primary" 
                      onClick={() => {
                        setShowCollaboratorModal(false);
                        setCollaboratorUserId("");
                        setCollaboratorSearch("");
                        setSearchResults([]);
                        setSelectedUser(null);
                        setCollaboratorAddSuccess(false);
                        setAddedCollaborators([]);
                        setCollaboratorContext('plan');
                      }}
                    >
                      Done
                    </button>
                  </div>
                </>
              ) : (
                // Form view
                <>
                  <form id="addCollaboratorForm" className="collaborator-modal-form" onSubmit={handleAddCollaborator}>
                    <div className="modal-body">
                      <p className="text-muted mb-3">
                        Search for a user by name or email address to add them as a collaborator. 
                        They will be able to view and edit this {collaboratorContext}.
                      </p>
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
                          placeholder="Type name or email..."
                          autoComplete="off"
                        />
                        {searchResults.length > 0 && (
                          <div 
                            className="position-absolute w-100 mt-1 bg-white border rounded shadow-sm" 
                            style={{ zIndex: 1000, maxHeight: '200px', overflowY: 'auto' }}
                          >
                            {searchResults.map(user => (
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
                        {selectedUser && (
                          <div className="mt-2 p-2 bg-light rounded">
                            <strong>Selected:</strong> {selectedUser.name} ({selectedUser.email})
                          </div>
                        )}
                      </div>
                    </div>
                  </form>
                  <div className="modal-footer justify-content-center">
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      onClick={() => {
                        setShowCollaboratorModal(false);
                        setCollaboratorUserId("");
                        setCollaboratorSearch("");
                        setSearchResults([]);
                        setSelectedUser(null);
                        setCollaboratorAddSuccess(false);
                        setAddedCollaborators([]);
                        setCollaboratorContext('plan');
                      }}
                      disabled={loading}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      form="addCollaboratorForm"
                      className="btn btn-primary"
                      disabled={loading || !selectedUser}
                    >
                      {loading ? "Adding..." : "Add Collaborator"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Sync Plan Modal */}
      {showSyncModal && syncChanges && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Sync Plan with Experience</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => {
                    setShowSyncModal(false);
                    setSyncChanges(null);
                  }}
                ></button>
              </div>
              <div className="modal-body">
                <p className="text-muted mb-3">
                  Select the changes you want to apply to your plan:
                </p>

                {/* Added Items */}
                {syncChanges.added.length > 0 && (
                  <div className="mb-4">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <h6 className="text-success mb-0">
                        <strong>✚ Added Items ({syncChanges.added.length})</strong>
                      </h6>
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="selectAllAdded"
                          checked={selectedSyncItems.added.length === syncChanges.added.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSyncItems(prev => ({
                                ...prev,
                                added: syncChanges.added.map((_, idx) => idx)
                              }));
                            } else {
                              setSelectedSyncItems(prev => ({ ...prev, added: [] }));
                            }
                          }}
                        />
                        <label className="form-check-label" htmlFor="selectAllAdded">
                          Select All
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
                                    setSelectedSyncItems(prev => ({
                                      ...prev,
                                      added: [...prev.added, idx]
                                    }));
                                  } else {
                                    setSelectedSyncItems(prev => ({
                                      ...prev,
                                      added: prev.added.filter(i => i !== idx)
                                    }));
                                  }
                                }}
                              />
                            </div>
                            <div className="flex-grow-1">
                              <strong>{item.text}</strong>
                              {item.url && (
                                <div className="small text-muted">
                                  URL: <a href={item.url} target="_blank" rel="noopener noreferrer">{item.url}</a>
                                </div>
                              )}
                            </div>
                            <div className="text-end ms-2">
                              {item.cost > 0 && (
                                <div className="badge bg-secondary">${item.cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                              )}
                              {item.planning_days > 0 && (
                                <div className="badge bg-info ms-1">{item.planning_days} {item.planning_days === 1 ? 'day' : 'days'}</div>
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
                        <strong>✖ Removed Items ({syncChanges.removed.length})</strong>
                      </h6>
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="selectAllRemoved"
                          checked={selectedSyncItems.removed.length === syncChanges.removed.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSyncItems(prev => ({
                                ...prev,
                                removed: syncChanges.removed.map((_, idx) => idx)
                              }));
                            } else {
                              setSelectedSyncItems(prev => ({ ...prev, removed: [] }));
                            }
                          }}
                        />
                        <label className="form-check-label" htmlFor="selectAllRemoved">
                          Select All
                        </label>
                      </div>
                    </div>
                    <div className="list-group">
                      {syncChanges.removed.map((item, idx) => (
                        <div key={idx} className="list-group-item list-group-item-danger">
                          <div className="d-flex align-items-start">
                            <div className="form-check me-3 mt-1">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id={`remove-${idx}`}
                                checked={selectedSyncItems.removed.includes(idx)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedSyncItems(prev => ({
                                      ...prev,
                                      removed: [...prev.removed, idx]
                                    }));
                                  } else {
                                    setSelectedSyncItems(prev => ({
                                      ...prev,
                                      removed: prev.removed.filter(i => i !== idx)
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
                        <strong>✎ Modified Items ({syncChanges.modified.length})</strong>
                      </h6>
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="selectAllModified"
                          checked={selectedSyncItems.modified.length === syncChanges.modified.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSyncItems(prev => ({
                                ...prev,
                                modified: syncChanges.modified.map((_, idx) => idx)
                              }));
                            } else {
                              setSelectedSyncItems(prev => ({ ...prev, modified: [] }));
                            }
                          }}
                        />
                        <label className="form-check-label" htmlFor="selectAllModified">
                          Select All
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
                                    setSelectedSyncItems(prev => ({
                                      ...prev,
                                      modified: [...prev.modified, idx]
                                    }));
                                  } else {
                                    setSelectedSyncItems(prev => ({
                                      ...prev,
                                      modified: prev.modified.filter(i => i !== idx)
                                    }));
                                  }
                                }}
                              />
                            </div>
                            <div className="flex-grow-1">
                              <strong className="d-block mb-2">{item.text}</strong>
                              {item.modifications.map((mod, modIdx) => (
                                <div key={modIdx} className="small mb-1">
                                  <span className="badge bg-warning text-dark me-2">{mod.field}</span>
                                  <span className="text-decoration-line-through text-muted me-2">
                                    {mod.field === 'cost' 
                                      ? `$${(mod.old || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                                      : mod.field === 'days'
                                      ? `${mod.old || 0} ${(mod.old || 0) === 1 ? 'day' : 'days'}`
                                      : mod.old || '(empty)'}
                                  </span>
                                  →
                                  <span className="text-success ms-2">
                                    {mod.field === 'cost' 
                                      ? `$${(mod.new || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                                      : mod.field === 'days'
                                      ? `${mod.new || 0} ${(mod.new || 0) === 1 ? 'day' : 'days'}`
                                      : mod.new || '(empty)'}
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

                {syncChanges.added.length === 0 && syncChanges.removed.length === 0 && syncChanges.modified.length === 0 && (
                  <div className="alert alert-info">
                    <strong>No changes detected.</strong> Your plan is already in sync with the experience.
                  </div>
                )}

                <div className="alert alert-warning mt-3">
                  <strong>Note:</strong> Your completion status and actual costs will be preserved for existing items.
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setShowSyncModal(false);
                    setSyncChanges(null);
                  }}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={confirmSyncPlan}
                  disabled={loading || (selectedSyncItems.added.length === 0 && selectedSyncItems.removed.length === 0 && selectedSyncItems.modified.length === 0)}
                >
                  {loading ? "Syncing..." : "Confirm Sync"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Plan Instance Item Modal */}
      {showPlanItemModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog plan-item-modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {planItemFormState === 1 
                    ? (editingPlanItem.parent ? 'Add Child Plan Item' : 'Add Plan Item')
                    : 'Edit Plan Item'}
                </h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => {
                    setShowPlanItemModal(false);
                    setEditingPlanItem({});
                  }}
                ></button>
              </div>
              <form id="planItemForm" className="plan-item-modal-form" onSubmit={activeTab === "experience" ? handleSaveExperiencePlanItem : handleSavePlanInstanceItem}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label htmlFor="planItemText" className="form-label">
                      Item Description <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      id="planItemText"
                      value={editingPlanItem.text || ""}
                      onChange={(e) => setEditingPlanItem({ ...editingPlanItem, text: e.target.value })}
                      placeholder="Enter item description"
                      required
                    />
                  </div>
                  
                  <div className="mb-3">
                    <label htmlFor="planItemUrl" className="form-label">
                      URL (optional)
                    </label>
                    <input
                      type="url"
                      className="form-control"
                      id="planItemUrl"
                      value={editingPlanItem.url || ""}
                      onChange={(e) => setEditingPlanItem({ ...editingPlanItem, url: e.target.value })}
                      placeholder="https://example.com"
                    />
                  </div>
                  
                  <div className="mb-3">
                    <label htmlFor="planItemCost" className="form-label">
                      Cost ($)
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      id="planItemCost"
                      value={editingPlanItem.cost || 0}
                      onChange={(e) => setEditingPlanItem({ ...editingPlanItem, cost: parseFloat(e.target.value) || 0 })}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  
                  <div className="mb-3">
                    <label htmlFor="planItemDays" className="form-label">
                      Planning Days
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      id="planItemDays"
                      value={editingPlanItem.planning_days || 0}
                      onChange={(e) => setEditingPlanItem({ ...editingPlanItem, planning_days: parseInt(e.target.value) || 0 })}
                      min="0"
                    />
                  </div>
                </div>
              </form>
              <div className="modal-footer justify-content-center">
                <div className="d-flex gap-2">
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => {
                      setShowPlanItemModal(false);
                      setEditingPlanItem({});
                    }}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    form="planItemForm"
                    className="btn btn-primary"
                    disabled={loading || !editingPlanItem.text}
                  >
                    {loading ? "Saving..." : (planItemFormState === 1 ? "Add Item" : "Update Item")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

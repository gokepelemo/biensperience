import ExperienceModals from './components/ExperienceModals';
import ExperiencePageHead from './components/ExperiencePageHead';
import ExperienceLayout from './components/ExperienceLayout';
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useUser } from "../../contexts/UserContext";
import { useData } from "../../contexts/DataContext";
import { useApp } from "../../contexts/AppContext";
import { useToast } from "../../contexts/ToastContext";
import useCollaboratorManager from "../../hooks/useCollaboratorManager";
import useExperienceCollaboratorData from "../../hooks/useExperienceCollaboratorData";
import { EntityNotFound } from "../../components/design-system";
import SingleExperienceSkeleton from "./components/SingleExperienceSkeleton";
import debug from "../../utilities/debug";
import { logger } from "../../utilities/logger";
import { useNavigationIntent } from "../../contexts/NavigationIntentContext";
import { useNavigationContext } from "../../contexts/NavigationContext";
import { useScrollHighlight } from "../../hooks/useScrollHighlight";
import usePlanManagement from "../../hooks/usePlanManagement";
import usePlanCosts from "../../hooks/usePlanCosts";
import usePlanSync from "../../hooks/usePlanSync";
import { usePresence } from "../../hooks/usePresence";
import { MODAL_NAMES } from "../../hooks/useModalManager";
import useExperienceModalState from "../../hooks/useExperienceModalState";
import { useDateManagement } from "../../hooks/useDateManagement";
import { useExperienceActions } from "../../hooks/useExperienceActions";
import { usePlanItemNotes } from "../../hooks/usePlanItemNotes";
import useExperienceHashRouting from "../../hooks/useExperienceHashRouting";
import useExperienceWebSocketEvents from "../../hooks/useExperienceWebSocketEvents";
import useExperienceHierarchyState from "../../hooks/useExperienceHierarchyState";
import useExperienceMentions from "../../hooks/useExperienceMentions";
import useExperiencePlanItemActions from "../../hooks/useExperiencePlanItemActions";
import useExperienceDetailsActions from "../../hooks/useExperienceDetailsActions";
import useExperienceDataLoader from "../../hooks/useExperienceDataLoader";
import useDetailsItemSync from "../../hooks/useDetailsItemSync";
import useExperienceCreatePlan from "../../hooks/useExperienceCreatePlan";
import usePlanButtonWidth from "../../hooks/usePlanButtonWidth";
import useExperienceSideEffects from "../../hooks/useExperienceSideEffects";
import useExperienceLifecycle from "../../hooks/useExperienceLifecycle";
import useExperiencePlanSelection from "../../hooks/useExperiencePlanSelection";
import './components/MyPlanTabContent/plan-item-views.css';
import { idEquals, normalizeId } from "../../utilities/id-utils";
import { getPhotoObjects } from "../../utilities/photo-utils";

export default function SingleExperience() {
  // ============================================================================
  // CONTEXT HOOKS & ROUTER
  // ============================================================================

  const { user } = useUser();
  const {
    fetchExperiences,
    fetchPlans,
    experiences: ctxExperiences,
    updateExperience: updateExperienceInContext,
  } = useData();
  const { registerH1, updateShowH1InNavbar } = useApp();
  const { success, error: showError, undoable } = useToast();
  const { experienceId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Date editing mode (passed into useDateManagement to avoid circular dep)
  const [isEditingDate, setIsEditingDate] = useState(false);

  // ============================================================================
  // CUSTOM HOOKS — plan/cost/presence/intent
  // ============================================================================

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
    createPlan,
    updatePlan,
    deletePlan,
  } = usePlanManagement(experienceId, user?._id);

  const {
    costs,
    costSummary,
    loading: costsLoading,
    addCost,
    updateCost,
    deleteCost,
  } = usePlanCosts(selectedPlanId);

  const {
    isConnected: presenceConnected,
    experienceMembers,
    planMembers,
    setTyping,
    setTab: setPresenceTab,
    subscribe: subscribeToEvents,
  } = usePresence({
    experienceId,
    planId: selectedPlanId,
    initialTab: 'the-plan',
    enabled: !!user?._id,
  });

  const { intent, consumeIntent, clearIntent } = useNavigationIntent();
  const { setNavigatedEntity } = useNavigationContext();
  const { scrollToItem } = useScrollHighlight();

  // ============================================================================
  // COMPONENT STATE
  // ============================================================================

  // Core experience data — pre-populate from DataContext cache for instant display
  const [experience, setExperience] = useState(() => {
    if (!ctxExperiences || !ctxExperiences.length || !experienceId) return null;
    return ctxExperiences.find((e) => idEquals(e._id, experienceId)) || null;
  });
  const [travelTips, setTravelTips] = useState(() => {
    if (!ctxExperiences || !ctxExperiences.length || !experienceId) return [];
    const cached = ctxExperiences.find((e) => idEquals(e._id, experienceId));
    return cached?.travel_tips || [];
  });
  const [loading, setLoading] = useState(false);
  const [experienceNotFound, setExperienceNotFound] = useState(false);

  // UI state
  const [favHover, setFavHover] = useState(false);
  const [hoveredPlanItem, setHoveredPlanItem] = useState(null);
  const [activeTab, setActiveTab] = useState("experience");
  const [pendingUnplan, setPendingUnplan] = useState(false);
  const [bienbotNewItemIds, setBienbotNewItemIds] = useState(() => new Set());
  const [experienceTabLoading, setExperienceTabLoading] = useState(true);

  // Modal management + modal data state
  const {
    activeModal,
    openModal,
    closeModal,
    isModalOpen,
    planItemToDelete,
    setPlanItemToDelete,
    planInstanceItemToDelete,
    setPlanInstanceItemToDelete,
    planItemFormState,
    setPlanItemFormState,
    editingPlanItem,
    setEditingPlanItem,
    selectedDetailsItem,
    setSelectedDetailsItem,
    detailsModalInitialTab,
    setDetailsModalInitialTab,
    inlineCostPlanItem,
    setInlineCostPlanItem,
    inlineCostLoading,
    setInlineCostLoading,
    photoViewerIndex,
    setPhotoViewerIndex,
    requestAccessPlanId,
    setRequestAccessPlanId,
    accessDeniedPlanId,
    setAccessDeniedPlanId,
    accessRequestSent,
    setAccessRequestSent,
    incompleteChildrenDialogData,
    setIncompleteChildrenDialogData,
    setShowDatePickerState,
    handleOpenPlanDeleteModal,
    handleOpenPlanInstanceDeleteModal,
    handleOpenDeleteExperienceModal,
  } = useExperienceModalState();

  // Refs
  const planButtonRef = useRef(null);
  const [planBtnWidth, setPlanBtnWidth] = usePlanButtonWidth();

  // Lifecycle: user-interaction counter + unmount flag
  const {
    userInteractionRef,
    isUnmountingRef,
    beginUserInteraction,
    endUserInteraction,
  } = useExperienceLifecycle();

  const h1Ref = useRef(null);

  // Memoized hero photos array
  const heroPhotos = useMemo(() => {
    const source = (experience?.photos?.length > 0)
      ? experience
      : (experience?.destination?.photos?.length > 0)
        ? experience.destination
        : null;
    return source ? getPhotoObjects(source) : [];
  }, [experience]);

  // Register experience and active plan in the navigation schema
  useEffect(() => {
    if (experience?._id) setNavigatedEntity('experience', experience);
  }, [experience?._id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (selectedPlan?._id) setNavigatedEntity('plan', selectedPlan);
  }, [selectedPlan?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================================================
  // MEMOIZED VALUES & COMPUTED STATE
  // ============================================================================

  const normalizePlan = useCallback((plan) => {
    if (!plan) return plan;
    const normalized = { ...plan };
    if (normalized._id && normalized._id.toString) normalized._id = normalized._id.toString();
    if (normalized.user && normalized.user._id && normalized.user._id.toString) {
      normalized.user = { ...normalized.user, _id: normalized.user._id.toString() };
    }
    return normalized;
  }, []);

  // Canonical plan selection list
  const allAccessiblePlans = useMemo(() => {
    const plans = [];
    if (userPlan) plans.push(userPlan);
    if (Array.isArray(sharedPlans) && sharedPlans.length) plans.push(...sharedPlans);

    const seen = new Set();
    return plans.filter((p) => {
      const pid = normalizeId(p?._id);
      if (!pid) return false;
      if (seen.has(pid)) return false;
      seen.add(pid);
      return true;
    });
  }, [userPlan, sharedPlans]);

  const currentPlan = useMemo(
    () =>
      activeTab === "experience"
        ? null
        : selectedPlanId
        ? allAccessiblePlans.find((p) => idEquals(p._id, selectedPlanId))
        : userPlan,
    [activeTab, selectedPlanId, allAccessiblePlans, userPlan]
  );

  // Owners/collaborators (IDs + resolved user records)
  const {
    experienceOwnerId,
    experienceOwner,
    experienceOwnerLoading,
    refetchExperienceOwner,
    experienceCollaborators,
    experienceCollaboratorsLoading,
    planOwner,
    planOwnerLoading,
    planCollaborators,
    planCollaboratorsLoading,
  } = useExperienceCollaboratorData({ experience, currentPlan });

  const { allPlanCollaborators, availableEntities, entityData } = useExperienceMentions({
    planOwner,
    planCollaborators,
    selectedPlan,
    experience,
  });

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  const { fetchAllData } = useExperienceDataLoader({
    experienceId,
    user,
    ctxExperiences,
    experience,
    setExperience,
    setTravelTips,
    setUserPlan,
    setUserHasExperience,
    setUserPlannedDate,
    setSharedPlans,
    setPlansLoading,
    setExperienceNotFound,
    updateExperienceInContext,
    normalizePlan,
  });

  // ============================================================================
  // CUSTOM HOOKS — collaborator + sync + actions + notes
  // ============================================================================

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
    showError,
  });

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
  } = usePlanSync({
    experience,
    selectedPlanId,
    allPlans: allAccessiblePlans,
    fetchSharedPlans,
    fetchUserPlan,
    fetchPlans,
    showError,
  });

  const {
    handleExperience,
    handleShareExperience,
    handleSharePlanItem,
    confirmRemoveExperience,
    pendingUnplanRef,
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
    setUserPlan,
    setUserHasExperience,
    setDisplayedPlannedDate,
    setSharedPlans,
    fetchPlans,
    success,
    showError,
    undoable,
  });

  const {
    handleAddNote: handleAddNoteToItem,
    handleUpdateNote: handleUpdateNoteOnItem,
    handleDeleteNote: handleDeleteNoteFromItem,
    handleVoteNoteRelevancy: handleVoteNoteRelevancyOnItem,
  } = usePlanItemNotes({
    selectedPlanId,
    selectedDetailsItem,
    setSelectedDetailsItem,
    setSharedPlans,
    setUserPlan,
    userPlan,
    user,
    success,
    showError,
    undoable,
  });

  // Hierarchy state (expanded parents + persistence)
  const {
    expandedParents,
    setExpandedParents,
    animatingCollapse,
    setHierarchyLoaded,
    getExpansionKey,
    isItemExpanded,
    toggleExpanded,
  } = useExperienceHierarchyState({
    user,
    experience,
    selectedPlanId,
    currentPlan,
    activeTab,
  });

  // ============================================================================
  // SIDE EFFECTS
  // ============================================================================

  // OPTIMIZATION: Use combined fetch on initial load
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Reset component state when navigating to a different experience
  useEffect(() => {
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
    resetSyncState();
    setFavHover(false);
    setPendingUnplan(false);
    setPlanBtnWidth(null);
    closeModal();
    setIsEditingDate(false);
    setPlannedDate("");
    setPlanItemToDelete(null);
    setPlanInstanceItemToDelete(null);
    setExperienceNotFound(false);
    setAccessDeniedPlanId(null);
    setAccessRequestSent(false);
    setExperienceTabLoading(true);
    userInteractionRef.current = 0;
    setPlanItemFormState(1);
    setEditingPlanItem({});
  }, [experienceId, resetSyncState]);

  // ============================================================================
  // HASH ROUTING (deep links + intent + URL sync)
  // ============================================================================

  const detailsModalOpen = isModalOpen(MODAL_NAMES.PLAN_ITEM_DETAILS);

  const { writeExperienceHash } = useExperienceHashRouting({
    experienceId,
    activeTab,
    setActiveTab,
    selectedPlanId,
    setSelectedPlanId,
    plansLoading,
    allAccessiblePlans,
    userPlan,
    setUserPlan,
    userInteractionRef,
    isUnmountingRef,
    intent,
    consumeIntent,
    clearIntent,
    scrollToItem,
    openModal,
    isModalOpen,
    MODAL_NAMES,
    selectedDetailsItem,
    setSelectedDetailsItem,
    setDetailsModalInitialTab,
    detailsModalOpen,
    setAccessDeniedPlanId,
    setAccessRequestSent,
  });

  // Keep selectedDetailsItem in sync with the latest plan data
  useDetailsItemSync({
    isModalOpen,
    MODAL_NAMES,
    selectedDetailsItem,
    setSelectedDetailsItem,
    selectedPlanId,
    allAccessiblePlans,
    userPlan,
  });

  // Subscribe to WebSocket and event-bus events for real-time updates
  useExperienceWebSocketEvents({
    subscribeToEvents,
    experienceId,
    fetchSharedPlans,
    fetchAllData,
    setExperience,
    isModalOpen,
    MODAL_NAMES,
    selectedDetailsItem,
    setSelectedDetailsItem,
  });

  // Bundled side-effects: BienBot fade-in, request-access intent, smooth loading,
  // h1 register, presence tab sync, stale-owner refresh.
  useExperienceSideEffects({
    userPlan,
    selectedPlanId,
    setActiveTab,
    setBienbotNewItemIds,
    openModal,
    MODAL_NAMES,
    setRequestAccessPlanId,
    experience,
    setExperienceTabLoading,
    h1Ref,
    registerH1,
    updateShowH1InNavbar,
    setPresenceTab,
    activeTab,
    experienceOwnerId,
    refetchExperienceOwner,
  });

  // ============================================================================
  // PLAN ITEM HANDLERS
  // ============================================================================

  // Plan selection + details navigation
  const {
    handlePlanChange,
    handleViewPlanItemDetails,
    handlePrevPlanItemDetails,
    handleNextPlanItemDetails,
    detailsNavIndex,
    handleAddCostForItem,
  } = useExperiencePlanSelection({
    user,
    userPlan,
    sharedPlans,
    selectedPlanId,
    setSelectedPlanId,
    selectedPlan,
    allAccessiblePlans,
    setDisplayedPlannedDate,
    plansLoading,
    intent,
    writeExperienceHash,
    openModal,
    MODAL_NAMES,
    selectedDetailsItem,
    setSelectedDetailsItem,
    setDetailsModalInitialTab,
    beginUserInteraction,
    endUserInteraction,
    setInlineCostPlanItem,
  });

  const {
    handleAddPlanInstanceItem,
    handleEditPlanInstanceItem,
    handleSavePlanInstanceItem,
    handlePlanInstanceItemDelete,
    handleAddExperiencePlanItem,
    handleEditExperiencePlanItem,
    handleSaveExperiencePlanItem,
    handlePlanDelete,
    handlePlanItemToggleComplete,
    handleReorderPlanItems,
    handleReorderExperiencePlanItems,
  } = useExperiencePlanItemActions({
    experience,
    setExperience,
    selectedPlanId,
    selectedPlan,
    sharedPlans,
    setSharedPlans,
    userPlan,
    setUserPlan,
    planItemFormState,
    setEditingPlanItem,
    setPlanItemFormState,
    planInstanceItemToDelete,
    setPlanInstanceItemToDelete,
    setSelectedDetailsItem,
    setIncompleteChildrenDialogData,
    fetchAllData,
    fetchSharedPlans,
    fetchUserPlan,
    fetchPlans,
    fetchExperiences,
    openModal,
    closeModal,
    MODAL_NAMES,
    beginUserInteraction,
    endUserInteraction,
    success,
    showError,
    undoable,
  });

  const {
    handleSaveInlineCost,
    handleAddDetail,
    handleAssign,
    handleUnassign,
    handleUpdateTitle,
  } = useExperienceDetailsActions({
    selectedPlan,
    selectedDetailsItem,
    setSelectedDetailsItem,
    userPlan,
    setUserPlan,
    setSharedPlans,
    selectedPlanId,
    inlineCostPlanItem,
    setInlineCostPlanItem,
    setInlineCostLoading,
    addCost,
    allPlanCollaborators,
    closeModal,
    success,
    showError,
  });

  // ============================================================================
  // ADD EXPERIENCE / CREATE PLAN
  // ============================================================================

  const handleAddExperience = useExperienceCreatePlan({
    user,
    experience,
    plannedDate,
    setPlannedDate,
    userHasExperience,
    pendingUnplanRef,
    createPlan,
    updatePlan,
    setSelectedPlanId,
    setActiveTab,
    setIsEditingDate,
    closeModal,
    navigate,
    success,
    showError,
  });

  // ============================================================================
  // DATE MANAGEMENT (must come after handleAddExperience to avoid circular dep)
  // ============================================================================

  const {
    plannedDateRef,
    handleDateUpdate,
    pendingShift,
    onShiftDates,
    onKeepDates,
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
    isEditingDateState: isEditingDate,
    setIsEditingDateState: setIsEditingDate,
  });

  // ============================================================================
  // MAIN COMPONENT RENDER
  // ============================================================================

  // Show skeleton loader while experience data is loading
  if (!experience && !experienceNotFound) {
    return <SingleExperienceSkeleton />;
  }

  const layoutProps = {
    experience, experienceId, user, navigate, location, heroPhotos,
    openModal, closeModal, setPhotoViewerIndex, MODAL_NAMES, h1Ref,
    activeTab, setActiveTab, userPlan, setUserPlan, sharedPlans, setSharedPlans,
    selectedPlan, selectedPlanId, setSelectedPlanId, handlePlanChange,
    plansLoading, experienceTabLoading, loading, userHasExperience,
    experienceOwner, experienceCollaborators, experienceOwnerLoading,
    experienceCollaboratorsLoading, planOwner, planCollaborators,
    planOwnerLoading, planCollaboratorsLoading,
    expandedParents, animatingCollapse, getExpansionKey, isItemExpanded, toggleExpanded,
    handleAddPlanInstanceItem, handleEditPlanInstanceItem, handleViewPlanItemDetails,
    handleAddExperiencePlanItem, handleEditExperiencePlanItem,
    handleReorderExperiencePlanItems, handleReorderPlanItems, handlePlanItemToggleComplete,
    setPlanItemToDelete, handleOpenPlanDeleteModal,
    setPlanInstanceItemToDelete, handleOpenPlanInstanceDeleteModal,
    hoveredPlanItem, setHoveredPlanItem,
    setRequestAccessPlanId, accessDeniedPlanId, accessRequestSent,
    showSyncButton, showSyncAlert, dismissSyncAlert, handleSyncPlan,
    displayedPlannedDate, isEditingDate, setIsEditingDate,
    plannedDate, setPlannedDate, plannedDateRef, handleDateUpdate, handleAddExperience,
    handleExperience, handleShareExperience, handleOpenDeleteExperienceModal,
    setShowDatePickerState, isModalOpen,
    pendingShift, onShiftDates, onKeepDates,
    planButtonRef, planBtnWidth, favHover, setFavHover,
    costs, costSummary, costsLoading, addCost, updateCost, deleteCost,
    presenceConnected, experienceMembers, planMembers, setTyping,
    intent, bienbotNewItemIds, collaboratorManager,
  };

  const modalsProps = {
    experience, user, navigate, isModalOpen, closeModal, openModal, MODAL_NAMES,
    heroPhotos, photoViewerIndex, setExperience, updateExperienceInContext,
    planItemToDelete, planInstanceItemToDelete, setPlanInstanceItemToDelete,
    handlePlanDelete, handlePlanInstanceItemDelete,
    editingPlanItem, setEditingPlanItem, planItemFormState, loading, activeTab,
    handleSaveExperiencePlanItem, handleSavePlanInstanceItem,
    requestAccessPlanId, setRequestAccessPlanId, accessDeniedPlanId, setAccessRequestSent,
    selectedPlan, selectedPlanId, selectedDetailsItem, setSelectedDetailsItem,
    detailsModalInitialTab, setDetailsModalInitialTab,
    confirmRemoveExperience, collaboratorManager,
    experienceCollaborators, planCollaborators,
    showSyncModal, closeSyncModal, syncChanges, selectedSyncItems, setSelectedSyncItems,
    confirmSyncPlan, syncLoading,
    costs, allPlanCollaborators,
    handleAddNoteToItem, handleUpdateNoteOnItem, handleDeleteNoteFromItem, handleVoteNoteRelevancyOnItem,
    handleAssign, handleUnassign, handleUpdateTitle,
    handleAddCostForItem, handleAddDetail, handleSharePlanItem, handlePlanItemToggleComplete,
    handlePrevPlanItemDetails, handleNextPlanItemDetails, detailsNavIndex,
    presenceConnected, planMembers,
    availableEntities, entityData,
    inlineCostPlanItem, setInlineCostPlanItem, handleSaveInlineCost, inlineCostLoading,
    incompleteChildrenDialogData, setIncompleteChildrenDialogData,
    writeExperienceHash, success, showError,
  };

  return (
    <>
      <ExperiencePageHead experience={experience} travelTips={travelTips} />
      {experience && !plansLoading ? (
        <ExperienceLayout {...layoutProps} />
      ) : experienceNotFound ? (
        <EntityNotFound entityType="experience" size="lg" />
      ) : (
        <SingleExperienceSkeleton />
      )}

      {/* All modal components */}
      <ExperienceModals {...modalsProps} />
    </>
  );
}

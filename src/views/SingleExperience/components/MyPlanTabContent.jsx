// ...existing code...
import {
  NESTING_THRESHOLD_PX,
  PROMOTION_THRESHOLD_PX,
  HIERARCHY_ANIMATION_DURATION_MS,
  SKELETON_TEXT_SMALL_WIDTH_PX,
  SKELETON_TEXT_SMALL_HEIGHT_PX,
  SKELETON_TEXT_LARGE_WIDTH_PX,
  SKELETON_TEXT_LARGE_HEIGHT_PX,
  SKELETON_CIRCLE_SIZE_PX,
  SKELETON_TEXT_MEDIUM_WIDTH,
  SKELETON_TEXT_MEDIUM_HEIGHT_PX,
  SKELETON_TEXT_DOUBLE_HEIGHT_PX,
  COMPLETION_SUCCESS_THRESHOLD,
  COMPLETION_WARNING_THRESHOLD,
  DRAG_ACTIVATION_DISTANCE_PX
} from './MyPlanTabContent/constants';

/**
 * @typedef {Object} PlanItem
 * @property {string} _id - Unique identifier
 * @property {string} plan_item_id - Reference to experience plan item
 * @property {string} text - Item text/title
 * @property {boolean} complete - Completion status
 * @property {number} [cost] - Actual cost
 * @property {string} [parent] - Parent item ID for nesting
 * @property {string} [scheduled_date] - ISO date string
 * @property {string} [scheduled_time] - HH:MM time string
 * @property {string} [activity_type] - Activity type key
 */

/**
 * @typedef {Object} ActivityGroup
 * @property {string} type - Activity type key
 * @property {string} label - Display label
 * @property {string} icon - Emoji icon
 * @property {string} category - Category for sorting
 * @property {PlanItem[]} items - Items in this group
 */

/**
 * @typedef {Object} Action
 * @property {string} id - Action identifier
 * @property {string} label - Display label
 * @property {React.ReactElement} icon - Icon component
 * @property {Function} onClick - Click handler
 */

/**
 * MyPlanTabContent Component
 * Displays user's plan with CRUD operations, metrics, and collaborative features
 * Updated to match The Plan tab design for cost and planning days display
 */

import { useState, useRef, useEffect, memo, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  BsListUl,
  BsCardList,
  BsCalendarWeek,
} from 'react-icons/bs';
import {
  FaCalendarAlt,
  FaDollarSign,
  FaCheckCircle,
  FaClock
} from 'react-icons/fa';
import UsersListDisplay from '../../../components/UsersListDisplay/UsersListDisplay';
import Loading from '../../../components/Loading/Loading';
import Banner from '../../../components/Banner/Banner';
import { Text } from '../../../components/design-system';
import SkeletonLoader from '../../../components/SkeletonLoader/SkeletonLoader';
import MetricsBar from '../../../components/MetricsBar/MetricsBar';
import CostsList from '../../../components/CostsList';
import SearchableSelect from '../../../components/FormField/SearchableSelect';
import AddDateModal from '../../../components/AddDateModal';
import { useUIPreference } from '../../../hooks/useUIPreference';
import { usePlanChat } from '../../../hooks/usePlanChat';
import { usePlanItemDragDrop } from '../../../hooks/usePlanItemDragDrop';
import { useDateScheduling } from '../../../hooks/useDateScheduling';
import { usePinItem } from '../../../hooks/usePinItem';
import { usePlanItemVisibility } from '../../../hooks/usePlanItemVisibility';
import { hasFeatureFlag, hasFeatureFlagInContext, FEATURE_FLAGS, FEATURE_FLAG_CONTEXT } from '../../../utilities/feature-flags';
import { formatCurrency } from '../../../utilities/currency-utils';
import { formatDateMetricCard, formatDateForInput } from '../../../utilities/date-utils';
import { formatPlanningTime } from '../../../utilities/planning-time-utils';
import { formatCostEstimate } from '../../../utilities/cost-utils';
import { lang } from '../../../lang.constants';
import debug from '../../../utilities/debug';
import MessagesModal from '../../../components/ChatModal/MessagesModal';
import { groupItemsByType, groupPlanItemsByDate } from './MyPlanTabContent/utils/grouping';
import styles from './MyPlanTabContent.module.scss';
import PlanActionsDropdown from './MyPlanTabContent/PlanActionsDropdown';
import PlanItemsRenderer from './MyPlanTabContent/PlanItemsRenderer';

// View options for plan items display
const VIEW_OPTIONS = [
  { value: 'card', label: lang.current.label.cardView, icon: BsCardList },
  { value: 'compact', label: lang.current.label.compactView, icon: BsListUl },
  { value: 'activity', label: lang.current.label.activityView, icon: BsListUl },
  { value: 'timeline', label: lang.current.label.timelineView, icon: BsCalendarWeek }
];

/**
 * MyPlanTabContent Component
 *
 * Displays the user's plan with CRUD operations, metrics, collaborative features, and multiple view modes.
 * Handles plan item rendering, drag-and-drop reordering, pinning, scheduling, and real-time presence.
 * Integrates with the design system for layout, spacing, and accessibility.
 *
 * @param {Object} props - Component props
 * @param {string|number} props.selectedPlanId - The currently selected plan's ID
 * @param {Object} props.user - The current user object
 * @param {Function} props.idEquals - Function to compare IDs for equality
 * @param {Object} props.userPlan - The user's canonical plan object
 * @param {Function} props.setUserPlan - Setter for the user's plan
 * @param {Array} props.sharedPlans - Array of shared/collaborative plans
 * @param {Function} props.setSharedPlans - Setter for shared plans
 * @param {Object} props.planOwner - The owner of the plan
 * @param {Array} props.planCollaborators - Array of plan collaborators
 * @param {boolean} props.planOwnerLoading - Loading state for plan owner
 * @param {boolean} props.planCollaboratorsLoading - Loading state for collaborators
 * @param {boolean} props.hashSelecting - UI state for hash selection
 * @param {boolean} props.showSyncButton - Whether to show the sync button
 * @param {boolean} props.showSyncAlert - Whether to show the sync alert
 * @param {Function} props.dismissSyncAlert - Handler to dismiss sync alert
 * @param {boolean} props.loading - Loading state for the plan
 * @param {boolean} props.plansLoading - Loading state for plans
 * @param {Set} props.expandedParents - Set of expanded parent item keys
 * @param {string|null} props.animatingCollapse - Key of parent currently animating collapse
 * @param {Function} props.getExpansionKey - Function to get canonical expansion key for an item
 * @param {Function} props.isItemExpanded - Function to check if an item is expanded
 * @param {string|null} props.displayedPlannedDate - The displayed planned date
 * @param {Function} props.setIsEditingDate - Setter for editing date state
 * @param {Function} props.setPlannedDate - Setter for planned date
 * @param {Function} props.setShowDatePicker - Setter for date picker visibility
 * @param {Object} props.plannedDateRef - Ref for planned date input
 * @param {Function} props.handleSyncPlan - Handler to sync plan with experience
 * @param {Function} props.handleAddPlanInstanceItem - Handler to add a plan item
 * @param {Function} props.handleEditPlanInstanceItem - Handler to edit a plan item
 * @param {Function} props.openCollaboratorModal - Handler to open collaborator modal
 * @param {Function} props.toggleExpanded - Handler to toggle item expansion
 * @param {Function} props.setPlanInstanceItemToDelete - Setter for item to delete
 * @param {Function} props.setShowPlanInstanceDeleteModal - Setter for delete modal visibility
 * @param {Function} props.handlePlanItemToggleComplete - Handler to toggle item completion
 * @param {Function} props.handleViewPlanItemDetails - Handler to view item details
 * @param {Object|null} props.hoveredPlanItem - Currently hovered plan item
 * @param {Function} props.setHoveredPlanItem - Setter for hovered plan item
 * @param {Object} props.lang - Language strings
 * @param {Function} props.onReorderPlanItems - Handler for reordering plan items
 * @param {Array} [props.costs] - Array of cost objects
 * @param {Object|null} [props.costSummary] - Summary of costs
 * @param {boolean} [props.costsLoading] - Loading state for costs
 * @param {Function} [props.onAddCost] - Handler to add a cost
 * @param {Function} [props.onUpdateCost] - Handler to update a cost
 * @param {Function} [props.onDeleteCost] - Handler to delete a cost
 * @param {boolean} [props.presenceConnected] - Real-time presence connection state
 * @param {Array} [props.planMembers] - Array of plan members for presence
 * @param {Function} [props.setTyping] - Handler for typing state
 * @returns {JSX.Element} The rendered plan tab content
 */
export default function MyPlanTabContent({
  // Plan selection & user
  selectedPlanId,
  user,
  idEquals,

  // User plan (canonical) + setter
  userPlan,
  setUserPlan,

  // Plan data
  sharedPlans,
  setSharedPlans,
  planOwner,
  planCollaborators,
  planOwnerLoading,
  planCollaboratorsLoading,

  // UI state
  hashSelecting,
  showSyncButton,
  showSyncAlert,
  dismissSyncAlert,
  loading,
  plansLoading,
  expandedParents,
  animatingCollapse,
  getExpansionKey,
  isItemExpanded,

  // Date picker state
  displayedPlannedDate,
  setIsEditingDate,
  setPlannedDate,
  setShowDatePicker,
  plannedDateRef,

  // Handlers
  handleSyncPlan,
  handleAddPlanInstanceItem,
  handleEditPlanInstanceItem,
  openCollaboratorModal,
  toggleExpanded,
  setPlanInstanceItemToDelete,
  setShowPlanInstanceDeleteModal,
  handlePlanItemToggleComplete,
  handleViewPlanItemDetails,

  // Hover state
  hoveredPlanItem,
  setHoveredPlanItem,

  // Language strings
  lang,

  // Reorder handler
  onReorderPlanItems,

  // Cost tracking
  costs = [],
  costSummary = null,
  costsLoading = false,
  onAddCost,
  onUpdateCost,
  onDeleteCost,

  // Real-time presence
  presenceConnected = false,
  planMembers = [],
  setTyping
}) {
  const maxPlanItemNestingLevel = useMemo(() => {
    const raw = import.meta.env.VITE_PLAN_ITEM_MAX_NESTING_LEVEL || import.meta.env.PLAN_ITEM_MAX_NESTING_LEVEL;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 1;
  }, []);

  // Chat functionality
  const {
    chatEnabled,
    chatLoading,
    chatError,
    showMessagesModal,
    setShowMessagesModal,
    messagesInitialChannelId,
    openPlanChat
  } = usePlanChat({ planId: selectedPlanId, user, planOwner });

  // Tab loading state for smooth transitions
  const [planTabLoading, setPlanTabLoading] = useState(true);
  // View state for plan items display (card or compact) - persisted in user preferences
  // Uses shared key 'viewMode.planItems' so preference syncs between Experience and Plan views
  const [planItemsView, setPlanItemsView] = useUIPreference('viewMode.planItems', 'compact');

  // Get current plan with "stale until updated" pattern to prevent flash
  // Keep last valid plan when sharedPlans.find() temporarily returns undefined during updates
  // NOTE: Defined early because handleDragEnd and other functions need it
  const lastValidPlanRef = useRef(null);

  // sharedPlans intentionally excludes the user's own plan; userPlan is canonical.
  // For rendering/selection we need the full set of accessible plans.
  const allPlans = useMemo(() => {
    if (userPlan) return [userPlan, ...(sharedPlans || [])];
    return sharedPlans || [];
  }, [userPlan, sharedPlans]);

  const selectedIsUserPlan = useMemo(() => {
    if (!selectedPlanId || !userPlan?._id) return false;
    return idEquals(userPlan._id, selectedPlanId);
  }, [selectedPlanId, userPlan?._id, idEquals]);

  const updateSelectedPlanInState = useCallback((updater) => {
    if (!selectedPlanId) return;

    if (selectedIsUserPlan) {
      if (!setUserPlan) return;
      setUserPlan((prev) => {
        if (!prev || !idEquals(prev._id, selectedPlanId)) return prev;
        return updater(prev);
      });
      return;
    }

    if (!setSharedPlans) return;
    setSharedPlans((prevPlans) =>
      (prevPlans || []).map((p) =>
        idEquals(p._id, selectedPlanId) ? updater(p) : p
      )
    );
  }, [selectedPlanId, selectedIsUserPlan, setUserPlan, setSharedPlans, idEquals]);
  const currentPlan = useMemo(() => {
    const foundPlan = allPlans.find(
      (p) => idEquals(p._id, selectedPlanId)
    );
    // If we found a valid plan, update the ref and return it
    if (foundPlan) {
      lastValidPlanRef.current = foundPlan;
      return foundPlan;
    }
    // If selectedPlanId changed, we need to clear the stale ref
    if (lastValidPlanRef.current && !idEquals(lastValidPlanRef.current._id, selectedPlanId)) {
      lastValidPlanRef.current = null;
      return undefined;
    }
    // Return the last valid plan to prevent flash during optimistic updates
    return lastValidPlanRef.current;
  }, [allPlans, selectedPlanId, idEquals]);

  // Smooth loading transition for plan tab
  useEffect(() => {
    if (currentPlan && currentPlan.plan && currentPlan.plan.length > 0) {
      requestAnimationFrame(() => setPlanTabLoading(false));
    }
  }, [currentPlan]);

  // Date scheduling functionality via custom hook
  const {
    showDateModal,
    dateModalPlanItem,
    dateModalTimeOnly,
    dateModalParentDate,
    handleScheduleDate,
    handleSaveDate,
    closeDateModal
  } = useDateScheduling({
    planId: selectedPlanId,
    planItems: currentPlan?.plan,
    updatePlanInState: updateSelectedPlanInState
  });

  // Pin/unpin functionality via custom hook
  const { handlePinItem } = usePinItem({
    planId: selectedPlanId,
    allPlans,
    updatePlanInState: updateSelectedPlanInState,
    idEquals
  });

  // Compute online user IDs from presence data
  // Always include the current user when presence is connected (they're always online to themselves)
  const onlineUserIds = useMemo(() => {
    if (!presenceConnected) {
      return new Set();
    }
    const ids = new Set(planMembers?.map(member => member.userId?.toString()).filter(Boolean) || []);
    // Always include the current user - they should see themselves as online
    if (user?._id) {
      ids.add(user._id.toString());
    }
    return ids;
  }, [presenceConnected, planMembers, user?._id]);

  // Plan item visibility, expansion, and pinning display logic via custom hook
  const pinnedItemId = currentPlan?.pinnedItemId?.toString() || null;

  const {
    getCanonicalParentKey,
    flattenPlanItemsFn,
    flattenedItems,
    filteredItems,
    pinnedItems,
    unpinnedItems,
    allUnpinnedItems,
    itemsToRender,
    parentItemMap,
    parentsWithChildren,
    isPinnedOrChild,
    hasChildren,
    isItemVisible,
    getPlanItemDepth,
    canAddChildToItem
  } = usePlanItemVisibility({
    planItems: currentPlan?.plan || [],
    expandedParents,
    animatingCollapse,
    getExpansionKey,
    pinnedItemId,
    isItemExpanded,
    maxNestingLevel: maxPlanItemNestingLevel
  });

  // Permission checks
  const isSuperAdmin = user?.role === 'super_admin' || user?.isSuperAdmin === true;
  const isPlanOwner = planOwner && idEquals(planOwner._id, user._id);
  const isPlanCollaborator =
    currentPlan &&
    currentPlan.permissions?.some(
      (p) => idEquals(p._id, user._id) && ["owner", "collaborator"].includes(p.type)
    );
  const canEdit = isSuperAdmin || isPlanOwner || isPlanCollaborator;

  // Compute earliest scheduled date from plan items as fallback
  // NOTE: ALL useMemo hooks must be called BEFORE any early returns to maintain hooks order
  const earliestScheduledDate = useMemo(() => {
    if (!currentPlan?.plan || currentPlan.plan.length === 0) return null;

    const scheduledDates = currentPlan.plan
      // Parent-only scheduling: ignore any legacy child schedules.
      .filter(item => !item.parent && item.scheduled_date)
      .map(item => new Date(item.scheduled_date))
      .filter(date => !isNaN(date.getTime()))
      .sort((a, b) => a - b);

    return scheduledDates.length > 0 ? scheduledDates[0].toISOString() : null;
  }, [currentPlan?.plan]);

  // Memoize timeline grouping to avoid recalculation on every render
  // For timeline/activity views, we exclude pinned items (they render separately at top)
  // Use allUnpinnedItems (includes collapsed children) so hierarchy is preserved
  const timelineGroups = useMemo(() => {
    if (planItemsView !== 'timeline' || flattenedItems.length === 0) return null;
    // Use allUnpinnedItems so pinned item renders separately and children are included
    return groupPlanItemsByDate(allUnpinnedItems);
  }, [planItemsView, flattenedItems, allUnpinnedItems]);

  // Memoize activity type grouping for activity view
  // For timeline/activity views, we exclude pinned items (they render separately at top)
  // Use allUnpinnedItems (includes collapsed children) so hierarchy is preserved
  const activityGroups = useMemo(() => {
    if (planItemsView !== 'activity' || flattenedItems.length === 0) return null;
    // Use allUnpinnedItems so pinned item renders separately and children are included
    return groupItemsByType(allUnpinnedItems, { parentLookup: currentPlan?.plan || [] });
  }, [planItemsView, flattenedItems, allUnpinnedItems, currentPlan?.plan]);

  // Drag-and-drop functionality via custom hook
  const { sensors, handleDragEnd } = usePlanItemDragDrop({
    planItems: currentPlan?.plan || [],
    parentItemMap,
    flattenPlanItemsFn,
    onReorderPlanItems,
    selectedPlanId,
    canEdit,
    maxPlanItemNestingLevel,
    thresholds: {
      nesting: NESTING_THRESHOLD_PX,
      promotion: PROMOTION_THRESHOLD_PX,
      dragActivation: DRAG_ACTIVATION_DISTANCE_PX,
      animationDuration: HIERARCHY_ANIMATION_DURATION_MS
    }
  });

  /**
   * Shared props for all plan item components (SortablePlanItem, SortableCompactPlanItem, TimelinePlanItem)
   * These are passed to all items regardless of view type
   */
  const sharedItemHandlers = useMemo(() => ({
    handlePlanItemToggleComplete,
    handleViewPlanItemDetails,
    handleAddPlanInstanceItem,
    handleEditPlanInstanceItem,
    setPlanInstanceItemToDelete,
    setShowPlanInstanceDeleteModal,
    onScheduleDate: handleScheduleDate,
    onPinItem: handlePinItem,
    onToggleExpand: toggleExpanded,
    lang,
    planOwner,
    planCollaborators,
    canEdit
  }), [
    handlePlanItemToggleComplete,
    handleViewPlanItemDetails,
    handleAddPlanInstanceItem,
    handleEditPlanInstanceItem,
    setPlanInstanceItemToDelete,
    setShowPlanInstanceDeleteModal,
    handleScheduleDate,
    handlePinItem,
    toggleExpanded,
    lang,
    planOwner,
    planCollaborators,
    canEdit
  ]);

  /**
   * Shared props for SortablePlanItem (card view).
   * SortablePlanItem uses some different prop names than the compact/timeline items.
   */
  const sharedSortablePlanItemProps = useMemo(() => ({
    currentPlan,
    user,
    idEquals,
    canEdit,
    toggleExpanded,
    getExpansionKey,
    handleAddPlanInstanceItem,
    handleEditPlanInstanceItem,
    setPlanInstanceItemToDelete,
    setShowPlanInstanceDeleteModal,
    handlePlanItemToggleComplete,
    hoveredPlanItem,
    setHoveredPlanItem,
    handleViewPlanItemDetails,
    planOwner,
    planCollaborators,
    lang,
    onPinItem: handlePinItem,
  }), [
    canEdit,
    currentPlan,
    getExpansionKey,
    handleAddPlanInstanceItem,
    handleEditPlanInstanceItem,
    handlePlanItemToggleComplete,
    handlePinItem,
    handleViewPlanItemDetails,
    hoveredPlanItem,
    idEquals,
    lang,
    planCollaborators,
    planOwner,
    setHoveredPlanItem,
    setPlanInstanceItemToDelete,
    setShowPlanInstanceDeleteModal,
    toggleExpanded,
    user,
  ]);

  /**
   * Generate per-item props based on the plan item
   * Returns dynamic props that vary per item
   */
  const getItemProps = useCallback((planItem) => {
    const parentItem = planItem.parent
      ? parentItemMap.get(planItem.parent.toString())
      : null;
    const itemId = (planItem._id || planItem.plan_item_id)?.toString();
    const itemHasChildren = hasChildren(planItem);
    const itemExpanded = isItemExpanded(planItem);
    const itemCanAddChild = canAddChildToItem(planItem);

    return {
      parentItem,
      isPinned: itemId === pinnedItemId,
      hasChildren: itemHasChildren,
      isExpanded: itemExpanded,
      canAddChild: itemCanAddChild
    };
  }, [parentItemMap, hasChildren, isItemExpanded, canAddChildToItem, pinnedItemId]);

  // Plan not found or still loading
  // Show skeleton loader when:
  // 1. plansLoading is true (explicit loading state)
  // 2. selectedPlanId exists but plan not in sharedPlans yet (race condition during plan creation)
  // 3. currentPlan is optimistic (placeholder created before canonical plan arrives)
  // Only show "Plan not found" after loading is complete and plan genuinely doesn't exist
  if (!currentPlan || currentPlan?._optimistic) {
    // If we have a selectedPlanId but no plan, it's likely being created/loaded
    const isPlanLoading =
      plansLoading ||
      !!currentPlan?._optimistic ||
      (selectedPlanId && !allPlans.some(p => idEquals(p._id, selectedPlanId)));

    if (isPlanLoading) {
      return (
        <div className="my-plan-view mt-4">
          {hashSelecting && (
            <div className="mb-3">
              <Loading size="md" message={lang.current.label.loadingPlan || 'Loading plan...'} showMessage={true} />
            </div>
          )}
          {/* Skeleton for plan metrics */}
          <div className="plan-metrics-container mb-4">
            <div className="row g-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="col-md-3 col-sm-6">
                  <div className="metric-card">
                    <SkeletonLoader variant="text" width={SKELETON_TEXT_SMALL_WIDTH_PX + 'px'} height={SKELETON_TEXT_SMALL_HEIGHT_PX + 'px'} className="mb-2" />
                    <SkeletonLoader variant="text" width={SKELETON_TEXT_LARGE_WIDTH_PX + 'px'} height={SKELETON_TEXT_LARGE_HEIGHT_PX + 'px'} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Skeleton for plan items */}
          <div className="plan-items-skeleton mt-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="plan-item-card mb-3 p-3 p-md-4">
                <div className="d-flex gap-3 mb-3">
                  <SkeletonLoader variant="circle" width={SKELETON_CIRCLE_SIZE_PX} height={SKELETON_CIRCLE_SIZE_PX} />
                  <SkeletonLoader variant="text" width={SKELETON_TEXT_MEDIUM_WIDTH} height={SKELETON_TEXT_MEDIUM_HEIGHT_PX} />
                </div>
                <SkeletonLoader variant="text" lines={2} height={SKELETON_TEXT_DOUBLE_HEIGHT_PX} />
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Only show "Plan not found" when loading is complete and plan truly doesn't exist
    return (
      <div className="my-plan-view mt-4">
        <p className={styles.centeredGrayText}>
          {lang.current.alert.planNotFound}
        </p>
      </div>
    );
  }

  // Check if metrics data is still loading
  // Plan exists but metrics might not be fully computed yet
  const metricsLoading = plansLoading || loading;

  // Display date: use planned_date if set, otherwise fallback to earliest scheduled date
  const displayDate = currentPlan.planned_date || earliestScheduledDate;
  const isUsingFallbackDate = !currentPlan.planned_date && earliestScheduledDate;

  // Build metrics array for MetricsBar
  // Order: Completion → Cost Estimate → Planning Time → Planned Date
  const planMetrics = metricsLoading ? [] : [
    {
      id: 'completion',
      title: lang.current.label.completion,
      type: 'completion',
      value: currentPlan.completion_percentage || 0,
      icon: <FaCheckCircle />,
      color: (currentPlan.completion_percentage || 0) >= COMPLETION_SUCCESS_THRESHOLD ? 'success' :
             (currentPlan.completion_percentage || 0) >= COMPLETION_WARNING_THRESHOLD ? 'primary' : 'default'
    },
    {
      id: 'total-cost',
      title: lang?.current?.label?.costEstimate || 'Cost Estimate',
      type: 'cost',
      value: currentPlan.total_cost || 0,
      icon: <FaDollarSign />,
      className: 'smallMetricValueItem',
      // Tooltip shows per-person context with the actual cost estimate value
      tooltip: `${lang.current.label.costEstimatePerPersonTooltip || 'Estimated cost per person'}: ${formatCurrency(currentPlan.total_cost || 0)}`
    },
    {
      id: 'planning-time',
      title: lang.current.label.planningTime,
      type: 'days',
      value: currentPlan.max_planning_days > 0 ? currentPlan.max_planning_days : null,
      icon: <FaClock />,
      className: 'smallMetricValueItem',
      // Tooltip shows full planning time when truncated
      tooltip: currentPlan.max_planning_days > 0 ? formatPlanningTime(currentPlan.max_planning_days) : null
    },
    {
      id: 'planned-date',
      title: lang.current.label.plannedDate,
      type: 'date',
      value: displayDate,
      icon: <FaCalendarAlt />,
      className: 'plannedDateItem',
      // Tooltip shows full date when truncated, with note if using fallback
      tooltip: displayDate
        ? `${formatDateMetricCard(displayDate)}${isUsingFallbackDate ? ' (earliest)' : ''}`
        : null,
      onClick: !currentPlan.planned_date ? () => {
        setIsEditingDate(true);
        setPlannedDate(
          displayedPlannedDate
            ? formatDateForInput(displayedPlannedDate)
            : ""
        );
        setShowDatePicker(true);
      } : undefined
    }
  ];

  // Plan metadata using MetricsBar component
  const planMetadata = (
    <div className="plan-metrics-container mb-4" ref={plannedDateRef}>
      {metricsLoading ? (
        <div className="row g-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="col-md-3 col-sm-6">
              <div className="metric-card">
                <SkeletonLoader variant="text" width={SKELETON_TEXT_SMALL_WIDTH_PX + 'px'} height={SKELETON_TEXT_SMALL_HEIGHT_PX + 'px'} className="mb-2" />
                <SkeletonLoader variant="text" width="80px" height="24px" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <MetricsBar metrics={planMetrics} compact />
      )}
    </div>
  );

  // Show skeleton loaders while plans are loading
  if (!currentPlan.plan || currentPlan.plan.length === 0) {
    if (plansLoading) {
      return (
        <div className="my-plan-view mt-4">
          {hashSelecting && (
            <div className="mb-3">
              <Loading size="md" message={lang.current.label.loadingPlan || 'Loading plan...'} showMessage={true} />
            </div>
          )}
          {planMetadata}
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
      );
    }

    // Show "No Plan Items" message when plans loaded but empty
    return (
      <div className="my-plan-view mt-4">
        {hashSelecting && (
          <div className="mb-3">
            <Loading size="md" message={lang.current.label.loadingPlan || 'Loading plan...'} showMessage={true} />
          </div>
        )}
        {showSyncButton && showSyncAlert && (
          <Banner
            type="info"
            size="sm"
            dismissible={true}
            onDismiss={dismissSyncAlert}
            message={lang.current.alert.planOutOfSyncMessage}
            button={{
              text: loading ? lang.current.button.syncing : lang.current.button.syncNow,
              onClick: handleSyncPlan,
              disabled: loading
            }}
            className="mb-4"
          />
        )}
        <div className="plan-header-row mb-4">
          <UsersListDisplay
            owner={planOwner}
            users={planCollaborators}
            messageKey="PlanningExperience"
            loading={
              planOwnerLoading || planCollaboratorsLoading
            }
            reserveSpace={true}
            showPresence={presenceConnected}
            onlineUserIds={onlineUserIds}
          />
          <PlanActionsDropdown
            canEdit={canEdit}
            isPlanOwner={isPlanOwner}
            showSyncButton={showSyncButton}
            loading={loading}
            handleAddPlanInstanceItem={handleAddPlanInstanceItem}
            openCollaboratorModal={openCollaboratorModal}
            handleSyncPlan={handleSyncPlan}
            chatEnabled={chatEnabled}
            chatLoading={chatLoading}
            openPlanChat={openPlanChat}
          />
        </div>
        {chatError && (
          <p className={styles.dangerText}>{chatError}</p>
        )}
        <MessagesModal
          show={showMessagesModal}
          onClose={() => setShowMessagesModal(false)}
          initialChannelId={messagesInitialChannelId}
          title="Messages"
        />
        {planMetadata}
        {planTabLoading ? (
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
        ) : (
          <p className={styles.centeredGrayText}>
            {lang.current.alert.noPlanItems}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="my-plan-view mt-4">
      {/* Show loading indicator when we detected a hash deep-link and plans are still loading */}
      {hashSelecting && (
        <div className="mb-3">
          <Loading size="md" message={lang.current.label.loadingPlan || 'Loading plan...'} showMessage={true} />
        </div>
      )}

      {/* Info Banner - Plan Items Out of Sync */}
      {showSyncButton && showSyncAlert && (
        <Banner
          type="info"
          size="sm"
          dismissible={true}
          onDismiss={dismissSyncAlert}
          message={lang.current.alert.planOutOfSyncMessage}
          button={{
            text: loading ? lang.current.button.syncing : lang.current.button.syncNow,
            onClick: handleSyncPlan,
            disabled: loading
          }}
          className="mb-4"
        />
      )}

      {/* Collaborators and Action Buttons Row */}
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
          showPresence={presenceConnected}
          onlineUserIds={onlineUserIds}
        />

        {/* Action Buttons - Right Side */}
        <PlanActionsDropdown
          canEdit={canEdit}
          isPlanOwner={isPlanOwner}
          showSyncButton={showSyncButton}
          loading={loading}
          handleAddPlanInstanceItem={handleAddPlanInstanceItem}
          openCollaboratorModal={openCollaboratorModal}
          handleSyncPlan={handleSyncPlan}
          chatEnabled={chatEnabled}
          chatLoading={chatLoading}
          openPlanChat={openPlanChat}
        />
      </div>

      {chatError && (
        <p className={styles.dangerText}>{chatError}</p>
      )}

      <MessagesModal
        show={showMessagesModal}
        onClose={() => setShowMessagesModal(false)}
        initialChannelId={messagesInitialChannelId}
        title="Messages"
      />

      {/* Plan Metrics Cards */}
      {planMetadata}

      {/* View Toggle - Right aligned */}
      <div className="plan-view-toggle mb-3 d-flex justify-content-end">
        <SearchableSelect
          options={VIEW_OPTIONS}
          value={planItemsView}
          onChange={setPlanItemsView}
          placeholder="View"
          searchable={false}
          size="sm"
          className="plan-view-select"
        />
      </div>

      {/* Plan Items List - All View Types */}
      <PlanItemsRenderer
        viewType={planItemsView}
        itemsToRender={itemsToRender}
        pinnedItems={pinnedItems}
        activityGroups={activityGroups}
        timelineGroups={timelineGroups}
        sensors={sensors}
        onDragEnd={handleDragEnd}
        sharedItemHandlers={sharedItemHandlers}
        sharedSortablePlanItemProps={sharedSortablePlanItemProps}
        getItemProps={getItemProps}
        isItemVisible={isItemVisible}
        pinnedItemId={pinnedItemId}
      />

      {/* Schedule Date Modal */}
      <AddDateModal
        show={showDateModal}
        onClose={closeDateModal}
        onSave={handleSaveDate}
        initialDate={dateModalPlanItem?.scheduled_date || null}
        initialTime={dateModalPlanItem?.scheduled_time || null}
        planItemText={dateModalPlanItem?.text || 'Plan Item'}
        minDate={currentPlan?.planned_date || null}
        timeOnly={dateModalTimeOnly}
        fixedDate={dateModalParentDate}
      />

      {/* Costs Section */}
      <CostsList
        planId={selectedPlanId}
        costs={costs}
        costSummary={costSummary}
        collaborators={planOwner ? [planOwner, ...(planCollaborators || [])] : planCollaborators || []}
        planItems={currentPlan.plan || []}
        currency={currentPlan?.currency || 'USD'}
        displayCurrency={user?.preferences?.currency}
        canEdit={canEdit}
        onAddCost={onAddCost}
        onUpdateCost={onUpdateCost}
        onDeleteCost={onDeleteCost}
        loading={costsLoading}
        showSummary={true}
        compact={false}
        presenceConnected={presenceConnected}
        onlineUserIds={onlineUserIds}
      />
    </div>
  );
}

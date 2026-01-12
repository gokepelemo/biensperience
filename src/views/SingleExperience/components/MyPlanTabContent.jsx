// ...existing code...
import {
  NESTING_THRESHOLD_PX,
  PROMOTION_THRESHOLD_PX,
  HIERARCHY_ANIMATION_DURATION_MS,
  MAX_PLAN_ITEM_DEPTH,
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
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
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
import { updatePlanItem, pinPlanItem } from '../../../utilities/plans-api';
import { hasFeatureFlag, hasFeatureFlagInContext, FEATURE_FLAGS, FEATURE_FLAG_CONTEXT } from '../../../utilities/feature-flags';
import { formatCurrency } from '../../../utilities/currency-utils';
import { formatDateMetricCard, formatDateForInput } from '../../../utilities/date-utils';
import { formatPlanningTime } from '../../../utilities/planning-time-utils';
import { formatCostEstimate } from '../../../utilities/cost-utils';
import { lang } from '../../../lang.constants';
import debug from '../../../utilities/debug';
import MessagesModal from '../../../components/ChatModal/MessagesModal';
import { groupItemsByType, groupPlanItemsByDate } from './MyPlanTabContent/utils/grouping';
import { createFlattenPlanItems } from '../../../utilities/plan-item-utils';
import styles from './MyPlanTabContent.module.scss';
import TimelinePlanItem from './MyPlanTabContent/TimelinePlanItem';
import TimelineDateGroup from './MyPlanTabContent/TimelineDateGroup';
import SortableCompactPlanItem from './MyPlanTabContent/SortableCompactPlanItem';
import SortablePlanItem from './MyPlanTabContent/SortablePlanItem';
import PlanActionsDropdown from './MyPlanTabContent/PlanActionsDropdown';

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

  // State for scheduling date modal (Timeline view)
  const [showDateModal, setShowDateModal] = useState(false);
  const [dateModalPlanItem, setDateModalPlanItem] = useState(null);
  const [dateModalTimeOnly, setDateModalTimeOnly] = useState(false);
  const [dateModalParentDate, setDateModalParentDate] = useState(null);

  // Handle opening the schedule date modal
  const handleScheduleDate = useCallback((planItem, parentItem = null) => {
    // Scheduling is only allowed on parent items.
    const isChild = planItem?.isChild || planItem?.parent;
    if (isChild) {
      debug.info('[MyPlanTabContent] Ignoring schedule request for child item');
      return;
    }

    setDateModalPlanItem(planItem);

    setDateModalTimeOnly(false);
    setDateModalParentDate(null);

    setShowDateModal(true);
  }, []);

  // Handle saving the scheduled date
  const handleSaveDate = useCallback(async (dateData) => {
    if (!dateModalPlanItem || !selectedPlanId) return;

    const planItemId = (dateModalPlanItem._id || dateModalPlanItem.plan_item_id)?.toString();
    const existing = currentPlan?.plan?.find((it) => {
      const itId = (it._id || it.plan_item_id)?.toString();
      return Boolean(planItemId && itId && itId === planItemId);
    });

    const prevSchedule = {
      scheduled_date: existing?.scheduled_date ?? null,
      scheduled_time: existing?.scheduled_time ?? null
    };

    // Optimistic update so Timeline view updates instantly (regroup/reorder) when scheduling changes.
    updateSelectedPlanInState((p) => {
      if (!p?.plan || !planItemId) return p;
      return {
        ...p,
        plan: p.plan.map((it) => {
          const itId = (it._id || it.plan_item_id)?.toString();
          if (!itId || itId !== planItemId) return it;
          return {
            ...it,
            scheduled_date: dateData.scheduled_date,
            scheduled_time: dateData.scheduled_time
          };
        })
      };
    });

    try {
      await updatePlanItem(selectedPlanId, dateModalPlanItem._id || dateModalPlanItem.plan_item_id, {
        scheduled_date: dateData.scheduled_date,
        scheduled_time: dateData.scheduled_time
      });
      setShowDateModal(false);
      setDateModalPlanItem(null);
    } catch (error) {
      debug.error('[MyPlanTabContent] Failed to save date', error);

      // Roll back optimistic update if the API call fails.
      updateSelectedPlanInState((p) => {
        if (!p?.plan || !planItemId) return p;
        return {
          ...p,
          plan: p.plan.map((it) => {
            const itId = (it._id || it.plan_item_id)?.toString();
            if (!itId || itId !== planItemId) return it;
            return {
              ...it,
              scheduled_date: prevSchedule.scheduled_date,
              scheduled_time: prevSchedule.scheduled_time
            };
          })
        };
      });
      throw error;
    }
  }, [dateModalPlanItem, selectedPlanId, currentPlan?.plan, updateSelectedPlanInState]);

  // Handle pin/unpin plan item (toggle)
  const handlePinItem = useCallback(async (planItem) => {
    if (!selectedPlanId) return;

    try {
      const itemId = (planItem._id || planItem.plan_item_id)?.toString();

      // Optimistic update - toggle the pinnedItemId
      const planForPin = allPlans.find(p => idEquals(p._id, selectedPlanId));
      const currentPinnedId = planForPin?.pinnedItemId?.toString();
      const newPinnedItemId = currentPinnedId === itemId ? null : itemId;

      updateSelectedPlanInState((p) => ({ ...p, pinnedItemId: newPinnedItemId }));

      // Make API call
      const result = await pinPlanItem(selectedPlanId, itemId);

      debug.log('[MyPlanTabContent] Plan item pin toggled', {
        planId: selectedPlanId,
        itemId,
        action: result.action,
        pinnedItemId: result.pinnedItemId
      });

      // Update with server response (in case it differs)
      updateSelectedPlanInState((p) => ({ ...p, pinnedItemId: result.pinnedItemId }));
    } catch (error) {
      debug.error('[MyPlanTabContent] Failed to pin/unpin item', error);
      // Rollback on error - refetch the plan data
      // For now, just log the error - the optimistic update remains
    }
  }, [selectedPlanId, allPlans, updateSelectedPlanInState, idEquals]);

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

  // Setup sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: DRAG_ACTIVATION_DISTANCE_PX, // Require 8px movement before drag starts (prevents accidental drags)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end event with hierarchy support
  const handleDragEnd = (event) => {
    const { active, over } = event;

    // Debug: Log full event structure to verify delta is available
    debug.log('[Drag] Full event structure', {
      hasActive: !!active,
      hasOver: !!over,
      delta: event.delta,
      deltaX: event.delta?.x,
      deltaY: event.delta?.y
    });

    if (!active || !over || active.id === over.id) {
      return; // No change needed
    }

    if (!currentPlan || !currentPlan.plan) {
      debug.warn('[Drag] Cannot reorder - no plan data');
      return;
    }

    // Find the dragged item and target item
    const draggedItem = currentPlan.plan.find(
      (item) => (item.plan_item_id || item._id).toString() === active.id.toString()
    );
    const targetItem = currentPlan.plan.find(
      (item) => (item.plan_item_id || item._id).toString() === over.id.toString()
    );

    if (!draggedItem || !targetItem) {
      debug.warn('[Drag] Could not find dragged or target item');
      return;
    }

    // Get IDs for comparison
    const draggedId = (draggedItem.plan_item_id || draggedItem._id).toString();
    const targetId = (targetItem.plan_item_id || targetItem._id).toString();
    const draggedParentId = draggedItem.parent?.toString() || null;
    const targetParentId = targetItem.parent?.toString() || null;
    const targetIsChild = !!targetItem.parent;
    const draggedIsChild = !!draggedItem.parent;

    // Detect horizontal offset to determine nesting/promotion intent
    // Drag right (NESTING_THRESHOLD_PX+) = nest under target, Drag left (NESTING_THRESHOLD_PX+) = promote to root
    // Use event.delta.x which dnd-kit provides directly (more reliable than rect coordinates)
    const horizontalOffset = event.delta?.x || 0;
    const nestingIntent = horizontalOffset > NESTING_THRESHOLD_PX;
    const promotionIntent = horizontalOffset < PROMOTION_THRESHOLD_PX;
    debug.log('[Drag] Hierarchy detection', { horizontalOffset, nestingIntent, promotionIntent, thresholds: { nest: NESTING_THRESHOLD, promote: PROMOTION_THRESHOLD } });

    debug.log('[Drag] Hierarchy-aware reorder', {
      draggedId,
      targetId,
      draggedParentId,
      targetParentId,
      draggedIsChild,
      targetIsChild,
      nestingIntent,
      promotionIntent
    });

    // Create a deep copy of items for modification
    let reorderedItems = currentPlan.plan.map(item => ({ ...item }));

    // Find the dragged item in our copy
    const draggedItemCopy = reorderedItems.find(
      (item) => (item.plan_item_id || item._id).toString() === draggedId
    );

    // Check if dragged item has children (can't nest a parent under another item)
    const draggedHasChildren = currentPlan.plan.some(
      item => item.parent?.toString() === draggedId
    );

    // Determine hierarchy change based on context:
    // 1. If promotion intent AND dragged is a child → promote to root (drag left), position above parent
    // 2. If nesting intent AND dragged has no children → make child of item above (drag right)
    // 3. If target is a child item, dragged item becomes sibling (same parent)
    // 4. If target is a parent item and dragged is child (no nesting intent) → promote to root
    // 5. If both are at same level → simple reorder

    // Get the flattened visual order to find item above
    const flattenedItems = flattenPlanItemsFn(currentPlan.plan);
    const draggedFlatIndex = flattenedItems.findIndex(
      (item) => (item.plan_item_id || item._id).toString() === draggedId
    );

    const canNestUnder = (potentialParentId) => {
      if (maxPlanItemNestingLevel <= 0) return false;
      const potentialParent = parentItemMap.get(potentialParentId?.toString());
      if (!potentialParent) return false;
      const parentDepth = getPlanItemDepth(potentialParent);
      return Number.isFinite(parentDepth) && parentDepth < maxPlanItemNestingLevel;
    };

    let promotedToParentPosition = false; // Track if we need special positioning
    if (promotionIntent && draggedIsChild) {
      // Explicit promotion: dragged left outside container alignment → become root item
      // Position above former parent for cognitive sense
      delete draggedItemCopy.parent;
      promotedToParentPosition = true;
      debug.log('[Drag] Promoting child to root (drag left intent), will position above parent');
    } else if (nestingIntent && !draggedHasChildren) {
      // Nesting intent detected (drag right) - can nest under item above OR target
      // Only works for items with no children of their own
      const itemAbove = draggedFlatIndex > 0 ? flattenedItems[draggedFlatIndex - 1] : null;
      const itemAboveId = itemAbove ? (itemAbove.plan_item_id || itemAbove._id).toString() : null;

      // Determine which item to nest under:
      // - If dropping ON a different root item, nest under that target
      // - Otherwise, nest under the item above
      if (!targetIsChild && draggedId !== targetId) {
        // Dropping on a root item - nest under target
        if (canNestUnder(targetId)) {
          draggedItemCopy.parent = targetId;
          debug.log('[Drag] Making item a child of drop target', { newParent: targetId });
        } else {
          debug.log('[Drag] Nest blocked by max nesting level', { candidateParentId: targetId });
        }
      } else if (itemAbove && !itemAbove.isChild) {
        // Item above is a root item - can nest under it
        if (canNestUnder(itemAboveId)) {
          draggedItemCopy.parent = itemAboveId;
          debug.log('[Drag] Making item a child of item above', { newParent: itemAboveId, itemAboveText: itemAbove.text });
        } else {
          debug.log('[Drag] Nest blocked by max nesting level', { candidateParentId: itemAboveId });
        }
      } else if (itemAbove && itemAbove.isChild) {
        // Item above is a child - become sibling (same parent)
        const siblingParentId = itemAbove.parent?.toString();
        if (siblingParentId && canNestUnder(siblingParentId)) {
          draggedItemCopy.parent = itemAbove.parent;
          debug.log('[Drag] Becoming sibling of item above', { newParent: itemAbove.parent });
        } else {
          debug.log('[Drag] Sibling reparent blocked by max nesting level', { candidateParentId: siblingParentId });
        }
      } else {
        debug.log('[Drag] No valid item to nest under');
      }
    } else if (targetIsChild && draggedParentId !== targetParentId && !promotionIntent) {
      // Dragged item should adopt the same parent as target (become sibling)
      const siblingParentId = targetItem.parent?.toString();
      if (siblingParentId && canNestUnder(siblingParentId)) {
        draggedItemCopy.parent = targetItem.parent;
        debug.log('[Drag] Reparenting to same parent as target', { newParent: targetItem.parent });
      } else {
        debug.log('[Drag] Sibling reparent blocked by max nesting level', { candidateParentId: siblingParentId });
      }
    } else if (!targetIsChild && draggedParentId && !nestingIntent) {
      // Target is a root item and dragged item was a child → promote to root
      delete draggedItemCopy.parent;
      debug.log('[Drag] Promoting child to root level');
    }
    // If both have same parent or both are root → just reorder (no parent change)

    // Find indices for arrayMove
    const oldIndex = reorderedItems.findIndex(
      (item) => (item.plan_item_id || item._id).toString() === draggedId
    );

    // For promotion by drag-left, position above the former parent item
    let newIndex;
    if (promotedToParentPosition && draggedParentId) {
      newIndex = reorderedItems.findIndex(
        (item) => (item.plan_item_id || item._id).toString() === draggedParentId
      );
      debug.log('[Drag] Positioning promoted item above former parent', { parentId: draggedParentId, newIndex });
    } else {
      newIndex = reorderedItems.findIndex(
        (item) => (item.plan_item_id || item._id).toString() === targetId
      );
    }

    if (oldIndex === -1 || newIndex === -1) {
      debug.warn('[Drag] Could not find item indices', { oldIndex, newIndex });
      return;
    }

    // Apply position reorder
    reorderedItems = arrayMove(reorderedItems, oldIndex, newIndex);

    // Determine hierarchy change type for visual feedback
    const newParentId = draggedItemCopy.parent?.toString() || null;
    const hierarchyChanged = draggedParentId !== newParentId;
    let hierarchyChangeType = null;
    if (hierarchyChanged) {
      if (newParentId && !draggedParentId) {
        // Was root, now has parent → nested
        hierarchyChangeType = 'nested';
      } else if (!newParentId && draggedParentId) {
        // Was child, now root → promoted
        hierarchyChangeType = 'promoted';
      } else if (newParentId && draggedParentId && newParentId !== draggedParentId) {
        // Changed parents → nested (reparented)
        hierarchyChangeType = 'nested';
      }
    }

    debug.log('[Drag] Reordered items', {
      activeId: active.id,
      overId: over.id,
      oldIndex,
      newIndex,
      hierarchyChanged,
      hierarchyChangeType
    });

    // Apply visual snap animation for hierarchy changes
    if (hierarchyChangeType) {
      const draggedItemElement = document.querySelector(`[data-plan-item-id="${draggedId}"]`);
      if (draggedItemElement) {
        // Remove any existing hierarchy classes
        draggedItemElement.classList.remove('hierarchy-nested', 'hierarchy-promoted');
        // Force reflow to restart animation
        void draggedItemElement.offsetWidth;
        // Add the appropriate class
        draggedItemElement.classList.add(`hierarchy-${hierarchyChangeType}`);
        // Remove class after animation completes
        setTimeout(() => {
          draggedItemElement.classList.remove(`hierarchy-${hierarchyChangeType}`);
        }, HIERARCHY_ANIMATION_DURATION_MS);
      }
    }

    // Call parent handler to update backend (pass draggedItemId for highlighting)
    if (onReorderPlanItems) {
      onReorderPlanItems(selectedPlanId, reorderedItems, active.id.toString());
    }
  };

    // Map both _id and plan_item_id to a canonical expansion key.
    // This lets us normalize child->parent references regardless of whether the parent was stored
    // as a plan instance _id or an experience plan_item_id.
    const idToExpansionKey = useMemo(() => {
      const map = new Map();
      if (!currentPlan?.plan) return map;

      for (const item of currentPlan.plan) {
        const canonicalKey = getExpansionKey(item);
        const itemId = item?._id?.toString?.() || null;
        const refId = item?.plan_item_id?.toString?.() || null;

        if (itemId && canonicalKey) map.set(itemId, canonicalKey);
        if (refId && canonicalKey) map.set(refId, canonicalKey);
      }

      return map;
    }, [currentPlan?.plan, getExpansionKey]);

    const getCanonicalParentKey = useCallback((item) => {
      const rawParentId = item?.parent?.toString?.() || null;
      if (!rawParentId) return null;
      return idToExpansionKey.get(rawParentId) || rawParentId;
    }, [idToExpansionKey]);

    // Memoized flattenPlanItems function with injected dependencies
    const flattenPlanItemsFn = useMemo(
      () => createFlattenPlanItems({
        expandedParents,
        animatingCollapse,
        getExpansionKey,
        getCanonicalParentKey
      }),
      [expandedParents, animatingCollapse, getExpansionKey, getCanonicalParentKey]
    );

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

  // Compute rendering data BEFORE early returns to maintain hooks order
  // These useMemos handle null currentPlan gracefully
  const flattenedItems = useMemo(() => {
    if (!currentPlan?.plan || currentPlan.plan.length === 0) return [];
    return flattenPlanItemsFn(currentPlan.plan);
  }, [currentPlan?.plan, flattenPlanItemsFn]);

  const filteredItems = useMemo(() => {
    return flattenedItems.filter(
      (item) =>
        item.isVisible ||
        (item.isChild && animatingCollapse === item.parentKey)
    );
  }, [flattenedItems, animatingCollapse]);

  const pinnedItemId = currentPlan?.pinnedItemId?.toString() || null;

  // Helper to check if an item is pinned (either the pinned item itself or a child of it)
  // Need to find the pinned item and check both its _id and plan_item_id
  const pinnedItem = useMemo(() => {
    if (!pinnedItemId || !currentPlan?.plan) return null;
    return currentPlan.plan.find(item =>
      (item._id?.toString() === pinnedItemId) ||
      (item.plan_item_id?.toString() === pinnedItemId)
    );
  }, [pinnedItemId, currentPlan?.plan]);

  const isPinnedOrChild = useCallback((item) => {
    if (!pinnedItemId || !pinnedItem) return false;
    const itemId = (item._id || item.plan_item_id)?.toString();
    // Item is the pinned item itself
    if (itemId === pinnedItemId) return true;
    // Child inherits pinned status from parent - check against both _id and plan_item_id of pinned item
    const parentId = item.parent?.toString();
    if (!parentId) return false;
    if (parentId === pinnedItem._id?.toString()) return true;
    if (parentId === pinnedItem.plan_item_id?.toString()) return true;
    return false;
  }, [pinnedItemId, pinnedItem]);

  // Extract pinned item and its children for separate rendering in Timeline/Activity views
  // Children respect the expand/collapse state of the pinned parent
  const { pinnedItems, unpinnedItems } = useMemo(() => {
    if (!pinnedItemId || flattenedItems.length === 0) {
      return { pinnedItems: [], unpinnedItems: filteredItems };
    }

    const pinned = [];
    const unpinned = [];

    // Get pinned items from flattenedItems, respecting visibility for children
    // The pinned parent is always visible, but its children respect expand/collapse state
    for (const item of flattenedItems) {
      if (isPinnedOrChild(item)) {
        // Include if it's the pinned parent OR if it's a visible child
        if (item.isVisible || (!item.isChild && !item.parent)) {
          pinned.push(item);
        }
      }
    }

    // Get unpinned items from filteredItems (respects expand/collapse for non-pinned)
    for (const item of filteredItems) {
      if (!isPinnedOrChild(item)) {
        unpinned.push(item);
      }
    }

    return { pinnedItems: pinned, unpinnedItems: unpinned };
  }, [flattenedItems, filteredItems, pinnedItemId, isPinnedOrChild]);

  // For timeline/activity views, we need ALL items (including collapsed children)
  // to properly group them with their parents - not just visible items
  const allUnpinnedItems = useMemo(() => {
    if (!pinnedItemId || flattenedItems.length === 0) {
      return flattenedItems;
    }

    return flattenedItems.filter(item => !isPinnedOrChild(item));
  }, [flattenedItems, pinnedItemId, isPinnedOrChild]);

  const itemsToRender = useMemo(() => {
    if (!pinnedItemId || filteredItems.length === 0) return filteredItems;
    // Pinned item (and children) first, then others
    return [...pinnedItems, ...unpinnedItems];
  }, [filteredItems, pinnedItemId, pinnedItems, unpinnedItems]);

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

  const parentsWithChildren = useMemo(() => {
    const parents = new Set();
    if (!currentPlan?.plan) return parents;

    for (const item of currentPlan.plan) {
      if (item.parent) {
        // Normalize parent key so it matches getExpansionKey(parent)
        const canonicalParentKey = getCanonicalParentKey(item);
        if (canonicalParentKey) parents.add(canonicalParentKey);
      }
    }
    return parents;
  }, [currentPlan?.plan, getCanonicalParentKey]);

  // Helper to check if an item has children
  const hasChildren = useCallback((item) => {
    const itemKey = getExpansionKey(item);
    if (!itemKey) return false;
    return parentsWithChildren.has(itemKey);
  }, [parentsWithChildren, getExpansionKey]);

  // Helper to check if an item should be visible based on expand/collapse state
  // Parent items are always visible; child items are visible only if parent is expanded
  const isItemVisible = useCallback((item) => {
    // If not a child, always visible
    if (!item.parent && !item.isChild) return true;
    // Child items: check if parent is expanded
    const parentKey = getCanonicalParentKey(item);
    if (!parentKey) return true;
    return expandedParents.has(parentKey);
  }, [expandedParents, getCanonicalParentKey]);

  // Create parent item lookup for child activity badge display
  const parentItemMap = useMemo(() => {
    const map = new Map();
    if (currentPlan?.plan) {
      for (const item of currentPlan.plan) {
        map.set((item.plan_item_id || item._id)?.toString(), item);
      }
    }
    return map;
  }, [currentPlan?.plan]);

  const getPlanItemDepth = useCallback((item) => {
    if (!item) return Infinity;

    const visited = new Set();
    let depth = 0;
    let cursor = item;

    while (cursor?.parent) {
      const parentId = cursor.parent?.toString();
      if (!parentId) return Infinity;
      if (visited.has(parentId)) return Infinity;
      visited.add(parentId);

      const parent = parentItemMap.get(parentId);
      if (!parent) return Infinity;

      depth += 1;
      if (depth > MAX_PLAN_ITEM_DEPTH) return Infinity;
      cursor = parent;
    }

    return depth;
  }, [parentItemMap]);

  const canAddChildToItem = useCallback((item) => {
    if (maxPlanItemNestingLevel <= 0) return false;
    const depth = getPlanItemDepth(item);
    return Number.isFinite(depth) && depth < maxPlanItemNestingLevel;
  }, [maxPlanItemNestingLevel, getPlanItemDepth]);

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

      {/* Plan Items List - Card View with Drag-and-Drop */}
      {planItemsView === 'card' && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={itemsToRender.map(item => (item.plan_item_id || item._id).toString())}
            strategy={verticalListSortingStrategy}
          >
            {itemsToRender.map((planItem) => {
              const itemId = (planItem._id || planItem.plan_item_id)?.toString();
              const itemProps = getItemProps(planItem);
              return (
                <SortablePlanItem
                  key={planItem.plan_item_id || planItem._id}
                  planItem={planItem}
                  canAddChild={itemProps.canAddChild}
                  hasChildren={itemProps.hasChildren}
                  isExpanded={itemProps.isExpanded}
                  {...sharedSortablePlanItemProps}
                  isPinned={itemId === pinnedItemId}
                />
              );
            })}
          </SortableContext>
        </DndContext>
      )}

      {/* Plan Items List - Compact View with Drag and Drop */}
      {planItemsView === 'compact' && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={itemsToRender.map(item => (item.plan_item_id || item._id).toString())}
            strategy={verticalListSortingStrategy}
          >
            <div className="compact-plan-items-list">
              {itemsToRender.map((planItem) => {
                const itemProps = getItemProps(planItem);
                return (
                  <SortableCompactPlanItem
                    key={planItem.plan_item_id || planItem._id}
                    planItem={planItem}
                    {...sharedItemHandlers}
                    {...itemProps}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Plan Items List - Activity View (grouped by activity type with drag and drop) */}
      {planItemsView === 'activity' && activityGroups && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="activity-plan-items-list">
            {/* Pinned Section - shown outside activity groups */}
            {pinnedItems.length > 0 && (
              <div className="activity-type-group activity-type-pinned">
                <div className="activity-type-group-header activity-pinned-header">
                  <span className="activity-type-label">Pinned</span>
                </div>
                <SortableContext
                  items={pinnedItems.map(item => (item.plan_item_id || item._id).toString())}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="activity-type-group-items">
                    {pinnedItems.map((planItem) => {
                      const itemProps = getItemProps(planItem);
                      return (
                        <SortableCompactPlanItem
                          key={planItem.plan_item_id || planItem._id}
                          planItem={planItem}
                          {...sharedItemHandlers}
                          {...itemProps}
                          showActivityBadge={true}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              </div>
            )}

            {/* Groups by activity type */}
            {activityGroups.groups.map((group) => {
              const visibleItems = group.items.filter(isItemVisible);
              if (visibleItems.length === 0) return null;
              return (
                <div key={group.type} className="activity-type-group">
                  <div className="activity-type-group-header">
                    <span className="activity-type-icon">{group.icon}</span>
                    <span className="activity-type-label">{group.label}</span>
                    <span className="activity-type-count">({visibleItems.length})</span>
                  </div>
                  <SortableContext
                    items={visibleItems.map(item => (item.plan_item_id || item._id).toString())}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="activity-type-group-items">
                      {visibleItems.map((planItem) => {
                        const itemProps = getItemProps(planItem);
                        return (
                          <SortableCompactPlanItem
                            key={planItem.plan_item_id || planItem._id}
                            planItem={planItem}
                            {...sharedItemHandlers}
                            {...itemProps}
                            showActivityBadge={true}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </div>
              );
            })}

            {/* Ungrouped items (no activity type) */}
            {(() => {
              const visibleUngrouped = activityGroups.ungrouped.filter(isItemVisible);
              if (visibleUngrouped.length === 0) return null;
              return (
                <div className="activity-type-group activity-type-ungrouped">
                  <div className="activity-type-group-header">
                    <span className="activity-type-icon">📌</span>
                    <span className="activity-type-label">Unspecified</span>
                    <span className="activity-type-count">({visibleUngrouped.length})</span>
                  </div>
                  <SortableContext
                    items={visibleUngrouped.map(item => (item.plan_item_id || item._id).toString())}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="activity-type-group-items">
                      {visibleUngrouped.map((planItem) => {
                        const itemProps = getItemProps(planItem);
                        return (
                          <SortableCompactPlanItem
                            key={planItem.plan_item_id || planItem._id}
                            planItem={planItem}
                            {...sharedItemHandlers}
                            {...itemProps}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </div>
              );
            })()}

            {/* Empty state */}
            {activityGroups.groups.length === 0 && activityGroups.ungrouped.length === 0 && (
              <div className="activity-empty-state">
                <p>No plan items yet. Add items to see them grouped by activity type.</p>
              </div>
            )}
          </div>
        </DndContext>
      )}

      {/* Plan Items List - Timeline View (grouped by date, time of day, then activity type) */}
      {planItemsView === 'timeline' && timelineGroups && (
          <div className="timeline-plan-items-list">
            {/* Pinned Section - shown outside timeline groups */}
            {pinnedItems.length > 0 && (
              <div className="timeline-date-group timeline-pinned">
                <div className="timeline-date-header timeline-pinned-header">
                  Pinned
                </div>
                <div className="timeline-date-content">
                  <div className="timeline-time-items">
                    {pinnedItems.map((planItem) => {
                      const itemProps = getItemProps(planItem);
                      return (
                        <TimelinePlanItem
                          key={planItem.plan_item_id || planItem._id}
                          planItem={planItem}
                          {...sharedItemHandlers}
                          {...itemProps}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Scheduled items grouped by date */}
            {timelineGroups.groups.map((group) => (
              <TimelineDateGroup
                key={group.dateKey}
                group={group}
                isItemVisibleFn={isItemVisible}
                sharedItemHandlers={sharedItemHandlers}
                getItemProps={getItemProps}
              />
            ))}

            {/* Unscheduled items section - also grouped by activity type */}
            {timelineGroups.unscheduled.length > 0 && (
              <div className="timeline-date-group timeline-unscheduled">
                <div className="timeline-date-header">
                  Unscheduled
                </div>
                <div className="timeline-date-content">
                  <div className="timeline-time-items">
                    {/* Grouped by activity type */}
                    {timelineGroups.unscheduledByActivity?.groups?.map(activityGroup => {
                      const visibleItems = activityGroup.items.filter(isItemVisible);
                      if (visibleItems.length === 0) return null;
                      return (
                        <div key={activityGroup.type} className="timeline-activity-group">
                          <div className="timeline-activity-header">
                            <span className="timeline-activity-icon">{activityGroup.icon}</span>
                            <span className="timeline-activity-label">{activityGroup.label}</span>
                          </div>
                          <div className="timeline-activity-items">
                            {visibleItems.map(item => {
                              const itemProps = getItemProps(item);
                              return (
                                <TimelinePlanItem
                                  key={item.plan_item_id || item._id}
                                  planItem={item}
                                  {...sharedItemHandlers}
                                  {...itemProps}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {/* Ungrouped items (no activity type) */}
                    {(() => {
                      const visibleUngrouped = (timelineGroups.unscheduledByActivity?.ungrouped || []).filter(isItemVisible);
                      if (visibleUngrouped.length === 0) return null;
                      return (
                        <div className="timeline-activity-group timeline-activity-ungrouped">
                          {timelineGroups.unscheduledByActivity?.groups?.length > 0 && (
                            <div className="timeline-activity-header">
                              <span className="timeline-activity-icon">📌</span>
                              <span className="timeline-activity-label">Other</span>
                            </div>
                          )}
                          <div className="timeline-activity-items">
                            {visibleUngrouped.map(item => {
                              const itemProps = getItemProps(item);
                              return (
                                <TimelinePlanItem
                                  key={item.plan_item_id || item._id}
                                  planItem={item}
                                  {...sharedItemHandlers}
                                  {...itemProps}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* Empty state when no items */}
            {timelineGroups.groups.length === 0 && timelineGroups.unscheduled.length === 0 && (
              <div className="timeline-empty-state">
                <p>No plan items yet. Add items to see them in your timeline.</p>
              </div>
            )}
          </div>
      )}

      {/* Schedule Date Modal */}
      <AddDateModal
        show={showDateModal}
        onClose={() => {
          setShowDateModal(false);
          setDateModalPlanItem(null);
          setDateModalTimeOnly(false);
          setDateModalParentDate(null);
        }}
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

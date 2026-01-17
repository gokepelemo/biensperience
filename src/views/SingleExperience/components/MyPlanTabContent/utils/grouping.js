/**
 * Grouping utilities for MyPlanTabContent.
 */

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

import { getActivityType } from '../../../../../constants/activity-types';
import { getTimeOfDay } from './time';
import { groupItemsByType } from '../../../../../utilities/plan-grouping-utils';


// Re-export the new unified utility for local compatibility
export { groupItemsByType } from '../../../../../utilities/plan-grouping-utils';

/**
 * Group plan items by date and time of day for Timeline view
 * Child items inherit scheduled_date/time from their parent if not set
 * Within each time section, items are further grouped by activity type
 * @param {Array<PlanItem>} items - Plan items to group by date/time
 * @returns {Object<string, {date: string, timeGroups: Object<string, {timeOfDay: string, activityGroups: Object<string, PlanItem[]>}>}>}
 *   Groups keyed by date string, containing time groups with activity subgroups
 */
export function groupPlanItemsByDate(items) {
  const groups = {};
  const unscheduled = [];

  // Create a map of items by BOTH _id and plan_item_id for parent lookups
  const itemsById = new Map();
  items.forEach(item => {
    if (item._id) {
      itemsById.set(item._id.toString(), item);
    }
    if (item.plan_item_id) {
      itemsById.set(item.plan_item_id.toString(), item);
    }
  });

  // Parent-only scheduling: a hierarchy's date/time is determined by its root item.
  // If the root has no scheduled_date, the entire hierarchy is considered unscheduled.
  const parentItems = items.filter(item => !item.parent);
  const childItems = items.filter(item => !!item.parent);

  const childrenByParent = new Map();
  childItems.forEach(child => {
    const parentId = child.parent.toString();
    if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
    childrenByParent.get(parentId).push(child);
  });

  // Helper to get children for a parent item (checks both _id and plan_item_id)
  const getChildrenForParent = (item) => {
    const children = [];
    if (item._id) {
      const byId = childrenByParent.get(item._id.toString()) || [];
      children.push(...byId);
    }
    if (item.plan_item_id) {
      const byPlanItemId = childrenByParent.get(item.plan_item_id.toString()) || [];
      for (const child of byPlanItemId) {
        if (!children.includes(child)) {
          children.push(child);
        }
      }
    }
    return children;
  };

  const addedIds = new Set();

  const addDescendantsToTarget = (parent, rootSchedule, pushFn) => {
    const children = getChildrenForParent(parent);
    for (const child of children) {
      const childId = (child._id || child.plan_item_id)?.toString();
      if (!childId || addedIds.has(childId)) continue;
      addedIds.add(childId);
      pushFn({
        ...child,
        isChild: true,
        inheritedSchedule: Boolean(rootSchedule?.scheduled_date),
        // Reflect root schedule on descendants for Timeline display/sorting.
        scheduled_date: rootSchedule?.scheduled_date ?? null,
        scheduled_time: rootSchedule?.scheduled_time ?? null
      });
      addDescendantsToTarget(child, rootSchedule, pushFn);
    }
  };

  const addHierarchyToUnscheduled = (root) => {
    const rootId = (root._id || root.plan_item_id)?.toString();
    if (rootId) addedIds.add(rootId);
    unscheduled.push({ ...root, inheritedSchedule: false });
    addDescendantsToTarget(root, { scheduled_date: null, scheduled_time: null }, (it) => {
      unscheduled.push({ ...it, inheritedSchedule: false });
    });
  };

  const addHierarchyToScheduled = (root) => {
    const rootId = (root._id || root.plan_item_id)?.toString();
    if (rootId) addedIds.add(rootId);

    const date = new Date(root.scheduled_date);
    if (isNaN(date.getTime())) {
      addHierarchyToUnscheduled(root);
      return;
    }

    const dateKey = date.toISOString().split('T')[0];
    if (!groups[dateKey]) {
      groups[dateKey] = {
        date,
        dateKey,
        morning: [],
        afternoon: [],
        evening: [],
        unspecified: []
      };
    }

    const timeOfDay = getTimeOfDay(root.scheduled_time);
    const pushFn = (it) => {
      if (timeOfDay) groups[dateKey][timeOfDay].push(it);
      else groups[dateKey].unspecified.push(it);
    };

    pushFn({ ...root, inheritedSchedule: false });
    addDescendantsToTarget(
      root,
      { scheduled_date: root.scheduled_date, scheduled_time: root.scheduled_time },
      pushFn
    );
  };

  // Process each root item; it brings its entire hierarchy along
  parentItems.forEach((root) => {
    if (!root?.scheduled_date) {
      addHierarchyToUnscheduled(root);
      return;
    }
    addHierarchyToScheduled(root);
  });

  // Any remaining items are orphaned (missing root). Show them under unscheduled.
  items.forEach((item) => {
    const itemId = (item._id || item.plan_item_id)?.toString();
    if (!itemId || addedIds.has(itemId)) return;
    addedIds.add(itemId);
    unscheduled.push({
      ...item,
      isChild: Boolean(item.parent),
      isOrphaned: Boolean(item.parent),
      inheritedSchedule: false
    });
  });

  // Group items by activity type within each time section
  for (const dateKey of Object.keys(groups)) {
    groups[dateKey].morningByActivity = groupItemsByType(groups[dateKey].morning);
    groups[dateKey].afternoonByActivity = groupItemsByType(groups[dateKey].afternoon);
    groups[dateKey].eveningByActivity = groupItemsByType(groups[dateKey].evening);
    groups[dateKey].unspecifiedByActivity = groupItemsByType(groups[dateKey].unspecified);
  }

  // Sort groups by date
  const sortedGroups = Object.values(groups).sort((a, b) => a.date - b.date);

  // Group unscheduled items by activity type
  const unscheduledByActivity = groupItemsByType(unscheduled);

  return { groups: sortedGroups, unscheduled, unscheduledByActivity };
}

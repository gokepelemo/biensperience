/**
 * Unified plan item grouping utility for activity type and timeline views.
 *
 * Usage:
 *   groupItemsByType(items, { parentLookup, categoryOrder, includeOrphans })
 *
 * - parentLookup: array of items to use for parent lookups (default: items)
 * - categoryOrder: array of category strings for sorting (default: ['essentials', 'experiences', 'services', 'other'])
 * - includeOrphans: whether to collect orphaned children (default: true)
 */
import { getActivityType } from '../constants/activity-types';

export const DEFAULT_CATEGORY_ORDER = ['essentials', 'experiences', 'services', 'other'];

export function groupItemsByType(items, options = {}) {
  if (!items || items.length === 0) {
    return { groups: [], ungrouped: [] };
  }
  const {
    parentLookup = items,
    categoryOrder = DEFAULT_CATEGORY_ORDER,
    includeOrphans = true
  } = options;

  const groups = {};
  const ungrouped = [];

  // Build parent-child map from parentLookup
  const childrenByParent = new Map();
  for (const item of parentLookup) {
    const parentId = item?.parent?.toString();
    if (!parentId) continue;
    if (!childrenByParent.has(parentId)) {
      childrenByParent.set(parentId, []);
    }
    childrenByParent.get(parentId).push(item);
  }

  const getChildrenForParent = (item) => {
    const children = [];
    const seen = new Set();
    const maybePushChildren = (parentId) => {
      if (!parentId) return;
      const list = childrenByParent.get(parentId) || [];
      for (const child of list) {
        const childId = (child?._id || child?.plan_item_id)?.toString();
        if (!childId || seen.has(childId)) continue;
        seen.add(childId);
        children.push(child);
      }
    };
    maybePushChildren(item?._id?.toString());
    maybePushChildren(item?.plan_item_id?.toString());
    return children;
  };

  const addedItems = new Set();
  const addDescendants = (parent, rootActivityType, targetArray) => {
    const children = getChildrenForParent(parent);
    for (const child of children) {
      const childId = (child?._id || child?.plan_item_id)?.toString();
      if (!childId || addedItems.has(childId)) continue;
      addedItems.add(childId);
      targetArray.push({
        ...child,
        isChild: true,
        inheritedActivityType: rootActivityType
          ? (!child.activity_type || child.activity_type === rootActivityType)
          : true
      });
      addDescendants(child, rootActivityType, targetArray);
    }
  };

  for (const item of items) {
    if (item?.parent || item?.isChild) continue;
    const itemId = (item?._id || item?.plan_item_id)?.toString();
    if (!itemId || addedItems.has(itemId)) continue;
    addedItems.add(itemId);
    const activityType = item.activity_type;
    if (!activityType) {
      ungrouped.push(item);
      addDescendants(item, null, ungrouped);
      continue;
    }
    if (!groups[activityType]) {
      const typeInfo = getActivityType(activityType);
      groups[activityType] = {
        type: activityType,
        label: typeInfo?.label || activityType,
        icon: typeInfo?.icon || '📌',
        category: typeInfo?.category || 'other',
        items: []
      };
    }
    groups[activityType].items.push(item);
    addDescendants(item, activityType, groups[activityType].items);
  }

  if (includeOrphans) {
    for (const item of items) {
      if (!item?.parent) continue;
      const itemId = (item?._id || item?.plan_item_id)?.toString();
      if (!itemId || addedItems.has(itemId)) continue;
      addedItems.add(itemId);
      ungrouped.push({ ...item, isChild: true, isOrphaned: true });
    }
  }

  // Sort groups by category order, then label
  const categoryOrderMap = Object.fromEntries(categoryOrder.map((cat, i) => [cat, i + 1]));
  const sortedGroups = Object.values(groups).sort((a, b) => {
    const orderA = categoryOrderMap[a.category] || 99;
    const orderB = categoryOrderMap[b.category] || 99;
    if (orderA !== orderB) return orderA - orderB;
    return a.label.localeCompare(b.label);
  });

  return { groups: sortedGroups, ungrouped };
}

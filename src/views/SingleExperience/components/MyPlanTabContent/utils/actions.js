/**
 * Action builder utilities for MyPlanTabContent.
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
 * @typedef {Object} Action
 * @property {string} id - Action identifier
 * @property {string} label - Display label
 * @property {React.ReactElement} icon - Icon component
 * @property {Function} onClick - Click handler
 */

import { createElement } from 'react';
import {
  BsPencilSquare,
  BsPlusCircle,
  BsCalendarEvent,
  BsEye,
  BsPinAngle,
  BsPinAngleFill,
  BsTrash3,
} from 'react-icons/bs';

/**
 * Build standardized actions array for plan item context menus
 * @param {Object} config - Action configuration
 * @param {PlanItem} config.planItem - The plan item
 * @param {PlanItem|null} config.parentItem - Parent item if nested
 * @param {boolean} config.canAddChild - Whether children can be added
 * @param {Object} config.lang - Language strings object
 * @param {boolean} config.isPinned - Whether item is pinned
 * @param {Function} config.onPinItem - Pin toggle callback
 * @param {Function} config.onEdit - Edit callback
 * @param {Function} config.onAddChild - Add child callback
 * @param {Function} config.onSchedule - Schedule callback
 * @param {Function} config.onViewDetails - View details callback
 * @param {Function} config.onDelete - Delete callback
 * @returns {Action[]} Array of action objects for ActionsMenu
 */
export function buildStandardPlanItemActions({
  planItem,
  parentItem,
  canAddChild,
  lang,
  isPinned,
  onPinItem,
  onEdit,
  onAddChild,
  onSchedule,
  onViewDetails,
  onDelete,
}) {
  const isChild = Boolean(planItem.isChild || planItem.parent);
  const isRoot = !planItem.parent && !planItem.isChild;

  const items = [
    {
      id: 'edit',
      label: lang.current.button?.update || 'Update',
      icon: createElement(BsPencilSquare),
      onClick: () => onEdit(planItem),
    },
  ];

  if (canAddChild) {
    items.splice(1, 0, {
      id: 'add-child',
      label: lang.current.button?.addChildItem || 'Add Child Item',
      icon: createElement(BsPlusCircle),
      onClick: () => onAddChild(planItem.plan_item_id || planItem._id),
    });
  }

  if (!isChild) {
    items.push({
      id: 'schedule',
      label: 'Schedule Date',
      icon: createElement(BsCalendarEvent),
      onClick: () => onSchedule(planItem, parentItem),
    });
  }

  if (planItem.url) {
    items.push({
      id: 'view-details',
      label: 'View Details',
      icon: createElement(BsEye),
      onClick: () => onViewDetails(planItem),
    });
  }

  if (isRoot && onPinItem) {
    items.push({
      id: 'pin',
      label: isPinned ? 'Unpin' : 'Pin to Top',
      icon: isPinned ? createElement(BsPinAngleFill) : createElement(BsPinAngle),
      variant: isPinned ? 'active' : 'default',
      onClick: () => onPinItem(planItem),
    });
  }

  items.push({
    id: 'delete',
    label: lang.current.tooltip.delete,
    icon: createElement(BsTrash3),
    variant: 'danger',
    onClick: () => onDelete(planItem),
  });

  return items;
}

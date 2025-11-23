/**
 * ExperienceTabContent Component
 * Displays the experience's plan items with collaborators and action buttons
 * This is the "The Plan" tab showing the master plan items defined by the experience owner
 */

import { Link } from 'react-router-dom';
import { BsPlusCircle } from 'react-icons/bs';
import { FaUserPlus } from 'react-icons/fa';
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
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import UsersListDisplay from '../../../components/UsersListDisplay/UsersListDisplay';
import DragHandle from '../../../components/DragHandle/DragHandle';
import { Text } from '../../../components/design-system';
import { formatCurrency } from '../../../utilities/currency-utils';
import { isOwner } from '../../../utilities/permissions';
import debug from '../../../utilities/debug';

// Sortable plan item component for drag and drop
function SortableExperiencePlanItem({
  planItem,
  experience,
  user,
  expandedParents,
  canEdit,
  toggleExpanded,
  handleAddExperiencePlanItem,
  handleEditExperiencePlanItem,
  setPlanItemToDelete,
  setShowPlanDeleteModal,
  lang
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: planItem._id.toString(),
    disabled: !canEdit,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1000 : 'auto',
  };

  const hasChildren = experience.plan_items.some(
    (sub) =>
      sub.parent &&
      sub.parent.toString() === planItem._id.toString()
  );

  const isChild = !!planItem.parent;

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-plan-item-id={planItem._id}
      className={`plan-item-card mb-3 overflow-hidden ${isDragging ? 'dragging' : ''}`}
    >
      <div className="plan-item-header p-3 p-md-4">
        <div className="plan-item-tree">
          {!isChild ? (
            (() => {
              if (hasChildren) {
                return (
                  <button
                    className="btn btn-sm btn-link p-0 expand-toggle"
                    onClick={() => toggleExpanded(planItem._id)}
                  >
                    {expandedParents.has(planItem._id) ? "▼" : "▶"}
                  </button>
                );
              } else {
                return <span className="no-child-arrow">•</span>;
              }
            })()
          ) : (
            <span className="child-arrow">↳</span>
          )}
        </div>
        <div className="plan-item-title flex-grow-1 fw-semibold">
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

        {/* Drag handle - only for parent items when user can edit */}
        {canEdit && !isChild && (
          <div className="drag-handle-wrapper">
            <DragHandle
              id={planItem._id.toString()}
              disabled={!canEdit}
            />
          </div>
        )}

        <div className="plan-item-actions">
          {isOwner(user, experience) && (
            <div className="d-flex gap-1">
              {!planItem.parent && (
                <button
                  className="btn btn-outline-primary btn-sm"
                  onClick={() =>
                    handleAddExperiencePlanItem(planItem._id)
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
  );
}

export default function ExperienceTabContent({
  // User data
  user,
  experience,

  // Collaborators data
  experienceOwner,
  experienceCollaborators,
  experienceOwnerLoading,
  experienceCollaboratorsLoading,

  // Plan items state
  expandedParents,
  animatingCollapse,

  // Handlers
  handleAddExperiencePlanItem,
  handleEditExperiencePlanItem,
  openCollaboratorModal,
  toggleExpanded,
  setPlanItemToDelete,
  setShowPlanDeleteModal,
  onReorderExperiencePlanItems,

  // Language strings
  lang
}) {
  // Setup sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Check if user can edit experience plan
  const canEdit = isOwner(user, experience);

  // Handle drag end event
  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (!active || !over || active.id === over.id) {
      return;
    }

    if (!experience || !experience.plan_items) {
      debug.warn('[ExperienceDrag] Cannot reorder - no plan items data');
      return;
    }

    // Only reorder parent items (not children)
    const parentItems = experience.plan_items.filter((item) => !item.parent);

    const oldIndex = parentItems.findIndex(
      (item) => item._id.toString() === active.id.toString()
    );
    const newIndex = parentItems.findIndex(
      (item) => item._id.toString() === over.id.toString()
    );

    if (oldIndex === -1 || newIndex === -1) {
      debug.warn('[ExperienceDrag] Could not find item indices', { oldIndex, newIndex });
      return;
    }

    const reorderedParents = arrayMove(parentItems, oldIndex, newIndex);

    // Rebuild full plan_items array with reordered parents and their children
    const childrenMap = new Map();
    experience.plan_items.forEach((item) => {
      if (item.parent) {
        const parentId = item.parent.toString();
        if (!childrenMap.has(parentId)) {
          childrenMap.set(parentId, []);
        }
        childrenMap.get(parentId).push(item);
      }
    });

    const reorderedItems = [];
    reorderedParents.forEach((parent) => {
      reorderedItems.push(parent);
      const children = childrenMap.get(parent._id.toString()) || [];
      reorderedItems.push(...children);
    });

    if (onReorderExperiencePlanItems) {
      onReorderExperiencePlanItems(experience._id, reorderedItems, active.id.toString());
    }
  };

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

  const flattenedItems = flattenPlanItems(experience.plan_items);
  const itemsToRender = flattenedItems.filter(
    (item) =>
      item.isVisible ||
      (item.isChild && animatingCollapse === item.parent)
  );

  // Get parent item IDs for sortable context
  const parentItemIds = experience.plan_items
    .filter((item) => !item.parent)
    .map((item) => item._id.toString());

  return (
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

      {/* Plan Items List with Drag and Drop */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={parentItemIds}
          strategy={verticalListSortingStrategy}
        >
          {itemsToRender.map((planItem) => (
            <SortableExperiencePlanItem
              key={planItem._id}
              planItem={planItem}
              experience={experience}
              user={user}
              expandedParents={expandedParents}
              canEdit={canEdit}
              toggleExpanded={toggleExpanded}
              handleAddExperiencePlanItem={handleAddExperiencePlanItem}
              handleEditExperiencePlanItem={handleEditExperiencePlanItem}
              setPlanItemToDelete={setPlanItemToDelete}
              setShowPlanDeleteModal={setShowPlanDeleteModal}
              lang={lang}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

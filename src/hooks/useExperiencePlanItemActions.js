/**
 * useExperiencePlanItemActions Hook
 *
 * Consolidates plan-item CRUD handlers (add/edit/save/delete/reorder/toggle-complete)
 * for both plan-instance items (user's plan) and experience template items.
 *
 * Extracted from SingleExperience.jsx — pure relocation of existing behavior.
 *
 * @module hooks/useExperiencePlanItemActions
 */

import { useCallback } from 'react';
import { lang } from '../lang.constants';
import debug from '../utilities/debug';
import { handleError } from '../utilities/error-handler';
import { idEquals, normalizeId, findIndexById, filterOutById } from '../utilities/id-utils';
import { eventBus } from '../utilities/event-bus';
import {
  deletePlanItem,
  addPlanItem as addExperiencePlanItem,
  updatePlanItem as updateExperiencePlanItem,
  reorderExperiencePlanItems,
} from '../utilities/experiences-api';
import {
  updatePlanItem,
  addPlanItem as addPlanItemToInstance,
  deletePlanItem as deletePlanItemFromInstance,
  reorderPlanItems,
} from '../utilities/plans-api';
import { escapeSelector, highlightPlanItem } from '../utilities/scroll-utils';
import useOptimisticAction from './useOptimisticAction';

export default function useExperiencePlanItemActions({
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
}) {
  // -------------------------------------------------------------------------
  // Plan-instance item helpers
  // -------------------------------------------------------------------------

  const handleAddPlanInstanceItem = useCallback((parentId = null) => {
    setEditingPlanItem(parentId ? { parent: parentId } : {});
    setPlanItemFormState(1); // Add mode
    openModal(MODAL_NAMES.ADD_EDIT_PLAN_ITEM);
  }, [openModal, MODAL_NAMES, setEditingPlanItem, setPlanItemFormState]);

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
    openModal(MODAL_NAMES.ADD_EDIT_PLAN_ITEM);
  }, [openModal, MODAL_NAMES, setEditingPlanItem, setPlanItemFormState]);

  // -------------------------------------------------------------------------
  // Plan-instance: save (add/update)
  // -------------------------------------------------------------------------

  const handleSavePlanInstanceItem = useCallback(
    async (formData) => {
      if (!selectedPlanId) return;

      const currentEditingPlanItem = formData;

      const prevPlans = [...sharedPlans];
      const prevUserPlan = userPlan && idEquals(userPlan._id, selectedPlanId)
        ? { ...userPlan, plan: Array.isArray(userPlan.plan) ? [...userPlan.plan] : [] }
        : null;

      const isAdd = planItemFormState === 1;
      const tempId = `temp-${Date.now()}`;

      const apply = () => {
        const applyToPlan = (plan) => {
          if (!plan) return plan;
          const nextItems = Array.isArray(plan.plan) ? [...plan.plan] : [];

          if (isAdd) {
            nextItems.push({
              _id: tempId,
              plan_item_id: currentEditingPlanItem.plan_item_id || tempId,
              text: currentEditingPlanItem.text || "",
              url: currentEditingPlanItem.url || "",
              cost: currentEditingPlanItem.cost || 0,
              planning_days: currentEditingPlanItem.planning_days || 0,
              parent: currentEditingPlanItem.parent || null,
              activity_type: currentEditingPlanItem.activity_type || null,
              location: currentEditingPlanItem.location || null,
              complete: false,
            });
          } else {
            const idx = findIndexById(nextItems, currentEditingPlanItem._id);
            if (idx >= 0) {
              nextItems[idx] = {
                ...nextItems[idx],
                text: currentEditingPlanItem.text || "",
                url: currentEditingPlanItem.url || "",
                cost: currentEditingPlanItem.cost || 0,
                planning_days: currentEditingPlanItem.planning_days || 0,
                parent: currentEditingPlanItem.parent || null,
                activity_type: currentEditingPlanItem.activity_type || null,
                location: currentEditingPlanItem.location || null,
              };
            }
          }

          return { ...plan, plan: nextItems };
        };

        setSharedPlans((prev) => prev.map(p => idEquals(p._id, selectedPlanId) ? applyToPlan(p) : p));
        setUserPlan((prev) => (prev && idEquals(prev._id, selectedPlanId)) ? applyToPlan(prev) : prev);

        closeModal();
        setEditingPlanItem({});
      };

      const apiCall = async () => {
        if (isAdd) {
          await addPlanItemToInstance(selectedPlanId, currentEditingPlanItem);
        } else {
          const { _id, plan_item_id, ...updates } = currentEditingPlanItem;
          await updatePlanItem(selectedPlanId, _id, updates);
        }
      };

      const rollback = () => {
        setSharedPlans(prevPlans);
        if (prevUserPlan) {
          setUserPlan(prevUserPlan);
        }
        openModal(MODAL_NAMES.ADD_EDIT_PLAN_ITEM);
        setEditingPlanItem(isAdd ? (currentEditingPlanItem || {}) : currentEditingPlanItem);
      };

      const onSuccess = async () => {
        fetchSharedPlans().catch(() => {});
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
      planItemFormState,
      fetchSharedPlans,
      fetchUserPlan,
      sharedPlans,
      userPlan,
      fetchPlans,
      showError,
      setSharedPlans,
      setUserPlan,
      setEditingPlanItem,
      closeModal,
      openModal,
      MODAL_NAMES,
    ]
  );

  // -------------------------------------------------------------------------
  // Plan-instance: delete
  // -------------------------------------------------------------------------

  const handlePlanInstanceItemDelete = useCallback(async () => {
    if (!selectedPlanId || !planInstanceItemToDelete) return;

    const itemToDelete = planInstanceItemToDelete;
    let prevPlansSnapshot = null;
    let prevUserPlanSnapshot = null;

    const apply = () => {
      setSharedPlans(prev => {
        prevPlansSnapshot = prev;
        const planIndex = findIndexById(prev, selectedPlanId);
        if (planIndex < 0) return prev;

        const updatedPlans = [...prev];
        const prevPlan = updatedPlans[planIndex];
        updatedPlans[planIndex] = {
          ...prevPlan,
          plan: filterOutById(prevPlan.plan, itemToDelete._id)
        };
        return updatedPlans;
      });

      if (userPlan && idEquals(userPlan._id, selectedPlanId)) {
        prevUserPlanSnapshot = { ...userPlan, plan: Array.isArray(userPlan.plan) ? [...userPlan.plan] : [] };
        setUserPlan(prev => prev ? {
          ...prev,
          plan: filterOutById(prev.plan, itemToDelete._id)
        } : prev);
      }

      closeModal();
      setPlanInstanceItemToDelete(null);
    };

    const apiCall = async () => {
      await deletePlanItemFromInstance(selectedPlanId, itemToDelete._id);
    };

    const rollback = () => {
      if (prevPlansSnapshot) {
        setSharedPlans(prevPlansSnapshot);
      }
      if (prevUserPlanSnapshot) {
        setUserPlan(prevUserPlanSnapshot);
      }
    };

    const onSuccess = async () => {
      fetchSharedPlans().catch(() => {});
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
    userPlan,
    fetchSharedPlans,
    fetchUserPlan,
    fetchPlans,
    showError,
    setSharedPlans,
    setUserPlan,
    setPlanInstanceItemToDelete,
    closeModal,
  ]);

  // -------------------------------------------------------------------------
  // Experience template items: add/edit/save
  // -------------------------------------------------------------------------

  const handleAddExperiencePlanItem = useCallback((parentId = null) => {
    setEditingPlanItem(parentId ? { parent: parentId } : {});
    setPlanItemFormState(1);
    openModal(MODAL_NAMES.ADD_EDIT_PLAN_ITEM);
  }, [openModal, MODAL_NAMES, setEditingPlanItem, setPlanItemFormState]);

  const handleEditExperiencePlanItem = useCallback((planItem) => {
    setEditingPlanItem({
      _id: planItem._id,
      text: planItem.text,
      url: planItem.url || "",
      cost: planItem.cost_estimate || 0,
      planning_days: planItem.planning_days || 0,
      parent: planItem.parent || null,
    });
    setPlanItemFormState(0);
    openModal(MODAL_NAMES.ADD_EDIT_PLAN_ITEM);
  }, [openModal, MODAL_NAMES, setEditingPlanItem, setPlanItemFormState]);

  const handleSaveExperiencePlanItem = useCallback(
    async (formData) => {
      const currentEditingPlanItem = formData;

      const isAdd = planItemFormState === 1;
      const prevExperience = experience ? { ...experience, plan_items: [...(experience.plan_items || [])] } : null;
      const tempId = `temp-${Date.now()}`;

      const apply = () => {
        if (!prevExperience) return;
        const updated = { ...prevExperience, plan_items: [...prevExperience.plan_items] };
        if (isAdd) {
          updated.plan_items.push({
            _id: tempId,
            text: currentEditingPlanItem.text,
            url: currentEditingPlanItem.url || "",
            cost_estimate: currentEditingPlanItem.cost || 0,
            planning_days: currentEditingPlanItem.planning_days || 0,
            parent: currentEditingPlanItem.parent || null,
            activity_type: currentEditingPlanItem.activity_type || null,
            location: currentEditingPlanItem.location || null,
          });
        } else {
          const idx = findIndexById(updated.plan_items, currentEditingPlanItem._id);
          if (idx >= 0) {
            updated.plan_items[idx] = {
              ...updated.plan_items[idx],
              text: currentEditingPlanItem.text,
              url: currentEditingPlanItem.url || "",
              cost_estimate: currentEditingPlanItem.cost || 0,
              planning_days: currentEditingPlanItem.planning_days || 0,
              parent: currentEditingPlanItem.parent || null,
              activity_type: currentEditingPlanItem.activity_type || null,
              location: currentEditingPlanItem.location || null,
            };
          }
        }
        setExperience(updated);
        closeModal();
        setEditingPlanItem({});
      };

      const apiCall = async () => {
        if (isAdd) {
          await addExperiencePlanItem(experience._id, {
            text: currentEditingPlanItem.text,
            url: currentEditingPlanItem.url,
            cost_estimate: currentEditingPlanItem.cost || 0,
            planning_days: currentEditingPlanItem.planning_days || 0,
            parent: currentEditingPlanItem.parent || null,
            activity_type: currentEditingPlanItem.activity_type || null,
            location: currentEditingPlanItem.location || null,
          });
        } else {
          await updateExperiencePlanItem(experience._id, {
            _id: currentEditingPlanItem._id,
            text: currentEditingPlanItem.text,
            url: currentEditingPlanItem.url,
            cost_estimate: currentEditingPlanItem.cost || 0,
            planning_days: currentEditingPlanItem.planning_days || 0,
            parent: currentEditingPlanItem.parent || null,
            activity_type: currentEditingPlanItem.activity_type || null,
            location: currentEditingPlanItem.location || null,
          });
        }
      };

      const rollback = () => {
        if (prevExperience) setExperience(prevExperience);
        openModal(MODAL_NAMES.ADD_EDIT_PLAN_ITEM);
        setEditingPlanItem(isAdd ? (currentEditingPlanItem || {}) : currentEditingPlanItem);
      };

      const onSuccess = async () => {
        fetchAllData().catch(() => {});
      };

      const onError = (err, defaultMsg) => {
        const errorMsg = handleError(err, { context: isAdd ? "Add experience plan item" : "Update experience plan item" }) || defaultMsg;
        showError(errorMsg);
      };

      const run = useOptimisticAction({ apply, apiCall, rollback, onSuccess, onError, context: isAdd ? 'Add experience plan item' : 'Update experience plan item' });
      await run();
    },
    [
      experience,
      planItemFormState,
      fetchAllData,
      setExperience,
      closeModal,
      openModal,
      MODAL_NAMES,
      setEditingPlanItem,
      showError,
    ]
  );

  // -------------------------------------------------------------------------
  // Experience template item: delete (with undo)
  // -------------------------------------------------------------------------

  const handlePlanDelete = useCallback(
    async (planItemId) => {
      if (!experience || !planItemId) return;
      const prevExperience = { ...experience, plan_items: [...(experience.plan_items || [])] };

      const updated = { ...prevExperience, plan_items: filterOutById(prevExperience.plan_items, planItemId) };
      setExperience(updated);
      closeModal();

      undoable(lang.current.notification?.plan?.itemDeletedUndo || 'Item removed. Tap Undo to restore it.', {
        onUndo: () => {
          setExperience(prevExperience);
        },
        onExpire: async () => {
          try {
            await deletePlanItem(experience._id, planItemId);
            fetchAllData().catch(() => {});
            fetchExperiences().catch(() => {});
          } catch (err) {
            setExperience(prevExperience);
            const errorMsg = handleError(err, { context: "Delete plan item" }) || 'Failed to delete item. It has been restored.';
            showError(errorMsg);
          }
        },
      });
    },
    [experience, fetchExperiences, fetchAllData, undoable, showError, setExperience, closeModal]
  );

  // -------------------------------------------------------------------------
  // Plan item: toggle completion (with incomplete-children gate)
  // -------------------------------------------------------------------------

  const handlePlanItemToggleComplete = useCallback(
    async (planItem, { skipChildCheck = false } = {}) => {
      if (!selectedPlanId || !planItem) return;

      const itemId = normalizeId(planItem._id || planItem.plan_item_id);
      const prevComplete = !!planItem.complete;
      const newComplete = !prevComplete;

      if (newComplete && !skipChildCheck) {
        const currentPlanItems = selectedPlan?.plan || [];
        const parentKey = (planItem._id || planItem.plan_item_id)?.toString();

        const children = currentPlanItems.filter((item) => {
          const p = item.parent;
          if (!p) return false;
          const parentId = (typeof p === 'object' ? p._id || p : p)?.toString();
          return parentId === parentKey ||
            (planItem.plan_item_id && parentId === planItem.plan_item_id?.toString());
        });

        if (children.length > 0) {
          const incompleteChildren = children.filter((c) => !c.complete);
          if (incompleteChildren.length > 0) {
            setIncompleteChildrenDialogData({ parentItem: planItem, incompleteChildren });
            return;
          }
        }
      }

      beginUserInteraction('toggle-complete');

      const updateItemComplete = (plan, targetItemId, complete) => {
        if (!plan?.plan) return plan;
        const updatedPlan = plan.plan.map((item) =>
          idEquals(item._id, targetItemId) || idEquals(item.plan_item_id, targetItemId)
            ? { ...item, complete }
            : item
        );

        const totalItems = updatedPlan.length;
        const completedItems = updatedPlan.filter(item => item.complete).length;
        const completion_percentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

        return {
          ...plan,
          plan: updatedPlan,
          completion_percentage
        };
      };

      const apply = () => {
        setSharedPlans((plans) =>
          plans.map((p) =>
            idEquals(p._id, selectedPlanId)
              ? updateItemComplete(p, itemId, newComplete)
              : p
          )
        );

        if (userPlan && idEquals(userPlan._id, selectedPlanId)) {
          setUserPlan((prev) => updateItemComplete(prev, itemId, newComplete));
        }

        const sourcePlan = (userPlan && idEquals(userPlan._id, selectedPlanId))
          ? userPlan
          : sharedPlans.find(p => idEquals(p._id, selectedPlanId));
        if (sourcePlan) {
          const optimisticPlan = updateItemComplete(sourcePlan, itemId, newComplete);
          eventBus.emit('plan:updated', {
            plan: optimisticPlan,
            planId: selectedPlanId,
            data: optimisticPlan,
            _optimistic: true
          });
        }
      };

      const apiCall = async () => {
        await updatePlanItem(selectedPlanId, itemId, { complete: newComplete });
      };

      const rollback = () => {
        setSharedPlans((plans) =>
          plans.map((p) =>
            idEquals(p._id, selectedPlanId)
              ? updateItemComplete(p, itemId, prevComplete)
              : p
          )
        );

        if (userPlan && idEquals(userPlan._id, selectedPlanId)) {
          setUserPlan((prev) => updateItemComplete(prev, itemId, prevComplete));
        }

        setSelectedDetailsItem((prev) =>
          prev && (idEquals(prev._id, itemId) || idEquals(prev.plan_item_id, itemId))
            ? { ...prev, complete: prevComplete }
            : prev
        );
      };

      const onError = (err, defaultMsg) => {
        const errorMsg =
          handleError(err, { context: 'Toggle plan item completion' }) ||
          defaultMsg;
        showError(errorMsg);
      };

      const run = useOptimisticAction({
        apply,
        apiCall,
        rollback,
        onError,
        context: 'Toggle plan item completion'
      });

      try {
        await run();
      } finally {
        endUserInteraction('toggle-complete');
      }
    },
    [
      selectedPlanId,
      selectedPlan,
      setSharedPlans,
      sharedPlans,
      userPlan,
      setUserPlan,
      showError,
      beginUserInteraction,
      endUserInteraction,
      setSelectedDetailsItem,
      setIncompleteChildrenDialogData,
    ]
  );

  // -------------------------------------------------------------------------
  // Reorder: plan instance items
  // -------------------------------------------------------------------------

  const handleReorderPlanItems = useCallback(
    async (planId, reorderedItems, draggedItemId) => {
      if (!planId || !reorderedItems) {
        debug.warn('[Reorder] Missing planId or reorderedItems');
        return;
      }

      debug.log('[Reorder] Reordering plan items', {
        planId,
        itemCount: reorderedItems.length,
        draggedItemId
      });

      const prevPlans = [...sharedPlans];
      const planIndex = sharedPlans.findIndex((p) => idEquals(p._id, planId));
      const prevPlan = planIndex >= 0 ? { ...sharedPlans[planIndex] } : null;
      const prevUserPlan = userPlan && idEquals(userPlan._id, planId)
        ? { ...userPlan, plan: Array.isArray(userPlan.plan) ? [...userPlan.plan] : [] }
        : null;

      const apply = () => {
        if (prevPlan && planIndex >= 0) {
          const updatedPlans = [...sharedPlans];
          updatedPlans[planIndex] = { ...prevPlan, plan: reorderedItems };
          setSharedPlans(updatedPlans);
        }

        if (userPlan && idEquals(userPlan._id, planId)) {
          setUserPlan(prev => prev ? { ...prev, plan: reorderedItems } : prev);
        }
      };

      const apiCall = async () => {
        await reorderPlanItems(planId, reorderedItems);
      };

      const rollback = () => {
        setSharedPlans(prevPlans);
        if (prevUserPlan) {
          setUserPlan(prevUserPlan);
        }
      };

      const onSuccess = async () => {
        if (draggedItemId) {
          setTimeout(() => {
            const itemSelector = `[data-plan-item-id="${escapeSelector(draggedItemId)}"]`;
            const itemElement = document.querySelector(itemSelector);
            if (itemElement) {
              highlightPlanItem(itemElement);
            }
          }, 100);
        }

        fetchSharedPlans().catch(() => {});
        fetchUserPlan().catch(() => {});
        fetchPlans().catch(() => {});
        success(lang.current.notification?.plan?.reordered || 'Your plan order has been saved');
      };

      const onError = (err, defaultMsg) => {
        const errorMsg = handleError(err, { context: "Reorder plan items" }) || defaultMsg;
        showError(errorMsg);
      };

      const run = useOptimisticAction({
        apply,
        apiCall,
        rollback,
        onSuccess,
        onError,
        context: 'Reorder plan items'
      });
      await run();
    },
    [
      sharedPlans,
      userPlan,
      fetchSharedPlans,
      fetchUserPlan,
      fetchPlans,
      success,
      showError,
      setSharedPlans,
      setUserPlan,
    ]
  );

  // -------------------------------------------------------------------------
  // Reorder: experience template items
  // -------------------------------------------------------------------------

  const handleReorderExperiencePlanItems = useCallback(
    async (experienceIdArg, reorderedItems, draggedItemId) => {
      if (!experienceIdArg || !reorderedItems) {
        debug.warn('[ExperienceReorder] Missing experienceId or reorderedItems');
        return;
      }

      debug.log('[ExperienceReorder] Reordering experience plan items', {
        experienceId: experienceIdArg,
        itemCount: reorderedItems.length,
        draggedItemId
      });

      const prevExperience = { ...experience };

      const apply = () => {
        setExperience({ ...experience, plan_items: reorderedItems });
      };

      const apiCall = async () => {
        await reorderExperiencePlanItems(experienceIdArg, reorderedItems);
      };

      const rollback = () => {
        setExperience(prevExperience);
      };

      const onSuccess = async () => {
        if (draggedItemId) {
          setTimeout(() => {
            const itemSelector = `[data-plan-item-id="${escapeSelector(draggedItemId)}"]`;
            const itemElement = document.querySelector(itemSelector);
            if (itemElement) {
              highlightPlanItem(itemElement);
            }
          }, 100);
        }

        fetchAllData().catch(() => {});
        success(lang.current.notification?.plan?.reordered || 'Your plan order has been saved');
      };

      const onError = (err, defaultMsg) => {
        const errorMsg = handleError(err, { context: "Reorder experience plan items" }) || defaultMsg;
        showError(errorMsg);
      };

      const run = useOptimisticAction({
        apply,
        apiCall,
        rollback,
        onSuccess,
        onError,
        context: 'Reorder experience plan items'
      });
      await run();
    },
    [
      experience,
      fetchAllData,
      success,
      showError,
      setExperience,
    ]
  );

  return {
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
  };
}

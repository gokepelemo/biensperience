import { useState, useCallback } from 'react';
import useOptimisticAction from './useOptimisticAction';
import { handleError } from '../utilities/error-handler';
import {
  addPlanItemToInstance,
  updatePlanItem as updatePlanItemAPI,
  deletePlanItemFromInstance,
  addExperiencePlanItem,
  updateExperiencePlanItem
} from '../utilities/plans-api';
import { idEquals } from '../utilities/id-utils';

/**
 * Custom hook for managing plan item CRUD operations with optimistic UI
 *
 * @param {Object} options
 * @param {Object} options.plan - Current plan object
 * @param {Object} options.experience - Experience object
 * @param {Array} options.sharedPlans - Array of shared plans
 * @param {Function} options.setSharedPlans - Setter for shared plans
 * @param {Function} options.setExperience - Setter for experience
 * @param {Function} options.fetchSharedPlans - Fetch shared plans
 * @param {Function} options.fetchUserPlan - Fetch user plan
 * @param {Function} options.fetchPlans - Fetch global plans
 * @param {Function} options.fetchExperience - Fetch experience data
 * @param {Function} options.showError - Error display function
 * @param {string} options.mode - 'plan' or 'experience' mode
 */
export default function usePlanItemManager({
  plan,
  experience,
  sharedPlans,
  setSharedPlans,
  setExperience,
  fetchSharedPlans,
  fetchUserPlan,
  fetchPlans,
  fetchExperience,
  showError,
  mode = 'plan' // 'plan' or 'experience'
}) {
  const [showModal, setShowModal] = useState(false);
  const [formState, setFormState] = useState(1); // 1 = add, 0 = edit
  const [editingItem, setEditingItem] = useState({});
  const [deleteItem, setDeleteItem] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const selectedPlanId = plan?._id;

  /**
   * Open add item modal
   */
  const handleAddItem = useCallback((parentId = null) => {
    setEditingItem(parentId ? { parent: parentId } : {});
    setFormState(1); // Add mode
    setShowModal(true);
  }, []);

  /**
   * Open edit item modal (plan instance item)
   */
  const handleEditPlanItem = useCallback((planItem) => {
    setEditingItem({
      _id: planItem._id,
      plan_item_id: planItem.plan_item_id,
      text: planItem.text,
      url: planItem.url || "",
      cost: planItem.cost || 0,
      planning_days: planItem.planning_days || 0,
      activity_type: planItem.activity_type || null,
      parent: planItem.parent || null,
    });
    setFormState(0); // Edit mode
    setShowModal(true);
  }, []);

  /**
   * Open edit item modal (experience plan item)
   */
  const handleEditExperienceItem = useCallback((planItem) => {
    setEditingItem({
      _id: planItem._id,
      text: planItem.text,
      url: planItem.url || "",
      cost: planItem.cost_estimate || 0,
      planning_days: planItem.planning_days || 0,
      activity_type: planItem.activity_type || null,
      parent: planItem.parent || null,
    });
    setFormState(0); // Edit mode
    setShowModal(true);
  }, []);

  /**
   * Save plan instance item (add or edit)
   */
  const handleSavePlanItem = useCallback(
    async (e) => {
      e.preventDefault();
      if (!selectedPlanId) return;

      const prevPlans = [...sharedPlans];
      const planIndex = sharedPlans.findIndex((p) => idEquals(p._id, selectedPlanId));
      const prevPlan = planIndex >= 0 ? { ...sharedPlans[planIndex], plan: [...sharedPlans[planIndex].plan] } : null;

      const isAdd = formState === 1;
      const tempId = `temp-${Date.now()}`;

      const apply = () => {
        if (!prevPlan || planIndex < 0) return;
        const updatedPlans = [...sharedPlans];
        const updatedPlan = { ...prevPlan, plan: [...prevPlan.plan] };
        if (isAdd) {
          updatedPlan.plan.push({
            _id: tempId,
            plan_item_id: editingItem.plan_item_id || tempId,
            text: editingItem.text || "",
            url: editingItem.url || "",
            cost: editingItem.cost || 0,
            planning_days: editingItem.planning_days || 0,
              activity_type: editingItem.activity_type || null,
            parent: editingItem.parent || null,
            complete: false,
          });
        } else {
          const idx = updatedPlan.plan.findIndex((i) => i._id?.toString() === editingItem._id?.toString());
          if (idx >= 0) {
            updatedPlan.plan[idx] = {
              ...updatedPlan.plan[idx],
              text: editingItem.text || "",
              url: editingItem.url || "",
              cost: editingItem.cost || 0,
              planning_days: editingItem.planning_days || 0,
              activity_type: editingItem.activity_type || null,
              parent: editingItem.parent || null,
            };
          }
        }
        updatedPlans[planIndex] = updatedPlan;
        setSharedPlans(updatedPlans);
        setShowModal(false);
        setEditingItem({});
      };

      const apiCall = async () => {
        if (isAdd) {
          await addPlanItemToInstance(selectedPlanId, editingItem);
        } else {
          const { _id, plan_item_id, ...updates } = editingItem;
          await updatePlanItemAPI(selectedPlanId, _id, updates);
        }
      };

      const rollback = () => {
        setSharedPlans(prevPlans);
        setShowModal(true);
        setEditingItem(isAdd ? (editingItem || {}) : editingItem);
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
    [selectedPlanId, editingItem, formState, sharedPlans, fetchSharedPlans, fetchUserPlan, fetchPlans, showError, setSharedPlans]
  );

  /**
   * Save experience plan item (add or edit)
   */
  const handleSaveExperienceItem = useCallback(
    async (e) => {
      e.preventDefault();

      const isAdd = formState === 1;
      const prevExperience = experience ? { ...experience, plan_items: [...(experience.plan_items || [])] } : null;
      const tempId = `temp-${Date.now()}`;

      const apply = () => {
        if (!prevExperience) return;
        const updated = { ...prevExperience, plan_items: [...prevExperience.plan_items] };
        if (isAdd) {
          updated.plan_items.push({
            _id: tempId,
            text: editingItem.text,
            url: editingItem.url || "",
            cost_estimate: editingItem.cost || 0,
            planning_days: editingItem.planning_days || 0,
            activity_type: editingItem.activity_type || null,
            parent: editingItem.parent || null,
          });
        } else {
          const idx = updated.plan_items.findIndex((i) => i._id?.toString() === editingItem._id?.toString());
          if (idx >= 0) {
            updated.plan_items[idx] = {
              ...updated.plan_items[idx],
              text: editingItem.text,
              url: editingItem.url || "",
              cost_estimate: editingItem.cost || 0,
              planning_days: editingItem.planning_days || 0,
              activity_type: editingItem.activity_type || null,
              parent: editingItem.parent || null,
            };
          }
        }
        setExperience(updated);
        setShowModal(false);
        setEditingItem({});
      };

      const apiCall = async () => {
        if (isAdd) {
          await addExperiencePlanItem(experience._id, {
            text: editingItem.text,
            url: editingItem.url,
            cost_estimate: editingItem.cost || 0,
            planning_days: editingItem.planning_days || 0,
            activity_type: editingItem.activity_type || null,
            parent: editingItem.parent || null,
          });
        } else {
          await updateExperiencePlanItem(experience._id, {
            _id: editingItem._id,
            text: editingItem.text,
            url: editingItem.url,
            cost_estimate: editingItem.cost || 0,
            planning_days: editingItem.planning_days || 0,
            activity_type: editingItem.activity_type || null,
            parent: editingItem.parent || null,
          });
        }
      };

      const rollback = () => {
        if (prevExperience) setExperience(prevExperience);
        setShowModal(true);
        setEditingItem(isAdd ? (editingItem || {}) : editingItem);
      };

      const onSuccess = async () => {
        fetchExperience().catch(() => {});
      };

      const onError = (err, defaultMsg) => {
        const errorMsg = handleError(err, { context: isAdd ? "Add experience plan item" : "Update experience plan item" }) || defaultMsg;
        showError(errorMsg);
      };

      const run = useOptimisticAction({ apply, apiCall, rollback, onSuccess, onError, context: isAdd ? 'Add experience plan item' : 'Update experience plan item' });
      await run();
    },
    [experience, editingItem, formState, fetchExperience, setExperience, showError]
  );

  /**
   * Delete plan instance item
   */
  const handleDeletePlanItem = useCallback(async () => {
    if (!selectedPlanId || !deleteItem) return;

    const prevPlans = [...sharedPlans];
    const planIndex = sharedPlans.findIndex((p) => idEquals(p._id, selectedPlanId));
    const prevPlan = planIndex >= 0 ? { ...sharedPlans[planIndex], plan: [...sharedPlans[planIndex].plan] } : null;

    const apply = () => {
      if (!prevPlan || planIndex < 0) return;
      const updatedPlans = [...sharedPlans];
      const updatedPlan = { ...prevPlan, plan: prevPlan.plan.filter((i) => i._id?.toString() !== deleteItem._id?.toString()) };
      updatedPlans[planIndex] = updatedPlan;
      setSharedPlans(updatedPlans);
      setShowDeleteModal(false);
      setDeleteItem(null);
    };

    const apiCall = async () => {
      await deletePlanItemFromInstance(selectedPlanId, deleteItem._id);
    };

    const rollback = () => {
      setSharedPlans(prevPlans);
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
  }, [selectedPlanId, deleteItem, sharedPlans, fetchSharedPlans, fetchUserPlan, fetchPlans, showError, setSharedPlans]);

  /**
   * Open delete confirmation modal (plan item)
   */
  const confirmDeleteItem = useCallback((item) => {
    setDeleteItem(item);
    setShowDeleteModal(true);
  }, []);

  /**
   * Handle form input changes
   */
  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setEditingItem(prev => ({ ...prev, [name]: value }));
  }, []);

  /**
   * Handle numeric input changes
   */
  const handleNumericChange = useCallback((e) => {
    const { name, value } = e.target;
    setEditingItem(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
  }, []);

  /**
   * Close modal
   */
  const closeModal = useCallback(() => {
    setShowModal(false);
    setEditingItem({});
  }, []);

  /**
   * Close delete modal
   */
  const closeDeleteModal = useCallback(() => {
    setShowDeleteModal(false);
    setDeleteItem(null);
  }, []);

  return {
    // Modal state
    showModal,
    showDeleteModal,
    formState,
    editingItem,

    // Handlers
    handleAddItem,
    handleEditItem: mode === 'plan' ? handleEditPlanItem : handleEditExperienceItem,
    handleSaveItem: mode === 'plan' ? handleSavePlanItem : handleSaveExperienceItem,
    handleDeleteItem: handleDeletePlanItem,
    confirmDeleteItem,

    // Form handlers
    handleInputChange,
    handleNumericChange,

    // Modal control
    closeModal,
    closeDeleteModal
  };
}

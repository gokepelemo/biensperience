/**
 * useExperienceDetailsActions Hook
 *
 * Handlers fired from the PlanItemDetailsModal in SingleExperience:
 *   - assignPlanItem / unassignPlanItem (collaborator assignment)
 *   - updatePlanItem title
 *   - inline cost entry save
 *   - addPlanItemDetail (transit / hotel / discount, etc.)
 *
 * Extracted from SingleExperience.jsx — pure relocation of existing behavior.
 *
 * @module hooks/useExperienceDetailsActions
 */

import { useCallback } from 'react';
import { lang } from '../lang.constants';
import { logger } from '../utilities/logger';
import { idEquals } from '../utilities/id-utils';
import {
  updatePlanItem,
  assignPlanItem,
  unassignPlanItem,
  addPlanItemDetail,
} from '../utilities/plans-api';

export default function useExperienceDetailsActions({
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
}) {
  // -------------------------------------------------------------------------
  // Inline cost entry
  // -------------------------------------------------------------------------

  const handleSaveInlineCost = useCallback(async (costData) => {
    if (!selectedPlanId || !inlineCostPlanItem) return;

    setInlineCostLoading(true);
    try {
      const costWithPlanItem = {
        ...costData,
        plan_item: inlineCostPlanItem._id || inlineCostPlanItem.plan_item_id
      };
      await addCost(selectedPlanId, costWithPlanItem);

      closeModal();
      setInlineCostPlanItem(null);

      success(lang.current.notification?.cost?.added || 'Cost added successfully');
    } catch (error) {
      logger.error('Failed to add inline cost', { error: error.message });
      showError(error.message || lang.current.alert.failedToAddCost);
    } finally {
      setInlineCostLoading(false);
    }
  }, [selectedPlanId, inlineCostPlanItem, addCost, success, showError, closeModal, setInlineCostLoading, setInlineCostPlanItem]);

  // -------------------------------------------------------------------------
  // Add plan item detail (flight/train/hotel/discount/etc.)
  // -------------------------------------------------------------------------

  const handleAddDetail = useCallback(async (payload) => {
    const { type, planItemId, planId: payloadPlanId, data, document } = payload;
    const planIdToUse = payloadPlanId || selectedPlanId;

    if (!planIdToUse || !planItemId) {
      showError('Missing plan or item information');
      return;
    }

    logger.info('[SingleExperience] Adding plan item detail', { type, planItemId, planId: planIdToUse });

    try {
      if (type === 'cost') {
        const costData = {
          ...data,
          plan_item: planItemId
        };
        await addCost(planIdToUse, costData);
        success(lang.current.notification?.cost?.added || 'Cost added successfully');
        return;
      }

      const detailData = {
        type,
        data,
        document
      };

      const result = await addPlanItemDetail(planIdToUse, planItemId, detailData);
      const updatedPlan = result?.plan || result?.data || result;

      if (updatedPlan?._id) {
        setSharedPlans(prevPlans =>
          prevPlans.map(p => idEquals(p._id, planIdToUse) ? updatedPlan : p)
        );
      }

      if (selectedDetailsItem && idEquals(selectedDetailsItem._id, planItemId) && updatedPlan?.plan?.length) {
        const nextItem = updatedPlan.plan.find(i => idEquals(i._id, planItemId));
        if (nextItem) setSelectedDetailsItem(nextItem);
      }

      const typeLabels = {
        flight: 'Flight details',
        train: 'Train reservation',
        cruise: 'Cruise reservation',
        ferry: 'Ferry reservation',
        bus: 'Bus reservation',
        hotel: 'Hotel reservation',
        parking: 'Parking details',
        discount: 'Discount'
      };
      const label = typeLabels[type] || 'Detail';
      success(`${label} added successfully`);
    } catch (error) {
      logger.error('[SingleExperience] Failed to add plan item detail', {
        type,
        planItemId,
        error: error.message
      });
      showError(error.message || 'Failed to add detail');
      throw error;
    }
  }, [selectedPlanId, addCost, selectedDetailsItem, setSharedPlans, setSelectedDetailsItem, success, showError]);

  // -------------------------------------------------------------------------
  // Assign plan item to collaborator
  // -------------------------------------------------------------------------

  const handleAssign = useCallback(async (userId) => {
    if (!selectedPlan || !selectedDetailsItem) return;

    const assignee = allPlanCollaborators.find(c => (c._id || c.user?._id) === userId);
    const assigneeName = assignee?.name || assignee?.user?.name || 'Unknown User';

    const previousAssignedTo = selectedDetailsItem.assigned_to;

    try {
      const updatePlanItemAssignment = (plans, planId, itemId, newAssignedTo) => {
        return plans.map(plan => {
          if (plan._id === planId) {
            return {
              ...plan,
              plan: plan.plan.map(item => {
                if (item._id === itemId) {
                  return { ...item, assignedTo: newAssignedTo, assigned_to: newAssignedTo };
                }
                return item;
              })
            };
          }
          return plan;
        });
      };

      if (userPlan?._id === selectedPlan._id) {
        setUserPlan(prev => prev ? {
          ...prev,
          plan: prev.plan.map(item =>
            item._id === selectedDetailsItem._id
              ? { ...item, assignedTo: userId, assigned_to: userId }
              : item
          )
        } : prev);
      }

      setSharedPlans(prev => updatePlanItemAssignment(prev, selectedPlan._id, selectedDetailsItem._id, userId));
      setSelectedDetailsItem(prev => prev ? { ...prev, assignedTo: userId, assigned_to: userId } : prev);

      await assignPlanItem(selectedPlan._id, selectedDetailsItem._id, userId);

      const message = lang.current.notification?.collaborator?.assigned?.replace('{name}', assigneeName) || `${assigneeName} is now responsible for this item`;
      success(message, { duration: 3000 });
    } catch (error) {
      logger.error('Error assigning plan item', { error: error.message, userId });

      if (userPlan?._id === selectedPlan._id) {
        setUserPlan(prev => prev ? {
          ...prev,
          plan: prev.plan.map(item =>
            item._id === selectedDetailsItem._id
              ? { ...item, assignedTo: previousAssignedTo, assigned_to: previousAssignedTo }
              : item
          )
        } : prev);
      }

      setSharedPlans(prev => prev.map(plan => {
        if (plan._id === selectedPlan._id) {
          return {
            ...plan,
            plan: plan.plan.map(item => {
              if (item._id === selectedDetailsItem._id) {
                return { ...item, assignedTo: previousAssignedTo, assigned_to: previousAssignedTo };
              }
              return item;
            })
          };
        }
        return plan;
      }));

      setSelectedDetailsItem(prev => prev ? { ...prev, assignedTo: previousAssignedTo, assigned_to: previousAssignedTo } : prev);
      showError(error.message || 'Failed to assign plan item');
    }
  }, [selectedPlan, selectedDetailsItem, userPlan, setUserPlan, setSharedPlans, setSelectedDetailsItem, allPlanCollaborators, success, showError]);

  // -------------------------------------------------------------------------
  // Unassign plan item
  // -------------------------------------------------------------------------

  const handleUnassign = useCallback(async () => {
    if (!selectedPlan || !selectedDetailsItem) return;

    const previousAssignedTo = selectedDetailsItem.assigned_to;

    try {
      if (userPlan?._id === selectedPlan._id) {
        setUserPlan(prev => prev ? {
          ...prev,
          plan: prev.plan.map(item =>
            item._id === selectedDetailsItem._id
              ? { ...item, assignedTo: null, assigned_to: null }
              : item
          )
        } : prev);
      }

      setSharedPlans(prev => prev.map(plan => {
        if (plan._id === selectedPlan._id) {
          return {
            ...plan,
            plan: plan.plan.map(item => {
              if (item._id === selectedDetailsItem._id) {
                return { ...item, assignedTo: null, assigned_to: null };
              }
              return item;
            })
          };
        }
        return plan;
      }));

      setSelectedDetailsItem(prev => prev ? { ...prev, assignedTo: null, assigned_to: null } : prev);

      await unassignPlanItem(selectedPlan._id, selectedDetailsItem._id);

      success(lang.current.notification?.collaborator?.unassigned || 'This item is no longer assigned to anyone', { duration: 3000 });
    } catch (error) {
      logger.error('Error unassigning plan item', { error: error.message });

      if (userPlan?._id === selectedPlan._id) {
        setUserPlan(prev => prev ? {
          ...prev,
          plan: prev.plan.map(item =>
            item._id === selectedDetailsItem._id
              ? { ...item, assignedTo: previousAssignedTo, assigned_to: previousAssignedTo }
              : item
          )
        } : prev);
      }

      setSharedPlans(prev => prev.map(plan => {
        if (plan._id === selectedPlan._id) {
          return {
            ...plan,
            plan: plan.plan.map(item => {
              if (item._id === selectedDetailsItem._id) {
                return { ...item, assignedTo: previousAssignedTo, assigned_to: previousAssignedTo };
              }
              return item;
            })
          };
        }
        return plan;
      }));

      setSelectedDetailsItem(prev => prev ? { ...prev, assignedTo: previousAssignedTo, assigned_to: previousAssignedTo } : prev);
      showError(error.message || 'Failed to unassign plan item');
    }
  }, [selectedPlan, selectedDetailsItem, userPlan, setUserPlan, setSharedPlans, setSelectedDetailsItem, success, showError]);

  // -------------------------------------------------------------------------
  // Update plan item title
  // -------------------------------------------------------------------------

  const handleUpdateTitle = useCallback(async (newTitle) => {
    if (!selectedPlan || !selectedDetailsItem) return;

    const previousText = selectedDetailsItem.text;

    try {
      if (userPlan?._id === selectedPlan._id) {
        setUserPlan(prev => prev ? {
          ...prev,
          plan: prev.plan.map(item =>
            item._id === selectedDetailsItem._id
              ? { ...item, text: newTitle }
              : item
          )
        } : prev);
      }

      setSharedPlans(prev => prev.map(plan => {
        if (plan._id === selectedPlan._id) {
          return {
            ...plan,
            plan: plan.plan.map(item => {
              if (item._id === selectedDetailsItem._id) {
                return { ...item, text: newTitle };
              }
              return item;
            })
          };
        }
        return plan;
      }));

      setSelectedDetailsItem(prev => prev ? { ...prev, text: newTitle } : prev);

      await updatePlanItem(selectedPlan._id, selectedDetailsItem._id, { text: newTitle });

      success('Plan item title updated', { duration: 2000 });
    } catch (error) {
      logger.error('Error updating plan item title', { error: error.message });

      if (userPlan?._id === selectedPlan._id) {
        setUserPlan(prev => prev ? {
          ...prev,
          plan: prev.plan.map(item =>
            item._id === selectedDetailsItem._id
              ? { ...item, text: previousText }
              : item
          )
        } : prev);
      }

      setSharedPlans(prev => prev.map(plan => {
        if (plan._id === selectedPlan._id) {
          return {
            ...plan,
            plan: plan.plan.map(item => {
              if (item._id === selectedDetailsItem._id) {
                return { ...item, text: previousText };
              }
              return item;
            })
          };
        }
        return plan;
      }));

      setSelectedDetailsItem(prev => prev ? { ...prev, text: previousText } : prev);
      showError(error.message || 'Failed to update plan item title');
      throw error;
    }
  }, [selectedPlan, selectedDetailsItem, userPlan, setUserPlan, setSharedPlans, setSelectedDetailsItem, success, showError]);

  return {
    handleSaveInlineCost,
    handleAddDetail,
    handleAssign,
    handleUnassign,
    handleUpdateTitle,
  };
}

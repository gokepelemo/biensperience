/**
 * useExperiencePlanSelection Hook
 *
 * Plan selection helpers for SingleExperience:
 *   - handlePlanChange (sets selectedPlanId, syncs displayed date, writes hash)
 *   - Auto-select first plan when plans load (if no hash navigation)
 *   - handleViewPlanItemDetails (open details modal + write item-level hash)
 *   - handlePrevPlanItemDetails / handleNextPlanItemDetails (keyboard/swipe nav)
 *   - detailsNavIndex (memoized)
 *   - handleAddCostForItem (open inline cost entry modal for an item)
 *
 * Extracted from SingleExperience.jsx — pure relocation.
 *
 * @module hooks/useExperiencePlanSelection
 */

import { useCallback, useEffect, useMemo } from 'react';
import debug from '../utilities/debug';
import { idEquals, normalizeId } from '../utilities/id-utils';

export default function useExperiencePlanSelection({
  // Plan state
  user,
  userPlan,
  sharedPlans,
  selectedPlanId,
  setSelectedPlanId,
  selectedPlan,
  allAccessiblePlans,
  setDisplayedPlannedDate,
  // Loading + intent
  plansLoading,
  intent,
  // Hash writer
  writeExperienceHash,
  // Modal management
  openModal,
  MODAL_NAMES,
  // Details modal state
  selectedDetailsItem,
  setSelectedDetailsItem,
  setDetailsModalInitialTab,
  // User interaction tracking (for prev/next)
  beginUserInteraction,
  endUserInteraction,
  // Inline cost
  setInlineCostPlanItem,
}) {
  // Plan select / change handler
  const handlePlanChange = useCallback(
    (planId, options = {}) => {
      const { writeHash = true, reason = 'select-plan' } = options;

      const pid = planId && planId.toString ? planId.toString() : planId;
      setSelectedPlanId(pid);

      const nextSelectedPlan = allAccessiblePlans.find((p) => idEquals(p._id, pid));
      if (nextSelectedPlan) {
        setDisplayedPlannedDate(nextSelectedPlan.planned_date || null);
      }

      if (writeHash && pid) {
        writeExperienceHash({ planId: pid, stripItem: true, reason });
      }
    },
    [allAccessiblePlans, writeExperienceHash, setSelectedPlanId, setDisplayedPlannedDate]
  );

  // Auto-select first plan when plans load (if no hash navigation)
  useEffect(() => {
    const hasPendingIntent = intent && !intent.consumed;
    if (!plansLoading && (userPlan || sharedPlans.length > 0) && !selectedPlanId && !hasPendingIntent) {
      const hash = window.location.hash || '';
      if (hash.startsWith('#plan-')) {
        debug.log('[Auto-select] Hash present in URL, skipping auto-select');
        return;
      }

      const firstPlan = userPlan || sharedPlans[0];
      if (!firstPlan) return;
      const firstPlanId =
        firstPlan._id && firstPlan._id.toString ? firstPlan._id.toString() : firstPlan._id;

      debug.log('[Auto-select] Auto-selecting first plan (staying on Experience tab):', {
        planId: firstPlanId,
        isOwnPlan: idEquals(firstPlan.user?._id || firstPlan.user, user._id),
      });

      setSelectedPlanId(firstPlanId);
      handlePlanChange(firstPlanId, { writeHash: false, reason: 'auto-select-first-plan' });
    }
  }, [plansLoading, sharedPlans, userPlan, selectedPlanId, intent, user._id, handlePlanChange, setSelectedPlanId]);

  // Handler to view plan item details — updates URL hash and opens modal
  const handleViewPlanItemDetails = useCallback((planItem, initialTab = 'notes') => {
    setSelectedDetailsItem(planItem);
    setDetailsModalInitialTab(initialTab);
    openModal(MODAL_NAMES.PLAN_ITEM_DETAILS);

    if (selectedPlanId && (planItem?._id || planItem?.plan_item_id)) {
      const itemId = normalizeId(planItem._id || planItem.plan_item_id);
      writeExperienceHash({
        planId: selectedPlanId,
        itemId,
        reason: 'open-plan-item-details',
      });
    }
  }, [selectedPlanId, openModal, MODAL_NAMES, writeExperienceHash, setSelectedDetailsItem, setDetailsModalInitialTab]);

  // Navigate to the previous plan item in the Details modal (keyboard ← / swipe right)
  const handlePrevPlanItemDetails = useCallback(() => {
    const items = selectedPlan?.plan;
    if (!items || !selectedDetailsItem) return;
    const idx = items.findIndex(item => idEquals(item._id, selectedDetailsItem._id));
    if (idx > 0) {
      beginUserInteraction('plan-item-nav');
      setSelectedDetailsItem(items[idx - 1]);
      setDetailsModalInitialTab('notes');
      requestAnimationFrame(() => endUserInteraction('plan-item-nav'));
    }
  }, [selectedPlan, selectedDetailsItem, beginUserInteraction, endUserInteraction, setSelectedDetailsItem, setDetailsModalInitialTab]);

  // Navigate to the next plan item in the Details modal
  const handleNextPlanItemDetails = useCallback(() => {
    const items = selectedPlan?.plan;
    if (!items || !selectedDetailsItem) return;
    const idx = items.findIndex(item => idEquals(item._id, selectedDetailsItem._id));
    if (idx >= 0 && idx < items.length - 1) {
      beginUserInteraction('plan-item-nav');
      setSelectedDetailsItem(items[idx + 1]);
      setDetailsModalInitialTab('notes');
      requestAnimationFrame(() => endUserInteraction('plan-item-nav'));
    }
  }, [selectedPlan, selectedDetailsItem, beginUserInteraction, endUserInteraction, setSelectedDetailsItem, setDetailsModalInitialTab]);

  const detailsNavIndex = useMemo(() => {
    const items = selectedPlan?.plan;
    if (!items || !selectedDetailsItem) return -1;
    return items.findIndex(item => idEquals(item._id, selectedDetailsItem._id));
  }, [selectedPlan?.plan, selectedDetailsItem]);

  // Handler to open inline cost entry from plan item details modal
  const handleAddCostForItem = useCallback((planItem) => {
    setInlineCostPlanItem(planItem);
    openModal(MODAL_NAMES.INLINE_COST_ENTRY);
  }, [openModal, MODAL_NAMES, setInlineCostPlanItem]);

  return {
    handlePlanChange,
    handleViewPlanItemDetails,
    handlePrevPlanItemDetails,
    handleNextPlanItemDetails,
    detailsNavIndex,
    handleAddCostForItem,
  };
}

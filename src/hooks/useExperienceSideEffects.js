/**
 * useExperienceSideEffects Hook
 *
 * Bundles assorted small side-effects for the SingleExperience view:
 *   - BienBot plan:item:added subscription (drives tab switch + fade-in animation)
 *   - bien:request_access intent handler (opens RequestPlanAccessModal)
 *   - Smooth loading transition for the experience tab
 *   - h1 registration for the navbar
 *   - Presence tab sync
 *   - Stale experience-owner refresh on user:updated
 *
 * Extracted from SingleExperience.jsx — pure relocation of existing behavior.
 *
 * @module hooks/useExperienceSideEffects
 */

import { useEffect, useState } from 'react';
import { logger } from '../utilities/logger';
import { eventBus, subscribeToEvent } from '../utilities/event-bus';

const NEW_ITEM_ANIMATION_MS = 2500;

export default function useExperienceSideEffects({
  // Plan item added animation
  userPlan,
  selectedPlanId,
  setActiveTab,
  setBienbotNewItemIds,
  // Request access intent
  openModal,
  MODAL_NAMES,
  setRequestAccessPlanId,
  // Smooth loading
  experience,
  setExperienceTabLoading,
  // h1 register
  h1Ref,
  registerH1,
  updateShowH1InNavbar,
  // Presence
  setPresenceTab,
  activeTab,
  // Stale owner refresh
  experienceOwnerId,
  refetchExperienceOwner,
}) {
  const [experienceOwnerStale, setExperienceOwnerStale] = useState(false);

  // Subscribe to plan:item:added at this level (always mounted) so BienBot-added items
  // can trigger a tab switch and animation even when MyPlanTabContent is not yet open.
  useEffect(() => {
    const handleItemAdded = (event) => {
      const planId = event.planId;
      const itemId = event.itemId || event.planItemId;
      if (!itemId || !planId) return;

      const currentPlanId = userPlan?._id?.toString ? userPlan._id.toString() : String(userPlan?._id || '');
      const selPlanId = selectedPlanId?.toString ? selectedPlanId.toString() : String(selectedPlanId || '');
      const eventPlanId = planId?.toString ? planId.toString() : String(planId);
      if (eventPlanId !== currentPlanId && eventPlanId !== selPlanId) return;

      setActiveTab('myplan');

      setBienbotNewItemIds((prev) => { const next = new Set(prev); next.add(itemId); return next; });
      setTimeout(() => {
        setBienbotNewItemIds((prev) => { const next = new Set(prev); next.delete(itemId); return next; });
      }, NEW_ITEM_ANIMATION_MS);
    };

    const unsub = eventBus.subscribe('plan:item:added', handleItemAdded);
    return () => unsub();
  }, [userPlan?._id, selectedPlanId, setActiveTab, setBienbotNewItemIds]);

  // Handle structured error action intent: request access to a plan.
  useEffect(() => {
    const unsubscribe = subscribeToEvent('bien:request_access', (event) => {
      const resourceType = event?.resourceType || null;
      const resourceId = event?.resourceId || null;

      if (resourceType && resourceType !== 'plan') return;
      if (!resourceId) {
        logger.warn('[SingleExperience] Request access intent missing resourceId', { event });
        return;
      }

      setRequestAccessPlanId(resourceId);
      openModal(MODAL_NAMES.REQUEST_PLAN_ACCESS);
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [openModal, MODAL_NAMES, setRequestAccessPlanId]);

  // Smooth loading transition for experience tab
  useEffect(() => {
    if (experience && experience.plan_items) {
      const timer = requestAnimationFrame(() => {
        setExperienceTabLoading(false);
      });
      return () => cancelAnimationFrame(timer);
    }
  }, [experience?.plan_items, setExperienceTabLoading]);

  // Register h1 for navbar
  useEffect(() => {
    if (h1Ref.current) {
      registerH1(h1Ref.current);
      updateShowH1InNavbar(true);
    }

    return () => {
      updateShowH1InNavbar(false);
    };
  }, [registerH1, updateShowH1InNavbar, experience, h1Ref]);

  // Sync tab changes to presence system
  useEffect(() => {
    if (setPresenceTab) {
      const presenceTabName = activeTab === 'myplan' ? 'my-plan' : 'the-plan';
      setPresenceTab(presenceTabName);
    }
  }, [activeTab, setPresenceTab]);

  // Subscribe to user updates to mark related data as stale (lazy refresh pattern)
  useEffect(() => {
    if (!experienceOwnerId) return;

    const handleUserUpdated = (event) => {
      const updatedUser = event.user;
      if (updatedUser && updatedUser._id === experienceOwnerId) {
        logger.debug('[SingleExperience] Experience owner updated, marking owner data as stale', {
          userId: updatedUser._id,
        });
        setExperienceOwnerStale(true);
      }
    };

    const unsubscribe = eventBus.subscribe('user:updated', handleUserUpdated);
    return () => unsubscribe();
  }, [experienceOwnerId]);

  // Refresh stale collaborator data when component re-renders (lazy refresh pattern)
  useEffect(() => {
    if (experienceOwnerStale && refetchExperienceOwner) {
      logger.debug('[SingleExperience] Refreshing stale experience owner data');
      refetchExperienceOwner();
      setExperienceOwnerStale(false);
    }
  }, [experienceOwnerStale, refetchExperienceOwner, experience]);
}

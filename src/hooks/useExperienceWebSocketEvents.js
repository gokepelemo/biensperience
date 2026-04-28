/**
 * useExperienceWebSocketEvents Hook
 *
 * Subscribes to WebSocket and event-bus events for the SingleExperience view:
 *   - plan:collaborator:added/removed
 *   - plan:created/deleted
 *   - experience:updated (refresh permissions/photos in real time)
 *   - experience:item:added/updated/deleted (drives sync banner)
 *   - plan:item:updated/completed/uncompleted (modal sync)
 *
 * Extracted from SingleExperience.jsx — pure relocation of existing behavior.
 *
 * @module hooks/useExperienceWebSocketEvents
 */

import { useEffect } from 'react';
import { logger } from '../utilities/logger';
import { idEquals } from '../utilities/id-utils';
import { eventBus, subscribeToEvent } from '../utilities/event-bus';
import { WS_EVENTS } from './useWebSocketEvents';

export default function useExperienceWebSocketEvents({
  subscribeToEvents,
  experienceId,
  fetchSharedPlans,
  fetchAllData,
  setExperience,
  isModalOpen,
  MODAL_NAMES,
  selectedDetailsItem,
  setSelectedDetailsItem,
}) {
  // Subscribe to WebSocket events for real-time shared plan updates
  useEffect(() => {
    if (!subscribeToEvents || !experienceId) return;

    const sessionId = eventBus.getSessionId();

    const toIdString = (val) => {
      if (!val) return null;
      try {
        return typeof val === 'string' ? val : val.toString();
      } catch (_) {
        return String(val);
      }
    };

    const getEventExperienceId = (event) => {
      return (
        event.experienceId ||
        event.experience?._id ||
        event.detail?.experienceId ||
        event.detail?.experience?._id ||
        event.payload?.experienceId ||
        event.payload?.experience?._id
      );
    };

    const applyExperiencePlanItemEvent = (event) => {
      // Skip events from this session (already handled locally)
      if (event.sessionId === sessionId) return;

      const eventExpId = toIdString(getEventExperienceId(event));
      if (!eventExpId || eventExpId !== toIdString(experienceId)) return;

      setExperience((prev) => {
        if (!prev) return prev;
        if (toIdString(prev._id) !== eventExpId) return prev;

        const prevItems = Array.isArray(prev.plan_items) ? prev.plan_items : [];
        const planItem = event.planItem || event.payload?.planItem || event.detail?.planItem;
        const planItemId = toIdString(event.planItemId || planItem?._id || event.payload?.planItemId || event.detail?.planItemId);

        if (!planItem && !planItemId) return prev;

        if (event.type === 'experience:item:added' && planItem) {
          const addedId = toIdString(planItem._id);
          if (!addedId) return prev;
          const exists = prevItems.some((it) => toIdString(it._id) === addedId);
          if (exists) return prev;
          return { ...prev, plan_items: [...prevItems, planItem] };
        }

        if (event.type === 'experience:item:updated' && planItem) {
          const updatedId = toIdString(planItem._id) || planItemId;
          if (!updatedId) return prev;
          let found = false;
          const nextItems = prevItems.map((it) => {
            if (toIdString(it._id) !== updatedId) return it;
            found = true;
            return { ...it, ...planItem };
          });
          if (!found) {
            return { ...prev, plan_items: [...prevItems, planItem] };
          }
          return { ...prev, plan_items: nextItems };
        }

        if (event.type === 'experience:item:deleted' && planItemId) {
          const idsToRemove = new Set([planItemId]);
          let changed = true;
          while (changed) {
            changed = false;
            for (const it of prevItems) {
              const parentId = toIdString(it.parent);
              const itId = toIdString(it._id);
              if (itId && parentId && idsToRemove.has(parentId) && !idsToRemove.has(itId)) {
                idsToRemove.add(itId);
                changed = true;
              }
            }
          }
          const nextItems = prevItems.filter((it) => !idsToRemove.has(toIdString(it._id)));
          if (nextItems.length === prevItems.length) return prev;
          return { ...prev, plan_items: nextItems };
        }

        return prev;
      });
    };

    // Handler for plan collaborator events
    const handleCollaboratorEvent = (event) => {
      if (event.sessionId === sessionId) return;
      if (event.experienceId !== experienceId) return;

      logger.debug('[SingleExperience] Collaborator event received, refreshing shared plans', {
        action: event.action,
        planId: event.planId
      });
      fetchSharedPlans();
    };

    // Handler for plan creation/deletion (new plans become shared plans)
    const handlePlanEvent = (event) => {
      if (event.sessionId === sessionId) return;
      const eventExpId = event.experienceId || event.data?.experience;
      if (eventExpId !== experienceId) return;

      logger.debug('[SingleExperience] Plan event received, refreshing shared plans', {
        type: event.type,
        planId: event.planId
      });
      fetchSharedPlans();
    };

    // Handler for experience updates (collaborators changed, photos, etc.)
    const handleExperienceUpdated = (event) => {
      if (event.sessionId === sessionId) return;

      const eventExpId = event.experienceId || event.experience?._id ||
                         event.detail?.experienceId || event.detail?.experience?._id ||
                         event.payload?.experienceId || event.payload?.experience?._id;

      if (eventExpId !== experienceId) return;

      logger.debug('[SingleExperience] Experience updated event received, refreshing data', {
        experienceId: eventExpId,
        updatedFields: event.updatedFields || event.payload?.updatedFields
      });

      fetchAllData();
    };

    const unsubCollaboratorAdded = subscribeToEvents('plan:collaborator:added', handleCollaboratorEvent);
    const unsubCollaboratorRemoved = subscribeToEvents('plan:collaborator:removed', handleCollaboratorEvent);
    const unsubPlanCreated = subscribeToEvents(WS_EVENTS.PLAN_CREATED, handlePlanEvent);
    const unsubPlanDeleted = subscribeToEvents(WS_EVENTS.PLAN_DELETED, handlePlanEvent);
    const unsubExperienceUpdated = subscribeToEvents(WS_EVENTS.EXPERIENCE_UPDATED, handleExperienceUpdated);

    const unsubExperienceItemAdded = subscribeToEvents('experience:item:added', applyExperiencePlanItemEvent);
    const unsubExperienceItemUpdated = subscribeToEvents('experience:item:updated', applyExperiencePlanItemEvent);
    const unsubExperienceItemDeleted = subscribeToEvents('experience:item:deleted', applyExperiencePlanItemEvent);

    return () => {
      unsubCollaboratorAdded();
      unsubCollaboratorRemoved();
      unsubPlanCreated();
      unsubPlanDeleted();
      unsubExperienceUpdated();
      unsubExperienceItemAdded();
      unsubExperienceItemUpdated();
      unsubExperienceItemDeleted();
    };
  }, [subscribeToEvents, experienceId, fetchSharedPlans, fetchAllData, setExperience]);

  // Subscribe to local event bus for plan item updates (photos, completion, etc.)
  // Plan state reconciliation is owned by usePlanManagement via `plan:updated`.
  // We only listen here to keep the Plan Item Details modal in sync while it's open.
  useEffect(() => {
    const handlePlanItemEvent = (event) => {
      const planId = event?.planId;
      const planItemId = event?.planItemId || event?.itemId;
      const planItem = event?.planItem || event?.item;

      if (!planId || !planItemId || !planItem) return;
      if (!isModalOpen(MODAL_NAMES.PLAN_ITEM_DETAILS)) return;
      if (!selectedDetailsItem || !idEquals(selectedDetailsItem._id, planItemId)) return;

      logger.debug('[SingleExperience] Plan item event received (modal sync)', {
        planId,
        planItemId,
        action: event?.action,
        hasPhotos: planItem?.photos?.length > 0
      });

      setSelectedDetailsItem((prev) => {
        if (!prev || !idEquals(prev._id, planItemId)) return prev;
        return {
          ...prev,
          ...planItem
        };
      });
    };

    const unsubscribes = [
      subscribeToEvent('plan:item:updated', handlePlanItemEvent),
      subscribeToEvent('plan:item:completed', handlePlanItemEvent),
      subscribeToEvent('plan:item:uncompleted', handlePlanItemEvent)
    ];

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [isModalOpen, selectedDetailsItem, setSelectedDetailsItem, MODAL_NAMES]);
}

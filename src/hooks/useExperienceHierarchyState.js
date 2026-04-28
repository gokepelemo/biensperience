/**
 * useExperienceHierarchyState Hook
 *
 * Manages plan-item hierarchy expansion state with encrypted persistence.
 * Storage keys: `hierarchy.experience.{experienceId}` and `hierarchy.plan.{planId}`.
 *
 * Extracted from SingleExperience.jsx — pure relocation of existing behavior.
 *
 * @module hooks/useExperienceHierarchyState
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '../utilities/logger';
import { storePreference, retrievePreference } from '../utilities/preferences-utils';

export default function useExperienceHierarchyState({
  user,
  experience,
  selectedPlanId,
  currentPlan,
  activeTab,
}) {
  const [expandedParents, setExpandedParents] = useState(new Set());
  const [animatingCollapse, setAnimatingCollapse] = useState(null);
  const [hierarchyLoaded, setHierarchyLoaded] = useState(false);

  // Keep a ref to the current animatingCollapse value so callbacks don't need to
  // re-create (memoized list items can otherwise capture a stale handler).
  const animatingCollapseRef = useRef(animatingCollapse);
  useEffect(() => {
    animatingCollapseRef.current = animatingCollapse;
  }, [animatingCollapse]);

  /**
   * Get a canonical expansion key for a plan item.
   */
  const getExpansionKey = useCallback((item) => {
    if (!item) return null;
    return (item.plan_item_id || item._id)?.toString() || null;
  }, []);

  /**
   * Check if an item is expanded.
   */
  const isItemExpanded = useCallback((item) => {
    const key = getExpansionKey(item);
    if (!key) return true;
    if (animatingCollapse === key) return false;
    return expandedParents.has(key);
  }, [expandedParents, getExpansionKey, animatingCollapse]);

  /**
   * Toggle expansion state for a plan item.
   */
  const toggleExpanded = useCallback((item) => {
    const key = getExpansionKey(item);
    if (!key) return;

    if (animatingCollapseRef.current === key) return;

    const persistState = async (newSet) => {
      try {
        if (!user?._id) return;

        let storageKey;
        if (activeTab === 'experience' && experience?._id) {
          storageKey = `hierarchy.experience.${experience._id}`;
        } else if (activeTab === 'myplan' && selectedPlanId) {
          storageKey = `hierarchy.plan.${selectedPlanId}`;
        }

        if (storageKey) {
          await storePreference(storageKey, Array.from(newSet), { userId: user._id });
        }
      } catch (error) {
        logger.error('Failed to persist hierarchy state', error);
      }
    };

    setExpandedParents((prev) => {
      const isCurrentlyExpanded = prev.has(key);

      if (isCurrentlyExpanded) {
        setAnimatingCollapse(key);

        setTimeout(() => {
          setExpandedParents((currentSet) => {
            const newSet = new Set(currentSet);
            newSet.delete(key);
            persistState(newSet);
            return newSet;
          });
          setAnimatingCollapse(null);
        }, 300);

        return prev;
      } else {
        const newSet = new Set(prev);
        newSet.add(key);
        persistState(newSet);
        return newSet;
      }
    });
  }, [getExpansionKey, user?._id, activeTab, experience?._id, selectedPlanId]);

  /**
   * Load persisted hierarchy state from encrypted storage.
   */
  useEffect(() => {
    if (!user?._id) return;

    let isMounted = true;

    async function loadHierarchyState() {
      try {
        let storageKey;
        let defaultExpandedIds = [];

        if (activeTab === 'experience' && experience?._id && experience?.plan_items) {
          storageKey = `hierarchy.experience.${experience._id}`;
          defaultExpandedIds = experience.plan_items
            .filter((item) => !item.parent)
            .map((item) => getExpansionKey(item))
            .filter(Boolean);
        } else if (activeTab === 'myplan' && selectedPlanId && currentPlan?.plan) {
          storageKey = `hierarchy.plan.${selectedPlanId}`;
          defaultExpandedIds = currentPlan.plan
            .filter((item) => !item.parent)
            .map((item) => getExpansionKey(item))
            .filter(Boolean);
        }

        if (storageKey) {
          const persistedIds = await retrievePreference(storageKey, defaultExpandedIds, { userId: user._id });

          if (isMounted) {
            setExpandedParents(new Set(persistedIds));
            setHierarchyLoaded(true);
          }
        }
      } catch (error) {
        logger.error('Failed to load hierarchy state', error);
        if (isMounted) {
          const defaultKeys = activeTab === 'experience' && experience?.plan_items
            ? experience.plan_items.filter((item) => !item.parent).map((item) => getExpansionKey(item)).filter(Boolean)
            : currentPlan?.plan?.filter((item) => !item.parent).map((item) => getExpansionKey(item)).filter(Boolean) || [];
          setExpandedParents(new Set(defaultKeys));
          setHierarchyLoaded(true);
        }
      }
    }

    loadHierarchyState();

    return () => {
      isMounted = false;
    };
  }, [activeTab, experience?._id, experience?.plan_items, selectedPlanId, currentPlan?.plan, user?._id, getExpansionKey]);

  return {
    expandedParents,
    setExpandedParents,
    animatingCollapse,
    setAnimatingCollapse,
    hierarchyLoaded,
    setHierarchyLoaded,
    getExpansionKey,
    isItemExpanded,
    toggleExpanded,
  };
}

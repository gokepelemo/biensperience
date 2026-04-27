/**
 * useExperienceHashRouting Hook
 *
 * Consolidates hash-based deep-link routing logic for the SingleExperience view.
 * Manages:
 *   - writeExperienceHash() — central URL hash writer (replaceState only)
 *   - tab/plan → URL sync effect
 *   - plan/item hash repair effect
 *   - navigation intent consumer
 *   - fallback hash handler for direct URL navigation
 *
 * Hash formats:
 *   #plan-{planId}
 *   #plan-{planId}-item-{itemId}
 *
 * Extracted from SingleExperience.jsx — pure relocation of existing behavior.
 *
 * @module hooks/useExperienceHashRouting
 */

import { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import debug from '../utilities/debug';
import { logger } from '../utilities/logger';
import { STORAGE_KEYS, LEGACY_STORAGE_KEYS } from '../utilities/storage-keys';
import { idEquals, normalizeId, findById } from '../utilities/id-utils';
import { getPlanPreview, getPlanById } from '../utilities/plans-api';

export default function useExperienceHashRouting({
  // identifiers
  experienceId,
  // tab + plan state
  activeTab,
  setActiveTab,
  selectedPlanId,
  setSelectedPlanId,
  plansLoading,
  allAccessiblePlans,
  userPlan,
  setUserPlan,
  // user interaction tracking refs
  userInteractionRef,
  isUnmountingRef,
  // intent
  intent,
  consumeIntent,
  clearIntent,
  // scroll/highlight
  scrollToItem,
  // modal
  openModal,
  isModalOpen,
  MODAL_NAMES,
  // details modal state
  selectedDetailsItem,
  setSelectedDetailsItem,
  setDetailsModalInitialTab,
  detailsModalOpen,
  // access denied state
  setAccessDeniedPlanId,
  setAccessRequestSent,
}) {
  const location = useLocation();
  const processedHashRef = useRef(null);
  const initialHashHandledRef = useRef(false);

  // Centralized URL hash writer.
  const writeExperienceHash = useCallback(
    ({ planId, itemId, stripItem = false, clearHash = false, reason = 'unknown' }) => {
      if (typeof window === 'undefined') return;
      if (!window.history?.replaceState) return;

      // CRITICAL: Skip URL updates entirely during user interactions (e.g., toggling completion)
      if (userInteractionRef.current) {
        debug.log('[URL Management] Skipping due to user interaction in progress', { reason });
        return;
      }

      // Prevent navigation if component is unmounting
      if (isUnmountingRef.current) return;

      // Only update URL if we're still on the SingleExperience route.
      if (!experienceId) return;
      const expectedPath = `/experiences/${experienceId}`;
      const pathnameNow = window.location.pathname || '';
      const pathnameNoSlash = pathnameNow.endsWith('/') && pathnameNow.length > 1
        ? pathnameNow.slice(0, -1)
        : pathnameNow;
      if (!pathnameNoSlash.endsWith(expectedPath)) return;

      const currentHash = window.location.hash || '';
      let targetHash = currentHash;

      if (clearHash) {
        targetHash = '';
      } else if (planId) {
        const normalizedPlanId = normalizeId(planId);
        const expectedPlanPrefix = `#plan-${normalizedPlanId}`;

        if (itemId) {
          const normalizedItemId = normalizeId(itemId);
          targetHash = `${expectedPlanPrefix}-item-${normalizedItemId}`;
        } else {
          const hasItemHashForPlan =
            currentHash.startsWith(`${expectedPlanPrefix}-item-`) && currentHash.includes('-item-');
          if (hasItemHashForPlan && !stripItem) {
            targetHash = currentHash;
          } else {
            targetHash = expectedPlanPrefix;
          }
        }
      }

      const currentUrl = `${window.location.pathname}${window.location.hash || ''}`;
      const targetUrl = targetHash
        ? `${window.location.pathname}${targetHash}`
        : window.location.pathname;

      if (currentUrl === targetUrl) return;

      // Demo branch behavior: replaceState only (no PopStateEvent / hashchange dispatch)
      window.history.replaceState(null, '', targetUrl);
      debug.log('[URL Management] Updated URL via replaceState', { reason, targetUrl });
    },
    [experienceId, userInteractionRef, isUnmountingRef]
  );

  // Demo-branch URL management: keep the address bar in sync with tab + selected plan,
  // while preserving incoming plan/item hashes for deep links.
  // CRITICAL: replaceState only (no popstate dispatch) to avoid scroll issues.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.history?.replaceState) return;
    if (userInteractionRef.current) return;
    if (isUnmountingRef.current) return;

    if (!experienceId) return;
    const expectedPath = `/experiences/${experienceId}`;
    const pathnameNow = window.location.pathname || '';
    const pathnameNoSlash = pathnameNow.endsWith('/') && pathnameNow.length > 1
      ? pathnameNow.slice(0, -1)
      : pathnameNow;
    if (!pathnameNoSlash.endsWith(expectedPath)) return;

    const basePath = pathnameNoSlash;
    const currentHash = window.location.hash || '';

    // If we're on the myplan tab and the hash already matches the selected plan,
    // treat this as a direct URL navigation and preserve it.
    if (currentHash.startsWith('#plan-') && activeTab === 'myplan' && selectedPlanId) {
      const hashContent = currentHash.substring(6);
      const hashPlanId = hashContent.split('-item-')[0];

      if (idEquals(hashPlanId, selectedPlanId)) {
        return;
      }
    }

    if (activeTab === 'myplan' && selectedPlanId) {
      const hashed = currentHash.startsWith('#plan-')
        ? `${basePath}${currentHash}`
        : `${basePath}#plan-${selectedPlanId}`;

      const current = `${window.location.pathname}${window.location.hash || ''}`;
      if (current !== hashed) {
        window.history.replaceState(null, '', hashed);
      }
      return;
    }

    const incomingHash = window.location.hash || '';
    if (incomingHash.startsWith('#plan-')) return;

    const expUrl = basePath;
    const current = `${window.location.pathname}${window.location.hash || ''}`;
    if (current !== expUrl) {
      window.history.replaceState(null, '', expUrl);
    }
  }, [activeTab, selectedPlanId, experienceId, userInteractionRef, isUnmountingRef]);

  /**
   * Demo-branch behavior: ensure the hash reflects the selected plan when on My Plan,
   * while preserving item-level hashes when they already match the selected plan.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.history?.replaceState) return;
    if (userInteractionRef.current) return;
    if (isUnmountingRef.current) return;

    if (activeTab === 'myplan' && selectedPlanId) {
      const currentHash = window.location.hash || '';
      const expectedPlanPrefix = `#plan-${selectedPlanId}`;

      // Preserve item-level hash when already correct
      if (currentHash.startsWith(expectedPlanPrefix)) return;

      const newHash = `#plan-${selectedPlanId}`;
      window.history.replaceState(null, '', `${window.location.pathname}${newHash}`);
    } else if (activeTab === 'experience') {
      // Preserve incoming plan hashes until plan data loads and handlers can process them.
      if ((window.location.hash || '').startsWith('#plan-')) return;

      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  }, [activeTab, selectedPlanId, userInteractionRef, isUnmountingRef]);

  // Navigation Intent Consumer - handles deep-link navigation from HashLink and direct URL
  // Single source of truth for scroll/highlight behavior
  useEffect(() => {
    debug.log('[NavigationIntent] Effect running', {
      userInteractionInProgress: userInteractionRef.current,
      intentExists: !!intent,
      intentConsumed: intent?.consumed,
      plansLoading,
      intentId: intent?.id,
      targetPlanId: intent?.targetPlanId,
      targetItemId: intent?.targetItemId
    });

    // Skip if user interaction is in progress (e.g., toggling completion)
    if (userInteractionRef.current) {
      debug.log('[NavigationIntent] Skipping - user interaction in progress');
      return;
    }

    // Skip if no intent or already consumed
    if (!intent || intent.consumed) {
      debug.log('[NavigationIntent] Skipping - no intent or already consumed');
      return;
    }

    // Skip if plans haven't loaded yet
    if (plansLoading || allAccessiblePlans.length === 0) {
      debug.log('[NavigationIntent] Plans still loading, waiting...', {
        plansLoading,
        userPlanExists: !!userPlan,
        intentId: intent.id
      });
      return;
    }

    const { targetPlanId, targetItemId, shouldAnimate, id: intentId } = intent;

    debug.log('[NavigationIntent] Processing intent:', {
      intentId,
      targetPlanId,
      targetItemId,
      shouldAnimate,
      type: intent.type
    });

    // Find the target plan
    const targetPlan = allAccessiblePlans.find((p) => idEquals(p._id, targetPlanId));

    if (!targetPlan) {
      debug.warn('[NavigationIntent] Plan not found in accessible plans:', {
        targetPlanId,
        availablePlans: allAccessiblePlans.map(p => p._id?.toString())
      });
      clearIntent();
      return;
    }

    consumeIntent(intentId);

    const tid = normalizeId(targetPlan._id);

    debug.log('[NavigationIntent] Found target plan, switching...', { tid, targetItemId });

    writeExperienceHash({
      planId: tid,
      itemId: targetItemId ? normalizeId(targetItemId) : null,
      reason: 'navigation-intent'
    });

    setSelectedPlanId(tid);
    setActiveTab('myplan');

    initialHashHandledRef.current = true;

    if (targetItemId) {
      debug.log('[NavigationIntent] Scheduling scroll to item:', { targetItemId, shouldAnimate });

      const planItem = findById(targetPlan.plan, targetItemId)
        || findById(targetPlan.plan, targetItemId, 'plan_item_id');

      if (planItem) {
        setSelectedDetailsItem(planItem);
        setDetailsModalInitialTab('notes');
        openModal(MODAL_NAMES.PLAN_ITEM_DETAILS);
      }

      requestAnimationFrame(() => {
        scrollToItem(targetItemId, { shouldHighlight: shouldAnimate })
          .then(result => debug.log('[NavigationIntent] scrollToItem result:', result ? 'found' : 'not found'))
          .catch(err => debug.log('[NavigationIntent] scrollToItem error:', err));
      });
    } else {
      debug.log('[NavigationIntent] No targetItemId, skipping scroll');
    }
  }, [
    intent,
    plansLoading,
    userPlan,
    allAccessiblePlans,
    consumeIntent,
    clearIntent,
    scrollToItem,
    openModal,
    setSelectedPlanId,
    setActiveTab,
    setSelectedDetailsItem,
    setDetailsModalInitialTab,
    writeExperienceHash,
    MODAL_NAMES,
    userInteractionRef
  ]);

  // Fallback handler for direct URL navigation (when no intent exists).
  // Only runs ONCE on initial page load to prevent re-scrolling on state changes
  useEffect(() => {
    if (userInteractionRef.current) return;
    if (initialHashHandledRef.current) return;
    if (intent && !intent.consumed) return;
    if (plansLoading) return;

    const currentHash = window.location.hash || '';
    if (allAccessiblePlans.length === 0 && !currentHash.startsWith('#plan-')) return;

    // If the hash was lost during early Router mount, restore it now.
    const pendingHashKey = STORAGE_KEYS.pendingHash;
    const legacyPendingHashKeys = LEGACY_STORAGE_KEYS.pendingHash;
    let hash = window.location.hash || '';
    if (!hash.startsWith('#plan-')) {
      try {
        let pendingRaw = window.localStorage?.getItem(pendingHashKey) || '';
        if (!pendingRaw) {
          for (const k of legacyPendingHashKeys) {
            const v = window.localStorage?.getItem(k) || '';
            if (v) { pendingRaw = v; break; }
          }
        }

        let pending = pendingRaw;
        if (pendingRaw && !pendingRaw.startsWith('#')) {
          try {
            const parsed = JSON.parse(pendingRaw);
            pending = parsed?.hash || '';
          } catch (e) {
            // ignore
          }
        }

        if (pending.startsWith('#plan-')) {
          const targetUrl = `${window.location.pathname}${window.location.search || ''}${pending}`;
          window.history.replaceState(null, '', targetUrl);
          hash = pending;
        }
      } catch (err) {
        // ignore
      }
    }

    try {
      window.localStorage?.removeItem(pendingHashKey);
      legacyPendingHashKeys.forEach((k) => {
        try { window.localStorage?.removeItem(k); } catch (e) {}
      });
    } catch (err) {
      // ignore
    }

    if (!hash.startsWith('#plan-')) {
      initialHashHandledRef.current = true;
      return;
    }

    if (processedHashRef.current === hash) return;

    // Parse hash format: #plan-{planId} or #plan-{planId}-item-{itemId}
    const hashContent = hash.substring(6);
    const parts = hashContent.split('-item-');
    const planId = parts[0];
    const itemId = parts.length > 1 ? parts[1] : null;

    if (!planId) return;

    debug.log('[SingleExperience] Fallback URL hash handler:', { planId, itemId, selectedPlanId, hash });

    const targetPlan = findById(allAccessiblePlans, planId);
    if (!targetPlan) {
      // Plan not in accessible list — verify with the server.
      getPlanById(planId)
        .then(plan => {
          debug.log('[Fallback Hash] Plan fetched successfully (race condition resolved):', planId);
          setUserPlan(prev => prev || plan);
          setSelectedPlanId(normalizeId(plan._id));
          setActiveTab('myplan');
        })
        .catch(err => {
          const status = err?.response?.status || err?.status;
          if (status === 403) {
            getPlanPreview(planId)
              .then(preview => {
                if (preview?.planId) {
                  setAccessDeniedPlanId(planId);
                  setAccessRequestSent(false);
                  setActiveTab('myplan');
                  debug.log('[Fallback Hash] Plan exists but access denied:', planId);
                }
              })
              .catch(() => {
                debug.warn('[Fallback Hash] Plan preview also failed:', planId);
              });
          } else {
            debug.warn('[Fallback Hash] Plan not found or error:', planId, status);
          }
        });
      processedHashRef.current = hash;
      initialHashHandledRef.current = true;
      return;
    }

    const tid = normalizeId(targetPlan._id);

    processedHashRef.current = hash;
    initialHashHandledRef.current = true;

    const needsTabSwitch = selectedPlanId !== tid;
    if (needsTabSwitch) {
      setSelectedPlanId(tid);
      setActiveTab('myplan');
    }

    if (itemId) {
      const planItem = findById(targetPlan.plan, itemId)
        || findById(targetPlan.plan, itemId, 'plan_item_id');

      if (planItem) {
        setSelectedDetailsItem(planItem);
        setDetailsModalInitialTab('notes');
        openModal(MODAL_NAMES.PLAN_ITEM_DETAILS);
      }

      if (needsTabSwitch) {
        requestAnimationFrame(() => {
          setTimeout(() => {
            scrollToItem(itemId, { shouldHighlight: true });
          }, 100);
        });
      } else {
        scrollToItem(itemId, { shouldHighlight: true });
      }
    }
  }, [
    plansLoading,
    allAccessiblePlans,
    selectedPlanId,
    intent,
    scrollToItem,
    setSelectedPlanId,
    setActiveTab,
    setUserPlan,
    setSelectedDetailsItem,
    setDetailsModalInitialTab,
    openModal,
    setAccessDeniedPlanId,
    setAccessRequestSent,
    MODAL_NAMES,
    userInteractionRef
  ]);

  // Hash repair: if React Router (or other navigation) clears the hash after the
  // plan/tab/modal has successfully loaded, re-add the expected hash.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.history?.replaceState) return;
    if (userInteractionRef.current) return;
    if (isUnmountingRef.current) return;
    if (!experienceId) return;

    const expectedPath = `/experiences/${experienceId}`;
    const pathnameNow = window.location.pathname || '';
    const pathnameNoSlash = pathnameNow.endsWith('/') && pathnameNow.length > 1
      ? pathnameNow.slice(0, -1)
      : pathnameNow;
    if (!pathnameNoSlash.endsWith(expectedPath)) return;

    if (plansLoading) return;
    if (activeTab !== 'myplan') return;
    if (!selectedPlanId) return;

    const currentHash = window.location.hash || '';

    // If the details modal is open, prefer item-level repair.
    if (detailsModalOpen && selectedDetailsItem && (selectedDetailsItem._id || selectedDetailsItem.plan_item_id)) {
      const itemId = normalizeId(selectedDetailsItem._id || selectedDetailsItem.plan_item_id);
      if (!itemId) return;

      const planObj = allAccessiblePlans.find((p) => idEquals(p._id, selectedPlanId));
      if (!planObj?.plan) return;
      const itemInPlan = findById(planObj.plan, itemId);
      if (!itemInPlan) return;

      const expectedItemHash = `#plan-${selectedPlanId}-item-${itemId}`;
      if (currentHash !== expectedItemHash) {
        writeExperienceHash({
          planId: selectedPlanId,
          itemId,
          reason: 'hash-repair/plan-item-loaded'
        });
      }
      return;
    }

    const selectedPlanLoaded = allAccessiblePlans.some((p) => idEquals(p._id, selectedPlanId));
    if (!selectedPlanLoaded) return;

    const expectedPlanPrefix = `#plan-${selectedPlanId}`;
    if (!currentHash.startsWith(expectedPlanPrefix)) {
      writeExperienceHash({
        planId: selectedPlanId,
        stripItem: true,
        reason: 'hash-repair/plan-loaded'
      });
    }
  }, [
    location.hash,
    activeTab,
    plansLoading,
    selectedPlanId,
    allAccessiblePlans,
    detailsModalOpen,
    selectedDetailsItem,
    experienceId,
    writeExperienceHash,
    userInteractionRef,
    isUnmountingRef
  ]);

  return {
    writeExperienceHash,
    processedHashRef,
    initialHashHandledRef
  };
}

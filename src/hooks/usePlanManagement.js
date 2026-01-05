import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { unstable_batchedUpdates as batchedUpdates } from 'react-dom';
import {
  getUserPlans,
  getPlanById,
  createPlan as createPlanAPI,
  updatePlan as updatePlanAPI,
  deletePlan as deletePlanAPI,
  getExperiencePlans,
  checkUserPlanForExperience
} from '../utilities/plans-api';
import { logger } from '../utilities/logger';
import {
  reconcileState,
  generateOptimisticId,
  getProtectedFields,
  LOCAL_CHANGE_PROTECTION_MS,
  eventBus,
  VectorClock
} from '../utilities/event-bus';
import {
  applyOperation,
  createAppliedOperationsSet,
  wasApplied,
  markApplied
} from '../utilities/plan-operations';
import {
  hasConflict,
  resolvePlanConflict,
  resolveItemConflict
} from '../utilities/conflict-resolver';

/**
 * Custom hook for managing plan-related state and operations
 * Handles plan CRUD, event subscriptions, and state synchronization
 *
 * @param {string} experienceId - The experience ID to manage plans for
 * @param {string} userId - The current user's ID
 * @returns {Object} Plan management state and functions
 */
export default function usePlanManagement(experienceId, userId) {
  // Core plan state
  const [userPlan, setUserPlan] = useState(null);
  const [sharedPlans, setSharedPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [plansLoading, setPlansLoading] = useState(false);

  // Date-related state
  const [plannedDate, setPlannedDate] = useState('');
  const [userPlannedDate, setUserPlannedDate] = useState(null);
  const [displayedPlannedDate, setDisplayedPlannedDate] = useState(null);

  // Flags
  const [userHasExperience, setUserHasExperience] = useState(false);

  // Refs for event deduplication
  const lastEventVersionRef = useRef({});

  // Refs for local change protection
  // Structure: { planId: { field: lastModifiedTimestamp, ... }, ... }
  const localModificationsRef = useRef({});

  // Pending events queue for events blocked by protection window
  // Structure: [{ event, queuedAt, planId }, ...]
  const pendingEventsRef = useRef([]);

  // Refs for vector clock tracking per plan (for causal ordering)
  // Structure: { planId: vectorClock, ... }
  const planVectorClocksRef = useRef({});

  // Ref for tracking applied operations (operation-based sync)
  // Used to prevent duplicate application of operations
  const appliedOperationsRef = useRef(createAppliedOperationsSet());

  // Ref for current experienceId - used to prevent race conditions
  // when navigating between experiences quickly
  const currentExperienceIdRef = useRef(experienceId);

  // Keep ref in sync with prop
  useEffect(() => {
    currentExperienceIdRef.current = experienceId;
  }, [experienceId]);

  /**
   * Track local modification for a plan field
   * This prevents remote events from overwriting recent local changes
   *
   * @param {string} planId - Plan ID being modified
   * @param {string[]} fields - Field names being modified
   */
  const trackLocalModification = useCallback((planId, fields) => {
    if (!planId || !fields || fields.length === 0) return;

    const now = Date.now();
    if (!localModificationsRef.current[planId]) {
      localModificationsRef.current[planId] = {};
    }

    fields.forEach(field => {
      localModificationsRef.current[planId][field] = now;
    });

    logger.debug('[usePlanManagement] Tracked local modifications', {
      planId,
      fields,
      timestamp: now
    });
  }, []);

  /**
   * Get protected fields for a specific plan
   *
   * @param {string} planId - Plan ID to check
   * @returns {string[]} Array of protected field names
   */
  const getProtectedFieldsForPlan = useCallback((planId) => {
    if (!planId || !localModificationsRef.current[planId]) return [];
    return getProtectedFields(localModificationsRef.current[planId]);
  }, []);

  /**
   * Get or create vector clock for a plan
   * Called when making local mutations to track causal ordering
   *
   * @param {string} planId - Plan ID
   * @returns {Object} Vector clock for this plan
   */
  const getPlanVectorClock = useCallback((planId) => {
    if (!planId) return VectorClock.createVectorClock();
    if (!planVectorClocksRef.current[planId]) {
      planVectorClocksRef.current[planId] = VectorClock.createVectorClock();
    }
    return planVectorClocksRef.current[planId];
  }, []);

  /**
   * Increment vector clock for a plan when making local mutation
   * This establishes causal "happens before" relationship
   *
   * @param {string} planId - Plan ID being mutated
   * @returns {Object} Updated vector clock
   */
  const incrementPlanVectorClock = useCallback((planId) => {
    if (!planId) return VectorClock.createVectorClock();

    const sessionId = eventBus.getSessionId();
    const currentClock = getPlanVectorClock(planId);
    const newClock = VectorClock.increment(currentClock, sessionId);
    planVectorClocksRef.current[planId] = newClock;

    logger.debug('[usePlanManagement] Incremented plan vector clock', {
      planId,
      sessionId,
      clock: VectorClock.format(newClock)
    });

    return newClock;
  }, [getPlanVectorClock]);

  /**
   * Update vector clock for a plan from remote event
   * Merges remote clock with local to maintain causal consistency
   *
   * @param {string} planId - Plan ID
   * @param {Object} remoteClock - Vector clock from remote event
   */
  const mergePlanVectorClock = useCallback((planId, remoteClock) => {
    if (!planId || !remoteClock) return;

    const currentClock = getPlanVectorClock(planId);
    const mergedClock = VectorClock.merge(currentClock, remoteClock);
    planVectorClocksRef.current[planId] = mergedClock;

    logger.debug('[usePlanManagement] Merged plan vector clock', {
      planId,
      localClock: VectorClock.format(currentClock),
      remoteClock: VectorClock.format(remoteClock),
      mergedClock: VectorClock.format(mergedClock)
    });
  }, [getPlanVectorClock]);

  /**
   * Clear expired modifications from tracking
   * Called periodically to prevent memory leaks
   */
  const cleanupExpiredModifications = useCallback(() => {
    const now = Date.now();
    Object.keys(localModificationsRef.current).forEach(planId => {
      const planMods = localModificationsRef.current[planId];
      Object.keys(planMods).forEach(field => {
        if (now - planMods[field] >= LOCAL_CHANGE_PROTECTION_MS) {
          delete planMods[field];
        }
      });
      // Remove empty plan entries
      if (Object.keys(planMods).length === 0) {
        delete localModificationsRef.current[planId];
      }
    });
  }, []);

  /**
   * Helper: Extract user ID from plan.user (handles both ObjectId and populated User object)
   * @param {string|Object} user - Either ObjectId string or populated User object
   * @returns {string|null} User ID string
   */
  const extractUserId = (user) => {
    if (!user) return null;
    // If it's a populated User object, extract _id
    if (typeof user === 'object' && user._id) {
      return user._id.toString();
    }
    // If it's already an ObjectId string, return as-is
    return user.toString();
  };

  /**
   * Fetch user's plan for the current experience
   */
  const fetchUserPlan = useCallback(async () => {
    if (!experienceId || !userId) return;

    // Capture experienceId at start of fetch for race condition check
    const fetchExperienceId = experienceId;

    try {
      logger.debug('[usePlanManagement] Fetching user plan', { experienceId, userId });
      const check = await checkUserPlanForExperience(experienceId);

      // RACE CONDITION CHECK: If experienceId changed during fetch, discard results
      if (currentExperienceIdRef.current !== fetchExperienceId) {
        logger.debug('[usePlanManagement] Discarding stale fetch result - experienceId changed', {
          fetchedFor: fetchExperienceId,
          currentExperienceId: currentExperienceIdRef.current
        });
        return;
      }

      if (check && check.planId) {
        const plan = await getPlanById(check.planId);

        // RACE CONDITION CHECK: Re-check after second async call
        if (currentExperienceIdRef.current !== fetchExperienceId) {
          logger.debug('[usePlanManagement] Discarding stale plan data - experienceId changed', {
            fetchedFor: fetchExperienceId,
            currentExperienceId: currentExperienceIdRef.current
          });
          return;
        }

        // CRITICAL: Use batchedUpdates to prevent UI flashing from multiple setState calls
        batchedUpdates(() => {
          setUserPlan(plan);
          setUserHasExperience(true);
          setUserPlannedDate(plan.planned_date);
          setDisplayedPlannedDate(plan.planned_date);
        });
        logger.debug('[usePlanManagement] User plan loaded', { planId: plan._id });
      } else {
        // CRITICAL FIX (biensperience-832d): Prevent UI flashing on empty fetch
        // Use functional update to preserve previous state if it exists
        // Rationale:
        // - If prev is null/undefined, this is initial load → accept null
        // - If prev is optimistic (pending creation), accept null (creation failed/not started)
        // - If prev has real data, preserve it - deletions should come via plan:deleted event
        // - This prevents flash when API has temporary issues or stale cache
        batchedUpdates(() => {
          setUserPlan(prev => {
            // Accept null if no previous plan or if it's optimistic
            if (!prev || prev._optimistic) {
              logger.debug('[usePlanManagement] No user plan found, setting to null');
              return null;
            }
            // Preserve existing real plan - trust event system for actual deletions
            logger.debug('[usePlanManagement] No plan from API but preserving existing', {
              prevPlanId: prev._id,
              wasOptimistic: prev._optimistic
            });
            return prev;
          });
          setUserHasExperience(prev => {
            // Use functional update for consistency
            return prev; // Preserve current state - will be updated by event if needed
          });
          // Only clear dates if we're genuinely clearing the plan
          // These will be updated correctly when setUserPlan runs
        });
        logger.debug('[usePlanManagement] No user plan found from API');
      }
    } catch (error) {
      logger.error('[usePlanManagement] Failed to fetch user plan', { error: error.message }, error);
      // On error, preserve existing state - don't flash to empty
      // The UI will show current data which may be stale but is better than empty
    }
  }, [experienceId, userId]);

  /**
   * Fetch all shared plans for the current experience
   */
  const fetchSharedPlans = useCallback(async () => {
    if (!experienceId) return;

    // Capture experienceId at start of fetch for race condition check
    const fetchExperienceId = experienceId;

    try {
      logger.debug('[usePlanManagement] Fetching shared plans', { experienceId });
      const plans = await getExperiencePlans(experienceId);

      // IMPORTANT: sharedPlans should exclude the current user's own plan.
      // The user's plan is managed separately via userPlan to prevent drift
      // and duplicated updates across two sources of truth.
      const sharedOnly = Array.isArray(plans)
        ? plans.filter((p) => extractUserId(p.user) !== userId)
        : plans;

      // RACE CONDITION CHECK: If experienceId changed during fetch, discard results
      if (currentExperienceIdRef.current !== fetchExperienceId) {
        logger.debug('[usePlanManagement] Discarding stale shared plans - experienceId changed', {
          fetchedFor: fetchExperienceId,
          currentExperienceId: currentExperienceIdRef.current
        });
        return;
      }

      // CRITICAL FIX (biensperience-ed99): Use merge pattern instead of full replacement
      // This prevents UI flash when API returns fewer plans than currently displayed
      setSharedPlans(prev => {
        if (!sharedOnly || sharedOnly.length === 0) {
          // API returned empty - check if we should preserve existing
          if (!prev || prev.length === 0) {
            logger.debug('[usePlanManagement] No shared plans found');
            return [];
          }
          // Preserve existing plans - trust event system for actual deletions
          logger.debug('[usePlanManagement] API returned no plans but preserving existing', {
            prevCount: prev.length
          });
          return prev;
        }
        // Merge strategy: Use new data but ensure consistency
        logger.debug('[usePlanManagement] Shared plans loaded', {
          count: sharedOnly.length,
          excludedUserPlans: Array.isArray(plans) ? Math.max(0, plans.length - sharedOnly.length) : 0
        });
        return sharedOnly;
      });
    } catch (error) {
      logger.error('[usePlanManagement] Failed to fetch shared plans', { error: error.message }, error);
      // CRITICAL FIX (biensperience-ed99): Don't clear on error - preserve existing state
      // This prevents UI flash when API temporarily fails
    }
  }, [experienceId, userId]);

  /**
   * Fetch all plans (user + shared)
   */
  const fetchPlans = useCallback(async () => {
    setPlansLoading(true);
    try {
      await Promise.all([
        fetchUserPlan(),
        fetchSharedPlans()
      ]);
    } finally {
      setPlansLoading(false);
    }
  }, [fetchUserPlan, fetchSharedPlans]);

  /**
   * Create a new plan for the current user
   */
  const createPlan = useCallback(async (plannedDateValue) => {
    if (!experienceId || !userId) {
      throw new Error('Experience ID and User ID required');
    }

    logger.debug('[usePlanManagement] Creating plan', { experienceId, userId, plannedDateValue });

    // Generate optimistic ID
    const optimisticId = generateOptimisticId('plan');
    const optimisticPlan = {
      _id: optimisticId,
      _optimistic: true,
      _version: Date.now(),
      experience: experienceId,
      user: userId,
      planned_date: plannedDateValue,
      plan: [],
      permissions: [{
        _id: userId,
        entity: 'user',
        type: 'owner'
      }]
    };

    // Optimistic update
    setUserPlan(optimisticPlan);
    setUserHasExperience(true);
    setDisplayedPlannedDate(plannedDateValue);

    try {
      // Create plan via API - events will handle reconciliation
      const result = await createPlanAPI(experienceId, plannedDateValue);

      logger.info('[usePlanManagement] Plan created successfully', {
        optimisticId,
        canonicalId: result._id,
        experienceId
      });

      return result;
    } catch (error) {
      // Rollback on error
      setUserPlan(null);
      setUserHasExperience(false);
      setDisplayedPlannedDate(null);
      throw error;
    }
  }, [experienceId, userId]);

  /**
   * Update a plan's properties
   */
  const updatePlan = useCallback(async (planId, updates) => {
    if (!planId) {
      throw new Error('Plan ID required');
    }

    logger.debug('[usePlanManagement] Updating plan', { planId, updates });

    // Track local modifications to protect from remote overwrites
    const modifiedFields = Object.keys(updates);
    trackLocalModification(planId, modifiedFields);

    // Increment vector clock for this plan (establishes causal ordering)
    const vectorClock = incrementPlanVectorClock(planId);

    // Optimistic update for user plan
    if (userPlan && userPlan._id === planId) {
      setUserPlan(prev => ({ ...prev, ...updates, _vectorClock: vectorClock }));
    }

    // Optimistic update for shared plans
    setSharedPlans(prev =>
      prev.map(p => p._id === planId ? { ...p, ...updates, _vectorClock: vectorClock } : p)
    );

    try {
      const result = await updatePlanAPI(planId, updates);
      logger.info('[usePlanManagement] Plan updated successfully', { planId });
      return result;
    } catch (error) {
      // Rollback will be handled by event system
      throw error;
    }
  }, [userPlan, trackLocalModification, incrementPlanVectorClock]);

  /**
   * Delete a plan
   */
  const deletePlan = useCallback(async (planId) => {
    if (!planId) {
      throw new Error('Plan ID required');
    }

    logger.debug('[usePlanManagement] Deleting plan', { planId });

    // Optimistic removal
    if (userPlan && userPlan._id === planId) {
      setUserPlan(null);
      setUserHasExperience(false);
      setDisplayedPlannedDate(null);
    }

    setSharedPlans(prev => prev.filter(p => p._id !== planId));

    try {
      const result = await deletePlanAPI(planId);
      logger.info('[usePlanManagement] Plan deleted successfully', { planId });
      return result;
    } catch (error) {
      // Rollback on error
      await fetchPlans();
      throw error;
    }
  }, [userPlan, fetchPlans]);

  /**
   * Event handler for plan:created events
   * Uses unstable_batchedUpdates to prevent multiple renders and UI flashing
   */
  useEffect(() => {
    const handlePlanCreated = (event) => {
      // Event bus spreads payload at top level
      const { planId, experienceId: eventExpId, version, data } = event;

      if (!planId || !data) return;

      // Ignore if not for this experience
      if (eventExpId && eventExpId !== experienceId) return;

      // Deduplicate based on version
      const lastVersion = lastEventVersionRef.current[`created:${planId}`] || 0;
      if (version && version <= lastVersion) {
        logger.debug('[usePlanManagement] Ignoring duplicate plan:created event', { planId, version, lastVersion });
        return;
      }
      lastEventVersionRef.current[`created:${planId}`] = version;

      logger.debug('[usePlanManagement] Handling plan:created event', { planId, version, data });

      // Reconcile state - replace optimistic with canonical
      // CRITICAL FIX: Pass event structure (with data, version) to reconcileState
      const eventStructure = { data, version, optimisticId: planId };

      // Extract user ID from plan data (handles both ObjectId and populated User object)
      const planUserId = extractUserId(data.user);
      const isUserPlan = planUserId === userId;

      logger.debug('[usePlanManagement] plan:created - User check', {
        planUserId,
        currentUserId: userId,
        isUserPlan,
        dataUserType: typeof data.user
      });

      // CRITICAL: Batch all state updates to prevent UI flashing
      // This ensures single render instead of multiple intermediate states
      batchedUpdates(() => {
        setUserPlan(prev => {
          // NEVER set to null if we have data - always merge/patch
          if (!prev) {
            const newPlan = isUserPlan ? data : null;
            logger.debug('[usePlanManagement] No previous plan, setting new plan', {
              newPlan: newPlan?._id,
              isUserPlan
            });
            return newPlan;
          }
          // Reconcile: merge canonical with optimistic, never replace with empty
          const reconciledPlan = reconcileState(prev, eventStructure);
          logger.debug('[usePlanManagement] Reconciling plan state', {
            previousPlanId: prev._id,
            reconciledPlanId: reconciledPlan?._id,
            version
          });
          return reconciledPlan || prev; // NEVER return null if we had data
        });

        // Update shared plans - merge, don't replace
        setSharedPlans(prev => {
          const planIdStr = planId?.toString ? planId.toString() : String(planId);

          // If this is the user's plan, it must NOT live in sharedPlans.
          // Remove any accidental duplicates and return.
          if (isUserPlan) {
            return prev.filter((p) => {
              const pid = p?._id?.toString ? p._id.toString() : String(p?._id);
              return pid !== planIdStr;
            });
          }

          const exists = prev.some((p) => {
            const pid = p?._id?.toString ? p._id.toString() : String(p?._id);
            return pid === planIdStr;
          });

          if (exists) {
            return prev.map((p) => {
              const pid = p?._id?.toString ? p._id.toString() : String(p?._id);
              if (pid === planIdStr) {
                const reconciled = reconcileState(p, eventStructure);
                return reconciled || p; // NEVER return null - keep previous if reconciliation fails
              }
              return p;
            });
          }

          return [...prev, data];
        });

        // CRITICAL: Update userHasExperience ONLY if this is the user's plan
        if (isUserPlan) {
          logger.debug('[usePlanManagement] Setting userHasExperience to true', {
            planId,
            userId,
            version
          });
          setUserHasExperience(true);
          setDisplayedPlannedDate(data.planned_date);
        }
      });
    };

    const unsubscribe = eventBus.subscribe('plan:created', handlePlanCreated);
    return () => unsubscribe();
  }, [experienceId, userId]);

  /**
   * Event handler for plan:updated events
   */
  useEffect(() => {
    const handlePlanUpdated = (event) => {
      // Event bus spreads payload at top level
      // Event payload may have plan data in different locations:
      // - updatePlanItem: { plan, planId }
      // - updatePlan: { data, planId, version }
      // - reorderPlanItems: { data, planId, version }
      const planId = event.planId;
      const experienceId_event = event.experienceId;
      const version = event.version;
      const data = event.data || event.plan;
      const eventVectorClock = event.vectorClock;

      if (!planId || !data) return;

      // Ignore if not for this experience
      if (experienceId_event && experienceId_event !== experienceId) return;

      // Deduplicate based on version
      const lastVersion = lastEventVersionRef.current[`updated:${planId}`] || 0;
      if (version && version <= lastVersion) {
        logger.debug('[usePlanManagement] Ignoring duplicate plan:updated event', { planId, version, lastVersion });
        return;
      }
      lastEventVersionRef.current[`updated:${planId}`] = version;

      // Get protected fields for this plan (fields with recent local modifications)
      const protectedFields = getProtectedFieldsForPlan(planId);

      // Get local vector clock for causal comparison
      const localVectorClock = getPlanVectorClock(planId);

      logger.debug('[usePlanManagement] Handling plan:updated event', {
        planId,
        version,
        data,
        protectedFields: protectedFields.length > 0 ? protectedFields : 'none',
        localClock: VectorClock.format(localVectorClock),
        eventClock: eventVectorClock ? VectorClock.format(eventVectorClock) : 'none'
      });

      // Merge remote vector clock with local to maintain causal consistency
      if (eventVectorClock) {
        mergePlanVectorClock(planId, eventVectorClock);
      }

      // Check for concurrent edits using vector clocks
      const isConcurrent = eventVectorClock && !VectorClock.isEmpty(localVectorClock)
        ? hasConflict(localVectorClock, eventVectorClock)
        : false;

      if (isConcurrent) {
        logger.info('[usePlanManagement] Concurrent edit detected, using conflict resolution', {
          planId,
          localClock: VectorClock.format(localVectorClock),
          remoteClock: VectorClock.format(eventVectorClock)
        });
      }

      // CRITICAL FIX: Pass event structure (with data, version, vectorClock) to reconcileState
      // Include protected fields to prevent overwriting recent local changes
      // Include vector clocks for causal ordering
      const eventStructure = { data, version, optimisticId: planId, vectorClock: eventVectorClock };
      const reconcileOptions = {
        protectedFields,
        localVectorClock: !VectorClock.isEmpty(localVectorClock) ? localVectorClock : undefined
      };

      // Extract user ID from plan data for later use
      const planUserId = extractUserId(data.user);
      const isUserPlan = planUserId === userId;

      logger.debug('[usePlanManagement] plan:updated - User check', {
        planUserId,
        currentUserId: userId,
        isUserPlan,
        dataUserType: typeof data.user
      });

      // CRITICAL: Batch all state updates to prevent UI flashing
      batchedUpdates(() => {
        // Update user plan if it matches
        setUserPlan(prev => {
          if (!prev || prev._id !== planId) return prev;

          // Use conflict resolver for concurrent edits
          if (isConcurrent) {
            const { resolved, source, conflicts } = resolvePlanConflict(
              prev,
              data,
              localVectorClock,
              eventVectorClock
            );

            if (conflicts.length > 0) {
              logger.info('[usePlanManagement] Resolved plan conflicts', {
                planId,
                source,
                conflictCount: conflicts.length,
                fields: conflicts.map(c => c.field)
              });
            }

            return resolved || prev; // NEVER return null - keep previous if resolution fails
          }

          // No conflict - use standard reconciliation
          const reconciled = reconcileState(prev, eventStructure, reconcileOptions);
          logger.debug('[usePlanManagement] Reconciled updated plan', {
            planId,
            version,
            reconciledPlanId: reconciled?._id,
            protectedFields
          });
          return reconciled || prev; // NEVER return null - keep previous if reconciliation fails
        });

        // Update shared plans - but only if something actually changes
        // to prevent unnecessary re-renders that cause scroll issues
        setSharedPlans(prev => {
          const planIdStr = planId?.toString ? planId.toString() : String(planId);

          // If this is the user's plan, it must NOT live in sharedPlans.
          // Remove any accidental duplicates and return.
          if (isUserPlan) {
            const filtered = prev.filter((p) => {
              const pid = p?._id?.toString ? p._id.toString() : String(p?._id);
              return pid !== planIdStr;
            });
            return filtered.length === prev.length ? prev : filtered;
          }

          let changed = false;
          const updated = prev.map(p => {
            if (p._id !== planId) return p;

            // Use conflict resolver for concurrent edits
            if (isConcurrent) {
              const pVectorClock = p._vectorClock || {};
              const { resolved } = resolvePlanConflict(
                p,
                data,
                pVectorClock,
                eventVectorClock
              );
              if (resolved && resolved !== p) changed = true;
              return resolved || p; // NEVER return null - keep previous
            }

            // No conflict - use standard reconciliation
            const reconciled = reconcileState(p, eventStructure, reconcileOptions);
            if (reconciled && reconciled !== p) changed = true;
            return reconciled || p; // NEVER return null - keep previous
          });

          // Only return new array if something actually changed
          return changed ? updated : prev;
        });

        // Update displayed date ONLY if it's the user's plan
        if (isUserPlan && data.planned_date !== undefined) {
          logger.debug('[usePlanManagement] Updating displayed planned date', {
            planId,
            plannedDate: data.planned_date
          });
          setDisplayedPlannedDate(data.planned_date);
          setUserPlannedDate(data.planned_date);
        }
      });
    };

    const unsubscribe = eventBus.subscribe('plan:updated', handlePlanUpdated);
    return () => unsubscribe();
  }, [experienceId, userId, getProtectedFieldsForPlan, getPlanVectorClock, mergePlanVectorClock]);

  /**
   * Event handler for plan:deleted events
   */
  useEffect(() => {
    const handlePlanDeleted = (event) => {
      // Event bus spreads payload at top level
      const { planId, experienceId: eventExpId, version } = event;

      if (!planId) return;

      // Ignore if not for this experience
      if (eventExpId && eventExpId !== experienceId) return;

      // Deduplicate based on version
      const lastVersion = lastEventVersionRef.current[`deleted:${planId}`] || 0;
      if (version && version <= lastVersion) {
        logger.debug('[usePlanManagement] Ignoring duplicate plan:deleted event', { planId, version, lastVersion });
        return;
      }
      lastEventVersionRef.current[`deleted:${planId}`] = version;

      logger.debug('[usePlanManagement] Handling plan:deleted event', { planId, version });

      // CRITICAL: Batch all state updates to prevent UI flashing
      batchedUpdates(() => {
        // Remove from user plan if it matches and update flags atomically
        setUserPlan(prev => {
          if (!prev || prev._id !== planId) return prev;
          // For deletions, null is acceptable - this is a legitimate empty state
          // Update flags in same batch
          setUserHasExperience(false);
          setDisplayedPlannedDate(null);
          setUserPlannedDate(null);
          return null;
        });

        // Remove from shared plans
        setSharedPlans(prev => prev.filter(p => p._id !== planId));
      });
    };

    const unsubscribe = eventBus.subscribe('plan:deleted', handlePlanDeleted);
    return () => unsubscribe();
  }, [experienceId, userId]);

  /**
   * Event handler for plan:operation events (CRDT-style operation-based sync)
   * Operations are idempotent and commutative, ensuring eventual consistency
   */
  useEffect(() => {
    const handlePlanOperation = (event) => {
      // Event bus spreads payload at top level
      const { planId, operation } = event;

      if (!planId || !operation) {
        logger.debug('[usePlanManagement] Invalid plan:operation event', { planId, operation });
        return;
      }

      // Check if this operation was already applied (idempotency)
      if (wasApplied(appliedOperationsRef.current, operation)) {
        logger.debug('[usePlanManagement] Skipping duplicate operation', {
          operationId: operation.id,
          type: operation.type
        });
        return;
      }

      // Mark operation as applied before processing
      markApplied(appliedOperationsRef.current, operation);

      // Merge vector clock from operation for causal consistency
      if (operation.vectorClock) {
        mergePlanVectorClock(planId, operation.vectorClock);
      }

      logger.debug('[usePlanManagement] Applying operation', {
        planId,
        operationId: operation.id,
        type: operation.type,
        payload: operation.payload
      });

      // CRITICAL: Batch all state updates to prevent UI flashing
      batchedUpdates(() => {
        // Apply operation to user plan if it matches
        setUserPlan(prev => {
          if (!prev || prev._id !== planId) return prev;

          const newState = applyOperation(prev, operation);
          if (newState !== prev) {
            logger.debug('[usePlanManagement] Operation applied to userPlan', {
              planId,
              operationId: operation.id,
              type: operation.type,
              previousPlanItems: prev.plan?.length,
              newPlanItems: newState?.plan?.length
            });
          }
          // NEVER return null from operations - keep previous if operation fails
          return newState || prev;
        });

        // Apply operation to shared plans
        setSharedPlans(prev =>
          prev.map(p => {
            if (p._id !== planId) return p;

            const newState = applyOperation(p, operation);
            if (newState !== p) {
              logger.debug('[usePlanManagement] Operation applied to sharedPlan', {
                planId,
                operationId: operation.id,
                type: operation.type
              });
            }
            // NEVER return null from operations - keep previous if operation fails
            return newState || p;
          })
        );

        // Handle special cases for plan-level operations
        if (operation.type === 'DELETE_PLAN') {
          // Check if it's the user's plan before setting flags
          setUserPlan(prev => {
            if (prev && prev._id === planId) {
              setUserHasExperience(false);
              setDisplayedPlannedDate(null);
              setUserPlannedDate(null);
            }
            return prev;
          });
        }

        // Handle date updates
        if (operation.type === 'UPDATE_PLAN' && operation.payload?.changes?.planned_date !== undefined) {
          const plannedDate = operation.payload.changes.planned_date;
          // Only update displayed date if this is the user's plan
          setUserPlan(prev => {
            if (prev && prev._id === planId) {
              const planUserId = extractUserId(prev.user);
              if (planUserId === userId) {
                setDisplayedPlannedDate(plannedDate);
                setUserPlannedDate(plannedDate);
              }
            }
            return prev;
          });
        }
      });
    };

    const unsubscribe = eventBus.subscribe('plan:operation', handlePlanOperation);
    return () => unsubscribe();
  }, [userId, mergePlanVectorClock]);

  /**
   * Initial load
   */
  useEffect(() => {
    if (experienceId && userId) {
      fetchPlans();
    }
  }, [experienceId, userId, fetchPlans]);

  /**
   * Periodic cleanup of expired local modifications
   * Runs every second to keep memory usage bounded
   */
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      cleanupExpiredModifications();
    }, 1000); // Every 1 second

    return () => clearInterval(cleanupInterval);
  }, [cleanupExpiredModifications]);

  // Compute selected plan from ID
  // Use string comparison since _id can be ObjectId or string
  const selectedPlan = useMemo(() => selectedPlanId
    ? sharedPlans.find(p => {
        const planId = p._id?.toString ? p._id.toString() : p._id;
        const targetId = selectedPlanId?.toString ? selectedPlanId.toString() : selectedPlanId;
        return planId === targetId;
      }) || userPlan
    : userPlan, [selectedPlanId, sharedPlans, userPlan]);

  return {
    // State
    userPlan,
    setUserPlan,
    sharedPlans,
    setSharedPlans,
    selectedPlanId,
    setSelectedPlanId,
    selectedPlan,
    plansLoading,
    setPlansLoading,
    plannedDate,
    setPlannedDate,
    userPlannedDate,
    setUserPlannedDate,
    displayedPlannedDate,
    setDisplayedPlannedDate,
    userHasExperience,
    setUserHasExperience,

    // Functions
    fetchUserPlan,
    fetchSharedPlans,
    fetchPlans,
    createPlan,
    updatePlan,
    deletePlan,

    // Local change protection
    trackLocalModification,
    getProtectedFieldsForPlan
  };
}

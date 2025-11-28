import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [collaborativePlans, setCollaborativePlans] = useState([]);
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

    try {
      logger.debug('[usePlanManagement] Fetching user plan', { experienceId, userId });
      const check = await checkUserPlanForExperience(experienceId);

      if (check && check.planId) {
        const plan = await getPlanById(check.planId);
        setUserPlan(plan);
        setUserHasExperience(true);
        setUserPlannedDate(plan.planned_date);
        setDisplayedPlannedDate(plan.planned_date);
        logger.debug('[usePlanManagement] User plan loaded', { planId: plan._id });
      } else {
        setUserPlan(null);
        setUserHasExperience(false);
        setUserPlannedDate(null);
        setDisplayedPlannedDate(null);
        logger.debug('[usePlanManagement] No user plan found');
      }
    } catch (error) {
      logger.error('[usePlanManagement] Failed to fetch user plan', { error: error.message }, error);
    }
  }, [experienceId, userId]);

  /**
   * Fetch all collaborative plans for the current experience
   */
  const fetchCollaborativePlans = useCallback(async () => {
    if (!experienceId) return;

    try {
      logger.debug('[usePlanManagement] Fetching collaborative plans', { experienceId });
      const plans = await getExperiencePlans(experienceId);
      setCollaborativePlans(plans || []);
      logger.debug('[usePlanManagement] Collaborative plans loaded', { count: plans?.length || 0 });
    } catch (error) {
      logger.error('[usePlanManagement] Failed to fetch collaborative plans', { error: error.message }, error);
      setCollaborativePlans([]);
    }
  }, [experienceId]);

  /**
   * Fetch all plans (user + collaborative)
   */
  const fetchPlans = useCallback(async () => {
    setPlansLoading(true);
    try {
      await Promise.all([
        fetchUserPlan(),
        fetchCollaborativePlans()
      ]);
    } finally {
      setPlansLoading(false);
    }
  }, [fetchUserPlan, fetchCollaborativePlans]);

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

    // Optimistic update for collaborative plans
    setCollaborativePlans(prev =>
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

    setCollaborativePlans(prev => prev.filter(p => p._id !== planId));

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
   */
  useEffect(() => {
    const handlePlanCreated = (event) => {
      const { planId, experienceId: eventExpId, version, data } = event.detail || {};

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

      setUserPlan(prev => {
        if (!prev) {
          const newPlan = isUserPlan ? data : null;
          logger.debug('[usePlanManagement] No previous plan, setting new plan', {
            newPlan: newPlan?._id,
            isUserPlan
          });
          return newPlan;
        }
        const reconciledPlan = reconcileState(prev, eventStructure);
        logger.debug('[usePlanManagement] Reconciling plan state', {
          previousPlanId: prev._id,
          reconciledPlanId: reconciledPlan?._id,
          version
        });
        return reconciledPlan;
      });

      // Update collaborative plans
      setCollaborativePlans(prev => {
        const exists = prev.some(p => p._id === planId);
        if (exists) {
          return prev.map(p => {
            if (p._id === planId) {
              const reconciled = reconcileState(p, eventStructure);
              return reconciled || p;
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
    };

    window.addEventListener('plan:created', handlePlanCreated);
    return () => window.removeEventListener('plan:created', handlePlanCreated);
  }, [experienceId, userId]);

  /**
   * Event handler for plan:updated events
   */
  useEffect(() => {
    const handlePlanUpdated = (event) => {
      // Event payload may have plan data in different locations:
      // - updatePlanItem: { plan, planId }
      // - updatePlan: { data, planId, version }
      // - reorderPlanItems: { data, planId, version }
      const detail = event.detail || {};
      const planId = detail.planId;
      const experienceId_event = detail.experienceId;
      const version = detail.version;
      const data = detail.data || detail.plan;
      const eventVectorClock = detail.vectorClock;

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

          return resolved;
        }

        // No conflict - use standard reconciliation
        const reconciled = reconcileState(prev, eventStructure, reconcileOptions);
        logger.debug('[usePlanManagement] Reconciled updated plan', {
          planId,
          version,
          reconciledPlanId: reconciled?._id,
          protectedFields
        });
        return reconciled || prev;
      });

      // Update collaborative plans
      setCollaborativePlans(prev =>
        prev.map(p => {
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
            return resolved;
          }

          // No conflict - use standard reconciliation
          const reconciled = reconcileState(p, eventStructure, reconcileOptions);
          return reconciled || p;
        })
      );

      // Update displayed date ONLY if it's the user's plan
      const planUserId = extractUserId(data.user);
      const isUserPlan = planUserId === userId;

      logger.debug('[usePlanManagement] plan:updated - User check', {
        planUserId,
        currentUserId: userId,
        isUserPlan,
        dataUserType: typeof data.user
      });

      if (isUserPlan && data.planned_date !== undefined) {
        logger.debug('[usePlanManagement] Updating displayed planned date', {
          planId,
          plannedDate: data.planned_date
        });
        setDisplayedPlannedDate(data.planned_date);
        setUserPlannedDate(data.planned_date);
      }
    };

    window.addEventListener('plan:updated', handlePlanUpdated);
    return () => window.removeEventListener('plan:updated', handlePlanUpdated);
  }, [experienceId, userId, getProtectedFieldsForPlan, getPlanVectorClock, mergePlanVectorClock]);

  /**
   * Event handler for plan:deleted events
   */
  useEffect(() => {
    const handlePlanDeleted = (event) => {
      const { planId, experienceId: eventExpId, version } = event.detail || {};

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

      // Remove from user plan if it matches
      setUserPlan(prev => {
        if (!prev || prev._id !== planId) return prev;
        setUserHasExperience(false);
        setDisplayedPlannedDate(null);
        setUserPlannedDate(null);
        return null;
      });

      // Remove from collaborative plans
      setCollaborativePlans(prev => prev.filter(p => p._id !== planId));
    };

    window.addEventListener('plan:deleted', handlePlanDeleted);
    return () => window.removeEventListener('plan:deleted', handlePlanDeleted);
  }, [experienceId, userId]);

  /**
   * Event handler for plan:operation events (CRDT-style operation-based sync)
   * Operations are idempotent and commutative, ensuring eventual consistency
   */
  useEffect(() => {
    const handlePlanOperation = (event) => {
      const { planId, operation } = event.detail || {};

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
        return newState;
      });

      // Apply operation to collaborative plans
      setCollaborativePlans(prev =>
        prev.map(p => {
          if (p._id !== planId) return p;

          const newState = applyOperation(p, operation);
          if (newState !== p) {
            logger.debug('[usePlanManagement] Operation applied to collaborativePlan', {
              planId,
              operationId: operation.id,
              type: operation.type
            });
          }
          return newState;
        })
      );

      // Handle special cases for plan-level operations
      if (operation.type === 'DELETE_PLAN') {
        if (userPlan && userPlan._id === planId) {
          setUserHasExperience(false);
          setDisplayedPlannedDate(null);
          setUserPlannedDate(null);
        }
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
    };

    window.addEventListener('plan:operation', handlePlanOperation);
    return () => window.removeEventListener('plan:operation', handlePlanOperation);
  }, [userId, mergePlanVectorClock]);

  /**
   * Legacy event handlers for backward compatibility
   */
  useEffect(() => {
    const handleLegacyPlanCreated = (event) => {
      const { plan, experienceId: eventExpId } = event.detail || {};
      if (!plan || (eventExpId && eventExpId !== experienceId)) return;

      // Convert to new event format and handle
      window.dispatchEvent(new CustomEvent('plan:created', {
        detail: {
          planId: plan._id,
          experienceId: eventExpId || experienceId,
          version: Date.now(),
          data: plan
        }
      }));
    };

    const handleLegacyPlanUpdated = (event) => {
      const { plan, experienceId: eventExpId } = event.detail || {};
      if (!plan || (eventExpId && eventExpId !== experienceId)) return;

      window.dispatchEvent(new CustomEvent('plan:updated', {
        detail: {
          planId: plan._id,
          experienceId: eventExpId || experienceId,
          version: Date.now(),
          data: plan
        }
      }));
    };

    const handleLegacyPlanDeleted = (event) => {
      const { plan, planId, experienceId: eventExpId } = event.detail || {};
      const id = planId || plan?._id;
      if (!id || (eventExpId && eventExpId !== experienceId)) return;

      window.dispatchEvent(new CustomEvent('plan:deleted', {
        detail: {
          planId: id,
          experienceId: eventExpId || experienceId,
          version: Date.now(),
          data: plan
        }
      }));
    };

    window.addEventListener('bien:plan_created', handleLegacyPlanCreated);
    window.addEventListener('bien:plan_updated', handleLegacyPlanUpdated);
    window.addEventListener('bien:plan_deleted', handleLegacyPlanDeleted);

    return () => {
      window.removeEventListener('bien:plan_created', handleLegacyPlanCreated);
      window.removeEventListener('bien:plan_updated', handleLegacyPlanUpdated);
      window.removeEventListener('bien:plan_deleted', handleLegacyPlanDeleted);
    };
  }, [experienceId]);

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
  const selectedPlan = selectedPlanId
    ? collaborativePlans.find(p => {
        const planId = p._id?.toString ? p._id.toString() : p._id;
        const targetId = selectedPlanId?.toString ? selectedPlanId.toString() : selectedPlanId;
        return planId === targetId;
      }) || userPlan
    : userPlan;

  return {
    // State
    userPlan,
    setUserPlan,
    collaborativePlans,
    setCollaborativePlans,
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
    fetchCollaborativePlans,
    fetchPlans,
    createPlan,
    updatePlan,
    deletePlan,

    // Local change protection
    trackLocalModification,
    getProtectedFieldsForPlan
  };
}

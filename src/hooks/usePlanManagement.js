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
import { reconcileState } from '../utilities/event-bus';
import { generateOptimisticId } from '../utilities/event-bus';

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

    // Optimistic update for user plan
    if (userPlan && userPlan._id === planId) {
      setUserPlan(prev => ({ ...prev, ...updates }));
    }

    // Optimistic update for collaborative plans
    setCollaborativePlans(prev =>
      prev.map(p => p._id === planId ? { ...p, ...updates } : p)
    );

    try {
      const result = await updatePlanAPI(planId, updates);
      logger.info('[usePlanManagement] Plan updated successfully', { planId });
      return result;
    } catch (error) {
      // Rollback will be handled by event system
      throw error;
    }
  }, [userPlan]);

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
      const { planId, experienceId: eventExpId, version, data } = event.detail || {};

      if (!planId || !data) return;

      // Ignore if not for this experience
      if (eventExpId && eventExpId !== experienceId) return;

      // Deduplicate based on version
      const lastVersion = lastEventVersionRef.current[`updated:${planId}`] || 0;
      if (version && version <= lastVersion) {
        logger.debug('[usePlanManagement] Ignoring duplicate plan:updated event', { planId, version, lastVersion });
        return;
      }
      lastEventVersionRef.current[`updated:${planId}`] = version;

      logger.debug('[usePlanManagement] Handling plan:updated event', { planId, version, data });

      // CRITICAL FIX: Pass event structure (with data, version) to reconcileState
      const eventStructure = { data, version, optimisticId: planId };

      // Update user plan if it matches
      setUserPlan(prev => {
        if (!prev || prev._id !== planId) return prev;
        const reconciled = reconcileState(prev, eventStructure);
        logger.debug('[usePlanManagement] Reconciled updated plan', {
          planId,
          version,
          reconciledPlanId: reconciled?._id
        });
        return reconciled || prev;
      });

      // Update collaborative plans
      setCollaborativePlans(prev =>
        prev.map(p => {
          if (p._id === planId) {
            const reconciled = reconcileState(p, eventStructure);
            return reconciled || p;
          }
          return p;
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
  }, [experienceId, userId]);

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

  // Compute selected plan from ID
  const selectedPlan = selectedPlanId
    ? collaborativePlans.find(p => p._id === selectedPlanId) || userPlan
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
    deletePlan
  };
}

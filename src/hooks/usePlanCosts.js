/**
 * usePlanCosts Hook
 *
 * Manages cost tracking state and operations for a plan.
 * Handles fetching, adding, updating, and deleting costs.
 *
 * @param {string} planId - The plan ID to manage costs for
 * @param {Object} options - Hook options
 * @param {boolean} options.autoFetch - Whether to fetch costs on mount (default: true)
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  getPlanCosts,
  getPlanCostSummary,
  addPlanCost,
  updatePlanCost,
  deletePlanCost,
} from '../utilities/plans-api';
import { logger } from '../utilities/logger';
import { eventBus } from '../utilities/event-bus';

export default function usePlanCosts(planId, options = {}) {
  const { autoFetch = true } = options;

  // State
  const [costs, setCosts] = useState([]);
  const [costSummary, setCostSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Fetch costs for the plan
   */
  const fetchCosts = useCallback(async (filters = {}) => {
    if (!planId) return;

    setLoading(true);
    setError(null);

    try {
      const [costsData, summaryData] = await Promise.all([
        getPlanCosts(planId, filters),
        getPlanCostSummary(planId),
      ]);

      setCosts(costsData || []);
      setCostSummary(summaryData || null);
    } catch (err) {
      logger.error('Failed to fetch plan costs', { planId, error: err.message });
      setError(err.message || 'Failed to fetch costs');
    } finally {
      setLoading(false);
    }
  }, [planId]);

  /**
   * Add a new cost to the plan
   */
  const handleAddCost = useCallback(async (targetPlanId, costData) => {
    const id = targetPlanId || planId;
    if (!id) {
      throw new Error('Plan ID is required');
    }

    try {
      const result = await addPlanCost(id, costData);

      // Update local state optimistically
      if (result) {
        setCosts(prev => [...prev, result]);
        // Refetch summary to get updated totals
        const summaryData = await getPlanCostSummary(id);
        setCostSummary(summaryData);
      }

      return result;
    } catch (err) {
      logger.error('Failed to add cost', { planId: id, error: err.message });
      throw err;
    }
  }, [planId]);

  /**
   * Update an existing cost
   */
  const handleUpdateCost = useCallback(async (targetPlanId, costId, updates) => {
    const id = targetPlanId || planId;
    if (!id || !costId) {
      throw new Error('Plan ID and Cost ID are required');
    }

    try {
      const result = await updatePlanCost(id, costId, updates);

      // Update local state
      if (result) {
        setCosts(prev =>
          prev.map(cost =>
            cost._id === costId ? { ...cost, ...result } : cost
          )
        );
        // Refetch summary to get updated totals
        const summaryData = await getPlanCostSummary(id);
        setCostSummary(summaryData);
      }

      return result;
    } catch (err) {
      logger.error('Failed to update cost', { planId: id, costId, error: err.message });
      throw err;
    }
  }, [planId]);

  /**
   * Delete a cost
   */
  const handleDeleteCost = useCallback(async (targetPlanId, costId) => {
    const id = targetPlanId || planId;
    if (!id || !costId) {
      throw new Error('Plan ID and Cost ID are required');
    }

    try {
      await deletePlanCost(id, costId);

      // Remove from local state
      setCosts(prev => prev.filter(cost => cost._id !== costId));
      // Refetch summary to get updated totals
      const summaryData = await getPlanCostSummary(id);
      setCostSummary(summaryData);
    } catch (err) {
      logger.error('Failed to delete cost', { planId: id, costId, error: err.message });
      throw err;
    }
  }, [planId]);

  /**
   * Clear costs state
   */
  const clearCosts = useCallback(() => {
    setCosts([]);
    setCostSummary(null);
    setError(null);
  }, []);

  // Auto-fetch on plan ID change
  useEffect(() => {
    if (autoFetch && planId) {
      fetchCosts();
    } else if (!planId) {
      clearCosts();
    }
  }, [planId, autoFetch, fetchCosts, clearCosts]);

  // Track last event version to prevent duplicate processing
  const lastEventVersionRef = useRef(0);

  // Subscribe to cost events via event bus for real-time updates
  useEffect(() => {
    if (!planId) return;

    const handleCostAdded = (event) => {
      const { planId: eventPlanId, cost, version } = event.detail || event;

      // Only process events for this plan
      if (eventPlanId !== planId && eventPlanId?.toString() !== planId?.toString()) return;

      // Deduplicate by version
      if (version && version <= lastEventVersionRef.current) return;
      if (version) lastEventVersionRef.current = version;

      logger.debug('usePlanCosts: cost_added event received', { planId: eventPlanId, cost });

      if (cost) {
        setCosts(prev => {
          // Don't add if already exists (optimistic update already added it)
          if (prev.some(c => c._id === cost._id)) return prev;
          return [...prev, cost];
        });
        // Refetch summary for updated totals
        getPlanCostSummary(planId).then(setCostSummary).catch(() => {});
      }
    };

    const handleCostUpdated = (event) => {
      const { planId: eventPlanId, costId, cost, version } = event.detail || event;

      // Only process events for this plan
      if (eventPlanId !== planId && eventPlanId?.toString() !== planId?.toString()) return;

      // Deduplicate by version
      if (version && version <= lastEventVersionRef.current) return;
      if (version) lastEventVersionRef.current = version;

      logger.debug('usePlanCosts: cost_updated event received', { planId: eventPlanId, costId, cost });

      if (costId && cost) {
        setCosts(prev =>
          prev.map(c => c._id === costId ? { ...c, ...cost } : c)
        );
        // Refetch summary for updated totals
        getPlanCostSummary(planId).then(setCostSummary).catch(() => {});
      }
    };

    const handleCostDeleted = (event) => {
      const { planId: eventPlanId, costId, version } = event.detail || event;

      // Only process events for this plan
      if (eventPlanId !== planId && eventPlanId?.toString() !== planId?.toString()) return;

      // Deduplicate by version
      if (version && version <= lastEventVersionRef.current) return;
      if (version) lastEventVersionRef.current = version;

      logger.debug('usePlanCosts: cost_deleted event received', { planId: eventPlanId, costId });

      if (costId) {
        setCosts(prev => prev.filter(c => c._id !== costId));
        // Refetch summary for updated totals
        getPlanCostSummary(planId).then(setCostSummary).catch(() => {});
      }
    };

    // Subscribe via event bus (handles cross-tab sync)
    const unsubscribeAdded = eventBus.subscribe('plan:cost_added', handleCostAdded);
    const unsubscribeUpdated = eventBus.subscribe('plan:cost_updated', handleCostUpdated);
    const unsubscribeDeleted = eventBus.subscribe('plan:cost_deleted', handleCostDeleted);

    // Also listen for direct window events (same-tab)
    window.addEventListener('plan:cost_added', handleCostAdded);
    window.addEventListener('plan:cost_updated', handleCostUpdated);
    window.addEventListener('plan:cost_deleted', handleCostDeleted);

    return () => {
      unsubscribeAdded();
      unsubscribeUpdated();
      unsubscribeDeleted();
      window.removeEventListener('plan:cost_added', handleCostAdded);
      window.removeEventListener('plan:cost_updated', handleCostUpdated);
      window.removeEventListener('plan:cost_deleted', handleCostDeleted);
    };
  }, [planId]);

  return {
    // State
    costs,
    costSummary,
    loading,
    error,

    // Actions
    fetchCosts,
    addCost: handleAddCost,
    updateCost: handleUpdateCost,
    deleteCost: handleDeleteCost,
    clearCosts,

    // Computed
    totalCost: costSummary?.totalCost || costs.reduce((sum, c) => sum + (c.cost || 0), 0),
    hasCosts: costs.length > 0,
  };
}

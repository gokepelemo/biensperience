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

import { useState, useCallback, useEffect } from 'react';
import {
  getPlanCosts,
  getPlanCostSummary,
  addPlanCost,
  updatePlanCost,
  deletePlanCost,
} from '../utilities/plans-api';
import { logger } from '../utilities/logger';

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

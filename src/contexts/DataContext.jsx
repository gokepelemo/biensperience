import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { getDestinations } from '../utilities/destinations-api';
import { getExperiences } from '../utilities/experiences-api';
import { getUserPlans } from '../utilities/plans-api';
import { useUser } from './UserContext';
import { logger } from '../utilities/logger';

logger.debug('DataContext module loaded');

const DataContext = createContext();

/**
 * Hook to access global data state
 * @returns {Object} Data context with destinations, experiences, plans, and refresh functions
 */
export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}

/**
 * Data Provider Component
 * Centralized state management for destinations, experiences, and plans
 * Provides instant UI updates across all components when data changes
 * Integrates with UserContext for user-specific data filtering
 */
export function DataProvider({ children }) {
  logger.debug('DataProvider function called');
  const { user, isAuthenticated } = useUser();
  const [destinations, setDestinations] = useState([]);
  const [experiences, setExperiences] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState({
    destinations: null,
    experiences: null,
    plans: null,
  });

  /**
   * Fetch all destinations from API
   * @returns {Promise<Array>} Array of destinations
   */
  const fetchDestinations = useCallback(async () => {
    logger.debug('fetchDestinations called', { user: user?.email || 'null' });
    if (!user) {
      logger.debug('No user, returning empty array');
      return [];
    }

    try {
      logger.debug('Calling getDestinations API');
      const data = await getDestinations();
      logger.debug('getDestinations returned', { count: data?.length || 0 });
      setDestinations(data || []);
      setLastUpdated(prev => ({ ...prev, destinations: new Date() }));
      return data || [];
    } catch (error) {
      logger.error('Failed to fetch destinations', { user: user?.email }, error);
      return [];
    }
  }, [user]);

  /**
   * Fetch all experiences from API
   * @returns {Promise<Array>} Array of experiences
   */
  const fetchExperiences = useCallback(async () => {
    if (!user) return [];

    try {
      const data = await getExperiences();
      setExperiences(data || []);
      setLastUpdated(prev => ({ ...prev, experiences: new Date() }));
      return data || [];
    } catch (error) {
      logger.error('Failed to fetch experiences', { user: user?.email }, error);
      return [];
    }
  }, [user]);

  /**
   * Fetch all user plans from API
   * @returns {Promise<Array>} Array of plans
   */
  const fetchPlans = useCallback(async () => {
    if (!user) return [];

    try {
      const data = await getUserPlans();
      setPlans(data || []);
      setLastUpdated(prev => ({ ...prev, plans: new Date() }));
      return data || [];
    } catch (error) {
      logger.error('Failed to fetch plans', { user: user?.email }, error);
      return [];
    }
  }, [user]);

  /**
   * Refresh all data (destinations, experiences, and plans)
   * @param {Object} options - Options for selective refresh
   * @param {boolean} options.destinations - Refresh destinations
   * @param {boolean} options.experiences - Refresh experiences
   * @param {boolean} options.plans - Refresh plans
   * @returns {Promise<void>}
   */
  const refreshAll = useCallback(async (options = {}) => {
    if (!user) {
      logger.debug('refreshAll called but no user, returning early');
      return;
    }

    logger.debug('refreshAll called', { user: user.email, options });

    const {
      destinations: refreshDestinations = true,
      experiences: refreshExperiences = true,
      plans: refreshPlans = true,
    } = options;

    setLoading(true);
    try {
      const promises = [];

      if (refreshDestinations) {
        logger.debug('Adding fetchDestinations to promises');
        promises.push(fetchDestinations());
      }
      if (refreshExperiences) {
        logger.debug('Adding fetchExperiences to promises');
        promises.push(fetchExperiences());
      }
      if (refreshPlans) {
        logger.debug('Adding fetchPlans to promises');
        promises.push(fetchPlans());
      }

      logger.debug('Executing fetch promises', { count: promises.length });
      const results = await Promise.all(promises);
      logger.debug('refreshAll completed', { results: results.map(r => r?.length || 0) });

    } catch (error) {
      logger.error('Failed to refresh data', { user: user.email }, error);
    } finally {
      setLoading(false);
    }
  }, [user, fetchDestinations, fetchExperiences, fetchPlans]);

  /**
   * Update a single destination in state (optimistic update)
   * @param {string} destinationId - Destination ID
   * @param {Object} updates - Updated destination data
   */
  const updateDestination = useCallback((destinationId, updates) => {
    setDestinations(prev =>
      prev.map(dest =>
        dest._id === destinationId ? { ...dest, ...updates } : dest
      )
    );
  }, []);

  /**
   * Add a new destination to state (optimistic update)
   * @param {Object} destination - New destination object
   */
  const addDestination = useCallback((destination) => {
    setDestinations(prev => [...prev, destination]);
    setLastUpdated(prev => ({ ...prev, destinations: new Date() }));
  }, []);

  /**
   * Remove a destination from state (optimistic update)
   * @param {string} destinationId - Destination ID to remove
   */
  const removeDestination = useCallback((destinationId) => {
    setDestinations(prev => prev.filter(dest => dest._id !== destinationId));
    setLastUpdated(prev => ({ ...prev, destinations: new Date() }));
  }, []);

  /**
   * Update a single experience in state (optimistic update)
   * @param {string} experienceId - Experience ID
   * @param {Object} updates - Updated experience data
   */
  const updateExperience = useCallback((experienceId, updates) => {
    setExperiences(prev =>
      prev.map(exp =>
        exp._id === experienceId ? { ...exp, ...updates } : exp
      )
    );
  }, []);

  /**
   * Add a new experience to state (optimistic update)
   * @param {Object} experience - New experience object
   */
  const addExperience = useCallback((experience) => {
    setExperiences(prev => [...prev, experience]);
    setLastUpdated(prev => ({ ...prev, experiences: new Date() }));
  }, []);

  /**
   * Remove an experience from state (optimistic update)
   * @param {string} experienceId - Experience ID to remove
   */
  const removeExperience = useCallback((experienceId) => {
    setExperiences(prev => prev.filter(exp => exp._id !== experienceId));
    setLastUpdated(prev => ({ ...prev, experiences: new Date() }));
  }, []);

  /**
   * Update a single plan in state (optimistic update)
   * @param {string} planId - Plan ID
   * @param {Object} updates - Updated plan data
   */
  const updatePlan = useCallback((planId, updates) => {
    setPlans(prev =>
      prev.map(plan =>
        plan._id === planId ? { ...plan, ...updates } : plan
      )
    );
  }, []);

  /**
   * Add a new plan to state (optimistic update)
   * @param {Object} plan - New plan object
   */
  const addPlan = useCallback((plan) => {
    setPlans(prev => [...prev, plan]);
    setLastUpdated(prev => ({ ...prev, plans: new Date() }));
  }, []);

  /**
   * Remove a plan from state (optimistic update)
   * @param {string} planId - Plan ID to remove
   */
  const removePlan = useCallback((planId) => {
    setPlans(prev => prev.filter(plan => plan._id !== planId));
    setLastUpdated(prev => ({ ...prev, plans: new Date() }));
  }, []);

  /**
   * Get a specific destination by ID
   * @param {string} destinationId - Destination ID
   * @returns {Object|null} Destination object or null
   */
  const getDestination = useCallback((destinationId) => {
    return destinations.find(dest => dest._id === destinationId) || null;
  }, [destinations]);

  /**
   * Get a specific experience by ID
   * @param {string} experienceId - Experience ID
   * @returns {Object|null} Experience object or null
   */
  const getExperience = useCallback((experienceId) => {
    return experiences.find(exp => exp._id === experienceId) || null;
  }, [experiences]);

  /**
   * Get a specific plan by ID
   * @param {string} planId - Plan ID
   * @returns {Object|null} Plan object or null
   */
  const getPlan = useCallback((planId) => {
    return plans.find(plan => plan._id === planId) || null;
  }, [plans]);

  /**
   * Get user's plan for a specific experience
   * @param {string} experienceId - Experience ID
   * @returns {Object|null} Plan object or null
   */
  const getUserPlanForExperience = useCallback((experienceId) => {
    return plans.find(plan => plan.experience === experienceId || plan.experience._id === experienceId) || null;
  }, [plans]);

  // Initial data fetch on mount or when user changes
  useEffect(() => {
    logger.debug('DataContext useEffect triggered', {
      isAuthenticated,
      user: user ? { email: user.email, _id: user._id } : null
    });
    if (isAuthenticated && user) {
      logger.debug('Calling refreshAll()', { user: user.email });
      refreshAll();
    } else {
      logger.debug('Clearing data - user not authenticated or user is null');
      // Clear data when user logs out
      setDestinations([]);
      setExperiences([]);
      setPlans([]);
    }
  }, [isAuthenticated, user, refreshAll]); // Include refreshAll to satisfy linting

  const value = {
    // State
    destinations,
    experiences,
    plans,
    loading,
    lastUpdated,

    // Fetch functions
    fetchDestinations,
    fetchExperiences,
    fetchPlans,
    refreshAll,

    // Getters
    getDestination,
    getExperience,
    getPlan,
    getUserPlanForExperience,

    // Optimistic update functions
    updateDestination,
    addDestination,
    removeDestination,
    updateExperience,
    addExperience,
    removeExperience,
    updatePlan,
    addPlan,
    removePlan,
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

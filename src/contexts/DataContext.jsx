import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { getDestinations, getDestinationsPage } from '../utilities/destinations-api';
import { getExperiences, getExperiencesPage } from '../utilities/experiences-api';
import { showExperience } from '../utilities/experiences-api';
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
  const [destinationsFilters, setDestinationsFilters] = useState({});
  const [experiences, setExperiences] = useState([]);
  const [destinationsMeta, setDestinationsMeta] = useState({ page: 0, limit: 30, total: 0, totalPages: 0, hasMore: true });
  const [experiencesMeta, setExperiencesMeta] = useState({ page: 0, limit: 30, total: 0, totalPages: 0, hasMore: true });
  const [experiencesFilters, setExperiencesFilters] = useState({});
  const experiencesFiltersRef = React.useRef(experiencesFilters);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState({
    destinations: null,
    experiences: null,
    plans: null,
  });
  // Track the most recent immediate-set of experiences (stale-while-revalidate)
  const [immediateExperiences, setImmediateExperiences] = useState(null);
  // Background refresh threshold for cached/plausible data (stale-while-revalidate)
  const STALE_AFTER_MS = 2 * 60 * 1000; // 2 minutes

  /**
   * Fetch all destinations from API
   * @returns {Promise<Array>} Array of destinations
   */
  const fetchDestinations = useCallback(async () => {
    logger.debug('fetchDestinations called', { user: user ? user.email : 'null' });

    try {
      logger.debug('Calling getDestinations API (page=1)');
      const resp = await getDestinations(destinationsFilters);
      // resp should be object with data/meta from API
      if (resp && resp.data && resp.meta) {
        setDestinations(resp.data || []);
        setDestinationsMeta(resp.meta);
        setLastUpdated(prev => ({ ...prev, destinations: new Date() }));
        return resp.data || [];
      } else if (Array.isArray(resp)) {
        // Backwards compatibility: if API returns array, treat as single page
        setDestinations(resp || []);
        setDestinationsMeta({ page: 1, limit: resp.length, total: resp.length, totalPages: 1, hasMore: false });
        setLastUpdated(prev => ({ ...prev, destinations: new Date() }));
        return resp || [];
      } else {
        logger.warn('Unexpected destinations response format', { resp });
        return [];
      }
    } catch (error) {
      logger.error('Failed to fetch destinations', { error: error.message });
      return [];
    }
  }, [destinationsFilters]);

  // Keep a ref with the latest experiencesFilters to avoid stale closures in
  // async fetch functions. This lets fetchMoreExperiences and fetchExperiences
  // always read the most recent filters without requiring them in dependency
  // arrays (which could otherwise trigger re-creations and unexpected effects).
  useEffect(() => {
    experiencesFiltersRef.current = experiencesFilters;
  }, [experiencesFilters]);

  const applyDestinationsFilter = useCallback(async (filters = {}) => {
    setDestinationsFilters(filters || {});
    setDestinations([]);
    setDestinationsMeta({ page: 0, limit: 30, total: 0, totalPages: 0, hasMore: true });
    return await fetchDestinations();
  }, [fetchDestinations]);

  /**
   * Fetch all experiences from API
   * @returns {Promise<Array>} Array of experiences
   */
  const fetchExperiences = useCallback(async (filters = {}) => {

    // Use provided filters or the latest filters from ref
    const appliedFilters = Object.keys(filters).length ? filters : (experiencesFiltersRef.current || {});

    try {
      // If caller passed explicit filters, treat this as a new query and reset state
      if (Object.keys(filters).length) {
        setExperiences([]);
        setExperiencesMeta({ page: 0, limit: 30, total: 0, totalPages: 0, hasMore: true });
      }

      const resp = await getExperiences(appliedFilters);

      // resp should be object with data/meta from API
      if (resp && resp.data && resp.meta) {
        setExperiences(resp.data || []);
        setExperiencesMeta(resp.meta);
        setLastUpdated(prev => ({ ...prev, experiences: new Date() }));
        return resp.data || [];
      } else if (Array.isArray(resp)) {
        // Backwards compatibility: if API returns array, treat as single page
        setExperiences(resp || []);
        setExperiencesMeta({ page: 1, limit: resp.length, total: resp.length, totalPages: 1, hasMore: false });
        setLastUpdated(prev => ({ ...prev, experiences: new Date() }));
        return resp || [];
      } else {
        logger.warn('Unexpected experiences response format', { resp });
        return [];
      }
    } catch (error) {
      logger.error('Failed to fetch experiences', { error: error.message });
      return [];
    }
  }, []);

  /**
   * Immediately set experiences in context from provided data (stale-while-revalidate)
   * Shows the provided items to the UI synchronously, then triggers a background
   * refresh from the API to replace with fresh results for the same filters.
   * @param {Array} items - Array of experience objects to show immediately
   * @param {Object} options - Optional params: { meta, filters, backgroundRefresh }
   */
  const setExperiencesImmediate = useCallback((items = [], options = {}) => {
  const { meta = null, filters = null, backgroundRefresh = true } = options || {};
    try {
      // Synchronously show provided items so navigating views render instantly
      setExperiences(Array.isArray(items) ? items : (items && items.data ? items.data : []));
      if (meta) {
        setExperiencesMeta(meta);
      } else if (Array.isArray(items)) {
        // If caller provided items but no meta, set a reasonable meta so
        // pagination / infinite-scroll logic can operate (page=1). We
        // default hasMore to false since we don't know total; callers
        // may override by passing meta.
        const len = items.length;
        if (len > 0) {
          setExperiencesMeta(prev => ({ ...prev, page: 1, limit: prev.limit || len, total: len, totalPages: 1, hasMore: false }));
        }
      }
      if (filters) setExperiencesFilters(filters || {});
      setLastUpdated(prev => ({ ...prev, experiences: new Date() }));

      if (!backgroundRefresh) {
        // still record immediate marker without a refresh
        // normalize filters to an object so consumers can compare reliably
        const normalizedFilters = filters ?? {};
        // Update filters in context immediately so other helpers (fetchMore) can use them
        setExperiencesFilters(normalizedFilters);
        experiencesFiltersRef.current = normalizedFilters;
        setImmediateExperiences({ filters: normalizedFilters, at: Date.now(), status: 'done', promise: Promise.resolve([]) });
        return Promise.resolve([]);
      }

      // Create a refresh promise so callers can deterministically wait for the
      // canonical server refresh to complete. We record the promise in the
      // immediateExperiences marker so views can inspect status or await it.
      const at = Date.now();
      let resolveFn;
      let rejectFn;
      const refreshPromise = new Promise((resolve, reject) => {
        resolveFn = resolve;
        rejectFn = reject;
      });

      // set marker as refreshing
  // Normalize filters to object ({} when null) so views can compare via JSON
  const normalizedFilters = filters ?? {};
  // Update filters in context immediately so other helpers (fetchMore) can use them
  setExperiencesFilters(normalizedFilters);
  experiencesFiltersRef.current = normalizedFilters;
  setImmediateExperiences({ filters: normalizedFilters, at, status: 'refreshing', promise: refreshPromise });

      // Run the refresh (do not block the caller). Use fetchExperiences to keep
      // canonical fetch logic centralized.
      (async () => {
        try {
          // If caller set a special __noApiParam flag, avoid passing those filters to the API
          const apiFilters = (filters && filters.__noApiParam) ? {} : (filters || experiencesFiltersRef.current || {});
          const resp = await fetchExperiences(apiFilters);
          // mark done
          setImmediateExperiences({ filters: normalizedFilters, at, status: 'done', promise: refreshPromise });
          resolveFn(resp || []);
        } catch (err) {
          setImmediateExperiences({ filters: normalizedFilters, at, status: 'error', promise: refreshPromise });
          logger.debug('Background refresh of experiences failed', { error: err?.message || err });
          rejectFn(err);
        }
      })();

      return refreshPromise;
    } catch (err) {
      logger.error('setExperiencesImmediate failed', { error: err?.message || err });
      return Promise.reject(err);
    }
  }, [fetchExperiences]);

  // Fetch next page of destinations and append to state
  const fetchMoreDestinations = useCallback(async () => {
    // If initial page hasn't been loaded yet, don't fetch more
    if (!destinationsMeta || destinationsMeta.page < 1) {
      logger.debug('fetchMoreDestinations: waiting for initial page', { meta: destinationsMeta });
      return [];
    }
    // Check if there are more pages available
    if (!destinationsMeta.hasMore) {
      logger.debug('fetchMoreDestinations: no more pages', { meta: destinationsMeta });
      return [];
    }

    const nextPage = destinationsMeta.page + 1;
    logger.debug('fetchMoreDestinations: fetching page', { nextPage, currentPage: destinationsMeta.page });

    try {
      const resp = await getDestinationsPage(nextPage, destinationsMeta.limit || 30, destinationsFilters);
      if (resp && resp.data && resp.meta) {
        setDestinations(prev => [...prev, ...resp.data]);
        setDestinationsMeta(resp.meta);
        setLastUpdated(prev => ({ ...prev, destinations: new Date() }));
        logger.debug('fetchMoreDestinations: success', { newItems: resp.data.length, newMeta: resp.meta });
        return resp.data;
      }
      return [];
    } catch (err) {
      logger.error('Failed to fetch more destinations', { error: err.message, nextPage });
      return [];
    }
  }, [destinationsMeta, destinationsFilters]);

  // Fetch next page of experiences and append to state
  const fetchMoreExperiences = useCallback(async (filters = null) => {
    const appliedFilters = filters || experiencesFiltersRef.current || {};
    // If initial page hasn't been loaded yet, don't fetch more (prevents requesting page=2 before page=1)
    if (!experiencesMeta || experiencesMeta.page < 1) {
      logger.debug('fetchMoreExperiences: waiting for initial page', { meta: experiencesMeta });
      return [];
    }
    // Check if there are more pages available
    if (!experiencesMeta.hasMore) {
      logger.debug('fetchMoreExperiences: no more pages', { meta: experiencesMeta });
      return [];
    }

    const nextPage = experiencesMeta.page + 1;
    logger.debug('fetchMoreExperiences: fetching page', { nextPage, currentPage: experiencesMeta.page });

    try {
      const resp = await getExperiencesPage(nextPage, experiencesMeta.limit || 30, appliedFilters);
      if (resp && resp.data && resp.meta) {
        setExperiences(prev => [...prev, ...resp.data]);
        setExperiencesMeta(resp.meta);
        setLastUpdated(prev => ({ ...prev, experiences: new Date() }));
        logger.debug('fetchMoreExperiences: success', { newItems: resp.data.length, newMeta: resp.meta });
        return resp.data;
      }
      return [];
    } catch (err) {
      logger.error('Failed to fetch more experiences', { error: err.message, nextPage });
      return [];
    }
  }, [experiencesMeta]);

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
      logger.error('Failed to fetch plans', { error: error.message });
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
      logger.error('Failed to refresh data', { error: error.message });
    } finally {
      setLoading(false);
    }
  }, [user, fetchDestinations, fetchExperiences, fetchPlans]);

  /**
   * Update a single destination in state (optimistic update)
   * @param {Object} updatedDestination - Full updated destination object
   */
  const updateDestination = useCallback((updatedDestination) => {
    setDestinations(prev =>
      prev.map(dest =>
        dest._id === updatedDestination._id ? { ...dest, ...updatedDestination } : dest
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
   * @param {Object} updatedExperience - Full updated experience object
   */
  const updateExperience = useCallback((updatedExperience) => {
    setExperiences(prev =>
      prev.map(exp =>
        exp._id === updatedExperience._id ? { ...exp, ...updatedExperience } : exp
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

  // Apply filters for experiences (sets filters and fetches first page)
  // NOTE: keep this function identity stable and avoid depending on fetchExperiences
  // to prevent causing effects that depend on this function to re-run when
  // internal fetch functions change identity (which can create render loops).
  const applyExperiencesFilter = useCallback(async (filters = {}) => {
    const cleanFilters = filters || {};
    setExperiencesFilters(cleanFilters);
    logger.info('applyExperiencesFilter called', {
      filters: cleanFilters,
      hasViewSpecific: cleanFilters.__viewSpecific,
      isEmpty: Object.keys(cleanFilters).length === 0
    });
    // Reset experiences and fetch first page with filters
    setExperiences([]);
    setExperiencesMeta({ page: 0, limit: 30, total: 0, totalPages: 0, hasMore: true });

    try {
      // Call the API directly rather than delegating to fetchExperiences
      const resp = await getExperiences(cleanFilters);

      // resp should be object with data/meta from API
      if (resp && resp.data && resp.meta) {
        setExperiences(resp.data || []);
        setExperiencesMeta(resp.meta);
        setLastUpdated(prev => ({ ...prev, experiences: new Date() }));
        return resp.data || [];
      } else if (Array.isArray(resp)) {
        // Backwards compatibility: if API returns array, treat as single page
        setExperiences(resp || []);
        setExperiencesMeta({ page: 1, limit: resp.length, total: resp.length, totalPages: 1, hasMore: false });
        setLastUpdated(prev => ({ ...prev, experiences: new Date() }));
        return resp || [];
      } else {
        logger.warn('Unexpected experiences filter response format', { resp });
        return [];
      }
    } catch (error) {
      logger.error('Failed to apply experiences filter', { error: error.message });
      return [];
    }
  }, []);

  // Initial data fetch on mount or when user changes
  useEffect(() => {
    logger.debug('DataContext useEffect triggered', {
      isAuthenticated,
      user: user ? { email: user.email, _id: user._id } : null,
      userId: user?._id
    });
    if (isAuthenticated && user) {
      logger.debug('Calling refreshAll() for user', { user: user.email });
      refreshAll();
    } else {
      logger.debug('Clearing data - user not authenticated or user is null');
      // Clear data when user logs out
      setDestinations([]);
      setExperiences([]);
      setPlans([]);
    }
  }, [isAuthenticated, user, refreshAll]); // Include refreshAll to satisfy linting

  // Listen for global plan lifecycle events (created/updated/deleted) and
  // update DataContext plans so all consumers reflect changes immediately.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onPlanCreated = (e) => {
      try {
        const detail = e?.detail || {};
        const plan = detail.plan;
        if (!plan || !plan._id) return;
        setPlans(prev => {
          const exists = prev.some(p => p._id && p._id.toString() === plan._id.toString());
          if (exists) {
            return prev.map(p => (p._id && p._id.toString() === plan._id.toString() ? plan : p));
          }
          return [plan, ...prev];
        });
        setLastUpdated(prev => ({ ...prev, plans: new Date() }));
        // Also refresh the related experience in context so views that read
        // from DataContext don't get a stale experience after a plan change.
        (async () => {
          try {
            const rawExp = detail.experienceId || plan?.experience?._id || plan?.experience || null;
            const expId = rawExp && rawExp.toString ? rawExp.toString() : rawExp;
            if (!expId) return;
            const updatedExp = await showExperience(expId);
            if (!updatedExp) return;
            setExperiences(prev => {
              const found = prev.findIndex(x => x._id && (x._id.toString ? x._id.toString() === updatedExp._id.toString() : x._id === updatedExp._id));
              if (found >= 0) {
                const copy = [...prev];
                copy[found] = updatedExp;
                return copy;
              }
              // If experience not in list, add it to front to ensure freshness
              return [updatedExp, ...prev];
            });
            setLastUpdated(prev => ({ ...prev, experiences: new Date() }));
          } catch (err) {
            logger.debug('Failed to refresh experience after plan create', { error: err?.message });
          }
        })();
      } catch (err) {
        logger.warn('DataContext onPlanCreated handler failed', { error: err?.message });
      }
    };

    const onPlanUpdated = (e) => {
      try {
        const detail = e?.detail || {};
        const plan = detail.plan;
        if (!plan || !plan._id) return;
        setPlans(prev => prev.map(p => (p._id && plan._id && p._id.toString() === plan._id.toString() ? { ...p, ...plan } : p)));
        setLastUpdated(prev => ({ ...prev, plans: new Date() }));
        // Keep the related experience fresh as well
        (async () => {
          try {
            const rawExp = detail.experienceId || plan?.experience?._id || plan?.experience || null;
            const expId = rawExp && rawExp.toString ? rawExp.toString() : rawExp;
            if (!expId) return;
            const updatedExp = await showExperience(expId);
            if (!updatedExp) return;
            setExperiences(prev => prev.map(x => (x._id && (x._id.toString ? x._id.toString() === updatedExp._id.toString() : x._id === updatedExp._id) ? updatedExp : x)));
            setLastUpdated(prev => ({ ...prev, experiences: new Date() }));
          } catch (err) {
            logger.debug('Failed to refresh experience after plan update', { error: err?.message });
          }
        })();
      } catch (err) {
        logger.warn('DataContext onPlanUpdated handler failed', { error: err?.message });
      }
    };

    const onPlanDeleted = (e) => {
      try {
        const detail = e?.detail || {};
        const plan = detail.plan;
        const experienceId = detail.experienceId || (plan && (plan.experience?._id || plan.experience)) || null;
        if (plan && plan._id) {
          setPlans(prev => prev.filter(p => !(p._id && p._id.toString() === plan._id.toString())));
          setLastUpdated(prev => ({ ...prev, plans: new Date() }));
          return;
        }
        if (experienceId) {
          const expId = experienceId && experienceId.toString ? experienceId.toString() : experienceId;
          setPlans(prev => prev.filter(p => {
            const pExp = p.experience?._id || p.experience || null;
            return !(pExp && pExp.toString ? pExp.toString() === expId : pExp === expId);
          }));
          setLastUpdated(prev => ({ ...prev, plans: new Date() }));
          // Also refresh the experience to remove plan-related flags
          (async () => {
            try {
              const updatedExp = await showExperience(expId);
              if (!updatedExp) return;
              setExperiences(prev => prev.map(x => (x._id && (x._id.toString ? x._id.toString() === updatedExp._id.toString() : x._id === updatedExp._id) ? updatedExp : x)));
              setLastUpdated(prev => ({ ...prev, experiences: new Date() }));
            } catch (err) {
              logger.debug('Failed to refresh experience after plan delete', { error: err?.message });
            }
          })();
        }
      } catch (err) {
        logger.warn('DataContext onPlanDeleted handler failed', { error: err?.message });
      }
    };

    window.addEventListener('bien:plan_created', onPlanCreated);
    window.addEventListener('bien:plan_updated', onPlanUpdated);
    window.addEventListener('bien:plan_deleted', onPlanDeleted);

    return () => {
      window.removeEventListener('bien:plan_created', onPlanCreated);
      window.removeEventListener('bien:plan_updated', onPlanUpdated);
      window.removeEventListener('bien:plan_deleted', onPlanDeleted);
    };
  }, []);

  // Background refresh when we detect potentially stale cached data in memory
  // Triggers non-blocking refreshes while keeping current UI responsive
  useEffect(() => {
    if (!user) return;

    const now = Date.now();

    const isStale = (d) => {
      if (!d) return true;
      const t = typeof d === 'number' ? d : new Date(d).getTime();
      return now - t > STALE_AFTER_MS;
    };

    // Destinations
    if (destinations.length > 0 && isStale(lastUpdated.destinations)) {
      Promise.resolve(fetchDestinations()).catch(() => {});
    }

    // Experiences
    if (experiences.length > 0 && isStale(lastUpdated.experiences)) {
      Promise.resolve(fetchExperiences()).catch(() => {});
    }

    // Plans
    if (plans.length > 0 && isStale(lastUpdated.plans)) {
      Promise.resolve(fetchPlans()).catch(() => {});
    }
  }, [
    user,
    destinations.length,
    experiences.length,
    plans.length,
    lastUpdated.destinations,
    lastUpdated.experiences,
    lastUpdated.plans,
    fetchDestinations,
    fetchExperiences,
    fetchPlans,
  ]);

  // Event bus listeners - update DataContext when events are broadcast
  useEffect(() => {
    const handleExperienceUpdated = (event) => {
      const { experience } = event.detail || {};
      if (experience && experience._id) {
        logger.debug('[DataContext] experience:updated event received', { id: experience._id });
        updateExperience(experience);
      }
    };

    const handleExperienceCreated = (event) => {
      const { experience } = event.detail || {};
      if (experience && experience._id) {
        logger.debug('[DataContext] experience:created event received', { id: experience._id });
        addExperience(experience);
      }
    };

    const handleExperienceDeleted = (event) => {
      const { experienceId } = event.detail || {};
      if (experienceId) {
        logger.debug('[DataContext] experience:deleted event received', { id: experienceId });
        removeExperience(experienceId);
      }
    };

    const handleDestinationUpdated = (event) => {
      const { destination } = event.detail || {};
      if (destination && destination._id) {
        logger.debug('[DataContext] destination:updated event received', { id: destination._id });
        updateDestination(destination);
      }
    };

    const handleDestinationCreated = (event) => {
      const { destination } = event.detail || {};
      if (destination && destination._id) {
        logger.debug('[DataContext] destination:created event received', { id: destination._id });
        addDestination(destination);
      }
    };

    const handleDestinationDeleted = (event) => {
      const { destinationId } = event.detail || {};
      if (destinationId) {
        logger.debug('[DataContext] destination:deleted event received', { id: destinationId });
        removeDestination(destinationId);
      }
    };

    const handlePlanUpdated = (event) => {
      const { plan, planId } = event.detail || {};
      if (plan || planId) {
        const id = planId || plan?._id;
        logger.debug('[DataContext] plan:updated event received', { id });
        if (plan) {
          updatePlan(id, plan);
        } else {
          // Partial update - refetch plans
          fetchPlans().catch(() => {});
        }
      }
    };

    const handlePlanCreated = (event) => {
      const { plan } = event.detail || {};
      if (plan && plan._id) {
        logger.debug('[DataContext] plan:created event received', { id: plan._id });
        addPlan(plan);
      }
    };

    const handlePlanDeleted = (event) => {
      const { planId } = event.detail || {};
      if (planId) {
        logger.debug('[DataContext] plan:deleted event received', { id: planId });
        removePlan(planId);
      }
    };

    // Register event listeners
    window.addEventListener('experience:updated', handleExperienceUpdated);
    window.addEventListener('experience:created', handleExperienceCreated);
    window.addEventListener('experience:deleted', handleExperienceDeleted);
    window.addEventListener('destination:updated', handleDestinationUpdated);
    window.addEventListener('destination:created', handleDestinationCreated);
    window.addEventListener('destination:deleted', handleDestinationDeleted);
    window.addEventListener('plan:updated', handlePlanUpdated);
    window.addEventListener('plan:created', handlePlanCreated);
    window.addEventListener('plan:deleted', handlePlanDeleted);

    // Cleanup listeners on unmount
    return () => {
      window.removeEventListener('experience:updated', handleExperienceUpdated);
      window.removeEventListener('experience:created', handleExperienceCreated);
      window.removeEventListener('experience:deleted', handleExperienceDeleted);
      window.removeEventListener('destination:updated', handleDestinationUpdated);
      window.removeEventListener('destination:created', handleDestinationCreated);
      window.removeEventListener('destination:deleted', handleDestinationDeleted);
      window.removeEventListener('plan:updated', handlePlanUpdated);
      window.removeEventListener('plan:created', handlePlanCreated);
      window.removeEventListener('plan:deleted', handlePlanDeleted);
    };
  }, [updateExperience, addExperience, removeExperience, updateDestination, addDestination, removeDestination, updatePlan, addPlan, removePlan, fetchPlans]);

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
  // Pagination helpers
  fetchMoreDestinations,
  fetchMoreExperiences,
  destinationsMeta,
  experiencesMeta,
  // Filtering helpers
  applyDestinationsFilter,
  destinationsFilters,
  applyExperiencesFilter,
  experiencesFilters,
  // Immediate-set helper (stale-while-revalidate)
  setExperiencesImmediate,
  // Marker for immediate-set (helpers can inspect to avoid overwrite races)
  immediateExperiences,

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

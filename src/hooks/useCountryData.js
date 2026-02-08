/**
 * useCountryData Hook
 *
 * Manages all data fetching, pagination, and event subscriptions for
 * the Countries view. Extracted from Countries.jsx for better testability
 * and separation of concerns.
 *
 * @param {string} countryName - URL slug of the country (from route params)
 * @returns {Object} Country data, loading states, pagination handlers, and metadata
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { getCountryData, loadMoreDestinations, loadMoreExperiences } from '../utilities/countries-api';
import { eventBus } from '../utilities/event-bus';
import { logger } from '../utilities/logger';
import { lang } from '../lang.constants';

/**
 * Convert a URL slug to title case display name
 * e.g., "united-states" -> "United States"
 */
function slugToDisplayName(slug) {
  if (!slug) return '';
  return decodeURIComponent(slug)
    .replace(/-/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

/**
 * Normalize a country name to a slug for comparison
 * e.g., "United States" -> "united-states"
 */
function normalizeCountrySlug(name) {
  return name?.toLowerCase().replace(/[\s-]+/g, '-') || '';
}

/**
 * Create entity event handlers for real-time updates.
 * Reduces duplication between destination and experience event subscriptions.
 *
 * @param {Object} config
 * @param {string} config.entityKey - Key to extract entity from event
 * @param {string} config.entityIdKey - Key for entity ID in delete events
 * @param {Function} config.setItems - State setter for items array
 * @param {Function} config.setMeta - State setter for pagination meta
 * @param {Function} config.matchesCountry - Check if entity belongs to current country
 * @returns {Object} Object with created, updated, deleted handlers
 */
function createEntityEventHandlers({ entityKey, entityIdKey, setItems, setMeta, matchesCountry }) {
  return {
    created: (event) => {
      const created = event[entityKey] || event.detail?.[entityKey];
      if (!created?._id) return;
      if (!matchesCountry(created)) return;

      setItems(prev => [created, ...prev]);
      setMeta(prev => prev ? { ...prev, total: prev.total + 1 } : prev);
    },
    updated: (event) => {
      const updated = event[entityKey] || event.detail?.[entityKey];
      if (!updated?._id) return;

      setItems(prev =>
        prev.map(item => item._id === updated._id ? { ...item, ...updated } : item)
      );
    },
    deleted: (event) => {
      const deletedId = event[entityIdKey] || event.detail?.[entityIdKey];
      if (!deletedId) return;

      setItems(prev => prev.filter(item => item._id !== deletedId));
      setMeta(prev => prev ? { ...prev, total: Math.max(0, prev.total - 1) } : prev);
    }
  };
}

export default function useCountryData(countryName) {
  // Data state
  const [destinations, setDestinations] = useState([]);
  const [experiences, setExperiences] = useState([]);
  const [country, setCountry] = useState(null);

  // Pagination metadata
  const [destinationsMeta, setDestinationsMeta] = useState(null);
  const [experiencesMeta, setExperiencesMeta] = useState(null);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [loadingMoreDestinations, setLoadingMoreDestinations] = useState(false);
  const [loadingMoreExperiences, setLoadingMoreExperiences] = useState(false);
  const [error, setError] = useState(null);

  // Convert slug to display name; API will return canonical name
  const displayCountryName = country || slugToDisplayName(countryName);

  // Fetch initial data for the country
  const fetchCountryData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      logger.info('[Countries] Fetching country data', { country: countryName });

      const result = await getCountryData(countryName);

      setCountry(result.country);
      setDestinations(result.destinations || []);
      setExperiences(result.experiences || []);
      setDestinationsMeta(result.destinationsMeta);
      setExperiencesMeta(result.experiencesMeta);

      logger.info('[Countries] Data loaded successfully', {
        country: result.country,
        destinationsCount: result.destinations?.length || 0,
        totalDestinations: result.destinationsMeta?.total,
        experiencesCount: result.experiences?.length || 0,
        totalExperiences: result.experiencesMeta?.total
      });
    } catch (err) {
      logger.error('[Countries] Failed to fetch country data', {
        error: err.message,
        country: countryName
      });
      setError(err.message || lang.current.countriesView.failedToLoadData);
    } finally {
      setLoading(false);
    }
  }, [countryName]);

  // Load more destinations
  const handleLoadMoreDestinations = useCallback(async () => {
    if (!destinationsMeta?.hasMore || loadingMoreDestinations) return;

    try {
      setLoadingMoreDestinations(true);
      const nextPage = destinationsMeta.page + 1;

      logger.info('[Countries] Loading more destinations', { page: nextPage });

      const result = await loadMoreDestinations(countryName, nextPage, destinationsMeta.limit);

      setDestinations(prev => [...prev, ...result.destinations]);
      setDestinationsMeta(result.destinationsMeta);

      logger.info('[Countries] Loaded more destinations', {
        newCount: result.destinations.length,
        totalLoaded: destinations.length + result.destinations.length
      });
    } catch (err) {
      logger.error('[Countries] Failed to load more destinations', { error: err.message });
    } finally {
      setLoadingMoreDestinations(false);
    }
  }, [countryName, destinationsMeta, loadingMoreDestinations, destinations.length]);

  // Load more experiences
  const handleLoadMoreExperiences = useCallback(async () => {
    if (!experiencesMeta?.hasMore || loadingMoreExperiences) return;

    try {
      setLoadingMoreExperiences(true);
      const nextPage = experiencesMeta.page + 1;

      logger.info('[Countries] Loading more experiences', { page: nextPage });

      const result = await loadMoreExperiences(countryName, nextPage, experiencesMeta.limit);

      setExperiences(prev => [...prev, ...result.experiences]);
      setExperiencesMeta(result.experiencesMeta);

      logger.info('[Countries] Loaded more experiences', {
        newCount: result.experiences.length,
        totalLoaded: experiences.length + result.experiences.length
      });
    } catch (err) {
      logger.error('[Countries] Failed to load more experiences', { error: err.message });
    } finally {
      setLoadingMoreExperiences(false);
    }
  }, [countryName, experiencesMeta, loadingMoreExperiences, experiences.length]);

  // Initial data fetch
  useEffect(() => {
    fetchCountryData();
  }, [fetchCountryData]);

  // Subscribe to destination events for real-time updates
  useEffect(() => {
    const currentCountrySlug = normalizeCountrySlug(countryName);

    const handlers = createEntityEventHandlers({
      entityKey: 'destination',
      entityIdKey: 'destinationId',
      setItems: setDestinations,
      setMeta: setDestinationsMeta,
      matchesCountry: (dest) => normalizeCountrySlug(dest.country) === currentCountrySlug
    });

    const unsubCreate = eventBus.subscribe('destination:created', handlers.created);
    const unsubUpdate = eventBus.subscribe('destination:updated', handlers.updated);
    const unsubDelete = eventBus.subscribe('destination:deleted', handlers.deleted);

    return () => {
      unsubCreate();
      unsubUpdate();
      unsubDelete();
    };
  }, [countryName]);

  // Subscribe to experience events for real-time updates
  useEffect(() => {
    const currentCountrySlug = normalizeCountrySlug(countryName);

    const handlers = createEntityEventHandlers({
      entityKey: 'experience',
      entityIdKey: 'experienceId',
      setItems: setExperiences,
      setMeta: setExperiencesMeta,
      matchesCountry: (exp) => normalizeCountrySlug(exp.destination?.country) === currentCountrySlug
    });

    const unsubCreate = eventBus.subscribe('experience:created', handlers.created);
    const unsubUpdate = eventBus.subscribe('experience:updated', handlers.updated);
    const unsubDelete = eventBus.subscribe('experience:deleted', handlers.deleted);

    return () => {
      unsubCreate();
      unsubUpdate();
      unsubDelete();
    };
  }, [countryName]);

  // Memoized page metadata
  const { pageTitle, pageDescription } = useMemo(() => ({
    pageTitle: `${displayCountryName} - ${lang.current.viewMeta.defaultTitle}`,
    pageDescription: lang.current.countriesView.pageDescription.replace('{country}', displayCountryName)
  }), [displayCountryName]);

  // Memoized subtitle using total counts from meta
  const subtitle = useMemo(() => {
    if (loading) return null;
    const destCount = destinationsMeta?.total || destinations.length;
    const expCount = experiencesMeta?.total || experiences.length;
    return `${destCount} ${destCount === 1 ? 'destination' : 'destinations'} • ${expCount} ${expCount === 1 ? 'experience' : 'experiences'}`;
  }, [loading, destinationsMeta?.total, experiencesMeta?.total, destinations.length, experiences.length]);

  return {
    // Data
    destinations,
    experiences,
    country,
    displayCountryName,

    // Pagination metadata
    destinationsMeta,
    experiencesMeta,

    // Loading & error states
    loading,
    loadingMoreDestinations,
    loadingMoreExperiences,
    error,

    // Actions
    fetchCountryData,
    handleLoadMoreDestinations,
    handleLoadMoreExperiences,

    // Computed values
    pageTitle,
    pageDescription,
    subtitle
  };
}

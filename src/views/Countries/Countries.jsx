import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { FaTh, FaMap } from "react-icons/fa";
import { lang } from "../../lang.constants";
import { getCountryData, loadMoreDestinations, loadMoreExperiences } from "../../utilities/countries-api";
import { eventBus } from "../../utilities/event-bus";
import { useViewModePreference } from "../../hooks/useUIPreference";
import useGeocodedMarkers from "../../hooks/useGeocodedMarkers";
import DestinationCard from "../../components/DestinationCard/DestinationCard";
import ExperienceCard from "../../components/ExperienceCard/ExperienceCard";
import { MapWithListings } from "../../components/InteractiveMap";
import PageWrapper from "../../components/PageWrapper/PageWrapper";
import PageOpenGraph from "../../components/OpenGraph/PageOpenGraph";
import Alert from "../../components/Alert/Alert";
import { Button, FlexCenter, SpaceY, EmptyState, FadeIn, SkeletonLoader } from "../../components/design-system";
import { logger } from "../../utilities/logger";
import styles from "./Countries.module.scss";

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
 * Create entity event handlers for real-time updates
 * Reduces duplication between destination and experience event subscriptions
 *
 * @param {Object} config - Configuration for the entity handlers
 * @param {string} config.entityKey - Key to extract entity from event (e.g., 'destination', 'experience')
 * @param {string} config.entityIdKey - Key for entity ID in delete events (e.g., 'destinationId', 'experienceId')
 * @param {Function} config.setItems - State setter for items array
 * @param {Function} config.setMeta - State setter for pagination meta
 * @param {Function} config.matchesCountry - Function to check if entity belongs to current country
 * @returns {Object} Object with created, updated, deleted handlers
 */
function createEntityEventHandlers({ entityKey, entityIdKey, setItems, setMeta, matchesCountry }) {
  return {
    created: (event) => {
      const created = event[entityKey] || event.detail?.[entityKey];
      if (!created?._id) return;

      if (!matchesCountry(created)) return;

      // Add to the beginning of the list
      setItems(prev => [created, ...prev]);
      // Update meta count
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
      // Update meta count
      setMeta(prev => prev ? { ...prev, total: Math.max(0, prev.total - 1) } : prev);
    }
  };
}

export default function Countries() {
  const { countryName } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // View mode preference (list or map)
  // URL query param takes precedence over persisted preference for shareable links
  const { viewMode: persistedViewMode, setViewMode: setPersistedViewMode } = useViewModePreference('countries', 'list');
  const urlViewMode = searchParams.get('view');
  const viewMode = (urlViewMode === 'map' || urlViewMode === 'list') ? urlViewMode : persistedViewMode;

  // Sync view mode changes to both URL and localStorage
  const setViewMode = useCallback((newMode) => {
    setPersistedViewMode(newMode);
    // Update URL without adding to history for each toggle
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (newMode === 'list') {
        newParams.delete('view'); // Remove param for default view
      } else {
        newParams.set('view', newMode);
      }
      return newParams;
    }, { replace: true });
  }, [setPersistedViewMode, setSearchParams]);

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

  // Map markers from geocoding hook
  const { markers: mapMarkers, isLoading: isGeocodingMarkers, hasData: hasMapData } = useGeocodedMarkers({
    destinations,
    experiences,
    loading
  });

  // Convert slug to display name for initial render, API will return canonical name
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

  // Load more destinations using dedicated API utility
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

  // Load more experiences using dedicated API utility
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

  // Handle marker click - navigate to destination/experience
  const handleMarkerClick = useCallback((marker) => {
    if (marker.link) {
      navigate(marker.link);
    }
  }, [navigate]);

  return (
    <PageWrapper title={pageTitle}>
      <PageOpenGraph
        title={pageTitle}
        description={pageDescription}
        keywords={`${displayCountryName}, travel, destinations, experiences, ${lang.current.viewMeta.defaultKeywords}`}
        ogTitle={pageTitle}
        ogDescription={pageDescription}
      />

      <div className={styles.countriesView}>
        {/* Page Header */}
        <FadeIn>
          <div className={styles.header}>
            <h1>{displayCountryName}</h1>
            {loading ? (
              <div className={styles.subtitleSkeleton}>
                <SkeletonLoader
                  variant="rectangle"
                  width="180px"
                  height="100%"
                  style={{ borderRadius: 'var(--radius-sm)' }}
                />
              </div>
            ) : subtitle && (
              <FadeIn delay={100}>
                <p className={styles.subtitle}>{subtitle}</p>
              </FadeIn>
            )}

            {/* View Toggle - only show if not loading and has data */}
            {!loading && !error && (destinations.length > 0 || experiences.length > 0) && (
              <FadeIn delay={150}>
                <div className={styles.viewToggle}>
                  <button
                    className={`${styles.viewToggleButton} ${viewMode === 'list' ? styles.viewToggleButtonActive : ''}`}
                    onClick={() => setViewMode('list')}
                    aria-label={lang.current.aria.cardsView}
                  >
                    <FaTh />
                    <span>{lang.current.countriesView.cards}</span>
                  </button>
                  <button
                    className={`${styles.viewToggleButton} ${viewMode === 'map' ? styles.viewToggleButtonActive : ''}`}
                    onClick={() => setViewMode('map')}
                    aria-label={lang.current.aria.mapView}
                    disabled={!hasMapData && viewMode !== 'map'}
                    title={!hasMapData ? lang.current.countriesView.noLocationDataTitle : lang.current.countriesView.viewOnMapTitle}
                  >
                    <FaMap />
                    <span>{lang.current.countriesView.map}</span>
                  </button>
                </div>
              </FadeIn>
            )}
          </div>
        </FadeIn>

        {/* Error State */}
        {error && (
          <FadeIn>
            <FlexCenter>
              <div className="col-12 col-md-8">
                <SpaceY size="4">
                  <Alert type="danger" dismissible={false}>
                    {error}
                  </Alert>
                  <FlexCenter>
                    <Button
                      variant="outline"
                      size="md"
                      onClick={fetchCountryData}
                      leftIcon={<span>↻</span>}
                    >
                      {lang.current.button.tryAgain || 'Try Again'}
                    </Button>
                  </FlexCenter>
                </SpaceY>
              </div>
            </FlexCenter>
          </FadeIn>
        )}

        {/* Content */}
        {!error && (
          <SpaceY size="6">
            {/* Map View with Listings Panel */}
            {viewMode === 'map' && !loading && (
              <FadeIn>
                <div className={styles.mapViewContainer}>
                  {isGeocodingMarkers ? (
                    <div className={styles.mapLoadingContainer}>
                      <SkeletonLoader variant="rectangle" width="100%" height="600px" />
                      <p className={styles.mapViewInfo}>{lang.current.countriesView.loadingLocations}</p>
                    </div>
                  ) : mapMarkers.length > 0 ? (
                    <MapWithListings
                      markers={mapMarkers}
                      loading={isGeocodingMarkers}
                      showSearch={true}
                      showFilters={true}
                      splitRatio="35-65"
                      onMarkerClick={handleMarkerClick}
                    />
                  ) : (
                    <EmptyState
                      variant="generic"
                      title={lang.current.emptyState.noLocationData}
                      description={lang.current.emptyState.noLocationDataDescription}
                      size="md"
                    />
                  )}
                </div>
              </FadeIn>
            )}

            {/* Cards View - Destinations Section */}
            {viewMode === 'list' && (
            <section className={styles.contentContainer}>
              <h2 className={styles.sectionTitle}>
                {loading ? (
                  <SkeletonLoader variant="text" width="220px" height="calc(var(--font-size-2xl) * 1.15)" />
                ) : (
                  lang.current.heading.destinations
                )}
              </h2>
              <div className={styles.destinationsList}>
                {loading ? (
                  // Skeleton loaders matching DestinationCard dimensions (12rem × 8rem)
                  Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className={styles.destinationSkeleton}>
                      <div className={styles.destinationSkeletonOverlay}>
                        <div className={styles.destinationSkeletonTitle} />
                      </div>
                    </div>
                  ))
                ) : destinations.length > 0 ? (
                  destinations.map((destination, index) => (
                    <FadeIn key={destination._id || index} delay={index * 30}>
                      <DestinationCard destination={destination} />
                    </FadeIn>
                  ))
                ) : (
                  <EmptyState
                    variant="generic"
                    title={lang.current.emptyState.noDestinationsYet}
                    description={lang.current.emptyState.noDestinationsYetDescription.replace('{country}', displayCountryName)}
                    size="sm"
                  />
                )}
              </div>

              {/* Show More Destinations */}
              {!loading && destinationsMeta?.hasMore && (
                <div className={styles.showMoreContainer}>
                  <Button
                    variant="outline"
                    size="md"
                    onClick={handleLoadMoreDestinations}
                    disabled={loadingMoreDestinations}
                    className={styles.showMoreButton}
                  >
                    {loadingMoreDestinations ? lang.current.loading.default : lang.current.countriesView.showMoreDestinations.replace('{current}', destinations.length).replace('{total}', destinationsMeta.total)}
                  </Button>
                </div>
              )}
            </section>
            )}

            {/* Cards View - Experiences Section */}
            {viewMode === 'list' && (
            <section className={styles.contentContainer}>
              <h2 className={styles.sectionTitle}>
                {loading ? (
                  <SkeletonLoader variant="text" width="220px" height="calc(var(--font-size-2xl) * 1.15)" />
                ) : (
                  lang.current.heading.experiences
                )}
              </h2>
              <div className={styles.experiencesList}>
                {loading ? (
                  // Skeleton loaders matching ExperienceCard dimensions (20rem × 12rem min-height)
                  Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className={styles.experienceSkeleton}>
                      <div className={styles.experienceSkeletonContent}>
                        <div className={styles.experienceSkeletonTitle} />
                      </div>
                      <div className={styles.experienceSkeletonActions}>
                        <div className={styles.experienceSkeletonButton} />
                        <div className={styles.experienceSkeletonButton} />
                        <div className={styles.experienceSkeletonButton} />
                      </div>
                    </div>
                  ))
                ) : experiences.length > 0 ? (
                  experiences.map((experience, index) => (
                    <FadeIn key={experience._id || index} delay={index * 30}>
                      <ExperienceCard experience={experience} />
                    </FadeIn>
                  ))
                ) : (
                  <EmptyState
                    variant="generic"
                    title={lang.current.emptyState.noExperiencesYet}
                    description={lang.current.emptyState.noExperiencesYetDescription.replace('{country}', displayCountryName)}
                    size="sm"
                  />
                )}
              </div>

              {/* Show More Experiences */}
              {!loading && experiencesMeta?.hasMore && (
                <div className={styles.showMoreContainer}>
                  <Button
                    variant="outline"
                    size="md"
                    onClick={handleLoadMoreExperiences}
                    disabled={loadingMoreExperiences}
                    className={styles.showMoreButton}
                  >
                    {loadingMoreExperiences ? lang.current.loading.default : lang.current.countriesView.showMoreExperiences.replace('{current}', experiences.length).replace('{total}', experiencesMeta.total)}
                  </Button>
                </div>
              )}
            </section>
            )}
          </SpaceY>
        )}
      </div>
    </PageWrapper>
  );
}

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FaTh, FaMap } from "react-icons/fa";
import { lang } from "../../lang.constants";
import { getCountryData } from "../../utilities/countries-api";
import { eventBus } from "../../utilities/event-bus";
import { useViewModePreference } from "../../hooks/useUIPreference";
import DestinationCard from "../../components/DestinationCard/DestinationCard";
import ExperienceCard from "../../components/ExperienceCard/ExperienceCard";
import { InteractiveMap } from "../../components/InteractiveMap";
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

export default function Countries() {
  const { countryName } = useParams();
  const navigate = useNavigate();

  // View mode preference (list or map)
  const { viewMode, setViewMode } = useViewModePreference('countries', 'list');

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
      setError(err.message || 'Failed to load country data');
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

      const result = await getCountryData(countryName, {
        destinationsPage: nextPage,
        destinationsLimit: destinationsMeta.limit,
        experiencesPage: experiencesMeta?.page || 1,
        experiencesLimit: 0 // Don't re-fetch experiences
      });

      setDestinations(prev => [...prev, ...(result.destinations || [])]);
      setDestinationsMeta(result.destinationsMeta);

      logger.info('[Countries] Loaded more destinations', {
        newCount: result.destinations?.length,
        totalLoaded: destinations.length + (result.destinations?.length || 0)
      });
    } catch (err) {
      logger.error('[Countries] Failed to load more destinations', { error: err.message });
    } finally {
      setLoadingMoreDestinations(false);
    }
  }, [countryName, destinationsMeta, experiencesMeta, loadingMoreDestinations, destinations.length]);

  // Load more experiences
  const handleLoadMoreExperiences = useCallback(async () => {
    if (!experiencesMeta?.hasMore || loadingMoreExperiences) return;

    try {
      setLoadingMoreExperiences(true);
      const nextPage = experiencesMeta.page + 1;

      logger.info('[Countries] Loading more experiences', { page: nextPage });

      const result = await getCountryData(countryName, {
        destinationsPage: destinationsMeta?.page || 1,
        destinationsLimit: 0, // Don't re-fetch destinations
        experiencesPage: nextPage,
        experiencesLimit: experiencesMeta.limit
      });

      setExperiences(prev => [...prev, ...(result.experiences || [])]);
      setExperiencesMeta(result.experiencesMeta);

      logger.info('[Countries] Loaded more experiences', {
        newCount: result.experiences?.length,
        totalLoaded: experiences.length + (result.experiences?.length || 0)
      });
    } catch (err) {
      logger.error('[Countries] Failed to load more experiences', { error: err.message });
    } finally {
      setLoadingMoreExperiences(false);
    }
  }, [countryName, destinationsMeta, experiencesMeta, loadingMoreExperiences, experiences.length]);

  // Initial data fetch
  useEffect(() => {
    fetchCountryData();
  }, [fetchCountryData]);

  // Subscribe to destination events for real-time updates
  useEffect(() => {
    const handleDestinationUpdated = (event) => {
      const updated = event.destination || event.detail?.destination;
      if (!updated?._id) return;

      setDestinations(prev =>
        prev.map(d => d._id === updated._id ? { ...d, ...updated } : d)
      );
    };

    const handleDestinationDeleted = (event) => {
      const deletedId = event.destinationId || event.detail?.destinationId;
      if (!deletedId) return;

      setDestinations(prev => prev.filter(d => d._id !== deletedId));
      // Update meta count
      setDestinationsMeta(prev => prev ? { ...prev, total: Math.max(0, prev.total - 1) } : prev);
    };

    const unsubUpdate = eventBus.subscribe('destination:updated', handleDestinationUpdated);
    const unsubDelete = eventBus.subscribe('destination:deleted', handleDestinationDeleted);

    return () => {
      unsubUpdate();
      unsubDelete();
    };
  }, []);

  // Subscribe to experience events for real-time updates
  useEffect(() => {
    const handleExperienceUpdated = (event) => {
      const updated = event.experience || event.detail?.experience;
      if (!updated?._id) return;

      setExperiences(prev =>
        prev.map(e => e._id === updated._id ? { ...e, ...updated } : e)
      );
    };

    const handleExperienceDeleted = (event) => {
      const deletedId = event.experienceId || event.detail?.experienceId;
      if (!deletedId) return;

      setExperiences(prev => prev.filter(e => e._id !== deletedId));
      // Update meta count
      setExperiencesMeta(prev => prev ? { ...prev, total: Math.max(0, prev.total - 1) } : prev);
    };

    const unsubUpdate = eventBus.subscribe('experience:updated', handleExperienceUpdated);
    const unsubDelete = eventBus.subscribe('experience:deleted', handleExperienceDeleted);

    return () => {
      unsubUpdate();
      unsubDelete();
    };
  }, []);

  // Memoized page metadata
  const { pageTitle, pageDescription } = useMemo(() => ({
    pageTitle: `${displayCountryName} - ${lang.current.viewMeta.defaultTitle}`,
    pageDescription: `Explore destinations and experiences in ${displayCountryName}. Discover travel plans, activities, and adventures.`
  }), [displayCountryName]);

  // Memoized subtitle using total counts from meta
  const subtitle = useMemo(() => {
    if (loading) return null;
    const destCount = destinationsMeta?.total || destinations.length;
    const expCount = experiencesMeta?.total || experiences.length;
    return `${destCount} ${destCount === 1 ? 'destination' : 'destinations'} • ${expCount} ${expCount === 1 ? 'experience' : 'experiences'}`;
  }, [loading, destinationsMeta?.total, experiencesMeta?.total, destinations.length, experiences.length]);

  // Transform experiences into map markers (only those with coordinates)
  const mapMarkers = useMemo(() => {
    const markers = [];

    // Add experiences with valid coordinates
    experiences.forEach(exp => {
      if (exp.location?.geo?.coordinates && exp.location.geo.coordinates.length === 2) {
        const [lng, lat] = exp.location.geo.coordinates;
        // Validate coordinates are valid numbers
        if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
          markers.push({
            id: exp._id,
            lat,
            lng,
            type: 'experience',
            name: exp.name,
            photo: exp.default_photo_id?.url || exp.photos?.[0]?.url,
            link: `/experiences/${exp._id}`
          });
        }
      }
    });

    logger.debug('[Countries] Map markers generated', {
      totalExperiences: experiences.length,
      markersWithCoords: markers.length
    });

    return markers;
  }, [experiences]);

  // Handle marker click - navigate to experience
  const handleMarkerClick = useCallback((marker) => {
    if (marker.link) {
      navigate(marker.link);
    }
  }, [navigate]);

  // Check if map view is available (has experiences with coordinates)
  const hasMapData = mapMarkers.length > 0;

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
            {subtitle && (
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
                    aria-label="Cards view"
                  >
                    <FaTh />
                    <span>Cards</span>
                  </button>
                  <button
                    className={`${styles.viewToggleButton} ${viewMode === 'map' ? styles.viewToggleButtonActive : ''}`}
                    onClick={() => setViewMode('map')}
                    aria-label="Map view"
                    disabled={!hasMapData && viewMode !== 'map'}
                    title={!hasMapData ? 'No experiences with location data' : 'View on map'}
                  >
                    <FaMap />
                    <span>Map</span>
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
                <Alert type="danger" dismissible={false}>
                  {error}
                </Alert>
              </div>
            </FlexCenter>
          </FadeIn>
        )}

        {/* Content */}
        {!error && (
          <SpaceY size="6">
            {/* Map View */}
            {viewMode === 'map' && !loading && (
              <FadeIn>
                <div className={styles.mapViewContainer}>
                  {hasMapData ? (
                    <>
                      <p className={styles.mapViewInfo}>
                        Showing {mapMarkers.length} {mapMarkers.length === 1 ? 'experience' : 'experiences'} with location data
                      </p>
                      <InteractiveMap
                        markers={mapMarkers}
                        height="500px"
                        onMarkerClick={handleMarkerClick}
                        fitBounds={true}
                      />
                    </>
                  ) : (
                    <EmptyState
                      variant="generic"
                      title="No Location Data"
                      description="None of the experiences in this country have location coordinates. Try the cards view instead."
                      size="md"
                    />
                  )}
                </div>
              </FadeIn>
            )}

            {/* Cards View - Destinations Section */}
            {viewMode === 'list' && (
            <section>
              <h2 className={styles.sectionTitle}>
                {loading ? (
                  <SkeletonLoader variant="text" width="200px" height="24px" />
                ) : (
                  lang.current.heading.destinations || 'Destinations'
                )}
              </h2>
              <FlexCenter>
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
                      title="No Destinations Yet"
                      description={`There are no destinations added for ${displayCountryName} yet.`}
                      size="sm"
                    />
                  )}
                </div>
              </FlexCenter>

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
                    {loadingMoreDestinations ? 'Loading...' : `Show More Destinations (${destinations.length} of ${destinationsMeta.total})`}
                  </Button>
                </div>
              )}
            </section>
            )}

            {/* Cards View - Experiences Section */}
            {viewMode === 'list' && (
            <section>
              <h2 className={styles.sectionTitle}>
                {loading ? (
                  <SkeletonLoader variant="text" width="200px" height="24px" />
                ) : (
                  lang.current.heading.experiences || 'Experiences'
                )}
              </h2>
              <FlexCenter>
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
                      title="No Experiences Yet"
                      description={`There are no experiences added for ${displayCountryName} yet.`}
                      size="sm"
                    />
                  )}
                </div>
              </FlexCenter>

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
                    {loadingMoreExperiences ? 'Loading...' : `Show More Experiences (${experiences.length} of ${experiencesMeta.total})`}
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

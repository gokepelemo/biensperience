import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FaTh, FaMap } from "react-icons/fa";
import { lang } from "../../lang.constants";
import { getCountryData } from "../../utilities/countries-api";
import { eventBus } from "../../utilities/event-bus";
import { useViewModePreference } from "../../hooks/useUIPreference";
import { geocodeAddressViaAPI } from "../../utilities/geocode-api";
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

  // Map markers state (populated via geocoding)
  const [mapMarkers, setMapMarkers] = useState([]);
  const [isGeocodingMarkers, setIsGeocodingMarkers] = useState(false);
  const geocodeCacheRef = useRef(new Map()); // Cache geocoded results

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

  // Helper function to validate and extract coordinates from location object
  const extractCoords = useCallback((location) => {
    const geoData = location?.geo;
    if (!geoData?.coordinates || !Array.isArray(geoData.coordinates) || geoData.coordinates.length !== 2) {
      return null;
    }
    const [lng, lat] = geoData.coordinates;
    // Validate coordinates are valid numbers and not zero (which would indicate no data)
    if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
      return null;
    }
    return { lat, lng };
  }, []);

  // Build address string for geocoding fallback
  const buildAddressString = useCallback((item, type) => {
    if (type === 'destination') {
      // Use map_location if available, otherwise build from name + country
      if (item.map_location) return item.map_location;
      const parts = [item.name];
      if (item.state) parts.push(item.state);
      if (item.country) parts.push(item.country);
      return parts.join(', ');
    } else {
      // Experience: use destination name + country
      if (item.destination?.name) {
        const parts = [item.destination.name];
        if (item.destination.country) parts.push(item.destination.country);
        return parts.join(', ');
      }
      return item.name; // Fallback to experience name
    }
  }, []);

  // Generate map markers with geocoding fallback
  useEffect(() => {
    if (loading || (destinations.length === 0 && experiences.length === 0)) {
      setMapMarkers([]);
      setIsGeocodingMarkers(false);
      return;
    }

    let isCancelled = false;

    async function generateMarkers() {
      setIsGeocodingMarkers(true);
      const markers = [];
      const geocodeQueue = [];

      // Process destinations
      for (const dest of destinations) {
        const coords = extractCoords(dest.location);

        // Build location name for display
        const destLocationName = dest.map_location || (dest.state ? `${dest.state}, ${dest.country}` : dest.country);

        if (coords) {
          markers.push({
            id: dest._id,
            lat: coords.lat,
            lng: coords.lng,
            type: 'destination',
            name: dest.name,
            photo: dest.default_photo_id?.url || dest.photos?.[0]?.url,
            link: `/destinations/${dest._id}`,
            locationName: destLocationName
          });
        } else {
          // Queue for geocoding
          const addressStr = buildAddressString(dest, 'destination');
          if (addressStr) {
            geocodeQueue.push({
              id: dest._id,
              type: 'destination',
              name: dest.name,
              photo: dest.default_photo_id?.url || dest.photos?.[0]?.url,
              link: `/destinations/${dest._id}`,
              locationName: destLocationName,
              addressStr
            });
          }
        }
      }

      // Process experiences
      for (const exp of experiences) {
        // Try experience's own location first
        let coords = extractCoords(exp.location);

        // If no experience location, try the destination's location
        if (!coords && exp.destination?.location) {
          coords = extractCoords(exp.destination.location);
        }

        // If still no coords, try plan_items
        if (!coords && exp.plan_items?.length > 0) {
          for (const item of exp.plan_items) {
            coords = extractCoords(item.location);
            if (coords) break;
          }
        }

        // Build location name for display
        const expLocationName = exp.destination?.name || null;

        if (coords) {
          markers.push({
            id: exp._id,
            lat: coords.lat,
            lng: coords.lng,
            type: 'experience',
            name: exp.name,
            photo: exp.default_photo_id?.url || exp.photos?.[0]?.url,
            link: `/experiences/${exp._id}`,
            locationName: expLocationName
          });
        } else {
          // Queue for geocoding
          const addressStr = buildAddressString(exp, 'experience');
          if (addressStr) {
            geocodeQueue.push({
              id: exp._id,
              type: 'experience',
              name: exp.name,
              photo: exp.default_photo_id?.url || exp.photos?.[0]?.url,
              link: `/experiences/${exp._id}`,
              locationName: expLocationName,
              addressStr
            });
          }
        }
      }

      // Log what we have before geocoding
      logger.info('[Countries] Initial markers from coordinates', {
        markersFromCoords: markers.length,
        needGeocoding: geocodeQueue.length,
        sampleMarker: markers[0] ? { id: markers[0].id, lat: markers[0].lat, lng: markers[0].lng, name: markers[0].name } : null
      });

      // Perform geocoding for items without coordinates (in batches)
      const BATCH_SIZE = 5;
      for (let i = 0; i < geocodeQueue.length; i += BATCH_SIZE) {
        if (isCancelled) break;

        const batch = geocodeQueue.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
          batch.map(async (item) => {
            // Check cache first
            const cached = geocodeCacheRef.current.get(item.addressStr);
            if (cached) {
              return { ...item, coords: cached };
            }

            try {
              const result = await geocodeAddressViaAPI(item.addressStr);
              if (result?.location) {
                geocodeCacheRef.current.set(item.addressStr, result.location);
                return { ...item, coords: result.location };
              }
            } catch (err) {
              logger.warn('[Countries] Geocoding failed', { address: item.addressStr, error: err.message });
            }
            return null;
          })
        );

        // Add successful geocoded items to markers
        for (const result of results) {
          if (result?.coords) {
            markers.push({
              id: result.id,
              lat: result.coords.lat,
              lng: result.coords.lng,
              type: result.type,
              name: result.name,
              photo: result.photo,
              link: result.link,
              locationName: result.locationName
            });
          }
        }
      }

      if (!isCancelled) {
        // Log final markers
        logger.info('[Countries] Final map markers', {
          total: markers.length,
          destinations: markers.filter(m => m.type === 'destination').length,
          experiences: markers.filter(m => m.type === 'experience').length,
          sampleMarkers: markers.slice(0, 3).map(m => ({ id: m.id, lat: m.lat, lng: m.lng, type: m.type }))
        });
        setMapMarkers(markers);
        setIsGeocodingMarkers(false);
      }
    }

    generateMarkers();

    return () => {
      isCancelled = true;
      setIsGeocodingMarkers(false);
    };
  }, [destinations, experiences, loading, extractCoords, buildAddressString]);

  // Handle marker click - navigate to experience
  const handleMarkerClick = useCallback((marker) => {
    if (marker.link) {
      navigate(marker.link);
    }
  }, [navigate]);

  // Check if map view is available (has markers or is still geocoding)
  const hasMapData = mapMarkers.length > 0 || isGeocodingMarkers;

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
                <SkeletonLoader variant="rectangle" width="180px" height="20px" style={{ borderRadius: 'var(--radius-sm)' }} />
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
                    <span>Cards</span>
                  </button>
                  <button
                    className={`${styles.viewToggleButton} ${viewMode === 'map' ? styles.viewToggleButtonActive : ''}`}
                    onClick={() => setViewMode('map')}
                    aria-label={lang.current.aria.mapView}
                    disabled={!hasMapData && viewMode !== 'map'}
                    title={!hasMapData ? 'No destinations or experiences with location data' : 'View on map'}
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
            {/* Map View with Listings Panel */}
            {viewMode === 'map' && !loading && (
              <FadeIn>
                <div className={styles.mapViewContainer}>
                  {isGeocodingMarkers ? (
                    <div className={styles.mapLoadingContainer}>
                      <SkeletonLoader variant="rectangle" width="100%" height="600px" />
                      <p className={styles.mapViewInfo}>Loading locations...</p>
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
                        <DestinationCard destination={destination} fluid />
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
                    {loadingMoreDestinations ? lang.current.loading.default : `Show More Destinations (${destinations.length} of ${destinationsMeta.total})`}
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
                        <ExperienceCard experience={experience} fluid />
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
                    {loadingMoreExperiences ? lang.current.loading.default : `Show More Experiences (${experiences.length} of ${experiencesMeta.total})`}
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

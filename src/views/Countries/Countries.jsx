import { useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { FaTh, FaMap } from "react-icons/fa";
import { lang } from "../../lang.constants";
import { useViewModePreference } from "../../hooks/useUIPreference";
import useGeocodedMarkers from "../../hooks/useGeocodedMarkers";
import useCountryData from "../../hooks/useCountryData";
import DestinationCard from "../../components/DestinationCard/DestinationCard";
import ExperienceCard from "../../components/ExperienceCard/ExperienceCard";
import { MapWithListings } from "../../components/InteractiveMap";
import PageWrapper from "../../components/PageWrapper/PageWrapper";
import PageOpenGraph from "../../components/OpenGraph/PageOpenGraph";
import { Button, FlexCenter, SpaceY, EmptyState, FadeIn, SkeletonLoader, ExperienceCardSkeleton, DestinationCardSkeleton, Alert } from "../../components/design-system";
import styles from "./Countries.module.scss";

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
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (newMode === 'list') {
        newParams.delete('view');
      } else {
        newParams.set('view', newMode);
      }
      return newParams;
    }, { replace: true });
  }, [setPersistedViewMode, setSearchParams]);

  // All data fetching, pagination, events, and computed values
  const {
    destinations,
    experiences,
    displayCountryName,
    destinationsMeta,
    experiencesMeta,
    loading,
    loadingMoreDestinations,
    loadingMoreExperiences,
    error,
    fetchCountryData,
    handleLoadMoreDestinations,
    handleLoadMoreExperiences,
    pageTitle,
    pageDescription,
    subtitle
  } = useCountryData(countryName);

  // Map markers from geocoding hook
  const { markers: mapMarkers, isLoading: isGeocodingMarkers, hasData: hasMapData } = useGeocodedMarkers({
    destinations,
    experiences,
    loading
  });

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
                  <DestinationCardSkeleton count={destinationsMeta.limit} />
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
                  <ExperienceCardSkeleton count={experiencesMeta.limit} />
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

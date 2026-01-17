import styles from "./Destinations.module.scss";
import { useMemo, useState, useEffect, useRef } from "react";
import { useUser } from "../../contexts/UserContext";
import { useData } from "../../contexts/DataContext";
import DestinationCard from "../../components/DestinationCard/DestinationCard";
import SortFilter from "../../components/SortFilter/SortFilter";
import PageOpenGraph from "../../components/OpenGraph/PageOpenGraph";
import PageWrapper from "../../components/PageWrapper/PageWrapper";
import Loading from "../../components/Loading/Loading";
import { deduplicateById, deduplicateFuzzy } from "../../utilities/deduplication";
import { sortItems, filterDestinations } from "../../utilities/sort-filter";
import { Container, Mobile, Desktop, EmptyState } from "../../components/design-system";
import SkeletonLoader from '../../components/SkeletonLoader/SkeletonLoader';
import { logger } from "../../utilities/logger";
import { lang } from "../../lang.constants";

export default function Destinations() {
  const { user } = useUser();
  const { destinations, loading, fetchMoreDestinations, destinationsMeta, applyDestinationsFilter, lastUpdated } = useData();

  // Check if initial data fetch has completed (prevents flash of "no data" on mount)
  const initialLoadComplete = lastUpdated?.destinations !== null;
  const [sortBy, setSortBy] = useState("alphabetical");
  const [filterBy, setFilterBy] = useState("all");
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!fetchMoreDestinations || !destinationsMeta?.hasMore || loadingMore) return;
    const el = sentinelRef.current;
    if (!el) return;

    let isLoadingRef = false; // Prevent race conditions from async callbacks

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !isLoadingRef) {
          isLoadingRef = true;
          setLoadingMore(true);

          // Use async IIFE to properly handle promise
          (async () => {
            try {
              logger.debug('Infinite scroll: Fetching more destinations');
              const newDestinations = await fetchMoreDestinations();

              if (newDestinations && newDestinations.length > 0) {
                // Wait longer for React to fully render and for images to start loading
                // This ensures smooth transition without glitches
                logger.debug('Infinite scroll: Waiting for DOM to settle', { count: newDestinations.length });
                await new Promise(resolve => setTimeout(resolve, 300));
              }
            } catch (err) {
              logger.error('Failed to fetch more destinations in infinite scroll', { error: err.message });
            } finally {
              isLoadingRef = false;
              setLoadingMore(false);
            }
          })();
        }
      });
    }, { rootMargin: '100px', threshold: 0 });

    io.observe(el);
    return () => {
      io.disconnect();
      isLoadingRef = false;
    };
  }, [fetchMoreDestinations, destinationsMeta?.hasMore, loadingMore]);

  // Deduplicate, filter, and sort destinations
  const processedDestinations = useMemo(() => {
    if (!destinations) return [];
    // First deduplicate by ID
    const uniqueById = deduplicateById(destinations);
    // Then apply fuzzy deduplication to catch similar names
    const uniqueFuzzy = deduplicateFuzzy(uniqueById, 'name', 90);
    const filtered = filterDestinations(uniqueFuzzy, filterBy, user?._id);
    return sortItems(filtered, sortBy);
  }, [destinations, sortBy, filterBy, user?._id]);

  return (
    <PageWrapper title={lang.current.destinationsView.pageTitle}>
      <PageOpenGraph
        title={lang.current.page.destinations.title}
        description={lang.current.page.destinations.description}
        keywords={lang.current.page.destinations.keywords}
        ogTitle={lang.current.page.destinations.ogTitle}
        ogDescription={`Browse ${processedDestinations?.length || 'hundreds of'} incredible travel destinations worldwide. Plan your perfect trip today.`}
      />

      <Container className={styles.destinationsHeader}>
        <div className="col-md-6">
          <Mobile>
            <h1 className="my-4" style={{ textAlign: 'center' }}>{lang.current.destinationsView.pageTitle}</h1>
          </Mobile>
          <Desktop>
            <h1 className="my-4" style={{ textAlign: 'start' }}>{lang.current.destinationsView.pageTitle}</h1>
          </Desktop>
        </div>
      </Container>

      <SortFilter
        onSortChange={(val) => {
          setSortBy(val);
          // propagate sort to server-side for destinations
          applyDestinationsFilter({ sort_by: val });
        }}
        onFilterChange={(val) => {
          setFilterBy(val);
        }}
        showFilter={true}
        filterType="destinations"
      />

      {(loading || !initialLoadComplete) ? (
        <Container className="my-4">
          <div className={styles.destinationsList}>
            {/* Skeleton loaders matching DestinationCard dimensions (12rem × 8rem) */}
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className={styles.destinationSkeleton}>
                <div className={styles.destinationSkeletonOverlay}>
                  <div className={styles.destinationSkeletonTitle} />
                </div>
              </div>
            ))}
          </div>
        </Container>
      ) : (
        <Container className="my-4">
          <div className={styles.destinationsList}>
            {processedDestinations.length > 0 ? (
              processedDestinations.map((destination, index) => (
                destination ? (
                  <DestinationCard
                    destination={destination}
                    key={destination._id || index}
                    forcePreload={true}
                  />
                ) : (
                  <div key={`placeholder-${index}`} style={{ width: '12rem', height: '8rem', display: 'inline-block', margin: '0.5rem' }}>
                    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                      <SkeletonLoader variant="rectangle" width="100%" height="100%" />
                    </div>
                  </div>
                )
              ))
            ) : (
              <EmptyState
                variant="search"
                title={lang.current.destinationsView.noDestinationsFound}
                description={lang.current.destinationsView.noDestinationsDescription}
                size="md"
              />
            )}
            {destinationsMeta?.hasMore && !loadingMore && (
              <div style={{ textAlign: 'center', width: '100%', marginTop: 24 }}>
                <div ref={sentinelRef} style={{ height: 1 }} />
              </div>
            )}
            {loadingMore && (
              <div style={{
                textAlign: 'center',
                width: '100%',
                marginTop: 40,
                marginBottom: 40,
                minHeight: '200px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Loading size="md" variant="overlay" animation="engine" message={lang.current.destinationsView.loadingMore} />
              </div>
            )}
          </div>
        </Container>
      )}
    </PageWrapper>
  );
}

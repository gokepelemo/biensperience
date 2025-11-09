import "./Destinations.css";
import { useMemo, useState, useEffect, useRef } from "react";
import { useUser } from "../../contexts/UserContext";
import { useData } from "../../contexts/DataContext";
import DestinationCard from "../../components/DestinationCard/DestinationCard";
import SortFilter from "../../components/SortFilter/SortFilter";
import PageOpenGraph from "../../components/OpenGraph/PageOpenGraph";
import Alert from "../../components/Alert/Alert";
import PageWrapper from "../../components/PageWrapper/PageWrapper";
import Loading from "../../components/Loading/Loading";
import { deduplicateById, deduplicateFuzzy } from "../../utilities/deduplication";
import { sortItems, filterDestinations } from "../../utilities/sort-filter";
import { Container, Mobile, Desktop } from "../../components/design-system";
import { logger } from "../../utilities/logger";

export default function Destinations() {
  const { user } = useUser();
  const { destinations, loading, fetchMoreDestinations, destinationsMeta, applyDestinationsFilter } = useData();
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
    <PageWrapper title="Destinations">
      <PageOpenGraph
        title="All Destinations"
        description="Explore our curated collection of travel destinations from around the world. Find your next adventure destination with detailed information, photos, and travel tips."
        keywords="travel destinations, world destinations, travel planning, tourism, vacation spots, travel guide, countries, cities"
        ogTitle="Discover Amazing Travel Destinations"
        ogDescription={`Browse ${processedDestinations?.length || 'hundreds of'} incredible travel destinations worldwide. Plan your perfect trip today.`}
      />

      <Container className="destinations-header">
        <div className="col-md-6">
          <Mobile>
            <h1 className="my-4" style={{ textAlign: 'center' }}>Destinations</h1>
          </Mobile>
          <Desktop>
            <h1 className="my-4" style={{ textAlign: 'start' }}>Destinations</h1>
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

      {loading ? (
        <Loading
          variant="centered"
          size="lg"
          animation="engine"
          message="Loading destinations..."
        />
      ) : (
        <Container className="my-4 animation-fade_in">
          <div className="destinations-list animation-fade_in">
            {processedDestinations.length > 0 ? (
              processedDestinations.map((destination, index) => (
                <DestinationCard
                  destination={destination}
                  key={destination._id || index}
                  className="animation-fade_in"
                />
              ))
            ) : (
              <Alert
                type="info"
                message="No destinations found matching your criteria."
                style={{ textAlign: 'center', width: '100%' }}
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
                <Loading size="md" variant="overlay" animation="engine" message="Loading more destinations..." />
              </div>
            )}
          </div>
        </Container>
      )}
    </PageWrapper>
  );
}

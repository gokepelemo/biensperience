import "./Destinations.css";
import { useMemo, useState, useEffect } from "react";
import { useUser } from "../../contexts/UserContext";
import { useData } from "../../contexts/DataContext";
import { useApp } from "../../contexts/AppContext";
import DestinationCard from "../../components/DestinationCard/DestinationCard";
import SortFilter from "../../components/SortFilter/SortFilter";
import PageMeta from "../../components/PageMeta/PageMeta";
import Alert from "../../components/Alert/Alert";
import PageWrapper from "../../components/PageWrapper/PageWrapper";
import { deduplicateById, deduplicateFuzzy } from "../../utilities/deduplication";
import { sortItems, filterDestinations } from "../../utilities/sort-filter";

export default function Destinations() {
  const { user } = useUser();
  const { destinations, loading } = useData();
  const { registerH1, clearActionButtons } = useApp();
  const [sortBy, setSortBy] = useState("alphabetical");
  const [filterBy, setFilterBy] = useState("all");

  // Register h1 for navbar integration
  useEffect(() => {
    const h1 = document.querySelector('h1');
    if (h1) registerH1(h1);

    return () => clearActionButtons();
  }, [registerH1, clearActionButtons]);

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
      <PageMeta
        title="All Destinations"
        description="Explore our curated collection of travel destinations from around the world. Find your next adventure destination with detailed information, photos, and travel tips."
        keywords="travel destinations, world destinations, travel planning, tourism, vacation spots, travel guide, countries, cities"
        ogTitle="Discover Amazing Travel Destinations"
        ogDescription={`Browse ${processedDestinations?.length || 'hundreds of'} incredible travel destinations worldwide. Plan your perfect trip today.`}
      />

      <div className="row fade-in">
        <div className="col-md-6 fade-in">
          <h1 className="my-4 h fade-in">Destinations</h1>
        </div>
      </div>

      <SortFilter
        onSortChange={setSortBy}
        onFilterChange={setFilterBy}
        showFilter={true}
        filterType="destinations"
      />

      {loading ? (
        <div className="text-center my-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading destinations...</span>
          </div>
        </div>
      ) : (
        <div className="row my-4 fade-in">
          <div className="col-md-12 p-3 d-flex flex-wrap justify-content-center align-items-center fade-in">
            {processedDestinations.length > 0 ? (
              processedDestinations.map((destination, index) => (
                <DestinationCard
                  destination={destination}
                  key={destination._id || index}
                  className="fade-in"
                />
              ))
            ) : (
              <Alert
                type="info"
                message="No destinations found matching your criteria."
                className="text-center w-100"
              />
            )}
          </div>
        </div>
      )}
    </PageWrapper>
  );
}

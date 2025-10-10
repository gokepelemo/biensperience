import "./Destinations.css";
import DestinationCard from "../../components/DestinationCard/DestinationCard";
import SortFilter from "../../components/SortFilter/SortFilter";
import PageMeta from "../../components/PageMeta/PageMeta";
import { deduplicateById, deduplicateFuzzy } from "../../utilities/deduplication";
import { sortItems, filterDestinations } from "../../utilities/sort-filter";
import { useMemo, useState } from "react";
import { getUser } from "../../utilities/users-service";

export default function Destinations({ destinations, updateData }) {
  const user = getUser();
  const [sortBy, setSortBy] = useState("alphabetical");
  const [filterBy, setFilterBy] = useState("all");

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
    <>
      <PageMeta
        title="All Destinations"
        description="Explore our curated collection of travel destinations from around the world. Find your next adventure destination with detailed information, photos, and travel tips."
        keywords="travel destinations, world destinations, travel planning, tourism, vacation spots, travel guide, countries, cities"
        ogTitle="Discover Amazing Travel Destinations"
        ogDescription={`Browse ${processedDestinations?.length || 'hundreds of'} incredible travel destinations worldwide. Plan your perfect trip today.`}
      />
      {processedDestinations && (
        <>
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

          <div className="row my-4 fade-in">
            <div className="col-md-12 p-3 d-flex flex-wrap justify-content-center align-items-center fade-in">
              {processedDestinations.length > 0 ? (
                processedDestinations.map((destination, index) => (
                  <DestinationCard destination={destination} key={destination._id || index} className="fade-in" />
                ))
              ) : (
                <div className="alert alert-info text-center w-100">
                  No destinations found matching your criteria.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

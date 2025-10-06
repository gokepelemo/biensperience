import "./Destinations.css";
import DestinationCard from "../../components/DestinationCard/DestinationCard";
import PageMeta from "../../components/PageMeta/PageMeta";
import { deduplicateById } from "../../utilities/deduplication";
import { useMemo } from "react";

export default function Destinations({ destinations }) {
  // Deduplicate destinations by ID to prevent duplicate rendering
  const uniqueDestinations = useMemo(() => {
    return destinations ? deduplicateById(destinations) : [];
  }, [destinations]);

  return (
    <>
      <PageMeta
        title="All Destinations"
        description="Explore our curated collection of travel destinations from around the world. Find your next adventure destination with detailed information, photos, and travel tips."
        keywords="travel destinations, world destinations, travel planning, tourism, vacation spots, travel guide, countries, cities"
        ogTitle="Discover Amazing Travel Destinations"
        ogDescription={`Browse ${uniqueDestinations?.length || 'hundreds of'} incredible travel destinations worldwide. Plan your perfect trip today.`}
      />
      {uniqueDestinations && (
        <>
          <div className="row fade-in">
            <div className="col-md-6 fade-in">
              <h1 className="my-4 h fade-in">Destinations</h1>
            </div>
          </div>
          <div className="row my-4 fade-in">
            <div className="col-md-12 p-3 d-flex flex-wrap justify-content-center align-items-center fade-in">
              {uniqueDestinations.map((destination, index) => (
                <DestinationCard destination={destination} key={destination._id || index} className="fade-in" />
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}

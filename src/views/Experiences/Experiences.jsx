import "./Experiences.css";
import ExperienceCard from "../../components/ExperienceCard/ExperienceCard";
import SortFilter from "../../components/SortFilter/SortFilter";
import PageMeta from "../../components/PageMeta/PageMeta";
import { deduplicateById, deduplicateFuzzy } from "../../utilities/deduplication";
import { sortItems, filterExperiences } from "../../utilities/sort-filter";
import { useMemo, useState } from "react";

export default function Experiences({
  experiences,
  user,
  setUser,
  updateData
}) {
  const [sortBy, setSortBy] = useState("alphabetical");
  const [filterBy, setFilterBy] = useState("all");

  // Deduplicate, filter, and sort experiences
  const processedExperiences = useMemo(() => {
    if (!experiences) return [];
    // First deduplicate by ID
    const uniqueById = deduplicateById(experiences);
    // Then apply fuzzy deduplication to catch similar names
    const uniqueFuzzy = deduplicateFuzzy(uniqueById, 'name', 90);
    const filtered = filterExperiences(uniqueFuzzy, filterBy, user._id);
    return sortItems(filtered, sortBy);
  }, [experiences, sortBy, filterBy, user._id]);

  return (
    <>
      <PageMeta
        title="All Experiences"
        description="Browse our curated collection of travel experiences from around the world. Discover unique adventures, plan your trips, and create unforgettable memories."
        keywords="travel experiences, adventures, trip planning, travel activities, tourism, bucket list, world travel"
        ogTitle="Discover Amazing Travel Experiences"
        ogDescription={`Explore ${processedExperiences?.length || 'hundreds of'} curated travel experiences worldwide. Start planning your next adventure today.`}
      />
      {processedExperiences && (
        <>
          <div className="row fade-in">
            <div className="col-md-6 fade-in">
              <h1 className="my-4 h fade-in">Experiences</h1>
            </div>
          </div>

          <SortFilter
            onSortChange={setSortBy}
            onFilterChange={setFilterBy}
            showFilter={true}
            filterType="experiences"
          />

          <div className="row my-4 fade-in">
            <div className="experiences-list fade-in">
              {processedExperiences.length > 0 ? (
                processedExperiences.map((experience, index) => (
                  <ExperienceCard
                    experience={experience}
                    key={experience._id || index}
                    user={user}
                    setUser={setUser}
                    updateData={updateData}
                    className="fade-in"
                  />
                ))
              ) : (
                <div className="alert alert-info text-center">
                  No experiences found matching your criteria.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

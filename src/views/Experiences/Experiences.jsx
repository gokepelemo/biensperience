import "./Experiences.css";
import { useMemo, useState, useEffect } from "react";
import { useUser } from "../../contexts/UserContext";
import { useData } from "../../contexts/DataContext";
import { useApp } from "../../contexts/AppContext";
import ExperienceCard from "../../components/ExperienceCard/ExperienceCard";
import SortFilter from "../../components/SortFilter/SortFilter";
import PageMeta from "../../components/PageMeta/PageMeta";
import Alert from "../../components/Alert/Alert";
import PageWrapper from "../../components/PageWrapper/PageWrapper";
import { deduplicateById, deduplicateFuzzy } from "../../utilities/deduplication";
import { sortItems, filterExperiences } from "../../utilities/sort-filter";

export default function Experiences() {
  const { user } = useUser();
  const { experiences, loading } = useData();
  const { registerH1, clearActionButtons } = useApp();
  const [sortBy, setSortBy] = useState("alphabetical");
  const [filterBy, setFilterBy] = useState("all");

  // Register h1 for navbar integration
  useEffect(() => {
    const h1 = document.querySelector('h1');
    if (h1) registerH1(h1);

    return () => clearActionButtons();
  }, [registerH1, clearActionButtons]);

  // Deduplicate, filter, and sort experiences
  const processedExperiences = useMemo(() => {
    if (!experiences) return [];
    // First deduplicate by ID
    const uniqueById = deduplicateById(experiences);
    // Then apply fuzzy deduplication to catch similar names
    const uniqueFuzzy = deduplicateFuzzy(uniqueById, 'title', 90);
    const filtered = filterExperiences(uniqueFuzzy, filterBy, user?._id);
    return sortItems(filtered, sortBy);
  }, [experiences, sortBy, filterBy, user?._id]);

  return (
    <PageWrapper title="Experiences">
      <PageMeta
        title="All Experiences"
        description="Browse our curated collection of travel experiences from around the world. Discover unique adventures, plan your trips, and create unforgettable memories."
        keywords="travel experiences, adventures, trip planning, travel activities, tourism, bucket list, world travel"
        ogTitle="Discover Amazing Travel Experiences"
        ogDescription={`Explore ${processedExperiences?.length || 'hundreds of'} curated travel experiences worldwide. Start planning your next adventure today.`}
      />

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

      {loading ? (
        <div className="text-center my-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading experiences...</span>
          </div>
        </div>
      ) : (
        <div className="row my-4 fade-in">
          <div className="experiences-list fade-in">
            {processedExperiences.length > 0 ? (
              processedExperiences.map((experience, index) => (
                <ExperienceCard
                  experience={experience}
                  key={experience._id || index}
                  className="fade-in"
                />
              ))
            ) : (
              <Alert
                type="info"
                message="No experiences found matching your criteria."
                className="text-center w-100"
              />
            )}
          </div>
        </div>
      )}
    </PageWrapper>
  );
}

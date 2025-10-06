import "./Experiences.css";
import ExperienceCard from "../../components/ExperienceCard/ExperienceCard";
import PageMeta from "../../components/PageMeta/PageMeta";
import { deduplicateById } from "../../utilities/deduplication";
import { useMemo } from "react";

export default function Experiences({
  experiences,
  user,
  setUser,
  updateData
}) {
  // Deduplicate experiences by ID to prevent duplicate rendering
  const uniqueExperiences = useMemo(() => {
    return experiences ? deduplicateById(experiences) : [];
  }, [experiences]);

  return (
    <>
      <PageMeta
        title="All Experiences"
        description="Browse our curated collection of travel experiences from around the world. Discover unique adventures, plan your trips, and create unforgettable memories."
        keywords="travel experiences, adventures, trip planning, travel activities, tourism, bucket list, world travel"
        ogTitle="Discover Amazing Travel Experiences"
        ogDescription={`Explore ${uniqueExperiences?.length || 'hundreds of'} curated travel experiences worldwide. Start planning your next adventure today.`}
      />
      {uniqueExperiences && (
        <>
          <div className="row fade-in">
            <div className="col-md-6 fade-in">
              <h1 className="my-4 h fade-in">Experiences</h1>
            </div>
          </div>
          <div className="row my-4 fade-in">
            <div className="experiences-list fade-in">
              {uniqueExperiences.map((experience, index) => (
                <ExperienceCard
                  experience={experience}
                  key={experience._id || index}
                  user={user}
                  setUser={setUser}
                  updateData={updateData}
                  className="fade-in"
                />
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}

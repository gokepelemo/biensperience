import { useEffect } from "react";
import { useUser } from "../../contexts/UserContext";
import { useData } from "../../contexts/DataContext";
import { useApp } from "../../contexts/AppContext";
import HeroBanner from "../../components/HeroBanner/HeroBanner";
import DestinationCard from "../../components/DestinationCard/DestinationCard";
import ExperienceCard from "../../components/ExperienceCard/ExperienceCard";
import PageMeta from "../../components/PageMeta/PageMeta";
import PageWrapper from "../../components/PageWrapper/PageWrapper";

export default function AppHome() {
  const { user } = useUser();
  const { experiences, destinations, plans, loading } = useData();
  const { registerH1, clearActionButtons } = useApp();

  // Register h1 for navbar integration
  useEffect(() => {
    const h1 = document.querySelector('h2'); // Using h2 as main heading on home
    if (h1) registerH1(h1);

    return () => clearActionButtons();
  }, [registerH1, clearActionButtons]);

  return (
    <PageWrapper title="Biensperience">
      <PageMeta
        title="Plan your next adventure with Biensperience"
        description="Discover and plan amazing travel experiences worldwide. Browse curated destinations, create your travel bucket list, and organize your adventures with Biensperience."
        keywords="travel planning, adventure, destinations, experiences, travel bucket list, trip planner, world travel, tourism"
        ogTitle="Biensperience - Plan Your Next Adventure"
        ogDescription="Discover curated travel experiences and destinations. Start planning your perfect adventure today with our comprehensive travel planning platform."
      />
      <HeroBanner className="fade-in" />

      {loading ? (
        <div className="text-center my-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : (
        <>
          <div className="row d-flex justify-content-center align-items-center fade-in">
            <h2 className="my-4 fade-in">Popular Destinations</h2>
            {destinations && destinations.length > 0 ? (
              destinations
                .filter((destination, index) => index <= 9)
                .map((destination, index) => (
                  <DestinationCard
                    key={destination._id || index}
                    destination={destination}
                    className="fade-in"
                  />
                ))
            ) : (
              <p className="text-center text-muted">No destinations available yet.</p>
            )}
          </div>

          <div className="row d-flex justify-content-center align-items-center fade-in">
            <h2 className="my-4 fade-in">Curated Experiences</h2>
            {experiences && experiences.length > 0 ? (
              experiences
                .filter((experience, index) => index <= 11)
                .map((experience, index) => (
                  <ExperienceCard
                    key={experience._id || index}
                    experience={experience}
                    className="fade-in"
                    userPlans={plans}
                  />
                ))
            ) : (
              <p className="text-center text-muted">No experiences available yet.</p>
            )}
          </div>
        </>
      )}
    </PageWrapper>
  );
}

import { useNavigate } from "react-router-dom";
import { useData } from "../../contexts/DataContext";
import { useUser } from "../../contexts/UserContext";
import { lang } from "../../lang.constants";
import HeroBanner from "../../components/HeroBanner/HeroBanner";
import DestinationCard from "../../components/DestinationCard/DestinationCard";
import ExperienceCard from "../../components/ExperienceCard/ExperienceCard";
import PageMeta from "../../components/PageMeta/PageMeta";
import PageWrapper from "../../components/PageWrapper/PageWrapper";
import Alert from "../../components/Alert/Alert";

export default function AppHome() {
  const { experiences, destinations, plans, loading } = useData();
  const { user } = useUser();
  const navigate = useNavigate();

  // Check if this is a new user with no content
  const isEmptyState = !loading && destinations.length === 0 && experiences.length === 0;

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
      ) : isEmptyState ? (
        <div className="row justify-content-center my-5">
          <div className="col-12 col-md-8 col-lg-6">
            <Alert
              type="info"
              title={lang.en.alert.welcomeTitle.replace('{name}', user?.name ? `, ${user.name}` : '')}
              dismissible={false}
            >
              <p className="mb-3">
                {lang.en.alert.welcomeFreshStart}
              </p>
              <div className="d-grid gap-2 d-md-flex justify-content-md-center">
                <button
                  className="btn btn-primary"
                  onClick={() => navigate('/destinations/new')}
                >
                  {lang.en.button.createDestination}
                </button>
                <button
                  className="btn btn-outline-primary"
                  onClick={() => navigate('/experiences/new')}
                >
                  {lang.en.button.createExperience}
                </button>
              </div>
            </Alert>
          </div>
        </div>
      ) : (
        <>
          <div className="row d-flex justify-content-center align-items-center fade-in">
            <h2 className="my-4 fade-in">{lang.en.heading.popularDestinations}</h2>
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
              <div className="col-12">
                <Alert type="info" dismissible={false}>
                  <p className="mb-2">{lang.en.alert.noDestinationsYet}</p>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => navigate('/destinations/new')}
                  >
                    {lang.en.button.createDestination}
                  </button>
                </Alert>
              </div>
            )}
          </div>

          <div className="row d-flex justify-content-center align-items-center fade-in">
            <h2 className="my-4 fade-in">{lang.en.heading.curatedExperiences}</h2>
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
              <div className="col-12">
                <Alert type="info" dismissible={false}>
                  <p className="mb-2">{lang.en.alert.noExperiencesYet}</p>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => navigate('/experiences/new')}
                  >
                    {lang.en.button.createExperience}
                  </button>
                </Alert>
              </div>
            )}
          </div>
        </>
      )}
    </PageWrapper>
  );
}

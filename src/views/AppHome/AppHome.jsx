import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../../contexts/DataContext";
import { useUser } from "../../contexts/UserContext";
import { lang } from "../../lang.constants";
import HeroBanner from "../../components/HeroBanner/HeroBanner";
import DestinationCard from "../../components/DestinationCard/DestinationCard";
import ExperienceCard from "../../components/ExperienceCard/ExperienceCard";
import PageOpenGraph from "../../components/OpenGraph/PageOpenGraph";
import PageWrapper from "../../components/PageWrapper/PageWrapper";
import Alert from "../../components/Alert/Alert";
import Loading from "../../components/Loading/Loading";
import { Button, FlexCenter, SpaceY, Container } from "../../components/design-system";
import { logger } from "../../utilities/logger";
import "./AppHome.css";

export default function AppHome() {
  const { experiences, destinations, plans, loading, applyDestinationsFilter, applyExperiencesFilter } = useData();
  const { user } = useUser();
  const navigate = useNavigate();
  const [showAllDestinations, setShowAllDestinations] = useState(false);
  const [showAllExperiences, setShowAllExperiences] = useState(false);
  const DESTINATIONS_INITIAL_DISPLAY = 10;
  const EXPERIENCES_INITIAL_DISPLAY = 12;

  // Fetch fresh, unfiltered data when AppHome mounts
  // This ensures we show all destinations and experiences, not filtered data from other views
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        logger.info('AppHome: Fetching fresh unfiltered data on mount');
        // Clear any filters and fetch all data
        await Promise.all([
          applyDestinationsFilter({}),
          applyExperiencesFilter({})
        ]);
        if (mounted) {
          logger.debug('AppHome: Data fetch completed', {
            destinationsCount: destinations.length,
            experiencesCount: experiences.length
          });
        }
      } catch (err) {
        logger.error('AppHome: Failed to fetch data on mount', { error: err.message });
      }
    })();
    return () => { mounted = false; };
    // Run once on mount, not when destinations/experiences change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check if this is a new user with no content
  const isEmptyState = !loading && destinations.length === 0 && experiences.length === 0;

  return (
    <PageWrapper title="Biensperience">
      <PageOpenGraph
        title="Plan your next adventure with Biensperience"
        description="Discover and plan amazing travel experiences worldwide. Browse curated destinations, create your travel bucket list, and organize your adventures with Biensperience."
        keywords="travel planning, adventure, destinations, experiences, travel bucket list, trip planner, world travel, tourism"
        ogTitle="Biensperience - Plan Your Next Adventure"
        ogDescription="Discover curated travel experiences and destinations. Start planning your perfect adventure today with our comprehensive travel planning platform."
      />
      <HeroBanner className="animation-fade_in" />

      {loading ? (
        <Loading variant="centered" size="lg" message="Loading..." />
      ) : isEmptyState ? (
        <FlexCenter>
          <div className="col-12 col-md-8 col-lg-6 text-center">
            <Alert
              type="info"
              title={lang.en.alert.welcomeTitle.replace('{name}', user?.name ? `, ${user.name}` : '')}
              dismissible={false}
            >
              <p className="mb-3">
                {lang.en.alert.welcomeFreshStart}
              </p>
              <SpaceY size={3}>
                <Button
                  variant="primary"
                  className="mb-3"
                  onClick={() => navigate('/destinations/new')}
                >
                  {lang.en.button.createDestination}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/experiences/new')}
                >
                  {lang.en.button.createExperience}
                </Button>
              </SpaceY>
            </Alert>
          </div>
        </FlexCenter>
      ) : (
        <>
          <h2 className="my-4 animation-fade_in">{lang.en.heading.popularDestinations}</h2>
          {destinations && destinations.length > 0 ? (
            <>
              <FlexCenter className="animation-fade_in">
                <div className="destinations-list">
                  {(showAllDestinations ? destinations : destinations.slice(0, DESTINATIONS_INITIAL_DISPLAY))
                    .map((destination, index) => (
                      <DestinationCard
                        key={destination._id || index}
                        destination={destination}
                        className="animation-fade_in"
                      />
                    ))}
                </div>
              </FlexCenter>
              {destinations.length > DESTINATIONS_INITIAL_DISPLAY && (
                <div className="col-12 text-center mt-4 mb-5">
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setShowAllDestinations(!showAllDestinations)}
                  >
                    {showAllDestinations ? 'Show Less' : 'Show More'}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <FlexCenter className="animation-fade_in">
              <div className="col-12">
                <Alert type="info" dismissible={false}>
                  <p className="mb-2">{lang.en.alert.noDestinationsYet}</p>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate('/destinations/new')}
                  >
                    {lang.en.button.createDestination}
                  </Button>
                </Alert>
              </div>
            </FlexCenter>
          )}

          <h2 className="my-4 animation-fade_in">{lang.en.heading.curatedExperiences}</h2>
          {experiences && experiences.length > 0 ? (
            <>
              <FlexCenter className="animation-fade_in">
                <div className="experiences-list">
                  {(showAllExperiences ? experiences : experiences.slice(0, EXPERIENCES_INITIAL_DISPLAY))
                    .map((experience, index) => (
                      <ExperienceCard
                        key={experience._id || index}
                        experience={experience}
                        className="animation-fade_in"
                        userPlans={plans}
                      />
                    ))}
                </div>
              </FlexCenter>
              {experiences.length > EXPERIENCES_INITIAL_DISPLAY && (
                <div className="col-12 text-center mt-4 mb-5">
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setShowAllExperiences(!showAllExperiences)}
                  >
                    {showAllExperiences ? 'Show Less' : 'Show More'}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <FlexCenter className="animation-fade_in">
              <div className="col-12">
                <Alert type="info" dismissible={false}>
                  <p className="mb-2">{lang.en.alert.noExperiencesYet}</p>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate('/experiences/new')}
                  >
                    {lang.en.button.createExperience}
                  </Button>
                </Alert>
              </div>
            </FlexCenter>
          )}
        </>
      )}
    </PageWrapper>
  );
}

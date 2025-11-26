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
import SkeletonLoader from "../../components/SkeletonLoader/SkeletonLoader";
import { Button, FlexCenter, SpaceY } from "../../components/design-system";
import { logger } from "../../utilities/logger";
import styles from "./AppHome.module.scss";

export default function AppHome() {
  const { experiences, destinations, plans, loading, applyDestinationsFilter, applyExperiencesFilter } = useData();
  const { user } = useUser();
  const navigate = useNavigate();
  const [showAllDestinations, setShowAllDestinations] = useState(false);
  const [showAllExperiences, setShowAllExperiences] = useState(false);
  // Track whether initial data fetch has completed
  const [initialFetchComplete, setInitialFetchComplete] = useState(false);
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
          setInitialFetchComplete(true);
        }
      } catch (err) {
        logger.error('AppHome: Failed to fetch data on mount', { error: err.message });
        if (mounted) {
          setInitialFetchComplete(true); // Still mark as complete so we show error state
        }
      }
    })();
    return () => { mounted = false; };
    // Run once on mount, not when destinations/experiences change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Determine loading states for each section
  // Show skeleton if: loading OR initial fetch hasn't completed yet
  const isDestinationsLoading = loading || !initialFetchComplete;
  const isExperiencesLoading = loading || !initialFetchComplete;

  // Check if this is a new user with no content (only after fetch completes)
  const isEmptyState = initialFetchComplete && !loading && destinations.length === 0 && experiences.length === 0;

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

      {/* Empty state - only shown after fetch completes with no data */}
      {isEmptyState ? (
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
              <SpaceY size="3">
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
          {/* Popular Destinations Section */}
          <h2 className="my-4 animation-fade_in">{lang.en.heading.popularDestinations}</h2>
          {isDestinationsLoading ? (
            // Skeleton loaders matching DestinationCard layout:
            // - Centered blurred title overlay (like destinationCardTitle)
            // - Count matches DESTINATIONS_INITIAL_DISPLAY
            <FlexCenter className="animation-fade_in">
              <div className={styles.destinationsList}>
                {Array.from({ length: DESTINATIONS_INITIAL_DISPLAY }, (_, i) => (
                  <div key={i} className={styles.destinationSkeleton}>
                    {/* Centered title overlay with blur - mirrors destinationCardTitle */}
                    <div className={styles.destinationSkeletonOverlay}>
                      <SkeletonLoader variant="text" width={`${65 + (i % 4) * 8}%`} height={20} />
                    </div>
                  </div>
                ))}
              </div>
            </FlexCenter>
          ) : destinations && destinations.length > 0 ? (
            <>
              <FlexCenter className="animation-fade_in">
                <div className={styles.destinationsList}>
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

          {/* Curated Experiences Section */}
          <h2 className="my-4 animation-fade_in">{lang.en.heading.curatedExperiences}</h2>
          {isExperiencesLoading ? (
            // Skeleton loaders matching ExperienceCard layout:
            // - Title centered in flex-grow area with blur overlay
            // - Action button at bottom right
            // Count matches EXPERIENCES_INITIAL_DISPLAY
            <FlexCenter className="animation-fade_in">
              <div className={styles.experiencesList}>
                {Array.from({ length: EXPERIENCES_INITIAL_DISPLAY }, (_, i) => (
                  <div key={i} className={styles.experienceSkeleton}>
                    {/* Title area - centered with blur overlay (mirrors experienceCardTitle) */}
                    <div className={styles.experienceSkeletonTitle}>
                      <div className={styles.experienceSkeletonTitleOverlay}>
                        <SkeletonLoader variant="text" width={`${75 + (i % 3) * 8}%`} height={20} />
                        <SkeletonLoader variant="text" width={`${50 + (i % 4) * 10}%`} height={16} className="mt-1" />
                      </div>
                    </div>
                    {/* Actions area - bottom right (mirrors experienceCardActions) */}
                    <div className={styles.experienceSkeletonActions}>
                      <SkeletonLoader variant="circle" width={44} height={44} />
                    </div>
                  </div>
                ))}
              </div>
            </FlexCenter>
          ) : experiences && experiences.length > 0 ? (
            <>
              <FlexCenter className="animation-fade_in">
                <div className={styles.experiencesList}>
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

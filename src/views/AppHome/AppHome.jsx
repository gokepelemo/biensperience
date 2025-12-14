import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../../contexts/DataContext";
import { useUser } from "../../contexts/UserContext";
import { useExperienceWizard } from "../../contexts/ExperienceWizardContext";
import { lang } from "../../lang.constants";
import HeroBanner from "../../components/HeroBanner/HeroBanner";
import DestinationCard from "../../components/DestinationCard/DestinationCard";
import ExperienceCard from "../../components/ExperienceCard/ExperienceCard";
import PageOpenGraph from "../../components/OpenGraph/PageOpenGraph";
import PageWrapper from "../../components/PageWrapper/PageWrapper";
import Alert from "../../components/Alert/Alert";
import SkeletonLoader from "../../components/SkeletonLoader/SkeletonLoader";
import { Button, FlexCenter, SpaceY, EmptyState } from "../../components/design-system";
import { logger } from "../../utilities/logger";
import styles from "./AppHome.module.scss";

export default function AppHome() {
  const { experiences, destinations, plans, loading, applyDestinationsFilter, applyExperiencesFilter } = useData();
  const { user } = useUser();
  const { openExperienceWizard } = useExperienceWizard();
  const navigate = useNavigate();
  const [showAllDestinations, setShowAllDestinations] = useState(false);
  const [showAllExperiences, setShowAllExperiences] = useState(false);

  // Track whether initial data fetch has completed
  // Use ref to track if we've already initiated a fetch to prevent double-fetching
  const fetchInitiatedRef = useRef(false);
  const hasExistingData = destinations.length > 0 || experiences.length > 0;
  const [initialFetchComplete, setInitialFetchComplete] = useState(hasExistingData && !loading);

  const DESTINATIONS_INITIAL_DISPLAY = 10;
  const EXPERIENCES_INITIAL_DISPLAY = 12;

  // Fetch fresh, unfiltered data when AppHome mounts (only if no data exists)
  // This ensures we show all destinations and experiences, not filtered data from other views
  useEffect(() => {
    // Skip fetch if data already exists (was cached) - mark as complete immediately
    if (hasExistingData && !loading) {
      setInitialFetchComplete(true);
      logger.debug('AppHome: Data already loaded, skipping fetch');
      return;
    }

    // Skip if we've already initiated a fetch (prevents double-fetch from strict mode)
    if (fetchInitiatedRef.current) {
      return;
    }

    fetchInitiatedRef.current = true;
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
    // Run once on mount - dependencies are stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Determine loading states for each section
  // Show skeleton only if: no data exists AND (loading OR initial fetch hasn't completed)
  // This prevents flashing when data already exists but a background refresh is happening
  const isDestinationsLoading = destinations.length === 0 && (loading || !initialFetchComplete);
  const isExperiencesLoading = experiences.length === 0 && (loading || !initialFetchComplete);

  // Check if this is a new user with no content (only after fetch completes)
  const isEmptyState = initialFetchComplete && !loading && destinations.length === 0 && experiences.length === 0;

  return (
    <PageWrapper title={lang.current.viewMeta.defaultTitle}>
      <PageOpenGraph
        title={lang.current.viewMeta.defaultTitle}
        description={lang.current.viewMeta.defaultDescription}
        keywords={lang.current.viewMeta.defaultKeywords}
        ogTitle={lang.current.viewMeta.defaultTitle}
        ogDescription={lang.current.viewMeta.defaultDescription}
      />
      <HeroBanner className="animation-fade-in" />

      {/* Empty state - only shown after fetch completes with no data */}
      {isEmptyState ? (
        <FlexCenter>
          <div className="col-12 col-md-8 col-lg-6 text-center">
            <EmptyState
              variant="generic"
              title={lang.current.alert.welcomeTitle.replace('{name}', user?.name ? `, ${user.name}` : '')}
              description={lang.current.alert.welcomeFreshStart}
              primaryAction={lang.current.button.createDestination}
              onPrimaryAction={() => navigate('/destinations/new')}
              secondaryAction={lang.current.button.createExperience}
              onSecondaryAction={() => openExperienceWizard()}
              size="md"
            />
          </div>
        </FlexCenter>
      ) : (
        <>
          {/* Popular Destinations Section */}
          <h2 className="my-4 animation-fade-in">{lang.current.heading.popularDestinations}</h2>
          {isDestinationsLoading ? (
            // Skeleton loaders matching DestinationCard layout:
            // - Wrapper with m-2 margin (matches DestinationCard.jsx line 111)
            // - Centered blurred title overlay (like destinationCardTitle)
            // - Count matches DESTINATIONS_INITIAL_DISPLAY
            <FlexCenter className="animation-fade-in">
              <div className={styles.destinationsList}>
                {Array.from({ length: DESTINATIONS_INITIAL_DISPLAY }, (_, i) => (
                  <div key={i} className={styles.destinationSkeletonWrapper}>
                    <div className={styles.destinationSkeleton}>
                      {/* Centered title overlay with blur - mirrors destinationCardTitle */}
                      <div className={styles.destinationSkeletonOverlay}>
                        <SkeletonLoader variant="text" width={`${65 + (i % 4) * 8}%`} height={20} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </FlexCenter>
          ) : destinations && destinations.length > 0 ? (
            <>
              <FlexCenter className="animation-fade-in">
                <div className={styles.destinationsList}>
                  {(showAllDestinations ? destinations : destinations.slice(0, DESTINATIONS_INITIAL_DISPLAY))
                    .map((destination, index) => (
                      <DestinationCard
                        key={destination._id || index}
                        destination={destination}
                        className="animation-fade-in"
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
                        {showAllDestinations ? lang.current.button.showLess : lang.current.button.showMore}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <FlexCenter className="animation-fade-in">
              <div className="col-12">
                <Alert type="info" dismissible={false}>
                  <p className="mb-2">{lang.current.alert.noDestinationsYet}</p>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate('/destinations/new')}
                  >
                    {lang.current.button.createDestination}
                  </Button>
                </Alert>
              </div>
            </FlexCenter>
          )}

          {/* Curated Experiences Section */}
          <h2 className="my-4 animation-fade-in">{lang.current.heading.curatedExperiences}</h2>
          {isExperiencesLoading ? (
            // Skeleton loaders matching ExperienceCard layout:
            // - Wrapper with m-2 margin and 20rem width (matches ExperienceCard.jsx line 465)
            // - Title centered in flex-grow area with blur overlay
            // - Action button at bottom
            // Count matches EXPERIENCES_INITIAL_DISPLAY
            <FlexCenter className="animation-fade-in">
              <div className={styles.experiencesList}>
                {Array.from({ length: EXPERIENCES_INITIAL_DISPLAY }, (_, i) => (
                  <div key={i} className={styles.experienceSkeletonWrapper}>
                    <div className={styles.experienceSkeleton}>
                      {/* Title area - centered with blur overlay (mirrors experienceCardTitle) */}
                      <div className={styles.experienceSkeletonTitle}>
                        <div className={styles.experienceSkeletonTitleOverlay}>
                          <SkeletonLoader variant="text" width={`${75 + (i % 3) * 8}%`} height={20} />
                          <SkeletonLoader variant="text" width={`${50 + (i % 4) * 10}%`} height={16} className="mt-1" />
                        </div>
                      </div>
                      {/* Actions area - bottom (mirrors experienceCardActions) */}
                      <div className={styles.experienceSkeletonActions}>
                        <SkeletonLoader variant="circle" width={44} height={44} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </FlexCenter>
          ) : experiences && experiences.length > 0 ? (
            <>
              <FlexCenter className="animation-fade-in">
                <div className={styles.experiencesList}>
                  {(showAllExperiences ? experiences : experiences.slice(0, EXPERIENCES_INITIAL_DISPLAY))
                    .map((experience, index) => (
                      <ExperienceCard
                        key={experience._id || index}
                        experience={experience}
                        className="animation-fade-in"
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
                    {showAllExperiences ? lang.current.button.showLess : lang.current.button.showMore}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <FlexCenter className="animation-fade-in">
              <div className="col-12">
                <Alert type="info" dismissible={false}>
                  <p className="mb-2">{lang.current.alert.noExperiencesYet}</p>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => openExperienceWizard()}
                  >
                    {lang.current.button.createExperience}
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

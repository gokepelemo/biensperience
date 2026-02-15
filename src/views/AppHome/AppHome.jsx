import { useEffect, useState, useRef, useMemo } from "react";
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
import SkeletonLoader from "../../components/SkeletonLoader/SkeletonLoader";
import { Button, FlexCenter, SpaceY, EmptyState, Alert } from "../../components/design-system";
import { logger } from "../../utilities/logger";
import styles from "./AppHome.module.scss";

const INITIAL_DISPLAY_LIMITS = {
  destinations: 10,
  experiences: 12
};

export default function AppHome() {
  const { experiences, destinations, plans, loading, applyDestinationsFilter, applyExperiencesFilter } = useData();
  const { user } = useUser();
  const { openExperienceWizard } = useExperienceWizard();
  const navigate = useNavigate();

  // UI state
  const [showAllDestinations, setShowAllDestinations] = useState(false);
  const [showAllExperiences, setShowAllExperiences] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Prevent double fetching
  const hasFetchedRef = useRef(false);

  // Determine if we have existing data
  const hasExistingData = destinations.length > 0 || experiences.length > 0;

  // Fetch fresh data when component mounts (only if no data exists)
  useEffect(() => {
    // Skip if data already exists or we've already fetched
    if (hasExistingData || hasFetchedRef.current) {
      setIsDataLoaded(true);
      logger.debug('AppHome: Data already loaded, skipping fetch');
      return;
    }

    hasFetchedRef.current = true;
    let mounted = true;

    (async () => {
      try {
        logger.info('AppHome: Fetching fresh data on mount');
        await Promise.all([
          applyDestinationsFilter({}, { shuffle: true }),
          applyExperiencesFilter({})
        ]);
        if (mounted) {
          setIsDataLoaded(true);
        }
      } catch (err) {
        logger.error('AppHome: Failed to fetch data on mount', { error: err.message });
        if (mounted) {
          setIsDataLoaded(true); // Still mark as complete so we show error state
        }
      }
    })();

    return () => { mounted = false; };
  }, [hasExistingData, applyDestinationsFilter, applyExperiencesFilter]);

  // Filter experiences to show only curated ones
  const curatedExperiences = useMemo(
    () => experiences.filter(exp => exp.isCurated),
    [experiences]
  );

  // Determine loading states
  const isDestinationsLoading = destinations.length === 0 && (loading || !isDataLoaded);
  const isExperiencesLoading = curatedExperiences.length === 0 && (loading || !isDataLoaded);

  // Determine if we should show empty state
  const isEmptyState = isDataLoaded && !hasExistingData;

  // Helper function to render show more/less button
  const renderShowMoreButton = (isExpanded, onToggle, itemCount, limit) => {
    if (itemCount <= limit) return null;

    return (
      <div className="col-12 text-center mt-4 mb-5">
        <Button
          variant="link"
          size="sm"
          onClick={onToggle}
        >
          {isExpanded ? lang.current.button.showLess : lang.current.button.showMore}
        </Button>
      </div>
    );
  };

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
            // Skeleton loaders matching DestinationCard layout
            <FlexCenter className="animation-fade-in">
              <div className={styles.destinationsList}>
                {Array.from({ length: INITIAL_DISPLAY_LIMITS.destinations }, (_, i) => (
                  <div key={i} className={styles.destinationSkeletonWrapper}>
                    <div className={styles.destinationSkeleton}>
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
                  {(showAllDestinations ? destinations : destinations.slice(0, INITIAL_DISPLAY_LIMITS.destinations))
                    .map((destination, index) => (
                      <DestinationCard
                        key={destination._id || index}
                        destination={destination}
                        className="animation-fade-in"
                      />
                    ))}
                </div>
              </FlexCenter>
              {renderShowMoreButton(showAllDestinations, () => setShowAllDestinations(!showAllDestinations), destinations.length, INITIAL_DISPLAY_LIMITS.destinations)}
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
                {Array.from({ length: INITIAL_DISPLAY_LIMITS.experiences }, (_, i) => (
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
          ) : curatedExperiences && curatedExperiences.length > 0 ? (
            <>
              <FlexCenter className="animation-fade-in">
                <div className={styles.experiencesList}>
                  {(showAllExperiences ? curatedExperiences : curatedExperiences.slice(0, INITIAL_DISPLAY_LIMITS.experiences))
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
              {renderShowMoreButton(showAllExperiences, () => setShowAllExperiences(!showAllExperiences), curatedExperiences.length, INITIAL_DISPLAY_LIMITS.experiences)}
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

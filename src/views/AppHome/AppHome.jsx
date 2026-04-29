import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Box, Flex } from "@chakra-ui/react";
import { useData } from "../../contexts/DataContext";
import { useUser } from "../../contexts/UserContext";
import { useExperienceWizard } from "../../contexts/ExperienceWizardContext";
import { lang } from "../../lang.constants";
import HeroBanner from "../../components/HeroBanner/HeroBanner";
import DestinationCard from "../../components/DestinationCard/DestinationCard";
import ExperienceCard from "../../components/ExperienceCard/ExperienceCard";
import PageOpenGraph from "../../components/OpenGraph/PageOpenGraph";
import PageWrapper from "../../components/PageWrapper/PageWrapper";
import { Button, Heading, FlexCenter, EmptyState, ExperienceCardSkeleton, DestinationCardSkeleton } from "../../components/design-system";
import { logger } from "../../utilities/logger";
import { getExperiences } from "../../utilities/experiences-api";

const DISPLAY_LIMIT = 12;
const CURATED_FETCH_LIMIT = 50;

/**
 * Renders one homepage section: heading, card grid (skeletons / cards / empty),
 * and an optional "Browse all" link when the list overflows DISPLAY_LIMIT.
 */
function HomeSection({
  title,
  items,
  isLoading,
  SkeletonComponent,
  renderCard,
  emptyVariant,
  primaryAction,
  onPrimaryAction,
  browseAllLabel,
  browseAllTo
}) {
  return (
    <>
      <Heading level={2} className="animation-fade-in" style={{ marginTop: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        {title}
      </Heading>
      {isLoading ? (
        <FlexCenter className="animation-fade-in">
          <Flex wrap="wrap" gap="4" justify="center" align="stretch" mb="8">
            <SkeletonComponent count={DISPLAY_LIMIT} />
          </Flex>
        </FlexCenter>
      ) : items.length > 0 ? (
        <>
          <FlexCenter className="animation-fade-in">
            <Flex wrap="wrap" gap="4" justify="center" align="stretch" mb="8">
              {items.slice(0, DISPLAY_LIMIT).map(renderCard)}
            </Flex>
          </FlexCenter>
          {items.length > DISPLAY_LIMIT && browseAllLabel && (
            <Box flex="0 0 100%" maxW="100%" textAlign="center" mt="6" mb="12">
              <Button
                as={Link}
                to={browseAllTo}
                variant="link"
                size="sm"
                style={{ minHeight: 'auto', minWidth: 'auto', textDecoration: 'none' }}
              >
                {browseAllLabel}
              </Button>
            </Box>
          )}
        </>
      ) : (
        <FlexCenter className="animation-fade-in">
          <Box w={{ base: "100%", md: "66.67%", lg: "50%" }} textAlign="center">
            <EmptyState
              variant={emptyVariant}
              primaryAction={primaryAction}
              onPrimaryAction={onPrimaryAction}
              size="md"
            />
          </Box>
        </FlexCenter>
      )}
    </>
  );
}

export default function AppHome() {
  const { destinationsShuffled: destinations, plans, applyDestinationsFilter } = useData();
  const { user } = useUser();
  const { openExperienceWizard } = useExperienceWizard();
  const navigate = useNavigate();
  const userId = user?._id;

  // Curated experiences are fetched into LOCAL state via the API directly,
  // so AppHome doesn't pollute DataContext's shared `experiences` cache with
  // a curator-only subset (which would silently filter the /experiences view
  // on its next visit through the cache-skip path).
  const [curatedExperiences, setCuratedExperiences] = useState([]);
  const [destinationsLoaded, setDestinationsLoaded] = useState(false);
  const [experiencesLoaded, setExperiencesLoaded] = useState(false);

  // Tracks which user we last fetched for. Resets on logout/login so we don't
  // serve the previous user's data after a session change while AppHome stays mounted.
  const fetchedForUserRef = useRef(null);
  const applyDestinationsFilterRef = useRef(applyDestinationsFilter);
  useEffect(() => {
    applyDestinationsFilterRef.current = applyDestinationsFilter;
  }, [applyDestinationsFilter]);

  useEffect(() => {
    // Bail only when the *successful* fetch matches the current user. In React
    // StrictMode the effect mounts → unmounts → mounts again; if we updated
    // this ref eagerly the second run would bail before doing any work, while
    // the first run's state writes were already cancelled by its cleanup,
    // leaving the UI stuck on skeletons.
    if (fetchedForUserRef.current === userId) return;

    let cancelled = false;

    (async () => {
      logger.debug('AppHome: Fetching homepage data', { userId });

      // Reset per-user state inside the async body so the second StrictMode
      // run's reset isn't immediately overwritten by the first run's pending writes.
      setDestinationsLoaded(false);
      setExperiencesLoaded(false);
      setCuratedExperiences([]);

      // Destinations: DataContext owns this state and de-dupes warm-cache hits.
      try {
        await applyDestinationsFilterRef.current({}, { shuffle: true });
      } catch (err) {
        logger.error('AppHome: Failed to fetch destinations', { error: err.message });
      }
      if (cancelled) return;
      setDestinationsLoaded(true);

      // Curated experiences: server-side filter, local state — does not
      // touch DataContext.experiences.
      try {
        const resp = await getExperiences({ curated: true, limit: CURATED_FETCH_LIMIT });
        const list = Array.isArray(resp) ? resp : (resp?.data || []);
        logger.debug('AppHome: Curated experiences fetched', {
          count: list.length,
          total: resp?.meta?.total,
          shape: Array.isArray(resp) ? 'array' : typeof resp
        });
        if (cancelled) return;
        setCuratedExperiences(list);
      } catch (err) {
        logger.error('AppHome: Failed to fetch curated experiences', { error: err.message });
      }
      if (cancelled) return;
      setExperiencesLoaded(true);

      // Mark this user as fetched only on success — see the comment at the top.
      fetchedForUserRef.current = userId;
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Per-resource loading flags. Detached from DataContext's global `loading`
  // (which previously caused skeleton flashes on unrelated background fetches).
  const isDestinationsLoading = !destinationsLoaded && destinations.length === 0;
  const isExperiencesLoading = !experiencesLoaded && curatedExperiences.length === 0;

  // Welcome empty state: only after BOTH lists have loaded and both are empty.
  const isEmptyState =
    destinationsLoaded && experiencesLoaded
    && destinations.length === 0
    && curatedExperiences.length === 0;

  const handleCreateDestination = useCallback(() => navigate('/destinations/new'), [navigate]);
  const handleCreateExperience = useCallback(() => openExperienceWizard(), [openExperienceWizard]);

  const renderDestinationCard = useCallback(
    (destination) => (
      <DestinationCard
        key={destination._id}
        destination={destination}
        className="animation-fade-in"
      />
    ),
    []
  );

  const renderExperienceCard = useCallback(
    (experience) => (
      <ExperienceCard
        key={experience._id}
        experience={experience}
        className="animation-fade-in"
        userPlans={plans}
      />
    ),
    [plans]
  );

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

      {isEmptyState ? (
        <FlexCenter>
          <Box w={{ base: "100%", md: "66.67%", lg: "50%" }} textAlign="center">
            <EmptyState
              variant="generic"
              title={lang.current.alert.welcomeTitle.replace('{name}', user?.name ? `, ${user.name}` : '')}
              description={lang.current.alert.welcomeFreshStart}
              primaryAction={lang.current.button.createDestination}
              onPrimaryAction={handleCreateDestination}
              secondaryAction={lang.current.button.createExperience}
              onSecondaryAction={handleCreateExperience}
              size="md"
            />
          </Box>
        </FlexCenter>
      ) : (
        <>
          <HomeSection
            title={lang.current.heading.popularDestinations}
            items={destinations}
            isLoading={isDestinationsLoading}
            SkeletonComponent={DestinationCardSkeleton}
            renderCard={renderDestinationCard}
            emptyVariant="destinations"
            primaryAction={lang.current.button.createDestination}
            onPrimaryAction={handleCreateDestination}
            browseAllLabel={lang.current.button.viewAllDestinations}
            browseAllTo="/destinations"
          />
          <HomeSection
            title={lang.current.heading.curatedExperiences}
            items={curatedExperiences}
            isLoading={isExperiencesLoading}
            SkeletonComponent={ExperienceCardSkeleton}
            renderCard={renderExperienceCard}
            emptyVariant="experiences"
            primaryAction={lang.current.button.createExperience}
            onPrimaryAction={handleCreateExperience}
            browseAllLabel={lang.current.button.viewAllExperiences}
            browseAllTo="/experiences"
          />
        </>
      )}
    </PageWrapper>
  );
}

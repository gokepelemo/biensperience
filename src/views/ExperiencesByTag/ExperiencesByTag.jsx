import styles from "./ExperiencesByTag.module.scss";
import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useData } from "../../contexts/DataContext";
import ExperienceCard from "../../components/ExperienceCard/ExperienceCard";
import Alert from "../../components/Alert/Alert";
import PageOpenGraph from "../../components/OpenGraph/PageOpenGraph";
import PageWrapper from "../../components/PageWrapper/PageWrapper";
import Loading from "../../components/Loading/Loading";
import SkeletonLoader from "../../components/SkeletonLoader/SkeletonLoader";
import Pagination from "../../components/Pagination/Pagination";
import { createUrlSlug } from "../../utilities/url-utils";
import { logger } from "../../utilities/logger";
import * as experiencesAPI from "../../utilities/experiences-api";
import { Button, Container, FlexBetween, FlexCenter, FadeIn } from "../../components/design-system";
import { FaUser, FaArrowRight } from "react-icons/fa";
import { lang } from "../../lang.constants";

const ITEMS_PER_PAGE = 12;

export default function ExperiencesByTag() {
  const { tagName } = useParams();
  const { experiences: contextExperiences, plans, loading: contextLoading } = useData();
  const [actualTagName, setActualTagName] = useState("");
  const [fetchedExperiences, setFetchedExperiences] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Helper: Convert slug/snake/kebab to Title Case synchronously (no state)
  const toTitleCase = (str) => {
    if (!str) return "";
    // Replace underscores/hyphens with spaces, collapse multiple separators
    const cleaned = String(str).replace(/[-_]+/g, " ").trim();
    return cleaned
      .split(/\s+/)
      .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ""))
      .join(" ");
  };

  // Compute initial display value from URL param to avoid flicker
  const initialTitleCaseTag = useMemo(() => toTitleCase(tagName), [tagName]);

  // Filter experiences from DataContext immediately (stale data)
  const filteredContextExperiences = useMemo(() => {
    if (!contextExperiences || !tagName) return [];

    return contextExperiences.filter(experience => {
      if (!experience.experience_type) return false;

      // Handle different formats of experience_type
      let tags = [];
      if (Array.isArray(experience.experience_type)) {
        // Flatten array - some old data has ["Tag1, Tag2"] instead of ["Tag1", "Tag2"]
        tags = experience.experience_type.flatMap(item =>
          typeof item === 'string' && item.includes(',')
            ? item.split(',').map(tag => tag.trim())
            : item
        );
      } else if (typeof experience.experience_type === 'string') {
        tags = experience.experience_type.split(',').map(tag => tag.trim());
      } else {
        return false;
      }

      return tags.some(tag => createUrlSlug(tag) === tagName);
    });
  }, [contextExperiences, tagName]);

  // Use fetched experiences if available, otherwise show filtered context experiences
  const allExperiences = fetchedExperiences !== null ? fetchedExperiences : filteredContextExperiences;

  // Calculate pagination
  const totalPages = Math.ceil(allExperiences.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const displayedExperiences = allExperiences.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Reset page when tag changes
  useEffect(() => {
    setCurrentPage(1);
  }, [tagName]);

  // Show loading if:
  // 1. Context is loading AND we don't have fetched data yet
  // 2. OR we have no experiences in context AND we're still fetching
  const loading = (contextLoading && fetchedExperiences === null) ||
                  (filteredContextExperiences.length === 0 && fetchedExperiences === null && isRefreshing);

  // Fetch ALL experiences with this tag from the backend (background refresh)
  useEffect(() => {
    let mounted = true;

    async function fetchExperiencesByTag() {
      try {
        setIsRefreshing(true);
        logger.debug('ExperiencesByTag: Fetching all experiences for tag', { tagName });

        // Fetch ALL experiences for this tag. Use the server's `all=true` flag
        // which returns the full result set (compatibility across pagination API changes).
        const response = await experiencesAPI.getExperiences({
          experience_type: initialTitleCaseTag,
          all: true
        });

        if (mounted) {
          const experiences = response.data || response || [];
          logger.debug('ExperiencesByTag: Background fetch complete', {
            tagName,
            initialCount: filteredContextExperiences.length,
            fetchedCount: experiences.length
          });
          setFetchedExperiences(experiences);
        }
      } catch (error) {
        logger.error('ExperiencesByTag: Error fetching experiences', {
          tagName,
          error: error.message
        });
        // Don't clear existing experiences on error - keep showing stale data
      } finally {
        if (mounted) {
          setIsRefreshing(false);
        }
      }
    }

    async function fetchTagName() {
      try {
        const response = await experiencesAPI.getTagName(tagName);
        if (mounted) {
          setActualTagName(response.tagName || initialTitleCaseTag);
        }
      } catch (error) {
        // If the API call fails, fall back to the URL slug
        logger.error('ExperiencesByTag: Error fetching tag name', {
          tagName,
          error: error.message
        });
        if (mounted) {
          setActualTagName(initialTitleCaseTag);
        }
      }
    }

    if (tagName) {
      fetchTagName();
      fetchExperiencesByTag();
    }

    return () => {
      mounted = false;
    };
  }, [tagName, initialTitleCaseTag, filteredContextExperiences.length]);

  // Derived value: prefer canonical from API, else initial Title Case from slug
  const displayTagName = actualTagName || initialTitleCaseTag;

  return (
    <PageWrapper title={lang.current.experiencesByTag.pageTitle.replace('{tagName}', displayTagName)}>
      <PageOpenGraph
        title={lang.current.experiencesByTag.experiencesTagged.replace('{tagName}', displayTagName)}
        description={`Discover ${displayedExperiences.length > 0 ? displayedExperiences.length : ''} travel experiences tagged as ${displayTagName}. Find unique ${displayTagName} adventures and activities around the world.`}
        keywords={`${displayTagName}, travel experiences, ${displayTagName} activities, ${displayTagName} adventures, travel planning, tourism`}
        ogTitle={`${displayTagName} Travel Experiences`}
        ogDescription={`Browse our collection of ${displayTagName} experiences${displayedExperiences.length > 0 ? `. ${displayedExperiences.length} curated experiences available` : ' from around the world'}.`}
      />

      <FadeIn>
        <Container className={styles.headerContainer}>
          {/* Row 1: Title (full width) */}
          <div className={styles.titleRow}>
            <h1 className="my-4">{lang.current.experiencesByTag.experiencesTagged.replace('{tagName}', displayTagName)}</h1>
          </div>
          {/* Row 2: Actions (right-aligned) */}
          <div className={styles.actionsRow}>
            <div className={styles.actionsRight}>
              <Button
                as={Link}
                to="/experiences"
                variant="light"
                leftIcon={<FaUser />}
                rightIcon={<FaArrowRight />}
              >
                {lang.current.experiencesByTag.viewAllExperiences}
              </Button>
            </div>
          </div>
        </Container>
      </FadeIn>

      {loading ? (
        <Loading
          variant="centered"
          size="lg"
          message={lang.current.experiencesByTag.loadingExperiences.replace('{tagName}', displayTagName)}
        />
      ) : (
        <FadeIn>
          <div className={styles.experiencesList}>
            {displayedExperiences.length > 0 ? (
              displayedExperiences.map((experience, index) => (
                <FadeIn key={experience?._id || `exp-${index}`} delay={index * 0.1}>
                  {experience ? (
                    <ExperienceCard
                      experience={experience}
                      userPlans={plans}
                      forcePreload={true}
                    />
                  ) : (
                    <div style={{ width: '12rem', height: '8rem', display: 'inline-block', margin: '0.5rem' }}>
                      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                        <SkeletonLoader variant="rectangle" width="100%" height="100%" />
                      </div>
                    </div>
                  )}
                </FadeIn>
              ))
            ) : (
              <Alert
                type="info"
                style={{ textAlign: 'center', width: '100%' }}
              >
                <h5>{lang.current.experiencesByTag.noExperiencesFound.replace('{tagName}', displayTagName)}</h5>
                <p>{lang.current.experiencesByTag.tryBrowsingAll}</p>
                <Button as={Link} to="/experiences" variant="gradient" className="mt-2">
                  {lang.current.experiencesByTag.browseAll}
                </Button>
              </Alert>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <FlexCenter className={styles.paginationWrapper}>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={allExperiences.length}
                itemsPerPage={ITEMS_PER_PAGE}
              />
            </FlexCenter>
          )}
        </FadeIn>
      )}
    </PageWrapper>
  );
}

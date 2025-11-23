import "./ExperiencesByTag.module.scss";
import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useData } from "../../contexts/DataContext";
import ExperienceCard from "../../components/ExperienceCard/ExperienceCard";
import Alert from "../../components/Alert/Alert";
import PageOpenGraph from "../../components/OpenGraph/PageOpenGraph";
import PageWrapper from "../../components/PageWrapper/PageWrapper";
import Loading from "../../components/Loading/Loading";
import { createUrlSlug } from "../../utilities/url-utils";
import { logger } from "../../utilities/logger";
import * as experiencesAPI from "../../utilities/experiences-api";
import { Button, Container, FlexBetween, FadeIn } from "../../components/design-system";

export default function ExperiencesByTag() {
  const { tagName } = useParams();
  const { experiences: contextExperiences, plans, loading: contextLoading } = useData();
  const [actualTagName, setActualTagName] = useState("");
  const [fetchedExperiences, setFetchedExperiences] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
  const displayedExperiences = fetchedExperiences !== null ? fetchedExperiences : filteredContextExperiences;

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
    <PageWrapper title={`${displayTagName} Experiences`}>
      <PageOpenGraph
        title={`Experiences tagged ${displayTagName}`}
        description={`Discover ${displayedExperiences.length > 0 ? displayedExperiences.length : ''} travel experiences tagged as ${displayTagName}. Find unique ${displayTagName} adventures and activities around the world.`}
        keywords={`${displayTagName}, travel experiences, ${displayTagName} activities, ${displayTagName} adventures, travel planning, tourism`}
        ogTitle={`${displayTagName} Travel Experiences`}
        ogDescription={`Browse our collection of ${displayTagName} experiences${displayedExperiences.length > 0 ? `. ${displayedExperiences.length} curated experiences available` : ' from around the world'}.`}
      />

      <FadeIn>
        <FlexBetween>
          <div className="col-md-6">
            <h1 className="my-4 h">Experiences tagged {displayTagName}</h1>
          </div>
          <div>
            <Button as={Link} to="/experiences" className="text-white">
              View All Experiences
            </Button>
          </div>
        </FlexBetween>
      </FadeIn>

      {loading ? (
        <Loading
          variant="centered"
          size="lg"
          message={`Loading ${displayTagName} experiences...`}
        />
      ) : displayedExperiences.length > 0 ? (
        <FadeIn>
          <Container className="my-4">
            <div className="experiences-list">
              {displayedExperiences.map((experience) => (
                <ExperienceCard
                  experience={experience}
                  key={experience._id}
                  userPlans={plans}
                  className="animation-fade_in"
                />
              ))}
            </div>
          </Container>
        </FadeIn>
      ) : (
        <FadeIn>
          <Container className="my-4">
            <div className="col-12">
              <Alert type="info">
                <h5>No experiences found with tag "{displayTagName}"</h5>
                <p>Try browsing all experiences or search for a different tag.</p>
                <Button as={Link} to="/experiences" variant="primary" className="mt-2">
                  Browse All Experiences
                </Button>
              </Alert>
            </div>
          </Container>
        </FadeIn>
      )}
    </PageWrapper>
  );
}

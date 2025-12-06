/**
 * DestinationExperienceGrid Component
 *
 * Displays a grid of experiences for a destination with built-in infinite scroll.
 * Uses the same Bootstrap Row/Col layout as the original SingleDestination view
 * to maintain pixel-perfect consistency.
 */

import { useRef, useEffect, useCallback } from 'react';
import { Row, Col } from 'react-bootstrap';
import ExperienceCard from '../../../components/ExperienceCard/ExperienceCard';
import { SkeletonLoader, EmptyState } from '../../../components/design-system';
import { lang } from '../../../lang.constants';
import styles from './DestinationExperienceGrid.module.scss';

/**
 * @param {Object} props
 * @param {Array} props.experiences - All experiences for the destination
 * @param {string} props.destinationName - Name of the destination for display
 * @param {string} props.destinationId - ID of the destination
 * @param {string} props.destinationCountry - Country of the destination
 * @param {number} props.visibleCount - Number of experiences currently visible
 * @param {boolean} props.hasMore - Whether there are more experiences to load
 * @param {Function} props.onLoadMore - Callback when more experiences should be loaded
 * @param {boolean} props.isLoading - Whether the component is in loading state
 * @param {Array} props.userPlans - User's plans for ExperienceCard context
 * @param {Function} props.onOptimisticDelete - Callback for optimistic deletion
 * @param {Function} props.onAddExperience - Callback for add experience action
 */
export default function DestinationExperienceGrid({
  experiences = [],
  destinationName,
  destinationId,
  destinationCountry,
  visibleCount,
  hasMore,
  onLoadMore,
  isLoading = false,
  userPlans = [],
  onOptimisticDelete,
  onAddExperience
}) {
  const loadMoreRef = useRef(null);

  // Infinite scroll observer
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore) return;

    const currentRef = loadMoreRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(currentRef);
    return () => {
      observer.unobserve(currentRef);
      observer.disconnect();
    };
  }, [hasMore, onLoadMore]);

  // Get displayed experiences based on visible count
  const displayedExperiences = experiences.slice(0, visibleCount);

  // Loading skeleton state
  if (isLoading && experiences.length === 0) {
    return (
      <section className={styles.grid} aria-label={`Experiences in ${destinationName}`}>
        <h3 className={styles.sectionTitle}>
          {lang.current.heading.experiencesIn.replace('{destinationName}', destinationName)}
        </h3>
        <Row className="justify-content-center">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Col
              md={6}
              key={`skeleton-${i}`}
              className="d-flex justify-content-center"
              style={{ marginBottom: 'var(--space-4)' }}
            >
              <SkeletonLoader variant="rectangle" width="100%" height="280px" />
            </Col>
          ))}
        </Row>
      </section>
    );
  }

  return (
    <section
      className={styles.grid}
      aria-label={`Experiences in ${destinationName}`}
    >
      <h3 className={styles.sectionTitle}>
        {lang.current.heading.experiencesIn.replace('{destinationName}', destinationName)}
      </h3>

      {displayedExperiences.length > 0 ? (
        <>
          <Row className="justify-content-center">
            {displayedExperiences.map((experience, index) => (
              experience ? (
                <Col
                  md={6}
                  key={experience._id || index}
                  className="d-flex justify-content-center"
                  style={{ marginBottom: 'var(--space-4)' }}
                >
                  <ExperienceCard
                    experience={experience}
                    userPlans={userPlans}
                    forcePreload={true}
                    onOptimisticDelete={onOptimisticDelete}
                  />
                </Col>
              ) : (
                <Col
                  md={6}
                  key={`placeholder-${index}`}
                  className="d-flex justify-content-center"
                  style={{ marginBottom: 'var(--space-4)' }}
                >
                  <SkeletonLoader variant="rectangle" width="100%" height="280px" />
                </Col>
              )
            ))}
          </Row>

          {/* Infinite scroll sentinel - loads more when visible */}
          {hasMore && (
            <div
              ref={loadMoreRef}
              className={styles.loadMore}
              aria-live="polite"
            >
              <span className={styles.loadMoreText}>
                Loading more experiences...
              </span>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          variant="experiences"
          title="No experiences in this destination yet"
          description="Be the first to add one and help others discover amazing activities here."
          primaryAction="Add Experience"
          onPrimaryAction={onAddExperience}
          size="md"
        />
      )}
    </section>
  );
}

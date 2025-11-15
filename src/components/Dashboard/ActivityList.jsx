import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FaClock, FaStar, FaExternalLinkAlt } from 'react-icons/fa';
import PropTypes from 'prop-types';
import { Heading } from '../design-system';
import { getActivityFeed } from '../../utilities/dashboard-api';
import { logger } from '../../utilities/logger';

/**
 * ActivityList component for displaying recent user activities with infinite scroll
 * Shows a list of recent actions with timestamps and clickable links to entities
 */
export default function ActivityList({ title = "Recent Activity", initialActivities = [] }) {
  const [activities, setActivities] = useState(initialActivities);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const observerTarget = useRef(null);
  /**
   * Render the activity description with proper formatting and links
   */
  const renderActivityDescription = (activity) => {
    const { action, item, targetItem, link } = activity;

    // For plan item completions, show more descriptive text
    // "Marked a plan item complete on {experience}" with item name as secondary detail
    if (targetItem) {
      return (
        <>
          {action}{' '}
          {link ? (
            <Link to={link} style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>
              {item}
            </Link>
          ) : (
            <strong>{item}</strong>
          )}
          {' '}
          <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.9em' }}>
            ({targetItem})
          </span>
        </>
      );
    }

    // For other activities, show "Action {entity_name}"
    return (
      <>
        {action}{' '}
        {link ? (
          <Link to={link} style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>
            {item}
          </Link>
        ) : (
          <strong>{item}</strong>
        )}
      </>
    );
  };

  // Fetch more activities
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    try {
      setLoading(true);
      setError(null);

      const response = await getActivityFeed(page + 1);

      if (response.activities && response.activities.length > 0) {
        setActivities(prev => [...prev, ...response.activities]);
        setPage(prev => prev + 1);
        setHasMore(response.pagination.hasMore);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      logger.error('Error loading more activities', { error: err.message }, err);
      setError('Failed to load more activities');
    } finally {
      setLoading(false);
    }
  }, [page, loading, hasMore]);

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [loadMore, hasMore, loading]);

  // Initialize with initial activities if provided
  useEffect(() => {
    if (initialActivities && initialActivities.length > 0 && activities.length === 0) {
      setActivities(initialActivities);
    }
  }, [initialActivities, activities.length]);

  return (
    <Card style={{
      backgroundColor: 'var(--color-bg-primary)',
      border: '1px solid var(--color-border-light)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-6)',
      maxHeight: '600px',
      overflow: 'auto',
    }}>
      <Heading level={3} style={{
        fontSize: 'var(--font-size-xl)',
        fontWeight: 'var(--font-weight-semibold)',
        color: 'var(--color-text-primary)',
        marginBottom: 'var(--space-6)',
      }}>
        {title}
      </Heading>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {activities.length > 0 ? activities.map((activity) => (
          <div
            key={activity.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 'var(--space-4)',
              backgroundColor: 'var(--color-bg-secondary)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 'var(--font-size-base)',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--space-1)',
              }}>
                {renderActivityDescription(activity)}
              </div>
              <div style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-muted)',
              }}>
                <FaClock style={{ marginRight: 'var(--space-1)' }} />
                {activity.time}
              </div>
            </div>
            {activity.link && (
              <Button
                as={Link}
                to={activity.link}
                variant="outline-secondary"
                size="sm"
                style={{
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                }}
              >
                View <FaExternalLinkAlt size={12} />
              </Button>
            )}
          </div>
        )) : (
          <div style={{
            textAlign: 'center',
            padding: 'var(--space-8)',
            color: 'var(--color-text-muted)',
          }}>
            <FaStar size={32} style={{ marginBottom: 'var(--space-2)', opacity: 0.5 }} />
            <div>No recent activity</div>
          </div>
        )}

        {/* Loading indicator */}
        {loading && (
          <div style={{
            textAlign: 'center',
            padding: 'var(--space-4)',
            color: 'var(--color-text-muted)',
          }}>
            Loading more activities...
          </div>
        )}

        {/* Error message */}
        {error && (
          <div style={{
            textAlign: 'center',
            padding: 'var(--space-4)',
            color: 'var(--color-danger)',
          }}>
            {error}
          </div>
        )}

        {/* Intersection observer target for infinite scroll */}
        <div ref={observerTarget} style={{ height: '20px' }} />

        {/* End of list message */}
        {!hasMore && activities.length > 0 && (
          <div style={{
            textAlign: 'center',
            padding: 'var(--space-4)',
            color: 'var(--color-text-muted)',
            fontSize: 'var(--font-size-sm)',
          }}>
            You've reached the end of your activity history
          </div>
        )}
      </div>
    </Card>
  );
}

ActivityList.propTypes = {
  initialActivities: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    action: PropTypes.string.isRequired,
    item: PropTypes.string.isRequired,
    targetItem: PropTypes.string, // For plan item completions
    link: PropTypes.string, // Link to the resource
    time: PropTypes.string.isRequired,
    timestamp: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    resourceType: PropTypes.string,
  })),
  title: PropTypes.string,
};

ActivityList.defaultProps = {
  initialActivities: [],
  title: 'Recent Activity',
};
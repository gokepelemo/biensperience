import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, Button } from 'react-bootstrap';
import { FaClock, FaStar, FaExternalLinkAlt } from 'react-icons/fa';
import PropTypes from 'prop-types';
import { Heading, HashLink, EmptyState } from '../design-system';
import { getUser } from '../../utilities/users-service';
import { getActivityFeed } from '../../utilities/dashboard-api';
import { logger } from '../../utilities/logger';

/**
 * ActivityList component for displaying recent user activities with infinite scroll
 * Shows a list of recent actions with timestamps and clickable links to entities
 */
export default function ActivityList({ title = "Recent Activity", initialActivities = [] }) {
  const [activities, setActivities] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, totalPages: 1, totalCount: 0 });
  const [error, setError] = useState(null);
  const isLoadingRef = useRef(false);
  const scrollRef = useRef(null);

  /**
   * Render the activity description with proper formatting and links
   */
  const renderActivityDescription = (activity) => {
    const { action, item, targetItem, link, targetLink } = activity;

    // For plan item completions, show more descriptive text
    // "Marked a plan item complete on {experience}" with item name as secondary detail
    if (targetItem) {
      return (
        <>
          {action}{' '}
            {link ? (
            <HashLink
              to={link}
              activitySource="dashboard"
              shouldShake={true}
              style={{ fontWeight: 'bold', color: 'var(--color-primary)', textDecoration: 'none' }}
            >
              {item}
            </HashLink>
          ) : (
            <strong>{item}</strong>
          )}
          {' '}
          <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.9em' }}>
            ({targetLink ? (
              <HashLink
                to={targetLink}
                activitySource="dashboard"
                shouldShake={true}
                style={{ color: 'var(--color-primary)', textDecoration: 'none' }}
              >
                {targetItem}
              </HashLink>
            ) : (
              targetItem
            )})
          </span>
        </>
      );
    }

    // For other activities, show "Action {entity_name}"
    return (
      <>
        {action}{' '}
        {link ? (
          <HashLink
            to={link}
            activitySource="dashboard"
            style={{ fontWeight: 'bold', color: 'var(--color-primary)', textDecoration: 'none' }}
          >
            {item}
          </HashLink>
        ) : (
          <strong>{item}</strong>
        )}
      </>
    );
  };

  // Load a specific page of activities (numbered pagination)
  const loadPage = useCallback(async (pageToLoad = 1) => {
    if (isLoadingRef.current) return;
    try {
      setLoading(true);
      isLoadingRef.current = true;
      setError(null);

      const response = await getActivityFeed(pageToLoad, pagination.limit);

      if (response.activities) {
        // Ensure we only show activities related to the current logged-in user
        const user = getUser();
        const filtered = user ? response.activities.filter(a => (a.actorId === user._id || a.targetId === user._id)) : response.activities;

        setActivities(filtered);
        setPage(response.pagination.page || pageToLoad);
        setPagination(response.pagination || { page: pageToLoad, limit: pagination.limit, totalPages: 1, totalCount: filtered.length });
      } else {
        setActivities([]);
        setPagination({ page: 1, limit: pagination.limit, totalPages: 1, totalCount: 0 });
      }
    } catch (err) {
      logger.error('Error loading activity page', { error: err.message }, err);
      setError(lang.current.alert.failedToLoadActivityFeed);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [pagination.limit]);

  // Load initial page on mount
  useEffect(() => {
    loadPage(1);
  }, [loadPage]);

  // Scroll to top of activity list when page changes
  useEffect(() => {
    if (scrollRef.current) {
      try {
        scrollRef.current.scrollTop = 0;
      } catch (e) {
        // ignore
      }
    }
  }, [page]);

  // If initialActivities provided and server didn't include pagination yet,
  // seed the list immediately while the first page request resolves.
  useEffect(() => {
    // If initialActivities provided, seed the list but only with items related to the current user
    if (initialActivities && initialActivities.length > 0 && activities.length === 0) {
      const user = getUser();
      const filtered = user ? initialActivities.filter(a => (a.actorId === user._id || a.targetId === user._id)) : initialActivities;
      setActivities(filtered);
    }
  }, [initialActivities]);

  return (
    <Card style={{
      backgroundColor: 'var(--color-bg-primary)',
      border: '1px solid var(--color-border-light)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-6)',
      height: '100%',
      overflow: 'auto',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <Heading level={3} style={{
        fontSize: 'var(--font-size-xl)',
        fontWeight: 'var(--font-weight-semibold)',
        color: 'var(--color-text-primary)',
        marginBottom: 'var(--space-6)',
      }}>
        {title}
      </Heading>
      <div ref={scrollRef} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', flex: 1, overflow: 'auto' }}>
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
              textDecoration: 'none',
              color: 'inherit',
              transition: 'all var(--transition-normal)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
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
              <HashLink
                to={activity.link}
                activitySource="dashboard"
                shouldShake={true}
                style={{ textDecoration: 'none' }}
              >
                <Button
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
              </HashLink>
            )}
          </div>
        )) : (
          <EmptyState
            variant="activity"
            size="sm"
            compact
          />
        )}

        {/* Loading indicator */}
        {loading && (
          <div style={{
            textAlign: 'center',
            padding: 'var(--space-4)',
            color: 'var(--color-text-muted)',
          }}>
            Loading activities...
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

        {/* End of list message */}
        {!loading && activities.length > 0 && pagination.page >= pagination.totalPages && (
          <div style={{
            textAlign: 'center',
            padding: 'var(--space-4)',
            color: 'var(--color-text-muted)',
            fontSize: 'var(--font-size-sm)',
          }}>
            You've reached the end of your activity history
          </div>
        )}
        {/* Pagination controls: only show pages count and Prev/Next */}
        {pagination.numPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
            <Button size="sm" variant="outline-secondary" disabled={page <= 1} onClick={() => loadPage(page - 1)}>Prev</Button>
            <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
              {page}/{pagination.numPages || pagination.totalPages}
            </div>
            <Button size="sm" variant="outline-secondary" disabled={page >= (pagination.numPages || pagination.totalPages)} onClick={() => loadPage(page + 1)}>Next</Button>
          </div>
        )}
      </div>
    </Card>
  );
}

// Helper to render page buttons compactly
function renderPageButtons(totalPages, currentPage, onClick) {
  const buttons = [];
  const maxButtons = 7;

  const addButton = (p) => buttons.push(
    <Button key={p} size="sm" variant={p === currentPage ? 'primary' : 'outline-secondary'} onClick={() => onClick(p)}>
      {p}
    </Button>
  );

  if (totalPages <= maxButtons) {
    for (let i = 1; i <= totalPages; i++) addButton(i);
  } else {
    // Always show first
    addButton(1);
    let start = Math.max(2, currentPage - 2);
    let end = Math.min(totalPages - 1, currentPage + 2);

    if (start > 2) buttons.push(<span key="dots-start" style={{ alignSelf: 'center' }}>...</span>);

    for (let i = start; i <= end; i++) addButton(i);

    if (end < totalPages - 1) buttons.push(<span key="dots-end" style={{ alignSelf: 'center' }}>...</span>);

    addButton(totalPages);
  }

  return <div style={{ display: 'flex', gap: 'var(--space-2)' }}>{buttons}</div>;
}

ActivityList.propTypes = {
  initialActivities: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    action: PropTypes.string.isRequired,
    item: PropTypes.string.isRequired,
    targetItem: PropTypes.string, // For plan item completions
    link: PropTypes.string, // Link to the primary resource
    targetLink: PropTypes.string, // Link to the target item (e.g., plan item)
    time: PropTypes.string.isRequired,
    timestamp: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    resourceType: PropTypes.string,
  })),
  title: PropTypes.string,
};

// defaultProps removed: using JS default parameters in function signature
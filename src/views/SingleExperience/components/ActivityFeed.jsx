/**
 * ActivityFeed Component
 * Displays the public activity feed for an experience.
 * Shows entries like "{user} is planning this experience", photo uploads, etc.
 * Includes WebSocket-driven "New Updates" indicator and optimistic UI with retry.
 */

import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FaRss, FaMapMarkerAlt, FaCamera, FaEye, FaRedo, FaSyncAlt } from 'react-icons/fa';
import UserAvatar from '../../../components/UserAvatar/UserAvatar';
import { SkeletonLoader } from '../../../components/design-system';
import { getExperienceActivityFeed } from '../../../utilities/activities-api';
import { eventBus } from '../../../utilities/event-bus';
import { displayRelativeTime } from '../../../utilities/time-utils';
import { useToast } from '../../../contexts/ToastContext';
import { logger } from '../../../utilities/logger';
import styles from './ActivityFeed.module.scss';

/**
 * Returns the icon and text for a given activity action
 */
function getActivityDisplay(activity) {
  const actorName = activity.actor?.name || 'Someone';

  switch (activity.action) {
    case 'experience_planned':
      return {
        icon: <FaMapMarkerAlt />,
        text: <><strong>{actorName}</strong> is planning this experience</>,
      };
    case 'plan_item_photo_added':
      return {
        icon: <FaCamera />,
        text: (
          <>
            <strong>{actorName}</strong> added a photo to &ldquo;{activity.target?.name || 'a plan item'}&rdquo;
          </>
        ),
      };
    case 'plan_item_visibility_changed':
      return {
        icon: <FaEye />,
        text: (
          <>
            <strong>{actorName}</strong> shared &ldquo;{activity.target?.name || 'a plan item'}&rdquo; publicly
          </>
        ),
      };
    default:
      return {
        icon: <FaRss />,
        text: <><strong>{actorName}</strong> {activity.reason || 'performed an action'}</>,
      };
  }
}

function ActivityFeed({ experienceId }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasNewUpdates, setHasNewUpdates] = useState(false);
  const { error: showError } = useToast();

  // Track the latest activity timestamp for new-updates detection
  const latestTimestampRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  /**
   * Fetch the activity feed from the API
   */
  const fetchFeed = useCallback(async (options = {}) => {
    const { append = false, before = null } = options;

    if (!append) setLoading(true);
    else setLoadingMore(true);

    setError(null);

    try {
      const params = { limit: 30 };
      if (before) params.before = before;

      const result = await getExperienceActivityFeed(experienceId, params);

      if (!isMountedRef.current) return;

      const newActivities = result?.activities || [];

      if (append) {
        setActivities(prev => [...prev, ...newActivities]);
      } else {
        setActivities(newActivities);
        // Track latest timestamp for new-updates detection
        if (newActivities.length > 0) {
          latestTimestampRef.current = newActivities[0].timestamp;
        }
      }

      setHasMore(result?.hasMore || false);
      setHasNewUpdates(false);
    } catch (err) {
      if (!isMountedRef.current) return;
      logger.error('[ActivityFeed] Failed to fetch feed', { experienceId, error: err.message });
      setError(err.message || 'Failed to load activity feed');

      if (!append) {
        showError('Failed to load activity feed', {
          actions: [{
            label: 'Retry',
            variant: 'danger',
            onClick: () => fetchFeed()
          }],
          duration: 0
        });
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [experienceId, showError]);

  // Initial load
  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  /**
   * Subscribe to WebSocket events for new activity notifications
   * Shows "New Updates" indicator instead of auto-refreshing
   */
  useEffect(() => {
    const handleNewActivity = (event) => {
      const eventExpId = event?.experienceId || event?.detail?.experienceId;
      if (eventExpId === experienceId) {
        setHasNewUpdates(true);
      }
    };

    const unsubscribe = eventBus.subscribe('experience:activity:new', handleNewActivity);
    return () => unsubscribe();
  }, [experienceId]);

  /**
   * Load more (cursor-based pagination)
   */
  const handleLoadMore = useCallback(() => {
    if (activities.length === 0 || loadingMore) return;
    const oldestTimestamp = activities[activities.length - 1]?.timestamp;
    if (oldestTimestamp) {
      fetchFeed({ append: true, before: oldestTimestamp });
    }
  }, [activities, loadingMore, fetchFeed]);

  /**
   * Handle "New Updates" click - refresh the feed
   */
  const handleRefresh = useCallback(() => {
    setHasNewUpdates(false);
    fetchFeed();
  }, [fetchFeed]);

  // Loading skeleton
  if (loading) {
    return (
      <div className={styles.activityFeed}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={styles.skeletonItem}>
            <SkeletonLoader variant="circle" width={32} height={32} />
            <div style={{ flex: 1 }}>
              <SkeletonLoader variant="text" width="80%" height={16} />
              <SkeletonLoader variant="text" width="40%" height={12} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Error state with retry
  if (error && activities.length === 0) {
    return (
      <div className={styles.activityFeed}>
        <div className={styles.errorBanner}>
          <span>{error}</span>
          <button
            type="button"
            className={styles.retryButton}
            onClick={() => fetchFeed()}
          >
            <FaRedo /> Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (activities.length === 0) {
    return (
      <div className={styles.activityFeed}>
        <div className={styles.emptyFeed}>
          <div className={styles.emptyIcon}><FaRss /></div>
          <div className={styles.emptyTitle}>No activity yet</div>
          <div className={styles.emptyDescription}>
            When users plan this experience or share photos publicly, their activity will appear here.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.activityFeed}>
      {/* New Updates indicator */}
      {hasNewUpdates && (
        <button
          type="button"
          className={styles.newUpdatesBar}
          onClick={handleRefresh}
          aria-label="New updates available, click to refresh"
        >
          <span className={styles.newUpdatesDot} />
          <FaSyncAlt size={12} /> New Updates
        </button>
      )}

      {/* Activity items */}
      {activities.map((activity) => {
        const { icon, text } = getActivityDisplay(activity);
        const actorUser = activity.actor ? {
          _id: activity.actor._id,
          name: activity.actor.name,
        } : null;

        return (
          <div key={activity._id} className={styles.activityItem}>
            <div className={styles.activityAvatar}>
              {actorUser ? (
                <Link to={`/users/${actorUser._id}`}>
                  <UserAvatar user={actorUser} size="sm" />
                </Link>
              ) : (
                <SkeletonLoader variant="circle" width={32} height={32} />
              )}
            </div>
            <div className={styles.activityContent}>
              <p className={styles.activityText}>
                <span className={styles.activityIcon}>{icon}</span>
                {text}
              </p>
              <span className={styles.activityMeta}>
                {displayRelativeTime(activity.timestamp || activity.createdAt)}
              </span>
            </div>
          </div>
        );
      })}

      {/* Load More */}
      {hasMore && (
        <div className={styles.loadMore}>
          <button
            type="button"
            className={styles.loadMoreButton}
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}

export default memo(ActivityFeed);

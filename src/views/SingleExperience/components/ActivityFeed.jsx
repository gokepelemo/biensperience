/**
 * ActivityFeed Component
 * Displays the public activity feed for an experience using Chakra UI Timeline.
 * Shows entries like "{user} is planning this experience", photo uploads, etc.
 * Includes WebSocket-driven "New Updates" indicator and optimistic UI with retry.
 * Uses Chakra UI Pagination for client-side page navigation.
 */

import { memo, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FaRss, FaMapMarkerAlt, FaCamera, FaEye, FaRedo, FaSyncAlt } from 'react-icons/fa';
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';
import { Timeline, Pagination, ButtonGroup, IconButton } from '@chakra-ui/react';
import UserAvatar from '../../../components/UserAvatar/UserAvatar';
import PhotoModal from '../../../components/PhotoModal/PhotoModal';
import { SkeletonLoader } from '../../../components/design-system';
import { getExperienceActivityFeed } from '../../../utilities/activities-api';
import { getPhotosByIds } from '../../../utilities/photos-api';
import { eventBus } from '../../../utilities/event-bus';
import { displayRelativeTime } from '../../../utilities/time-utils';
import { useToast } from '../../../contexts/ToastContext';
import { logger } from '../../../utilities/logger';
import styles from './ActivityFeed.module.scss';

const PAGE_SIZE = 10;

/**
 * Returns the icon and color for a given activity action
 */
function getActivityIndicator(activity) {
  switch (activity.action) {
    case 'experience_planned':
      return { icon: <FaMapMarkerAlt />, colorPalette: 'blue' };
    case 'plan_item_photo_added':
      return { icon: <FaCamera />, colorPalette: 'green' };
    case 'plan_item_visibility_changed':
      return { icon: <FaEye />, colorPalette: 'purple' };
    default:
      return { icon: <FaRss />, colorPalette: 'gray' };
  }
}

/**
 * Returns the text for a given activity action
 */
function getActivityText(activity) {
  const actorName = activity.actor?.name || 'Someone';

  switch (activity.action) {
    case 'experience_planned':
      return <><strong>{actorName}</strong> is planning this experience</>;
    case 'plan_item_photo_added':
      return (
        <>
          <strong>{actorName}</strong> added a photo to &ldquo;{activity.target?.name || 'a plan item'}&rdquo;
        </>
      );
    case 'plan_item_visibility_changed':
      return (
        <>
          <strong>{actorName}</strong> shared &ldquo;{activity.target?.name || 'a plan item'}&rdquo; publicly
        </>
      );
    default:
      return <><strong>{actorName}</strong> {activity.reason || 'performed an action'}</>;
  }
}

function ActivityFeed({ experienceId }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasNewUpdates, setHasNewUpdates] = useState(false);
  const [photosMap, setPhotosMap] = useState({});
  const [modalPhoto, setModalPhoto] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
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
      const params = { limit: 100 };
      if (before) params.before = before;

      const result = await getExperienceActivityFeed(experienceId, params);

      if (!isMountedRef.current) return;

      const newActivities = result?.activities || [];

      if (append) {
        setActivities(prev => [...prev, ...newActivities]);
      } else {
        setActivities(newActivities);
        setCurrentPage(1);
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
   * Batch-fetch photos referenced by plan_item_photo_added activities
   * so we can display inline thumbnails in the feed.
   */
  useEffect(() => {
    if (activities.length === 0) return;

    const photoIds = activities
      .filter(a => a.action === 'plan_item_photo_added' && a.metadata?.photoId)
      .map(a => a.metadata.photoId)
      .filter(id => !photosMap[id]); // skip already-loaded photos

    if (photoIds.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const photos = await getPhotosByIds(photoIds);
        if (cancelled) return;
        setPhotosMap(prev => {
          const next = { ...prev };
          photos.forEach(p => { if (p?._id) next[p._id] = p; });
          return next;
        });
      } catch (err) {
        logger.debug('[ActivityFeed] Failed to fetch activity photos', { error: err.message });
      }
    })();
    return () => { cancelled = true; };
  }, [activities]); // eslint-disable-line react-hooks/exhaustive-deps

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
   * Load more activities via cursor-based pagination
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

  /**
   * Client-side pagination of loaded activities
   */
  const paginatedActivities = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return activities.slice(start, start + PAGE_SIZE);
  }, [activities, currentPage]);

  const totalPages = Math.ceil(activities.length / PAGE_SIZE);
  const isOnLastPage = currentPage === totalPages;

  /**
   * Handle page change - if on last page and hasMore, load more
   */
  const handlePageChange = useCallback((e) => {
    const newPage = e.page;
    setCurrentPage(newPage);
    // If navigating to the last page and there are more to load, fetch them
    if (newPage >= totalPages && hasMore && !loadingMore) {
      handleLoadMore();
    }
  }, [totalPages, hasMore, loadingMore, handleLoadMore]);

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

      {/* Timeline Activity items */}
      <Timeline.Root size="md" variant="outline" className={styles.timeline}>
        {paginatedActivities.map((activity) => {
          const { icon, colorPalette } = getActivityIndicator(activity);
          const text = getActivityText(activity);
          const actorUser = activity.actor ? {
            _id: activity.actor._id,
            name: activity.actor.name,
          } : null;
          const activityPhoto = activity.action === 'plan_item_photo_added' && activity.metadata?.photoId
            ? photosMap[activity.metadata.photoId]
            : null;

          return (
            <Timeline.Item key={activity._id}>
              <Timeline.Connector>
                <Timeline.Separator />
                <Timeline.Indicator colorPalette={colorPalette}>
                  {actorUser ? (
                    <UserAvatar user={actorUser} size="xs" linkToProfile={false} />
                  ) : (
                    icon
                  )}
                </Timeline.Indicator>
              </Timeline.Connector>
              <Timeline.Content>
                <Timeline.Title className={styles.activityText}>
                  {text}
                </Timeline.Title>
                {activityPhoto?.url && (
                  <button
                    type="button"
                    className={styles.activityPhotoThumb}
                    onClick={() => setModalPhoto(activityPhoto)}
                    aria-label={`View photo added to ${activity.target?.name || 'plan item'}`}
                  >
                    <img
                      src={activityPhoto.url}
                      alt={activityPhoto.photo_credit || 'Activity photo'}
                      loading="lazy"
                    />
                  </button>
                )}
                <Timeline.Description className={styles.activityMeta}>
                  {displayRelativeTime(activity.timestamp || activity.createdAt)}
                </Timeline.Description>
              </Timeline.Content>
            </Timeline.Item>
          );
        })}
      </Timeline.Root>

      {/* Photo Modal */}
      {modalPhoto && (
        <PhotoModal
          photo={modalPhoto}
          onClose={() => setModalPhoto(null)}
        />
      )}

      {/* Pagination */}
      {activities.length > PAGE_SIZE && (
        <div className={styles.paginationContainer}>
          <Pagination.Root
            count={activities.length}
            pageSize={PAGE_SIZE}
            page={currentPage}
            onPageChange={handlePageChange}
          >
            <ButtonGroup variant="ghost" size="sm">
              <Pagination.PrevTrigger asChild>
                <IconButton aria-label="Previous page">
                  <LuChevronLeft />
                </IconButton>
              </Pagination.PrevTrigger>

              <Pagination.Items
                render={(page) => (
                  <IconButton variant={{ base: "ghost", _selected: "outline" }}>
                    {page.value}
                  </IconButton>
                )}
              />

              <Pagination.NextTrigger asChild>
                <IconButton aria-label="Next page">
                  <LuChevronRight />
                </IconButton>
              </Pagination.NextTrigger>
            </ButtonGroup>
          </Pagination.Root>
        </div>
      )}

      {/* Load more indicator when on last page with more data available */}
      {isOnLastPage && hasMore && (
        <div className={styles.loadMore}>
          <button
            type="button"
            className={styles.loadMoreButton}
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading...' : 'Load more activities'}
          </button>
        </div>
      )}
    </div>
  );
}

export default memo(ActivityFeed);

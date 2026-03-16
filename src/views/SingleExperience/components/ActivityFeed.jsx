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
import { Box, Flex, Timeline, Pagination, ButtonGroup, IconButton } from '@chakra-ui/react';
import UserAvatar from '../../../components/UserAvatar/UserAvatar';
import PhotoModal from '../../../components/PhotoModal/PhotoModal';
import { SkeletonLoader } from '../../../components/design-system';
import { getExperienceActivityFeed } from '../../../utilities/activities-api';
import { getPhotosByIds } from '../../../utilities/photos-api';
import { eventBus } from '../../../utilities/event-bus';
import { displayRelativeTime } from '../../../utilities/time-utils';
import { useToast } from '../../../contexts/ToastContext';
import { useUser } from '../../../contexts/UserContext';
import { logger } from '../../../utilities/logger';

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
function ActorName({ actor }) {
  const { user: currentUser } = useUser();
  const isCurrentUser = currentUser?._id && actor?._id && currentUser._id === actor._id;
  const name = isCurrentUser ? 'You' : (actor?.name || 'Someone');
  if (actor?._id) {
    return <Link to={`/profile/${actor._id}`} style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-primary)', textDecoration: 'none' }}><strong>{name}</strong></Link>;
  }
  return <strong>{name}</strong>;
}

function ActivityText({ activity }) {
  const { user: currentUser } = useUser();
  const isCurrentUser = currentUser?._id && activity.actor?._id && currentUser._id === activity.actor._id;
  const verb = (singular, plural) => isCurrentUser ? plural : singular;

  switch (activity.action) {
    case 'experience_planned':
      return <><ActorName actor={activity.actor} /> {verb('is planning', 'are planning')} this experience</>;
    case 'plan_item_photo_added':
      return (
        <>
          <ActorName actor={activity.actor} /> added a photo to &ldquo;{activity.target?.name || 'a plan item'}&rdquo;
        </>
      );
    case 'plan_item_visibility_changed':
      return (
        <>
          <ActorName actor={activity.actor} /> shared &ldquo;{activity.target?.name || 'a plan item'}&rdquo; publicly
        </>
      );
    default:
      return <><ActorName actor={activity.actor} /> {activity.reason || 'performed an action'}</>;
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
      <div style={{ padding: 'var(--space-4) 0' }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ display: 'flex', gap: 'var(--space-3)', padding: 'var(--space-3) 0', borderBottom: '1px solid var(--color-border-light)' }}>
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
      <div style={{ padding: 'var(--space-4) 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-2) var(--space-3)', marginBottom: 'var(--space-3)', background: 'rgba(220, 53, 69, 0.1)', border: '1px solid var(--color-danger, #dc3545)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', color: 'var(--color-danger, #dc3545)' }}>
          <span>{error}</span>
          <Box
            as="button"
            type="button"
            css={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)', background: 'transparent', border: '1px solid var(--color-danger, #dc3545)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-1) var(--space-3)', fontSize: 'var(--font-size-xs)', color: 'var(--color-danger, #dc3545)', cursor: 'pointer', marginTop: 'var(--space-2)', transition: 'background var(--transition-fast), color var(--transition-fast)', '&:hover': { background: 'var(--color-danger, #dc3545)', color: 'white' } }}
            onClick={() => fetchFeed()}
          >
            <FaRedo /> Retry
          </Box>
        </div>
      </div>
    );
  }

  // Empty state
  if (activities.length === 0) {
    return (
      <div style={{ padding: 'var(--space-4) 0' }}>
        <div style={{ textAlign: 'center', padding: 'var(--space-8) var(--space-4)', color: 'var(--color-text-muted)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-3)', opacity: 0.4 }}><FaRss /></div>
          <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--space-2)', color: 'var(--color-text-secondary)' }}>No activity yet</div>
          <div style={{ fontSize: 'var(--font-size-sm)', maxWidth: '300px', margin: '0 auto' }}>
            When users plan this experience or share photos publicly, their activity will appear here.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--space-4) 0' }}>
      {/* New Updates indicator */}
      {hasNewUpdates && (
        <Box
          as="button"
          type="button"
          css={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-4)', marginBottom: 'var(--space-4)', background: 'var(--color-primary-light, #e8f4fd)', border: '1px solid var(--color-primary)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-primary)', transition: 'background var(--transition-fast), transform var(--transition-fast)', animation: 'slideDown 0.3s ease-out', '&:hover': { background: 'var(--color-primary)', color: 'white', transform: 'translateY(-1px)' }, '@keyframes slideDown': { from: { opacity: 0, transform: 'translateY(-10px)' }, to: { opacity: 1, transform: 'translateY(0)' } } }}
          onClick={handleRefresh}
          aria-label="New updates available, click to refresh"
        >
          <Box as="span" css={{ width: '8px', height: '8px', background: 'var(--color-primary)', borderRadius: '50%', animation: 'pulse 1.5s ease-in-out infinite', '@keyframes pulse': { '0%': { opacity: 1 }, '50%': { opacity: 0.4 }, '100%': { opacity: 1 } } }} />
          <FaSyncAlt size={12} /> New Updates
        </Box>
      )}

      {/* Timeline Activity items */}
      <Timeline.Root size="md" variant="outline" css={{ width: '100%', '& .chakra-timeline__item': { alignItems: 'center' }, '& .chakra-timeline__content': { paddingTop: 0, paddingBottom: 'var(--space-4)' }, '& .chakra-timeline__indicator': { overflow: 'hidden' } }}>
        {paginatedActivities.map((activity) => {
          const { icon, colorPalette } = getActivityIndicator(activity);
          const text = <ActivityText activity={activity} />;
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
                <Timeline.Title css={{ display: 'block !important', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', lineHeight: 'var(--line-height-normal)', '& strong': { fontWeight: 'var(--font-weight-semibold)' } }}>
                  {text}
                </Timeline.Title>
                {activityPhoto?.url && (
                  <Box
                    as="button"
                    type="button"
                    css={{ display: 'block', width: '80px', height: '80px', margin: 'var(--space-2) 0', padding: 0, border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-md)', overflow: 'hidden', cursor: 'pointer', background: 'var(--color-bg-tertiary, #f8f9fa)', transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)', flexShrink: 0, '&:hover': { borderColor: 'var(--color-primary)', boxShadow: 'var(--shadow-sm)' }, '& img': { width: '100%', height: '100%', objectFit: 'cover', display: 'block' } }}
                    onClick={() => setModalPhoto(activityPhoto)}
                    aria-label={`View photo added to ${activity.target?.name || 'plan item'}`}
                  >
                    <img
                      src={activityPhoto.url}
                      alt={activityPhoto.photo_credit || 'Activity photo'}
                      loading="lazy"
                    />
                  </Box>
                )}
                <Timeline.Description css={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
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
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-4) 0', marginTop: 'var(--space-2)' }}>
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
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-2) 0' }}>
          <Box
            as="button"
            type="button"
            css={{ background: 'transparent', border: '1px solid var(--color-border-medium)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-6)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', cursor: 'pointer', transition: 'border-color var(--transition-fast), color var(--transition-fast)', '&:hover': { borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }, '&:disabled': { opacity: 0.5, cursor: 'not-allowed' } }}
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading...' : 'Load more activities'}
          </Box>
        </div>
      )}
    </div>
  );
}

export default memo(ActivityFeed);

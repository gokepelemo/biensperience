/**
 * ActivityFeed Component
 * Displays user's activity feed with type filtering and pagination
 *
 * Filtering strategy:
 * - Client-side instant filtering on already-loaded data for immediate feedback
 * - Background API call with server-side filter for accurate/enriched results
 * - When filter changes: immediately filter DOM data, then merge API results
 *
 * Merge strategy for background API responses:
 * - Start with existing client-side filtered data as the base
 * - Merge in new/updated activities from API by ID
 * - Preserve existing items, add new ones, update changed ones
 * - This prevents UI flashing and ensures smooth transitions
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import { FaCalendarAlt, FaMapMarkerAlt, FaStar, FaUsers, FaFilter, FaChevronRight, FaRegClock } from 'react-icons/fa';
import { Timeline } from '@chakra-ui/react';
import UserAvatar from '../UserAvatar/UserAvatar';
import { getRelativeTime } from '../../utilities/date-utils';
import { getActivityFeed } from '../../utilities/dashboard-api';
import { getFollowFeed } from '../../utilities/follows-api';
import { getPhotosByIds } from '../../utilities/photos-api';
import PhotoModal from '../PhotoModal/PhotoModal';
import { logger } from '../../utilities/logger';
import { lang } from '../../lang.constants';
import { SkeletonLoader } from '../design-system';
import { openWithSession } from '../../hooks/useBienBot';

import styles from './ActivityFeed.module.css';

// Activity type filter options
const ACTIVITY_FILTERS = [
  { key: 'all', label: 'All Activity', icon: null },
  { key: 'plans', label: 'Plans', icon: FaCalendarAlt },
  { key: 'content', label: 'Content', icon: FaStar },
  { key: 'social', label: 'Social', icon: FaUsers },
];

// Map filter keys to action types (raw action values from Activity model)
// "content" shows both Experience and Destination CRUD (creating/editing content)
// "plans" shows all plan-related activities (creating plans, completing items, costs)
// "social" shows follows and collaborators
const FILTER_TO_ACTIONS = {
  all: null, // No filter
  plans: { actions: ['plan_created', 'plan_updated', 'plan_item_completed', 'plan_item_uncompleted', 'cost_added', 'cost_updated', 'cost_deleted'] },
  content: { actions: ['resource_created', 'resource_updated', 'permission_added', 'permission_removed'], resourceTypes: ['Experience', 'Destination'] },
  social: { actions: ['follow_created', 'follow_removed', 'collaborator_added', 'collaborator_removed'] },
};

// Get icon for activity type based on raw actionType or resourceType
function getActivityIcon(resourceType, actionType) {
  if (actionType?.includes('plan') || actionType?.includes('cost')) return FaCalendarAlt;
  if (actionType?.includes('follow') || actionType?.includes('collaborator')) return FaUsers;
  if (resourceType === 'Experience') return FaStar;
  if (resourceType === 'Destination') return FaMapMarkerAlt;
  return FaStar;
}

// Get timeline indicator color palette based on activity type
function getTimelineColor(resourceType, actionType) {
  if (actionType?.includes('plan') || actionType?.includes('cost')) return 'blue';
  if (actionType?.includes('follow') || actionType?.includes('collaborator')) return 'purple';
  if (resourceType === 'Experience') return 'yellow';
  if (resourceType === 'Destination') return 'green';
  return 'gray';
}

/**
 * Group activities that refer to the same resource and happened close in time.
 * Activities performed by the same actor on the same resource within GROUP_TIME_WINDOW_MS
 * are collapsed: the first (newest) becomes the parent, the rest become children rendered
 * as sub-bullets underneath it.
 *
 * @param {Array} activities - Activities sorted newest-first
 * @returns {Array} Grouped activities where each item has a `children` array
 */
const GROUP_TIME_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// Pairs of action types that are semantic opposites and must never be grouped together.
// If a parent activity has one of these action types, a candidate with the paired
// action type will not be treated as a child bullet — even if they share the same resource.
const OPPOSING_ACTION_PAIRS = new Map([
  ['plan_item_completed', 'plan_item_uncompleted'],
  ['plan_item_uncompleted', 'plan_item_completed'],
  ['favorite_added', 'favorite_removed'],
  ['favorite_removed', 'favorite_added'],
  ['follow_created', 'follow_removed'],
  ['follow_removed', 'follow_created'],
  ['collaborator_added', 'collaborator_removed'],
  ['collaborator_removed', 'collaborator_added'],
  ['permission_added', 'permission_removed'],
  ['permission_removed', 'permission_added'],
]);

function groupActivities(activities) {
  if (!activities || activities.length === 0) return [];

  const groups = [];
  const assigned = new Set();

  for (let i = 0; i < activities.length; i++) {
    if (assigned.has(i)) continue;

    const parent = activities[i];
    const children = [];
    const parentTime = new Date(parent.timestamp).getTime();
    // Use resource link as the grouping key; fall back to item name when no link exists
    const groupKey = parent.link || parent.item;

    for (let j = i + 1; j < activities.length; j++) {
      if (assigned.has(j)) continue;

      const candidate = activities[j];
      const candidateKey = candidate.link || candidate.item;
      const candidateTime = new Date(candidate.timestamp).getTime();
      const timeDiff = Math.abs(parentTime - candidateTime);

      if (
        groupKey &&
        candidateKey === groupKey &&
        candidate.actorId === parent.actorId &&
        timeDiff <= GROUP_TIME_WINDOW_MS &&
        OPPOSING_ACTION_PAIRS.get(parent.actionType) !== candidate.actionType
      ) {
        children.push(candidate);
        assigned.add(j);
      }
    }

      // Dedupe children:
      // 1. Exclude any child whose actionType+resource is identical to the parent —
      //    the parent entry already represents that action, so the child is redundant.
      // 2. Keep only one child per unique actionType+resource combination among the
      //    remaining children (handles the same event logged multiple times).
      const parentDedupeKey = `${parent.actionType}:${parent.link || parent.item}`;
      const seenChildKeys = new Set([parentDedupeKey]);
      const deduplicatedChildren = children.filter(child => {
        const key = `${child.actionType}:${child.link || child.item}`;
        if (seenChildKeys.has(key)) return false;
        seenChildKeys.add(key);
        return true;
      });

      assigned.add(i);
    groups.push({ ...parent, children: deduplicatedChildren });
  }

  return groups;
}

/**
 * Filter activities client-side using raw actionType and resourceType fields
 * @param {Array} activities - Activities to filter
 * @param {string} filterKey - Filter key (e.g., 'plans', 'experiences')
 * @returns {Array} Filtered activities
 */
function filterActivitiesClientSide(activities, filterKey) {
  if (!activities || filterKey === 'all') return activities;

  const filterConfig = FILTER_TO_ACTIONS[filterKey];
  if (!filterConfig) return activities;

  const { actions, resourceTypes } = filterConfig;

  return activities.filter(activity => {
    // Use raw actionType for accurate matching
    const actionType = activity.actionType;
    if (!actionType) return false;

    // Check if action type matches
    if (!actions.includes(actionType)) return false;

    // If resourceTypes filter is specified, also check resourceType
    if (resourceTypes && resourceTypes.length > 0) {
      return resourceTypes.includes(activity.resourceType);
    }

    return true;
  });
}

/**
 * Merge API activities into existing activities list
 * - Preserves existing items that match the current filter
 * - Adds new items from API that don't exist locally
 * - Updates existing items with fresh data from API
 * - Maintains order based on API response (which has correct server ordering)
 *
 * @param {Array} existing - Existing activities (client-side filtered)
 * @param {Array} incoming - Incoming activities from API
 * @returns {Array} Merged activities list
 */
function mergeActivities(existing, incoming) {
  if (!incoming || incoming.length === 0) return existing || [];
  if (!existing || existing.length === 0) return incoming;

  // Create a map of existing activities by ID for O(1) lookup
  const existingMap = new Map();
  existing.forEach(activity => {
    if (activity.id) {
      existingMap.set(activity.id, activity);
    }
  });

  // Build merged list starting with API order (authoritative ordering)
  const merged = [];
  const seenIds = new Set();

  // First, add all incoming items (updating with fresh data)
  incoming.forEach(activity => {
    if (activity.id) {
      seenIds.add(activity.id);
      // Use incoming data (fresher from API)
      merged.push(activity);
    }
  });

  // Then, add any existing items not in the API response
  // (these might be items from a previous page or filtered out by API pagination)
  existing.forEach(activity => {
    if (activity.id && !seenIds.has(activity.id)) {
      merged.push(activity);
    }
  });

  return merged;
}

/**
 * ActivityFeed component
 * @param {Object} props
 * @param {string} props.userId - User ID to fetch activity for
 * @param {string} [props.feedType='all'] - 'all' for combined, 'own' for user's activity, 'following' for followed users
 */
export default function ActivityFeed({ userId, feedType = 'all', rightControls = null }) {
  // All activities (unfiltered) - used as source for client-side filtering
  const [allActivities, setAllActivities] = useState([]);
  // Displayed activities (may be client-side filtered)
  const [displayedActivities, setDisplayedActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  // Filter application loading state (used to prevent flashes during filter transitions)
  const [filterApplying, setFilterApplying] = useState(false);
  // Photo thumbnails for photo-related activities
  const [photosMap, setPhotosMap] = useState({});
  const [modalPhoto, setModalPhoto] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    totalCount: 0,
    hasMore: false,
  });

  // Track if we're refreshing in background (don't show loading indicator)
  const isBackgroundRefresh = useRef(false);

  // Prevent stale requests from overwriting UI when filters change quickly
  const latestRequestIdRef = useRef(0);
  const activeFilterRef = useRef(activeFilter);
  useEffect(() => {
    activeFilterRef.current = activeFilter;
  }, [activeFilter]);

  // Fetch activities from API
  const fetchActivities = useCallback(async (page = 1, filter = activeFilterRef.current, append = false, isBackground = false) => {
    const requestId = ++latestRequestIdRef.current;

    if (!isBackground) {
      if (page === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
    }
    if (!isBackground) {
      setError(null);
    }

    try {
      const limit = 20;

      // Get filter config for the selected filter
      const filterConfig = filter !== 'all' ? FILTER_TO_ACTIONS[filter] : null;

      if (feedType === 'all') {
        // Combined feed: fetch both own activities AND following activities
        const ownOptions = {};
        const followOptions = { limit, skip: (page - 1) * limit };

        if (filterConfig) {
          ownOptions.actions = filterConfig.actions;
          if (filterConfig.resourceTypes) {
            ownOptions.resourceTypes = filterConfig.resourceTypes;
          }
          followOptions.actions = filterConfig.actions.join(',');
          if (filterConfig.resourceTypes) {
            followOptions.resourceTypes = filterConfig.resourceTypes.join(',');
          }
        }

        // Fetch both feeds in parallel
        const [ownResponse, followResponse] = await Promise.all([
          getActivityFeed(page, limit, ownOptions),
          getFollowFeed(followOptions)
        ]);

        // Ignore stale responses
        if (requestId !== latestRequestIdRef.current) return;

        const ownItems = ownResponse.activities || [];
        const followItems = followResponse.feed || [];

        // Merge and deduplicate by ID, then sort by timestamp (most recent first)
        const combinedMap = new Map();
        [...ownItems, ...followItems].forEach(item => {
          if (item.id && !combinedMap.has(item.id)) {
            combinedMap.set(item.id, item);
          }
        });
        const combinedItems = Array.from(combinedMap.values())
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, limit); // Limit to page size

        if (append) {
          setAllActivities(prev => {
            const existingIds = new Set(prev.map(a => a.id));
            const newItems = combinedItems.filter(item => !existingIds.has(item.id));
            return [...prev, ...newItems];
          });
          setDisplayedActivities(prev => {
            const existingIds = new Set(prev.map(a => a.id));
            const newItems = combinedItems.filter(item => !existingIds.has(item.id));
            return [...prev, ...newItems];
          });
        } else if (isBackground) {
          setDisplayedActivities(prev => mergeActivities(prev, combinedItems));
          setAllActivities(prev => {
            if (filter === 'all') return combinedItems;
            return mergeActivities(prev, combinedItems);
          });
        } else {
          setAllActivities(combinedItems);
          setDisplayedActivities(combinedItems);
        }

        // Combined pagination: use the larger total count, check if either has more
        const ownTotal = ownResponse.pagination?.totalCount || 0;
        const followTotal = followResponse.total || 0;
        const ownHasMore = ownResponse.pagination?.hasMore || false;
        const followHasMore = (followResponse.skip || 0) + followItems.length < followTotal;

        setPagination({
          page,
          limit,
          totalCount: Math.max(ownTotal, followTotal),
          hasMore: ownHasMore || followHasMore,
        });
      } else if (feedType === 'following') {
        // For follow feed, use options object with actions filter
        const options = { limit, skip: (page - 1) * limit };
        if (filterConfig) {
          options.actions = filterConfig.actions.join(',');
          if (filterConfig.resourceTypes) {
            options.resourceTypes = filterConfig.resourceTypes.join(',');
          }
        }
        const response = await getFollowFeed(options);
        // Transform follow feed response to match activity feed format
        const feedItems = response.feed || [];

        // Ignore stale responses (e.g., an older "all" request completing after switching to "social")
        if (requestId !== latestRequestIdRef.current) return;

        if (append) {
          // Appending more items (load more)
          setAllActivities(prev => [...prev, ...feedItems]);
          setDisplayedActivities(prev => [...prev, ...feedItems]);
        } else if (isBackground) {
          // Background refresh: merge API results with existing client-side filtered data
          // This enriches the optimistic client-side filter with accurate server data
          setDisplayedActivities(prev => mergeActivities(prev, feedItems));
          // Also update allActivities with the fresh data for future client-side filtering
          setAllActivities(prev => {
            // When filter is 'all', just use API data; otherwise merge
            if (filter === 'all') return feedItems;
            return mergeActivities(prev, feedItems);
          });
        } else {
          // Initial load or explicit refresh: replace entirely
          setAllActivities(feedItems);
          setDisplayedActivities(feedItems);
        }
        setPagination({
          page,
          limit: response.limit || limit,
          totalCount: response.total || 0,
          hasMore: (response.skip || 0) + feedItems.length < (response.total || 0),
        });
      } else {
        // For own activity, use server-side filtering
        const options = {};
        if (filterConfig) {
          options.actions = filterConfig.actions;
          if (filterConfig.resourceTypes) {
            options.resourceTypes = filterConfig.resourceTypes;
          }
        }
        const response = await getActivityFeed(page, limit, options);
        const activityItems = response.activities || [];

        // Ignore stale responses (e.g., an older "all" request completing after switching to "social")
        if (requestId !== latestRequestIdRef.current) return;

        if (append) {
          // Appending more items (load more)
          setAllActivities(prev => [...prev, ...activityItems]);
          setDisplayedActivities(prev => [...prev, ...activityItems]);
        } else if (isBackground) {
          // Background refresh: merge API results with existing client-side filtered data
          // This enriches the optimistic client-side filter with accurate server data
          setDisplayedActivities(prev => mergeActivities(prev, activityItems));
          // Also update allActivities with the fresh data for future client-side filtering
          setAllActivities(prev => {
            // When filter is 'all', just use API data; otherwise merge
            if (filter === 'all') return activityItems;
            return mergeActivities(prev, activityItems);
          });
        } else {
          // Initial load or explicit refresh: replace entirely
          setAllActivities(activityItems);
          setDisplayedActivities(activityItems);
        }
        setPagination({
          page: response.pagination?.page || page,
          limit: response.pagination?.limit || limit,
          totalCount: response.pagination?.totalCount || 0,
          hasMore: response.pagination?.hasMore || false,
        });
      }
    } catch (err) {
      logger.error('[ActivityFeed] Failed to fetch activities', { error: err.message });
      if (!isBackground) {
        setError('Failed to load activity');
      }
    } finally {
      // Only the latest request should mutate loading flags
      if (requestId === latestRequestIdRef.current) {
        if (!isBackground) {
          setLoading(false);
          setLoadingMore(false);
        }
        // If this request was triggered by a filter change, end the filter-loading state
        if (activeFilterRef.current === filter) {
          setFilterApplying(false);
        }
      }
      isBackgroundRefresh.current = false;
    }
  }, [feedType]);

  // Initial fetch
  useEffect(() => {
    // Always fetch based on the currently-selected filter to prevent initial unfiltered flashes
    fetchActivities(1, activeFilterRef.current, false);
  }, [userId, feedType, fetchActivities]);

  /**
   * Batch-fetch photos referenced by photo activities
   * so we can display inline thumbnails in the feed.
   */
  useEffect(() => {
    if (displayedActivities.length === 0) return;

    const photoIds = displayedActivities
      .filter(a => a.photoId && !photosMap[a.photoId])
      .map(a => a.photoId);

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
  }, [displayedActivities]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle filter change with instant client-side preview + background API refresh
  const handleFilterChange = useCallback((filterKey) => {
    setFilterApplying(true);
    setActiveFilter(filterKey);

    // Immediately filter displayed activities using client-side data
    if (filterKey === 'all') {
      // Show all loaded activities
      setDisplayedActivities(allActivities);
    } else {
      // Filter client-side for instant feedback
      const filtered = filterActivitiesClientSide(allActivities, filterKey);
      setDisplayedActivities(filtered);
    }

    // Queue background API refresh for accurate server-filtered data
    isBackgroundRefresh.current = true;
    fetchActivities(1, filterKey, false, true);
  }, [allActivities, fetchActivities]);

  // Handle load more - appends next page to existing activities
  const handleLoadMore = useCallback(() => {
    if (!loadingMore && pagination.hasMore) {
      fetchActivities(pagination.page + 1, activeFilter, true);
    }
  }, [loadingMore, pagination.hasMore, pagination.page, activeFilter, fetchActivities]);

  // Render loading skeleton
  if (loading) {
    return (
      <div className={styles.activityFeed}>
        <div className={styles.filterHeader}>
          <div className={styles.filterLeftSpacer} />
          <div className={styles.filterPills}>
            {ACTIVITY_FILTERS.map((filter) => (
              <div key={filter.key} className={styles.filterPillSkeleton}>
                <SkeletonLoader variant="rectangle" width="80px" height="32px" />
              </div>
            ))}
          </div>
          <div className={styles.filterRight}>{rightControls}</div>
        </div>
        <div className={styles.activityList}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={`skeleton-${i}`} className={styles.activityItemSkeleton}>
              <SkeletonLoader variant="rectangle" width="100%" height="72px" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className={styles.activityFeed}>
        <div className={styles.errorState}>
          <p>{error}</p>
          <button onClick={() => fetchActivities(1, activeFilter, false)} className={styles.retryButton}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.activityFeed}>
      {/* Filter Pills */}
      <div className={styles.filterHeader}>
        <div className={styles.filterLeftSpacer} />
        <div className={styles.filterPills}>
          {ACTIVITY_FILTERS.map((filter) => {
            const Icon = filter.icon;
            return (
              <button
                key={filter.key}
                className={`${styles.filterPill} ${activeFilter === filter.key ? styles.filterPillActive : ''}`}
                onClick={() => handleFilterChange(filter.key)}
              >
                {Icon && <Icon className={styles.filterIcon} />}
                <span>{filter.label}</span>
              </button>
            );
          })}
        </div>
        <div className={styles.filterRight}>{rightControls}</div>
      </div>

      {/* Activity Timeline */}
      <div className={styles.activityList}>
        {filterApplying ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={`filter-skeleton-${i}`} className={styles.activityItemSkeleton}>
              <SkeletonLoader variant="rectangle" width="100%" height="72px" />
            </div>
          ))
        ) : displayedActivities.length === 0 ? (
          <div className={styles.emptyState}>
            <FaFilter className={styles.emptyIcon} />
            <p>No activity to show</p>
            {activeFilter !== 'all' && (
              <button onClick={() => handleFilterChange('all')} className={styles.clearFilterButton}>
                Clear filter
              </button>
            )}
          </div>
        ) : (
          <>
            <Timeline.Root size="md" variant="outline" className={styles.timeline}>
              {groupActivities(displayedActivities).map((activity) => {
                // Use actionType (raw) for icon selection, fall back to action text
                const Icon = getActivityIcon(activity.resourceType, activity.actionType || activity.action);
                // Determine color palette based on action type
                const colorPalette = getTimelineColor(activity.resourceType, activity.actionType || activity.action);
                // Format action text with "You" prefix for own activities
                const isOwnActivity = feedType === 'own' || activity.actorId === userId;
                const actorUser = activity.actorId ? {
                  _id: activity.actorId,
                  name: activity.actorName || 'User',
                  oauthProfilePhoto: activity.actorPhoto || null,
                } : null;
                // BienBotSession activities contain proper nouns ("BienBot", session title,
                // owner name) that must not be lowercased. All other actions are normalised
                // to lowercase so the "You Became…" capitalisation from the backend verb map
                // is rendered as "You became…".
                const actionVerb = (activity.actionType === 'collaborator_added' && activity.resourceType === 'BienBotSession')
                  ? activity.action
                  : activity.action.toLowerCase();
                const activityPhoto = activity.photoId ? photosMap[activity.photoId] : null;
                return (
                  <Timeline.Item key={activity.id}>
                    <Timeline.Connector>
                      <Timeline.Separator />
                      <Timeline.Indicator colorPalette={colorPalette}>
                        {actorUser ? (
                          <UserAvatar user={actorUser} size="xs" linkToProfile={!isOwnActivity} />
                        ) : (
                          <Icon />
                        )}
                      </Timeline.Indicator>
                    </Timeline.Connector>
                    <Timeline.Content>
                      <Timeline.Title className={styles.activityText}>
                        {isOwnActivity ? (
                          `You ${actionVerb} `
                        ) : (
                          <>
                            <Link to={`/profile/${activity.actorId}`} className={styles.activityActorLink}>
                              {activity.actorName || 'Someone'}
                            </Link>
                            {` ${actionVerb} `}
                          </>
                        )}
                        {activity.item && (
                          <>
                            {activity.link ? (
                              <Link to={activity.link} className={styles.activityLink}>
                                {activity.item}
                              </Link>
                            ) : (
                              <span className={styles.activityItemName}>{activity.item}</span>
                            )}
                            {activity.targetItem && (
                              <span className={styles.activityTarget}> - {activity.targetItem}</span>
                            )}
                            {activity.link && (
                              <Link to={activity.link} className={styles.activityArrow} aria-label={`Go to ${activity.item}`}>
                                <FaChevronRight />
                              </Link>
                            )}
                          </>
                        )}
                      </Timeline.Title>
                      {activity.resourceType === 'BienBotSession' && activity.bienbotSessionId && (
                        <a
                          href={`#bienbot-session-${activity.bienbotSessionId}`}
                          className={styles.activityLink}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25em' }}
                          onClick={(e) => {
                            e.preventDefault();
                            openWithSession(activity.bienbotSessionId);
                          }}
                        >
                          View session <FaChevronRight style={{ fontSize: '0.75em' }} />
                        </a>
                      )}
                      {activityPhoto?.url && (
                        <button
                          type="button"
                          className={styles.activityPhotoThumb}
                          onClick={() => setModalPhoto(activityPhoto)}
                          aria-label={`View photo for ${activity.item || 'activity'}`}
                        >
                          <img
                            src={activityPhoto.url}
                            alt={activityPhoto.photo_credit || 'Activity photo'}
                            loading="lazy"
                          />
                        </button>
                      )}
                      {activity.children && activity.children.length > 0 && (
                        <ul className={styles.activitySubList}>
                          {activity.children.map((child) => {
                            const isChildOwnActivity = feedType === 'own' || child.actorId === userId;
                            const isCollaboratorAction = child.actionType === 'collaborator_added' || child.actionType === 'permission_added';
                            let childActionVerb;
                            if (isCollaboratorAction && child.resourceType !== 'BienBotSession') {
                              childActionVerb = "You're now a collaborator on";
                            } else if (child.actionType === 'collaborator_added' && child.resourceType === 'BienBotSession') {
                              childActionVerb = child.action;
                            } else {
                              // Personalize: prefix with actor name/"You" so sub-bullets
                              // read as full sentences, not bare verbs.
                              const verbLower = child.action.toLowerCase();
                              if (isChildOwnActivity) {
                                childActionVerb = `You ${verbLower}`;
                              } else {
                                childActionVerb = `${child.actorName || 'Someone'} ${verbLower}`;
                              }
                            }
                            return (
                              <li key={child.id} className={styles.activitySubItem}>
                                <span className={styles.activitySubBullet} aria-hidden="true" />
                                <span>
                                  {childActionVerb}
                                  {child.item && (
                                    <>
                                      {' '}
                                      {child.link ? (
                                        <Link to={child.link} className={styles.activityLink}>
                                          {child.item}
                                        </Link>
                                      ) : (
                                        <span className={styles.activityItemName}>{child.item}</span>
                                      )}
                                    </>
                                  )}
                                  {child.targetItem && (
                                    <span className={styles.activityTarget}> - {child.targetItem}</span>
                                  )}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      <Timeline.Description className={styles.activityTime}>
                        <FaRegClock style={{ fontSize: '1em', marginRight: '0.25em', opacity: 0.7 }} />
                        {getRelativeTime(new Date(activity.timestamp))}
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

            {/* Load More */}
            {pagination.hasMore && (
              <div className={styles.loadMore}>
                <button
                  className={styles.loadMoreButton}
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? 'Loading...' : 'Load more activities'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

ActivityFeed.propTypes = {
  userId: PropTypes.string.isRequired,
  feedType: PropTypes.oneOf(['all', 'own', 'following']),
  rightControls: PropTypes.node,
};

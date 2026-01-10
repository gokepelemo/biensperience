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
import { FaCalendarAlt, FaMapMarkerAlt, FaStar, FaUsers, FaFilter, FaChevronRight } from 'react-icons/fa';
import { getActivityFeed } from '../../utilities/dashboard-api';
import { getFollowFeed } from '../../utilities/follows-api';
import { logger } from '../../utilities/logger';
import { lang } from '../../lang.constants';
import { SkeletonLoader } from '../design-system';
import styles from './ActivityFeed.module.scss';

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

  // Handle load more
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

      {/* Activity List */}
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
            {displayedActivities.map((activity) => {
              // Use actionType (raw) for icon selection, fall back to action text
              const Icon = getActivityIcon(activity.resourceType, activity.actionType || activity.action);
              // Format action text with "You" prefix for own activities
              // When viewing own profile feed, always use "You" instead of actor name
              const isOwnActivity = feedType === 'own' || activity.actorId === userId;
              const actionText = isOwnActivity
                ? `You ${activity.action.toLowerCase()}`
                : `${activity.actorName || 'Someone'} ${activity.action.toLowerCase()}`;
              return (
                <div key={activity.id} className={styles.activityItem}>
                  <div className={styles.activityIcon}>
                    <Icon />
                  </div>
                  <div className={styles.activityContent}>
                    <p className={styles.activityText}>
                      <span className={styles.activityAction}>{actionText}</span>
                      {activity.item && (
                        <>
                          {' '}
                          {activity.link ? (
                            <Link to={activity.link} className={styles.activityLink}>
                              {activity.item}
                            </Link>
                          ) : (
                            <span className={styles.activityItemName}>{activity.item}</span>
                          )}
                        </>
                      )}
                      {activity.targetItem && (
                        <span className={styles.activityTarget}> - {activity.targetItem}</span>
                      )}
                    </p>
                    <span className={styles.activityTime}>{activity.time}</span>
                  </div>
                  {activity.link && (
                    <Link to={activity.link} className={styles.activityArrow}>
                      <FaChevronRight />
                    </Link>
                  )}
                </div>
              );
            })}

            {/* Load More Button */}
            {pagination.hasMore && (
              <div className={styles.loadMore}>
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className={styles.loadMoreButton}
                >
                  {loadingMore ? lang.current.loading.default : lang.current.button.loadMore}
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

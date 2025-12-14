/**
 * ActivityFeed Component
 * Displays user's activity feed with type filtering and pagination
 *
 * Filtering strategy:
 * - Client-side instant filtering on already-loaded data for immediate feedback
 * - Background API call with server-side filter for accurate results
 * - When filter changes: immediately filter DOM data, then refresh from API
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import { FaCalendarAlt, FaMapMarkerAlt, FaStar, FaUsers, FaFilter, FaChevronRight } from 'react-icons/fa';
import { getActivityFeed } from '../../utilities/dashboard-api';
import { getFollowFeed } from '../../utilities/follows-api';
import { logger } from '../../utilities/logger';
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
 * ActivityFeed component
 * @param {Object} props
 * @param {string} props.userId - User ID to fetch activity for
 * @param {string} [props.feedType='own'] - 'own' for user's activity, 'following' for followed users
 */
export default function ActivityFeed({ userId, feedType = 'own' }) {
  // All activities (unfiltered) - used as source for client-side filtering
  const [allActivities, setAllActivities] = useState([]);
  // Displayed activities (may be client-side filtered)
  const [displayedActivities, setDisplayedActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    totalCount: 0,
    hasMore: false,
  });

  // Track if we're refreshing in background (don't show loading indicator)
  const isBackgroundRefresh = useRef(false);

  // Fetch activities from API
  const fetchActivities = useCallback(async (page = 1, filter = activeFilter, append = false, isBackground = false) => {
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
      let response;
      const limit = 20;

      // Get filter config for the selected filter
      const filterConfig = filter !== 'all' ? FILTER_TO_ACTIONS[filter] : null;

      if (feedType === 'following') {
        // For follow feed, use options object with actions filter
        const options = { limit, skip: (page - 1) * limit };
        if (filterConfig) {
          options.actions = filterConfig.actions.join(',');
          if (filterConfig.resourceTypes) {
            options.resourceTypes = filterConfig.resourceTypes.join(',');
          }
        }
        response = await getFollowFeed(options);
        // Transform follow feed response to match activity feed format
        const feedItems = response.feed || [];

        if (append) {
          setAllActivities(prev => [...prev, ...feedItems]);
          setDisplayedActivities(prev => [...prev, ...feedItems]);
        } else {
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
        response = await getActivityFeed(page, limit, options);
        const activityItems = response.activities || [];

        if (append) {
          setAllActivities(prev => [...prev, ...activityItems]);
          setDisplayedActivities(prev => [...prev, ...activityItems]);
        } else {
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
      if (!isBackground) {
        setLoading(false);
        setLoadingMore(false);
      }
      isBackgroundRefresh.current = false;
    }
  }, [activeFilter, feedType]);

  // Initial fetch
  useEffect(() => {
    fetchActivities(1, 'all', false);
  }, [userId, feedType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle filter change with instant client-side preview + background API refresh
  const handleFilterChange = useCallback((filterKey) => {
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
        <div className={styles.filterPills}>
          {ACTIVITY_FILTERS.map((filter) => (
            <div key={filter.key} className={styles.filterPillSkeleton}>
              <SkeletonLoader variant="rectangle" width="80px" height="32px" />
            </div>
          ))}
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

      {/* Activity List */}
      <div className={styles.activityList}>
        {displayedActivities.length === 0 ? (
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
              return (
                <div key={activity.id} className={styles.activityItem}>
                  <div className={styles.activityIcon}>
                    <Icon />
                  </div>
                  <div className={styles.activityContent}>
                    <p className={styles.activityText}>
                      <span className={styles.activityAction}>{activity.action}</span>
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
                  {loadingMore ? 'Loading...' : 'Load More'}
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
  feedType: PropTypes.oneOf(['own', 'following']),
};

ActivityFeed.defaultProps = {
  feedType: 'own',
};

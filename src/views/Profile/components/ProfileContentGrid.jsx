/**
 * ProfileContentGrid Component
 *
 * Displays a grid of content (experiences or destinations) for the Profile view.
 * Includes built-in skeleton loaders and pagination support.
 * Designed to match the Profile view's grid pattern for consistency.
 */

import ExperienceCard from '../../../components/ExperienceCard/ExperienceCard';
import DestinationCard from '../../../components/DestinationCard/DestinationCard';
import { SkeletonLoader, EmptyState } from '../../../components/design-system';
import Pagination from '../../../components/Pagination/Pagination';
import styles from '../Profile.module.scss';

/**
 * @param {Object} props
 * @param {'experiences' | 'destinations'} props.type - Content type to display
 * @param {Array} props.items - Items to display
 * @param {boolean} props.isLoading - Whether content is loading
 * @param {boolean} props.isInitialLoad - Whether this is the initial load (shows full skeleton)
 * @param {number} props.itemsPerPage - Number of items per page
 * @param {Object} props.meta - Pagination metadata from API
 * @param {number} props.currentPage - Current page number
 * @param {Function} props.onPageChange - Page change callback
 * @param {boolean} props.showPagination - Whether to show pagination
 * @param {Array} props.userPlans - User's plans for ExperienceCard context
 * @param {Object} props.emptyState - Empty state configuration
 */
export default function ProfileContentGrid({
  type = 'experiences',
  items = null,
  isLoading = false,
  isInitialLoad = false,
  itemsPerPage = 6,
  meta = null,
  currentPage = 1,
  onPageChange,
  showPagination = true,
  userPlans = [],
  emptyState = {}
}) {
  const isDestinations = type === 'destinations';
  const gridClassName = isDestinations ? styles.destinationsGrid : styles.profileGrid;

  // Initial load - show skeleton loaders
  if (items === null || isInitialLoad) {
    return (
      <div className={gridClassName}>
        <ProfileContentGridSkeleton type={type} count={itemsPerPage} />
      </div>
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      <div className={gridClassName}>
        <EmptyState
          variant={isDestinations ? 'destinations' : 'experiences'}
          title={emptyState.title || `No ${isDestinations ? 'Destinations' : 'Experiences'}`}
          description={emptyState.description || ''}
          primaryAction={emptyState.primaryAction}
          onPrimaryAction={emptyState.onPrimaryAction}
          size="md"
        />
      </div>
    );
  }

  // Content with loading overlay during page transitions
  return (
    <>
      <div
        className={gridClassName}
        style={isLoading ? { opacity: 0.6, pointerEvents: 'none', transition: 'opacity 0.2s ease' } : undefined}
      >
        {items.map((item, index) => (
          isDestinations ? (
            <DestinationCard
              key={item._id || index}
              destination={item}
            />
          ) : (
            <ExperienceCard
              key={item._id || index}
              experience={item}
              userPlans={userPlans}
            />
          )
        ))}
      </div>

      {/* Pagination */}
      {showPagination && meta && meta.totalPages > 1 && (
        <div className={styles.paginationContainer}>
          <Pagination
            currentPage={currentPage}
            totalPages={meta.totalPages}
            onPageChange={onPageChange}
            disabled={isLoading}
          />
        </div>
      )}
    </>
  );
}

/**
 * Skeleton loader for ProfileContentGrid
 * Provides accurate loading state that matches the actual grid layout
 */
export function ProfileContentGridSkeleton({ type = 'experiences', count = 6 }) {
  const isDestinations = type === 'destinations';

  if (isDestinations) {
    // Destination cards are smaller (12rem x 8rem)
    return Array.from({ length: count }).map((_, i) => (
      <div
        key={`skeleton-dest-${i}`}
        style={{
          width: '12rem',
          height: '8rem',
          borderRadius: 'var(--radius-2xl)',
          overflow: 'hidden'
        }}
      >
        <SkeletonLoader variant="rectangle" width="100%" height="100%" />
      </div>
    ));
  }

  // Experience cards - full card skeleton with image, title, and details
  return Array.from({ length: count }).map((_, i) => (
    <div
      key={`skeleton-exp-${i}`}
      style={{
        width: '100%',
        minWidth: '280px',
        maxWidth: '400px'
      }}
    >
      <div
        style={{
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          background: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border-light)',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        {/* Image placeholder */}
        <div style={{ position: 'relative', paddingTop: '56.25%' }}>
          <div style={{ position: 'absolute', inset: 0 }}>
            <SkeletonLoader variant="rectangle" width="100%" height="100%" />
          </div>
        </div>

        {/* Content area */}
        <div style={{ padding: 'var(--space-4)' }}>
          {/* Title */}
          <SkeletonLoader
            variant="text"
            width="85%"
            height="24px"
            style={{ marginBottom: 'var(--space-2)' }}
          />

          {/* Location */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
            <SkeletonLoader variant="circle" width="14px" height="14px" />
            <SkeletonLoader variant="text" width="100px" height="16px" />
          </div>

          {/* Tags */}
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
            <SkeletonLoader
              variant="rectangle"
              width="60px"
              height="24px"
              style={{ borderRadius: 'var(--radius-full)' }}
            />
            <SkeletonLoader
              variant="rectangle"
              width="70px"
              height="24px"
              style={{ borderRadius: 'var(--radius-full)' }}
            />
          </div>

          {/* Meta row - cost and time */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <SkeletonLoader variant="text" width="50px" height="18px" />
            <SkeletonLoader variant="text" width="60px" height="18px" />
          </div>
        </div>
      </div>
    </div>
  ));
}

/**
 * Tabs skeleton for Profile navigation
 * Shows 5 tabs: Activity, Follows, Planned, Created, Destinations
 */
export function ProfileTabsSkeleton() {
  return (
    <div className={styles.profileTabs}>
      {/* Activity tab */}
      <SkeletonLoader
        variant="rectangle"
        width="75px"
        height="32px"
        style={{ borderRadius: 'var(--radius-sm)' }}
      />
      {/* Follows tab */}
      <SkeletonLoader
        variant="rectangle"
        width="70px"
        height="32px"
        style={{ borderRadius: 'var(--radius-sm)' }}
      />
      {/* Planned tab */}
      <SkeletonLoader
        variant="rectangle"
        width="75px"
        height="32px"
        style={{ borderRadius: 'var(--radius-sm)' }}
      />
      {/* Created tab */}
      <SkeletonLoader
        variant="rectangle"
        width="70px"
        height="32px"
        style={{ borderRadius: 'var(--radius-sm)' }}
      />
      {/* Destinations tab */}
      <SkeletonLoader
        variant="rectangle"
        width="100px"
        height="32px"
        style={{ borderRadius: 'var(--radius-sm)' }}
      />
    </div>
  );
}

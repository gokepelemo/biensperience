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
        className="d-block m-2"
        style={{ width: '12rem', verticalAlign: 'top' }}
      >
        <div
          style={{
            width: '12rem',
            height: '8rem',
            borderRadius: 'var(--radius-2xl)',
            overflow: 'hidden'
          }}
        >
          <SkeletonLoader variant="rectangle" width="100%" height="100%" />
        </div>
      </div>
    ));
  }

  // Experience cards - match ExperienceCard structure (background image, title overlay, actions row)
  return Array.from({ length: count }).map((_, i) => (
    <div
      key={`skeleton-exp-${i}`}
      className="d-block m-2"
      style={{ width: '20rem', verticalAlign: 'top' }}
    >
      <div
        style={{
          width: '20rem',
          minHeight: '12rem',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-3)'
        }}
      >
        {/* Background image placeholder */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <SkeletonLoader variant="rectangle" width="100%" height="100%" />
        </div>

        {/* Title overlay placeholder */}
        <div style={{
          zIndex: 1,
          width: '100%',
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: 'var(--color-bg-overlay)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3) var(--space-4)',
            width: '100%',
            maxWidth: '85%',
            display: 'flex',
            justifyContent: 'center'
          }}>
            <SkeletonLoader
              variant="text"
              width="70%"
              height="calc(var(--font-size-lg) * 1.25)"
              animate={false}
              style={{ background: 'rgba(255, 255, 255, 0.25)' }}
            />
          </div>
        </div>

        {/* Actions row placeholder */}
        <div style={{
          zIndex: 1,
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          gap: 'var(--space-2)',
          padding: 'var(--space-3)'
        }}>
          <SkeletonLoader variant="circle" width="var(--btn-height-md)" height="var(--btn-height-md)" />
          <SkeletonLoader variant="circle" width="var(--btn-height-md)" height="var(--btn-height-md)" />
          <SkeletonLoader variant="circle" width="var(--btn-height-md)" height="var(--btn-height-md)" />
        </div>
      </div>
    </div>
  ));
}

/**
 * Single tab skeleton item matching TabNav's TabItem structure
 * Shows icon circle + text rectangle
 */
function TabSkeletonItem({ width }) {
  return (
    <div className={styles.profileTabSkeletonItem}>
      {/* Icon skeleton */}
      <SkeletonLoader
        variant="circle"
        width="var(--profile-tab-skeleton-icon-size)"
        height="var(--profile-tab-skeleton-icon-size)"
      />
      {/* Label skeleton */}
      <SkeletonLoader
        variant="rectangle"
        width={width}
        height="var(--profile-tab-skeleton-label-height)"
        style={{ borderRadius: 'var(--radius-xs)' }}
      />
    </div>
  );
}

/**
 * Tabs skeleton for Profile navigation
 * Shows 5 tabs: Activity, Follows, Planned, Created, Destinations
 * Matches TabNav component structure with centered layout
 */
export function ProfileTabsSkeleton() {
  return (
    <div className={styles.profileTabs}>
      {/* Desktop tabs skeleton (mirrors TabNav horizontal tabs) */}
      <div className={styles.profileTabsSkeletonDesktop} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
        <TabSkeletonItem width="50px" />
        <TabSkeletonItem width="45px" />
        <TabSkeletonItem width="48px" />
        <TabSkeletonItem width="48px" />
        <TabSkeletonItem width="72px" />
      </div>

      {/* Mobile dropdown skeleton (mirrors TabNav dropdown trigger) */}
      <div className={styles.profileTabsSkeletonMobile}>
        <SkeletonLoader
          variant="rectangle"
          width="100%"
          height="48px"
          style={{ borderRadius: 'var(--radius-lg)' }}
        />
      </div>
    </div>
  );
}

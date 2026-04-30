/**
 * ProfileContentGrid Component
 *
 * Displays a grid of content (experiences or destinations) for the Profile view.
 * Includes built-in skeleton loaders, placeholder support, and pagination.
 * Designed to match the Profile view's grid pattern for consistency.
 */

import { forwardRef, memo } from 'react';
import ExperienceCard from '../../../components/ExperienceCard/ExperienceCard';
import DestinationCard from '../../../components/DestinationCard/DestinationCard';
import { SkeletonLoader, EmptyState } from '../../../components/design-system';
import Pagination from '../../../components/Pagination/Pagination';
import styles from '../Profile.module.css';

/**
 * @param {Object} props
 * @param {'experiences' | 'destinations'} props.type - Content type to display
 * @param {Array} props.items - Items to display (null = initial load)
 * @param {boolean} props.isLoading - Whether content is loading (shows opacity overlay)
 * @param {number} props.skeletonCount - Number of skeleton items during initial load
 * @param {number} props.itemsPerPage - Items per page (used for placeholder calculation)
 * @param {Object} props.meta - Pagination metadata { totalPages }
 * @param {number} props.currentPage - Current page number
 * @param {Function} props.onPageChange - Page change callback
 * @param {boolean} props.showPagination - Whether to show pagination
 * @param {Function} props.renderCard - Custom card renderer: (item, index) => ReactNode
 * @param {Array} props.userPlans - User's plans for default ExperienceCard rendering
 * @param {Object} props.emptyState - Empty state configuration { title, description, icon, primaryAction, onPrimaryAction }
 * @param {boolean} props.showPlaceholders - Whether to show placeholder skeletons for partial pages
 */
const ProfileContentGrid = forwardRef(function ProfileContentGrid({
  type = 'experiences',
  items = null,
  isLoading = false,
  skeletonCount,
  itemsPerPage = 6,
  meta = null,
  currentPage = 1,
  onPageChange,
  showPagination = true,
  renderCard,
  userPlans = [],
  emptyState = {},
  showPlaceholders = false
}, ref) {
  const isDestinations = type === 'destinations';
  const gridClassName = isDestinations ? styles.destinationsGrid : styles.profileGrid;
  const effectiveSkeletonCount = skeletonCount ?? itemsPerPage;

  // Initial load - show skeleton loaders
  if (items === null) {
    return (
      <div ref={ref} className={gridClassName}>
        <ProfileContentGridSkeleton type={type} count={effectiveSkeletonCount} />
      </div>
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      <div ref={ref} className={gridClassName}>
        <div className={styles.emptyStateWrapper}>
          <EmptyState
            variant={isDestinations ? 'destinations' : 'experiences'}
            icon={emptyState.icon}
            title={emptyState.title || `No ${isDestinations ? 'Destinations' : 'Experiences'}`}
            description={emptyState.description || ''}
            primaryAction={emptyState.primaryAction}
            onPrimaryAction={emptyState.onPrimaryAction}
            size="md"
          />
        </div>
      </div>
    );
  }

  // Compute placeholders for non-last pages to maintain consistent grid height
  const totalPages = meta?.totalPages || 1;
  const needsPlaceholders = showPlaceholders && currentPage < totalPages && items.length < itemsPerPage;
  const placeholderCount = needsPlaceholders ? Math.max(0, itemsPerPage - items.length) : 0;

  // Content with loading overlay during page transitions
  return (
    <>
      <div
        ref={ref}
        className={gridClassName}
        style={isLoading ? { opacity: 0.6, pointerEvents: 'none', transition: 'opacity 0.2s ease' } : undefined}
      >
        {items.map((item, index) => {
          if (renderCard) return renderCard(item, index);
          return isDestinations ? (
            <DestinationCard
              key={item._id || index}
              destination={item}
            />
          ) : (
            <ExperienceCard
              key={item._id || index}
              experience={item}
              userPlans={userPlans}
              fluid
            />
          );
        })}
        {placeholderCount > 0 && (
          <ProfileContentGridSkeleton
            type={type}
            count={placeholderCount}
            keyPrefix="placeholder"
          />
        )}
      </div>

      {/* Pagination */}
      {showPagination && meta && totalPages > 1 && (
        <div className={styles.paginationContainer}>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
            disabled={isLoading}
          />
        </div>
      )}
    </>
  );
});

// Wrap with React.memo so Profile.jsx's frequent re-renders (caused by
// auxiliary state like `activeTab`, `showAllPlanned`, etc.) don't cascade
// into a full grid rebuild when the tab's items array hasn't changed.
// IMPORTANT: callers should pass stable refs for `renderCard`, `onPageChange`,
// and `emptyState` (via useCallback / useMemo) for memo to actually short-circuit.
export default memo(ProfileContentGrid);

/**
 * Skeleton loader for ProfileContentGrid
 * Provides accurate loading state that matches the actual grid layout
 */
export function ProfileContentGridSkeleton({ type = 'experiences', count = 6, keyPrefix = 'skeleton' }) {
  const isDestinations = type === 'destinations';

  if (isDestinations) {
    // Destination cards are 12rem x 8rem
    return Array.from({ length: count }).map((_, i) => (
      <div
        key={`${keyPrefix}-dest-${i}`}
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

  // Experience cards - match ExperienceCard dimensions (fills grid cell, min-height 12rem)
  return Array.from({ length: count }).map((_, i) => (
    <div
      key={`${keyPrefix}-exp-${i}`}
      style={{
        minHeight: '12rem',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden'
      }}
    >
      <SkeletonLoader variant="rectangle" width="100%" height="100%" style={{ minHeight: '12rem' }} />
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
 *
 * Real TabNav renders:
 *   - Desktop: nav.tabNav.tabNavBordered > button.tabItem (with icon + label + optional badge)
 *   - Mobile: div.mobileDropdown > button.dropdownTrigger (min-height 48px) + margin-bottom space-4
 * Both are wrapped in .profileTabs (margin-bottom space-6)
 */
export function ProfileTabsSkeleton() {
  return (
    <div className={styles.profileTabs}>
      {/* Desktop tabs skeleton (mirrors TabNav .tabNav.tabNavBordered) */}
      <div className={styles.profileTabsSkeletonDesktop} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
        <TabSkeletonItem width="50px" />
        <TabSkeletonItem width="45px" />
        <TabSkeletonItem width="48px" />
        <TabSkeletonItem width="48px" />
        <TabSkeletonItem width="72px" />
      </div>

      {/* Mobile dropdown skeleton (mirrors TabNav .mobileDropdown > .dropdownTrigger)
          Real trigger: min-height 48px, padding space-3/space-4, radius-lg, margin-bottom space-4 */}
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

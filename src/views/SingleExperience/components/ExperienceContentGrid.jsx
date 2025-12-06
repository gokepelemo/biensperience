/**
 * ExperienceContentGrid Component
 *
 * Displays the main content grid for a single experience with consistent layout.
 * Encapsulates the two-column layout with hero, content cards, and sidebar.
 * Designed to match SingleDestination's grid pattern for consistency.
 */

import { Row, Col, Breadcrumb } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FaHome, FaRegImage, FaHeart, FaCalendarAlt, FaDollarSign, FaClock, FaStar } from 'react-icons/fa';
import { SkeletonLoader } from '../../../components/design-system';
import styles from '../SingleExperience.module.scss';

/**
 * @param {Object} props
 * @param {Object} props.experience - Experience data
 * @param {boolean} props.isLoading - Whether the component is in loading state
 * @param {React.ReactNode} props.heroContent - Content for the hero section
 * @param {React.ReactNode} props.tagsContent - Content for the tags section
 * @param {React.ReactNode} props.titleContent - Content for the title section
 * @param {React.ReactNode} props.mainContent - Main column content (overview, plan items)
 * @param {React.ReactNode} props.sidebarContent - Sidebar column content
 * @param {number} props.photoCount - Number of photos
 * @param {Function} props.onPhotoButtonClick - Callback when photo button is clicked
 */
export default function ExperienceContentGrid({
  experience,
  isLoading = false,
  heroContent,
  tagsContent,
  titleContent,
  mainContent,
  sidebarContent,
  photoCount = 0,
  onPhotoButtonClick
}) {
  // Loading skeleton state
  if (isLoading) {
    return <ExperienceContentGridSkeleton />;
  }

  if (!experience) {
    return null;
  }

  return (
    <>
      {/* Breadcrumb Navigation */}
      <nav className={styles.breadcrumbNav} aria-label="breadcrumb">
        <Breadcrumb>
          <Breadcrumb.Item linkAs={Link} linkProps={{ to: "/" }}>
            <FaHome size={12} style={{ marginRight: '4px' }} />
            Home
          </Breadcrumb.Item>
          {experience.destination && (
            <Breadcrumb.Item
              linkAs={Link}
              linkProps={{ to: `/destinations/${experience.destination._id}` }}
            >
              {experience.destination.name}
            </Breadcrumb.Item>
          )}
          <Breadcrumb.Item active>
            {experience.name}
          </Breadcrumb.Item>
        </Breadcrumb>
      </nav>

      <Row>
        {/* Main Content Column (8 cols on lg+) */}
        <Col lg={8}>
          {/* Hero Image Section */}
          <div className={styles.heroSection}>
            {heroContent}
            <button
              type="button"
              className={styles.heroPhotoButton}
              onClick={onPhotoButtonClick}
              aria-label={photoCount > 0 ? `View ${photoCount} photo${photoCount !== 1 ? 's' : ''}` : "Add photos"}
            >
              <FaRegImage />
              {photoCount > 0 && (
                <span className={styles.photoCount}>{photoCount}</span>
              )}
            </button>
          </div>

          {/* Tags Section */}
          {tagsContent && (
            <div className={styles.tagsSection}>
              {tagsContent}
            </div>
          )}

          {/* Title Section */}
          {titleContent && (
            <div className={styles.titleSection}>
              {titleContent}
            </div>
          )}

          {/* Main Content (Overview, Plan Items, etc.) */}
          {mainContent}
        </Col>

        {/* Sidebar Column (4 cols on lg+) */}
        <Col lg={4}>
          <div className={styles.sidebar}>
            {sidebarContent}
          </div>
        </Col>
      </Row>
    </>
  );
}

/**
 * Skeleton loader for ExperienceContentGrid
 * Provides accurate loading state that matches the actual layout
 */
export function ExperienceContentGridSkeleton() {
  return (
    <>
      {/* Breadcrumb Skeleton */}
      <nav className={styles.breadcrumbNav} aria-label="breadcrumb">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <SkeletonLoader variant="text" width="50px" height="16px" />
          <span style={{ color: 'var(--color-text-muted)' }}>/</span>
          <SkeletonLoader variant="text" width="80px" height="16px" />
          <span style={{ color: 'var(--color-text-muted)' }}>/</span>
          <SkeletonLoader variant="text" width="120px" height="16px" />
        </div>
      </nav>

      <Row>
        {/* Main Content Column */}
        <Col lg={8}>
          {/* Hero Image Skeleton */}
          <div className={styles.heroSection}>
            <SkeletonLoader
              variant="rectangle"
              width="100%"
              height="100%"
              style={{ position: 'absolute', top: 0, left: 0 }}
            />
          </div>

          {/* Tags Skeleton */}
          <div className={styles.tagsSection}>
            <SkeletonLoader variant="rectangle" width="80px" height="28px" style={{ borderRadius: 'var(--radius-full)' }} />
            <SkeletonLoader variant="rectangle" width="100px" height="28px" style={{ borderRadius: 'var(--radius-full)' }} />
            <SkeletonLoader variant="rectangle" width="70px" height="28px" style={{ borderRadius: 'var(--radius-full)' }} />
          </div>

          {/* Title Section Skeleton */}
          <div className={styles.titleSection}>
            <SkeletonLoader variant="text" width="70%" height="40px" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
              <SkeletonLoader variant="circle" width="20px" height="20px" />
              <SkeletonLoader variant="text" width="200px" height="20px" />
            </div>
          </div>

          {/* Overview Card Skeleton */}
          <div className={styles.contentCard}>
            <div className={styles.cardBody}>
              <SkeletonLoader variant="text" width="120px" height="24px" style={{ marginBottom: 'var(--space-4)' }} />
              <SkeletonLoader variant="text" width="100%" height="16px" style={{ marginBottom: 'var(--space-2)' }} />
              <SkeletonLoader variant="text" width="95%" height="16px" style={{ marginBottom: 'var(--space-2)' }} />
              <SkeletonLoader variant="text" width="80%" height="16px" style={{ marginBottom: 'var(--space-2)' }} />
              <SkeletonLoader variant="text" width="60%" height="16px" />
            </div>
          </div>

          {/* Plan Items Card Skeleton */}
          <div className={styles.contentCard}>
            <div className={styles.cardBody}>
              {/* Tabs Skeleton */}
              <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-border-light)', paddingBottom: 'var(--space-3)' }}>
                <SkeletonLoader variant="rectangle" width="100px" height="36px" style={{ borderRadius: 'var(--radius-md)' }} />
                <SkeletonLoader variant="rectangle" width="80px" height="36px" style={{ borderRadius: 'var(--radius-md)' }} />
              </div>

              {/* Plan Items Skeleton */}
              {[1, 2, 3, 4].map((i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3)', borderBottom: '1px solid var(--color-border-light)' }}>
                  <SkeletonLoader variant="circle" width="24px" height="24px" />
                  <div style={{ flex: 1 }}>
                    <SkeletonLoader variant="text" width="70%" height="18px" />
                    <SkeletonLoader variant="text" width="40%" height="14px" style={{ marginTop: 'var(--space-1)' }} />
                  </div>
                  <SkeletonLoader variant="rectangle" width="60px" height="28px" style={{ borderRadius: 'var(--radius-sm)' }} />
                </div>
              ))}
            </div>
          </div>
        </Col>

        {/* Sidebar Column */}
        <Col lg={4}>
          <div className={styles.sidebar}>
            <div className={styles.sidebarCard}>
              {/* Sidebar Title Skeleton */}
              <SkeletonLoader variant="text" width="140px" height="24px" style={{ marginBottom: 'var(--space-4)' }} />

              {/* Date Picker Skeleton */}
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <SkeletonLoader variant="text" width="80px" height="14px" style={{ marginBottom: 'var(--space-2)' }} />
                <SkeletonLoader variant="rectangle" width="100%" height="44px" style={{ borderRadius: 'var(--radius-md)' }} />
              </div>

              {/* Details List Skeleton */}
              <div className={styles.detailsList}>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className={styles.detailItem}>
                    <SkeletonLoader variant="text" width="80px" height="14px" style={{ marginBottom: 'var(--space-1)' }} />
                    <SkeletonLoader variant="text" width="120px" height="20px" />
                  </div>
                ))}
              </div>

              {/* Action Buttons Skeleton */}
              <div className={styles.sidebarActions}>
                <SkeletonLoader variant="rectangle" width="100%" height="44px" style={{ borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-3)' }} />
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <SkeletonLoader variant="rectangle" width="100%" height="40px" style={{ borderRadius: 'var(--radius-md)' }} />
                  <SkeletonLoader variant="rectangle" width="44px" height="40px" style={{ borderRadius: 'var(--radius-md)', flexShrink: 0 }} />
                </div>
              </div>
            </div>
          </div>
        </Col>
      </Row>
    </>
  );
}

/**
 * Stats bar component for experience metrics
 * Similar to SingleDestination's stats bar
 */
export function ExperienceStatsBar({
  planCount = 0,
  favoriteCount = 0,
  photoCount = 0,
  planItemCount = 0
}) {
  const stats = [
    { icon: FaCalendarAlt, value: planCount, label: planCount === 1 ? 'Plan' : 'Plans', show: planCount > 0 },
    { icon: FaHeart, value: favoriteCount, label: favoriteCount === 1 ? 'Favorite' : 'Favorites', show: favoriteCount > 0 },
    { icon: FaRegImage, value: photoCount, label: photoCount === 1 ? 'Photo' : 'Photos', show: photoCount > 0 },
    { icon: FaStar, value: planItemCount, label: planItemCount === 1 ? 'Activity' : 'Activities', show: planItemCount > 0 }
  ].filter(s => s.show);

  if (stats.length === 0) return null;

  return (
    <div className={styles.statsBar}>
      {stats.map((stat, index) => (
        <div key={index} className={styles.statItem}>
          <stat.icon className={styles.statIcon} />
          <span className={styles.statValue}>{stat.value}</span>
          <span className={styles.statLabel}>{stat.label}</span>
        </div>
      ))}
    </div>
  );
}

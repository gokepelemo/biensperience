/**
 * ProfileSkeleton Component
 *
 * Full-page skeleton loader for the Profile view.
 * Displays accurate placeholders for header, tabs, and content grid
 * to prevent layout shifts during initial load.
 */

import { Row, Col } from 'react-bootstrap';
import ProfileHeaderSkeleton from './ProfileHeaderSkeleton';
import { ProfileContentGridSkeleton, ProfileTabsSkeleton } from './ProfileContentGrid';
import { SkeletonLoader } from '../../../components/design-system';
import activityFeedStyles from '../../../components/ActivityFeed/ActivityFeed.module.scss';
import styles from '../Profile.module.scss';

export default function ProfileSkeleton({ isOwner = false, activeTab = 'activity' }) {
  return (
    <>
      {/* Profile Header Card Skeleton */}
      <ProfileHeaderSkeleton isOwner={isOwner} />

      {/* Tab Navigation Skeleton */}
      <ProfileTabsSkeleton />

      {/* Content Skeleton */}
      <Row>
        <Col lg={12}>
          {activeTab === 'activity' ? (
            <div className={activityFeedStyles.activityFeed}>
              <div className={activityFeedStyles.filterHeader}>
                <div className={activityFeedStyles.filterLeftSpacer} />
                <div className={activityFeedStyles.filterPills}>
                  {["108px", "60px", "76px", "64px"].map((width, i) => (
                    <div key={`filter-pill-skeleton-${i}`} className={activityFeedStyles.filterPillSkeleton}>
                      <SkeletonLoader variant="rectangle" width={width} height="36px" style={{ borderRadius: 'var(--radius-full)' }} />
                    </div>
                  ))}
                </div>
                <div className={activityFeedStyles.filterRight}>
                  <SkeletonLoader
                    variant="rectangle"
                    width="200px"
                    height="var(--btn-height-md)"
                    style={{ borderRadius: 'var(--radius-md)' }}
                  />
                </div>
              </div>

              <div className={activityFeedStyles.activityList}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={`activity-row-skeleton-${i}`} className={activityFeedStyles.activityItemSkeleton}>
                    <SkeletonLoader variant="rectangle" width="100%" height="72px" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className={styles.profileGrid}>
              <ProfileContentGridSkeleton
                type={activeTab === 'destinations' ? 'destinations' : 'experiences'}
                count={6}
              />
            </div>
          )}
        </Col>
      </Row>
    </>
  );
}

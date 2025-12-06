/**
 * ProfileHeaderSkeleton Component
 *
 * Displays a pixel-accurate skeleton loader for the Profile header card.
 * Matches the actual ProfileHeaderCard layout to prevent layout shifts.
 */

import { Card } from 'react-bootstrap';
import SkeletonLoader from '../../../components/SkeletonLoader/SkeletonLoader';
import styles from '../Profile.module.scss';

export default function ProfileHeaderSkeleton() {
  return (
    <Card className={styles.profileHeaderCard}>
      {/* Cover Image / Gradient - Same as actual component */}
      <div className={styles.profileCover} />

      <Card.Body className={styles.profileHeaderBody}>
        <div className={styles.profileHeaderFlex}>
          {/* Avatar Skeleton */}
          <div className={styles.profileAvatarContainer} style={{ cursor: 'default' }}>
            <SkeletonLoader
              variant="circle"
              width="150px"
              height="150px"
              style={{
                border: '5px solid var(--color-bg-primary)',
                boxShadow: 'var(--shadow-lg)'
              }}
            />
          </div>

          {/* Info Section Skeleton */}
          <div className={styles.profileInfo}>
            {/* Name Row */}
            <div className={styles.profileNameRow}>
              <SkeletonLoader variant="text" width="200px" height="36px" />
              <SkeletonLoader variant="circle" width="24px" height="24px" />
            </div>

            {/* Location */}
            <div style={{ marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <SkeletonLoader variant="circle" width="16px" height="16px" />
              <SkeletonLoader variant="text" width="120px" height="20px" />
            </div>

            {/* Bio */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <SkeletonLoader variant="text" width="100%" height="18px" style={{ marginBottom: 'var(--space-2)' }} />
              <SkeletonLoader variant="text" width="85%" height="18px" />
            </div>

            {/* Metrics Bar */}
            <div className={styles.profileMetricsBar}>
              <SkeletonLoader variant="text" width="60px" height="16px" />
              <span className={styles.profileMetricDivider}>·</span>
              <SkeletonLoader variant="text" width="80px" height="16px" />
              <span className={styles.profileMetricDivider}>·</span>
              <SkeletonLoader variant="text" width="90px" height="16px" />
            </div>
          </div>

          {/* Action Buttons Skeleton */}
          <div className={styles.profileActions}>
            <SkeletonLoader
              variant="rectangle"
              width="44px"
              height="44px"
              style={{ borderRadius: 'var(--radius-full)' }}
            />
          </div>
        </div>
      </Card.Body>
    </Card>
  );
}

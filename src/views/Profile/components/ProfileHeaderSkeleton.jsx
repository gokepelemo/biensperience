/**
 * ProfileHeaderSkeleton Component
 *
 * Displays a pixel-accurate skeleton loader for the Profile header card.
 * Matches the actual ProfileHeaderCard layout to prevent layout shifts.
 */

import { Card } from 'react-bootstrap';
import SkeletonLoader from '../../../components/SkeletonLoader/SkeletonLoader';
import styles from '../Profile.module.scss';

export default function ProfileHeaderSkeleton({ isOwner = false }) {
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
              width="var(--profile-skeleton-avatar-size)"
              height="var(--profile-skeleton-avatar-size)"
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
              <SkeletonLoader
                variant="text"
                width="200px"
                height="calc(var(--profile-skeleton-name-font-size) * 1.2)"
              />
              <SkeletonLoader
                variant="circle"
                width="var(--profile-skeleton-verified-size)"
                height="var(--profile-skeleton-verified-size)"
              />
            </div>

            {/* Location */}
            <div style={{ marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <SkeletonLoader
                variant="circle"
                width="var(--profile-skeleton-location-icon-size)"
                height="var(--profile-skeleton-location-icon-size)"
              />
              <SkeletonLoader
                variant="text"
                width="120px"
                height="calc(var(--font-size-base) * 1.25)"
              />
            </div>

            {/* Bio */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <SkeletonLoader
                variant="text"
                width="100%"
                height="calc(var(--font-size-base) * 1.125)"
                style={{ marginBottom: 'var(--space-2)' }}
              />
              <SkeletonLoader
                variant="text"
                width="85%"
                height="calc(var(--font-size-base) * 1.125)"
              />
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
            {isOwner ? (
              <SkeletonLoader
                variant="rectangle"
                width="var(--btn-height-md)"
                height="var(--btn-height-md)"
                style={{ borderRadius: 'var(--radius-full)' }}
              />
            ) : null}
          </div>
        </div>
      </Card.Body>
    </Card>
  );
}

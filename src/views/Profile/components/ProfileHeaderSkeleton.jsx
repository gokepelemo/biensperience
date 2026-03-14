/**
 * ProfileHeaderSkeleton Component
 *
 * Displays a pixel-accurate skeleton loader for the Profile header card.
 * Matches the actual ProfileHeaderCard layout to prevent layout shifts.
 *
 * Key dimension sources (real content):
 *   - Avatar: 150px (120px at <=575px) via UserAvatar "profile" size + 5px border
 *   - Cover: 200px (150px at <=575px) via .profileCover
 *   - Info padding-top: var(--space-20) to push below avatar overlap
 *   - Name: font-size-3xl (font-size-2xl at <=575px) + margin-bottom space-2
 *   - Location: font-size-base + margin-bottom space-3 (conditional in real content)
 *   - Bio: font-size-base, line-height-relaxed + margin-bottom space-4 (conditional)
 *   - Metrics: 5 clickable items with padding space-1/space-2, 4 dot dividers
 *   - Actions padding-top: var(--space-20)
 */

import { Card } from '../../../components/design-system';
import SkeletonLoader from '../../../components/SkeletonLoader/SkeletonLoader';
import styles from '../Profile.module.css';

export default function ProfileHeaderSkeleton({ isOwner = false }) {
  return (
    <Card className={styles.profileHeaderCard}>
      {/* Cover Image / Gradient - Same as actual component */}
      <div className={styles.profileCover} />

      <Card.Body className={styles.profileHeaderBody}>
        <div className={styles.profileHeaderFlex}>
          {/* Avatar Skeleton - matches UserAvatar "profile" size (150px/120px) + border */}
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
            {/* Name Row - matches .profileNameRow (flex, gap space-2, margin-bottom space-2) */}
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

            {/* Location - matches .profileLocation (font-size-base, gap space-2, margin-bottom space-3)
                Real content is conditional, but we reserve the space to avoid upward shift
                when location IS present (the common case). Use visibility:hidden-style min-height
                so the skeleton reserves the row. */}
            <div className={styles.profileLocation}>
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

            {/* Bio - matches .profileBio (font-size-base, line-height-relaxed, margin-bottom space-4)
                Real content is conditional; we show skeleton to reserve common-case space. */}
            <div className={styles.profileBio}>
              <SkeletonLoader
                variant="text"
                width="100%"
                height="calc(var(--font-size-base) * var(--line-height-relaxed, 1.625))"
                style={{ marginBottom: 'var(--space-2)' }}
              />
              <SkeletonLoader
                variant="text"
                width="85%"
                height="calc(var(--font-size-base) * var(--line-height-relaxed, 1.625))"
              />
            </div>

            {/* Metrics Bar - matches real content: 5 clickable metrics + 4 dividers
                Real metrics use .profileMetricClickable which adds padding space-1/space-2
                with negative margin to keep visual alignment. We match that here. */}
            <div className={styles.profileMetricsBar}>
              <span className={styles.profileMetricClickable} style={{ cursor: 'default' }}>
                <SkeletonLoader variant="text" width="75px" height="16px" />
              </span>
              <span className={styles.profileMetricDivider}>·</span>
              <span className={styles.profileMetricClickable} style={{ cursor: 'default' }}>
                <SkeletonLoader variant="text" width="72px" height="16px" />
              </span>
              <span className={styles.profileMetricDivider}>·</span>
              <span className={styles.profileMetricClickable} style={{ cursor: 'default' }}>
                <SkeletonLoader variant="text" width="55px" height="16px" />
              </span>
              <span className={styles.profileMetricDivider}>·</span>
              <span className={styles.profileMetricClickable} style={{ cursor: 'default' }}>
                <SkeletonLoader variant="text" width="90px" height="16px" />
              </span>
              <span className={styles.profileMetricDivider}>·</span>
              <span className={styles.profileMetricClickable} style={{ cursor: 'default' }}>
                <SkeletonLoader variant="text" width="85px" height="16px" />
              </span>
            </div>
          </div>

          {/* Action Buttons Skeleton - matches .profileActions (padding-top space-20, gap space-3) */}
          <div className={styles.profileActions}>
            {isOwner ? (
              /* Owner sees a dropdown toggle (ellipsis button) */
              <SkeletonLoader
                variant="rectangle"
                width="var(--btn-height-md)"
                height="var(--btn-height-md)"
                style={{ borderRadius: 'var(--radius-full)' }}
              />
            ) : (
              /* Non-owner sees a Follow button (minWidth 100px, rounded) */
              <SkeletonLoader
                variant="rectangle"
                width="100px"
                height="var(--btn-height-md)"
                style={{ borderRadius: 'var(--radius-full)' }}
              />
            )}
          </div>
        </div>
      </Card.Body>
    </Card>
  );
}

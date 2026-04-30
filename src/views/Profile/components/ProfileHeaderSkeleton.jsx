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

export default function ProfileHeaderSkeleton({
  isOwner = false,
  hasBio = false,
  hasLocation = false,
  // Default true: most users complete email verification after signup, so the
  // verified-badge skeleton matches the common case. Real content omits the
  // badge for unverified users, which produces a small horizontal shift on
  // the name row — preferable to the alternative (default false → badge
  // appearing pushes name leftward, more visually noticeable).
  hasVerifiedBadge = true,
}) {
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
              {hasVerifiedBadge && (
                <SkeletonLoader
                  variant="circle"
                  width="var(--profile-skeleton-verified-size)"
                  height="var(--profile-skeleton-verified-size)"
                />
              )}
            </div>

            {/* Location skeleton — only render when the real content will also
                render this row. Otherwise we reserve space the real content
                will not use, producing a downward layout shift on load. The
                hasLocation hint comes from UserContext when this is the
                viewer's own profile; for other users we default to false
                (the conservative shape — no shift if absent, only a small
                downward shift if present). */}
            {hasLocation && (
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
            )}

            {/* Bio skeleton — same conditional reasoning as location above. */}
            {hasBio && (
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
            )}

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

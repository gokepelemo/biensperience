/**
 * ExperienceDetailsSkeleton Component
 * Skeleton loader for the Experience Details sidebar to prevent layout shift
 */

import SkeletonLoader from '../../../components/SkeletonLoader/SkeletonLoader';
import styles from '../SingleExperience.module.scss';

export default function ExperienceDetailsSkeleton() {
  return (
    <div className={styles.sidebarCard}>
      <h3 className={styles.sidebarTitle}>Experience Details</h3>

      {/* Details List Skeleton */}
      <div className={styles.detailsList}>
        {/* Estimated Cost */}
        <div className={styles.detailItem}>
          <div className={styles.detailLabel}>
            <SkeletonLoader variant="text" width="100px" height="16px" />
          </div>
          <div className={styles.detailValue}>
            <SkeletonLoader variant="text" width="80px" height="20px" />
          </div>
        </div>

        {/* Planning Time */}
        <div className={styles.detailItem}>
          <div className={styles.detailLabel}>
            <SkeletonLoader variant="text" width="100px" height="16px" />
          </div>
          <div className={styles.detailValue}>
            <SkeletonLoader variant="text" width="60px" height="20px" />
          </div>
        </div>

        {/* Destination */}
        <div className={styles.detailItem}>
          <div className={styles.detailLabel}>
            <SkeletonLoader variant="text" width="80px" height="16px" />
          </div>
          <div className={styles.detailValue}>
            <SkeletonLoader variant="text" width="100px" height="20px" />
          </div>
        </div>
      </div>

      {/* Action Buttons Skeleton */}
      <div className={styles.sidebarActions}>
        <div className="d-flex flex-column gap-3">
          {/* Primary Button */}
          <SkeletonLoader
            variant="rectangle"
            width="100%"
            height="52px"
            style={{ borderRadius: 'var(--radius-full)' }}
          />
          {/* Secondary Buttons Row */}
          <div className="d-flex gap-2">
            <SkeletonLoader
              variant="rectangle"
              width="100%"
              height="44px"
              style={{ borderRadius: 'var(--btn-radius-pill)', flex: 1 }}
            />
            <SkeletonLoader
              variant="rectangle"
              width="60px"
              height="44px"
              style={{ borderRadius: 'var(--btn-radius-pill)' }}
            />
            <SkeletonLoader
              variant="rectangle"
              width="60px"
              height="44px"
              style={{ borderRadius: 'var(--btn-radius-pill)' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

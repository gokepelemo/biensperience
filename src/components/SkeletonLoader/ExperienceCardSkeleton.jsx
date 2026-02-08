/**
 * ExperienceCardSkeleton Component
 * Skeleton loading placeholder matching ExperienceCard layout exactly.
 * Uses react-loading-skeleton via SkeletonLoader for consistent shimmer effects.
 *
 * Card: 20rem width, min-height 12rem, border-radius md, centered title + bottom actions row
 *
 * @param {Object} props
 * @param {number} props.count - Number of skeleton cards to render (default: 6)
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import SkeletonLoader from './SkeletonLoader';
import styles from './ExperienceCardSkeleton.module.scss';

function ExperienceCardSkeleton({ count = 6 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className={styles.card}>
          <div className={styles.content}>
            <div className={styles.titleOverlay}>
              <SkeletonLoader
                variant="text"
                width="70%"
                height="calc(var(--font-size-lg) * var(--line-height-normal, 1.5))"
                style={{ opacity: 0.5 }}
              />
            </div>
          </div>
          <div className={styles.actions}>
            <SkeletonLoader variant="circle" width={44} height={44} />
            <SkeletonLoader variant="circle" width={44} height={44} />
            <SkeletonLoader variant="circle" width={44} height={44} />
          </div>
        </div>
      ))}
    </>
  );
}

ExperienceCardSkeleton.propTypes = {
  count: PropTypes.number
};

export default memo(ExperienceCardSkeleton);

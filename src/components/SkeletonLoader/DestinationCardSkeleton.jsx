/**
 * DestinationCardSkeleton Component
 * Skeleton loading placeholder matching DestinationCard layout exactly.
 * Uses react-loading-skeleton via SkeletonLoader for consistent shimmer effects.
 *
 * Card: 12rem × 8rem, border-radius 2xl, centered title overlay with blur
 *
 * @param {Object} props
 * @param {number} props.count - Number of skeleton cards to render (default: 6)
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import SkeletonLoader from './SkeletonLoader';
import styles from './DestinationCardSkeleton.module.scss';

function DestinationCardSkeleton({ count = 6 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className={styles.card}>
          <div className={styles.overlay}>
            <SkeletonLoader
              variant="text"
              width="70%"
              height="calc(var(--font-size-lg) * var(--line-height-snug, 1.375))"
              style={{ opacity: 0.5 }}
            />
          </div>
        </div>
      ))}
    </>
  );
}

DestinationCardSkeleton.propTypes = {
  count: PropTypes.number
};

export default memo(DestinationCardSkeleton);

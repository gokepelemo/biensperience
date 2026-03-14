/**
 * MapListingCardSkeleton Component
 * Loading skeleton for MapListingCard matching its layout structure
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import SkeletonLoader from '../SkeletonLoader/SkeletonLoader';
import styles from './MapListingCardSkeleton.module.css';

/**
 * MapListingCardSkeleton component
 * @param {Object} props
 * @param {number} props.count - Number of skeletons to render
 */
function MapListingCardSkeleton({ count = 1 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className={styles.skeleton}>
          <div className={styles.imageContainer}>
            <SkeletonLoader variant="rectangle" width="100%" height="100%" />
            <div className={styles.badgePlaceholder}>
              <SkeletonLoader variant="rectangle" width={60} height={16} />
            </div>
          </div>
          <div className={styles.content}>
            <SkeletonLoader variant="text" width="80%" height={16} />
            <SkeletonLoader variant="text" width="60%" height={12} />
          </div>
        </div>
      ))}
    </>
  );
}

MapListingCardSkeleton.propTypes = {
  count: PropTypes.number
};

export default memo(MapListingCardSkeleton);

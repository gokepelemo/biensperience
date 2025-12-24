/**
 * MapListingCardSkeleton Component
 * Loading skeleton for MapListingCard matching its layout structure
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import styles from './MapListingCardSkeleton.module.scss';

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
            <div className={styles.imagePlaceholder} />
            <div className={styles.badgePlaceholder} />
          </div>
          <div className={styles.content}>
            <div className={styles.namePlaceholder} />
            <div className={styles.locationPlaceholder} />
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

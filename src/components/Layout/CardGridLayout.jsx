/**
 * CardGridLayout Component
 * Responsive grid for browsing experiences/destinations.
 * Desktop: 4 columns, Tablet: 2 columns, Mobile: 1 column.
 */

import React from 'react';
import PropTypes from 'prop-types';
import styles from './CardGridLayout.module.scss';

/**
 * CardGridLayout - Responsive card grid container
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Card components to display
 * @param {1|2|3|4|5|6} props.columns - Max number of columns on desktop
 * @param {'sm'|'md'|'lg'|'xl'} props.gap - Gap between cards
 * @param {boolean} props.masonry - Use masonry layout (variable height)
 * @param {boolean} props.loading - Show skeleton loaders
 * @param {number} props.skeletonCount - Number of skeleton cards when loading
 * @param {string} props.emptyMessage - Message when no items
 * @param {React.ReactNode} props.emptyAction - Action button when empty
 * @param {string} props.className - Additional CSS classes
 */
export default function CardGridLayout({
  children,
  columns = 4,
  gap = 'md',
  masonry = false,
  loading = false,
  skeletonCount = 8,
  emptyMessage = 'No items to display',
  emptyAction,
  className = '',
}) {
  const containerClasses = [
    styles.cardGrid,
    styles[`columns${columns}`],
    styles[`gap${gap.charAt(0).toUpperCase() + gap.slice(1)}`],
    masonry && styles.masonry,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // Loading state with skeletons
  if (loading) {
    return (
      <div className={containerClasses}>
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <div key={index} className={styles.skeletonCard}>
            <div className={styles.skeletonImage} />
            <div className={styles.skeletonContent}>
              <div className={styles.skeletonTitle} />
              <div className={styles.skeletonText} />
              <div className={styles.skeletonText} style={{ width: '60%' }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  const childArray = React.Children.toArray(children);
  if (childArray.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyMessage}>{emptyMessage}</p>
        {emptyAction && <div className={styles.emptyAction}>{emptyAction}</div>}
      </div>
    );
  }

  return <div className={containerClasses}>{children}</div>;
}

CardGridLayout.propTypes = {
  children: PropTypes.node,
  columns: PropTypes.oneOf([1, 2, 3, 4, 5, 6]),
  gap: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
  masonry: PropTypes.bool,
  loading: PropTypes.bool,
  skeletonCount: PropTypes.number,
  emptyMessage: PropTypes.string,
  emptyAction: PropTypes.node,
  className: PropTypes.string,
};

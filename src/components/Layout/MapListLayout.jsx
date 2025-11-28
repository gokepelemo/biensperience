/**
 * MapListLayout Component
 * Split view with map and list for location-based browsing.
 * Mobile: Toggle between map and list views.
 */

import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { FaList, FaMapMarkedAlt } from 'react-icons/fa';
import styles from './MapListLayout.module.scss';

/**
 * MapListLayout - Split view for map and list content
 *
 * @param {Object} props
 * @param {React.ReactNode} props.map - Map component
 * @param {React.ReactNode} props.list - List content
 * @param {'list'|'map'} props.defaultView - Default view on mobile
 * @param {'left'|'right'} props.mapPosition - Map position on desktop
 * @param {'50-50'|'60-40'|'40-60'|'70-30'|'30-70'} props.splitRatio - Split ratio on desktop
 * @param {boolean} props.resizable - Allow resizing split
 * @param {string} props.listLabel - Label for list toggle
 * @param {string} props.mapLabel - Label for map toggle
 * @param {string} props.className - Additional CSS classes
 */
export default function MapListLayout({
  map,
  list,
  defaultView = 'list',
  mapPosition = 'left',
  splitRatio = '50-50',
  resizable = false,
  listLabel = 'List',
  mapLabel = 'Map',
  className = '',
}) {
  const [mobileView, setMobileView] = useState(defaultView);

  const switchToList = useCallback(() => setMobileView('list'), []);
  const switchToMap = useCallback(() => setMobileView('map'), []);

  const containerClasses = [
    styles.mapListLayout,
    styles[`ratio${splitRatio.replace('-', '')}`],
    mapPosition === 'right' && styles.mapRight,
    resizable && styles.resizable,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClasses}>
      {/* Desktop Split View */}
      <div className={styles.desktopView}>
        <div className={styles.mapPane}>{map}</div>
        <div className={styles.listPane}>
          <div className={styles.listContent}>{list}</div>
        </div>
      </div>

      {/* Mobile Toggle View */}
      <div className={styles.mobileView}>
        <div className={styles.toggleBar}>
          <button
            type="button"
            className={`${styles.toggleButton} ${mobileView === 'list' ? styles.active : ''}`}
            onClick={switchToList}
            aria-pressed={mobileView === 'list'}
          >
            <FaList aria-hidden="true" />
            <span>{listLabel}</span>
          </button>
          <button
            type="button"
            className={`${styles.toggleButton} ${mobileView === 'map' ? styles.active : ''}`}
            onClick={switchToMap}
            aria-pressed={mobileView === 'map'}
          >
            <FaMapMarkedAlt aria-hidden="true" />
            <span>{mapLabel}</span>
          </button>
        </div>

        <div className={styles.mobileContent}>
          {mobileView === 'list' ? (
            <div className={styles.mobileList}>{list}</div>
          ) : (
            <div className={styles.mobileMap}>{map}</div>
          )}
        </div>
      </div>
    </div>
  );
}

MapListLayout.propTypes = {
  map: PropTypes.node.isRequired,
  list: PropTypes.node.isRequired,
  defaultView: PropTypes.oneOf(['list', 'map']),
  mapPosition: PropTypes.oneOf(['left', 'right']),
  splitRatio: PropTypes.oneOf(['50-50', '60-40', '40-60', '70-30', '30-70']),
  resizable: PropTypes.bool,
  listLabel: PropTypes.string,
  mapLabel: PropTypes.string,
  className: PropTypes.string,
};

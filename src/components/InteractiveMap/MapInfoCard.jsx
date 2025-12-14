/**
 * MapInfoCard Component
 * Info card displayed in Google Maps InfoWindow on marker hover/click
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { FaStar, FaMapMarkerAlt, FaChevronRight } from 'react-icons/fa';
import styles from './MapInfoCard.module.scss';

/**
 * MapInfoCard component
 * @param {Object} props
 * @param {string} props.name - Name of the destination/experience
 * @param {string} props.photo - Photo URL
 * @param {string} props.type - 'destination' or 'experience'
 * @param {string} props.link - Link to the detail page
 */
export default function MapInfoCard({ name, photo, type, link }) {
  const Icon = type === 'experience' ? FaStar : FaMapMarkerAlt;
  const typeLabel = type === 'experience' ? 'Experience' : 'Destination';

  return (
    <div className={styles.infoCard}>
      {photo && (
        <div className={styles.photoContainer}>
          <img
            src={photo}
            alt={name}
            className={styles.photo}
            loading="lazy"
          />
        </div>
      )}
      <div className={styles.content}>
        <div className={styles.header}>
          <span className={`${styles.badge} ${styles[type]}`}>
            <Icon className={styles.badgeIcon} />
            {typeLabel}
          </span>
        </div>
        <h4 className={styles.name}>{name}</h4>
        {link && (
          <Link to={link} className={styles.viewLink}>
            View Details
            <FaChevronRight className={styles.arrowIcon} />
          </Link>
        )}
      </div>
    </div>
  );
}

MapInfoCard.propTypes = {
  name: PropTypes.string.isRequired,
  photo: PropTypes.string,
  type: PropTypes.oneOf(['destination', 'experience']).isRequired,
  link: PropTypes.string
};

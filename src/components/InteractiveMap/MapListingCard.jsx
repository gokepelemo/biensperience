/**
 * MapListingCard Component
 * Card for displaying destination/experience in map sidebar listing
 * Inspired by Airbnb/booking style listings
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { FaStar, FaMapMarkerAlt } from 'react-icons/fa';
import styles from './MapListingCard.module.scss';

/**
 * MapListingCard component
 * @param {Object} props
 * @param {string} props.id - Unique identifier
 * @param {string} props.name - Name of the destination/experience
 * @param {string} props.photo - Photo URL
 * @param {string} props.type - 'destination' or 'experience'
 * @param {string} props.link - Link to the detail page
 * @param {string} props.location - Location/city name
 * @param {boolean} props.isActive - Whether this card is currently selected/hovered on map
 * @param {Function} props.onHover - Callback when card is hovered
 * @param {Function} props.onLeave - Callback when hover ends
 * @param {Function} props.onClick - Callback when card is clicked
 */
function MapListingCard({
  id,
  name,
  photo,
  type,
  link,
  location,
  isActive = false,
  onHover,
  onLeave,
  onClick
}) {
  const Icon = type === 'experience' ? FaStar : FaMapMarkerAlt;
  const typeLabel = type === 'experience' ? 'Experience' : 'Destination';

  const handleMouseEnter = () => {
    if (onHover) onHover(id);
  };

  const handleMouseLeave = () => {
    if (onLeave) onLeave(id);
  };

  const handleClick = (e) => {
    if (onClick) {
      onClick(id, e);
    }
  };

  return (
    <div
      className={`${styles.listingCard} ${isActive ? styles.active : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick(e);
        }
      }}
    >
      <div className={styles.imageContainer}>
        {photo ? (
          <img
            src={photo}
            alt={name}
            className={styles.image}
            loading="lazy"
          />
        ) : (
          <div className={styles.noImage}>
            <Icon />
          </div>
        )}
        <span className={`${styles.typeBadge} ${styles[type]}`}>
          <Icon className={styles.badgeIcon} />
          {typeLabel}
        </span>
      </div>

      <div className={styles.content}>
        <h3 className={styles.name}>
          <Link to={link} className={styles.nameLink}>
            {name}
          </Link>
        </h3>
        {location && (
          <p className={styles.location}>
            <FaMapMarkerAlt className={styles.locationIcon} />
            {location}
          </p>
        )}
      </div>
    </div>
  );
}

MapListingCard.propTypes = {
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  photo: PropTypes.string,
  type: PropTypes.oneOf(['destination', 'experience']).isRequired,
  link: PropTypes.string.isRequired,
  location: PropTypes.string,
  isActive: PropTypes.bool,
  onHover: PropTypes.func,
  onLeave: PropTypes.func,
  onClick: PropTypes.func
};

export default memo(MapListingCard);

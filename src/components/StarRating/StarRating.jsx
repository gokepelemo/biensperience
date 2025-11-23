import React from 'react';
import PropTypes from 'prop-types';
import { FaStar, FaRegStar, FaStarHalfAlt } from 'react-icons/fa';
import styles from './StarRating.module.scss';

export default function StarRating({ value = 0, max = 5, size = 16, color = '#f59e0b', className = '' }) {
  const stars = [];
  for (let i = 1; i <= max; i++) {
    if (value >= i) {
      stars.push('full');
    } else if (value + 0.5 >= i) {
      stars.push('half');
    } else {
      stars.push('empty');
    }
  }

  return (
    <div className={`${styles.starRating} ${className}`} aria-hidden>
      {stars.map((s, idx) => (
        <span
          key={idx}
          className={`${styles.star} ${s === 'half' ? styles.starHalf : ''}`}
          style={{ color, fontSize: size }}
        >
          {s === 'full' && <FaStar />}
          {s === 'half' && <FaStarHalfAlt />}
          {s === 'empty' && <FaRegStar />}
        </span>
      ))}
    </div>
  );
}

StarRating.propTypes = {
  value: PropTypes.number,
  max: PropTypes.number,
  size: PropTypes.number,
  color: PropTypes.string,
  className: PropTypes.string
};

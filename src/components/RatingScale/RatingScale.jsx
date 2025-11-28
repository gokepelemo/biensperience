import { useId } from 'react';
import PropTypes from 'prop-types';
import {
  calculateStars,
  calculateDifficultySegments,
  getDifficultyColor,
  getDifficultyLabel,
  getRatingLabel,
  formatRating,
  normalizeRating
} from '../../utilities/rating-utils';
import styles from './RatingScale.module.scss';

/**
 * SVG Star component for star ratings
 * Uses the exact design pattern from Storybook with unique gradient IDs
 * @param {string} filled - 'full', 'half', or 'empty'
 * @param {number} size - Size in pixels (ignored if inherit is true)
 * @param {string} gradientId - Unique ID for half-star gradient
 * @param {boolean} inherit - Inherit size from parent element via CSS
 */
function StarIcon({ filled = 'full', size = 16, gradientId, inherit = false }) {
  const fillColor = filled === 'empty'
    ? 'var(--color-border-medium)'
    : 'var(--color-warning)';

  // When inherit is true, use 1em for size to inherit from parent font-size
  const svgSize = inherit ? '1em' : size;

  if (filled === 'half') {
    return (
      <svg width={svgSize} height={svgSize} viewBox="0 0 16 16" className={styles.star}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="50%" stopColor="var(--color-warning)" />
            <stop offset="50%" stopColor="var(--color-border-medium)" />
          </linearGradient>
        </defs>
        <path
          d="M8 1.5L9.5 6.5H14.5L10.5 9.5L12 14.5L8 11.5L4 14.5L5.5 9.5L1.5 6.5H6.5L8 1.5Z"
          fill={`url(#${gradientId})`}
        />
      </svg>
    );
  }

  return (
    <svg width={svgSize} height={svgSize} viewBox="0 0 16 16" className={styles.star}>
      <path
        d="M8 1.5L9.5 6.5H14.5L10.5 9.5L12 14.5L8 11.5L4 14.5L5.5 9.5L1.5 6.5H6.5L8 1.5Z"
        fill={fillColor}
      />
    </svg>
  );
}

StarIcon.propTypes = {
  filled: PropTypes.oneOf(['full', 'half', 'empty']),
  size: PropTypes.number,
  gradientId: PropTypes.string,
  inherit: PropTypes.bool
};

/**
 * Star Rating Display
 * Renders filled, half, and empty stars based on rating value
 *
 * @param {number} rating - Rating value (0-5 by default, supports decimals for half stars)
 * @param {number} maxStars - Maximum number of stars to display (default: 5)
 * @param {string} size - Size variant: 'sm', 'md', 'lg', 'xl'
 * @param {boolean} showValue - Show numeric value next to stars
 * @param {boolean} showLabel - Show descriptive label (Poor/Fair/Good/Very Good/Excellent)
 * @param {string} variant - Display variant: 'default', 'compact', 'inline'
 * @param {boolean} inherit - Inherit styles from parent element (font-size, color, etc.)
 * @param {string} className - Additional CSS classes
 */
export function StarRating({
  rating,
  maxStars = 5,
  size = 'md',
  showValue = false,
  showLabel = false,
  variant = 'default',
  inherit = false,
  className = ''
}) {
  // Generate unique ID for half-star gradient
  const gradientId = useId();

  const stars = calculateStars(rating, maxStars);

  const sizeMap = {
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24
  };
  const starSize = inherit ? undefined : (sizeMap[size] || sizeMap.md);

  const sizeClass = inherit ? '' : (styles[`size${size.charAt(0).toUpperCase() + size.slice(1)}`] || styles.sizeMd);
  const variantClass = variant !== 'default' ? styles[`variant${variant.charAt(0).toUpperCase() + variant.slice(1)}`] : '';
  const inheritClass = inherit ? styles.inherit : '';

  return (
    <div className={`${styles.ratingScale} ${styles.starRating} ${sizeClass} ${variantClass} ${inheritClass} ${className}`}>
      <div className={styles.stars}>
        {/* Full stars */}
        {[...Array(stars.full)].map((_, i) => (
          <StarIcon key={`full-${i}`} filled="full" size={starSize} inherit={inherit} />
        ))}
        {/* Half star */}
        {stars.half > 0 && (
          <StarIcon key="half" filled="half" size={starSize} gradientId={`star-half-${gradientId}`} inherit={inherit} />
        )}
        {/* Empty stars */}
        {[...Array(stars.empty)].map((_, i) => (
          <StarIcon key={`empty-${i}`} filled="empty" size={starSize} inherit={inherit} />
        ))}
      </div>
      {showValue && (
        <span className={styles.ratingValue}>
          {formatRating(rating, { scale: 'star', showMax: false, decimals: 1 })}
        </span>
      )}
      {showLabel && (
        <span className={styles.ratingLabel}>
          {getRatingLabel(rating)}
        </span>
      )}
    </div>
  );
}

StarRating.propTypes = {
  rating: PropTypes.number,
  maxStars: PropTypes.number,
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
  showValue: PropTypes.bool,
  showLabel: PropTypes.bool,
  inherit: PropTypes.bool,
  className: PropTypes.string
};

/**
 * Difficulty Rating Display
 * Renders a segmented bar with color-coded difficulty
 * @param {number} difficulty - Difficulty value (1-10)
 * @param {number} segments - Number of segments to display (default: 10)
 * @param {string} size - Size variant: 'sm', 'md', 'lg', 'xl'
 * @param {boolean} showValue - Show numeric value
 * @param {boolean} showLabel - Show descriptive label (Easy/Moderate/Challenging/Extreme)
 * @param {string} variant - Display variant: 'bar', 'dots', 'numeric'
 * @param {boolean} inherit - Inherit styles from parent element
 * @param {string} className - Additional CSS classes
 */
export function DifficultyRating({
  difficulty,
  segments = 10,
  size = 'md',
  showValue = false,
  showLabel = false,
  variant = 'bar',
  inherit = false,
  className = ''
}) {
  const segmentInfo = calculateDifficultySegments(difficulty, segments);
  const color = getDifficultyColor(difficulty);
  const label = getDifficultyLabel(difficulty);

  const sizeClass = inherit ? '' : (styles[`size${size.charAt(0).toUpperCase() + size.slice(1)}`] || styles.sizeMd);
  const inheritClass = inherit ? styles.inherit : '';

  if (variant === 'numeric') {
    return (
      <div className={`${styles.ratingScale} ${styles.difficultyNumeric} ${sizeClass} ${inheritClass} ${className}`}>
        <span className={styles.difficultyValue} style={{ color }}>
          {formatRating(difficulty, { scale: 'difficulty', showMax: true })}
        </span>
        {showLabel && (
          <span className={styles.difficultyLabel} style={{ color }}>
            {label}
          </span>
        )}
      </div>
    );
  }

  if (variant === 'dots') {
    return (
      <div className={`${styles.ratingScale} ${styles.difficultyDots} ${sizeClass} ${inheritClass} ${className}`}>
        <div className={styles.dots}>
          {[...Array(segments)].map((_, i) => (
            <span
              key={i}
              className={`${styles.dot} ${i < segmentInfo.filled ? styles.dotFilled : styles.dotEmpty}`}
              style={{ backgroundColor: i < segmentInfo.filled ? color : undefined }}
            />
          ))}
        </div>
        {showValue && (
          <span className={styles.difficultyValue} style={{ color }}>
            {formatRating(difficulty, { scale: 'difficulty', showMax: true })}
          </span>
        )}
        {showLabel && (
          <span className={styles.difficultyLabel} style={{ color }}>
            {label}
          </span>
        )}
      </div>
    );
  }

  // Default: bar variant
  return (
    <div className={`${styles.ratingScale} ${styles.difficultyBar} ${sizeClass} ${inheritClass} ${className}`}>
      <div className={styles.barContainer}>
        <div
          className={styles.barFill}
          style={{
            width: `${segmentInfo.percentage}%`,
            backgroundColor: color
          }}
        />
        <div className={styles.barSegments}>
          {[...Array(segments)].map((_, i) => (
            <span key={i} className={styles.barSegment} />
          ))}
        </div>
      </div>
      {showValue && (
        <span className={styles.difficultyValue} style={{ color }}>
          {formatRating(difficulty, { scale: 'difficulty', showMax: true })}
        </span>
      )}
      {showLabel && (
        <span className={styles.difficultyLabel} style={{ color }}>
          {label}
        </span>
      )}
    </div>
  );
}

DifficultyRating.propTypes = {
  difficulty: PropTypes.number,
  segments: PropTypes.number,
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
  showValue: PropTypes.bool,
  showLabel: PropTypes.bool,
  variant: PropTypes.oneOf(['bar', 'dots', 'numeric']),
  inherit: PropTypes.bool,
  className: PropTypes.string
};

/**
 * Percentage Rating Display
 * Renders a progress bar with percentage
 * @param {number} value - Percentage value (0-100)
 * @param {string} size - Size variant: 'sm', 'md', 'lg', 'xl'
 * @param {boolean} showValue - Show percentage value
 * @param {string} color - Color variant: 'primary', 'success', 'warning', 'danger'
 * @param {boolean} inherit - Inherit styles from parent element
 * @param {string} className - Additional CSS classes
 */
export function PercentageRating({
  value,
  size = 'md',
  showValue = true,
  color = 'primary',
  inherit = false,
  className = ''
}) {
  const percentage = Math.min(100, Math.max(0, value || 0));

  const colorMap = {
    primary: 'var(--color-primary)',
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    danger: 'var(--color-danger)'
  };
  const barColor = colorMap[color] || colorMap.primary;

  const sizeClass = inherit ? '' : (styles[`size${size.charAt(0).toUpperCase() + size.slice(1)}`] || styles.sizeMd);
  const inheritClass = inherit ? styles.inherit : '';

  return (
    <div className={`${styles.ratingScale} ${styles.percentageRating} ${sizeClass} ${inheritClass} ${className}`}>
      <div className={styles.percentageBarContainer}>
        <div
          className={styles.percentageBarFill}
          style={{
            width: `${percentage}%`,
            backgroundColor: barColor
          }}
        />
      </div>
      {showValue && (
        <span className={styles.percentageValue}>
          {Math.round(percentage)}%
        </span>
      )}
    </div>
  );
}

PercentageRating.propTypes = {
  value: PropTypes.number,
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
  showValue: PropTypes.bool,
  color: PropTypes.oneOf(['primary', 'success', 'warning', 'danger']),
  inherit: PropTypes.bool,
  className: PropTypes.string
};

/**
 * Generic RatingScale Component
 * Automatically selects the appropriate display based on scale type
 * @param {number} value - Rating value
 * @param {string} scale - Scale type: 'star', 'difficulty', 'percentage', 'custom'
 * @param {string} size - Size variant: 'sm', 'md', 'lg', 'xl'
 * @param {boolean} showValue - Show numeric value
 * @param {boolean} showLabel - Show descriptive label
 * @param {string} variant - Display variant (varies by scale type)
 * @param {boolean} inherit - Inherit styles from parent element
 * @param {string} className - Additional CSS classes
 */
export default function RatingScale({
  value,
  scale = 'star',
  size = 'md',
  showValue = false,
  showLabel = false,
  variant,
  inherit = false,
  className = ''
}) {
  const inheritClass = inherit ? styles.inherit : '';

  if (value === null || value === undefined) {
    return (
      <span className={`${styles.ratingScale} ${styles.noRating} ${inheritClass} ${className}`}>
        Not rated
      </span>
    );
  }

  switch (scale) {
    case 'star':
      return (
        <StarRating
          rating={value}
          size={size}
          showValue={showValue}
          showLabel={showLabel}
          inherit={inherit}
          className={className}
        />
      );

    case 'difficulty':
      return (
        <DifficultyRating
          difficulty={value}
          size={size}
          showValue={showValue}
          showLabel={showLabel}
          variant={variant || 'bar'}
          inherit={inherit}
          className={className}
        />
      );

    case 'percentage':
      return (
        <PercentageRating
          value={value}
          size={size}
          showValue={showValue}
          inherit={inherit}
          className={className}
        />
      );

    default:
      return (
        <span className={`${styles.ratingScale} ${styles.numericRating} ${inheritClass} ${className}`}>
          {formatRating(value, { scale, showMax: true })}
        </span>
      );
  }
}

RatingScale.propTypes = {
  value: PropTypes.number,
  scale: PropTypes.oneOf(['star', 'difficulty', 'percentage', 'custom']),
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
  showValue: PropTypes.bool,
  showLabel: PropTypes.bool,
  variant: PropTypes.string,
  inherit: PropTypes.bool,
  className: PropTypes.string
};

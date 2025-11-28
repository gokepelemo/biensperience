/**
 * Rating Utilities
 *
 * Provides functions for handling various rating scales and formats.
 * Supports star ratings (1-5), difficulty ratings (1-10), and custom scales.
 */

/**
 * Rating scale configurations
 */
export const RATING_SCALES = {
  star: {
    min: 0,
    max: 5,
    step: 0.5,
    label: 'Rating',
    unit: 'stars',
    icon: 'star'
  },
  difficulty: {
    min: 1,
    max: 10,
    step: 1,
    label: 'Difficulty',
    unit: 'level',
    icon: 'gauge'
  },
  percentage: {
    min: 0,
    max: 100,
    step: 1,
    label: 'Progress',
    unit: '%',
    icon: 'percent'
  },
  custom: {
    min: 0,
    max: 10,
    step: 1,
    label: 'Score',
    unit: 'points',
    icon: 'chart'
  }
};

/**
 * Clamp a value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
export function clampRating(value, min = 0, max = 5) {
  if (value === null || value === undefined || isNaN(value)) return null;
  return Math.min(max, Math.max(min, value));
}

/**
 * Normalize a rating to a 0-1 scale
 * @param {number} value - Rating value
 * @param {number} min - Scale minimum
 * @param {number} max - Scale maximum
 * @returns {number} Normalized value (0-1)
 */
export function normalizeRating(value, min = 0, max = 5) {
  if (value === null || value === undefined) return 0;
  const clamped = clampRating(value, min, max);
  return (clamped - min) / (max - min);
}

/**
 * Convert a rating from one scale to another
 * @param {number} value - Rating value in source scale
 * @param {Object} fromScale - Source scale configuration
 * @param {Object} toScale - Target scale configuration
 * @returns {number} Rating value in target scale
 */
export function convertRating(value, fromScale, toScale) {
  if (value === null || value === undefined) return null;
  const normalized = normalizeRating(value, fromScale.min, fromScale.max);
  return normalized * (toScale.max - toScale.min) + toScale.min;
}

/**
 * Calculate star display information for a rating
 * @param {number} rating - Rating value (0-5 scale)
 * @param {number} maxStars - Maximum number of stars to display
 * @returns {Object} Star display configuration
 */
export function calculateStars(rating, maxStars = 5) {
  const clamped = clampRating(rating, 0, maxStars) || 0;
  const fullStars = Math.floor(clamped);
  const decimal = clamped % 1;

  // Determine if we show a half star
  // 0.25-0.74 = half star, 0.75+ rounds up to full star
  const hasHalfStar = decimal >= 0.25 && decimal < 0.75;
  const roundedUpStars = decimal >= 0.75 ? 1 : 0;
  const emptyStars = maxStars - fullStars - (hasHalfStar ? 1 : 0) - roundedUpStars;

  return {
    full: fullStars + roundedUpStars,
    half: hasHalfStar ? 1 : 0,
    empty: Math.max(0, emptyStars),
    total: maxStars,
    value: clamped,
    percentage: (clamped / maxStars) * 100
  };
}

/**
 * Calculate difficulty bar segments for display
 * @param {number} difficulty - Difficulty value (1-10 scale)
 * @param {number} segments - Number of segments to display
 * @returns {Object} Segment display configuration
 */
export function calculateDifficultySegments(difficulty, segments = 10) {
  const clamped = clampRating(difficulty, 1, segments) || 0;
  const filled = Math.floor(clamped);
  const partial = clamped % 1;

  return {
    filled,
    partial: partial > 0 ? 1 : 0,
    partialAmount: partial,
    empty: Math.max(0, segments - filled - (partial > 0 ? 1 : 0)),
    total: segments,
    value: clamped,
    percentage: (clamped / segments) * 100
  };
}

/**
 * Get the color for a difficulty level
 * @param {number} difficulty - Difficulty value (1-10 scale)
 * @returns {string} CSS color variable
 */
export function getDifficultyColor(difficulty) {
  if (difficulty === null || difficulty === undefined) return 'var(--color-border-medium)';
  if (difficulty <= 3) return 'var(--color-success)';
  if (difficulty <= 5) return 'var(--color-success-dark)';
  if (difficulty <= 7) return 'var(--color-warning)';
  if (difficulty <= 9) return 'var(--color-danger-light)';
  return 'var(--color-danger)';
}

/**
 * Get a descriptive label for a difficulty level
 * @param {number} difficulty - Difficulty value (1-10 scale)
 * @returns {string} Descriptive label
 */
export function getDifficultyLabel(difficulty) {
  if (difficulty === null || difficulty === undefined) return 'Not rated';
  if (difficulty <= 2) return 'Easy';
  if (difficulty <= 4) return 'Moderate';
  if (difficulty <= 6) return 'Challenging';
  if (difficulty <= 8) return 'Difficult';
  return 'Expert';
}

/**
 * Get a descriptive label for a star rating
 * @param {number} rating - Rating value (0-5 scale)
 * @returns {string} Descriptive label
 */
export function getRatingLabel(rating) {
  if (rating === null || rating === undefined) return 'Not rated';
  if (rating <= 1) return 'Poor';
  if (rating <= 2) return 'Fair';
  if (rating <= 3) return 'Good';
  if (rating <= 4) return 'Very Good';
  return 'Excellent';
}

/**
 * Format a rating value for display
 * @param {number} value - Rating value
 * @param {Object} options - Formatting options
 * @returns {string} Formatted rating string
 */
export function formatRating(value, options = {}) {
  const {
    scale = 'star',
    showMax = true,
    decimals = 1,
    showLabel = false
  } = options;

  if (value === null || value === undefined) return 'N/A';

  const scaleConfig = RATING_SCALES[scale] || RATING_SCALES.star;
  const clamped = clampRating(value, scaleConfig.min, scaleConfig.max);
  const formatted = Number.isInteger(clamped) ? clamped.toString() : clamped.toFixed(decimals);

  let result = formatted;

  if (showMax) {
    result += `/${scaleConfig.max}`;
  }

  if (showLabel) {
    if (scale === 'star') {
      result = `${result} - ${getRatingLabel(clamped)}`;
    } else if (scale === 'difficulty') {
      result = `${result} - ${getDifficultyLabel(clamped)}`;
    }
  }

  return result;
}

/**
 * Parse a rating string to a number
 * @param {string} ratingStr - Rating string (e.g., "4.5", "8/10", "85%")
 * @param {string} scale - Scale type
 * @returns {number|null} Parsed rating value
 */
export function parseRating(ratingStr, scale = 'star') {
  if (!ratingStr || typeof ratingStr !== 'string') return null;

  // Remove common suffixes and parse
  const cleaned = ratingStr.replace(/\/\d+|%|stars?|points?/gi, '').trim();
  const value = parseFloat(cleaned);

  if (isNaN(value)) return null;

  const scaleConfig = RATING_SCALES[scale] || RATING_SCALES.star;
  return clampRating(value, scaleConfig.min, scaleConfig.max);
}

/**
 * Get tooltip text for a rating
 * @param {number} value - Rating value
 * @param {string} scale - Scale type
 * @returns {string} Tooltip text
 */
export function getRatingTooltip(value, scale = 'star') {
  if (value === null || value === undefined) return 'No rating available';

  if (scale === 'star') {
    const label = getRatingLabel(value);
    return `${formatRating(value, { scale: 'star', showMax: true })} - ${label}`;
  }

  if (scale === 'difficulty') {
    const label = getDifficultyLabel(value);
    return `Difficulty: ${formatRating(value, { scale: 'difficulty', showMax: true })} - ${label}`;
  }

  return formatRating(value, { scale, showMax: true });
}

export default {
  RATING_SCALES,
  clampRating,
  normalizeRating,
  convertRating,
  calculateStars,
  calculateDifficultySegments,
  getDifficultyColor,
  getDifficultyLabel,
  getRatingLabel,
  formatRating,
  parseRating,
  getRatingTooltip
};

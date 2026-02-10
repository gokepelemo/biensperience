/**
 * ChakraProgressBar - Chakra UI v3 Progress Implementation
 *
 * Drop-in replacement for the custom ProgressBar component.
 * Uses Chakra UI v3 Progress primitive for built-in accessibility
 * while preserving the existing CSS Modules styling.
 *
 * Chakra benefits gained:
 * - Built-in ARIA attributes (role=progressbar, aria-valuenow, etc.)
 * - Reduced-motion support
 * - Consistent progress patterns across the design system
 *
 * Task: biensperience-20d0 - Create Chakra wrappers for ProgressBar
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Progress } from '@chakra-ui/react';
import styles from './ProgressBar.module.scss';

/**
 * ChakraProgressBar - Chakra-backed progress bar with existing CSS Modules styling
 *
 * @param {Object} props
 * @param {number} props.value - Progress value (0-100)
 * @param {string} props.color - Color variant: 'primary', 'success', 'danger', 'warning'
 * @param {string} props.size - Size: 'sm', 'md', 'lg'
 * @param {boolean} props.showPercentage - Show percentage label
 * @param {boolean} props.animated - Animate progress bar
 */
export default function ChakraProgressBar({
  value,
  color = 'primary',
  size = 'md',
  showPercentage = false,
  animated = false
}) {
  const clampedValue = Math.min(100, Math.max(0, value));

  const sizeClass = styles[`progressBar${size.charAt(0).toUpperCase() + size.slice(1)}`];
  const colorClass = styles[`progressBar${color.charAt(0).toUpperCase() + color.slice(1)}`];

  return (
    <div className={styles.progressBarWrapper}>
      <Progress.Root
        className={`${styles.progressBar} ${sizeClass}`}
        value={clampedValue}
        max={100}
        min={0}
      >
        <Progress.Track>
          <Progress.Range
            className={`${styles.progressBarFill} ${colorClass} ${animated ? styles.progressBarAnimated : ''}`}
          />
        </Progress.Track>
      </Progress.Root>
      {showPercentage && (
        <Progress.ValueText className={styles.progressBarPercentage}>
          {clampedValue}%
        </Progress.ValueText>
      )}
    </div>
  );
}

ChakraProgressBar.propTypes = {
  value: PropTypes.number.isRequired,
  color: PropTypes.oneOf(['primary', 'success', 'danger', 'warning']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  showPercentage: PropTypes.bool,
  animated: PropTypes.bool,
};

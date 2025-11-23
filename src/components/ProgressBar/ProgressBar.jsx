import styles from './ProgressBar.module.scss';

/**
 * Progress bar component with percentage display
 *
 * @param {Object} props - Component props
 * @param {number} props.value - Progress value (0-100)
 * @param {string} [props.color='primary'] - Progress bar color: 'primary', 'success', 'danger', 'warning'
 * @param {string} [props.size='md'] - Size: 'sm', 'md', 'lg'
 * @param {boolean} [props.showPercentage=false] - Show percentage label
 * @param {boolean} [props.animated=false] - Animate progress bar
 */
export default function ProgressBar({
  value,
  color = 'primary',
  size = 'md',
  showPercentage = false,
  animated = false
}) {
  const clampedValue = Math.min(100, Math.max(0, value));

  // Generate dynamic class names
  const sizeClass = styles[`progressBar${size.charAt(0).toUpperCase() + size.slice(1)}`];
  const colorClass = styles[`progressBar${color.charAt(0).toUpperCase() + color.slice(1)}`];

  return (
    <div className={styles.progressBarWrapper}>
      <div className={`${styles.progressBar} ${sizeClass}`}>
        <div
          className={`${styles.progressBarFill} ${colorClass} ${animated ? styles.progressBarAnimated : ''}`}
          style={{ width: `${clampedValue}%` }}
          role="progressbar"
          aria-valuenow={clampedValue}
          aria-valuemin="0"
          aria-valuemax="100"
        />
      </div>
      {showPercentage && (
        <span className={styles.progressBarPercentage}>{clampedValue}%</span>
      )}
    </div>
  );
}

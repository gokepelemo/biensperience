import './ProgressBar.css';

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

  return (
    <div className="progress-bar-wrapper">
      <div className={`progress-bar progress-bar-${size}`}>
        <div 
          className={`progress-bar-fill progress-bar-${color} ${animated ? 'progress-bar-animated' : ''}`}
          style={{ width: `${clampedValue}%` }}
          role="progressbar"
          aria-valuenow={clampedValue}
          aria-valuemin="0"
          aria-valuemax="100"
        />
      </div>
      {showPercentage && (
        <span className="progress-bar-percentage">{clampedValue}%</span>
      )}
    </div>
  );
}

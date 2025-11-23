import styles from './Stepper.module.scss';

/**
 * Stepper component for step-by-step progress indication
 *
 * @param {Object} props - Component props
 * @param {Array} props.steps - Array of step objects with { title, description, status }
 * @param {string} [props.variant='default'] - Stepper variant: 'default', 'compact'
 * @param {string} [props.color='primary'] - Step color: 'primary', 'success', 'danger', 'warning'
 */
export default function Stepper({ steps, variant = 'default', color = 'primary' }) {
  const variantClass = variant !== 'default' ? styles[`stepper${variant.charAt(0).toUpperCase() + variant.slice(1)}`] : '';

  return (
    <div className={`${styles.stepper} ${variantClass}`.trim()}>
      {steps.map((step, index) => {
        const statusClass = styles[`stepperItem${step.status.charAt(0).toUpperCase() + step.status.slice(1)}`];
        const colorClass = styles[`stepperItem${color.charAt(0).toUpperCase() + color.slice(1)}`];

        return (
          <div
            key={index}
            className={`${styles.stepperItem} ${statusClass} ${colorClass}`.trim()}
          >
            <div className={styles.stepperMarker}>
              {step.status === 'completed' ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M13.5 4.5L6 12L2.5 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : step.status === 'error' ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              ) : (
                <span className={styles.stepperNumber}>{index + 1}</span>
              )}
            </div>
            {variant === 'default' && (
              <div className={styles.stepperContent}>
                <div className={styles.stepperTitle}>{step.title}</div>
                {step.description && (
                  <div className={styles.stepperDescription}>{step.description}</div>
                )}
              </div>
            )}
            {index < steps.length - 1 && <div className={styles.stepperConnector} />}
          </div>
        );
      })}
    </div>
  );
}

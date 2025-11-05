import './Stepper.css';

/**
 * Stepper component for step-by-step progress indication
 * 
 * @param {Object} props - Component props
 * @param {Array} props.steps - Array of step objects with { title, description, status }
 * @param {string} [props.variant='default'] - Stepper variant: 'default', 'compact'
 * @param {string} [props.color='primary'] - Step color: 'primary', 'success', 'danger', 'warning'
 */
export default function Stepper({ steps, variant = 'default', color = 'primary' }) {
  return (
    <div className={`stepper stepper-${variant}`}>
      {steps.map((step, index) => (
        <div 
          key={index}
          className={`stepper-item stepper-item-${step.status} stepper-item-${color}`}
        >
          <div className="stepper-marker">
            {step.status === 'completed' ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M13.5 4.5L6 12L2.5 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : step.status === 'error' ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            ) : (
              <span className="stepper-number">{index + 1}</span>
            )}
          </div>
          {variant === 'default' && (
            <div className="stepper-content">
              <div className="stepper-title">{step.title}</div>
              {step.description && (
                <div className="stepper-description">{step.description}</div>
              )}
            </div>
          )}
          {index < steps.length - 1 && <div className="stepper-connector" />}
        </div>
      ))}
    </div>
  );
}

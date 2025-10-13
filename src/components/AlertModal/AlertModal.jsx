import "./AlertModal.css";

/**
 * AlertModal - A reusable modal for displaying alert messages
 * 
 * @param {boolean} show - Controls modal visibility
 * @param {function} onClose - Callback when modal is closed
 * @param {string} title - Modal title
 * @param {string} message - Alert message to display
 * @param {string} variant - Bootstrap variant (info, success, warning, danger)
 * @param {string} buttonText - Text for the close button (default: "OK")
 */
export default function AlertModal({
  show,
  onClose,
  title = "Alert",
  message,
  variant = "info",
  buttonText = "OK"
}) {
  if (!show) return null;

  const variantClass = {
    info: "alert-info",
    success: "alert-success",
    warning: "alert-warning",
    danger: "alert-danger"
  }[variant] || "alert-info";

  const iconClass = {
    info: "ℹ️",
    success: "✅",
    warning: "⚠️",
    danger: "❌"
  }[variant] || "ℹ️";

  return (
    <div 
      className="modal show d-block" 
      tabIndex="-1" 
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div 
        className="modal-dialog modal-dialog-centered"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <span className="me-2">{iconClass}</span>
              {title}
            </h5>
            <button 
              type="button" 
              className="btn-close" 
              onClick={onClose}
              aria-label="Close"
            ></button>
          </div>
          <div className="modal-body">
            <div className={`alert ${variantClass} mb-0`}>
              {message}
            </div>
          </div>
          <div className="modal-footer">
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={onClose}
            >
              {buttonText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

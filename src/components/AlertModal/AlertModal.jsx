import "./AlertModal.css";
import Modal from "../Modal/Modal";

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
    <Modal
      show={show}
      onClose={onClose}
      title={title}
      icon={iconClass}
      submitText={buttonText}
      showCancelButton={false}
      submitVariant="primary"
      centered={true}
    >
      <div className={`alert ${variantClass} mb-0`}>
        {message}
      </div>
    </Modal>
  );
}

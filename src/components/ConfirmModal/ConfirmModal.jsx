import "./ConfirmModal.css";
import { lang } from "../../lang.constants";

/**
 * Reusable confirmation modal component
 * @param {Object} props
 * @param {boolean} props.show - Whether to show the modal
 * @param {Function} props.onClose - Callback when modal is closed
 * @param {Function} props.onConfirm - Callback when action is confirmed
 * @param {string} props.title - Modal title
 * @param {string} props.message - Modal message
 * @param {string} props.confirmText - Text for confirm button (default: "Delete")
 * @param {string} props.confirmVariant - Bootstrap variant for confirm button (default: "danger")
 * @param {string} props.cancelText - Text for cancel button (default: "Cancel")
 */
export default function ConfirmModal({
  show,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = lang.en.button.delete,
  confirmVariant = "danger",
  cancelText = lang.en.button.cancel
}) {
  if (!show) return null;

  return (
    <div className="modal show d-block modal-backdrop" tabIndex="-1">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{title}</h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              aria-label="Close"
            ></button>
          </div>
          <div className="modal-body">
            <p>{message}</p>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              {cancelText}
            </button>
            <button
              type="button"
              className={`btn btn-${confirmVariant}`}
              onClick={onConfirm}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

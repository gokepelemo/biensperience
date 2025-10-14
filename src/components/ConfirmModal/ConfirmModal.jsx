import "./ConfirmModal.css";
import { lang } from "../../lang.constants";
import Modal from "../Modal/Modal";

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
  return (
    <Modal
      show={show}
      onClose={onClose}
      onSubmit={onConfirm}
      title={title}
      submitText={confirmText}
      submitVariant={confirmVariant}
      cancelText={cancelText}
      centered={true}
    >
      <p>{message}</p>
    </Modal>
  );
}

import styles from "./ConfirmModal.module.scss";
import { lang } from "../../lang.constants";
import Modal from "../Modal/Modal";
import Alert from "../Alert/Alert";
import { FaExclamationTriangle, FaTrash } from "react-icons/fa";

/**
 * Reusable confirmation modal component with enhanced delete styling
 * Matches the Storybook DeleteConfirmationModal design pattern
 *
 * @param {Object} props
 * @param {boolean} props.show - Whether to show the modal
 * @param {Function} props.onClose - Callback when modal is closed
 * @param {Function} props.onConfirm - Callback when action is confirmed
 * @param {string} props.title - Modal title (e.g., "Delete Experience?")
 * @param {string} props.message - Main message describing what's being deleted
 * @param {string} props.itemName - Name of the item being deleted (shown in bold)
 * @param {string[]} props.additionalInfo - Array of additional consequences (shown as bullet list)
 * @param {string} props.confirmText - Text for confirm button (default: "Delete Permanently")
 * @param {string} props.confirmVariant - Bootstrap variant for confirm button (default: "danger")
 * @param {string} props.cancelText - Text for cancel button (default: "Cancel")
 * @param {boolean} props.showWarning - Whether to show the "cannot be undone" warning (default: true)
 * @param {boolean} props.showIcon - Whether to show icons in title and button (default: true)
 * @param {string} props.warningText - Custom warning text (default: "This action cannot be undone!")
 * @param {boolean} props.confirmDisabled - Whether the confirm button is disabled
 * @param {React.ReactNode} props.blockerContent - Custom content to show when action is blocked (replaces normal content)
 */
export default function ConfirmModal({
  show,
  onClose,
  onConfirm,
  title,
  message,
  itemName,
  additionalInfo = [],
  confirmText = "Delete Permanently",
  confirmVariant = "danger",
  cancelText = lang.current.button.cancel,
  showWarning = true,
  showIcon = true,
  warningText = "This action cannot be undone!",
  confirmDisabled = false,
  blockerContent = null
}) {
  // Build title with icon
  const titleContent = (
    <span style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-2)',
      color: confirmVariant === 'danger' ? 'var(--color-danger)' : undefined
    }}>
      {showIcon && confirmVariant === 'danger' && <FaExclamationTriangle />}
      {title}
    </span>
  );

  // Build custom footer with both Cancel and Confirm buttons
  // If blockerContent is provided and confirmDisabled, show only close button
  const footerContent = blockerContent && confirmDisabled ? (
    <div style={{
      display: 'flex',
      gap: 'var(--space-3)',
      justifyContent: 'flex-end',
      width: '100%'
    }}>
      <button
        type="button"
        className="btn btn-outline-secondary"
        onClick={onClose}
        style={{
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-3) var(--space-6)',
        }}
      >
        Close
      </button>
    </div>
  ) : (
    <div style={{
      display: 'flex',
      gap: 'var(--space-3)',
      justifyContent: 'flex-end',
      width: '100%'
    }}>
      <button
        type="button"
        className="btn btn-outline-secondary"
        onClick={onClose}
        style={{
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-3) var(--space-6)',
        }}
      >
        {cancelText}
      </button>
      <button
        type="button"
        className={`btn btn-${confirmVariant}`}
        onClick={onConfirm}
        disabled={confirmDisabled}
        style={{
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-3) var(--space-6)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          opacity: confirmDisabled ? 0.5 : 1,
          cursor: confirmDisabled ? 'not-allowed' : 'pointer',
        }}
      >
        {showIcon && confirmVariant === 'danger' && <FaTrash />}
        {confirmText}
      </button>
    </div>
  );

  return (
    <Modal
      show={show}
      onClose={onClose}
      title={titleContent}
      footer={footerContent}
      centered={true}
      showSubmitButton={false}
    >
      {/* If blockerContent is provided and confirmDisabled, show blocker instead of normal content */}
      {blockerContent && confirmDisabled ? (
        blockerContent
      ) : (
        <>
          {/* Warning alert */}
          {showWarning && (
            <Alert
              type="danger"
              style={{
                marginBottom: 'var(--space-4)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <FaExclamationTriangle style={{ marginRight: 'var(--space-2)' }} />
              {warningText}
            </Alert>
          )}

          {/* Main message */}
          <p style={{
            fontSize: 'var(--font-size-base)',
            color: 'var(--color-text-secondary)',
            lineHeight: 'var(--line-height-relaxed)',
            marginBottom: additionalInfo.length > 0 ? 'var(--space-4)' : 0,
          }}>
            {message}
            {itemName && (
              <>
                {' '}<strong>"{itemName}"</strong>
              </>
            )}
            {message && !itemName && '.'}
          </p>

          {/* Additional info list */}
          {additionalInfo.length > 0 && (
            <>
              <p style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-muted)',
                marginBottom: 'var(--space-2)',
              }}>
                This will also delete:
              </p>
              <ul style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-muted)',
                paddingLeft: 'var(--space-6)',
                margin: 0,
              }}>
                {additionalInfo.map((info, index) => (
                  <li key={index}>{info}</li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Modal>
  );
}

import "./Modal.css";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { lang } from "../../lang.constants";

/**
 * Modal component
 * A reusable, flexible modal component with support for various configurations
 * 
 * @param {Object} props
 * @param {boolean} props.show - Controls modal visibility
 * @param {Function} props.onClose - Callback when modal is closed
 * @param {Function} [props.onSubmit] - Optional callback when submit button is clicked
 * @param {string|React.ReactNode} props.title - Modal title
 * @param {React.ReactNode} props.children - Modal body content
 * @param {string} [props.submitText="Submit"] - Text for submit button
 * @param {string} [props.submitVariant="primary"] - Bootstrap variant for submit button (primary, danger, success, etc.)
 * @param {string} [props.cancelText="Cancel"] - Text for cancel button
 * @param {boolean} [props.showCancelButton=true] - Whether to show cancel button
 * @param {boolean} [props.showSubmitButton=true] - Whether to show submit button
 * @param {boolean} [props.disableSubmit=false] - Whether submit button should be disabled
 * @param {boolean} [props.loading=false] - Whether to show loading state on submit button
 * @param {string} [props.size] - Modal size: 'sm', 'lg', 'xl' (default is medium)
 * @param {boolean} [props.scrollable=false] - Whether modal body should be scrollable
 * @param {boolean} [props.centered=true] - Whether to vertically center the modal
 * @param {React.ReactNode} [props.footer] - Custom footer content (replaces default buttons)
 * @param {string} [props.dialogClassName] - Additional classes for modal-dialog element
 * @param {string} [props.contentClassName] - Additional classes for modal-content element
 * @param {string} [props.bodyClassName] - Additional classes for modal-body element
 * @param {React.ReactNode} [props.icon] - Optional icon/emoji to display before title
 */
export default function Modal({
  show,
  onClose,
  onSubmit,
  title,
  children,
  submitText = "Submit",
  submitVariant = "primary",
  cancelText = "Cancel",
  showCancelButton = true,
  showSubmitButton = true,
  disableSubmit = false,
  loading = false,
  size,
  scrollable = false,
  centered = true,
  footer,
  dialogClassName = "",
  contentClassName = "",
  bodyClassName = "",
  icon
}) {
  if (!show) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit && !disableSubmit && !loading) {
      onSubmit(e);
    }
  };

  const modalDialogClasses = [
    "modal-dialog",
    centered && "modal-dialog-centered",
    scrollable && "modal-dialog-scrollable",
    size && `modal-${size}`,
    dialogClassName
  ].filter(Boolean).join(" ");

  const modalContentClasses = [
    "modal-content",
    contentClassName
  ].filter(Boolean).join(" ");

  const modalBodyClasses = [
    "modal-body",
    bodyClassName
  ].filter(Boolean).join(" ");

  const modalContent = (
    <div className="modal show d-block modal-backdrop" tabIndex="-1">
      <div className={modalDialogClasses}>
        <div className={modalContentClasses}>
          {/* Header */}
          <div className="modal-header">
            <h5 className="modal-title">
              {icon && <span className="me-2">{icon}</span>}
              {title}
            </h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              aria-label={lang.en.aria.close}
              disabled={loading}
            ></button>
          </div>

          {/* Body */}
          <div className={modalBodyClasses}>
            {children}
          </div>

          {/* Footer */}
          <div className="modal-footer">
            {footer ? (
              // Custom footer provided
              footer
            ) : (
              // Default footer with buttons
              <>
                {showCancelButton && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={onClose}
                    disabled={loading}
                  >
                    {cancelText}
                  </button>
                )}
                {showSubmitButton && onSubmit && (
                  <button
                    type="button"
                    className={`btn btn-${submitVariant}`}
                    onClick={handleSubmit}
                    disabled={disableSubmit || loading}
                  >
                    {loading ? "Loading..." : submitText}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Render modal at document body level to ensure proper positioning
  return createPortal(modalContent, document.body);
}

Modal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func,
  title: PropTypes.node.isRequired,
  children: PropTypes.node,
  submitText: PropTypes.string,
  submitVariant: PropTypes.oneOf(['primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark']),
  cancelText: PropTypes.string,
  showCancelButton: PropTypes.bool,
  showSubmitButton: PropTypes.bool,
  disableSubmit: PropTypes.bool,
  loading: PropTypes.bool,
  size: PropTypes.oneOf(['sm', 'lg', 'xl']),
  scrollable: PropTypes.bool,
  centered: PropTypes.bool,
  footer: PropTypes.node,
  dialogClassName: PropTypes.string,
  contentClassName: PropTypes.string,
  bodyClassName: PropTypes.string,
  icon: PropTypes.node
};

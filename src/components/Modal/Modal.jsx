import styles from "./Modal.module.scss";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { lang } from "../../lang.constants";

/**
 * Flexible modal component with customizable size, buttons, and content.
 * See PropTypes for full prop documentation.
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

  // CSS Modules class mapping
  const sizeClass = size === 'sm' ? styles.modalSm
    : size === 'lg' ? styles.modalLg
    : size === 'xl' ? styles.modalXl
    : size === 'fullscreen' ? styles.modalFullscreen
    : '';

  const modalDialogClasses = [
    "modal-dialog", // Bootstrap base class
    centered && styles.modalDialogCentered,
    scrollable && styles.modalDialogScrollable,
    sizeClass,
    dialogClassName
  ].filter(Boolean).join(" ");

  const modalContentClasses = [
    styles.modalContent,
    contentClassName
  ].filter(Boolean).join(" ");

  const modalBodyClasses = [
    "modal-body", // Bootstrap base class
    styles.modalBody,
    bodyClassName
  ].filter(Boolean).join(" ");

  const modalContent = (
    <div className={`${styles.modalShow} modal show d-block`} tabIndex="-1">
      <div className={modalDialogClasses}>
        <div className={modalContentClasses}>
          {/* Header */}
          <div className={`modal-header ${styles.modalHeader}`}>
            <h5 className={`modal-title ${styles.modalTitle}`}>
              {icon && <span className="me-2">{icon}</span>}
              {title}
            </h5>
            <button
              type="button"
              className={`btn-close ${styles.btnClose}`}
              onClick={onClose}
              aria-label={lang.current.aria.close}
              disabled={loading}
            >
              <span aria-hidden="true">&times;</span>
            </button>
          </div>

          {/* Body */}
          <div className={modalBodyClasses}>
            {children}
          </div>

          {/* Footer - Only render if there's a submit button or custom footer */}
          {(footer || (showSubmitButton && onSubmit)) && (
            <div className={`modal-footer ${styles.modalFooter}`}>
              {footer ? (
                // Custom footer provided
                footer
              ) : (
                // Default footer with submit button only (Close X in header handles cancellation)
                <>
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
          )}
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
  size: PropTypes.oneOf(['sm', 'lg', 'xl', 'fullscreen']),
  scrollable: PropTypes.bool,
  centered: PropTypes.bool,
  footer: PropTypes.node,
  dialogClassName: PropTypes.string,
  contentClassName: PropTypes.string,
  bodyClassName: PropTypes.string,
  icon: PropTypes.node
};

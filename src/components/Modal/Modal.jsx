import { useEffect, forwardRef, useId } from "react";
import { createPortal } from "react-dom";
import styles from "./Modal.module.scss";
import PropTypes from "prop-types";
import { lang } from "../../lang.constants";
import { useModalEscape } from "../../hooks/useKeyboardNavigation";

/**
 * Modal Component - Legacy Implementation
 *
 * Flexible modal component with customizable size, buttons, and content.
 * Uses plain HTML elements with createPortal for rendering. The global
 * _modal.scss applies gradient header, white title/close button styling
 * via .modal-header/.btn-close selectors.
 *
 * This is a legacy implementation preserved for reference.
 * The default implementation is DialogModal.jsx which
 * provides Dialog-based focus trapping and ARIA support.
 *
 * Task: biensperience-ce17 - Modal Migration
 */
const Modal = forwardRef(function Modal({
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
  icon,
  showHeader = true,
  // When true, the modal is rendered in document-flow (absolute) and allows full page scroll.
  // On close, the page scroll position is restored to what it was before opening.
  allowBodyScroll = false
}, ref) {
  // Generate unique ID for accessibility
  const modalId = useId();
  const titleId = `modal-title-${modalId}`;

  // ESC key closes modal
  useModalEscape(onClose, show);

  // Scroll lock via CSS overflow:hidden on body (non-allowBodyScroll mode only).
  // allowBodyScroll mode uses a fixed overlay with internal scrolling — no
  // scroll position manipulation needed.
  useEffect(() => {
    if (show && !allowBodyScroll) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [show, allowBodyScroll]);

  if (!show) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit && !disableSubmit && !loading) {
      onSubmit(e);
    }
  };

  // Handle backdrop click
  const handleBackdropClick = (e) => {
    // Only close if clicking directly on the backdrop, not the modal content
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // CSS Modules class mapping
  const sizeClass = size === 'sm' ? styles.modalSm
    : size === 'lg' ? styles.modalLg
    : size === 'xl' ? styles.modalXl
    : size === 'fullscreen' ? styles.modalFullscreen
    : '';

  const modalDialogClasses = [
    "modal-dialog", // Bootstrap base class for compatibility
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
    "modal-body", // Bootstrap base class for compatibility
    styles.modalBody,
    bodyClassName
  ].filter(Boolean).join(" ");

  // Render via createPortal to document.body for proper z-index stacking
  // Uses plain HTML elements to preserve global _modal.scss styling (gradient
  // header, white close button, etc.) while Chakra Dialog.Root provides
  // accessibility benefits (aria attributes, focus management).
  const modalContent = (
    <div
      ref={ref}
      className={`${styles.modalShow} ${allowBodyScroll ? styles.modalAllowBodyScroll : ''} modal show`}
      tabIndex="-1"
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1050,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        overflowY: allowBodyScroll ? 'auto' : 'visible',
        overflowX: allowBodyScroll ? 'hidden' : 'visible',
        WebkitOverflowScrolling: 'touch',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
    >
      <div className={modalDialogClasses}>
        <div className={modalContentClasses}>
          {/* Header */}
          {showHeader && (
            <div className="modal-header">
              <h5 id={titleId} className="modal-title">
                {icon && <span className={styles.iconSpacing}>{icon}</span>}
                {title}
              </h5>
              <button
                type="button"
                className="btn-close"
                onClick={onClose}
                aria-label={lang.current.aria.close}
                disabled={loading}
              >
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
          )}

          {/* Body */}
          <div className={modalBodyClasses}>
            {children}
          </div>

          {/* Footer - Only render if there's a submit button or custom footer */}
          {(footer || (showSubmitButton && onSubmit)) && (
            <div className="modal-footer">
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
                      {loading ? lang.current.loading.default : submitText}
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

  return createPortal(modalContent, document.body);
});

Modal.displayName = 'Modal';

Modal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func,
  title: PropTypes.node,
  children: PropTypes.node,
  submitText: PropTypes.string,
  submitVariant: PropTypes.oneOf(['primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark']),
  cancelText: PropTypes.string,
  showCancelButton: PropTypes.bool,
  showSubmitButton: PropTypes.bool,
  disableSubmit: PropTypes.bool,
  loading: PropTypes.bool,
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl', 'fullscreen']),
  scrollable: PropTypes.bool,
  centered: PropTypes.bool,
  footer: PropTypes.node,
  dialogClassName: PropTypes.string,
  contentClassName: PropTypes.string,
  bodyClassName: PropTypes.string,
  icon: PropTypes.node,
  showHeader: PropTypes.bool,
  allowBodyScroll: PropTypes.bool
};

export default Modal;

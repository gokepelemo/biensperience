/**
 * ChakraModal - Chakra UI v3 Dialog Implementation
 *
 * Drop-in replacement for the Bootstrap-based Modal component.
 * Uses Chakra UI v3 Dialog for built-in accessibility, focus trapping,
 * scroll locking, and portal rendering while preserving the global
 * _modal.scss styling via Bootstrap-compatible class names.
 *
 * IMPORTANT: The global _modal.scss applies gradient header, white title/close
 * button styling via .modal-header/.btn-close selectors. This implementation
 * keeps those class names so global styles are automatically applied.
 *
 * Task: biensperience-277f - Chakra UI Modal wrapper (feature-flagged)
 */

import { forwardRef, useRef, useEffect } from 'react';
import { Dialog, Portal, CloseButton } from '@chakra-ui/react';
import styles from './Modal.module.scss';
import PropTypes from 'prop-types';
import { lang } from '../../lang.constants';

const ChakraModal = forwardRef(function ChakraModal({
  show,
  onClose,
  onSubmit,
  title,
  children,
  submitText = 'Submit',
  submitVariant = 'primary',
  cancelText = 'Cancel',
  showCancelButton = true,
  showSubmitButton = true,
  disableSubmit = false,
  loading = false,
  size,
  scrollable = false,
  centered = true,
  footer,
  dialogClassName = '',
  contentClassName = '',
  bodyClassName = '',
  icon,
  showHeader = true,
  allowBodyScroll = false
}, ref) {
  // Track scroll position for allowBodyScroll mode
  const scrollYRef = useRef(0);

  // Handle allowBodyScroll mode (Chakra handles normal scroll lock natively)
  useEffect(() => {
    if (show && allowBodyScroll) {
      scrollYRef.current = window.scrollY;
      window.scrollTo(0, 0);

      return () => {
        window.scrollTo(0, scrollYRef.current || 0);
      };
    }
  }, [show, allowBodyScroll]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit && !disableSubmit && !loading) {
      onSubmit(e);
    }
  };

  // Map size prop to CSS module classes (same as Bootstrap Modal)
  const sizeClass = size === 'sm' ? styles.modalSm
    : size === 'lg' ? styles.modalLg
    : size === 'xl' ? styles.modalXl
    : size === 'fullscreen' ? styles.modalFullscreen
    : '';

  const modalDialogClasses = [
    'modal-dialog',
    centered && styles.modalDialogCentered,
    scrollable && styles.modalDialogScrollable,
    sizeClass,
    dialogClassName
  ].filter(Boolean).join(' ');

  const modalContentClasses = [
    styles.modalContent,
    contentClassName
  ].filter(Boolean).join(' ');

  const modalBodyClasses = [
    'modal-body',
    styles.modalBody,
    bodyClassName
  ].filter(Boolean).join(' ');

  return (
    <Dialog.Root
      open={show}
      onOpenChange={(details) => {
        if (!details.open) {
          onClose();
        }
      }}
      closeOnEscape={true}
      closeOnInteractOutside={true}
      trapFocus={true}
      preventScroll={!allowBodyScroll}
      lazyMount
      unmountOnExit
      motionPreset="none"
    >
      <Portal>
        {/* Backdrop - uses our existing styling, not Chakra's default */}
        <Dialog.Backdrop
          className={`${styles.modalShow} ${allowBodyScroll ? styles.modalAllowBodyScroll : ''}`}
          style={{
            position: allowBodyScroll ? 'absolute' : 'fixed',
            top: 0,
            left: 0,
            right: 0,
            ...(allowBodyScroll ? {} : { bottom: 0 }),
            zIndex: 1050,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            // Reset Chakra's default backdrop styles
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'none',
          }}
        />
        <Dialog.Positioner
          ref={ref}
          className={`${styles.modalShow} ${allowBodyScroll ? styles.modalAllowBodyScroll : ''}`}
          style={{
            position: allowBodyScroll ? 'absolute' : 'fixed',
            top: 0,
            left: 0,
            right: 0,
            ...(allowBodyScroll ? {} : { bottom: 0 }),
            zIndex: 1050,
            // Override Chakra defaults to match existing layout
            display: 'flex',
            alignItems: allowBodyScroll ? 'flex-start' : 'center',
            justifyContent: allowBodyScroll ? 'flex-start' : 'center',
            padding: 0,
          }}
        >
          <Dialog.Content
            className={modalDialogClasses}
            style={{
              // Reset Chakra's Dialog.Content styles - we use our own CSS modules
              background: 'transparent',
              boxShadow: 'none',
              borderRadius: 0,
              padding: 0,
              maxWidth: 'none',
              width: 'auto',
              maxHeight: 'none',
              position: 'relative',
            }}
          >
            <div className={modalContentClasses}>
              {/* Header */}
              {showHeader && (
                <Dialog.Header className="modal-header" style={{ padding: undefined, borderBottom: undefined }}>
                  <Dialog.Title
                    className="modal-title"
                    style={{ fontWeight: undefined, fontSize: undefined, color: undefined }}
                  >
                    {icon && <span className="me-2">{icon}</span>}
                    {title}
                  </Dialog.Title>
                  <Dialog.CloseTrigger asChild>
                    <button
                      type="button"
                      className="btn-close"
                      aria-label={lang.current.aria.close}
                      disabled={loading}
                    >
                      <span aria-hidden="true">&times;</span>
                    </button>
                  </Dialog.CloseTrigger>
                </Dialog.Header>
              )}

              {/* Body */}
              <Dialog.Body className={modalBodyClasses} style={{ padding: undefined }}>
                {children}
              </Dialog.Body>

              {/* Footer */}
              {(footer || (showSubmitButton && onSubmit)) && (
                <Dialog.Footer className="modal-footer" style={{ borderTop: undefined, padding: undefined }}>
                  {footer ? (
                    footer
                  ) : (
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
                </Dialog.Footer>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
});

ChakraModal.displayName = 'ChakraModal';

ChakraModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func,
  title: PropTypes.node,
  children: PropTypes.node,
  submitText: PropTypes.string,
  submitVariant: PropTypes.oneOf([
    'primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark'
  ]),
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
  icon: PropTypes.node,
  showHeader: PropTypes.bool,
  allowBodyScroll: PropTypes.bool,
};

export default ChakraModal;

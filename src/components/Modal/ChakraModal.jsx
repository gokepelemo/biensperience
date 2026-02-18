/**
 * ChakraModal - Chakra UI v3 Dialog Implementation
 *
 * Drop-in replacement for the legacy Modal component.
 * Uses Chakra UI v3 Dialog.Root for built-in accessibility (focus trapping,
 * ESC key handling, scroll locking, ARIA attributes) while rendering the
 * header, body, and footer as plain HTML elements so the global _modal.scss
 * styles (gradient header, white close button, footer buttons) apply without
 * specificity conflicts.
 *
 * IMPORTANT: Do NOT use Dialog.Header, Dialog.Title, Dialog.Body, or
 * Dialog.Footer — they inject Chakra recipe styles that override the global
 * _modal.scss selectors. Use plain <div>/<h5>/<button> with Bootstrap-
 * compatible class names instead.
 *
 * Task: biensperience-277f - Chakra UI Modal wrapper (feature-flagged)
 */

import { forwardRef, useRef, useEffect, useId } from 'react';
import { Dialog, Portal } from '@chakra-ui/react';
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
  // Early return - don't render anything if modal should be hidden
  // This prevents any flash during unmount/close transitions
  if (!show) return null;

  // Generate unique ID for accessibility
  const modalId = useId();
  const titleId = `modal-title-${modalId}`;

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

  // Map size prop to CSS module classes
  const sizeClass = size === 'sm' ? styles.modalSm
    : size === 'md' ? styles.modalMd
    : size === 'lg' ? styles.modalLg
    : size === 'xl' ? styles.modalXl
    : size === 'fullscreen' ? styles.modalFullscreen
    : '';

  const modalDialogClasses = [
    'modal-dialog',
    centered && 'modal-dialog-centered',
    scrollable && styles.modalDialogScrollable,
    sizeClass,
    dialogClassName
  ].filter(Boolean).join(' ');

  const modalContentClasses = [
    'modal-content',
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
        {/* Backdrop - plain styling, not Chakra's default */}
        <Dialog.Backdrop
          className={`${styles.modalShow} ${allowBodyScroll ? styles.modalAllowBodyScroll : ''}`}
          style={{
            position: allowBodyScroll ? 'absolute' : 'fixed',
            top: 0,
            left: 0,
            right: 0,
            ...(allowBodyScroll ? {} : { bottom: 0 }),
            zIndex: 1050,
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'none',
            // Disable all animations and transitions
            transition: 'none !important',
            animation: 'none !important',
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
            display: 'flex',
            alignItems: allowBodyScroll ? 'flex-start' : 'center',
            justifyContent: allowBodyScroll ? 'flex-start' : 'center',
            padding: 0,
            width: '100%',
            maxWidth: '100%',
            // Disable all animations and transitions
            transition: 'none !important',
            animation: 'none !important',
            // Allow dropdowns to render outside modal bounds
            overflow: 'visible',
          }}
        >
          {/* Dialog.Content provides ARIA role="dialog" + aria-modal + focus trap anchor */}
          {/* Always include 'show' class since unmountOnExit ensures this only renders when open */}
          <Dialog.Content
            className={`modal show ${modalDialogClasses}`}
            aria-labelledby={title ? titleId : undefined}
            style={{
              // Reset Chakra Dialog.Content recipe styles
              // Do NOT set maxWidth here — CSS module size classes
              // (.modalSm, .modalMd, etc.) control max-width on this element
              background: 'transparent',
              boxShadow: 'none',
              borderRadius: 0,
              padding: 0,
              width: size === 'fullscreen' ? '100%' : undefined,
              maxHeight: 'none',
              position: 'relative',
              // Allow dropdowns to render outside content bounds
              overflow: 'visible',
              // Disable all animations and transitions
              transition: 'none',
              animation: 'none',
            }}
          >
            {/* Plain HTML from here down — global _modal.scss targets these class names */}
            <div className={modalContentClasses}>
              {/* Header */}
              {showHeader && (
                <div className="modal-header">
                  <h5 id={titleId} className="modal-title">
                    {icon && <span className="me-2">{icon}</span>}
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

              {/* Footer */}
              {(footer || (showSubmitButton && onSubmit)) && (
                <div className="modal-footer">
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
                </div>
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
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl', 'fullscreen']),
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

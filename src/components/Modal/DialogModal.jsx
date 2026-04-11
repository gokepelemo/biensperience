/**
 * DialogModal - Native Chakra UI v3 Dialog Implementation
 *
 * Drop-in replacement for the legacy Bootstrap Modal component, now using
 * native Chakra Dialog compound components (Dialog.Header, Dialog.Body,
 * Dialog.Footer, Dialog.CloseTrigger). All styling is handled by the Dialog
 * slot recipe in ui-theme.js — no inline style overrides.
 *
 * The global _modal.scss is retained only for legacy non-migrated modals
 * that still use plain HTML with Bootstrap class names. This component does
 * NOT depend on _modal.scss.
 *
 * Migration: biensperience-6b63 (P3.1)
 */

import { forwardRef, useId } from 'react';
import { Dialog, Portal } from '@chakra-ui/react';
import styles from './Modal.module.css';
import PropTypes from 'prop-types';
import { lang } from '../../lang.constants';
import { useScrollLock } from '../../hooks/useScrollLock';

// Map our size prop values to Chakra Dialog size variants
const SIZE_MAP = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  xl: 'xl',
  fullscreen: 'full',
};

const DialogModal = forwardRef(function DialogModal({
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
  allowBodyScroll = false,
  trapFocus = true,
  closeOnInteractOutside = true
}, ref) {
  // Generate unique ID for accessibility (hooks must be called unconditionally)
  const modalId = useId();
  const titleId = `modal-title-${modalId}`;

  // Lock body scroll when modal is open. The hook uses a global ref counter
  // so stacked modals coordinate correctly — body scroll is only restored
  // when the last modal unmounts. Both normal and allowBodyScroll modals
  // need body lock: allowBodyScroll mode scrolls within a fixed overlay
  // (overflow-y: auto on positioner), not the actual page body.
  useScrollLock(show);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit && !disableSubmit && !loading) {
      onSubmit(e);
    }
  };

  // Resolve Chakra size variant
  const chakraSize = SIZE_MAP[size] || undefined;

  // Determine scroll behavior:
  // - allowBodyScroll: positioner scrolls (outside)
  // - scrollable: body scrolls (inside)
  // - default: no scrolling constraints (outside)
  const scrollBehavior = scrollable ? 'inside' : 'outside';

  // Build combined className for Dialog.Content
  // dialogClassName and contentClassName both apply to the content card
  const contentClasses = [contentClassName, dialogClassName].filter(Boolean).join(' ') || undefined;

  // Fullscreen modals fill the entire viewport regardless of placement.
  // Force 'center' to avoid the 'top' placement variant adding paddingTop
  // to the positioner, which would push the dialog below the navbar.
  const placement = chakraSize === 'full' ? 'center' : (centered ? 'center' : 'top');

  return (
    <Dialog.Root
      open={show}
      onOpenChange={(details) => {
        if (!details.open) {
          onClose();
        }
      }}
      closeOnEscape={true}
      closeOnInteractOutside={closeOnInteractOutside}
      trapFocus={trapFocus}
      // We use our own useScrollLock for iOS Safari position:fixed workaround
      preventScroll={false}
      lazyMount
      unmountOnExit
      motionPreset="none"
      size={chakraSize}
      placement={placement}
      scrollBehavior={scrollBehavior}
    >
      <Portal>
        <Dialog.Backdrop
          className={allowBodyScroll ? styles.modalAllowBodyScroll : undefined}
        />
        <Dialog.Positioner
          className={allowBodyScroll ? styles.modalAllowBodyScroll : undefined}
          // allowBodyScroll: positioner scrolls internally instead of page
          style={allowBodyScroll ? {
            overflowY: 'auto',
            overflowX: 'hidden',
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
          } : undefined}
        >
          <Dialog.Content
            ref={ref}
            aria-labelledby={title ? titleId : undefined}
            className={contentClasses}
          >
            {/* Header */}
            {showHeader && (
              <Dialog.Header>
                <Dialog.Title id={titleId}>
                  {icon && <span className={styles.iconSpacing}>{icon}</span>}
                  {title}
                </Dialog.Title>
                <Dialog.CloseTrigger asChild>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label={lang.current.aria.close}
                    disabled={loading}
                    style={{
                      position: 'relative',
                      top: 'unset',
                      right: 'unset',
                      bottom: 'unset',
                      left: 'unset',
                      inset: 'unset',
                      alignSelf: 'center',
                      flexShrink: 0,
                      marginTop: 0,
                      marginBottom: 0,
                    }}
                  >
                    <span aria-hidden="true" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>&times;</span>
                  </button>
                </Dialog.CloseTrigger>
              </Dialog.Header>
            )}

            {/* Body */}
            <Dialog.Body className={bodyClassName || undefined}>
              {children}
            </Dialog.Body>

            {/* Footer */}
            {(footer || (showSubmitButton && onSubmit)) && (
              <Dialog.Footer>
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
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
});

DialogModal.displayName = 'DialogModal';

DialogModal.propTypes = {
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
  trapFocus: PropTypes.bool,
  closeOnInteractOutside: PropTypes.bool,
};

export default DialogModal;

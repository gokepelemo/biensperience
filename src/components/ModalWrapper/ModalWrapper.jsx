/**
 * Modal Abstraction Layer
 *
 * This component provides a stable API for Modal usage across the application.
 * It wraps the underlying modal implementation (currently Bootstrap Modal,
 * future: Chakra UI Modal) to enable seamless UI framework transitions.
 *
 * CRITICAL: This abstraction enables zero-regression migration to Chakra UI.
 * All modal consumers should import from design-system, NOT directly from Modal.
 *
 * Implementation Strategy:
 * 1. Phase 1 (Current): Wraps Bootstrap Modal with pass-through props
 * 2. Phase 2: Add feature flag to toggle between Bootstrap and Chakra
 * 3. Phase 3: Default to Chakra, keep Bootstrap fallback
 * 4. Phase 4: Remove Bootstrap implementation
 *
 * API Stability Guarantee:
 * - Props interface will NOT change during migration
 * - All consumers can import { Modal } from 'design-system'
 * - Implementation swap is transparent to consumers
 *
 * Task: biensperience-012c
 * Related: biensperience-b93c (E2E tests), biensperience-8653 (documentation)
 */

import { forwardRef } from 'react';
import PropTypes from 'prop-types';
import BootstrapModal from '../Modal/Modal';

/**
 * Modal Component - Design System Abstraction
 *
 * @param {Object} props - Modal properties
 * @param {boolean} props.show - Controls modal visibility
 * @param {Function} props.onClose - Callback when modal closes
 * @param {Function} [props.onSubmit] - Callback for form submission
 * @param {React.ReactNode} [props.title] - Modal title (supports JSX)
 * @param {React.ReactNode} [props.children] - Modal body content
 * @param {string} [props.submitText='Submit'] - Submit button text
 * @param {string} [props.submitVariant='primary'] - Submit button variant
 * @param {string} [props.cancelText='Cancel'] - Cancel button text
 * @param {boolean} [props.showCancelButton=true] - Show cancel button
 * @param {boolean} [props.showSubmitButton=true] - Show submit button
 * @param {boolean} [props.disableSubmit=false] - Disable submit button
 * @param {boolean} [props.loading=false] - Show loading state
 * @param {string} [props.size] - Modal size: 'sm', 'lg', 'xl', 'fullscreen'
 * @param {boolean} [props.scrollable=false] - Enable body scrolling
 * @param {boolean} [props.centered=true] - Center modal vertically
 * @param {React.ReactNode} [props.footer] - Custom footer content
 * @param {string} [props.dialogClassName=''] - Custom class for modal dialog
 * @param {string} [props.contentClassName=''] - Custom class for modal content
 * @param {string} [props.bodyClassName=''] - Custom class for modal body
 * @param {React.ReactNode} [props.icon] - Icon to display before title
 * @param {boolean} [props.showHeader=true] - Show modal header
 * @param {boolean} [props.allowBodyScroll=false] - Allow page scrolling (absolute positioning)
 * @param {React.Ref} ref - Forwarded ref to modal element
 * @returns {React.ReactElement} Modal component
 *
 * @example
 * // Simple confirmation modal
 * <Modal
 *   show={showModal}
 *   onClose={() => setShowModal(false)}
 *   onSubmit={handleConfirm}
 *   title="Confirm Action"
 *   size="sm"
 * >
 *   Are you sure you want to continue?
 * </Modal>
 *
 * @example
 * // Form modal with custom footer
 * <Modal
 *   show={showModal}
 *   onClose={handleClose}
 *   title="Edit Profile"
 *   size="lg"
 *   footer={
 *     <div>
 *       <button onClick={handleClose}>Cancel</button>
 *       <button onClick={handleSave}>Save</button>
 *     </div>
 *   }
 * >
 *   <FormFields />
 * </Modal>
 *
 * @example
 * // Fullscreen modal with document scroll
 * <Modal
 *   show={showDetails}
 *   onClose={handleClose}
 *   title="Plan Item Details"
 *   size="fullscreen"
 *   allowBodyScroll={true}
 * >
 *   <DetailedContent />
 * </Modal>
 */
const ModalWrapper = forwardRef((props, ref) => {
  // Feature flag for future Chakra UI implementation
  // const useChakraModal = useFeatureFlag('chakra_modal'); // Future: Phase 2
  const useChakraModal = false; // Phase 1: Always use Bootstrap

  // Future: Return Chakra Modal when feature flag is enabled
  // if (useChakraModal) {
  //   return <ChakraModalWrapper {...props} ref={ref} />;
  // }

  // Phase 1: Pass through to Bootstrap Modal
  return <BootstrapModal {...props} ref={ref} />;
});

// Display name for React DevTools
ModalWrapper.displayName = 'Modal';

// PropTypes definition (matches current Modal implementation exactly)
ModalWrapper.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func,
  title: PropTypes.node,
  children: PropTypes.node,
  submitText: PropTypes.string,
  submitVariant: PropTypes.oneOf([
    'primary',
    'secondary',
    'success',
    'danger',
    'warning',
    'info',
    'light',
    'dark'
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

export default ModalWrapper;

/**
 * Modal Abstraction Layer
 *
 * This component provides a stable API for Modal usage across the application.
 * It wraps either the current custom Modal or the modern Dialog implementation,
 * controlled by component-specific feature flags.
 *
 * CRITICAL: This abstraction enables zero-regression migration between implementations.
 * All modal consumers should import from design-system, NOT directly from Modal.
 *
 * Implementation Status:
 * - Phase 1: Bootstrap Modal (completed)
 * - Phase 2: Feature flag toggle (completed)
 * - Phase 3: Feature-flagged modern Dialog (completed)
 * - Phase 4: modern Dialog is default (completed)
 * - Phase 5 (Current): Legacy Bootstrap Modal removed; Dialog is the sole implementation
 *
 * API Stability Guarantee:
 * - Props interface is stable and will not change
 * - All consumers can import { Modal } from 'design-system'
 * - Implementation swap is transparent to consumers
 *
 * Task: biensperience-012c, biensperience-277f, biensperience-0512
 * Related: biensperience-b93c (E2E tests), biensperience-cd21 (visual regression)
 */

import { forwardRef } from 'react';
import PropTypes from 'prop-types';
import DialogModal from '../Modal/DialogModal';

/**
 * Modal Component - Design System Abstraction
 *
 * Now uses modern Modal implementation for improved accessibility,
 * consistent styling, and better integration with the design system.
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
  return <DialogModal {...props} ref={ref} />;
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

export default ModalWrapper;

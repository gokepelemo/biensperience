/**
 * Unit tests for Modal Abstraction Layer
 * Verifies that ModalWrapper correctly wraps Bootstrap Modal
 *
 * Task: biensperience-012c
 * Related: biensperience-b93c (E2E tests)
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from '../../src/components/design-system';

// Mock the underlying Bootstrap Modal
jest.mock('../../src/components/Modal/Modal', () => {
  return function MockBootstrapModal({ show, onClose, title, children, submitText, onSubmit, footer, ...props }) {
    if (!show) return null;

    return (
      <div data-testid="bootstrap-modal" role="dialog">
        <div data-testid="modal-header">
          {title && <h5>{title}</h5>}
          <button data-testid="close-button" onClick={onClose}>×</button>
        </div>
        <div data-testid="modal-body">{children}</div>
        {footer ? (
          <div data-testid="modal-footer">{footer}</div>
        ) : (
          onSubmit && (
            <div data-testid="modal-footer">
              <button data-testid="submit-button" onClick={onSubmit}>
                {submitText || 'Submit'}
              </button>
            </div>
          )
        )}
      </div>
    );
  };
});

describe('Modal Abstraction Layer', () => {
  const defaultProps = {
    show: true,
    onClose: jest.fn(),
    title: 'Test Modal',
    children: 'Modal content',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render the Modal abstraction', () => {
      render(<Modal {...defaultProps} />);
      expect(screen.getByTestId('bootstrap-modal')).toBeInTheDocument();
    });

    it('should pass through all props to underlying Bootstrap Modal', () => {
      render(<Modal {...defaultProps} />);

      // Verify title is rendered
      expect(screen.getByText('Test Modal')).toBeInTheDocument();

      // Verify children are rendered
      expect(screen.getByText('Modal content')).toBeInTheDocument();
    });

    it('should not render when show=false', () => {
      render(<Modal {...defaultProps} show={false} />);
      expect(screen.queryByTestId('bootstrap-modal')).not.toBeInTheDocument();
    });
  });

  describe('Event Handling', () => {
    it('should call onClose when close button is clicked', () => {
      const onClose = jest.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);

      fireEvent.click(screen.getByTestId('close-button'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onSubmit when submit button is clicked', () => {
      const onSubmit = jest.fn();
      render(<Modal {...defaultProps} onSubmit={onSubmit} submitText="Save" />);

      fireEvent.click(screen.getByTestId('submit-button'));
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  describe('Custom Footer', () => {
    it('should render custom footer when provided', () => {
      const customFooter = <div data-testid="custom-footer">Custom buttons</div>;
      render(<Modal {...defaultProps} footer={customFooter} />);

      expect(screen.getByTestId('custom-footer')).toBeInTheDocument();
      expect(screen.getByText('Custom buttons')).toBeInTheDocument();
    });

    it('should not render default submit button when custom footer provided', () => {
      const customFooter = <div>Custom</div>;
      render(<Modal {...defaultProps} footer={customFooter} onSubmit={jest.fn()} />);

      expect(screen.queryByTestId('submit-button')).not.toBeInTheDocument();
    });
  });

  describe('Size Variants', () => {
    it('should accept sm size prop', () => {
      const { container } = render(<Modal {...defaultProps} size="sm" />);
      expect(container.firstChild).toBeTruthy();
    });

    it('should accept lg size prop', () => {
      const { container } = render(<Modal {...defaultProps} size="lg" />);
      expect(container.firstChild).toBeTruthy();
    });

    it('should accept xl size prop', () => {
      const { container } = render(<Modal {...defaultProps} size="xl" />);
      expect(container.firstChild).toBeTruthy();
    });

    it('should accept fullscreen size prop', () => {
      const { container } = render(<Modal {...defaultProps} size="fullscreen" />);
      expect(container.firstChild).toBeTruthy();
    });
  });

  describe('Backward Compatibility', () => {
    it('should support all legacy props', () => {
      const legacyProps = {
        show: true,
        onClose: jest.fn(),
        onSubmit: jest.fn(),
        title: 'Legacy Modal',
        children: 'Content',
        submitText: 'Submit',
        submitVariant: 'primary',
        cancelText: 'Cancel',
        showCancelButton: true,
        showSubmitButton: true,
        disableSubmit: false,
        loading: false,
        size: 'lg',
        scrollable: false,
        centered: true,
        dialogClassName: 'custom-dialog',
        contentClassName: 'custom-content',
        bodyClassName: 'custom-body',
        showHeader: true,
        allowBodyScroll: false,
      };

      const { container } = render(<Modal {...legacyProps} />);
      expect(container.firstChild).toBeTruthy();
    });
  });

  describe('API Stability', () => {
    it('should export Modal from design-system', () => {
      expect(Modal).toBeDefined();
      expect(typeof Modal).toBe('object'); // forwardRef returns an object
    });

    it('should maintain display name for DevTools', () => {
      expect(Modal.displayName || Modal.render?.displayName).toBe('Modal');
    });
  });
});

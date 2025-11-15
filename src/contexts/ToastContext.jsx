import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { resendConfirmation } from '../utilities/users-api';
import Toast from '../components/Toast/Toast';

const ToastContext = createContext();

/**
 * Hook to access toast notifications
 * @returns {Object} Toast context with addToast, removeToast, success, error, warning, info functions
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

/**
 * Toast Provider Component
 * Manages global toast notifications with stacking support and Bootstrap variants
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  /**
   * Add a new toast notification
   * @param {Object} options - Toast configuration
   * @param {string} options.message - Message to display
   * @param {string} [options.header] - Optional header text
   * @param {string} [options.type] - Toast type: 'primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark'
   * @param {string} [options.bg] - Background variant (overrides type)
   * @param {string} [options.position] - Position: 'top-start', 'top-center', 'top-end', 'middle-start', 'middle-center', 'middle-end', 'bottom-start', 'bottom-center', 'bottom-end'
   * @param {number} [options.duration=5000] - Auto-dismiss duration in ms (0 = no auto-dismiss)
   * @param {Array} [options.actions] - Action buttons [{label, onClick, variant}]
   * @param {boolean} [options.showCloseButton=true] - Show close button
   * @param {boolean} [options.autohide] - Enable autohide (default: true if duration > 0)
   * @param {string} [options.animation='fade'] - Animation type ('fade' or 'slide')
   * @returns {string} Toast ID
   */
  const addToast = useCallback((options) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast = {
      id,
      message: options.message || '',
      header: options.header,
      type: options.type || 'info',
      bg: options.bg,
      position: options.position || 'top-end',
      duration: options.duration !== undefined ? options.duration : 5000,
      actions: options.actions || null,
      showCloseButton: options.showCloseButton !== undefined ? options.showCloseButton : true,
      autohide: options.autohide,
      animation: options.animation || 'fade',
    };

    setToasts((prev) => [...prev, newToast]);
    return id;
  }, []);

  /**
   * Remove a toast notification
   * @param {string} id - Toast ID to remove
   */
  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  /**
   * Helper functions for common toast types
   */
  const success = useCallback((message, options = {}) => {
    return addToast({ message, type: 'success', ...options });
  }, [addToast]);

  const error = useCallback((message, options = {}) => {
    // If message is a structured EMAIL_NOT_VERIFIED payload, render a toast with a resend action
    if (message && typeof message === 'object' && message.__emailNotVerified) {
      const email = message.email;
      const actions = [];

      if (email) {
        actions.push({
          label: 'Resend verification',
          variant: 'primary',
          onClick: async () => {
            try {
              await resendConfirmation(email);
              // Show success feedback
              addToast({ message: 'Verification email sent. Please check your inbox.', type: 'success', duration: 5000 });
            } catch (err) {
              addToast({ message: err?.message || 'Failed to resend verification email.', type: 'danger' });
            }
          }
        });
      } else {
        // If we don't have an email, provide a way to open the Profile page
        actions.push({
          label: 'Open profile',
          variant: 'primary',
          onClick: () => { window.location.href = '/profile'; }
        });
      }

      // Keep the toast visible until user dismisses (duration: 0)
      return addToast({ message: message.message, type: 'danger', actions, duration: 0 });
    }

    return addToast({ message, type: 'danger', ...options });
  }, [addToast]);

  const warning = useCallback((message, options = {}) => {
    return addToast({ message, type: 'warning', ...options });
  }, [addToast]);

  const info = useCallback((message, options = {}) => {
    return addToast({ message, type: 'info', ...options });
  }, [addToast]);

  const primary = useCallback((message, options = {}) => {
    return addToast({ message, type: 'primary', ...options });
  }, [addToast]);

  const secondary = useCallback((message, options = {}) => {
    return addToast({ message, type: 'secondary', ...options });
  }, [addToast]);

  const light = useCallback((message, options = {}) => {
    return addToast({ message, type: 'light', ...options });
  }, [addToast]);

  const dark = useCallback((message, options = {}) => {
    return addToast({ message, type: 'dark', ...options });
  }, [addToast]);

  const value = {
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
    primary,
    secondary,
    light,
    dark,
  };

  // Listen for global email-not-verified events emitted by send-request
  useEffect(() => {
    const handler = (e) => {
      const data = e?.detail || {};
      const message = data.error || 'Please verify your email address before performing this action.';
      const email = data.email || null;
      const actions = [];

      if (email) {
        actions.push({
          label: 'Resend verification',
          variant: 'primary',
          onClick: async () => {
            try {
              await resendConfirmation(email);
              addToast({ message: 'Verification email sent. Please check your inbox.', type: 'success', duration: 5000 });
            } catch (err) {
              addToast({ message: err?.message || 'Failed to resend verification email.', type: 'danger' });
            }
          }
        });
      } else {
        actions.push({ label: 'Open profile', variant: 'primary', onClick: () => { window.location.href = '/profile'; } });
      }

      addToast({ message, type: 'danger', actions, duration: 0 });
    };

    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('bien:email_not_verified', handler);
    }

    return () => {
      if (typeof window !== 'undefined' && window.removeEventListener) {
        window.removeEventListener('bien:email_not_verified', handler);
      }
    };
  }, [addToast]);

  // Group toasts by position for proper stacking
  const toastsByPosition = toasts.reduce((acc, toast) => {
    const position = toast.position || 'top-end';
    if (!acc[position]) {
      acc[position] = [];
    }
    acc[position].push(toast);
    return acc;
  }, {});

  return (
    <ToastContext.Provider value={value}>
      {children}
      {Object.entries(toastsByPosition).map(([position, positionToasts]) =>
        positionToasts.map((toast, index) => (
          <Toast
            key={toast.id}
            id={toast.id}
            message={toast.message}
            header={toast.header}
            type={toast.type}
            bg={toast.bg}
            position={position}
            duration={toast.duration}
            onClose={removeToast}
            index={index}
            actions={toast.actions}
            showCloseButton={toast.showCloseButton}
            autohide={toast.autohide}
            animation={toast.animation}
          />
        ))
      )}
    </ToastContext.Provider>
  );
}

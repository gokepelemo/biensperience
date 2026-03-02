import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { resendConfirmation } from '../utilities/users-api';
import Toast from '../components/Toast/Toast';
import { createToastConfig } from '../utilities/error-handler';
import { eventBus } from '../utilities/event-bus';
import { lang } from '../lang.constants';

// Preserve context reference across HMR to prevent "must be used within Provider" errors
const ToastContext = (import.meta.hot?.data?.ToastContext) || createContext();
if (import.meta.hot) {
  import.meta.hot.data.ToastContext = ToastContext;
}

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

  const buildEmailVerificationActions = useCallback((email) => {
    if (email) {
      return [{
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
      }];
    }
    return [{ label: 'Open profile', variant: 'primary', onClick: () => { window.location.href = '/profile'; } }];
  }, [addToast]);

  const error = useCallback((message, options = {}) => {
    // If message is a structured EMAIL_NOT_VERIFIED payload, render a toast with a resend action
    if (message && typeof message === 'object' && message.__emailNotVerified) {
      const actions = buildEmailVerificationActions(message.email);
      return addToast({ message: message.message, type: 'danger', actions, duration: 0 });
    }

    return addToast({ message, type: 'danger', ...options });
  }, [addToast, buildEmailVerificationActions]);

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

  // Track deferred timers for undo toasts so they can be cleaned up
  const undoTimersRef = useRef({});

  /**
   * Show an undoable toast with a deferred action
   * Applies optimistic UI immediately, defers the API call until the undo window expires.
   * @param {string} message - Message to display
   * @param {Object} options - Configuration
   * @param {Function} options.onUndo - Called when user clicks Undo (restore UI state)
   * @param {Function} options.onExpire - Called when undo window expires (execute API call)
   * @param {number} [options.duration=8000] - Undo window duration in ms
   * @returns {string} Toast ID
   */
  const undoable = useCallback((message, { onUndo, onExpire, duration = 8000, ...options } = {}) => {
    const undoLabel = lang.current.toast.undo || 'Undo';
    const undoneMessage = lang.current.toast.undone || 'Action undone';
    let undone = false;

    const id = addToast({
      message,
      type: 'success',
      duration,
      showCloseButton: true,
      ...options,
      actions: [
        {
          label: undoLabel,
          variant: 'primary',
          onClick: () => {
            undone = true;
            // Cancel the deferred timer
            if (undoTimersRef.current[id]) {
              clearTimeout(undoTimersRef.current[id]);
              delete undoTimersRef.current[id];
            }
            onUndo?.();
            addToast({ message: undoneMessage, type: 'info', duration: 3000 });
          }
        }
      ],
    });

    // Schedule the deferred action when undo window expires
    undoTimersRef.current[id] = setTimeout(() => {
      delete undoTimersRef.current[id];
      if (!undone) {
        onExpire?.();
      }
    }, duration);

    return id;
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
    undoable,
  };

  // Listen for global email-not-verified events emitted by send-request via eventBus
  useEffect(() => {
    const handler = (event) => {
      const data = event || {};
      const message = data.error || 'Please verify your email address before performing this action.';
      const actions = buildEmailVerificationActions(data.email || null);
      addToast({ message, type: 'danger', actions, duration: 0 });
    };

    const unsubscribe = eventBus.subscribe('bien:email_not_verified', handler);

    return () => {
      unsubscribe();
    };
  }, [addToast, buildEmailVerificationActions]);

  // Listen for global API error events emitted by send-request via eventBus
  useEffect(() => {
    const handler = (event) => {
      // Event payload comes directly from broadcastEvent
      const error = event?.error;

      if (!error) return;

      // Generate toast configuration from structured error
      const toastConfig = createToastConfig(error);

      // Add toast with configuration
      addToast({
        message: toastConfig.message,
        type: toastConfig.type,
        duration: toastConfig.duration,
        actions: toastConfig.actions,
        showCloseButton: toastConfig.showCloseButton
      });
    };

    const unsubscribe = eventBus.subscribe('bien:api_error', handler);

    return () => {
      unsubscribe();
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

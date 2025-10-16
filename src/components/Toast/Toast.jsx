import React, { useEffect, useState, useRef } from 'react';
import { Toast as BootstrapToast } from 'react-bootstrap';
import { FaCheckCircle, FaExclamationCircle, FaInfoCircle, FaExclamationTriangle } from 'react-icons/fa';
import './Toast.css';

/**
 * Toast Notification Component - Bootstrap Version
 * 
 * @param {Object} props
 * @param {string} props.id - Unique identifier for the toast
 * @param {string} props.message - Message to display
 * @param {string} props.header - Optional header text
 * @param {string} props.type - Toast type: 'primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark'
 * @param {string} props.bg - Background variant (overrides type if provided)
 * @param {string} props.position - Position: 'top-start', 'top-center', 'top-end', 'middle-start', 'middle-center', 'middle-end', 'bottom-start', 'bottom-center', 'bottom-end'
 * @param {number} props.duration - Auto-dismiss duration in milliseconds (0 = no auto-dismiss)
 * @param {Function} props.onClose - Callback when toast is closed
 * @param {number} props.index - Stack index for positioning
 * @param {Array} props.actions - Optional action buttons [{label, onClick, variant}]
 * @param {boolean} props.showCloseButton - Show close button (default: true)
 * @param {boolean} props.autohide - Enable autohide (default: true if duration > 0)
 * @param {string} props.animation - Animation type: 'fade' or 'slide' (default: 'fade')
 */
export default function Toast({
  id,
  message,
  header,
  type = 'info',
  bg,
  position = 'top-end',
  duration = 5000,
  onClose,
  index = 0,
  actions = null,
  showCloseButton = true,
  autohide,
  animation = 'fade',
}) {
  const [show, setShow] = useState(false);
  const toastRef = useRef(null);

  // Map old type names to Bootstrap variants
  const getBootstrapVariant = () => {
    if (bg) return bg;
    
    const typeMap = {
      'error': 'danger',
      'cookie-consent': 'primary',
      'success': 'success',
      'warning': 'warning',
      'info': 'info'
    };
    return typeMap[type] || type;
  };

  const getIcon = () => {
    const iconClass = "me-2";
    switch (type) {
      case 'success':
        return <FaCheckCircle className={iconClass} />;
      case 'error':
      case 'danger':
        return <FaExclamationCircle className={iconClass} />;
      case 'warning':
        return <FaExclamationTriangle className={iconClass} />;
      case 'info':
      case 'primary':
      default:
        return <FaInfoCircle className={iconClass} />;
    }
  };

  useEffect(() => {
    // Show toast on mount
    setShow(true);

    // Auto-hide logic
    const shouldAutohide = autohide !== undefined ? autohide : duration > 0;
    if (shouldAutohide && duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, autohide]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    setShow(false);
    // Give time for exit animation
    setTimeout(() => {
      onClose(id);
    }, 300);
  };

  // Calculate position styling
  const getPositionStyle = () => {
    const styles = {
      position: 'fixed',
      zIndex: 9999,
    };

    // Parse position prop
    const [vertical, horizontal] = position.split('-');

    // Vertical positioning
    if (vertical === 'top') {
      styles.top = `${20 + index * 85}px`;
    } else if (vertical === 'bottom') {
      styles.bottom = `${20 + index * 85}px`;
    } else if (vertical === 'middle') {
      styles.top = '50%';
      styles.transform = 'translateY(-50%)';
    }

    // Horizontal positioning
    if (horizontal === 'start') {
      styles.left = '20px';
    } else if (horizontal === 'end') {
      styles.right = '20px';
    } else if (horizontal === 'center') {
      styles.left = '50%';
      styles.transform = styles.transform 
        ? `${styles.transform} translateX(-50%)` 
        : 'translateX(-50%)';
    }

    return styles;
  };

  const variant = getBootstrapVariant();
  const textClass = ['light', 'warning', 'info', 'secondary'].includes(variant) ? 'text-dark' : 'text-white';

  return (
    <BootstrapToast
      ref={toastRef}
      show={show}
      onClose={handleClose}
      style={getPositionStyle()}
      className={`biensperience-toast ${animation === 'slide' ? 'toast-slide' : ''}`}
      bg={variant}
      autohide={false} // We handle autohide manually
    >
      {header && (
        <BootstrapToast.Header closeButton={showCloseButton} className={textClass}>
          {getIcon()}
          <strong className="me-auto">{header}</strong>
        </BootstrapToast.Header>
      )}
      <BootstrapToast.Body className={textClass}>
        <div className="d-flex align-items-start">
          {!header && (
            <div className="toast-icon-wrapper">
              {getIcon()}
            </div>
          )}
          <div className="flex-grow-1">
            {message}
            {actions && (
              <div className="toast-actions mt-2 d-flex gap-2">
                {Array.isArray(actions) 
                  ? actions.map((action, idx) => (
                      <button
                        key={idx}
                        className={`btn btn-sm ${action.variant ? `btn-${action.variant}` : 'btn-light'}`}
                        onClick={() => {
                          action.onClick();
                          handleClose();
                        }}
                      >
                        {action.label}
                      </button>
                    ))
                  : actions
                }
              </div>
            )}
          </div>
          {!header && showCloseButton && (
            <button
              type="button"
              className="btn-close btn-close-white ms-2"
              aria-label="Close"
              onClick={handleClose}
            />
          )}
        </div>
      </BootstrapToast.Body>
    </BootstrapToast>
  );
}

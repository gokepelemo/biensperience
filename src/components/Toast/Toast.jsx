import React, { useEffect, useState, useRef } from 'react';
import { Toast as BootstrapToast } from 'react-bootstrap';
import { FaCheckCircle, FaExclamationCircle, FaInfoCircle, FaExclamationTriangle } from 'react-icons/fa';
import { lang } from '../../lang.constants';
import styles from './Toast.module.scss';

/**
 * Toast notification component with auto-dismiss and positioning support.
 * See PropTypes for full prop documentation.
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
    const positionStyles = {
      position: 'fixed',
      zIndex: 9999,
    };

    // Parse position prop
    const [vertical, horizontal] = position.split('-');

    // Vertical positioning
    if (vertical === 'top') {
      positionStyles.top = `${20 + index * 85}px`;
    } else if (vertical === 'bottom') {
      positionStyles.bottom = `${20 + index * 85}px`;
    } else if (vertical === 'middle') {
      positionStyles.top = '50%';
      positionStyles.transform = 'translateY(-50%)';
    }

    // Horizontal positioning
    if (horizontal === 'start') {
      positionStyles.left = '20px';
    } else if (horizontal === 'end') {
      positionStyles.right = '20px';
    } else if (horizontal === 'center') {
      positionStyles.left = '50%';
      positionStyles.transform = positionStyles.transform
        ? `${positionStyles.transform} translateX(-50%)`
        : 'translateX(-50%)';
    }

    return positionStyles;
  };

  const variant = getBootstrapVariant();
  const textClass = ['light', 'warning', 'info', 'secondary'].includes(variant) ? 'text-dark' : 'text-white';

  return (
    <BootstrapToast
      ref={toastRef}
      show={show}
      onClose={handleClose}
      style={getPositionStyle()}
      className={`${styles.biensperienceToast} ${animation === 'slide' ? styles.toastSlide : ''}`}
      bg={variant}
      autohide={false} // We handle autohide manually
    >
      {header && (
        <BootstrapToast.Header
          closeButton={showCloseButton}
          closeVariant={['light', 'warning', 'info', 'secondary'].includes(variant) ? 'black' : 'white'}
          className={textClass}
        >
          {getIcon()}
          <strong className="me-auto">{header}</strong>
        </BootstrapToast.Header>
      )}
      {!header && showCloseButton && (
        <button
          type="button"
          className={`btn-close ${['light', 'warning', 'info', 'secondary'].includes(variant) ? '' : styles.btnCloseWhite}`}
          aria-label={lang.current.toast.close}
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: '0.5rem',
            right: '0.5rem',
            zIndex: 2
          }}
        />
      )}
      <BootstrapToast.Body className={`${styles.toastBody} ${textClass}`}>
        <div className={`d-flex align-items-start ${styles.toastBodyFlex}`}>
          {!header && (
            <div className={styles.toastIconWrapper}>
              {getIcon()}
            </div>
          )}
          <div className={`flex-grow-1 ${styles.toastMessageContent}`}>
            {message}
            {actions && (
              <div className={styles.toastActions}>
                {Array.isArray(actions)
                  ? actions.map((action, idx) => (
                      <button
                        key={idx}
                        className={`btn ${action.variant ? `btn-${action.variant}` : 'btn-light'}`}
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
        </div>
      </BootstrapToast.Body>
    </BootstrapToast>
  );
}

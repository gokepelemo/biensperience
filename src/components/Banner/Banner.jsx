import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { FaTimes, FaInfoCircle, FaCheckCircle, FaExclamationTriangle, FaTimesCircle, FaBullhorn } from 'react-icons/fa';
import { Button } from '../design-system';
import { FadeIn } from '../Animation';
import { lang } from '../../lang.constants';
import styles from './Banner.module.scss';

/**
 * Banner component for notifications and alerts with auto-expiry functionality
 *
 * @param {Object} props - Component props
 * @param {string} props.type - Banner type: 'info', 'success', 'warning', 'danger', 'neutral'
 * @param {string} props.variant - Visual variant: 'light', 'solid', 'bordered'
 * @param {string} props.title - Banner title text
 * @param {string} props.message - Banner message/subtitle text
 * @param {React.ReactNode} props.icon - Custom icon component (defaults to type-based icon)
 * @param {boolean} props.showIcon - Whether to show the icon
 * @param {boolean} props.dismissible - Whether banner can be manually dismissed
 * @param {function} props.onDismiss - Callback when banner is dismissed
 * @param {function} props.onExpiry - Callback when banner expires automatically
 * @param {number} props.expiryTime - Auto-expiry time in milliseconds (0 = no expiry)
 * @param {Object} props.button - Button configuration object
 * @param {string} props.button.text - Button text
 * @param {string} props.button.variant - Button variant
 * @param {function} props.button.onClick - Button click handler
 * @param {boolean} props.button.disabled - Whether button is disabled
 * @param {string} props.size - Banner size: 'sm', 'md', 'lg'
 * @param {string} props.className - Additional CSS classes
 * @param {Object} props.style - Inline styles
 * @param {React.ReactNode} props.children - Custom content (replaces title/message)
 */
export default function Banner({
  type = 'info',
  variant = 'light',
  title,
  message,
  icon,
  showIcon = true,
  dismissible = false,
  onDismiss,
  onExpiry,
  expiryTime = 0,
  button,
  size = 'md',
  className = '',
  style = {},
  children,
  ...props
}) {
  const [isVisible, setIsVisible] = useState(true);
  const [isExpiring, setIsExpiring] = useState(false);

  // Auto-expiry logic
  useEffect(() => {
    if (expiryTime > 0 && isVisible) {
      const expiryTimer = setTimeout(() => {
        handleExpiry();
      }, expiryTime);

      return () => clearTimeout(expiryTimer);
    }
  }, [expiryTime, isVisible]);

  const handleExpiry = useCallback(() => {
    setIsExpiring(true);

    // Wait for exit animation before removing
    setTimeout(() => {
      setIsVisible(false);
      if (onExpiry) {
        onExpiry();
      }
    }, 300); // Match CSS transition duration
  }, [onExpiry]);

  const handleDismiss = useCallback(() => {
    setIsExpiring(true);

    setTimeout(() => {
      setIsVisible(false);
      if (onDismiss) {
        onDismiss();
      }
    }, 300);
  }, [onDismiss]);

  // Don't render if not visible
  if (!isVisible) {
    return null;
  }

  // Build CSS classes
  const typeClass = styles[`banner${type.charAt(0).toUpperCase() + type.slice(1)}`];
  const variantClass = variant === 'solid' ? styles.bannerSolid
    : variant === 'bordered' ? styles.bannerBordered
    : styles.bannerLight;
  const sizeClass = size === 'sm' ? styles.bannerSm
    : size === 'lg' ? styles.bannerLg
    : '';

  const bannerClasses = [
    styles.banner,
    typeClass,
    variantClass,
    sizeClass,
    isExpiring && styles.bannerExpiring,
    className
  ].filter(Boolean).join(' ');

  // Get default icon based on type (use react-icons for consistent visuals)
  const getDefaultIcon = () => {
    const icons = {
      info: <FaInfoCircle size={18} />,
      success: <FaCheckCircle size={18} />,
      warning: <FaExclamationTriangle size={18} />,
      danger: <FaTimesCircle size={18} />,
      neutral: <FaBullhorn size={18} />,
    };
    return icons[type] || <FaBullhorn size={18} />;
  };

  const displayIcon = icon !== undefined ? (showIcon ? icon : null) : (showIcon ? getDefaultIcon() : null);

  return (
    <FadeIn
      duration="normal"
      trigger={!isExpiring}
      className={bannerClasses}
      style={style}
      role="alert"
      aria-live="polite"
      {...props}
    >
      <div className={styles.bannerContent}>
        {/* Icon */}
        {displayIcon && (
          <div className={styles.bannerIcon}>
            {typeof displayIcon === 'string' ? (
              <span className={styles.bannerIconEmoji}>{displayIcon}</span>
            ) : (
              displayIcon
            )}
          </div>
        )}

        {/* Text Content */}
        <div className={styles.bannerText}>
          {children ? (
            children
          ) : (
            <>
              {title && (
                <div className={styles.bannerTitle}>
                  {title}
                </div>
              )}
              {message && (
                <div className={styles.bannerMessage}>
                  {message}
                </div>
              )}
            </>
          )}
        </div>

        {/* Button */}
        {button && (
          <div className={styles.bannerActions}>
            <Button
              variant={button.variant || 'outline'}
              size="sm"
              onClick={button.onClick}
              disabled={button.disabled}
              className={styles.bannerButton}
            >
              {button.text}
            </Button>
          </div>
        )}

        {/* Dismiss Button */}
        {dismissible && (
          <button
            type="button"
            className={styles.bannerClose}
            onClick={handleDismiss}
            aria-label={lang.current.banner.dismissBanner}
          >
            <FaTimes size={16} />
          </button>
        )}
      </div>
    </FadeIn>
  );
}

Banner.propTypes = {
  type: PropTypes.oneOf(['info', 'success', 'warning', 'danger', 'neutral']),
  variant: PropTypes.oneOf(['light', 'solid', 'bordered']),
  title: PropTypes.string,
  message: PropTypes.string,
  icon: PropTypes.node,
  showIcon: PropTypes.bool,
  dismissible: PropTypes.bool,
  onDismiss: PropTypes.func,
  onExpiry: PropTypes.func,
  expiryTime: PropTypes.number,
  button: PropTypes.shape({
    text: PropTypes.string.isRequired,
    variant: PropTypes.string,
    onClick: PropTypes.func,
    disabled: PropTypes.bool
  }),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  className: PropTypes.string,
  style: PropTypes.object,
  children: PropTypes.node
};
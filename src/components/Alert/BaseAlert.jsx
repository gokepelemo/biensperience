/**
 * BaseAlert - Design System Alert Component Implementation
 *
 * Drop-in replacement for the custom Alert component.
 * Uses styled primitives for built-in accessibility
 * while preserving the existing Alert.module.scss styling via CSS Module class names.
 *
 * IMPORTANT: This implementation completely resets default styling
 * and applies the existing CSS Module classes, ensuring pixel-perfect
 * visual parity with the original Alert component.
 *
 * Benefits:
 * - Built-in ARIA attributes (role="alert", aria-live)
 * - Consistent focus management for dismissible alerts
 * - Semantic alert structure
 *
 * Task: biensperience-f047 - Migrate Alert component
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { chakra } from '@chakra-ui/react';
import { lang } from '../../lang.constants';
import styles from './Alert.module.scss';

/**
 * Using chakra('div') (the styled factory) instead of the Alert.Root recipe component.
 *
 * The Alert.Root recipe component applies slot recipe base + variant + size + status
 * styles that fight with our CSS Module classes. The chakra factory creates a bare
 * styled <div> element with NO recipe styles — only Chakra's runtime (css prop support,
 * ref forwarding). This means our CSS Module classes from Alert.module.scss are the
 * sole source of visual styling, with zero specificity conflicts.
 *
 * We add role="alert" and aria-live manually to retain accessibility benefits.
 */
const StyledAlert = chakra('div');

/**
 * BaseAlert - Chakra UI Alert.Root with CSS Module styling
 *
 * Uses Chakra Alert.Root for accessibility benefits,
 * with reset styling to use CSS Modules.
 */
export default function BaseAlert({
  type = 'info',
  dismissible = false,
  onDismiss,
  title,
  message,
  children,
  className = '',
  style = {},
  icon,
  showIcon = true,
  size = 'md',
  bordered = false,
  closeButtonStyle = {},
  actions,
}) {
  const [visible, setVisible] = useState(true);

  // CSS Modules class mapping
  const typeClass = type === 'primary' ? styles.alertPrimary
    : type === 'secondary' ? styles.alertSecondary
    : type === 'success' ? styles.alertSuccess
    : type === 'danger' ? styles.alertDanger
    : type === 'warning' ? styles.alertWarning
    : type === 'info' ? styles.alertInfo
    : type === 'light' ? styles.alertLight
    : type === 'dark' ? styles.alertDark
    : styles.alertInfo;

  const sizeClass = size === 'sm' ? styles.alertSm
    : size === 'lg' ? styles.alertLg
    : '';

  const alertClasses = [
    styles.alert,
    typeClass,
    dismissible && styles.alertDismissible,
    sizeClass,
    bordered && styles.alertBordered,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss();
    } else {
      setVisible(false);
    }
  };

  if (!visible) return null;

  return (
    <StyledAlert
      className={alertClasses}
      style={style}
      role="alert"
      aria-live={type === 'danger' || type === 'warning' ? 'assertive' : 'polite'}
    >
      {dismissible && (
        <button
          type="button"
          className={`btn-close ${styles.btnClose}`}
          aria-label={lang.current.aria.dismissAlert}
          onClick={handleDismiss}
          style={closeButtonStyle}
        />
      )}

      <div className={styles.alertContent}>
        {icon && showIcon && <span className={styles.alertIcon}>{icon}</span>}

        <div className={styles.alertText}>
          {title && <div className={styles.alertTitle}><strong>{title}</strong></div>}
          {children || (message && <div className={styles.alertMessage}>{message}</div>)}
        </div>
      </div>

      {actions && (
        <div className={styles.alertActions}>
          {actions}
        </div>
      )}
    </StyledAlert>
  );
}

BaseAlert.propTypes = {
  /** Alert type/variant */
  type: PropTypes.oneOf(['primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark']),
  /** Whether alert can be dismissed */
  dismissible: PropTypes.bool,
  /** Callback when alert is dismissed */
  onDismiss: PropTypes.func,
  /** Alert title (optional) */
  title: PropTypes.node,
  /** Alert message (alternative to children) */
  message: PropTypes.node,
  /** Alert content */
  children: PropTypes.node,
  /** Additional CSS class */
  className: PropTypes.string,
  /** Inline styles */
  style: PropTypes.object,
  /** Icon element */
  icon: PropTypes.node,
  /** Whether to show icon */
  showIcon: PropTypes.bool,
  /** Alert size */
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  /** Whether to show a prominent border */
  bordered: PropTypes.bool,
  /** Styles for close button */
  closeButtonStyle: PropTypes.object,
  /** Action buttons to display */
  actions: PropTypes.node,
};

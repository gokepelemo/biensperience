import React, { useState } from "react";
import { lang } from "../../lang.constants";
import styles from "./Alert.module.scss";

/**
 * Reusable Alert Component with support for various types, sizes, and actions.
 * See PropTypes for full prop documentation.
 */
const Alert = ({
  type = "info",
  dismissible = false,
  onDismiss,
  title,
  message,
  children,
  className = "",
  style = {},
  icon,
  showIcon = true,
  size = "md",
  bordered = false,
  closeButtonStyle = {},
  actions,
}) => {
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
    .join(" ");

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss();
    } else {
      setVisible(false);
    }
  };

  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className={alertClasses} style={style} role="alert">
      {dismissible && (
        <button
          type="button"
          className={`btn-close ${styles.btnClose}`}
          aria-label={lang.en.aria.dismissAlert}
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
    </div>
  );
};

export default Alert;

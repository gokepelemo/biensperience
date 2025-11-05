import React from "react";
import { lang } from "../../lang.constants";
import { getComponentStyles } from "../../utilities/design-system";
import "./Alert.css";

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
  const alertClasses = [
    "alert",
    `alert-${type}`,
    dismissible && "alert-dismissible",
    `alert-${size}`,
    bordered && "alert-bordered",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss();
    }
  };

  return (
    <div className={alertClasses} style={style} role="alert">
      {dismissible && (
        <button
          type="button"
          className="btn-close"
          aria-label={lang.en.aria.dismissAlert}
          onClick={handleDismiss}
          style={closeButtonStyle}
        >
          <span aria-hidden="true">&times;</span>
        </button>
      )}
      
      <div className="alert-content">
        {icon && showIcon && <span className="alert-icon">{icon}</span>}
        
        <div className="alert-text">
          {title && <div className="alert-title"><strong>{title}</strong></div>}
          {children || (message && <div className="alert-message">{message}</div>)}
        </div>
      </div>

      {actions && (
        <div className="alert-actions" style={{ cssText: getComponentStyles('alertActions') }}>
          {actions}
        </div>
      )}
    </div>
  );
};

export default Alert;

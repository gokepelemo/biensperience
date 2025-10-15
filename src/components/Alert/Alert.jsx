import React from "react";
import "./Alert.css";

/**
 * Reusable Alert Component
 * 
 * @param {Object} props
 * @param {string} props.type - Alert type: 'success', 'warning', 'danger', 'info', 'primary', 'secondary', 'light', 'dark'
 * @param {boolean} props.dismissible - Whether the alert can be dismissed
 * @param {function} props.onDismiss - Callback when alert is dismissed
 * @param {string} props.title - Alert title (optional)
 * @param {string|React.ReactNode} props.message - Alert message or content
 * @param {React.ReactNode} props.children - Additional content (overrides message if provided)
 * @param {string} props.className - Additional CSS classes
 * @param {Object} props.style - Inline styles
 * @param {string} props.icon - Optional icon/emoji to display
 * @param {boolean} props.showIcon - Whether to show the icon (default: true if icon provided)
 * @param {string} props.size - Alert size: 'sm', 'md', 'lg' (default: 'md')
 * @param {boolean} props.bordered - Whether to show border (default: false)
 * @param {Object} props.closeButtonStyle - Custom styles for close button
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
          aria-label="Dismiss alert"
          onClick={handleDismiss}
          style={closeButtonStyle}
        />
      )}
      
      <div className="alert-content">
        {icon && showIcon && <span className="alert-icon">{icon}</span>}
        
        <div className="alert-text">
          {title && <div className="alert-title"><strong>{title}</strong></div>}
          {children || (message && <div className="alert-message">{message}</div>)}
        </div>
      </div>
    </div>
  );
};

export default Alert;

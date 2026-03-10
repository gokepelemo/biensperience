/**
 * BaseAlert — Native Chakra UI v3 Alert compound component
 *
 * Uses Chakra's Alert.Root/Content/Indicator/Title/Description
 * with the alert slotRecipe from ui-theme.js.
 * No CSS Modules — pure Chakra tokens.
 *
 * Prop mapping:
 *   type → Chakra status (info/success/warning/error/neutral)
 *   size → Chakra size (sm/md/lg)
 *   bordered → borderWidth override
 *   dismissible → CloseButton endElement
 *   icon → Alert.Indicator child
 *   actions → flex footer area
 *
 * Task: biensperience-8797 — P2.4 Alert → Chakra Alert
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Alert, CloseButton, Box } from '@chakra-ui/react';
import { lang } from '../../lang.constants';

// Map legacy type names to Chakra Alert status values
const STATUS_MAP = {
  primary: 'info',
  secondary: 'neutral',
  success: 'success',
  danger: 'error',
  warning: 'warning',
  info: 'info',
  light: 'neutral',
  dark: 'neutral',
};

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

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss();
    } else {
      setVisible(false);
    }
  };

  if (!visible) return null;

  const status = STATUS_MAP[type] || 'info';

  return (
    <Alert.Root
      status={status}
      variant="subtle"
      size={size}
      role="alert"
      aria-live={type === 'danger' || type === 'warning' ? 'assertive' : 'polite'}
      className={className || undefined}
      style={Object.keys(style).length ? style : undefined}
      css={bordered ? { borderWidth: '2px', borderStyle: 'solid' } : undefined}
    >
      {showIcon && (
        <Alert.Indicator>
          {icon || undefined}
        </Alert.Indicator>
      )}

      <Alert.Content>
        {title && <Alert.Title>{title}</Alert.Title>}
        {children ? (
          <Alert.Description>{children}</Alert.Description>
        ) : message ? (
          <Alert.Description>{message}</Alert.Description>
        ) : null}
      </Alert.Content>

      {actions && (
        <Box
          css={{
            display: 'flex',
            alignItems: 'center',
            gap: '{spacing.2}',
            marginLeft: 'auto',
            flexShrink: 0,
          }}
        >
          {actions}
        </Box>
      )}

      {dismissible && (
        <CloseButton
          pos="relative"
          top="-1"
          insetEnd="-1"
          aria-label={lang.current.aria.dismissAlert}
          onClick={handleDismiss}
          style={Object.keys(closeButtonStyle).length ? closeButtonStyle : undefined}
          size="sm"
        />
      )}
    </Alert.Root>
  );
}

BaseAlert.propTypes = {
  type: PropTypes.oneOf(['primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark']),
  dismissible: PropTypes.bool,
  onDismiss: PropTypes.func,
  title: PropTypes.node,
  message: PropTypes.node,
  children: PropTypes.node,
  className: PropTypes.string,
  style: PropTypes.object,
  icon: PropTypes.node,
  showIcon: PropTypes.bool,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  bordered: PropTypes.bool,
  closeButtonStyle: PropTypes.object,
  actions: PropTypes.node,
};

import React, { useEffect } from 'react';
import { Box, Button, HStack, VStack, IconButton } from '@chakra-ui/react';
import { FaCheckCircle, FaExclamationCircle, FaInfoCircle, FaExclamationTriangle, FaTimes } from 'react-icons/fa';
import { lang } from '../../lang.constants';
import styles from './Toast.module.css';

/**
 * Get icon component based on type
 */
const getIcon = (type) => {
  switch (type) {
    case 'success':
      return FaCheckCircle;
    case 'error':
    case 'danger':
      return FaExclamationCircle;
    case 'warning':
      return FaExclamationTriangle;
    case 'info':
    case 'primary':
    default:
      return FaInfoCircle;
  }
};

/**
 * Get background color based on type
 */
const getBackgroundColor = (type, bg) => {
  const variant = bg || type;
  const colorMap = {
    'success': 'var(--color-success)',
    'error': 'var(--color-danger)',
    'danger': 'var(--color-danger)',
    'warning': 'var(--color-warning)',
    'info': 'var(--color-info)',
    'primary': 'var(--color-primary)',
    'secondary': 'var(--color-text-muted)',
    'light': 'var(--color-bg-secondary)',
    'dark': 'var(--color-bg-tertiary)',
  };
  return colorMap[variant] || 'var(--color-info)';
};

/**
 * Get text color based on background
 */
const getTextColor = (type, bg) => {
  const variant = bg || type;
  const lightBgVariants = ['light', 'warning', 'secondary'];
  return lightBgVariants.includes(variant) ? 'var(--color-text-primary)' : 'white';
};

/**
 * Toast notification component with auto-dismiss and positioning support.
 * Uses Chakra UI Box components for layout with Biensperience design tokens.
 *
 * @param {Object} props
 * @param {string} props.id - Unique toast ID
 * @param {string} props.message - Message to display
 * @param {string} [props.header] - Optional header text
 * @param {string} [props.type='info'] - Toast type: 'success', 'error', 'warning', 'info', 'primary', etc.
 * @param {string} [props.bg] - Background variant (overrides type)
 * @param {string} [props.position='top-end'] - Position on screen
 * @param {number} [props.duration=5000] - Auto-dismiss duration in ms (0 = no auto-dismiss)
 * @param {Function} props.onClose - Callback when toast closes
 * @param {number} [props.index=0] - Index for stacking calculation
 * @param {Array} [props.actions] - Action buttons [{label, onClick, variant}]
 * @param {boolean} [props.showCloseButton=true] - Show close button
 * @param {boolean} [props.autohide] - Enable autohide
 * @param {string} [props.animation='fade'] - Animation type ('fade' or 'slide')
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
  const IconComponent = getIcon(type);
  const backgroundColor = getBackgroundColor(type, bg);
  const textColor = getTextColor(type, bg);
  const isUndoToast = Array.isArray(actions) && actions.some(a => a.label === (lang.current.toast.undo || 'Undo'));

  // Auto-hide logic
  useEffect(() => {
    const shouldAutohide = autohide !== undefined ? autohide : duration > 0;
    if (shouldAutohide && duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, autohide]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    // Brief delay for exit animation
    setTimeout(() => {
      onClose(id);
    }, 150);
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

  return (
    <Box
      className={`${styles.biensperienceToast} ${animation === 'slide' ? styles.toastSlide : ''}`.trim()}
      style={getPositionStyle()}
      bg={backgroundColor}
      color={textColor}
      minW="300px"
      maxW="500px"
      borderRadius="var(--radius-md)"
      boxShadow="var(--shadow-md)"
      overflow="visible"
      position="relative"
    >
      <Box p="var(--space-3) var(--space-4)">
        <HStack align="center" gap="var(--space-3)">
          {/* Icon */}
          <Box className={styles.toastIconWrapper} fontSize="1.25rem" display="flex" alignItems="center" flexShrink={0}>
            <IconComponent />
          </Box>

          {/* Content */}
          <VStack align="stretch" flex="1" gap="var(--space-2)" minW="0">
            {/* Header */}
            {header && (
              <Box
                fontWeight="var(--font-weight-bold)"
                fontSize="var(--font-size-base)"
              >
                {header}
              </Box>
            )}

            {/* Message */}
            <Box
              className={styles.toastMessageContent}
              fontSize="var(--font-size-base)"
              fontWeight="var(--font-weight-semibold)"
              lineHeight="var(--line-height-relaxed)"
            >
              {message}
            </Box>

            {/* Actions */}
            {actions && (
              <HStack className={styles.toastActions} gap="var(--space-2)" mt="var(--space-2)">
                {Array.isArray(actions)
                  ? actions.map((action, idx) => (
                      <Button
                        key={idx}
                        size="sm"
                        variant={action.variant === 'primary' ? 'solid' : 'ghost'}
                        bg={action.variant === 'primary' ? 'rgba(255, 255, 255, 0.95)' : 'transparent'}
                        color={action.variant === 'primary' ? backgroundColor : textColor}
                        fontWeight="var(--font-weight-semibold)"
                        fontSize="var(--font-size-sm)"
                        minH="32px"
                        px="var(--space-3)"
                        _hover={{
                          bg: action.variant === 'primary' ? 'white' : 'rgba(255, 255, 255, 0.1)',
                          transform: 'translateY(-1px)',
                        }}
                        onClick={() => {
                          action.onClick();
                          handleClose();
                        }}
                      >
                        {action.label}
                      </Button>
                    ))
                  : actions
                }
              </HStack>
            )}
          </VStack>

          {/* Close button - inside HStack for vertical alignment */}
          {showCloseButton && (
            <IconButton
              className={styles.toastCloseButton}
              onClick={handleClose}
              aria-label={lang.current.toast.close}
              variant="ghost"
              size="xs"
              color={textColor}
            >
              <FaTimes size={12} />
            </IconButton>
          )}
        </HStack>
      </Box>

      {/* Undo countdown progress bar */}
      {isUndoToast && duration > 0 && (
        <Box
          className={styles.undoProgress}
          style={{ animationDuration: `${duration}ms` }}
        />
      )}
    </Box>
  );
}

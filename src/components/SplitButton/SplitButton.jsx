/**
 * SplitButton - Chakra UI Split Menu Button Component
 *
 * A reusable split button that combines a primary action button with a dropdown
 * menu for secondary actions. Built on Chakra UI's Menu, Group, and IconButton
 * primitives.
 *
 * Usage:
 * ```jsx
 * import SplitButton from '../../components/SplitButton/SplitButton';
 *
 * <SplitButton
 *   label="Update Profile"
 *   icon={<FaEdit />}
 *   onClick={() => navigate('/profile/update')}
 *   variant="outline"
 *   size="sm"
 *   rounded
 *   menuAriaLabel="Profile actions"
 *   placement="bottom-end"
 * >
 *   <SplitButton.Item value="photos" onClick={handlePhotos}>
 *     <FaCamera /> Manage Photos
 *   </SplitButton.Item>
 *   <SplitButton.Item value="settings" onClick={handleSettings}>
 *     <FaCog /> Settings
 *   </SplitButton.Item>
 * </SplitButton>
 * ```
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Menu, Portal } from '@chakra-ui/react';
import { LuChevronDown } from 'react-icons/lu';
import { Button } from '../design-system';
import styles from './SplitButton.module.scss';

/**
 * SplitButton - Primary action button with dropdown menu for secondary actions.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.label - Text label for the primary button
 * @param {React.ReactNode} [props.icon] - Optional icon rendered before the label
 * @param {Function} props.onClick - Click handler for the primary button
 * @param {string} [props.variant='outline'] - Design system Button variant (gradient, outline, light, etc.)
 * @param {string} [props.size='sm'] - Design system Button size (xs, sm, md, lg, xl)
 * @param {boolean} [props.rounded=false] - Apply pill-shaped border radius
 * @param {string} [props.menuAriaLabel='More actions'] - Accessible label for the dropdown trigger
 * @param {string} [props.placement='bottom-end'] - Menu positioning placement
 * @param {boolean} [props.disabled=false] - Disable the entire split button
 * @param {string} [props.className] - Additional CSS class for the root wrapper
 * @param {React.ReactNode} props.children - Menu.Item children for the dropdown
 */
const SplitButton = ({
  label,
  icon,
  onClick,
  variant = 'outline',
  size = 'sm',
  rounded = false,
  menuAriaLabel = 'More actions',
  placement = 'bottom-end',
  disabled = false,
  className = '',
  children,
}) => {
  const radiusLeft = rounded
    ? 'var(--radius-full) 0 0 var(--radius-full)'
    : 'var(--btn-radius-default) 0 0 var(--btn-radius-default)';
  const radiusRight = rounded
    ? '0 var(--radius-full) var(--radius-full) 0'
    : '0 var(--btn-radius-default) var(--btn-radius-default) 0';

  return (
    <Menu.Root positioning={{ placement }}>
      <div className={`${styles.splitButtonGroup} ${className}`.trim()}>
        <Button
          variant={variant}
          size={size}
          style={{ borderRadius: radiusLeft, borderRight: 'none' }}
          onClick={onClick}
          disabled={disabled}
          className={styles.primaryButton}
        >
          {icon && <span className={styles.buttonIcon}>{icon}</span>}
          {label}
        </Button>
        <Menu.Trigger asChild>
          <Button
            variant={variant}
            size={size}
            aria-label={menuAriaLabel}
            disabled={disabled}
            style={{ borderRadius: radiusRight, borderLeft: 'none' }}
            className={styles.triggerButton}
          >
            <LuChevronDown />
          </Button>
        </Menu.Trigger>
      </div>
      <Portal>
        <Menu.Positioner>
          <Menu.Content className={styles.menuContent}>
            {children}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};

SplitButton.displayName = 'SplitButton';

SplitButton.propTypes = {
  label: PropTypes.node.isRequired,
  icon: PropTypes.node,
  onClick: PropTypes.func.isRequired,
  variant: PropTypes.oneOf(['gradient', 'outline', 'light', 'tertiary', 'link', 'danger', 'success']),
  size: PropTypes.oneOf(['xs', 'sm', 'md', 'lg', 'xl']),
  rounded: PropTypes.bool,
  menuAriaLabel: PropTypes.string,
  placement: PropTypes.string,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  children: PropTypes.node.isRequired,
};

/**
 * SplitButton.Item - Convenience alias for Menu.Item.
 * Accepts all Chakra Menu.Item props.
 */
SplitButton.Item = Menu.Item;

/**
 * SplitButton.Separator - Convenience alias for Menu.Separator.
 */
SplitButton.Separator = Menu.Separator;

export default SplitButton;

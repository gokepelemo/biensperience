/**
 * ActionsMenu - A reusable dropdown actions menu component
 *
 * This component provides a consistent UI for action menus throughout the app,
 * following the design system tokens for styling.
 *
 * @example
 * <ActionsMenu
 *   trigger={<BsThreeDotsVertical />}
 *   actions={[
 *     { id: 'edit', label: 'Edit', icon: <FaEdit />, onClick: handleEdit },
 *     { id: 'delete', label: 'Delete', icon: <FaTrash />, variant: 'danger', onClick: handleDelete },
 *   ]}
 * />
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { BsThreeDotsVertical } from 'react-icons/bs';
import styles from './ActionsMenu.module.scss';

/**
 * ActionsMenu component
 *
 * @param {Object} props
 * @param {React.ReactNode} props.trigger - Custom trigger element (defaults to three dots icon)
 * @param {Array} props.actions - Array of action objects
 * @param {string} props.actions[].id - Unique identifier for the action
 * @param {string} props.actions[].label - Display label for the action
 * @param {React.ReactNode} props.actions[].icon - Icon to display before label
 * @param {function} props.actions[].onClick - Click handler
 * @param {string} props.actions[].variant - Visual variant: 'default', 'danger', 'active'
 * @param {boolean} props.actions[].disabled - Whether action is disabled
 * @param {boolean} props.actions[].hidden - Whether to hide this action
 * @param {string} props.position - Menu position: 'bottom-right' (default), 'bottom-left'
 * @param {string} props.size - Size variant: 'sm', 'md' (default)
 * @param {string} props.ariaLabel - Accessibility label for trigger button
 * @param {string} props.className - Additional CSS class for container
 */
export default function ActionsMenu({
  trigger,
  actions = [],
  position = 'bottom-right',
  size = 'md',
  ariaLabel = 'Actions',
  className = '',
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  // Focus first menu item when opened
  useEffect(() => {
    if (isOpen && menuRef.current) {
      const firstItem = menuRef.current.querySelector('button:not([disabled])');
      if (firstItem) {
        firstItem.focus();
      }
    }
  }, [isOpen]);

  const handleToggle = useCallback(() => {
    if (!disabled) {
      setIsOpen(prev => !prev);
    }
  }, [disabled]);

  const handleActionClick = useCallback((action) => {
    if (action.disabled) return;

    setIsOpen(false);
    if (action.onClick) {
      action.onClick();
    }
  }, []);

  const handleKeyDown = useCallback((event, action, index) => {
    const visibleActions = actions.filter(a => !a.hidden);

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        const nextIndex = (index + 1) % visibleActions.length;
        menuRef.current?.querySelectorAll('button')[nextIndex]?.focus();
        break;
      case 'ArrowUp':
        event.preventDefault();
        const prevIndex = (index - 1 + visibleActions.length) % visibleActions.length;
        menuRef.current?.querySelectorAll('button')[prevIndex]?.focus();
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        handleActionClick(action);
        break;
      case 'Tab':
        setIsOpen(false);
        break;
      default:
        break;
    }
  }, [actions, handleActionClick]);

  // Filter out hidden actions
  const visibleActions = actions.filter(action => !action.hidden);

  if (visibleActions.length === 0) {
    return null;
  }

  const containerClasses = [
    styles.container,
    styles[`size-${size}`],
    className,
  ].filter(Boolean).join(' ');

  const menuClasses = [
    styles.menu,
    styles[`position-${position}`],
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClasses} ref={containerRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={ariaLabel}
        title={ariaLabel}
        disabled={disabled}
      >
        {trigger || <BsThreeDotsVertical />}
      </button>

      {isOpen && (
        <div
          className={menuClasses}
          role="menu"
          aria-orientation="vertical"
          ref={menuRef}
        >
          {visibleActions.map((action, index) => {
            const itemClasses = [
              styles.item,
              action.variant === 'danger' && styles.itemDanger,
              action.variant === 'active' && styles.itemActive,
              action.disabled && styles.itemDisabled,
            ].filter(Boolean).join(' ');

            return (
              <button
                key={action.id}
                type="button"
                className={itemClasses}
                onClick={() => handleActionClick(action)}
                onKeyDown={(e) => handleKeyDown(e, action, index)}
                disabled={action.disabled}
                role="menuitem"
                tabIndex={isOpen ? 0 : -1}
              >
                {action.icon && <span className={styles.icon}>{action.icon}</span>}
                <span className={styles.label}>{action.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

ActionsMenu.propTypes = {
  trigger: PropTypes.node,
  actions: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    icon: PropTypes.node,
    onClick: PropTypes.func,
    variant: PropTypes.oneOf(['default', 'danger', 'active']),
    disabled: PropTypes.bool,
    hidden: PropTypes.bool,
  })).isRequired,
  position: PropTypes.oneOf(['bottom-right', 'bottom-left']),
  size: PropTypes.oneOf(['sm', 'md']),
  ariaLabel: PropTypes.string,
  className: PropTypes.string,
  disabled: PropTypes.bool,
};

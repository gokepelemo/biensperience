/**
 * BottomNavLayout Component
 * Mobile layout with fixed bottom navigation.
 */

import React from 'react';
import PropTypes from 'prop-types';
import styles from './BottomNavLayout.module.scss';
import { lang } from '../../lang.constants';

/**
 * NavItem - Individual navigation item
 */
export function NavItem({
  icon,
  label,
  active = false,
  badge,
  onClick,
  href,
  className = '',
}) {
  const itemClasses = [
    styles.navItem,
    active && styles.active,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      <span className={styles.navIcon}>
        {icon}
        {badge !== undefined && badge !== null && (
          <span className={styles.navBadge}>{badge}</span>
        )}
      </span>
      {label && <span className={styles.navLabel}>{label}</span>}
    </>
  );

  if (href) {
    return (
      <a href={href} className={itemClasses} aria-current={active ? 'page' : undefined}>
        {content}
      </a>
    );
  }

  return (
    <button
      type="button"
      className={itemClasses}
      onClick={onClick}
      aria-pressed={active}
    >
      {content}
    </button>
  );
}

NavItem.propTypes = {
  icon: PropTypes.node.isRequired,
  label: PropTypes.string,
  active: PropTypes.bool,
  badge: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onClick: PropTypes.func,
  href: PropTypes.string,
  className: PropTypes.string,
};

/**
 * BottomNavLayout - Mobile layout with fixed bottom navigation
 *
 * @param {Object} props
 * @param {React.ReactNode} props.header - Optional header content
 * @param {React.ReactNode} props.children - Main scrollable content
 * @param {React.ReactNode} props.nav - Navigation items (NavItem components)
 * @param {boolean} props.hideNavOnScroll - Hide nav when scrolling down
 * @param {boolean} props.blurBackground - Apply blur effect to nav background
 * @param {string} props.className - Additional CSS classes
 */
export default function BottomNavLayout({
  header,
  children,
  nav,
  hideNavOnScroll = false,
  blurBackground = true,
  className = '',
}) {
  const containerClasses = [
    styles.bottomNavLayout,
    hideNavOnScroll && styles.hideOnScroll,
    blurBackground && styles.blurBg,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClasses}>
      {header && <header className={styles.header}>{header}</header>}

      <main className={styles.content}>{children}</main>

      <nav className={styles.bottomNav} aria-label={lang.current.bottomNavLayout.mainNavigation}>
        {nav}
      </nav>
    </div>
  );
}

BottomNavLayout.propTypes = {
  header: PropTypes.node,
  children: PropTypes.node.isRequired,
  nav: PropTypes.node.isRequired,
  hideNavOnScroll: PropTypes.bool,
  blurBackground: PropTypes.bool,
  className: PropTypes.string,
};

// Named export for sub-component
BottomNavLayout.NavItem = NavItem;

/**
 * NavigationBreadcrumb - Design System Breadcrumb Implementation
 *
 * Drop-in replacement for the Bootstrap-based Breadcrumb component.
 * Uses Breadcrumb primitives with built-in skeleton
 * loading states for layout-preserving loading indicators.
 *
 * Benefits:
 * - Semantic Breadcrumb.Root/List/Item/Link/CurrentLink/Separator structure
 * - Built-in ARIA attributes for accessibility
 * - Skeleton loading state via `loading` prop
 * - Consistent with other components in the design system
 *
 * Props API is backwards-compatible with the original Breadcrumb:
 * - items: Array of { label, href } objects for intermediate breadcrumb items
 * - currentPage: The current/active page name
 * - backTo: URL for mobile back-arrow navigation
 * - backLabel: Label for the mobile back link
 * - loading: When true, renders skeleton placeholders
 * - className: Additional CSS class
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { Breadcrumb } from '@chakra-ui/react';
import { FaHome, FaArrowLeft } from 'react-icons/fa';
import { Show, Hide } from '../Responsive';
import SkeletonLoader from '../SkeletonLoader/SkeletonLoader';
import styles from './Breadcrumb.module.css';

/**
 * Desktop skeleton breadcrumb using SkeletonLoader for visual consistency
 */
function BreadcrumbSkeleton({ className = '' }) {
  return (
    <nav className={`${styles.breadcrumbNav} ${className}`} aria-label="breadcrumb" aria-busy="true">
      <div className={styles.skeletonRow}>
        <SkeletonLoader variant="text" width="50px" height={14} />
        <span className={styles.skeletonSeparator}>{'\u2002/\u2002'}</span>
        <SkeletonLoader variant="text" width="100px" height={14} />
        <span className={styles.skeletonSeparator}>{'\u2002/\u2002'}</span>
        <SkeletonLoader variant="text" width="140px" height={14} />
      </div>
    </nav>
  );
}

/**
 * Mobile skeleton breadcrumb (back arrow placeholder)
 */
function MobileBreadcrumbSkeleton({ className = '' }) {
  return (
    <div className={`${styles.mobileBreadcrumb} ${className}`} aria-busy="true">
      <div className={styles.skeletonRow} style={{ gap: 'var(--space-2)' }}>
        <SkeletonLoader variant="text" width={14} height={14} />
        <SkeletonLoader variant="text" width="100px" height={14} />
      </div>
    </div>
  );
}

export default function NavigationBreadcrumb({
  items = [],
  currentPage = '',
  backTo = null,
  backLabel = '',
  loading = false,
  className = ''
}) {
  // Loading state: render skeletons
  if (loading) {
    return (
      <>
        <Hide on="mobile">
          <BreadcrumbSkeleton className={className} />
        </Hide>
        <Show on="mobile">
          <MobileBreadcrumbSkeleton className={className} />
        </Show>
      </>
    );
  }

  // Separator character matching the original design
  const separator = <span>/</span>;

  // Desktop: Full breadcrumb trail using Chakra UI Breadcrumb
  const renderDesktopBreadcrumbs = () => (
    <nav className={`${styles.breadcrumbNav} ${className}`} aria-label="breadcrumb">
      <Breadcrumb.Root size="sm" variant="plain">
        <Breadcrumb.List>
          {/* Home */}
          <Breadcrumb.Item>
            <Breadcrumb.Link asChild>
              <Link to="/">
                <FaHome size={12} style={{ marginRight: '4px' }} />
                Home
              </Link>
            </Breadcrumb.Link>
          </Breadcrumb.Item>
          <Breadcrumb.Separator>{separator}</Breadcrumb.Separator>

          {/* Intermediate items */}
          {items.map((item, index) => (
            <React.Fragment key={index}>
              <Breadcrumb.Item>
                {item.href ? (
                  <Breadcrumb.Link asChild>
                    <Link to={item.href}>{item.label}</Link>
                  </Breadcrumb.Link>
                ) : (
                  <Breadcrumb.CurrentLink>{item.label}</Breadcrumb.CurrentLink>
                )}
              </Breadcrumb.Item>
              {(currentPage || index < items.length - 1) && <Breadcrumb.Separator>{separator}</Breadcrumb.Separator>}
            </React.Fragment>
          ))}

          {/* Current page */}
          {currentPage && (
            <Breadcrumb.Item>
              <Breadcrumb.CurrentLink>{currentPage}</Breadcrumb.CurrentLink>
            </Breadcrumb.Item>
          )}
        </Breadcrumb.List>
      </Breadcrumb.Root>
    </nav>
  );

  // Mobile: Minimalist back arrow pattern
  // Note: Does NOT render currentPage as h1 - views have their own h1 that's
  // registered with registerH1() for navbar scroll integration
  const renderMobileBreadcrumbs = () => {
    const hasBackNavigation = backTo && backLabel;

    if (!hasBackNavigation) {
      return null;
    }

    return (
      <div className={`${styles.mobileBreadcrumb} ${className}`}>
        <Link to={backTo} className={styles.backLink}>
          <FaArrowLeft size={14} />
          <span className={styles.backLabel}>{backLabel}</span>
        </Link>
      </div>
    );
  };

  return (
    <>
      {/* Desktop breadcrumbs */}
      <Hide on="mobile">
        {renderDesktopBreadcrumbs()}
      </Hide>

      {/* Mobile breadcrumbs */}
      <Show on="mobile">
        {renderMobileBreadcrumbs()}
      </Show>
    </>
  );
}

NavigationBreadcrumb.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string.isRequired,
    href: PropTypes.string
  })),
  currentPage: PropTypes.string,
  backTo: PropTypes.string,
  backLabel: PropTypes.string,
  loading: PropTypes.bool,
  className: PropTypes.string
};

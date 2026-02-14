/**
 * Responsive Breadcrumb Component
 * Shows full breadcrumb trail on desktop, minimalist back arrow pattern on mobile
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaHome, FaArrowLeft } from 'react-icons/fa';
import { Breadcrumb as BootstrapBreadcrumb } from 'react-bootstrap';
import { Show, Hide } from '../Responsive';
import styles from './Breadcrumb.module.scss';

export default function Breadcrumb({
  items = [],
  currentPage = '',
  backTo = null,
  backLabel = '',
  className = ''
}) {
  // Desktop: Full breadcrumb trail
  const renderDesktopBreadcrumbs = () => (
    <nav className={`${styles.breadcrumbNav} ${className}`} aria-label="breadcrumb">
      <BootstrapBreadcrumb>
        <BootstrapBreadcrumb.Item linkAs={Link} linkProps={{ to: "/" }}>
          <FaHome size={12} style={{ marginRight: '4px' }} />
          Home
        </BootstrapBreadcrumb.Item>
        {items.map((item, index) => (
          <BootstrapBreadcrumb.Item
            key={index}
            linkAs={item.href ? Link : undefined}
            linkProps={item.href ? { to: item.href } : undefined}
            active={!item.href}
          >
            {item.label}
          </BootstrapBreadcrumb.Item>
        ))}
        {currentPage && (
          <BootstrapBreadcrumb.Item active>
            {currentPage}
          </BootstrapBreadcrumb.Item>
        )}
      </BootstrapBreadcrumb>
    </nav>
  );

  // Mobile: Minimalist back arrow pattern
  // Note: Does NOT render currentPage as h1 - views have their own h1 that's
  // registered with registerH1() for navbar scroll integration
  const renderMobileBreadcrumbs = () => {
    const hasBackNavigation = backTo && backLabel;

    if (!hasBackNavigation) {
      return null; // No mobile breadcrumb if no back navigation
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
/**
 * CollapsibleSectionLayout Component
 * Accordion-style sections for organizing content.
 */

import React, { useState, useCallback, useId } from 'react';
import PropTypes from 'prop-types';
import { FaChevronDown } from 'react-icons/fa';
import styles from './CollapsibleSectionLayout.module.scss';

/**
 * Section - Individual collapsible section
 */
export function Section({
  title,
  subtitle,
  badge,
  icon,
  children,
  defaultExpanded = false,
  disabled = false,
  className = '',
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const contentId = useId();

  const toggleExpanded = useCallback(() => {
    if (!disabled) {
      setIsExpanded((prev) => !prev);
    }
  }, [disabled]);

  const sectionClasses = [
    styles.section,
    isExpanded && styles.expanded,
    disabled && styles.disabled,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={sectionClasses}>
      <button
        type="button"
        className={styles.sectionHeader}
        onClick={toggleExpanded}
        aria-expanded={isExpanded}
        aria-controls={contentId}
        aria-disabled={disabled}
      >
        <div className={styles.sectionTitleGroup}>
          {icon && <span className={styles.sectionIcon}>{icon}</span>}
          <div className={styles.sectionTitles}>
            <span className={styles.sectionTitle}>{title}</span>
            {subtitle && <span className={styles.sectionSubtitle}>{subtitle}</span>}
          </div>
        </div>
        <div className={styles.sectionActions}>
          {badge !== undefined && badge !== null && (
            <span className={styles.sectionBadge}>{badge}</span>
          )}
          <FaChevronDown
            className={styles.chevron}
            aria-hidden="true"
          />
        </div>
      </button>
      <div
        id={contentId}
        className={styles.sectionContent}
        aria-hidden={!isExpanded}
      >
        <div className={styles.sectionContentInner}>{children}</div>
      </div>
    </div>
  );
}

Section.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  badge: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  icon: PropTypes.node,
  children: PropTypes.node.isRequired,
  defaultExpanded: PropTypes.bool,
  disabled: PropTypes.bool,
  className: PropTypes.string,
};

/**
 * CollapsibleSectionLayout - Container for accordion sections
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Section components
 * @param {boolean} props.allowMultiple - Allow multiple sections open at once
 * @param {boolean} props.bordered - Show borders between sections
 * @param {boolean} props.elevated - Add shadow elevation
 * @param {string} props.className - Additional CSS classes
 */
export default function CollapsibleSectionLayout({
  children,
  allowMultiple = true,
  bordered = true,
  elevated = false,
  className = '',
}) {
  const containerClasses = [
    styles.collapsibleLayout,
    bordered && styles.bordered,
    elevated && styles.elevated,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // Note: For single-accordion mode (allowMultiple=false),
  // you would need to lift state up and control expansion from here.
  // Current implementation allows each section to manage its own state.

  return (
    <div className={containerClasses} data-allow-multiple={allowMultiple}>
      {children}
    </div>
  );
}

CollapsibleSectionLayout.propTypes = {
  children: PropTypes.node.isRequired,
  allowMultiple: PropTypes.bool,
  bordered: PropTypes.bool,
  elevated: PropTypes.bool,
  className: PropTypes.string,
};

// Named export for sub-component
CollapsibleSectionLayout.Section = Section;

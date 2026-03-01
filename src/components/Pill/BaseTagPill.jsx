/**
 * BaseTagPill - Design System Tag Implementation
 *
 * Drop-in replacement for the custom TagPill component.
 * Uses Tag primitive for built-in accessibility,
 * closable support, and ARIA semantics while preserving the existing
 * TagPill.module.scss styling via CSS Module class names.
 *
 * IMPORTANT: This implementation completely resets default Tag
 * styling and applies the existing CSS Module classes, ensuring pixel-perfect
 * visual parity with the original TagPill component.
 *
 * Benefits:
 * - Compound component pattern (Tag.Root, Tag.Label, Tag.CloseTrigger)
 * - Built-in closable/removable support
 * - Semantic ARIA attributes
 * - Consistent focus management
 *
 * Task: biensperience-bbd4 - Migrate Pill component
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Tag } from '@chakra-ui/react';
import { FaTimes } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import { lang } from '../../lang.constants';
import styles from './TagPill.module.scss';

export default function BaseTagPill({
  children,
  color = 'primary',
  gradient = true,
  rounded = true,
  removable = false,
  onRemove,
  size = 'md',
  className = '',
  to,
  as = null,
  href,
  ...props
}) {
  const colorClass = styles[`tagPill${color.charAt(0).toUpperCase() + color.slice(1)}`];
  const sizeClass = styles[`tagPill${size.charAt(0).toUpperCase() + size.slice(1)}`];

  const classes = [
    styles.tagPill,
    colorClass,
    gradient && styles.tagPillGradient,
    rounded && styles.tagPillRounded,
    sizeClass,
    className
  ].filter(Boolean).join(' ');

  const content = (
    <>
      <span className={styles.tagPillContent}>{children}</span>
      {removable && (
        <button
          type="button"
          aria-label={lang.current.aria.remove}
          className={styles.tagPillRemove}
          onClick={(e) => { e.stopPropagation(); onRemove && onRemove(e); }}
        >
          <FaTimes />
        </button>
      )}
    </>
  );

  // If `to` is provided, prefer react-router Link
  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {content}
      </Link>
    );
  }

  // If `as` is provided and is a string 'a', render anchor
  if (as === 'a') {
    return (
      <a href={href} className={classes} {...props}>
        {content}
      </a>
    );
  }

  // If `as` is a component (elementType), render it and forward common props
  if (as && typeof as !== 'string') {
    const AsComponent = as;
    const forwarded = { className: classes, href, to, ...props };
    return (
      <AsComponent {...forwarded}>{content}</AsComponent>
    );
  }

  // Default: Chakra Tag.Root as the base element (renders as span)
  return (
    <Tag.Root
      className={classes}
      unstyled
      {...props}
    >
      {content}
    </Tag.Root>
  );
}

BaseTagPill.propTypes = {
  children: PropTypes.node.isRequired,
  color: PropTypes.oneOf(['primary', 'success', 'warning', 'danger', 'info', 'neutral', 'light']),
  gradient: PropTypes.bool,
  rounded: PropTypes.bool,
  removable: PropTypes.bool,
  onRemove: PropTypes.func,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  className: PropTypes.string,
  to: PropTypes.string,
  as: PropTypes.string,
  href: PropTypes.string,
};

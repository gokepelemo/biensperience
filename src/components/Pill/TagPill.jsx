import React from 'react';
import PropTypes from 'prop-types';
import { FaTimes } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import styles from './TagPill.module.scss';

export default function TagPill({
  children,
  color = 'primary',
  gradient = true,
  rounded = true,
  removable = false,
  onRemove,
  size = 'md',
  className = '',
  to, // react-router Link target (convenience)
  as = null, // either a string like 'a' or a component (elementType)
  href, // anchor href
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
          aria-label="remove"
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

  // Default: span
  return (
    <span className={classes} {...props}>
      {content}
    </span>
  );
}

TagPill.propTypes = {
  children: PropTypes.node.isRequired,
  color: PropTypes.oneOf(['primary','success','warning','danger','info','neutral','light']),
  gradient: PropTypes.bool,
  rounded: PropTypes.bool,
  removable: PropTypes.bool,
  onRemove: PropTypes.func,
  size: PropTypes.oneOf(['sm','md','lg']),
  className: PropTypes.string,
  to: PropTypes.string,
  as: PropTypes.string,
  href: PropTypes.string,
};

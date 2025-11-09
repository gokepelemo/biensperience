import React from 'react';
import PropTypes from 'prop-types';
import { FaTimes } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import './TagPill.css';

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
  const classes = [
    'tag-pill',
    `tag-pill-${color}`,
    gradient && 'tag-pill-gradient',
    rounded && 'tag-pill-rounded',
    `tag-pill-${size}`,
    className
  ].filter(Boolean).join(' ');

  const content = (
    <>
      <span className="tag-pill-content">{children}</span>
      {removable && (
        <button
          type="button"
          aria-label="remove"
          className="tag-pill-remove"
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
  color: PropTypes.oneOf(['primary','success','warning','danger','info','neutral']),
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

/**
 * BaseCard – Native Chakra UI v3 Card compound component
 *
 * Uses the `card` slotRecipe from ui-theme.js (elevated/outline/subtle/unstyled,
 * sm/md/lg).  No `unstyled` prop — the recipe owns all visual styling.
 *
 * Sub-components:
 *   BaseCard (Root), BaseCardHeader, BaseCardBody, BaseCardFooter,
 *   BaseCardTitle, BaseCardDescription
 *
 * Migrated: P2.10 — biensperience-44ac
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Card as CardPrimitive } from '@chakra-ui/react';

/* ── Root ───────────────────────────────────────────────────────────── */

function BaseCard({
  children,
  variant = 'elevated',
  size = 'md',
  className = '',
  style = {},
  ...props
}) {
  return (
    <CardPrimitive.Root
      variant={variant}
      size={size}
      className={className || undefined}
      style={style}
      {...props}
    >
      {children}
    </CardPrimitive.Root>
  );
}

BaseCard.propTypes = {
  children: PropTypes.node,
  variant: PropTypes.oneOf(['elevated', 'outline', 'subtle', 'unstyled']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  className: PropTypes.string,
  style: PropTypes.object,
};

/* ── Header ─────────────────────────────────────────────────────────── */

function BaseCardHeader({ children, className = '', ...props }) {
  return (
    <CardPrimitive.Header className={className || undefined} {...props}>
      {children}
    </CardPrimitive.Header>
  );
}

BaseCardHeader.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
};

/* ── Body ───────────────────────────────────────────────────────────── */

function BaseCardBody({ children, className = '', ...props }) {
  return (
    <CardPrimitive.Body className={className || undefined} {...props}>
      {children}
    </CardPrimitive.Body>
  );
}

BaseCardBody.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
};

/* ── Footer ─────────────────────────────────────────────────────────── */

function BaseCardFooter({ children, className = '', ...props }) {
  return (
    <CardPrimitive.Footer className={className || undefined} {...props}>
      {children}
    </CardPrimitive.Footer>
  );
}

BaseCardFooter.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
};

/* ── Title ──────────────────────────────────────────────────────────── */

function BaseCardTitle({ children, className = '', ...props }) {
  return (
    <CardPrimitive.Title className={className || undefined} {...props}>
      {children}
    </CardPrimitive.Title>
  );
}

BaseCardTitle.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
};

/* ── Description ────────────────────────────────────────────────────── */

function BaseCardDescription({ children, className = '', ...props }) {
  return (
    <CardPrimitive.Description className={className || undefined} {...props}>
      {children}
    </CardPrimitive.Description>
  );
}

BaseCardDescription.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
};

/* ── Compound pattern ───────────────────────────────────────────────── */

BaseCard.Header = BaseCardHeader;
BaseCard.Body = BaseCardBody;
BaseCard.Footer = BaseCardFooter;
BaseCard.Title = BaseCardTitle;
BaseCard.Description = BaseCardDescription;
BaseCard.Text = BaseCardDescription; // react-bootstrap compat alias

export default BaseCard;
export {
  BaseCard,
  BaseCardHeader,
  BaseCardBody,
  BaseCardFooter,
  BaseCardTitle,
  BaseCardDescription,
};

/**
 * BaseCard - Design System Card Implementation
 *
 * Drop-in replacement for react-bootstrap Card component.
 * Uses Chakra Card compound component for built-in accessibility
 * while preserving existing CSS Module styling via className props.
 *
 * IMPORTANT: Uses `unstyled` prop to completely reset Chakra default
 * styling, allowing CSS Modules to be the sole source of visual styling.
 *
 * Sub-components: BaseCard (Root), BaseCardHeader, BaseCardBody, BaseCardFooter,
 *                 BaseCardTitle, BaseCardDescription
 *
 * Benefits:
 * - Semantic HTML structure
 * - Built-in ARIA attributes
 * - Consistent focus management
 * - Polymorphic `as` prop
 *
 * Task: biensperience-9abe
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Card as CardPrimitive } from '@chakra-ui/react';

/**
 * BaseCard - Chakra Card.Root with unstyled reset
 *
 * Maps to react-bootstrap `<Card>`. Accepts className and style for CSS Module styling.
 */
function BaseCard({ children, className = '', style = {}, ...props }) {
  return (
    <CardPrimitive.Root
      className={className}
      style={style}
      unstyled
      {...props}
    >
      {children}
    </CardPrimitive.Root>
  );
}

BaseCard.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  style: PropTypes.object,
};

/**
 * BaseCardHeader - Chakra Card.Header
 *
 * Maps to react-bootstrap `<Card.Header>`.
 */
function BaseCardHeader({ children, className = '', ...props }) {
  return (
    <CardPrimitive.Header className={className} {...props}>
      {children}
    </CardPrimitive.Header>
  );
}

BaseCardHeader.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
};

/**
 * BaseCardBody - Chakra Card.Body
 *
 * Maps to react-bootstrap `<Card.Body>`.
 */
function BaseCardBody({ children, className = '', ...props }) {
  return (
    <CardPrimitive.Body className={className} {...props}>
      {children}
    </CardPrimitive.Body>
  );
}

BaseCardBody.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
};

/**
 * BaseCardFooter - Chakra Card.Footer
 *
 * Maps to react-bootstrap `<Card.Footer>`.
 */
function BaseCardFooter({ children, className = '', ...props }) {
  return (
    <CardPrimitive.Footer className={className} {...props}>
      {children}
    </CardPrimitive.Footer>
  );
}

BaseCardFooter.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
};

/**
 * BaseCardTitle - Chakra Card.Title
 *
 * Maps to react-bootstrap `<Card.Title>`.
 */
function BaseCardTitle({ children, className = '', ...props }) {
  return (
    <CardPrimitive.Title className={className} {...props}>
      {children}
    </CardPrimitive.Title>
  );
}

BaseCardTitle.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
};

/**
 * BaseCardDescription - Chakra Card.Description
 *
 * Maps to react-bootstrap `<Card.Text>`.
 */
function BaseCardDescription({ children, className = '', ...props }) {
  return (
    <CardPrimitive.Description className={className} {...props}>
      {children}
    </CardPrimitive.Description>
  );
}

BaseCardDescription.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
};

// Attach sub-components for compound component pattern
// Allows both: <Card.Body> and <CardBody> usage
BaseCard.Header = BaseCardHeader;
BaseCard.Body = BaseCardBody;
BaseCard.Footer = BaseCardFooter;
BaseCard.Title = BaseCardTitle;
BaseCard.Description = BaseCardDescription;
BaseCard.Text = BaseCardDescription; // Alias for react-bootstrap compat

export default BaseCard;
export {
  BaseCard,
  BaseCardHeader,
  BaseCardBody,
  BaseCardFooter,
  BaseCardTitle,
  BaseCardDescription
};

import React from 'react';
import RBAccordion from 'react-bootstrap/Accordion';
import './Accordion.scss';

// Thin wrapper around react-bootstrap Accordion that applies design-system styles
const Accordion = ({ className = '', children, ...props }) => (
  <RBAccordion className={`ds-accordion ${className}`} {...props}>
    {children}
  </RBAccordion>
);

// Re-export subcomponents so callers can use Accordion.Item / Header / Body
Accordion.Item = RBAccordion.Item;
Accordion.Header = RBAccordion.Header;
Accordion.Body = RBAccordion.Body;

export default Accordion;

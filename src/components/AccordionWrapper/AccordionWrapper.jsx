/**
 * Accordion Abstraction Layer
 *
 * Provides a stable API for Accordion usage across the application.
 * All accordion consumers should import from design-system, NOT directly from Accordion.
 *
 * Implementation: Chakra UI Accordion (BaseAccordion) — Phase 5 complete.
 *
 * Task: biensperience-7d07
 * Related: biensperience-081e (Phase 5), biensperience-6ba4 (umbrella)
 */

import PropTypes from 'prop-types';
import BaseAccordion from '../Accordion/BaseAccordion';

/**
 * AccordionWrapper - Design System Accordion
 */
function AccordionWrapper(props) {
  return <BaseAccordion {...props} />;
}

AccordionWrapper.displayName = 'Accordion';

AccordionWrapper.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node,
  defaultActiveKey: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.number]))
  ]),
};

// Wrapper components for subcomponents
function AccordionItemWrapper(props) {
  return <BaseAccordion.Item {...props} />;
}

AccordionItemWrapper.displayName = 'Accordion.Item';

function AccordionHeaderWrapper(props) {
  return <BaseAccordion.Header {...props} />;
}

AccordionHeaderWrapper.displayName = 'Accordion.Header';

function AccordionBodyWrapper(props) {
  return <BaseAccordion.Body {...props} />;
}

AccordionBodyWrapper.displayName = 'Accordion.Body';

// Attach subcomponents to main component
AccordionWrapper.Item = AccordionItemWrapper;
AccordionWrapper.Header = AccordionHeaderWrapper;
AccordionWrapper.Body = AccordionBodyWrapper;

export default AccordionWrapper;

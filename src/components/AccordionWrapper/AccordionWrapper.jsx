/**
 * Accordion Abstraction Layer
 *
 * This component provides a stable API for Accordion usage across the application.
 * It wraps either the react-bootstrap Accordion or the modern Accordion implementation,
 * controlled by component-specific feature flags.
 *
 * CRITICAL: This abstraction enables zero-regression migration between implementations.
 * All accordion consumers should import from design-system, NOT directly from Accordion.
 *
 * Implementation Status:
 * - Phase 1: React-Bootstrap Accordion (completed)
 * - Phase 2: Feature-flagged modern (completed) Accordion
 * - Phase 3: modern Accordion validation (completed)
 * - Phase 4 (Current): modern Accordion is default; legacy available via 'bootstrap_accordion' flag
 * - Phase 5: Remove legacy implementation (after validation period)
 *
 * API Stability Guarantee:
 * - Props interface is stable and will not change
 * - All consumers can import { Accordion } from 'design-system'
 * - Implementation swap is transparent to consumers
 *
 * Task: biensperience-7d07
 * Related: biensperience-081e (Phase 5), biensperience-6ba4 (umbrella)
 */

import PropTypes from 'prop-types';
import Accordion from '../Accordion/Accordion';
import BaseAccordion from '../Accordion/BaseAccordion';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';

/**
 * AccordionWrapper - Design System Abstraction for Accordion
 *
 * Uses the accessible Accordion implementation by default,
 * falls back to the react-bootstrap Accordion when 'bootstrap_accordion' flag is enabled.
 */
function AccordionWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_accordion');
  const AccordionComponent = useLegacy ? Accordion : BaseAccordion;
  return <AccordionComponent {...props} />;
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
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_accordion');
  const ItemComponent = !useLegacy ? BaseAccordion.Item : Accordion.Item;
  return <ItemComponent {...props} />;
}

AccordionItemWrapper.displayName = 'Accordion.Item';

function AccordionHeaderWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_accordion');
  const HeaderComponent = !useLegacy ? BaseAccordion.Header : Accordion.Header;
  return <HeaderComponent {...props} />;
}

AccordionHeaderWrapper.displayName = 'Accordion.Header';

function AccordionBodyWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_accordion');
  const BodyComponent = !useLegacy ? BaseAccordion.Body : Accordion.Body;
  return <BodyComponent {...props} />;
}

AccordionBodyWrapper.displayName = 'Accordion.Body';

// Attach subcomponents to main component
AccordionWrapper.Item = AccordionItemWrapper;
AccordionWrapper.Header = AccordionHeaderWrapper;
AccordionWrapper.Body = AccordionBodyWrapper;

export default AccordionWrapper;

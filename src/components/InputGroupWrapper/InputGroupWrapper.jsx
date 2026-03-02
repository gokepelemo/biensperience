/**
 * InputGroup Abstraction Layer
 *
 * Provides a stable API for InputGroup usage across the application.
 * Implementation: Chakra UI InputGroup (BaseInputGroup) — Phase 5 complete.
 *
 * Task: biensperience-b5e8
 * Related: biensperience-e5c4 (epic)
 */

import PropTypes from 'prop-types';
import BaseInputGroup, { BaseInputGroupText } from '../InputGroup/BaseInputGroup';

/**
 * InputGroupWrapper - Design System InputGroup
 */
export function InputGroupWrapper(props) {
  return <BaseInputGroup {...props} />;
}

InputGroupWrapper.displayName = 'InputGroup';

InputGroupWrapper.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
};

/**
 * InputGroupTextWrapper
 */
export function InputGroupTextWrapper(props) {
  return <BaseInputGroupText {...props} />;
}

InputGroupTextWrapper.displayName = 'InputGroup.Text';
InputGroupTextWrapper.propTypes = { children: PropTypes.node, className: PropTypes.string };

// Compound sub-component
InputGroupWrapper.Text = InputGroupTextWrapper;

export default InputGroupWrapper;

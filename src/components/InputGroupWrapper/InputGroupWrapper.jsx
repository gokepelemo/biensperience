/**
 * InputGroup Abstraction Layer
 *
 * Provides a stable API for InputGroup usage across the application.
 * Wraps either the react-bootstrap InputGroup or the modern BaseInputGroup (Chakra),
 * controlled by the 'bootstrap_inputgroup' feature flag.
 *
 * Task: biensperience-b5e8
 * Related: biensperience-e5c4 (epic)
 */

import PropTypes from 'prop-types';
import { InputGroup as RBInputGroup } from 'react-bootstrap';
import BaseInputGroup, { BaseInputGroupText } from '../InputGroup/BaseInputGroup';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';

/**
 * InputGroupWrapper - Design System Abstraction for InputGroup
 */
export function InputGroupWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_inputgroup');
  const Component = useLegacy ? RBInputGroup : BaseInputGroup;
  return <Component {...props} />;
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
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_inputgroup');
  const Component = useLegacy ? RBInputGroup.Text : BaseInputGroupText;
  return <Component {...props} />;
}

InputGroupTextWrapper.displayName = 'InputGroup.Text';
InputGroupTextWrapper.propTypes = { children: PropTypes.node, className: PropTypes.string };

// Compound sub-component
InputGroupWrapper.Text = InputGroupTextWrapper;

export default InputGroupWrapper;

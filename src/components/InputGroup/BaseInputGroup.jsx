/**
 * BaseInputGroup - Design System InputGroup Implementation
 *
 * Drop-in replacement for react-bootstrap InputGroup component.
 * Uses Chakra Group component for layout while preserving
 * existing CSS Module styling via className props.
 *
 * IMPORTANT: Uses `unstyled` approach — Chakra Group is minimal by default,
 * so CSS Modules remain the sole source of visual styling.
 *
 * Sub-components: BaseInputGroup (Root), BaseInputGroupText (addon)
 *
 * Task: biensperience-b5e8
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Group, chakra } from '@chakra-ui/react';

const StyledAddon = chakra('span');

/**
 * BaseInputGroup - Chakra Group wrapper
 *
 * Maps to react-bootstrap `<InputGroup>`. Wraps form controls with optional addons.
 */
function BaseInputGroup({ children, className = '', style = {}, ...props }) {
  return (
    <Group className={className} style={style} {...props}>
      {children}
    </Group>
  );
}

BaseInputGroup.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  style: PropTypes.object,
};

/**
 * BaseInputGroupText - Addon text/icon for InputGroup
 *
 * Maps to react-bootstrap `<InputGroup.Text>`.
 */
function BaseInputGroupText({ children, className = '', ...props }) {
  return (
    <StyledAddon className={className} {...props}>
      {children}
    </StyledAddon>
  );
}

BaseInputGroupText.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
};

// Compound component pattern
BaseInputGroup.Text = BaseInputGroupText;

export default BaseInputGroup;
export { BaseInputGroup, BaseInputGroupText };

/**
 * ListGroup Abstraction Layer
 *
 * Provides a stable API for ListGroup usage across the application.
 * Implementation: Chakra UI ListGroup (BaseListGroup) — Phase 5 complete.
 *
 * Task: biensperience-d847
 * Related: biensperience-e5c4 (epic)
 */

import PropTypes from 'prop-types';
import BaseListGroup, { BaseListGroupItem } from '../ListGroup/BaseListGroup';

/**
 * ListGroupWrapper - Design System ListGroup
 */
export function ListGroupWrapper(props) {
  return <BaseListGroup {...props} />;
}

ListGroupWrapper.displayName = 'ListGroup';

ListGroupWrapper.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  as: PropTypes.elementType,
};

/**
 * ListGroupItemWrapper
 */
export function ListGroupItemWrapper(props) {
  return <BaseListGroupItem {...props} />;
}

ListGroupItemWrapper.displayName = 'ListGroup.Item';

ListGroupItemWrapper.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  action: PropTypes.bool,
  active: PropTypes.bool,
  disabled: PropTypes.bool,
  variant: PropTypes.string,
  as: PropTypes.elementType,
  onClick: PropTypes.func,
};

// Compound sub-component
ListGroupWrapper.Item = ListGroupItemWrapper;

export default ListGroupWrapper;

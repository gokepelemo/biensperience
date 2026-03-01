/**
 * ListGroup Abstraction Layer
 *
 * Provides a stable API for ListGroup usage across the application.
 * Wraps either the react-bootstrap ListGroup or the modern BaseListGroup (Chakra),
 * controlled by the 'bootstrap_listgroup' feature flag.
 *
 * Task: biensperience-d847
 * Related: biensperience-e5c4 (epic)
 */

import PropTypes from 'prop-types';
import { ListGroup as RBListGroup } from 'react-bootstrap';
import BaseListGroup, { BaseListGroupItem } from '../ListGroup/BaseListGroup';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';

/**
 * ListGroupWrapper - Design System Abstraction for ListGroup
 */
export function ListGroupWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_listgroup');
  const Component = useLegacy ? RBListGroup : BaseListGroup;
  return <Component {...props} />;
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
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_listgroup');
  const Component = useLegacy ? RBListGroup.Item : BaseListGroupItem;
  return <Component {...props} />;
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

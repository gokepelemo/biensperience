/**
 * Utility for flattening hierarchical plan items for rendering.
 *
 * @param {Object} options
 *   - expandedParents: Set of expanded parent keys
 *   - animatingCollapse: key of parent currently animating collapse
 *   - getExpansionKey: function to get canonical expansion key for an item
 *   - getCanonicalParentKey: function to get canonical parent key for an item
 * @returns {function} flattenPlanItems(items): Array<{...item, isChild, isVisible, parentKey}>
 */
export function createFlattenPlanItems({ expandedParents, animatingCollapse, getExpansionKey, getCanonicalParentKey }) {
  return function flattenPlanItems(items) {
    const result = [];
    const addItem = (item, isChild = false) => {
      const parentKey = getCanonicalParentKey(item);
      const isVisible =
        !isChild ||
        (expandedParents.has(parentKey) && animatingCollapse !== parentKey);
      result.push({ ...item, isChild, isVisible, parentKey });

      const itemKey = getExpansionKey(item);
      items
        .filter(
          (sub) =>
            sub.parent &&
            getCanonicalParentKey(sub) === itemKey
        )
        .forEach((sub) => addItem(sub, true));
    };
    items
      .filter((item) => !item.parent)
      .forEach((item) => addItem(item, false));
    return result;
  };
}

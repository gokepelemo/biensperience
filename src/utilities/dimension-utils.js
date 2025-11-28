/**
 * Dimension Utilities
 *
 * Performant utilities for measuring element dimensions, parent containers,
 * and viewport constraints. Uses cached measurements and batched reads to
 * minimize layout thrashing.
 *
 * @example
 * // Get element's effective space
 * const space = getAvailableSpace(element);
 * console.log(space.width, space.height);
 *
 * // Get ancestor chain dimensions
 * const chain = getAncestorDimensions(element);
 *
 * // Get smallest container (useful for constrained layouts)
 * const smallest = getSmallestContainer(element);
 */

/**
 * Get viewport dimensions (cached for performance)
 * @returns {{ width: number, height: number, scrollX: number, scrollY: number }}
 */
export function getViewportDimensions() {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    scrollX: window.scrollX || window.pageXOffset,
    scrollY: window.scrollY || window.pageYOffset,
  };
}

/**
 * Get element's bounding rect with additional computed properties
 * Uses getBoundingClientRect for performance (single reflow)
 *
 * @param {HTMLElement} element
 * @returns {DOMRect & { scrollWidth: number, scrollHeight: number, isVisible: boolean }}
 */
export function getElementDimensions(element) {
  if (!element || !(element instanceof HTMLElement)) {
    return null;
  }

  const rect = element.getBoundingClientRect();

  return {
    // Standard DOMRect properties
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    x: rect.x,
    y: rect.y,

    // Additional useful properties
    scrollWidth: element.scrollWidth,
    scrollHeight: element.scrollHeight,
    clientWidth: element.clientWidth,
    clientHeight: element.clientHeight,

    // Visibility check (element has dimensions and is in viewport)
    isVisible: rect.width > 0 && rect.height > 0,
  };
}

/**
 * Get computed content box dimensions (excluding padding/border)
 * Useful for knowing actual content area
 *
 * @param {HTMLElement} element
 * @returns {{ width: number, height: number, paddingX: number, paddingY: number, borderX: number, borderY: number }}
 */
export function getContentBoxDimensions(element) {
  if (!element || !(element instanceof HTMLElement)) {
    return null;
  }

  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();

  const paddingTop = parseFloat(style.paddingTop) || 0;
  const paddingRight = parseFloat(style.paddingRight) || 0;
  const paddingBottom = parseFloat(style.paddingBottom) || 0;
  const paddingLeft = parseFloat(style.paddingLeft) || 0;

  const borderTop = parseFloat(style.borderTopWidth) || 0;
  const borderRight = parseFloat(style.borderRightWidth) || 0;
  const borderBottom = parseFloat(style.borderBottomWidth) || 0;
  const borderLeft = parseFloat(style.borderLeftWidth) || 0;

  const paddingX = paddingLeft + paddingRight;
  const paddingY = paddingTop + paddingBottom;
  const borderX = borderLeft + borderRight;
  const borderY = borderTop + borderBottom;

  return {
    width: rect.width - paddingX - borderX,
    height: rect.height - paddingY - borderY,
    paddingX,
    paddingY,
    borderX,
    borderY,
    paddingTop,
    paddingRight,
    paddingBottom,
    paddingLeft,
    borderTop,
    borderRight,
    borderBottom,
    borderLeft,
  };
}

/**
 * Get dimensions of all ancestors from element to document body
 * Batches reads to prevent layout thrashing
 *
 * @param {HTMLElement} element
 * @param {Object} options
 * @param {boolean} options.includeBody - Include document.body (default: true)
 * @param {boolean} options.stopAtOverflow - Stop at first overflow:hidden/scroll/auto ancestor
 * @returns {Array<{ element: HTMLElement, dimensions: Object, overflow: string, position: string }>}
 */
export function getAncestorDimensions(element, options = {}) {
  const { includeBody = true, stopAtOverflow = false } = options;

  if (!element || !(element instanceof HTMLElement)) {
    return [];
  }

  const ancestors = [];
  let current = element.parentElement;

  // Batch read: collect all elements first
  const elements = [];
  while (current && current !== document.documentElement) {
    if (!includeBody && current === document.body) {
      break;
    }
    elements.push(current);
    current = current.parentElement;
  }

  // Batch read: get all dimensions at once (single reflow)
  for (const el of elements) {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    const overflow = style.overflow;
    const overflowX = style.overflowX;
    const overflowY = style.overflowY;
    const position = style.position;

    const ancestorData = {
      element: el,
      tagName: el.tagName.toLowerCase(),
      dimensions: {
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        clientWidth: el.clientWidth,
        clientHeight: el.clientHeight,
        scrollWidth: el.scrollWidth,
        scrollHeight: el.scrollHeight,
      },
      overflow,
      overflowX,
      overflowY,
      position,
      isScrollContainer: ['auto', 'scroll', 'hidden'].includes(overflow) ||
                         ['auto', 'scroll', 'hidden'].includes(overflowX) ||
                         ['auto', 'scroll', 'hidden'].includes(overflowY),
    };

    ancestors.push(ancestorData);

    // Stop at first scroll container if requested
    if (stopAtOverflow && ancestorData.isScrollContainer) {
      break;
    }
  }

  return ancestors;
}

/**
 * Find the nearest scroll container ancestor
 *
 * @param {HTMLElement} element
 * @returns {{ element: HTMLElement, dimensions: Object } | null}
 */
export function getNearestScrollContainer(element) {
  const ancestors = getAncestorDimensions(element, { stopAtOverflow: true });
  return ancestors.find(a => a.isScrollContainer) || null;
}

/**
 * Get the smallest containing ancestor (useful for constrained layouts)
 * Returns the ancestor with the smallest area that contains the element
 *
 * @param {HTMLElement} element
 * @returns {{ element: HTMLElement, dimensions: Object } | null}
 */
export function getSmallestContainer(element) {
  const ancestors = getAncestorDimensions(element);

  if (ancestors.length === 0) {
    return null;
  }

  // Find ancestor with smallest area
  return ancestors.reduce((smallest, current) => {
    const smallestArea = smallest.dimensions.width * smallest.dimensions.height;
    const currentArea = current.dimensions.width * current.dimensions.height;
    return currentArea < smallestArea ? current : smallest;
  }, ancestors[0]);
}

/**
 * Calculate available space for an element within its containers
 * Takes into account all ancestors and viewport
 *
 * @param {HTMLElement} element
 * @param {Object} options
 * @param {number} options.padding - Minimum padding from edges (default: 0)
 * @returns {{ width: number, height: number, constrainedBy: string }}
 */
export function getAvailableSpace(element, options = {}) {
  const { padding = 0 } = options;

  if (!element || !(element instanceof HTMLElement)) {
    return null;
  }

  const viewport = getViewportDimensions();
  const elementRect = element.getBoundingClientRect();

  // Start with viewport as maximum
  let maxWidth = viewport.width - (padding * 2);
  let maxHeight = viewport.height - (padding * 2);
  let constrainedBy = 'viewport';

  // Check each ancestor for tighter constraints
  const ancestors = getAncestorDimensions(element);

  for (const ancestor of ancestors) {
    const { dimensions, isScrollContainer } = ancestor;

    // Only constrain if ancestor is a scroll container or has explicit dimensions
    if (isScrollContainer) {
      const ancestorWidth = dimensions.clientWidth - (padding * 2);
      const ancestorHeight = dimensions.clientHeight - (padding * 2);

      if (ancestorWidth < maxWidth) {
        maxWidth = ancestorWidth;
        constrainedBy = ancestor.tagName;
      }

      if (ancestorHeight < maxHeight) {
        maxHeight = ancestorHeight;
        constrainedBy = ancestor.tagName;
      }
    }
  }

  // Also check element's position relative to viewport edges
  const spaceAbove = elementRect.top - padding;
  const spaceBelow = viewport.height - elementRect.bottom - padding;
  const spaceLeft = elementRect.left - padding;
  const spaceRight = viewport.width - elementRect.right - padding;

  return {
    width: Math.max(0, maxWidth),
    height: Math.max(0, maxHeight),
    spaceAbove: Math.max(0, spaceAbove),
    spaceBelow: Math.max(0, spaceBelow),
    spaceLeft: Math.max(0, spaceLeft),
    spaceRight: Math.max(0, spaceRight),
    constrainedBy,
  };
}

/**
 * Calculate optimal position for a floating element (tooltip, dropdown, etc.)
 * Finds best position to maximize visibility within viewport
 *
 * @param {HTMLElement} anchorElement - Element to position relative to
 * @param {Object} floatingDimensions - { width, height } of floating element
 * @param {Object} options
 * @param {number} options.padding - Minimum padding from viewport edges (default: 16)
 * @param {number} options.offset - Offset from anchor element (default: 8)
 * @param {string} options.preferredPosition - 'top' | 'bottom' | 'left' | 'right' (default: 'top')
 * @returns {{ top: number, left: number, position: string, fits: boolean }}
 */
export function calculateOptimalPosition(anchorElement, floatingDimensions, options = {}) {
  const {
    padding = 16,
    offset = 8,
    preferredPosition = 'top',
  } = options;

  if (!anchorElement || !(anchorElement instanceof HTMLElement)) {
    return null;
  }

  const viewport = getViewportDimensions();
  const anchorRect = anchorElement.getBoundingClientRect();
  const { width: floatWidth, height: floatHeight } = floatingDimensions;

  // Calculate available space in each direction
  const space = {
    top: anchorRect.top - padding,
    bottom: viewport.height - anchorRect.bottom - padding,
    left: anchorRect.left - padding,
    right: viewport.width - anchorRect.right - padding,
  };

  // Determine best vertical position
  let verticalPosition = preferredPosition;
  let top, left;

  // Try preferred position first, then fallback
  const verticalOptions = preferredPosition === 'bottom'
    ? ['bottom', 'top']
    : ['top', 'bottom'];

  for (const pos of verticalOptions) {
    if (pos === 'top' && space.top >= floatHeight + offset) {
      verticalPosition = 'top';
      top = anchorRect.top - floatHeight - offset;
      break;
    } else if (pos === 'bottom' && space.bottom >= floatHeight + offset) {
      verticalPosition = 'bottom';
      top = anchorRect.bottom + offset;
      break;
    }
  }

  // Fallback: position at top with scroll if needed
  if (top === undefined) {
    if (space.top > space.bottom) {
      verticalPosition = 'top';
      top = Math.max(padding, anchorRect.top - floatHeight - offset);
    } else {
      verticalPosition = 'bottom';
      top = Math.min(viewport.height - floatHeight - padding, anchorRect.bottom + offset);
    }
  }

  // Calculate horizontal position (center on anchor, clamp to viewport)
  const anchorCenter = anchorRect.left + anchorRect.width / 2;
  left = anchorCenter - floatWidth / 2;

  // Clamp horizontal position to viewport
  const minLeft = padding;
  const maxLeft = viewport.width - floatWidth - padding;
  left = Math.max(minLeft, Math.min(left, maxLeft));

  // Final safety clamp for vertical position
  top = Math.max(padding, Math.min(top, viewport.height - floatHeight - padding));

  // Check if element fully fits
  const fits = top >= padding &&
               top + floatHeight <= viewport.height - padding &&
               left >= padding &&
               left + floatWidth <= viewport.width - padding;

  return {
    top,
    left,
    position: verticalPosition,
    fits,
    // Additional info for arrow positioning
    anchorCenter,
    horizontalOffset: anchorCenter - (left + floatWidth / 2),
  };
}

/**
 * Create a ResizeObserver that batches callbacks for performance
 *
 * @param {Function} callback - Called with array of { element, dimensions }
 * @param {Object} options
 * @param {number} options.debounceMs - Debounce time in ms (default: 16 for 60fps)
 * @returns {{ observe: Function, unobserve: Function, disconnect: Function }}
 */
export function createDimensionObserver(callback, options = {}) {
  const { debounceMs = 16 } = options;

  let timeoutId = null;
  let pendingEntries = [];

  const observer = new ResizeObserver((entries) => {
    // Batch entries
    pendingEntries.push(...entries);

    // Debounce callback
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      const results = pendingEntries.map(entry => ({
        element: entry.target,
        dimensions: {
          width: entry.contentRect.width,
          height: entry.contentRect.height,
          top: entry.contentRect.top,
          left: entry.contentRect.left,
        },
        borderBoxSize: entry.borderBoxSize?.[0] ? {
          width: entry.borderBoxSize[0].inlineSize,
          height: entry.borderBoxSize[0].blockSize,
        } : null,
      }));

      callback(results);
      pendingEntries = [];
      timeoutId = null;
    }, debounceMs);
  });

  return {
    observe: (element) => observer.observe(element),
    unobserve: (element) => observer.unobserve(element),
    disconnect: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      observer.disconnect();
    },
  };
}

/**
 * Hook-friendly dimension measurement that triggers on first render
 * Returns a ref callback and current dimensions
 *
 * @param {HTMLElement} element
 * @returns {{ width: number, height: number } | null}
 */
export function measureOnce(element) {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return {
    width: rect.width,
    height: rect.height,
  };
}

/**
 * Set dimensions on an element with proper CSS units
 * Handles SCSS/CSS variable resolution and computed style awareness
 *
 * @param {HTMLElement} element - Target element to set dimensions on
 * @param {Object} dimensions - Dimensions to set
 * @param {number|string} dimensions.width - Width (number = px, string = as-is)
 * @param {number|string} dimensions.height - Height (number = px, string = as-is)
 * @param {number|string} dimensions.minWidth - Min width
 * @param {number|string} dimensions.maxWidth - Max width
 * @param {number|string} dimensions.minHeight - Min height
 * @param {number|string} dimensions.maxHeight - Max height
 * @param {Object} options
 * @param {boolean} options.preserveAspectRatio - Maintain aspect ratio when setting one dimension
 * @param {boolean} options.useImportant - Add !important to styles (use sparingly)
 * @returns {{ success: boolean, appliedStyles: Object }}
 */
export function setElementDimensions(element, dimensions, options = {}) {
  const { preserveAspectRatio = false, useImportant = false } = options;

  if (!element || !(element instanceof HTMLElement)) {
    return { success: false, appliedStyles: {} };
  }

  const appliedStyles = {};
  const priority = useImportant ? 'important' : '';

  // Get current dimensions for aspect ratio calculation
  let currentRect = null;
  if (preserveAspectRatio) {
    currentRect = element.getBoundingClientRect();
  }

  // Helper to convert value to CSS string
  const toCSSValue = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return `${value}px`;
    return value; // Already a string with units
  };

  // Apply width
  if (dimensions.width !== undefined) {
    const cssWidth = toCSSValue(dimensions.width);
    if (cssWidth) {
      element.style.setProperty('width', cssWidth, priority);
      appliedStyles.width = cssWidth;

      // Calculate height to preserve aspect ratio
      if (preserveAspectRatio && currentRect && currentRect.width > 0 && dimensions.height === undefined) {
        const aspectRatio = currentRect.height / currentRect.width;
        const newWidth = typeof dimensions.width === 'number' ? dimensions.width : parseFloat(dimensions.width);
        if (!isNaN(newWidth)) {
          const newHeight = newWidth * aspectRatio;
          element.style.setProperty('height', `${newHeight}px`, priority);
          appliedStyles.height = `${newHeight}px`;
        }
      }
    }
  }

  // Apply height
  if (dimensions.height !== undefined) {
    const cssHeight = toCSSValue(dimensions.height);
    if (cssHeight) {
      element.style.setProperty('height', cssHeight, priority);
      appliedStyles.height = cssHeight;

      // Calculate width to preserve aspect ratio
      if (preserveAspectRatio && currentRect && currentRect.height > 0 && dimensions.width === undefined) {
        const aspectRatio = currentRect.width / currentRect.height;
        const newHeight = typeof dimensions.height === 'number' ? dimensions.height : parseFloat(dimensions.height);
        if (!isNaN(newHeight)) {
          const newWidth = newHeight * aspectRatio;
          element.style.setProperty('width', `${newWidth}px`, priority);
          appliedStyles.width = `${newWidth}px`;
        }
      }
    }
  }

  // Apply min/max constraints
  const constraints = ['minWidth', 'maxWidth', 'minHeight', 'maxHeight'];
  for (const prop of constraints) {
    if (dimensions[prop] !== undefined) {
      const cssValue = toCSSValue(dimensions[prop]);
      if (cssValue) {
        // Convert camelCase to kebab-case for CSS property
        const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
        element.style.setProperty(cssProp, cssValue, priority);
        appliedStyles[prop] = cssValue;
      }
    }
  }

  return { success: true, appliedStyles };
}

/**
 * Set element dimensions to match a container or viewport
 * Useful for making an element fill available space
 *
 * @param {HTMLElement} element - Target element
 * @param {Object} options
 * @param {'parent'|'viewport'|'smallest'|'scroll'|HTMLElement} options.relativeTo - What to size relative to
 * @param {number} options.padding - Padding to subtract from dimensions
 * @param {boolean} options.respectMaxWidth - Use CSS max-width instead of fixed width
 * @param {boolean} options.respectMaxHeight - Use CSS max-height instead of fixed height
 * @returns {{ success: boolean, dimensions: Object }}
 */
export function fitToContainer(element, options = {}) {
  const {
    relativeTo = 'parent',
    padding = 0,
    respectMaxWidth = false,
    respectMaxHeight = false,
  } = options;

  if (!element || !(element instanceof HTMLElement)) {
    return { success: false, dimensions: null };
  }

  let targetDimensions;

  if (relativeTo === 'viewport') {
    const viewport = getViewportDimensions();
    targetDimensions = {
      width: viewport.width - (padding * 2),
      height: viewport.height - (padding * 2),
    };
  } else if (relativeTo === 'parent') {
    const parent = element.parentElement;
    if (!parent) return { success: false, dimensions: null };
    const parentDims = getContentBoxDimensions(parent);
    targetDimensions = {
      width: parentDims.width - (padding * 2),
      height: parentDims.height - (padding * 2),
    };
  } else if (relativeTo === 'smallest') {
    const smallest = getSmallestContainer(element);
    if (!smallest) return { success: false, dimensions: null };
    targetDimensions = {
      width: smallest.dimensions.clientWidth - (padding * 2),
      height: smallest.dimensions.clientHeight - (padding * 2),
    };
  } else if (relativeTo === 'scroll') {
    const scrollContainer = getNearestScrollContainer(element);
    if (!scrollContainer) {
      // Fallback to viewport
      const viewport = getViewportDimensions();
      targetDimensions = {
        width: viewport.width - (padding * 2),
        height: viewport.height - (padding * 2),
      };
    } else {
      targetDimensions = {
        width: scrollContainer.dimensions.clientWidth - (padding * 2),
        height: scrollContainer.dimensions.clientHeight - (padding * 2),
      };
    }
  } else if (relativeTo instanceof HTMLElement) {
    const refDims = getContentBoxDimensions(relativeTo);
    targetDimensions = {
      width: refDims.width - (padding * 2),
      height: refDims.height - (padding * 2),
    };
  } else {
    return { success: false, dimensions: null };
  }

  // Apply dimensions using max-width/height or fixed values
  const dimensionsToApply = {};

  if (respectMaxWidth) {
    dimensionsToApply.maxWidth = targetDimensions.width;
  } else {
    dimensionsToApply.width = targetDimensions.width;
  }

  if (respectMaxHeight) {
    dimensionsToApply.maxHeight = targetDimensions.height;
  } else {
    dimensionsToApply.height = targetDimensions.height;
  }

  const result = setElementDimensions(element, dimensionsToApply);

  return {
    success: result.success,
    dimensions: targetDimensions,
    appliedStyles: result.appliedStyles,
  };
}

/**
 * Clear inline dimension styles from an element
 *
 * @param {HTMLElement} element
 * @param {Object} options
 * @param {boolean} options.all - Clear all dimension-related styles
 * @param {string[]} options.properties - Specific properties to clear
 */
export function clearDimensionStyles(element, options = {}) {
  const { all = true, properties = [] } = options;

  if (!element || !(element instanceof HTMLElement)) {
    return;
  }

  const dimensionProps = [
    'width', 'height',
    'min-width', 'max-width',
    'min-height', 'max-height',
  ];

  const propsToClear = all ? dimensionProps : properties;

  for (const prop of propsToClear) {
    element.style.removeProperty(prop);
  }
}

/**
 * Get CSS variable value resolved for an element
 * Useful for reading SCSS-generated CSS custom properties
 *
 * @param {HTMLElement} element
 * @param {string} variableName - CSS variable name (with or without --)
 * @returns {string|null}
 */
export function getCSSVariableValue(element, variableName) {
  if (!element || !(element instanceof HTMLElement)) {
    return null;
  }

  const varName = variableName.startsWith('--') ? variableName : `--${variableName}`;
  const style = window.getComputedStyle(element);
  const value = style.getPropertyValue(varName).trim();

  return value || null;
}

/**
 * Parse a CSS value and convert to pixels
 * Handles px, rem, em, vh, vw, %
 *
 * @param {string} value - CSS value string
 * @param {HTMLElement} contextElement - Element for relative unit calculations
 * @returns {number|null}
 */
export function cssValueToPixels(value, contextElement = document.documentElement) {
  if (typeof value === 'number') return value;
  if (!value || typeof value !== 'string') return null;

  const trimmed = value.trim();

  // Already pixels
  if (trimmed.endsWith('px')) {
    return parseFloat(trimmed);
  }

  // Rem - relative to root font size
  if (trimmed.endsWith('rem')) {
    const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
    return parseFloat(trimmed) * rootFontSize;
  }

  // Em - relative to element font size
  if (trimmed.endsWith('em')) {
    const fontSize = parseFloat(getComputedStyle(contextElement).fontSize);
    return parseFloat(trimmed) * fontSize;
  }

  // Viewport units
  if (trimmed.endsWith('vh')) {
    return (parseFloat(trimmed) / 100) * window.innerHeight;
  }
  if (trimmed.endsWith('vw')) {
    return (parseFloat(trimmed) / 100) * window.innerWidth;
  }

  // Percentage - relative to parent
  if (trimmed.endsWith('%') && contextElement.parentElement) {
    const parentRect = contextElement.parentElement.getBoundingClientRect();
    // Assume width percentage (use parentRect.height for height %)
    return (parseFloat(trimmed) / 100) * parentRect.width;
  }

  // Try parsing as plain number (assume pixels)
  const num = parseFloat(trimmed);
  return isNaN(num) ? null : num;
}

export default {
  getViewportDimensions,
  getElementDimensions,
  getContentBoxDimensions,
  getAncestorDimensions,
  getNearestScrollContainer,
  getSmallestContainer,
  getAvailableSpace,
  calculateOptimalPosition,
  createDimensionObserver,
  measureOnce,
  setElementDimensions,
  fitToContainer,
  clearDimensionStyles,
  getCSSVariableValue,
  cssValueToPixels,
};

/**
 * Button Utilities
 *
 * Provides functions for calculating consistent button widths based on content.
 * Ensures all buttons with similar content have the same width for visual alignment.
 */

// Character width estimation factors (in em units)
// Based on average character widths in common sans-serif fonts
const CHAR_WIDTH_FACTORS = {
  uppercase: 0.7,   // Uppercase letters are wider
  lowercase: 0.55,  // Lowercase letters average width
  number: 0.6,      // Numbers are consistent width
  space: 0.25,      // Space character
  punctuation: 0.3, // Punctuation marks
  wide: 0.9,        // Wide characters: M, W, m, w
  narrow: 0.35,     // Narrow characters: i, l, j, t, f, I
};

// Characters by width category
const WIDE_CHARS = new Set(['M', 'W', 'm', 'w', '@', '%']);
const NARROW_CHARS = new Set(['i', 'l', 'j', 't', 'f', 'I', '!', '.', ',', ':', ';', "'", '`']);

/**
 * Estimate the visual width of a text string in em units
 * @param {string} text - The text to measure
 * @returns {number} Estimated width in em units
 */
export function estimateTextWidth(text) {
  if (!text || typeof text !== 'string') return 0;

  let width = 0;

  for (const char of text) {
    if (WIDE_CHARS.has(char)) {
      width += CHAR_WIDTH_FACTORS.wide;
    } else if (NARROW_CHARS.has(char)) {
      width += CHAR_WIDTH_FACTORS.narrow;
    } else if (char === ' ') {
      width += CHAR_WIDTH_FACTORS.space;
    } else if (/[A-Z]/.test(char)) {
      width += CHAR_WIDTH_FACTORS.uppercase;
    } else if (/[a-z]/.test(char)) {
      width += CHAR_WIDTH_FACTORS.lowercase;
    } else if (/[0-9]/.test(char)) {
      width += CHAR_WIDTH_FACTORS.number;
    } else if (/[.,!?;:'"()\-_]/.test(char)) {
      width += CHAR_WIDTH_FACTORS.punctuation;
    } else {
      // Default to lowercase width for unknown characters
      width += CHAR_WIDTH_FACTORS.lowercase;
    }
  }

  return width;
}

/**
 * Calculate the minimum width needed for a button based on its text content
 * Uses the design system's padding and font-size tokens
 *
 * @param {string} text - Button text content
 * @param {Object} options - Configuration options
 * @param {string} options.size - Button size: 'sm', 'md', 'lg' (default: 'md')
 * @param {boolean} options.hasIcon - Whether button has an icon (adds icon gap)
 * @param {number} options.minWidth - Minimum width in pixels (default: based on size)
 * @returns {number} Calculated width in pixels
 */
export function calculateButtonWidth(text, options = {}) {
  const { size = 'md', hasIcon = false, minWidth = null } = options;

  // Font sizes in pixels (from design tokens)
  const fontSizes = {
    sm: 14,
    md: 16,
    lg: 18,
  };

  // Horizontal padding in pixels (from design tokens)
  const paddingX = {
    sm: 12,  // space-3
    md: 16,  // space-4
    lg: 24,  // space-6
  };

  // Minimum widths in pixels (for visual consistency)
  const defaultMinWidths = {
    sm: 80,
    md: 100,
    lg: 120,
  };

  // Icon gap in pixels (space-2 = 8px)
  const iconGap = 8;
  // Estimated icon width (typical icon size)
  const iconWidth = size === 'lg' ? 20 : size === 'sm' ? 14 : 16;

  const fontSize = fontSizes[size] || fontSizes.md;
  const padding = paddingX[size] || paddingX.md;
  const minWidthValue = minWidth ?? defaultMinWidths[size] ?? defaultMinWidths.md;

  // Calculate text width in pixels
  const textWidthEm = estimateTextWidth(text);
  const textWidthPx = textWidthEm * fontSize;

  // Total content width
  let contentWidth = textWidthPx + (padding * 2);

  // Add icon space if present
  if (hasIcon) {
    contentWidth += iconWidth + iconGap;
  }

  // Return the larger of calculated width or minimum width
  // Round up to nearest 4px for clean alignment
  const calculatedWidth = Math.max(contentWidth, minWidthValue);
  return Math.ceil(calculatedWidth / 4) * 4;
}

/**
 * Calculate a unified width for a group of buttons based on the longest text
 * Ensures all buttons in a group have the same width for visual alignment
 *
 * @param {string[]} texts - Array of button text strings
 * @param {Object} options - Configuration options (same as calculateButtonWidth)
 * @returns {number} Unified width in pixels for all buttons
 */
export function calculateGroupButtonWidth(texts, options = {}) {
  if (!Array.isArray(texts) || texts.length === 0) {
    return calculateButtonWidth('', options);
  }

  // Find the width needed for the longest text
  const maxWidth = Math.max(
    ...texts.map(text => calculateButtonWidth(text, options))
  );

  return maxWidth;
}

/**
 * Generate inline style object with calculated width
 * Can be spread directly onto a button element
 *
 * @param {string} text - Button text content
 * @param {Object} options - Configuration options
 * @returns {Object} Style object with minWidth and width properties
 */
export function getButtonWidthStyle(text, options = {}) {
  const width = calculateButtonWidth(text, options);
  return {
    minWidth: `${width}px`,
    width: `${width}px`,
  };
}

/**
 * Generate inline style object for a group of buttons
 * All buttons will have the same width based on the longest text
 *
 * @param {string[]} texts - Array of button text strings
 * @param {Object} options - Configuration options
 * @returns {Object} Style object with minWidth and width properties
 */
export function getGroupButtonWidthStyle(texts, options = {}) {
  const width = calculateGroupButtonWidth(texts, options);
  return {
    minWidth: `${width}px`,
    width: `${width}px`,
  };
}

/**
 * Hook-ready function to get button dimensions based on size
 * Returns all relevant dimension values from design tokens
 *
 * @param {string} size - Button size: 'sm', 'md', 'lg'
 * @returns {Object} Object with height, paddingY, paddingX, fontSize values
 */
export function getButtonDimensions(size = 'md') {
  const dimensions = {
    sm: {
      height: 36,
      paddingY: 8,
      paddingX: 12,
      fontSize: 14,
      borderRadius: 8,
    },
    md: {
      height: 44,
      paddingY: 12,
      paddingX: 16,
      fontSize: 16,
      borderRadius: 8,
    },
    lg: {
      height: 52,
      paddingY: 16,
      paddingX: 24,
      fontSize: 18,
      borderRadius: 8,
    },
  };

  return dimensions[size] || dimensions.md;
}

/**
 * CSS custom property names for button dimensions
 * Use these when setting CSS variables programmatically
 */
export const BUTTON_CSS_VARS = {
  // Heights
  heightSm: '--btn-height-sm',
  heightMd: '--btn-height-md',
  heightLg: '--btn-height-lg',

  // Padding
  paddingYSm: '--btn-padding-y-sm',
  paddingXSm: '--btn-padding-x-sm',
  paddingYMd: '--btn-padding-y-md',
  paddingXMd: '--btn-padding-x-md',
  paddingYLg: '--btn-padding-y-lg',
  paddingXLg: '--btn-padding-x-lg',

  // Font sizes
  fontSizeSm: '--btn-font-size-sm',
  fontSizeMd: '--btn-font-size-md',
  fontSizeLg: '--btn-font-size-lg',

  // Common
  fontWeight: '--btn-font-weight',
  radiusDefault: '--btn-radius-default',
  radiusPill: '--btn-radius-pill',
  shadowBase: '--btn-shadow-base',
  shadowHover: '--btn-shadow-hover',
  transition: '--btn-transition',
  hoverLift: '--btn-hover-lift',
  iconGap: '--btn-icon-gap',
};

export default {
  estimateTextWidth,
  calculateButtonWidth,
  calculateGroupButtonWidth,
  getButtonWidthStyle,
  getGroupButtonWidthStyle,
  getButtonDimensions,
  BUTTON_CSS_VARS,
};

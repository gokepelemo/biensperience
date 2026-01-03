/**
 * CSS Environment Consistency Utility
 *
 * Ensures consistent CSS behavior and measurements across different environments
 * (development vs production). Handles timing issues, measurement consistency,
 * and environment-specific CSS differences.
 */

import { logger } from './logger';
import { safeMeasure, waitForCSS, createCSSReadyPromise } from './css-loading-detection';

/**
 * Environment detection for CSS consistency
 */
export const CSS_ENVIRONMENT = {
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
};

/**
 * Consistent timing for CSS-dependent operations
 * @param {number} multiplier - Multiplier for base delay (default: 1)
 * @returns {number} - Delay in milliseconds
 */
export function getCSSDelay(multiplier = 1) {
  // Longer delay in development for HMR and slower CSS loading
  const baseDelay = CSS_ENVIRONMENT.isDevelopment ? 100 : 50;
  return baseDelay * multiplier;
}

/**
 * Force layout recalculation to ensure CSS is applied
 * @param {HTMLElement} element - Element to force layout on
 */
export function forceLayout(element) {
  if (!element) return;

  try {
    // Force layout by accessing layout properties
    element.offsetHeight; // eslint-disable-line no-unused-expressions
    element.offsetWidth; // eslint-disable-line no-unused-expressions
  } catch (error) {
    logger.error('Error forcing layout', error);
  }
}

/**
 * Consistent element measurement with environment-aware timing
 * @param {HTMLElement} element - Element to measure
 * @param {string} property - Property to measure
 * @param {Object} options - Measurement options
 * @returns {Promise<number>} - Measured value
 */
export async function consistentMeasure(element, property = 'height', options = {}) {
  if (!element) {
    logger.warn('Cannot measure null/undefined element');
    return 0;
  }

  const {
    waitForCSS: shouldWaitForCSS = true,
    forceLayout: shouldForceLayout = true,
    retries = 3,
    retryDelay = getCSSDelay(2)
  } = options;

  // Wait for CSS if requested
  if (shouldWaitForCSS) {
    await createCSSReadyPromise();
  }

  // Force layout recalculation if requested
  if (shouldForceLayout) {
    forceLayout(element);
  }

  // Retry measurement with delays to handle timing issues
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const value = await safeMeasure(element, property);

      // Validate measurement is reasonable
      if (value > 0 || property === 'scrollHeight' || property === 'scrollWidth') {
        if (attempt > 1) {
          logger.debug(`Measurement succeeded on attempt ${attempt}`, { property, value });
        }
        return value;
      }

      // If measurement is 0 and this isn't the last attempt, wait and retry
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }

      return value; // Return 0 if all attempts fail

    } catch (error) {
      logger.error(`Measurement attempt ${attempt} failed`, error);
      if (attempt === retries) {
        return 0;
      }
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  return 0;
}

/**
 * Get modal dimensions consistently across environments
 * @param {HTMLElement} modalElement - Modal element to measure
 * @returns {Promise<Object>} - { width, height, scrollHeight }
 */
export async function getModalDimensions(modalElement) {
  if (!modalElement) {
    logger.warn('Cannot measure modal dimensions: element is null');
    return { width: 0, height: 0, scrollHeight: 0 };
  }

  try {
    // Wait for CSS and force layout
    await waitForCSS(() => {}, {
      testSelector: modalElement.tagName.toLowerCase(),
      testProperty: 'display',
      expectedValue: 'block'
    });

    forceLayout(modalElement);

    // Measure with retries
    const [width, height, scrollHeight] = await Promise.all([
      consistentMeasure(modalElement, 'width', { retries: 5 }),
      consistentMeasure(modalElement, 'height', { retries: 5 }),
      consistentMeasure(modalElement, 'scrollHeight', { retries: 5 })
    ]);

    const dimensions = { width, height, scrollHeight };
    logger.debug('Modal dimensions measured', dimensions);

    return dimensions;
  } catch (error) {
    logger.error('Error measuring modal dimensions', error);
    return { width: 0, height: 0, scrollHeight: 0 };
  }
}

/**
 * Environment-aware CSS class application
 * @param {string} baseClass - Base CSS class name
 * @param {Object} modifiers - Modifier conditions
 * @returns {string} - Combined class string
 */
export function createCSSClass(baseClass, modifiers = {}) {
  const classes = [baseClass];

  Object.entries(modifiers).forEach(([modifier, condition]) => {
    if (condition) {
      classes.push(`${baseClass}--${modifier}`);
    }
  });

  // Add environment-specific classes for debugging
  if (CSS_ENVIRONMENT.isDevelopment) {
    classes.push(`${baseClass}--dev`);
  }

  return classes.join(' ');
}

/**
 * Consistent viewport size detection
 * @returns {Object} - { width, height, isMobile, isTablet, isDesktop }
 */
export function getViewportInfo() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  return {
    width,
    height,
    isMobile: width < 768,
    isTablet: width >= 768 && width < 992,
    isDesktop: width >= 992,
  };
}

/**
 * Environment-aware CSS custom property getter
 * @param {string} propertyName - CSS custom property name (without --)
 * @param {HTMLElement} element - Element to get property from (default: :root)
 * @param {string} fallback - Fallback value
 * @returns {string} - Property value
 */
export function getCSSCustomProperty(propertyName, element = document.documentElement, fallback = '') {
  try {
    const value = getComputedStyle(element).getPropertyValue(`--${propertyName}`).trim();
    return value || fallback;
  } catch (error) {
    logger.error('Error getting CSS custom property', error);
    return fallback;
  }
}

/**
 * Environment-aware CSS custom property setter
 * @param {string} propertyName - CSS custom property name (without --)
 * @param {string} value - Value to set
 * @param {HTMLElement} element - Element to set property on (default: :root)
 */
export function setCSSCustomProperty(propertyName, value, element = document.documentElement) {
  try {
    element.style.setProperty(`--${propertyName}`, value);
  } catch (error) {
    logger.error('Error setting CSS custom property', error);
  }
}

/**
 * Initialize CSS environment consistency
 * Call this once when the app starts
 */
export function initializeCSSEnvironment() {
  logger.info('Initializing CSS environment consistency', {
    environment: process.env.NODE_ENV,
    isDevelopment: CSS_ENVIRONMENT.isDevelopment,
    viewport: getViewportInfo()
  });

  // Set environment-specific CSS custom properties
  setCSSCustomProperty('env-is-development', CSS_ENVIRONMENT.isDevelopment ? '1' : '0');
  setCSSCustomProperty('env-is-production', CSS_ENVIRONMENT.isProduction ? '1' : '0');

  // Set viewport information as CSS custom properties
  const viewport = getViewportInfo();
  setCSSCustomProperty('viewport-width', `${viewport.width}px`);
  setCSSCustomProperty('viewport-height', `${viewport.height}px`);

  // Update viewport properties on resize
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const newViewport = getViewportInfo();
      setCSSCustomProperty('viewport-width', `${newViewport.width}px`);
      setCSSCustomProperty('viewport-height', `${newViewport.height}px`);
    }, 100);
  });
}

// Export default object
export default {
  CSS_ENVIRONMENT,
  getCSSDelay,
  forceLayout,
  consistentMeasure,
  getModalDimensions,
  createCSSClass,
  getViewportInfo,
  getCSSCustomProperty,
  setCSSCustomProperty,
  initializeCSSEnvironment,
};
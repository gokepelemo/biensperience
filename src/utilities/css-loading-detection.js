/**
 * CSS Loading Detection Utility
 *
 * Ensures CSS is fully loaded before allowing JavaScript to perform measurements
 * or manipulations that depend on CSS styling. This prevents race conditions
 * between CSS loading and JavaScript execution.
 */

import { logger } from '../utilities/logger';

/**
 * Check if a CSS file is loaded by testing if its styles are applied
 * @param {string} testSelector - CSS selector to test
 * @param {string} testProperty - CSS property to check
 * @param {string} expectedValue - Expected value of the property
 * @returns {boolean} - True if CSS is loaded
 */
export function isCSSLoaded(testSelector = 'body', testProperty = 'font-family', expectedValue) {
  try {
    const element = document.querySelector(testSelector);
    if (!element) return false;

    const computedStyle = window.getComputedStyle(element);
    const actualValue = computedStyle.getPropertyValue(testProperty);

    if (expectedValue) {
      return actualValue.includes(expectedValue);
    }

    // If no expected value provided, just check if we have a computed style
    return actualValue !== '';
  } catch (error) {
    logger.error('Error checking CSS loading state', error);
    return false;
  }
}

/**
 * Wait for CSS to be fully loaded before executing a callback
 * @param {Function} callback - Function to execute after CSS is loaded
 * @param {Object} options - Configuration options
 * @param {number} options.timeout - Maximum time to wait in milliseconds (default: 10000)
 * @param {number} options.interval - Check interval in milliseconds (default: 50)
 * @param {string} options.testSelector - CSS selector to test
 * @param {string} options.testProperty - CSS property to check
 * @param {string} options.expectedValue - Expected value of the property
 * @returns {Promise} - Resolves when CSS is loaded or timeout occurs
 */
export function waitForCSS(callback, options = {}) {
  const {
    timeout = 10000,
    interval = 50,
    testSelector = 'body',
    testProperty = 'font-family',
    expectedValue
  } = options;

  return new Promise((resolve, reject) => {
    let elapsed = 0;
    const startTime = Date.now();

    const checkCSS = () => {
      elapsed = Date.now() - startTime;

      if (elapsed > timeout) {
        logger.warn('CSS loading timeout', { elapsed, timeout });
        resolve(callback()); // Execute callback even on timeout
        return;
      }

      if (isCSSLoaded(testSelector, testProperty, expectedValue)) {
        logger.debug('CSS loaded successfully', { elapsed });
        resolve(callback());
        return;
      }

      setTimeout(checkCSS, interval);
    };

    // Start checking immediately
    checkCSS();
  });
}

/**
 * Enhanced version that waits for multiple CSS conditions
 * @param {Function} callback - Function to execute after all CSS is loaded
 * @param {Array} conditions - Array of condition objects
 * @param {Object} options - Global options
 * @returns {Promise} - Resolves when all conditions are met
 */
export function waitForMultipleCSS(callback, conditions = [], options = {}) {
  const { timeout = 10000 } = options;

  return new Promise((resolve, reject) => {
    let elapsed = 0;
    const startTime = Date.now();

    const checkAllConditions = () => {
      elapsed = Date.now() - startTime;

      if (elapsed > timeout) {
        logger.warn('CSS loading timeout for multiple conditions', { elapsed, timeout });
        resolve(callback()); // Execute callback even on timeout
        return;
      }

      const allLoaded = conditions.every(condition => {
        const { testSelector = 'body', testProperty = 'font-family', expectedValue } = condition;
        return isCSSLoaded(testSelector, testProperty, expectedValue);
      });

      if (allLoaded) {
        logger.debug('All CSS conditions met', { elapsed, conditionCount: conditions.length });
        resolve(callback());
        return;
      }

      setTimeout(checkAllConditions, 50);
    };

    checkAllConditions();
  });
}

/**
 * Create a CSS loading promise that can be awaited
 * @param {Object} options - Configuration options
 * @returns {Promise} - Resolves when CSS is loaded
 */
export function createCSSReadyPromise(options = {}) {
  return new Promise((resolve) => {
    waitForCSS(() => resolve(), options);
  });
}

/**
 * Safe measurement function that waits for CSS before measuring
 * @param {HTMLElement} element - Element to measure
 * @param {string} property - Property to measure ('height', 'width', etc.)
 * @param {Object} options - CSS waiting options
 * @returns {Promise<number>} - Resolves with the measured value
 */
export async function safeMeasure(element, property = 'height', options = {}) {
  await createCSSReadyPromise(options);

  try {
    const rect = element.getBoundingClientRect();
    switch (property) {
      case 'height':
        return rect.height;
      case 'width':
        return rect.width;
      case 'top':
        return rect.top;
      case 'left':
        return rect.left;
      case 'scrollHeight':
        return element.scrollHeight;
      case 'scrollWidth':
        return element.scrollWidth;
      default:
        return rect.height;
    }
  } catch (error) {
    logger.error('Error measuring element', error);
    return 0;
  }
}

/**
 * Hook for React components to wait for CSS before rendering measurements
 * @param {Object} options - CSS waiting options
 * @returns {Object} - { isCSSReady, waitForCSS }
 */
export function useCSSReady(options = {}) {
  const [isCSSReady, setIsCSSReady] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;

    waitForCSS(() => {
      if (mounted) {
        setIsCSSReady(true);
      }
    }, options);

    return () => {
      mounted = false;
    };
  }, []);

  return { isCSSReady };
}

// Export default object for easy importing
export default {
  isCSSLoaded,
  waitForCSS,
  waitForMultipleCSS,
  createCSSReadyPromise,
  safeMeasure,
  useCSSReady,
};
/**
 * CSS Loading Detection Utility
 *
 * Detects when CSS stylesheets are fully loaded and applied.
 * This addresses differences between development (Vite dev server) and production (Express static files).
 */

let cssLoaded = false;
let cssLoadPromise = null;

/**
 * Check if all stylesheets are loaded
 */
export function areStylesheetsLoaded() {
  if (cssLoaded) return true;

  try {
    const stylesheets = document.styleSheets;
    if (stylesheets.length === 0) return false;

    let loadedCount = 0;
    for (let i = 0; i < stylesheets.length; i++) {
      try {
        // Try to access cssRules - if it throws, stylesheet isn't loaded
        const rules = stylesheets[i].cssRules;
        loadedCount++;
      } catch (e) {
        // Stylesheet not loaded yet
        return false;
      }
    }

    cssLoaded = loadedCount === stylesheets.length;
    return cssLoaded;
  } catch (error) {
    return false;
  }
}

/**
 * Check if CSS is applied by testing computed styles
 */
export function isCSSApplied() {
  try {
    const testElement = document.createElement('div');
    testElement.style.cssText = 'position: absolute; visibility: hidden;';
    document.body.appendChild(testElement);

    const computedStyle = getComputedStyle(testElement);
    const hasCSS = computedStyle.position === 'absolute';

    document.body.removeChild(testElement);
    return hasCSS;
  } catch (error) {
    return false;
  }
}

/**
 * Wait for CSS to be fully loaded and applied
 */
export function waitForCSS() {
  if (cssLoadPromise) return cssLoadPromise;

  cssLoadPromise = new Promise((resolve) => {
    const checkCSS = () => {
      if (areStylesheetsLoaded() && isCSSApplied()) {
        cssLoaded = true;
        resolve();
      } else {
        // Check again in a short timeout
        setTimeout(checkCSS, 50);
      }
    };

    // Start checking immediately
    checkCSS();
  });

  return cssLoadPromise;
}

/**
 * Reset CSS loading state (useful for testing or dynamic stylesheet loading)
 */
export function resetCSSLoadingState() {
  cssLoaded = false;
  cssLoadPromise = null;
}

// Auto-detect CSS loading on page load
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => waitForCSS());
  } else {
    waitForCSS();
  }
}
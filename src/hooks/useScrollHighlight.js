/**
 * useScrollHighlight Hook
 *
 * Consolidated hook for scrolling to elements and applying highlight animation.
 * Single source of truth for all scroll/highlight logic in the application.
 *
 * Features:
 * - Smooth scroll with configurable offset for fixed headers
 * - Retry logic for elements that may not be in DOM yet
 * - Highlight animation with automatic cleanup
 * - Prevents duplicate highlights
 */

import { useCallback, useRef } from 'react';
import { animateScroll } from 'react-scroll';
import { logger } from '../utilities/logger';

// CSS class for deep-link highlight animation
const HIGHLIGHT_CLASS = 'deep-link-highlight';
const HIGHLIGHT_DURATION = 2000; // ms

/**
 * Hook for scrolling to elements and applying highlight animation.
 * Consolidates all scroll/highlight logic into a single source.
 *
 * @returns {Object} Object containing scrollToItem, applyHighlight, and clearHighlight functions
 */
export function useScrollHighlight() {
  // Track active highlight to prevent duplicates
  const activeHighlightRef = useRef(null);

  /**
   * Apply highlight animation to an element
   * @param {HTMLElement} element - Element to highlight
   */
  const applyHighlight = useCallback((element) => {
    if (!element) {
      return;
    }

    // Clear any existing highlight first
    if (activeHighlightRef.current) {
      try {
        activeHighlightRef.current.classList.remove(HIGHLIGHT_CLASS);
      } catch (e) {
        // Element may have been removed from DOM
      }
    }

    // Find the card element (may need to traverse up)
    const card = element.closest('.plan-item-card') || element;

    logger.debug('[ScrollHighlight] Applying highlight to element');

    // Apply highlight class
    card.classList.add(HIGHLIGHT_CLASS);
    activeHighlightRef.current = card;

    // Remove after animation completes
    setTimeout(() => {
      try {
        card.classList.remove(HIGHLIGHT_CLASS);
        if (activeHighlightRef.current === card) {
          activeHighlightRef.current = null;
        }
        logger.debug('[ScrollHighlight] Highlight animation complete, class removed');
      } catch (e) {
        // Element may have been removed from DOM
      }
    }, HIGHLIGHT_DURATION);
  }, []);

  /**
   * Clear any active highlight immediately
   */
  const clearHighlight = useCallback(() => {
    if (activeHighlightRef.current) {
      try {
        activeHighlightRef.current.classList.remove(HIGHLIGHT_CLASS);
        activeHighlightRef.current = null;
        logger.debug('[ScrollHighlight] Highlight cleared');
      } catch (e) {
        // Element may have been removed from DOM
      }
    }
  }, []);

  /**
   * Scroll to a plan item and optionally highlight it
   * @param {string} itemId - The plan item ID to scroll to
   * @param {Object} options
   * @param {boolean} options.shouldHighlight - Whether to apply highlight animation (default: true)
   * @param {number} options.offset - Scroll offset for fixed headers (default: 200)
   * @param {number} options.duration - Scroll animation duration (default: 800)
   * @param {number} options.maxAttempts - Max retry attempts to find element (default: 8)
   * @param {number} options.retryDelay - Delay between retries in ms (default: 200)
   * @returns {Promise<HTMLElement|null>} The found element or null
   */
  const scrollToItem = useCallback(async (itemId, options = {}) => {
    const {
      shouldHighlight = true,
      offset = 200,
      duration = 300, // Reduced from 800ms for subtle, snappy scroll
      maxAttempts = 8,
      retryDelay = 200
    } = options;

    if (!itemId) {
      logger.info('[ScrollHighlight] No itemId provided');
      return null;
    }

    logger.info('[ScrollHighlight] Attempting to scroll to item:', { itemId, shouldHighlight, offset, duration });

    // Find element with retries (element may not be in DOM yet)
    let element = null;
    let attempts = 0;

    while (!element && attempts < maxAttempts) {
      attempts++;

      // Try multiple selector patterns
      const escapedId = CSS.escape(itemId);
      const selectors = [
        `[data-plan-item-id="${escapedId}"]`,
        `[data-plan-item-id="${itemId}"]`,
        `#${escapedId}`
      ];

      for (const selector of selectors) {
        try {
          element = document.querySelector(selector);
          if (element) {
            logger.info('[ScrollHighlight] Found element with selector:', { selector, attempt: attempts });
            break;
          }
        } catch (e) {
          // Invalid selector, continue to next
        }
      }

      if (!element && attempts < maxAttempts) {
        logger.info('[ScrollHighlight] Element not found, retrying...', {
          attempt: attempts,
          maxAttempts,
          searchedId: itemId,
          selectors
        });
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    if (!element) {
      logger.info('[ScrollHighlight] Element not found after max attempts:', { itemId, attempts });
      return null;
    }

    logger.debug('[ScrollHighlight] Found element, scrolling...', { itemId, attempts });

    // Scroll to element
    return new Promise((resolve) => {
      const elementRect = element.getBoundingClientRect();
      const elementTop = elementRect.top + window.pageYOffset;

      let highlightApplied = false;

      const doHighlight = () => {
        if (highlightApplied) {
          return;
        }
        highlightApplied = true;
        if (shouldHighlight) {
          applyHighlight(element);
        }
        resolve(element);
      };

      // Fallback timeout in case onComplete doesn't fire
      const fallbackTimeout = setTimeout(() => {
        doHighlight();
      }, duration + 100);

      animateScroll.scrollTo(elementTop - offset, {
        duration,
        smooth: 'easeOutQuad', // Gentler easing to prevent bounce
        onComplete: () => {
          clearTimeout(fallbackTimeout);
          logger.debug('[ScrollHighlight] Scroll complete');
          doHighlight();
        }
      });
    });
  }, [applyHighlight]);

  const returnValue = {
    scrollToItem,
    applyHighlight,
    clearHighlight,
    HIGHLIGHT_CLASS,
    HIGHLIGHT_DURATION
  };

  return returnValue;
}

export default useScrollHighlight;

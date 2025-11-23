// Shared scrolling and element utilities used by SingleExperience and other views
// Provides safe selector escaping, plan-item highlighting (shake), and a retrying
// scroll-to-item helper that resolves when the element is found or falls back.

import { logger } from './logger';
import { scroller, animateScroll } from 'react-scroll';

/**
 * Escape a string for use in querySelector.
 * Uses CSS.escape when available, with a conservative fallback.
 */
export function escapeSelector(s) {
  if (!s && s !== 0) return s;
  try {
    if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(s);
  } catch (e) {
    // ignore
  }
  return String(s).replace(/\\|"|'|`/g, (m) => `\\${m}`);
}

/**
 * Apply a transient shake animation to the closest `.plan-item-card` for the
 * given plan item id. Looks for `[data-plan-item-id]` first, then falls back
 * to `document.getElementById`.
 * Returns the card element when successful, otherwise null.
 */
export function highlightPlanItem(id) {
  if (!id || typeof window === 'undefined') return null;
  const escaped = escapeSelector(id);
  let el = null;
  try {
    el = document.querySelector(`[data-plan-item-id="${escaped}"]`);
  } catch (e) {
    try { el = document.querySelector(`[data-plan-item-id='${escaped}']`); } catch (err) { el = null; }
  }
  if (!el) {
    try { el = document.getElementById(id); } catch (e) { el = null; }
  }
  if (!el) return null;
  const card = el.closest && el.closest('.plan-item-card') ? el.closest('.plan-item-card') : el;
    try {
    card.classList.add('shake-animation');
    setTimeout(() => {
      try { card.classList.remove('shake-animation'); } catch (e) {}
    }, 2000);
  } catch (e) {
    // ignore DOM errors
  }
  return card;
}

/**
 * Attempt to scroll to a plan item by its id. Retries up to `maxAttempts`
 * waiting `delayMs` between attempts. Resolves with the found element or
 * null if not found (after scrolling the plan section as a fallback).
 *
 * @param {string} itemId - The plan item ID to scroll to
 * @param {Object} options - Configuration options
 * @param {number} options.maxAttempts - Maximum retry attempts (default: 8)
 * @param {number} options.delayMs - Delay between retries in ms (default: 200)
 * @param {number} options.anticipationDelay - Delay before scroll starts for user re-orientation (default: 250ms)
 * @param {boolean} options.shouldHighlight - Whether to apply shake animation (default: true for deep-links, false otherwise)
 */
export function attemptScrollToItem(itemId, { maxAttempts = 8, delayMs = 200, anticipationDelay = 250, shouldHighlight = true } = {}) {
  return new Promise((resolve) => {
    if (!itemId) {
      logger.debug('[Scroll] No itemId provided, scrolling to plan section');
      const planSection = document.querySelector('.my-plan-view');
      if (planSection) {
        logger.debug('[Scroll] Found plan section, scrolling...');
        setTimeout(() => {
          try {
            const elementTop = planSection.getBoundingClientRect().top + window.pageYOffset;
            animateScroll.scrollTo(elementTop - 80, {
              duration: 800,
              delay: 0,
              smooth: 'easeInOutQuart',
              offset: -80
            });
          } catch (e) {
            // Fallback to native scrollIntoView
            planSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, anticipationDelay);
      } else {
        logger.debug('[Scroll] ❌ Plan section .my-plan-view not found');
      }
      return resolve(null);
    }

    const escapedId = escapeSelector(itemId);
    let attempts = 0;

    const tryFind = () => {
      attempts += 1;
      logger.debug(`[Scroll] Attempt ${attempts}/${maxAttempts} to find item:`, { itemId });
      let itemElement = null;
      try {
        itemElement = document.querySelector(`[data-plan-item-id=\"${escapedId}\"]`);
      } catch (e) {
        try { itemElement = document.querySelector(`[data-plan-item-id='${escapedId}']`); } catch (err) { itemElement = null; }
      }

      if (itemElement) {
        logger.debug('[Scroll] ✅ Found item element, scrolling...');

        // Use react-scroll for smoother animation with anticipation delay
        setTimeout(() => {
          try {
            // Get element position for react-scroll
            const elementTop = itemElement.getBoundingClientRect().top + window.pageYOffset;

            // Scroll with react-scroll (smoother easing, configurable delay)
            animateScroll.scrollTo(elementTop - 100, {
              duration: 800,
              delay: 0,
              smooth: 'easeInOutQuart',
              offset: -100 // Offset for headers
            });
          } catch (e) {
            // Fallback to native scrollIntoView
            logger.debug('[Scroll] react-scroll failed, using fallback');
            try { itemElement.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (err) {}
          }

          // Only apply shake/highlight animation if requested (deep-link navigation)
          // Skip for item completion toggles to avoid unwanted animation
          // Delay animation until after scroll completes (800ms duration + 200ms buffer)
          if (shouldHighlight) {
            logger.debug('[Scroll] Scheduling shake animation after scroll completes');
            setTimeout(() => {
              highlightPlanItem(itemId);
              setTimeout(() => {
                try {
                  const card = itemElement.closest && itemElement.closest('.plan-item-card') ? itemElement.closest('.plan-item-card') : itemElement;
                  if (card) card.style.backgroundColor = '';
                } catch (e) {}
              }, 2100);
            }, 1000); // Wait for scroll to complete (800ms scroll + 200ms buffer)
          }
        }, anticipationDelay);

        return resolve(itemElement);
      }

      if (attempts < maxAttempts) {
        logger.debug('[Scroll] Item not found yet, will retry...');
        setTimeout(tryFind, delayMs);
        return;
      }

      // final fallback: scroll to plan section and resolve null
      logger.debug('[Scroll] ❌ Item not found after max attempts, falling back to plan section');
      const planSection = document.querySelector('.my-plan-view');
      if (planSection) {
        logger.debug('[Scroll] Found plan section, scrolling...');
        setTimeout(() => {
          try {
            const elementTop = planSection.getBoundingClientRect().top + window.pageYOffset;
            animateScroll.scrollTo(elementTop - 80, {
              duration: 800,
              delay: 0,
              smooth: 'easeInOutQuart',
              offset: -80
            });
          } catch (e) {
            // Fallback to native scrollIntoView
            planSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, anticipationDelay);
      } else {
        logger.debug('[Scroll] ❌ Plan section .my-plan-view not found');
      }
      return resolve(null);
    };

    tryFind();
  });
}

export default {
  escapeSelector,
  highlightPlanItem,
  attemptScrollToItem
};

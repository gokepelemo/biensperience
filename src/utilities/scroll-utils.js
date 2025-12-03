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
 * Apply a transient shake animation to the closest `.plan-item-card` or `.compact-plan-item`
 * for the given plan item id. Looks for `[data-plan-item-id]` first, then falls back
 * to `document.getElementById`.
 * Returns the card/item element when successful, otherwise null.
 *
 * Supports both Card View (.plan-item-card) and Compact View (.compact-plan-item)
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

  // Support both Card View and Compact View
  // Try .plan-item-card first (Card View), then .compact-plan-item (Compact View), fallback to element itself
  let targetEl = el;
  if (el.closest) {
    const cardView = el.closest('.plan-item-card');
    const compactView = el.closest('.compact-plan-item');
    targetEl = cardView || compactView || el;
  }

  try {
    targetEl.classList.add('shake-animation');
    setTimeout(() => {
      try { targetEl.classList.remove('shake-animation'); } catch (e) {}
    }, 2500); // Match animation duration of 2.5s
  } catch (e) {
    // ignore DOM errors
  }
  return targetEl;
}

/**
 * Attempt to scroll to a plan item by its id. Retries up to `maxAttempts`
 * waiting `delayMs` between attempts. Resolves with the found element or
 * null if not found (after scrolling the plan section as a fallback).
 *
 * @param {string} itemId - The plan item ID to scroll to
 * @param {Object} options - Configuration options
 * @param {number} options.maxAttempts - Maximum retry attempts (default: 8)
 * @param {number} options.delayMs - Delay between retries in ms (default: 150)
 * @param {number} options.anticipationDelay - Delay before scroll starts (default: 0ms - immediate)
 * @param {boolean} options.shouldHighlight - Whether to apply shake animation (default: true for deep-links, false otherwise)
 */
export function attemptScrollToItem(itemId, { maxAttempts = 8, delayMs = 150, anticipationDelay = 0, shouldHighlight = true } = {}) {
  // Helper to execute immediately or with delay
  const scheduleScroll = (fn) => {
    if (anticipationDelay > 0) {
      setTimeout(fn, anticipationDelay);
    } else {
      requestAnimationFrame(fn);
    }
  };

  return new Promise((resolve) => {
    if (!itemId) {
      logger.debug('[Scroll] No itemId provided, scrolling to plan section');
      const planSection = document.querySelector('.my-plan-view');
      if (planSection) {
        logger.debug('[Scroll] Found plan section, scrolling...');
        scheduleScroll(() => {
          try {
            const elementTop = planSection.getBoundingClientRect().top + window.pageYOffset;
            animateScroll.scrollTo(elementTop - 80, {
              duration: 300,
              delay: 0,
              smooth: 'easeOutQuad',
              offset: -80
            });
          } catch (e) {
            planSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
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

        const onScrollComplete = () => {
          if (shouldHighlight) {
            logger.debug('[Scroll] Scroll complete, triggering shake animation via callback');
            highlightPlanItem(itemId);
          }
        };

        scheduleScroll(() => {
          try {
            const elementTop = itemElement.getBoundingClientRect().top + window.pageYOffset;
            animateScroll.scrollTo(elementTop - 200, {
              duration: 300,
              delay: 0,
              smooth: 'easeOutQuad',
              offset: -200,
              onComplete: onScrollComplete
            });
          } catch (e) {
            logger.debug('[Scroll] react-scroll failed, using fallback');
            try {
              itemElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              if (shouldHighlight) {
                const observer = new IntersectionObserver((entries) => {
                  if (entries[0].isIntersecting) {
                    observer.disconnect();
                    highlightPlanItem(itemId);
                  }
                }, { threshold: 0.5 });
                observer.observe(itemElement);
                setTimeout(() => observer.disconnect(), 2000);
              }
            } catch (err) {
              if (shouldHighlight) highlightPlanItem(itemId);
            }
          }
        });

        return resolve(itemElement);
      }

      if (attempts < maxAttempts) {
        logger.debug('[Scroll] Item not found yet, will retry...');
        setTimeout(tryFind, delayMs);
        return;
      }

      logger.debug('[Scroll] ❌ Item not found after max attempts, falling back to plan section');
      const planSection = document.querySelector('.my-plan-view');
      if (planSection) {
        logger.debug('[Scroll] Found plan section, scrolling...');
        scheduleScroll(() => {
          try {
            const elementTop = planSection.getBoundingClientRect().top + window.pageYOffset;
            animateScroll.scrollTo(elementTop - 80, {
              duration: 300,
              delay: 0,
              smooth: 'easeOutQuad',
              offset: -80
            });
          } catch (e) {
            planSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
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

// Shared scrolling and element utilities used by SingleExperience and other views
// Provides safe selector escaping, plan-item highlighting (shake), and a retrying
// scroll-to-item helper that resolves when the element is found or falls back.

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
 */
export function attemptScrollToItem(itemId, { maxAttempts = 8, delayMs = 200 } = {}) {
  return new Promise((resolve) => {
    if (!itemId) {
      const planSection = document.querySelector('.my-plan-view');
      if (planSection) planSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return resolve(null);
    }

    const escapedId = escapeSelector(itemId);
    let attempts = 0;

    const tryFind = () => {
      attempts += 1;
      let itemElement = null;
      try {
        itemElement = document.querySelector(`[data-plan-item-id=\"${escapedId}\"]`);
      } catch (e) {
        try { itemElement = document.querySelector(`[data-plan-item-id='${escapedId}']`); } catch (err) { itemElement = null; }
      }

      if (itemElement) {
        try { itemElement.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
        highlightPlanItem(itemId);
        setTimeout(() => {
          try {
            const card = itemElement.closest && itemElement.closest('.plan-item-card') ? itemElement.closest('.plan-item-card') : itemElement;
            if (card) card.style.backgroundColor = '';
          } catch (e) {}
        }, 2100);
        return resolve(itemElement);
      }

      if (attempts < maxAttempts) {
        setTimeout(tryFind, delayMs);
        return;
      }

      // final fallback: scroll to plan section and resolve null
      const planSection = document.querySelector('.my-plan-view');
      if (planSection) planSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

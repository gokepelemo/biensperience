/**
 * useScrollLock - Centralized body scroll lock for modals
 *
 * Prevents the underlying page from scrolling when one or more modals are open.
 * Uses a global ref counter so nested/stacked modals coordinate correctly:
 * body scroll is locked when any modal is open, and only unlocked when the
 * last modal closes.
 *
 * On iOS Safari, `overflow: hidden` on the body alone doesn't prevent scroll
 * bleed-through for touch events. This hook also sets `position: fixed` and
 * preserves/restores the scroll position to prevent the page from jumping.
 *
 * @param {boolean} active - Whether this modal is currently open
 */

import { useEffect } from 'react';

// Global counter tracks how many active scroll locks exist.
// Body scroll is unlocked only when this reaches 0.
let lockCount = 0;
let savedScrollY = 0;

function lockBody() {
  if (lockCount === 0) {
    // Save current scroll position before locking
    savedScrollY = window.scrollY;

    // Apply fixed positioning to prevent iOS Safari scroll bleed-through.
    // overflow: hidden alone is insufficient on iOS — the body still scrolls
    // under touch events. position: fixed + top offset is the reliable fix.
    document.body.style.position = 'fixed';
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.overflow = 'hidden';
  }
  lockCount++;
}

function unlockBody() {
  lockCount--;
  if (lockCount <= 0) {
    lockCount = 0;

    // Remove fixed positioning and restore scroll position
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.overflow = '';

    // Restore the scroll position that was saved when locking.
    // Use behavior: 'instant' to override the global scroll-behavior: smooth
    // on <html>, which would otherwise cause a visible animated scroll.
    try {
      window.scrollTo({ top: savedScrollY, left: 0, behavior: 'instant' });
    } catch (e) {
      // scrollTo is not implemented in jsdom (test environment)
    }
  }
}

export function useScrollLock(active) {
  useEffect(() => {
    if (!active) return;

    lockBody();

    return () => {
      unlockBody();
    };
  }, [active]);
}

export default useScrollLock;

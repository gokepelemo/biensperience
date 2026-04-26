import { useEffect } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

/**
 * Trap focus within the element referenced by `ref` while `active` is true.
 * Tab from the last focusable element cycles to the first; Shift+Tab from the
 * first cycles to the last. Inactive trap is a no-op.
 *
 * @param {React.RefObject<HTMLElement>} ref
 * @param {boolean} active
 */
export function useFocusTrap(ref, active) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const node = ref.current;

    function handleKeyDown(e) {
      if (e.key !== 'Tab') return;
      const focusables = Array.from(node.querySelectorAll(FOCUSABLE_SELECTOR))
        .filter(el => !el.hasAttribute('inert'));
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement;

      if (e.shiftKey && current === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      }
    }

    node.addEventListener('keydown', handleKeyDown);
    return () => node.removeEventListener('keydown', handleKeyDown);
  }, [ref, active]);
}

import { useCallback, useEffect, useRef } from 'react';

const SWIPE_THRESHOLD = 60;
const HORIZONTAL_RATIO = 1.5;

export default function usePlanItemNavigation({ show, onPrev, onNext }) {
  const touchStartXRef = useRef(null);
  const touchStartYRef = useRef(null);

  useEffect(() => {
    if (!show || (!onPrev && !onNext)) return undefined;

    const isTypingTarget = (el) => {
      if (!el) return false;
      const tag = el.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
      const role = el.getAttribute?.('role');
      if (role === 'tab' || role === 'option') return true;
      if (el.isContentEditable) return true;
      // Walk ancestors so focus inside a contenteditable shadow / mention popover
      // / Stream Chat MessageInput counts even when the focused descendant is a
      // bare span/div without its own opt-out. data-bien-no-nav explicitly opts
      // a subtree out of arrow-key plan-item navigation.
      let node = el;
      while (node && node !== document.body) {
        if (node.dataset?.bienNoNav !== undefined) return true;
        if (node.isContentEditable) return true;
        const ce = node.getAttribute?.('contenteditable');
        if (ce === '' || ce === 'true' || ce === 'plaintext-only') return true;
        node = node.parentElement;
      }
      return false;
    };

    const handleKeyDown = (e) => {
      if (isTypingTarget(document.activeElement)) return;

      if (e.key === 'ArrowLeft' && onPrev) {
        e.preventDefault();
        onPrev();
      } else if (e.key === 'ArrowRight' && onNext) {
        e.preventDefault();
        onNext();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [show, onPrev, onNext]);

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length !== 1) {
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      return;
    }
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e) => {
      if (touchStartXRef.current === null) return;
      const dx = e.changedTouches[0].clientX - touchStartXRef.current;
      const dy = e.changedTouches[0].clientY - touchStartYRef.current;
      touchStartXRef.current = null;
      touchStartYRef.current = null;

      if (Math.abs(dx) < SWIPE_THRESHOLD) return;
      if (Math.abs(dx) < Math.abs(dy) * HORIZONTAL_RATIO) return;

      if (dx < 0 && onNext) {
        onNext();
      } else if (dx > 0 && onPrev) {
        onPrev();
      }
    },
    [onPrev, onNext]
  );

  return { handleTouchStart, handleTouchEnd };
}

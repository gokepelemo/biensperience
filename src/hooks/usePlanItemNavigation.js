import { useCallback, useEffect, useRef } from 'react';

const SWIPE_THRESHOLD = 60;
const HORIZONTAL_RATIO = 1.5;

export default function usePlanItemNavigation({ show, onPrev, onNext }) {
  const touchStartXRef = useRef(null);
  const touchStartYRef = useRef(null);

  useEffect(() => {
    if (!show || (!onPrev && !onNext)) return undefined;

    const handleKeyDown = (e) => {
      const el = document.activeElement;
      const tag = el?.tagName?.toLowerCase();
      const role = el?.getAttribute?.('role');
      if (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        el?.isContentEditable ||
        role === 'tab' ||
        role === 'option'
      ) {
        return;
      }

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

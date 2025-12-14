import { useEffect } from 'react';
import { logger } from '../utilities/logger';

// Hook: useButtonWidth
// - ref: React ref to the button element
// - texts: array of strings to measure (different button states)
// - options: { extraPadding: number (px) } optional padding to add to measured text
// The hook sets element.style.minWidth to the measured width in px.
export default function useButtonWidth(ref, texts = [], options = {}) {
  useEffect(() => {
    if (!ref || !ref.current || !texts || texts.length === 0) return;

    const el = ref.current;

    function compute() {
      try {
        const cs = window.getComputedStyle(el);
        // build a canvas to measure text width more reliably than DOM offscreen
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Construct font string from computed styles
        const fontStyle = `${cs.fontStyle || ''} ${cs.fontVariant || ''} ${cs.fontWeight || ''} ${cs.fontSize || 'inherit'}/${cs.lineHeight || 'normal'} ${cs.fontFamily || 'inherit'}`;
        ctx.font = fontStyle;

        let max = 0;
        texts.forEach(txt => {
          if (typeof txt !== 'string') return;
          const metrics = ctx.measureText(txt.trim());
          const w = metrics.width;
          if (w > max) max = w;
        });

        // Add padding and border widths from computed style
        const padLeft = parseFloat(cs.paddingLeft) || 0;
        const padRight = parseFloat(cs.paddingRight) || 0;
        const borderLeft = parseFloat(cs.borderLeftWidth) || 0;
        const borderRight = parseFloat(cs.borderRightWidth) || 0;
        const extra = options.extraPadding || 8; // small breathing room

        const total = Math.ceil(max + padLeft + padRight + borderLeft + borderRight + extra);

        // Apply as minWidth to avoid shrinking below measured size
        el.style.minWidth = total + 'px';
      } catch (err) {
        // fail silently - measurement not critical
        logger.warn('useButtonWidth measurement failed', { error: err.message });
      }
    }

    compute();

    // Recompute on resize and when fonts load
    window.addEventListener('resize', compute);
    if (document && document.fonts && document.fonts.ready) {
      document.fonts.ready.then(compute).catch(() => {});
    }

    return () => {
      window.removeEventListener('resize', compute);
    };
  }, [ref, texts, options.extraPadding]);
}

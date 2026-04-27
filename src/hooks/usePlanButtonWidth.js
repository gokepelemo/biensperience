/**
 * usePlanButtonWidth Hook
 *
 * Measures the maximum width needed for the plan/unplan button based on the
 * longest possible label so the button doesn't reflow when state toggles.
 *
 * Extracted from SingleExperience.jsx — pure relocation of existing behavior.
 *
 * @module hooks/usePlanButtonWidth
 */

import { useEffect, useState } from 'react';
import { lang } from '../lang.constants';

export default function usePlanButtonWidth() {
  const [planBtnWidth, setPlanBtnWidth] = useState(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const candidates = [
      lang.current.button.addFavoriteExp,
      lang.current.button.expPlanAdded,
      lang.current.button.removeFavoriteExp,
    ].filter(Boolean);

    const measure = (text) => {
      const el = document.createElement('button');
      el.className = 'btn btn-sm btn-icon btn-plan-add';
      el.style.visibility = 'hidden';
      el.style.position = 'absolute';
      el.style.pointerEvents = 'none';
      el.style.whiteSpace = 'nowrap';
      el.textContent = text;
      document.body.appendChild(el);
      const w = Math.ceil(el.offsetWidth);
      document.body.removeChild(el);
      return w;
    };

    try {
      const widths = candidates.map(measure);
      if (widths.length) {
        const maxW = Math.max(...widths) + 8;
        setPlanBtnWidth(maxW);
      }
    } catch (_) {
      // Ignore measurement errors
    }
  }, []);

  return [planBtnWidth, setPlanBtnWidth];
}

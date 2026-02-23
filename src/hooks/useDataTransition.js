import { useRef, useEffect, useState, useCallback } from 'react';
import { hashData } from '../utilities/data-hash';

/**
 * Hook that detects data changes via hashing and returns a CSS class
 * to apply a subtle transition animation.
 *
 * The hook skips animation on first render (mount) and only triggers
 * when the hash of the watched data actually changes.
 *
 * @param {*} data - The data to watch for changes
 * @param {Object} [options]
 * @param {'pulse'|'fade'|'highlight'} [options.animation='pulse'] - Animation type
 * @param {number} [options.duration=600] - Animation duration in ms
 * @param {string[]} [options.ignoreKeys] - Keys to exclude from hash comparison
 * @param {boolean} [options.enabled=true] - Whether to enable animations
 * @param {function} [options.selectFields] - Function to pick specific fields for comparison
 *
 * @returns {{ transitionClass: string, isTransitioning: boolean, triggerTransition: function }}
 */
export function useDataTransition(data, options = {}) {
  const {
    animation = 'pulse',
    duration = 600,
    ignoreKeys,
    enabled = true,
    selectFields = null,
  } = options;

  const hashRef = useRef(null);
  const isFirstRender = useRef(true);
  const timeoutRef = useRef(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const triggerTransition = useCallback(() => {
    if (!enabled) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setIsTransitioning(true);

    timeoutRef.current = setTimeout(() => {
      setIsTransitioning(false);
      timeoutRef.current = null;
    }, duration);
  }, [enabled, duration]);

  useEffect(() => {
    if (!enabled) return;

    const comparisonData = selectFields ? selectFields(data) : data;
    const currentHash = hashData(comparisonData, ignoreKeys ? { ignoreKeys } : undefined);

    // Skip first render — only animate changes, not initial load
    if (isFirstRender.current) {
      hashRef.current = currentHash;
      isFirstRender.current = false;
      return;
    }

    // Compare hashes — if different, data actually changed
    if (hashRef.current !== null && hashRef.current !== currentHash) {
      triggerTransition();
    }

    hashRef.current = currentHash;
  }); // Intentionally no deps — runs on every render to catch any data change

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const transitionClass = isTransitioning ? `data-transition-${animation}` : '';

  return {
    transitionClass,
    isTransitioning,
    triggerTransition,
  };
}

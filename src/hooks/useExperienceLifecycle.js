/**
 * useExperienceLifecycle Hook
 *
 * Lifecycle utilities for the SingleExperience view:
 *   - userInteractionRef + begin/endUserInteraction (counter-based, prevents
 *     hash effects from firing during user-driven mutations like toggling
 *     completion).
 *   - isUnmountingRef (set to true on unmount; consumed by hash routing/etc.
 *     to skip URL writes during unmount).
 *
 * Extracted from SingleExperience.jsx — pure relocation of existing behavior.
 *
 * @module hooks/useExperienceLifecycle
 */

import { useCallback, useEffect, useRef } from 'react';
import debug from '../utilities/debug';

export default function useExperienceLifecycle() {
  const userInteractionRef = useRef(0);
  const isUnmountingRef = useRef(false);

  const beginUserInteraction = useCallback((reason = 'unknown') => {
    userInteractionRef.current += 1;
    debug.log('[UserInteraction] begin', { reason, count: userInteractionRef.current });
  }, []);

  const endUserInteraction = useCallback((reason = 'unknown') => {
    userInteractionRef.current = Math.max(0, userInteractionRef.current - 1);
    debug.log('[UserInteraction] end', { reason, count: userInteractionRef.current });
  }, []);

  // Set unmounting flag when component unmounts
  useEffect(() => {
    return () => {
      isUnmountingRef.current = true;
    };
  }, []);

  return {
    userInteractionRef,
    isUnmountingRef,
    beginUserInteraction,
    endUserInteraction,
  };
}

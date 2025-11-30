/**
 * usePresence Hook
 *
 * Simplified wrapper around useWebSocketEvents for presence tracking.
 * Provides real-time collaboration awareness: who's online, who's typing,
 * and which tab collaborators are viewing.
 *
 * @module hooks/usePresence
 */

import { useEffect, useCallback, useRef } from 'react';
import { useWebSocketEvents, WS_EVENTS } from './useWebSocketEvents';
import { logger } from '../utilities/logger';

/**
 * Typing indicator debounce time in milliseconds.
 * After this time without typing, typing indicator is cleared.
 */
const TYPING_DEBOUNCE_MS = 2000;

/**
 * Hook for managing real-time presence in experience/plan views.
 *
 * @param {object} options - Configuration options
 * @param {string} options.experienceId - Experience ID to track presence for
 * @param {string} [options.planId] - Optional plan ID for plan-specific presence
 * @param {string} [options.initialTab='overview'] - Initial tab the user is viewing
 * @param {boolean} [options.enabled=true] - Whether to enable presence tracking
 * @returns {object} Presence state and controls
 *
 * @example
 * const {
 *   isConnected,
 *   experienceMembers,
 *   planMembers,
 *   typingUsers,
 *   setTyping,
 *   setTab
 * } = usePresence({
 *   experienceId: '123',
 *   planId: '456',
 *   initialTab: 'the-plan'
 * });
 */
export function usePresence({
  experienceId,
  planId,
  initialTab = 'overview',
  enabled = true
}) {
  const typingTimeoutRef = useRef(null);
  const currentTabRef = useRef(initialTab);

  const {
    isConnected,
    connectionError,
    subscribe,
    emit,
    joinExperience,
    leaveExperience,
    setExperienceTab,
    joinPlan,
    leavePlan,
    setTyping: wsSetTyping,
    experienceMembers,
    planMembers
  } = useWebSocketEvents();

  // Track typing users by field
  const typingUsersRef = useRef(new Map());

  // Join experience room on mount
  useEffect(() => {
    if (!enabled || !experienceId || !isConnected) return;

    logger.debug('[usePresence] Joining experience room', { experienceId, initialTab });
    joinExperience(experienceId, initialTab);

    return () => {
      logger.debug('[usePresence] Leaving experience room', { experienceId });
      leaveExperience(experienceId);
    };
  }, [enabled, experienceId, isConnected, initialTab, joinExperience, leaveExperience]);

  // Join plan room if planId provided
  useEffect(() => {
    if (!enabled || !planId || !isConnected) return;

    logger.debug('[usePresence] Joining plan room', { planId });
    joinPlan(planId);

    return () => {
      logger.debug('[usePresence] Leaving plan room', { planId });
      leavePlan(planId);
    };
  }, [enabled, planId, isConnected, joinPlan, leavePlan]);

  // Handle typing indicator with auto-clear
  const setTyping = useCallback((isTyping, field = 'default') => {
    if (!enabled || !isConnected) return;

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    wsSetTyping(isTyping, field);

    // Auto-clear typing after debounce time
    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        wsSetTyping(false, field);
        typingTimeoutRef.current = null;
      }, TYPING_DEBOUNCE_MS);
    }
  }, [enabled, isConnected, wsSetTyping]);

  // Update tab when user switches tabs
  const setTab = useCallback((tab) => {
    if (!enabled || !isConnected) return;
    if (tab === currentTabRef.current) return;

    currentTabRef.current = tab;
    setExperienceTab(tab);
    logger.debug('[usePresence] Tab changed', { tab });
  }, [enabled, isConnected, setExperienceTab]);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Get list of users currently typing
  const getTypingUsers = useCallback(() => {
    return Array.from(typingUsersRef.current.entries())
      .filter(([_, data]) => data.isTyping)
      .map(([userId, data]) => ({
        userId,
        field: data.field
      }));
  }, []);

  return {
    // Connection state
    isConnected,
    connectionError,

    // Room members
    experienceMembers,
    planMembers,

    // Typing
    setTyping,
    getTypingUsers,

    // Tab tracking
    setTab,

    // Low-level access for advanced use cases
    subscribe,
    emit
  };
}

/**
 * Hook specifically for plan room presence with typing indicators.
 * Use when you need plan-specific features like item editing.
 *
 * @param {string} planId - Plan ID
 * @param {object} [options] - Options
 * @param {boolean} [options.enabled=true] - Enable presence tracking
 * @returns {object} Plan presence state
 */
export function usePlanPresence(planId, { enabled = true } = {}) {
  const {
    isConnected,
    subscribe,
    joinPlan,
    leavePlan,
    setTyping: wsSetTyping,
    planMembers
  } = useWebSocketEvents();

  const typingTimeoutRef = useRef(null);
  const typingUsersRef = useRef(new Map());

  // Join plan room
  useEffect(() => {
    if (!enabled || !planId || !isConnected) return;

    joinPlan(planId);
    return () => leavePlan(planId);
  }, [enabled, planId, isConnected, joinPlan, leavePlan]);

  // Listen for typing events
  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = subscribe(WS_EVENTS.PRESENCE_UPDATED, (event) => {
      if (event.planId === planId && event.type === 'typing') {
        typingUsersRef.current.set(event.userId, {
          isTyping: event.isTyping,
          field: event.field,
          timestamp: Date.now()
        });
      }
    });

    return unsubscribe;
  }, [enabled, planId, subscribe]);

  // Set typing with auto-clear
  const setTyping = useCallback((isTyping, field = 'item') => {
    if (!enabled || !isConnected) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    wsSetTyping(isTyping, field);

    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        wsSetTyping(false, field);
      }, TYPING_DEBOUNCE_MS);
    }
  }, [enabled, isConnected, wsSetTyping]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const getTypingUsers = useCallback(() => {
    const now = Date.now();
    return Array.from(typingUsersRef.current.entries())
      .filter(([_, data]) => data.isTyping && (now - data.timestamp) < TYPING_DEBOUNCE_MS * 2)
      .map(([userId, data]) => ({
        userId,
        field: data.field
      }));
  }, []);

  return {
    isConnected,
    planMembers,
    setTyping,
    getTypingUsers
  };
}

export default usePresence;

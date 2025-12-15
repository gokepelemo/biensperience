/**
 * React Hook for WebSocket Event Subscription and Emission
 *
 * Provides a React-friendly interface to the EventBus with:
 * - Connection state management
 * - Event subscription with automatic cleanup
 * - Room-based presence (join/leave experience and plan rooms)
 * - Presence tracking for collaborative editing
 * - Automatic reconnection handling
 *
 * Room Types:
 * - Experience rooms: `experience:{experienceId}` - All users viewing an experience
 * - Plan rooms: `plan:{planId}` - Users collaborating on a specific plan
 * - Tab-specific: Bound to SingleExperience tabs (The Plan, My Plan, etc.)
 *
 * Uses the configured transport (localStorage, websocket, or hybrid)
 * from event-transport.js based on environment variables.
 *
 * @module useWebSocketEvents
 *
 * @example
 * // Basic usage
 * const { subscribe, emit, isConnected } = useWebSocketEvents();
 *
 * // Subscribe to plan updates
 * useEffect(() => {
 *   const unsubscribe = subscribe('plan:updated', (event) => {
 *     console.log('Plan updated:', event);
 *   });
 *   return unsubscribe;
 * }, [subscribe]);
 *
 * // Emit an event
 * emit('plan:item:completed', { planId, itemId });
 *
 * @example
 * // Experience room (SingleExperience view)
 * const { joinExperience, leaveExperience, experienceMembers } = useWebSocketEvents();
 * useEffect(() => {
 *   joinExperience(experienceId, activeTab);
 *   return () => leaveExperience(experienceId);
 * }, [experienceId, activeTab]);
 *
 * @example
 * // Plan room (collaborative editing)
 * const { joinPlan, leavePlan, planMembers } = useWebSocketEvents();
 * useEffect(() => {
 *   if (planId) joinPlan(planId);
 *   return () => leavePlan(planId);
 * }, [planId]);
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { eventBus } from '../utilities/event-bus';
import { logger } from '../utilities/logger';
import { ConnectionState } from '../utilities/event-transport';

/**
 * WebSocket event types for type safety
 */
export const WS_EVENTS = {
  // Experience events
  EXPERIENCE_CREATED: 'experience:created',
  EXPERIENCE_UPDATED: 'experience:updated',
  EXPERIENCE_DELETED: 'experience:deleted',

  // Plan events
  PLAN_CREATED: 'plan:created',
  PLAN_UPDATED: 'plan:updated',
  PLAN_DELETED: 'plan:deleted',

  // Plan item events
  PLAN_ITEM_ADDED: 'plan:item:added',
  PLAN_ITEM_UPDATED: 'plan:item:updated',
  PLAN_ITEM_DELETED: 'plan:item:deleted',
  PLAN_ITEM_COMPLETED: 'plan:item:completed',
  PLAN_ITEM_REORDERED: 'plan:item:reordered',

  // Collaborator events
  COLLABORATOR_JOINED: 'collaborator:joined',
  COLLABORATOR_LEFT: 'collaborator:left',
  COLLABORATOR_TYPING: 'collaborator:typing',

  // Presence events
  PRESENCE_ONLINE: 'presence:online',
  PRESENCE_OFFLINE: 'presence:offline',
  PRESENCE_JOINED: 'presence:joined',
  PRESENCE_LEFT: 'presence:left',
  PRESENCE_UPDATED: 'presence:updated',

  // Room events
  ROOM_JOINED: 'room:joined',
  ROOM_LEFT: 'room:left',

  // System events
  SYSTEM_CONNECTED: 'system:connected',
  SYSTEM_DISCONNECTED: 'system:disconnected',
  SYSTEM_ERROR: 'system:error'
};

/**
 * Hook for WebSocket event subscription and emission
 *
 * @param {object} options - Configuration options
 * @param {boolean} options.autoConnect - Auto-connect on mount (default: true)
 * @returns {object} WebSocket event utilities
 */
export function useWebSocketEvents(options = {}) {
  const { autoConnect = true } = options;

  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState(ConnectionState.DISCONNECTED);
  const [connectionError, setConnectionError] = useState(null);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Room state (legacy - plan-based)
  const [currentRoom, setCurrentRoom] = useState(null);
  const [roomMembers, setRoomMembers] = useState([]);

  // Experience room state
  const [currentExperience, setCurrentExperience] = useState(null);
  const [currentTab, setCurrentTab] = useState(null);
  const [experienceMembers, setExperienceMembers] = useState([]);

  // Plan room state
  const [currentPlan, setCurrentPlan] = useState(null);
  const [planMembers, setPlanMembers] = useState([]);

  // Presence state
  const [onlineUsers, setOnlineUsers] = useState(new Map());

  // Refs for stable callbacks
  const subscriptionsRef = useRef(new Map());
  const roomRef = useRef(null);
  const experienceRef = useRef(null);
  const planRef = useRef(null);
  const stateUnsubRef = useRef(null);

  /**
   * Check connection status and subscribe to state changes
   */
  const checkConnection = useCallback(() => {
    const transport = eventBus.transport;
    const connected = transport?.isConnected?.() || eventBus.transportReady || false;
    setIsConnected(connected);

    // Get current connection state from transport
    const currentState = transport?.getConnectionState?.() || ConnectionState.DISCONNECTED;
    setConnectionState(currentState);
    setIsReconnecting(currentState === ConnectionState.RECONNECTING);

    return connected;
  }, []);

  /**
   * Subscribe to an event type
   * Returns unsubscribe function for cleanup
   */
  const subscribe = useCallback((eventType, handler) => {
    logger.debug('[useWebSocketEvents] Subscribing', { eventType });

    // Subscribe via EventBus
    const unsubscribe = eventBus.subscribe(eventType, handler);

    // Track subscription for cleanup
    const subscriptionId = `${eventType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    subscriptionsRef.current.set(subscriptionId, unsubscribe);

    // Return combined unsubscribe that also cleans up our tracking
    return () => {
      unsubscribe();
      subscriptionsRef.current.delete(subscriptionId);
    };
  }, []);

  /**
   * Emit an event to other clients
   */
  const emit = useCallback((eventType, detail = {}, options = {}) => {
    logger.debug('[useWebSocketEvents] Emitting', { eventType, detail });

    // Include room info if in a room
    const payload = {
      ...detail,
      planId: detail.planId || roomRef.current
    };

    eventBus.emit(eventType, payload, options);
  }, []);

  /**
   * Join a plan room for real-time collaboration
   */
  const joinRoom = useCallback((planId) => {
    if (!planId) return;

    logger.info('[useWebSocketEvents] Joining room', { planId });
    roomRef.current = planId;
    setCurrentRoom(planId);

    // Emit room join event
    emit('room:join', { planId }, { localOnly: false });

    // Subscribe to room-specific events
    const unsubJoined = subscribe(WS_EVENTS.ROOM_JOINED, (event) => {
      if (event.planId === planId) {
        setRoomMembers(event.members || []);
      }
    });

    const unsubPresenceJoined = subscribe(WS_EVENTS.PRESENCE_JOINED, (event) => {
      if (event.planId === planId || !event.planId) {
        setRoomMembers(prev => {
          const exists = prev.some(m => m.userId === event.userId);
          if (exists) return prev;
          return [...prev, { userId: event.userId, sessionId: event.sessionId }];
        });
      }
    });

    const unsubPresenceLeft = subscribe(WS_EVENTS.PRESENCE_LEFT, (event) => {
      if (event.planId === planId || !event.planId) {
        setRoomMembers(prev => prev.filter(m => m.sessionId !== event.sessionId));
      }
    });

    // Store unsubscribers for cleanup
    subscriptionsRef.current.set(`room_${planId}_joined`, unsubJoined);
    subscriptionsRef.current.set(`room_${planId}_presence_joined`, unsubPresenceJoined);
    subscriptionsRef.current.set(`room_${planId}_presence_left`, unsubPresenceLeft);
  }, [emit, subscribe]);

  /**
   * Leave current room
   */
  const leaveRoom = useCallback((planId) => {
    const roomToLeave = planId || roomRef.current;
    if (!roomToLeave) return;

    logger.info('[useWebSocketEvents] Leaving room', { planId: roomToLeave });

    // Emit room leave event
    emit('room:leave', { planId: roomToLeave }, { localOnly: false });

    // Clean up room subscriptions
    const roomKeys = Array.from(subscriptionsRef.current.keys())
      .filter(key => key.startsWith(`room_${roomToLeave}`));

    roomKeys.forEach(key => {
      const unsub = subscriptionsRef.current.get(key);
      if (unsub) unsub();
      subscriptionsRef.current.delete(key);
    });

    if (roomRef.current === roomToLeave) {
      roomRef.current = null;
      setCurrentRoom(null);
      setRoomMembers([]);
    }
  }, [emit]);

  /**
   * Join an experience room (SingleExperience view)
   * Tracks which tab the user is viewing for presence
   *
   * @param {string} experienceId - Experience ID
   * @param {string} tab - Current tab (e.g., 'the-plan', 'my-plan', 'overview')
   */
  const joinExperience = useCallback((experienceId, tab = 'overview') => {
    if (!experienceId) return;

    const roomId = `experience:${experienceId}`;
    logger.info('[useWebSocketEvents] Joining experience room', { experienceId, tab, roomId });

    experienceRef.current = experienceId;
    setCurrentExperience(experienceId);
    setCurrentTab(tab);

    // Emit room join with tab info
    emit('room:join', {
      roomId,
      experienceId,
      tab,
      type: 'experience'
    }, { localOnly: false });

    // Subscribe to presence updates for this experience
    const unsubJoined = subscribe(WS_EVENTS.ROOM_JOINED, (event) => {
      if (event.experienceId === experienceId || event.roomId === roomId) {
        setExperienceMembers(event.members || []);
      }
    });

    const unsubPresenceJoined = subscribe(WS_EVENTS.PRESENCE_JOINED, (event) => {
      if (event.experienceId === experienceId || event.roomId === roomId) {
        setExperienceMembers(prev => {
          const exists = prev.some(m => m.sessionId === event.sessionId);
          if (exists) {
            // Update existing member's tab
            return prev.map(m => m.sessionId === event.sessionId
              ? { ...m, tab: event.tab }
              : m
            );
          }
          return [...prev, {
            userId: event.userId,
            sessionId: event.sessionId,
            tab: event.tab
          }];
        });
      }
    });

    const unsubPresenceLeft = subscribe(WS_EVENTS.PRESENCE_LEFT, (event) => {
      if (event.experienceId === experienceId || event.roomId === roomId) {
        setExperienceMembers(prev => prev.filter(m => m.sessionId !== event.sessionId));
      }
    });

    const unsubTabChange = subscribe(WS_EVENTS.PRESENCE_UPDATED, (event) => {
      if ((event.experienceId === experienceId || event.roomId === roomId) && event.type === 'tab_change') {
        setExperienceMembers(prev => prev.map(m =>
          m.sessionId === event.sessionId ? { ...m, tab: event.tab } : m
        ));
      }
    });

    // Store unsubscribers
    subscriptionsRef.current.set(`experience_${experienceId}_joined`, unsubJoined);
    subscriptionsRef.current.set(`experience_${experienceId}_presence_joined`, unsubPresenceJoined);
    subscriptionsRef.current.set(`experience_${experienceId}_presence_left`, unsubPresenceLeft);
    subscriptionsRef.current.set(`experience_${experienceId}_tab_change`, unsubTabChange);
  }, [emit, subscribe]);

  /**
   * Leave an experience room
   */
  const leaveExperience = useCallback((experienceId) => {
    const expToLeave = experienceId || experienceRef.current;
    if (!expToLeave) return;

    const roomId = `experience:${expToLeave}`;
    logger.info('[useWebSocketEvents] Leaving experience room', { experienceId: expToLeave, roomId });

    emit('room:leave', { roomId, experienceId: expToLeave, type: 'experience' }, { localOnly: false });

    // Clean up subscriptions
    const expKeys = Array.from(subscriptionsRef.current.keys())
      .filter(key => key.startsWith(`experience_${expToLeave}`));

    expKeys.forEach(key => {
      const unsub = subscriptionsRef.current.get(key);
      if (unsub) unsub();
      subscriptionsRef.current.delete(key);
    });

    if (experienceRef.current === expToLeave) {
      experienceRef.current = null;
      setCurrentExperience(null);
      setCurrentTab(null);
      setExperienceMembers([]);
    }
  }, [emit]);

  /**
   * Update current tab within experience (notifies other viewers)
   */
  const setExperienceTab = useCallback((tab) => {
    if (!experienceRef.current) return;

    setCurrentTab(tab);
    emit('presence:update', {
      experienceId: experienceRef.current,
      roomId: `experience:${experienceRef.current}`,
      type: 'tab_change',
      tab,
      timestamp: Date.now()
    }, { localOnly: false });
  }, [emit]);

  /**
   * Join a plan room for collaborative editing
   */
  const joinPlan = useCallback((planId) => {
    if (!planId) return;

    const roomId = `plan:${planId}`;
    logger.info('[useWebSocketEvents] Joining plan room', { planId, roomId });

    planRef.current = planId;
    setCurrentPlan(planId);

    emit('room:join', { roomId, planId, type: 'plan' }, { localOnly: false });

    const unsubJoined = subscribe(WS_EVENTS.ROOM_JOINED, (event) => {
      if (event.planId === planId || event.roomId === roomId) {
        setPlanMembers(event.members || []);
      }
    });

    const unsubPresenceJoined = subscribe(WS_EVENTS.PRESENCE_JOINED, (event) => {
      if (event.planId === planId || event.roomId === roomId) {
        setPlanMembers(prev => {
          const exists = prev.some(m => m.sessionId === event.sessionId);
          if (exists) return prev;
          return [...prev, { userId: event.userId, sessionId: event.sessionId }];
        });
      }
    });

    const unsubPresenceLeft = subscribe(WS_EVENTS.PRESENCE_LEFT, (event) => {
      if (event.planId === planId || event.roomId === roomId) {
        setPlanMembers(prev => prev.filter(m => m.sessionId !== event.sessionId));
      }
    });

    subscriptionsRef.current.set(`plan_${planId}_joined`, unsubJoined);
    subscriptionsRef.current.set(`plan_${planId}_presence_joined`, unsubPresenceJoined);
    subscriptionsRef.current.set(`plan_${planId}_presence_left`, unsubPresenceLeft);
  }, [emit, subscribe]);

  /**
   * Leave a plan room
   */
  const leavePlan = useCallback((planId) => {
    const planToLeave = planId || planRef.current;
    if (!planToLeave) return;

    const roomId = `plan:${planToLeave}`;
    logger.info('[useWebSocketEvents] Leaving plan room', { planId: planToLeave, roomId });

    emit('room:leave', { roomId, planId: planToLeave, type: 'plan' }, { localOnly: false });

    const planKeys = Array.from(subscriptionsRef.current.keys())
      .filter(key => key.startsWith(`plan_${planToLeave}`));

    planKeys.forEach(key => {
      const unsub = subscriptionsRef.current.get(key);
      if (unsub) unsub();
      subscriptionsRef.current.delete(key);
    });

    if (planRef.current === planToLeave) {
      planRef.current = null;
      setCurrentPlan(null);
      setPlanMembers([]);
    }
  }, [emit]);

  /**
   * Update presence (e.g., typing indicator, cursor position)
   */
  const updatePresence = useCallback((presenceData) => {
    // Send to current context (plan or experience)
    const context = planRef.current
      ? { planId: planRef.current, roomId: `plan:${planRef.current}` }
      : experienceRef.current
        ? { experienceId: experienceRef.current, roomId: `experience:${experienceRef.current}` }
        : roomRef.current
          ? { planId: roomRef.current }
          : null;

    if (!context) return;

    emit('presence:update', {
      ...context,
      ...presenceData
    }, { localOnly: false });
  }, [emit]);

  /**
   * Send typing indicator
   */
  const setTyping = useCallback((isTyping, field = 'general') => {
    updatePresence({
      type: 'typing',
      isTyping,
      field,
      timestamp: Date.now()
    });
  }, [updatePresence]);

  // Monitor connection status
  useEffect(() => {
    if (!autoConnect) return;

    // Check initial connection status
    checkConnection();

    // Subscribe to transport state changes (if available)
    const transport = eventBus.transport;
    if (transport?.onStateChange) {
      stateUnsubRef.current = transport.onStateChange((state) => {
        setConnectionState(state);
        setIsConnected(state === ConnectionState.CONNECTED);
        setIsReconnecting(state === ConnectionState.RECONNECTING);

        if (state === ConnectionState.FAILED) {
          setConnectionError('Connection failed after maximum reconnection attempts');
        } else if (state === ConnectionState.CONNECTED) {
          setConnectionError(null);
        }

        logger.debug('[useWebSocketEvents] Connection state changed', { state });
      });
    }

    // Subscribe to connection events (for backward compatibility)
    const unsubConnected = subscribe(WS_EVENTS.SYSTEM_CONNECTED, () => {
      setIsConnected(true);
      setConnectionState(ConnectionState.CONNECTED);
      setConnectionError(null);
    });

    const unsubDisconnected = subscribe(WS_EVENTS.SYSTEM_DISCONNECTED, () => {
      setIsConnected(false);
      setConnectionState(ConnectionState.DISCONNECTED);
    });

    const unsubError = subscribe(WS_EVENTS.SYSTEM_ERROR, (event) => {
      setConnectionError(event.error || 'Connection error');
    });

    // Poll connection status periodically (less frequently since we have state subscription)
    const interval = setInterval(checkConnection, 10000);

    return () => {
      if (stateUnsubRef.current) {
        stateUnsubRef.current();
        stateUnsubRef.current = null;
      }
      unsubConnected();
      unsubDisconnected();
      unsubError();
      clearInterval(interval);
    };
  }, [autoConnect, checkConnection, subscribe]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Leave any rooms
      if (roomRef.current) leaveRoom(roomRef.current);
      if (experienceRef.current) leaveExperience(experienceRef.current);
      if (planRef.current) leavePlan(planRef.current);

      // Unsubscribe all
      subscriptionsRef.current.forEach(unsub => unsub());
      subscriptionsRef.current.clear();
    };
  }, [leaveRoom, leaveExperience, leavePlan]);

  return {
    // Connection state
    isConnected,
    connectionState,
    connectionError,
    isReconnecting,

    // Core event functions
    subscribe,
    emit,

    // Experience room management (SingleExperience view)
    joinExperience,
    leaveExperience,
    setExperienceTab,
    currentExperience,
    currentTab,
    experienceMembers,

    // Plan room management (collaborative editing)
    joinPlan,
    leavePlan,
    currentPlan,
    planMembers,

    // Legacy room management (backwards compatible)
    joinRoom,
    leaveRoom,
    currentRoom,
    roomMembers,

    // Presence
    updatePresence,
    setTyping,
    onlineUsers,

    // Utilities
    checkConnection,
    sessionId: eventBus.getSessionId(),
    getVectorClock: eventBus.getVectorClock.bind(eventBus),
    getTransportType: () => eventBus.getTransportType(),
    isWebSocketConnected: () => eventBus.isWebSocketConnected(),
    isEncrypted: () => eventBus.transport?.isEncrypted?.() || false,

    // Event type constants
    events: WS_EVENTS,
    ConnectionState
  };
}

/**
 * Hook for subscribing to a specific plan's events
 *
 * @param {string} planId - Plan ID to subscribe to
 * @param {object} handlers - Event handlers
 * @returns {object} Room state and utilities
 *
 * @example
 * const { roomMembers, isConnected } = usePlanRoom(planId, {
 *   onItemAdded: (event) => console.log('Item added'),
 *   onItemCompleted: (event) => console.log('Item completed'),
 *   onMemberJoined: (event) => console.log('Member joined')
 * });
 */
export function usePlanRoom(planId, handlers = {}) {
  const {
    subscribe,
    emit,
    isConnected,
    joinRoom,
    leaveRoom,
    roomMembers,
    setTyping,
    events
  } = useWebSocketEvents();

  // Join room when planId changes
  useEffect(() => {
    if (!planId) return;

    joinRoom(planId);

    return () => {
      leaveRoom(planId);
    };
  }, [planId, joinRoom, leaveRoom]);

  // Set up event handlers
  useEffect(() => {
    if (!planId) return;

    const unsubscribers = [];

    // Plan item events
    if (handlers.onItemAdded) {
      unsubscribers.push(subscribe(events.PLAN_ITEM_ADDED, (event) => {
        if (event.planId === planId) handlers.onItemAdded(event);
      }));
    }

    if (handlers.onItemUpdated) {
      unsubscribers.push(subscribe(events.PLAN_ITEM_UPDATED, (event) => {
        if (event.planId === planId) handlers.onItemUpdated(event);
      }));
    }

    if (handlers.onItemDeleted) {
      unsubscribers.push(subscribe(events.PLAN_ITEM_DELETED, (event) => {
        if (event.planId === planId) handlers.onItemDeleted(event);
      }));
    }

    if (handlers.onItemCompleted) {
      unsubscribers.push(subscribe(events.PLAN_ITEM_COMPLETED, (event) => {
        if (event.planId === planId) handlers.onItemCompleted(event);
      }));
    }

    if (handlers.onItemReordered) {
      unsubscribers.push(subscribe(events.PLAN_ITEM_REORDERED, (event) => {
        if (event.planId === planId) handlers.onItemReordered(event);
      }));
    }

    // Presence events
    if (handlers.onMemberJoined) {
      unsubscribers.push(subscribe(events.PRESENCE_JOINED, (event) => {
        handlers.onMemberJoined(event);
      }));
    }

    if (handlers.onMemberLeft) {
      unsubscribers.push(subscribe(events.PRESENCE_LEFT, (event) => {
        handlers.onMemberLeft(event);
      }));
    }

    if (handlers.onTyping) {
      unsubscribers.push(subscribe(events.PRESENCE_UPDATED, (event) => {
        if (event.type === 'typing') handlers.onTyping(event);
      }));
    }

    // Plan-level events
    if (handlers.onPlanUpdated) {
      unsubscribers.push(subscribe(events.PLAN_UPDATED, (event) => {
        if (event.planId === planId) handlers.onPlanUpdated(event);
      }));
    }

    if (handlers.onPlanDeleted) {
      unsubscribers.push(subscribe(events.PLAN_DELETED, (event) => {
        if (event.planId === planId) handlers.onPlanDeleted(event);
      }));
    }

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [planId, handlers, subscribe, events]);

  return {
    isConnected,
    roomMembers,
    emit,
    setTyping
  };
}

export default useWebSocketEvents;

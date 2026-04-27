import { useState, useCallback, useEffect } from 'react';
import { unstable_batchedUpdates as batchedUpdates } from 'react-dom';
import {
  getSessions,
  resumeSession as resumeSessionAPI,
  deleteSession as deleteSessionAPI,
  addSessionCollaborator as addCollaboratorAPI,
  removeSessionCollaborator as removeCollaboratorAPI,
} from '../utilities/bienbot-api';
import { eventBus } from '../utilities/event-bus';
import { logger } from '../utilities/logger';
import { encryptData, decryptData } from '../utilities/crypto-utils';

const ACTIVE_SESSION_KEY = 'bien:bienbot_active_session';

/**
 * useSessionManager — owns the BienBot session slice:
 *   - sessions list + currentSession
 *   - encrypted localStorage persistence (persist / clear / read)
 *   - session lifecycle (load / fetch / delete / share / unshare / clear / reset)
 *   - cross-tab event subscriptions for `bienbot:session_*`
 *   - initial-session bootstrap on mount when `initialSessionId` is provided
 *
 * Pure relocation of the session-management surface out of `useBienBot.js`.
 *
 * @param {Object} params
 * @param {string|null} [params.initialSessionId]      - Resume this session on mount
 * @param {string|null} [params.userId]                - Current user id (used to scope persistence + cross-tab event filtering)
 * @param {Object}      [params.invokeContext]         - Entity context forwarded to resumeSession
 * @param {Object}      params.sessionIdRef            - Ref kept in sync with the active session id
 * @param {Object}      params.invokeContextSentRef    - Ref tracking whether invokeContext has been forwarded
 * @param {Function}    params.setMessages             - React setter for the messages array
 * @param {Function}    params.setPendingActions       - React setter for the pending-actions list
 * @param {Function}    params.setSuggestedNextSteps   - React setter for the suggested-next-steps list
 * @param {Function}    params.setIsLoading            - React setter for the global loading flag
 * @param {Function}    params.setIsStreaming          - React setter for the streaming flag (cleared by clearSession/resetSession)
 * @param {Function}    params.cancelStream            - Cancel any in-flight SSE stream
 *
 * @returns {{
 *   sessions: Array,
 *   currentSession: Object|null,
 *   setCurrentSession: Function,
 *   persistSessionId: (sid: string) => Promise<void>,
 *   clearPersistedSession: () => void,
 *   getPersistedSession: () => Promise<Object|null>,
 *   loadSession: (sid: string) => Promise<void>,
 *   fetchSessions: (options?: Object) => Promise<void>,
 *   deleteSession: (sid: string) => Promise<void>,
 *   shareSession: (userId: string, role?: string) => Promise<Object|null>,
 *   unshareSession: (userId: string) => Promise<Object|null>,
 *   clearSession: () => void,
 *   resetSession: () => void,
 * }}
 */
export default function useSessionManager({
  initialSessionId = null,
  userId = null,
  invokeContext,
  sessionIdRef,
  invokeContextSentRef,
  setMessages,
  setPendingActions,
  setSuggestedNextSteps,
  setIsLoading,
  setIsStreaming,
  cancelStream,
}) {
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);

  // Keep sessionIdRef in sync with currentSession
  useEffect(() => {
    if (currentSession?._id) {
      sessionIdRef.current = currentSession._id;
    }
  }, [currentSession, sessionIdRef]);

  // ---------------------------------------------------------------------------
  // Session persistence (localStorage) — AES-GCM encrypted
  // ---------------------------------------------------------------------------

  /** Persist active session ID to encrypted localStorage. */
  const persistSessionId = useCallback(async (sid) => {
    if (!sid || !userId) return;
    try {
      const encrypted = await encryptData({ sessionId: sid, userId }, userId);
      localStorage.setItem(ACTIVE_SESSION_KEY, encrypted);
    } catch (err) {
      logger.debug('[useBienBot] Failed to persist session', { error: err?.message });
    }
  }, [userId]);

  /** Clear persisted session ID from localStorage. */
  const clearPersistedSession = useCallback(() => {
    try {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
    } catch {
      // ignore
    }
  }, []);

  /** Read persisted session ID (returns Promise<{ sessionId, userId } | null>). */
  const getPersistedSession = useCallback(async () => {
    try {
      const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
      if (!raw || !userId) return null;
      return await decryptData(raw, userId);
    } catch {
      return null;
    }
  }, [userId]);

  // ---------------------------------------------------------------------------
  // Session management
  // ---------------------------------------------------------------------------

  /**
   * Load (resume) a past session. Inserts the server greeting as the first message
   * and populates suggestedNextSteps from the greeting.
   *
   * @param {string} sid - Session ID to resume
   */
  const loadSession = useCallback(async (sid) => {
    if (!sid) return;

    setIsLoading(true);
    try {
      const currentPageContext = invokeContext?.entity && invokeContext?.id
        ? { entity: invokeContext.entity, id: invokeContext.id, label: invokeContext.label }
        : null;
      const result = await resumeSessionAPI(sid, currentPageContext);
      const { session, greeting } = result || {};

      if (!session) {
        logger.warn('[useBienBot] No session returned from resume', { sid });
        return;
      }

      sessionIdRef.current = session._id;
      invokeContextSentRef.current = true; // Resumed sessions already have context
      persistSessionId(session._id);

      batchedUpdates(() => {
        setCurrentSession(session);
        setPendingActions(
          (session.pending_actions || []).filter(a => !a.executed)
        );

        // Build initial messages: greeting + any existing history
        const initialMessages = [];

        if (greeting) {
          const greetingContent = greeting.text || greeting.message || (typeof greeting === 'string' ? greeting : '');
          if (greetingContent) {
            initialMessages.push({
              _id: `greeting-${Date.now()}`,
              role: 'assistant',
              content: greetingContent,
              createdAt: new Date().toISOString()
            });
          }

          // Extract suggested_next_steps from greeting
          if (greeting.suggested_next_steps?.length) {
            setSuggestedNextSteps(greeting.suggested_next_steps);
          } else {
            setSuggestedNextSteps([]);
          }
        }

        // Append session message history if present
        if (session.messages?.length) {
          initialMessages.push(...session.messages);
        }

        setMessages(initialMessages);
      });
    } catch (err) {
      logger.error('[useBienBot] Failed to load session', { error: err.message, sid });
    } finally {
      setIsLoading(false);
    }
  }, [
    persistSessionId,
    invokeContext,
    sessionIdRef,
    invokeContextSentRef,
    setIsLoading,
    setMessages,
    setPendingActions,
    setSuggestedNextSteps,
  ]);

  /**
   * Clear the current session state. Does NOT delete the session server-side.
   */
  const clearSession = useCallback(() => {
    cancelStream();
    clearPersistedSession();

    batchedUpdates(() => {
      sessionIdRef.current = null;
      invokeContextSentRef.current = false;
      setCurrentSession(null);
      setMessages([]);
      setPendingActions([]);
      setSuggestedNextSteps([]);
      setIsLoading(false);
      setIsStreaming(false);
    });
  }, [
    cancelStream,
    clearPersistedSession,
    sessionIdRef,
    invokeContextSentRef,
    setMessages,
    setPendingActions,
    setSuggestedNextSteps,
    setIsLoading,
    setIsStreaming,
  ]);

  /**
   * Reset session tracking without clearing messages or suggested prompts.
   * Used when the user navigates to a new entity without sending any messages,
   * so the analysis greeting for the new entity can be shown while ensuring the
   * next message creates a fresh session anchored to the new entity.
   */
  const resetSession = useCallback(() => {
    cancelStream();
    clearPersistedSession();

    batchedUpdates(() => {
      sessionIdRef.current = null;
      invokeContextSentRef.current = false;
      setCurrentSession(null);
      setPendingActions([]);
      setIsLoading(false);
      setIsStreaming(false);
      // Intentionally does NOT clear messages or suggestedNextSteps so the
      // analysis greeting for the new entity remains visible.
    });
  }, [
    cancelStream,
    clearPersistedSession,
    sessionIdRef,
    invokeContextSentRef,
    setPendingActions,
    setIsLoading,
    setIsStreaming,
  ]);

  /**
   * Delete a session server-side. Only the session owner may do this.
   * Directly updates local state after successful API call for immediate feedback.
   *
   * @param {string} sid - Session ID to delete
   * @returns {Promise<void>}
   */
  const deleteSession = useCallback(async (sid) => {
    if (!sid) return;
    try {
      await deleteSessionAPI(sid);
      // Directly update state after successful API call (don't rely solely on event bus)
      setSessions(prev => prev.filter(s => s._id !== sid));
      if (sessionIdRef.current === sid) {
        clearSession();
      }
    } catch (err) {
      logger.error('[useBienBot] Failed to delete session', { error: err.message, sid });
      throw err;
    }
  }, [clearSession, sessionIdRef]);

  // ---------------------------------------------------------------------------
  // Fetch sessions list
  // ---------------------------------------------------------------------------

  /**
   * Refresh the sessions list from the server.
   *
   * @param {Object} [options] - Filter options ({ status })
   */
  const fetchSessions = useCallback(async (options) => {
    try {
      const result = await getSessions(options);
      setSessions(result?.sessions || []);
    } catch (err) {
      logger.error('[useBienBot] Failed to fetch sessions', { error: err.message });
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Load initial session if provided
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (initialSessionId) {
      loadSession(initialSessionId);
    }
  }, [initialSessionId, loadSession]);

  // ---------------------------------------------------------------------------
  // Event subscriptions — keep sessions list in sync
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const unsubDeleted = eventBus.subscribe('bienbot:session_deleted', (event) => {
      const deletedId = event.sessionId;
      if (deletedId) {
        setSessions(prev => prev.filter(s => s._id !== deletedId));
        // If the deleted session is the current one, clear it
        if (sessionIdRef.current === deletedId) {
          clearSession();
        }
      }
    });

    const unsubResumed = eventBus.subscribe('bienbot:session_resumed', (event) => {
      const resumedId = event.sessionId;
      if (resumedId) {
        // Move resumed session to top of list
        setSessions(prev => {
          const session = prev.find(s => s._id === resumedId);
          if (!session) return prev;
          return [session, ...prev.filter(s => s._id !== resumedId)];
        });
      }
    });

    const unsubCreated = eventBus.subscribe('bienbot:session_created', (event) => {
      const { sessionId: createdId, userId: creatorId } = event;
      // Only react to sessions created by this user in another tab
      if (createdId && creatorId === userId && createdId !== sessionIdRef.current) {
        fetchSessions();
      }
    });

    return () => {
      unsubDeleted();
      unsubResumed();
      unsubCreated();
    };
  }, [clearSession, fetchSessions, userId, sessionIdRef]);

  // ---------------------------------------------------------------------------
  // Session sharing
  // ---------------------------------------------------------------------------

  /**
   * Share the current session with another user.
   *
   * @param {string} userId - User ID to share with
   * @param {string} [role='viewer'] - 'viewer' or 'editor'
   * @returns {Promise<Object|null>} Updated shared_with list, or null on error
   */
  const shareSession = useCallback(async (userId, role = 'viewer') => {
    const sid = sessionIdRef.current;
    if (!sid || !userId) return null;

    try {
      const result = await addCollaboratorAPI(sid, userId, role);
      if (result?.shared_with) {
        setCurrentSession(prev => prev ? { ...prev, shared_with: result.shared_with } : prev);
      }
      return result;
    } catch (err) {
      logger.error('[useBienBot] Failed to share session', { error: err.message });
      return null;
    }
  }, [sessionIdRef]);

  /**
   * Remove a collaborator from the current session.
   *
   * @param {string} userId - User ID to remove
   * @returns {Promise<Object|null>} Updated shared_with list, or null on error
   */
  const unshareSession = useCallback(async (userId) => {
    const sid = sessionIdRef.current;
    if (!sid || !userId) return null;

    try {
      const result = await removeCollaboratorAPI(sid, userId);
      if (result?.shared_with) {
        setCurrentSession(prev => prev ? { ...prev, shared_with: result.shared_with } : prev);
      }
      return result;
    } catch (err) {
      logger.error('[useBienBot] Failed to unshare session', { error: err.message });
      return null;
    }
  }, [sessionIdRef]);

  return {
    sessions,
    currentSession,
    setCurrentSession,
    persistSessionId,
    clearPersistedSession,
    getPersistedSession,
    loadSession,
    fetchSessions,
    deleteSession,
    shareSession,
    unshareSession,
    clearSession,
    resetSession,
  };
}

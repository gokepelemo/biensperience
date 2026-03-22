import { useState, useCallback, useRef, useEffect } from 'react';
import { unstable_batchedUpdates as batchedUpdates } from 'react-dom';
import {
  postMessage,
  getSessions,
  getSession,
  resumeSession as resumeSessionAPI,
  executeActions as executeActionsAPI,
  cancelAction as cancelActionAPI,
  deleteSession as deleteSessionAPI,
  updateSessionContext as updateSessionContextAPI,
  addSessionCollaborator as addCollaboratorAPI,
  removeSessionCollaborator as removeCollaboratorAPI
} from '../utilities/bienbot-api';
import { eventBus } from '../utilities/event-bus';
import { logger } from '../utilities/logger';

/**
 * useBienBot — manages BienBot conversation state, SSE streaming,
 * pending actions, and session lifecycle.
 *
 * @param {Object} params
 * @param {string|null} [params.sessionId] - Existing session to load, or null for a new session
 * @param {Object} [params.invokeContext] - Entity context ({ entity, id, label }) from the mounting component
 * @returns {Object} BienBot state and actions
 */
export default function useBienBot({ sessionId: initialSessionId = null, invokeContext } = {}) {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [pendingActions, setPendingActions] = useState([]);
  const [suggestedNextSteps, setSuggestedNextSteps] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  // ---------------------------------------------------------------------------
  // Refs
  // ---------------------------------------------------------------------------
  const abortControllerRef = useRef(null);
  const sessionIdRef = useRef(initialSessionId);
  const invokeContextSentRef = useRef(false);

  // Keep sessionIdRef in sync with currentSession
  useEffect(() => {
    if (currentSession?._id) {
      sessionIdRef.current = currentSession._id;
    }
  }, [currentSession]);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Cancel any in-flight SSE stream. */
  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // ---------------------------------------------------------------------------
  // sendMessage
  // ---------------------------------------------------------------------------

  /**
   * Send a user message. Auto-creates a session on first send if sessionId is null.
   * invokeContext is forwarded only on the very first send.
   *
   * @param {string} text - User message text
   * @param {File} [attachment] - Optional file attachment to extract text from
   */
  const sendMessage = useCallback(async (text, attachment) => {
    if (!text?.trim()) return;

    // Clear suggested next steps when user sends a new message
    setSuggestedNextSteps([]);

    // Optimistic: append user message immediately
    const userMessage = {
      _id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
      attachments: attachment ? [{ filename: attachment.name, mimeType: attachment.type, fileSize: attachment.size }] : []
    };

    setMessages(prev => [...prev, userMessage]);

    // Prepare streaming state
    const assistantMessageId = `temp-${Date.now()}-assistant`;
    let streamedContent = '';

    batchedUpdates(() => {
      setIsLoading(true);
      setIsStreaming(true);
    });

    // Append a placeholder assistant message to accumulate tokens into
    setMessages(prev => [...prev, {
      _id: assistantMessageId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString()
    }]);

    // Set up abort controller
    cancelStream();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Determine whether to send invokeContext (only when present and not yet sent)
    const sid = sessionIdRef.current;
    const shouldSendContext = !sid && invokeContext?.entity && invokeContext?.id && !invokeContextSentRef.current;

    try {
      await postMessage(sid, text, {
        invokeContext: shouldSendContext ? invokeContext : undefined,
        attachment: attachment || undefined,
        signal: controller.signal,

        onSession: ({ sessionId: newSessionId, title }) => {
          sessionIdRef.current = newSessionId;
          if (shouldSendContext) {
            invokeContextSentRef.current = true;
          }
          setCurrentSession(prev => ({
            ...(prev || {}),
            _id: newSessionId,
            title: title || prev?.title
          }));
        },

        onToken: (tokenText) => {
          streamedContent += tokenText;
          const captured = streamedContent;
          setMessages(prev =>
            prev.map(m =>
              m._id === assistantMessageId
                ? { ...m, content: captured }
                : m
            )
          );
        },

        onActions: (actions) => {
          setPendingActions(actions || []);
        },

        onDone: () => {
          batchedUpdates(() => {
            setIsStreaming(false);
            setIsLoading(false);
          });
          abortControllerRef.current = null;
        },

        onError: (error) => {
          logger.error('[useBienBot] Stream error', { error: error.message });
          batchedUpdates(() => {
            setIsStreaming(false);
            setIsLoading(false);
          });
          // Update the assistant message with an error indicator
          setMessages(prev =>
            prev.map(m =>
              m._id === assistantMessageId
                ? { ...m, content: streamedContent || error.message || 'Something went wrong. Please try again.', error: true }
                : m
            )
          );
          abortControllerRef.current = null;
        }
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        logger.debug('[useBienBot] Message send aborted');
      } else {
        logger.error('[useBienBot] Failed to send message', { error: err.message });
        setMessages(prev =>
          prev.map(m =>
            m._id === assistantMessageId
              ? { ...m, content: err.message || 'Something went wrong. Please try again.', error: true }
              : m
          )
        );
      }
      batchedUpdates(() => {
        setIsStreaming(false);
        setIsLoading(false);
      });
      abortControllerRef.current = null;
    }
  }, [invokeContext, cancelStream]);

  // ---------------------------------------------------------------------------
  // executeActions
  // ---------------------------------------------------------------------------

  /**
   * Execute pending actions by IDs.
   * Entity events are emitted by bienbot-api.js automatically.
   *
   * @param {string[]} actionIds - Action IDs to execute
   * @returns {Promise<Object|null>} Execution result or null on error
   */
  const executeActions = useCallback(async (actionIds) => {
    const sid = sessionIdRef.current;
    if (!sid || !actionIds?.length) return null;

    setIsLoading(true);
    try {
      const result = await executeActionsAPI(sid, actionIds);

      // Remove executed actions from pendingActions
      setPendingActions(prev =>
        prev.filter(a => !actionIds.includes(a._id || a.id))
      );

      // If the server returned an updated session, sync it
      if (result?.session) {
        setCurrentSession(result.session);
      }

      return result;
    } catch (err) {
      logger.error('[useBienBot] Failed to execute actions', { error: err.message });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // cancelAction
  // ---------------------------------------------------------------------------

  /**
   * Cancel (remove) a single pending action.
   *
   * @param {string} actionId - Action ID to cancel
   */
  const cancelAction = useCallback(async (actionId) => {
    const sid = sessionIdRef.current;
    if (!sid || !actionId) return;

    try {
      await cancelActionAPI(sid, actionId);
      setPendingActions(prev => prev.filter(a => (a._id || a.id) !== actionId));
    } catch (err) {
      logger.error('[useBienBot] Failed to cancel action', { error: err.message });
    }
  }, []);

  // ---------------------------------------------------------------------------
  // updateContext — inject entity context mid-session
  // ---------------------------------------------------------------------------

  /**
   * Update the session context when the user opens a new entity (e.g. a plan
   * item modal) while the BienBot drawer is already open. Injects a visible
   * acknowledgment message so the user knows BienBot is now aware of the entity.
   *
   * @param {string} entity - Entity type (e.g. 'plan_item')
   * @param {string} entityId - Entity ID
   * @param {string} [contextDescription] - Rich description for display (e.g. "My Plan on \"Paris Trip\"")
   * @returns {Promise<string|null>} Resolved entity label, or null on error
   */
  const updateContext = useCallback(async (entity, entityId, contextDescription) => {
    const sid = sessionIdRef.current;
    if (!sid || !entity || !entityId) return null;

    try {
      const result = await updateSessionContextAPI(sid, entity, entityId);
      const label = result?.entityLabel;

      if (label) {
        // Build ack message — prefer rich contextDescription over bare label
        const displayText = contextDescription || `"${label}"`;
        const ackMessage = {
          _id: `ctx-${Date.now()}`,
          role: 'assistant',
          content: `My context has been enriched with information about ${displayText}. You can ask me anything about it or tell me to take actions on it.`,
          createdAt: new Date().toISOString(),
          isContextAck: true
        };

        setMessages(prev => [...prev, ackMessage]);
      }

      return label;
    } catch (err) {
      logger.error('[useBienBot] Failed to update context', { error: err.message, entity, entityId });
      return null;
    }
  }, []);

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
      const result = await resumeSessionAPI(sid);
      const { session, greeting } = result || {};

      if (!session) {
        logger.warn('[useBienBot] No session returned from resume', { sid });
        return;
      }

      sessionIdRef.current = session._id;
      invokeContextSentRef.current = true; // Resumed sessions already have context

      batchedUpdates(() => {
        setCurrentSession(session);
        setPendingActions(session.pending_actions || []);

        // Build initial messages: greeting + any existing history
        const initialMessages = [];

        if (greeting) {
          initialMessages.push({
            _id: `greeting-${Date.now()}`,
            role: 'assistant',
            content: greeting.text || greeting.message || (typeof greeting === 'string' ? greeting : ''),
            createdAt: new Date().toISOString()
          });

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
  }, []);

  /**
   * Clear the current session state. Does NOT delete the session server-side.
   */
  const clearSession = useCallback(() => {
    cancelStream();

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
  }, [cancelStream]);

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

    return () => {
      unsubDeleted();
      unsubResumed();
    };
  }, [clearSession]);

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
  }, []);

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
  }, []);

  // ---------------------------------------------------------------------------
  // Cleanup: cancel in-flight stream on unmount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      cancelStream();
    };
  }, [cancelStream]);

  // ---------------------------------------------------------------------------
  // Return API
  // ---------------------------------------------------------------------------
  return {
    sessions,
    currentSession,
    messages,
    pendingActions,
    suggestedNextSteps,
    isLoading,
    isStreaming,
    sendMessage,
    executeActions,
    cancelAction,
    updateContext,
    loadSession,
    clearSession,
    fetchSessions,
    shareSession,
    unshareSession
  };
}

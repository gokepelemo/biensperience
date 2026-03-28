import { useState, useCallback, useRef, useEffect } from 'react';
import { unstable_batchedUpdates as batchedUpdates } from 'react-dom';
import {
  postMessage,
  postSharedComment as postSharedCommentAPI,
  getMutualFollowers as getMutualFollowersAPI,
  getSessions,
  getSession,
  resumeSession as resumeSessionAPI,
  executeActions as executeActionsAPI,
  cancelAction as cancelActionAPI,
  deleteSession as deleteSessionAPI,
  updateSessionContext as updateSessionContextAPI,
  updateActionStatus as updateActionStatusAPI,
  getWorkflowState as getWorkflowStateAPI,
  addSessionCollaborator as addCollaboratorAPI,
  removeSessionCollaborator as removeCollaboratorAPI
} from '../utilities/bienbot-api';
import { eventBus, broadcastEvent } from '../utilities/event-bus';
import { logger } from '../utilities/logger';
import { encryptData, decryptData } from '../utilities/crypto-utils';

const ACTIVE_SESSION_KEY = 'bien:bienbot_active_session';

/**
 * Open the BienBot panel with a pre-filled message in the input.
 * Can be called from anywhere in the component tree (e.g. post-plan toasts).
 *
 * @param {string} text - Message to pre-fill in the input
 */
export function openWithPrefilledMessage(text) {
  broadcastEvent('bienbot:open', { initialMessage: text });
}

/**
 * useBienBot — manages BienBot conversation state, SSE streaming,
 * pending actions, and session lifecycle.
 *
 * @param {Object} params
 * @param {string|null} [params.sessionId] - Existing session to load, or null for a new session
 * @param {Object} [params.invokeContext] - Entity context ({ entity, id, label }) from the mounting component
 * @returns {Object} BienBot state and actions
 */
export default function useBienBot({ sessionId: initialSessionId = null, invokeContext, userId = null } = {}) {
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

        onSession: ({ sessionId: newSessionId, title, attachment: attachmentInfo }) => {
          sessionIdRef.current = newSessionId;
          if (shouldSendContext) {
            invokeContextSentRef.current = true;
          }
          setCurrentSession(prev => ({
            ...(prev || {}),
            _id: newSessionId,
            title: title || prev?.title,
            // Mark the current user as owner so isSessionOwner evaluates correctly
            // for follow-up messages. The onSession event fires only when this client
            // creates the session, so the sender is always the owner.
            user: userId
          }));
          persistSessionId(newSessionId);
          // Update optimistic user message with S3 attachment info from server
          if (attachmentInfo?.s3Key) {
            setMessages(prev =>
              prev.map(m =>
                m._id === userMessage._id && m.attachments?.length > 0
                  ? {
                      ...m,
                      attachments: m.attachments.map((att, idx) =>
                        idx === 0
                          ? { ...att, s3Key: attachmentInfo.s3Key, s3Bucket: attachmentInfo.s3Bucket, isProtected: attachmentInfo.isProtected }
                          : att
                      )
                    }
                  : m
              )
            );
          }
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

        onStructuredContent: (blocks) => {
          // Attach structured content blocks to the current assistant message.
          // discovery_result_list blocks replace any existing sentinel (data===null)
          // in-place so the skeleton transitions to real content without flickering.
          if (blocks && blocks.length > 0) {
            setMessages(prev =>
              prev.map(m => {
                if (m._id !== assistantMessageId) return m;
                let existing = m.structured_content || [];
                let updated = [...existing];
                for (const block of blocks) {
                  if (block.type === 'discovery_result_list') {
                    const sentinelIdx = updated.findIndex(
                      b => b.type === 'discovery_result_list' && b.data === null
                    );
                    if (sentinelIdx !== -1) {
                      updated = [...updated];
                      updated[sentinelIdx] = block;
                    } else {
                      updated = [...updated, block];
                    }
                  } else {
                    updated = [...updated, block];
                  }
                }
                return { ...m, structured_content: updated };
              })
            );
          }
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
          // Update the assistant message with an error indicator.
          // Never expose raw exception messages in the chat UI.
          setMessages(prev =>
            prev.map(m =>
              m._id === assistantMessageId
                ? { ...m, content: streamedContent || 'Something went wrong. Please try again.', error: true }
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
        // Never expose raw exception messages in the chat UI.
        setMessages(prev =>
          prev.map(m =>
            m._id === assistantMessageId
              ? { ...m, content: 'Something went wrong. Please try again.', error: true }
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
  }, [invokeContext, cancelStream, persistSessionId]);

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
      persistSessionId(session._id);

      batchedUpdates(() => {
        setCurrentSession(session);
        setPendingActions(session.pending_actions || []);

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
  }, [persistSessionId]);

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
  }, [cancelStream, clearPersistedSession]);

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
  }, [clearSession]);

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
  // Workflow step management
  // ---------------------------------------------------------------------------

  /**
   * Post a shared comment — saves the message without triggering the LLM pipeline.
   * Used by shared collaborators (editors) and by the session owner when replying
   * inline to a collaborator message.
   *
   * @param {string} text - Comment text
   * @param {string|null} [replyTo] - msg_id of the message being replied to
   * @returns {Promise<void>}
   */
  const sendSharedComment = useCallback(async (text, replyTo = null) => {
    if (!text?.trim()) return;

    const sid = sessionIdRef.current;
    if (!sid) return;

    // Optimistically append the comment to the local messages list
    const tempId = `temp-comment-${Date.now()}`;
    const optimisticMsg = {
      _id: tempId,
      role: 'user',
      content: text,
      message_type: 'shared_comment',
      // Tag with current userId so the UI can distinguish own messages from
      // collaborator messages before the server confirmation arrives.
      sent_by: userId,
      reply_to: replyTo || null,
      createdAt: new Date().toISOString()
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      const result = await postSharedCommentAPI(sid, text, replyTo);
      const savedMsg = result?.message;
      if (savedMsg) {
        // Replace optimistic message with server-confirmed version
        setMessages(prev =>
          prev.map(m => m._id === tempId ? { ...savedMsg, _id: tempId } : m)
        );
      }
    } catch (err) {
      logger.error('[useBienBot] Failed to post shared comment', { error: err.message });
      // Never expose raw exception messages in the chat UI.
      setMessages(prev =>
        prev.map(m =>
          m._id === tempId ? { ...m, error: true, content: 'Failed to send. Please try again.' } : m
        )
      );
    }
  }, []);

  /**
   * Search mutual followers for sharing the current session.
   *
   * @param {string} q - Search query (name or email)
   * @returns {Promise<Array<{ _id, name, email }>>}
   */
  const searchMutualFollowers = useCallback(async (q = '') => {
    try {
      const result = await getMutualFollowersAPI(q);
      return result?.users || [];
    } catch (err) {
      logger.error('[useBienBot] Failed to search mutual followers', { error: err.message });
      return [];
    }
  }, []);

  /**
   * Approve a workflow step. Executes it immediately and updates local state.
   *
   * @param {string} actionId - Action ID to approve
   * @returns {Promise<Object|null>} Updated action result, or null on error
   */
  const approveStep = useCallback(async (actionId) => {
    const sid = sessionIdRef.current;
    if (!sid || !actionId) return null;

    setIsLoading(true);
    try {
      const data = await updateActionStatusAPI(sid, actionId, 'approved');

      // Sync pending actions from server response
      if (data?.pending_actions) {
        setPendingActions(data.pending_actions);
      }

      return data;
    } catch (err) {
      logger.error('[useBienBot] Failed to approve step', { error: err.message, actionId });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Skip a workflow step. Cascades failure to dependent steps.
   *
   * @param {string} actionId - Action ID to skip
   * @returns {Promise<Object|null>} Updated action result, or null on error
   */
  const skipStep = useCallback(async (actionId) => {
    const sid = sessionIdRef.current;
    if (!sid || !actionId) return null;

    try {
      const data = await updateActionStatusAPI(sid, actionId, 'skipped');

      if (data?.pending_actions) {
        setPendingActions(data.pending_actions);
      }

      return data;
    } catch (err) {
      logger.error('[useBienBot] Failed to skip step', { error: err.message, actionId });
      return null;
    }
  }, []);

  /**
   * Edit a workflow step's payload and optionally approve it.
   *
   * @param {string} actionId - Action ID to edit
   * @param {Object} newPayload - Updated payload
   * @returns {Promise<Object|null>} Updated action result, or null on error
   */
  const editStep = useCallback(async (actionId, newPayload) => {
    const sid = sessionIdRef.current;
    if (!sid || !actionId) return null;

    setIsLoading(true);
    try {
      const data = await updateActionStatusAPI(sid, actionId, 'approved', newPayload);

      if (data?.pending_actions) {
        setPendingActions(data.pending_actions);
      }

      return data;
    } catch (err) {
      logger.error('[useBienBot] Failed to edit step', { error: err.message, actionId });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Cancel an entire workflow (skip all remaining pending steps).
   *
   * @param {string} workflowId - Workflow ID to cancel
   * @returns {Promise<void>}
   */
  const cancelWorkflow = useCallback(async (workflowId) => {
    const sid = sessionIdRef.current;
    if (!sid || !workflowId) return;

    const workflowSteps = pendingActions.filter(
      a => a.workflow_id === workflowId && a.status === 'pending'
    );

    for (const step of workflowSteps) {
      try {
        await updateActionStatusAPI(sid, step.id, 'skipped');
      } catch (err) {
        logger.error('[useBienBot] Failed to skip workflow step during cancel', {
          error: err.message,
          actionId: step.id
        });
      }
    }

    // Refresh pending actions from server
    try {
      const sessionData = await getSession(sid);
      if (sessionData?.pending_actions) {
        setPendingActions(sessionData.pending_actions);
      }
    } catch (err) {
      logger.error('[useBienBot] Failed to refresh after workflow cancel', { error: err.message });
    }
  }, [pendingActions]);

  // ---------------------------------------------------------------------------
  // Cleanup: cancel in-flight stream on unmount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      cancelStream();
    };
  }, [cancelStream]);

  // ---------------------------------------------------------------------------
  // appendStructuredContent — inject a structured content block into the last
  // assistant message (used for post-action enrichment like tip suggestions)
  // ---------------------------------------------------------------------------
  const appendStructuredContent = useCallback((block) => {
    if (!block) return;
    setMessages(prev => {
      // Find the last assistant message
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].role === 'assistant') {
          const updated = [...prev];
          updated[i] = {
            ...updated[i],
            structured_content: [...(updated[i].structured_content || []), block]
          };
          return updated;
        }
      }
      return prev;
    });
  }, []);

  // ---------------------------------------------------------------------------
  // appendMessage — add a message to the conversation (used for action feedback)
  // ---------------------------------------------------------------------------
  const appendMessage = useCallback((msg) => {
    if (!msg) return;
    setMessages(prev => [...prev, msg]);
  }, []);

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
    deleteSession,
    isStreaming,
    sendMessage,
    sendSharedComment,
    searchMutualFollowers,
    executeActions,
    cancelAction,
    updateContext,
    loadSession,
    clearSession,
    fetchSessions,
    shareSession,
    unshareSession,
    approveStep,
    skipStep,
    editStep,
    cancelWorkflow,
    appendStructuredContent,
    appendMessage,
    getPersistedSession,
    clearPersistedSession
  };
}

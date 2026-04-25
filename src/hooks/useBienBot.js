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
  removeSessionCollaborator as removeCollaboratorAPI,
  analyzeEntity,
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
 * Open the BienBot panel and immediately load a specific session by ID.
 * Useful for deep-linking to a shared session from the activity feed.
 *
 * @param {string} sessionId - BienBot session ID to open
 */
export function openWithSession(sessionId) {
  broadcastEvent('bienbot:open', { bienbotSessionId: sessionId });
}

/**
 * Call the stateless analyze endpoint and open BienBot with the results
 * displayed as a synthetic assistant message.
 *
 * @param {string} entity - 'experience' | 'destination' | 'plan'
 * @param {string} entityId - MongoDB ObjectId string
 * @param {string} entityLabel - Human-readable entity name for the message header
 */
export async function openWithAnalysis(entity, entityId, entityLabel) {
  const result = await analyzeEntity(entity, entityId);
  broadcastEvent('bienbot:open', {
    analysisSuggestions: {
      entity,
      entityId,
      entityLabel,
      suggestions: result.suggestions,
      suggestedPrompts: result.suggestedPrompts || [],
    },
  });
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
export default function useBienBot({ sessionId: initialSessionId = null, invokeContext, navigationSchema = null, userId = null } = {}) {
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
  // Holds the formatted analysis greeting text that was shown to the user before the
  // first message was sent. Sent once as `priorGreeting` on new session creation so
  // the backend can persist it as the opening assistant turn, giving the LLM the
  // context it needs to answer follow-up questions about the analysis.
  const priorGreetingRef = useRef(null);

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
  // streamMessage — internal SSE streaming helper shared by sendMessage and
  // sendHiddenMessage. Manages the assistant placeholder, abort controller,
  // session bootstrap, and all SSE event handlers.
  //
  // @param {Object} opts
  // @param {string}  opts.text        - Wire text (stored in session history)
  // @param {string}  [opts.hiddenText] - When set, sent to LLM via hiddenUserMessage;
  //                                      text is stored as the visible turn
  // @param {File}    [opts.attachment] - File attachment (sendMessage flow only)
  // ---------------------------------------------------------------------------

  async function streamMessage({ text, hiddenText, attachment }) {
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

    // Always send invokeContext when available so the backend knows which entity
    // page the user is currently viewing. This is critical for plan disambiguation
    // on resumed sessions (otherwise the backend can't anchor actions to the page).
    const sid = sessionIdRef.current;
    const hasInvokeContext = invokeContext?.entity && invokeContext?.id;
    const isFirstMessage = !sid && !invokeContextSentRef.current;
    const priorGreeting = !sid ? priorGreetingRef.current : null;
    // Clear after capture so it is only ever sent once
    if (priorGreeting) priorGreetingRef.current = null;

    try {
      await postMessage(sid, text, {
        invokeContext: hasInvokeContext ? invokeContext : undefined,
        navigationSchema: (isFirstMessage && navigationSchema) ? navigationSchema : undefined,
        priorGreeting: priorGreeting || undefined,
        attachment: attachment || undefined,
        hiddenUserMessage: hiddenText || undefined,
        signal: controller.signal,

        onSession: ({ sessionId: newSessionId, title, attachment: attachmentInfo }) => {
          sessionIdRef.current = newSessionId;
          if (isFirstMessage) {
            invokeContextSentRef.current = true;
          }
          setCurrentSession(prev => ({
            ...(prev || {}),
            _id: newSessionId,
            title: title || prev?.title,
            // Mark the current user as owner so isSessionOwner evaluates correctly
            // for follow-up messages. The onSession event fires only when this client
            // creates the session, so the sender is always the owner.
            user: userId,
            // Populate invoke_context on new sessions so the reconciliation effect
            // recognises the entity as already tracked and does not inject a
            // spurious "context has changed" ack message.
            ...(isFirstMessage && hasInvokeContext ? {
              invoke_context: {
                entity: invokeContext.entity,
                entity_id: invokeContext.id,
                entity_label: invokeContext.label,
              }
            } : {})
          }));
          persistSessionId(newSessionId);
          // Update optimistic user message with S3 attachment info from server.
          // Find the most recent user message that has a pending attachment without s3Key.
          if (attachmentInfo?.s3Key) {
            setMessages(prev =>
              prev.map(m => {
                if (m.role === 'user' && m.attachments?.length > 0 && !m.attachments[0].s3Key) {
                  return {
                    ...m,
                    attachments: m.attachments.map((att, idx) =>
                      idx === 0
                        ? { ...att, s3Key: attachmentInfo.s3Key, s3Bucket: attachmentInfo.s3Bucket, isProtected: attachmentInfo.isProtected }
                        : att
                    )
                  };
                }
                return m;
              })
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
        logger.debug('[useBienBot] Stream aborted');
      } else {
        logger.error('[useBienBot] Failed to stream message', { error: err.message });
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
  }

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

    // Dismiss any pending action prompts — the new message supersedes them
    setPendingActions([]);

    // Optimistic: append user message immediately
    const userMessage = {
      _id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
      attachments: attachment ? [{ filename: attachment.name, mimeType: attachment.type, fileSize: attachment.size }] : []
    };

    setMessages(prev => [...prev, userMessage]);

    await streamMessage({ text, attachment });
  }, [invokeContext, navigationSchema, userId, cancelStream, persistSessionId]);

  // ---------------------------------------------------------------------------
  // sendHiddenMessage — programmatic follow-up that stores visibleText in the
  // session history but sends hiddenText to the LLM.  Used after local actions
  // (e.g. "Plan this") so the LLM can suggest next steps without a round-trip.
  // ---------------------------------------------------------------------------

  /**
   * Send a follow-up message after a locally-executed action.
   * - Does NOT append a user bubble (caller is responsible for that).
   * - Does NOT clear suggestedNextSteps or pendingActions.
   * - Stores `storedText` in session history; sends `hiddenText` to the LLM.
   *
   * @param {string} storedText  - Visible text stored in session (shown to user)
   * @param {string} hiddenText  - Text sent to LLM instead of storedText
   */
  const sendHiddenMessage = useCallback(async (storedText, hiddenText) => {
    if (!storedText?.trim() || !hiddenText?.trim()) return;
    if (isStreaming || isLoading) return;

    await streamMessage({ text: storedText, hiddenText });
  }, [isStreaming, isLoading, invokeContext, navigationSchema, userId, cancelStream, persistSessionId]);

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

      // If the server returned an updated session, merge it — don't replace.
      // The execute endpoint returns a sparse { id, context } object and does not
      // include the `user` field, so a full replace would make isSessionOwner false
      // on subsequent renders, incorrectly routing follow-up messages to sendSharedComment.
      if (result?.session) {
        setCurrentSession(prev => prev ? { ...prev, ...result.session } : result.session);
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
  const updateContext = useCallback(async (entity, entityId, contextDescription, { isSwitch = false } = {}) => {
    const sid = sessionIdRef.current;
    if (!sid || !entity || !entityId) return null;

    try {
      const result = await updateSessionContextAPI(sid, entity, entityId);
      const label = result?.entityLabel;

      // Sync local currentSession.context with the server's authoritative response
      // (it includes cascade-cleared plan_id/experience_id when switching entities)
      if (result?.context) {
        setCurrentSession(prev => prev ? { ...prev, context: result.context } : prev);
      }

      if (label) {
        // Build ack message — prefer rich contextDescription over bare label
        const displayText = contextDescription || `"${label}"`;
        const isUserEntity = entity?.toLowerCase() === 'user';
        const isOwnProfile = isUserEntity && userId && entityId && entityId.toString() === userId.toString();
        let ackContent;
        if (isSwitch) {
          if (isOwnProfile) {
            ackContent = `Context has changed to your profile. You can take actions on it with BienBot.`;
          } else {
            ackContent = `Context switched to ${displayText}. I'll now focus on this ${entity} unless you tell me otherwise.`;
          }
        } else {
          if (isOwnProfile) {
            ackContent = `Context has changed to your profile. You can take actions on it with BienBot.`;
          } else {
            const contextSuffix = isUserEntity
              ? 'You can ask me anything about them or tell me to take actions on their profile.'
              : 'You can ask me anything about it or tell me to take actions on it.';
            ackContent = `My context has been enriched with information about ${displayText}. ${contextSuffix}`;
          }
        }
        const ackMessage = {
          _id: `ctx-${Date.now()}`,
          role: 'assistant',
          content: ackContent,
          createdAt: new Date().toISOString(),
          isContextAck: true
        };

        // If the most recent message is already a context ack (e.g. experience ack
        // immediately followed by plan ack during navigation), replace it so the user
        // only ever sees one enrichment message at a time.
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.isContextAck) {
            return [...prev.slice(0, -1), ackMessage];
          }
          return [...prev, ackMessage];
        });
      }

      return label;
    } catch (err) {
      logger.error('[useBienBot] Failed to update context', { error: err.message, entity, entityId });
      return null;
    }
  }, [userId]);

  /**
   * Explicitly switch BienBot's context to a new entity. Unlike updateContext (passive
   * enrichment), this signals a deliberate focus change — triggered by the user choosing
   * to switch context via the ContextSwitchPrompt.
   *
   * @param {string} entity - Entity type
   * @param {string} entityId - Entity ID
   * @param {string} [contextDescription] - Rich description for display
   * @returns {Promise<string|null>} Resolved entity label, or null on error
   */
  const switchContext = useCallback(
    (entity, entityId, contextDescription) => updateContext(entity, entityId, contextDescription, { isSwitch: true }),
    [updateContext]
  );

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
  }, [persistSessionId, invokeContext]);

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
  }, [clearSession, fetchSessions, userId]);

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
  }, [userId]);

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
        setPendingActions(data.pending_actions.filter(a => !a.executed));
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
        setPendingActions(data.pending_actions.filter(a => !a.executed));
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
        setPendingActions(data.pending_actions.filter(a => !a.executed));
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
        setPendingActions(sessionData.pending_actions.filter(a => !a.executed));
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
  /** Store the formatted analysis greeting so it is persisted as the first session message. */
  const setPriorGreeting = useCallback((text) => {
    priorGreetingRef.current = text || null;
  }, []);

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
  // replaceInitialGreeting — replace greeting-only state with a new greeting.
  // If the user has already sent a message, appends instead of replacing so
  // that real conversation history is never lost.
  // ---------------------------------------------------------------------------
  const replaceInitialGreeting = useCallback((msg) => {
    if (!msg) return;
    setMessages(prev => {
      const hasUserMessages = prev.some(m => m.role === 'user');
      if (hasUserMessages) return [...prev, msg];
      return [msg];
    });
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
    setSuggestedNextSteps,
    isLoading,
    deleteSession,
    isStreaming,
    sendMessage,
    sendHiddenMessage,
    sendSharedComment,
    searchMutualFollowers,
    executeActions,
    cancelAction,
    updateContext,
    switchContext,
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
    replaceInitialGreeting,
    setPriorGreeting,
    getPersistedSession,
    clearPersistedSession,
    resetSession
  };
}

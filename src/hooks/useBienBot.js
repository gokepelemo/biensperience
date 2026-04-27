import { useState, useCallback, useRef, useEffect } from 'react';
import {
  postSharedComment as postSharedCommentAPI,
  getMutualFollowers as getMutualFollowersAPI,
  updateSessionContext as updateSessionContextAPI,
  analyzeEntity,
} from '../utilities/bienbot-api';
import { broadcastEvent } from '../utilities/event-bus';
import { logger } from '../utilities/logger';
import useSessionManager from './useSessionManager';
import useSSEStream from './useSSEStream';
import useActionManager from './useActionManager';

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
 * Composed from three focused hooks:
 *   - useSessionManager — sessions list, currentSession, persistence, lifecycle
 *   - useSSEStream      — token streaming, tool-call pills, AbortController
 *   - useActionManager  — pendingActions, executeActions, cancelAction, workflows
 *
 * The public API is unchanged from the pre-split implementation; consumers
 * (BienBotPanel etc.) need no modifications.
 *
 * @param {Object} params
 * @param {string|null} [params.sessionId] - Existing session to load, or null for a new session
 * @param {Object} [params.invokeContext] - Entity context ({ entity, id, label }) from the mounting component
 * @returns {Object} BienBot state and actions
 */
export default function useBienBot({ sessionId: initialSessionId = null, invokeContext, navigationSchema = null, userId = null } = {}) {
  // ---------------------------------------------------------------------------
  // Composed-hook state (lives at the top level so multiple sub-hooks can share)
  // ---------------------------------------------------------------------------
  const [messages, setMessages] = useState([]);
  const [suggestedNextSteps, setSuggestedNextSteps] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // Refs shared across sub-hooks
  // ---------------------------------------------------------------------------
  const sessionIdRef = useRef(initialSessionId);
  const invokeContextSentRef = useRef(false);
  // Holds the formatted analysis greeting text that was shown to the user before the
  // first message was sent. Sent once as `priorGreeting` on new session creation so
  // the backend can persist it as the opening assistant turn, giving the LLM the
  // context it needs to answer follow-up questions about the analysis.
  const priorGreetingRef = useRef(null);
  // Shared AbortController for the SSE stream so both useSessionManager
  // (clearSession/resetSession/loadSession) and useSSEStream can cancel it.
  const abortControllerRef = useRef(null);

  // ---------------------------------------------------------------------------
  // Action manager — owns pendingActions slice + execute/cancel/workflow helpers
  // ---------------------------------------------------------------------------
  const {
    pendingActions,
    setPendingActions,
    executeActions,
    cancelAction,
    approveStep,
    skipStep,
    editStep,
    cancelWorkflow,
  } = useActionManager({
    sessionIdRef,
    setCurrentSession: (...args) => sessionManagerRef.current?.setCurrentSession(...args),
    setIsLoading,
  });

  // ---------------------------------------------------------------------------
  // SSE stream — owns isStreaming + streamMessage + cancelStream
  //
  // We pass setCurrentSession as a wrapper that defers to the session manager
  // (which is constructed below). This avoids a circular-init problem while
  // preserving the original semantics: streamMessage's onSession callback
  // updates the same currentSession state managed by useSessionManager.
  // ---------------------------------------------------------------------------
  const sessionManagerRef = useRef(null);

  const {
    isStreaming,
    setIsStreaming,
    streamMessage,
    cancelStream,
  } = useSSEStream({
    sessionIdRef,
    invokeContext,
    navigationSchema,
    userId,
    invokeContextSentRef,
    priorGreetingRef,
    abortControllerRef,
    persistSessionId: (...args) => sessionManagerRef.current?.persistSessionId(...args),
    setMessages,
    setCurrentSession: (...args) => sessionManagerRef.current?.setCurrentSession(...args),
    setPendingActions,
    setIsLoading,
  });

  // ---------------------------------------------------------------------------
  // Session manager — owns sessions list, currentSession, persistence,
  // load/fetch/delete/share/unshare, clear/reset, and event subscriptions
  // ---------------------------------------------------------------------------
  const sessionManager = useSessionManager({
    initialSessionId,
    userId,
    invokeContext,
    sessionIdRef,
    invokeContextSentRef,
    setMessages,
    setPendingActions,
    setSuggestedNextSteps,
    setIsLoading,
    setIsStreaming,
    cancelStream,
  });

  const {
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
  } = sessionManager;

  // Keep the sessionManagerRef pointing at the latest manager so the wrappers
  // injected into useActionManager / useSSEStream resolve to the live setters.
  sessionManagerRef.current = sessionManager;

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
  }, [streamMessage, setPendingActions]);

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
  }, [isStreaming, isLoading, streamMessage]);

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
  }, [userId, setCurrentSession]);

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
  // Shared comments + mutual-follower search
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

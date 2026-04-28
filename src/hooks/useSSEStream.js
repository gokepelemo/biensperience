import { useState, useCallback } from 'react';
import { unstable_batchedUpdates as batchedUpdates } from 'react-dom';
import { postMessage } from '../utilities/bienbot-api';
import { logger } from '../utilities/logger';

/**
 * useSSEStream — owns the SSE streaming lifecycle for BienBot:
 *   - Assistant placeholder message creation + token accumulation
 *   - tool_call_start / tool_call_end pill bookkeeping
 *   - AbortController management + cancelStream
 *   - Error handling (including AbortError) + isStreaming flag
 *
 * The composed `useBienBot` hook owns the message list, current session,
 * and pending-actions slices and passes their setters in. This hook is a
 * pure relocation of the streaming logic out of `useBienBot.js` — semantics
 * are preserved exactly.
 *
 * @param {Object} params
 * @param {Object} params.sessionIdRef           - Ref holding the active session id (mutated by onSession)
 * @param {Object} [params.invokeContext]        - Entity context ({ entity, id, label })
 * @param {Object} [params.navigationSchema]     - Optional navigation schema (sent on first message)
 * @param {string} [params.userId]               - Current user id (used to mark new-session ownership)
 * @param {Object} params.invokeContextSentRef   - Ref tracking whether invokeContext has been forwarded
 * @param {Object} params.priorGreetingRef       - Ref holding analysis greeting to persist on first send
 * @param {Object} params.priorReferencedEntitiesRef - Ref holding entities the analyze LLM identified; sent once on first send so the backend can seed session.context
 * @param {Object} params.abortControllerRef     - Ref holding the active AbortController (mutated by streamMessage)
 * @param {Function} params.persistSessionId     - Persist a session id to encrypted localStorage
 * @param {Function} params.setMessages          - React setter for the messages array
 * @param {Function} params.setCurrentSession    - React setter for the current session
 * @param {Function} params.setPendingActions    - React setter for the pending actions list
 * @param {Function} params.setIsLoading         - React setter for the global loading flag
 *
 * @returns {{
 *   isStreaming: boolean,
 *   streamMessage: (opts: { text: string, hiddenText?: string, attachment?: File }) => Promise<void>,
 *   cancelStream: () => void
 * }}
 */
export default function useSSEStream({
  sessionIdRef,
  invokeContext,
  navigationSchema,
  userId,
  invokeContextSentRef,
  priorGreetingRef,
  priorReferencedEntitiesRef,
  abortControllerRef,
  persistSessionId,
  setMessages,
  setCurrentSession,
  setPendingActions,
  setIsLoading,
}) {
  const [isStreaming, setIsStreaming] = useState(false);

  /** Cancel any in-flight SSE stream. */
  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, [abortControllerRef]);

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
    // Track in-flight tool-call pills by call_id so we can transition each pill
    // through pending → success/error and clear them all when the second LLM
    // response begins streaming tokens (or when the stream errors/aborts).
    const toolCallPills = new Map();

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
    const priorReferencedEntities = !sid ? priorReferencedEntitiesRef?.current : null;
    // Clear after capture so they are only ever sent once
    if (priorGreeting) priorGreetingRef.current = null;
    if (priorReferencedEntities && priorReferencedEntitiesRef) priorReferencedEntitiesRef.current = null;

    try {
      await postMessage(sid, text, {
        invokeContext: hasInvokeContext ? invokeContext : undefined,
        navigationSchema: (isFirstMessage && navigationSchema) ? navigationSchema : undefined,
        priorGreeting: priorGreeting || undefined,
        priorReferencedEntities: priorReferencedEntities || undefined,
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
          // Once the second LLM response starts streaming, any pills from the
          // tool-call phase have served their purpose. Clear them so the UI
          // transitions cleanly from pills → answer text.
          if (toolCallPills.size > 0) {
            toolCallPills.clear();
            setMessages(prev =>
              prev.map(m =>
                m._id === assistantMessageId
                  ? { ...m, tool_call_pills: [] }
                  : m
              )
            );
          }
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

        onToolCallStart: ({ call_id, type, label }) => {
          toolCallPills.set(call_id, { call_id, type, label, status: 'pending' });
          const snapshot = Array.from(toolCallPills.values());
          setMessages(prev => prev.map(m =>
            m._id === assistantMessageId ? { ...m, tool_call_pills: snapshot } : m
          ));
        },

        onToolCallEnd: ({ call_id, ok }) => {
          const existing = toolCallPills.get(call_id);
          if (existing) {
            toolCallPills.set(call_id, { ...existing, status: ok ? 'success' : 'error' });
          }
          const snapshot = Array.from(toolCallPills.values());
          setMessages(prev => prev.map(m =>
            m._id === assistantMessageId ? { ...m, tool_call_pills: snapshot } : m
          ));
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
          toolCallPills.clear();
          // Update the assistant message with an error indicator.
          // Never expose raw exception messages in the chat UI.
          setMessages(prev =>
            prev.map(m =>
              m._id === assistantMessageId
                ? { ...m, content: streamedContent || 'Something went wrong. Please try again.', error: true, tool_call_pills: [] }
                : m
            )
          );
          abortControllerRef.current = null;
        }
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        logger.debug('[useBienBot] Stream aborted');
        // Clear any in-flight pills on cancellation so they don't visually
        // persist on the partially-streamed assistant message.
        if (toolCallPills.size > 0) {
          toolCallPills.clear();
          setMessages(prev =>
            prev.map(m =>
              m._id === assistantMessageId
                ? { ...m, tool_call_pills: [] }
                : m
            )
          );
        }
      } else {
        logger.error('[useBienBot] Failed to stream message', { error: err.message });
        toolCallPills.clear();
        // Never expose raw exception messages in the chat UI.
        setMessages(prev =>
          prev.map(m =>
            m._id === assistantMessageId
              ? { ...m, content: 'Something went wrong. Please try again.', error: true, tool_call_pills: [] }
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

  return {
    isStreaming,
    setIsStreaming,
    streamMessage,
    cancelStream,
  };
}

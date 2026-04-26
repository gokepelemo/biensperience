/**
 * BienBotPanel — Sliding chat drawer (desktop) / bottom sheet (mobile).
 *
 * Renders the full BienBot chat UI. On desktop it slides in from the right;
 * on mobile it slides up from the bottom as a full-screen sheet.
 *
 * @module components/BienBotPanel
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { FaBell } from 'react-icons/fa';
import { Text } from '../design-system';
import useBienBot from '../../hooks/useBienBot';
import { useInputHistory } from '../../hooks/useInputHistory';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useUser } from '../../contexts/UserContext';
import { useData } from '../../contexts/DataContext';
import {
  getSuggestionsForContext,
  getPlaceholderForContext,
  getEmptyStateForContext,
  getNavigationUrlForResult
} from '../../utilities/bienbot-suggestions';
import { logger } from '../../utilities/logger';
import { decodeHtmlEntities } from '../../utilities/html-entities';
import { eventBus } from '../../utilities/event-bus';
import { useBienBotOptimistic } from './useBienBotOptimistic';
import { useExecuteAction } from './useExecuteAction';
import PendingActionsArea from './PendingActionsArea';
import ChatInputArea from './ChatInputArea';
import SessionHistoryView from './SessionHistoryView';
import { applyTips as applyTipsAPI } from '../../utilities/bienbot-api';
import { createPlan } from '../../utilities/plans-api';
import Autocomplete from '../Autocomplete/Autocomplete';
import NotificationItem from './NotificationItem';
import BienBotHeader from './BienBotHeader';
import MessageList from './MessageList';
import styles from './BienBotPanel.module.css';
import { CloseIcon, BienBotIcon } from './icons';

// ─── Main BienBotPanel component ──────────────────────────────────────────────

/**
 * BienBotPanel chat drawer.
 *
 * @param {Object} props
 * @param {boolean} props.open - Whether the panel is visible
 * @param {Function} props.onClose - Callback to close the panel
 * @param {Object|null} props.invokeContext - Entity context ({ entity, id, label }) or null for non-entity views
 * @param {Object|null} props.baseInvokeContext - Route-only context (no override). Used solely to detect page navigations for the ContextSwitchPrompt.
 * @param {string|null} props.currentView - View identifier for non-entity pages
 * @param {boolean} props.isEntityView - Whether current page is an entity detail page
 * @param {boolean} props.notificationOnly - Whether to show notification-only mode (no chat)
 * @param {Array} props.notifications - Notification activities
 * @param {Array} props.unseenNotificationIds - IDs of unseen notifications
 * @param {Function} props.onMarkNotificationsSeen - Callback to mark notification IDs as seen
 * @param {string|null} [props.initialMessage] - Pre-fill the textarea with this text on open
 */

const ANALYSIS_TYPE_EMOJI = { warning: '⚠️', tip: '💡', info: 'ℹ️' };

function formatAnalysisSuggestions({ entityLabel, suggestions }) {
  if (!suggestions || suggestions.length === 0) {
    return `✅ **${entityLabel}** looks good — no issues found. What would you like to work on?`;
  }
  const lines = suggestions.map(
    (s) => `${ANALYSIS_TYPE_EMOJI[s.type] || 'ℹ️'} ${s.message}`
  );
  return `🔍 Here's what I noticed about **${entityLabel}**:\n\n${lines.join('\n')}`;
}

export default function BienBotPanel({
  open,
  onClose,
  invokeContext,
  baseInvokeContext = null,
  navigationSchema = null,
  currentView,
  isEntityView,
  notificationOnly = false,
  notifications = [],
  unseenNotificationIds = [],
  onMarkNotificationsSeen,
  initialMessage = null,
  initialSessionId = null,
  analysisSuggestions = null,
  clearAnalysisSuggestions = null,
}) {
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  // Set to true when the user explicitly sends a message so the scroll
  // effect always jumps to the bottom, regardless of current scroll position.
  const userSentRef = useRef(false);
  const inputValueRef = useRef('');
  const prevContextRef = useRef(null);
  // Tracks which (sessionId, entity, entityId) combos have already been reconciled
  // so we don't call updateContext more than once per session+entity pair.
  const sessionContextReconciledRef = useRef(null);
  const messagesRef = useRef([]);
  const [attachment, setAttachment] = useState(null);
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  // Prevents duplicate plan creation if the user double-clicks "Plan this" before
  // createPlan resolves (isStreaming/isLoading are only set later, inside sendHiddenMessage).
  const isPlanningRef = useRef(false);
  const [savedSession, setSavedSession] = useState(null);
  const [viewMode, setViewMode] = useState('chat');
  // Pending context switch: set when the user navigates to a different entity while
  // a conversation is in progress. Cleared when the user picks Stay or Switch.
  const [pendingContextSwitch, setPendingContextSwitch] = useState(null);
  // Normalised texts of items currently in the active plan — used to filter
  // suggestion_list blocks so already-added items are not offered again.
  const [currentPlanItemTexts, setCurrentPlanItemTexts] = useState(new Set());

  const { user } = useUser();
  const { getPlan } = useData();
  const broadcastOptimistic = useBienBotOptimistic();

  // ── Auto-resize textarea to fit content ──────────────────────────────────
  const resizeTextarea = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    // Reset to single row to get accurate scrollHeight
    el.style.height = 'auto';
    // Clamp to max-height (set via CSS)
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  const resetTextareaHeight = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
  }, []);

  // ── Input history recall (ArrowUp / ArrowDown) ───────────────────────────
  const { handleHistoryKey, resetHistory } = useInputHistory({
    inputRef,
    onValueChange: useCallback(() => {
      // Sync inputValueRef with the updated textarea value, then resize.
      inputValueRef.current = inputRef.current?.value ?? '';
      resizeTextarea();
    }, [resizeTextarea]),
  });

  const navigate = useNavigate();

  const {
    messages,
    pendingActions,
    suggestedNextSteps,
    setSuggestedNextSteps,
    isLoading,
    isStreaming,
    currentSession,
    sessions,
    sendMessage,
    sendHiddenMessage,
    executeActions,
    cancelAction,
    updateContext,
    switchContext,
    loadSession,
    clearSession,
    deleteSession,
    shareSession,
    unshareSession,
    sendSharedComment,
    searchMutualFollowers,
    approveStep,
    skipStep,
    editStep,
    cancelWorkflow,
    appendStructuredContent,
    appendMessage,
    replaceInitialGreeting,
    setPriorGreeting,
    resetSession,
    getPersistedSession,
    clearPersistedSession,
    fetchSessions
  } = useBienBot({ invokeContext, navigationSchema, userId: user?._id });

  const { handleExecuteAction, executingActionId } = useExecuteAction({
    pendingActions,
    executeActions,
    cancelAction,
    navigate,
    onClose,
    broadcastOptimistic,
    appendStructuredContent,
    appendMessage,
    userId: user?._id,
  });

  // ── Focus trap: keep focus inside the dialog while open ────────────────
  useFocusTrap(panelRef, open);

  // ── Handle adding suggested plan items ─────────────────────────────────
  const handleAddSuggestedItems = useCallback(
    (items) => {
      if (!items?.length || isStreaming || isLoading) return;
      const itemNames = items
        .map(i => decodeHtmlEntities(i.text || i.content || '').trim())
        .filter(Boolean);
      if (!itemNames.length) return;
      const msg = `Add these plan items: ${itemNames.join(', ')}`;
      sendMessage(msg);
    },
    [sendMessage, isStreaming, isLoading]
  );

  // ── Handle adding selected Unsplash photos ──────────────────────────────
  const handleAddPhotos = useCallback(
    (photos, entityType, entityId) => {
      if (!photos?.length || isStreaming || isLoading) return;
      const photoLines = photos.map(p => {
        const credit = p.photographer ? ` (by ${p.photographer}${p.photographer_url ? ` — ${p.photographer_url}` : ''})` : '';
        return `- ${p.url}${credit}`;
      }).join('\n');
      const msg = `Add these ${photos.length} selected photo${photos.length !== 1 ? 's' : ''} to the ${entityType}:\n${photoLines}`;
      sendMessage(msg);
    },
    [sendMessage, isStreaming, isLoading]
  );

  // ── Handle adding selected travel tips ─────────────────────────────────
  const handleAddTips = useCallback(
    async (tips, destinationId) => {
      if (!tips?.length || isStreaming || isLoading) return;
      const sid = currentSession?._id;
      if (!sid || !destinationId) return;

      try {
        const result = await applyTipsAPI(sid, destinationId, tips);
        const added = result?.added ?? tips.length;
        appendMessage({
          _id: `tips-result-${Date.now()}`,
          role: 'assistant',
          content: `\u2705 Added ${added} travel tip${added !== 1 ? 's' : ''} to the destination.`,
          createdAt: new Date().toISOString(),
          isActionResult: true
        });
      } catch (err) {
        logger.error('[BienBotPanel] Failed to apply tips', { error: err.message });
        appendMessage({
          _id: `tips-error-${Date.now()}`,
          role: 'assistant',
          content: 'Could not add the travel tips. Please try again.',
          createdAt: new Date().toISOString(),
          error: true
        });
      }
    },
    [isStreaming, isLoading, currentSession, appendMessage]
  );

  // ── Handle viewing a discovery result ──────────────────────────────────
  const handleViewDiscoveryResult = useCallback(
    (experienceId) => {
      if (!experienceId) return;
      navigate(`/experiences/${experienceId}`);
    },
    [navigate]
  );

  // ── Handle planning a discovery result ─────────────────────────────────
  const handlePlanDiscoveryResult = useCallback(
    async (experienceName, experienceId) => {
      if (!experienceName || !experienceId || isStreaming || isLoading || isPlanningRef.current) return;
      isPlanningRef.current = true;

      // Step 1: optimistic user bubble
      appendMessage({
        role: 'user',
        _id: `plan-btn-${Date.now()}`,
        content: `I want to plan \`${experienceName}\``,
        createdAt: new Date().toISOString(),
      });

      try {
        // Step 2: execute locally
        const plan = await createPlan(experienceId);

        // Step 3: navigate
        navigate(`/experiences/${experienceId}#plan-${plan._id}`);

        // Step 4: action result bubble
        appendMessage({
          role: 'assistant',
          _id: `plan-result-${Date.now()}`,
          content: `✅ Plan created for \`${experienceName}\`!`,
          createdAt: new Date().toISOString(),
          isActionResult: true,
        });

        // Step 5: hidden LLM trigger
        await sendHiddenMessage(
          `I want to plan \`${experienceName}\``,
          `A plan for \`${experienceName}\` (plan_id: ${plan._id}) was just created. Confirm it's ready and suggest 3–4 specific next steps.`
        );
      } catch (err) {
        appendMessage({
          role: 'assistant',
          _id: `plan-err-${Date.now()}`,
          content: `Could not create the plan for \`${experienceName}\`. Please try again.`,
          createdAt: new Date().toISOString(),
          error: true,
        });
      } finally {
        isPlanningRef.current = false;
      }
    },
    [appendMessage, sendHiddenMessage, isStreaming, isLoading, navigate]
  );

  // ── Handle entity ref card selection (disambiguation from BienBot) ──────
  const handleEntityRefSelect = useCallback(
    (ref) => {
      if (isStreaming || isLoading || !ref?._id || !ref?.name) return;
      switch (ref.type) {
        case 'plan_item':
          if (ref.action === 'mark_complete') {
            sendMessage(`Mark \`${ref.name}\` as complete`);
          } else if (ref.action === 'navigate') {
            // No hash URL available — ask BienBot to navigate contextually
            sendMessage(`Navigate to \`${ref.name}\``);
          }
          break;
        case 'experience':
          // Use a neutral message so the LLM continues from existing context rather than
          // triggering the plan-creation flow (which would ask "which destination?").
          sendMessage(`Tell me about \`${ref.name}\``);
          break;
        case 'plan':
          sendMessage(`Show me the details for \`${ref.name}\``);
          break;
        case 'destination':
          sendMessage(`Use \`${ref.name}\` as the destination`);
          break;
        default:
          sendMessage(ref.name);
          break;
      }
    },
    [sendMessage, isStreaming, isLoading]
  );

  // ── Handle empty discovery results ─────────────────────────────────────
  const handleDiscoveryEmpty = useCallback(
    (filtersApplied) => {
      if (isStreaming || isLoading) return;
      const { destination_name, destination_id, activity_types } = filtersApplied || {};
      if (!destination_id && destination_name) {
        sendMessage(`Create ${destination_name} as a destination`);
      } else if (destination_id && destination_name) {
        const activity = activity_types?.[0];
        sendMessage(activity
          ? `Create a new ${activity} experience in ${destination_name}`
          : `Create a new experience in ${destination_name}`
        );
      } else {
        sendMessage("I'd like to create a destination");
      }
    },
    [isStreaming, isLoading, sendMessage]
  );

  const isSessionOwner = currentSession && user?._id && currentSession.user?.toString() === user._id.toString();
  // True when sessions shared with this user exist but no current session is active.
  // Used to surface the share button so the user can navigate to a shared session.
  const hasSharedSessions = !currentSession && user?._id &&
    sessions.some(s => s.user?.toString() !== user._id.toString());

  const [replyTo, setReplyTo] = useState(null);
  // replyTo = { msg_id, preview, senderName } | null

  const handleNewChat = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.value = '';
      inputValueRef.current = '';
    }
    resetTextareaHeight();
    clearSession();
    setViewMode('chat');
  }, [clearSession, resetTextareaHeight]);

  // ── Context-aware text ──────────────────────────────────────────────────
  const entityType = invokeContext?.entity || null;

  const placeholderText = useMemo(
    () => getPlaceholderForContext(invokeContext, currentView),
    [invokeContext, currentView]
  );

  const emptyStateText = useMemo(
    () => getEmptyStateForContext(invokeContext, currentView),
    [invokeContext, currentView]
  );

  // Entity data for dynamic suggestion chips (name-aware templates)
  const entityData = useMemo(() => {
    if (!invokeContext?.label) return null;
    return {
      name: invokeContext.label,
      id: invokeContext.id,
      destinationName: invokeContext.destinationName || null,
      destinationId: invokeContext.destinationId || null,
    };
  }, [invokeContext?.label, invokeContext?.id, invokeContext?.destinationName, invokeContext?.destinationId]);

  // Initial suggestion chips — shown when no messages and no server-provided steps
  const initialSuggestions = useMemo(
    () => getSuggestionsForContext(entityType, currentView, entityData),
    [entityType, currentView, entityData]
  );

  // Show server-provided steps if available, otherwise initial suggestions
  const visibleChips = suggestedNextSteps.length > 0
    ? suggestedNextSteps
    : (messages.length === 0 ? initialSuggestions : []);

  // ── Focus input when panel opens ──────────────────────────────────────────
  useEffect(() => {
    if (open && inputRef.current) {
      // Small delay to wait for CSS transition
      const t = setTimeout(() => {
        if (inputRef.current) {
          // Pre-fill with initialMessage if provided
          if (initialMessage) {
            inputRef.current.value = initialMessage;
            inputValueRef.current = initialMessage;
          }
          inputRef.current.focus();
        }
      }, 300);
      return () => clearTimeout(t);
    }
  }, [open, initialMessage]);

  // ── Inject analysis suggestions as synthetic assistant message on open ────
  // Use a ref to prevent double-injection: React StrictMode re-runs effects from
  // the same render snapshot (so `messages` is stale/empty on both runs). The ref
  // persists across the double-invoke and gates the second run out.
  // Reset on close so the next open can show a fresh greeting.
  const analysisGreetingInjectedRef = useRef(false);
  useEffect(() => {
    if (!open) {
      analysisGreetingInjectedRef.current = false;
      return;
    }
    if (!analysisSuggestions || analysisGreetingInjectedRef.current) return;

    // If the user is already engaged in a conversation, do not inject a new greeting
    // here — the invokeContext change effect handles that case by calling updateContext,
    // which injects a focused ack note rather than replacing the conversation with
    // a new analysis message.
    const hasUserMessages = messagesRef.current.some(m => m.role === 'user');
    if (hasUserMessages) {
      analysisGreetingInjectedRef.current = true;
      if (clearAnalysisSuggestions) clearAnalysisSuggestions();
      return;
    }

    analysisGreetingInjectedRef.current = true;
    const content = formatAnalysisSuggestions(analysisSuggestions);
    // Force-scroll so the greeting is always visible, even if the user had
    // previously scrolled up in a prior conversation.
    userSentRef.current = true;
    // replaceInitialGreeting removes any existing greeting-only messages before
    // inserting the new one, so the user never sees stale or duplicate greetings
    // when they reopen BienBot without having sent anything.
    replaceInitialGreeting({
      _id: `analysis-${Date.now()}`,
      role: 'assistant',
      content,
      createdAt: new Date().toISOString(),
      isActionResult: true,
    });

    // Stash the formatted greeting so that if the user replies before any session
    // exists, the backend can persist it as the opening assistant turn. This gives
    // the LLM the context it needs to answer follow-up questions coherently.
    setPriorGreeting(`[ANALYSIS]\n${content}`);

    // Set suggested prompts as clickable chips so the user can act on the greeting
    if (analysisSuggestions.suggestedPrompts?.length > 0) {
      setSuggestedNextSteps(analysisSuggestions.suggestedPrompts);
    }

    if (clearAnalysisSuggestions) {
      clearAnalysisSuggestions();
    }
  }, [open, analysisSuggestions, replaceInitialGreeting, setPriorGreeting, setSuggestedNextSteps, clearAnalysisSuggestions]);

  // ── Re-focus input after BienBot finishes responding ─────────────────────
  useEffect(() => {
    if (!isLoading && !isStreaming && open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLoading, isStreaming, open]);

  // ── Detect invokeContext changes when panel opens on a different entity ──
  // IMPORTANT: we track baseInvokeContext (route-only, no override) to detect
  // real page navigations. Disambiguation actions (select_plan, select_destination)
  // change invokeContextOverride in BienBotTrigger, which flows into invokeContext
  // but NOT into baseInvokeContext. This prevents a spurious ContextSwitchPrompt
  // when the user clicks a plan card from a resumed session while still on the
  // same experience page (e.g. Nashville Glamping).
  const navContext = baseInvokeContext || invokeContext;
  useEffect(() => {
    if (!open || !navContext?.id) return;

    const prev = prevContextRef.current;
    const changed = prev && (prev.id !== navContext.id || prev.entity !== navContext.entity);

    // Store current as previous for next comparison (include label for ContextSwitchPrompt)
    prevContextRef.current = {
      entity: navContext.entity,
      id: navContext.id,
      label: navContext.contextDescription || navContext.label || navContext.entity,
    };

    if (!changed) return;

    const hasUserMessages = messagesRef.current.some(m => m.role === 'user');

    if (hasUserMessages) {
      // User is engaged in a conversation: show a prompt instead of silently switching
      // context. The user can choose to continue their current conversation or switch
      // BienBot's focus to the newly navigated entity.
      const prevLabel = prev.label || prev.entity;
      const newLabel = navContext.contextDescription || navContext.label || navContext.entity;
      setPendingContextSwitch({
        entity: navContext.entity,
        entityId: navContext.id,
        contextDescription: navContext.contextDescription,
        prevEntityLabel: prevLabel,
        newEntityLabel: newLabel,
      });
    } else {
      // User hasn't engaged (only saw the greeting): reset session tracking so
      // the next message starts a fresh session anchored to the new entity.
      // Messages are NOT cleared — the analysisSuggestions effect already
      // replaced/injected the new entity's greeting.
      resetSession();
    }
  }, [open, navContext?.entity, navContext?.id, updateContext, resetSession]);

  // ── Reconcile a resumed session's context with the current page entity ──────
  // When the user resumes an old session while viewing a different entity, the
  // session's invoke_context may point to a stale entity. This effect detects
  // that mismatch immediately after the session is loaded and calls updateContext
  // so BienBot is aware of what the user is currently looking at, before they
  // send any messages.
  useEffect(() => {
    // Reset reconciliation tracking when the session is cleared
    if (!currentSession?._id) {
      sessionContextReconciledRef.current = null;
      return;
    }

    if (!open || !invokeContext?.entity || !invokeContext?.id) return;

    const reconcileKey = `${currentSession._id}:${invokeContext.entity}:${invokeContext.id}`;
    if (sessionContextReconciledRef.current === reconcileKey) return;
    sessionContextReconciledRef.current = reconcileKey;

    // Check if the session was already created for this entity
    const sessionEntityId = currentSession.invoke_context?.entity_id?.toString();
    const sessionEntity = currentSession.invoke_context?.entity;
    if (sessionEntityId === invokeContext.id && sessionEntity === invokeContext.entity) return;

    // Check if the session's accumulated context already includes this entity
    const ctx = currentSession.context || {};
    const alreadyInContext =
      (invokeContext.entity === 'experience' && ctx.experience_id?.toString() === invokeContext.id) ||
      (invokeContext.entity === 'destination' && ctx.destination_id?.toString() === invokeContext.id) ||
      (invokeContext.entity === 'plan' && ctx.plan_id?.toString() === invokeContext.id);
    if (alreadyInContext) return;

    // The resumed session doesn't have context for the entity currently in view —
    // update it so BienBot knows what the user is looking at.
    logger.debug('[BienBotPanel] Reconciling resumed session context with current entity', {
      sessionId: currentSession._id,
      sessionEntity,
      sessionEntityId,
      currentEntity: invokeContext.entity,
      currentEntityId: invokeContext.id,
    });
    updateContext(invokeContext.entity, invokeContext.id, invokeContext.contextDescription);
  }, [
    open,
    currentSession?._id,
    currentSession?.invoke_context,
    currentSession?.context,
    invokeContext?.entity,
    invokeContext?.id,
    invokeContext?.contextDescription,
    updateContext,
  ]);

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // ── Track current plan items for suggestion deduplication ────────────────
  // Seed from DataContext whenever the active plan changes (invoke context or
  // session context). Kept in sync via plan:updated / plan:created events.
  const activePlanId = useMemo(() => {
    if (invokeContext?.entity === 'plan') return invokeContext.id;
    return currentSession?.context?.plan_id?.toString() || null;
  }, [invokeContext?.entity, invokeContext?.id, currentSession?.context?.plan_id]);

  useEffect(() => {
    if (!activePlanId) return;
    const plan = getPlan(activePlanId);
    if (!Array.isArray(plan?.plan)) return;
    setCurrentPlanItemTexts(
      new Set(plan.plan.map(i => (i.text || i.content || '').toLowerCase().trim()).filter(Boolean))
    );
  }, [activePlanId, getPlan]);

  // When a plan is updated (item added, synced, etc.) we rebuild the set of
  // normalised item texts so SuggestionList can filter out already-added items.
  useEffect(() => {
    const handlePlanUpdated = (event) => {
      const plan = event.plan || event.data;
      if (!Array.isArray(plan?.plan)) return;
      setCurrentPlanItemTexts(
        new Set(plan.plan.map(i => (i.text || i.content || '').toLowerCase().trim()).filter(Boolean))
      );
    };
    const unsub1 = eventBus.subscribe('plan:updated', handlePlanUpdated);
    const unsub2 = eventBus.subscribe('plan:created', handlePlanUpdated);
    return () => { unsub1(); unsub2(); };
  }, []);

  // ── Scroll to bottom on new messages ─────────────────────────────────────
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !messagesEndRef.current) return;

    // Always scroll when the user explicitly sent a message
    const forcedByUser = userSentRef.current;
    if (forcedByUser) {
      userSentRef.current = false;
    }

    // Otherwise only auto-scroll if user is within ~80px of the bottom
    const scrollFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const nearBottom = scrollFromBottom < 80;

    if (forcedByUser || nearBottom) {
      messagesEndRef.current.scrollIntoView({
        behavior: isStreaming ? 'auto' : 'smooth'
      });
    }
  }, [messages, isStreaming]);

  // ── Close on Escape key ───────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // ── Attachment handlers ────────────────────────────────────────────────────
  const ALLOWED_ATTACH_TYPES = 'image/jpeg,image/png,image/gif,image/webp,image/tiff,application/pdf,text/plain,text/csv';
  const MAX_ATTACH_SIZE = 10 * 1024 * 1024; // 10MB

  const handleAttachClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_ATTACH_SIZE) {
      logger.warn('[BienBotPanel] File too large', { size: file.size });
      // Reset the input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setAttachment(file);
    // Generate local preview URL for images
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setAttachmentPreviewUrl(url);
    } else {
      setAttachmentPreviewUrl(null);
    }
    // Reset the file input so the same file can be re-selected if removed
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleRemoveAttachment = useCallback(() => {
    if (attachmentPreviewUrl) {
      URL.revokeObjectURL(attachmentPreviewUrl);
    }
    setAttachment(null);
    setAttachmentPreviewUrl(null);
  }, [attachmentPreviewUrl]);

  // ── Send message handler ──────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const text = inputRef.current?.value?.trim();
    if (!text || isStreaming || isLoading) return;

    logger.debug('[BienBotPanel] Sending message', { length: text.length, hasAttachment: !!attachment });
    userSentRef.current = true;

    // Detect /message slash command — routes to peer exchange (no LLM)
    const isMessageCommand = /^\/message\s/.test(text);
    if (currentSession && (isMessageCommand || !isSessionOwner || replyTo)) {
      // Non-owner, owner using /message command, or owner replying to a collaborator
      // → shared comment path (no LLM). Strip the /message prefix if present.
      const content = isMessageCommand ? text.replace(/^\/message\s+/, '') : text;
      if (content) {
        sendSharedComment(content, replyTo?.msg_id || null);
      }
      setReplyTo(null);
    } else {
      sendMessage(text, attachment || undefined);
    }

    // Clear the textarea and attachment
    if (inputRef.current) {
      inputRef.current.value = '';
      inputValueRef.current = '';
      resetHistory();
    }
    resetTextareaHeight();
    if (attachmentPreviewUrl) {
      URL.revokeObjectURL(attachmentPreviewUrl);
      setAttachmentPreviewUrl(null);
    }
    setAttachment(null);
  }, [isStreaming, isLoading, isSessionOwner, replyTo, sendSharedComment, sendMessage, attachment, resetTextareaHeight, attachmentPreviewUrl, resetHistory]);

  // Keyboard submit (Enter without Shift) + input history recall (ArrowUp / ArrowDown)
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
        return;
      }

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        // Build newest-first list of user message texts from the current session.
        // messagesRef is kept in sync with `messages` via a useEffect.
        const history = messagesRef.current
          .filter(m => m.role === 'user' && typeof m.content === 'string' && m.content.trim())
          .map(m => m.content)
          .reverse();
        handleHistoryKey(e, history);
      }
    },
    [handleSend, handleHistoryKey]
  );

  // ── Collaborator reply — pre-fill textarea with /message slash command ──
  const handleReplyToCollaborator = useCallback(
    (msg) => {
      const senderName = msg.sender_name;
      setReplyTo({
        msg_id: msg.msg_id,
        preview: msg.content?.slice(0, 100) || '',
        senderName
      });
      if (inputRef.current) {
        const prefix = `/message @${senderName} `;
        inputRef.current.value = prefix;
        inputValueRef.current = prefix;
        resizeTextarea();
        inputRef.current.focus();
        inputRef.current.setSelectionRange(prefix.length, prefix.length);
      }
    },
    [resizeTextarea]
  );

  // ── Chip click — fill textarea with template ───────────────────────────
  const handleChipClick = useCallback(
    (step) => {
      const text = step.label || step.text || step;
      if (!text) return;

      if (typeof text === 'string' && inputRef.current) {
        inputRef.current.value = text;
        inputRef.current.focus();
        resizeTextarea();
      }
    },
    [resizeTextarea]
  );

  // ── Action execute/cancel ─────────────────────────────────────────────────

  const handleCancelAction = useCallback(
    (actionId) => {
      logger.debug('[BienBotPanel] Cancelling action', { actionId });
      cancelAction(actionId);
      inputRef.current?.focus();
    },
    [cancelAction]
  );

  const handleUpdateAction = useCallback(
    (actionId, description) => {
      // Cancel the action so BienBot can propose a revised one
      cancelAction(actionId);
      // Pre-fill the input with a correction prompt including the original description
      if (inputRef.current) {
        const prefix = description ? `Update this action: ${description}` : 'Update this action: ';
        inputRef.current.value = prefix;
        inputRef.current.focus();
        inputRef.current.setSelectionRange(prefix.length, prefix.length);
        resizeTextarea();
      }
    },
    [cancelAction, resizeTextarea]
  );

  // ── Workflow step handlers ────────────────────────────────────────────────
  const handleApproveStep = useCallback(
    async (actionId) => {
      logger.debug('[BienBotPanel] Approving workflow step', { actionId });
      const result = await approveStep(actionId);

      // Auto-navigate when the step creates an entity
      if (result?.action?.result) {
        const navUrl = getNavigationUrlForResult(result.action);
        if (navUrl) navigate(navUrl);
      }

      // Contextual enrichment from step execution (e.g. tips after destination creation)
      if (result?.enrichment) {
        appendStructuredContent(result.enrichment);
      }
    },
    [approveStep, navigate, appendStructuredContent]
  );

  const handleSkipStep = useCallback(
    (actionId) => {
      logger.debug('[BienBotPanel] Skipping workflow step', { actionId });
      skipStep(actionId);
    },
    [skipStep]
  );

  const handleEditStep = useCallback(
    async (actionId, newPayload) => {
      logger.debug('[BienBotPanel] Editing workflow step', { actionId });
      const result = await editStep(actionId, newPayload);

      if (result?.action?.result) {
        const navUrl = getNavigationUrlForResult(result.action);
        if (navUrl) navigate(navUrl);
      }
    },
    [editStep, navigate]
  );

  const handleCancelWorkflow = useCallback(
    (workflowId) => {
      logger.debug('[BienBotPanel] Cancelling workflow', { workflowId });
      cancelWorkflow(workflowId);
    },
    [cancelWorkflow]
  );

  // ── Backdrop click closes panel ───────────────────────────────────────────
  const handleBackdropClick = useCallback(
    (e) => {
      if (e.target !== e.currentTarget) return;
      const draft = inputRef.current?.value?.trim();
      const hasUnsaved = !!draft || !!attachment;
      if (hasUnsaved) {
        const ok = window.confirm('You have an unsent message. Close anyway?');
        if (!ok) return;
      }
      onClose();
    },
    [onClose, attachment]
  );

  // ── Notification view handler ────────────────────────────────────────────
  const handleViewNotification = useCallback(
    (resourceId, notificationId) => {
      if (resourceId) {
        navigate(`/experiences/${resourceId}`);
      }
      if (notificationId && onMarkNotificationsSeen) {
        onMarkNotificationsSeen([notificationId]);
      }
      onClose();
    },
    [navigate, onMarkNotificationsSeen, onClose]
  );

  // ── BienBot session notification handler ──────────────────────────────────
  // Keeps the panel open — marks the notification seen, loads the session,
  // and switches to chat view without closing and re-opening.
  const handleViewBienBotSession = useCallback(
    async (sessionId, notificationId) => {
      if (notificationId && onMarkNotificationsSeen) {
        onMarkNotificationsSeen([notificationId]);
      }
      try {
        userSentRef.current = true;
        await loadSession(sessionId);
        setViewMode('chat');
      } catch (e) {
        logger.error('[BienBotPanel] Failed to load session from notification', { error: e?.message });
      }
    },
    [onMarkNotificationsSeen, loadSession, setViewMode]
  );

  // Mark all unseen notifications as seen when notification-only panel opens
  useEffect(() => {
    if (open && notificationOnly && unseenNotificationIds.length > 0 && onMarkNotificationsSeen) {
      onMarkNotificationsSeen(unseenNotificationIds);
    }
  }, [open, notificationOnly, unseenNotificationIds, onMarkNotificationsSeen]);

  // Check for saved session on mount
  useEffect(() => {
    if (!open || currentSession || messages.length > 0) return;
    let cancelled = false;
    getPersistedSession().then((saved) => {
      if (!cancelled && saved?.sessionId && String(saved.userId) === String(user?._id)) {
        setSavedSession(saved);
      }
    });
    return () => { cancelled = true; };
  }, [open, currentSession, messages.length, getPersistedSession, user?._id]);

  // Load a specific session when deep-linked via initialSessionId (e.g. from
  // activity feed BienBot session link). Tracks the last-loaded session ID so
  // that (a) re-opening with the same ID after close triggers a fresh load,
  // and (b) changing to a different session ID while the panel is open also
  // triggers a load (handles rapid "View session" clicks for different sessions).
  //
  // The cleanup function resets the ref on every teardown. This is required for
  // React StrictMode (development) which intentionally runs each effect twice
  // (mount → cleanup → remount) to surface side-effect bugs. Without the cleanup
  // the ref holds 'sess123' into the second run, which then compares equal to
  // initialSessionId and skips loadSession entirely.
  const initialSessionLoadedRef = useRef(null); // null | sessionId string
  useEffect(() => {
    if (!open) {
      // Reset on every close so the next open can load a session.
      initialSessionLoadedRef.current = null;
      return;
    }
    // No session requested, or this exact session was already loaded.
    if (!initialSessionId || initialSessionLoadedRef.current === initialSessionId) return;
    initialSessionLoadedRef.current = initialSessionId;
    userSentRef.current = true;
    loadSession(initialSessionId).catch(() => {});

    // Reset on cleanup so StrictMode's double-invocation and dep-change
    // re-runs always start from a clean slate.
    return () => {
      initialSessionLoadedRef.current = null;
    };
  }, [open, initialSessionId, loadSession]);

  // Fetch sessions when the panel opens without an active session so we can
  // detect sessions shared with this user and show the share/sessions button.
  useEffect(() => {
    if (!open || currentSession) return;
    fetchSessions({ status: 'active' });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only re-run on `open` flip; `currentSession` and `fetchSessions` would re-trigger the fetch on every session change
  }, [open]);

  // ── Resume / dismiss saved session callbacks (passed to MessageList) ────────
  const handleResume = useCallback(() => {
    if (!savedSession) return;
    const sid = savedSession.sessionId;
    setSavedSession(null);
    userSentRef.current = true;
    loadSession(sid).catch(() => {
      clearPersistedSession();
    });
  }, [savedSession, loadSession, clearPersistedSession]);

  const handleDismissResume = useCallback(() => {
    setSavedSession(null);
    clearPersistedSession();
  }, [clearPersistedSession]);

  // Panel label from invokeContext
  const panelLabel = notificationOnly
    ? 'Notifications'
    : (invokeContext?.label
      ? `BienBot — ${invokeContext.label}`
      : 'BienBot');

  return (
    <>
      {/* Backdrop */}
      <div
        className={`${styles.backdrop} ${open ? styles.open : ''}`}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Drawer / bottom sheet */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={panelLabel}
        className={`${styles.panel} ${open ? styles.open : ''}`}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <BienBotHeader
          notificationOnly={notificationOnly}
          invokeContext={invokeContext}
          currentSession={currentSession}
          hasSharedSessions={hasSharedSessions}
          isSessionOwner={isSessionOwner}
          shareOpen={shareOpen}
          setShareOpen={setShareOpen}
          shareSession={shareSession}
          unshareSession={unshareSession}
          searchMutualFollowers={searchMutualFollowers}
          fetchSessions={fetchSessions}
          setViewMode={setViewMode}
          viewMode={viewMode}
          messagesCount={messages.length}
          handleNewChat={handleNewChat}
          isLoading={isLoading}
          isStreaming={isStreaming}
          clearSession={clearSession}
          onClose={onClose}
        />

        {notificationOnly ? (
          /* ── Notification-only mode ──────────────────────────── */
          <div ref={messagesContainerRef} className={styles.messages} aria-live="off" aria-atomic="false">
            {notifications.length === 0 ? (
              <div className={styles.emptyState}>
                <Text size="sm">No notifications yet</Text>
              </div>
            ) : (
              <div className={styles.notificationList}>
                {notifications.map((notif) => (
                  <NotificationItem
                    key={notif._id}
                    notification={notif}
                    onView={handleViewNotification}
                    onViewSession={handleViewBienBotSession}
                  />
                ))}
              </div>
            )}
          </div>
        ) : viewMode === 'history' ? (
          /* ── Session history view ────────────────────────────── */
          <SessionHistoryView
            sessions={sessions}
            currentSessionId={currentSession?._id}
            userId={user?._id?.toString()}
            onSelectSession={async (sid) => {
              try {
                userSentRef.current = true;
                await loadSession(sid);
                setViewMode('chat');
              } catch {
                // Session may have been deleted server-side; stay in history view
              }
            }}
            onDeleteSession={async (sid) => {
              try {
                await deleteSession(sid);
                // If that was the active session, go back to a fresh chat
                if (currentSession?._id === sid) {
                  setViewMode('chat');
                }
              } catch {
                // Silently ignore — event bus won't fire, session stays in list
              }
            }}
            onBack={() => setViewMode('chat')}
          />
        ) : (
          /* ── Chat mode ──────────────────────────────────────── */
          <>
            {/* ── Notification banner (non-intrusive, for AI users) ── */}
            {unseenNotificationIds.length > 0 && notifications.length > 0 && (
              <div className={styles.notificationBanner}>
                <FaBell size={12} className={styles.notificationBannerIcon} />
                <Text size="sm" className={styles.notificationBannerText}>
                  {unseenNotificationIds.length} new notification{unseenNotificationIds.length !== 1 ? 's' : ''}
                </Text>
                <button
                  type="button"
                  className={styles.notificationBannerDismiss}
                  onClick={() => onMarkNotificationsSeen?.(unseenNotificationIds)}
                  aria-label="Dismiss notifications"
                >
                  <CloseIcon />
                </button>
              </div>
            )}

            {/* ── Messages ───────────────────────────────────────── */}
            <MessageList
              messages={messages}
              isLoading={isLoading}
              isStreaming={isStreaming}
              currentSession={currentSession}
              emptyStateText={emptyStateText}
              savedSession={savedSession}
              onResume={handleResume}
              onDismissResume={handleDismissResume}
              onAddSuggestedItems={handleAddSuggestedItems}
              onAddPhotos={handleAddPhotos}
              onAddTips={handleAddTips}
              onViewDiscoveryResult={handleViewDiscoveryResult}
              onPlanDiscoveryResult={handlePlanDiscoveryResult}
              onDiscoveryEmpty={handleDiscoveryEmpty}
              onEntityRefSelect={handleEntityRefSelect}
              onReplyToCollaborator={handleReplyToCollaborator}
              currentPlanItemTexts={currentPlanItemTexts}
              currentUserId={user?._id?.toString()}
              messagesContainerRef={messagesContainerRef}
              messagesEndRef={messagesEndRef}
            />

            {/* ── Screen-reader status: announce only the final assistant message ── */}
            {!isStreaming && messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' && (
              <div role="status" aria-live="polite" className={styles.srOnly}>
                {messages[messages.length - 1].content}
              </div>
            )}

            {/* ── Pending action cards ────────────────────────────── */}
            <PendingActionsArea
              pendingActions={pendingActions}
              isLoading={isLoading}
              isStreaming={isStreaming}
              executingActionId={executingActionId}
              onExecute={handleExecuteAction}
              onCancel={handleCancelAction}
              onUpdate={handleUpdateAction}
              onApproveStep={handleApproveStep}
              onSkipStep={handleSkipStep}
              onEditStep={handleEditStep}
              onCancelWorkflow={handleCancelWorkflow}
            />

            <ChatInputArea
              inputRef={inputRef}
              fileInputRef={fileInputRef}
              visibleChips={visibleChips}
              onChipClick={handleChipClick}
              attachment={attachment}
              attachmentPreviewUrl={attachmentPreviewUrl}
              onAttachClick={handleAttachClick}
              onFileChange={handleFileChange}
              onRemoveAttachment={handleRemoveAttachment}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
              pendingContextSwitch={pendingContextSwitch}
              onStaySwitch={() => setPendingContextSwitch(null)}
              onAcceptSwitch={() => {
                switchContext(
                  pendingContextSwitch.entity,
                  pendingContextSwitch.entityId,
                  pendingContextSwitch.contextDescription
                );
                setPendingContextSwitch(null);
              }}
              placeholderText={placeholderText}
              isStreaming={isStreaming}
              isLoading={isLoading}
              resizeTextarea={resizeTextarea}
              onKeyDown={handleKeyDown}
              onSend={handleSend}
              allowedAttachTypes={ALLOWED_ATTACH_TYPES}
            />
          </>
        )}
      </div>
    </>
  );
}

BienBotPanel.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  invokeContext: PropTypes.shape({
    entity: PropTypes.string.isRequired,
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    contextDescription: PropTypes.string
  }),
  currentView: PropTypes.string,
  isEntityView: PropTypes.bool,
  notificationOnly: PropTypes.bool,
  notifications: PropTypes.array,
  unseenNotificationIds: PropTypes.array,
  onMarkNotificationsSeen: PropTypes.func,
  initialMessage: PropTypes.string,
  analysisSuggestions: PropTypes.shape({
    entity: PropTypes.string,
    entityLabel: PropTypes.string,
    suggestions: PropTypes.arrayOf(PropTypes.shape({
      type: PropTypes.string,
      message: PropTypes.string,
    })),
    suggestedPrompts: PropTypes.arrayOf(PropTypes.string),
  }),
  clearAnalysisSuggestions: PropTypes.func,
};

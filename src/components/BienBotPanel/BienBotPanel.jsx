/**
 * BienBotPanel — Sliding chat drawer (desktop) / bottom sheet (mobile).
 *
 * Renders the full BienBot chat UI. On desktop it slides in from the right;
 * on mobile it slides up from the bottom as a full-screen sheet.
 *
 * @module components/BienBotPanel
 */

import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { Button, Text, Heading } from '../design-system';
import { Tag } from '@chakra-ui/react';
import useBienBot from '../../hooks/useBienBot';
import {
  getSuggestionsForContext,
  getPlaceholderForContext,
  getEmptyStateForContext
} from '../../utilities/bienbot-suggestions';
import { logger } from '../../utilities/logger';
import styles from './BienBotPanel.module.css';

// ─── Close icon ──────────────────────────────────────────────────────────────

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18 6L6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── BienBot robot icon ───────────────────────────────────────────────────────

function BienBotIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="9" cy="10" r="1.25" fill="currentColor" />
      <circle cx="15" cy="10" r="1.25" fill="currentColor" />
      <path
        d="M8.5 15.5c1 1.5 5 1.5 7 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── New chat icon ──────────────────────────────────────────────────────────

function NewChatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Send icon ────────────────────────────────────────────────────────────────

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Pending action card ──────────────────────────────────────────────────────

function ActionCard({ action, onExecute, onCancel, disabled }) {
  const actionId = action._id || action.id;
  const actionType = action.type || action.action_type || 'Action';
  const description = action.description || action.summary || actionType;

  return (
    <div className={styles.actionCard}>
      <div className={styles.actionInfo}>
        <div className={styles.actionType}>{actionType}</div>
        <div className={styles.actionDescription} title={description}>
          {description}
        </div>
      </div>
      <div className={styles.actionButtons}>
        <Button
          variant="success"
          size="sm"
          onClick={() => onExecute(actionId)}
          disabled={disabled}
        >
          Yes
        </Button>
        <Button
          variant="outline-secondary"
          size="sm"
          onClick={() => onCancel(actionId)}
          disabled={disabled}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

ActionCard.propTypes = {
  action: PropTypes.shape({
    _id: PropTypes.string,
    id: PropTypes.string,
    type: PropTypes.string,
    action_type: PropTypes.string,
    description: PropTypes.string,
    summary: PropTypes.string
  }).isRequired,
  onExecute: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  disabled: PropTypes.bool
};

// ─── Main BienBotPanel component ──────────────────────────────────────────────

/**
 * BienBotPanel chat drawer.
 *
 * @param {Object} props
 * @param {boolean} props.open - Whether the panel is visible
 * @param {Function} props.onClose - Callback to close the panel
 * @param {Object|null} props.invokeContext - Entity context ({ entity, id, label }) or null for non-entity views
 * @param {string|null} props.currentView - View identifier for non-entity pages
 * @param {boolean} props.isEntityView - Whether current page is an entity detail page
 */
export default function BienBotPanel({ open, onClose, invokeContext, currentView, isEntityView }) {
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputValueRef = useRef('');
  const prevContextRef = useRef(null);
  const navigate = useNavigate();

  const {
    messages,
    pendingActions,
    suggestedNextSteps,
    isLoading,
    isStreaming,
    sendMessage,
    executeActions,
    cancelAction,
    updateContext,
    clearSession
  } = useBienBot({ invokeContext });

  const handleNewChat = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.value = '';
      inputValueRef.current = '';
    }
    clearSession();
  }, [clearSession]);

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

  // Initial suggestion chips — shown when no messages and no server-provided steps
  const initialSuggestions = useMemo(
    () => getSuggestionsForContext(entityType, currentView),
    [entityType, currentView]
  );

  // Show server-provided steps if available, otherwise initial suggestions
  const visibleChips = suggestedNextSteps.length > 0
    ? suggestedNextSteps
    : (messages.length === 0 ? initialSuggestions : []);

  // ── Focus input when panel opens ──────────────────────────────────────────
  useEffect(() => {
    if (open && inputRef.current) {
      // Small delay to wait for CSS transition
      const t = setTimeout(() => inputRef.current?.focus(), 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  // ── Detect invokeContext changes (e.g. plan item opened mid-chat) ────────
  useEffect(() => {
    if (!open || !invokeContext?.id) return;

    const prev = prevContextRef.current;
    const changed = prev && (prev.id !== invokeContext.id || prev.entity !== invokeContext.entity);

    // Store current as previous for next comparison
    prevContextRef.current = { entity: invokeContext.entity, id: invokeContext.id };

    // Only push context update when context actually changed (not on first mount)
    if (changed && messages.length > 0) {
      updateContext(invokeContext.entity, invokeContext.id, invokeContext.contextDescription);
    }
  }, [open, invokeContext?.entity, invokeContext?.id, updateContext, messages.length]);

  // ── Scroll to bottom on new messages ─────────────────────────────────────
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

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

  // ── Send message handler ──────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const text = inputRef.current?.value?.trim();
    if (!text || isStreaming || isLoading) return;

    logger.debug('[BienBotPanel] Sending message', { length: text.length });

    sendMessage(text);

    // Clear the textarea
    if (inputRef.current) {
      inputRef.current.value = '';
      inputValueRef.current = '';
    }
  }, [isStreaming, isLoading, sendMessage]);

  // Keyboard submit (Enter without Shift)
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // ── Chip click — fill textarea with template ───────────────────────────
  const handleChipClick = useCallback(
    (step) => {
      const text = step.label || step.text || step;
      if (!text) return;

      if (typeof text === 'string' && inputRef.current) {
        inputRef.current.value = text;
        inputRef.current.focus();
      }
    },
    []
  );

  // ── Action execute/cancel ─────────────────────────────────────────────────
  const handleExecuteAction = useCallback(
    (actionId) => {
      logger.debug('[BienBotPanel] Executing action', { actionId });

      // Check if it's a navigate action
      const action = pendingActions.find(a => (a._id || a.id) === actionId);
      if (action && action.type === 'navigate_to_entity') {
        const url = action.payload?.url;
        if (url) {
          navigate(url);
          // Remove from pending without server call
          cancelAction(actionId);
          return;
        }
      }

      executeActions([actionId]);
    },
    [executeActions, pendingActions, cancelAction, navigate]
  );

  const handleCancelAction = useCallback(
    (actionId) => {
      logger.debug('[BienBotPanel] Cancelling action', { actionId });
      cancelAction(actionId);
    },
    [cancelAction]
  );

  // ── Backdrop click closes panel ───────────────────────────────────────────
  const handleBackdropClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  // Panel label from invokeContext
  const panelLabel = invokeContext?.label
    ? `BienBot — ${invokeContext.label}`
    : 'BienBot';

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
        role="dialog"
        aria-modal="true"
        aria-label={panelLabel}
        className={`${styles.panel} ${open ? styles.open : ''}`}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <div className={styles.header}>
          <span className={styles.botIcon} aria-hidden="true">
            <BienBotIcon />
          </span>

          <div className={styles.headerTitle}>
            <Heading level={5} style={{ margin: 0, lineHeight: 1.3 }}>
              BienBot
            </Heading>
            {invokeContext?.label && (
              <Text
                size="sm"
                className={styles.headerLabel}
                title={invokeContext.label}
              >
                {invokeContext.label}
              </Text>
            )}
          </div>

          {messages.length > 0 && (
            <button
              type="button"
              className={styles.newChatButton}
              onClick={handleNewChat}
              aria-label="Start new chat"
              title="New chat"
              disabled={isStreaming}
            >
              <NewChatIcon />
            </button>
          )}

          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close BienBot"
          >
            <CloseIcon />
          </button>
        </div>

        {/* ── Messages ───────────────────────────────────────── */}
        <div className={styles.messages} aria-live="polite" aria-atomic="false">
          {messages.length === 0 && !isLoading ? (
            <div className={styles.emptyState}>
              <Text size="sm">{emptyStateText}</Text>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.role === 'user';
              const isAssistant = msg.role === 'assistant';
              const isCurrentlyStreaming =
                isAssistant && isStreaming && msg === messages[messages.length - 1];

              return (
                <div
                  key={msg._id}
                  className={[
                    styles.message,
                    isUser ? styles.messageUser : styles.messageAssistant,
                    msg.error ? styles.messageError : '',
                    msg.isContextAck ? styles.messageContextAck : '',
                    isCurrentlyStreaming ? styles.streaming : ''
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {msg.content}
                </div>
              );
            })
          )}

          {/* Loading dots (between last user message and first assistant token) */}
          {isLoading && !isStreaming && (
            <div className={styles.loadingDots} aria-label="BienBot is thinking">
              <span />
              <span />
              <span />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Pending action cards ────────────────────────────── */}
        {pendingActions.length > 0 && (
          <div className={styles.actionsContainer}>
            {pendingActions.map((action) => (
              <ActionCard
                key={action._id || action.id}
                action={action}
                onExecute={handleExecuteAction}
                onCancel={handleCancelAction}
                disabled={isLoading || isStreaming}
              />
            ))}
          </div>
        )}

        {/* ── Suggested action chips ───────────────────────────── */}
        {visibleChips.length > 0 && (
          <div className={styles.chipsContainer}>
            {visibleChips.map((step, idx) => {
              const label =
                typeof step === 'string'
                  ? step
                  : step.label || step.text || '';
              return (
                <Tag.Root
                  key={idx}
                  variant="outline"
                  colorPalette="purple"
                  size="lg"
                  className={styles.chip}
                  onClick={() => handleChipClick(step)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleChipClick(step);
                    }
                  }}
                >
                  <Tag.Label>{label}</Tag.Label>
                </Tag.Root>
              );
            })}
          </div>
        )}

        {/* ── Input area ──────────────────────────────────────── */}
        <div className={styles.inputArea}>
          <textarea
            ref={inputRef}
            className={styles.textInput}
            placeholder={placeholderText}
            rows={1}
            disabled={isStreaming}
            onKeyDown={handleKeyDown}
            aria-label="Message input"
          />
          <Button
            variant="primary"
            size="md"
            className={styles.sendButton}
            onClick={handleSend}
            disabled={isLoading || isStreaming}
            aria-label="Send message"
          >
            <SendIcon />
          </Button>
        </div>
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
  isEntityView: PropTypes.bool
};

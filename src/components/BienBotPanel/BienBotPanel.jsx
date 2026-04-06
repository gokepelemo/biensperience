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
import { useNavigate, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FaBell } from 'react-icons/fa';
import { Button, Text, Heading } from '../design-system';
import { Tag } from '@chakra-ui/react';
import useBienBot from '../../hooks/useBienBot';
import { useUser } from '../../contexts/UserContext';
import {
  getSuggestionsForContext,
  getPlaceholderForContext,
  getEmptyStateForContext,
  getNavigationUrlForResult
} from '../../utilities/bienbot-suggestions';
import { logger } from '../../utilities/logger';
import WorkflowStepCard from './WorkflowStepCard';
import PlanSelector from './PlanSelector';
import SuggestionList from './SuggestionList';
import TipSuggestionList from './TipSuggestionList';
import BienBotPhotoGallery from './BienBotPhotoGallery';
import DiscoveryResultCard from './DiscoveryResultCard';
import PendingActionCard from './PendingActionCard';
import SessionHistoryView from './SessionHistoryView';
import EntityRefList from './EntityRefList';
import { getAttachmentUrl, applyTips as applyTipsAPI } from '../../utilities/bienbot-api';
import { eventBus } from '../../utilities/event-bus';
import Autocomplete from '../Autocomplete/Autocomplete';
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

// ─── History icon ──────────────────────────────────────────────────────────

function HistoryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 8v4l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
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

// ─── Share icon ─────────────────────────────────────────────────────────────

function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="18" cy="5" r="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="18" cy="19" r="3" stroke="currentColor" strokeWidth="2" />
      <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

// ─── Session share popover ──────────────────────────────────────────────────

function SessionSharePopover({ open, onClose, sharedWith, onShare, onUnshare, isOwner, onSearchUsers }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = useCallback(async (query) => {
    setSearchQuery(query);
    if (!query || query.length < 2 || !onSearchUsers) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const users = await onSearchUsers(query);
      // Filter out users already shared with
      const sharedIds = new Set((sharedWith || []).map(c => c.user_id?.toString()));
      setSearchResults((users || []).filter(u => !sharedIds.has(u._id?.toString())));
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [onSearchUsers, sharedWith]);

  const handleSelect = useCallback(async (item) => {
    if (!item?._id || isSubmitting) return;
    setError('');
    setIsSubmitting(true);
    try {
      const result = await onShare(item._id, 'viewer');
      if (result) {
        setSearchQuery('');
        setSearchResults([]);
      } else {
        setError('Could not share. The user may not mutually follow you.');
      }
    } catch {
      setError('Failed to share session.');
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, onShare]);

  if (!open) return null;

  return (
    <div className={styles.sharePopover}>
      <div className={styles.sharePopoverHeader}>
        <Text size="sm" style={{ fontWeight: 600 }}>Share session</Text>
        <button type="button" className={styles.sharePopoverClose} onClick={onClose} aria-label="Close share popover">
          <CloseIcon />
        </button>
      </div>

      {isOwner && (
        <div className={styles.shareForm}>
          <Autocomplete
            inputId="bienbot-share-search"
            placeholder="Search mutual followers…"
            entityType="user"
            items={searchResults}
            onSelect={handleSelect}
            onSearch={handleSearch}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            showAvatar={true}
            showMeta={true}
            size="sm"
            loading={isSearching}
            emptyMessage={
              searchQuery && searchQuery.length < 2
                ? 'Type at least 2 characters'
                : 'No mutual followers found'
            }
            disableFilter={true}
            disabled={isSubmitting}
          />
        </div>
      )}

      {error && <Text size="sm" className={styles.shareError}>{error}</Text>}

      {(sharedWith || []).length > 0 && (
        <div className={styles.shareList}>
          {sharedWith.map((collab) => (
            <div key={collab.user_id} className={styles.shareListItem}>
              <Text size="sm" className={styles.shareListUser}>
                {collab.user_name || collab.user_id?.toString().slice(-6)}
              </Text>
              {isOwner && (
                <button
                  type="button"
                  className={styles.shareRemoveButton}
                  onClick={() => onUnshare(collab.user_id)}
                  aria-label="Remove collaborator"
                  title="Remove"
                >
                  <CloseIcon />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {(sharedWith || []).length === 0 && !isOwner && (
        <Text size="sm" style={{ color: 'var(--color-text-tertiary)', padding: 'var(--space-2) 0' }}>
          No collaborators yet.
        </Text>
      )}
    </div>
  );
}

SessionSharePopover.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  sharedWith: PropTypes.array,
  onShare: PropTypes.func.isRequired,
  onUnshare: PropTypes.func.isRequired,
  isOwner: PropTypes.bool,
  onSearchUsers: PropTypes.func
};

// ─── Paperclip (attach) icon ──────────────────────────────────────────────────

function AttachIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// PlanCard removed — plan disambiguation now handled by PlanSelector component

// ─── Inline entity chip renderer ─────────────────────────────────────────────

/**
 * Parse message text and replace inline JSON entity refs with clickable chips.
 * Pattern: {"_id":"...","name":"...","type":"..."} (keys in any order)
 *
 * @param {string} text - Raw message text from the LLM
 * @param {Function} navigate - React Router navigate function
 * @param {object} chipStyles - CSS module styles object
 * @returns {React.ReactNode}
 */
// Match compact JSON entity refs embedded in LLM output
const ENTITY_JSON_RE = /\{[^{}]*"_id"\s*:\s*"[^"]*"[^{}]*"name"\s*:\s*"[^"]*"[^{}]*"type"\s*:\s*"[^"]*"[^{}]*\}/g;
// Placeholder token used to survive markdown parsing: \uE000entity{n}\uE001 (Private Use Area - safe through remark)
const PLACEHOLDER_RE = /\uE000entity(\d+)\uE001/g;

function buildEntityChip(ref, idx, _navigate, chipStyles) {
  const { _id, name, type } = ref;
  let url = null;
  if (_id && name && type) {
    if (type === 'destination') url = `/destinations/${_id}`;
    else if (type === 'experience') url = `/experiences/${_id}`;
    else if (type === 'plan') url = ref.experience_id ? `/experiences/${ref.experience_id}#plan-${_id}` : null;
  }
  const label = name || type || 'entity';
  if (url) {
    return (
      <Link
        key={`chip-${_id}-${idx}`}
        to={url}
        className={chipStyles.inlineEntityChip}
        aria-label={`View ${type}: ${label}`}
      >
        {label}
      </Link>
    );
  }
  return <span key={`chip-nolink-${idx}`} className={chipStyles.inlineEntityChipNoLink}>{label}</span>;
}

function substituteChips(text, entityRefs, navigate, chipStyles) {
  if (typeof text !== 'string') return text;
  const parts = [];
  let last = 0;
  let m;
  PLACEHOLDER_RE.lastIndex = 0;
  while ((m = PLACEHOLDER_RE.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const ref = entityRefs[parseInt(m[1], 10)];
    if (ref) parts.push(buildEntityChip(ref, m.index, navigate, chipStyles));
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  if (parts.length === 0) return text;
  if (parts.length === 1) return parts[0];
  return parts.map((p, i) => (typeof p === 'string' ? <React.Fragment key={i}>{p}</React.Fragment> : p));
}

function processChildren(children, entityRefs, navigate, chipStyles) {
  return React.Children.map(children, (child) => {
    if (typeof child === 'string') return substituteChips(child, entityRefs, navigate, chipStyles);
    return child;
  });
}

function renderMessageContent(text, navigate, chipStyles, role) {
  if (!text) return null;

  // Extract entity JSON refs and replace with placeholder tokens
  const entityRefs = [];
  ENTITY_JSON_RE.lastIndex = 0;
  const processedText = text.replace(ENTITY_JSON_RE, (match) => {
    try {
      entityRefs.push(JSON.parse(match));
      return `\uE000entity${entityRefs.length - 1}\uE001`;
    } catch {
      return match;
    }
  });

  // User messages: plain text with entity chips (no markdown parsing)
  if (role !== 'assistant') {
    const result = substituteChips(processedText, entityRefs, navigate, chipStyles);
    if (!Array.isArray(result)) return result;
    return result.map((p, i) => (typeof p === 'string' ? <React.Fragment key={i}>{p}</React.Fragment> : p));
  }

  // Assistant messages: full markdown rendering with entity chip substitution
  const bindChip = (children) => processChildren(children, entityRefs, navigate, chipStyles);

  const mdComponents = {
    p: ({ children }) => <p>{bindChip(children)}</p>,
    li: ({ children }) => <li>{bindChip(children)}</li>,
    a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
    pre: ({ children }) => <pre className={chipStyles.codeBlock}>{children}</pre>,
    code: ({ children, className }) => <code className={className}>{children}</code>,
  };

  return (
    <div className={chipStyles.markdownContent}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
        {processedText}
      </ReactMarkdown>
    </div>
  );
}

// ─── Notification item ───────────────────────────────────────────────────────

function NotificationItem({ notification, onView, onViewSession }) {
  const message = notification.reason ||
    `${notification.actor?.name || 'Someone'} added you as a collaborator to ${notification.resource?.name || 'an experience'}`;
  const resourceId = notification.resource?.id || notification.resource?._id;
  const isBienBotSession = notification.resource?.type === 'BienBotSession';

  return (
    <div className={styles.notificationItem}>
      <span className={styles.notificationIcon} aria-hidden="true">
        <FaBell size={14} />
      </span>
      <div className={styles.notificationContent}>
        <Text size="sm">{message}</Text>
        {resourceId && !isBienBotSession && (
          <button
            type="button"
            className={styles.notificationViewButton}
            onClick={() => onView(resourceId, notification._id)}
          >
            View
          </button>
        )}
        {isBienBotSession && resourceId && (
          <button
            type="button"
            className={styles.notificationViewButton}
            onClick={() => onViewSession?.(resourceId, notification._id)}
          >
            View session
          </button>
        )}
        {isBienBotSession && !resourceId && (
          <button
            type="button"
            className={styles.notificationViewButton}
            onClick={() => onView(null, notification._id)}
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}

NotificationItem.propTypes = {
  notification: PropTypes.shape({
    _id: PropTypes.string,
    reason: PropTypes.string,
    actor: PropTypes.shape({ name: PropTypes.string }),
    resource: PropTypes.shape({
      id: PropTypes.string,
      _id: PropTypes.string,
      name: PropTypes.string
    })
  }).isRequired,
  onView: PropTypes.func.isRequired,
  onViewSession: PropTypes.func
};

// ─── Image attachment with signed URL ─────────────────────────────────────────

function ImageAttachment({ attachment, sessionId, messageIndex, attachmentIndex }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId || messageIndex < 0 || attachmentIndex < 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const result = await getAttachmentUrl(sessionId, messageIndex, attachmentIndex);
        if (!cancelled && result?.url) {
          setImageUrl(result.url);
        }
      } catch (err) {
        logger.debug('[BienBotPanel] Failed to load attachment URL', { error: err.message });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [sessionId, messageIndex, attachmentIndex]);

  if (loading) {
    return (
      <span className={styles.attachmentBadge}>
        <span className={styles.attachmentFilename}>{attachment.filename}</span>
      </span>
    );
  }

  if (imageUrl) {
    return (
      <div className={styles.imageAttachment}>
        <img
          src={imageUrl}
          alt={attachment.filename}
          className={styles.imageAttachmentThumb}
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <span className={styles.attachmentBadge}>
      <span className={styles.attachmentFilename}>{attachment.filename}</span>
    </span>
  );
}

ImageAttachment.propTypes = {
  attachment: PropTypes.shape({
    filename: PropTypes.string.isRequired,
    mimeType: PropTypes.string,
    s3Key: PropTypes.string
  }).isRequired,
  sessionId: PropTypes.string,
  messageIndex: PropTypes.number.isRequired,
  attachmentIndex: PropTypes.number.isRequired
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
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputValueRef = useRef('');
  const prevContextRef = useRef(null);
  // Tracks which (sessionId, entity, entityId) combos have already been reconciled
  // so we don't call updateContext more than once per session+entity pair.
  const sessionContextReconciledRef = useRef(null);
  // Refs for stable plan-focus subscription (avoids stale closures)
  const openRef = useRef(open);
  const messagesRef = useRef([]);
  const updateContextRef = useRef(null);
  const planFocusRef = useRef({ sentPlans: new Set(), lastSessionId: null });
  const [attachment, setAttachment] = useState(null);
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [executingActionId, setExecutingActionId] = useState(null);
  const [savedSession, setSavedSession] = useState(null);
  const [viewMode, setViewMode] = useState('chat');

  const { user } = useUser();

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
    executeActions,
    cancelAction,
    updateContext,
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
    resetSession,
    getPersistedSession,
    clearPersistedSession,
    fetchSessions
  } = useBienBot({ invokeContext, navigationSchema, userId: user?._id });

  // ── Handle adding suggested plan items ─────────────────────────────────
  const handleAddSuggestedItems = useCallback(
    (items) => {
      if (!items?.length || isStreaming || isLoading) return;
      const itemNames = items.map(i => i.text || i.content).filter(Boolean);
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
      const photoPayload = photos.map(p => ({
        url: p.url,
        photographer: p.photographer,
        photographer_url: p.photographer_url,
        unsplash_url: p.unsplash_url
      }));
      const msg = `Add ${photos.length} selected photo${photos.length !== 1 ? 's' : ''} to the ${entityType}`;
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
    (experienceName, experienceId) => {
      if (!experienceName || isStreaming || isLoading) return;
      // The experience_id is available to the LLM via the discovery context block,
      // so we don't need to expose it in the visible message text.
      sendMessage(`I want to plan \`${experienceName}\``);
    },
    [sendMessage, isStreaming, isLoading]
  );

  // ── Handle entity ref card selection (disambiguation from BienBot) ──────
  const handleEntityRefSelect = useCallback(
    (ref) => {
      if (isStreaming || isLoading || !ref?._id || !ref?.name) return;
      switch (ref.type) {
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

    // Set suggested prompts as clickable chips so the user can act on the greeting
    if (analysisSuggestions.suggestedPrompts?.length > 0) {
      setSuggestedNextSteps(analysisSuggestions.suggestedPrompts);
    }

    if (clearAnalysisSuggestions) {
      clearAnalysisSuggestions();
    }
  }, [open, analysisSuggestions]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Re-focus input after BienBot finishes responding ─────────────────────
  useEffect(() => {
    if (!isLoading && !isStreaming && open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLoading, isStreaming, open]);

  // ── Detect invokeContext changes when panel opens on a different entity ──
  useEffect(() => {
    if (!open || !invokeContext?.id) return;

    const prev = prevContextRef.current;
    const changed = prev && (prev.id !== invokeContext.id || prev.entity !== invokeContext.entity);

    // Store current as previous for next comparison
    prevContextRef.current = { entity: invokeContext.entity, id: invokeContext.id };

    if (!changed) return;

    const hasUserMessages = messagesRef.current.some(m => m.role === 'user');

    if (hasUserMessages) {
      // User is engaged in a conversation: inject an acknowledgment note so they
      // know BienBot now has context for the new entity. The session continues
      // with enriched context. The analysis greeting is intentionally skipped
      // (handled above in the analysisSuggestions effect guard).
      updateContext(invokeContext.entity, invokeContext.id, invokeContext.contextDescription);
    } else {
      // User hasn't engaged (only saw the greeting): reset session tracking so
      // the next message starts a fresh session anchored to the new entity.
      // Messages are NOT cleared — the analysisSuggestions effect already
      // replaced/injected the new entity's greeting.
      resetSession();
    }
  }, [open, invokeContext?.entity, invokeContext?.id, updateContext, resetSession]);

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

  // ── Sync refs used by the stable plan-focus subscription ─────────────────
  useEffect(() => { openRef.current = open; }, [open]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { updateContextRef.current = updateContext; }, [updateContext]);

  // Reset plan-focus dedup tracking when the session changes
  useEffect(() => {
    const sessionId = currentSession?._id || null;
    if (planFocusRef.current.lastSessionId !== sessionId) {
      planFocusRef.current = { sentPlans: new Set(), lastSessionId: sessionId };
    }
  }, [currentSession?._id]);

  // ── Enrich BienBot context when plan tab becomes active mid-conversation ──
  useEffect(() => {
    const unsub = eventBus.subscribe('bienbot:plan_focused', (event) => {
      if (!openRef.current) return; // Panel must be open
      if (!messagesRef.current?.length) return; // Conversation must be in progress
      const { planId, entity = 'plan', contextDescription } = event;
      if (!planId) return;
      const { sentPlans } = planFocusRef.current;
      if (sentPlans.has(planId)) return; // Already sent for this plan in this session
      sentPlans.add(planId);
      updateContextRef.current?.(entity, planId, contextDescription);
    });
    return () => unsub();
  }, []); // Stable — uses refs to access latest values

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
    }
    resetTextareaHeight();
    if (attachmentPreviewUrl) {
      URL.revokeObjectURL(attachmentPreviewUrl);
      setAttachmentPreviewUrl(null);
    }
    setAttachment(null);
  }, [isStreaming, isLoading, isSessionOwner, replyTo, sendSharedComment, sendMessage, attachment, resetTextareaHeight, attachmentPreviewUrl]);

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
  const handleExecuteAction = useCallback(
    async (actionId) => {
      logger.debug('[BienBotPanel] Executing action', { actionId });

      // Check if it's a navigate action (client-only, no server call)
      const action = pendingActions.find(a => (a._id || a.id) === actionId);
      if (action && action.type === 'navigate_to_entity') {
        const url = action.payload?.url;
        // Validate URL contains real IDs, not LLM placeholders like <unknown> or <experienceId>
        if (url && !/<[^>]+>/.test(url)) {
          navigate(url);
          cancelAction(actionId);
          return;
        }
        // Bad URL — cancel without navigating
        cancelAction(actionId);
        return;
      }

      // For select_plan, cancel all other select_plan actions (user picked one)
      if (action && action.type === 'select_plan') {
        const otherSelectPlans = pendingActions.filter(
          a => a.type === 'select_plan' && (a._id || a.id) !== actionId
        );
        for (const other of otherSelectPlans) {
          cancelAction(other._id || other.id);
        }
      }

      // For select_destination, cancel all other select_destination actions (user picked one)
      if (action && action.type === 'select_destination') {
        const otherSelectDestinations = pendingActions.filter(
          a => a.type === 'select_destination' && (a._id || a.id) !== actionId
        );
        for (const other of otherSelectDestinations) {
          cancelAction(other._id || other.id);
        }
      }

      // Show executing state on the action card
      setExecutingActionId(actionId);

      const result = await executeActions([actionId]);

      setExecutingActionId(null);

      // Build a feedback message summarizing what happened
      if (result?.results) {
        const feedbackLines = [];
        for (const actionResult of result.results) {
          if (actionResult.success) {
            if (actionResult.type === 'create_plan') {
              const expName = actionResult.result?.experience?.name || '';
              const itemCount = actionResult.result?.plan?.length || 0;
              feedbackLines.push(
                `\u2705 Plan created${expName ? ` for ${expName}` : ''}${itemCount > 0 ? ` with ${itemCount} item${itemCount !== 1 ? 's' : ''}` : ''}. Taking you there now\u2026`
              );
            } else {
              const entityName = actionResult.result?.name || actionResult.result?.title || actionResult.result?.content || '';
              const typeLabel = (actionResult.type || '').replace(/_/g, ' ');
              feedbackLines.push(`\u2705 ${typeLabel}${entityName ? `: ${entityName}` : ''}`);
            }
          } else {
            const typeLabel = (actionResult.type || '').replace(/_/g, ' ');
            feedbackLines.push(`\u274c ${typeLabel}: ${actionResult.error || 'failed'}`);
          }
        }
        if (feedbackLines.length > 0) {
          appendMessage({
            _id: `exec-result-${Date.now()}`,
            role: 'assistant',
            content: feedbackLines.join('\n'),
            createdAt: new Date().toISOString(),
            isActionResult: true
          });
        }

        // Auto-navigate to newly created entities (panel stays open)
        for (const actionResult of result.results) {
          const navUrl = getNavigationUrlForResult(actionResult);
          if (navUrl) {
            navigate(navUrl);
            break; // Only navigate once
          }
        }
      }

      // Contextual enrichment: suggestions/tips/photos after entity creation
      if (result?.enrichment) {
        appendStructuredContent(result.enrichment);
      }
    },
    [executeActions, pendingActions, cancelAction, navigate, appendStructuredContent, appendMessage]
  );

  const handleCancelAction = useCallback(
    (actionId) => {
      logger.debug('[BienBotPanel] Cancelling action', { actionId });
      cancelAction(actionId);
      setTimeout(() => inputRef.current?.focus(), 50);
    },
    [cancelAction]
  );

  const handleUpdateAction = useCallback(
    (actionId, description) => {
      // Cancel the action so BienBot can propose a revised one
      cancelAction(actionId);
      // Pre-fill the input with a correction prompt
      if (inputRef.current) {
        inputRef.current.value = `Update this action: `;
        inputRef.current.focus();
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
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
        role="dialog"
        aria-modal="true"
        aria-label={panelLabel}
        className={`${styles.panel} ${open ? styles.open : ''}`}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <div className={styles.header}>
          <span className={styles.botIcon} aria-hidden="true">
            {notificationOnly ? <FaBell size={22} /> : <BienBotIcon />}
          </span>

          <div className={styles.headerTitle}>
            <Heading level={5} style={{ margin: 0, lineHeight: 1.3 }}>
              {notificationOnly ? 'Notifications' : 'BienBot'}
            </Heading>
            {!notificationOnly && invokeContext?.label && (
              <Text
                size="sm"
                className={styles.headerLabel}
                title={invokeContext.label}
              >
                {invokeContext.label}
              </Text>
            )}
          </div>

          {!notificationOnly && (currentSession || hasSharedSessions) && (
            <div className={styles.shareWrapper}>
              <button
                type="button"
                className={styles.newChatButton}
                onClick={() => {
                  if (!currentSession) {
                    // No active session — open history so the user can select a shared session
                    fetchSessions({ status: 'active' });
                    setViewMode('history');
                  } else {
                    setShareOpen(prev => !prev);
                  }
                }}
                aria-label={currentSession ? 'Share session' : 'View shared sessions'}
                title={currentSession ? 'Share session' : 'View shared sessions'}
              >
                <ShareIcon />
                {currentSession && (currentSession.shared_with || []).length > 0 && (
                  <span className={styles.shareBadge}>{currentSession.shared_with.length}</span>
                )}
              </button>
              {currentSession && (
                <SessionSharePopover
                  open={shareOpen}
                  onClose={() => setShareOpen(false)}
                  sharedWith={currentSession.shared_with}
                  onShare={shareSession}
                  onUnshare={unshareSession}
                  isOwner={isSessionOwner}
                  onSearchUsers={searchMutualFollowers}
                />
              )}
            </div>
          )}

          {!notificationOnly && messages.length > 0 && (
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

          {!notificationOnly && (
            <button
              type="button"
              className={styles.newChatButton}
              onClick={() => {
                if (viewMode === 'history') {
                  setViewMode('chat');
                } else {
                  fetchSessions({ status: 'active' });
                  setViewMode('history');
                }
              }}
              aria-label={viewMode === 'history' ? 'Back to chat' : 'Chat history'}
              title={viewMode === 'history' ? 'Back to chat' : 'Chat history'}
            >
              <HistoryIcon />
            </button>
          )}

          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label={notificationOnly ? 'Close notifications' : 'Close BienBot'}
          >
            <CloseIcon />
          </button>
        </div>

        {notificationOnly ? (
          /* ── Notification-only mode ──────────────────────────── */
          <div className={styles.messages} aria-live="polite" aria-atomic="false">
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
            <div className={styles.messages} aria-live="polite" aria-atomic="false">
              {savedSession && !currentSession && messages.length === 0 && !isLoading ? (
                <div className={styles.resumePrompt}>
                  <Text size="sm">You have an unfinished conversation.</Text>
                  <div className={styles.resumeButtons}>
                    <Button
                      variant="gradient"
                      size="sm"
                      onClick={() => {
                        const sid = savedSession.sessionId;
                        setSavedSession(null);
                        loadSession(sid).catch(() => {
                          clearPersistedSession();
                        });
                      }}
                    >
                      Continue
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSavedSession(null);
                        clearPersistedSession();
                      }}
                    >
                      New Chat
                    </Button>
                  </div>
                </div>
              ) : messages.length === 0 && !isLoading ? (
                <div className={styles.emptyState}>
                  <Text size="sm">{emptyStateText}</Text>
                </div>
              ) : (
                messages.map((msg, msgIdx) => {
                  const isUser = msg.role === 'user';
                  const isAssistant = msg.role === 'assistant';
                  const isSharedComment = msg.message_type === 'shared_comment';
                  // A collaborator message is a shared_comment from someone other than the
                  // current user. We use sent_by (ObjectId) for the comparison.
                  const isCollaboratorMessage = isSharedComment && msg.sender_name &&
                    msg.sent_by?.toString() !== user?._id?.toString();
                  const isCurrentlyStreaming =
                    isAssistant && isStreaming && msg === messages[messages.length - 1];

                  // Skip rendering empty bubbles (no text, no structured content, no attachments)
                  const hasContent = msg.content ||
                    msg.structured_content?.length > 0 ||
                    (isUser && msg.attachments?.length > 0) ||
                    isCurrentlyStreaming;
                  if (!hasContent) return null;

                  return (
                    <div
                      key={msg.msg_id || msg._id || msgIdx}
                      className={[
                        styles.message,
                        isSharedComment ? styles.messageSharedComment : (isUser ? styles.messageUser : styles.messageAssistant),
                        msg.error ? styles.messageError : '',
                        msg.isContextAck ? styles.messageContextAck : '',
                        msg.isActionResult ? styles.messageActionResult : '',
                        isCurrentlyStreaming ? styles.streaming : ''
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {isSharedComment && msg.sender_name && (
                        <span className={styles.messageSenderName}>{msg.sender_name}</span>
                      )}
                      {msg.reply_to_preview && (
                        <span className={styles.replyPreviewInMessage}>{msg.reply_to_preview}</span>
                      )}
                      {isUser && msg.attachments?.length > 0 && (
                        <div className={styles.messageAttachments}>
                          {msg.attachments.map((att, i) => {
                            const isImage = att.mimeType?.startsWith('image/');
                            if (isImage && att.s3Key) {
                              return (
                                <ImageAttachment
                                  key={i}
                                  attachment={att}
                                  sessionId={currentSession?._id}
                                  messageIndex={messages.indexOf(msg)}
                                  attachmentIndex={i}
                                />
                              );
                            }
                            return (
                              <span key={i} className={styles.attachmentBadge}>
                                <AttachIcon />
                                <span className={styles.attachmentFilename}>{att.filename}</span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                      {renderMessageContent(msg.content, navigate, styles, msg.role)}
                      {msg.structured_content?.length > 0 && (
                        <div className={styles.structuredContent}>
                          {msg.structured_content.map((block, blockIdx) => {
                            if (block.type === 'suggestion_list') {
                              return (
                                <SuggestionList
                                  key={blockIdx}
                                  data={block.data}
                                  onAddSelected={handleAddSuggestedItems}
                                  disabled={isLoading || isStreaming}
                                />
                              );
                            }
                            if (block.type === 'photo_gallery') {
                              return (
                                <BienBotPhotoGallery
                                  key={blockIdx}
                                  data={block.data}
                                  onAddPhotos={handleAddPhotos}
                                  disabled={isLoading || isStreaming}
                                />
                              );
                            }
                            if (block.type === 'tip_suggestion_list') {
                              return (
                                <TipSuggestionList
                                  key={blockIdx}
                                  data={block.data}
                                  onAddSelected={handleAddTips}
                                  disabled={isLoading || isStreaming}
                                />
                              );
                            }
                            if (block.type === 'discovery_result_list') {
                              return (
                                <DiscoveryResultCard
                                  key={blockIdx}
                                  data={block.data}
                                  onView={handleViewDiscoveryResult}
                                  onPlan={handlePlanDiscoveryResult}
                                  onEmpty={handleDiscoveryEmpty}
                                  disabled={isLoading || isStreaming}
                                />
                              );
                            }
                            if (block.type === 'entity_ref_list') {
                              return (
                                <EntityRefList
                                  key={blockIdx}
                                  refs={block.data?.refs || []}
                                  onSelect={handleEntityRefSelect}
                                />
                              );
                            }
                            return null;
                          })}
                        </div>
                      )}
                      {isCollaboratorMessage && msg.msg_id && (
                        <div className={styles.collaboratorReplyRow}>
                          <button
                            type="button"
                            className={styles.collaboratorReplyButton}
                            onClick={() => handleReplyToCollaborator(msg)}
                            aria-label={`Reply to ${msg.sender_name}`}
                          >
                            ↩ Reply
                          </button>
                        </div>
                      )}
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
            {pendingActions.length > 0 && (() => {
              // Separate regular actions from workflow steps and plan/destination pickers
              const regularActions = [];
              const planPickerActions = [];
              const destinationPickerActions = [];
              const workflowGroups = new Map();

              for (const action of pendingActions) {
                if (action.workflow_id) {
                  const group = workflowGroups.get(action.workflow_id) || [];
                  group.push(action);
                  workflowGroups.set(action.workflow_id, group);
                } else if (action.type === 'select_plan') {
                  planPickerActions.push(action);
                } else if (action.type === 'select_destination') {
                  destinationPickerActions.push(action);
                } else {
                  regularActions.push(action);
                }
              }

              return (
                <div className={styles.actionsContainer}>
                  {/* Destination picker (select_destination disambiguation) */}
                  {destinationPickerActions.length > 0 && (
                    <PlanSelector
                      actions={destinationPickerActions}
                      onExecute={handleExecuteAction}
                      onCancel={handleCancelAction}
                      disabled={isLoading || isStreaming}
                    />
                  )}

                  {/* Plan picker (select_plan disambiguation) */}
                  {planPickerActions.length > 0 && (
                    <PlanSelector
                      actions={planPickerActions}
                      onExecute={handleExecuteAction}
                      onCancel={handleCancelAction}
                      disabled={isLoading || isStreaming}
                    />
                  )}

                  {/* Workflow step cards */}
                  {[...workflowGroups.entries()].map(([wfId, steps]) => (
                    <WorkflowStepCard
                      key={wfId}
                      workflowId={wfId}
                      steps={steps}
                      onApprove={handleApproveStep}
                      onSkip={handleSkipStep}
                      onEdit={handleEditStep}
                      onCancelWorkflow={handleCancelWorkflow}
                      disabled={isLoading || isStreaming}
                    />
                  ))}

                  {/* Regular (non-workflow) action cards */}
                  {regularActions.map((action) => (
                    <PendingActionCard
                      key={action._id || action.id}
                      action={action}
                      onExecute={handleExecuteAction}
                      onUpdate={handleUpdateAction}
                      onCancel={handleCancelAction}
                      disabled={isLoading || isStreaming}
                      executing={executingActionId}
                    />
                  ))}
                </div>
              );
            })()}

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
            {attachment && (
              <div className={styles.attachmentPreview}>
                {attachmentPreviewUrl && (
                  <img
                    src={attachmentPreviewUrl}
                    alt={attachment.name}
                    className={styles.attachmentPreviewThumb}
                  />
                )}
                <span className={styles.attachmentPreviewName}>
                  {!attachmentPreviewUrl && <AttachIcon />}
                  {attachment.name}
                </span>
                <button
                  type="button"
                  className={styles.attachmentRemove}
                  onClick={handleRemoveAttachment}
                  aria-label="Remove attachment"
                >
                  <CloseIcon />
                </button>
              </div>
            )}
            {replyTo && (
              <div className={styles.replyStrip}>
                <span className={styles.replyStripContent}>
                  Replying to <strong>{replyTo.senderName}</strong>: {replyTo.preview}
                </span>
                <button
                  type="button"
                  className={styles.replyStripClose}
                  onClick={() => setReplyTo(null)}
                  aria-label="Cancel reply"
                >
                  <CloseIcon />
                </button>
              </div>
            )}
            <div className={styles.inputArea}>
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_ATTACH_TYPES}
                className={styles.hiddenFileInput}
                onChange={handleFileChange}
                aria-hidden="true"
                tabIndex={-1}
              />
              <button
                type="button"
                className={styles.attachButton}
                onClick={handleAttachClick}
                disabled={isStreaming || !!attachment}
                aria-label="Attach a file"
                title="Attach image or document"
              >
                <AttachIcon />
              </button>
              <textarea
                ref={inputRef}
                className={styles.textInput}
                placeholder={placeholderText}
                rows={1}
                disabled={isStreaming}
                onInput={resizeTextarea}
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

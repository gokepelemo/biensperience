import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { StreamChat } from 'stream-chat';
import {
  Chat,
  Channel,
  ChannelHeader,
  MessageInput,
  MessageList,
  Thread,
  Window
} from 'stream-chat-react';
import 'stream-chat-react/dist/css/v2/index.css';
import { FaChevronDown, FaTimes } from 'react-icons/fa';

import Alert from '../Alert/Alert';
import styles from './MessagesModal.module.scss';

import { getChatToken, getOrCreateDmChannel } from '../../utilities/chat-api';
import { logger } from '../../utilities/logger';

function getDisplayNameForChannel({ channel, currentUserId }) {
  if (!channel) return 'Message';

  const name = channel?.data?.name;
  if (name && typeof name === 'string' && name.trim()) return name;

  // Heuristic for DMs using deterministic IDs: dm_<id1>_<id2>
  const channelId = channel?.id || channel?.cid;
  if (typeof channelId === 'string' && channelId.startsWith('dm_')) {
    // Prefer member user names if available
    try {
      const members = channel?.state?.members || {};
      const other = Object.values(members)
        .map(m => m?.user)
        .filter(u => u && u.id && u.id !== currentUserId)
        .find(Boolean);

      if (other?.name) return `Message ${other.name}`;
    } catch (e) {
      // ignore
    }
    return 'Direct message';
  }

  return 'Message';
}

/**
 * MessagesModal - Custom modal for Stream Chat
 */
export default function MessagesModal({
  show,
  onClose,
  initialChannelId,
  targetUserId = null,
  title = 'Messages'
}) {
  const apiKey = import.meta.env.VITE_STREAM_CHAT_API_KEY;
  const clientRef = useRef(null);
  // Track if we're in the process of closing to prevent re-initialization
  const isClosingRef = useRef(false);

  const [uiTheme, setUiTheme] = useState(() => {
    try {
      const root = document?.documentElement;
      const theme =
        root?.getAttribute('data-theme') || root?.getAttribute('data-bs-theme');
      return theme === 'dark' ? 'dark' : 'light';
    } catch (e) {
      return 'light';
    }
  });

  const [client, setClient] = useState(null);
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  const [loading, setLoading] = useState(false);
  const [channelSwitching, setChannelSwitching] = useState(false);
  const [error, setError] = useState('');
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false);

  // Handle close - notify parent FIRST, then cleanup
  const handleClose = useCallback(() => {
    // Prevent re-initialization during close
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    logger.debug('[MessagesModal] Close requested');

    // CRITICAL: Call onClose FIRST to update parent's show state
    // This ensures the modal unmounts before we reset internal state
    if (onClose) {
      onClose();
    }

    // Disconnect Stream Chat client (async, fire and forget)
    if (clientRef.current) {
      clientRef.current.disconnectUser().catch(() => {
        // ignore disconnect errors
      });
      clientRef.current = null;
    }

    // Reset internal state after parent is notified
    setClient(null);
    setChannels([]);
    setActiveChannel(null);
    setCurrentUser(null);
    setError('');
    setLoading(false);
    setMobileDropdownOpen(false);
  }, [onClose]);

  // ESC key handler - attached directly to document, outside React's event system
  useEffect(() => {
    if (!show) return;

    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
      }
    };

    // Use capture phase to intercept before Stream Chat
    document.addEventListener('keydown', handleEsc, true);
    return () => document.removeEventListener('keydown', handleEsc, true);
  }, [show, handleClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (show) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [show]);

  const canInit = useMemo(() => {
    return Boolean(show && apiKey);
  }, [show, apiKey]);

  // Theme observer
  useEffect(() => {
    try {
      const root = document?.documentElement;
      if (!root) return undefined;

      const observer = new MutationObserver(() => {
        try {
          const theme =
            root.getAttribute('data-theme') || root.getAttribute('data-bs-theme');
          setUiTheme(theme === 'dark' ? 'dark' : 'light');
        } catch (e) {
          // ignore
        }
      });

      observer.observe(root, {
        attributes: true,
        attributeFilter: ['data-theme', 'data-bs-theme']
      });

      return () => observer.disconnect();
    } catch (e) {
      return undefined;
    }
  }, []);

  // Reset closing flag when modal opens
  useEffect(() => {
    if (show) {
      isClosingRef.current = false;
    }
  }, [show]);

  // Initialize Stream Chat when modal opens
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Don't initialize if closing or not ready
      if (!canInit || isClosingRef.current) return;

      setLoading(true);
      setError('');

      try {
        const { token, user } = await getChatToken();

        const streamClient = new StreamChat(apiKey);
        await streamClient.connectUser(
          {
            id: user.id,
            name: user.name
          },
          token
        );

        if (cancelled) {
          try {
            await streamClient.disconnectUser();
          } catch (disconnectErr) {
            // ignore
          }
          return;
        }

        // Store in ref for cleanup access
        clientRef.current = streamClient;
        setClient(streamClient);
        setCurrentUser(user);

        // Query all channels for this user (DMs + group chats)
        const filters = {
          type: 'messaging',
          members: { $in: [user.id] }
        };
        const sort = { last_message_at: -1 };

        const result = await streamClient.queryChannels(filters, sort, {
          state: true,
          watch: false,
          presence: false,
          limit: 50
        });

        if (cancelled) return;

        // IMPORTANT UX: plan item group chats should ONLY appear inside the
        // PlanItemDetails modal Chat tab, not in the global Messages modal.
        const filtered = (result || []).filter((ch) => {
          if (ch?.data?.planItemId) return false;
          if (typeof ch?.id === 'string' && ch.id.startsWith('planItem_')) return false;
          return true;
        });

        setChannels(filtered);


        // Prefer a channel based on target user (continue existing 1:1),
        // otherwise prefer initial channel if provided, otherwise most recent.
        let nextActive = null;

        if (targetUserId) {
          // Look for an existing DM channel among queried channels that matches both members
          const existingDm = filtered.find((ch) => {
            try {
              const members = ch?.state?.members || {};
              const memberIds = Object.values(members).map(m => m?.user?.id).filter(Boolean);
              // Must include both the target and the current user
              return memberIds.includes(targetUserId) && memberIds.includes(user.id) && memberIds.length === 2;
            } catch (e) {
              return false;
            }
          });

          if (existingDm) {
            nextActive = existingDm;
            await nextActive.watch();
          } else if (initialChannelId) {
            const existing = filtered.find(ch => ch?.id === initialChannelId);
            nextActive = existing || streamClient.channel('messaging', initialChannelId);
            await nextActive.watch();
          } else {
            // No existing DM found locally; ask server to return or create the DM channel
            try {
              const resp = await getOrCreateDmChannel(targetUserId);
              const channelId = resp?.id || resp?.cid || resp?._id || resp;
              if (channelId) {
                nextActive = streamClient.channel('messaging', channelId);
                await nextActive.watch();
              }
            } catch (e) {
              // fall through to fallback below
            }
          }
        } else if (initialChannelId) {
          const existing = filtered.find(ch => ch?.id === initialChannelId);
          nextActive = existing || streamClient.channel('messaging', initialChannelId);
          await nextActive.watch();
        } else if (filtered.length > 0) {
          nextActive = filtered[0];
          await nextActive.watch();
        }

        if (cancelled) return;
        setActiveChannel(nextActive);
      } catch (err) {
        logger.error('[MessagesModal] Failed to initialize chat', err);
        if (!cancelled) {
          setError(err?.message || 'Failed to initialize chat');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [canInit, apiKey, initialChannelId]);

  // Cleanup when modal closes
  useEffect(() => {
    if (!show && clientRef.current) {
      clientRef.current.disconnectUser().catch(() => {
        // ignore
      });
      clientRef.current = null;
    }
  }, [show]);

  const handleSelectChannel = useCallback(async (channel) => {
    if (!client || !channel) return;
    // Don't reload if already on this channel
    if (activeChannel?.id === channel?.id) {
      setMobileDropdownOpen(false);
      return;
    }

    try {
      setChannelSwitching(true);
      await channel.watch();
      setActiveChannel(channel);
      setMobileDropdownOpen(false);
    } catch (err) {
      logger.error('[MessagesModal] Failed to select channel', err);
      setError(err?.message || 'Failed to open channel');
    } finally {
      setChannelSwitching(false);
    }
  }, [client, activeChannel?.id]);

  // Don't render anything if not shown
  if (!show) return null;

  // Main modal content
  const modalContent = createPortal(
    <div
      className={styles.modalBackdrop}
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="messages-modal-title"
    >
      <div className={styles.modalDialog}>
        <div className={styles.modalContent}>
          {/* Header */}
          <div className={styles.modalHeader}>
            <h5 id="messages-modal-title" className={styles.modalTitle}>{title}</h5>
            <button
              type="button"
              className={styles.closeButton}
              onClick={handleClose}
              aria-label="Close messages"
            >
              <FaTimes />
            </button>
          </div>

          {/* Body */}
          <div className={styles.modalBody}>
            {!apiKey && (
              <Alert
                type="danger"
                message="Chat is not configured (missing VITE_STREAM_CHAT_API_KEY)."
              />
            )}

            {error && <Alert type="danger" message={error} />}

            {loading && <div className={styles.loadingState}>Loading messages…</div>}

            {!loading && client && (
              <div className={styles.messagesContainer}>
                <Chat
                  client={client}
                  theme={uiTheme === 'dark' ? 'str-chat__theme-dark' : 'str-chat__theme-light'}
                >
                  {/* Mobile channel selector dropdown */}
                  {channels.length > 0 && (
                    <div className={styles.mobileChannelSelector}>
                      <button
                        type="button"
                        className={styles.mobileDropdownToggle}
                        onClick={() => setMobileDropdownOpen(prev => !prev)}
                        aria-expanded={mobileDropdownOpen}
                        aria-haspopup="listbox"
                      >
                        <span className={styles.mobileDropdownLabel}>
                          {activeChannel
                            ? getDisplayNameForChannel({ channel: activeChannel, currentUserId: currentUser?.id })
                            : 'Select conversation'}
                        </span>
                        <FaChevronDown className={`${styles.mobileDropdownIcon} ${mobileDropdownOpen ? styles.open : ''}`} />
                      </button>
                      {mobileDropdownOpen && (
                        <ul className={styles.mobileDropdownList} role="listbox">
                          {channels.map((ch) => {
                            const label = getDisplayNameForChannel({
                              channel: ch,
                              currentUserId: currentUser?.id
                            });
                            const isActive = activeChannel?.id && ch?.id === activeChannel.id;
                            const unreadCount = ch?.state?.unreadCount || 0;

                            return (
                              <li key={ch.cid || ch.id} role="option" aria-selected={isActive}>
                                <button
                                  type="button"
                                  className={`${styles.mobileDropdownItem} ${isActive ? styles.active : ''} ${unreadCount > 0 ? styles.hasUnread : ''}`}
                                  onClick={() => handleSelectChannel(ch)}
                                >
                                  <span className={styles.mobileDropdownItemLabel}>{label}</span>
                                  {unreadCount > 0 && (
                                    <span className={styles.unreadBadge} aria-label={`${unreadCount} unread messages`}>
                                      {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                  )}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  )}

                  <div className={styles.layout}>
                    <aside className={styles.sidebar} aria-label="Channels">
                      {(channels || []).length === 0 ? (
                        <div className={styles.empty}>No messages yet.</div>
                      ) : (
                        <ul className={styles.channelList}>
                          {channels.map((ch) => {
                            const label = getDisplayNameForChannel({
                              channel: ch,
                              currentUserId: currentUser?.id
                            });
                            const isActive = activeChannel?.id && ch?.id === activeChannel.id;
                            // Get unread count for this channel
                            const unreadCount = ch?.state?.unreadCount || 0;

                            return (
                              <li key={ch.cid || ch.id}>
                                <button
                                  type="button"
                                  className={`${styles.channelButton} ${isActive ? styles.active : ''} ${unreadCount > 0 ? styles.hasUnread : ''}`}
                                  onClick={() => handleSelectChannel(ch)}
                                >
                                  <span className={styles.channelName}>{label}</span>
                                  {unreadCount > 0 && (
                                    <span className={styles.unreadBadge} aria-label={`${unreadCount} unread messages`}>
                                      {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                  )}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </aside>

                    <section className={`${styles.pane} ${channelSwitching ? styles.switching : ''}`} aria-label="Messages">
                      {activeChannel ? (
                        <Channel channel={activeChannel}>
                          <Window>
                            <ChannelHeader />
                            <MessageList />
                            <MessageInput focus />
                          </Window>
                          <Thread />
                        </Channel>
                      ) : (
                        <div className={styles.emptyPane}>Select a conversation.</div>
                      )}
                    </section>
                  </div>
                </Chat>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );

  return modalContent;
}

MessagesModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  initialChannelId: PropTypes.string,
  title: PropTypes.node
};

import { useEffect, useMemo, useState, useCallback, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
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
import { Link, useInRouterContext, useLocation, useParams } from 'react-router-dom';

import Alert from '../Alert/Alert';
import styles from './MessagesModal.module.scss';
import useStreamChat from '../../hooks/useStreamChat';
import ChannelTitle from './ChannelTitle';

import { cancelBienBotChannel, getChatToken, getOrCreateDmChannel } from '../../utilities/chat-api';
import { getPlanById } from '../../utilities/plans-api';
import { getFriendlyChatErrorMessage } from '../../utilities/chat-error-utils';
import { logger } from '../../utilities/logger';
import { broadcastEvent } from '../../utilities/event-bus';
import { useUIPreference } from '../../hooks/useUIPreference';
import { updateUser } from '../../utilities/users-api';
import { useUser } from '../../contexts/UserContext';

/**
 * Get display name for channel list/sidebar (shows just other user's name for DMs)
 */
function getListDisplayName({ channel, currentUserId }) {
  if (!channel) return 'Message';

  const channelId = channel?.id || channel?.cid;

  // For DM channels, show just the other user's name (not "User A & User B")
  if (typeof channelId === 'string' && channelId.startsWith('dm_')) {
    try {
      const members = channel?.state?.members || {};
      const other = Object.values(members)
        .map(m => m?.user)
        .filter(u => u && u.id && u.id !== currentUserId)
        .find(Boolean);

      if (other?.name) return other.name;
    } catch (e) {
      // ignore
    }
    return 'Direct message';
  }

  // For non-DM channels, use the channel name if available
  const name = channel?.data?.name;
  if (name && typeof name === 'string' && name.trim()) return name;

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
  const inRouterContext = useInRouterContext();
  const location = useLocation();
  const params = useParams();
  // Track if we're in the process of closing to prevent re-initialization
  const isClosingRef = useRef(false);

  const modalContentRef = useRef(null);
  const previouslyFocusedElRef = useRef(null);

  const { user } = useUser();

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

  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [planExperienceCache, setPlanExperienceCache] = useState({});

  // User preference for active channels in messages list
  // Default to null (show all channels) for backward compatibility
  const [activeChannelIds, setActiveChannelIds] = useUIPreference('messages.activeChannels', null);

  // Track if we've synced preferences to backend to avoid initial load sync
  const hasSyncedPreferencesRef = useRef(false);

  const [loading, setLoading] = useState(false);
  const [channelSwitching, setChannelSwitching] = useState(false);
  const [error, setError] = useState('');
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false);
  const mobileSelectorRef = useRef(null);
  const mobileDropdownToggleRef = useRef(null);
  const [mobileDropdownStyle, setMobileDropdownStyle] = useState(null);
  const mobileDropdownRef = useRef(null);

  const computeMobileDropdownStyle = useCallback(() => {
    try {
      const r = mobileDropdownToggleRef.current?.getBoundingClientRect?.();
      if (!r) return null;

      // Clamp within viewport and flip above when needed.
      const viewportW = window?.innerWidth || 0;
      const viewportH = window?.innerHeight || 0;
      const margin = 8;
      const gap = 4;
      const preferredMaxHeight = 240;

      const width = Math.max(180, r.width || 0);
      const maxLeft = Math.max(margin, viewportW - width - margin);
      const left = Math.min(Math.max(r.left, margin), maxLeft);
      const clampedWidth = Math.min(width, Math.max(0, viewportW - margin * 2));

      const spaceBelow = Math.max(0, viewportH - r.bottom - margin);
      const spaceAbove = Math.max(0, r.top - margin);

      const shouldPlaceBelow = spaceBelow >= Math.min(preferredMaxHeight, 160) || spaceBelow >= spaceAbove;
      const maxHeight = Math.min(preferredMaxHeight, shouldPlaceBelow ? spaceBelow : spaceAbove);

      const top = shouldPlaceBelow
        ? Math.min(r.bottom + gap, viewportH - margin)
        : Math.max(margin, r.top - gap - maxHeight);

      return {
        position: 'fixed',
        top,
        left,
        right: 'auto',
        width: clampedWidth,
        maxHeight,
        overflowY: 'auto',
        zIndex: 3000
      };
    } catch (e) {
      return null;
    }
  }, []);

  // When using a portal, compute the dropdown position after DOM layout.
  useLayoutEffect(() => {
    if (!mobileDropdownOpen) return undefined;

    let raf1 = 0;
    let raf2 = 0;

    const measure = () => {
      const nextStyle = computeMobileDropdownStyle();
      if (nextStyle) setMobileDropdownStyle(nextStyle);
    };

    // Measure now + again next frame to handle late layout changes.
    measure();
    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(measure);
    });

    return () => {
      if (raf1) window.cancelAnimationFrame(raf1);
      if (raf2) window.cancelAnimationFrame(raf2);
    };
  }, [mobileDropdownOpen, computeMobileDropdownStyle]);

  const canInit = useMemo(() => {
    return Boolean(show && apiKey);
  }, [show, apiKey]);

  const {
    client,
    currentUser,
    loading: clientLoading,
    error: clientError,
    disconnect: disconnectClient
  } = useStreamChat({
    connectWhen: canInit,
    disconnectWhen: !show,
    apiKey,
    context: 'MessagesModal'
  });

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
    if (disconnectClient) {
      disconnectClient().catch(() => {});
    }

    // Reset internal state after parent is notified
    setChannels([]);
    setActiveChannel(null);
    setError('');
    setLoading(false);
    setMobileDropdownOpen(false);
  }, [onClose, disconnectClient]);

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

  // Focus trap (Tab/Shift+Tab) + focus restore
  useEffect(() => {
    if (!show) return undefined;

    // Save the element that opened the modal so we can restore focus on close
    try {
      previouslyFocusedElRef.current = document.activeElement;
    } catch (e) {
      previouslyFocusedElRef.current = null;
    }

    const getFocusable = (rootEl) => {
      if (!rootEl) return [];

      const selector = [
        'a[href]',
        'area[href]',
        'button:not([disabled])',
        'input:not([disabled]):not([type="hidden"])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        'iframe',
        'object',
        'embed',
        '[contenteditable="true"]',
        '[tabindex]:not([tabindex="-1"])'
      ].join(',');

      const nodes = Array.from(rootEl.querySelectorAll(selector));

      // Keep only elements that are actually visible/focusable in the layout
      return nodes.filter((el) => {
        try {
          return el && el.getClientRects && el.getClientRects().length > 0;
        } catch (e) {
          return false;
        }
      });
    };

    const getTrapElements = () => {
      // Include the mobile dropdown list even when it portals to document.body.
      // This prevents the focus trap from making the dropdown unreachable.
      const modalEls = getFocusable(modalContentRef.current);
      const dropdownEls = mobileDropdownOpen ? getFocusable(mobileDropdownRef.current) : [];
      const all = [...modalEls, ...dropdownEls];

      // De-dupe while preserving order
      const seen = new Set();
      return all.filter((el) => {
        if (!el || seen.has(el)) return false;
        seen.add(el);
        return true;
      });
    };

    const focusFirstWithinTrap = () => {
      const focusables = getTrapElements();
      if (focusables.length > 0) {
        focusables[0].focus();
      } else if (modalContentRef.current) {
        modalContentRef.current.focus();
      }
    };

    // After first paint, if focus isn't already inside the modal, move it in.
    const focusTimer = window.setTimeout(() => {
      try {
        const active = document.activeElement;
        const modal = modalContentRef.current;
        const dropdown = mobileDropdownRef.current;
        const focusIsInside =
          (modal && active && modal.contains(active)) ||
          (dropdown && active && dropdown.contains(active));

        if (!focusIsInside) {
          focusFirstWithinTrap();
        }
      } catch (e) {
        // ignore
      }
    }, 0);

    const handleTabTrap = (e) => {
      if (e.key !== 'Tab') return;

      const focusables = getTrapElements();
      if (focusables.length === 0) {
        e.preventDefault();
        focusFirstWithinTrap();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const activeIsInside = focusables.includes(active);

      // If focus has escaped the modal somehow, bring it back.
      if (!activeIsInside) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }

      if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      }
    };

    // Capture phase so we trap before Stream Chat / other handlers
    document.addEventListener('keydown', handleTabTrap, true);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleTabTrap, true);

      // Restore focus to opener (if it still exists)
      try {
        const prev = previouslyFocusedElRef.current;
        if (prev && typeof prev.focus === 'function' && document.contains(prev)) {
          prev.focus();
        }
      } catch (e) {
        // ignore
      }
    };
  }, [show, mobileDropdownOpen]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (show) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [show]);

  // Close mobile dropdown when clicking outside or on resize
  useEffect(() => {
    if (!mobileDropdownOpen) return undefined;

    const onDocClick = (e) => {
      try {
        // If click happened inside the toggle or inside the dropdown (portal or inline), ignore
        if (mobileSelectorRef.current && mobileSelectorRef.current.contains(e.target)) return;
        if (mobileDropdownRef.current && mobileDropdownRef.current.contains(e.target)) return;

        setMobileDropdownOpen(false);
      } catch (err) {
        // ignore
      }
    };

    const onResize = () => setMobileDropdownOpen(false);

    document.addEventListener('click', onDocClick, true);
    window.addEventListener('resize', onResize);

    return () => {
      document.removeEventListener('click', onDocClick, true);
      window.removeEventListener('resize', onResize);
    };
  }, [mobileDropdownOpen]);

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

  // Query channels once the Stream client is connected
  useEffect(() => {
    let cancelled = false;

    async function loadChannels() {
      // Don't initialize if closing or not ready
      if (!show || !client || !currentUser || isClosingRef.current) return;

      setLoading(true);
      setError('');

      try {
        // Query all channels for this user (DMs + group chats)
        const filters = {
          type: 'messaging',
          members: { $in: [currentUser.id] }
        };
        const sort = { last_message_at: -1 };

        const result = await client.queryChannels(filters, sort, {
          state: true,
          watch: false,
          presence: false,
          limit: 50
        });

        if (cancelled) return;

        // IMPORTANT UX: plan item group chats should ONLY appear inside the
        // PlanItemDetails modal Chat tab, not in the global Messages modal.
        // Plan group chats are included in the global Messages modal.
        let filtered = (result || []).filter((ch) => {
          if (ch?.data?.planItemId) return false;
          if (typeof ch?.id === 'string' && ch.id.startsWith('planItem_')) return false;
          return true;
        });

        // Filter based on user's active channels preference
        // If activeChannelIds is null (default), show all channels
        // If it's an array, only show channels with IDs in the array
        if (activeChannelIds && Array.isArray(activeChannelIds)) {
          const activeChannelIdSet = new Set(activeChannelIds);
          const newChannelIds = filtered
            .map(ch => ch?.id || ch?.cid)
            .filter(channelId => channelId && !activeChannelIdSet.has(channelId));

          // Add any new channels to the active list
          if (newChannelIds.length > 0) {
            setActiveChannelIds(prev => [...(prev || []), ...newChannelIds]);
          }

          filtered = filtered.filter((ch) => {
            const channelId = ch?.id || ch?.cid;
            return activeChannelIdSet.has(channelId);
          });
        } else if (activeChannelIds === null && filtered.length > 0) {
          // Initialize preference with all current channels when first loading
          const allChannelIds = filtered.map(ch => ch?.id || ch?.cid);
          setActiveChannelIds(allChannelIds);
        }

        setChannels(filtered);

        // Prefer a channel based on target user (continue existing 1:1),
        // otherwise prefer initial channel if provided, otherwise most recent.
        let nextActive = null;

        if (targetUserId) {
          const targetUserIdStr = typeof targetUserId === 'string'
            ? targetUserId
            : targetUserId?.toString?.();

          if (!targetUserIdStr) {
            setError('Unable to start conversation (invalid target user).');
          }

          // Look for an existing DM channel among queried channels that matches both members
          // DM channels have deterministic IDs: dm_<minUserId>_<maxUserId>
          const existingDm = filtered.find((ch) => {
            try {
              const members = ch?.state?.members || {};
              const memberIds = Object.values(members).map(m => m?.user?.id).filter(Boolean);
              // Must be a DM channel (starts with 'dm_'), include both users, and have exactly 2 members
              return ch?.id?.startsWith('dm_') &&
                memberIds.includes(targetUserIdStr) &&
                memberIds.includes(currentUser.id) &&
                memberIds.length === 2;
            } catch (e) {
              return false;
            }
          });

          if (existingDm) {
            nextActive = existingDm;
            await nextActive.watch();
          } else if (initialChannelId) {
            const existing = filtered.find(ch => ch?.id === initialChannelId);
            nextActive = existing || client.channel('messaging', initialChannelId);
            await nextActive.watch();
          } else {
            // No existing DM found locally; ask server to return or create the DM channel
            try {
              if (!targetUserIdStr) {
                throw new Error('Invalid target user');
              }

              const resp = await getOrCreateDmChannel(targetUserIdStr);
              const channelId = resp?.id || resp?.cid || resp?._id || resp;
              if (channelId) {
                nextActive = client.channel('messaging', channelId);
                await nextActive.watch();
                // Add the newly created DM channel to the channels list so it appears immediately
                setChannels(prevChannels => [nextActive, ...prevChannels]);

                // Emit event for new channel created
                try {
                  broadcastEvent('channel:created', {
                    channel: { id: channelId, type: 'dm', targetUserId },
                    channelId
                  });
                  logger.debug('[MessagesModal] Channel created event dispatched', { channelId });
                } catch (eventErr) {
                  // Silently ignore event emission errors
                }
              }
            } catch (err) {
              logger.error('[MessagesModal] Failed to open DM channel', err);
              if (!cancelled) {
                setError(getFriendlyChatErrorMessage(err, { defaultMessage: 'Failed to start conversation' }));
              }

              // Fallback: if we have any channels, at least open the most recent.
              if (!nextActive && filtered.length > 0) {
                try {
                  nextActive = filtered[0];
                  await nextActive.watch();
                } catch (watchErr) {
                  logger.error('[MessagesModal] Failed to fallback to most recent channel', watchErr);
                }
              }
            }
          }
        } else if (initialChannelId) {
          const existing = filtered.find(ch => ch?.id === initialChannelId);
          nextActive = existing || client.channel('messaging', initialChannelId);
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
          setError(getFriendlyChatErrorMessage(err, { defaultMessage: 'Failed to initialize chat' }));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadChannels();

    return () => {
      cancelled = true;
    };
  }, [show, client, currentUser?.id, initialChannelId, targetUserId, activeChannelIds]);

  // Defensive: avoid a visually blank modal if Stream client init ends in a weird state
  // (e.g. StrictMode double-invocation cancellation). If we have an API key, are not
  // loading, and still have no client/error after a short grace period, surface a
  // clear error so users (and us) know what's wrong.
  useEffect(() => {
    if (!show) return undefined;
    if (!apiKey) return undefined;
    if (isClosingRef.current) return undefined;
    if (client) return undefined;
    if (clientLoading || loading) return undefined;
    if (clientError || error) return undefined;

    const timeoutId = window.setTimeout(() => {
      if (isClosingRef.current) return;
      // Re-check at fire time via latest render closures. If we still have no client,
      // surface an actionable message.
      setError('Chat failed to initialize. Please close and reopen the modal.');
    }, 2000);

    return () => window.clearTimeout(timeoutId);
  }, [show, apiKey, client, clientLoading, loading, clientError, error]);

  const mergedError = clientError || error;
  const mergedLoading = clientLoading || loading;

  const handleSelectChannel = useCallback(async (channel) => {
    if (!client || !channel) return;
    // Don't reload if already on this channel
    if (activeChannel?.id === channel?.id) {
      return;
    }

    try {
      setChannelSwitching(true);
      await channel.watch();
      setActiveChannel(channel);
    } catch (err) {
      logger.error('[MessagesModal] Failed to select channel', err);
      setError(getFriendlyChatErrorMessage(err, { defaultMessage: 'Failed to open channel' }));
    } finally {
      setChannelSwitching(false);
    }
  }, [client, activeChannel?.id]);

  const handleRemoveChannel = useCallback(async (e, channel) => {
    e.preventDefault();
    e.stopPropagation();

    const channelId = channel?.id || channel?.cid;
    const isBienBot = typeof channelId === 'string' && channelId.startsWith('bienbot_');

    try {
      // BienBot cancellation must also delete the channel on Stream Chat.
      // Other channel removals remain local-only (existing UX).
      if (isBienBot) {
        try {
          await cancelBienBotChannel();
        } catch (err) {
          logger.error('[MessagesModal] Failed to cancel BienBot channel', err);
          // Continue with local removal to honor the user's intent.
        }
      }

      // Remove from local channels list so it disappears from the sidebar
      setChannels(prev => prev.filter(ch => (ch?.id || ch?.cid) !== channelId));

      // If the removed channel was active, switch to the first available channel
      if (activeChannel?.id === channel?.id) {
        const remaining = channels.filter(ch => (ch?.id || ch?.cid) !== channelId);
        const next = remaining.length > 0 ? remaining[0] : null;
        setActiveChannel(next);
      }

      // Update user preference to hide this channel from messages list
      // Optimistically update the preference (remove channel from active list)
      setActiveChannelIds(prev => {
        if (prev === null) {
          // If no preference set yet, create one excluding this channel
          const allChannelIds = channels.map(ch => ch?.id || ch?.cid).filter(id => id !== channelId);
          return allChannelIds;
        } else if (Array.isArray(prev)) {
          // Remove this channel from the active list
          return prev.filter(id => id !== channelId);
        }
        return prev;
      });

      // Emit event for channel removed
      try {
        broadcastEvent('channel:removed', {
          channelId,
          channelType: channelId?.startsWith('dm_') ? 'dm' : (isBienBot ? 'bienbot' : 'group')
        });
        logger.debug('[MessagesModal] Channel removed event dispatched', { channelId });
      } catch (eventErr) {
        // Silently ignore event emission errors
      }
    } catch (err) {
      logger.error('[MessagesModal] Failed to remove channel', err);
    }
  }, [activeChannel, channels, setActiveChannelIds]);

  // Sync activeChannelIds to backend when it changes (after initial load)
  useEffect(() => {
    if (!user?._id || !hasSyncedPreferencesRef.current) {
      // Skip initial load
      hasSyncedPreferencesRef.current = true;
      return;
    }

    // Debounce the API call to avoid excessive requests
    const timeoutId = setTimeout(async () => {
      try {
        await updateUser(user._id, {
          preferences: {
            messages: {
              activeChannels: activeChannelIds
            }
          }
        });
        logger.debug('[MessagesModal] Synced active channels to backend', { activeChannelIds });
      } catch (err) {
        logger.error('[MessagesModal] Failed to sync active channels to backend', err);
        // Don't show error to user - this is a background sync
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeoutId);
  }, [activeChannelIds, user?._id]);

  const renderMobileDropdownItems = useCallback(() => {
    return channels.map((ch) => {
      const label = getListDisplayName({
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
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSelectChannel(ch);
              setMobileDropdownOpen(false);
            }}
          >
            <ChannelTitle
              label={label}
              className={styles.mobileDropdownItemLabel}
            />
            {unreadCount > 0 && (
              <span className={styles.unreadBadge} aria-label={`${unreadCount} unread messages`}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </li>
      );
    });
  }, [activeChannel?.id, channels, currentUser?.id, handleSelectChannel]);

  const renderMobileDropdownList = useCallback((styleOverride) => {
    return (
      <ul
        ref={mobileDropdownRef}
        className={styles.mobileDropdownList}
        role="listbox"
        style={styleOverride}
      >
        {renderMobileDropdownItems()}
      </ul>
    );
  }, [renderMobileDropdownItems]);

  const headerTitle = useMemo(() => {
    if (!activeChannel) {
      return {
        prefix: 'Messages',
        label: null,
        linkTo: null,
      };
    }

    const label = getListDisplayName({
      channel: activeChannel,
      currentUserId: currentUser?.id
    });

    const safeLabel = (typeof label === 'string' && label.trim()) ? label.trim() : null;

    // Determine entity link target (DM -> profile, plan/plan-item -> experience deep link)
    let linkTo = null;
    try {
      const channelId = activeChannel?.id || activeChannel?.cid;
      const data = activeChannel?.data || {};

      if (typeof channelId === 'string' && channelId.startsWith('dm_')) {
        const members = activeChannel?.state?.members || {};
        const other = Object.values(members)
          .map(m => m?.user)
          .filter(u => u && u.id && u.id !== currentUser?.id)
          .find(Boolean);

        if (other?.id) {
          linkTo = `/profile/${other.id}`;
        }
      } else {
        // plan channel IDs: plan_{planId}
        // plan item channel IDs: planItem_{planId}_{planItemId}
        const planId = (data.planId && String(data.planId)) || (
          typeof channelId === 'string' && channelId.startsWith('plan_')
            ? channelId.substring('plan_'.length)
            : null
        );

        const planItemId = (data.planItemId && String(data.planItemId)) || (
          typeof channelId === 'string' && channelId.startsWith('planItem_')
            ? channelId.split('_')[2] || null
            : null
        );

        const experienceId = planId ? planExperienceCache?.[planId] : null;
        if (planId && experienceId) {
          linkTo = planItemId
            ? `/experiences/${experienceId}#plan-${planId}-item-${planItemId}`
            : `/experiences/${experienceId}#plan-${planId}`;
        }
      }
    } catch (e) {
      linkTo = null;
    }

    return {
      prefix: 'Messages',
      label: safeLabel,
      linkTo,
    };
  }, [activeChannel, currentUser?.id, planExperienceCache, title]);

  // Handle clicking on entity link in modal title
  const handleEntityLinkClick = useCallback((event) => {
    if (!headerTitle.linkTo) return;

    // Check if we're already on the same entity page
    const currentPath = location.pathname;
    const linkTo = headerTitle.linkTo;

    // For profile links: /profile/:profileId
    if (linkTo.startsWith('/profile/')) {
      const linkProfileId = linkTo.split('/profile/')[1];
      if (currentPath === `/profile/${params.profileId}` && linkProfileId === params.profileId) {
        event.preventDefault();
        onClose();
        return;
      }
    }

    // For experience links: /experiences/:experienceId
    if (linkTo.startsWith('/experiences/')) {
      const linkExperienceId = linkTo.split('/experiences/')[1].split('#')[0]; // Remove hash
      if (currentPath === `/experiences/${params.experienceId}` && linkExperienceId === params.experienceId) {
        event.preventDefault();
        onClose();
        return;
      }
    }

    // Allow normal navigation for different entities
  }, [headerTitle.linkTo, location.pathname, params.profileId, params.experienceId, onClose]);

  // If a plan/plan-item channel becomes active, fetch its experienceId once so we can build a deep link.
  useEffect(() => {
    if (!activeChannel) return undefined;

    const channelId = activeChannel?.id || activeChannel?.cid;
    const data = activeChannel?.data || {};

    const planId = (data.planId && String(data.planId)) || (
      typeof channelId === 'string' && (channelId.startsWith('plan_') || channelId.startsWith('planItem_'))
        ? channelId.split('_')[1] || null
        : null
    );

    if (!planId) return undefined;
    if (planExperienceCache?.[planId]) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const plan = await getPlanById(planId);
        const expRaw = plan?.experience?._id || plan?.experience;
        const experienceId = expRaw && expRaw.toString ? expRaw.toString() : expRaw;

        if (!cancelled && experienceId) {
          setPlanExperienceCache(prev => ({
            ...(prev || {}),
            [planId]: experienceId,
          }));
        }
      } catch (err) {
        // Not fatal; just means we can't link this channel.
        logger.debug('[MessagesModal] Failed to resolve plan experience for header link', {
          planId,
          channelId: typeof channelId === 'string' ? channelId : null,
        }, err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeChannel, planExperienceCache, setPlanExperienceCache]);

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
      <div className={styles.modalDialog} ref={modalContentRef} tabIndex={-1}>
        <div className={styles.modalContent}>
          {/* Header */}
          <div className={styles.modalHeader}>
            <h5 id="messages-modal-title" className={styles.modalTitle}>
              {headerTitle.prefix}
              {headerTitle.label ? (
                <>
                  {' — '}
                  {headerTitle.linkTo ? (
                    inRouterContext ? (
                      <Link to={headerTitle.linkTo} className={styles.modalTitleLink} onClick={handleEntityLinkClick}>
                        <ChannelTitle
                          label={headerTitle.label}
                          className={styles.modalTitleChannel}
                          innerClassName={styles.channelTitleInner}
                        />
                      </Link>
                    ) : (
                      <a href={headerTitle.linkTo} className={styles.modalTitleLink} onClick={handleEntityLinkClick}>
                        <ChannelTitle
                          label={headerTitle.label}
                          className={styles.modalTitleChannel}
                          innerClassName={styles.channelTitleInner}
                        />
                      </a>
                    )
                  ) : (
                    <span className={styles.modalTitleChannelText}>{headerTitle.label}</span>
                  )}
                </>
              ) : null}
            </h5>
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

            {mergedError && <Alert type="danger" message={mergedError} />}

            {mergedLoading && <div className={styles.loadingState}>Loading messages…</div>}

            {!mergedLoading && client && (
              <div className={styles.messagesContainer}>
                {/* Mobile channel selector - rendered OUTSIDE Chat component to avoid Stream re-render issues */}
                {channels.length > 0 && (
                  <div className={styles.mobileChannelSelector} ref={mobileSelectorRef}>
                    <button
                      type="button"
                      className={styles.mobileDropdownToggle}
                      ref={mobileDropdownToggleRef}
                      onClick={(e) => {
                        try {
                          e.preventDefault();
                          e.stopPropagation();

                          const next = !mobileDropdownOpen;
                          setMobileDropdownOpen(next);
                          if (!next) {
                            setMobileDropdownStyle(null);
                            return;
                          }

                          // Best-effort immediate measurement so the portal doesn't render invisible
                          // while waiting for the layout-effect pass.
                          const nextStyle = computeMobileDropdownStyle();
                          if (nextStyle) setMobileDropdownStyle(nextStyle);
                        } catch (e) {
                          // ignore
                        }
                      }}
                      aria-expanded={mobileDropdownOpen}
                      aria-haspopup="listbox"
                    >
                      <span className={styles.mobileDropdownLabel}>
                        {activeChannel
                          ? getListDisplayName({ channel: activeChannel, currentUserId: currentUser?.id })
                          : 'Select conversation'}
                      </span>
                      <FaChevronDown className={`${styles.mobileDropdownIcon} ${mobileDropdownOpen ? styles.open : ''}`} />
                    </button>
                    {mobileDropdownOpen && (
                      (typeof document !== 'undefined')
                        ? createPortal(
                            renderMobileDropdownList(
                              mobileDropdownStyle ||
                                computeMobileDropdownStyle() || {
                                  position: 'fixed',
                                  top: 8,
                                  left: 8,
                                  right: 'auto',
                                  width: 'calc(100vw - 16px)',
                                  maxHeight: 240,
                                  overflowY: 'auto',
                                  zIndex: 3000
                                }
                            ),
                            document.body
                          )
                        : null
                    )}
                  </div>
                )}

                <Chat
                  client={client}
                  theme={uiTheme === 'dark' ? 'str-chat__theme-dark' : 'str-chat__theme-light'}
                >
                  <div className={styles.layout}>
                    <aside className={styles.sidebar} aria-label="Channels">
                      {(channels || []).length === 0 ? (
                        <div className={styles.empty}>No messages yet.</div>
                      ) : (
                        <ul className={styles.channelList}>
                          {channels.map((ch) => {
                            const label = getListDisplayName({
                              channel: ch,
                              currentUserId: currentUser?.id
                            });
                            const isActive = activeChannel?.id && ch?.id === activeChannel.id;
                            // Get unread count for this channel
                            const unreadCount = ch?.state?.unreadCount || 0;

                            return (
                              <li key={ch.cid || ch.id} className={styles.channelListItem}>
                                <div
                                  role="button"
                                  tabIndex={0}
                                  className={`${styles.channelButton} ${isActive ? styles.active : ''} ${unreadCount > 0 ? styles.hasUnread : ''}`}
                                  onClick={() => handleSelectChannel(ch)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      handleSelectChannel(ch);
                                    }
                                  }}
                                >
                                  <ChannelTitle
                                    label={label}
                                    className={styles.channelName}
                                    innerClassName={styles.channelTitleInner}
                                  />
                                  {unreadCount > 0 && (
                                    <span className={styles.unreadBadge} aria-label={`${unreadCount} unread messages`}>
                                      {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                  )}

                                  <button
                                    type="button"
                                    className={styles.deleteChannelButton}
                                    onClick={(e) => handleRemoveChannel(e, ch)}
                                    aria-label="Remove conversation"
                                  >
                                    <FaTimes />
                                  </button>
                                </div>
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
  targetUserId: PropTypes.string,
  title: PropTypes.node
};

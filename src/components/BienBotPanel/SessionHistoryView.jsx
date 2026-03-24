/**
 * SessionHistoryView — In-panel list of past BienBot sessions.
 *
 * Groups sessions by date (Today, Yesterday, This Week, This Month, Older)
 * and shows title, context badge, timestamp, and summary snippet.
 *
 * @module components/BienBotPanel/SessionHistoryView
 */

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Text } from '../design-system';
import { Tag } from '@chakra-ui/react';
import styles from './BienBotPanel.module.css';

// ─── Date grouping helpers ──────────────────────────────────────────────────

function getDateGroup(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(today);
  monthAgo.setMonth(monthAgo.getMonth() - 1);

  if (date >= today) return 'Today';
  if (date >= yesterday) return 'Yesterday';
  if (date >= weekAgo) return 'This Week';
  if (date >= monthAgo) return 'This Month';
  return 'Older';
}

function formatRelativeTime(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getSessionSnippet(session) {
  if (session.summary?.text) {
    return session.summary.text.slice(0, 80) + (session.summary.text.length > 80 ? '...' : '');
  }
  const firstUserMsg = session.messages?.find(m => m.role === 'user');
  if (firstUserMsg?.content) {
    return firstUserMsg.content.slice(0, 80) + (firstUserMsg.content.length > 80 ? '...' : '');
  }
  return 'No messages';
}

// ─── SessionHistoryView ─────────────────────────────────────────────────────

export default function SessionHistoryView({ sessions, currentSessionId, onSelectSession, onBack }) {
  const grouped = useMemo(() => {
    const groups = new Map();
    const order = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older'];

    for (const session of sessions) {
      const group = getDateGroup(session.updatedAt || session.createdAt);
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(session);
    }

    // Return in display order, skip empty groups
    return order.filter(g => groups.has(g)).map(g => ({ label: g, sessions: groups.get(g) }));
  }, [sessions]);

  return (
    <div className={styles.historyView}>
      {/* Header */}
      <div className={styles.historyHeader}>
        <button
          type="button"
          className={styles.historyBackButton}
          onClick={onBack}
          aria-label="Back to chat"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <Text size="md" fontWeight="semibold">Chat History</Text>
      </div>

      {/* Session list */}
      <div className={styles.historyList}>
        {grouped.length === 0 ? (
          <div className={styles.emptyState}>
            <Text size="sm">No past conversations yet.</Text>
          </div>
        ) : (
          grouped.map(({ label, sessions: groupSessions }) => (
            <div key={label} className={styles.historyGroup}>
              <div className={styles.historyGroupLabel}>
                <Text size="xs" fontWeight="semibold">{label}</Text>
              </div>
              {groupSessions.map((session) => {
                const isCurrent = session._id === currentSessionId;
                return (
                  <button
                    key={session._id}
                    type="button"
                    className={`${styles.historyItem} ${isCurrent ? styles.historyItemCurrent : ''}`}
                    onClick={() => !isCurrent && onSelectSession(session._id)}
                    disabled={isCurrent}
                  >
                    <div className={styles.historyItemTop}>
                      <span className={styles.historyItemTitle}>
                        {session.title || 'Untitled'}
                      </span>
                      <span className={styles.historyItemTime}>
                        {formatRelativeTime(session.updatedAt || session.createdAt)}
                      </span>
                    </div>
                    <div className={styles.historyItemBottom}>
                      {session.invoke_context?.entity_label && (
                        <Tag.Root size="sm" variant="subtle" colorPalette="purple" className={styles.historyContextBadge}>
                          <Tag.Label>{session.invoke_context.entity_label}</Tag.Label>
                        </Tag.Root>
                      )}
                      {isCurrent && (
                        <Tag.Root size="sm" variant="outline" colorPalette="green">
                          <Tag.Label>Current</Tag.Label>
                        </Tag.Root>
                      )}
                    </div>
                    <Text size="xs" className={styles.historyItemSnippet}>
                      {getSessionSnippet(session)}
                    </Text>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

SessionHistoryView.propTypes = {
  sessions: PropTypes.arrayOf(PropTypes.shape({
    _id: PropTypes.string.isRequired,
    title: PropTypes.string,
    updatedAt: PropTypes.string,
    createdAt: PropTypes.string,
    invoke_context: PropTypes.shape({
      entity_label: PropTypes.string
    }),
    summary: PropTypes.shape({
      text: PropTypes.string
    }),
    messages: PropTypes.array
  })).isRequired,
  currentSessionId: PropTypes.string,
  onSelectSession: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired
};

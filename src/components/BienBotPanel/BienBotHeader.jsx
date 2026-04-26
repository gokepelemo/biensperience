import React from 'react';
import PropTypes from 'prop-types';
import { FaBell } from 'react-icons/fa';
import { Heading, Text } from '../design-system';
import { CloseIcon, BienBotIcon, NewChatIcon, HistoryIcon, ShareIcon } from './icons';
import SessionSharePopover from './SessionSharePopover';
import styles from './BienBotPanel.module.css';

function BienBotHeader({
  notificationOnly,
  invokeContext,
  currentSession,
  hasSharedSessions,
  isSessionOwner,
  shareOpen,
  setShareOpen,
  shareSession,
  unshareSession,
  searchMutualFollowers,
  fetchSessions,
  setViewMode,
  viewMode,
  messagesCount,
  handleNewChat,
  isLoading,
  isStreaming,
  clearSession,
  onClose,
}) {
  return (
    <div className={styles.header}>
      {!notificationOnly && (isLoading || isStreaming) ? (
        <button
          type="button"
          className={styles.botIconReload}
          onClick={clearSession}
          aria-label="BienBot is loading — click to reload"
          title="Stuck? Click to reload BienBot"
        >
          <BienBotIcon />
        </button>
      ) : (
        <span className={styles.botIcon} aria-hidden="true">
          {notificationOnly ? <FaBell size={22} /> : <BienBotIcon />}
        </span>
      )}

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

      {!notificationOnly && messagesCount > 0 && (
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
  );
}

BienBotHeader.propTypes = {
  notificationOnly: PropTypes.bool,
  invokeContext: PropTypes.shape({
    entity: PropTypes.string,
    id: PropTypes.string,
    label: PropTypes.string,
  }),
  currentSession: PropTypes.object,
  hasSharedSessions: PropTypes.bool,
  isSessionOwner: PropTypes.bool,
  shareOpen: PropTypes.bool.isRequired,
  setShareOpen: PropTypes.func.isRequired,
  shareSession: PropTypes.func.isRequired,
  unshareSession: PropTypes.func.isRequired,
  searchMutualFollowers: PropTypes.func.isRequired,
  fetchSessions: PropTypes.func.isRequired,
  setViewMode: PropTypes.func.isRequired,
  viewMode: PropTypes.string.isRequired,
  messagesCount: PropTypes.number.isRequired,
  handleNewChat: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
  isStreaming: PropTypes.bool,
  clearSession: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default BienBotHeader;

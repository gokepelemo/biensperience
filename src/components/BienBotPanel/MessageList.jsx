/**
 * MessageList — Renders the scrollable chat message area.
 *
 * Extracted from BienBotPanel to isolate the largest rendering block:
 * resume prompt, empty state, messages.map, structured_content dispatch,
 * loading dots, and scroll anchor.
 *
 * @module components/BienBotPanel/MessageList
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Button, Text } from '../design-system';
import MessageContent from './MessageContent';
import ImageAttachment from './ImageAttachment';
import SuggestionList from './SuggestionList';
import BienBotPhotoGallery from './BienBotPhotoGallery';
import TipSuggestionList from './TipSuggestionList';
import DiscoveryResultCard from './DiscoveryResultCard';
import EntityRefList from './EntityRefList';
import ToolCallPill from './ToolCallPill';
import { AttachIcon } from './icons';
import styles from './BienBotPanel.module.css';

function MessageList({
  messages,
  isLoading,
  isStreaming,
  currentSession,
  emptyStateText,
  savedSession,
  onResume,
  onDismissResume,
  onAddSuggestedItems,
  onAddPhotos,
  onAddTips,
  onViewDiscoveryResult,
  onPlanDiscoveryResult,
  onDiscoveryEmpty,
  onEntityRefSelect,
  onReplyToCollaborator,
  currentPlanItemTexts,
  currentUserId,
  messagesContainerRef,
  messagesEndRef,
}) {
  return (
    <div
      ref={messagesContainerRef}
      className={styles.messages}
      aria-live="off"
      aria-atomic="false"
    >
      {savedSession && !currentSession && messages.length === 0 && !isLoading ? (
        <div className={styles.resumePrompt}>
          <Text size="sm">You have an unfinished conversation.</Text>
          <div className={styles.resumeButtons}>
            <Button
              variant="gradient"
              size="sm"
              onClick={onResume}
            >
              Continue
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDismissResume}
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
            msg.sent_by?.toString() !== currentUserId;
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
                          messageIndex={msgIdx}
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
              {msg.tool_call_pills?.length > 0 && (
                <div className={styles.toolCallPills}>
                  {msg.tool_call_pills.map(pill => (
                    <ToolCallPill
                      key={pill.call_id}
                      label={pill.label}
                      status={pill.status}
                    />
                  ))}
                </div>
              )}
              <MessageContent text={msg.content} role={msg.role} />
              {msg.structured_content?.length > 0 && (
                <div className={styles.structuredContent}>
                  {msg.structured_content.map((block, blockIdx) => {
                    if (block.type === 'suggestion_list') {
                      return (
                        <SuggestionList
                          key={blockIdx}
                          data={block.data}
                          onAddSelected={onAddSuggestedItems}
                          disabled={isLoading || isStreaming}
                          existingItemTexts={currentPlanItemTexts}
                        />
                      );
                    }
                    if (block.type === 'photo_gallery') {
                      return (
                        <BienBotPhotoGallery
                          key={blockIdx}
                          data={block.data}
                          onAddPhotos={onAddPhotos}
                          disabled={isLoading || isStreaming}
                        />
                      );
                    }
                    if (block.type === 'tip_suggestion_list') {
                      return (
                        <TipSuggestionList
                          key={blockIdx}
                          data={block.data}
                          onAddSelected={onAddTips}
                          disabled={isLoading || isStreaming}
                        />
                      );
                    }
                    if (block.type === 'discovery_result_list') {
                      return (
                        <DiscoveryResultCard
                          key={blockIdx}
                          data={block.data}
                          onView={onViewDiscoveryResult}
                          onPlan={onPlanDiscoveryResult}
                          onEmpty={onDiscoveryEmpty}
                          disabled={isLoading || isStreaming}
                        />
                      );
                    }
                    if (block.type === 'entity_ref_list') {
                      return (
                        <EntityRefList
                          key={blockIdx}
                          refs={block.data?.refs || []}
                          onSelect={onEntityRefSelect}
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
                    onClick={() => onReplyToCollaborator(msg)}
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
  );
}

MessageList.propTypes = {
  messages: PropTypes.array.isRequired,
  isLoading: PropTypes.bool,
  isStreaming: PropTypes.bool,
  currentSession: PropTypes.object,
  emptyStateText: PropTypes.string,
  savedSession: PropTypes.object,
  onResume: PropTypes.func.isRequired,
  onDismissResume: PropTypes.func.isRequired,
  onAddSuggestedItems: PropTypes.func.isRequired,
  onAddPhotos: PropTypes.func.isRequired,
  onAddTips: PropTypes.func.isRequired,
  onViewDiscoveryResult: PropTypes.func.isRequired,
  onPlanDiscoveryResult: PropTypes.func.isRequired,
  onDiscoveryEmpty: PropTypes.func.isRequired,
  onEntityRefSelect: PropTypes.func.isRequired,
  onReplyToCollaborator: PropTypes.func.isRequired,
  currentPlanItemTexts: PropTypes.instanceOf(Set),
  currentUserId: PropTypes.string,
  messagesContainerRef: PropTypes.object.isRequired,
  messagesEndRef: PropTypes.object.isRequired,
};

export default React.memo(MessageList);

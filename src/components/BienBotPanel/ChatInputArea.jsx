/**
 * ChatInputArea — Suggestion chips, attachment preview, reply strip,
 * context-switch prompt, and the message compose bar.
 *
 * @module components/BienBotPanel/ChatInputArea
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Button } from '../design-system';
import ContextSwitchPrompt from '../ContextSwitchPrompt/ContextSwitchPrompt';
import { AttachIcon, SendIcon, CloseIcon } from './icons';
import styles from './BienBotPanel.module.css';

function ChatInputArea({
  inputRef,
  fileInputRef,
  visibleChips,
  onChipClick,
  attachment,
  attachmentPreviewUrl,
  onAttachClick,
  onFileChange,
  onRemoveAttachment,
  replyTo,
  onCancelReply,
  pendingContextSwitch,
  onStaySwitch,
  onAcceptSwitch,
  placeholderText,
  isStreaming,
  isLoading,
  resizeTextarea,
  onKeyDown,
  onSend,
  allowedAttachTypes,
}) {
  return (
    <>
      {/* ── Suggested action chips ─────────────────────────────────── */}
      {visibleChips.length > 0 && (
        <div className={styles.chipsContainer}>
          {visibleChips.map((step, idx) => {
            const label =
              typeof step === 'string'
                ? step
                : step.label || step.text || '';
            return (
              <button
                key={idx}
                type="button"
                className={styles.chip}
                data-chip="true"
                onClick={() => onChipClick(step)}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Attachment preview ────────────────────────────────────── */}
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
            onClick={onRemoveAttachment}
            aria-label="Remove attachment"
          >
            <CloseIcon />
          </button>
        </div>
      )}

      {/* ── Reply strip ───────────────────────────────────────────── */}
      {replyTo && (
        <div className={styles.replyStrip}>
          <span className={styles.replyStripContent}>
            Replying to <strong>{replyTo.senderName}</strong>: {replyTo.preview}
          </span>
          <button
            type="button"
            className={styles.replyStripClose}
            onClick={onCancelReply}
            aria-label="Cancel reply"
          >
            <CloseIcon />
          </button>
        </div>
      )}

      {/* ── Context switch prompt ─────────────────────────────────── */}
      {pendingContextSwitch && (
        <ContextSwitchPrompt
          prevEntityLabel={pendingContextSwitch.prevEntityLabel}
          newEntityLabel={pendingContextSwitch.newEntityLabel}
          newEntityType={pendingContextSwitch.entity}
          onStay={onStaySwitch}
          onSwitch={onAcceptSwitch}
        />
      )}

      {/* ── Input area ────────────────────────────────────────────── */}
      <div className={styles.inputArea}>
        <input
          ref={fileInputRef}
          type="file"
          accept={allowedAttachTypes}
          className={styles.hiddenFileInput}
          onChange={onFileChange}
          aria-hidden="true"
          tabIndex={-1}
        />
        <button
          type="button"
          className={styles.attachButton}
          onClick={onAttachClick}
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
          onKeyDown={onKeyDown}
          aria-label="Message input"
        />
        <Button
          variant="primary"
          size="md"
          className={styles.sendButton}
          onClick={onSend}
          disabled={isLoading || isStreaming}
          aria-label="Send message"
        >
          <SendIcon />
        </Button>
      </div>
    </>
  );
}

ChatInputArea.propTypes = {
  inputRef: PropTypes.object.isRequired,
  fileInputRef: PropTypes.object.isRequired,
  visibleChips: PropTypes.array.isRequired,
  onChipClick: PropTypes.func.isRequired,
  attachment: PropTypes.object,
  attachmentPreviewUrl: PropTypes.string,
  onAttachClick: PropTypes.func.isRequired,
  onFileChange: PropTypes.func.isRequired,
  onRemoveAttachment: PropTypes.func.isRequired,
  replyTo: PropTypes.shape({
    senderName: PropTypes.string,
    preview: PropTypes.string,
  }),
  onCancelReply: PropTypes.func.isRequired,
  pendingContextSwitch: PropTypes.shape({
    entity: PropTypes.string,
    prevEntityLabel: PropTypes.string,
    newEntityLabel: PropTypes.string,
  }),
  onStaySwitch: PropTypes.func.isRequired,
  onAcceptSwitch: PropTypes.func.isRequired,
  placeholderText: PropTypes.string,
  isStreaming: PropTypes.bool,
  isLoading: PropTypes.bool,
  resizeTextarea: PropTypes.func.isRequired,
  onKeyDown: PropTypes.func.isRequired,
  onSend: PropTypes.func.isRequired,
  allowedAttachTypes: PropTypes.string.isRequired,
};

export default ChatInputArea;

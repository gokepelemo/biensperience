import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { getAttachmentUrl } from '../../utilities/bienbot-api';
import { logger } from '../../utilities/logger';
import styles from './BienBotPanel.module.css';

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

export default ImageAttachment;

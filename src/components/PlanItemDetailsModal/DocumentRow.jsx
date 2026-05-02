import { memo } from 'react';
import {
  FaBan,
  FaEye,
  FaFileAlt,
  FaFileImage,
  FaFilePdf,
  FaLock,
  FaRobot,
  FaSkullCrossbones,
  FaTrash,
  FaUndo,
  FaUsers,
} from 'react-icons/fa';
import { Tooltip } from '../design-system';
import { formatFileSize } from '../../utilities/document-upload';
import styles from './DocumentsTab.module.css';

function getDocumentIcon(mimeType) {
  if (mimeType?.startsWith('image/')) return <FaFileImage />;
  if (mimeType === 'application/pdf') return <FaFilePdf />;
  return <FaFileAlt />;
}

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function DocumentRow({
  doc,
  isOwner,
  isAdmin,
  canEdit,
  hasAiData,
  isLoadingPreview,
  onPreview,
  onShowAiSummary,
  onVisibilityToggle,
  onRestore,
  onPermanentDelete,
  onDelete,
}) {
  const isDisabled = doc.isDisabled;

  return (
    <div
      className={`${styles.documentCard} ${isDisabled ? styles.disabledDocument : ''}`}
    >
      {isDisabled && (
        <div className={styles.disabledBadge}>
          <FaBan />
          <span>Disabled</span>
        </div>
      )}

      <div className={styles.documentIcon}>{getDocumentIcon(doc.mimeType)}</div>

      <div className={styles.documentInfo}>
        <div className={styles.documentName}>{doc.originalFilename}</div>
        <div className={styles.documentMeta}>
          <span>{formatFileSize(doc.fileSize)}</span>
          <span className={styles.metaSeparator}>•</span>
          <span>{formatDate(doc.createdAt)}</span>
          {doc.user?.name && (
            <>
              <span className={styles.metaSeparator}>•</span>
              <span>{doc.user.name}</span>
            </>
          )}
          {isDisabled && doc.disabledAt && (
            <>
              <span className={styles.metaSeparator}>•</span>
              <span className={styles.disabledInfo}>
                Disabled {formatDate(doc.disabledAt)}
                {doc.disabledBy?.name && ` by ${doc.disabledBy.name}`}
              </span>
            </>
          )}
        </div>
      </div>

      <div className={styles.documentActions}>
        <Tooltip content="Preview document" placement="top">
          <button
            type="button"
            className={styles.previewButton}
            onClick={() => onPreview(doc)}
            disabled={isLoadingPreview}
            aria-label="Preview document"
          >
            {isLoadingPreview ? (
              <span className={styles.loadingSpinnerSmall}></span>
            ) : (
              <FaEye />
            )}
          </button>
        </Tooltip>

        {hasAiData && (
          <Tooltip content="View AI-generated summary" placement="top">
            <button
              type="button"
              className={styles.aiBadge}
              onClick={() => onShowAiSummary(doc._id)}
              aria-label="View AI summary"
            >
              <FaRobot />
            </button>
          </Tooltip>
        )}

        {isOwner && !isDisabled && (
          <Tooltip
            content={
              doc.visibility === 'private'
                ? 'Private - only you can see this. Click to share with collaborators.'
                : 'Shared with collaborators. Click to make private.'
            }
            placement="top"
          >
            <button
              type="button"
              className={`${styles.visibilityButton} ${doc.visibility === 'private' ? styles.private : styles.shared}`}
              onClick={() => onVisibilityToggle(doc._id, doc.visibility)}
              aria-label={
                doc.visibility === 'private'
                  ? 'Make visible to collaborators'
                  : 'Make private'
              }
            >
              {doc.visibility === 'private' ? <FaLock /> : <FaUsers />}
            </button>
          </Tooltip>
        )}

        {!isOwner && doc.visibility === 'private' && !isDisabled && (
          <Tooltip content="Private document" placement="top">
            <span
              className={`${styles.visibilityIndicator} ${styles.private}`}
            >
              <FaLock />
            </span>
          </Tooltip>
        )}

        {isAdmin && isDisabled && (
          <>
            <Tooltip content="Restore document 🔐" placement="top">
              <button
                type="button"
                className={styles.restoreButton}
                onClick={() => onRestore(doc._id)}
                aria-label="Restore document"
              >
                <FaUndo />
              </button>
            </Tooltip>
            <Tooltip content="Permanently delete 🔐" placement="top">
              <button
                type="button"
                className={styles.permanentDeleteButton}
                onClick={() => onPermanentDelete(doc._id)}
                aria-label="Permanently delete document"
              >
                <FaSkullCrossbones />
              </button>
            </Tooltip>
          </>
        )}

        {isOwner && canEdit && !isDisabled && (
          <Tooltip content="Delete document" placement="top">
            <button
              type="button"
              className={styles.deleteButton}
              onClick={() => onDelete(doc._id)}
              aria-label="Delete document"
            >
              <FaTrash />
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

export default memo(DocumentRow);

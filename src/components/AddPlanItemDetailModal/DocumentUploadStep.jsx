/**
 * DocumentUploadStep Component
 * Step 3 of AddPlanItemDetailModal - Upload document with AI parsing
 */

import { useState, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import styles from './AddPlanItemDetailModal.module.scss';
import Tooltip from '../Tooltip/Tooltip';
import { logger } from '../../utilities/logger';
import { lang } from '../../lang.constants';
import { validateDocument, ALL_SUPPORTED_MIMES, MAX_FILE_SIZES, formatFileSize as formatFileSizeUtil } from '../../utilities/document-upload';

// Max file size for display (use the largest)
const MAX_FILE_SIZE = Math.max(...Object.values(MAX_FILE_SIZES));
// Accepted file types for input
const ACCEPTED_FILE_TYPES = ALL_SUPPORTED_MIMES;

/**
 * Map detail types to document types for AI parsing
 */
const DETAIL_TO_DOCUMENT_TYPE = {
  cost: 'receipt',
  flight: 'flight',
  train: 'transport',
  cruise: 'transport',
  ferry: 'transport',
  bus: 'transport',
  hotel: 'hotel',
  parking: 'travel',
  discount: 'travel'
};

export default function DocumentUploadStep({
  detailType,
  value,
  onChange,
  planItem,
  plan
}) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  // Handle file selection
  const handleFileSelect = useCallback((selectedFile) => {
    setError(null);

    if (!selectedFile) {
      setFile(null);
      setPreview(null);
      onChange(null);
      return;
    }

    // Validate the file
    const validation = validateDocument(selectedFile);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    setFile(selectedFile);

    // Create preview for images
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target.result);
      reader.readAsDataURL(selectedFile);
    } else {
      setPreview(null);
    }

    // Pass file info to parent
    onChange({
      file: selectedFile,
      fileName: selectedFile.name,
      fileType: selectedFile.type,
      fileSize: selectedFile.size,
      documentType: DETAIL_TO_DOCUMENT_TYPE[detailType] || 'travel'
    });

    logger.info('[DocumentUploadStep] File selected', {
      name: selectedFile.name,
      type: selectedFile.type,
      size: selectedFile.size
    });
  }, [detailType, onChange]);

  // Handle file input change
  const handleInputChange = useCallback((e) => {
    const selectedFile = e.target.files?.[0];
    handleFileSelect(selectedFile);
  }, [handleFileSelect]);

  // Handle drag events
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  // Handle drop
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFile = e.dataTransfer.files?.[0];
    handleFileSelect(droppedFile);
  }, [handleFileSelect]);

  // Remove selected file
  const handleRemoveFile = useCallback(() => {
    setFile(null);
    setPreview(null);
    setError(null);
    onChange(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, [onChange]);

  // Open file dialog
  const handleBrowseClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  // Format file size for display
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Get file icon based on type
  const getFileIcon = (mimeType) => {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType === 'application/pdf') return '📄';
    return '📎';
  };

  return (
    <div className={styles.documentUploadStep}>
      {/* AI Processing Info */}
      <div className={styles.aiInfoBox}>
        <div className={styles.aiInfoHeader}>
          <span className={styles.aiInfoIcon}>🤖</span>
          <span className={styles.aiInfoTitle}>AI Document Processing</span>
          <Tooltip
            content="Your document will be processed using AI to automatically extract relevant information like confirmation numbers, dates, and amounts. This helps pre-fill details and saves time."
            placement="top"
          >
            <span className={styles.aiInfoHelp}>ⓘ</span>
          </Tooltip>
        </div>
        <p className={styles.aiInfoText}>
          Upload a confirmation email, receipt, or booking document.
          Our AI will extract key details automatically.
        </p>
      </div>

      {/* File Drop Zone */}
      <div
        className={`${styles.dropZone} ${dragActive ? styles.dragActive : ''} ${file ? styles.hasFile : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {!file ? (
          <>
            <div className={styles.dropZoneIcon}>📤</div>
            <p className={styles.dropZoneText}>
              Drag and drop your file here, or{' '}
              <button
                type="button"
                className={styles.browseButton}
                onClick={handleBrowseClick}
              >
                browse
              </button>
            </p>
            <p className={styles.dropZoneHint}>
              Accepts PDF, PNG, JPEG, GIF, WebP (max {formatFileSize(MAX_FILE_SIZE)})
            </p>
          </>
        ) : (
          <div className={styles.selectedFile}>
            {preview ? (
              <img src={preview} alt="Preview" className={styles.filePreview} />
            ) : (
              <div className={styles.fileIconLarge}>
                {getFileIcon(file.type)}
              </div>
            )}
            <div className={styles.fileInfo}>
              <span className={styles.fileName}>{file.name}</span>
              <span className={styles.fileSize}>{formatFileSize(file.size)}</span>
            </div>
            <button
              type="button"
              className={styles.removeFileButton}
              onClick={handleRemoveFile}
              aria-label="Remove file"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        className={styles.hiddenInput}
        accept={ACCEPTED_FILE_TYPES.join(',')}
        onChange={handleInputChange}
      />

      {/* Error message */}
      {error && (
        <div className={styles.uploadError}>
          {error}
        </div>
      )}

      {/* Supported formats */}
      <div className={styles.supportedFormats}>
        <span className={styles.formatsLabel}>Supported formats:</span>
        <div className={styles.formatsList}>
          <span className={styles.formatBadge}>📄 PDF</span>
          <span className={styles.formatBadge}>🖼️ PNG</span>
          <span className={styles.formatBadge}>🖼️ JPEG</span>
          <span className={styles.formatBadge}>🖼️ GIF</span>
          <span className={styles.formatBadge}>🖼️ WebP</span>
        </div>
      </div>

      {/* Skip option */}
      <p className={styles.skipHint}>
        This step is optional. You can always add a document later.
      </p>
    </div>
  );
}

DocumentUploadStep.propTypes = {
  detailType: PropTypes.string,
  value: PropTypes.object,
  onChange: PropTypes.func.isRequired,
  planItem: PropTypes.object,
  plan: PropTypes.object
};

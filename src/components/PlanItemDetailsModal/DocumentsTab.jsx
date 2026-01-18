/**
 * DocumentsTab Component
 * Documents tab content for PlanItemDetailsModal with upload, visibility controls, and AI summary
 * 
 * Features:
 * - Document upload with AI parsing
 * - Visibility controls (private/collaborators)
 * - Soft delete with super admin permanent delete
 * - Event bus integration for real-time updates
 * - Pagination support
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { FaUpload, FaLock, FaUsers, FaRobot, FaTrash, FaFileAlt, FaFilePdf, FaFileImage, FaEye, FaUndo, FaSkullCrossbones, FaBan, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import EmptyState from '../EmptyState/EmptyState';
import Loading from '../Loading/Loading';
import Modal from '../Modal/Modal';
import Tooltip from '../Tooltip/Tooltip';
import DocumentViewerModal from '../DocumentViewerModal';
import ProgressBar from '../ProgressBar/ProgressBar';
import { Button } from '../design-system';
import {
  getDocumentsByEntity,
  uploadDocument,
  updateDocumentVisibility,
  deleteDocument,
  permanentDeleteDocument,
  restoreDocument,
  formatFileSize,
  getAcceptAttribute,
  getDocumentPreviewUrl,
  getFileSizeLimits
} from '../../utilities/document-upload';
import { logger } from '../../utilities/logger';
import { lang } from '../../lang.constants';
import { useUser } from '../../contexts/UserContext';
import { hasFeatureFlag } from '../../utilities/feature-flags';
import { isSuperAdmin } from '../../utilities/permissions';
import { eventBus, broadcastEvent } from '../../utilities/event-bus';
import DropZone from '../DropZone';
import styles from './DocumentsTab.module.scss';

// Pagination config
const DEFAULT_PAGE_SIZE = 10;

/**
 * Get icon for document type based on mime type
 */
function getDocumentIcon(mimeType) {
  if (mimeType?.startsWith('image/')) return <FaFileImage />;
  if (mimeType === 'application/pdf') return <FaFilePdf />;
  return <FaFileAlt />;
}

/**
 * Format date for display
 */
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

export default function DocumentsTab({
  planItem,
  plan,
  canEdit = false
}) {
  const { user } = useUser();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [showAiSummary, setShowAiSummary] = useState(null); // Document ID for AI summary modal
  const [deleteConfirm, setDeleteConfirm] = useState(null); // Document ID for delete confirmation
  const [permanentDeleteConfirm, setPermanentDeleteConfirm] = useState(null); // Document ID for permanent delete
  const [previewDoc, setPreviewDoc] = useState(null); // Document for preview { doc, previewUrl }
  const [loadingPreview, setLoadingPreview] = useState(null); // Document ID currently loading preview
  const [showDisabled, setShowDisabled] = useState(false); // Show disabled documents toggle
  const [uploadProgress, setUploadProgress] = useState(null); // Upload progress: { loaded, total, percent, fileName }
  const [pagination, setPagination] = useState({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 1,
    hasMore: false
  });
  const [uploadMode, setUploadMode] = useState(false); // Whether we're in upload mode (shows drop zone)
  const fileInputRef = useRef(null);

  // Check if user has AI features enabled
  const hasAiFeatures = hasFeatureFlag(user, 'ai_features');
  // Check if user is super admin
  const isAdmin = isSuperAdmin(user);

  // Fetch documents for this plan item
  const fetchDocuments = useCallback(async (page = 1) => {
    if (!planItem?._id || !plan?._id) return;

    setLoading(true);
    setError(null);

    try {
      const result = await getDocumentsByEntity('plan_item', planItem._id, {
        planId: plan._id,
        includeDisabled: isAdmin && showDisabled,
        page,
        limit: DEFAULT_PAGE_SIZE
      });
      setDocuments(result.documents);
      setPagination(result.pagination);
    } catch (err) {
      logger.error('[DocumentsTab] Failed to fetch documents', { error: err.message });
      setError('Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [planItem?._id, plan?._id, isAdmin, showDisabled]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Subscribe to document events for real-time updates
  useEffect(() => {
    if (!planItem?._id || !plan?._id) return;

    // Handle document created
    const handleDocumentCreated = (event) => {
      const doc = event.document;
      if (doc && doc.entityType === 'plan_item' && doc.entityId === planItem._id) {
        let wasAdded = false;
        setDocuments(prev => {
          // Check if document already exists to prevent duplicates
          const exists = prev.some(d => d._id === doc._id);
          if (exists) return prev;
          wasAdded = true;
          return [doc, ...prev];
        });
        // Only increment pagination if document was actually added (not duplicate)
        if (wasAdded) {
          setPagination(prev => ({ ...prev, total: prev.total + 1 }));
        }
        logger.debug('[DocumentsTab] Document created event received', { documentId: doc._id, wasAdded });
      }
    };

    // Handle document updated
    const handleDocumentUpdated = (event) => {
      const doc = event.document;
      if (doc && doc.entityType === 'plan_item' && doc.entityId === planItem._id) {
        setDocuments(prev => prev.map(d => d._id === doc._id ? doc : d));
        logger.debug('[DocumentsTab] Document updated event received', { documentId: doc._id });
      }
    };

    // Handle document deleted (soft delete)
    const handleDocumentDeleted = (event) => {
      const { documentId, isDisabled } = event;
      if (documentId) {
        if (isDisabled && isAdmin && showDisabled) {
          // For admin viewing disabled docs, update the doc's isDisabled status
          setDocuments(prev => prev.map(d =>
            d._id === documentId ? { ...d, isDisabled: true, disabledAt: new Date() } : d
          ));
        } else {
          // Remove from list for regular users or if not showing disabled
          setDocuments(prev => prev.filter(d => d._id !== documentId));
          setPagination(prev => ({ ...prev, total: Math.max(0, prev.total - 1) }));
        }
        logger.debug('[DocumentsTab] Document deleted event received', { documentId });
      }
    };

    // Handle document permanently deleted
    const handleDocumentPermanentlyDeleted = (event) => {
      const { documentId } = event;
      if (documentId) {
        setDocuments(prev => prev.filter(d => d._id !== documentId));
        setPagination(prev => ({ ...prev, total: Math.max(0, prev.total - 1) }));
        logger.debug('[DocumentsTab] Document permanently deleted event received', { documentId });
      }
    };

    // Handle document restored
    const handleDocumentRestored = (event) => {
      const doc = event.document;
      if (doc && doc.entityType === 'plan_item' && doc.entityId === planItem._id) {
        setDocuments(prev => prev.map(d => d._id === doc._id ? doc : d));
        logger.debug('[DocumentsTab] Document restored event received', { documentId: doc._id });
      }
    };

    // Subscribe to events
    const unsubscribeCreated = eventBus.subscribe('document:created', handleDocumentCreated);
    const unsubscribeUpdated = eventBus.subscribe('document:updated', handleDocumentUpdated);
    const unsubscribeDeleted = eventBus.subscribe('document:deleted', handleDocumentDeleted);
    const unsubscribePermanentlyDeleted = eventBus.subscribe('document:permanentlyDeleted', handleDocumentPermanentlyDeleted);
    const unsubscribeRestored = eventBus.subscribe('document:restored', handleDocumentRestored);

    // Cleanup subscriptions
    return () => {
      unsubscribeCreated();
      unsubscribeUpdated();
      unsubscribeDeleted();
      unsubscribePermanentlyDeleted();
      unsubscribeRestored();
    };
  }, [planItem?._id, plan?._id, isAdmin, showDisabled]);

  // Handle file upload
  const handleFileSelect = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setUploadProgress({ loaded: 0, total: file.size, percent: 0, fileName: file.name });

    try {
      const newDoc = await uploadDocument(file, {
        entityType: 'plan_item',
        entityId: planItem._id,
        planId: plan._id,
        planItemId: planItem._id,
        visibility: 'collaborators', // Default to collaborators
        aiParsingEnabled: hasAiFeatures,
        onProgress: (progress) => {
          setUploadProgress(prev => ({
            ...prev,
            loaded: progress.loaded,
            total: progress.total,
            percent: progress.percent
          }));
        }
      });

      // Add document to state (event bus handles cross-tab sync, not local)
      // We add directly here since we initiated the upload
      setDocuments(prev => {
        // Check if document already exists to prevent duplicates
        const exists = prev.some(d => d._id === newDoc._id);
        if (exists) return prev;
        return [newDoc, ...prev];
      });
      setPagination(prev => ({ ...prev, total: prev.total + 1 }));

      logger.info('[DocumentsTab] Document uploaded', { documentId: newDoc._id });
    } catch (err) {
      logger.error('[DocumentsTab] Upload failed', { error: err.message });
      setError(err.message || 'Failed to upload document');
    } finally {
      setUploading(false);
      setUploadProgress(null);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [planItem?._id, plan?._id, hasAiFeatures]);

  // Handle drag-and-drop file upload
  const handleDrop = useCallback(async (files) => {
    if (!files || files.length === 0) return;

    logger.info('[DocumentsTab] Files dropped for upload', { count: files.length });

    setUploading(true);
    setError(null);

    try {
      const uploadedDocs = [];

      for (const file of Array.from(files)) {
        logger.debug('[DocumentsTab] Uploading dropped document', { fileName: file.name });

        const newDoc = await uploadDocument(file, {
          entityType: 'plan_item',
          entityId: planItem._id,
          planId: plan._id,
          planItemId: planItem._id,
          visibility: 'collaborators', // Default to collaborators
          aiParsingEnabled: hasAiFeatures
        });

        uploadedDocs.push(newDoc);
      }

      if (uploadedDocs.length > 0) {
        // Add documents to state
        setDocuments(prev => {
          // Check for duplicates
          const filtered = uploadedDocs.filter(newDoc =>
            !prev.some(existing => existing._id === newDoc._id)
          );
          return [...filtered, ...prev];
        });
        setPagination(prev => ({ ...prev, total: prev.total + uploadedDocs.length }));

        logger.info('[DocumentsTab] Documents uploaded via drag-drop', {
          uploadedCount: uploadedDocs.length
        });
      }
    } catch (err) {
      logger.error('[DocumentsTab] Drag-drop upload failed', { error: err.message });
      setError(err.message || 'Failed to upload documents');
    } finally {
      setUploading(false);
    }
  }, [planItem?._id, plan?._id, hasAiFeatures, documents.length]);

  // Handle visibility toggle
  const handleVisibilityToggle = useCallback(async (documentId, currentVisibility) => {
    const newVisibility = currentVisibility === 'private' ? 'collaborators' : 'private';

    try {
      const updatedDoc = await updateDocumentVisibility(documentId, newVisibility);
      setDocuments(prev => prev.map(doc =>
        doc._id === documentId ? { ...doc, visibility: updatedDoc.visibility } : doc
      ));

      // Emit event for other components
      broadcastEvent('document:updated', { document: updatedDoc });

      logger.info('[DocumentsTab] Visibility updated', { documentId, newVisibility });
    } catch (err) {
      logger.error('[DocumentsTab] Failed to update visibility', { error: err.message });
      setError('Failed to update visibility');
    }
  }, []);

  // Handle document deletion (soft delete)
  const handleDelete = useCallback(async (documentId) => {
    try {
      await deleteDocument(documentId);
      
      // Optimistically update UI
      if (isAdmin && showDisabled) {
        setDocuments(prev => prev.map(doc =>
          doc._id === documentId ? { ...doc, isDisabled: true, disabledAt: new Date() } : doc
        ));
      } else {
        setDocuments(prev => prev.filter(doc => doc._id !== documentId));
        setPagination(prev => ({ ...prev, total: Math.max(0, prev.total - 1) }));
      }
      setDeleteConfirm(null);

      // Emit event
      broadcastEvent('document:deleted', { documentId, isDisabled: true });

      logger.info('[DocumentsTab] Document disabled', { documentId });
    } catch (err) {
      logger.error('[DocumentsTab] Failed to delete document', { error: err.message });
      setError('Failed to delete document');
    }
  }, [isAdmin, showDisabled]);

  // Handle permanent deletion (super admin only)
  const handlePermanentDelete = useCallback(async (documentId) => {
    try {
      await permanentDeleteDocument(documentId);
      setDocuments(prev => prev.filter(doc => doc._id !== documentId));
      setPagination(prev => ({ ...prev, total: Math.max(0, prev.total - 1) }));
      setPermanentDeleteConfirm(null);

      // Emit event
      broadcastEvent('document:permanentlyDeleted', { documentId });

      logger.info('[DocumentsTab] Document permanently deleted', { documentId });
    } catch (err) {
      logger.error('[DocumentsTab] Failed to permanently delete document', { error: err.message });
      setError('Failed to permanently delete document');
    }
  }, []);

  // Handle document restore (super admin only)
  const handleRestore = useCallback(async (documentId) => {
    try {
      const restoredDoc = await restoreDocument(documentId);
      setDocuments(prev => prev.map(doc =>
        doc._id === documentId ? restoredDoc : doc
      ));

      // Emit event
      broadcastEvent('document:restored', { document: restoredDoc });

      logger.info('[DocumentsTab] Document restored', { documentId });
    } catch (err) {
      logger.error('[DocumentsTab] Failed to restore document', { error: err.message });
      setError('Failed to restore document');
    }
  }, []);

  // Check if current user is the owner of a document
  const isDocumentOwner = useCallback((doc) => {
    const docUserId = doc.user?._id || doc.user;
    return user?._id === docUserId || user?._id?.toString() === docUserId?.toString();
  }, [user?._id]);

  // Trigger file input
  const handleUploadClick = useCallback(() => {
    setUploadMode(true); // Enter upload mode to show drop zone
    const input = fileInputRef.current;
    if (!input) {
      logger.error('[DocumentsTab] Upload click: file input ref missing');
      return;
    }

    // Prefer showPicker() when supported; some browsers restrict click() on hidden inputs.
    try {
      if (typeof input.showPicker === 'function') {
        input.showPicker();
        return;
      }
    } catch (err) {
      // Fall back to click()
      logger.debug('[DocumentsTab] showPicker failed, falling back to click', { error: err?.message });
    }

    input.click();
  }, []);

  // Handle document preview - get signed URL and open viewer
  const handlePreview = useCallback(async (doc) => {
    setLoadingPreview(doc._id);
    setError(null);

    try {
      const previewData = await getDocumentPreviewUrl(doc._id);
      setPreviewDoc({
        doc,
        previewUrl: previewData.url,
        filename: previewData.filename,
        mimeType: previewData.mimeType
      });
      logger.info('[DocumentsTab] Document preview opened', { documentId: doc._id });
    } catch (err) {
      logger.error('[DocumentsTab] Failed to get preview URL', { error: err.message });
      setError('Failed to load document preview');
    } finally {
      setLoadingPreview(null);
    }
  }, []);

  // Close document preview
  const handleClosePreview = useCallback(() => {
    setPreviewDoc(null);
  }, []);

  // Get AI summary for a document
  const getAiSummary = useCallback((doc) => {
    if (!doc.aiParsedData) return null;

    const { summary, documentType, ...fields } = doc.aiParsedData;
    const relevantFields = Object.entries(fields)
      .filter(([key, value]) => value && !['_id', 'createdAt', 'updatedAt'].includes(key))
      .map(([key, value]) => ({
        label: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
        value: typeof value === 'object' ? JSON.stringify(value) : String(value)
      }));

    return { summary, documentType, fields: relevantFields };
  }, []);

  // Handle page change
  const handlePageChange = useCallback((newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchDocuments(newPage);
    }
  }, [fetchDocuments, pagination.totalPages]);

  // Toggle show disabled documents
  const handleToggleDisabled = useCallback(() => {
    setShowDisabled(prev => !prev);
  }, []);

  // Loading state
  if (loading && documents.length === 0) {
    return (
      <div className={styles.documentsTab}>
        <Loading size="sm" variant="centered" message="Loading documents..." />
      </div>
    );
  }

  // Empty state - when no documents are available (including disabled ones when showDisabled is true)
  if (documents.length === 0) {
    return (
      <div className={styles.documentsTab}>
        <input
          ref={fileInputRef}
          type="file"
          accept={getAcceptAttribute()}
          onChange={handleFileSelect}
          className={styles.hiddenFileInput}
          aria-hidden="true"
        />

        {error && (
          <div className={styles.errorMessage}>{error}</div>
        )}

        {/* Super admin toggle for disabled documents */}
        {isAdmin && (
          <div className={styles.adminControls}>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleDisabled}
              className={styles.adminToggle}
              title="Super Admin Only"
            >
              <FaBan className={styles.adminIcon} />
              {showDisabled ? 'Hide Disabled' : 'Show Disabled'}
              <span className={styles.adminBadge}>🔐</span>
            </Button>
          </div>
        )}

        <EmptyState
          variant="documents"
          title={showDisabled ? 'No Disabled Documents Found' : undefined}
          description={showDisabled ? 'There are no disabled documents for this plan item.' : undefined}
          primaryAction={canEdit ? (lang.current.planItemDetailsModal?.uploadDocument || 'Upload Document') : null}
          onPrimaryAction={canEdit ? handleUploadClick : null}
          size="md"
          fillContainer
        />
      </div>
    );
  }

  // Documents list
  return (
    <div className={styles.documentsTab}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={getAcceptAttribute()}
        onChange={handleFileSelect}
        className={styles.hiddenFileInput}
        aria-hidden="true"
      />

      {/* Error message */}
      {error && (
        <div className={styles.errorMessage}>{error}</div>
      )}

      {/* Upload bar and admin controls */}
      {canEdit && (
        <div className={styles.uploadBar}>
          {/* Super admin toggle */}
          {isAdmin && (
            <Button
              variant={showDisabled ? 'light' : 'outline'}
              size="sm"
              onClick={handleToggleDisabled}
              className={styles.adminToggle}
              title="Super Admin Only"
            >
              <FaBan className={styles.adminIcon} />
              {showDisabled ? 'Hide Disabled' : 'Show Disabled'}
              <span className={styles.adminBadge}>🔐</span>
            </Button>
          )}

          {/* Upload button with file size info */}
          <Tooltip content={getFileSizeLimits().summary} placement="bottom">
            <Button
              variant="outline"
              size="sm"
              onClick={handleUploadClick}
              disabled={uploading}
            >
              <FaUpload className={styles.uploadIcon} />
              {uploading ? 'Uploading...' : 'Upload Document'}
            </Button>
          </Tooltip>
        </div>
      )}

      {/* Upload bar for read-only users */}
      {!canEdit && isAdmin && (
        <div className={styles.uploadBar}>
          {/* Super admin toggle */}
          <Button
            variant={showDisabled ? 'light' : 'outline'}
            size="sm"
            onClick={handleToggleDisabled}
            className={styles.adminToggle}
            title="Super Admin Only"
          >
            <FaBan className={styles.adminIcon} />
            {showDisabled ? 'Hide Disabled' : 'Show Disabled'}
            <span className={styles.adminBadge}>🔐</span>
          </Button>
        </div>
      )}

      {/* File size limit help text */}
      {canEdit && !uploading && !uploadProgress && (
        <div className={styles.fileSizeHint}>
          Max file size: {getFileSizeLimits().maxSize} (varies by type)
        </div>
      )}

      {/* Upload progress indicator */}
      {uploadProgress && (
        <div className={styles.uploadProgressContainer} aria-busy="true">
          <div className={styles.uploadProgressInfo}>
            <span className={styles.uploadFileName}>{uploadProgress.fileName}</span>
            <span className={styles.uploadSize}>
              {formatFileSize(uploadProgress.loaded)} / {formatFileSize(uploadProgress.total)}
            </span>
          </div>
          <ProgressBar
            value={uploadProgress.percent}
            color="primary"
            size="sm"
            showPercentage
            animated
          />
          {uploadProgress.percent === 100 && (
            <span className={styles.uploadProcessing}>Processing document...</span>
          )}
        </div>
      )}

      {/* Aria-live region for screen reader announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="visually-hidden"
      >
        {uploading && uploadProgress && uploadProgress.percent < 100 && (
          `Uploading ${uploadProgress.fileName}: ${uploadProgress.percent}% complete`
        )}
        {uploading && uploadProgress && uploadProgress.percent === 100 && (
          'Upload complete, processing document...'
        )}
        {error && `Upload error: ${error}`}
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className={styles.loadingOverlay}>
          <span className={styles.loadingSpinner}></span>
        </div>
      )}

      {/* Documents list */}
      {canEdit && uploadMode ? (
        <DropZone
          onDrop={handleDrop}
          accept={getAcceptAttribute()}
          multiple={true}
          disabled={uploading}
          dropMessage="Drop documents here to upload"
          className={styles.documentDropZone}
        >
          <div className={styles.documentsList}>
            {documents.map((doc) => {
              const isOwner = isDocumentOwner(doc);
              const aiSummary = hasAiFeatures ? getAiSummary(doc) : null;
              const hasAiData = !!aiSummary;
              const isDisabled = doc.isDisabled;

              return (
                <div
                  key={doc._id}
                  className={`${styles.documentCard} ${isDisabled ? styles.disabledDocument : ''}`}
                >
                  {/* Disabled indicator */}
                  {isDisabled && (
                    <div className={styles.disabledBadge}>
                      <FaBan />
                      <span>Disabled</span>
                    </div>
                  )}

                  {/* Document icon and info */}
                  <div className={styles.documentIcon}>
                    {getDocumentIcon(doc.mimeType)}
                  </div>

                  <div className={styles.documentInfo}>
                    <div className={styles.documentName}>
                      {doc.originalFilename}
                    </div>
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

                  {/* Action buttons */}
                  <div className={styles.documentActions}>
                    {/* Preview button */}
                    <Tooltip content="Preview document" placement="top">
                      <button
                        type="button"
                        className={styles.previewButton}
                        onClick={() => handlePreview(doc)}
                        disabled={loadingPreview === doc._id}
                        aria-label="Preview document"
                      >
                        {loadingPreview === doc._id ? (
                          <span className={styles.loadingSpinnerSmall}></span>
                        ) : (
                          <FaEye />
                        )}
                      </button>
                    </Tooltip>

                    {/* AI badge - shows if document has AI parsed data */}
                    {hasAiData && (
                      <Tooltip content="View AI-generated summary" placement="top">
                        <button
                          type="button"
                          className={styles.aiBadge}
                          onClick={() => setShowAiSummary(doc._id)}
                          aria-label="View AI summary"
                        >
                          <FaRobot />
                        </button>
                      </Tooltip>
                    )}

                    {/* Visibility toggle - only for document owner and not disabled */}
                    {isOwner && !isDisabled && (
                      <Tooltip
                        content={doc.visibility === 'private'
                          ? 'Private - only you can see this. Click to share with collaborators.'
                          : 'Shared with collaborators. Click to make private.'}
                        placement="top"
                      >
                        <button
                          type="button"
                          className={`${styles.visibilityButton} ${doc.visibility === 'private' ? styles.private : styles.shared}`}
                          onClick={() => handleVisibilityToggle(doc._id, doc.visibility)}
                          aria-label={doc.visibility === 'private' ? 'Make visible to collaborators' : 'Make private'}
                        >
                          {doc.visibility === 'private' ? <FaLock /> : <FaUsers />}
                        </button>
                      </Tooltip>
                    )}

                    {/* Non-owner visibility indicator */}
                    {!isOwner && doc.visibility === 'private' && !isDisabled && (
                      <Tooltip content="Private document" placement="top">
                        <span className={`${styles.visibilityIndicator} ${styles.private}`}>
                          <FaLock />
                        </span>
                      </Tooltip>
                    )}

                    {/* Super admin actions for disabled documents */}
                    {isAdmin && isDisabled && (
                      <>
                        <Tooltip content="Restore document 🔐" placement="top">
                          <button
                            type="button"
                            className={styles.restoreButton}
                            onClick={() => handleRestore(doc._id)}
                            aria-label="Restore document"
                          >
                            <FaUndo />
                          </button>
                        </Tooltip>
                        <Tooltip content="Permanently delete 🔐" placement="top">
                          <button
                            type="button"
                            className={styles.permanentDeleteButton}
                            onClick={() => setPermanentDeleteConfirm(doc._id)}
                            aria-label="Permanently delete document"
                          >
                            <FaSkullCrossbones />
                          </button>
                        </Tooltip>
                      </>
                    )}

                    {/* Delete button - only for document owner and not disabled */}
                    {isOwner && canEdit && !isDisabled && (
                      <Tooltip content="Delete document" placement="top">
                        <button
                          type="button"
                          className={styles.deleteButton}
                          onClick={() => setDeleteConfirm(doc._id)}
                          aria-label="Delete document"
                        >
                          <FaTrash />
                        </button>
                      </Tooltip>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </DropZone>
      ) : (
        <div className={styles.documentsList}>
          {documents.map((doc) => {
            const isOwner = isDocumentOwner(doc);
            const aiSummary = hasAiFeatures ? getAiSummary(doc) : null;
            const hasAiData = !!aiSummary;
            const isDisabled = doc.isDisabled;

            return (
              <div
                key={doc._id}
                className={`${styles.documentCard} ${isDisabled ? styles.disabledDocument : ''}`}
              >
                {/* Disabled indicator */}
                {isDisabled && (
                  <div className={styles.disabledBadge}>
                    <FaBan />
                    <span>Disabled</span>
                  </div>
                )}

                {/* Document icon and info */}
                <div className={styles.documentIcon}>
                  {getDocumentIcon(doc.mimeType)}
                </div>

                <div className={styles.documentInfo}>
                  <div className={styles.documentName}>
                    {doc.originalFilename}
                  </div>
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

                {/* Action buttons */}
                <div className={styles.documentActions}>
                  {/* Preview button */}
                  <Tooltip content="Preview document" placement="top">
                    <button
                      type="button"
                      className={styles.previewButton}
                      onClick={() => handlePreview(doc)}
                      disabled={loadingPreview === doc._id}
                      aria-label="Preview document"
                    >
                      {loadingPreview === doc._id ? (
                        <span className={styles.loadingSpinnerSmall}></span>
                      ) : (
                        <FaEye />
                      )}
                    </button>
                  </Tooltip>

                  {/* AI badge - shows if document has AI parsed data */}
                  {hasAiData && (
                    <Tooltip content="View AI-generated summary" placement="top">
                      <button
                        type="button"
                        className={styles.aiBadge}
                        onClick={() => setShowAiSummary(doc._id)}
                        aria-label="View AI summary"
                      >
                        <FaRobot />
                      </button>
                    </Tooltip>
                  )}

                  {/* Visibility toggle - only for document owner and not disabled */}
                  {isOwner && !isDisabled && (
                    <Tooltip
                      content={doc.visibility === 'private'
                        ? 'Private - only you can see this. Click to share with collaborators.'
                        : 'Shared with collaborators. Click to make private.'}
                      placement="top"
                    >
                      <button
                        type="button"
                        className={`${styles.visibilityButton} ${doc.visibility === 'private' ? styles.private : styles.shared}`}
                        onClick={() => handleVisibilityToggle(doc._id, doc.visibility)}
                        aria-label={doc.visibility === 'private' ? 'Make visible to collaborators' : 'Make private'}
                      >
                        {doc.visibility === 'private' ? <FaLock /> : <FaUsers />}
                      </button>
                    </Tooltip>
                  )}

                  {/* Non-owner visibility indicator */}
                  {!isOwner && doc.visibility === 'private' && !isDisabled && (
                    <Tooltip content="Private document" placement="top">
                      <span className={`${styles.visibilityIndicator} ${styles.private}`}>
                        <FaLock />
                      </span>
                    </Tooltip>
                  )}

                  {/* Super admin actions for disabled documents */}
                  {isAdmin && isDisabled && (
                    <>
                      <Tooltip content="Restore document 🔐" placement="top">
                        <button
                          type="button"
                          className={styles.restoreButton}
                          onClick={() => handleRestore(doc._id)}
                          aria-label="Restore document"
                        >
                          <FaUndo />
                        </button>
                      </Tooltip>
                      <Tooltip content="Permanently delete 🔐" placement="top">
                        <button
                          type="button"
                          className={styles.permanentDeleteButton}
                          onClick={() => setPermanentDeleteConfirm(doc._id)}
                          aria-label="Permanently delete document"
                        >
                          <FaSkullCrossbones />
                        </button>
                      </Tooltip>
                    </>
                  )}

                  {/* Delete button - only for document owner and not disabled */}
                  {isOwner && canEdit && !isDisabled && (
                    <Tooltip content="Delete document" placement="top">
                      <button
                        type="button"
                        className={styles.deleteButton}
                        onClick={() => setDeleteConfirm(doc._id)}
                        aria-label="Delete document"
                      >
                        <FaTrash />
                      </button>
                    </Tooltip>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className={styles.pagination}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page <= 1 || loading}
            aria-label="Previous page"
          >
            <FaChevronLeft />
          </Button>
          <span className={styles.pageInfo}>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages || loading}
            aria-label="Next page"
          >
            <FaChevronRight />
          </Button>
        </div>
      )}

      {/* AI Summary Modal */}
      <Modal
        show={!!showAiSummary}
        onClose={() => setShowAiSummary(null)}
        title="AI Document Summary"
      >
        {showAiSummary && (() => {
          const doc = documents.find(d => d._id === showAiSummary);
          const summary = doc ? getAiSummary(doc) : null;

          if (!summary) {
            return (
              <div className={styles.aiSummaryContent}>
                <p>No AI summary available for this document.</p>
              </div>
            );
          }

          return (
            <div className={styles.aiSummaryContent}>
              {summary.documentType && (
                <div className={styles.aiSummaryType}>
                  <strong>Document Type:</strong> {summary.documentType}
                </div>
              )}

              {summary.summary && (
                <div className={styles.aiSummaryText}>
                  <strong>Summary:</strong>
                  <p>{summary.summary}</p>
                </div>
              )}

              {summary.fields.length > 0 && (
                <div className={styles.aiSummaryFields}>
                  <strong>Extracted Information:</strong>
                  <dl className={styles.aiFieldsList}>
                    {summary.fields.map((field, index) => (
                      <div key={index} className={styles.aiField}>
                        <dt>{field.label}:</dt>
                        <dd>{field.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        show={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Document"
        size="sm"
      >
        <div className={styles.deleteConfirmContent}>
          <p>Are you sure you want to delete this document? The document will be disabled and can be restored by an administrator.</p>
          <div className={styles.deleteConfirmActions}>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => handleDelete(deleteConfirm)}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Permanent Delete Confirmation Modal (Super Admin) */}
      <Modal
        show={!!permanentDeleteConfirm}
        onClose={() => setPermanentDeleteConfirm(null)}
        title="⚠️ Permanently Delete Document"
        size="sm"
      >
        <div className={styles.deleteConfirmContent}>
          <p className={styles.dangerWarning}>
            <strong>Warning:</strong> This will permanently delete the document from S3 storage and the database. This action cannot be undone.
          </p>
          <div className={styles.deleteConfirmActions}>
            <Button variant="outline" onClick={() => setPermanentDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => handlePermanentDelete(permanentDeleteConfirm)}>
              <FaSkullCrossbones className={styles.deleteIcon} />
              Permanently Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Document Preview Modal */}
      <DocumentViewerModal
        show={!!previewDoc}
        onClose={handleClosePreview}
        documentUrl={previewDoc?.previewUrl}
        fileName={previewDoc?.filename || previewDoc?.doc?.originalFilename}
        mimeType={previewDoc?.mimeType || previewDoc?.doc?.mimeType}
        title={previewDoc?.doc?.originalFilename}
      />
    </div>
  );
}

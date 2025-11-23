import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import Modal from '../Modal/Modal';
import { Button } from '../../components/design-system';
import Loading from '../Loading/Loading';
import Alert from '../Alert/Alert';
import {
  loadDocument,
  convertDocumentForViewing,
  cleanupDocumentResources,
  getDocumentIcon,
  formatFileSize,
  isSupportedDocument
} from '../../utilities/document-viewer';
import * as FaIcons from 'react-icons/fa';
import styles from './DocumentViewerModal.module.scss';

// Dynamic import for react-pdf to avoid loading it unnecessarily
let Document = null;
let Page = null;

/**
 * DocumentViewerModal Component
 *
 * Modal component for viewing documents (PDF, DOCX, TXT, etc.) inline.
 * Supports downloading documents and provides a unified viewing experience.
 */
export default function DocumentViewerModal({
  show,
  onClose,
  documentUrl,
  fileName,
  mimeType,
  title,
  onDownload,
  ...modalProps
}) {
  const [document, setDocument] = useState(null);
  const [viewableContent, setViewableContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pdfError, setPdfError] = useState(null);

  // Load document when modal opens or URL changes
  useEffect(() => {
    if (show && documentUrl) {
      loadDocumentContent();
    } else {
      // Clear content when modal closes
      setDocument(null);
      setViewableContent(null);
      setPdfDocument(null);
      setNumPages(null);
      setPageNumber(1);
      setPdfError(null);
      setError(null);
    }
  }, [show, documentUrl, fileName, mimeType]);

  // Cleanup resources when component unmounts or content changes
  useEffect(() => {
    return () => {
      if (viewableContent) {
        cleanupDocumentResources(viewableContent);
      }
    };
  }, [viewableContent]);

  const loadDocumentContent = useCallback(async () => {
    if (!documentUrl) return;

    setLoading(true);
    setError(null);
    setPdfError(null);

    try {
      const doc = await loadDocument(documentUrl, { fileName, mimeType });
      setDocument(doc);

      if (doc.docType === 'PDF') {
        // Load react-pdf components dynamically
        if (!Document || !Page) {
          const pdfModule = await import('react-pdf');
          Document = pdfModule.Document;
          Page = pdfModule.Page;
        }
      }

      const viewable = await convertDocumentForViewing(doc);
      setViewableContent(viewable);
    } catch (err) {
      console.error('Error loading document:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [documentUrl, fileName, mimeType]);

  const onPdfLoadSuccess = useCallback(({ numPages: nextNumPages }) => {
    setNumPages(nextNumPages);
    setPageNumber(1);
  }, []);

  const onPdfLoadError = useCallback((error) => {
    console.error('Error loading PDF:', error);
    setPdfError(error.message);
  }, []);

  const goToPrevPage = useCallback(() => {
    setPageNumber(prevPageNumber => Math.max(1, prevPageNumber - 1));
  }, []);

  const goToNextPage = useCallback(() => {
    setPageNumber(prevPageNumber => Math.min(numPages, prevPageNumber + 1));
  }, [numPages]);

  const handleDownload = useCallback(() => {
    if (onDownload) {
      onDownload();
    } else if (documentUrl) {
      // Default download behavior: open in new tab
      window.open(documentUrl, '_blank');
    }
  }, [onDownload, documentUrl]);

  const renderDocumentContent = () => {
    if (loading) {
      return (
        <div className={styles.documentViewerLoading}>
          <Loading size="lg" />
          <p>Loading document...</p>
        </div>
      );
    }

    if (error) {
      return (
        <Alert type="danger" className={styles.documentViewerError}>
          <strong>Error loading document:</strong> {error}
        </Alert>
      );
    }

    if (!viewableContent) {
      return (
        <div className={styles.documentViewerPlaceholder}>
          <FaIcons.FaFile className={styles.documentIcon} />
          <p>No document to display</p>
        </div>
      );
    }

    const { type, content, url, fileName: docFileName } = viewableContent;

    switch (type) {
      case 'pdf':
        if (!Document || !Page) {
          return (
            <div className={styles.documentViewerLoading}>
              <Loading size="lg" />
              <p>Loading PDF viewer...</p>
            </div>
          );
        }

        return (
          <div className={styles.documentViewerPdf}>
            {pdfError && (
              <Alert type="warning" className={styles.documentViewerPdfError}>
                <strong>PDF Error:</strong> {pdfError}
                <br />
                Falling back to iframe viewer.
              </Alert>
            )}
            <div className={styles.pdfControls}>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={goToPrevPage}
                disabled={pageNumber <= 1}
              >
                <FaIcons.FaChevronLeft />
              </Button>
              <span className={styles.pdfPageInfo}>
                Page {pageNumber} of {numPages || '?'}
              </span>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={goToNextPage}
                disabled={pageNumber >= numPages}
              >
                <FaIcons.FaChevronRight />
              </Button>
            </div>
            <div className={styles.pdfContent}>
              <Document
                file={url}
                onLoadSuccess={onPdfLoadSuccess}
                onLoadError={onPdfLoadError}
                loading={
                  <div className={styles.documentViewerLoading}>
                    <Loading size="lg" />
                    <p>Loading PDF...</p>
                  </div>
                }
                error={
                  <div className={styles.documentViewerError}>
                    <Alert type="danger">
                      <strong>Failed to load PDF:</strong> {pdfError}
                    </Alert>
                  </div>
                }
              >
                <Page
                  pageNumber={pageNumber}
                  scale={1.2}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              </Document>
            </div>
          </div>
        );

      case 'html':
        return (
          <div className={styles.documentViewerHtml}>
            <div
              className={styles.documentContent}
              dangerouslySetInnerHTML={{ __html: content }}
            />
          </div>
        );

      case 'text':
        return (
          <div className={styles.documentViewerText}>
            <pre className={styles.documentTextContent}>{content}</pre>
          </div>
        );

      default:
        return (
          <div className={styles.documentViewerUnsupported}>
            <FaIcons.FaFile className={styles.documentIcon} />
            <p>This document type is not supported for inline viewing.</p>
            <p>Please download the file to view it.</p>
          </div>
        );
    }
  };

  const getModalTitle = () => {
    if (title) return title;
    if (document?.fileName) return document.fileName;
    return 'Document Viewer';
  };

  const getDocumentIconComponent = () => {
    if (!document?.docType) return null;

    const iconName = getDocumentIcon(document.docType);
    const IconComponent = FaIcons[iconName];

    return IconComponent ? <IconComponent className={styles.documentTypeIcon} /> : null;
  };

  const modalFooter = (
    <div className={styles.documentViewerFooter}>
      {document && (
        <div className={styles.documentInfo}>
          {getDocumentIconComponent()}
          <span className={styles.documentDetails}>
            {document.fileName}
            {document.contentLength > 0 && (
              <span className={styles.documentSize}>({formatFileSize(document.contentLength)})</span>
            )}
          </span>
        </div>
      )}
      <div className={styles.documentActions}>
        <Button
          variant="outline-secondary"
          onClick={handleDownload}
          disabled={loading}
        >
          <FaIcons.FaDownload className="me-2" />
          Download
        </Button>
        <Button
          variant="secondary"
          onClick={onClose}
          disabled={loading}
        >
          Close
        </Button>
      </div>
    </div>
  );

  return (
    <Modal
      show={show}
      onClose={onClose}
      title={getModalTitle()}
      size="xl"
      scrollable={false}
      footer={modalFooter}
      dialogClassName={styles.documentViewerModal}
      contentClassName={styles.documentViewerContent}
      bodyClassName={styles.documentViewerBody}
      {...modalProps}
    >
      {renderDocumentContent()}
    </Modal>
  );
}

DocumentViewerModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  documentUrl: PropTypes.string,
  fileName: PropTypes.string,
  mimeType: PropTypes.string,
  title: PropTypes.string,
  onDownload: PropTypes.func
};

DocumentViewerModal.defaultProps = {
  documentUrl: null,
  fileName: null,
  mimeType: null,
  title: null,
  onDownload: null
};
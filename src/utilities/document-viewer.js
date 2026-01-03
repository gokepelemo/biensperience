/**
 * Document Viewer Utility
 *
 * Provides unified interface for viewing different document types (PDF, DOCX, etc.)
 * in web applications. Handles file type detection, content loading, and rendering.
 */

import { sendRequest } from './send-request';
import { logger } from './logger';

// Dynamic imports for document libraries to avoid loading them unnecessarily
let mammoth = null;
let pdfjsLib = null;

/**
 * Load document libraries dynamically
 */
async function loadDocumentLibraries() {
  if (typeof window === 'undefined') return; // Skip on server-side

  try {
    // Load mammoth for DOCX processing
    if (!mammoth) {
      mammoth = (await import('mammoth')).default;
    }

    // Load PDF.js for PDF processing
    if (!pdfjsLib) {
      pdfjsLib = (await import('pdfjs-dist'));
      // Set worker source for PDF.js
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    }
  } catch (error) {
    logger.warn('Failed to load document libraries:', { error: error.message });
  }
}

/**
 * Supported document types and their MIME types
 */
export const DOCUMENT_TYPES = {
  PDF: {
    mimeTypes: ['application/pdf'],
    extensions: ['.pdf'],
    viewer: 'pdf'
  },
  DOCX: {
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    extensions: ['.docx'],
    viewer: 'docx'
  },
  DOC: {
    mimeTypes: ['application/msword'],
    extensions: ['.doc'],
    viewer: 'docx' // Convert to HTML
  },
  TXT: {
    mimeTypes: ['text/plain'],
    extensions: ['.txt'],
    viewer: 'text'
  },
  RTF: {
    mimeTypes: ['application/rtf', 'text/rtf'],
    extensions: ['.rtf'],
    viewer: 'text'
  }
};

/**
 * Detect document type from file name or MIME type
 * @param {string} fileName - File name with extension
 * @param {string} mimeType - MIME type (optional)
 * @returns {string|null} Document type key or null if unsupported
 */
export function detectDocumentType(fileName, mimeType = null) {
  if (!fileName) return null;

  const extension = fileName.toLowerCase().split('.').pop();

  // First try MIME type matching
  if (mimeType) {
    for (const [type, config] of Object.entries(DOCUMENT_TYPES)) {
      if (config.mimeTypes.includes(mimeType)) {
        return type;
      }
    }
  }

  // Then try extension matching
  for (const [type, config] of Object.entries(DOCUMENT_TYPES)) {
    if (config.extensions.includes(`.${extension}`)) {
      return type;
    }
  }

  return null;
}

/**
 * Check if a file is a supported document type
 * @param {string} fileName - File name with extension
 * @param {string} mimeType - MIME type (optional)
 * @returns {boolean} True if supported
 */
export function isSupportedDocument(fileName, mimeType = null) {
  return detectDocumentType(fileName, mimeType) !== null;
}

/**
 * Get viewer type for a document
 * @param {string} fileName - File name with extension
 * @param {string} mimeType - MIME type (optional)
 * @returns {string|null} Viewer type or null if unsupported
 */
export function getViewerType(fileName, mimeType = null) {
  const docType = detectDocumentType(fileName, mimeType);
  return docType ? DOCUMENT_TYPES[docType].viewer : null;
}

/**
 * Load document content from URL
 * @param {string} url - Document URL
 * @param {Object} options - Loading options
 * @returns {Promise<Object>} Document content and metadata
 */
export async function loadDocument(url, options = {}) {
  if (!url) {
    throw new Error('Document URL is required');
  }

  try {
    // For now, we'll assume documents are accessible via direct URLs
    // In a real implementation, you might need to proxy through your API
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to load document: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');

    // Get filename from URL or headers
    let fileName = options.fileName;
    if (!fileName) {
      const contentDisposition = response.headers.get('content-disposition');
      if (contentDisposition) {
        const matches = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (matches && matches[1]) {
          fileName = matches[1].replace(/['"]/g, '');
        }
      }
      // Fallback to URL basename
      if (!fileName) {
        fileName = url.split('/').pop().split('?')[0];
      }
    }

    const docType = detectDocumentType(fileName, contentType);

    if (!docType) {
      throw new Error(`Unsupported document type: ${fileName} (${contentType})`);
    }

    return {
      url,
      fileName,
      contentType,
      contentLength: parseInt(contentLength) || 0,
      docType,
      viewerType: DOCUMENT_TYPES[docType].viewer,
      blob: await response.blob()
    };

  } catch (error) {
    logger.error('Error loading document:', { error: error.message }, error);
    throw new Error(`Failed to load document: ${error.message}`);
  }
}

/**
 * Convert document to viewable format
 * @param {Object} document - Document object from loadDocument
 * @returns {Promise<Object>} Viewable content
 */
export async function convertDocumentForViewing(document) {
  const { docType, blob, fileName, url } = document;

  // Load libraries if needed
  await loadDocumentLibraries();

  switch (docType) {
    case 'PDF':
      // PDFs are viewed via PDF.js/react-pdf.
      // Important: use a blob URL derived from the already-fetched response.
      // This prevents a second network fetch (which can fail due to CORS, signed URL quirks,
      // or misconfigured relative URLs) and keeps viewing reliable.
      return {
        type: 'pdf',
        url: URL.createObjectURL(blob),
        fileName
      };

    case 'DOCX':
    case 'DOC':
      // Convert DOCX/DOC to HTML using mammoth
      try {
        if (!mammoth) {
          throw new Error('Mammoth library not available');
        }

        const arrayBuffer = await blob.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });

        return {
          type: 'html',
          content: result.value,
          messages: result.messages,
          fileName
        };
      } catch (error) {
        logger.error('Error converting DOCX:', { error: error.message }, error);
        return {
          type: 'html',
          content: `
            <div class="document-error">
              <h3>Unable to convert document</h3>
              <p>The document could not be converted for viewing. This might be due to:</p>
              <ul>
                <li>Unsupported document format or version</li>
                <li>Complex document structure</li>
                <li>Missing document libraries</li>
              </ul>
              <p>Please try downloading the file to view it in an external application.</p>
            </div>
          `,
          fileName
        };
      }

    case 'TXT':
    case 'RTF':
      // Text files can be displayed as plain text
      try {
        const text = await blob.text();
        return {
          type: 'text',
          content: text,
          fileName
        };
      } catch (error) {
        logger.error('Error reading text document:', { error: error.message }, error);
        return {
          type: 'html',
          content: '<div class="document-error"><p>Unable to read text document.</p></div>',
          fileName
        };
      }

    default:
      return {
        type: 'html',
        content: `
          <div class="document-placeholder">
            <h3>Document type not supported</h3>
            <p>This document type (${docType}) is not supported for inline viewing.</p>
            <p>Supported formats: PDF, DOCX, DOC, TXT, RTF</p>
            <p>Please download the file to view it in an external application.</p>
          </div>
        `,
        fileName
      };
  }
}

/**
 * Clean up document resources (revoke object URLs)
 * @param {Object} viewableDocument - Document object from convertDocumentForViewing
 */
export function cleanupDocumentResources(viewableDocument) {
  if (viewableDocument && viewableDocument.url && viewableDocument.url.startsWith('blob:')) {
    URL.revokeObjectURL(viewableDocument.url);
  }
}

/**
 * Get document icon based on type
 * @param {string} docType - Document type key
 * @returns {string} Icon name from react-icons
 */
export function getDocumentIcon(docType) {
  switch (docType) {
    case 'PDF':
      return 'FaFilePdf';
    case 'DOCX':
    case 'DOC':
      return 'FaFileWord';
    case 'TXT':
    case 'RTF':
      return 'FaFileAlt';
    default:
      return 'FaFile';
  }
}

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted size string
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
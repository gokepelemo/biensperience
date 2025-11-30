/**
 * AI Document Utilities
 * Provides document upload, text extraction, and AI-powered parsing for plan items
 *
 * Supports: PDF, images, Word documents, and plain text
 * Uses: AWS Textract for OCR, Anthropic Claude for intelligent extraction
 */

require('dotenv').config();

const path = require('path');
const fs = require('fs');
const { s3Upload, s3Delete } = require('../uploads/aws-s3-upload');
const backendLogger = require('./backend-logger');

// Supported document types and their MIME types
const SUPPORTED_DOCUMENT_TYPES = {
  // PDF documents
  pdf: ['application/pdf'],
  // Images (for OCR)
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/tiff'],
  // Word documents
  word: [
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ],
  // Plain text
  text: ['text/plain', 'text/csv', 'text/markdown']
};

// Flatten for quick lookup
const ALL_SUPPORTED_MIMES = Object.values(SUPPORTED_DOCUMENT_TYPES).flat();

// Allowed base directories for file operations (security)
const ALLOWED_BASE_DIRS = [
  path.resolve(process.cwd(), 'uploads'),
  path.resolve(process.cwd(), 'tmp'),
  '/tmp'
];

/**
 * Sanitize and validate file path to prevent path traversal attacks
 * @param {string} filePath - The file path to validate
 * @returns {string} The validated absolute path
 * @throws {Error} If path is invalid or outside allowed directories
 */
function sanitizePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid file path: path must be a non-empty string');
  }

  // Resolve to absolute path
  const absolutePath = path.resolve(filePath);

  // Check for path traversal attempts
  if (filePath.includes('..') || filePath.includes('\0')) {
    throw new Error('Invalid file path: path traversal not allowed');
  }

  // Verify path is within allowed directories
  const isAllowed = ALLOWED_BASE_DIRS.some(baseDir => {
    const resolvedBase = path.resolve(baseDir);
    return absolutePath.startsWith(resolvedBase + path.sep) || absolutePath === resolvedBase;
  });

  if (!isAllowed) {
    backendLogger.warn('Path traversal attempt blocked', {
      requestedPath: filePath,
      resolvedPath: absolutePath,
      allowedDirs: ALLOWED_BASE_DIRS
    });
    throw new Error('Invalid file path: access to this location is not allowed');
  }

  return absolutePath;
}

// Maximum file sizes (in bytes)
const MAX_FILE_SIZES = {
  pdf: 50 * 1024 * 1024, // 50MB
  image: 10 * 1024 * 1024, // 10MB
  word: 25 * 1024 * 1024, // 25MB
  text: 5 * 1024 * 1024 // 5MB
};

// OCR confidence thresholds for routing decisions
const OCR_CONFIG = {
  // Minimum confidence (0-100) to trust OCR results
  // Below this, we fall back to LLM vision
  confidenceThreshold: 70,

  // Minimum text length to consider OCR successful
  // Very short results often indicate failed extraction
  minimumTextLength: 20,

  // Maximum image size for LLM vision (5MB for Claude)
  maxVisionImageSize: 5 * 1024 * 1024
};

/**
 * Validate document type and size
 * @param {Object} file - File object with mimetype and size
 * @returns {Object} { valid: boolean, error?: string, type?: string }
 */
function validateDocument(file) {
  if (!file || !file.mimetype) {
    return { valid: false, error: 'No file provided' };
  }

  const mimeType = file.mimetype.toLowerCase();

  if (!ALL_SUPPORTED_MIMES.includes(mimeType)) {
    return {
      valid: false,
      error: `Unsupported file type: ${mimeType}. Supported: PDF, images, Word documents, text files.`
    };
  }

  // Determine document type
  let docType = null;
  for (const [type, mimes] of Object.entries(SUPPORTED_DOCUMENT_TYPES)) {
    if (mimes.includes(mimeType)) {
      docType = type;
      break;
    }
  }

  // Check file size
  const maxSize = MAX_FILE_SIZES[docType] || MAX_FILE_SIZES.text;
  if (file.size > maxSize) {
    const maxSizeMB = Math.round(maxSize / (1024 * 1024));
    return {
      valid: false,
      error: `File too large. Maximum size for ${docType} files is ${maxSizeMB}MB.`
    };
  }

  return { valid: true, type: docType };
}

/**
 * Extract text from a document using appropriate method
 * @param {string} filePath - Path to the uploaded file
 * @param {string} mimeType - MIME type of the file
 * @param {Object} options - Extraction options
 * @returns {Promise<Object>} { text: string, metadata: Object }
 */
async function extractText(filePath, mimeType, options = {}) {
  const mimeTypeLower = mimeType.toLowerCase();

  // Plain text - read directly
  if (SUPPORTED_DOCUMENT_TYPES.text.includes(mimeTypeLower)) {
    return extractPlainText(filePath);
  }

  // PDF - use pdf-parse or external service
  if (SUPPORTED_DOCUMENT_TYPES.pdf.includes(mimeTypeLower)) {
    return extractPdfText(filePath, options);
  }

  // Images - use OCR
  if (SUPPORTED_DOCUMENT_TYPES.image.includes(mimeTypeLower)) {
    return extractImageText(filePath, options);
  }

  // Word documents - use mammoth
  if (SUPPORTED_DOCUMENT_TYPES.word.includes(mimeTypeLower)) {
    return extractWordText(filePath, options);
  }

  throw new Error(`Unsupported file type for text extraction: ${mimeType}`);
}

/**
 * Extract text from plain text file
 * @param {string} filePath - Path to the text file
 * @returns {Promise<Object>} { text: string, metadata: Object }
 */
async function extractPlainText(filePath) {
  try {
    const safePath = sanitizePath(filePath);
    const content = await fs.promises.readFile(safePath, 'utf-8');
    return {
      text: content,
      metadata: {
        method: 'direct-read',
        characterCount: content.length,
        lineCount: content.split('\n').length
      }
    };
  } catch (error) {
    backendLogger.error('Plain text extraction failed', { error: error.message, filePath });
    throw new Error(`Failed to read text file: ${error.message}`);
  }
}

/**
 * Extract text from PDF using pdf-parse
 * Falls back to placeholder if library not available
 * @param {string} filePath - Path to the PDF file
 * @param {Object} options - Extraction options
 * @returns {Promise<Object>} { text: string, metadata: Object }
 */
async function extractPdfText(filePath, options = {}) {
  try {
    const safePath = sanitizePath(filePath);

    // Try to use pdf-parse if available
    let pdfParse;
    try {
      pdfParse = require('pdf-parse');
    } catch (e) {
      backendLogger.warn('pdf-parse not installed. Install with: npm install pdf-parse');
      return {
        text: '[PDF text extraction requires pdf-parse. Install with: npm install pdf-parse]',
        metadata: {
          method: 'placeholder',
          error: 'pdf-parse not installed'
        }
      };
    }

    const dataBuffer = await fs.promises.readFile(safePath);
    const data = await pdfParse(dataBuffer);

    return {
      text: data.text,
      metadata: {
        method: 'pdf-parse',
        pages: data.numpages,
        characterCount: data.text.length,
        info: data.info
      }
    };
  } catch (error) {
    backendLogger.error('PDF text extraction failed', { error: error.message, filePath });
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

/**
 * Extract text from image using OCR with confidence-based LLM fallback
 *
 * Strategy:
 * 1. Try Tesseract.js OCR first (fast, free, local)
 * 2. Check confidence score and text length
 * 3. If below threshold, fall back to Claude Vision API
 *
 * @param {string} filePath - Path to the image file
 * @param {Object} options - OCR options
 * @param {string} options.language - OCR language (default: 'eng')
 * @param {boolean} options.forceLLM - Skip OCR and use LLM directly
 * @param {boolean} options.skipLLMFallback - Don't fall back to LLM on low confidence
 * @returns {Promise<Object>} { text: string, metadata: Object }
 */
async function extractImageText(filePath, options = {}) {
  const { forceLLM = false, skipLLMFallback = false } = options;

  // Option to force LLM vision (skip OCR entirely)
  if (forceLLM) {
    backendLogger.info('[extractImageText] Forced LLM mode, skipping OCR');
    return extractImageTextWithLLM(filePath, options);
  }

  // Try Tesseract OCR first
  const ocrResult = await tryTesseractOCR(filePath, options);

  // If OCR failed completely, try LLM fallback
  if (!ocrResult.success) {
    if (skipLLMFallback) {
      return {
        text: ocrResult.text || '',
        metadata: {
          method: 'tesseract-ocr-failed',
          error: ocrResult.error,
          confidence: 0
        }
      };
    }

    backendLogger.info('[extractImageText] OCR failed, falling back to LLM vision', {
      error: ocrResult.error
    });
    return extractImageTextWithLLM(filePath, options);
  }

  // Check if OCR confidence is sufficient
  const confidence = ocrResult.confidence || 0;
  const textLength = (ocrResult.text || '').trim().length;

  const isConfidenceLow = confidence < OCR_CONFIG.confidenceThreshold;
  const isTextTooShort = textLength < OCR_CONFIG.minimumTextLength;

  if ((isConfidenceLow || isTextTooShort) && !skipLLMFallback) {
    backendLogger.info('[extractImageText] Low OCR confidence, falling back to LLM vision', {
      confidence,
      textLength,
      threshold: OCR_CONFIG.confidenceThreshold,
      minLength: OCR_CONFIG.minimumTextLength
    });

    // Try LLM vision for better results
    const llmResult = await extractImageTextWithLLM(filePath, options);

    // If LLM got more text or has structured data, prefer it
    if (llmResult.text.trim().length > textLength) {
      return llmResult;
    }

    // Otherwise return OCR result with low confidence warning
    return {
      text: ocrResult.text,
      metadata: {
        method: 'tesseract-ocr',
        confidence,
        language: options.language || 'eng',
        characterCount: textLength,
        warning: 'Low confidence OCR result, LLM fallback did not improve'
      }
    };
  }

  // Good OCR result
  return {
    text: ocrResult.text,
    metadata: {
      method: 'tesseract-ocr',
      confidence,
      language: options.language || 'eng',
      characterCount: textLength
    }
  };
}

/**
 * Try Tesseract.js OCR
 * @param {string} filePath - Path to the image file
 * @param {Object} options - OCR options
 * @returns {Promise<Object>} { success: boolean, text?: string, confidence?: number, error?: string }
 */
async function tryTesseractOCR(filePath, options = {}) {
  try {
    let Tesseract;
    try {
      Tesseract = require('tesseract.js');
    } catch (e) {
      backendLogger.warn('tesseract.js not installed. Install with: npm install tesseract.js');
      return {
        success: false,
        error: 'tesseract.js not installed'
      };
    }

    const language = options.language || 'eng';
    const result = await Tesseract.recognize(filePath, language, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          backendLogger.debug('OCR progress', { progress: m.progress });
        }
      }
    });

    return {
      success: true,
      text: result.data.text,
      confidence: result.data.confidence
    };
  } catch (error) {
    backendLogger.error('Tesseract OCR failed', { error: error.message, filePath });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Extract text from image using Claude Vision API
 * Sends the image directly to Claude for visual text extraction
 *
 * @param {string} filePath - Path to the image file
 * @param {Object} options - Extraction options
 * @returns {Promise<Object>} { text: string, metadata: Object }
 */
async function extractImageTextWithLLM(filePath, options = {}) {
  try {
    const safePath = sanitizePath(filePath);
    const Anthropic = require('@anthropic-ai/sdk');

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      backendLogger.warn('ANTHROPIC_API_KEY not set. LLM vision extraction unavailable.');
      return {
        text: '',
        metadata: {
          method: 'llm-vision-unavailable',
          error: 'ANTHROPIC_API_KEY not configured'
        }
      };
    }

    // Read image and convert to base64
    const imageBuffer = await fs.promises.readFile(safePath);

    // Check file size limit for Claude Vision
    if (imageBuffer.length > OCR_CONFIG.maxVisionImageSize) {
      backendLogger.warn('Image too large for LLM vision', {
        size: imageBuffer.length,
        maxSize: OCR_CONFIG.maxVisionImageSize
      });
      return {
        text: '',
        metadata: {
          method: 'llm-vision-skipped',
          error: `Image exceeds ${OCR_CONFIG.maxVisionImageSize / (1024 * 1024)}MB limit for vision API`
        }
      };
    }

    const base64Image = imageBuffer.toString('base64');

    // Determine media type from file extension
    const ext = path.extname(filePath).toLowerCase();
    const mediaTypeMap = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };
    const mediaType = mediaTypeMap[ext] || 'image/jpeg';

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: options.model || 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Image
              }
            },
            {
              type: 'text',
              text: `Extract ALL text visible in this image. Include:
- All printed text, labels, and headings
- Numbers, dates, times, prices, and codes
- Names, addresses, and contact information
- Any handwritten text if legible

Format the extracted text preserving the logical structure (e.g., keep related items together).
If this appears to be a travel document (ticket, booking, receipt), also identify:
- Document type
- Key details (dates, times, locations, confirmation numbers)

Return the text content followed by any structured observations.`
            }
          ]
        }
      ]
    });

    const extractedText = response.content[0]?.text || '';

    backendLogger.info('[extractImageTextWithLLM] LLM vision extraction complete', {
      textLength: extractedText.length,
      model: response.model,
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens
    });

    return {
      text: extractedText,
      metadata: {
        method: 'llm-vision',
        model: response.model,
        characterCount: extractedText.length,
        usage: response.usage
      }
    };
  } catch (error) {
    backendLogger.error('LLM vision extraction failed', { error: error.message, filePath });
    return {
      text: '',
      metadata: {
        method: 'llm-vision-failed',
        error: error.message
      }
    };
  }
}

/**
 * Extract text from Word document using mammoth
 * @param {string} filePath - Path to the Word file
 * @param {Object} options - Extraction options
 * @returns {Promise<Object>} { text: string, metadata: Object }
 */
async function extractWordText(filePath, options = {}) {
  try {
    let mammoth;
    try {
      mammoth = require('mammoth');
    } catch (e) {
      backendLogger.warn('mammoth not installed. Install with: npm install mammoth');
      return {
        text: '[Word document extraction requires mammoth. Install with: npm install mammoth]',
        metadata: {
          method: 'placeholder',
          error: 'mammoth not installed'
        }
      };
    }

    const result = await mammoth.extractRawText({ path: filePath });

    return {
      text: result.value,
      metadata: {
        method: 'mammoth',
        warnings: result.messages,
        characterCount: result.value.length
      }
    };
  } catch (error) {
    backendLogger.error('Word document extraction failed', { error: error.message, filePath });
    throw new Error(`Failed to extract text from Word document: ${error.message}`);
  }
}

/**
 * Parse extracted text using AI to identify structured data
 * Uses Claude API for intelligent extraction of travel-related information
 * @param {string} text - Extracted text content
 * @param {string} documentType - Type of document (flight, hotel, activity, etc.)
 * @param {Object} options - Parsing options
 * @returns {Promise<Object>} Structured data extracted from text
 */
async function parseWithAI(text, documentType = 'travel', options = {}) {
  const Anthropic = require('@anthropic-ai/sdk');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    backendLogger.warn('ANTHROPIC_API_KEY not set. AI parsing unavailable.');
    return {
      parsed: false,
      error: 'AI parsing not configured',
      rawText: text
    };
  }

  const client = new Anthropic({ apiKey });

  // Build prompt based on document type
  const prompts = {
    flight: `Extract flight details from this document. Return JSON with: airline, flightNumber, departureCity, arrivalCity, departureDate, departureTime, arrivalDate, arrivalTime, confirmationNumber, passengerName, seatNumber, terminal, gate. If a field is not found, use null.`,

    hotel: `Extract hotel booking details from this document. Return JSON with: hotelName, address, checkInDate, checkInTime, checkOutDate, checkOutTime, confirmationNumber, roomType, guestName, nights, totalCost. If a field is not found, use null.`,

    activity: `Extract activity/tour booking details from this document. Return JSON with: activityName, provider, date, time, duration, location, confirmationNumber, participantNames, totalCost, meetingPoint, instructions. If a field is not found, use null.`,

    restaurant: `Extract restaurant reservation details from this document. Return JSON with: restaurantName, address, date, time, partySize, confirmationNumber, specialRequests. If a field is not found, use null.`,

    transport: `Extract transportation booking details from this document. Return JSON with: type (car, train, bus, ferry), provider, pickupLocation, dropoffLocation, pickupDate, pickupTime, returnDate, returnTime, confirmationNumber, vehicleType, totalCost. If a field is not found, use null.`,

    travel: `This is a travel-related document. Analyze the content and extract any relevant travel information. Return JSON with: documentType (flight, hotel, activity, restaurant, transport, or other), summary (brief description), and any extracted details structured appropriately. If a field is not found, use null.`
  };

  const prompt = prompts[documentType] || prompts.travel;

  try {
    const response = await client.messages.create({
      model: options.model || 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `${prompt}\n\nDocument text:\n\`\`\`\n${text.substring(0, 10000)}\n\`\`\``
        }
      ]
    });

    // Extract JSON from response
    const content = response.content[0]?.text || '';
    let parsed = null;

    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (e) {
        backendLogger.warn('Failed to parse AI response as JSON', { content });
      }
    }

    return {
      parsed: !!parsed,
      data: parsed,
      rawText: text,
      aiResponse: content,
      model: response.model,
      usage: response.usage
    };
  } catch (error) {
    backendLogger.error('AI parsing failed', { error: error.message, documentType });
    return {
      parsed: false,
      error: error.message,
      rawText: text
    };
  }
}

/**
 * Upload document and extract text with AI parsing
 * Complete workflow for document processing
 * @param {Object} file - Uploaded file object (from multer)
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} { url, text, parsed, metadata }
 */
async function processDocument(file, options = {}) {
  const {
    extractTextEnabled = true,
    aiParseEnabled = true,
    documentType = 'travel',
    deleteLocalFile = true,
    uploadToS3 = true,
    s3Prefix = 'documents'
  } = options;

  // Validate document
  const validation = validateDocument(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  let s3Url = null;
  let extractedText = null;
  let aiParsed = null;

  try {
    // Upload to S3 if enabled
    if (uploadToS3) {
      const timestamp = Date.now();
      const sanitizedName = path.basename(file.originalname).replace(/[^a-zA-Z0-9.-]/g, '_');
      const s3Key = `${s3Prefix}/${timestamp}-${sanitizedName}`;

      const uploadResult = await s3Upload(file.path, file.originalname, s3Key);
      s3Url = uploadResult.Location;

      backendLogger.info('Document uploaded to S3', { url: s3Url, type: validation.type });
    }

    // Extract text if enabled
    if (extractTextEnabled) {
      extractedText = await extractText(file.path, file.mimetype, options);
      backendLogger.debug('Text extracted', {
        method: extractedText.metadata.method,
        length: extractedText.text.length
      });
    }

    // Parse with AI if enabled and text was extracted
    if (aiParseEnabled && extractedText && extractedText.text) {
      aiParsed = await parseWithAI(extractedText.text, documentType, options);
      backendLogger.debug('AI parsing complete', { parsed: aiParsed.parsed });
    }

    return {
      success: true,
      url: s3Url,
      documentType: validation.type,
      text: extractedText?.text || null,
      textMetadata: extractedText?.metadata || null,
      aiParsed: aiParsed?.data || null,
      aiResponse: aiParsed?.aiResponse || null,
      aiModel: aiParsed?.model || null
    };
  } finally {
    // Clean up local file if requested
    if (deleteLocalFile && file.path) {
      try {
        await fs.promises.unlink(file.path);
        backendLogger.debug('Local file cleaned up', { path: file.path });
      } catch (e) {
        backendLogger.warn('Failed to delete local file', { path: file.path, error: e.message });
      }
    }
  }
}

/**
 * Delete a document from S3 and optionally from plan item
 * @param {string} documentUrl - S3 URL of the document
 * @returns {Promise<void>}
 */
async function deleteDocument(documentUrl) {
  if (!documentUrl) {
    throw new Error('Document URL is required');
  }

  await s3Delete(documentUrl);
  backendLogger.info('Document deleted from S3', { url: documentUrl });
}

/**
 * Get supported document types and their max sizes
 * Useful for frontend validation
 * @returns {Object} Supported types configuration
 */
function getSupportedTypes() {
  return {
    types: SUPPORTED_DOCUMENT_TYPES,
    mimeTypes: ALL_SUPPORTED_MIMES,
    maxSizes: MAX_FILE_SIZES,
    accept: ALL_SUPPORTED_MIMES.join(',')
  };
}

/**
 * Process a Document model instance
 * Downloads from S3 if needed, extracts text, parses with AI, updates model
 *
 * @param {Object} document - Document mongoose model instance
 * @param {Object} options - Processing options
 * @param {string} options.tempDir - Temporary directory for processing
 * @returns {Promise<Object>} Updated document
 */
async function processDocumentModel(document, options = {}) {
  const {
    tempDir = path.join(__dirname, '../uploads/temp'),
    downloadFromS3Fn = null // Optional custom S3 download function
  } = options;

  // Ensure temp directory exists
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  let localFilePath = null;

  try {
    // Mark as processing
    await document.markProcessing();

    // Download from S3
    const timestamp = Date.now();
    const sanitizedName = path.basename(document.originalFilename).replace(/[^a-zA-Z0-9.-]/g, '_');
    localFilePath = path.join(tempDir, `${timestamp}-${sanitizedName}`);

    if (downloadFromS3Fn) {
      await downloadFromS3Fn(document.s3Url, localFilePath);
    } else {
      // Default download using https/http
      await downloadFile(document.s3Url, localFilePath);
    }

    backendLogger.debug('[processDocumentModel] Downloaded from S3', {
      documentId: document._id,
      localPath: localFilePath
    });

    // Extract text using document's processing options
    const extractionResult = await extractText(localFilePath, document.mimeType, {
      language: document.processingOptions?.language || 'eng',
      forceLLM: document.processingOptions?.forceLLM || false,
      skipLLMFallback: document.processingOptions?.skipLLMFallback || false
    });

    const extractedText = extractionResult.text || '';
    const processingResult = {
      method: extractionResult.metadata.method,
      confidence: extractionResult.metadata.confidence,
      characterCount: extractionResult.metadata.characterCount || extractedText.length,
      pageCount: extractionResult.metadata.pages,
      language: extractionResult.metadata.language,
      model: extractionResult.metadata.model,
      usage: extractionResult.metadata.usage,
      processedAt: new Date(),
      warning: extractionResult.metadata.warning
    };

    // Parse with AI if enabled and text was extracted
    let aiParsedData = null;
    if (document.aiParsingEnabled && extractedText.length > 0) {
      try {
        const documentTypeHint = document.processingOptions?.documentTypeHint || 'travel';
        const parseResult = await parseWithAI(extractedText, documentTypeHint);

        if (parseResult.parsed && parseResult.data) {
          aiParsedData = {
            ...parseResult.data,
            rawAiResponse: parseResult.aiResponse
          };
          processingResult.model = parseResult.model;
        }
      } catch (parseError) {
        backendLogger.warn('[processDocumentModel] AI parsing failed', {
          error: parseError.message,
          documentId: document._id
        });
        // Continue without AI parsing - it's not critical
      }
    }

    // Update document with results
    await document.markCompleted(extractedText, processingResult, aiParsedData);

    backendLogger.info('[processDocumentModel] Processing complete', {
      documentId: document._id,
      textLength: extractedText.length,
      method: processingResult.method
    });

    return document;

  } catch (error) {
    backendLogger.error('[processDocumentModel] Processing failed', {
      error: error.message,
      documentId: document._id
    });

    await document.markFailed(error);
    throw error;

  } finally {
    // Cleanup local file
    if (localFilePath && fs.existsSync(localFilePath)) {
      try {
        await fs.promises.unlink(localFilePath);
      } catch (e) {
        backendLogger.warn('[processDocumentModel] Failed to cleanup local file', {
          error: e.message,
          path: localFilePath
        });
      }
    }
  }
}

/**
 * Download a file from URL to local path
 * @param {string} url - URL to download from
 * @param {string} localPath - Local path to save to
 * @returns {Promise<void>}
 */
function downloadFile(url, localPath) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const http = require('http');

    const file = fs.createWriteStream(localPath);
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(localPath, () => {}); // Cleanup
        reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      file.close();
      fs.unlink(localPath, () => {}); // Cleanup
      reject(err);
    });
  });
}

/**
 * Process pending documents in batch
 * Finds documents with status 'pending' or 'failed' and processes them
 *
 * @param {Object} options - Processing options
 * @param {number} options.limit - Maximum documents to process (default: 10)
 * @param {string} options.tempDir - Temporary directory for processing
 * @returns {Promise<Object>} { processed: number, failed: number, errors: Array }
 */
async function processPendingDocuments(options = {}) {
  const { limit = 10, tempDir } = options;

  // Import Document model here to avoid circular dependency
  const Document = require('../models/document');

  const pendingDocs = await Document.findPendingDocuments(limit);

  backendLogger.info('[processPendingDocuments] Found pending documents', {
    count: pendingDocs.length,
    limit
  });

  const results = {
    processed: 0,
    failed: 0,
    errors: []
  };

  for (const doc of pendingDocs) {
    try {
      await processDocumentModel(doc, { tempDir });
      results.processed++;
    } catch (error) {
      results.failed++;
      results.errors.push({
        documentId: doc._id.toString(),
        error: error.message
      });
    }
  }

  backendLogger.info('[processPendingDocuments] Batch processing complete', results);

  return results;
}

module.exports = {
  validateDocument,
  extractText,
  extractImageTextWithLLM,
  parseWithAI,
  processDocument,
  processDocumentModel,
  processPendingDocuments,
  downloadFile,
  deleteDocument,
  getSupportedTypes,
  SUPPORTED_DOCUMENT_TYPES,
  MAX_FILE_SIZES,
  OCR_CONFIG
};

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * Permission sub-schema for document access control
 * Supports role-based access (owner, collaborator, contributor)
 */
const permissionSchema = new Schema({
  _id: {
    type: Schema.Types.ObjectId,
    required: true
  },
  entity: {
    type: String,
    required: true,
    enum: ['user', 'plan', 'experience']
  },
  type: {
    type: String,
    enum: ['owner', 'collaborator', 'contributor']
  },
  granted_at: {
    type: Date,
    default: Date.now
  },
  granted_by: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, { _id: false });

/**
 * Processing result schema for storing extraction metadata
 */
const processingResultSchema = new Schema({
  method: {
    type: String,
    enum: ['tesseract-ocr', 'llm-vision', 'pdf-parse', 'mammoth', 'direct-read', 'placeholder', 'failed'],
    required: true
  },
  confidence: {
    type: Number,
    min: 0,
    max: 100
  },
  characterCount: Number,
  pageCount: Number,
  language: String,
  model: String, // AI model used (e.g., 'claude-sonnet-4-20250514')
  usage: {
    input_tokens: Number,
    output_tokens: Number
  },
  processedAt: {
    type: Date,
    default: Date.now
  },
  error: String,
  warning: String
}, { _id: false });

/**
 * AI-parsed data schema for structured extraction results
 */
const aiParsedDataSchema = new Schema({
  documentType: {
    type: String,
    enum: ['flight', 'hotel', 'activity', 'restaurant', 'transport', 'receipt', 'itinerary', 'other']
  },
  summary: String,
  // Flight-specific fields
  airline: String,
  flightNumber: String,
  departureCity: String,
  arrivalCity: String,
  departureDate: Date,
  departureTime: String,
  arrivalDate: Date,
  arrivalTime: String,
  terminal: String,
  gate: String,
  seatNumber: String,
  // Hotel-specific fields
  hotelName: String,
  checkInDate: Date,
  checkInTime: String,
  checkOutDate: Date,
  checkOutTime: String,
  roomType: String,
  nights: Number,
  // Common fields
  confirmationNumber: String,
  address: String,
  location: String,
  totalCost: Number,
  currency: String,
  participantNames: [String],
  guestName: String,
  passengerName: String,
  // Activity/tour fields
  activityName: String,
  provider: String,
  duration: String,
  meetingPoint: String,
  instructions: String,
  // Transport fields
  transportType: String,
  pickupLocation: String,
  dropoffLocation: String,
  pickupDate: Date,
  pickupTime: String,
  returnDate: Date,
  returnTime: String,
  vehicleType: String,
  // Restaurant fields
  restaurantName: String,
  partySize: Number,
  specialRequests: String,
  // Raw AI response for debugging/reprocessing
  rawAiResponse: String
}, { _id: false });

/**
 * Document schema
 * Stores uploaded documents with S3 references and extracted/parsed content
 */
const documentSchema = new Schema(
  {
    // Owner of the document
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    // Entity the document is attached to
    entityType: {
      type: String,
      enum: ['plan', 'plan_item', 'experience', 'destination'],
      required: true
    },
    entityId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true
    },
    // Optional plan item reference (when entityType is 'plan_item')
    planId: {
      type: Schema.Types.ObjectId,
      ref: "Plan"
    },
    planItemId: {
      type: Schema.Types.ObjectId
    },

    // File information
    originalFilename: {
      type: String,
      required: true
    },
    mimeType: {
      type: String,
      required: true
    },
    fileSize: {
      type: Number,
      required: true
    },
    documentType: {
      type: String,
      enum: ['pdf', 'image', 'word', 'text'],
      required: true
    },

    // S3 storage information
    s3Key: {
      type: String,
      required: true,
      unique: true
    },
    s3Url: {
      type: String,
      required: true
    },
    s3Bucket: {
      type: String,
      required: true
    },
    // Whether document is stored in protected (private) bucket
    // Protected documents require signed URLs for access
    isProtected: {
      type: Boolean,
      default: false,
      index: true
    },
    // Bucket type for easier querying and routing
    bucketType: {
      type: String,
      enum: ['public', 'protected'],
      default: 'public'
    },

    // Processing status
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'reprocessing'],
      default: 'pending',
      index: true
    },

    // Extracted content
    extractedText: {
      type: String,
      default: ''
    },
    processingResult: {
      type: processingResultSchema
    },

    // AI-parsed structured data
    aiParsedData: {
      type: aiParsedDataSchema
    },
    aiParsingEnabled: {
      type: Boolean,
      default: true
    },

    // Permissions for collaborative access
    permissions: {
      type: [permissionSchema],
      default: []
    },

    // Processing options (for reprocessing)
    processingOptions: {
      language: { type: String, default: 'eng' },
      forceLLM: { type: Boolean, default: false },
      skipLLMFallback: { type: Boolean, default: false },
      documentTypeHint: { type: String }
    },

    // Custom metadata array for flexible key-value storage
    // Allows users to add any custom metadata to documents
    metadata: {
      type: [new Schema({
        key: {
          type: String,
          required: true,
          trim: true
        },
        value: {
          type: Schema.Types.Mixed,
          required: true
        },
        type: {
          type: String,
          enum: ['string', 'number', 'boolean', 'date', 'array', 'object'],
          default: 'string'
        },
        addedBy: {
          type: Schema.Types.ObjectId,
          ref: 'User'
        },
        addedAt: {
          type: Date,
          default: Date.now
        }
      }, { _id: true })],
      default: []
    },

    // Processing timestamps
    lastProcessedAt: Date,
    processAttempts: {
      type: Number,
      default: 0
    },
    maxProcessAttempts: {
      type: Number,
      default: 3
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for efficient queries
documentSchema.index({ user: 1, entityType: 1, entityId: 1 });
documentSchema.index({ planId: 1, planItemId: 1 });
documentSchema.index({ status: 1, createdAt: -1 });
documentSchema.index({ 'permissions._id': 1, 'permissions.entity': 1 });

/**
 * Virtual: Check if document can be reprocessed
 */
documentSchema.virtual("canReprocess").get(function () {
  return this.processAttempts < this.maxProcessAttempts &&
         this.status !== 'processing' &&
         this.status !== 'reprocessing';
});

/**
 * Virtual: Check if processing was successful
 */
documentSchema.virtual("isProcessed").get(function () {
  return this.status === 'completed' && this.extractedText && this.extractedText.length > 0;
});

/**
 * Static: Find documents for an entity
 */
documentSchema.statics.findByEntity = function(entityType, entityId) {
  return this.find({ entityType, entityId }).sort({ createdAt: -1 });
};

/**
 * Static: Find documents for a plan item
 */
documentSchema.statics.findByPlanItem = function(planId, planItemId) {
  return this.find({ planId, planItemId }).sort({ createdAt: -1 });
};

/**
 * Static: Find pending documents for processing
 */
documentSchema.statics.findPendingDocuments = function(limit = 10) {
  return this.find({
    status: { $in: ['pending', 'failed'] },
    processAttempts: { $lt: 3 }
  })
  .sort({ createdAt: 1 })
  .limit(limit);
};

/**
 * Instance: Mark as processing
 */
documentSchema.methods.markProcessing = function() {
  this.status = 'processing';
  this.processAttempts += 1;
  return this.save();
};

/**
 * Instance: Mark as completed with results
 */
documentSchema.methods.markCompleted = function(extractedText, processingResult, aiParsedData = null) {
  this.status = 'completed';
  this.extractedText = extractedText;
  this.processingResult = processingResult;
  this.lastProcessedAt = new Date();

  if (aiParsedData) {
    this.aiParsedData = aiParsedData;
  }

  return this.save();
};

/**
 * Instance: Mark as failed
 */
documentSchema.methods.markFailed = function(error) {
  this.status = 'failed';
  this.processingResult = {
    method: 'failed',
    error: error.message || String(error),
    processedAt: new Date()
  };
  this.lastProcessedAt = new Date();

  return this.save();
};

/**
 * Instance: Queue for reprocessing
 */
documentSchema.methods.queueReprocess = function(options = {}) {
  if (!this.canReprocess) {
    throw new Error('Document cannot be reprocessed - max attempts reached or currently processing');
  }

  this.status = 'reprocessing';

  if (options.language) this.processingOptions.language = options.language;
  if (options.forceLLM !== undefined) this.processingOptions.forceLLM = options.forceLLM;
  if (options.skipLLMFallback !== undefined) this.processingOptions.skipLLMFallback = options.skipLLMFallback;
  if (options.documentTypeHint) this.processingOptions.documentTypeHint = options.documentTypeHint;

  return this.save();
};

/**
 * Instance: Add metadata entry
 * @param {string} key - Metadata key
 * @param {*} value - Metadata value
 * @param {string} userId - User ID who added the metadata
 * @returns {Promise} Saved document
 */
documentSchema.methods.addMetadata = function(key, value, userId) {
  // Determine type
  let type = 'string';
  if (typeof value === 'number') type = 'number';
  else if (typeof value === 'boolean') type = 'boolean';
  else if (value instanceof Date) type = 'date';
  else if (Array.isArray(value)) type = 'array';
  else if (typeof value === 'object' && value !== null) type = 'object';

  // Check if key already exists
  const existingIndex = this.metadata.findIndex(m => m.key === key);

  if (existingIndex >= 0) {
    // Update existing
    this.metadata[existingIndex].value = value;
    this.metadata[existingIndex].type = type;
    this.metadata[existingIndex].addedBy = userId;
    this.metadata[existingIndex].addedAt = new Date();
  } else {
    // Add new
    this.metadata.push({
      key,
      value,
      type,
      addedBy: userId,
      addedAt: new Date()
    });
  }

  return this.save();
};

/**
 * Instance: Get metadata value by key
 * @param {string} key - Metadata key
 * @returns {*} Metadata value or undefined
 */
documentSchema.methods.getMetadata = function(key) {
  const entry = this.metadata.find(m => m.key === key);
  return entry ? entry.value : undefined;
};

/**
 * Instance: Remove metadata entry by key
 * @param {string} key - Metadata key
 * @returns {Promise} Saved document
 */
documentSchema.methods.removeMetadata = function(key) {
  this.metadata = this.metadata.filter(m => m.key !== key);
  return this.save();
};

/**
 * Instance: Get all metadata as a plain object
 * @returns {Object} Key-value pairs of all metadata
 */
documentSchema.methods.getMetadataObject = function() {
  const result = {};
  for (const entry of this.metadata) {
    result[entry.key] = entry.value;
  }
  return result;
};

module.exports = mongoose.model("Document", documentSchema);

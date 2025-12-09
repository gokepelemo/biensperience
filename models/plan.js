const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * Permission sub-schema for collaborative plan management
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
    enum: ['user', 'destination', 'experience']
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
 * Note visibility options:
 * - 'private': Only viewable by the note creator
 * - 'contributors': Viewable by all collaborators on the plan (All Contributors)
 */
const NOTE_VISIBILITY = ['private', 'contributors'];

/**
 * Note schema for plan item details
 */
const noteSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  visibility: {
    type: String,
    enum: NOTE_VISIBILITY,
    default: 'contributors' // Default: visible to all plan collaborators
  }
}, { timestamps: true }); // createdAt and updatedAt

/**
 * GeoJSON Point schema for location coordinates
 */
const geoPointSchema = new Schema({
  type: {
    type: String,
    enum: ['Point'],
    default: 'Point'
  },
  coordinates: {
    type: [Number], // [longitude, latitude]
    validate: {
      validator: function(coords) {
        if (!coords || coords.length !== 2) return true; // Allow empty/null
        const [lng, lat] = coords;
        return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
      },
      message: 'Coordinates must be [longitude, latitude] with valid ranges'
    }
  }
}, { _id: false });

/**
 * Location schema for plan items
 * Stores human-readable address and GeoJSON Point for geocoding
 */
const locationSchema = new Schema({
  address: {
    type: String,
    trim: true
  },
  geo: {
    type: geoPointSchema,
    default: null
  },
  // Optional additional address components from geocoding
  city: String,
  state: String,
  country: String,
  postalCode: String,
  placeId: String // Google Place ID for reference
}, { _id: false });

// ============================================================================
// TRANSPORT EXTENSION SCHEMAS
// Mode-specific schemas that extend the base transport details
// ============================================================================

/**
 * Transport mode enumeration
 */
const TRANSPORT_MODES = [
  'flight', 'train', 'cruise', 'ferry', 'bus', 'coach',
  'car_share', 'ride', 'metro', 'local_transit', 'bike_rental', 'scooter'
];

/**
 * Transport status enumeration
 */
const TRANSPORT_STATUSES = ['scheduled', 'active', 'completed', 'cancelled', 'delayed'];

/**
 * Flight extension schema (minimal - for collaborator tracking)
 * Additional fields specific to air travel
 */
const flightExtensionSchema = new Schema({
  terminal: { type: String, trim: true },
  arrivalTerminal: { type: String, trim: true },
  gate: { type: String, trim: true },
  arrivalGate: { type: String, trim: true }
}, { _id: false });

/**
 * Train extension schema (minimal - for collaborator tracking)
 * Additional fields specific to rail travel
 */
const trainExtensionSchema = new Schema({
  carriageNumber: { type: String, trim: true },
  platform: { type: String, trim: true },
  arrivalPlatform: { type: String, trim: true }
}, { _id: false });

/**
 * Cruise/Ferry extension schema (minimal - for collaborator tracking)
 * Additional fields specific to water travel
 */
const cruiseFerryExtensionSchema = new Schema({
  deck: { type: String, trim: true },
  shipName: { type: String, trim: true },
  embarkationPort: { type: String, trim: true },
  disembarkationPort: { type: String, trim: true }
}, { _id: false });

/**
 * Bus/Coach extension schema (minimal - for collaborator tracking)
 * Additional fields specific to road travel
 */
const busCoachExtensionSchema = new Schema({
  stopName: { type: String, trim: true },
  arrivalStopName: { type: String, trim: true }
}, { _id: false });

/**
 * Car Share/Ride extension schema (minimal - for collaborator tracking)
 * Additional fields specific to rideshare/car services
 */
const carShareRideExtensionSchema = new Schema({
  vehicleModel: { type: String, trim: true },
  vehicleColor: { type: String, trim: true },
  licensePlate: { type: String, trim: true },
  pickupSpot: { type: String, trim: true }
}, { _id: false });

/**
 * Metro/Local Transit extension schema (minimal - for collaborator tracking)
 * Additional fields specific to public transit
 */
const metroLocalTransitExtensionSchema = new Schema({
  lineNumber: { type: String, trim: true },
  direction: { type: String, trim: true },
  platform: { type: String, trim: true }
}, { _id: false });

/**
 * Bike Rental/Scooter extension schema (minimal - for collaborator tracking)
 * Additional fields specific to micro-mobility rentals
 */
const bikeScooterExtensionSchema = new Schema({
  dockName: { type: String, trim: true },
  returnDockName: { type: String, trim: true }
}, { _id: false });

/**
 * Discount type enumeration
 */
const DISCOUNT_TYPES = ['promo_code', 'coupon', 'loyalty', 'member', 'early_bird', 'group', 'seasonal', 'referral', 'other'];

/**
 * Discount status enumeration
 */
const DISCOUNT_STATUSES = ['active', 'applied', 'expired', 'invalid'];

/**
 * Discount extension schema
 * Stores discount/promo code details for plan items
 * Can be linked to any plan item that has a discount applied
 */
const discountExtensionSchema = new Schema({
  // Type of discount
  discountType: {
    type: String,
    enum: DISCOUNT_TYPES,
    default: 'promo_code'
  },
  // The actual code (promo code, coupon code, etc.)
  code: { type: String, trim: true },
  // Description of the discount
  description: { type: String, trim: true },
  // Discount value (percentage or fixed amount)
  discountValue: { type: Number },
  // Whether the discount is a percentage (true) or fixed amount (false)
  isPercentage: { type: Boolean, default: true },
  // Currency for fixed amount discounts
  currency: { type: String, default: 'USD', maxlength: 3, uppercase: true },
  // Minimum purchase required for discount
  minimumPurchase: { type: Number },
  // Maximum discount cap (for percentage discounts)
  maxDiscount: { type: Number },
  // Expiration date
  expiresAt: { type: Date },
  // Status
  status: {
    type: String,
    enum: DISCOUNT_STATUSES,
    default: 'active'
  },
  // Source where the code was obtained (website, email, partner, etc.)
  source: { type: String, trim: true },
  // Additional notes about usage or restrictions
  discountNotes: { type: String, trim: true }
}, { _id: false });

/**
 * Parking type enumeration
 */
const PARKING_TYPES = ['street', 'garage', 'lot', 'valet', 'hotel', 'airport', 'venue', 'private', 'other'];

/**
 * Parking status enumeration
 */
const PARKING_STATUSES = ['reserved', 'active', 'completed', 'cancelled'];

/**
 * Parking extension schema
 * Stores parking details for plan items
 * Can be linked to accommodation, activity, or transport plan items
 */
const parkingExtensionSchema = new Schema({
  // Parking type (street, garage, lot, valet, etc.)
  parkingType: {
    type: String,
    enum: PARKING_TYPES,
    default: 'lot'
  },
  // Parking facility/location name
  facilityName: { type: String, trim: true },
  // Address or location description
  address: { type: String, trim: true },
  // Parking spot/space number or identifier
  spotNumber: { type: String, trim: true },
  // Floor/level in multi-story garages
  level: { type: String, trim: true },
  // Start date/time
  startTime: { type: Date },
  // End date/time
  endTime: { type: Date },
  // Cost information
  cost: { type: Number },
  currency: { type: String, default: 'USD', maxlength: 3, uppercase: true },
  // Whether parking is prepaid
  prepaid: { type: Boolean, default: false },
  // Reservation/confirmation number
  confirmationNumber: { type: String, trim: true },
  // Access code or gate code if applicable
  accessCode: { type: String, trim: true },
  // Status
  status: {
    type: String,
    enum: PARKING_STATUSES,
    default: 'reserved'
  },
  // Additional notes
  parkingNotes: { type: String, trim: true }
}, { _id: false });

/**
 * Transport extension schema
 * Combines base transport fields with mode-specific extensions
 * Stores transport details for plan items with activity_type='transport'
 */
const transportExtensionSchema = new Schema({
  // Base transport fields (common to all modes)
  mode: {
    type: String,
    enum: TRANSPORT_MODES,
    required: true
  },
  vendor: { type: String, trim: true },
  trackingNumber: { type: String, trim: true },
  country: { type: String, maxlength: 2, uppercase: true },
  departureTime: { type: Date },
  arrivalTime: { type: Date },
  departureLocation: { type: String, trim: true },
  arrivalLocation: { type: String, trim: true },
  status: {
    type: String,
    enum: TRANSPORT_STATUSES,
    default: 'scheduled'
  },
  transportNotes: { type: String, trim: true },

  // Mode-specific extension (only one will be populated based on mode)
  flight: { type: flightExtensionSchema, default: null },
  train: { type: trainExtensionSchema, default: null },
  cruise: { type: cruiseFerryExtensionSchema, default: null },
  ferry: { type: cruiseFerryExtensionSchema, default: null },
  bus: { type: busCoachExtensionSchema, default: null },
  coach: { type: busCoachExtensionSchema, default: null },
  carShare: { type: carShareRideExtensionSchema, default: null },
  ride: { type: carShareRideExtensionSchema, default: null },
  metro: { type: metroLocalTransitExtensionSchema, default: null },
  localTransit: { type: metroLocalTransitExtensionSchema, default: null },
  bikeRental: { type: bikeScooterExtensionSchema, default: null },
  scooter: { type: bikeScooterExtensionSchema, default: null }
}, { _id: false });

/**
 * Document reference schema for plan item details
 * References the Document model for uploaded documents
 */
const documentReferenceSchema = new Schema({
  document: {
    type: Schema.Types.ObjectId,
    ref: 'Document',
    required: true
  },
  addedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  addedAt: {
    type: Date,
    default: Date.now
  },
  // Optional display name override (if different from document.originalFilename)
  displayName: { type: String, trim: true },
  // Optional notes about this document's relevance to the plan item
  contextNotes: { type: String, trim: true }
}, { _id: true });

/**
 * Plan item snapshot schema
 * Point-in-time snapshot of plan items for this specific user's plan
 */
const planItemSnapshotSchema = new Schema({
  plan_item_id: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'Experience.plan_items'
  },
  complete: {
    type: Boolean,
    default: false
  },
  cost: {
    type: Number,
    default: 0
  },
  planning_days: {
    type: Number,
    default: 0
  },
  // Store snapshot of original item data in case experience changes
  text: String,
  url: String,
  photos: { type: [Schema.Types.ObjectId], ref: 'Photo', default: [] },
  parent: { type: Schema.Types.ObjectId },
  // Activity type for grouping plan items
  // Expanded for travel and local exploration theme
  activity_type: {
    type: String,
    enum: [
      // Essentials
      'accommodation', 'transport', 'food', 'drinks', 'coffee',
      // Experiences
      'sightseeing', 'museum', 'nature', 'adventure', 'sports', 'entertainment',
      'wellness', 'tour', 'class', 'nightlife', 'religious', 'local',
      // Services
      'shopping', 'market', 'health', 'banking', 'communication', 'admin', 'laundry', 'rental',
      // Other
      'photography', 'meeting', 'work', 'rest', 'packing', 'checkpoint', 'custom',
      // Legacy (for backwards compatibility)
      'activity',
      null
    ],
    default: null
  },
  // Scheduled date and time for timeline organization (user-specific overrides)
  scheduled_date: { type: Date, default: null },
  scheduled_time: { type: String, default: null }, // HH:MM format
  // Location for the plan item (address and GeoJSON coordinates)
  location: {
    type: locationSchema,
    default: null
  },
  // Plan item details (notes, chat, photos, documents, transport, parking)
  details: {
    type: new Schema({
      notes: {
        type: [noteSchema],
        default: []
      },
      chat: {
        type: [Schema.Types.Mixed], // Future: chat message schema
        default: []
      },
      photos: {
        type: [Schema.Types.ObjectId],
        ref: 'Photo',
        default: []
      },
      // Document references - links to Document model
      documents: {
        type: [documentReferenceSchema],
        default: []
      },
      // Transport extension - only populated for activity_type='transport'
      // Contains mode-specific details (flight, train, cruise, etc.)
      transport: {
        type: transportExtensionSchema,
        default: null
      },
      // Parking extension - stores parking details for plan items
      // Can be linked to any plan item that requires parking info
      parking: {
        type: parkingExtensionSchema,
        default: null
      },
      // Discount extension - stores promo codes and discount information
      // Can be linked to any plan item that has a discount applied
      discount: {
        type: discountExtensionSchema,
        default: null
      }
    }, { _id: false }),
    default: () => ({ notes: [], chat: [], photos: [], documents: [], transport: null, parking: null, discount: null })
  },
  // Assignment to collaborator or owner
  assignedTo: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, { _id: true });

/**
 * Plan schema
 * Represents a user's personalized plan for an experience
 * Creates point-in-time snapshot of plan items
 */
const planSchema = new Schema(
  {
    experience: {
      type: Schema.Types.ObjectId,
      ref: "Experience",
      required: true
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    planned_date: {
      type: Date
    },
    // Default currency for the plan (used for cost tracking and CSV export)
    // Individual costs can override this with their own currency
    currency: {
      type: String,
      default: 'USD',
      maxlength: 3,
      uppercase: true,
      trim: true
    },
    plan: {
      type: [planItemSnapshotSchema],
      default: []
    },
    // Costs associated with the plan. Each cost can be linked to a plan_item,
    // a collaborator, or the plan itself.
    costs: {
      type: [new Schema({
        title: { type: String, required: true },
        description: { type: String },
        cost: { type: Number, required: true, default: 0 },
        currency: { type: String, default: 'USD' },
        category: {
          type: String,
          enum: ['accommodation', 'transport', 'food', 'activities', 'equipment', 'other', null],
          default: null
        },
        date: { type: Date, default: Date.now }, // When the cost was incurred
        plan_item: { type: Schema.Types.ObjectId }, // optional link to a plan item snapshot
        plan: { type: Schema.Types.ObjectId, ref: 'Plan' }, // optional link back to this plan
        collaborator: { type: Schema.Types.ObjectId, ref: 'User' }, // optional contributor who paid or is responsible
        created_at: { type: Date, default: Date.now }
      }, { _id: true }) ],
      default: []
    },
    permissions: {
      type: [permissionSchema],
      default: [],
      validate: {
        validator: function(permissions) {
          // Ensure at least one owner exists
          const hasOwner = permissions.some(p => 
            p.entity === 'user' && p.type === 'owner'
          );
          
          // If permissions array has user entries, must have at least one owner
          const hasUserPermissions = permissions.some(p => p.entity === 'user');
          if (hasUserPermissions && !hasOwner) {
            return false;
          }
          
          // Check for duplicate permissions
          const seen = new Set();
          for (const p of permissions) {
            const key = `${p.entity}:${p._id}`;
            if (seen.has(key)) {
              return false;
            }
            seen.add(key);
          }
          
          return true;
        },
        message: 'Plans must have at least one owner and no duplicate permissions'
      }
    },
    notes: {
      type: String
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for efficient queries
planSchema.index({ experience: 1, user: 1 }, { unique: true }); // One plan per user per experience
planSchema.index({ user: 1 });
planSchema.index({ experience: 1 });
planSchema.index({ user: 1, updatedAt: -1 }); // For getUserPlans sorted by updatedAt

// OPTIMIZATION: Compound index for permission-based queries (Phase 2.3)
// Supports queries that filter by experience and permission entities
planSchema.index({ experience: 1, 'permissions._id': 1, 'permissions.type': 1 });  // For getExperiencePlans queries

// OPTIMIZATION: Index for dashboard permission-based queries
// Supports queries that filter by permissions without experience (e.g., getDashboardStats)
planSchema.index({ 'permissions._id': 1, 'permissions.entity': 1 });

// Spatial index for plan item locations (GeoJSON Points stored on each plan item)
// Enables geospatial queries for proximity-based plan item lookups
planSchema.index({ 'plan.location.geo': '2dsphere' });

/**
 * Virtual property for total cost
 */
planSchema.virtual("total_cost").get(function () {
  if (!this.plan || !Array.isArray(this.plan)) return 0;
  const itemsTotal = this.plan.reduce((sum, item) => sum + (item.cost || 0), 0);
  const costsTotal = (this.costs && Array.isArray(this.costs))
    ? this.costs.reduce((s, c) => s + (c.cost || 0), 0)
    : 0;
  return itemsTotal + costsTotal;
});

/**
 * Helper function to flatten plan items hierarchy
 * @param {Array} items - Plan items array
 * @returns {Array} Flattened array of all plan items
 */
function flattenPlanItems(items) {
  if (!Array.isArray(items)) return [];

  const result = [];

  function addItem(item) {
    result.push(item);

    // Find and add children
    const children = items.filter(sub =>
      sub.parent && sub.parent.toString() === (item.plan_item_id || item._id).toString()
    );

    children.forEach(child => addItem(child));
  }

  // Start with root items (no parent)
  const rootItems = items.filter(item => !item.parent);
  rootItems.forEach(item => addItem(item));

  return result;
}

/**
 * Virtual property for maximum planning days
 * Considers all plan items in the hierarchy, not just top-level items
 * Named max_planning_days to be consistent with Experience model
 */
planSchema.virtual("max_planning_days").get(function () {
  if (!this.plan || !Array.isArray(this.plan)) return 0;

  // Flatten the hierarchy to consider all items
  const allItems = flattenPlanItems(this.plan);

  // Find the maximum planning_days value
  return allItems.reduce((max, item) => Math.max(max, item.planning_days || 0), 0);
});

/**
 * Virtual property for completion percentage
 */
planSchema.virtual("completion_percentage").get(function () {
  if (!this.plan || !Array.isArray(this.plan) || this.plan.length === 0) return 0;
  const completed = this.plan.filter(item => item.complete).length;
  return Math.round((completed / this.plan.length) * 100);
});

module.exports = mongoose.model("Plan", planSchema);

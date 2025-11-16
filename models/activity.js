/**
 * Activity Model - Universal audit log for all entity changes
 * 
 * Records all modifications to resources (experiences, destinations, photos, plans, users)
 * enabling full audit trails and state restoration capabilities.
 */

const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  // Timestamp of the activity
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  },

  // Type of action performed
  action: {
    type: String,
    required: true,
    enum: [
      // Permission actions
      'permission_added',
      'permission_removed',
      'permission_updated',
      'ownership_transferred',
      
      // Resource CRUD actions
      'resource_created',
      'resource_updated',
      'resource_deleted',
      
      // User actions
      'user_registered',
      'user_updated',
      'user_deleted',
      'email_verified',
      'password_changed',
      'profile_updated',
      
      // Plan actions
      'plan_created',
      'plan_updated',
      'plan_deleted',
      'plan_item_completed',
      'plan_item_uncompleted',
      
      // Social actions
      'favorite_added',
      'favorite_removed',
      'collaborator_added',
      'collaborator_removed',
      
      // System actions
      'data_imported',
      'data_exported',
      'backup_created',
      'rollback_performed'
    ],
    index: true
  },

  // Actor who performed the action
  actor: {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    email: String,
    name: String,
    role: String
  },

  // Resource affected by the action
  resource: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },
    type: {
      type: String,
      required: true,
      enum: ['User', 'Experience', 'Destination', 'Photo', 'Plan', 'PlanItem'],
      index: true
    },
    name: String // Human-readable name for the resource
  },

  // Target entity for relationship actions (permissions, collaborators, etc.)
  target: {
    id: mongoose.Schema.Types.ObjectId,
    type: {
      type: String,
      enum: ['User', 'Experience', 'Destination', 'Photo', 'Plan', 'PlanItem']
    },
    name: String
  },

  // Permission-specific data (when action involves permissions)
  permission: {
    _id: mongoose.Schema.Types.ObjectId,
    entity: {
      type: String,
      enum: ['user', 'destination', 'experience']
    },
    type: {
      type: String,
      enum: ['owner', 'collaborator', 'contributor']
    }
  },

  // State snapshots for rollback capability
  previousState: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  
  newState: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },

  // Changes made (field-level granularity for updates)
  changes: [{
    field: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed
  }],

  // Human-readable reason for the action
  reason: {
    type: String,
    required: true
  },

  // Request metadata for forensics
  metadata: {
    ipAddress: String,
    userAgent: String,
    requestPath: String,
    requestMethod: String,
    sessionId: String
  },

  // Rollback token for secure state restoration
  rollbackToken: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },

  // Reference to original activity if this is a rollback
  rollbackOf: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Activity',
    default: null
  },

  // Tags for categorization and filtering
  tags: [{
    type: String,
    index: true
  }],

  // Success/failure status
  status: {
    type: String,
    enum: ['success', 'failure', 'partial'],
    default: 'success'
  },

  // Error details if action failed
  error: {
    message: String,
    code: String,
    stack: String
  }
}, {
  timestamps: true,
  collection: 'activities'
});

// Indexes for efficient querying
activitySchema.index({ 'actor._id': 1, timestamp: -1 });
activitySchema.index({ 'resource.id': 1, timestamp: -1 });
activitySchema.index({ 'resource.type': 1, timestamp: -1 });
activitySchema.index({ action: 1, timestamp: -1 });
activitySchema.index({ tags: 1 });

// Static method to log activity
activitySchema.statics.log = async function(activityData) {
  try {
    const activity = new this(activityData);
    await activity.save();
    return { success: true, activity };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Static method to get activity history for a resource
activitySchema.statics.getHistory = async function(resourceId, options = {}) {
  const query = { 'resource.id': resourceId };
  
  if (options.action) {
    query.action = options.action;
  }
  
  if (options.startDate) {
    query.timestamp = { $gte: options.startDate };
  }
  
  if (options.endDate) {
    query.timestamp = query.timestamp || {};
    query.timestamp.$lte = options.endDate;
  }
  
  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(options.limit || 100)
    .lean();
};

// Static method to get activity by actor
activitySchema.statics.getByActor = async function(actorId, options = {}) {
  const query = { 'actor._id': actorId };
  
  if (options.action) {
    query.action = options.action;
  }
  
  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(options.limit || 100)
    .lean();
};

// Static method to restore state from activity
activitySchema.statics.restoreState = async function(rollbackToken) {
  const activity = await this.findOne({ rollbackToken });
  
  if (!activity) {
    return { success: false, error: 'Activity not found' };
  }
  
  if (!activity.previousState) {
    return { success: false, error: 'No previous state available for restoration' };
  }
  
  return {
    success: true,
    resourceId: activity.resource.id,
    resourceType: activity.resource.type,
    previousState: activity.previousState
  };
};

module.exports = mongoose.model('Activity', activitySchema);

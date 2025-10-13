const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * Permission sub-schema for collaborative photo management
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

const photoSchema = new Schema(
  {
    url: { type: String },
    s3_key: { type: String },
    photo_credit: { type: String },
    photo_credit_url: { type: String },
    caption: { type: String },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
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
        message: 'Photos must have at least one owner and no duplicate permissions'
      }
    }
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Photo", photoSchema);

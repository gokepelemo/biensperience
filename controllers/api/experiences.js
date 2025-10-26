const mongoose = require('mongoose');
const Experience = require('../../models/experience');
const Destination = require('../../models/destination');
const User = require('../../models/user');
const Plan = require('../../models/plan');
const permissions = require('../../utilities/permissions');
const { getEnforcer } = require('../../utilities/permission-enforcer');
const backendLogger = require('../../utilities/backend-logger');

// Helper function to escape regex special characters
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
const { findDuplicateFuzzy } = require("../../utilities/fuzzy-match");

async function index(req, res) {
  try {
    let experiences = await Experience.find({})
      .populate("destination")
      .exec();
    res.status(200).json(experiences);
  } catch (err) {
    backendLogger.error('Error fetching experiences', { error: err.message, userId: req.user?._id });
    res.status(400).json({ error: 'Failed to fetch experiences' });
  }
}

async function createExperience(req, res) {
  try {
    // Initialize permissions array with owner
    req.body.permissions = [
      {
        _id: req.user._id,
        entity: permissions.ENTITY_TYPES.USER,
        type: permissions.ROLES.OWNER
      }
    ];

    // Get all user experiences for fuzzy checking
    const userExperiences = await Experience.find({
      permissions: {
        $elemMatch: {
          entity: permissions.ENTITY_TYPES.USER,
          type: permissions.ROLES.OWNER,
          _id: req.user._id
        }
      }
    });

    // Check for exact duplicate (case-insensitive)
    const exactDuplicate = await Experience.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(req.body.name)}$`, 'i') },
      permissions: {
        $elemMatch: {
          entity: permissions.ENTITY_TYPES.USER,
          type: permissions.ROLES.OWNER,
          _id: req.user._id
        }
      }
    });

    if (exactDuplicate) {
      return res.status(409).json({
        error: 'Duplicate experience',
        message: `An experience named "${req.body.name}" already exists. Please choose a different name.`
      });
    }

    // Check for fuzzy duplicate
    const fuzzyDuplicate = findDuplicateFuzzy(
      userExperiences,
      req.body.name,
      'name',
      85
    );

    if (fuzzyDuplicate) {
      return res.status(409).json({
        error: 'Similar experience exists',
        message: `A similar experience "${fuzzyDuplicate.name}" already exists. Did you mean to use that instead?`
      });
    }

    let experience = await Experience.create(req.body);
    res.status(201).json(experience);
  } catch (err) {
    backendLogger.error('Error creating experience', { error: err.message, userId: req.user._id, name: req.body.name, destination: req.body.destination });
    res.status(400).json({ error: 'Failed to create experience' });
  }
}

async function showExperience(req, res) {
  try {
    let experience = await Experience.findById(req.params.id)
      .populate("destination")
      .populate({
        path: "permissions._id",
        select: "name photo photos default_photo_index"
      });
    
    // Manually populate the photo field for each user in permissions
    if (experience && experience.permissions) {
      const Photo = mongoose.model('Photo');
      
      await Promise.all(
        experience.permissions.map(async (perm) => {
          if (perm._id) {
            // Handle legacy photo field (ObjectId reference)
            if (perm._id.photo) {
              const isObjectId = perm._id.photo.constructor.name === 'ObjectId' ||
                                (typeof perm._id.photo === 'string') ||
                                !perm._id.photo.url;

              if (isObjectId) {
                const populatedPhoto = await Photo.findById(perm._id.photo).select('url caption');
                perm._id.photo = populatedPhoto;
              }
            }

            // Handle photos array - populate each photo if needed
            if (perm._id.photos && perm._id.photos.length > 0) {
              for (let i = 0; i < perm._id.photos.length; i++) {
                const photoItem = perm._id.photos[i];
                if (photoItem && !photoItem.url && (typeof photoItem === 'string' || photoItem.constructor.name === 'ObjectId')) {
                  const populatedPhoto = await Photo.findById(photoItem).select('url caption');
                  perm._id.photos[i] = populatedPhoto;
                }
              }
            }
          }
        })
      );
    }
    
    res.status(200).json(experience);
  } catch (err) {
    backendLogger.error('Error fetching experience', { error: err.message, experienceId: req.params.id });
    res.status(400).json({ error: 'Failed to fetch experience' });
  }
}

async function updateExperience(req, res) {
  backendLogger.info('updateExperience called', { experienceId: req.params.experienceId || req.params.id, userId: req.user._id });
  const experienceId = req.params.experienceId || req.params.id;
  try {
    backendLogger.info('Looking up experience', { experienceId });
    let experience = await Experience.findById(experienceId);
    backendLogger.info('Experience lookup result', { found: !!experience });
    
    if (!experience) {
      backendLogger.warn('Experience not found', { experienceId });
      return res.status(404).json({ error: 'Experience not found' });
    }
    
    // Check if user has permission to edit using PermissionEnforcer
    const enforcer = getEnforcer({ Destination, Experience, User });
    const permCheck = await enforcer.canEdit({
      userId: req.user._id,
      resource: experience
    });
    
    if (!permCheck.allowed) {
      return res.status(403).json({ 
        error: 'Not authorized to update this experience',
        message: permCheck.reason || 'You must be the owner or a collaborator to edit this experience.'
      });
    }

    // Check for duplicate experience name if name is being updated
    if (req.body.name && req.body.name !== experience.name) {
      // Check for exact duplicate
      const exactDuplicate = await Experience.findOne({
        name: { $regex: new RegExp(`^${escapeRegex(req.body.name)}$`, 'i') },
        permissions: {
          $elemMatch: {
            entity: permissions.ENTITY_TYPES.USER,
            type: permissions.ROLES.OWNER,
            _id: req.user._id
          }
        },
        _id: { $ne: experienceId }
      });

      if (exactDuplicate) {
        return res.status(409).json({
          error: 'Duplicate experience',
          message: `An experience named "${req.body.name}" already exists. Please choose a different name.`
        });
      }

      // Check for fuzzy duplicate
      const userExperiences = await Experience.find({
        permissions: {
          $elemMatch: {
            entity: permissions.ENTITY_TYPES.USER,
            type: permissions.ROLES.OWNER,
            _id: req.user._id
          }
        },
        _id: { $ne: experienceId }
      });

      const fuzzyDuplicate = findDuplicateFuzzy(
        userExperiences,
        req.body.name,
        'name',
        85
      );

      if (fuzzyDuplicate) {
        return res.status(409).json({
          error: 'Similar experience exists',
          message: `A similar experience "${fuzzyDuplicate.name}" already exists. Did you mean to use that instead?`
        });
      }
    }

    // Filter out fields that shouldn't be updated
    const allowedFields = [
      'name', 'destination', 'map_location', 'experience_type', 
      'plan_items', 'photo', 'photos', 'default_photo_index', 'permissions'
    ];
    
    const updateData = {};
    for (const field of allowedFields) {
      if (req.body.hasOwnProperty(field)) {
        updateData[field] = req.body[field];
      }
    }
    backendLogger.debug('About to validate permissions');
    // Validate permissions if present
    if (updateData.permissions) {
      backendLogger.debug('Validating permissions', { count: updateData.permissions.length });
      for (const perm of updateData.permissions) {
        backendLogger.debug('Checking permission', { permission: perm });
        if (!perm._id) {
          backendLogger.error('Invalid permission: missing _id', { permission: perm, experienceId });
          return res.status(400).json({ error: 'Invalid permissions data: missing _id' });
        }
        if (!perm.entity || !['user', 'destination', 'experience'].includes(perm.entity)) {
          backendLogger.error('Invalid permission: invalid entity', { permission: perm, experienceId });
          return res.status(400).json({ error: 'Invalid permissions data: invalid entity' });
        }
      }
    }
    
    backendLogger.info('Filtered update data', { 
      experienceId, 
      updateFields: Object.keys(updateData),
      originalBodyKeys: Object.keys(req.body)
    });
    
    // Validate permissions if present
    if (updateData.permissions) {
      for (const perm of updateData.permissions) {
        if (!perm._id) {
          backendLogger.error('Invalid permission: missing _id', { permission: perm, experienceId });
          return res.status(400).json({ error: 'Invalid permissions data: missing _id' });
        }
        if (!perm.entity || !['user', 'destination', 'experience'].includes(perm.entity)) {
          backendLogger.error('Invalid permission: invalid entity', { permission: perm, experienceId });
          return res.status(400).json({ error: 'Invalid permissions data: invalid entity' });
        }
      }
    }
    
    experience = Object.assign(experience, updateData);
    
    backendLogger.info('About to save experience', { experienceId, bodyKeys: Object.keys(req.body) });
    await experience.save();
    backendLogger.info('Experience saved successfully', { experienceId });
    res.status(200).json(experience);
  } catch (err) {
    backendLogger.error('Experience save error details', {
      message: err.message,
      stack: err.stack,
      name: err.name,
      code: err.code,
      errors: err.errors
    });
    
    // Safe logging to avoid undefined property access
    const safeExperienceId = experienceId || 'undefined';
    const safeUserId = req.user && req.user._id ? req.user._id.toString() : 'undefined';
    
    backendLogger.error('Error saving experience', { 
      error: err.message, 
      errors: err.errors, 
      userId: safeUserId, 
      experienceId: safeExperienceId 
    });
    
    res.status(400).json({ 
      error: 'Failed to update experience',
      details: {
        message: err.message,
        name: err.name,
        code: err.code
      }
    });
  }
}

async function deleteExperience(req, res) {
  try {
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid experience ID format' });
    }

    let experience = await Experience.findById(req.params.id);
    
    if (!experience) {
      return res.status(404).json({ error: 'Experience not found' });
    }
    
    // Check if user has permission to delete using PermissionEnforcer
    const enforcer = getEnforcer({ Destination, Experience, User });
    const permCheck = await enforcer.canDelete({
      userId: req.user._id,
      resource: experience
    });
    
    if (!permCheck.allowed) {
      return res.status(403).json({ 
        error: 'Unauthorized',
        message: permCheck.reason || 'Only the experience owner can delete it.'
      });
    }
    
    // Check if any other users have plans for this experience
    const existingPlans = await Plan.find({ experience: req.params.id })
      .populate('user', '_id name email photo photos default_photo_index');
    
    if (existingPlans.length > 0) {
      // Check if any plan belongs to someone other than the owner
      const otherUserPlans = existingPlans.filter(
        plan => plan.user._id.toString() !== req.user._id.toString()
      );
      
      if (otherUserPlans.length > 0) {
        // Get unique users with their plan details
        const usersWithPlans = otherUserPlans.map(plan => ({
          userId: plan.user._id,
          name: plan.user.name,
          email: plan.user.email,
          photo: plan.user.photo,
          photos: plan.user.photos,
          default_photo_index: plan.user.default_photo_index,
          planId: plan._id,
          plannedDate: plan.planned_date
        }));
        
        return res.status(409).json({ 
          error: 'Cannot delete experience',
          message: 'This experience cannot be deleted because other users have created plans for it. You can transfer ownership to one of these users instead.',
          planCount: otherUserPlans.length,
          usersWithPlans: usersWithPlans
        });
      }
    }
    
    await experience.deleteOne();
    res.status(200).json({ message: 'Experience deleted successfully' });
  } catch (err) {
    backendLogger.error('Error deleting experience', { error: err.message, userId: req.user._id, experienceId: req.params.id });
    res.status(400).json({ error: 'Failed to delete experience' });
  }
}

async function createPlanItem(req, res) {
  try {
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(req.params.experienceId)) {
      return res.status(400).json({ error: 'Invalid experience ID format' });
    }

    let experience = await Experience.findById(req.params.experienceId)
      .populate("destination")
      .populate({
        path: "user",
        select: "name email photo photos default_photo_index",
        populate: {
          path: "photo",
          model: "Photo"
        }
      })
      .populate({
        path: "permissions._id",
        select: "name photo photos default_photo_index"
      });
    
    if (!experience) {
      return res.status(404).json({ error: 'Experience not found' });
    }
    
    // Check if user has permission to edit using PermissionEnforcer
    const enforcer = getEnforcer({ Destination, Experience, User });
    const permCheck = await enforcer.canEdit({
      userId: req.user._id,
      resource: experience
    });
    
    if (!permCheck.allowed) {
      return res.status(403).json({ 
        error: 'Not authorized to modify this experience',
        message: permCheck.reason || 'You must be the owner or a collaborator to add plan items.'
      });
    }
    
    req.body.cost_estimate = !req.body.cost_estimate
      ? 0
      : req.body.cost_estimate;
    experience.plan_items.push(req.body);
    await experience.save();

    // Re-fetch with populated permissions for consistent response
    experience = await Experience.findById(req.params.experienceId)
      .populate("destination")
      .populate({
        path: "user",
        select: "name email photo photos default_photo_index",
        populate: {
          path: "photo",
          model: "Photo"
        }
      })
      .populate({
        path: "permissions._id",
        select: "name photo photos default_photo_index"
      });

    res.status(201).json(experience);
  } catch (err) {
    backendLogger.error('Error creating plan item', { error: err.message, userId: req.user._id, experienceId: req.params.experienceId });
    res.status(400).json({ error: 'Failed to create plan item' });
  }
}

async function updatePlanItem(req, res) {
  try {
    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(req.params.experienceId)) {
      return res.status(400).json({ error: 'Invalid experience ID format' });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.planItemId)) {
      return res.status(400).json({ error: 'Invalid plan item ID format' });
    }

    let experience = await Experience.findById(req.params.experienceId)
      .populate("destination")
      .populate({
        path: "user",
        select: "name email photo photos default_photo_index",
        populate: {
          path: "photo",
          model: "Photo"
        }
      })
      .populate({
        path: "permissions._id",
        select: "name photo photos default_photo_index"
      });
    
    if (!experience) {
      return res.status(404).json({ error: 'Experience not found' });
    }
    
    // Check if user has permission to edit using PermissionEnforcer
    const enforcer = getEnforcer({ Destination, Experience, User });
    const permCheck = await enforcer.canEdit({
      userId: req.user._id,
      resource: experience
    });
    
    if (!permCheck.allowed) {
      return res.status(403).json({ 
        error: 'Not authorized to modify plan items',
        message: permCheck.reason || 'You must be the owner or a collaborator to update plan items.'
      });
    }
    
    let plan_item = experience.plan_items.id(req.params.planItemId);
    
    if (!plan_item) {
      return res.status(404).json({ error: 'Plan item not found' });
    }
    
    // Update only provided fields (exclude _id as it's immutable)
    const { _id, ...updateData } = req.body;
    Object.assign(plan_item, updateData);
    await experience.save();

    // Re-fetch with populated permissions for consistent response
    experience = await Experience.findById(req.params.experienceId)
      .populate("destination")
      .populate({
        path: "user",
        select: "name email photo photos default_photo_index",
        populate: {
          path: "photo",
          model: "Photo"
        }
      })
      .populate({
        path: "permissions._id",
        select: "name photo photos default_photo_index"
      });

    res.status(200).json(experience);
  } catch (err) {
    backendLogger.error('Error updating plan item', { error: err.message, userId: req.user._id, experienceId: req.params.experienceId, planItemId: req.params.planItemId });
    res.status(400).json({ error: 'Failed to update plan item' });
  }
}

async function deletePlanItem(req, res) {
  try {
    // Validate ObjectId formats
    if (!mongoose.Types.ObjectId.isValid(req.params.experienceId)) {
      return res.status(400).json({ error: 'Invalid experience ID format' });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.planItemId)) {
      return res.status(400).json({ error: 'Invalid plan item ID format' });
    }

    let experience = await Experience.findById(req.params.experienceId)
      .populate("destination")
      .populate({
        path: "user",
        select: "name email photo photos default_photo_index",
        populate: {
          path: "photo",
          model: "Photo"
        }
      })
      .populate({
        path: "permissions._id",
        select: "name photo photos default_photo_index"
      });
    
    if (!experience) {
      return res.status(404).json({ error: 'Experience not found' });
    }
    
    // Check if user has permission to edit using PermissionEnforcer
    const enforcer = getEnforcer({ Destination, Experience, User });
    const permCheck = await enforcer.canEdit({
      userId: req.user._id,
      resource: experience
    });
    
    if (!permCheck.allowed) {
      return res.status(403).json({ 
        error: 'Not authorized to modify plan items',
        message: permCheck.reason || 'You must be the owner or a collaborator to delete plan items.'
      });
    }
    
    const planItem = experience.plan_items.id(req.params.planItemId);
    if (!planItem) {
      return res.status(404).json({ error: 'Plan item not found' });
    }
    
    planItem.deleteOne();
    await experience.save();

    // Re-fetch with populated permissions for consistent response
    experience = await Experience.findById(req.params.experienceId)
      .populate("destination")
      .populate({
        path: "user",
        select: "name email photo photos default_photo_index",
        populate: {
          path: "photo",
          model: "Photo"
        }
      })
      .populate({
        path: "permissions._id",
        select: "name photo photos default_photo_index"
      });
    
    res.status(200).json(experience);
  } catch (err) {
    backendLogger.error('Error deleting plan item', { error: err.message, userId: req.user._id, experienceId: req.params.experienceId, planItemId: req.params.planItemId });
    res.status(400).json({ error: 'Failed to delete plan item' });
  }
}

/**
 * @deprecated Use Plan model instead
 * Legacy endpoint - redirects to Plan creation
 * Kept for backward compatibility during migration
 */
async function addUser(req, res) {
  console.warn('addUser endpoint is deprecated. Use POST /api/plans/experience/:experienceId instead');
  res.status(410).json({ 
    error: 'This endpoint is deprecated',
    message: 'Please use POST /api/plans/experience/:experienceId to create a plan',
    alternativeEndpoint: `/api/plans/experience/${req.params.experienceId}`
  });
}

/**
 * @deprecated Use Plan model instead
 * Legacy endpoint - redirects to Plan deletion
 * Kept for backward compatibility during migration
 */
async function removeUser(req, res) {
  console.warn('removeUser endpoint is deprecated. Use DELETE /api/plans/:id instead');
  res.status(410).json({ 
    error: 'This endpoint is deprecated',
    message: 'Please use DELETE /api/plans/:id to remove a plan',
    note: 'You must first get the plan ID using GET /api/plans'
  });
}

/**
 * @deprecated Use Plan model instead
 * Legacy endpoint - redirects to Plan item updates
 * Kept for backward compatibility during migration
 */
async function userPlanItemDone(req, res) {
  console.warn('userPlanItemDone endpoint is deprecated. Use PATCH /api/plans/:id/items/:itemId instead');
  res.status(410).json({ 
    error: 'This endpoint is deprecated',
    message: 'Please use PATCH /api/plans/:id/items/:itemId to update plan item completion',
    note: 'You must first get the plan ID using GET /api/plans'
  });
}

/**
 * Get experiences where user has created a plan (contributor permission)
 * Replaces the old users array approach
 */
async function showUserExperiences(req, res) {
  try {
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    // Get all plans for this user
    const plans = await Plan.find({ user: req.params.userId })
      .populate({
        path: 'experience',
        populate: {
          path: 'destination',
          select: 'name country'
        }
      })
      .exec();

    // Extract unique experiences from plans
    const experiences = plans
      .filter(plan => plan.experience) // Filter out null experiences
      .map(plan => plan.experience);

    res.status(200).json(experiences);
  } catch (err) {
    backendLogger.error('Error fetching user experiences', { error: err.message, userId: req.params.userId });
    res.status(400).json({ error: 'Failed to fetch user experiences' });
  }
}

async function showUserCreatedExperiences(req, res) {
  try {
    // Validate ObjectId format to prevent injection
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    const userId = new mongoose.Types.ObjectId(req.params.userId);

    let experiences = await Experience.find({
      permissions: {
        $elemMatch: {
          entity: permissions.ENTITY_TYPES.USER,
          type: permissions.ROLES.OWNER,
          _id: userId
        }
      }
    })
      .populate("destination")
      .exec();
    res.status(200).json(experiences);
  } catch (err) {
    backendLogger.error('Error fetching user created experiences', { error: err.message, userId: req.params.userId });
    res.status(400).json({ error: 'Failed to fetch user created experiences' });
  }
}

async function getTagName(req, res) {
  try {
    const { tagSlug } = req.params;

    // Helper function to create URL slug (same logic as frontend)
    const createUrlSlug = (str) => {
      return str
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    };

    // Find the first experience that has a tag matching the slug
    const experience = await Experience.findOne({
      experience_type: { $exists: true, $ne: [] }
    }).exec();

    if (!experience) {
      return res.status(404).json({ error: 'No tags found' });
    }

    // Get all experiences to find all matching tags
    const allExperiences = await Experience.find({
      experience_type: { $exists: true, $ne: [] }
    }).exec();

    // Find the matching tag name
    for (const exp of allExperiences) {
      if (exp.experience_type && Array.isArray(exp.experience_type)) {
        // Flatten array - some old data has ["Tag1, Tag2"] instead of ["Tag1", "Tag2"]
        const tags = exp.experience_type.flatMap(item =>
          typeof item === 'string' && item.includes(',')
            ? item.split(',').map(tag => tag.trim())
            : item
        );

        const matchingTag = tags.find(
          tag => createUrlSlug(tag) === tagSlug
        );
        if (matchingTag) {
          return res.status(200).json({ tagName: matchingTag });
        }
      }
    }

    // If no match found, return the slug as fallback
    res.status(404).json({ error: 'Tag not found', tagName: tagSlug });
  } catch (err) {
    backendLogger.error('Error finding tag by slug', { error: err.message, tagSlug: req.params.tagSlug });
    res.status(400).json({ error: 'Failed to find tag' });
  }
}

async function addPhoto(req, res) {
  try {
    const experience = await Experience.findById(req.params.id);

    if (!experience) {
      return res.status(404).json({ error: 'Experience not found' });
    }

    // Check if user has permission to edit
    const enforcer = getEnforcer({ Destination, Experience, User });
    const permCheck = await enforcer.canEdit({
      userId: req.user._id,
      resource: experience
    });

    if (!permCheck.allowed) {
      return res.status(401).json({
        error: 'Not authorized to modify this experience',
        message: permCheck.reason
      });
    }

    const { url, photo_credit, photo_credit_url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'Photo URL is required' });
    }

    // Add photo to photos array
    experience.photos.push({
      url,
      photo_credit: photo_credit || 'Unknown',
      photo_credit_url: photo_credit_url || url
    });

    await experience.save();

    res.status(201).json(experience);
  } catch (err) {
    backendLogger.error('Error adding photo to experience', { error: err.message, userId: req.user._id, experienceId: req.params.id, url: req.body.url });
    res.status(400).json({ error: 'Failed to add photo' });
  }
}

async function removePhoto(req, res) {
  try {
    const experience = await Experience.findById(req.params.id);

    if (!experience) {
      return res.status(404).json({ error: 'Experience not found' });
    }

    // Check if user has permission to edit using PermissionEnforcer
    const enforcer = getEnforcer({ Destination, Experience, User });
    const permCheck = await enforcer.canEdit({
      userId: req.user._id,
      resource: experience
    });

    if (!permCheck.allowed) {
      return res.status(403).json({
        error: 'Not authorized',
        message: permCheck.reason || 'You must be the owner or a collaborator to modify this experience.'
      });
    }

    const photoIndex = parseInt(req.params.photoIndex);

    if (photoIndex < 0 || photoIndex >= experience.photos.length) {
      return res.status(400).json({ error: 'Invalid photo index' });
    }

    // Remove photo from array
    experience.photos.splice(photoIndex, 1);

    // Adjust default_photo_index if necessary
    if (experience.default_photo_index >= experience.photos.length) {
      experience.default_photo_index = Math.max(0, experience.photos.length - 1);
    }

    await experience.save();

    res.status(200).json(experience);
  } catch (err) {
    backendLogger.error('Error removing photo from experience', { error: err.message, userId: req.user._id, experienceId: req.params.id, photoIndex: req.params.photoIndex });
    res.status(400).json({ error: 'Failed to remove photo' });
  }
}

async function setDefaultPhoto(req, res) {
  try {
    const experience = await Experience.findById(req.params.id);

    if (!experience) {
      return res.status(404).json({ error: 'Experience not found' });
    }

    // Check if user has permission to edit
    const enforcer = getEnforcer({ Destination, Experience, User });
    const permCheck = await enforcer.canEdit({
      userId: req.user._id,
      resource: experience
    });

    if (!permCheck.allowed) {
      return res.status(401).json({
        error: 'Not authorized to modify this experience',
        message: permCheck.reason
      });
    }

    const photoIndex = parseInt(req.body.photoIndex);

    if (photoIndex < 0 || photoIndex >= experience.photos.length) {
      return res.status(400).json({ error: 'Invalid photo index' });
    }

    experience.default_photo_index = photoIndex;
    await experience.save();

    res.status(200).json(experience);
  } catch (err) {
    backendLogger.error('Error setting default photo', { error: err.message, userId: req.user._id, experienceId: req.params.id, photoIndex: req.body.photoIndex });
    res.status(400).json({ error: 'Failed to set default photo' });
  }
}

// ============================================
// PERMISSION MANAGEMENT FUNCTIONS
// ============================================

/**
 * Add a permission (collaborator/contributor or inherited entity) to an experience
 * POST /api/experiences/:id/permissions
 */
async function addExperiencePermission(req, res) {
  try {
    // Validate experience ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid experience ID format' });
    }

    const experience = await Experience.findById(req.params.id);

    if (!experience) {
      return res.status(404).json({ error: 'Experience not found' });
    }

    // Only owner can modify permissions
    if (!permissions.isOwner(req.user, experience)) {
      return res.status(401).json({ error: 'Only the experience owner can manage permissions' });
    }

    const { _id, entity, type } = req.body;

    // Validate required fields
    if (!_id || !entity) {
      return res.status(400).json({ error: 'Permission must have _id and entity fields' });
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ error: 'Invalid permission _id format' });
    }

    // Validate entity exists
    if (entity === permissions.ENTITY_TYPES.USER) {
      const user = await User.findById(_id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Prevent owner from being added as permission
      const ownerPermission = experience.permissions.find(p =>
        p.entity === 'user' && p.type === 'owner'
      );
      if (ownerPermission && _id === ownerPermission._id.toString()) {
        return res.status(400).json({ error: 'Owner already has full permissions' });
      }

      if (!type) {
        return res.status(400).json({ error: 'User permissions must have a type field' });
      }
    } else if (entity === permissions.ENTITY_TYPES.DESTINATION) {
      const destination = await Destination.findById(_id);
      if (!destination) {
        return res.status(404).json({ error: 'Target destination not found' });
      }

      // Check for circular dependency
      const models = { Destination, Experience };
      const wouldBeCircular = await permissions.wouldCreateCircularDependency(
        experience, 
        _id, 
        entity, 
        models
      );

      if (wouldBeCircular) {
        return res.status(400).json({ 
          error: 'Cannot add permission: would create circular dependency' 
        });
      }
    } else if (entity === permissions.ENTITY_TYPES.EXPERIENCE) {
      const targetExp = await Experience.findById(_id);
      if (!targetExp) {
        return res.status(404).json({ error: 'Target experience not found' });
      }

      // Check for circular dependency
      const models = { Destination, Experience };
      const wouldBeCircular = await permissions.wouldCreateCircularDependency(
        experience, 
        _id, 
        entity, 
        models
      );

      if (wouldBeCircular) {
        return res.status(400).json({ 
          error: 'Cannot add permission: would create circular dependency' 
        });
      }
    }

    // Add permission
    const permission = { _id, entity };
    if (type) {
      permission.type = type;
    }

    const result = permissions.addPermission(experience, permission);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    await experience.save();

    res.status(201).json({
      message: 'Permission added successfully',
      experience
    });

  } catch (err) {
    backendLogger.error('Error adding experience permission', { error: err.message, userId: req.user._id, experienceId: req.params.id, entityId: req.body.entityId, entityType: req.body.entityType, type: req.body.type });
    res.status(400).json({ error: 'Failed to add permission' });
  }
}

/**
 * Remove a permission from an experience
 * DELETE /api/experiences/:id/permissions/:entityId/:entityType
 */
async function removeExperiencePermission(req, res) {
  try {
    // Validate experience ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid experience ID format' });
    }

    // Validate entity ID
    if (!mongoose.Types.ObjectId.isValid(req.params.entityId)) {
      return res.status(400).json({ error: 'Invalid entity ID format' });
    }

    const experience = await Experience.findById(req.params.id);

    if (!experience) {
      return res.status(404).json({ error: 'Experience not found' });
    }

    // Only owner can modify permissions
    if (!permissions.isOwner(req.user, experience)) {
      return res.status(401).json({ error: 'Only the experience owner can manage permissions' });
    }

    const { entityId, entityType } = req.params;

    // Validate entity type
    if (!Object.values(permissions.ENTITY_TYPES).includes(entityType)) {
      return res.status(400).json({ 
        error: `Invalid entity type. Must be one of: ${Object.values(permissions.ENTITY_TYPES).join(', ')}` 
      });
    }

    const result = permissions.removePermission(experience, entityId, entityType);

    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }

    await experience.save();

    res.status(200).json({
      message: 'Permission removed successfully',
      removed: result.removed,
      experience
    });

  } catch (err) {
    backendLogger.error('Error removing experience permission', { error: err.message, userId: req.user._id, experienceId: req.params.id, entityId: req.params.entityId, entityType: req.params.entityType });
    res.status(400).json({ error: 'Failed to remove permission' });
  }
}

/**
 * Update a user permission type (collaborator <-> contributor)
 * PATCH /api/experiences/:id/permissions/:userId
 */
async function updateExperiencePermission(req, res) {
  try {
    // Validate experience ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid experience ID format' });
    }

    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const experience = await Experience.findById(req.params.id);

    if (!experience) {
      return res.status(404).json({ error: 'Experience not found' });
    }

    // Only owner can modify permissions
    if (!permissions.isOwner(req.user, experience)) {
      return res.status(401).json({ error: 'Only the experience owner can manage permissions' });
    }

    const { type } = req.body;

    if (!type) {
      return res.status(400).json({ error: 'Permission type is required' });
    }

    const result = permissions.updatePermissionType(experience, req.params.userId, type);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    await experience.save();

    res.status(200).json({
      message: 'Permission updated successfully',
      experience
    });

  } catch (err) {
    backendLogger.error('Error updating experience permission', { error: err.message, userId: req.user._id, experienceId: req.params.id, userIdParam: req.params.userId, type: req.body.type });
    res.status(400).json({ error: 'Failed to update permission' });
  }
}

/**
 * Get all permissions for an experience (with inheritance resolved)
 * GET /api/experiences/:id/permissions
 */
async function getExperiencePermissions(req, res) {
  try {
    // Validate experience ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid experience ID format' });
    }

    const experience = await Experience.findById(req.params.id);

    if (!experience) {
      return res.status(404).json({ error: 'Experience not found' });
    }

    const models = { Destination, Experience };
    const allPermissions = await permissions.getAllPermissions(experience, models);

    // Get owner information from permissions
    const ownerPermission = experience.permissions.find(p =>
      p.entity === 'user' && p.type === 'owner'
    );

    let ownerInfo = null;
    if (ownerPermission) {
      const ownerUser = await User.findById(ownerPermission._id).select('name');
      if (ownerUser) {
        ownerInfo = {
          userId: ownerPermission._id,
          name: ownerUser.name,
          role: permissions.ROLES.OWNER
        };
      }
    }

    res.status(200).json({
      owner: ownerInfo,
      permissions: allPermissions,
      directPermissions: experience.permissions || []
    });

  } catch (err) {
    backendLogger.error('Error getting experience permissions', { error: err.message, experienceId: req.params.id });
    res.status(400).json({ error: 'Failed to get permissions' });
  }
}

async function transferOwnership(req, res) {
  try {
    const { experienceId } = req.params;
    const { newOwnerId } = req.body;

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(experienceId)) {
      return res.status(400).json({ error: 'Invalid experience ID format' });
    }
    if (!mongoose.Types.ObjectId.isValid(newOwnerId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    // Find experience and verify current ownership
    const experience = await Experience.findById(experienceId);
    
    if (!experience) {
      return res.status(404).json({ error: 'Experience not found' });
    }

    // Verify current user is the owner
    if (!permissions.isOwner(req.user._id, experience)) {
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'Only the experience owner can transfer ownership.'
      });
    }

    // Verify new owner exists and has a plan for this experience
    const newOwner = await User.findById(newOwnerId);
    if (!newOwner) {
      return res.status(404).json({ error: 'New owner not found' });
    }

    // Verify the new owner has a plan for this experience
    const newOwnerPlan = await Plan.findOne({
      experience: experienceId,
      user: newOwnerId
    });

    if (!newOwnerPlan) {
      return res.status(400).json({ 
        error: 'Invalid transfer',
        message: 'The new owner must have a plan for this experience before ownership can be transferred.'
      });
    }

    // Update ownership
    // Update permissions array
    // Remove old owner's owner permission
    experience.permissions = experience.permissions.filter(
      p => !(p.entity === 'user' && p._id.toString() === req.user._id.toString() && p.type === 'owner')
    );

    // Check if new owner already has a permission entry
    const newOwnerPermIndex = experience.permissions.findIndex(
      p => p.entity === 'user' && p._id.toString() === newOwnerId
    );

    if (newOwnerPermIndex !== -1) {
      // Update existing permission to owner
      experience.permissions[newOwnerPermIndex].type = 'owner';
    } else {
      // Add new owner permission
      experience.permissions.push({
        _id: newOwnerId,
        entity: 'user',
        type: 'owner',
        granted_by: req.user._id,
        granted_at: new Date()
      });
    }

    // 3. Add previous owner as contributor (so they can still view their original creation)
    const prevOwnerExists = experience.permissions.some(
      p => p.entity === 'user' && p._id.toString() === req.user._id.toString()
    );

    if (!prevOwnerExists) {
      experience.permissions.push({
        _id: req.user._id,
        entity: 'user',
        type: 'contributor',
        granted_by: newOwnerId,
        granted_at: new Date()
      });
    }

    await experience.save();

    // Return updated experience with new owner details
    const updatedExperience = await Experience.findById(experienceId)
      .populate('destination');

    res.json({
      message: 'Ownership transferred successfully',
      experience: updatedExperience,
      previousOwner: {
        id: req.user._id,
        name: req.user.name
      },
      newOwner: {
        id: newOwner._id,
        name: newOwner.name
      }
    });

  } catch (err) {
    backendLogger.error('Error transferring ownership', { error: err.message, userId: req.user._id, experienceId: req.params.experienceId, newOwnerId: req.body.newOwnerId });
    res.status(400).json({ error: 'Failed to transfer ownership' });
  }
}

module.exports = {
  create: createExperience,
  show: showExperience,
  update: updateExperience,
  delete: deleteExperience,
  transferOwnership,
  index,
  createPlanItem,
  updatePlanItem,
  deletePlanItem,
  addUser,
  removeUser,
  userPlanItemDone,
  showUserExperiences,
  showUserCreatedExperiences,
  getTagName,
  addPhoto,
  removePhoto,
  setDefaultPhoto,
  addExperiencePermission,
  removeExperiencePermission,
  updateExperiencePermission,
  getExperiencePermissions,
};

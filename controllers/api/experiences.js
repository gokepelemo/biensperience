const mongoose = require('mongoose');
const Experience = require('../../models/experience');
const Destination = require('../../models/destination');
const User = require('../../models/user');
const Plan = require('../../models/plan');
const Photo = require('../../models/photo');
const permissions = require('../../utilities/permissions');
const { getEnforcer } = require('../../utilities/permission-enforcer');
const backendLogger = require('../../utilities/backend-logger');
const { trackCreate, trackUpdate, trackDelete } = require('../../utilities/activity-tracker');

// Helper function to escape regex special characters
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
const { findDuplicateFuzzy } = require("../../utilities/fuzzy-match");

/**
 * GET /api/experiences/tags
 * Return a list of distinct experience_type tags across experiences
 */
async function getExperienceTags(req, res) {
  try {
    // Use Mongo distinct to get experience_type entries (may be array or comma-separated strings)
    // Support server-side `q` filter to search tag labels without returning all tags
    const q = req.query.q && String(req.query.q).trim();
    let raw;
    if (q) {
      const regex = new RegExp(escapeRegex(q), 'i');
      // Query for documents where experience_type contains the regex either as a string or inside an array
      const query = {
        $or: [
          { experience_type: { $regex: regex } },
          { experience_type: { $elemMatch: { $regex: regex } } }
        ]
      };
      raw = await Experience.distinct('experience_type', query);
    } else {
      raw = await Experience.distinct('experience_type');
    }
    const tagSet = new Set();

    raw.forEach(item => {
      if (!item) return;
      if (Array.isArray(item)) {
        item.forEach(tag => {
          if (typeof tag === 'string') tagSet.add(tag.trim());
        });
      } else if (typeof item === 'string') {
        // split comma-separated strings
        item.split(',').map(t => t.trim()).forEach(t => { if (t) tagSet.add(t); });
      }
    });

    const tags = Array.from(tagSet).sort();
    res.status(200).json({ data: tags });
  } catch (err) {
    backendLogger.error('Error fetching experience tags', { error: err.message });
    res.status(400).json({ error: 'Failed to fetch tags' });
  }
}

async function index(req, res) {
  const start = Date.now();
  try {
      // Pagination support: if page or limit provided, return paginated result with meta
      const page = parseInt(req.query.page, 10);
      const limit = parseInt(req.query.limit, 10);

      // Build filter from query params (supports server-side filtering with pagination)
      const filter = {};
      if (req.query.destination) {
        // Support single or comma-separated destination values. Each value may be an ObjectId,
        // a slug, or a destination name. Resolve non-ObjectId values to ObjectId via lookup.
        const raw = String(req.query.destination || '').trim();
        const parts = raw.split(',').map(p => p.trim()).filter(Boolean);
        const resolvedIds = [];

        for (const part of parts) {
          if (mongoose.Types.ObjectId.isValid(part)) {
            // Use `new` with ObjectId to avoid runtime error in certain mongoose/bson versions
            resolvedIds.push(new mongoose.Types.ObjectId(part));
            continue;
          }

          // Try to resolve slug or exact name (case-insensitive)
          try {
            backendLogger.debug('Attempting to resolve destination part', { part });

            // If the part contains a comma, try to split into name and country
            const commaIndex = part.indexOf(',');
            let destDoc = null;

            if (commaIndex > -1) {
              const left = part.substring(0, commaIndex).trim();
              const right = part.substring(commaIndex + 1).trim();
              // Try exact-ish match on name + country
              destDoc = await Destination.findOne({
                $and: [
                  { name: { $regex: new RegExp(escapeRegex(left), 'i') } },
                  { country: { $regex: new RegExp(escapeRegex(right), 'i') } }
                ]
              }).select('_id').lean().exec();
            }

            // Fallbacks: slug, name contains, country contains
            if (!destDoc) {
              destDoc = await Destination.findOne({
                $or: [
                  { slug: part },
                  { name: { $regex: new RegExp(escapeRegex(part), 'i') } },
                  { country: { $regex: new RegExp(escapeRegex(part), 'i') } }
                ]
              }).select('_id').lean().exec();
            }

            if (destDoc && destDoc._id) {
              // destDoc._id may already be an ObjectId or a string; ensure we construct properly
              resolvedIds.push(new mongoose.Types.ObjectId(destDoc._id));
              backendLogger.debug('Resolved destination part to _id', { part, id: destDoc._id });
            } else {
              backendLogger.debug('Could not resolve destination part to any destination', { part });
            }
          } catch (err) {
            backendLogger.error('Error resolving destination part', { part, error: err.message });
          }
        }

        if (resolvedIds.length === 1) {
          filter.destination = resolvedIds[0];
        } else if (resolvedIds.length > 1) {
          filter.destination = { $in: resolvedIds };
        } else {
          // No resolvable destination parts; leave filter untouched (will match all)
          backendLogger.debug('No valid destination ids resolved from query', { raw });
        }
      }
      // Support filtering by experience type (tags). Matches array values or comma-separated strings.
      if (req.query.experience_type) {
        const et = String(req.query.experience_type).trim();
        if (et.length) {
          const regex = new RegExp(escapeRegex(et), 'i');
          // This will match if experience_type is a string that contains the tag or an array where an element matches
          filter.experience_type = { $regex: regex };
        }
      }

      const baseQuery = Experience.find(filter)
        .select('name destination photos default_photo_id permissions experience_type createdAt updatedAt')
        .slice('photos', 1)
        .populate({ path: 'photos', select: 'url caption width height' })
        .lean({ virtuals: false });

      // Default pagination: page=1, limit=30
      const p = Number.isNaN(page) || page < 1 ? 1 : page;
      const l = Number.isNaN(limit) || limit < 1 ? 30 : limit;
      const skip = (p - 1) * l;

      // Sorting support
      const sortBy = req.query.sort_by || req.query.sort || 'created-newest';
      const sortOrder = req.query.sort_order || req.query.order || 'desc';
      const sortMap = {
        'alphabetical': { name: 1 },
        'alphabetical-desc': { name: -1 },
        'created-newest': { createdAt: -1 },
        'created-oldest': { createdAt: 1 },
        'updated-newest': { updatedAt: -1 },
        'updated-oldest': { updatedAt: 1 }
      };
      const sortObj = sortMap[sortBy] || (sortOrder === 'asc' ? { createdAt: 1 } : { createdAt: -1 });

      const total = await Experience.countDocuments(filter);
  backendLogger.debug('Experiences index request', { query: req.query, filter });
      // If sorting by destination, use aggregation to lookup destination and sort by destination.name
      const isDestinationSort = sortBy === 'destination' || sortBy === 'destination-desc';
      const destSortDir = sortBy === 'destination' ? 1 : -1;

      // If ?all=true requested, return full array (compatibility)
      if (req.query.all === 'true' || req.query.all === true) {
        if (isDestinationSort) {
          const all = await Experience.aggregate([
            { $match: filter },
            // lookup destination
            { $lookup: { from: 'destinations', localField: 'destination', foreignField: '_id', as: 'destination' } },
            { $unwind: { path: '$destination', preserveNullAndEmptyArrays: true } },
            // lookup photos (keep first photo only)
            { $lookup: { from: 'photos', localField: 'photos', foreignField: '_id', as: 'photos' } },
            { $addFields: { photos: { $slice: ['$photos', 1] } } },
            { $sort: { 'destination.name': destSortDir } },
            { $project: { name: 1, destination: 1, photos: 1, default_photo_id: 1, permissions: 1, experience_type: 1, createdAt: 1, updatedAt: 1 } }
          ]).exec();
          return res.status(200).json(all);
        }

        const all = await Experience.find(filter)
          .select('name destination photos default_photo_id permissions experience_type createdAt updatedAt')
          .slice('photos', 1)
          .populate({ path: 'photos', select: 'url caption width height' })
          .sort(sortObj)
          .lean({ virtuals: false })
          .exec();
        return res.status(200).json(all);
      }

      // Apply sort and pagination
      let experiences;
      if (isDestinationSort) {
        // Use aggregation for destination sort + pagination
        const pipeline = [
          { $match: filter },
          { $lookup: { from: 'destinations', localField: 'destination', foreignField: '_id', as: 'destination' } },
          { $unwind: { path: '$destination', preserveNullAndEmptyArrays: true } },
          { $lookup: { from: 'photos', localField: 'photos', foreignField: '_id', as: 'photos' } },
          { $addFields: { photos: { $slice: ['$photos', 1] } } },
          { $sort: { 'destination.name': destSortDir } },
          { $skip: skip },
          { $limit: l },
          { $project: { name: 1, destination: 1, photos: 1, default_photo_id: 1, permissions: 1, experience_type: 1, createdAt: 1, updatedAt: 1 } }
        ];

        experiences = await Experience.aggregate(pipeline).exec();
      } else {
        experiences = await Experience.find(filter)
          .select('name destination photos default_photo_id permissions experience_type createdAt updatedAt')
          .slice('photos', 1)
          .populate({ path: 'photos', select: 'url caption width height' })
          .sort(sortObj)
          .skip(skip)
          .limit(l)
          .lean({ virtuals: false })
          .exec();
      }

      const totalPages = Math.ceil(total / l);
      backendLogger.info('Experiences index fetched (paginated)', {
        count: experiences.length,
        durationMs: Date.now() - start,
        page: p,
        limit: l,
        total,
        userId: req.user?._id
      });

      return res.status(200).json({
        data: experiences,
        meta: {
          page: p,
          limit: l,
          total,
          totalPages,
          hasMore: p < totalPages
        }
      });
  } catch (err) {
      // Log full stack and context to aid debugging
      backendLogger.error('Error fetching experiences', {
        error: err.message,
        stack: err.stack,
        query: req.query,
        filter: typeof filter !== 'undefined' ? filter : null,
        userId: req.user?._id,
        durationMs: Date.now() - start
      });

      // Return 500 to indicate server-side failure and include message for easier local debugging
      res.status(500).json({ error: 'Failed to fetch experiences', details: err.message });
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

    // Check for duplicate experiences in single optimized query
    const userExperiences = await Experience.find({
      permissions: {
        $elemMatch: {
          entity: permissions.ENTITY_TYPES.USER,
          type: permissions.ROLES.OWNER,
          _id: req.user._id
        }
      }
    })
    .select('name')
    .lean()
    .exec();

    const exactDuplicate = userExperiences.find(exp =>
      exp.name.toLowerCase() === req.body.name.toLowerCase()
    );

    if (exactDuplicate) {
      return res.status(409).json({
        error: 'Duplicate experience',
        message: `An experience named "${req.body.name}" already exists. Please choose a different name.`
      });
    }

    // Check for similar experience names
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
    
    trackCreate({
      resource: experience,
      resourceType: 'Experience',
      actor: req.user,
      req,
      reason: `Experience "${experience.name}" created`
    });
    
    res.status(201).json(experience);
  } catch (err) {
    backendLogger.error('Error creating experience', { error: err.message, userId: req.user._id, name: req.body.name, destination: req.body.destination });
    res.status(400).json({ error: 'Failed to create experience' });
  }
}

async function showExperience(req, res) {
  try {
    // OPTIMIZATION: Use lean() for read-only queries and select only needed fields
    let experience = await Experience.findById(req.params.id)
      .populate("destination")
      .populate("photos", "url caption photo_credit photo_credit_url width height")
      .populate({
        path: "permissions._id",
        populate: {
          path: "photos",
          model: "Photo",
          select: 'url caption'
        },
        select: "name photos default_photo_id"
      })
      .lean()
      .exec();

    res.status(200).json(experience);
  } catch (err) {
    backendLogger.error('Error fetching experience', { error: err.message, experienceId: req.params.id });
    res.status(400).json({ error: 'Failed to fetch experience' });
  }
}

// OPTIMIZATION: Combined endpoint for SingleExperience page
// Fetches experience + user plan + collaborative plans in ONE optimized query
// Reduces 3 separate API calls to 1, dramatically improving page load time
async function showExperienceWithContext(req, res) {
  try {
    const { id: experienceId } = req.params;
    const userId = req.user._id;

    backendLogger.debug('Fetching experience with full context', { experienceId, userId });

    // OPTIMIZATION: Simplified queries with minimal population and select fields
    // Remove nested population to reduce query complexity
    const experiencePromise = Experience.findById(experienceId)
      .populate("destination", "name city country slug")
      .populate("photos", "url caption photo_credit photo_credit_url width height")
      .select('-__v')  // Exclude version field
      .lean()
      .exec();

    // Fetch user's plan for this experience with minimal data
    const userPlanPromise = Plan.findOne({
      experience: experienceId,
      user: userId
    })
      .select('experience user planned_date plan permissions notes createdAt updatedAt')
      .lean()
      .exec();

    // Fetch all collaborative plans for this experience (where user is a collaborator)
    // Only fetch essential fields to reduce data transfer
    const collaborativePlansPromise = Plan.find({
      experience: experienceId,
      'permissions._id': userId,
      user: { $ne: userId } // Exclude user's own plan
    })
      .select('experience user planned_date plan permissions notes createdAt updatedAt')
      .lean()
      .exec();

    // Execute all queries in parallel for maximum performance
    const [experience, userPlan, collaborativePlans] = await Promise.all([
      experiencePromise,
      userPlanPromise,
      collaborativePlansPromise
    ]);

    if (!experience) {
      return res.status(404).json({ error: 'Experience not found' });
    }

    backendLogger.info('Experience context fetched', {
      experienceId,
      userId: userId.toString(),
      hasUserPlan: !!userPlan,
      collaborativePlansCount: collaborativePlans.length
    });
    // Compute total_cost for userPlan
    if (userPlan && userPlan.plan) {
      userPlan.total_cost = userPlan.plan.reduce((sum, item) => sum + (item.cost || 0), 0);
    }

    // Compute total_cost for collaborativePlans
    if (collaborativePlans && collaborativePlans.length > 0) {
      collaborativePlans.forEach(plan => {
        if (plan.plan) {
          plan.total_cost = plan.plan.reduce((sum, item) => sum + (item.cost || 0), 0);
        }
      });
    }

    // Return combined data structure
    res.status(200).json({
      experience,
      userPlan,
      collaborativePlans
    });
  } catch (err) {
    backendLogger.error('Error fetching experience with context', {
      error: err.message,
      experienceId: req.params.id,
      userId: req.user?._id
    });
    res.status(400).json({ error: 'Failed to fetch experience data' });
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
      'plan_items', 'photos', 'default_photo_id', 'permissions'
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
    
    // Capture previous state for activity tracking
    const previousState = experience.toObject();
    
    experience = Object.assign(experience, updateData);
    
    backendLogger.info('About to save experience', { experienceId, bodyKeys: Object.keys(req.body) });
    await experience.save();
    backendLogger.info('Experience saved successfully', { experienceId });
    
    // Track update (non-blocking)
    trackUpdate({
      resource: experience,
      previousState,
      resourceType: 'Experience',
      actor: req.user,
      req,
      fieldsToTrack: Object.keys(updateData),
      reason: `Experience "${experience.name}" updated`
    });
    
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
      .populate({
        path: 'user',
        select: '_id name email photos default_photo_id',
        populate: [
          {
            path: 'photos',
            model: 'Photo'
          }
        ]
      });
    
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
          photos: plan.user.photos,
          default_photo_id: plan.user.default_photo_id,
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
    
    // Track deletion (non-blocking) - must happen before deleteOne()
    trackDelete({
      resource: experience,
      resourceType: 'Experience',
      actor: req.user,
      req,
      reason: `Experience "${experience.name}" deleted`
    });
    
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
        select: "name email photo photos default_photo_id",
        populate: [
          {
            path: "photo",
            model: "Photo"
          },
          {
            path: "photos",
            model: "Photo"
          }
        ]
      })
      .populate({
        path: "permissions._id",
        populate: [
          {
            path: "photo",
            select: "url caption"
          },
          {
            path: "photos",
            model: "Photo"
          }
        ],
        select: "name photo photos default_photo_id"
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
        select: "name email photo photos default_photo_id",
        populate: [
          {
            path: "photo",
            model: "Photo"
          },
          {
            path: "photos",
            model: "Photo"
          }
        ]
      })
      .populate({
        path: "permissions._id",
        populate: [
          {
            path: "photo",
            select: "url caption"
          },
          {
            path: "photos",
            model: "Photo"
          }
        ],
        select: "name photo photos default_photo_id"
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
        select: "name email photo photos default_photo_id",
        populate: [
          {
            path: "photo",
            model: "Photo"
          },
          {
            path: "photos",
            model: "Photo"
          }
        ]
      })
      .populate({
        path: "permissions._id",
        populate: [
          {
            path: "photo",
            select: "url caption"
          },
          {
            path: "photos",
            model: "Photo"
          }
        ],
        select: "name photo photos default_photo_id"
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
        select: "name email photo photos default_photo_id",
        populate: [
          {
            path: "photo",
            model: "Photo"
          },
          {
            path: "photos",
            model: "Photo"
          }
        ]
      })
      .populate({
        path: "permissions._id",
        populate: [
          {
            path: "photo",
            select: "url caption"
          },
          {
            path: "photos",
            model: "Photo"
          }
        ],
        select: "name photo photos default_photo_id"
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
        select: "name email photo photos default_photo_id",
        populate: [
          {
            path: "photo",
            model: "Photo"
          },
          {
            path: "photos",
            model: "Photo"
          }
        ]
      })
      .populate({
        path: "permissions._id",
        populate: [
          {
            path: "photo",
            select: "url caption"
          },
          {
            path: "photos",
            model: "Photo"
          }
        ],
        select: "name photo photos default_photo_id"
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
        select: "name email photo photos default_photo_id",
        populate: [
          {
            path: "photo",
            model: "Photo"
          },
          {
            path: "photos",
            model: "Photo"
          }
        ]
      })
      .populate({
        path: "permissions._id",
        populate: [
          {
            path: "photo",
            select: "url caption"
          },
          {
            path: "photos",
            model: "Photo"
          }
        ],
        select: "name photo photos default_photo_id"
      });
    
    res.status(200).json(experience);
  } catch (err) {
    backendLogger.error('Error deleting plan item', { error: err.message, userId: req.user._id, experienceId: req.params.experienceId, planItemId: req.params.planItemId });
    res.status(400).json({ error: 'Failed to delete plan item' });
  }
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
        populate: [
          {
            path: 'destination',
            select: 'name country'
          },
          {
            path: 'photos',
            select: 'url caption'
          }
        ]
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
      .populate({
        path: 'photos',
        select: 'url caption'
      })
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

    // OPTIMIZATION: Single query with .lean() and .select() to only fetch experience_type field
    // Reduces memory usage by 90%+ (only fetching tag arrays, not full documents)
    const allExperiences = await Experience.find({
      experience_type: { $exists: true, $ne: [] }
    })
    .select('experience_type')
    .lean()
    .exec();

    if (!allExperiences || allExperiences.length === 0) {
      return res.status(404).json({ error: 'No tags found' });
    }

    // Find the matching tag name (in-memory operation)
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

    // Adjust default_photo_id if necessary
    if (experience.default_photo_id && !experience.photos.includes(experience.default_photo_id)) {
      experience.default_photo_id = experience.photos.length > 0 ? experience.photos[0] : null;
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

    experience.default_photo_id = experience.photos[photoIndex];
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

    // Add permission using enforcer (SECURE)
    const { getEnforcer } = require('../../utilities/permission-enforcer');
    const enforcer = getEnforcer({ Experience, Destination, User });
    
    const permission = { _id, entity };
    if (type) {
      permission.type = type;
    }

    const result = await enforcer.addPermission({
      resource: experience,
      permission,
      actorId: req.user._id,
      reason: 'Owner added permission via API',
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        requestPath: req.path,
        requestMethod: req.method
      }
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Permission saved by enforcer, no need to save again

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

    // Remove permission using enforcer (SECURE)
    const { getEnforcer } = require('../../utilities/permission-enforcer');
    const enforcer = getEnforcer({ Experience, Destination, User });

    const result = await enforcer.removePermission({
      resource: experience,
      permissionId: entityId,
      entityType,
      actorId: req.user._id,
      reason: 'Owner removed permission via API',
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        requestPath: req.path,
        requestMethod: req.method
      }
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
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

    // Update permission using enforcer (SECURE)
    const { getEnforcer } = require('../../utilities/permission-enforcer');
    const enforcer = getEnforcer({ Experience, Destination, User });

    const result = await enforcer.updatePermission({
      resource: experience,
      permissionId: req.params.userId,
      entityType: 'user',
      newType: type,
      actorId: req.user._id,
      reason: 'Owner updated permission type via API',
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        requestPath: req.path,
        requestMethod: req.method
      }
    });

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

    // Update ownership using PermissionEnforcer (SECURE)
    const { getEnforcer } = require('../../utilities/permission-enforcer');
    const enforcer = getEnforcer({ Destination, Experience, User });

    const transferResult = await enforcer.transferOwnership({
      resource: experience,
      oldOwnerId: req.user._id,
      newOwnerId: newOwnerId,
      actorId: req.user._id,
      reason: 'Ownership transfer requested by current owner',
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        requestPath: req.path,
        requestMethod: req.method
      }
    });

    if (!transferResult.success) {
      return res.status(400).json({
        error: 'Transfer failed',
        message: transferResult.error
      });
    }

    await experience.save();

    // OPTIMIZATION: Re-populate existing document instead of fetching again (Phase 3.1)
    // This avoids a redundant database query since we already have the experience
    await experience.populate('destination');

    res.json({
      message: 'Ownership transferred successfully',
      experience: experience,
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
  showWithContext: showExperienceWithContext,
  update: updateExperience,
  delete: deleteExperience,
  transferOwnership,
  index,
  createPlanItem,
  updatePlanItem,
  deletePlanItem,
  showUserExperiences,
  showUserCreatedExperiences,
  getTagName,
  getExperienceTags,
  addPhoto,
  removePhoto,
  setDefaultPhoto,
  addExperiencePermission,
  removeExperiencePermission,
  updateExperiencePermission,
  getExperiencePermissions,
};

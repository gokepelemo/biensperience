const mongoose = require('mongoose');
const Experience = require('../../models/experience');

// Helper function to escape regex special characters
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
const { lang } = require("../../src/lang.constants");
const { findDuplicateFuzzy } = require("../../utilities/fuzzy-match");

async function index(req, res) {
  try {
    let experiences = await Experience.find({})
      .populate("destination")
      .populate("users.user")
      .populate("user")
      .exec();
    res.status(200).json(experiences);
  } catch (err) {
    console.error('Error fetching experiences:', err);
    res.status(400).json({ error: 'Failed to fetch experiences' });
  }
}

async function createExperience(req, res) {
  try {
    req.body.user = req.user._id;

    // Get all user experiences for fuzzy checking
    const userExperiences = await Experience.find({ user: req.user._id });

    // Check for exact duplicate (case-insensitive)
    const exactDuplicate = await Experience.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(req.body.name)}$`, 'i') },
      user: req.user._id
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
    console.error('Error creating experience:', err);
    res.status(400).json({ error: 'Failed to create experience' });
  }
}

async function showExperience(req, res) {
  try {
    let experience = await Experience.findById(req.params.id)
      .populate("destination")
      .populate("users.user")
      .populate("user");
    res.status(200).json(experience);
  } catch (err) {
    console.error('Error fetching experience:', err);
    res.status(400).json({ error: 'Failed to fetch experience' });
  }
}

async function updateExperience(req, res) {
  const experienceId = req.params.experienceId || req.params.id;
  try {
    let experience = await Experience.findById(experienceId).populate("user");
    if (req.user._id.toString() !== experience.user._id.toString()) res.status(401).end();

    // Check for duplicate experience name if name is being updated
    if (req.body.name && req.body.name !== experience.name) {
      // Check for exact duplicate
      const exactDuplicate = await Experience.findOne({
        name: { $regex: new RegExp(`^${escapeRegex(req.body.name)}$`, 'i') },
        user: req.user._id,
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
        user: req.user._id,
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

    experience = Object.assign(experience, req.body);
    await experience.save();
    res.status(200).json(experience);
  } catch (err) {
    console.error('Error updating experience:', err);
    res.status(400).json({ error: 'Failed to update experience' });
  }
}

async function deleteExperience(req, res) {
  try {
    let experience = await Experience.findById(req.params.id).populate("user");
    if (req.user._id.toString() !== experience.user._id.toString()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    await experience.deleteOne();
    res.status(200).json({ message: 'Experience deleted successfully' });
  } catch (err) {
    console.error('Error deleting experience:', err);
    res.status(400).json({ error: 'Failed to delete experience' });
  }
}

async function createPlanItem(req, res) {
  try {
    let experience = await Experience.findById(req.params.experienceId)
      .populate("destination")
      .populate("user");
    if (req.user._id.toString() !== experience.user._id.toString()) res.status(401).end();
    req.body.cost_estimate = !req.body.cost_estimate
      ? 0
      : req.body.cost_estimate;
    experience.plan_items.push(req.body);
    await experience.save();
    res.status(201).json(experience);
  } catch (err) {
    console.error('Error creating plan item:', err);
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
      .populate("user");
    
    if (!experience) {
      return res.status(404).json({ error: 'Experience not found' });
    }
    
    if (req.user._id.toString() !== experience.user._id.toString()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    let plan_item = experience.plan_items.id(req.params.planItemId);
    
    if (!plan_item) {
      return res.status(404).json({ error: 'Plan item not found' });
    }
    
    // Update only provided fields (exclude _id as it's immutable)
    const { _id, ...updateData } = req.body;
    Object.assign(plan_item, updateData);
    await experience.save();
    res.status(200).json(experience);
  } catch (err) {
    console.error('Error updating plan item:', err);
    res.status(400).json({ error: 'Failed to update plan item' });
  }
}

async function deletePlanItem(req, res) {
  try {
    let experience = await Experience.findById(req.params.experienceId)
      .populate("destination")
      .populate("user");
    if (req.user._id.toString() !== experience.user._id.toString()) res.status(401).end();
    experience.plan_items.id(req.params.planItemId).deleteOne();
    await experience.save();
    experience.users.forEach((user, index) => {
      experience.users[index].user = Object.assign(user.user, {
        password: null,
        email: null,
      });
    });
    res.status(200).json(experience);
  } catch (err) {
    console.error('Error deleting plan item:', err);
    res.status(400).json({ error: 'Failed to delete plan item' });
  }
}

async function addUser(req, res) {
  try {
    let experience = await Experience.findById(req.params.experienceId)
      .populate("destination")
      .populate("users.user");

    // Check if user already exists using consistent ID comparison
    const userExists = experience.users.some(
      (u) => u.user._id.toString() === req.params.userId
    );

    if (!userExists) {
      let newUser = {
        user: req.params.userId,
        plan: [],
        planned_date: req.body.planned_date ? new Date(req.body.planned_date) : null,
      };
      experience.users.push(newUser);

      // Save and wait for completion before responding
      await experience.save();

      // Re-fetch to get populated data
      experience = await Experience.findById(req.params.experienceId)
        .populate("destination")
        .populate("users.user");
    } else {
      console.log(lang.en.logMessages.userAlreadyAdded);
    }

    // Sanitize user data
    experience.users.forEach((user, index) => {
      experience.users[index].user = Object.assign(user.user, {
        password: null,
        email: null,
      });
    });

    res.status(201).json(experience);
  } catch (err) {
    console.error('Error adding user to experience:', err);
    res.status(400).json({ error: 'Failed to add user to experience' });
  }
}

async function removeUser(req, res) {
  try {
    let experience = await Experience.findById(req.params.experienceId)
      .populate("destination")
      .populate("users.user");

    // Find user index using consistent ID comparison
    const idx = experience.users.findIndex(
      (u) => u.user._id.toString() === req.params.userId
    );

    if (idx !== -1) {
      experience.users.splice(idx, 1);

      // Save and wait for completion before responding
      await experience.save();

      // Re-fetch to get populated data
      experience = await Experience.findById(req.params.experienceId)
        .populate("destination")
        .populate("users.user");
    } else {
      console.log(lang.en.logMessages.userRemovedFromExperience);
    }

    // Sanitize user data
    experience.users.forEach((user, index) => {
      experience.users[index].user = Object.assign(user.user, {
        password: null,
        email: null,
      });
    });

    res.status(200).json(experience);
  } catch (err) {
    console.error('Error removing user from experience:', err);
    res.status(400).json({ error: 'Failed to remove user from experience' });
  }
}

async function userPlanItemDone(req, res) {
  try {
    let experience = await Experience.findById(req.params.experienceId)
      .populate("users.user")
      .populate("destination");
    let user = experience.users.findIndex(
      (expUser) => expUser.user.id === req.user._id
    );
    // If user is not in the experience, add them first
    if (user === -1) {
      let newUser = {
        user: req.user._id,
        plan: [],
        planned_date: null,
      };
      experience.users.push(newUser);
      user = experience.users.length - 1;
    }
    let plan_idx = experience.users[user].plan.indexOf(req.params.planItemId);
    if (plan_idx === -1) {
      experience.users[user].plan.push(req.params.planItemId);
      await experience.save();
      res.status(201).json(experience);
    } else {
      experience.users[user].plan.splice(plan_idx, 1);
      await experience.save();
      res.status(200).json(experience);
    }
  } catch (err) {
    console.error('Error marking plan item done:', err);
    res.status(400).json({ error: 'Failed to mark plan item done' });
  }
}

async function showUserExperiences(req, res) {
  try {
    let experiences = await Experience.find({ "users.user": req.params.userId })
      .populate("users.user")
      .populate("destination")
      .exec();
    res.status(200).json(experiences);
  } catch (err) {
    console.error('Error fetching user experiences:', err);
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

    let experiences = await Experience.find({ user: userId })
      .populate("users.user")
      .populate("destination")
      .populate("user")
      .exec();
    res.status(200).json(experiences);
  } catch (err) {
    console.error('Error fetching user created experiences:', err);
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
    console.error('Error finding tag by slug:', err);
    res.status(400).json({ error: 'Failed to find tag' });
  }
}

async function addPhoto(req, res) {
  try {
    const experience = await Experience.findById(req.params.id).populate("user");

    if (!experience) {
      return res.status(404).json({ error: 'Experience not found' });
    }

    if (req.user._id.toString() !== experience.user._id.toString()) {
      return res.status(401).json({ error: 'Not authorized to modify this experience' });
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
    console.error('Error adding photo to experience:', err);
    res.status(400).json({ error: 'Failed to add photo' });
  }
}

async function removePhoto(req, res) {
  try {
    const experience = await Experience.findById(req.params.id).populate("user");

    if (!experience) {
      return res.status(404).json({ error: 'Experience not found' });
    }

    if (req.user._id.toString() !== experience.user._id.toString()) {
      return res.status(401).json({ error: 'Not authorized to modify this experience' });
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
    console.error('Error removing photo from experience:', err);
    res.status(400).json({ error: 'Failed to remove photo' });
  }
}

async function setDefaultPhoto(req, res) {
  try {
    const experience = await Experience.findById(req.params.id).populate("user");

    if (!experience) {
      return res.status(404).json({ error: 'Experience not found' });
    }

    if (req.user._id.toString() !== experience.user._id.toString()) {
      return res.status(401).json({ error: 'Not authorized to modify this experience' });
    }

    const photoIndex = parseInt(req.body.photoIndex);

    if (photoIndex < 0 || photoIndex >= experience.photos.length) {
      return res.status(400).json({ error: 'Invalid photo index' });
    }

    experience.default_photo_index = photoIndex;
    await experience.save();

    res.status(200).json(experience);
  } catch (err) {
    console.error('Error setting default photo:', err);
    res.status(400).json({ error: 'Failed to set default photo' });
  }
}

module.exports = {
  create: createExperience,
  show: showExperience,
  update: updateExperience,
  delete: deleteExperience,
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
};

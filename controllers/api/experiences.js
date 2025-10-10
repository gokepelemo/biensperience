const Experience = require("../../models/experience");
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
      name: { $regex: new RegExp(`^${req.body.name}$`, 'i') },
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
    res.status(400).json(err);
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
        name: { $regex: new RegExp(`^${req.body.name}$`, 'i') },
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
    res.status(400).json(err);
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
    res.status(400).json(err);
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
    res.status(400).json(err);
  }
}

async function updatePlanItem(req, res) {
  try {
    let experience = await Experience.findById(req.params.experienceId)
      .populate("destination")
      .populate("user");
    if (req.user._id.toString() !== experience.user._id.toString()) res.status(401).end();
    let plan_item = experience.plan_items.id(req.params.planItemId);
    Object.assign(plan_item, req.body);
    await experience.save();
    res.status(200).json(experience);
  } catch (err) {
    res.status(400).json(err);
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
    res.status(400).json(err);
  }
}

async function addUser(req, res) {
  try {
    let experience = await Experience.findById(req.params.experienceId)
      .populate("destination")
      .populate("users.user");
    let idx = experience.users
      .map((user) => user.user)
      .indexOf(req.params.userId);
    if (idx === -1) {
      let newUser = {
        user: req.params.userId,
        plan: [],
        planned_date: req.body.planned_date ? new Date(req.body.planned_date) : null,
      };
      experience.users.push(newUser);
    } else {
      console.log(lang.en.logMessages.userAlreadyAdded);
    }
    experience.users.forEach((user, index) => {
      experience.users[index].user = Object.assign(user.user, {
        password: null,
        email: null,
      });
    });
    experience.save();
    res.status(201).json(experience);
  } catch (err) {
    res.status(400).json(err);
  }
}

async function removeUser(req, res) {
  try {
    let experience = await Experience.findById(req.params.experienceId)
      .populate("destination")
      .populate("users.user");
    let idx = experience.users
      .map((user) => user.user.id)
      .indexOf(req.params.userId);
    if (idx !== -1) {
      experience.users.splice(idx, 1);
    } else {
      console.log(lang.en.logMessages.userRemovedFromExperience);
    }
    experience.save();
    experience.users.forEach((user, index) => {
      experience.users[index].user = Object.assign(user.user, {
        password: null,
        email: null,
      });
    });
    res.status(200).json(experience);
  } catch (err) {
    res.status(400).json(err);
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
    res.status(400).json(err);
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
    res.status(400).json(err);
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
    res.status(400).json(err);
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
  getTagName,
};

const Experience = require("../../models/experience");

async function index(req, res) {
  try {
    let experiences = await Experience.find({})
      .populate("destination")
      .populate("users.user")
      .populate("user")
      .exec();
    res.status(200).json(experiences);
  } catch (err) {
    res.status(400).json(err);
  }
}

async function createExperience(req, res) {
  try {
    req.body.user = req.user._id;
    let experience = await Experience.create(req.body);
    res.status(201).json(experience);
  } catch (err) {
    res.status(400).json(err);
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
  const experienceId = req.params.experienceId ? req.params.experienceId : id;
  try {
    let experience = await Experience.findById(experienceId).populate("user");
    if (req.user._id !== experience.user._id) res.status(401).end();
    experience = Object.assign(experience, req.body);
    experience.save();
    res.status(200).json(experience);
  } catch (err) {
    res.status(400).json(err);
  }
}

async function deleteExperience(req, res) {
  try {
    let experience = await Experience.findById(req.params.id).populate("user");
    if (req.user._id !== experience.user._id) res.status(401).end();
    experience.deleteOne();
    res.status(200).end();
  } catch (err) {
    res.status(400).json(err);
  }
}

async function createPlanItem(req, res) {
  try {
    let experience = await Experience.findById(req.params.experienceId)
      .populate("destination")
      .populate("user");
    if (req.user._id !== experience.user._id) res.status(401).end();
    req.body.cost_estimate = !req.body.cost_estimate
      ? 0
      : req.body.cost_estimate;
    experience.plan_items.push(req.body);
    experience.save();
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
    if (req.user._id !== experience.user._id) res.status(401).end();
    let plan_item = experience.plan_items.id(req.params.planItemId);
    plan_item = Object.assign(plan_item, req.body);
    experience.save();
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
    if (req.user._id !== experience.user._id) res.status(401).end();
    experience.plan_items.id(req.params.planItemId).deleteOne();
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
      };
      experience.users.push(newUser);
    } else {
      console.log("User is already added.");
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
      console.log("User isn't added to this experience anymore.");
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
    let plan_idx = experience.users[user].plan.indexOf(req.params.planItemId);
    if (plan_idx === -1) {
      experience.users[user].plan.push(req.params.planItemId);
      experience.save();
      res.status(201).json(experience);
    } else {
      experience.users[user].plan.splice(plan_idx, 1);
      experience.save();
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
};

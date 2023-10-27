const Experience = require("../../models/experience");

async function index(req, res) {
  try {
    const experiences = await Experience.find({});
    return res.json(experiences);
  } catch (err) {
    res.status(400).json(err);
  }
}

async function createExperience(req, res) {
  try {
    const experience = await Experience.create(req.body);
    return res.json(experience);
  } catch (err) {
    res.status(400).json(err);
  }
}

async function showExperience(req, res) {
  try {
    const experience = await Experience.findById(req.params.id).populate(
      "destination"
    );
    return res.json(experience);
  } catch (err) {
    res.status(400).json(err);
  }
}

async function updateExperience(req, res) {
  const experienceId = req.params.experienceId ? req.params.experienceId : id;
  try {
    let experience = await Experience.findById(experienceId);
    experience = Object.assign(experience, req.body);
    await experience.save();
    return res.json(experience);
  } catch (err) {
    res.status(400).json(err);
  }
}

async function deleteExperience(req, res) {
  try {
    const experience = await Experience.findByIdAndDelete(req.params.id);
    return res.json(experience);
  } catch (err) {
    res.status(400).json(err);
  }
}

async function createPlanItem(req, res) {
  try {
    let experience = await Experience.findById(req.params.experienceId);
    let plan_item = experience.plan_items.create(req.body);
    res.json(experience);
  } catch (err) {
    res.status(400).json(err);
  }
}

async function updatePlanItem(req, res) {
  try {
    let experience = await Experience.findById(req.params.experienceId);
    let plan_item = experience.plan_items.id(req.params.planItemId);
    plan_item = Object.assign(plan_item, req.body);
    experience.save();
    res.json(experience);
  } catch (err) {
    res.status(400).json(err);
  }
}

async function deletePlanItem(req, res) {
  try {
    let experience = await Experience.findById(req.params.experienceId);
    experience.plan_items.id(req.params.planItemId).deleteOne();
    res.json(experience);
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
  deletePlanItem
};

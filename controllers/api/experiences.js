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
    const experience = await Experience.findById(req.params.id).populate("destination");
    return res.json(experience);
  } catch (err) {
    res.status(400).json(err);
  }
}

async function updateExperience(req, res) {
  const experienceId = req.params.experienceId ? req.params.experienceId : id;
  try {
    let experience = await Experience.findById(experienceId);
    if (req.params.experienceId && req.method == "POST") {
      experience.planItems.create(req.body);
    } else if (req.params.planItemId && req.method == "PUT") {
      let planItem = experience.planItems.id(req.params.planItemId);
      Object.assign(planItem, req.body);
    } else if (req.params.planItemId && req.method == "DELETE") {
      let planItem = experience.planItems.id(req.params.planItemId).deleteOne();
    } else {
      Object.assign(experience, req.body);
    }
    await experience.save();
    return res.json(experience);
  } catch (err) {
    res.status(400).json(err);
  }
}

async function deleteExperience(req, res) {
  try {
    const experience = await Experience.findByIdAndDelete(req.body);
    return res.json(experience);
  } catch (err) {
    res.status(400).json(err);
  }
}

module.exports = {
  create: createExperience,
  show: showExperience,
  update: updateExperience,
  delete: deleteExperience,
  index
};

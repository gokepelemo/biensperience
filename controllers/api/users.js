const User = require("../../models/user");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

function createJWT(user) {
  return jwt.sign({ user }, process.env.SECRET, { expiresIn: "24h" });
}

async function create(req, res) {
  try {
    const user = await User.create(req.body);
    const token = createJWT(user);
    res.json(token);
  } catch (err) {
    res.status(400).json(err);
  }
}

async function login(req, res) {
  try {
    const user = await User.findOne({ email: req.body.email });
    const passwordTest = await bcrypt.compare(req.body.password, user.password);
    const token = passwordTest ? createJWT(user) : null;
    res.json(token);
  } catch (err) {
    res.status(400).json(err);
  }
}

function checkToken(req, res) {
  res.json(req.exp);
}

async function getUser(req, res) {
  try {
    const user = await User.findById(req.params.id);
    res.json(user);
  } catch (err) {
    res.status(400).json(err);
  }
}

async function addExperience(req, res) {
  try {
    if (req.user._id !== req.params.userId) res.status(401).json(err);
    let user = await User.findById(req.params.userId);
    let idx = user.experiences.findIndex(
      (experience) => experience.experience.id === req.params.experienceId
    );
    if (idx === -1) {
      let newExperience = {
        experience: req.params.experienceId,
        plan: [],
      };
      user.experiences.push(newExperience);
      await user.save();
    } else {
      console.log("Experience is already added.")
    }
    return res.status(200).json(user);
  } catch (err) {
    res.status(400).json(err);
  }
}

async function removeExperience(req, res) {
  try {
    let user = await User.findById(req.params.userId);
    let idx = user.experiences.findIndex(
      (experience) => experience.experience.id === req.params.experienceId
    );
    if(idx !== -1) {
      user.experiences.splice(idx, 1);
      await user.save();
    } else {
      console.log("Experience isn't added to this user anymore.")
    }
    return res.status(200).json(user);
  } catch (err) {
    res.status(400).json(err);
  }
}

module.exports = {
  create,
  login,
  checkToken,
  addExperience,
  removeExperience,
  getUser,
};

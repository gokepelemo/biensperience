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
    res.status(201).json(token);
  } catch (err) {
    res.status(400).json(err);
  }
}

async function login(req, res) {
  try {
    const user = await User.findOne({ email: req.body.email }).populate(
      "photo"
    );
    const passwordTest = await bcrypt.compare(req.body.password, user.password);
    const token = passwordTest ? createJWT(user) : null;
    res.status(200).json(token);
  } catch (err) {
    console.log(err);
    res.status(400).json(err);
  }
}

function checkToken(req, res) {
  res.status(200).json(req.exp);
}

async function getUser(req, res) {
  try {
    const user = await User.findById(req.params.id).populate("photo");
    res.status(200).json(user);
  } catch (err) {
    res.status(400).json(err);
  }
}

async function updateUser(req, res, next) {
  let user;
  try {
    user = await User.findByIdAndUpdate(req.params.id, req.body).populate("photo");
    res.status(200).json(user);
  } catch (err) {
    res.status(400).json(err);
  }
}

module.exports = {
  create,
  login,
  checkToken,
  getUser,
  updateUser,
};

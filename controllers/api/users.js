const User = require("../../models/user");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const SALT_ROUNDS = process.env.SALT_ROUNDS;

function createJWT(user) {
  return jwt.sign({ user }, process.env.SECRET, { expiresIn: "24h" });
}

async function hashPassword(password) {
  await bcrypt.hash(password, 6).then(hash => {
    return hash
  })
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
    const user = await User.findOne({ email: req.body.email }).populate(
      "photo"
    );
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
    const user = await User.findById(req.params.id).populate("photo");
    res.json(user);
  } catch (err) {
    res.status(400).json(err);
  }
}

async function updateUser(req, res, next) {
  let user;
  try {
    delete req.body.password;
    user = await User.findByIdAndUpdate(req.params.id, req.body).populate("photo");
    res.json(user);
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

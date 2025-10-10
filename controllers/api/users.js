const User = require("../../models/user");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");

function createJWT(user) {
  return jwt.sign({ user }, process.env.SECRET, { expiresIn: "24h" });
}

async function create(req, res) {
  try {
    const user = await User.create(req.body);
    const token = createJWT(user);
    res.status(201).json(token);
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(400).json({ error: 'Failed to create user' });
  }
}

async function login(req, res) {
  try {
    // Validate email format to prevent injection - use safer validation
    const email = req.body.email;
    if (!email || typeof email !== 'string' || email.length > 254 || email.length < 3) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Basic email validation - check for @ and . with reasonable positioning
    const hasAt = email.includes('@');
    const hasDot = email.includes('.');
    const atPosition = email.indexOf('@');
    const lastDotPosition = email.lastIndexOf('.');

    if (!hasAt || !hasDot || atPosition < 1 || lastDotPosition < atPosition + 2 || lastDotPosition >= email.length - 1) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const user = await User.findOne({ email: email }).populate(
      "photo"
    );
    const passwordTest = await bcrypt.compare(req.body.password, user.password);
    const token = passwordTest ? createJWT(user) : null;
    res.status(200).json(token);
  } catch (err) {
    console.log(err);
    console.error('Error logging in user:', err);
    res.status(400).json({ error: 'Failed to login' });
  }
}

function checkToken(req, res) {
  res.status(200).json(req.exp);
}

async function getUser(req, res) {
  try {
    // Validate ObjectId format and convert to prevent injection
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    const userId = new mongoose.Types.ObjectId(req.params.id);

    const user = await User.findOne({ _id: userId }).populate("photo");
    res.status(200).json(user);
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(400).json({ error: 'Failed to fetch user' });
  }
}

async function updateUser(req, res, next) {
  let user;
  try {
    // Validate ObjectId format and convert to prevent injection
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    const userId = new mongoose.Types.ObjectId(req.params.id);

    // Whitelist allowed fields to prevent mass assignment vulnerabilities
    const allowedFields = ['name', 'email'];
    const updateData = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    // Validate email format if being updated
    if (updateData.email) {
      const email = updateData.email;
      if (typeof email !== 'string' || email.length > 254 || email.length < 3) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      const hasAt = email.includes('@');
      const hasDot = email.includes('.');
      const atPosition = email.indexOf('@');
      const lastDotPosition = email.lastIndexOf('.');

      if (!hasAt || !hasDot || atPosition < 1 || lastDotPosition < atPosition + 2 || lastDotPosition >= email.length - 1) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
    }

    user = await User.findOneAndUpdate({ _id: userId }, updateData, { new: true }).populate("photo");
    res.status(200).json(user);
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(400).json({ error: 'Failed to update user' });
  }
}

module.exports = {
  create,
  login,
  checkToken,
  getUser,
  updateUser,
};

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
    
    // Return 404 if user doesn't exist
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
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
    const allowedFields = ['name', 'email', 'photos', 'default_photo_index', 'password', 'oldPassword'];
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

    // Handle password update if provided
    if (updateData.password) {
      if (!updateData.oldPassword) {
        return res.status(400).json({ error: 'Old password is required to change password' });
      }

      // Get the user to verify old password
      const userToUpdate = await User.findOne({ _id: userId });
      if (!userToUpdate) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Verify old password
      const bcrypt = require('bcrypt');
      const isMatch = await bcrypt.compare(updateData.oldPassword, userToUpdate.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      // Validate new password
      if (typeof updateData.password !== 'string' || updateData.password.length < 3) {
        return res.status(400).json({ error: 'New password must be at least 3 characters' });
      }
    }

    // Validate update data to ensure it's safe
    const validatedUpdateData = {};
    if (updateData.name && typeof updateData.name === 'string' && updateData.name.length <= 100) {
      validatedUpdateData.name = updateData.name.trim();
    }
    if (updateData.email && typeof updateData.email === 'string' && updateData.email.length <= 254) {
      validatedUpdateData.email = updateData.email.trim();
    }
    
    // Validate photos array if provided
    if (updateData.photos !== undefined) {
      if (Array.isArray(updateData.photos)) {
        // Validate each photo object
        const validPhotos = updateData.photos.filter(photo => {
          return photo && 
                 typeof photo === 'object' && 
                 typeof photo.url === 'string' && 
                 photo.url.length > 0 &&
                 photo.url.length <= 2048; // Reasonable URL length limit
        });
        validatedUpdateData.photos = validPhotos;
      }
    }
    
    // Validate default_photo_index if provided
    if (updateData.default_photo_index !== undefined) {
      const index = parseInt(updateData.default_photo_index);
      if (!isNaN(index) && index >= 0 && index < 1000) { // Reasonable max photos limit
        validatedUpdateData.default_photo_index = index;
      }
    }

    // Add password to validated data if it passed validation
    if (updateData.password) {
      validatedUpdateData.password = updateData.password;
    }

    user = await User.findOneAndUpdate({ _id: userId }, validatedUpdateData, { new: true }).populate("photo");
    res.status(200).json(user);
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(400).json({ error: 'Failed to update user' });
  }
}

async function addPhoto(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (req.user._id.toString() !== user._id.toString()) {
      return res.status(401).json({ error: 'Not authorized to modify this user profile' });
    }

    const { url, photo_credit, photo_credit_url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'Photo URL is required' });
    }

    // Add photo to photos array
    user.photos.push({
      url,
      photo_credit: photo_credit || 'Unknown',
      photo_credit_url: photo_credit_url || url
    });

    await user.save();

    res.status(201).json(user);
  } catch (err) {
    console.error('Error adding photo to user:', err);
    res.status(400).json({ error: 'Failed to add photo' });
  }
}

async function removePhoto(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (req.user._id.toString() !== user._id.toString()) {
      return res.status(401).json({ error: 'Not authorized to modify this user profile' });
    }

    const photoIndex = parseInt(req.params.photoIndex);

    if (photoIndex < 0 || photoIndex >= user.photos.length) {
      return res.status(400).json({ error: 'Invalid photo index' });
    }

    // Remove photo from array
    user.photos.splice(photoIndex, 1);

    // Adjust default_photo_index if necessary
    if (user.default_photo_index >= user.photos.length) {
      user.default_photo_index = Math.max(0, user.photos.length - 1);
    }

    await user.save();

    res.status(200).json(user);
  } catch (err) {
    console.error('Error removing photo from user:', err);
    res.status(400).json({ error: 'Failed to remove photo' });
  }
}

async function setDefaultPhoto(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (req.user._id.toString() !== user._id.toString()) {
      return res.status(401).json({ error: 'Not authorized to modify this user profile' });
    }

    const photoIndex = parseInt(req.body.photoIndex);

    if (photoIndex < 0 || photoIndex >= user.photos.length) {
      return res.status(400).json({ error: 'Invalid photo index' });
    }

    user.default_photo_index = photoIndex;
    await user.save();

    res.status(200).json(user);
  } catch (err) {
    console.error('Error setting default photo:', err);
    res.status(400).json({ error: 'Failed to set default photo' });
  }
}

module.exports = {
  create,
  login,
  checkToken,
  getUser,
  updateUser,
  addPhoto,
  removePhoto,
  setDefaultPhoto,
};

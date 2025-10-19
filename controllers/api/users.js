const User = require("../../models/user");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const { USER_ROLES } = require("../../utilities/user-roles");
const { isSuperAdmin } = require("../../utilities/permissions");
const backendLogger = require("../../utilities/backend-logger");

function createJWT(user) {
  return jwt.sign({ user }, process.env.SECRET, { expiresIn: "24h" });
}

async function create(req, res) {
  try {
    // Validate required fields
    if (!req.body.email || !req.body.password || !req.body.name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    // Validate password strength
    if (typeof req.body.password !== 'string' || req.body.password.length < 3) {
      return res.status(400).json({ error: 'Password must be at least 3 characters long' });
    }

    // Validate email format
    const email = req.body.email;
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

    const user = await User.create(req.body);
    const token = createJWT(user);
    res.status(201).json(token);
  } catch (err) {
    backendLogger.error('Error creating user', { error: err.message, email: req.body.email, name: req.body.name });
    // Check for duplicate email error
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Email already exists' });
    }
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

    const user = await User.findOne({ email: email }).populate("photo");
    
    // Check if user exists before attempting password comparison
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const passwordTest = await bcrypt.compare(req.body.password, user.password);
    
    if (!passwordTest) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = createJWT(user);
    res.status(200).json(token);
  } catch (err) {
    backendLogger.error('Error logging in user', { error: err.message, email: req.body.email });
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
    backendLogger.error('Error fetching user', { error: err.message, userId: req.params.id });
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

    // Generate new JWT token with updated user data
    const token = createJWT(user);
    res.status(200).json({ user, token });
  } catch (err) {
    backendLogger.error('Error updating user', { error: err.message, userId: req.params.id });
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

    // Generate new JWT token with updated user data
    const token = createJWT(user);
    res.status(201).json({ user, token });
  } catch (err) {
    backendLogger.error('Error adding photo to user', { error: err.message, userId: req.params.id, url: req.body.url });
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

    // Generate new JWT token with updated user data
    const token = createJWT(user);
    res.status(200).json({ user, token });
  } catch (err) {
    backendLogger.error('Error removing photo from user', { error: err.message, userId: req.params.id, photoIndex: req.params.photoIndex });
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

    // Generate new JWT token with updated user data
    const token = createJWT(user);
    res.status(200).json({ user, token });
  } catch (err) {
    backendLogger.error('Error setting default photo', { error: err.message, userId: req.params.id, photoIndex: req.body.photoIndex });
    res.status(400).json({ error: 'Failed to set default photo' });
  }
}

async function searchUsers(req, res) {
  try {
    const { q } = req.query;
    
    if (!q || typeof q !== 'string' || q.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    // Escape special regex characters to prevent regex injection
    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const sanitizedQuery = escapeRegex(q);

    // Search by name or email (case-insensitive)
    const users = await User.find({
      $or: [
        { name: { $regex: sanitizedQuery, $options: 'i' } },
        { email: { $regex: sanitizedQuery, $options: 'i' } }
      ]
    })
    .select('_id name email') // Only return necessary fields
    .limit(10); // Limit results to 10

    res.json(users);
  } catch (err) {
    backendLogger.error('Error searching users', { error: err.message, query: req.query.q });
    res.status(500).json({ error: 'Failed to search users' });
  }
}

async function getAllUsers(req, res) {
  try {
    // Only super admins can get all users
    if (!isSuperAdmin(req.user)) {
      return res.status(403).json({ error: 'Access denied. Super admin privileges required.' });
    }

    const users = await User.find({})
      .select('name email role createdAt')
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (err) {
    backendLogger.error('Error getting all users', { error: err.message, userId: req.user._id });
    res.status(500).json({ error: 'Failed to get users' });
  }
}

async function updateUserRole(req, res) {
  try {
    // Only super admins can update user roles
    if (!isSuperAdmin(req.user)) {
      return res.status(403).json({ error: 'Only super admins can update user roles' });
    }

    const { id } = req.params;
    const { role } = req.body;

    // Validate role
    if (!Object.values(USER_ROLES).includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Prevent super admin from removing their own super admin status
    if (req.user._id.toString() === id && role !== USER_ROLES.SUPER_ADMIN) {
      return res.status(400).json({ error: 'Cannot remove super admin status from yourself' });
    }

    // Find and update user
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update role and isSuperAdmin flag
    user.role = role;
    user.isSuperAdmin = role === USER_ROLES.SUPER_ADMIN;
    await user.save();

    res.json({ message: 'User role updated successfully', user: { _id: user._id, name: user.name, email: user.email, role: user.role, isSuperAdmin: user.isSuperAdmin } });
  } catch (err) {
    backendLogger.error('Error updating user role', { error: err.message, userId: req.user._id, targetUserId: req.params.id, newRole: req.body.role });
    res.status(500).json({ error: 'Failed to update user role' });
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
  searchUsers,
  updateUserRole,
  getAllUsers,
};

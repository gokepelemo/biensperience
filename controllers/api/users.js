const User = require("../../models/user");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const mongoose = require("mongoose");
const { USER_ROLES } = require("../../utilities/user-roles");
const { isSuperAdmin } = require("../../utilities/permissions");
const backendLogger = require("../../utilities/backend-logger");
const photoUtils = require("../../utilities/photo-utils");

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

    // Generate email confirmation token
    const confirmToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(confirmToken).digest('hex');

    user.emailConfirmationToken = hashedToken;
    user.emailConfirmationExpires = Date.now() + 24 * 3600000; // 24 hours
    await user.save();

    // Send confirmation email
    try {
      const confirmUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/confirm-email/${confirmToken}`;
      const { sendEmailConfirmation } = require('../../utilities/email-service');
      await sendEmailConfirmation(user.email, user.name, confirmUrl);
      backendLogger.info('Email confirmation sent', { email: user.email, userId: user._id });
    } catch (emailError) {
      backendLogger.error('Failed to send confirmation email', { error: emailError.message, email: user.email });
      // Don't fail signup if email fails - user can resend
    }

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

    // Check if user is updating their own profile or is a super admin
    if (req.user._id.toString() !== userId.toString() && !isSuperAdmin(req.user)) {
      return res.status(403).json({ error: 'You can only update your own profile' });
    }

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

async function updateUserAsAdmin(req, res) {
  try {
    // Check if requester is a super admin
    if (!isSuperAdmin(req.user)) {
      return res.status(403).json({ error: 'Super admin access required' });
    }

    // Validate ObjectId format and convert to prevent injection
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    const userId = new mongoose.Types.ObjectId(req.params.id);

    // Whitelist allowed fields for admin updates (includes emailConfirmed)
    const allowedFields = ['name', 'email', 'photos', 'default_photo_index', 'password', 'emailConfirmed'];
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

    // Validate emailConfirmed field
    if (updateData.emailConfirmed !== undefined) {
      if (typeof updateData.emailConfirmed !== 'boolean') {
        return res.status(400).json({ error: 'emailConfirmed must be a boolean' });
      }
    }

    // Handle password update if provided (no old password required for admin)
    if (updateData.password) {
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

    // Add emailConfirmed to validated data if provided
    if (updateData.emailConfirmed !== undefined) {
      validatedUpdateData.emailConfirmed = updateData.emailConfirmed;
    }

    const user = await User.findOneAndUpdate({ _id: userId }, validatedUpdateData, { new: true }).populate("photo");

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    backendLogger.info('User updated by admin', {
      adminId: req.user._id,
      adminEmail: req.user.email,
      targetUserId: user._id,
      targetUserEmail: user.email,
      changes: Object.keys(validatedUpdateData)
    });

    res.status(200).json({ user });
  } catch (err) {
    backendLogger.error('Error updating user as admin', { error: err.message, userId: req.params.id, adminId: req.user._id });
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

    // Get the photo ID before removing
    const photoId = user.photos[photoIndex]._id;

    // Remove photo using utility (handles default photo adjustment)
    const removed = photoUtils.removePhoto(user, photoId);

    if (!removed) {
      return res.status(400).json({ error: 'Failed to remove photo' });
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

    // Support both photoId (new) and photoIndex (legacy) params
    const photoId = req.body.photoId;
    const photoIndex = req.body.photoIndex !== undefined ? parseInt(req.body.photoIndex) : null;

    let success;
    if (photoId) {
      // New method: Use photo ID
      success = photoUtils.setDefaultPhotoById(user, photoId);
    } else if (photoIndex !== null) {
      // Legacy method: Use photo index
      success = photoUtils.setDefaultPhotoByIndex(user, photoIndex);
    } else {
      return res.status(400).json({ error: 'photoId or photoIndex required' });
    }

    if (!success) {
      return res.status(400).json({ error: 'Invalid photo ID or index' });
    }

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

/**
 * Request password reset
 * Generates a reset token and sends email
 */
async function requestPasswordReset(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // Always return success to prevent email enumeration attacks
    if (!user) {
      backendLogger.info('Password reset requested for non-existent email', { email });
      return res.json({ message: 'If an account exists, a reset email has been sent' });
    }

    // Check if user uses OAuth (no password to reset)
    if (user.provider !== 'local') {
      backendLogger.info('Password reset requested for OAuth user', { email, provider: user.provider });
      return res.json({ message: 'If an account exists, a reset email has been sent' });
    }

    // Generate reset token (32 bytes = 64 hex characters)
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Hash the token before storing
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Set token and expiration (1 hour from now)
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Send email with reset link
    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;

    try {
      const { sendPasswordResetEmail } = require('../../utilities/email-service');
      await sendPasswordResetEmail(user.email, user.name, resetUrl);
      backendLogger.info('Password reset email sent', { email: user.email, userId: user._id });
    } catch (emailError) {
      backendLogger.error('Failed to send password reset email', { error: emailError.message, email: user.email });
      // Clear the token since email failed
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();
      return res.status(500).json({ error: 'Failed to send reset email. Please try again.' });
    }

    res.json({ message: 'If an account exists, a reset email has been sent' });
  } catch (err) {
    backendLogger.error('Error requesting password reset', { error: err.message });
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
}

/**
 * Reset password with token
 */
async function resetPassword(req, res) {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    // Validate password strength
    if (typeof password !== 'string' || password.length < 3) {
      return res.status(400).json({ error: 'Password must be at least 3 characters long' });
    }

    // Hash the token to match what's stored
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid token
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      backendLogger.warn('Invalid or expired password reset token');
      return res.status(400).json({ error: 'Password reset token is invalid or has expired' });
    }

    // Update password (will be hashed by pre-save hook)
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    backendLogger.info('Password reset successful', { userId: user._id, email: user.email });

    // Send confirmation email
    try {
      const { sendPasswordResetConfirmation } = require('../../utilities/email-service');
      await sendPasswordResetConfirmation(user.email, user.name);
    } catch (emailError) {
      backendLogger.error('Failed to send password reset confirmation', { error: emailError.message });
      // Don't fail the request if confirmation email fails
    }

    res.json({ message: 'Password has been reset successfully' });
  } catch (err) {
    backendLogger.error('Error resetting password', { error: err.message });
    res.status(500).json({ error: 'Failed to reset password' });
  }
}

/**
 * Confirm email with token
 */
async function confirmEmail(req, res) {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Hash the token to match what's stored
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid token
    const user = await User.findOne({
      emailConfirmationToken: hashedToken,
      emailConfirmationExpires: { $gt: Date.now() }
    });

    if (!user) {
      backendLogger.warn('Invalid or expired email confirmation token');
      return res.status(400).json({ error: 'Email confirmation token is invalid or has expired' });
    }

    // Confirm email
    user.emailConfirmed = true;
    user.emailConfirmationToken = undefined;
    user.emailConfirmationExpires = undefined;
    await user.save();

    backendLogger.info('Email confirmed successfully', { userId: user._id, email: user.email });

    res.json({ message: 'Email confirmed successfully' });
  } catch (err) {
    backendLogger.error('Error confirming email', { error: err.message });
    res.status(500).json({ error: 'Failed to confirm email' });
  }
}

/**
 * Resend confirmation email
 */
async function resendConfirmation(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // Always return success to prevent email enumeration
    if (!user) {
      backendLogger.info('Confirmation resend requested for non-existent email', { email });
      return res.json({ message: 'If an account exists, a confirmation email has been sent' });
    }

    // Check if already confirmed
    if (user.emailConfirmed) {
      return res.json({ message: 'Email is already confirmed' });
    }

    // Check if user uses OAuth (no email confirmation needed)
    if (user.provider !== 'local') {
      backendLogger.info('Confirmation resend requested for OAuth user', { email, provider: user.provider });
      return res.json({ message: 'If an account exists, a confirmation email has been sent' });
    }

    // Generate new confirmation token
    const confirmToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(confirmToken).digest('hex');

    user.emailConfirmationToken = hashedToken;
    user.emailConfirmationExpires = Date.now() + 24 * 3600000; // 24 hours
    await user.save();

    // Send confirmation email
    try {
      const confirmUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/confirm-email/${confirmToken}`;
      const { sendEmailConfirmation } = require('../../utilities/email-service');
      await sendEmailConfirmation(user.email, user.name, confirmUrl);
      backendLogger.info('Confirmation email resent', { email: user.email, userId: user._id });
    } catch (emailError) {
      backendLogger.error('Failed to resend confirmation email', { error: emailError.message, email: user.email });
      return res.status(500).json({ error: 'Failed to send confirmation email. Please try again.' });
    }

    res.json({ message: 'If an account exists, a confirmation email has been sent' });
  } catch (err) {
    backendLogger.error('Error resending confirmation', { error: err.message });
    res.status(500).json({ error: 'Failed to resend confirmation email' });
  }
}

module.exports = {
  create,
  login,
  checkToken,
  getUser,
  updateUser,
  updateUserAsAdmin,
  addPhoto,
  removePhoto,
  setDefaultPhoto,
  searchUsers,
  updateUserRole,
  getAllUsers,
  requestPasswordReset,
  resetPassword,
  confirmEmail,
  resendConfirmation,
};

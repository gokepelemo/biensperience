const User = require("../../models/user");
const Photo = require("../../models/photo");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const mongoose = require("mongoose");
const { USER_ROLES } = require("../../utilities/user-roles");
const { isSuperAdmin } = require("../../utilities/permissions");
const { isSystemUser } = require("../../utilities/system-users");
const backendLogger = require("../../utilities/backend-logger");
const { geocodeAddress } = require("../../utilities/geocoding-utils");
const { invalidateVisibilityCache } = require("../../utilities/websocket-server");

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

    const user = await User.findOne({ email: email })
      .populate("photos", "url caption photo_credit photo_credit_url width height");

    // Check if user exists before attempting password comparison
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const passwordTest = await bcrypt.compare(req.body.password, user.password);
    
    if (!passwordTest) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Create new session for user
    const { createSessionForUser } = require('../../utilities/session-middleware');
    const sessionId = await createSessionForUser(user, true);
    
    // Create JWT token
    const token = createJWT(user);
    
    // Add session ID to response
    res.setHeader('bien-session-id', sessionId);
    res.status(200).json({ 
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        photos: user.photos
      }
    });
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

    // Block access to system user profiles (e.g., Archive User)
    // These are internal system accounts that should never be publicly viewable
    if (isSystemUser(userId)) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = await User.findOne({ _id: userId })
      .populate("photos", "url caption photo_credit photo_credit_url width height")
      .lean();

    // Return 404 if user doesn't exist
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if profile is private (from preferences.profileVisibility)
    // Allow access if: user is viewing their own profile, or user is super admin
    const requestingUserId = req.user?._id?.toString();
    const isOwnProfile = requestingUserId === userId.toString();
    const isAdmin = req.user && isSuperAdmin(req.user);
    const profileVisibility = user.preferences?.profileVisibility || 'public';

    if (profileVisibility === 'private' && !isOwnProfile && !isAdmin) {
      // Return limited profile data for private profiles
      return res.status(200).json({
        _id: user._id,
        name: user.name,
        visibility: 'private',
        isPrivate: true
      });
    }

    res.status(200).json(user);
  } catch (err) {
    backendLogger.error('Error fetching user', { error: err.message, userId: req.params.id });
    res.status(400).json({ error: 'Failed to fetch user' });
  }
}

// OPTIMIZATION: Bulk fetch multiple users in one query
async function getBulkUsers(req, res) {
  try {
    const idsParam = req.query.ids;
    
    if (!idsParam) {
      return res.status(400).json({ error: 'ids query parameter is required' });
    }

    // Parse comma-separated IDs
    const ids = idsParam.split(',').map(id => id.trim()).filter(id => id);
    
    // Validate all IDs
    const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
    
    if (validIds.length === 0) {
      return res.json([]); // Return empty array if no valid IDs
    }

    // Fetch all users in one query
    // Include feature_flags and bio for curator status detection
    const users = await User.find({ _id: { $in: validIds } })
      .select('name email photos default_photo_id createdAt feature_flags bio')
      .populate("photos", "url caption")
      .lean();

    res.status(200).json(users);
  } catch (err) {
    backendLogger.error('Error fetching bulk users', { error: err.message, ids: req.query.ids });
    res.status(400).json({ error: 'Failed to fetch users' });
  }
}

async function getProfile(req, res) {
  try {
    const user = await User.findOne({ _id: req.user._id })
      .populate("photos", "url caption photo_credit photo_credit_url width height")
      .lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json(user);
  } catch (err) {
    backendLogger.error('Error fetching user profile', { error: err.message, userId: req.user._id });
    res.status(400).json({ error: 'Failed to fetch user profile' });
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
    // Allow `preferences` so users can update theme, language, currency, etc.
    // Allow `location` for user location with geocoding support
    // Allow `bio` and `links` for curator profile features
    const allowedFields = ['name', 'email', 'photos', 'default_photo_id', 'password', 'oldPassword', 'preferences', 'location', 'bio', 'links'];
    
    // Super admins can also update email confirmation status and feature flags
    if (isSuperAdmin(req.user)) {
      allowedFields.push('emailConfirmed');
      allowedFields.push('feature_flags');
    }
    
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
    if (updateData.password !== undefined && updateData.password !== null && updateData.password !== '') {
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
    
    // Validate emailConfirmed field if provided (super admin only)
    if (updateData.emailConfirmed !== undefined) {
      if (typeof updateData.emailConfirmed !== 'boolean') {
        return res.status(400).json({ error: 'emailConfirmed must be a boolean' });
      }
      validatedUpdateData.emailConfirmed = updateData.emailConfirmed;
    }
    
    // Validate photos array if provided
    if (updateData.photos !== undefined) {
      if (Array.isArray(updateData.photos)) {
        // Validate each photo ID (should be ObjectId references to Photo documents)
        const validPhotoIds = updateData.photos.filter(photoId => {
          return photoId === null || mongoose.Types.ObjectId.isValid(photoId);
        });
        validatedUpdateData.photos = validPhotoIds;
      }
    }
    
    // Validate default_photo_id if provided
    if (updateData.default_photo_id !== undefined) {
      if (updateData.default_photo_id === null || mongoose.Types.ObjectId.isValid(updateData.default_photo_id)) {
        validatedUpdateData.default_photo_id = updateData.default_photo_id;
      }
    }

    // Validate preferences object if provided
    if (updateData.preferences !== undefined && typeof updateData.preferences === 'object') {
      const p = updateData.preferences;
      const prefs = {};

      // theme: allow light, dark, or system-default
      if (p.theme && typeof p.theme === 'string' && ['light', 'dark', 'system-default'].includes(p.theme)) {
        prefs.theme = p.theme;
      }

      // currency: basic sanitization (3-10 chars)
      if (p.currency && typeof p.currency === 'string' && p.currency.length <= 10) {
        prefs.currency = p.currency.trim();
      }

      // language: validate against lang.constants.js available codes
      if (p.language && typeof p.language === 'string' && p.language.length <= 20) {
        const langCode = p.language.trim();
        try {
          const path = require('path');
          const { pathToFileURL } = require('url');
          const langPath = path.resolve(__dirname, '..', '..', 'src', 'lang.constants.js');
          // Dynamic import of ESM module
          const langModule = await import(pathToFileURL(langPath).href);
          const available = typeof langModule.getAvailableLanguageCodes === 'function'
            ? langModule.getAvailableLanguageCodes()
            : (langModule.lang && langModule.lang.current ? ['en'] : []);
          if (Array.isArray(available) && available.includes(langCode)) {
            prefs.language = langCode;
          } else {
            // If code not available, skip or fallback to default from module if provided
            if (typeof langModule.getCurrentLanguage === 'function') {
              prefs.language = langModule.getCurrentLanguage() || 'en';
            }
          }
        } catch (e) {
          // On any error, ignore and fall back to provided value
          prefs.language = langCode;
        }
      }

      // timezone: validate against available timezone options
      if (p.timezone && typeof p.timezone === 'string' && p.timezone.length <= 50) {
        const tzValue = p.timezone.trim();
        try {
          const { isValidTimezone } = require('../../utilities/timezone-utils');
          if (isValidTimezone(tzValue)) {
            prefs.timezone = tzValue;
          } else {
            // If timezone not available, skip (don't save invalid timezone)
            backendLogger.warn('Invalid timezone provided in preferences', { timezone: tzValue });
          }
        } catch (e) {
          // On any error, ignore and don't save timezone
          backendLogger.warn('Error validating timezone in preferences', { timezone: tzValue, error: e.message });
        }
      }

      // profileVisibility
      if (p.profileVisibility && ['private', 'public'].includes(p.profileVisibility)) {
        prefs.profileVisibility = p.profileVisibility;
      }

      // notifications
      if (p.notifications && typeof p.notifications === 'object') {
        const n = {};
        if (typeof p.notifications.enabled === 'boolean') n.enabled = !!p.notifications.enabled;
        if (Array.isArray(p.notifications.channels)) {
          n.channels = p.notifications.channels.filter(c => ['email', 'push', 'sms'].includes(c));
        }
        if (Array.isArray(p.notifications.types)) {
          n.types = p.notifications.types.filter(t => ['activity', 'reminder', 'marketing', 'updates'].includes(t));
        }
        prefs.notifications = n;
      }

      // Only set preferences if at least one valid value present
      if (Object.keys(prefs).length > 0) {
        validatedUpdateData.preferences = prefs;
      }
    }

    // Handle location update with geocoding
    if (updateData.location !== undefined) {
      if (updateData.location === null || updateData.location === '') {
        // Clear location if null or empty string
        validatedUpdateData.location = null;
      } else if (typeof updateData.location === 'string') {
        // If location is a string (query), geocode it
        const locationQuery = updateData.location.trim();
        if (locationQuery.length >= 2) {
          try {
            const geocodedLocation = await geocodeAddress(locationQuery);
            if (geocodedLocation) {
              validatedUpdateData.location = {
                displayName: geocodedLocation.displayName,
                city: geocodedLocation.city,
                state: geocodedLocation.state,
                country: geocodedLocation.country,
                countryCode: geocodedLocation.countryCode,
                postalCode: geocodedLocation.postalCode,
                coordinates: geocodedLocation.coordinates,
                originalQuery: geocodedLocation.originalQuery,
                geocodedAt: geocodedLocation.geocodedAt
              };
              backendLogger.info('Location geocoded successfully', {
                userId: userId.toString(),
                query: locationQuery,
                city: geocodedLocation.city,
                country: geocodedLocation.country
              });
            } else {
              backendLogger.warn('Location geocoding returned no results', {
                userId: userId.toString(),
                query: locationQuery
              });
              return res.status(400).json({
                error: 'Could not find location. Please try a different address, city, or zip code.'
              });
            }
          } catch (geocodeError) {
            backendLogger.error('Location geocoding failed', {
              error: geocodeError.message,
              userId: userId.toString(),
              query: locationQuery
            });
            return res.status(500).json({ error: 'Failed to geocode location. Please try again.' });
          }
        }
      } else if (typeof updateData.location === 'object') {
        // If location is already an object (from previous geocoding), validate and use it
        const loc = updateData.location;
        validatedUpdateData.location = {
          displayName: loc.displayName,
          city: loc.city,
          state: loc.state,
          country: loc.country,
          countryCode: loc.countryCode?.toUpperCase()?.substring(0, 2),
          postalCode: loc.postalCode,
          coordinates: loc.coordinates,
          originalQuery: loc.originalQuery,
          geocodedAt: loc.geocodedAt || new Date()
        };
      }
    }

    // Validate bio field if provided (curator profile feature)
    if (updateData.bio !== undefined) {
      if (updateData.bio === null || updateData.bio === '') {
        validatedUpdateData.bio = null;
      } else if (typeof updateData.bio === 'string' && updateData.bio.length <= 500) {
        validatedUpdateData.bio = updateData.bio.trim();
      }
    }

    // Validate links array if provided (curator profile feature)
    if (updateData.links !== undefined) {
      if (!Array.isArray(updateData.links)) {
        validatedUpdateData.links = [];
      } else {
        // Valid link types for social networks
        const validLinkTypes = ['twitter', 'instagram', 'facebook', 'youtube', 'tiktok', 'linkedin', 'pinterest', 'github', 'website', 'custom'];

        const validLinks = updateData.links
          .filter(link => {
            if (!link || typeof link !== 'object') return false;
            if (!link.title || typeof link.title !== 'string' || link.title.trim().length === 0) return false;
            if (!link.url || typeof link.url !== 'string') return false;
            // Basic URL validation
            try {
              new URL(link.url);
              return true;
            } catch (e) {
              return false;
            }
          })
          .map(link => ({
            type: validLinkTypes.includes(link.type) ? link.type : 'custom',
            username: link.username && typeof link.username === 'string' ? link.username.trim() : undefined,
            title: link.title.trim().substring(0, 100),
            url: link.url.trim(),
            meta: link.meta && typeof link.meta === 'object' ? link.meta : {}
          }))
          .slice(0, 10); // Limit to 10 links

        validatedUpdateData.links = validLinks;
      }
    }

    // Add password to validated data if it passed validation
    if (updateData.password) {
      validatedUpdateData.password = updateData.password;
    }

    // Validate feature_flags if provided (super admin only)
    if (updateData.feature_flags !== undefined && isSuperAdmin(req.user)) {
      if (!Array.isArray(updateData.feature_flags)) {
        validatedUpdateData.feature_flags = [];
      } else {
        // Known valid flags
        const validFlagKeys = ['ai_features', 'beta_ui', 'advanced_analytics', 'real_time_collaboration', 'document_ai_parsing', 'bulk_export', 'curator'];

        const validatedFlags = updateData.feature_flags
          .filter(flag => {
            if (!flag || typeof flag !== 'object') return false;
            if (!flag.flag || typeof flag.flag !== 'string') return false;
            // Only allow known flags
            return validFlagKeys.includes(flag.flag.toLowerCase());
          })
          .map(flag => ({
            flag: flag.flag.toLowerCase(),
            enabled: Boolean(flag.enabled),
            config: flag.config && typeof flag.config === 'object' ? flag.config : {},
            granted_at: flag.granted_at || new Date(),
            granted_by: flag.granted_by || req.user._id,
            expires_at: flag.expires_at ? new Date(flag.expires_at) : null,
            reason: typeof flag.reason === 'string' ? flag.reason.substring(0, 500) : null
          }));

        validatedUpdateData.feature_flags = validatedFlags;

        backendLogger.info('Feature flags updated by super admin', {
          adminId: req.user._id.toString(),
          targetUserId: userId.toString(),
          flagCount: validatedFlags.length,
          flags: validatedFlags.map(f => ({ flag: f.flag, enabled: f.enabled }))
        });
      }
    }

    user = await User.findOneAndUpdate({ _id: userId }, validatedUpdateData, { new: true })
      .populate("photos", "url caption photo_credit photo_credit_url width height");

    // Invalidate visibility cache if profileVisibility was updated
    // This ensures websocket presence reflects the new privacy setting immediately
    if (validatedUpdateData.preferences?.profileVisibility) {
      invalidateVisibilityCache(userId.toString());
    }

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

    // Whitelist allowed fields for admin updates (includes emailConfirmed and feature_flags)
    const allowedFields = ['name', 'email', 'photos', 'default_photo_id', 'password', 'emailConfirmed', 'feature_flags', 'bio', 'links'];
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

    // Validate default_photo_id if provided
    if (updateData.default_photo_id !== undefined) {
      if (updateData.default_photo_id === null || mongoose.Types.ObjectId.isValid(updateData.default_photo_id)) {
        validatedUpdateData.default_photo_id = updateData.default_photo_id;
      }
    }

    // Add password to validated data if provided
    if (updateData.password) {
      validatedUpdateData.password = updateData.password;
    }

    // Add emailConfirmed to validated data if provided
    if (updateData.emailConfirmed !== undefined) {
      validatedUpdateData.emailConfirmed = updateData.emailConfirmed;
    }

    // Validate and add feature_flags if provided
    if (updateData.feature_flags !== undefined) {
      if (!Array.isArray(updateData.feature_flags)) {
        validatedUpdateData.feature_flags = [];
      } else {
        // Known valid flags
        const validFlagKeys = ['ai_features', 'beta_ui', 'advanced_analytics', 'real_time_collaboration', 'document_ai_parsing', 'bulk_export', 'curator'];

        const validatedFlags = updateData.feature_flags
          .filter(flag => {
            if (!flag || typeof flag !== 'object') return false;
            if (!flag.flag || typeof flag.flag !== 'string') return false;
            // Only allow known flags
            return validFlagKeys.includes(flag.flag.toLowerCase());
          })
          .map(flag => ({
            flag: flag.flag.toLowerCase(),
            enabled: !!flag.enabled,
            config: flag.config || {},
            granted_at: flag.granted_at ? new Date(flag.granted_at) : new Date(),
            granted_by: flag.granted_by || req.user._id,
            expires_at: flag.expires_at ? new Date(flag.expires_at) : null,
            reason: typeof flag.reason === 'string' ? flag.reason.substring(0, 500) : null
          }));

        validatedUpdateData.feature_flags = validatedFlags;

        backendLogger.info('Feature flags updated by super admin', {
          adminId: req.user._id.toString(),
          targetUserId: userId.toString(),
          flagCount: validatedFlags.length,
          flags: validatedFlags.map(f => ({ flag: f.flag, enabled: f.enabled }))
        });
      }
    }

    // Validate and add bio if provided (curator feature)
    if (updateData.bio !== undefined) {
      if (typeof updateData.bio === 'string') {
        validatedUpdateData.bio = updateData.bio.substring(0, 500).trim();
      }
    }

    // Validate and add links if provided (curator feature)
    if (updateData.links !== undefined) {
      if (Array.isArray(updateData.links)) {
        // Valid link types for social networks
        const validLinkTypes = ['twitter', 'instagram', 'facebook', 'youtube', 'tiktok', 'linkedin', 'pinterest', 'github', 'website', 'custom'];

        const validatedLinks = updateData.links
          .filter(link => link && typeof link === 'object' && typeof link.url === 'string')
          .slice(0, 10) // Limit to 10 links
          .map(link => ({
            type: validLinkTypes.includes(link.type) ? link.type : 'custom',
            username: link.username && typeof link.username === 'string' ? link.username.trim() : undefined,
            title: typeof link.title === 'string' ? link.title.substring(0, 100).trim() : '',
            url: link.url.substring(0, 2048).trim(),
            meta: link.meta || {}
          }));
        validatedUpdateData.links = validatedLinks;
      }
    }

    const user = await User.findOneAndUpdate({ _id: userId }, validatedUpdateData, { new: true })
      .populate("photos", "url caption photo_credit photo_credit_url width height");

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

    // Remove photo from array
    const removedPhoto = user.photos[photoIndex];
    user.photos.splice(photoIndex, 1);

    // Clear default_photo_id if the removed photo was the default
    if (user.default_photo_id && removedPhoto && user.default_photo_id.toString() === removedPhoto._id.toString()) {
      user.default_photo_id = null;
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

    user.default_photo_id = user.photos[photoIndex]._id;
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

/**
 * Delete user account and associated data
 * Users can only delete their own account (or super admins can delete others)
 * Requires password confirmation for security
 *
 * Options:
 * - transferToUserId: Optional user ID to transfer all data to instead of deleting
 */
async function deleteAccount(req, res) {
  try {
    const { id } = req.params;
    const { password, confirmDelete, transferToUserId } = req.body;

    // Validate confirmation
    if (confirmDelete !== 'DELETE') {
      return res.status(400).json({
        error: 'Please type DELETE to confirm account deletion'
      });
    }

    // Check if user is deleting their own account or is super admin
    const isOwnAccount = req.user._id.toString() === id;
    const isAdmin = isSuperAdmin(req.user);

    if (!isOwnAccount && !isAdmin) {
      return res.status(403).json({
        error: 'You can only delete your own account'
      });
    }

    // Find the user to delete
    const userToDelete = await User.findById(id);
    if (!userToDelete) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deleting super admin accounts (extra safety)
    if (userToDelete.role === 'super_admin' && !isAdmin) {
      return res.status(403).json({
        error: 'Super admin accounts cannot be deleted this way'
      });
    }

    // Prevent deleting demo user account in demo mode
    const isDemoMode = process.env.REACT_APP_DEMO_MODE === 'true' || process.env.DEMO_MODE === 'true';
    const isDemoUser = userToDelete.isDemoUser === true || userToDelete.email === 'demo@biensperience.com';
    if (isDemoMode && isDemoUser) {
      backendLogger.warn('Attempted to delete demo user account', {
        userId: id,
        attemptedBy: req.user._id
      });
      return res.status(403).json({
        error: 'The demo user account cannot be deleted in demo mode. This account is used for demonstration purposes.'
      });
    }

    // For own account deletion, require password verification
    if (isOwnAccount && userToDelete.password) {
      if (!password) {
        return res.status(400).json({
          error: 'Password is required to delete your account'
        });
      }

      const match = await bcrypt.compare(password, userToDelete.password);
      if (!match) {
        return res.status(401).json({ error: 'Incorrect password' });
      }
    }

    // If transferring data, validate the target user exists
    let transferTargetUser = null;
    if (transferToUserId) {
      if (!mongoose.Types.ObjectId.isValid(transferToUserId)) {
        return res.status(400).json({ error: 'Invalid transfer target user ID' });
      }

      // Cannot transfer to self
      if (transferToUserId === id) {
        return res.status(400).json({ error: 'Cannot transfer data to yourself' });
      }

      transferTargetUser = await User.findById(transferToUserId);
      if (!transferTargetUser) {
        return res.status(404).json({ error: 'Transfer target user not found' });
      }

      backendLogger.info('Data transfer requested during account deletion', {
        fromUserId: id,
        toUserId: transferToUserId,
        toUserEmail: transferTargetUser.email
      });
    }

    backendLogger.info('Starting account deletion', {
      userId: id,
      deletedBy: req.user._id,
      isOwnAccount,
      transferToUserId: transferToUserId || null
    });

    // Import models for cleanup
    const Experience = require('../../models/experience');
    const Plan = require('../../models/plan');
    const Activity = require('../../models/activity');
    const Follow = require('../../models/follow');
    const ApiToken = require('../../models/apiToken');
    const Document = require('../../models/document');
    const Destination = require('../../models/destination');

    // If transferring, transfer data instead of deleting
    if (transferTargetUser) {
      const transferTargetId = mongoose.Types.ObjectId.createFromHexString(transferToUserId);
      const deletingUserId = mongoose.Types.ObjectId.createFromHexString(id);

      // 1. Transfer user's photos to target user
      if (userToDelete.photos && userToDelete.photos.length > 0) {
        await Photo.updateMany(
          { _id: { $in: userToDelete.photos } },
          { $set: { user: transferTargetId } }
        );
        // Add photos to target user's photos array
        await User.findByIdAndUpdate(transferToUserId, {
          $push: { photos: { $each: userToDelete.photos } }
        });
        backendLogger.info('Transferred photos to new owner', {
          count: userToDelete.photos.length,
          toUserId: transferToUserId
        });
      }

      // 2. Transfer user's plans to target user
      const transferredPlans = await Plan.updateMany(
        { user: deletingUserId },
        { $set: { user: transferTargetId } }
      );
      backendLogger.info('Transferred plans to new owner', {
        count: transferredPlans.modifiedCount,
        toUserId: transferToUserId
      });

      // 3. Transfer experience ownership permissions
      // Find all experiences where deleting user is owner
      const ownedExperiences = await Experience.find({
        'permissions': {
          $elemMatch: {
            _id: deletingUserId,
            type: 'owner'
          }
        }
      });

      for (const exp of ownedExperiences) {
        // Check if target user already has permissions on this experience
        const existingPerm = exp.permissions.find(
          p => p._id.toString() === transferToUserId
        );

        if (existingPerm) {
          // Upgrade existing permission to owner and remove old owner
          await Experience.findByIdAndUpdate(exp._id, {
            $set: { 'permissions.$[elem].type': 'owner' },
            $pull: { permissions: { _id: deletingUserId } }
          }, {
            arrayFilters: [{ 'elem._id': transferTargetId }]
          });
        } else {
          // Add target user as owner and remove old owner
          await Experience.findByIdAndUpdate(exp._id, {
            $push: {
              permissions: {
                _id: transferTargetId,
                entity: 'user',
                type: 'owner',
                granted_at: new Date(),
                granted_by: deletingUserId
              }
            },
            $pull: { permissions: { _id: deletingUserId } }
          });
        }
      }
      backendLogger.info('Transferred experience ownership', {
        count: ownedExperiences.length,
        toUserId: transferToUserId
      });

      // 4. Transfer collaborator permissions (upgrade to maintain access)
      await Experience.updateMany(
        { 'permissions._id': deletingUserId },
        {
          $set: { 'permissions.$[elem]._id': transferTargetId },
        },
        {
          arrayFilters: [{ 'elem._id': deletingUserId }]
        }
      );

      // 5. Transfer destination ownership permissions
      const ownedDestinations = await Destination.find({
        'permissions': {
          $elemMatch: {
            _id: deletingUserId,
            type: 'owner'
          }
        }
      });

      for (const dest of ownedDestinations) {
        const existingPerm = dest.permissions.find(
          p => p._id.toString() === transferToUserId
        );

        if (existingPerm) {
          await Destination.findByIdAndUpdate(dest._id, {
            $set: { 'permissions.$[elem].type': 'owner' },
            $pull: { permissions: { _id: deletingUserId } }
          }, {
            arrayFilters: [{ 'elem._id': transferTargetId }]
          });
        } else {
          await Destination.findByIdAndUpdate(dest._id, {
            $push: {
              permissions: {
                _id: transferTargetId,
                entity: 'user',
                type: 'owner',
                granted_at: new Date(),
                granted_by: deletingUserId
              }
            },
            $pull: { permissions: { _id: deletingUserId } }
          });
        }
      }
      backendLogger.info('Transferred destination ownership', {
        count: ownedDestinations.length,
        toUserId: transferToUserId
      });

      // 6. Transfer documents to target user
      const transferredDocs = await Document.updateMany(
        { user: deletingUserId },
        { $set: { user: transferTargetId } }
      );
      backendLogger.info('Transferred documents to new owner', {
        count: transferredDocs.modifiedCount,
        toUserId: transferToUserId
      });

      // 7. Transfer activities (update actor reference)
      await Activity.updateMany(
        { actor: deletingUserId },
        { $set: { actor: transferTargetId } }
      );
      await Activity.updateMany(
        { user: deletingUserId },
        { $set: { user: transferTargetId } }
      );

      // 8. Transfer follows (people who followed deleting user now follow target)
      await Follow.updateMany(
        { following: deletingUserId },
        { $set: { following: transferTargetId } }
      );
      // People deleting user was following - just delete those
      await Follow.deleteMany({ follower: deletingUserId });

    } else {
      // No transfer - delete all data

      // 1. Delete user's photos from S3 and database
      if (userToDelete.photos && userToDelete.photos.length > 0) {
        try {
          const { s3Delete } = require('../../uploads/aws-s3');
          for (const photoId of userToDelete.photos) {
            const photo = await Photo.findById(photoId);
            if (photo && photo.url) {
              try {
                await s3Delete(photo.url);
              } catch (s3Err) {
                backendLogger.warn('Failed to delete photo from S3', {
                  photoId,
                  error: s3Err.message
                });
              }
              await Photo.findByIdAndDelete(photoId);
            }
          }
        } catch (photoErr) {
          backendLogger.error('Error cleaning up photos', { error: photoErr.message });
        }
      }

      // 2. Delete user's plans
      await Plan.deleteMany({ user: id });

      // 3. Remove user from experience permissions (don't delete experiences they collaborate on)
      await Experience.updateMany(
        { 'permissions._id': mongoose.Types.ObjectId.createFromHexString(id) },
        { $pull: { permissions: { _id: mongoose.Types.ObjectId.createFromHexString(id) } } }
      );

      // 4. Handle experiences owned by user
      // Transfer ownership to the first collaborator, or delete if no collaborators
      const ownedExperiences = await Experience.find({
        'permissions': {
          $elemMatch: {
            _id: mongoose.Types.ObjectId.createFromHexString(id),
            type: 'owner'
          }
        }
      });

      for (const exp of ownedExperiences) {
        const collaborators = exp.permissions.filter(
          p => p._id.toString() !== id && p.type !== 'owner'
        );

        if (collaborators.length > 0) {
          // Transfer ownership to first collaborator
          const newOwner = collaborators[0];
          await Experience.findByIdAndUpdate(exp._id, {
            $set: { 'permissions.$[elem].type': 'owner' },
            $pull: { permissions: { _id: mongoose.Types.ObjectId.createFromHexString(id) } }
          }, {
            arrayFilters: [{ 'elem._id': newOwner._id }]
          });
          backendLogger.info('Transferred experience ownership', {
            experienceId: exp._id,
            newOwnerId: newOwner._id
          });
        } else {
          // No collaborators - delete the experience and its photos
          if (exp.photos && exp.photos.length > 0) {
            for (const photoId of exp.photos) {
              try {
                const photo = await Photo.findById(photoId);
                if (photo && photo.url) {
                  const { s3Delete } = require('../../uploads/aws-s3');
                  await s3Delete(photo.url);
                }
                await Photo.findByIdAndDelete(photoId);
              } catch (err) {
                backendLogger.warn('Failed to delete experience photo', { photoId, error: err.message });
              }
            }
          }
          await Experience.findByIdAndDelete(exp._id);
        }
      }

      // 5. Delete user's documents
      const userDocs = await Document.find({ user: id });
      for (const doc of userDocs) {
        if (doc.s3Key) {
          try {
            const { s3Delete } = require('../../uploads/aws-s3');
            await s3Delete(doc.s3Key, { protected: doc.isProtected });
          } catch (s3Err) {
            backendLogger.warn('Failed to delete document from S3', {
              docId: doc._id,
              error: s3Err.message
            });
          }
        }
      }
      await Document.deleteMany({ user: id });

      // 6. Delete user's activities
      await Activity.deleteMany({ user: id });
      await Activity.deleteMany({ actor: id });

      // 7. Delete user's follows
      await Follow.deleteMany({ $or: [{ follower: id }, { following: id }] });
    }

    // Always delete API tokens (security - don't transfer)
    await ApiToken.deleteMany({ user: id });

    // Finally, delete the user
    await User.findByIdAndDelete(id);

    backendLogger.info('Account deleted successfully', {
      userId: id,
      deletedBy: req.user._id,
      dataTransferred: !!transferTargetUser,
      transferredTo: transferToUserId || null
    });

    const message = transferTargetUser
      ? `Your account has been deleted. All your data has been transferred to ${transferTargetUser.name}.`
      : 'Your account and all associated data have been permanently deleted';

    res.json({
      success: true,
      message,
      dataTransferred: !!transferTargetUser,
      transferredTo: transferTargetUser ? {
        _id: transferTargetUser._id,
        name: transferTargetUser.name,
        email: transferTargetUser.email
      } : null
    });

  } catch (err) {
    backendLogger.error('Error deleting account', {
      error: err.message,
      userId: req.params.id
    });
    res.status(500).json({ error: 'Failed to delete account' });
  }
}

module.exports = {
  create,
  login,
  checkToken,
  getUser,
  getBulkUsers,
  getProfile,
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
  deleteAccount,
};

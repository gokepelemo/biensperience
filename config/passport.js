/**
 * Passport OAuth Configuration
 * Sets up authentication strategies for Facebook, Google, and Twitter
 */

const passport = require('passport');
const FacebookStrategy = require('passport-facebook').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const TwitterStrategy = require('passport-twitter').Strategy;
const User = require('../models/user');
const Photo = require('../models/photo');
const jwt = require('jsonwebtoken');
const backendLogger = require('../utilities/backend-logger');
const { getJwtSecret } = require('../utilities/secrets');

/**
 * Create a profile photo entity from OAuth provider photo URL
 * @param {string} photoUrl - The OAuth photo URL
 * @param {ObjectId} userId - The user ID who owns the photo
 * @param {string} provider - The OAuth provider (facebook, google, twitter)
 * @returns {ObjectId|null} - The created photo ID or null if creation failed
 */
async function createOAuthProfilePhoto(photoUrl, userId, provider) {
  if (!photoUrl) return null;

  try {
    const photoData = {
      url: photoUrl,
      photo_credit: `${provider.charAt(0).toUpperCase() + provider.slice(1)} Profile Photo`,
      photo_credit_url: photoUrl,
      permissions: [{
        _id: userId,
        entity: 'user',
        type: 'owner',
        granted_by: userId
      }]
    };

    const photo = await Photo.create(photoData);
    backendLogger.info('OAuth profile photo created', {
      photoId: photo._id,
      userId: userId,
      provider: provider,
      url: photoUrl
    });
    return photo._id;
  } catch (error) {
    backendLogger.error('Failed to create OAuth profile photo', {
      error: error.message,
      userId: userId,
      provider: provider,
      url: photoUrl
    });
    return null;
  }
}

/**
 * Serialize user for session
 */
passport.serializeUser((user, done) => {
  done(null, user._id);
});

/**
 * Deserialize user from session
 */
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

/**
 * Facebook Strategy
 */
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: process.env.FACEBOOK_CALLBACK_URL || 'http://localhost:3001/api/auth/facebook/callback',
    profileFields: ['id', 'emails', 'name', 'picture.type(large)'],
    passReqToCallback: true,
  },
  async (req, accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
      
      // If user is already logged in (account linking)
      if (req.user) {
        const user = await User.findById(req.user._id);
        
        // Check if Facebook account is already linked to another user
        const existingUser = await User.findOne({ facebookId: profile.id });
        if (existingUser && existingUser._id.toString() !== user._id.toString()) {
          return done(null, false, { message: 'This Facebook account is already linked to another user' });
        }
        
        // Link Facebook account
        user.facebookId = profile.id;
        if (!user.linkedAccounts) user.linkedAccounts = [];
        
        const existingLink = user.linkedAccounts.find(acc => acc.provider === 'facebook');
        if (!existingLink) {
          user.linkedAccounts.push({
            provider: 'facebook',
            providerId: profile.id,
            linkedAt: new Date()
          });
        }
        
        if (profile.photos && profile.photos[0] && !user.oauthProfilePhoto) {
          user.oauthProfilePhoto = profile.photos[0].value;
        }
        
        await user.save();
        return done(null, user);
      }
      
      // Check if user exists by Facebook ID
      let user = await User.findOne({ facebookId: profile.id });
      
      if (user) {
        // User exists, log them in
        return done(null, user);
      }
      
      // Check if user exists by email (link accounts)
      if (email) {
        user = await User.findOne({ email });
        if (user) {
          // If user already has a different Facebook account linked, block
          if (user.facebookId && user.facebookId !== profile.id) {
            return done(null, false, { message: 'This email is already associated with another Facebook account' });
          }
          // Link Facebook to existing account
          user.facebookId = profile.id;
          if (!user.linkedAccounts) user.linkedAccounts = [];
          const existingLink = user.linkedAccounts.find(acc => acc.provider === 'facebook');
          if (!existingLink) {
            user.linkedAccounts.push({
              provider: 'facebook',
              providerId: profile.id,
              linkedAt: new Date()
            });
          }
          if (profile.photos && profile.photos[0] && !user.oauthProfilePhoto) {
            user.oauthProfilePhoto = profile.photos[0].value;
          }
          await user.save();
          return done(null, user);
        }
      }
      
      // Create new user
      const newUser = new User({
        name: `${profile.name.givenName} ${profile.name.familyName}`,
        email: email || `facebook_${profile.id}@biensperience.com`,
        facebookId: profile.id,
        provider: 'facebook',
        oauthProfilePhoto: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
        linkedAccounts: [{
          provider: 'facebook',
          providerId: profile.id,
          linkedAt: new Date()
        }]
      });
      
      await newUser.save();
      
      // Create profile photo entity if OAuth photo exists
      if (profile.photos && profile.photos[0]) {
        const photoId = await createOAuthProfilePhoto(profile.photos[0].value, newUser._id, 'facebook');
        if (photoId) {
          newUser.photos.push({ photo: photoId, default: true });
          await newUser.save();
        }
      }
      
      return done(null, newUser);
      
    } catch (err) {
      return done(err, null);
    }
  }));
}

/**
 * Google Strategy
 */
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback',
    passReqToCallback: true,
  },
  async (req, accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
      
      // If user is already logged in (account linking)
      if (req.user) {
        const user = await User.findById(req.user._id);
        
        // Check if Google account is already linked to another user
        const existingUser = await User.findOne({ googleId: profile.id });
        if (existingUser && existingUser._id.toString() !== user._id.toString()) {
          return done(null, false, { message: 'This Google account is already linked to another user' });
        }
        
        // Link Google account
        user.googleId = profile.id;
        if (!user.linkedAccounts) user.linkedAccounts = [];
        
        const existingLink = user.linkedAccounts.find(acc => acc.provider === 'google');
        if (!existingLink) {
          user.linkedAccounts.push({
            provider: 'google',
            providerId: profile.id,
            linkedAt: new Date()
          });
        }
        
        if (profile.photos && profile.photos[0] && !user.oauthProfilePhoto) {
          user.oauthProfilePhoto = profile.photos[0].value;
        }
        
        await user.save();
        return done(null, user);
      }
      
      // Check if user exists by Google ID
      let user = await User.findOne({ googleId: profile.id });
      
      if (user) {
        // User exists, log them in
        return done(null, user);
      }
      
      // Check if user exists by email (link accounts)
      if (email) {
        user = await User.findOne({ email });
        if (user) {
          // If user already has a different Google account linked, block
          if (user.googleId && user.googleId !== profile.id) {
            return done(null, false, { message: 'This email is already associated with another Google account' });
          }
          // Link Google to existing account
          user.googleId = profile.id;
          if (!user.linkedAccounts) user.linkedAccounts = [];
          const existingLink = user.linkedAccounts.find(acc => acc.provider === 'google');
          if (!existingLink) {
            user.linkedAccounts.push({
              provider: 'google',
              providerId: profile.id,
              linkedAt: new Date()
            });
          }
          if (profile.photos && profile.photos[0] && !user.oauthProfilePhoto) {
            user.oauthProfilePhoto = profile.photos[0].value;
          }
          await user.save();
          return done(null, user);
        }
      }
      
      // Create new user
      const newUser = new User({
        name: profile.displayName,
        email: email || `google_${profile.id}@biensperience.com`,
        googleId: profile.id,
        provider: 'google',
        oauthProfilePhoto: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
        linkedAccounts: [{
          provider: 'google',
          providerId: profile.id,
          linkedAt: new Date()
        }]
      });
      
      await newUser.save();
      
      // Create profile photo entity if OAuth photo exists
      if (profile.photos && profile.photos[0]) {
        const photoId = await createOAuthProfilePhoto(profile.photos[0].value, newUser._id, 'google');
        if (photoId) {
          newUser.photos.push({ photo: photoId, default: true });
          await newUser.save();
        }
      }
      
      return done(null, newUser);
      
    } catch (err) {
      return done(err, null);
    }
  }));
}

/**
 * Twitter Strategy (OAuth 1.0a)
 */
if (process.env.TWITTER_CONSUMER_KEY && process.env.TWITTER_CONSUMER_SECRET) {
  backendLogger.info('Initializing Twitter OAuth 1.0a strategy', {
    hasConsumerKey: !!process.env.TWITTER_CONSUMER_KEY,
    callbackUrl: process.env.TWITTER_CALLBACK_URL
  });
  
  passport.use(new TwitterStrategy({
    consumerKey: process.env.TWITTER_CONSUMER_KEY,
    consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
    callbackURL: process.env.TWITTER_CALLBACK_URL || 'http://localhost:3001/api/auth/twitter/callback',
    passReqToCallback: true,
  },
  async (req, accessToken, refreshToken, profile, done) => {
    try {
      backendLogger.info('Twitter OAuth callback invoked', {
        profileId: profile.id,
        username: profile.username,
        displayName: profile.displayName,
        hasPhotos: !!(profile.photos && profile.photos.length > 0),
        profileKeys: Object.keys(profile)
      });
      
      // OAuth 1.0a profile structure
      const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
      
      // If user is already logged in (account linking)
      if (req.user) {
        const user = await User.findById(req.user._id);
        
        // Check if Twitter account is already linked to another user
        const existingUser = await User.findOne({ twitterId: profile.id });
        if (existingUser && existingUser._id.toString() !== user._id.toString()) {
          return done(null, false, { message: 'This Twitter account is already linked to another user' });
        }
        
        // Link Twitter account
        user.twitterId = profile.id;
        if (!user.linkedAccounts) user.linkedAccounts = [];
        
        const existingLink = user.linkedAccounts.find(acc => acc.provider === 'twitter');
        if (!existingLink) {
          user.linkedAccounts.push({
            provider: 'twitter',
            providerId: profile.id,
            linkedAt: new Date()
          });
        }
        
        if (profile.photos && profile.photos[0] && !user.oauthProfilePhoto) {
          user.oauthProfilePhoto = profile.photos[0].value;
        }
        
        await user.save();
        return done(null, user);
      }
      
      // Check if user exists by Twitter ID
      let user = await User.findOne({ twitterId: profile.id });
      
      if (user) {
        // User exists, log them in
        return done(null, user);
      }
      
      // Check if user exists by email (link accounts)
      if (email) {
        user = await User.findOne({ email });
        if (user) {
          // If user already has a different Twitter account linked, block
          if (user.twitterId && user.twitterId !== profile.id) {
            return done(null, false, { message: 'This email is already associated with another X account' });
          }
          // Link Twitter to existing account
          user.twitterId = profile.id;
          if (!user.linkedAccounts) user.linkedAccounts = [];
          const existingLink = user.linkedAccounts.find(acc => acc.provider === 'twitter');
          if (!existingLink) {
            user.linkedAccounts.push({
              provider: 'twitter',
              providerId: profile.id,
              linkedAt: new Date()
            });
          }
          if (profile.photos && profile.photos[0] && !user.oauthProfilePhoto) {
            user.oauthProfilePhoto = profile.photos[0].value;
          }
          await user.save();
          return done(null, user);
        }
      }
      
      // Create new user
      const profilePhotoUrl = profile.photos && profile.photos[0] ? profile.photos[0].value.replace('_normal', '') : null;
      
      const newUser = new User({
        name: profile.displayName || profile.username,
        email: email || `twitter_${profile.id}@biensperience.com`,
        twitterId: profile.id,
        provider: 'twitter',
        oauthProfilePhoto: profilePhotoUrl,
        linkedAccounts: [{
          provider: 'twitter',
          providerId: profile.id,
          linkedAt: new Date()
        }]
      });
      
      await newUser.save();
      
      // Create profile photo entity if OAuth photo exists
      if (profilePhotoUrl) {
        const photoId = await createOAuthProfilePhoto(profilePhotoUrl, newUser._id, 'twitter');
        if (photoId) {
          newUser.photos.push({ photo: photoId, default: true });
          await newUser.save();
        }
      }
      
      backendLogger.info('Twitter OAuth new user created', {
        email: newUser.email,
        userId: newUser._id.toString()
      });
      return done(null, newUser);
      
    } catch (err) {
      backendLogger.error('[Twitter OAuth 1.0a] Error', { error: err.message, stack: err.stack, profileId: profile.id });
      return done(err, null);
    }
  }));
} else {
  backendLogger.warn('Twitter OAuth 1.0a not configured', { 
    missing: ['TWITTER_CONSUMER_KEY', 'TWITTER_CONSUMER_SECRET'].filter(key => !process.env[key]) 
  });
}

/**
 * Extract the minimal user fields needed in the JWT payload.
 * The backend always re-fetches the user from the DB (checkToken.js),
 * and the frontend UserContext fetches fresh data immediately after mount.
 * Keeping large fields (hidden_signals, feature_flags, bienbot_memory,
 * preferences.notifications, etc.) out of the token prevents 431 errors
 * caused by oversized request headers.
 */
function buildJwtPayload(user) {
  const u = user.toObject ? user.toObject() : user;
  return {
    _id: u._id,
    name: u.name,
    email: u.email,
    provider: u.provider,
    role: u.role,
    isSuperAdmin: u.isSuperAdmin,
    emailConfirmed: u.emailConfirmed,
    visibility: u.visibility,
    oauthProfilePhoto: u.oauthProfilePhoto || null,
    photos: (u.photos || []).map(p => ({ photo: p.photo, default: p.default })),
    // Slim preferences: only the display/UI fields used before the API response
    preferences: {
      theme: u.preferences?.theme || 'system-default',
      currency: u.preferences?.currency || 'USD',
      language: u.preferences?.language || 'en',
      timezone: u.preferences?.timezone || 'UTC',
    },
    // Slim feature_flags: only flag key and enabled status (no config, timestamps)
    feature_flags: (u.feature_flags || [])
      .filter(f => f.enabled)
      .map(f => ({ flag: f.flag, enabled: true })),
  };
}

/**
 * Helper function to create JWT token for OAuth users
 */
function createToken(user) {
  // jti enables Redis-backed revocation (see utilities/jwt-denylist.js).
  const { generateJti } = require('../utilities/jwt-denylist');
  return jwt.sign(
    { user: buildJwtPayload(user), jti: generateJti() },
    getJwtSecret(),
    { expiresIn: '24h' }
  );
}

module.exports = { passport, createToken };

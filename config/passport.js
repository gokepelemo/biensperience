/**
 * Passport OAuth Configuration
 * Sets up authentication strategies for Facebook, Google, and Twitter
 */

const passport = require('passport');
const FacebookStrategy = require('passport-facebook').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const TwitterStrategy = require('passport-twitter-oauth2').Strategy;
const User = require('../models/user');
const jwt = require('jsonwebtoken');
const backendLogger = require('../utilities/backend-logger');

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
    const user = await User.findById(id).populate('photo');
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
      let user = await User.findOne({ facebookId: profile.id }).populate('photo');
      
      if (user) {
        // User exists, log them in
        return done(null, user);
      }
      
      // Check if user exists by email (link accounts)
      if (email) {
        user = await User.findOne({ email }).populate('photo');
        if (user) {
          // Link Facebook to existing account
          user.facebookId = profile.id;
          if (!user.linkedAccounts) user.linkedAccounts = [];
          user.linkedAccounts.push({
            provider: 'facebook',
            providerId: profile.id,
            linkedAt: new Date()
          });
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
      let user = await User.findOne({ googleId: profile.id }).populate('photo');
      
      if (user) {
        // User exists, log them in
        return done(null, user);
      }
      
      // Check if user exists by email (link accounts)
      if (email) {
        user = await User.findOne({ email }).populate('photo');
        if (user) {
          // Link Google to existing account
          user.googleId = profile.id;
          if (!user.linkedAccounts) user.linkedAccounts = [];
          user.linkedAccounts.push({
            provider: 'google',
            providerId: profile.id,
            linkedAt: new Date()
          });
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
      return done(null, newUser);
      
    } catch (err) {
      return done(err, null);
    }
  }));
}

/**
 * Twitter Strategy (OAuth 2.0)
 */
if (process.env.TWITTER_CLIENT_ID && process.env.TWITTER_CLIENT_SECRET) {
  console.log('[Passport] Initializing Twitter OAuth 2.0 strategy');
  console.log('[Passport] Twitter Client ID:', process.env.TWITTER_CLIENT_ID ? 'Set' : 'Missing');
  console.log('[Passport] Twitter Callback URL:', process.env.TWITTER_CALLBACK_URL);
  
  passport.use(new TwitterStrategy({
    clientType: 'confidential',
    clientID: process.env.TWITTER_CLIENT_ID,
    clientSecret: process.env.TWITTER_CLIENT_SECRET,
    callbackURL: process.env.TWITTER_CALLBACK_URL || 'http://localhost:3001/api/auth/twitter/callback',
    scope: ['tweet.read', 'users.read', 'offline.access'],
    passReqToCallback: true,
  },
  async (req, accessToken, refreshToken, profile, done) => {
    try {
      console.log('[Twitter Strategy] Authentication callback invoked');
      console.log('[Twitter Strategy] Profile ID:', profile.id);
      console.log('[Twitter Strategy] Profile username:', profile.username);
      
      // OAuth 2.0 profile structure is different
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
      let user = await User.findOne({ twitterId: profile.id }).populate('photo');
      
      if (user) {
        // User exists, log them in
        return done(null, user);
      }
      
      // Check if user exists by email (link accounts)
      if (email) {
        user = await User.findOne({ email }).populate('photo');
        if (user) {
          // Link Twitter to existing account
          user.twitterId = profile.id;
          if (!user.linkedAccounts) user.linkedAccounts = [];
          user.linkedAccounts.push({
            provider: 'twitter',
            providerId: profile.id,
            linkedAt: new Date()
          });
          if (profile.photos && profile.photos[0] && !user.oauthProfilePhoto) {
            user.oauthProfilePhoto = profile.photos[0].value;
          }
          await user.save();
          return done(null, user);
        }
      }
      
      // Create new user
      const newUser = new User({
        name: profile.displayName || profile.data?.name || profile.username,
        email: email || `twitter_${profile.id}@biensperience.com`,
        twitterId: profile.id,
        provider: 'twitter',
        oauthProfilePhoto: profile.photos && profile.photos[0] ? profile.photos[0].value.replace('_normal', '') : 
                          (profile.data?.profile_image_url ? profile.data.profile_image_url.replace('_normal', '') : null),
        linkedAccounts: [{
          provider: 'twitter',
          providerId: profile.id,
          linkedAt: new Date()
        }]
      });
      
      await newUser.save();
      console.log('[Twitter Strategy] New user created:', newUser.email);
      return done(null, newUser);
      
    } catch (err) {
      backendLogger.error('[Twitter Strategy] Error', { error: err.message, stack: err.stack, profileId: profile.id });
      return done(err, null);
    }
  }));
} else {
  console.warn('[Passport] Twitter OAuth 2.0 not configured - missing TWITTER_CLIENT_ID or TWITTER_CLIENT_SECRET');
}

/**
 * Helper function to create JWT token for OAuth users
 */
function createToken(user) {
  return jwt.sign(
    { user },
    process.env.SECRET,
    { expiresIn: '24h' }
  );
}

module.exports = { passport, createToken };

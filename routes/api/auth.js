/**
 * OAuth Authentication Routes
 * Handles social login via Facebook, Google, and Twitter
 */

const express = require('express');
const router = express.Router();
const { passport, createToken } = require('../../config/passport');
const ensureLoggedIn = require('../../config/ensureLoggedIn');
const backendLogger = require('../../utilities/backend-logger');
const { authLimiter } = require('../../config/rateLimiters');
const User = require('../../models/user');
const { createSessionForUser } = require('../../utilities/session-middleware');

/**
 * CSRF Token Endpoint
 * Returns a CSRF token for the client to use in subsequent requests
 * This is a GET request so it's not protected by CSRF itself
 */
router.get('/csrf-token', (req, res) => {
  try {
    const generateToken = req.app.get('csrfTokenGenerator');
    const csrfToken = generateToken(req, res);
    res.json({ csrfToken });
  } catch (err) {
    backendLogger.error('CSRF token generation error', { error: err.message });
    res.status(500).json({ error: 'Failed to generate CSRF token' });
  }
});

/**
 * Facebook OAuth Routes
 */

// Initiate Facebook OAuth
router.get('/facebook', authLimiter, (req, res, next) => {
  // Generate CSRF token and store in session
  const generateToken = req.app.get('csrfTokenGenerator');
  const csrfToken = generateToken(req, res);
  req.session.oauthState = csrfToken;
  
  passport.authenticate('facebook', {
    scope: ['email'],
    state: csrfToken
  })(req, res, next);
});

// Facebook OAuth callback
router.get('/facebook/callback',
  (req, res, next) => {
    // Validate state parameter matches session
    const state = req.query.state;
    const sessionState = req.session.oauthState;
    
    if (!state || !sessionState || state !== sessionState) {
      backendLogger.error('OAuth state mismatch - potential CSRF attack', { state, sessionState, provider: 'facebook' });
      return res.redirect('/login?error=oauth_csrf_failed');
    }
    
    // Clear session state after validation
    delete req.session.oauthState;
    next();
  },
  passport.authenticate('facebook', { 
    failureRedirect: '/login?error=facebook_auth_failed',
    session: false 
  }),
  (req, res) => {
    try {
      // Create new session for user (get mutable user document)
      const { createSessionForUser } = require('../../utilities/session-middleware');
      User.findById(req.user._id)
        .then(async (user) => {
          const sessionId = await createSessionForUser(user, true);
          
          // Create JWT token
          const token = createToken(req.user);

          // Set secure HTTP-only cookie
          res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
          });
          
          // Add session ID to cookie for frontend
          res.cookie('bien_session_id', sessionId, {
            httpOnly: true, // Keep secure - frontend doesn't need to read this
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
          });

          // Clear session state
          delete req.session.oauthState;

          // Redirect to frontend without token in URL
          res.redirect(`/?oauth=facebook`);
        })
        .catch((err) => {
          backendLogger.error('Facebook OAuth session creation error', { error: err.message, userId: req.user?._id });
          res.redirect('/login?error=facebook_session_failed');
        });
    } catch (err) {
      backendLogger.error('Facebook OAuth callback error', { error: err.message, userId: req.user?._id });
      res.redirect('/login?error=facebook_token_failed');
    }
  }
);

/**
 * Google OAuth Routes
 */

// Initiate Google OAuth
router.get('/google', authLimiter, (req, res, next) => {
  // Generate CSRF token and store in session
  const generateToken = req.app.get('csrfTokenGenerator');
  const csrfToken = generateToken(req, res);
  req.session.oauthState = csrfToken;
  
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state: csrfToken
  })(req, res, next);
});

// Google OAuth callback
router.get('/google/callback',
  (req, res, next) => {
    // Validate state parameter matches session
    const state = req.query.state;
    const sessionState = req.session.oauthState;
    
    if (!state || !sessionState || state !== sessionState) {
      backendLogger.error('OAuth state mismatch - potential CSRF attack', { state, sessionState, provider: 'google' });
      return res.redirect('/login?error=oauth_csrf_failed');
    }
    
    // Clear session state after validation
    delete req.session.oauthState;
    next();
  },
  passport.authenticate('google', { 
    failureRedirect: '/login?error=google_auth_failed',
    session: false 
  }),
  async (req, res) => {
    try {
      // Get mutable user document for session creation
      const user = await User.findById(req.user._id);
      
      if (!user) {
        backendLogger.error('Google OAuth user not found', { userId: req.user._id });
        return res.redirect('/login?error=google_user_not_found');
      }

      // Create session for user
      await createSessionForUser(user, true).catch(err => {
        backendLogger.error('Google OAuth session creation error', { error: err.message, userId: req.user?._id });
        throw err;
      });

      // Create JWT token
      const token = createToken(req.user);

      // Set secure HTTP-only cookie
      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      // Set session ID cookie for frontend access
      res.cookie('bien_session_id', user.currentSessionId, {
        httpOnly: true, // Keep secure - frontend doesn't need to read this
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      // Redirect to frontend without token in URL
      res.redirect(`/?oauth=google`);
    } catch (err) {
      backendLogger.error('Google OAuth callback error', { error: err.message, userId: req.user?._id });
      res.redirect('/login?error=google_token_failed');
    }
  }
);

/**
 * Twitter OAuth Routes
 */

// Initiate Twitter OAuth
router.get('/twitter', authLimiter, (req, res, next) => {
  // Generate CSRF token and store in session
  const generateToken = req.app.get('csrfTokenGenerator');
  
  if (!generateToken || typeof generateToken !== 'function') {
    backendLogger.error('CSRF token generator not found or not a function', { type: typeof generateToken });
    return res.status(500).json({ 
      error: 'Server configuration error',
      message: 'CSRF token generator is not available' 
    });
  }
  
  const csrfToken = generateToken(req, res);
  req.session.oauthState = csrfToken;
  
  // Pass state parameter for CSRF protection (OAuth 2.0 supports state)
  passport.authenticate('twitter', {
    scope: ['tweet.read', 'users.read', 'offline.access'],
    state: csrfToken
  })(req, res, next);
});

// Twitter OAuth callback
router.get('/twitter/callback',
  (req, res, next) => {
    // Validate CSRF state parameter (Twitter OAuth 2.0 supports state)
    const state = req.query.state;
    const sessionState = req.session.oauthState;

    if (!state || !sessionState || state !== sessionState) {
      backendLogger.error('Twitter OAuth state mismatch - potential CSRF attack', {
        hasState: !!state,
        hasSessionState: !!sessionState,
        provider: 'twitter'
      });
      return res.redirect('/login?error=oauth_csrf_failed');
    }

    if (req.query.denied) {
      backendLogger.info('Twitter OAuth denied by user');
      return res.redirect('/login?error=twitter_auth_denied');
    }

    next();
  },
  passport.authenticate('twitter', { 
    failureRedirect: '/login?error=twitter_auth_failed',
    session: false 
  }),
  async (req, res) => {
    try {
      // Get mutable user document for session creation
      const user = await User.findById(req.user._id);
      
      if (!user) {
        backendLogger.error('Twitter OAuth user not found', { userId: req.user._id });
        return res.redirect('/login?error=twitter_user_not_found');
      }

      // Create session for user
      await createSessionForUser(user, true).catch(err => {
        backendLogger.error('Twitter OAuth session creation error', { error: err.message, userId: req.user?._id });
        throw err;
      });

      // Create JWT token
      const token = createToken(req.user);

      // Set secure HTTP-only cookie
      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      // Set session ID cookie for frontend access
      res.cookie('bien_session_id', user.currentSessionId, {
        httpOnly: true, // Keep secure - frontend doesn't need to read this
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      // Clear session state
      delete req.session.oauthState;

      // Redirect to frontend without token in URL
      res.redirect(`/?oauth=twitter`);
    } catch (err) {
      backendLogger.error('Twitter OAuth callback error', { error: err.message, userId: req.user?._id });
      res.redirect('/login?error=twitter_token_failed');
    }
  }
);

/**
 * Account Linking Routes (for logged-in users)
 */

// Link Facebook account
router.get('/link/facebook', ensureLoggedIn, (req, res, next) => {
  // Generate CSRF token and store in session
  const generateToken = req.app.get('csrfTokenGenerator');
  const csrfToken = generateToken(req, res);
  req.session.oauthState = csrfToken;
  
  passport.authenticate('facebook', {
    scope: ['email'],
    state: csrfToken
  })(req, res, next);
});

router.get('/link/facebook/callback', ensureLoggedIn,
  (req, res, next) => {
    // Validate state parameter matches session
    const state = req.query.state;
    const sessionState = req.session.oauthState;
    
    if (!state || !sessionState || state !== sessionState) {
      backendLogger.error('OAuth state mismatch - potential CSRF attack', { state, sessionState, provider: 'facebook-link' });
      return res.redirect('/profile/settings?error=oauth_csrf_failed');
    }
    
    // Clear session state after validation
    delete req.session.oauthState;
    next();
  },
  passport.authenticate('facebook', { session: false }),
  (req, res) => {
    if (!req.user) {
      return res.redirect('/profile/settings?error=facebook_link_failed');
    }
    res.redirect('/profile/settings?success=facebook_linked');
  }
);

// Link Google account
router.get('/link/google', ensureLoggedIn, (req, res, next) => {
  // Generate CSRF token and store in session
  const generateToken = req.app.get('csrfTokenGenerator');
  const csrfToken = generateToken(req, res);
  req.session.oauthState = csrfToken;
  
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state: csrfToken
  })(req, res, next);
});

router.get('/link/google/callback', ensureLoggedIn,
  (req, res, next) => {
    // Validate state parameter matches session
    const state = req.query.state;
    const sessionState = req.session.oauthState;
    
    if (!state || !sessionState || state !== sessionState) {
      backendLogger.error('OAuth state mismatch - potential CSRF attack', { state, sessionState, provider: 'google-link' });
      return res.redirect('/profile/settings?error=oauth_csrf_failed');
    }
    
    // Clear session state after validation
    delete req.session.oauthState;
    next();
  },
  passport.authenticate('google', { session: false }),
  (req, res) => {
    if (!req.user) {
      return res.redirect('/profile/settings?error=google_link_failed');
    }
    res.redirect('/profile/settings?success=google_linked');
  }
);

// Link Twitter account
router.get('/link/twitter', ensureLoggedIn, (req, res, next) => {
  // Generate CSRF token and store in session
  const generateToken = req.app.get('csrfTokenGenerator');
  const csrfToken = generateToken(req, res);
  req.session.oauthState = csrfToken;
  
  passport.authenticate('twitter')(req, res, next);
});

router.get('/link/twitter/callback', ensureLoggedIn,
  (req, res, next) => {
    // Note: Twitter OAuth 1.0a doesn't support state parameter
    // We rely on OAuth 1.0a's built-in CSRF protection via oauth_token
    delete req.session.oauthState;
    next();
  },
  passport.authenticate('twitter', { session: false }),
  (req, res) => {
    if (!req.user) {
      return res.redirect('/profile/settings?error=twitter_link_failed');
    }
    res.redirect('/profile/settings?success=twitter_linked');
  }
);

/**
 * Unlink Social Account
 */
router.delete('/unlink/:provider', ensureLoggedIn, async (req, res) => {
  try {
    const { provider } = req.params;
    const User = require('../../models/user');
    
    if (!['facebook', 'google', 'twitter'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid provider' });
    }
    
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if user has password (can't unlink if OAuth is only auth method)
    if (!user.password && user.linkedAccounts && user.linkedAccounts.length <= 1) {
      return res.status(400).json({ 
        error: 'Cannot unlink your only authentication method. Please set a password first.' 
      });
    }
    
    // Remove provider ID
    if (provider === 'facebook') {
      user.facebookId = undefined;
    } else if (provider === 'google') {
      user.googleId = undefined;
    } else if (provider === 'twitter') {
      user.twitterId = undefined;
    }
    
    // Remove from linkedAccounts
    if (user.linkedAccounts) {
      user.linkedAccounts = user.linkedAccounts.filter(acc => acc.provider !== provider);
    }
    
    await user.save();
    
    res.json({ 
      message: `${provider.charAt(0).toUpperCase() + provider.slice(1)} account unlinked successfully`,
      user 
    });
    
  } catch (err) {
    const provider = req.params.provider || 'unknown';
    backendLogger.error('Unlink account error', { error: err.message, userId: req.user._id, provider });
    res.status(500).json({ error: 'Failed to unlink account' });
  }
});

/**
 * Get linked accounts for current user
 */
router.get('/linked-accounts', ensureLoggedIn, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const linkedAccounts = {
      facebook: !!user.facebookId,
      google: !!user.googleId,
      twitter: !!user.twitterId,
      hasPassword: !!user.password,
      accounts: user.linkedAccounts || []
    };
    
    res.json(linkedAccounts);
    
  } catch (err) {
    backendLogger.error('Get linked accounts error', { error: err.message, userId: req.user._id });
    res.status(500).json({ error: 'Failed to get linked accounts' });
  }
});

/**
 * Logout endpoint
 * Clears user session on backend
 */
router.post('/logout', ensureLoggedIn, async (req, res) => {
  try {
    const { clearSessionForUser } = require('../../utilities/session-middleware');
    const user = await User.findById(req.user._id);
    
    if (!user) {
      backendLogger.warn('Logout attempted for non-existent user', { userId: req.user._id });
      return res.status(200).json({ message: 'Logged out successfully' });
    }
    
    // Clear session from database
    await clearSessionForUser(user);
    
    // Clear session cookie
    res.clearCookie('bien_session_id', {
      httpOnly: true, // Match the setting used when cookie was created
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
    });
    
    // Clear auth token cookie
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
    });
    
    backendLogger.info('User logged out successfully', { userId: req.user._id });
    res.json({ message: 'Logged out successfully' });
    
  } catch (err) {
    backendLogger.error('Logout error', { error: err.message, userId: req.user._id });
    res.status(500).json({ error: 'Failed to logout' });
  }
});

module.exports = router;

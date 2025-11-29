/**
 * API Token Routes
 *
 * Endpoints for managing API tokens:
 * - GET /api/tokens - Get all tokens for current user
 * - POST /api/tokens - Create a new API token
 * - DELETE /api/tokens/:id - Revoke/delete a token
 * - PUT /api/users/api-enabled - Toggle API access for user
 */

const express = require('express');
const router = express.Router();
const ApiToken = require('../../models/apiToken');
const User = require('../../models/user');
const backendLogger = require('../../utilities/backend-logger');

/**
 * Middleware to ensure user is authenticated
 */
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

/**
 * GET /api/tokens
 * Get all API tokens for the current user
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const tokens = await ApiToken.getUserTokens(req.user._id);

    backendLogger.info('User retrieved API tokens', {
      userId: req.user._id,
      tokenCount: tokens.length
    });

    res.json(tokens);
  } catch (error) {
    backendLogger.error('Error retrieving API tokens', {
      userId: req.user._id,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to retrieve API tokens' });
  }
});

/**
 * POST /api/tokens
 * Create a new API token
 * Body: { name: string, expiresAt: Date (optional) }
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    // Check if API access is enabled
    const user = await User.findById(req.user._id);
    if (!user.apiEnabled) {
      return res.status(403).json({
        error: 'API access is disabled. Please enable it first.'
      });
    }

    const { name, expiresAt } = req.body;

    const { token, apiToken } = await ApiToken.createToken(req.user._id, {
      name: name || 'API Token',
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      createdFrom: req.ip,
      createdUserAgent: req.get('User-Agent')
    });

    backendLogger.info('API token created', {
      userId: req.user._id,
      tokenId: apiToken._id,
      tokenName: apiToken.name,
      audit: true
    });

    // Return the plain token (ONLY time it's visible) and metadata
    res.status(201).json({
      token, // Plain token - user should save this!
      tokenData: {
        _id: apiToken._id,
        name: apiToken.name,
        tokenPrefix: apiToken.tokenPrefix,
        expiresAt: apiToken.expiresAt,
        createdAt: apiToken.createdAt,
        isActive: apiToken.isActive // Include active status for UI display
      }
    });
  } catch (error) {
    backendLogger.error('Error creating API token', {
      userId: req.user._id,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to create API token' });
  }
});

/**
 * DELETE /api/tokens/:id
 * Revoke (deactivate) or permanently delete an API token
 * Query param: ?permanent=true to delete instead of revoke
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const permanent = req.query.permanent === 'true';

    // Verify token belongs to user
    const token = await ApiToken.findById(id);
    if (!token) {
      return res.status(404).json({ error: 'Token not found' });
    }

    if (token.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to delete this token' });
    }

    let success;
    if (permanent) {
      success = await ApiToken.deleteToken(id);
      backendLogger.info('API token deleted permanently', {
        userId: req.user._id,
        tokenId: id,
        audit: true
      });
    } else {
      success = await ApiToken.revokeToken(id);
      backendLogger.info('API token revoked', {
        userId: req.user._id,
        tokenId: id,
        audit: true
      });
    }

    if (success) {
      res.json({
        success: true,
        message: permanent ? 'Token deleted permanently' : 'Token revoked successfully'
      });
    } else {
      res.status(404).json({ error: 'Token not found or already deleted' });
    }
  } catch (error) {
    backendLogger.error('Error deleting API token', {
      userId: req.user._id,
      tokenId: req.params.id,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to delete API token' });
  }
});

/**
 * PUT /api/tokens/toggle-api-access
 * Toggle API access for the current user
 * Body: { enabled: boolean }
 */
router.put('/toggle-api-access', requireAuth, async (req, res) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean value' });
    }

    const user = await User.findById(req.user._id);
    user.apiEnabled = enabled;
    await user.save();

    backendLogger.info('API access toggled', {
      userId: req.user._id,
      enabled,
      audit: true
    });

    // If disabling API access, optionally revoke all tokens
    if (!enabled) {
      const tokens = await ApiToken.getUserTokens(req.user._id);
      for (const token of tokens) {
        if (token.isActive) {
          await ApiToken.revokeToken(token._id);
        }
      }
      backendLogger.info('All API tokens revoked due to API access being disabled', {
        userId: req.user._id,
        tokenCount: tokens.length
      });
    }

    res.json({
      success: true,
      apiEnabled: user.apiEnabled,
      message: enabled ? 'API access enabled' : 'API access disabled and all tokens revoked'
    });
  } catch (error) {
    backendLogger.error('Error toggling API access', {
      userId: req.user._id,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to toggle API access' });
  }
});

module.exports = router;

const Destination = require('../../models/destination');
const Experience = require('../../models/experience');
const Plan = require('../../models/plan');
const User = require('../../models/user');
const { USER_ROLES } = require('../../utilities/user-roles');
const logger = require('../../utilities/backend-logger');

/**
 * Check if user is a super admin
 * @param {Object} user - User object
 * @returns {boolean} True if user is super admin
 */
function isSuperAdmin(user) {
  return user && (user.isSuperAdmin === true || user.role === USER_ROLES.SUPER_ADMIN);
}

/**
 * Search configuration
 * Ready for external search service integration (Algolia, Elasticsearch, etc.)
 */
const SEARCH_CONFIG = {
  defaultLimit: 10,
  maxLimit: 50,
  minQueryLength: 2,
  // Future: Add Algolia/Elasticsearch configuration here
  externalService: null, // Set to 'algolia', 'elasticsearch', etc. when ready
};

/**
 * Build MongoDB text search query
 * @param {string} query - Search query
 * @returns {Object} MongoDB search query object
 */
function buildTextSearchQuery(query) {
  return {
    $text: { $search: query }
  };
}

/**
 * Escape special regex characters to prevent injection
 * @param {string} string - String to escape
 * @returns {string} Escaped string safe for regex
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build MongoDB regex search query (fallback when text index not available)
 * @param {string} query - Search query
 * @param {Array<string>} fields - Fields to search
 * @returns {Object} MongoDB regex query object
 */
function buildRegexSearchQuery(query, fields) {
  // Escape special regex characters to prevent injection
  const escapedQuery = escapeRegex(query);
  const regex = new RegExp(escapedQuery.split(' ').join('|'), 'i');
  return {
    $or: fields.map(field => ({ [field]: regex }))
  };
}

/**
 * Search all collections
 * GET /api/search?q=query&types=destination,experience&limit=10
 */
async function searchAll(req, res) {
  try {
    const { q: query, types, limit = SEARCH_CONFIG.defaultLimit } = req.query;

    // Validate query
    if (!query || query.trim().length < SEARCH_CONFIG.minQueryLength) {
      return res.status(400).json({
        error: `Query must be at least ${SEARCH_CONFIG.minQueryLength} characters`
      });
    }

    // Parse types filter
    const searchTypes = types
      ? types.split(',').map(t => t.trim())
      : ['destination', 'experience', 'plan', 'user'];

    // Validate and cap limit
    const searchLimit = Math.min(
      Math.max(1, parseInt(limit)),
      SEARCH_CONFIG.maxLimit
    );

    logger.info('Global search', {
      userId: req.user._id,
      query,
      types: searchTypes,
      limit: searchLimit
    });

    // Execute searches in parallel
    const results = await Promise.all([
      searchTypes.includes('destination')
        ? searchDestinationsInternal(query, searchLimit, req.user)
        : Promise.resolve([]),
      searchTypes.includes('experience')
        ? searchExperiencesInternal(query, searchLimit, req.user)
        : Promise.resolve([]),
      searchTypes.includes('plan')
        ? searchPlansInternal(query, searchLimit, req.user)
        : Promise.resolve([]),
      searchTypes.includes('user')
        ? searchUsersInternal(query, searchLimit, req.user)
        : Promise.resolve([]),
    ]);

    // Flatten and combine results
    const combinedResults = results.flat();

    logger.info('Search completed', {
      userId: req.user._id,
      query,
      resultCount: combinedResults.length
    });

    res.json(combinedResults);
  } catch (error) {
    logger.error('Search failed', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Search failed' });
  }
}

/**
 * Internal function to search destinations
 */
async function searchDestinationsInternal(query, limit, user) {
  try {
    const searchQuery = buildRegexSearchQuery(query, ['name', 'city', 'country', 'description']);

    const destinations = await Destination.find(searchQuery)
      .limit(limit)
      .select('name city country description photos')
      .lean();

    return destinations.map(dest => ({
      ...dest,
      type: 'destination'
    }));
  } catch (error) {
    logger.error('Destination search failed', { error: error.message });
    return [];
  }
}

/**
 * Internal function to search experiences
 */
async function searchExperiencesInternal(query, limit, user) {
  try {
    const searchQuery = buildRegexSearchQuery(query, ['name', 'description', 'experience_type']);

    const experiences = await Experience.find(searchQuery)
      .limit(limit)
      .populate('destination', 'name city country')
      .select('name description destination experience_type photos')
      .lean();

    return experiences.map(exp => ({
      ...exp,
      type: 'experience'
    }));
  } catch (error) {
    logger.error('Experience search failed', { error: error.message });
    return [];
  }
}

/**
 * Internal function to search plans
 */
async function searchPlansInternal(query, limit, user) {
  try {
    // Search in plans where user is owner or collaborator
    const userPlans = await Plan.find({
      $or: [
        { user: user._id },
        { 'permissions.user': user._id }
      ]
    })
      .populate({
        path: 'experience',
        match: buildRegexSearchQuery(query, ['title', 'description']),
        select: 'title description destination'
      })
      .limit(limit)
      .lean();

    // Filter out plans where experience didn't match (populate returned null)
    const matchedPlans = userPlans.filter(plan => plan.experience);

    return matchedPlans.map(plan => ({
      ...plan,
      type: 'plan'
    }));
  } catch (error) {
    logger.error('Plan search failed', { error: error.message });
    return [];
  }
}

/**
 * Internal function to search users
 */
async function searchUsersInternal(query, limit, user) {
  try {
    // Only super admins can search all users
    if (!isSuperAdmin(user)) {
      return [];
    }

    const searchQuery = buildRegexSearchQuery(query, ['name', 'email']);

    const users = await User.find(searchQuery)
      .limit(limit)
      .select('name email role profilePhoto')
      .lean();

    return users.map(u => ({
      ...u,
      type: 'user'
    }));
  } catch (error) {
    logger.error('User search failed', { error: error.message });
    return [];
  }
}

/**
 * Search destinations endpoint
 * GET /api/search/destinations?q=query&limit=10
 */
async function searchDestinations(req, res) {
  try {
    const { q: query, limit = SEARCH_CONFIG.defaultLimit } = req.query;

    if (!query || query.trim().length < SEARCH_CONFIG.minQueryLength) {
      return res.status(400).json({
        error: `Query must be at least ${SEARCH_CONFIG.minQueryLength} characters`
      });
    }

    const searchLimit = Math.min(
      Math.max(1, parseInt(limit)),
      SEARCH_CONFIG.maxLimit
    );

    const results = await searchDestinationsInternal(query, searchLimit, req.user);

    res.json(results);
  } catch (error) {
    logger.error('Destination search endpoint failed', { error: error.message });
    res.status(500).json({ error: 'Search failed' });
  }
}

/**
 * Search experiences endpoint
 * GET /api/search/experiences?q=query&limit=10
 */
async function searchExperiences(req, res) {
  try {
    const { q: query, limit = SEARCH_CONFIG.defaultLimit } = req.query;

    if (!query || query.trim().length < SEARCH_CONFIG.minQueryLength) {
      return res.status(400).json({
        error: `Query must be at least ${SEARCH_CONFIG.minQueryLength} characters`
      });
    }

    const searchLimit = Math.min(
      Math.max(1, parseInt(limit)),
      SEARCH_CONFIG.maxLimit
    );

    const results = await searchExperiencesInternal(query, searchLimit, req.user);

    res.json(results);
  } catch (error) {
    logger.error('Experience search endpoint failed', { error: error.message });
    res.status(500).json({ error: 'Search failed' });
  }
}

/**
 * Search plans endpoint
 * GET /api/search/plans?q=query&limit=10
 */
async function searchPlans(req, res) {
  try {
    const { q: query, limit = SEARCH_CONFIG.defaultLimit } = req.query;

    if (!query || query.trim().length < SEARCH_CONFIG.minQueryLength) {
      return res.status(400).json({
        error: `Query must be at least ${SEARCH_CONFIG.minQueryLength} characters`
      });
    }

    const searchLimit = Math.min(
      Math.max(1, parseInt(limit)),
      SEARCH_CONFIG.maxLimit
    );

    const results = await searchPlansInternal(query, searchLimit, req.user);

    res.json(results);
  } catch (error) {
    logger.error('Plan search endpoint failed', { error: error.message });
    res.status(500).json({ error: 'Search failed' });
  }
}

/**
 * Search users endpoint (admin only)
 * GET /api/search/users?q=query&limit=10
 */
async function searchUsers(req, res) {
  try {
    if (!isSuperAdmin(req.user)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { q: query, limit = SEARCH_CONFIG.defaultLimit } = req.query;

    if (!query || query.trim().length < SEARCH_CONFIG.minQueryLength) {
      return res.status(400).json({
        error: `Query must be at least ${SEARCH_CONFIG.minQueryLength} characters`
      });
    }

    const searchLimit = Math.min(
      Math.max(1, parseInt(limit)),
      SEARCH_CONFIG.maxLimit
    );

    const results = await searchUsersInternal(query, searchLimit, req.user);

    res.json(results);
  } catch (error) {
    logger.error('User search endpoint failed', { error: error.message });
    res.status(500).json({ error: 'Search failed' });
  }
}

/**
 * Future: Integration with external search services
 *
 * Example Algolia integration:
 *
 * async function searchWithAlgolia(query, options) {
 *   const { types, limit } = options;
 *   const index = algoliaClient.initIndex('biensperience');
 *
 *   const { hits } = await index.search(query, {
 *     filters: types ? `type:${types.join(' OR type:')}` : '',
 *     hitsPerPage: limit,
 *   });
 *
 *   return hits;
 * }
 */

module.exports = {
  searchAll,
  searchDestinations,
  searchExperiences,
  searchPlans,
  searchUsers,
};

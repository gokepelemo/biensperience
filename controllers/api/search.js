const Destination = require('../../models/destination');
const Experience = require('../../models/experience');
const Plan = require('../../models/plan');
const User = require('../../models/user');
const mongoose = require('mongoose');
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
  minQueryLength: 1, // Allow single character searches for better UX
  // Future: Add Algolia/Elasticsearch configuration here
  externalService: null, // Set to 'algolia', 'elasticsearch', etc. when ready
};

// Maximum input length to consider for Levenshtein distance to avoid
// excessive CPU usage or loop-bound injection from very large inputs.
// This caps the dynamic programming table size and prevents attacker-controlled
// values from causing unbounded loops.
const LEVENSHTEIN_MAX_LEN = 256;
/**
 * Normalize a string for comparison
 * - lowercased
 * - trimmed
 * - collapse multiple spaces
 */
function normalize(str = '') {
  return (str || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Compute Levenshtein distance (iterative DP) between two strings
 * Returns an integer distance >= 0
 */
function levenshtein(a = '', b = '') {
  a = normalize(a);
  b = normalize(b);
  // Cap the lengths to a reasonable value to avoid loop-bound injection
  // and DoS from extremely large inputs.
  if (a.length > LEVENSHTEIN_MAX_LEN) a = a.slice(0, LEVENSHTEIN_MAX_LEN);
  if (b.length > LEVENSHTEIN_MAX_LEN) b = b.slice(0, LEVENSHTEIN_MAX_LEN);

  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;

  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(
        dp[j] + 1,        // deletion
        dp[j - 1] + 1,    // insertion
        prev + cost       // substitution
      );
      prev = temp;
    }
  }
  return dp[n];
}

/**
 * Compute a relevance score between 0 and 1 for an item against a query.
 * Uses a mix of exact/startsWith/includes checks and normalized Levenshtein similarity.
 *
 * Score priority (highest to lowest):
 * 1.0     - Exact match (text === query)
 * 0.98    - Text contains query as complete phrase (for long queries)
 * 0.95    - Query contains text as complete phrase (query is superset)
 * 0.90-1.0 - Text starts with query
 * 0.85    - Any word in text starts with query
 * 0.70-0.90 - Text contains query as substring
 * 0.0-0.60 - Levenshtein similarity fallback
 */
function computeRelevanceScore(query, item) {
  const q = normalize(query);
  if (!q) return 0;

  // Collect candidate strings to match against
  const candidates = getCandidateStrings(item)
    .map(normalize)
    .filter(Boolean);

  if (candidates.length === 0) return 0;

  const qWords = q.split(/\s+/).filter(Boolean);
  const isMultiWordQuery = qWords.length > 1;

  let best = 0;
  for (const text of candidates) {
    if (!text) continue;

    // Exact match - highest priority
    if (text === q) {
      best = Math.max(best, 1.0);
      continue;
    }

    // For multi-word queries, check for complete phrase containment
    if (isMultiWordQuery) {
      // Text contains the entire query as a phrase (exact sentence match)
      // e.g., query="hidden gems of helsinki" in text="hidden gems of helsinki monsoon season"
      if (text.includes(q)) {
        // Score based on how much of the text is covered by the query
        const coverage = q.length / text.length;
        // High coverage = better match (query is most of the text)
        const score = 0.92 + (0.06 * coverage); // 0.92-0.98
        best = Math.max(best, score);
        continue;
      }

      // Query contains the entire text as a phrase
      // e.g., query="hidden gems of helsinki monsoon season adventures" contains text="hidden gems of helsinki"
      if (q.includes(text)) {
        const coverage = text.length / q.length;
        const score = 0.88 + (0.07 * coverage); // 0.88-0.95
        best = Math.max(best, score);
        continue;
      }

      // All query words appear in text (word-level AND match)
      const textWords = text.split(/\s+/).filter(Boolean);
      const allWordsMatch = qWords.every(qw =>
        textWords.some(tw => tw === qw || tw.startsWith(qw))
      );
      if (allWordsMatch) {
        // Score based on word order similarity
        const wordMatchCount = qWords.filter(qw => textWords.includes(qw)).length;
        const exactWordRatio = wordMatchCount / qWords.length;
        const score = 0.80 + (0.08 * exactWordRatio); // 0.80-0.88
        best = Math.max(best, score);
      }
    }

    // Starts with boost
    if (text.startsWith(q)) {
      // Longer prefix match slightly better
      const pct = Math.min(1, q.length / Math.max(1, text.length));
      best = Math.max(best, 0.90 + 0.08 * pct); // 0.90-0.98
    }

    // Word-boundary startsWith
    const words = text.split(/\s+/);
    if (words.some(w => w.startsWith(q))) {
      best = Math.max(best, 0.85);
    }

    // Includes (substring match) - for single words or partial matches
    if (text.includes(q)) {
      const pct = Math.min(1, q.length / Math.max(1, text.length));
      best = Math.max(best, 0.70 + (0.15 * pct)); // 0.70-0.85
    }

    // Levenshtein similarity (normalized) - fuzzy fallback
    const dist = levenshtein(text, q);
    const maxLen = Math.max(text.length, q.length) || 1;
    const sim = 1 - dist / maxLen; // 0..1
    best = Math.max(best, 0.6 * sim); // modest weight, max 0.6
  }

  // Small type-based adjustments (optional): prioritize exact entity names slightly
  if (item.type === 'destination') best += 0.01; // tiny nudge to break ties predictably
  if (item.type === 'experience') best += 0.005;

  return Math.max(0, Math.min(1, best));
}

/**
 * Extract candidate strings from an item for relevance comparison
 */
function getCandidateStrings(item) {
  const type = item.type;
  switch (type) {
    case 'destination':
      return [item.name, item.city, item.country, item.description];
    case 'experience':
      // Experience model uses 'overview' not 'description'
      return [item.name, item.overview, item.experience_type?.[0], item.destination?.name, item.destinationName];
    case 'plan':
      return [item.experience?.name, item.experience?.title, item.title, item.description];
    case 'user':
      return [item.name, item.username, item.email];
    default:
      return [item.name, item.title, item.description];
  }
}

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
 *
 * Creates a comprehensive search query with three priority levels:
 * 1. Exact phrase match (normalized whitespace)
 * 2. All words present (AND logic)
 * 3. Any word matches (OR logic)
 *
 * @param {string} query - Search query
 * @param {Array<string>} fields - Fields to search
 * @returns {Object} MongoDB regex query object
 */
function buildRegexSearchQuery(query, fields) {
  // Normalize the query: trim, lowercase, collapse multiple whitespace
  const normalizedQuery = normalize(query);

  // Escape special regex characters to prevent injection
  const escapedQuery = escapeRegex(normalizedQuery);

  // For multi-word queries, create a more sophisticated search:
  // 1. First priority: exact phrase match (with flexible whitespace)
  // 2. Second priority: all words must appear (AND logic via lookahead)
  // 3. Third priority: any word matches (OR logic)
  const words = escapedQuery.split(/\s+/).filter(w => w.length > 0);

  logger.debug('buildRegexSearchQuery', {
    query,
    normalizedQuery,
    escapedQuery,
    wordCount: words.length,
    words: words.slice(0, 10) // Limit to 10 words in log
  });

  if (words.length === 1) {
    // Single word: simple contains match
    const regex = new RegExp(words[0], 'i');
    return {
      $or: fields.map(field => ({ [field]: regex }))
    };
  }

  // Multi-word query: match the full phrase OR all words (AND)

  // For exact phrase matching, replace spaces with \s+ to match any whitespace
  // This handles cases where database has multiple spaces, tabs, or newlines
  const phrasePattern = words.join('\\s+');
  const phraseRegex = new RegExp(phrasePattern, 'i');

  // Using lookahead for AND: (?=.*word1)(?=.*word2).*
  const andPattern = words.map(w => `(?=.*${w})`).join('') + '.*';
  const andRegex = new RegExp(andPattern, 'i');

  // Also allow OR matching for partial results
  const orRegex = new RegExp(words.join('|'), 'i');

  logger.debug('buildRegexSearchQuery patterns', {
    phrasePattern: phrasePattern.slice(0, 100),
    andPattern: andPattern.slice(0, 100),
    orPattern: words.join('|').slice(0, 100)
  });

  // Build query that prefers phrase/AND matches
  return {
    $or: [
      // Exact phrase match with flexible whitespace (highest priority in results)
      ...fields.map(field => ({ [field]: phraseRegex })),
      // All words present (AND)
      ...fields.map(field => ({ [field]: andRegex })),
      // Any word present (OR) - for broader results
      ...fields.map(field => ({ [field]: orRegex }))
    ]
  };
}

/**
 * Check if a string is a valid MongoDB ObjectId
 * @param {string} str - String to check
 * @returns {boolean} True if valid ObjectId
 */
function isValidObjectId(str) {
  return mongoose.Types.ObjectId.isValid(str) && /^[a-fA-F0-9]{24}$/.test(str);
}

/**
 * Lookup an entity directly by ObjectId
 * Returns the entity with type and isDirectMatch flag for "I'm feeling lucky" behavior
 * @param {string} id - ObjectId to lookup
 * @param {Object} user - Current user
 * @returns {Promise<Object|null>} Entity with type, or null if not found
 */
async function lookupByObjectId(id, user) {
  const objectId = new mongoose.Types.ObjectId(id);

  // Try each collection in order of likelihood
  // Experience first (most common use case)
  const experience = await Experience.findById(objectId)
    .populate('destination', 'name city country')
    .select('name description destination experience_type photos')
    .lean();

  if (experience) {
    return {
      ...experience,
      type: 'experience',
      isDirectMatch: true,
      score: 1.0
    };
  }

  // Try destination
  const destination = await Destination.findById(objectId)
    .select('name city country description photos')
    .lean();

  if (destination) {
    const expCount = await Experience.countDocuments({ destination: objectId });
    return {
      ...destination,
      type: 'destination',
      experienceCount: expCount,
      isDirectMatch: true,
      score: 1.0
    };
  }

  // Try plan (only if user has access)
  const plan = await Plan.findOne({
    _id: objectId,
    $or: [
      { user: user._id },
      { 'permissions.user': user._id }
    ]
  })
    .populate('experience', 'name title description')
    .lean();

  if (plan) {
    return {
      ...plan,
      type: 'plan',
      isDirectMatch: true,
      score: 1.0
    };
  }

  // Try user
  const foundUser = await User.findById(objectId)
    .select(isSuperAdmin(user) ? 'name email role photos default_photo_id' : 'name photos default_photo_id')
    .lean();

  if (foundUser) {
    return {
      ...foundUser,
      type: 'user',
      isDirectMatch: true,
      score: 1.0
    };
  }

  return null;
}

/**
 * Search all collections
 * GET /api/search?q=query&types=destination,experience&limit=10
 *
 * Special behavior: If query is a valid ObjectId, returns direct match
 * with isDirectMatch=true for "I'm feeling lucky" redirect behavior
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

    const trimmedQuery = query.trim();

    // Check if query is a valid ObjectId - return direct match
    if (isValidObjectId(trimmedQuery)) {
      logger.info('ObjectId search', { userId: req.user._id, objectId: trimmedQuery });

      const directMatch = await lookupByObjectId(trimmedQuery, req.user);
      if (directMatch) {
        logger.info('Direct ObjectId match found', {
          userId: req.user._id,
          objectId: trimmedQuery,
          type: directMatch.type
        });
        return res.json({ results: [directMatch] });
      }
      // If no direct match, continue with regular search
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
      query: trimmedQuery,
      types: searchTypes,
      limit: searchLimit
    });

    // Execute searches in parallel
    const results = await Promise.all([
      searchTypes.includes('destination')
        ? searchDestinationsInternal(trimmedQuery, searchLimit, req.user)
        : Promise.resolve([]),
      searchTypes.includes('experience')
        ? searchExperiencesInternal(trimmedQuery, searchLimit, req.user)
        : Promise.resolve([]),
      searchTypes.includes('plan')
        ? searchPlansInternal(trimmedQuery, searchLimit, req.user)
        : Promise.resolve([]),
      searchTypes.includes('user')
        ? searchUsersInternal(trimmedQuery, searchLimit, req.user)
        : Promise.resolve([]),
    ]);

    logger.debug('Search results by type', {
      query: trimmedQuery,
      destinations: results[0]?.length || 0,
      experiences: results[1]?.length || 0,
      plans: results[2]?.length || 0,
      users: results[3]?.length || 0
    });

    // Flatten and combine results
    let combinedResults = results.flat();

    // Compute relevance scores and sort descending by score
    combinedResults = combinedResults.map((r) => ({
      ...r,
      score: computeRelevanceScore(trimmedQuery, r),
    }))
    .sort((a, b) => b.score - a.score);

    logger.info('Search completed', {
      userId: req.user._id,
      query: trimmedQuery,
      resultCount: combinedResults.length
    });

  res.json({ results: combinedResults });
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

    // Get experience counts for each destination using countDocuments
    const destinationsWithCounts = await Promise.all(
      destinations.map(async (dest) => {
        // Convert string _id to ObjectId for proper matching
        const destId = typeof dest._id === 'string' ? new mongoose.Types.ObjectId(dest._id) : dest._id;
        const count = await Experience.countDocuments({ destination: destId });
        return {
          ...dest,
          type: 'destination',
          experienceCount: count
        };
      })
    );

    return destinationsWithCounts;
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
    // Fields: name, overview (not description), experience_type array
    const searchQuery = buildRegexSearchQuery(query, ['name', 'overview', 'experience_type']);

    logger.debug('Experience search query', {
      query,
      mongoQuery: JSON.stringify(searchQuery).slice(0, 500)
    });

    const experiences = await Experience.find(searchQuery)
      .limit(limit)
      .populate('destination', 'name city country')
      .select('name overview destination experience_type photos')
      .lean();

    logger.debug('Experience search results', {
      query,
      resultCount: experiences.length,
      names: experiences.slice(0, 5).map(e => e.name)
    });

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
    // All authenticated users can search for other users (for collaboration purposes)
    // Super admins get additional fields like role and email
    const searchQuery = buildRegexSearchQuery(query, ['name', 'email']);

    // Select fields based on user role
    const selectFields = isSuperAdmin(user)
      ? 'name email role photos default_photo_id'
      : 'name photos default_photo_id';

    const users = await User.find(searchQuery)
      .limit(limit)
      .select(selectFields)
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
 * Search users endpoint
 * GET /api/search/users?q=query&limit=10
 * Available to all authenticated users for collaboration purposes
 */
async function searchUsers(req, res) {
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

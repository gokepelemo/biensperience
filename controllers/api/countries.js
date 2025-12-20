const Destination = require('../../models/destination');
const Experience = require('../../models/experience');
const { successResponse, errorResponse } = require('../../utilities/controller-helpers');
const backendLogger = require('../../utilities/backend-logger');

// Default pagination limits
const DEFAULT_DESTINATIONS_LIMIT = 12;
const DEFAULT_EXPERIENCES_LIMIT = 12;

/**
 * Normalize a country name/slug to a format suitable for database matching.
 * Handles both URL slugs (e.g., "united-states") and display names (e.g., "United States").
 *
 * @param {string} input - The country name or slug
 * @returns {string} Normalized country name for regex matching
 */
function normalizeCountryName(input) {
  if (!input) return '';

  // Decode URL encoding first
  let decoded = decodeURIComponent(input);

  // Convert dashes to spaces (for slug support)
  decoded = decoded.replace(/-/g, ' ');

  // Normalize whitespace
  decoded = decoded.trim().replace(/\s+/g, ' ');

  return decoded;
}

/**
 * Build a flexible regex pattern that matches both the normalized name
 * and common variations (with dashes, extra spaces, etc.)
 *
 * @param {string} normalizedName - The normalized country name
 * @returns {RegExp} Case-insensitive regex for matching
 */
function buildCountryRegex(normalizedName) {
  // Escape regex special characters
  const escaped = normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Replace spaces with a pattern that matches space, dash, or multiple spaces
  const pattern = escaped.replace(/\s+/g, '[\\s-]+');

  return new RegExp(`^${pattern}$`, 'i');
}

/**
 * Get all destinations and experiences for a specific country
 * GET /api/countries/:countryName
 *
 * Query params:
 * - destinationsPage: Page number for destinations (default: 1)
 * - destinationsLimit: Items per page for destinations (default: 12)
 * - experiencesPage: Page number for experiences (default: 1)
 * - experiencesLimit: Items per page for experiences (default: 12)
 *
 * Supports both display names (e.g., "United States") and URL slugs (e.g., "united-states")
 */
async function getByCountry(req, res) {
  try {
    const { countryName } = req.params;

    if (!countryName) {
      return errorResponse(res, null, 'Country name is required', 400);
    }

    // Parse pagination parameters
    const destinationsPage = Math.max(1, parseInt(req.query.destinationsPage, 10) || 1);
    const destinationsLimit = Math.min(50, Math.max(1, parseInt(req.query.destinationsLimit, 10) || DEFAULT_DESTINATIONS_LIMIT));
    const experiencesPage = Math.max(1, parseInt(req.query.experiencesPage, 10) || 1);
    const experiencesLimit = Math.min(50, Math.max(1, parseInt(req.query.experiencesLimit, 10) || DEFAULT_EXPERIENCES_LIMIT));

    // Normalize the country name (handles both slugs and display names)
    const normalizedCountryName = normalizeCountryName(countryName);

    if (!normalizedCountryName) {
      return errorResponse(res, null, 'Invalid country name', 400);
    }

    backendLogger.info('[countries] Fetching destinations and experiences for country', {
      input: countryName,
      normalized: normalizedCountryName,
      destinationsPage,
      destinationsLimit,
      experiencesPage,
      experiencesLimit
    });

    // Build a flexible regex that matches variations
    const countryRegex = buildCountryRegex(normalizedCountryName);

    // Get ALL destination IDs upfront in a single query (for experience lookup)
    // This avoids the N+1 query pattern of fetching destinations twice
    const allDestinationDocs = await Destination.find({ country: countryRegex })
      .select('_id name country state photos default_photo_id location map_location')
      .sort({ name: 1 })
      .populate('default_photo_id')
      .populate('photos')
      .lean();

    const allDestinationIds = allDestinationDocs.map(d => d._id);
    const totalDestinations = allDestinationDocs.length;

    // Paginate destinations from the already-fetched array (no additional query)
    const destinationsSkip = (destinationsPage - 1) * destinationsLimit;
    const destinations = allDestinationDocs.slice(destinationsSkip, destinationsSkip + destinationsLimit);

    // Count total experiences for pagination metadata (skip if experiencesLimit is 0)
    const totalExperiences = experiencesLimit > 0 && allDestinationIds.length > 0
      ? await Experience.countDocuments({ destination: { $in: allDestinationIds } })
      : 0;

    // Fetch paginated experiences efficiently using destination IDs (indexed query)
    // Skip the query entirely if experiencesLimit is 0 (optimization for Load More destinations)
    const experiencesSkip = (experiencesPage - 1) * experiencesLimit;
    const experiences = experiencesLimit > 0 && allDestinationIds.length > 0
      ? await Experience.find({
          destination: { $in: allDestinationIds }
        })
          .sort({ name: 1 })
          .skip(experiencesSkip)
          .limit(experiencesLimit)
          .select('name destination photos default_photo_id permissions experience_type overview location plan_items.location createdAt updatedAt')
          .populate('destination', 'name country city location')
          .populate('photos', 'url caption photo_credit photo_credit_url width height')
          .populate('default_photo_id', 'url caption photo_credit photo_credit_url width height')
          .lean({ virtuals: true })
      : [];

    // Get the canonical country name from first destination (for display)
    const canonicalCountryName = destinations.length > 0
      ? destinations[0].country
      : normalizedCountryName;

    // Build pagination metadata
    const destinationsMeta = {
      page: destinationsPage,
      limit: destinationsLimit,
      total: totalDestinations,
      totalPages: Math.ceil(totalDestinations / destinationsLimit),
      hasMore: destinationsSkip + destinations.length < totalDestinations
    };

    const experiencesMeta = {
      page: experiencesPage,
      limit: experiencesLimit,
      total: totalExperiences,
      totalPages: Math.ceil(totalExperiences / experiencesLimit),
      hasMore: experiencesSkip + experiences.length < totalExperiences
    };

    backendLogger.info('[countries] Found destinations and experiences', {
      country: canonicalCountryName,
      destinationsCount: destinations.length,
      totalDestinations,
      experiencesCount: experiences.length,
      totalExperiences
    });

    // Debug: Log location data statistics (only at debug level to avoid production overhead)
    if (backendLogger.isDebugEnabled()) {
      const destWithLocation = destinations.filter(d => d.location);
      const destWithGeo = destinations.filter(d => d.location?.geo);
      const destWithCoords = destinations.filter(d => d.location?.geo?.coordinates?.length === 2);
      const expWithLocation = experiences.filter(e => e.location);
      const expWithGeo = experiences.filter(e => e.location?.geo);
      const expWithCoords = experiences.filter(e => e.location?.geo?.coordinates?.length === 2);

      backendLogger.debug('[countries] Location data statistics', {
        destinationsWithLocation: destWithLocation.length,
        destinationsWithGeo: destWithGeo.length,
        destinationsWithCoordinates: destWithCoords.length,
        experiencesWithLocation: expWithLocation.length,
        experiencesWithGeo: expWithGeo.length,
        experiencesWithCoordinates: expWithCoords.length
      });
    }

    return successResponse(res, {
      country: canonicalCountryName,
      slug: normalizedCountryName.toLowerCase().replace(/\s+/g, '-'),
      destinations,
      destinationsMeta,
      experiences,
      experiencesMeta
    }, 'Data retrieved successfully');

  } catch (error) {
    backendLogger.error('[countries] Error fetching country data', {
      error: error.message,
      stack: error.stack
    });
    return errorResponse(res, error, 'Error fetching country data');
  }
}

module.exports = {
  getByCountry
};

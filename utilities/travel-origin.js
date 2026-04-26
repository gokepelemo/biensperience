/**
 * Travel Origin Utility
 *
 * Provides utilities for resolving a user's default travel origin from their
 * preferences. Used by BienBot context builders and future transport booking
 * flows to establish the departure point when the destination is the
 * experience's destination.
 *
 * @module utilities/travel-origin
 */

/**
 * Returns true if the user has a default travel origin set.
 * @param {Object} user - Mongoose user document or lean object
 * @returns {boolean}
 */
function hasDefaultTravelOrigin(user) {
  return !!(user?.preferences?.defaultTravelOrigin?.displayName);
}

/**
 * Returns a short human-readable label for the user's default travel origin.
 * Examples: "New York, NY, US" or "Paris, Île-de-France, FR"
 * Returns null if no origin is set.
 *
 * @param {Object} user - Mongoose user document or lean object
 * @returns {string|null}
 */
function getTravelOriginSummary(user) {
  const origin = user?.preferences?.defaultTravelOrigin;
  if (!origin?.displayName) return null;

  // Build a short label from city + state + countryCode
  const parts = [origin.city, origin.state, origin.countryCode].filter(Boolean);
  if (parts.length >= 2) return parts.join(', ');

  // Fall back to first segment of displayName (up to first comma)
  return (origin.displayName.split(',')[0] || '').trim() || origin.displayName;
}

/**
 * Returns the full display name of the default travel origin, or null.
 * @param {Object} user - Mongoose user document or lean object
 * @returns {string|null}
 */
function getTravelOriginDisplayName(user) {
  return user?.preferences?.defaultTravelOrigin?.displayName || null;
}

/**
 * Returns a structured origin object ready for use in transport booking APIs.
 * Shape matches the geocodeAddress return structure for easy integration.
 *
 * @param {Object} user - Mongoose user document or lean object
 * @returns {{ displayName: string, city: string|null, state: string|null, country: string|null, countryCode: string|null, lat: number|null, lng: number|null }|null}
 */
function formatOriginForTransport(user) {
  const origin = user?.preferences?.defaultTravelOrigin;
  if (!origin?.displayName) return null;

  return {
    displayName: origin.displayName,
    city: origin.city || null,
    state: origin.state || null,
    country: origin.country || null,
    countryCode: origin.countryCode || null,
    postalCode: origin.postalCode || null,
    lat: origin.lat != null ? origin.lat : null,
    lng: origin.lng != null ? origin.lng : null
  };
}

/**
 * Returns a plain-text LLM context block describing the user's default travel
 * origin. Used by BienBot context builders to inform the LLM of the user's
 * departure point for route, transport, and trip planning queries.
 *
 * Returns null if no origin is set.
 *
 * Example output:
 *   Default travel origin: New York, NY, US (New York, New York, United States)
 *   Use this as the departure point when making travel, transport, or route
 *   suggestions unless the user specifies a different starting location.
 *
 * @param {Object} user - Mongoose user document or lean object
 * @returns {string|null}
 */
function getTravelOriginContext(user) {
  const origin = user?.preferences?.defaultTravelOrigin;
  if (!origin?.displayName) return null;

  const summary = getTravelOriginSummary(user);
  const label = summary && summary !== origin.displayName
    ? `${summary} (${origin.displayName})`
    : origin.displayName;

  return [
    `Default travel origin: ${label}`,
    "Use this as the departure point when the user asks about travel routes, transport options, or trip planning, unless they specify a different starting location."
  ].join('\n');
}

module.exports = {
  hasDefaultTravelOrigin,
  getTravelOriginSummary,
  getTravelOriginDisplayName,
  formatOriginForTransport,
  getTravelOriginContext
};

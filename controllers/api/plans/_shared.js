/**
 * Shared helpers for the plans controllers (bd #97c6).
 *
 * Pure relocation from controllers/api/plans.js. Re-exports the helper
 * functions that are used across multiple per-domain controller modules
 * (sanitizeLocation, filterNotesByVisibility, isPlanMember).
 *
 * Per-domain modules import what they need from this file, plus the model
 * and utility modules they would have required when everything lived in
 * a single file.
 */

const Plan = require("../../../models/plan");
const Experience = require("../../../models/experience");
const Destination = require("../../../models/destination");
const User = require("../../../models/user");
const permissions = require("../../../utilities/permissions");
const backendLogger = require("../../../utilities/backend-logger");

// Sanitize location data for GeoJSON
function sanitizeLocation(location) {
  if (!location) return null;

  // If location is empty object or only has null/empty values, return null
  const hasAddress = location.address && typeof location.address === 'string' && location.address.trim();
  const hasGeo = location.geo && location.geo.coordinates && Array.isArray(location.geo.coordinates) && location.geo.coordinates.length === 2;

  if (!hasAddress && !hasGeo) return null;

  const sanitized = {
    address: hasAddress ? location.address.trim() : null,
    geo: null,
    city: (location.city && typeof location.city === 'string') ? location.city : null,
    state: (location.state && typeof location.state === 'string') ? location.state : null,
    country: (location.country && typeof location.country === 'string') ? location.country : null,
    postalCode: (location.postalCode && typeof location.postalCode === 'string') ? location.postalCode : null,
    placeId: (location.placeId && typeof location.placeId === 'string') ? location.placeId : null
  };

  // Validate and set GeoJSON coordinates
  if (hasGeo) {
    const [lng, lat] = location.geo.coordinates;
    if (typeof lng === 'number' && typeof lat === 'number' &&
        lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90) {
      sanitized.geo = {
        type: 'Point',
        coordinates: [lng, lat]
      };
    }
  }

  return sanitized;
}

// Filter plan notes by visibility
function filterNotesByVisibility(plan, userId) {
  if (!plan || !plan.plan || !Array.isArray(plan.plan)) return plan;

  const userIdStr = userId?.toString();

  plan.plan.forEach(planItem => {
    if (planItem.details && planItem.details.notes && Array.isArray(planItem.details.notes)) {
      // Filter out private notes that don't belong to the current user
      planItem.details.notes = planItem.details.notes.filter(note => {
        // 'contributors' visibility (default) - visible to all plan members
        if (!note.visibility || note.visibility === 'contributors') {
          return true;
        }
        // 'private' visibility - only visible to the note creator
        if (note.visibility === 'private') {
          const noteUserId = note.user?._id?.toString() || note.user?.toString();
          return noteUserId === userIdStr;
        }
        // Unknown visibility - default to visible (backwards compatibility)
        return true;
      });
    }
  });

  return plan;
}

// Check if a user is a valid member of a plan
async function isPlanMember(plan, userId) {
  if (!plan || !userId) return false;

  const userIdStr = userId.toString();

  // Check if user is the plan owner
  if (plan.user && plan.user.toString() === userIdStr) {
    return true;
  }

  // Check direct user permissions on the plan
  const hasDirectPermission = plan.permissions?.some(
    p => p.entity === 'user' && p._id.toString() === userIdStr
  );
  if (hasDirectPermission) {
    return true;
  }

  // Check inherited permissions from experience
  const models = { Plan, Experience, Destination, User };
  try {
    const resolvedPermissions = await permissions.resolvePermissionsWithInheritance(plan, models);
    return resolvedPermissions.has(userIdStr);
  } catch (err) {
    backendLogger.warn('Error resolving plan permissions for member check', {
      planId: plan._id.toString(),
      userId: userIdStr,
      error: err.message
    });
    return false;
  }
}

module.exports = {
  sanitizeLocation,
  filterNotesByVisibility,
  isPlanMember,
};

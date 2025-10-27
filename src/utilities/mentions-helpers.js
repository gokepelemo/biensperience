/**
 * Utility functions for preparing entities for mentions
 * Helps components integrate with the mentions system
 *
 * @module mentions-helpers
 */

import { MENTION_TYPES } from './mentions';

/**
 * Prepare user entities for mentions
 * @param {Array} users - Array of user objects
 * @returns {Array} Formatted entities for mentions
 */
export function prepareUserEntities(users) {
  return users.map(user => ({
    id: user._id,
    type: MENTION_TYPES.USER,
    displayName: user.name || user.username || 'Unknown User',
    data: user
  }));
}

/**
 * Prepare destination entities for mentions
 * @param {Array} destinations - Array of destination objects
 * @returns {Array} Formatted entities for mentions
 */
export function prepareDestinationEntities(destinations) {
  return destinations.map(destination => ({
    id: destination._id,
    type: MENTION_TYPES.DESTINATION,
    displayName: destination.name || 'Unknown Destination',
    data: destination
  }));
}

/**
 * Prepare experience entities for mentions
 * @param {Array} experiences - Array of experience objects
 * @returns {Array} Formatted entities for mentions
 */
export function prepareExperienceEntities(experiences) {
  return experiences.map(experience => ({
    id: experience._id,
    type: MENTION_TYPES.EXPERIENCE,
    displayName: experience.name || 'Unknown Experience',
    data: experience
  }));
}

/**
 * Prepare mixed entities for mentions
 * @param {Object} options - Options object
 * @param {Array} options.users - Array of user objects
 * @param {Array} options.destinations - Array of destination objects
 * @param {Array} options.experiences - Array of experience objects
 * @returns {Array} Combined formatted entities for mentions
 */
export function prepareMixedEntities({ users = [], destinations = [], experiences = [] }) {
  return [
    ...prepareUserEntities(users),
    ...prepareDestinationEntities(destinations),
    ...prepareExperienceEntities(experiences)
  ];
}

/**
 * Create entity data map for mentions rendering
 * @param {Array} entities - Array of entity objects with _id
 * @returns {Object} Map of entityId -> entity data
 */
export function createEntityDataMap(entities) {
  const map = {};
  entities.forEach(entity => {
    if (entity._id) {
      map[entity._id] = entity;
    }
  });
  return map;
}

/**
 * Extract entity IDs from mention text
 * @param {string} text - Text containing mentions
 * @returns {Object} Map of entity types to arrays of IDs
 */
export function extractEntityIdsFromText(text) {
  const { extractMentions } = require('./mentions');
  const mentions = extractMentions(text);

  const entityIds = {
    [MENTION_TYPES.USER]: [],
    [MENTION_TYPES.DESTINATION]: [],
    [MENTION_TYPES.EXPERIENCE]: []
  };

  mentions.forEach(mention => {
    if (entityIds[mention.entityType]) {
      entityIds[mention.entityType].push(mention.entityId);
    }
  });

  return entityIds;
}
/**
 * Utility functions for formatting changes in confirmation modals
 * Provides user-friendly representations of data changes with appropriate icons/emojis
 */

import { formatCurrency } from './currency-utils';
import { logger } from './logger';

/**
 * Get the appropriate icon/emoji for a field based on its type and context
 * @param {string} fieldName - The field name (snake_case)
 * @param {string} entityType - The entity type (destination, experience, profile, etc.)
 * @returns {string} Icon/emoji for the field
 */
export function getFieldIcon(fieldName, entityType = '') {
  const fieldIcons = {
    // Destination fields
    name: '🏷️',
    description: '📝',
    country: '🌍',
    state: '🏛️',
    city: '🏙️',
    travel_tips: '💡',
    photos: '📸',
    default_photo_id: '🖼️',

    // Experience fields
    experience_name: '🎯',
    type: '🏷️',
    plan_items: '📋',
    photo: '📸',

    // Profile fields
    user_name: '👤',
    email: '📧',
    bio: '📖',
    avatar: '🖼️',
    location: '📍',
    links: '🔗',

    // Plan fields
    planned_date: '📅',
    completion_status: '✅',
    cost_estimate: '💰',
    planning_days: '⏰',

    // Generic fallbacks
    default: '📝'
  };

  // Check for entity-specific field first
  const entityFieldKey = `${entityType}_${fieldName}`;
  if (fieldIcons[entityFieldKey]) {
    return fieldIcons[entityFieldKey];
  }

  // Check for generic field
  if (fieldIcons[fieldName]) {
    return fieldIcons[fieldName];
  }

  return fieldIcons.default;
}

/**
 * Format field name from various formats (snake_case, camelCase, ALL_CAPS, etc.) to Title Case
 * @param {string} fieldName - Field name in any format
 * @returns {string} Formatted field name in Title Case
 */
export function formatFieldName(fieldName) {
  if (!fieldName) return '';

  // Handle snake_case
  if (fieldName.includes('_')) {
    return fieldName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  // Handle camelCase, PascalCase, and other mixed case
  // Insert space before capital letters (but not at the beginning)
  const withSpaces = fieldName.replace(/([a-z])([A-Z])/g, '$1 $2');

  // Handle ALL_CAPS
  if (fieldName === fieldName.toUpperCase()) {
    return withSpaces
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  // Handle regular camelCase/PascalCase
  return withSpaces
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Format changes in a user-friendly way with appropriate icons
 * @param {string} field - The field name
 * @param {Object} change - Change object with from/to properties
 * @param {string} entityType - The entity type for icon context
 * @returns {string} Formatted change description
 */
export function formatChanges(field, change, entityType = '') {
  const icon = getFieldIcon(field, entityType);

  // Special handling for feature_flags
  if (field === 'feature_flags' && change.added !== undefined && change.removed !== undefined) {
    const changes = [];
    if (change.added && change.added.length > 0) {
      changes.push(`🚩 Added flags: ${change.added.join(', ')}`);
    }
    if (change.removed && change.removed.length > 0) {
      changes.push(`🚩 Removed flags: ${change.removed.join(', ')}`);
    }
    return changes.length > 0 ? changes.join('\n') : '🚩 Feature Flags updated';
  }

  // Handle numeric changes (costs, counts, etc.) with delta formatting
  if (typeof change.from === 'number' && typeof change.to === 'number') {
    const delta = change.to - change.from;
    const sign = delta > 0 ? '+' : '';

    // Special handling for cost fields
    if (field.includes('cost') || field.includes('price') || field.includes('budget')) {
      const formattedDelta = formatCurrency(Math.abs(delta));
      return `${icon} ${formatFieldName(field)}: ${sign}${formattedDelta}`;
    }

    // General numeric delta formatting
    return `${icon} ${formatFieldName(field)}: ${sign}${delta}`;
  }

  // Handle arrays
  if (Array.isArray(change.from) && Array.isArray(change.to)) {
    return formatArrayChanges(field, change, icon);
  }

  // Handle objects (including nested objects)
  if (typeof change.from === 'object' && change.from !== null &&
      typeof change.to === 'object' && change.to !== null) {
    return formatObjectChanges(field, change, icon, entityType);
  }

  // Handle simple values
  const fromValue = formatValue(change.from, field);
  const toValue = formatValue(change.to, field);
  return `${icon} ${formatFieldName(field)}: ${fromValue} → ${toValue}`;
}

/**
 * Format array changes with detailed diff
 * @param {string} field - Field name
 * @param {Object} change - Change object
 * @param {string} icon - Field icon
 * @returns {string} Formatted array changes
 */

/**
 * Format links changes with special handling for curator profile links
 * Supports both social media links (with type/username) and custom links (with title/url)
 * @param {Object} change - Change object with from/to arrays
 * @param {string} icon - Field icon
 * @returns {string} Formatted links changes
 */
function formatLinksChanges(change, icon) {
  const changes = [];

  // Normalize arrays (handle undefined/null)
  const fromLinks = change.from || [];
  const toLinks = change.to || [];

  // Helper to get display name for a link
  const getLinkDisplayName = (link) => {
    if (!link) return '';
    // Social network links use type + username
    if (link.type && link.username) {
      const networkName = link.type.charAt(0).toUpperCase() + link.type.slice(1);
      return `${networkName}: @${link.username}`;
    }
    // Custom/website links use title
    if (link.title) return link.title;
    // Fallback to URL
    return link.url || '';
  };

  // Helper to check if two links are the same
  const linksMatch = (a, b) => {
    if (!a || !b) return false;
    // Social network links: match on type + username
    if (a.type && b.type && a.type !== 'custom' && a.type !== 'website') {
      return a.type === b.type && a.username === b.username;
    }
    // Custom links: match on URL
    return a.url === b.url;
  };

  // Find added links
  toLinks.forEach((link) => {
    const isNew = !fromLinks.some(oldLink => linksMatch(link, oldLink));

    if (isNew) {
      const displayName = getLinkDisplayName(link);
      if (displayName) {
        changes.push(`${icon} Added: ${displayName}`);
      }
    }
  });

  // Find removed links
  fromLinks.forEach((link) => {
    const isRemoved = !toLinks.some(newLink => linksMatch(link, newLink));

    if (isRemoved) {
      const displayName = getLinkDisplayName(link);
      if (displayName) {
        changes.push(`${icon} Removed: ${displayName}`);
      }
    }
  });

  // Find modified links (same type but different username, or same URL base but different title)
  toLinks.forEach((link) => {
    // For social links, check if username changed
    if (link.type && link.type !== 'custom' && link.type !== 'website') {
      const matchingOldLink = fromLinks.find(oldLink =>
        oldLink.type === link.type && oldLink.username !== link.username
      );
      if (matchingOldLink && matchingOldLink.username && link.username) {
        const networkName = link.type.charAt(0).toUpperCase() + link.type.slice(1);
        changes.push(`${icon} Updated ${networkName}: @${matchingOldLink.username} → @${link.username}`);
      }
    } else {
      // For custom links, check if title or URL changed
      const matchingOldLink = fromLinks.find(oldLink =>
        oldLink.url === link.url && oldLink.title !== link.title
      );
      if (matchingOldLink) {
        changes.push(`${icon} Updated title: "${matchingOldLink.title}" → "${link.title}"`);
      }

      const matchingTitleLink = fromLinks.find(oldLink =>
        oldLink.title === link.title && oldLink.url !== link.url
      );
      if (matchingTitleLink && !matchingOldLink) {
        changes.push(`${icon} Updated URL for "${link.title}"`);
      }
    }
  });

  // If no specific changes detected but arrays are different lengths
  if (changes.length === 0) {
    if (fromLinks.length === 0 && toLinks.length > 0) {
      changes.push(`${icon} Added ${toLinks.length} link${toLinks.length > 1 ? 's' : ''}`);
    } else if (fromLinks.length > 0 && toLinks.length === 0) {
      changes.push(`${icon} Removed all links`);
    } else if (fromLinks.length !== toLinks.length) {
      changes.push(`${icon} Links updated: ${fromLinks.length} → ${toLinks.length}`);
    }
  }

  return changes.join('\n') || `${icon} Links updated`;
}

/**
 * Format travel tips changes with special handling for structured tips
 * @param {Object} change - Change object with from/to arrays
 * @param {string} icon - Field icon
 * @returns {string} Formatted travel tips changes
 */
function formatTravelTipsChanges(change, icon) {
  const changes = [];

  // Find added tips
  change.to.forEach((tip, index) => {
    const isNew = !change.from.some(oldTip => {
      // For structured tips, compare key properties
      if (typeof tip === 'object' && typeof oldTip === 'object') {
        return tip.value === oldTip.value && tip.type === oldTip.type;
      }
      // For simple string tips, direct comparison
      return tip === oldTip;
    });

    if (isNew) {
      if (typeof tip === 'object') {
        // Structured tip
        const tipType = tip.type || 'Custom';
        const tipIcon = tip.icon || '💡';
        changes.push(`${icon} New ${tipType} Tip: ${tipIcon} ${tip.value}`);
        if (tip.note) {
          changes.push(`  • Note: ${tip.note}`);
        }
        if (tip.exchangeRate) {
          changes.push(`  • ${tip.exchangeRate}`);
        }
        if (tip.callToAction?.url) {
          changes.push(`  • Link: ${tip.callToAction.label || 'Learn More'}`);
        }
      } else {
        // Simple string tip
        changes.push(`${icon} New Tip: 💡 ${tip}`);
      }
    }
  });

  // Find removed tips
  change.from.forEach((tip, index) => {
    const isRemoved = !change.to.some(newTip => {
      // For structured tips, compare key properties
      if (typeof tip === 'object' && typeof newTip === 'object') {
        return tip.value === newTip.value && tip.type === newTip.type;
      }
      // For simple string tips, direct comparison
      return tip === newTip;
    });

    if (isRemoved) {
      if (typeof tip === 'object') {
        // Structured tip
        const tipType = tip.type || 'Custom';
        const tipIcon = tip.icon || '💡';
        changes.push(`${icon} Removed ${tipType} Tip: ${tipIcon} ${tip.value}`);
      } else {
        // Simple string tip
        changes.push(`${icon} Removed Tip: 💡 ${tip}`);
      }
    }
  });

  // Detect reordering if no additions/removals but arrays are different
  if (changes.length === 0 && change.from.length === change.to.length) {
    // Same content but different order
    const orderChanged = change.from.some((tip, index) => {
      const toTip = change.to[index];
      // For structured tips, compare key properties
      if (typeof tip === 'object' && typeof toTip === 'object') {
        return tip.value !== toTip.value || tip.type !== toTip.type;
      }
      // For simple string tips, direct comparison
      return tip !== toTip;
    });

    if (orderChanged) {
      changes.push(`${icon} Order of Travel Tips updated`);
    }
  }

  return changes.join('\n');
}

function formatArrayChanges(field, change, icon) {
  const added = [];
  const removed = [];

  // Special handling for travel_tips field
  if (field === 'travel_tips') {
    return formatTravelTipsChanges(change, icon);
  }

  // Special handling for links field (curator profile links)
  if (field === 'links') {
    return formatLinksChanges(change, icon);
  }

  // Handle arrays of objects
  if (change.from.length > 0 && typeof change.from[0] === 'object') {
    return formatObjectArrayChanges(field, change, icon);
  }

  // Handle arrays of primitives
  change.to.forEach(item => {
    if (!change.from.includes(item)) {
      added.push(item);
    }
  });

  change.from.forEach(item => {
    if (!change.to.includes(item)) {
      removed.push(item);
    }
  });

  const changes = [];
  if (added.length > 0) {
    if (added.length === 1) {
      changes.push(`${icon} New ${formatFieldName(field).slice(0, -1)} → ${added[0]}`);
    } else {
      changes.push(`${icon} New ${formatFieldName(field)} (${added.length}):`);
      added.forEach(item => changes.push(`  • ${item}`));
    }
  }
  if (removed.length > 0) {
    if (removed.length === 1) {
      changes.push(`${icon} Removed ${formatFieldName(field).slice(0, -1)} → ${removed[0]}`);
    } else {
      changes.push(`${icon} Removed ${formatFieldName(field)} (${removed.length}):`);
      removed.forEach(item => changes.push(`  • ${item}`));
    }
  }

  return changes.join('\n');
}

/**
 * Format changes in arrays of objects
 * @param {string} field - Field name
 * @param {Object} change - Change object
 * @param {string} icon - Field icon
 * @returns {string} Formatted object array changes
 */
function formatObjectArrayChanges(field, change, icon) {
  // Use ID-based comparison if objects have _id property, otherwise fall back to deep comparison
  const hasIds = change.from.length > 0 && change.from[0]._id;

  let added, removed;

  if (hasIds) {
    // Performance optimization: Use ID-based comparison O(n) instead of JSON.stringify O(n²×m)
    const fromIds = new Set(change.from.map(item => String(item._id)));
    const toIds = new Set(change.to.map(item => String(item._id)));

    added = change.to.filter(item => !fromIds.has(String(item._id)));
    removed = change.from.filter(item => !toIds.has(String(item._id)));
  } else {
    // Fallback to deep equality for objects without IDs
    added = change.to.filter(item => !change.from.some(existing => deepEqual(item, existing)));
    removed = change.from.filter(item => !change.to.some(existing => deepEqual(item, existing)));
  }

  const changes = [];
  if (added.length > 0) {
    changes.push(`${icon} Added ${added.length} ${formatFieldName(field).slice(0, -1)}${added.length > 1 ? 's' : ''}`);
  }
  if (removed.length > 0) {
    changes.push(`${icon} Removed ${removed.length} ${formatFieldName(field).slice(0, -1)}${removed.length > 1 ? 's' : ''}`);
  }

  return changes.join('\n');
}

/**
 * Format object changes with nested diff
 * @param {string} field - Field name
 * @param {Object} change - Change object
 * @param {string} icon - Field icon
 * @param {string} entityType - Entity type for context
 * @returns {string} Formatted object changes
 */
function formatObjectChanges(field, change, icon, entityType) {
  const fromKeys = Object.keys(change.from);
  const toKeys = Object.keys(change.to);

  const addedKeys = toKeys.filter(key => !fromKeys.includes(key));
  const removedKeys = fromKeys.filter(key => !toKeys.includes(key));
  const changedKeys = fromKeys.filter(key =>
    toKeys.includes(key) && !deepEqual(change.from[key], change.to[key])
  );

  const changes = [];

  if (addedKeys.length > 0) {
    changes.push(`${icon} Added ${addedKeys.length} field${addedKeys.length > 1 ? 's' : ''}: ${addedKeys.map(k => formatFieldName(k)).join(', ')}`);
  }
  if (removedKeys.length > 0) {
    changes.push(`${icon} Removed ${removedKeys.length} field${removedKeys.length > 1 ? 's' : ''}: ${removedKeys.map(k => formatFieldName(k)).join(', ')}`);
  }
  if (changedKeys.length > 0) {
    const fieldChanges = changedKeys.map(key => {
      const subChange = { from: change.from[key], to: change.to[key] };
      return `  • ${formatFieldName(key)}: ${formatValue(subChange.from, key)} → ${formatValue(subChange.to, key)}`;
    });
    changes.push(`${icon} Updated ${changedKeys.length} field${changedKeys.length > 1 ? 's' : ''}:\n${fieldChanges.join('\n')}`);
  }

  return changes.join('\n');
}

/**
 * Format individual values with special handling for different types
 * @param {*} value - Value to format
 * @param {string} fieldName - Field name for context
 * @returns {string} Formatted value
 */
function formatValue(value, fieldName = '') {
  if (value === null || value === undefined) {
    return 'None';
  }

  // Handle currency fields
  if (typeof value === 'number' && (fieldName.includes('cost') || fieldName.includes('price') || fieldName.includes('budget'))) {
    return formatCurrency(value);
  }

  // Handle booleans
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  // Handle dates
  if (value instanceof Date || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value))) {
    try {
      const date = new Date(value);
      return date.toLocaleDateString();
    } catch {
      return String(value);
    }
  }

  // Handle objects and arrays
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      if (value.length === 0) return 'None';
      if (value.length === 1) return String(value[0]);
      return `${value.length} items`;
    }
    return 'Complex data';
  }

  return String(value);
}

/**
 * Deep equality check for objects and arrays with depth limit
 * @param {*} a - First value
 * @param {*} b - Second value
 * @param {number} [maxDepth=10] - Maximum recursion depth to prevent stack overflow
 * @param {number} [currentDepth=0] - Current recursion depth (internal use)
 * @returns {boolean} Whether values are deeply equal
 */
function deepEqual(a, b, maxDepth = 10, currentDepth = 0) {
  // Prevent stack overflow from deeply nested objects
  if (currentDepth >= maxDepth) {
    logger.warn('deepEqual: Maximum depth reached, treating as unequal', { maxDepth, currentDepth });
    return false;
  }

  if (a === b) return true;

  if (a == null || b == null) return a === b;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i], maxDepth, currentDepth + 1)) return false;
    }
    return true;
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!deepEqual(a[key], b[key], maxDepth, currentDepth + 1)) return false;
    }
    return true;
  }

  return false;
}

/**
 * Get a summary of all changes with icons
 * @param {Object} changes - Object containing all field changes
 * @param {string} entityType - The entity type for icon context
 * @returns {Array} Array of formatted change strings
 */
export function summarizeChanges(changes, entityType = '') {
  return Object.entries(changes).map(([field, change]) =>
    formatChanges(field, change, entityType)
  );
}
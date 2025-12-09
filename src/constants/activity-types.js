/**
 * Activity Type Constants
 *
 * Expanded activity types for travel and local exploration.
 * Each type includes an icon, label, and category for grouping.
 *
 * Categories:
 * - essentials: Core travel needs (accommodation, transport, food)
 * - experiences: Activities and attractions
 * - services: Practical needs (shopping, health, banking)
 * - other: Miscellaneous/custom types
 */

/**
 * Complete list of activity types with metadata
 * Organized by category for better UX in autocomplete
 */
export const ACTIVITY_TYPES = [
  // ============ ESSENTIALS ============
  { value: 'accommodation', label: 'Accommodation', icon: '🏨', category: 'essentials', keywords: ['hotel', 'hostel', 'airbnb', 'lodging', 'stay', 'sleep', 'room', 'resort', 'villa', 'apartment'] },
  { value: 'transport', label: 'Transportation', icon: '🚗', category: 'essentials', keywords: ['car', 'bus', 'train', 'flight', 'taxi', 'uber', 'metro', 'subway', 'ferry', 'cruise', 'ride', 'transfer', 'airport'] },
  { value: 'food', label: 'Food & Dining', icon: '🍽️', category: 'essentials', keywords: ['restaurant', 'cafe', 'lunch', 'dinner', 'breakfast', 'brunch', 'meal', 'eat', 'cuisine', 'bistro', 'bar'] },
  { value: 'drinks', label: 'Drinks & Nightlife', icon: '🍸', category: 'essentials', keywords: ['bar', 'pub', 'cocktail', 'wine', 'beer', 'club', 'nightclub', 'lounge', 'happy hour'] },
  { value: 'coffee', label: 'Coffee & Tea', icon: '☕', category: 'essentials', keywords: ['cafe', 'coffee shop', 'tea', 'espresso', 'latte', 'bakery', 'pastry'] },

  // ============ EXPERIENCES ============
  { value: 'sightseeing', label: 'Sightseeing', icon: '📸', category: 'experiences', keywords: ['landmark', 'monument', 'attraction', 'view', 'tour', 'visit', 'explore', 'scenic', 'viewpoint'] },
  { value: 'museum', label: 'Museum & Gallery', icon: '🏛️', category: 'experiences', keywords: ['art', 'history', 'exhibition', 'culture', 'gallery', 'display', 'artifact'] },
  { value: 'nature', label: 'Nature & Outdoors', icon: '🌲', category: 'experiences', keywords: ['park', 'hike', 'trail', 'mountain', 'forest', 'beach', 'lake', 'river', 'camping', 'wildlife', 'garden'] },
  { value: 'adventure', label: 'Adventure', icon: '🧗', category: 'experiences', keywords: ['extreme', 'thrill', 'zipline', 'bungee', 'rafting', 'skydiving', 'paragliding', 'surfing', 'diving', 'snorkeling'] },
  { value: 'sports', label: 'Sports & Recreation', icon: '⚽', category: 'experiences', keywords: ['game', 'match', 'stadium', 'golf', 'tennis', 'swim', 'gym', 'fitness', 'cycling', 'running'] },
  { value: 'entertainment', label: 'Entertainment', icon: '🎭', category: 'experiences', keywords: ['show', 'concert', 'theater', 'cinema', 'movie', 'festival', 'event', 'performance', 'live'] },
  { value: 'wellness', label: 'Wellness & Spa', icon: '💆', category: 'experiences', keywords: ['spa', 'massage', 'relax', 'sauna', 'yoga', 'meditation', 'retreat', 'therapy', 'treatment'] },
  { value: 'tour', label: 'Guided Tour', icon: '🎫', category: 'experiences', keywords: ['guide', 'walking', 'bus tour', 'excursion', 'day trip', 'group', 'private tour'] },
  { value: 'class', label: 'Class & Workshop', icon: '🎨', category: 'experiences', keywords: ['cooking', 'pottery', 'art class', 'lesson', 'workshop', 'learn', 'craft', 'skill'] },
  { value: 'nightlife', label: 'Nightlife', icon: '🌃', category: 'experiences', keywords: ['party', 'dancing', 'club', 'disco', 'night out', 'late night'] },
  { value: 'religious', label: 'Religious & Spiritual', icon: '🕌', category: 'experiences', keywords: ['temple', 'church', 'mosque', 'shrine', 'cathedral', 'monastery', 'worship', 'prayer'] },
  { value: 'local', label: 'Local Experience', icon: '🏘️', category: 'experiences', keywords: ['neighborhood', 'community', 'authentic', 'hidden gem', 'off beaten path', 'local life'] },

  // ============ SERVICES ============
  { value: 'shopping', label: 'Shopping', icon: '🛍️', category: 'services', keywords: ['mall', 'market', 'store', 'boutique', 'souvenir', 'gift', 'fashion', 'outlet'] },
  { value: 'market', label: 'Market & Bazaar', icon: '🏪', category: 'services', keywords: ['street market', 'flea market', 'farmers market', 'bazaar', 'vendors', 'stalls'] },
  { value: 'health', label: 'Health & Medical', icon: '🏥', category: 'services', keywords: ['pharmacy', 'hospital', 'clinic', 'doctor', 'medicine', 'emergency', 'vaccination'] },
  { value: 'banking', label: 'Banking & Money', icon: '🏦', category: 'services', keywords: ['atm', 'currency', 'exchange', 'bank', 'money', 'cash', 'transfer'] },
  { value: 'communication', label: 'Communication', icon: '📱', category: 'services', keywords: ['sim card', 'wifi', 'internet', 'phone', 'data', 'roaming'] },
  { value: 'admin', label: 'Admin & Documentation', icon: '📋', category: 'services', keywords: ['visa', 'passport', 'permit', 'registration', 'paperwork', 'embassy', 'consulate'] },
  { value: 'laundry', label: 'Laundry & Cleaning', icon: '🧺', category: 'services', keywords: ['wash', 'dry clean', 'clothes', 'laundromat'] },
  { value: 'rental', label: 'Rental & Equipment', icon: '🚲', category: 'services', keywords: ['car rental', 'bike rental', 'scooter', 'equipment', 'gear', 'hire'] },

  // ============ OTHER ============
  { value: 'photography', label: 'Photography', icon: '📷', category: 'other', keywords: ['photo', 'shoot', 'portrait', 'picture', 'instagram', 'photoshoot', 'camera'] },
  { value: 'meeting', label: 'Meeting & Social', icon: '🤝', category: 'other', keywords: ['meet', 'friend', 'family', 'reunion', 'gathering', 'social', 'networking'] },
  { value: 'work', label: 'Work & Business', icon: '💼', category: 'other', keywords: ['office', 'coworking', 'conference', 'remote work', 'business', 'meeting'] },
  { value: 'rest', label: 'Rest & Relaxation', icon: '😴', category: 'other', keywords: ['break', 'nap', 'downtime', 'chill', 'free time', 'leisure'] },
  { value: 'packing', label: 'Packing & Prep', icon: '🧳', category: 'other', keywords: ['pack', 'prepare', 'organize', 'luggage', 'checklist', 'ready'] },
  { value: 'checkpoint', label: 'Checkpoint', icon: '📍', category: 'other', keywords: ['waypoint', 'stop', 'milestone', 'marker', 'poi', 'point of interest'] },
  { value: 'custom', label: 'Custom Activity', icon: '✨', category: 'other', keywords: ['other', 'misc', 'miscellaneous', 'general', 'flexible'] }
];

/**
 * Activity type value to full object lookup
 */
export const ACTIVITY_TYPE_MAP = Object.fromEntries(
  ACTIVITY_TYPES.map(type => [type.value, type])
);

/**
 * Category labels and icons
 */
export const ACTIVITY_CATEGORIES = {
  essentials: { label: 'Essentials', icon: '🏠', order: 1 },
  experiences: { label: 'Experiences', icon: '✨', order: 2 },
  services: { label: 'Services', icon: '🛠️', order: 3 },
  other: { label: 'Other', icon: '📦', order: 4 }
};

/**
 * Get activity type info by value
 * @param {string} value - Activity type value
 * @returns {Object|null} Activity type object or null
 */
export function getActivityType(value) {
  if (!value) return null;
  return ACTIVITY_TYPE_MAP[value] || null;
}

/**
 * Get activity type icon by value
 * @param {string} value - Activity type value
 * @returns {string} Icon emoji or default
 */
export function getActivityTypeIcon(value) {
  const type = getActivityType(value);
  return type?.icon || '📌';
}

/**
 * Get activity type label by value
 * @param {string} value - Activity type value
 * @returns {string} Label or value
 */
export function getActivityTypeLabel(value) {
  const type = getActivityType(value);
  return type?.label || value || 'Unspecified';
}

/**
 * Get activity types grouped by category
 * @returns {Object} Types grouped by category key
 */
export function getActivityTypesByCategory() {
  const grouped = {};

  for (const type of ACTIVITY_TYPES) {
    if (!grouped[type.category]) {
      grouped[type.category] = [];
    }
    grouped[type.category].push(type);
  }

  return grouped;
}

/**
 * Get all searchable text for an activity type (for trie indexing)
 * @param {Object} type - Activity type object
 * @returns {string[]} Array of searchable strings
 */
export function getActivityTypeSearchTerms(type) {
  if (!type) return [];

  const terms = [
    type.label.toLowerCase(),
    type.value.toLowerCase()
  ];

  if (type.keywords) {
    terms.push(...type.keywords.map(k => k.toLowerCase()));
  }

  return terms;
}

/**
 * Get display string for activity type, handling parent/child differences
 * @param {Object} item - Plan item
 * @param {Object} parentItem - Parent plan item (if child)
 * @returns {Object} { displayLabel, badge } - badge is set if child differs from parent
 */
export function getActivityTypeDisplay(item, parentItem = null) {
  const itemType = getActivityType(item?.activity_type);

  if (!itemType) {
    return { displayLabel: null, badge: null };
  }

  // If this is a child item with a different activity type from parent
  if (parentItem && item.parent) {
    const parentType = getActivityType(parentItem?.activity_type);

    if (parentType && parentType.value !== itemType.value) {
      // Child has a different type than parent - show as badge
      return {
        displayLabel: null,
        badge: { icon: itemType.icon, label: itemType.label }
      };
    }
  }

  return { displayLabel: itemType, badge: null };
}

/**
 * Backend enum values (for validation)
 * This list should be kept in sync with the backend model
 */
export const ACTIVITY_TYPE_VALUES = ACTIVITY_TYPES.map(t => t.value);

/**
 * Legacy activity types that need migration
 * Maps old values to new values (if different)
 */
export const LEGACY_ACTIVITY_TYPE_MAP = {
  'activity': 'custom' // 'activity' was renamed to 'custom'
};

/**
 * Get normalized activity type value (handles legacy values)
 * @param {string} value - Raw activity type value
 * @returns {string|null} Normalized value
 */
export function normalizeActivityType(value) {
  if (!value) return null;
  return LEGACY_ACTIVITY_TYPE_MAP[value] || value;
}

/**
 * Cost categories derived from activity types
 * Uses the same values as activity types for consistency
 * Includes all activity types that make sense as cost categories
 */
export const COST_CATEGORIES = ACTIVITY_TYPES.map(type => ({
  value: type.value,
  label: type.label,
  icon: type.icon,
  category: type.category
}));

/**
 * Get cost category options for dropdowns
 * Grouped by category for better UX
 * @returns {Array} Cost category options with icon and label
 */
export function getCostCategoryOptions() {
  return ACTIVITY_TYPES.map(type => ({
    value: type.value,
    label: `${type.icon} ${type.label}`,
    icon: type.icon,
    category: type.category
  }));
}

/**
 * Get cost category info by value
 * @param {string} value - Cost category value
 * @returns {Object|null} Category info with icon and label
 */
export function getCostCategory(value) {
  if (!value) return null;
  const type = ACTIVITY_TYPE_MAP[value];
  if (!type) return null;
  return {
    value: type.value,
    label: type.label,
    icon: type.icon,
    category: type.category
  };
}

/**
 * Get cost category icon by value
 * @param {string} value - Cost category value
 * @returns {string} Icon emoji or default
 */
export function getCostCategoryIcon(value) {
  const category = getCostCategory(value);
  return category?.icon || '💰';
}

/**
 * Get cost category label by value
 * @param {string} value - Cost category value
 * @returns {string} Label or value
 */
export function getCostCategoryLabel(value) {
  const category = getCostCategory(value);
  return category?.label || value || 'Other';
}

export default ACTIVITY_TYPES;

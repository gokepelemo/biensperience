/**
 * Constants for AddPlanItemDetailModal
 * Separated to avoid circular dependency issues
 */

/**
 * Detail types available for plan items
 */
export const DETAIL_TYPES = {
  COST: 'cost',
  FLIGHT: 'flight',
  TRAIN: 'train',
  CRUISE: 'cruise',
  FERRY: 'ferry',
  BUS: 'bus',
  HOTEL: 'hotel',
  PARKING: 'parking',
  DISCOUNT: 'discount'
};

/**
 * Configuration for each detail type
 * Categories are used for grouping in the Details tab:
 * - transportation: flights, trains, buses, ferries, cruises
 * - accommodation: hotels, rentals
 * - parking: parking details
 * - discount: promo codes, group discounts
 * - expense: tracked costs
 */
export const DETAIL_TYPE_CONFIG = {
  [DETAIL_TYPES.COST]: {
    label: 'Cost',
    icon: '💰',
    description: 'Track an expense for this item',
    category: 'expense'
  },
  [DETAIL_TYPES.FLIGHT]: {
    label: 'Flight Itinerary',
    icon: '✈️',
    description: 'Add flight reservation details',
    category: 'transportation'
  },
  [DETAIL_TYPES.HOTEL]: {
    label: 'Hotel Reservation',
    icon: '🏨',
    description: 'Add hotel booking details',
    category: 'accommodation'
  },
  [DETAIL_TYPES.TRAIN]: {
    label: 'Train Reservation',
    icon: '🚂',
    description: 'Add train booking details',
    category: 'transportation'
  },
  [DETAIL_TYPES.CRUISE]: {
    label: 'Cruise Reservation',
    icon: '🚢',
    description: 'Add cruise booking details',
    category: 'transportation'
  },
  [DETAIL_TYPES.FERRY]: {
    label: 'Ferry Reservation',
    icon: '⛴️',
    description: 'Add ferry booking details',
    category: 'transportation'
  },
  [DETAIL_TYPES.BUS]: {
    label: 'Bus Reservation',
    icon: '🚌',
    description: 'Add bus booking details',
    category: 'transportation'
  },
  [DETAIL_TYPES.PARKING]: {
    label: 'Parking Details',
    icon: '🅿️',
    description: 'Add parking information',
    category: 'parking'
  },
  [DETAIL_TYPES.DISCOUNT]: {
    label: 'Group Discount Codes',
    icon: '🏷️',
    description: 'Add promo codes or group discounts',
    category: 'discount'
  }
};

/**
 * Category definitions for grouping details in the Details tab
 */
export const DETAIL_CATEGORIES = {
  transportation: {
    label: 'Transportation',
    icon: '🚗',
    order: 1
  },
  accommodation: {
    label: 'Accommodation',
    icon: '🏠',
    order: 2
  },
  parking: {
    label: 'Parking',
    icon: '🅿️',
    order: 3
  },
  discount: {
    label: 'Discount Codes',
    icon: '🏷️',
    order: 4
  },
  expense: {
    label: 'Expenses',
    icon: '💰',
    order: 5
  }
};

/**
 * Step identifiers for the modal wizard
 */
export const STEPS = {
  SELECT_TYPE: 1,
  ENTER_DETAILS: 2,
  UPLOAD_DOCUMENT: 3
};

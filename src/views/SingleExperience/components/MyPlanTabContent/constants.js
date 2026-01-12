/**
 * Constants for MyPlanTabContent UI and logic magic numbers.
 * All values should be referenced from here for maintainability.
 */

/**
 * Minimum horizontal drag distance (px) to trigger nesting of plan items.
 */
export const NESTING_THRESHOLD_PX = 40;

/**
 * Minimum horizontal drag distance (px, negative) to trigger promotion to root.
 */
export const PROMOTION_THRESHOLD_PX = -40;

/**
 * Animation duration for hierarchy changes (ms).
 */
export const HIERARCHY_ANIMATION_DURATION_MS = 500;

/**
 * Maximum allowed plan item nesting depth.
 */
export const MAX_PLAN_ITEM_DEPTH = 50;

/**
 * SkeletonLoader width for small text (px).
 */
export const SKELETON_TEXT_SMALL_WIDTH_PX = 60;

/**
 * SkeletonLoader height for small text (px).
 */
export const SKELETON_TEXT_SMALL_HEIGHT_PX = 14;

/**
 * SkeletonLoader width for large text (px).
 */
export const SKELETON_TEXT_LARGE_WIDTH_PX = 80;

/**
 * SkeletonLoader height for large text (px).
 */
export const SKELETON_TEXT_LARGE_HEIGHT_PX = 24;

/**
 * SkeletonLoader circle size (px).
 */
export const SKELETON_CIRCLE_SIZE_PX = 24;

/**
 * SkeletonLoader width for medium text (percent string).
 */
export const SKELETON_TEXT_MEDIUM_WIDTH = '70%';

/**
 * SkeletonLoader height for medium text (px).
 */
export const SKELETON_TEXT_MEDIUM_HEIGHT_PX = 20;

/**
 * SkeletonLoader height for double-line text (px).
 */
export const SKELETON_TEXT_DOUBLE_HEIGHT_PX = 16;

/**
 * Completion percentage threshold for success color (100%).
 */
export const COMPLETION_SUCCESS_THRESHOLD = 100;

/**
 * Completion percentage threshold for primary color (50%).
 */
export const COMPLETION_WARNING_THRESHOLD = 50;

/**
 * Minimum drag distance (px) to trigger drag operation (prevents accidental drags).
 */
export const DRAG_ACTIVATION_DISTANCE_PX = 8;

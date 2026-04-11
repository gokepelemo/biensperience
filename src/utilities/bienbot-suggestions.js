/**
 * BienBot suggested action chips — static templates per view/entity context.
 *
 * Each suggestion is a string template that gets placed in the textarea
 * when the user clicks it. Templates use {placeholders} that the user
 * can edit before sending.
 *
 * @module utilities/bienbot-suggestions
 */

// ── Entity-page suggestions ─────────────────────────────────────────────────

const EXPERIENCE_SUGGESTIONS = [
  'What should I know before planning this experience?',
  'Add a plan item for {activity, e.g. "a walking tour"}',
  'Estimate the total cost for this experience',
];

const DESTINATION_SUGGESTIONS = [
  'Show me experiences in this destination',
  'What are the must-see attractions here?',
  'Create an experience for {type, e.g. "a food tour"} here',
];

const PLAN_SUGGESTIONS = [
  'What items still need to be planned?',
  'Add a plan item for {activity, e.g. "lunch at a local restaurant"}',
  'Estimate total costs for this plan',
];

const PLAN_ITEM_SUGGESTIONS = [
  'Add a note about {detail, e.g. "reservation time"}',
  'What should I know about this activity?',
  'Suggest similar alternatives',
];

const USER_SUGGESTIONS = [
  'Show me experiences created by this user',
  'What destinations has this user explored?',
];

// ── View-page suggestions (non-entity) ──────────────────────────────────────

const HOME_SUGGESTIONS = [
  'Find an experience in {destination, e.g. "Tokyo"}',
  'Show me a budget-friendly adventure experience',
  'Create a new destination for {place, e.g. "Lisbon, Portugal"}',
  'What can I plan next?',
];

const EXPERIENCES_LIST_SUGGESTIONS = [
  'Find an experience that involves {activity, e.g. "hiking"}',
  'Show me experiences under {budget, e.g. "$200"}',
  'Create a new experience in {destination, e.g. "Barcelona"}',
];

const DESTINATIONS_LIST_SUGGESTIONS = [
  'Show me destinations with food and culture experiences',
  'Create a new destination for {place, e.g. "Marrakech, Morocco"}',
  'Which destinations have the most experiences?',
];

const DASHBOARD_SUGGESTIONS = [
  'What are my upcoming plans?',
  'Show me my most recent experience',
  'Create a new experience for my next trip',
];

const EXPERIENCE_TYPES_SUGGESTIONS = [
  'Show me the top-rated experiences in this category',
  'Find a budget-friendly option in this category',
  'Create an experience like these in {destination, e.g. "Paris"}',
];

const DEFAULT_SUGGESTIONS = [
  'Help me plan a trip to {destination, e.g. "Bali"}',
  'Show me popular experiences',
  'Create a new destination',
  'What can BienBot help me with?',
];

// ── Dynamic template builders (entity-name-aware) ───────────────────────────

function buildDynamicSuggestions(entityType, entityData) {
  if (!entityData) return null;
  const { name, destinationName } = entityData;

  switch (entityType) {
    case 'destination':
      if (!name) return null;
      return [
        `Plan an experience in ${name}`,
        `What are the best experiences in ${name}?`,
        `What should I know before visiting ${name}?`
      ];
    case 'experience':
      if (!name) return null;
      return [
        `Plan ${name}`,
        `What do I need for ${name}?`,
        'What do people do on similar experiences?'
      ];
    case 'plan':
      if (!name) return null;
      return [
        `What are next steps for my ${name} plan?`,
        destinationName
          ? `What experiences in ${destinationName} do people recommend?`
          : 'What experiences do people recommend near here?'
      ];
    default:
      return null;
  }
}

// ── Mapping ─────────────────────────────────────────────────────────────────

const ENTITY_SUGGESTIONS = {
  experience: EXPERIENCE_SUGGESTIONS,
  destination: DESTINATION_SUGGESTIONS,
  plan: PLAN_SUGGESTIONS,
  plan_item: PLAN_ITEM_SUGGESTIONS,
  user: USER_SUGGESTIONS,
};

const VIEW_SUGGESTIONS = {
  home: HOME_SUGGESTIONS,
  experiences: EXPERIENCES_LIST_SUGGESTIONS,
  destinations: DESTINATIONS_LIST_SUGGESTIONS,
  dashboard: DASHBOARD_SUGGESTIONS,
  'experience-types': EXPERIENCE_TYPES_SUGGESTIONS,
  countries: DESTINATIONS_LIST_SUGGESTIONS,
};

/**
 * Get suggested action chips for the current context.
 *
 * @param {string|null} entityType - Entity type if on an entity page
 * @param {string|null} currentView - View identifier if on a non-entity page
 * @param {object|null} [entityData] - Entity data for dynamic templates { name, id, destinationName, destinationId }
 * @returns {string[]} Array of suggestion templates
 */
export function getSuggestionsForContext(entityType, currentView, entityData) {
  // Try dynamic (entity-name-aware) suggestions first
  if (entityType && entityData) {
    const dynamic = buildDynamicSuggestions(entityType, entityData);
    if (dynamic) return dynamic;
  }

  if (entityType && ENTITY_SUGGESTIONS[entityType]) {
    return ENTITY_SUGGESTIONS[entityType];
  }
  if (currentView && VIEW_SUGGESTIONS[currentView]) {
    return VIEW_SUGGESTIONS[currentView];
  }
  return DEFAULT_SUGGESTIONS;
}

// ── Placeholder text ────────────────────────────────────────────────────────

const VIEW_PLACEHOLDERS = {
  home: 'Discover, explore, plan...',
  experiences: 'Discover, discuss, create...',
  destinations: 'Explore, discover, ask...',
  dashboard: 'Review, plan, explore...',
  'experience-types': 'Browse, discover, ask...',
  countries: 'Explore, discover, plan...',
  settings: 'Ask...',
  invites: 'Ask...',
  admin: 'Ask...',
};

/**
 * Get placeholder text for the BienBot input based on current context.
 *
 * @param {Object|null} invokeContext - Entity context if on entity page
 * @param {string|null} currentView - View identifier
 * @returns {string} Placeholder text
 */
export function getPlaceholderForContext(invokeContext, currentView) {
  if (invokeContext?.contextDescription || invokeContext?.label) {
    return 'Discuss, explore, plan...';
  }
  if (currentView && VIEW_PLACEHOLDERS[currentView]) {
    return VIEW_PLACEHOLDERS[currentView];
  }
  return 'Discover, explore, plan...';
}

/**
 * Get empty-state text for the BienBot panel based on current context.
 *
 * @param {Object|null} invokeContext - Entity context if on entity page
 * @param {string|null} currentView - View identifier
 * @returns {string} Empty state text
 */
export function getEmptyStateForContext(invokeContext, currentView) {
  if (invokeContext?.contextDescription) {
    return `Ask me anything about ${invokeContext.contextDescription}.`;
  }
  if (invokeContext?.label) {
    return `Ask me anything about "${invokeContext.label}".`;
  }
  if (currentView && VIEW_PLACEHOLDERS[currentView]) {
    return VIEW_PLACEHOLDERS[currentView];
  }
  return 'Plan your next adventure, explore destinations, create experiences, and more. Just ask!';
}

// ── Auto-navigation after entity creation ───────────────────────────────────

/**
 * Entity creation action types that should trigger auto-navigation.
 * Priority order: experience > plan > destination (highest = navigate to).
 */
const CREATION_ACTIONS = {
  create_destination: { priority: 1, getUrl: (entity) => entity?._id ? `/destinations/${entity._id}` : null },
  create_experience: { priority: 3, getUrl: (entity) => entity?._id ? `/experiences/${entity._id}` : null },
  create_plan: { priority: 2, getUrl: (entity) => {
    const expId = entity?.experience?._id || entity?.experience;
    const planId = entity?._id;
    return expId && planId ? `/experiences/${expId}#plan-${planId}` : null;
  }},
};

/**
 * Determine the navigation URL after executing BienBot action(s).
 *
 * For standalone creation actions, returns the URL of the created entity.
 * For workflows, returns the URL of the highest-priority created entity
 * (only if all steps succeeded).
 *
 * @param {Object} actionResult - Single action result from executeActions API
 * @returns {string|null} URL to navigate to, or null if no navigation needed
 */
export function getNavigationUrlForResult(actionResult) {
  if (!actionResult?.success) return null;

  const entity = actionResult.result || actionResult.entity || actionResult.data;

  // Standalone creation action
  if (CREATION_ACTIONS[actionResult.type]) {
    return CREATION_ACTIONS[actionResult.type].getUrl(entity);
  }

  // Workflow — find the highest-priority creation step
  if (actionResult.type === 'workflow' && entity?.results && Array.isArray(entity.results)) {
    // Only auto-navigate if all steps succeeded
    const allSucceeded = entity.results.every(r => r.success);
    if (!allSucceeded) return null;

    let bestUrl = null;
    let bestPriority = 0;

    for (const stepResult of entity.results) {
      if (!stepResult.success || !CREATION_ACTIONS[stepResult.type]) continue;
      const stepEntity = stepResult.result;
      const config = CREATION_ACTIONS[stepResult.type];
      if (config.priority > bestPriority) {
        const url = config.getUrl(stepEntity);
        if (url) {
          bestUrl = url;
          bestPriority = config.priority;
        }
      }
    }

    return bestUrl;
  }

  return null;
}

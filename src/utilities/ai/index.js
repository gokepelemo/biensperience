/**
 * AI Utilities for Biensperience
 *
 * SECURITY: All AI API calls go through the backend proxy. API keys are
 * stored server-side only — never exposed to the frontend. The backend owns
 * prompt resolution and provider routing; per-call prompt overrides may be
 * forwarded via `options.prompts`.
 *
 * Requires the 'ai_features' feature flag to be enabled for the user.
 *
 * @module ai
 *
 * @example
 * // Import specific functions
 * import { autocomplete, improveDescription, AI_PROVIDERS } from '../utilities/ai';
 *
 * // Use with default provider (via backend proxy)
 * const suggestion = await autocomplete('The best time to visit');
 *
 * // Check if AI is available (async)
 * import { isAIAvailableAsync } from '../utilities/ai';
 * const available = await isAIAvailableAsync();
 *
 * // Use React hook
 * import { useAI } from '../utilities/ai';
 *
 * function MyComponent() {
 *   const { autocomplete, loading, error } = useAI();
 *
 *   const handleSuggest = async () => {
 *     const suggestion = await autocomplete('The best time to visit');
 *   };
 * }
 *
 * // Feature flag gating
 * import { FeatureFlag } from '../components/FeatureFlag';
 * <FeatureFlag flag="ai_features">
 *   <AIToolbar />
 * </FeatureFlag>
 */

// Constants
export {
  AI_PROVIDERS,
  AI_TASKS,
  DEFAULT_MODELS,
  PROVIDER_ENDPOINTS
} from './constants';

// High-level functions
export {
  autocomplete,
  editLanguage,
  improveDescription,
  summarize,
  generateTravelTips,
  translate
} from './functions';

// Utility functions
export {
  isProviderConfigured,
  getConfiguredProviders,
  isAIAvailable,
  isAIAvailableAsync,
  getDefaultProvider,
  getDefaultProviderSync,
  prefetchAIStatus,
  clearAIStatusCache
} from './utils';

// Event-bus integration
export {
  AI_EVENTS,
  createTrackedRequest,
  completeTrackedRequest,
  failTrackedRequest,
  subscribeToAIEvent,
  subscribeToAIRequests,
  getPendingRequests,
  hasAIPendingRequests,
  emitProviderChanged,
  emitAvailabilityChanged
} from './events';

// React hook
export { useAI } from './useAI';

// Default export for convenience
import { AI_PROVIDERS, AI_TASKS } from './constants';
import {
  autocomplete,
  editLanguage,
  improveDescription,
  summarize,
  generateTravelTips,
  translate
} from './functions';
import {
  isProviderConfigured,
  getConfiguredProviders,
  isAIAvailable,
  isAIAvailableAsync,
  getDefaultProvider,
  prefetchAIStatus
} from './utils';
import { AI_EVENTS, subscribeToAIEvent, subscribeToAIRequests } from './events';
import { useAI } from './useAI';

export default {
  // Constants
  AI_PROVIDERS,
  AI_TASKS,
  AI_EVENTS,

  // High-level functions
  autocomplete,
  editLanguage,
  improveDescription,
  summarize,
  generateTravelTips,
  translate,

  // Utility functions
  isProviderConfigured,
  getConfiguredProviders,
  isAIAvailable,
  isAIAvailableAsync,
  getDefaultProvider,
  prefetchAIStatus,

  // Event-bus integration
  subscribeToAIEvent,
  subscribeToAIRequests,

  // React hook
  useAI
};

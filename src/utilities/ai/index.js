/**
 * AI Utilities for Biensperience
 *
 * Provides text autocomplete, language editing, description improvement,
 * and content summarization for destinations, locations, and travel activities.
 *
 * Supports multiple AI providers with configurable defaults and task-based routing.
 * Includes event-bus integration for cross-tab/real-time synchronization.
 *
 * @module ai
 *
 * @example
 * // Import specific functions
 * import { autocomplete, improveDescription, AI_PROVIDERS } from '../utilities/ai';
 *
 * // Use with default provider
 * const suggestion = await autocomplete('The best time to visit');
 *
 * // Override provider for specific call
 * const improved = await improveDescription(text, { provider: AI_PROVIDERS.ANTHROPIC });
 *
 * // Check if AI is available
 * import { isAIAvailable } from '../utilities/ai';
 * if (isAIAvailable()) {
 *   // Show AI features
 * }
 *
 * // Use React hook with event-bus integration
 * import { useAI } from '../utilities/ai';
 *
 * function MyComponent() {
 *   const { autocomplete, loading, error } = useAI({
 *     context: { entityId: experienceId, entityType: 'experience' }
 *   });
 *
 *   const handleSuggest = async () => {
 *     const suggestion = await autocomplete('The best time to visit');
 *     // Handle suggestion
 *   };
 * }
 */

// Constants
export {
  AI_PROVIDERS,
  AI_TASKS,
  DEFAULT_MODELS,
  PROVIDER_ENDPOINTS,
  SYSTEM_PROMPTS
} from './constants';

// Configuration
export {
  getAIConfig,
  getApiKey,
  getProviderForTask
} from './config';

// Core completion
export { complete } from './complete';

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
  getDefaultProvider
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

// Adapters (for advanced usage)
export {
  adapters,
  getAdapter,
  openaiAdapter,
  anthropicAdapter,
  mistralAdapter,
  geminiAdapter
} from './adapters';

// Default export for convenience
import { AI_PROVIDERS, AI_TASKS } from './constants';
import { getAIConfig } from './config';
import { complete } from './complete';
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
  getDefaultProvider
} from './utils';
import { AI_EVENTS, subscribeToAIEvent, subscribeToAIRequests } from './events';
import { useAI } from './useAI';

export default {
  // Constants
  AI_PROVIDERS,
  AI_TASKS,
  AI_EVENTS,

  // Core functions
  complete,

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
  getDefaultProvider,
  getAIConfig,

  // Event-bus integration
  subscribeToAIEvent,
  subscribeToAIRequests,

  // React hook
  useAI
};

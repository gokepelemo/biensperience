/**
 * NavigationIntentContext
 *
 * Single source of truth for navigation intent in the scroll/shake/highlight system.
 * Tracks when a user intends to navigate to a specific plan item (via deep-link,
 * HashLink, etc.) and whether it should trigger visual highlighting.
 *
 * This eliminates race conditions and scattered state from the previous system
 * that used refs, localStorage, and multiple competing effects.
 */

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { logger } from '../utilities/logger';

// Intent types for different navigation sources
export const INTENT_TYPES = {
  DEEP_LINK: 'deep-link',      // Direct URL with hash (e.g., user shares/pastes URL)
  CROSS_VIEW: 'cross-view',    // Navigation from another view/modal (e.g., Dashboard)
  SAME_PAGE: 'same-page',      // Jump within current page (e.g., same-page HashLink)
};

// Intent expiration time (30 seconds)
const INTENT_EXPIRATION_MS = 30000;

const NavigationIntentContext = createContext(null);

/**
 * Generate unique intent ID
 * Format: intent-{timestamp}-{random4chars}
 */
function generateIntentId() {
  return `intent-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
}

export function NavigationIntentProvider({ children }) {
  const [intent, setIntent] = useState(null);
  const location = useLocation();

  /**
   * Create a new navigation intent
   * @param {string} type - One of INTENT_TYPES (deep-link, cross-view, same-page)
   * @param {string} targetPlanId - The plan ID to navigate to
   * @param {string|null} targetItemId - Optional specific item ID within the plan
   * @param {boolean} shouldAnimate - Whether to trigger highlight animation (default: true)
   * @returns {string} The generated intent ID
   */
  const createIntent = useCallback((type, targetPlanId, targetItemId = null, shouldAnimate = true) => {
    const newIntent = {
      id: generateIntentId(),
      type,
      targetPlanId,
      targetItemId,
      shouldAnimate,
      timestamp: Date.now(),
      consumed: false,
      sourceLocation: location.pathname
    };

    logger.debug('[NavigationIntent] Created intent:', newIntent);
    setIntent(newIntent);
    return newIntent.id;
  }, [location.pathname]);

  /**
   * Mark intent as consumed (prevents re-triggering)
   * Should be called BEFORE performing the navigation action to prevent race conditions
   * @param {string} intentId - The intent ID to consume
   */
  const consumeIntent = useCallback((intentId) => {
    setIntent(prev => {
      if (!prev || prev.id !== intentId) {
        logger.debug('[NavigationIntent] Cannot consume - ID mismatch:', { expected: prev?.id, received: intentId });
        return prev;
      }
      logger.debug('[NavigationIntent] Consumed intent:', intentId);
      return { ...prev, consumed: true };
    });
  }, []);

  /**
   * Clear intent completely
   * Use when navigation failed or intent is no longer valid
   */
  const clearIntent = useCallback(() => {
    logger.debug('[NavigationIntent] Cleared intent');
    setIntent(null);
  }, []);

  /**
   * Check if there's a pending (unconsumed) intent
   */
  const hasPendingIntent = intent && !intent.consumed;

  /**
   * Auto-expire stale intents
   * Prevents orphaned intents from triggering animations long after creation
   */
  useEffect(() => {
    if (!intent || intent.consumed) return;

    const timeout = setTimeout(() => {
      if (Date.now() - intent.timestamp > INTENT_EXPIRATION_MS) {
        logger.debug('[NavigationIntent] Auto-expired stale intent:', intent.id);
        clearIntent();
      }
    }, INTENT_EXPIRATION_MS);

    return () => clearTimeout(timeout);
  }, [intent, clearIntent]);

  /**
   * Parse hash from URL on initial load (deep-link detection)
   * Only creates intent for initial page load with hash, not for SPA navigation
   */
  useEffect(() => {
    // Only process on initial mount with a hash
    const hash = window.location.hash;
    logger.debug('[NavigationIntent] Hash detection on mount:', { hash, pathname: window.location.pathname });

    if (!hash || hash.length < 2) {
      logger.debug('[NavigationIntent] No hash or too short, skipping');
      return;
    }

    // Check if this is a plan-related hash
    const cleanHash = hash.slice(1); // Remove leading #
    if (!cleanHash.startsWith('plan-')) {
      logger.debug('[NavigationIntent] Hash does not start with plan-, skipping:', cleanHash);
      return;
    }

    // Parse plan and item IDs from hash
    // Format: #plan-{planId} or #plan-{planId}-item-{itemId}
    const parts = cleanHash.split('-');
    logger.debug('[NavigationIntent] Hash parts:', parts);

    if (parts.length < 2) {
      logger.debug('[NavigationIntent] Not enough parts in hash, skipping');
      return;
    }

    const planId = parts[1];
    let itemId = null;

    // Check for item ID
    const itemIndex = parts.indexOf('item');
    if (itemIndex !== -1 && parts.length > itemIndex + 1) {
      itemId = parts[itemIndex + 1];
    }

    logger.debug('[NavigationIntent] Parsed IDs from hash:', { planId, itemId, itemIndex });

    // Create deep-link intent if we don't already have one
    if (!intent && planId) {
      logger.debug('[NavigationIntent] Creating deep-link intent:', { planId, itemId });
      createIntent(INTENT_TYPES.DEEP_LINK, planId, itemId, true);
    } else {
      logger.debug('[NavigationIntent] Not creating intent:', { intentExists: !!intent, planId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const contextValue = {
    intent,
    hasPendingIntent,
    createIntent,
    consumeIntent,
    clearIntent,
    INTENT_TYPES
  };

  return (
    <NavigationIntentContext.Provider value={contextValue}>
      {children}
    </NavigationIntentContext.Provider>
  );
}

/**
 * Hook to access navigation intent context
 * Must be used within NavigationIntentProvider
 */
export function useNavigationIntent() {
  const context = useContext(NavigationIntentContext);
  if (!context) {
    throw new Error('useNavigationIntent must be used within NavigationIntentProvider');
  }
  return context;
}

export default NavigationIntentContext;

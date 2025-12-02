/**
 * FeatureFlag Component
 *
 * Conditionally renders children based on feature flag status.
 * Provides multiple rendering patterns for feature-gated UI.
 *
 * @module components/FeatureFlag
 */

import React from 'react';
import { useFeatureFlag, useFeatureFlags } from '../../hooks/useFeatureFlag';
import { logger } from '../../utilities/logger';

/**
 * Render children only if feature flag is enabled
 *
 * @param {Object} props - Component props
 * @param {string} props.flag - Feature flag key to check
 * @param {React.ReactNode} props.children - Content to render if flag is enabled
 * @param {React.ReactNode} props.fallback - Content to render if flag is disabled
 * @param {boolean} props.showFallback - Whether to show fallback (default: true)
 *
 * @example
 * <FeatureFlag flag="ai_features">
 *   <AIAutocompleteButton />
 * </FeatureFlag>
 *
 * @example
 * <FeatureFlag flag="ai_features" fallback={<UpgradePrompt />}>
 *   <AIAutocompleteButton />
 * </FeatureFlag>
 */
export function FeatureFlag({ flag, children, fallback = null, showFallback = true }) {
  const { enabled } = useFeatureFlag(flag);

  if (enabled) {
    return <>{children}</>;
  }

  if (showFallback && fallback) {
    return <>{fallback}</>;
  }

  return null;
}

/**
 * Render children if ANY of the flags are enabled
 *
 * @param {Object} props - Component props
 * @param {Array<string>} props.flags - Array of flag keys
 * @param {React.ReactNode} props.children - Content to render if any flag is enabled
 * @param {React.ReactNode} props.fallback - Content to render if no flags are enabled
 */
export function FeatureFlagAny({ flags, children, fallback = null }) {
  const { enabled } = useFeatureFlags(flags, { mode: 'any' });

  if (enabled) {
    return <>{children}</>;
  }

  return fallback ? <>{fallback}</> : null;
}

/**
 * Render children only if ALL flags are enabled
 *
 * @param {Object} props - Component props
 * @param {Array<string>} props.flags - Array of flag keys
 * @param {React.ReactNode} props.children - Content to render if all flags are enabled
 * @param {React.ReactNode} props.fallback - Content to render if any flag is disabled
 */
export function FeatureFlagAll({ flags, children, fallback = null }) {
  const { enabled } = useFeatureFlags(flags, { mode: 'all' });

  if (enabled) {
    return <>{children}</>;
  }

  return fallback ? <>{fallback}</> : null;
}

/**
 * Render different content based on flag status (switch pattern)
 *
 * @param {Object} props - Component props
 * @param {string} props.flag - Feature flag key
 * @param {React.ReactNode} props.enabled - Content when flag is enabled
 * @param {React.ReactNode} props.disabled - Content when flag is disabled
 *
 * @example
 * <FeatureFlagSwitch
 *   flag="ai_features"
 *   enabled={<AIToolbar />}
 *   disabled={<BasicToolbar />}
 * />
 */
export function FeatureFlagSwitch({ flag, enabled: enabledContent, disabled: disabledContent }) {
  const { enabled } = useFeatureFlag(flag);

  return enabled ? <>{enabledContent}</> : <>{disabledContent}</>;
}

/**
 * Higher-order component to wrap components with feature flag check
 *
 * @param {string} flagKey - Feature flag key
 * @param {Object} options - Options
 * @param {React.ComponentType} options.fallback - Fallback component
 * @returns {Function} HOC function
 *
 * @example
 * const ProtectedAIPanel = withFeatureFlag('ai_features')(AIPanel);
 */
export function withFeatureFlag(flagKey, options = {}) {
  const { fallback: FallbackComponent = null } = options;

  return function(WrappedComponent) {
    function FeatureFlaggedComponent(props) {
      const { enabled } = useFeatureFlag(flagKey);

      if (!enabled) {
        if (FallbackComponent) {
          return <FallbackComponent {...props} />;
        }
        return null;
      }

      return <WrappedComponent {...props} />;
    }

    FeatureFlaggedComponent.displayName = `withFeatureFlag(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

    return FeatureFlaggedComponent;
  };
}

/**
 * Component to display a locked/premium feature message
 *
 * @param {Object} props - Component props
 * @param {string} props.flag - Feature flag key
 * @param {string} props.title - Custom title
 * @param {string} props.message - Custom message
 * @param {string} props.actionLabel - Label for action button
 * @param {Function} props.onAction - Action button click handler
 */
export function FeatureLockedMessage({
  flag,
  title = 'Premium Feature',
  message,
  actionLabel = 'Learn More',
  onAction
}) {
  const { denialMessage } = useFeatureFlag(flag);

  return (
    <div className="feature-locked-message text-center p-4">
      <div className="feature-locked-icon mb-3">
        <span role="img" aria-label="locked" style={{ fontSize: '2rem' }}>🔒</span>
      </div>
      <h5 className="mb-2">{title}</h5>
      <p className="text-muted mb-3">
        {message || denialMessage}
      </p>
      {onAction && (
        <button
          className="btn btn-primary btn-sm"
          onClick={onAction}
          type="button"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

/**
 * Debug component to display feature flag status (dev only)
 *
 * @param {Object} props - Component props
 * @param {string} props.flag - Feature flag key to debug
 */
export function FeatureFlagDebug({ flag }) {
  const { enabled, config, flagKey } = useFeatureFlag(flag);

  // Only render in development
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '10px',
        right: '10px',
        padding: '8px 12px',
        background: enabled ? '#d4edda' : '#f8d7da',
        border: `1px solid ${enabled ? '#c3e6cb' : '#f5c6cb'}`,
        borderRadius: '4px',
        fontSize: '12px',
        fontFamily: 'monospace',
        zIndex: 9999
      }}
    >
      <strong>{flagKey}:</strong> {enabled ? '✅ enabled' : '❌ disabled'}
      {config && Object.keys(config).length > 0 && (
        <div style={{ marginTop: '4px', fontSize: '10px' }}>
          config: {JSON.stringify(config)}
        </div>
      )}
    </div>
  );
}

export default FeatureFlag;

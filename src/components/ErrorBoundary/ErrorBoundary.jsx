/**
 * ErrorBoundary Component
 * Catches JavaScript errors anywhere in the component tree and displays a fallback UI
 */

import React from 'react';
import { Alert, Button, Container } from 'react-bootstrap';
import { logger } from '../../utilities/logger';
import styles from './ErrorBoundary.module.scss';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // If we fail to load a code-split chunk (common after a deploy/server restart
    // while the tab was backgrounded), the fastest recovery is a one-time reload.
    // Guard against reload loops with sessionStorage.
    try {
      const message = error?.message || String(error);
      const isChunkLoadFailure =
        message.includes('Failed to fetch dynamically imported module') ||
        message.includes('Expected a JavaScript-or-Wasm module script') ||
        message.includes('ChunkLoadError') ||
        message.includes('Loading chunk');

      if (isChunkLoadFailure && typeof window !== 'undefined') {
        const key = 'bien:chunkReloadAttempted';
        const legacyKey = 'bien:chunk_reload_attempted';
        const alreadyAttempted =
          window.sessionStorage?.getItem(key) === 'true' ||
          window.sessionStorage?.getItem(legacyKey) === 'true';
        if (!alreadyAttempted) {
          window.sessionStorage?.setItem(key, 'true');
          try { window.sessionStorage?.removeItem(legacyKey); } catch (e) {}
          window.location.reload();
          return;
        }
      }
    } catch (e) {
      // Ignore reload guard failures and proceed with normal error UI.
    }

    // Log error details
    logger.error('ErrorBoundary caught an error', {
      error: error.message,
      componentStack: errorInfo.componentStack,
      errorCount: this.state.errorCount + 1
    }, error);

    this.setState(prevState => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1
    }));

    // Call optional error callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });

    // Call optional reset callback
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <Container className={`${styles.errorBoundaryContainer} my-5`}>
          <Alert variant="danger" className={styles.errorBoundaryAlert}>
            <Alert.Heading>
              {this.props.title || 'Oops! Something went wrong'}
            </Alert.Heading>
            <p>
              {this.props.message ||
                'We encountered an unexpected error. This has been logged and we\'ll look into it.'}
            </p>

            {/* Show error details in development */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className={`${styles.errorDetails} mt-3`}>
                <summary className={styles.cursorPointer}>Error Details (Development Only)</summary>
                <div className="mt-2">
                  <strong>Error:</strong>
                  <pre className="bg-color-secondary p-2 rounded">
                    {this.state.error.toString()}
                  </pre>
                  {this.state.errorInfo && (
                    <>
                      <strong>Component Stack:</strong>
                      <pre className="bg-color-secondary p-2 rounded" style={{ fontSize: '0.85rem' }}>
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </>
                  )}
                </div>
              </details>
            )}

            <div className="mt-4 d-flex gap-2">
              <Button variant="primary" onClick={this.handleReset}>
                Try Again
              </Button>
              <Button variant="outline-secondary" onClick={this.handleReload}>
                Reload Page
              </Button>
              {this.props.showHomeButton && (
                <Button variant="outline-primary" href="/">
                  Go Home
                </Button>
              )}
            </div>
          </Alert>

          {/* Show error frequency warning if errors are recurring */}
          {this.state.errorCount > 2 && (
            <Alert variant="warning" className="mt-3">
              <strong>Recurring Error Detected</strong>
              <p className="mb-0">
                This error has occurred {this.state.errorCount} times.
                You may want to reload the page or contact support if the issue persists.
              </p>
            </Alert>
          )}
        </Container>
      );
    }

    // No error, render children normally
    return this.props.children;
  }
}

/**
 * Function component wrapper for using error boundaries with hooks
 */
export function withErrorBoundary(Component, errorBoundaryProps = {}) {
  return function WithErrorBoundaryWrapper(props) {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

export default ErrorBoundary;

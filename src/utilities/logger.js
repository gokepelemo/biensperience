/**
 * Frontend logging utility for Biensperience application with log level filtering
 *
 * Log Levels (in order of verbosity):
 * - ERROR (0): Critical errors only
 * - WARN (1): Warnings and errors
 * - INFO (2): Important informational messages, warnings, and errors
 * - DEBUG (3): Development debugging info (default)
 * - TRACE (4): Detailed trace information (most verbose)
 *
 * Set REACT_APP_LOG_LEVEL environment variable to control logging:
 * - production: ERROR level (minimal logging)
 * - development: DEBUG level (comprehensive logging without trace)
 * - testing: INFO level (important events only)
 *
 * Override in browser console: window.__LOG_LEVEL__ = 'TRACE'
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4
};

// Determine current log level from environment or browser override
const getLogLevel = () => {
  // Check browser override first (for runtime debugging)
  if (typeof window !== 'undefined' && window.__LOG_LEVEL__) {
    return LOG_LEVELS[window.__LOG_LEVEL__.toUpperCase()] ?? LOG_LEVELS.DEBUG;
  }

  // Check environment variable
  const envLevel = process.env.REACT_APP_LOG_LEVEL?.toUpperCase();
  if (envLevel && LOG_LEVELS[envLevel] !== undefined) {
    return LOG_LEVELS[envLevel];
  }

  // Default based on NODE_ENV
  if (process.env.NODE_ENV === 'production') {
    return LOG_LEVELS.ERROR; // Production: errors only
  } else if (process.env.NODE_ENV === 'test') {
    return LOG_LEVELS.INFO; // Testing: info and above
  }

  return LOG_LEVELS.DEBUG; // Development: debug and above (no trace)
};

let currentLogLevel = getLogLevel();

// Logger utility with level filtering
export const logger = {
  /**
   * Set log level at runtime (useful for debugging)
   * @param {string} level - Log level: 'ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'
   */
  setLevel: (level) => {
    const upperLevel = level.toUpperCase();
    if (LOG_LEVELS[upperLevel] !== undefined) {
      currentLogLevel = LOG_LEVELS[upperLevel];
      if (typeof window !== 'undefined') {
        window.__LOG_LEVEL__ = upperLevel;
      }
      console.log(`Log level set to: ${upperLevel}`);
    } else {
      console.warn(`Invalid log level: ${level}. Valid levels:`, Object.keys(LOG_LEVELS));
    }
  },

  /**
   * Get current log level
   */
  getLevel: () => {
    return Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === currentLogLevel);
  },

  /**
   * Log error - always shown (level 0)
   */
  error: (message, data, error) => {
    if (currentLogLevel >= LOG_LEVELS.ERROR) {
      console.error(message, data, error);
    }
  },

  /**
   * Log warning - shown at WARN level and above (level 1+)
   */
  warn: (message, data, error) => {
    if (currentLogLevel >= LOG_LEVELS.WARN) {
      console.warn(message, data, error);
    }
  },

  /**
   * Log info - shown at INFO level and above (level 2+)
   * Use for important application events
   */
  info: (message, data) => {
    if (currentLogLevel >= LOG_LEVELS.INFO) {
      console.info(message, data);
    }
  },

  /**
   * Log debug - shown at DEBUG level and above (level 3+)
   * Use for development debugging
   */
  debug: (message, data) => {
    if (currentLogLevel >= LOG_LEVELS.DEBUG) {
      console.debug(message, data);
    }
  },

  /**
   * Log trace - shown only at TRACE level (level 4)
   * Use for very detailed debugging (most verbose)
   */
  trace: (message, data) => {
    if (currentLogLevel >= LOG_LEVELS.TRACE) {
      console.trace(message, data);
    }
  },

  /**
   * Log API events - shown at INFO level and above
   */
  apiEvent: (method, url, status, duration, data) => {
    if (currentLogLevel >= LOG_LEVELS.INFO) {
      console.log(`API ${method} ${url} - ${status} (${duration}ms)`, data);
    }
  }
};

// Export log levels for reference
export { LOG_LEVELS };

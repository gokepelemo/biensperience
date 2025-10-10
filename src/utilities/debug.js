/**
 * Debug utility for conditional console logging
 * Only logs when REACT_APP_DEBUG environment variable is set to 'true'
 */

const isDebugMode = process.env.REACT_APP_DEBUG === 'true';

export const debug = {
  log: (...args) => {
    if (isDebugMode) {
      console.log(...args);
    }
  },
  error: (...args) => {
    if (isDebugMode) {
      console.error(...args);
    }
  },
  warn: (...args) => {
    if (isDebugMode) {
      console.warn(...args);
    }
  },
  info: (...args) => {
    if (isDebugMode) {
      console.info(...args);
    }
  },
  table: (...args) => {
    if (isDebugMode) {
      console.table(...args);
    }
  },
  group: (label) => {
    if (isDebugMode) {
      console.group(label);
    }
  },
  groupEnd: () => {
    if (isDebugMode) {
      console.groupEnd();
    }
  },
  isEnabled: () => isDebugMode
};

// Default export
export default debug;

/**
 * Simple frontend logging utility for Biensperience application
 * Only supports console logging for browser environment
 */

// Simple logger for frontend - only console logging
export const logger = {
  error: (message, data, error) => {
    console.error(message, data, error);
  },
  warn: (message, data, error) => {
    console.warn(message, data, error);
  },
  info: (message, data) => {
    console.info(message, data);
  },
  debug: (message, data) => {
    console.debug(message, data);
  },
  trace: (message, data) => {
    console.trace(message, data);
  },
  apiEvent: (method, url, status, duration, data) => {
    console.log(`API ${method} ${url} - ${status} (${duration}ms)`, data);
  }
};

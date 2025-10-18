/**
 * Comprehensive logging utility for Biensperience backend
 * Supports multiple destinations: console, file, log forwarders, Kafka, etc.
 * All logging is async and non-blocking for API events.
 *
 * @module logger
 */

const fs = require('fs').promises;
const path = require('path');

// Log levels
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4
};

// Log level names for display
const LOG_LEVEL_NAMES = {
  [LOG_LEVELS.ERROR]: 'ERROR',
  [LOG_LEVELS.WARN]: 'WARN',
  [LOG_LEVELS.INFO]: 'INFO',
  [LOG_LEVELS.DEBUG]: 'DEBUG',
  [LOG_LEVELS.TRACE]: 'TRACE'
};

// Environment configuration
const config = {
  logLevel: process.env.LOG_LEVEL ? parseInt(process.env.LOG_LEVEL) : LOG_LEVELS.INFO,
  enableConsole: process.env.LOG_CONSOLE !== 'false', // Default true
  enableFile: process.env.LOG_FILE === 'true',
  logFilePath: process.env.LOG_FILE_PATH || path.join(process.cwd(), 'logs', 'app.log'),
  enableForwarder: process.env.LOG_FORWARDER === 'true',
  forwarderUrl: process.env.LOG_FORWARDER_URL,
  enableKafka: process.env.LOG_KAFKA === 'true',
  kafkaConfig: {
    brokers: process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : [],
    topic: process.env.KAFKA_TOPIC || 'biensperience-logs'
  }
};

// Destination subscribers (hooks for custom destinations)
const subscribers = new Set();

/**
 * Subscribe to log events for custom destinations
 * @param {Function} subscriber - Function that receives log data
 */
function subscribeToLogs(subscriber) {
  if (typeof subscriber === 'function') {
    subscribers.add(subscriber);
  }
}

/**
 * Unsubscribe from log events
 * @param {Function} subscriber - Function to remove
 */
function unsubscribeFromLogs(subscriber) {
  subscribers.delete(subscriber);
}

/**
 * Format log entry
 * @param {number} level - Log level
 * @param {string} message - Log message
 * @param {Object} meta - Additional metadata
 * @param {Error} error - Optional error object
 * @returns {Object} Formatted log entry
 */
function formatLogEntry(level, message, meta = {}, error = null) {
  const timestamp = new Date().toISOString();
  const levelName = LOG_LEVEL_NAMES[level];

  const entry = {
    timestamp,
    level,
    levelName,
    message,
    ...meta,
    process: {
      pid: process.pid,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    }
  };

  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return entry;
}

/**
 * Write to file destination (async)
 * @param {string} logString - Formatted log string
 */
async function writeToFile(logString) {
  if (!config.enableFile) return;

  try {
    // Ensure log directory exists
    const logDir = path.dirname(config.logFilePath);
    await fs.mkdir(logDir, { recursive: true });

    // Append to file
    await fs.appendFile(config.logFilePath, logString + '\n', 'utf8');
  } catch (error) {
    // Fallback to console if file logging fails
    console.error('Failed to write to log file:', error);
  }
}

/**
 * Send to log forwarder (async)
 * @param {Object} logEntry - Formatted log entry
 */
async function sendToForwarder(logEntry) {
  if (!config.enableForwarder || !config.forwarderUrl) return;

  try {
    const https = require('https');
    const http = require('http');

    const url = new URL(config.forwarderUrl);
    const client = url.protocol === 'https:' ? https : http;

    const data = JSON.stringify(logEntry);

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = client.request(options);
    req.write(data);
    req.end();
  } catch (error) {
    console.error('Failed to send to log forwarder:', error);
  }
}

/**
 * Send to Kafka (async)
 * @param {Object} logEntry - Formatted log entry
 */
async function sendToKafka(logEntry) {
  if (!config.enableKafka || !config.kafkaConfig.brokers.length) return;

  try {
    // Dynamic import to avoid requiring kafka if not used
    const { Kafka } = require('kafkajs');

    const kafka = new Kafka({
      clientId: 'biensperience-logger',
      brokers: config.kafkaConfig.brokers
    });

    const producer = kafka.producer();
    await producer.connect();

    await producer.send({
      topic: config.kafkaConfig.topic,
      messages: [{
        value: JSON.stringify(logEntry)
      }]
    });

    await producer.disconnect();
  } catch (error) {
    console.error('Failed to send to Kafka:', error);
  }
}

/**
 * Notify subscribers (async)
 * @param {Object} logEntry - Formatted log entry
 */
async function notifySubscribers(logEntry) {
  const promises = Array.from(subscribers).map(async (subscriber) => {
    try {
      await subscriber(logEntry);
    } catch (error) {
      console.error('Log subscriber error:', error);
    }
  });

  await Promise.allSettled(promises);
}

/**
 * Core logging function
 * @param {number} level - Log level
 * @param {number} message - Log message
 * @param {Object} meta - Additional metadata
 * @param {Error} error - Optional error object
 */
async function log(level, message, meta = {}, error = null) {
  // Check if this log level should be processed
  if (level > config.logLevel) return;

  const logEntry = formatLogEntry(level, message, meta, error);
  const logString = JSON.stringify(logEntry);

  // Fire-and-forget all destinations (non-blocking)
  const promises = [];

  // Console logging
  if (config.enableConsole) {
    const consoleMethod = level === LOG_LEVELS.ERROR ? 'error' :
                         level === LOG_LEVELS.WARN ? 'warn' :
                         level === LOG_LEVELS.DEBUG ? 'debug' :
                         level === LOG_LEVELS.TRACE ? 'debug' : 'log';

    console[consoleMethod](`[${logEntry.levelName}] ${message}`, meta, error || '');
  }

  // File logging
  promises.push(writeToFile(logString));

  // Log forwarder
  promises.push(sendToForwarder(logEntry));

  // Kafka
  promises.push(sendToKafka(logEntry));

  // Subscribers
  promises.push(notifySubscribers(logEntry));

  // Don't await - let all destinations process asynchronously
  Promise.allSettled(promises).catch(error => {
    console.error('Logging error:', error);
  });
}

// Public logging API
const logger = {
  /**
   * Log error message
   * @param {string} message - Error message
   * @param {Object} meta - Additional metadata
   * @param {Error} error - Error object
   */
  error: (message, meta = {}, error = null) => log(LOG_LEVELS.ERROR, message, meta, error),

  /**
   * Log warning message
   * @param {string} message - Warning message
   * @param {Object} meta - Additional metadata
   */
  warn: (message, meta = {}) => log(LOG_LEVELS.WARN, message, meta),

  /**
   * Log info message
   * @param {string} message - Info message
   * @param {Object} meta - Additional metadata
   */
  info: (message, meta = {}) => log(LOG_LEVELS.INFO, message, meta),

  /**
   * Log debug message
   * @param {string} message - Debug message
   * @param {Object} meta - Additional metadata
   */
  debug: (message, meta = {}) => log(LOG_LEVELS.DEBUG, message, meta),

  /**
   * Log trace message
   * @param {string} message - Trace message
   * @param {Object} meta - Additional metadata
   */
  trace: (message, meta = {}) => log(LOG_LEVELS.TRACE, message, meta),

  /**
   * Log API event (always async, non-blocking)
   * @param {string} method - HTTP method
   * @param {string} url - Request URL
   * @param {number} statusCode - Response status code
   * @param {number} duration - Request duration in ms
   * @param {Object} meta - Additional metadata
   */
  apiEvent: (method, url, statusCode, duration, meta = {}) => {
    const level = statusCode >= 500 ? LOG_LEVELS.ERROR :
                  statusCode >= 400 ? LOG_LEVELS.WARN : LOG_LEVELS.INFO;

    log(level, `API ${method} ${url} - ${statusCode} (${duration}ms)`, {
      api: {
        method,
        url,
        statusCode,
        duration
      },
      ...meta
    });
  },

  /**
   * Subscribe to log events
   * @param {Function} subscriber - Subscriber function
   */
  subscribe: subscribeToLogs,

  /**
   * Unsubscribe from log events
   * @param {Function} subscriber - Subscriber function
   */
  unsubscribe: unsubscribeFromLogs,

  /**
   * Get current configuration
   */
  getConfig: () => ({ ...config }),

  /**
   * Update configuration (for runtime changes)
   * @param {Object} newConfig - New configuration
   */
  updateConfig: (newConfig) => {
    Object.assign(config, newConfig);
  }
};

module.exports = logger;

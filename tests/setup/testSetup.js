/**
 * Test Setup - Database Configuration
 *
 * Configures MongoDB Memory Server for testing.
 * Creates an in-memory MongoDB instance for isolated testing.
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;
let activeUsers = 0;

function isConnected() {
  return mongoose.connection.readyState === 1;
}

function withTimeout(promise, ms, label) {
  let timeoutId;
  const timeoutPromise = new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve({ __timedOut: true, label }), ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

/**
 * Connect to the in-memory database
 */
async function connect() {
  // Jest reuses worker processes across multiple test files.
  // Keep a single in-memory server/connection per worker and ref-count callers.
  if (isConnected() && mongoServer) {
    activeUsers += 1;
    return;
  }

  if (!mongoServer) {
    mongoServer = await MongoMemoryServer.create();
  }

  const mongoUri = mongoServer.getUri();
  if (!isConnected()) {
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  }

  activeUsers = Math.max(activeUsers, 0) + 1;
}

/**
 * Close database connection and stop MongoMemoryServer
 */
async function closeDatabase() {
  if (activeUsers > 1) {
    activeUsers -= 1;
    return;
  }

  activeUsers = 0;

  try {
    if (isConnected()) {
      // Dropping the DB is unnecessary for MongoMemoryServer teardown and
      // occasionally hangs under full-suite concurrency. Disconnect best-effort.
      try {
        await withTimeout(mongoose.disconnect(), 5000, 'mongoose.disconnect');
      } catch (e) {
        // ignore
      }
    }
  } finally {
    if (mongoServer) {
      try {
        await withTimeout(mongoServer.stop(), 5000, 'mongoServer.stop');
      } catch (e) {
        // ignore
      }
      mongoServer = null;
    }
  }
}

/**
 * Clear all collections in the database
 */
async function clearDatabase() {
  if (!isConnected()) return;
  const collections = mongoose.connection.collections;

  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
}

module.exports = {
  connect,
  closeDatabase,
  clearDatabase,
};

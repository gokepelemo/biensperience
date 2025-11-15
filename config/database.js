const mongoose = require('mongoose');
const backendLogger = require('../utilities/backend-logger');

// Determine MongoDB URI. In production, require DATABASE_URL to be set.
const envUri = process.env.DATABASE_URL;
const defaultDevUri = 'mongodb://localhost:27017/biensperience_dev';
const mongoUri = envUri || (String(process.env.NODE_ENV).toLowerCase() === 'production' ? null : defaultDevUri);

if (!mongoUri) {
    // Clear and helpful error for missing production DATABASE_URL
    backendLogger.error('Missing DATABASE_URL environment variable. Aborting startup.');
    // Also print to stderr for manual runs where logger may not be configured
    console.error('ERROR: DATABASE_URL environment variable is required in production.');
    process.exit(1);
}

mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true }).catch(err => {
    backendLogger.error('Failed to connect to MongoDB', { error: err.message });
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
});

const db = mongoose.connection;

db.on('connected', function () {
    backendLogger.info('Database connected', { database: db.name, host: db.host, port: db.port });
});

// Optional: verbose query tracing for performance tuning
// Enable by setting MONGOOSE_DEBUG=true in env
if (String(process.env.MONGOOSE_DEBUG).toLowerCase() === 'true') {
    try {
        mongoose.set('debug', function (collectionName, method, query, doc, options) {
            // Avoid logging sensitive data
            const safeDoc = doc ? Object.keys(doc) : undefined;
            backendLogger.debug('Mongoose query', {
                collection: collectionName,
                method,
                query,
                docKeys: safeDoc,
                options
            });
        });
        backendLogger.info('Mongoose debug enabled');
    } catch (e) {
        backendLogger.warn('Failed to enable Mongoose debug', { error: e.message });
    }
}
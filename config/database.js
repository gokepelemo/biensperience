const mongoose = require('mongoose');
const backendLogger = require('../utilities/backend-logger');

mongoose.connect(process.env.DATABASE_URL);

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
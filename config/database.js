const mongoose = require('mongoose');
const backendLogger = require('../utilities/backend-logger');

mongoose.connect(process.env.DATABASE_URL);

const db = mongoose.connection;

db.on('connected', function () {
    backendLogger.info('Database connected', { database: db.name, host: db.host, port: db.port });
});
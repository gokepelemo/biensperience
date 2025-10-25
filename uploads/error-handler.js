const backendLogger = require('../utilities/backend-logger');

module.exports = function (err, res) {
  if (err.name.match(/Valid/) || err.name === "MongoError") {
    const message = "The received params failed a Mongoose validation";
    err = { status: 422, message };
  } else if (err.name === "DocumentNotFound") {
    err.status = 404;
  } else if (err.name === "CastError" || err.name === "BadParamsError") {
    err.status = 422;
  }
  res.status(err.status || 500).json(err);
  if (!process.env.TESTENV) {
    backendLogger.error('Upload error handler', { error: err.message, status: err.status, name: err.name });
  }
};

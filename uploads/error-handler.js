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
  process.env.TESTENV || console.error(err);
};

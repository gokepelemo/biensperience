// Helper to sanitize file names using sanitize-filename
const sanitize = require('sanitize-filename');
module.exports = function(filename) {
  return sanitize(filename);
};
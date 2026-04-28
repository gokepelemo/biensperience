/**
 * Façade — implementation split into controllers/api/plans/ (bd #97c6).
 *
 * This file used to be 5,796 lines. The implementation is now distributed across
 * per-domain modules under controllers/api/plans/. Routes (routes/api/plans.js)
 * import this façade unchanged via `require('../../controllers/api/plans')`.
 */

const crud = require('./plans/crud');
const items = require('./plans/items');
const collaborators = require('./plans/collaborators');
const notes = require('./plans/notes');
const details = require('./plans/details');
const costs = require('./plans/costs');
const dateShift = require('./plans/date-shift');
const aiConfig = require('./plans/ai-config');

module.exports = {
  ...crud,
  ...items,
  ...collaborators,
  ...notes,
  ...details,
  ...costs,
  ...dateShift,
  ...aiConfig,
};

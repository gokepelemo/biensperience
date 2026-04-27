/**
 * BienBot Action Executor — façade.
 *
 * The implementation has been split by domain into `utilities/bienbot-actions/`
 * (see bd #8f36.14). This file re-exports the aggregated public API so the
 * 30+ existing import sites — controllers, models, tests — keep working
 * without churn.
 *
 * Add new handlers to the appropriate per-domain module:
 *   - plan-actions.js        — plans, plan items, plan sub-resources, plan fetchers
 *   - experience-actions.js  — experience CRUD + fetch_experience_items
 *   - destination-actions.js — destination CRUD, favorites, fetch_destination_experiences
 *   - user-actions.js        — collaborator invites, follows, profile, fetch_user_plans
 *   - discovery-actions.js   — content discovery, photos, suggestions, navigate
 *   - workflow-actions.js    — multi-step workflow + $step_N ref resolution
 *
 * The aggregator in `utilities/bienbot-actions/index.js` builds the
 * ALLOWED_ACTION_TYPES / READ_ONLY_ACTION_TYPES / TOOL_CALL_ACTION_TYPES /
 * ACTION_HANDLERS registry tables and exposes `executeAction`/`executeActions`.
 *
 * @module utilities/bienbot-action-executor
 */

module.exports = require('./bienbot-actions');

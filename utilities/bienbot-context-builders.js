/**
 * BienBot Context Builders — façade
 *
 * Backward-compatibility shim. The implementation now lives in
 * `utilities/bienbot-context/` (one module per entity type). This file
 * re-exports the public surface so existing consumers
 * (`require('./bienbot-context-builders')`) continue to work unchanged.
 *
 * A follow-up ticket can flip the imports to `require('./bienbot-context')`
 * directly and remove this façade.
 *
 * @module utilities/bienbot-context-builders
 */

module.exports = require('./bienbot-context');

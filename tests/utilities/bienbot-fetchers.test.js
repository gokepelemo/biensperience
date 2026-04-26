const {
  READ_ONLY_ACTION_TYPES,
  ACTION_HANDLERS
} = require('../../utilities/bienbot-action-executor');

describe('fetch_plan_items registration', () => {
  it('is registered as a read-only action type', () => {
    expect(READ_ONLY_ACTION_TYPES.has('fetch_plan_items')).toBe(true);
  });

  it('has a handler', () => {
    expect(typeof ACTION_HANDLERS.fetch_plan_items).toBe('function');
  });
});

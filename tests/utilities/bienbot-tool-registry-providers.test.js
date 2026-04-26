const { _resetRegistryForTest, getTool, executeRegisteredTool } = require('../../utilities/bienbot-tool-registry');
const { _resetForTest, bootstrap } = require('../../utilities/bienbot-tool-registry/bootstrap');

describe('Wikivoyage provider registration', () => {
  beforeEach(() => {
    _resetRegistryForTest();
    _resetForTest();
    bootstrap();
  });

  it('registers fetch_destination_tips', () => {
    expect(getTool('fetch_destination_tips')).toBeTruthy();
  });

  it('rejects invalid destination_id', async () => {
    const out = await executeRegisteredTool(
      'fetch_destination_tips',
      { destination_id: 'not-a-real-id' },
      { _id: 'u1' },
      {}
    );
    expect(out.success).toBe(false);
    expect(out.body.error).toBeDefined();
  });
});

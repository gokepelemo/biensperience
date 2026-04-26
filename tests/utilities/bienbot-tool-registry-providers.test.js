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

describe('Google Maps provider', () => {
  beforeEach(() => {
    _resetRegistryForTest();
    _resetForTest();
    process.env.GOOGLE_MAPS_API_KEY = 'test-key';
    bootstrap();
  });
  afterEach(() => { delete process.env.GOOGLE_MAPS_API_KEY; });

  it('registers fetch_destination_places', () => {
    expect(getTool('fetch_destination_places')).toBeTruthy();
  });

  it('disables provider when GOOGLE_MAPS_API_KEY is absent', () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    _resetRegistryForTest();
    _resetForTest();
    bootstrap();
    expect(getTool('fetch_destination_places')).toBeNull();
  });
});

describe('TripAdvisor provider', () => {
  beforeEach(() => {
    _resetRegistryForTest();
    _resetForTest();
    process.env.TRIPADVISOR_API_KEY = 'test-key';
    bootstrap();
  });
  afterEach(() => { delete process.env.TRIPADVISOR_API_KEY; });

  it('registers fetch_destination_attractions', () => {
    expect(getTool('fetch_destination_attractions')).toBeTruthy();
  });

  it('is disabled when TRIPADVISOR_API_KEY is absent', () => {
    delete process.env.TRIPADVISOR_API_KEY;
    _resetRegistryForTest();
    _resetForTest();
    bootstrap();
    expect(getTool('fetch_destination_attractions')).toBeNull();
  });
});

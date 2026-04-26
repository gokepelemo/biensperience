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

describe('Unsplash provider', () => {
  beforeEach(() => {
    _resetRegistryForTest();
    _resetForTest();
    process.env.UNSPLASH_ACCESS_KEY = 'test-key';
    bootstrap();
  });
  afterEach(() => { delete process.env.UNSPLASH_ACCESS_KEY; });

  it('registers fetch_destination_photos', () => {
    expect(getTool('fetch_destination_photos')).toBeTruthy();
  });

  it('is disabled when UNSPLASH_ACCESS_KEY is absent', () => {
    delete process.env.UNSPLASH_ACCESS_KEY;
    _resetRegistryForTest();
    _resetForTest();
    bootstrap();
    expect(getTool('fetch_destination_photos')).toBeNull();
  });
});

describe('Weather provider', () => {
  beforeEach(() => {
    _resetRegistryForTest();
    _resetForTest();
    process.env.OPENWEATHER_API_KEY = 'test-key';
    bootstrap();
  });
  afterEach(() => { delete process.env.OPENWEATHER_API_KEY; });

  it('registers fetch_forecast', () => {
    expect(getTool('fetch_forecast')).toBeTruthy();
  });

  it('is disabled when OPENWEATHER_API_KEY is absent', () => {
    delete process.env.OPENWEATHER_API_KEY;
    _resetRegistryForTest();
    _resetForTest();
    bootstrap();
    expect(getTool('fetch_forecast')).toBeNull();
  });
});

describe('Holidays provider', () => {
  beforeEach(() => {
    _resetRegistryForTest();
    _resetForTest();
    bootstrap();
  });

  it('registers fetch_public_holidays without requiring an env key', () => {
    expect(getTool('fetch_public_holidays')).toBeTruthy();
  });
});

describe('Webhook provider', () => {
  beforeEach(() => {
    _resetRegistryForTest();
    _resetForTest();
    process.env.TRIP_ALERT_WEBHOOK_URL = 'https://hooks.test/abc';
    bootstrap();
  });
  afterEach(() => { delete process.env.TRIP_ALERT_WEBHOOK_URL; });

  it('registers send_trip_alert as a write tool', () => {
    const entry = getTool('send_trip_alert');
    expect(entry).toBeTruthy();
    expect(entry.tool.mutating).toBe(true);
    expect(entry.tool.irreversible).toBe(true);
    expect(entry.tool.confirmDescription).toMatch(/{alert_type}/);
  });

  it('is disabled when TRIP_ALERT_WEBHOOK_URL is absent', () => {
    delete process.env.TRIP_ALERT_WEBHOOK_URL;
    _resetRegistryForTest();
    _resetForTest();
    bootstrap();
    expect(getTool('send_trip_alert')).toBeNull();
  });
});

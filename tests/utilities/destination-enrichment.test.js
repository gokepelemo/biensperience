/**
 * Unit tests for utilities/destination-enrichment.
 *
 * Covers the registry-backed replacement for the legacy `enrichDestination`
 * chain that was deleted in T11. Asserts:
 *   - Each registry tool is called once with the destination's name
 *   - A failing tool does not block the others (parallel resilience)
 *   - 503 from a disabled provider is treated as "no data", not failure
 *   - Tips merged onto Destination doc; doc save() invoked; timestamp set
 *   - Photos persisted via Photo.create and pushed onto destination.photos
 *   - Cache freshness short-circuits before any tool is called
 *   - Background mode returns cached data and fires the refresh async
 *
 * The module's deps are mocked at the boundary (toolRegistry, mongoose
 * models, permission-enforcer). Integration with real tool handlers is
 * covered by tests/utilities/bienbot-tool-registry-providers.test.js.
 */

jest.mock('../../utilities/backend-logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../utilities/bienbot-tool-registry', () => ({
  executeRegisteredTool: jest.fn()
}));

jest.mock('../../utilities/bienbot-tool-registry/bootstrap', () => ({
  bootstrap: jest.fn()
}));

jest.mock('../../utilities/permission-enforcer', () => ({
  getEnforcer: jest.fn()
}));

jest.mock('../../utilities/controller-helpers', () => ({
  validateObjectId: jest.fn((id) => {
    const valid = typeof id === 'string' && /^[a-f0-9]{24}$/.test(id);
    return { valid, error: valid ? null : 'Invalid id', objectId: valid ? id : null };
  })
}));

jest.mock('../../models/destination', () => ({ findById: jest.fn() }));
jest.mock('../../models/experience', () => ({}));
jest.mock('../../models/plan', () => ({}));
jest.mock('../../models/user', () => ({}));
jest.mock('../../models/photo', () => ({
  create: jest.fn(),
  find: jest.fn()
}));

const Destination = require('../../models/destination');
const Photo = require('../../models/photo');
const toolRegistry = require('../../utilities/bienbot-tool-registry');
const { getEnforcer } = require('../../utilities/permission-enforcer');

const {
  enrichDestinationViaRegistry,
  _internal
} = require('../../utilities/destination-enrichment');

const VALID_ID = 'a'.repeat(24);
const mockUser = { _id: 'u1', name: 'Test User' };

function makeMockDestination(overrides = {}) {
  return {
    _id: VALID_ID,
    name: 'Paris',
    photos: [],
    travel_tips: [],
    travel_tips_updated_at: null,
    save: jest.fn().mockResolvedValue(true),
    toObject: jest.fn().mockReturnValue({
      _id: VALID_ID, name: 'Paris', travel_tips: [], photos: []
    }),
    ...overrides
  };
}

function ok(name, body) {
  return { success: true, statusCode: 200, body, errors: [] };
}
function disabled() {
  return { success: false, statusCode: 503, body: { ok: false, error: 'provider_unavailable' }, errors: ['provider_unavailable'] };
}
function upstreamFail() {
  return { success: false, statusCode: 502, body: { ok: false, error: 'upstream_unavailable' }, errors: ['upstream_unavailable'] };
}

describe('destination-enrichment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getEnforcer.mockReturnValue({
      canEdit: jest.fn().mockResolvedValue({ allowed: true })
    });
    Photo.find.mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) })
    });
  });

  // -------------------------------------------------------------------------
  // Validation + permission
  // -------------------------------------------------------------------------

  it('returns 400 for invalid destination ID', async () => {
    const out = await enrichDestinationViaRegistry('not-an-oid', mockUser);
    expect(out.statusCode).toBe(400);
    expect(toolRegistry.executeRegisteredTool).not.toHaveBeenCalled();
  });

  it('returns 404 when destination not found', async () => {
    Destination.findById.mockResolvedValue(null);
    const out = await enrichDestinationViaRegistry(VALID_ID, mockUser);
    expect(out.statusCode).toBe(404);
    expect(toolRegistry.executeRegisteredTool).not.toHaveBeenCalled();
  });

  it('returns 403 when user lacks edit permission', async () => {
    getEnforcer.mockReturnValue({
      canEdit: jest.fn().mockResolvedValue({ allowed: false, reason: 'nope' })
    });
    Destination.findById.mockResolvedValue(makeMockDestination());
    const out = await enrichDestinationViaRegistry(VALID_ID, mockUser);
    expect(out.statusCode).toBe(403);
    expect(toolRegistry.executeRegisteredTool).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Cache freshness
  // -------------------------------------------------------------------------

  it('short-circuits with cached data when fresh and not forced', async () => {
    Destination.findById.mockResolvedValue(makeMockDestination({
      travel_tips: [{ type: 'Custom', value: 'tip' }],
      travel_tips_updated_at: new Date()
    }));
    const out = await enrichDestinationViaRegistry(VALID_ID, mockUser);
    expect(out.statusCode).toBe(200);
    expect(out.body.data.cached).toBe(true);
    expect(toolRegistry.executeRegisteredTool).not.toHaveBeenCalled();
  });

  it('runs enrichment when cache is fresh but force=true', async () => {
    Destination.findById.mockResolvedValue(makeMockDestination({
      travel_tips: [{ type: 'Custom', value: 'tip' }],
      travel_tips_updated_at: new Date()
    }));
    toolRegistry.executeRegisteredTool.mockResolvedValue(disabled());

    const out = await enrichDestinationViaRegistry(VALID_ID, mockUser, { force: true });
    expect(out.statusCode).toBe(200);
    expect(out.body.data.cached).toBe(false);
    expect(toolRegistry.executeRegisteredTool).toHaveBeenCalledTimes(4);
  });

  // -------------------------------------------------------------------------
  // Tool dispatch + parallel resilience
  // -------------------------------------------------------------------------

  it('calls all four registry tools in parallel with the destination name', async () => {
    Destination.findById.mockResolvedValue(makeMockDestination());
    toolRegistry.executeRegisteredTool.mockResolvedValue(disabled());

    await enrichDestinationViaRegistry(VALID_ID, mockUser);

    const calls = toolRegistry.executeRegisteredTool.mock.calls;
    const names = calls.map((c) => c[0]).sort();
    expect(names).toEqual([
      'fetch_destination_attractions',
      'fetch_destination_photos',
      'fetch_destination_places',
      'fetch_destination_tips'
    ]);

    // Every payload includes destination_name = 'Paris'
    for (const [, payload] of calls) {
      expect(payload.destination_name).toBe('Paris');
    }
    // Tips additionally requires destination_id
    const tipsCall = calls.find((c) => c[0] === 'fetch_destination_tips');
    expect(tipsCall[1].destination_id).toBe(VALID_ID);
  });

  it('survives a thrown registry promise (parallel resilience)', async () => {
    Destination.findById.mockResolvedValue(makeMockDestination());
    toolRegistry.executeRegisteredTool.mockImplementation((name) => {
      if (name === 'fetch_destination_tips') return Promise.reject(new Error('boom'));
      return Promise.resolve(disabled());
    });

    const out = await enrichDestinationViaRegistry(VALID_ID, mockUser);
    expect(out.statusCode).toBe(200);
    expect(out.body.data.cached).toBe(false);
    // Other tools were still attempted
    expect(toolRegistry.executeRegisteredTool).toHaveBeenCalledTimes(4);
  });

  it('survives an upstream failure on one tool', async () => {
    Destination.findById.mockResolvedValue(makeMockDestination());
    toolRegistry.executeRegisteredTool.mockImplementation((name) => {
      if (name === 'fetch_destination_attractions') return Promise.resolve(upstreamFail());
      if (name === 'fetch_destination_tips') {
        return Promise.resolve(ok('fetch_destination_tips', {
          destination_name: 'Paris',
          tips: [{ section: 'see', type: 'Custom', category: 'Sightseeing', content: 'See the Eiffel Tower', icon: '👁️' }],
          returned: 1
        }));
      }
      return Promise.resolve(disabled());
    });

    const dest = makeMockDestination();
    Destination.findById.mockResolvedValue(dest);

    const out = await enrichDestinationViaRegistry(VALID_ID, mockUser);
    expect(out.statusCode).toBe(200);
    expect(dest.save).toHaveBeenCalled();
    expect(dest.travel_tips).toHaveLength(1);
    expect(dest.travel_tips[0]).toMatchObject({
      type: 'Custom',
      category: 'Sightseeing',
      value: 'See the Eiffel Tower',
      source: 'Wikivoyage'
    });
  });

  // -------------------------------------------------------------------------
  // Merge into Destination doc
  // -------------------------------------------------------------------------

  it('merges tips from all successful providers into travel_tips', async () => {
    const dest = makeMockDestination();
    Destination.findById.mockResolvedValue(dest);

    toolRegistry.executeRegisteredTool.mockImplementation((name) => {
      if (name === 'fetch_destination_tips') {
        return Promise.resolve(ok('tips', {
          tips: [{ section: 'eat', type: 'Food', category: 'Food', content: 'Try the croissants' }]
        }));
      }
      if (name === 'fetch_destination_places') {
        return Promise.resolve(ok('places', {
          places: [{ name: 'Le Comptoir', address: '9 Carrefour de l\'Odéon', rating: 4.5, place_id: 'pid1' }]
        }));
      }
      if (name === 'fetch_destination_attractions') {
        return Promise.resolve(ok('attractions', {
          attractions: [{ name: 'Louvre', rating: 4.7, num_reviews: 100000, web_url: 'https://t.com/Louvre' }]
        }));
      }
      return Promise.resolve(disabled()); // photos
    });

    await enrichDestinationViaRegistry(VALID_ID, mockUser);

    expect(dest.save).toHaveBeenCalled();
    expect(dest.travel_tips).toHaveLength(3);
    const sources = dest.travel_tips.map((t) => t.source);
    expect(sources).toEqual(expect.arrayContaining(['Wikivoyage', 'Google Maps', 'TripAdvisor']));
  });

  it('persists photos via Photo.create and dedupes against existing URLs', async () => {
    const dest = makeMockDestination();
    Destination.findById.mockResolvedValue(dest);
    // Existing destination already has one Unsplash photo we should dedupe
    dest.photos = ['existing-photo-id'];
    Photo.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ url: 'https://unsplash.com/old.jpg' }])
      })
    });

    Photo.create.mockImplementation((doc) =>
      Promise.resolve({ _id: `pid-${doc.url.slice(-3)}`, ...doc })
    );

    toolRegistry.executeRegisteredTool.mockImplementation((name) => {
      if (name === 'fetch_destination_photos') {
        return Promise.resolve(ok('photos', {
          photos: [
            { url: 'https://unsplash.com/old.jpg', photographer: 'Old' },                 // dedup
            { url: 'https://unsplash.com/new1.jpg', photographer: 'Alice', photographer_url: 'https://u/alice' },
            { url: 'https://unsplash.com/new2.jpg' }
          ]
        }));
      }
      return Promise.resolve(disabled());
    });

    await enrichDestinationViaRegistry(VALID_ID, mockUser);

    expect(Photo.create).toHaveBeenCalledTimes(2); // old.jpg deduped
    const newIds = dest.photos.filter((p) => p !== 'existing-photo-id');
    expect(newIds).toHaveLength(2);
    expect(dest.save).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Background mode
  // -------------------------------------------------------------------------

  it('returns cached data immediately in background mode and fires async refresh', async () => {
    const dest = makeMockDestination({
      travel_tips: [{ type: 'Custom', value: 'stale' }],
      travel_tips_updated_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
    });
    Destination.findById.mockResolvedValue(dest);
    toolRegistry.executeRegisteredTool.mockResolvedValue(disabled());

    const out = await enrichDestinationViaRegistry(VALID_ID, mockUser, { background: true });

    expect(out.statusCode).toBe(200);
    expect(out.body.data.cached).toBe(true);
    expect(out.body.data.refreshing).toBe(true);

    // Allow microtasks to flush so the fire-and-forget call hits the mock
    await new Promise((r) => setImmediate(r));
    expect(toolRegistry.executeRegisteredTool).toHaveBeenCalledTimes(4);
  });

  // -------------------------------------------------------------------------
  // Mapping helpers
  // -------------------------------------------------------------------------

  describe('_internal mapping helpers', () => {
    it('tipFromRegistry maps a registry tip into travel_tips shape', () => {
      const out = _internal.tipFromRegistry({
        section: 'see', type: 'Custom', category: 'Sightseeing', content: ' See it ', icon: '👁️'
      }, 'Paris');
      expect(out).toMatchObject({
        type: 'Custom',
        category: 'Sightseeing',
        value: 'See it',
        source: 'Wikivoyage',
        icon: '👁️'
      });
      expect(out.url).toContain('Paris');
      expect(out.callToAction.url).toContain('Paris');
    });

    it('tipFromRegistry returns null on empty content', () => {
      expect(_internal.tipFromRegistry({ content: '   ' }, 'Paris')).toBeNull();
      expect(_internal.tipFromRegistry(null, 'Paris')).toBeNull();
    });

    it('tipFromGooglePlace folds rating and address into the value', () => {
      const out = _internal.tipFromGooglePlace({ name: 'Le Cafe', rating: 4.5, address: '12 rue X', place_id: 'pid' });
      expect(out.value).toContain('Le Cafe');
      expect(out.value).toContain('4.5★');
      expect(out.value).toContain('12 rue X');
      expect(out.source).toBe('Google Maps');
      expect(out.url).toContain('place_id:pid');
    });

    it('tipFromTripAdvisor folds rating and review count', () => {
      const out = _internal.tipFromTripAdvisor({ name: 'Louvre', rating: 4.7, num_reviews: 100000, web_url: 'https://t.com/x' });
      expect(out.value).toContain('Louvre');
      expect(out.value).toContain('4.7★');
      expect(out.value).toContain('100000 reviews');
      expect(out.source).toBe('TripAdvisor');
    });
  });
});

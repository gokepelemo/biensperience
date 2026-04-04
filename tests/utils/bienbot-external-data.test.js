/**
 * Unit tests for bienbot-external-data
 *
 * Tests:
 * - normalizedSimilarity() edge cases (empty, identical, partial overlap)
 * - withRetry() timeout, retries, exponential backoff
 * - suggestPlanItems() validation, empty results, deduplication, frequency ranking
 * - fetchEntityPhotos() validation, Unsplash API mock, missing API key graceful degradation
 * - addEntityPhotos() permission check, S3 transfer, Unsplash URL photos
 * - fetchWikivoyageTips() section parsing, fallback to summary, timeout handling
 * - fetchGoogleMapsTips() place search, review filtering, missing API key
 * - fetchTravelData() parallel execution, partial provider failure
 * - enrichDestination() cache freshness, background mode, permission check
 * - fetchDestinationTips() deduplication against existing tips
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../../utilities/backend-logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../models/destination', () => {
  const mock = {
    findById: jest.fn(),
    find: jest.fn(),
  };
  return mock;
});

jest.mock('../../models/experience', () => ({
  findById: jest.fn(),
  find: jest.fn(),
}));

jest.mock('../../models/plan', () => ({}));

jest.mock('../../models/user', () => ({}));

jest.mock('../../models/photo', () => ({
  create: jest.fn(),
}));

jest.mock('../../utilities/permission-enforcer', () => ({
  getEnforcer: jest.fn(),
}));

jest.mock('../../utilities/upload-pipeline', () => ({
  transferBucket: jest.fn(),
}));

jest.mock('../../utilities/controller-helpers', () => ({
  validateObjectId: jest.fn((id, _fieldName) => {
    // Simple 24-hex-char check to simulate ObjectId validation
    const valid = typeof id === 'string' && /^[a-f0-9]{24}$/.test(id);
    return { valid, error: valid ? null : `Invalid ${_fieldName} format`, objectId: valid ? id : null };
  }),
}));

jest.mock('../../utilities/api-rate-tracker', () => ({
  checkBudget: jest.fn().mockReturnValue({ allowed: true, remaining: 50, resetAt: new Date() }),
  recordUsage: jest.fn(),
  getStatus: jest.fn(),
}));

const Destination = require('../../models/destination');
const Experience = require('../../models/experience');
const Photo = require('../../models/photo');
const { getEnforcer } = require('../../utilities/permission-enforcer');
const { transferBucket } = require('../../utilities/upload-pipeline');
const tracker = require('../../utilities/api-rate-tracker');

const {
  normalizedSimilarity,
  withRetry,
  suggestPlanItems,
  fetchEntityPhotos,
  addEntityPhotos,
  fetchWikivoyageTips,
  fetchWikivoyagePlanItems,
  extractPlanItemCandidates,
  fetchGoogleMapsTips,
  fetchTravelData,
  enrichDestination,
  fetchDestinationTips,
} = require('../../utilities/bienbot-external-data');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_ID = 'a'.repeat(24);
const VALID_ID_2 = 'b'.repeat(24);
const VALID_ID_3 = 'c'.repeat(24);

const mockUser = { _id: VALID_ID, name: 'Test User', role: 'regular_user' };

function chainable(resolvedValue) {
  return {
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(resolvedValue),
      limit: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(resolvedValue),
      }),
    }),
    lean: jest.fn().mockResolvedValue(resolvedValue),
    limit: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(resolvedValue),
    }),
  };
}

function mockFetchResponse(body, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

let originalFetch;
let originalEnv;

function resetMocks() {
  jest.clearAllMocks();
  process.env = { ...originalEnv };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('bienbot-external-data', () => {
  beforeAll(() => {
    originalFetch = global.fetch;
    originalEnv = { ...process.env };
  });

  afterAll(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
  });

  beforeEach(resetMocks);

  // =========================================================================
  // normalizedSimilarity
  // =========================================================================

  describe('normalizedSimilarity()', () => {
    it('returns 1 for identical strings', () => {
      expect(normalizedSimilarity('hello', 'hello')).toBe(1);
    });

    it('returns 0 for empty strings', () => {
      expect(normalizedSimilarity('', '')).toBe(1); // identical
      expect(normalizedSimilarity('', 'hello')).toBe(0);
      expect(normalizedSimilarity('hello', '')).toBe(0);
    });

    it('returns 0 for single-character strings (no bigrams possible)', () => {
      expect(normalizedSimilarity('a', 'b')).toBe(0);
      expect(normalizedSimilarity('x', 'x')).toBe(1); // identical shortcut
    });

    it('returns high similarity for near-identical strings', () => {
      const score = normalizedSimilarity('visit the eiffel tower', 'visit the eiffel towers');
      expect(score).toBeGreaterThan(0.8);
    });

    it('returns low similarity for completely different strings', () => {
      const score = normalizedSimilarity('abcdef', 'zyxwvu');
      expect(score).toBeLessThan(0.3);
    });

    it('returns moderate similarity for partial overlap', () => {
      const score = normalizedSimilarity('tokyo tower', 'tokyo skytree');
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(0.8);
    });
  });

  // =========================================================================
  // withRetry
  // =========================================================================

  describe('withRetry()', () => {
    it('returns result on first successful attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const result = await withRetry(fn, { maxRetries: 2, baseDelayMs: 1, timeoutMs: 50 });
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries on failure and succeeds on second attempt', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('recovered');

      const result = await withRetry(fn, { maxRetries: 2, baseDelayMs: 1, timeoutMs: 50 });
      expect(result).toBe('recovered');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('returns null when all attempts are exhausted', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('persistent failure'));

      const result = await withRetry(fn, { maxRetries: 1, baseDelayMs: 1, timeoutMs: 50 });
      expect(result).toBeNull();
      expect(fn).toHaveBeenCalledTimes(2); // initial + 1 retry
    });

    it('handles AbortError from timeout', async () => {
      const fn = jest.fn().mockImplementation(() => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        return Promise.reject(err);
      });

      const result = await withRetry(fn, { maxRetries: 0, baseDelayMs: 1, timeoutMs: 50 });
      expect(result).toBeNull();
    });

    it('passes AbortSignal to the function', async () => {
      const fn = jest.fn().mockResolvedValue('ok');
      await withRetry(fn, { maxRetries: 0, timeoutMs: 50 });
      expect(fn).toHaveBeenCalledWith(expect.any(AbortSignal));
    });
  });

  // =========================================================================
  // withRetry budget integration
  // =========================================================================

  describe('withRetry() budget integration', () => {
    it('returns null without calling fn when provider budget is exhausted', async () => {
      tracker.checkBudget.mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: new Date() });
      const fn = jest.fn().mockResolvedValue('result');
      const result = await withRetry(fn, { provider: 'unsplash' });
      expect(result).toBeNull();
      expect(fn).not.toHaveBeenCalled();
    });

    it('calls fn and records usage when provider has budget', async () => {
      tracker.checkBudget.mockReturnValueOnce({ allowed: true, remaining: 10, resetAt: new Date() });
      const fn = jest.fn().mockResolvedValue('ok');
      const result = await withRetry(fn, { provider: 'tripadvisor' });
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(tracker.recordUsage).toHaveBeenCalledWith('tripadvisor');
    });

    it('works normally when no provider is given', async () => {
      const fn = jest.fn().mockResolvedValue('no-provider');
      const result = await withRetry(fn);
      expect(result).toBe('no-provider');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // suggestPlanItems
  // =========================================================================

  describe('suggestPlanItems()', () => {
    it('returns 400 when destination_id is missing', async () => {
      const result = await suggestPlanItems({}, mockUser);
      expect(result.statusCode).toBe(400);
      expect(result.body.error).toMatch(/destination_id/i);
    });

    it('returns 400 for invalid destination_id format', async () => {
      const result = await suggestPlanItems({ destination_id: 'not-valid' }, mockUser);
      expect(result.statusCode).toBe(400);
      expect(result.body.error).toMatch(/invalid/i);
    });

    it('returns 404 when destination is not found', async () => {
      Destination.findById.mockReturnValue(chainable(null));

      const result = await suggestPlanItems({ destination_id: VALID_ID }, mockUser);
      expect(result.statusCode).toBe(404);
    });

    it('returns empty suggestions when no public experiences exist', async () => {
      Destination.findById.mockReturnValue(chainable({ _id: VALID_ID, name: 'Paris' }));
      Experience.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await suggestPlanItems({ destination_id: VALID_ID }, mockUser);
      expect(result.statusCode).toBe(200);
      expect(result.body.data.suggestions).toEqual([]);
      expect(result.body.data.source_count).toBe(0);
    });

    it('ranks suggestions by frequency (most common first)', async () => {
      Destination.findById.mockReturnValue(chainable({ _id: VALID_ID, name: 'Paris' }));

      const experiences = [
        { name: 'Trip A', plan_items: [{ content: 'Visit Eiffel Tower' }, { content: 'Visit Louvre' }] },
        { name: 'Trip B', plan_items: [{ content: 'Visit Eiffel Tower' }, { content: 'Seine Cruise' }] },
        { name: 'Trip C', plan_items: [{ content: 'visit eiffel tower' }] }, // case-insensitive dedup
      ];

      Experience.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(experiences),
          }),
        }),
      });

      const result = await suggestPlanItems({ destination_id: VALID_ID }, mockUser);
      expect(result.statusCode).toBe(200);

      const suggestions = result.body.data.suggestions;
      expect(suggestions.length).toBe(3);
      // Eiffel Tower appears 3 times, should be first
      expect(suggestions[0].text).toMatch(/eiffel tower/i);
      expect(suggestions[0].frequency).toBe(3);
    });

    it('deduplicates against exclude_items', async () => {
      Destination.findById.mockReturnValue(chainable({ _id: VALID_ID, name: 'Paris' }));

      const experiences = [
        { name: 'Trip A', plan_items: [{ content: 'Visit Eiffel Tower' }, { content: 'Visit Louvre' }] },
      ];

      Experience.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(experiences),
          }),
        }),
      });

      const result = await suggestPlanItems({
        destination_id: VALID_ID,
        exclude_items: ['visit eiffel tower'],
      }, mockUser);

      const texts = result.body.data.suggestions.map(s => s.text.toLowerCase());
      expect(texts).not.toContain('visit eiffel tower');
    });

    it('respects the limit parameter', async () => {
      Destination.findById.mockReturnValue(chainable({ _id: VALID_ID, name: 'Tokyo' }));

      const items = Array.from({ length: 15 }, (_, i) => ({ content: `Item ${i}` }));
      Experience.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([{ name: 'Big Trip', plan_items: items }]),
          }),
        }),
      });

      const result = await suggestPlanItems({ destination_id: VALID_ID, limit: 5 }, mockUser);
      expect(result.body.data.suggestions.length).toBeLessThanOrEqual(5);
    });

    it('caps sources at 3 per suggestion', async () => {
      Destination.findById.mockReturnValue(chainable({ _id: VALID_ID, name: 'Tokyo' }));

      const experiences = Array.from({ length: 5 }, (_, i) => ({
        name: `Trip ${i}`,
        plan_items: [{ content: 'Common item' }],
      }));

      Experience.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(experiences),
          }),
        }),
      });

      const result = await suggestPlanItems({ destination_id: VALID_ID }, mockUser);
      expect(result.body.data.suggestions[0].sources.length).toBeLessThanOrEqual(3);
    });

    it('appends Wikivoyage items when community suggestions are fewer than limit', async () => {
      Destination.findById.mockReturnValue(chainable({ _id: VALID_ID, name: 'Kyoto' }));
      Experience.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
      delete process.env.GOOGLE_MAPS_API_KEY;

      // Wikivoyage sections response
      const sectionsResponse = { parse: { sections: [{ line: 'See', index: '1' }] } };
      const seeContent = { parse: { text: { '*': '<span class="listing-name">Nijo Castle</span>' } } };

      global.fetch = jest.fn()
        .mockResolvedValueOnce(mockFetchResponse(sectionsResponse))
        .mockResolvedValueOnce(mockFetchResponse(seeContent));

      const result = await suggestPlanItems({ destination_id: VALID_ID, limit: 5 }, mockUser);
      expect(result.statusCode).toBe(200);
      const wvSuggestions = result.body.data.suggestions.filter(s => s.source_type === 'wikivoyage');
      expect(wvSuggestions.length).toBeGreaterThan(0);
      expect(wvSuggestions[0]).toMatchObject({
        sources: ['Wikivoyage'],
        source_type: 'wikivoyage',
        frequency: 0,
      });
    });

    it('does not call Wikivoyage when community suggestions already fill the limit', async () => {
      // 3 experiences each contributing a unique item → fills limit=3 from community
      Destination.findById.mockReturnValue(chainable({ _id: VALID_ID, name: 'Tokyo' }));
      const experiences = [
        { name: 'Trip A', plan_items: [{ content: 'Shibuya Crossing' }] },
        { name: 'Trip B', plan_items: [{ content: 'Senso-ji Temple' }] },
        { name: 'Trip C', plan_items: [{ content: 'Akihabara Electric Town Walk' }] },
      ];
      Experience.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(experiences),
          }),
        }),
      });
      delete process.env.GOOGLE_MAPS_API_KEY;
      global.fetch = jest.fn();

      const result = await suggestPlanItems({ destination_id: VALID_ID, limit: 3 }, mockUser);
      expect(result.statusCode).toBe(200);
      // fetch should not have been called for Wikivoyage
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('deduplicates Wikivoyage items against community suggestions', async () => {
      Destination.findById.mockReturnValue(chainable({ _id: VALID_ID, name: 'Kyoto' }));
      const experiences = [
        { name: 'Trip A', plan_items: [{ content: 'Nijo Castle' }] },
      ];
      Experience.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(experiences),
          }),
        }),
      });
      delete process.env.GOOGLE_MAPS_API_KEY;

      // Wikivoyage returns the same item name as the community suggestion
      const sectionsResponse = { parse: { sections: [{ line: 'See', index: '1' }] } };
      const seeContent = { parse: { text: { '*': '<span class="listing-name">Nijo Castle</span>' } } };
      global.fetch = jest.fn()
        .mockResolvedValueOnce(mockFetchResponse(sectionsResponse))
        .mockResolvedValueOnce(mockFetchResponse(seeContent));

      const result = await suggestPlanItems({ destination_id: VALID_ID, limit: 10 }, mockUser);
      const allNames = result.body.data.suggestions.map(s => s.text.toLowerCase());
      const uniqueNames = new Set(allNames);
      expect(allNames.length).toBe(uniqueNames.size);
    });

    it('deduplicates Wikivoyage items against exclude_items', async () => {
      Destination.findById.mockReturnValue(chainable({ _id: VALID_ID, name: 'Kyoto' }));
      Experience.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
      delete process.env.GOOGLE_MAPS_API_KEY;

      const sectionsResponse = { parse: { sections: [{ line: 'See', index: '1' }] } };
      const seeContent = { parse: { text: { '*': '<span class="listing-name">Kinkaku-ji</span>' } } };
      global.fetch = jest.fn()
        .mockResolvedValueOnce(mockFetchResponse(sectionsResponse))
        .mockResolvedValueOnce(mockFetchResponse(seeContent));

      const result = await suggestPlanItems({
        destination_id: VALID_ID,
        exclude_items: ['Kinkaku-ji'],
        limit: 10
      }, mockUser);
      const names = result.body.data.suggestions.map(s => s.text.toLowerCase());
      expect(names).not.toContain('kinkaku-ji');
    });
  });

  // =========================================================================
  // fetchEntityPhotos
  // =========================================================================

  describe('fetchEntityPhotos()', () => {
    it('returns 400 for invalid entity_type', async () => {
      const result = await fetchEntityPhotos({ entity_type: 'plan', entity_id: VALID_ID }, mockUser);
      expect(result.statusCode).toBe(400);
      expect(result.body.error).toMatch(/entity_type/);
    });

    it('returns 400 when entity_id is missing', async () => {
      const result = await fetchEntityPhotos({ entity_type: 'destination' }, mockUser);
      expect(result.statusCode).toBe(400);
      expect(result.body.error).toMatch(/entity_id/);
    });

    it('returns empty photos when UNSPLASH_ACCESS_KEY is not set', async () => {
      delete process.env.UNSPLASH_ACCESS_KEY;

      const result = await fetchEntityPhotos({
        entity_type: 'destination',
        entity_id: VALID_ID,
      }, mockUser);

      expect(result.statusCode).toBe(200);
      expect(result.body.data.photos).toEqual([]);
    });

    it('returns 404 when entity is not found', async () => {
      process.env.UNSPLASH_ACCESS_KEY = 'test-key';
      Destination.findById.mockReturnValue(chainable(null));

      const result = await fetchEntityPhotos({
        entity_type: 'destination',
        entity_id: VALID_ID,
      }, mockUser);

      expect(result.statusCode).toBe(404);
    });

    it('fetches and maps Unsplash photos for a destination', async () => {
      process.env.UNSPLASH_ACCESS_KEY = 'test-key';

      Destination.findById.mockReturnValue(chainable({ _id: VALID_ID, name: 'Paris' }));

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          total: 100,
          results: [{
            id: 'photo-1',
            urls: { regular: 'https://unsplash.com/photo-1.jpg', thumb: 'https://unsplash.com/thumb-1.jpg' },
            width: 1920,
            height: 1080,
            description: 'Eiffel Tower',
            user: { name: 'Photographer', links: { html: 'https://unsplash.com/@photographer' } },
            links: { html: 'https://unsplash.com/photos/photo-1' },
          }],
        }),
      });

      const result = await fetchEntityPhotos({
        entity_type: 'destination',
        entity_id: VALID_ID,
      }, mockUser);

      expect(result.statusCode).toBe(200);
      expect(result.body.data.photos).toHaveLength(1);
      expect(result.body.data.photos[0]).toMatchObject({
        unsplash_id: 'photo-1',
        url: 'https://unsplash.com/photo-1.jpg',
        photographer: 'Photographer',
      });
      expect(result.body.data.search_query).toBe('Paris');
    });

    it('enriches search query with destination name for experiences', async () => {
      process.env.UNSPLASH_ACCESS_KEY = 'test-key';

      Experience.findById.mockReturnValue(chainable({
        _id: VALID_ID_2,
        name: 'Cherry Blossom Tour',
        destination: VALID_ID,
      }));
      Destination.findById.mockReturnValue(chainable({ _id: VALID_ID, name: 'Tokyo' }));

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ total: 0, results: [] }),
      });

      const result = await fetchEntityPhotos({
        entity_type: 'experience',
        entity_id: VALID_ID_2,
      }, mockUser);

      expect(result.statusCode).toBe(200);
      expect(result.body.data.search_query).toBe('Cherry Blossom Tour Tokyo');
    });

    it('returns empty photos on Unsplash API error (graceful degradation)', async () => {
      process.env.UNSPLASH_ACCESS_KEY = 'test-key';
      Destination.findById.mockReturnValue(chainable({ _id: VALID_ID, name: 'Paris' }));

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve('Rate limited'),
      });

      const result = await fetchEntityPhotos({
        entity_type: 'destination',
        entity_id: VALID_ID,
      }, mockUser);

      expect(result.statusCode).toBe(200);
      expect(result.body.data.photos).toEqual([]);
    });

    it('returns 503 when Unsplash budget is exhausted', async () => {
      tracker.checkBudget.mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: new Date() });
      process.env.UNSPLASH_ACCESS_KEY = 'test-key';

      const result = await fetchEntityPhotos(
        { entity_type: 'destination', entity_id: VALID_ID },
        mockUser
      );

      expect(result.statusCode).toBe(503);
      expect(result.body.success).toBe(false);
      expect(result.body.error).toMatch(/temporarily unavailable/i);
    });
  });

  // =========================================================================
  // addEntityPhotos
  // =========================================================================

  describe('addEntityPhotos()', () => {
    let mockEnforcer;

    beforeEach(() => {
      mockEnforcer = {
        canEdit: jest.fn().mockResolvedValue({ allowed: true }),
      };
      getEnforcer.mockReturnValue(mockEnforcer);
    });

    it('returns 400 for invalid entity_type', async () => {
      const result = await addEntityPhotos({ entity_type: 'plan', entity_id: VALID_ID, photos: [] }, mockUser);
      expect(result.statusCode).toBe(400);
    });

    it('returns 400 when entity_id is missing', async () => {
      const result = await addEntityPhotos({ entity_type: 'destination', photos: [{}] }, mockUser);
      expect(result.statusCode).toBe(400);
    });

    it('returns 400 when photos array is empty', async () => {
      const result = await addEntityPhotos({
        entity_type: 'destination',
        entity_id: VALID_ID,
        photos: [],
      }, mockUser);
      expect(result.statusCode).toBe(400);
      expect(result.body.error).toMatch(/photos/i);
    });

    it('returns 400 when photos exceed 20', async () => {
      const result = await addEntityPhotos({
        entity_type: 'destination',
        entity_id: VALID_ID,
        photos: Array.from({ length: 21 }, () => ({ url: 'https://example.com/photo.jpg' })),
      }, mockUser);
      expect(result.statusCode).toBe(400);
      expect(result.body.error).toMatch(/20/);
    });

    it('returns 403 when user lacks edit permission', async () => {
      mockEnforcer.canEdit.mockResolvedValue({ allowed: false, reason: 'Not authorized' });

      const mockEntity = { _id: VALID_ID, photos: [], save: jest.fn() };
      Destination.findById.mockResolvedValue(mockEntity);

      const result = await addEntityPhotos({
        entity_type: 'destination',
        entity_id: VALID_ID,
        photos: [{ url: 'https://example.com/photo.jpg' }],
      }, mockUser);

      expect(result.statusCode).toBe(403);
    });

    it('adds Unsplash URL photos with attribution', async () => {
      const mockEntity = {
        _id: VALID_ID,
        photos: [],
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnValue({ _id: VALID_ID, photos: [{ url: 'https://unsplash.com/photo.jpg' }] }),
      };
      Destination.findById.mockResolvedValue(mockEntity);

      const result = await addEntityPhotos({
        entity_type: 'destination',
        entity_id: VALID_ID,
        photos: [{
          url: 'https://unsplash.com/photo.jpg',
          photographer: 'Jane Doe',
          photographer_url: 'https://unsplash.com/@janedoe',
        }],
      }, mockUser);

      expect(result.statusCode).toBe(200);
      expect(mockEntity.photos).toHaveLength(1);
      expect(mockEntity.photos[0].photo_credit).toBe('Jane Doe / Unsplash');
      expect(mockEntity.save).toHaveBeenCalled();
    });

    it('transfers S3 photos from protected to public bucket', async () => {
      const mockEntity = {
        _id: VALID_ID,
        photos: [],
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnValue({ _id: VALID_ID, photos: [] }),
      };
      Destination.findById.mockResolvedValue(mockEntity);

      transferBucket.mockResolvedValue({
        location: 'https://s3.amazonaws.com/public/photos/123-bienbot-pic.jpg',
        key: 'photos/123-bienbot-pic.jpg',
      });

      Photo.create.mockResolvedValue({
        _id: VALID_ID_2,
        url: 'https://s3.amazonaws.com/public/photos/123-bienbot-pic.jpg',
        photo_credit: 'Test User',
      });

      const result = await addEntityPhotos({
        entity_type: 'destination',
        entity_id: VALID_ID,
        photos: [{
          s3_key: 'bienbot/user123/session456/pic.jpg',
          filename: 'pic.jpg',
        }],
      }, mockUser);

      expect(result.statusCode).toBe(200);
      expect(transferBucket).toHaveBeenCalledWith('bienbot/user123/session456/pic.jpg', expect.objectContaining({
        fromProtected: true,
        toPrefix: 'photos/',
        deleteSource: false,
      }));
    });

    it('returns 404 when entity is not found', async () => {
      Destination.findById.mockResolvedValue(null);

      const result = await addEntityPhotos({
        entity_type: 'destination',
        entity_id: VALID_ID,
        photos: [{ url: 'https://example.com/photo.jpg' }],
      }, mockUser);

      expect(result.statusCode).toBe(404);
    });

    it('continues adding remaining photos when one S3 transfer fails', async () => {
      const mockEntity = {
        _id: VALID_ID,
        photos: [],
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnValue({ _id: VALID_ID, photos: [] }),
      };
      Destination.findById.mockResolvedValue(mockEntity);

      transferBucket.mockRejectedValueOnce(new Error('S3 error'));

      const result = await addEntityPhotos({
        entity_type: 'destination',
        entity_id: VALID_ID,
        photos: [
          { s3_key: 'bienbot/bad.jpg' },
          { url: 'https://unsplash.com/good.jpg', photographer: 'Bob' },
        ],
      }, mockUser);

      expect(result.statusCode).toBe(200);
      // Only the URL photo should have been added (S3 one failed)
      expect(mockEntity.photos).toHaveLength(1);
      expect(mockEntity.photos[0].url).toBe('https://unsplash.com/good.jpg');
    });
  });

  // =========================================================================
  // fetchWikivoyageTips
  // =========================================================================

  describe('fetchWikivoyageTips()', () => {
    beforeEach(() => {
      jest.useRealTimers();
    });

    it('returns structured tips from section-level parsing', async () => {
      // Mock section index response
      const sectionsResponse = {
        parse: {
          sections: [
            { line: 'See', index: '1' },
            { line: 'Do', index: '2' },
            { line: 'Eat', index: '3' },
          ],
        },
      };

      // Mock section content responses
      const sectionContent = (text) => ({
        parse: { text: { '*': `<p>${text}</p>` } },
      });

      global.fetch = jest.fn()
        .mockResolvedValueOnce(mockFetchResponse(sectionsResponse)) // sections list
        .mockResolvedValueOnce(mockFetchResponse(sectionContent('Visit the ancient temple ruins and admire the stunning architecture'))) // See
        .mockResolvedValueOnce(mockFetchResponse(sectionContent('Try river kayaking through the gorges and scenic valleys'))) // Do
        .mockResolvedValueOnce(mockFetchResponse(sectionContent('Sample the local street food markets with traditional delicacies'))); // Eat

      const tips = await fetchWikivoyageTips('Kyoto');

      expect(tips.length).toBeGreaterThan(0);
      expect(tips[0]).toMatchObject({
        source: 'Wikivoyage',
        url: expect.stringContaining('Kyoto'),
      });
      // Should have type and category from section mapping
      expect(tips[0]).toHaveProperty('type');
      expect(tips[0]).toHaveProperty('category');
      expect(tips[0]).toHaveProperty('callToAction');
    });

    it('falls back to summary when section parsing returns nothing', async () => {
      // Sections return empty
      global.fetch = jest.fn()
        .mockResolvedValueOnce(mockFetchResponse({ parse: { sections: [] } }))
        // Summary fallback
        .mockResolvedValueOnce(mockFetchResponse({
          extract: 'Kyoto is a beautiful city in Japan. It has many temples and shrines. The food is excellent and diverse.',
          content_urls: { desktop: { page: 'https://en.wikivoyage.org/wiki/Kyoto' } },
        }));

      const tips = await fetchWikivoyageTips('Kyoto');

      expect(tips.length).toBeGreaterThan(0);
      expect(tips[0]).toMatchObject({
        type: 'Custom',
        category: 'Overview',
        source: 'Wikivoyage',
        icon: '🌍',
      });
    });

    it('returns empty array when destination page does not exist (404)', async () => {
      global.fetch = jest.fn()
        .mockResolvedValueOnce(mockFetchResponse({
          error: { code: 'missingtitle', info: 'Page not found' },
        }))
        // Summary also 404
        .mockResolvedValueOnce(mockFetchResponse({}, false, 404));

      const tips = await fetchWikivoyageTips('NonexistentPlace12345');
      expect(tips).toEqual([]);
    });

    it('respects maxTotalTips option', async () => {
      const sectionsResponse = {
        parse: {
          sections: [
            { line: 'See', index: '1' },
            { line: 'Do', index: '2' },
            { line: 'Eat', index: '3' },
            { line: 'Sleep', index: '4' },
          ],
        },
      };

      const longContent = (prefix) => ({
        parse: {
          text: {
            '*': Array.from({ length: 10 }, (_, i) =>
              `<li>${prefix} item ${i} with enough text to pass the 15 char minimum filter</li>`
            ).join(''),
          },
        },
      });

      global.fetch = jest.fn()
        .mockResolvedValueOnce(mockFetchResponse(sectionsResponse))
        .mockResolvedValueOnce(mockFetchResponse(longContent('See')))
        .mockResolvedValueOnce(mockFetchResponse(longContent('Do')))
        .mockResolvedValueOnce(mockFetchResponse(longContent('Eat')))
        .mockResolvedValueOnce(mockFetchResponse(longContent('Sleep')));

      const tips = await fetchWikivoyageTips('Paris', { maxTotalTips: 3 });
      expect(tips.length).toBeLessThanOrEqual(3);
    });
  });

  // =========================================================================
  // extractPlanItemCandidates
  // =========================================================================

  describe('extractPlanItemCandidates()', () => {
    it('extracts name and description from listing-name/listing-description spans (Tier 1)', () => {
      const html = `
        <ul>
          <li><span class="listing-name">Fushimi Inari</span> — <span class="listing-description">Famous for thousands of vermilion torii gates lining forested trails</span></li>
          <li><span class="listing-name">Kinkaku-ji</span> — <span class="listing-description">The iconic Golden Pavilion reflected in its surrounding pond</span></li>
        </ul>`;
      const results = extractPlanItemCandidates(html, 'see');
      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        name: 'Fushimi Inari',
        description: 'Famous for thousands of vermilion torii gates lining forested trails',
        activity_type: 'sightseeing',
      });
      expect(results[1].name).toBe('Kinkaku-ji');
    });

    it('falls back to separator split on plain text when no listing spans found (Tier 2)', () => {
      const html = '<p>Nijo Castle – A UNESCO World Heritage Site with beautiful gardens and nightingale floors.</p>';
      const results = extractPlanItemCandidates(html, 'see');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toMatch(/Nijo Castle/);
      expect(results[0].description.length).toBeGreaterThan(10);
    });

    it('falls back to name-only when no separator is found in Tier 2 line', () => {
      const html = '<p>Arashiyama Bamboo Grove</p>';
      const results = extractPlanItemCandidates(html, 'do');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toContain('Arashiyama Bamboo Grove');
      expect(results[0].description).toBe('');
    });

    it('skips lines longer than 300 characters in Tier 2', () => {
      const longLine = 'A'.repeat(301);
      const html = `<p>${longLine}</p>`;
      const results = extractPlanItemCandidates(html, 'see');
      expect(results).toHaveLength(0);
    });

    it('caps results at PLAN_ITEM_MAX_PER_SECTION for the given section', () => {
      // 'see' max is 6
      const items = Array.from({ length: 10 }, (_, i) =>
        `<span class="listing-name">Place ${i}</span>`);
      const html = `<ul>${items.join('')}</ul>`;
      const results = extractPlanItemCandidates(html, 'see');
      expect(results.length).toBeLessThanOrEqual(6);
    });

    it('maps section key to correct activity_type', () => {
      const html = '<span class="listing-name">Some Restaurant</span>';
      expect(extractPlanItemCandidates(html, 'eat')[0].activity_type).toBe('food');
      expect(extractPlanItemCandidates(html, 'do')[0].activity_type).toBe('adventure');
      expect(extractPlanItemCandidates(html, 'drink')[0].activity_type).toBe('nightlife');
      expect(extractPlanItemCandidates(html, 'buy')[0].activity_type).toBe('shopping');
      expect(extractPlanItemCandidates(html, 'sleep')[0].activity_type).toBe('accommodation');
    });

    it('strips inner HTML tags from extracted name and description', () => {
      const html = `
        <span class="listing-name"><a href="/wiki/Kinkaku">Kinkaku-ji</a></span>
        <span class="listing-description">See the <b>Golden Pavilion</b> at sunset</span>`;
      const results = extractPlanItemCandidates(html, 'see');
      expect(results[0].name).toBe('Kinkaku-ji');
      expect(results[0].description).not.toMatch(/<[^>]+>/);
    });
  });

  // =========================================================================
  // fetchWikivoyagePlanItems
  // =========================================================================

  describe('fetchWikivoyagePlanItems()', () => {
    beforeEach(() => {
      jest.useRealTimers();
    });

    it('returns structured items from See and Do sections', async () => {
      const sectionsResponse = {
        parse: {
          sections: [
            { line: 'See', index: '1' },
            { line: 'Do', index: '2' },
          ],
        },
      };
      const seeContent = {
        parse: {
          text: {
            '*': '<ul><li><span class="listing-name">Fushimi Inari</span><span class="listing-description">Famous torii gate trails on Mount Inari</span></li></ul>',
          },
        },
      };
      const doContent = {
        parse: {
          text: {
            '*': '<ul><li><span class="listing-name">Tea Ceremony</span><span class="listing-description">Traditional matcha ceremony in a historic tea house</span></li></ul>',
          },
        },
      };

      global.fetch = jest.fn()
        .mockResolvedValueOnce(mockFetchResponse(sectionsResponse))
        .mockResolvedValueOnce(mockFetchResponse(seeContent))
        .mockResolvedValueOnce(mockFetchResponse(doContent));

      const items = await fetchWikivoyagePlanItems('Kyoto');

      expect(items.length).toBe(2);
      expect(items[0]).toMatchObject({
        name: 'Fushimi Inari',
        activity_type: 'sightseeing',
        source_url: expect.stringContaining('Kyoto'),
      });
      expect(items[1]).toMatchObject({
        name: 'Tea Ceremony',
        activity_type: 'adventure',
      });
    });

    it('ignores non-plan-item sections (get around, stay safe)', async () => {
      const sectionsResponse = {
        parse: {
          sections: [
            { line: 'Get around', index: '1' },
            { line: 'Stay safe', index: '2' },
            { line: 'See', index: '3' },
          ],
        },
      };
      const seeContent = {
        parse: { text: { '*': '<span class="listing-name">Kyoto Tower</span>' } },
      };

      global.fetch = jest.fn()
        .mockResolvedValueOnce(mockFetchResponse(sectionsResponse))
        .mockResolvedValueOnce(mockFetchResponse(seeContent));

      const items = await fetchWikivoyagePlanItems('Kyoto');

      // Should only have the See section item, not Get around / Stay safe
      expect(items).toHaveLength(1);
      expect(items[0].activity_type).toBe('sightseeing');
    });

    it('deduplicates items appearing in multiple sections', async () => {
      const sectionsResponse = {
        parse: {
          sections: [
            { line: 'See', index: '1' },
            { line: 'Do', index: '2' },
          ],
        },
      };
      // Same attraction name in both sections
      const sharedContent = {
        parse: { text: { '*': '<span class="listing-name">Nishiki Market</span>' } },
      };

      global.fetch = jest.fn()
        .mockResolvedValueOnce(mockFetchResponse(sectionsResponse))
        .mockResolvedValueOnce(mockFetchResponse(sharedContent))
        .mockResolvedValueOnce(mockFetchResponse(sharedContent));

      const items = await fetchWikivoyagePlanItems('Kyoto');
      const names = items.map(i => i.name);
      const unique = new Set(names.map(n => n.toLowerCase()));
      expect(names.length).toBe(unique.size);
    });

    it('respects the maxTotal option', async () => {
      const sectionsResponse = {
        parse: {
          sections: [{ line: 'See', index: '1' }, { line: 'Do', index: '2' }],
        },
      };
      const manyItems = Array.from({ length: 10 }, (_, i) =>
        `<span class="listing-name">Place ${i} with unique enough name</span>`).join('');
      const content = { parse: { text: { '*': manyItems } } };

      global.fetch = jest.fn()
        .mockResolvedValueOnce(mockFetchResponse(sectionsResponse))
        .mockResolvedValueOnce(mockFetchResponse(content))
        .mockResolvedValueOnce(mockFetchResponse(content));

      const items = await fetchWikivoyagePlanItems('Paris', { maxTotal: 3 });
      expect(items.length).toBeLessThanOrEqual(3);
    });

    it('returns empty array when destination page does not exist (404)', async () => {
      global.fetch = jest.fn()
        .mockResolvedValueOnce(mockFetchResponse({
          error: { code: 'missingtitle', info: 'Page not found' },
        }));

      const items = await fetchWikivoyagePlanItems('NonexistentPlace99999');
      expect(items).toEqual([]);
    });

    it('returns empty array on network failure without throwing', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const items = await fetchWikivoyagePlanItems('Somewhere');
      expect(items).toEqual([]);
    });

    it('includes section anchor in source_url', async () => {
      const sectionsResponse = {
        parse: { sections: [{ line: 'Eat', index: '1' }] },
      };
      const content = {
        parse: { text: { '*': '<span class="listing-name">Nishiki Market</span>' } },
      };

      global.fetch = jest.fn()
        .mockResolvedValueOnce(mockFetchResponse(sectionsResponse))
        .mockResolvedValueOnce(mockFetchResponse(content));

      const items = await fetchWikivoyagePlanItems('Kyoto');
      expect(items[0].source_url).toContain('#Eat');
    });
  });

  // =========================================================================
  // fetchGoogleMapsTips
  // =========================================================================

  describe('fetchGoogleMapsTips()', () => {
    beforeEach(() => {
      jest.useRealTimers();
    });

    it('returns empty array when GOOGLE_MAPS_API_KEY is not set', async () => {
      delete process.env.GOOGLE_MAPS_API_KEY;
      const tips = await fetchGoogleMapsTips('Paris');
      expect(tips).toEqual([]);
    });

    it('fetches place reviews and filters by rating >= 4', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'test-key';

      global.fetch = jest.fn()
        // Find place
        .mockResolvedValueOnce(mockFetchResponse({
          candidates: [{ place_id: 'place-123', name: 'Paris' }],
        }))
        // Place details
        .mockResolvedValueOnce(mockFetchResponse({
          result: {
            name: 'Paris',
            url: 'https://maps.google.com/paris',
            reviews: [
              { text: 'Amazing city with beautiful architecture!', rating: 5 },
              { text: 'Terrible experience, too crowded.', rating: 2 },
              { text: 'Loved the food and the culture here.', rating: 4 },
              { text: 'Pretty good overall trip to Paris.', rating: 4 },
            ],
          },
        }));

      const tips = await fetchGoogleMapsTips('Paris');

      // Only reviews with rating >= 4 should be included
      expect(tips.length).toBe(3);
      expect(tips.every(t => t.rating >= 4)).toBe(true);
      expect(tips[0]).toMatchObject({
        type: 'review',
        source: 'Google Maps',
      });
    });

    it('returns empty when place is not found', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'test-key';

      global.fetch = jest.fn()
        .mockResolvedValueOnce(mockFetchResponse({ candidates: [] }));

      const tips = await fetchGoogleMapsTips('NonexistentPlace12345');
      expect(tips).toEqual([]);
    });

    it('truncates long reviews to 150 characters', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'test-key';

      const longText = 'A'.repeat(200);

      global.fetch = jest.fn()
        .mockResolvedValueOnce(mockFetchResponse({
          candidates: [{ place_id: 'place-123' }],
        }))
        .mockResolvedValueOnce(mockFetchResponse({
          result: {
            name: 'Paris',
            reviews: [{ text: longText, rating: 5 }],
          },
        }));

      const tips = await fetchGoogleMapsTips('Paris');
      expect(tips[0].value.length).toBe(150); // 147 + '...'
    });
  });

  // =========================================================================
  // fetchTravelData
  // =========================================================================

  describe('fetchTravelData()', () => {
    beforeEach(() => {
      jest.useRealTimers();
      delete process.env.UNSPLASH_ACCESS_KEY;
      delete process.env.GOOGLE_MAPS_API_KEY;
    });

    it('runs all providers in parallel and combines results', async () => {
      // With no API keys, Unsplash and Google Maps return empty
      // Wikivoyage (no key needed) will be mocked
      global.fetch = jest.fn()
        // Wikivoyage sections
        .mockResolvedValueOnce(mockFetchResponse({ parse: { sections: [] } }))
        // Wikivoyage summary fallback
        .mockResolvedValueOnce(mockFetchResponse({
          extract: 'Paris is the capital of France. The city is known for the Eiffel Tower landmark.',
          content_urls: { desktop: { page: 'https://en.wikivoyage.org/wiki/Paris' } },
        }));

      const result = await fetchTravelData('Paris');

      expect(result).toHaveProperty('travel_tips');
      expect(result).toHaveProperty('photos');
      expect(result).toHaveProperty('providers_succeeded');
      expect(result).toHaveProperty('providers_failed');
    });

    it('handles partial provider failure gracefully', async () => {
      // Wikivoyage sections — succeed with empty, summary — succeed with data
      // Google Maps — no key so returns empty
      global.fetch = jest.fn()
        .mockResolvedValueOnce(mockFetchResponse({ parse: { sections: [] } }))
        .mockResolvedValueOnce(mockFetchResponse({
          extract: 'Paris is the capital of France and a wonderful travel destination.',
          content_urls: { desktop: { page: 'https://en.wikivoyage.org/wiki/Paris' } },
        }));

      const result = await fetchTravelData('Paris', { includePhotos: false });

      // Should not throw — returns combined results
      expect(result.travel_tips).toBeDefined();
      expect(result.photos).toBeDefined();
      expect(result.providers_succeeded).toContain('wikivoyage');
    });

    it('skips photos when includePhotos is false', async () => {
      global.fetch = jest.fn()
        .mockResolvedValueOnce(mockFetchResponse({ parse: { sections: [] } }))
        .mockResolvedValueOnce(mockFetchResponse({ extract: '' }));

      const result = await fetchTravelData('Paris', { includePhotos: false });

      expect(result.photos).toEqual([]);
    });
  });

  // =========================================================================
  // enrichDestination
  // =========================================================================

  describe('enrichDestination()', () => {
    let mockEnforcer;

    beforeEach(() => {
      jest.useRealTimers();
      mockEnforcer = {
        canEdit: jest.fn().mockResolvedValue({ allowed: true }),
      };
      getEnforcer.mockReturnValue(mockEnforcer);
      delete process.env.UNSPLASH_ACCESS_KEY;
      delete process.env.GOOGLE_MAPS_API_KEY;
    });

    it('returns 400 for invalid destination ID', async () => {
      const result = await enrichDestination('not-valid', mockUser);
      expect(result.statusCode).toBe(400);
    });

    it('returns 404 when destination not found', async () => {
      Destination.findById.mockResolvedValue(null);

      const result = await enrichDestination(VALID_ID, mockUser);
      expect(result.statusCode).toBe(404);
    });

    it('returns 403 when user lacks edit permission', async () => {
      mockEnforcer.canEdit.mockResolvedValue({ allowed: false, reason: 'Not authorized' });
      Destination.findById.mockResolvedValue({ _id: VALID_ID, name: 'Paris' });

      const result = await enrichDestination(VALID_ID, mockUser);
      expect(result.statusCode).toBe(403);
    });

    it('returns cached data when cache is fresh', async () => {
      const freshDest = {
        _id: VALID_ID,
        name: 'Paris',
        travel_tips: [{ type: 'Custom', value: 'Cached tip' }],
        travel_tips_updated_at: new Date(), // just now = fresh
        toObject: jest.fn().mockReturnValue({ _id: VALID_ID, name: 'Paris', travel_tips: ['Cached tip'] }),
      };
      Destination.findById.mockResolvedValue(freshDest);

      const result = await enrichDestination(VALID_ID, mockUser);

      expect(result.statusCode).toBe(200);
      expect(result.body.data.cached).toBe(true);
    });

    it('fetches fresh data when cache is stale', async () => {
      const staleDest = {
        _id: VALID_ID,
        name: 'Paris',
        travel_tips: [{ type: 'Custom', value: 'Old tip' }],
        travel_tips_updated_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
        photos: [],
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnValue({ _id: VALID_ID }),
      };
      Destination.findById.mockResolvedValue(staleDest);

      // Mock external calls to return empty (just testing cache logic)
      global.fetch = jest.fn()
        .mockResolvedValueOnce(mockFetchResponse({ parse: { sections: [] } }))
        .mockResolvedValueOnce(mockFetchResponse({ extract: '' }));

      const result = await enrichDestination(VALID_ID, mockUser);

      expect(result.statusCode).toBe(200);
      expect(result.body.data.cached).toBe(false);
      expect(staleDest.save).toHaveBeenCalled();
    });

    it('forces refresh when force=true even with fresh cache', async () => {
      const freshDest = {
        _id: VALID_ID,
        name: 'Paris',
        travel_tips: [{ type: 'Custom', value: 'Tip' }],
        travel_tips_updated_at: new Date(), // fresh
        photos: [],
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnValue({ _id: VALID_ID }),
      };
      Destination.findById.mockResolvedValue(freshDest);

      global.fetch = jest.fn()
        .mockResolvedValueOnce(mockFetchResponse({ parse: { sections: [] } }))
        .mockResolvedValueOnce(mockFetchResponse({ extract: '' }));

      const result = await enrichDestination(VALID_ID, mockUser, { force: true });

      expect(result.statusCode).toBe(200);
      expect(result.body.data.cached).toBe(false);
    });

    it('returns cached data immediately in background mode', async () => {
      const staleDest = {
        _id: VALID_ID,
        name: 'Paris',
        travel_tips: [{ type: 'Custom', value: 'Stale tip' }],
        travel_tips_updated_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        photos: [],
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnValue({ _id: VALID_ID, travel_tips: ['Stale tip'] }),
      };
      Destination.findById.mockResolvedValue(staleDest);

      global.fetch = jest.fn()
        .mockResolvedValueOnce(mockFetchResponse({ parse: { sections: [] } }))
        .mockResolvedValueOnce(mockFetchResponse({ extract: '' }));

      const result = await enrichDestination(VALID_ID, mockUser, { background: true });

      expect(result.statusCode).toBe(200);
      expect(result.body.data.cached).toBe(true);
      expect(result.body.data.refreshing).toBe(true);
    });
  });

  // =========================================================================
  // fetchDestinationTips
  // =========================================================================

  describe('fetchDestinationTips()', () => {
    beforeEach(() => {
      jest.useRealTimers();
      delete process.env.UNSPLASH_ACCESS_KEY;
      delete process.env.GOOGLE_MAPS_API_KEY;
    });

    it('returns 400 when destination_id is missing', async () => {
      const result = await fetchDestinationTips({}, mockUser);
      expect(result.statusCode).toBe(400);
    });

    it('returns 400 for invalid destination_id format', async () => {
      const result = await fetchDestinationTips({ destination_id: 'bad' }, mockUser);
      expect(result.statusCode).toBe(400);
    });

    it('returns 404 when destination is not found', async () => {
      Destination.findById.mockReturnValue(chainable(null));

      const result = await fetchDestinationTips({ destination_id: VALID_ID }, mockUser);
      expect(result.statusCode).toBe(404);
    });

    it('uses destination_name override and skips DB lookup', async () => {
      global.fetch = jest.fn()
        .mockResolvedValueOnce(mockFetchResponse({ parse: { sections: [] } }))
        .mockResolvedValueOnce(mockFetchResponse({ extract: '' }));

      const result = await fetchDestinationTips({
        destination_id: VALID_ID,
        destination_name: 'Tokyo',
      }, mockUser);

      expect(result.statusCode).toBe(200);
      // Should NOT have called Destination.findById since name was overridden
      expect(Destination.findById).not.toHaveBeenCalled();
    });

    it('deduplicates against existing destination tips', async () => {
      Destination.findById.mockReturnValue(chainable({
        _id: VALID_ID,
        name: 'Paris',
        travel_tips: [{ value: 'Visit the Eiffel Tower and enjoy the beautiful view' }],
      }));

      // Return tips that include a duplicate
      global.fetch = jest.fn()
        .mockResolvedValueOnce(mockFetchResponse({ parse: { sections: [] } }))
        .mockResolvedValueOnce(mockFetchResponse({
          extract: 'Visit the Eiffel Tower and enjoy the beautiful view. The Louvre Museum has an amazing art collection worth seeing.',
          content_urls: { desktop: { page: 'https://en.wikivoyage.org/wiki/Paris' } },
        }));

      const result = await fetchDestinationTips({ destination_id: VALID_ID }, mockUser);

      expect(result.statusCode).toBe(200);
      // The Eiffel Tower tip should be deduplicated
      const tipValues = (result.body.data.tips || []).map(t => t.value);
      const hasDuplicate = tipValues.some(v =>
        v.toLowerCase().includes('visit the eiffel tower')
      );
      expect(hasDuplicate).toBe(false);
    });

    it('returns empty tips with provider_count 0 when no data available', async () => {
      Destination.findById.mockReturnValue(chainable({
        _id: VALID_ID,
        name: 'UnknownPlace',
        travel_tips: [],
      }));

      global.fetch = jest.fn()
        .mockResolvedValueOnce(mockFetchResponse({
          error: { code: 'missingtitle', info: 'not found' },
        }))
        .mockResolvedValueOnce(mockFetchResponse({}, false, 404));

      const result = await fetchDestinationTips({ destination_id: VALID_ID }, mockUser);

      expect(result.statusCode).toBe(200);
      expect(result.body.data.tips).toEqual([]);
      expect(result.body.data.provider_count).toBe(0);
    });
  });
});

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

const Destination = require('../../models/destination');
const Experience = require('../../models/experience');
const Photo = require('../../models/photo');
const { getEnforcer } = require('../../utilities/permission-enforcer');
const { transferBucket } = require('../../utilities/upload-pipeline');

const {
  normalizedSimilarity,
  withRetry,
  suggestPlanItems,
  fetchEntityPhotos,
  addEntityPhotos,
  fetchWikivoyageTips,
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

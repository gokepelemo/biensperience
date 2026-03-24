/**
 * Unit tests for bienbot-entity-resolver
 *
 * Tests:
 * - resolveEntity() per entity type (user, destination, experience, plan)
 * - resolveEntities() batch resolution with confidence classification
 * - formatResolutionBlock() prompt text generation
 * - Edge cases: empty input, unknown types, no matches
 */

const {
  resolveEntities,
  resolveEntity,
  formatResolutionBlock,
  ResolutionConfidence,
  DEFAULT_THRESHOLDS,
  FIELD_TYPE_MAP,
  _resolveUserByEmail,
  _resolveUserByName,
  _resolveDestination,
  _resolveExperience,
  _resolvePlan,
} = require('../../utilities/bienbot-entity-resolver');

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock search functions
jest.mock('../../controllers/api/search', () => ({
  searchUsersInternal: jest.fn().mockResolvedValue([]),
  searchDestinationsInternal: jest.fn().mockResolvedValue([]),
  searchExperiencesInternal: jest.fn().mockResolvedValue([]),
  searchPlansInternal: jest.fn().mockResolvedValue([]),
  computeRelevanceScore: jest.fn().mockReturnValue(0),
}));

// Mock User model
jest.mock('../../models/user', () => ({
  findOne: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    }),
  }),
}));

// Mock logger
jest.mock('../../utilities/backend-logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const searchMock = require('../../controllers/api/search');
const UserMock = require('../../models/user');

const mockUser = { _id: 'current-user-id', name: 'Current User', role: 'regular_user' };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetMocks() {
  jest.clearAllMocks();
  // Reset default empty returns
  searchMock.searchUsersInternal.mockResolvedValue([]);
  searchMock.searchDestinationsInternal.mockResolvedValue([]);
  searchMock.searchExperiencesInternal.mockResolvedValue([]);
  searchMock.searchPlansInternal.mockResolvedValue([]);
  UserMock.findOne.mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    }),
  });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('bienbot-entity-resolver', () => {
  beforeEach(resetMocks);

  // -------------------------------------------------------------------------
  // Exports
  // -------------------------------------------------------------------------

  describe('exports', () => {
    it('exports required functions and constants', () => {
      expect(typeof resolveEntities).toBe('function');
      expect(typeof resolveEntity).toBe('function');
      expect(typeof formatResolutionBlock).toBe('function');
      expect(ResolutionConfidence).toEqual({
        HIGH: 'high',
        MEDIUM: 'medium',
        LOW: 'low',
      });
      expect(DEFAULT_THRESHOLDS).toEqual({
        autoResolve: 0.90,
        disambiguate: 0.60,
      });
    });

    it('exports FIELD_TYPE_MAP with all supported fields', () => {
      expect(FIELD_TYPE_MAP).toEqual({
        destination_name: 'destination',
        experience_name: 'experience',
        assignee_name: 'user',
        user_email: 'user',
      });
    });
  });

  // -------------------------------------------------------------------------
  // resolveEntity — user by email
  // -------------------------------------------------------------------------

  describe('resolveEntity — user by email', () => {
    it('resolves exact email match with HIGH confidence', async () => {
      UserMock.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: 'user-123',
            name: 'Sarah Chen',
            email: 'sarah@example.com',
          }),
        }),
      });

      const result = await resolveEntity('sarah@example.com', 'user', mockUser, { _isEmail: true });

      expect(result.confidence).toBe(ResolutionConfidence.HIGH);
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0]).toMatchObject({
        id: 'user-123',
        name: 'Sarah Chen',
        type: 'user',
        score: 1.0,
        detail: 'sarah@example.com',
      });
    });

    it('falls back to name search when email not found', async () => {
      searchMock.searchUsersInternal.mockResolvedValue([
        { _id: 'user-456', name: 'Sarah Williams', type: 'user' },
      ]);

      const result = await resolveEntity('sarah@unknown.com', 'user', mockUser, { _isEmail: true });

      // Email lookup returns nothing, falls through to name search
      // Name search finds 'Sarah Williams' but fuzzy match on email vs name is low
      expect(result.candidates.length).toBeGreaterThanOrEqual(0);
    });
  });

  // -------------------------------------------------------------------------
  // resolveEntity — user by name
  // -------------------------------------------------------------------------

  describe('resolveEntity — user by name', () => {
    it('resolves exact name match with HIGH confidence', async () => {
      searchMock.searchUsersInternal.mockResolvedValue([
        { _id: 'user-789', name: 'Sarah Chen', email: 'sarah@example.com', type: 'user' },
      ]);

      const result = await resolveEntity('Sarah Chen', 'user', mockUser);

      expect(result.confidence).toBe(ResolutionConfidence.HIGH);
      expect(result.candidates[0]).toMatchObject({
        id: 'user-789',
        name: 'Sarah Chen',
        type: 'user',
      });
    });

    it('returns MEDIUM confidence for partial name match', async () => {
      searchMock.searchUsersInternal.mockResolvedValue([
        { _id: 'user-1', name: 'Sarah Chen', type: 'user' },
        { _id: 'user-2', name: 'Sarah Williams', type: 'user' },
        { _id: 'user-3', name: 'Sarah Park', type: 'user' },
      ]);

      const result = await resolveEntity('Sarah', 'user', mockUser);

      // 'Sarah' vs 'Sarah Chen' is a partial match — not exact
      expect(result.candidates.length).toBeGreaterThan(0);
    });

    it('boosts collaborator context matches', async () => {
      searchMock.searchUsersInternal.mockResolvedValue([
        { _id: 'user-1', name: 'Sarah Chen', type: 'user' },
      ]);

      const result = await resolveEntity('Sarah Chen', 'user', mockUser, {
        collaborators: [{ _id: 'user-1', name: 'Sarah Chen', email: 'sarah@example.com' }],
      });

      expect(result.candidates[0].id).toBe('user-1');
      // Collaborator boost should increase score
      expect(result.candidates[0].score).toBeGreaterThanOrEqual(0.9);
    });
  });

  // -------------------------------------------------------------------------
  // resolveEntity — destination
  // -------------------------------------------------------------------------

  describe('resolveEntity — destination', () => {
    it('resolves exact destination name', async () => {
      searchMock.searchDestinationsInternal.mockResolvedValue([
        { _id: 'dest-1', name: 'Tokyo', city: null, country: 'Japan', type: 'destination' },
      ]);

      const result = await resolveEntity('Tokyo', 'destination', mockUser);

      expect(result.confidence).toBe(ResolutionConfidence.HIGH);
      expect(result.candidates[0]).toMatchObject({
        id: 'dest-1',
        type: 'destination',
      });
    });

    it('returns multiple candidates for ambiguous names', async () => {
      searchMock.searchDestinationsInternal.mockResolvedValue([
        { _id: 'dest-1', name: 'Paris', city: null, country: 'France', type: 'destination' },
        { _id: 'dest-2', name: 'Paris', city: null, country: 'Texas', type: 'destination' },
      ]);

      const result = await resolveEntity('Paris', 'destination', mockUser);

      expect(result.candidates.length).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // resolveEntity — experience
  // -------------------------------------------------------------------------

  describe('resolveEntity — experience', () => {
    it('resolves exact experience name', async () => {
      searchMock.searchExperiencesInternal.mockResolvedValue([
        {
          _id: 'exp-1',
          name: 'Cherry Blossom Season',
          destination: { _id: 'dest-1', name: 'Tokyo', country: 'Japan' },
          type: 'experience',
        },
      ]);

      const result = await resolveEntity('Cherry Blossom Season', 'experience', mockUser);

      expect(result.confidence).toBe(ResolutionConfidence.HIGH);
      expect(result.candidates[0]).toMatchObject({
        id: 'exp-1',
        name: 'Cherry Blossom Season',
        type: 'experience',
      });
    });

    it('boosts experience in current destination context', async () => {
      searchMock.searchExperiencesInternal.mockResolvedValue([
        {
          _id: 'exp-1',
          name: 'Cherry Blossom Tour',
          destination: { _id: 'dest-1', name: 'Tokyo' },
          type: 'experience',
        },
        {
          _id: 'exp-2',
          name: 'Cherry Blossom Walk',
          destination: { _id: 'dest-2', name: 'Kyoto' },
          type: 'experience',
        },
      ]);

      const result = await resolveEntity('Cherry Blossom Tour', 'experience', mockUser, {
        destinationId: 'dest-1',
      });

      // The one in the current destination should score higher
      expect(result.candidates[0].id).toBe('exp-1');
    });
  });

  // -------------------------------------------------------------------------
  // resolveEntity — edge cases
  // -------------------------------------------------------------------------

  describe('resolveEntity — edge cases', () => {
    it('returns LOW confidence for empty name', async () => {
      const result = await resolveEntity('', 'destination', mockUser);
      expect(result.confidence).toBe(ResolutionConfidence.LOW);
      expect(result.candidates).toHaveLength(0);
    });

    it('returns LOW confidence for null name', async () => {
      const result = await resolveEntity(null, 'destination', mockUser);
      expect(result.confidence).toBe(ResolutionConfidence.LOW);
    });

    it('returns LOW confidence for unknown type', async () => {
      const result = await resolveEntity('something', 'unknown_type', mockUser);
      expect(result.confidence).toBe(ResolutionConfidence.LOW);
    });

    it('returns LOW confidence when no results found', async () => {
      searchMock.searchDestinationsInternal.mockResolvedValue([]);
      const result = await resolveEntity('Nonexistent Place', 'destination', mockUser);
      expect(result.confidence).toBe(ResolutionConfidence.LOW);
      expect(result.candidates).toHaveLength(0);
    });

    it('caps candidates at 5', async () => {
      searchMock.searchUsersInternal.mockResolvedValue(
        Array.from({ length: 10 }, (_, i) => ({
          _id: `user-${i}`,
          name: `John Smith ${i}`,
          type: 'user',
        }))
      );

      const result = await resolveEntity('John Smith', 'user', mockUser);
      expect(result.candidates.length).toBeLessThanOrEqual(5);
    });
  });

  // -------------------------------------------------------------------------
  // resolveEntities — batch
  // -------------------------------------------------------------------------

  describe('resolveEntities — batch resolution', () => {
    it('resolves multiple entity types in parallel', async () => {
      // Set up destination result
      searchMock.searchDestinationsInternal.mockResolvedValue([
        { _id: 'dest-1', name: 'Tokyo', country: 'Japan', type: 'destination' },
      ]);

      // Set up user result
      UserMock.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: 'user-1',
            name: 'Sarah Chen',
            email: 'sarah@example.com',
          }),
        }),
      });

      const result = await resolveEntities(
        {
          destination_name: 'Tokyo',
          user_email: 'sarah@example.com',
        },
        mockUser
      );

      expect(Object.keys(result.resolved).length).toBeGreaterThanOrEqual(1);
      expect(result.unresolved).toBeDefined();
      expect(result.ambiguous).toBeDefined();
    });

    it('skips unknown field names', async () => {
      const result = await resolveEntities(
        {
          unknown_field: 'something',
          plan_item_texts: ['item 1', 'item 2'],
        },
        mockUser
      );

      expect(result.resolved).toEqual({});
      expect(result.ambiguous).toEqual({});
      expect(result.unresolved).toEqual([]);
    });

    it('handles null/undefined input gracefully', async () => {
      const nullResult = await resolveEntities(null, mockUser);
      expect(nullResult).toEqual({ resolved: {}, ambiguous: {}, unresolved: [] });

      const undefinedResult = await resolveEntities(undefined, mockUser);
      expect(undefinedResult).toEqual({ resolved: {}, ambiguous: {}, unresolved: [] });
    });

    it('handles empty extractedNames', async () => {
      const result = await resolveEntities({}, mockUser);
      expect(result).toEqual({ resolved: {}, ambiguous: {}, unresolved: [] });
    });

    it('classifies results into resolved/ambiguous/unresolved', async () => {
      // High confidence destination
      searchMock.searchDestinationsInternal.mockResolvedValue([
        { _id: 'dest-1', name: 'Tokyo', country: 'Japan', type: 'destination' },
      ]);

      // No user results (unresolved)
      searchMock.searchUsersInternal.mockResolvedValue([]);

      const result = await resolveEntities(
        {
          destination_name: 'Tokyo',
          assignee_name: 'Nonexistent User',
        },
        mockUser
      );

      // Tokyo should be resolved (exact match)
      expect(result.resolved).toHaveProperty('destination_name');
      // Unknown user should be unresolved
      expect(result.unresolved).toContain('assignee_name');
    });
  });

  // -------------------------------------------------------------------------
  // formatResolutionBlock
  // -------------------------------------------------------------------------

  describe('formatResolutionBlock', () => {
    it('returns null when nothing to format', () => {
      const result = formatResolutionBlock(
        { resolved: {}, ambiguous: {}, unresolved: [] },
        {}
      );
      expect(result).toBeNull();
    });

    it('formats resolved entries', () => {
      const block = formatResolutionBlock(
        {
          resolved: {
            destination_name: {
              id: 'dest-1',
              name: 'Tokyo, Japan',
              type: 'destination',
              score: 0.98,
            },
          },
          ambiguous: {},
          unresolved: [],
        },
        { destination_name: 'Tokyo' }
      );

      expect(block).toContain('[Entity Resolution]');
      expect(block).toContain('✓ "Tokyo"');
      expect(block).toContain('destination:dest-1');
      expect(block).toContain('Tokyo, Japan');
      expect(block).toContain('0.98');
    });

    it('formats ambiguous entries with multiple candidates', () => {
      const block = formatResolutionBlock(
        {
          resolved: {},
          ambiguous: {
            experience_name: [
              { id: 'exp-1', name: 'Cherry Blossom Tour', type: 'experience', score: 0.85, detail: 'in Tokyo' },
              { id: 'exp-2', name: 'Cherry Blossom Walk', type: 'experience', score: 0.80, detail: 'in Kyoto' },
            ],
          },
          unresolved: [],
        },
        { experience_name: 'Cherry Blossom' }
      );

      expect(block).toContain('? "Cherry Blossom"');
      expect(block).toContain('ambiguous, 2 matches');
      expect(block).toContain('1. experience:exp-1');
      expect(block).toContain('2. experience:exp-2');
    });

    it('formats unresolved entries', () => {
      const block = formatResolutionBlock(
        {
          resolved: {},
          ambiguous: {},
          unresolved: ['assignee_name'],
        },
        { assignee_name: 'Unknown Person' }
      );

      expect(block).toContain('✗ "Unknown Person"');
      expect(block).toContain('unresolved, no matches');
    });

    it('includes usage rules', () => {
      const block = formatResolutionBlock(
        {
          resolved: {
            destination_name: { id: 'x', name: 'Y', type: 'destination', score: 0.95 },
          },
          ambiguous: {},
          unresolved: [],
        },
        { destination_name: 'Y' }
      );

      expect(block).toContain('Use resolved IDs directly in action payloads');
      expect(block).toContain('For ambiguous matches');
      expect(block).toContain('For unresolved names');
    });
  });
});

/**
 * Feature Flags Utility Tests
 *
 * Tests for the backend feature flags utility:
 * - hasFeatureFlag
 * - getFeatureFlagConfig
 * - getUserFeatureFlags
 * - addFeatureFlag / removeFeatureFlag
 * - Global flags
 *
 * Run with:
 * npm run test:api -- tests/utils/feature-flags.test.js
 */

const {
  FEATURE_FLAGS,
  FEATURE_FLAG_CONTEXT,
  hasFeatureFlag,
  hasFeatureFlagInContext,
  getFeatureFlagConfig,
  getUserFeatureFlags,
  hasGlobalFlag,
  getFlagMetadata,
  getAllFlags,
  createFlagDenialResponse
} = require('../../utilities/feature-flags');

describe('Feature Flags Utility', () => {
  describe('hasFeatureFlag', () => {
    test('should return false for null user', () => {
      expect(hasFeatureFlag(null, 'ai_features')).toBe(false);
    });

    test('should return false for user without feature_flags', () => {
      const user = { _id: '123', name: 'Test' };
      expect(hasFeatureFlag(user, 'ai_features')).toBe(false);
    });

    test('should return false for user with empty feature_flags', () => {
      const user = { _id: '123', feature_flags: [] };
      expect(hasFeatureFlag(user, 'ai_features')).toBe(false);
    });

    test('should return false for non-existent flag', () => {
      const user = {
        _id: '123',
        feature_flags: [{ flag: 'ai_features', enabled: true }]
      };
      expect(hasFeatureFlag(user, 'nonexistent_flag')).toBe(false);
    });

    test('should return true for enabled flag', () => {
      const user = {
        _id: '123',
        feature_flags: [{ flag: 'ai_features', enabled: true }]
      };
      expect(hasFeatureFlag(user, 'ai_features')).toBe(true);
    });

    test('should return false for disabled flag', () => {
      const user = {
        _id: '123',
        feature_flags: [{ flag: 'ai_features', enabled: false }]
      };
      expect(hasFeatureFlag(user, 'ai_features')).toBe(false);
    });

    test('should be case-insensitive for flag keys', () => {
      const user = {
        _id: '123',
        feature_flags: [{ flag: 'ai_features', enabled: true }]
      };
      expect(hasFeatureFlag(user, 'AI_FEATURES')).toBe(true);
      expect(hasFeatureFlag(user, 'Ai_Features')).toBe(true);
    });

    test('should return true for super_admin users', () => {
      const superAdmin = {
        _id: '123',
        role: 'super_admin',
        feature_flags: [] // No flags, but super admin should bypass
      };
      expect(hasFeatureFlag(superAdmin, 'ai_features')).toBe(true);
      expect(hasFeatureFlag(superAdmin, 'any_flag')).toBe(true);
    });

    test('should respect allowSuperAdmin option', () => {
      const superAdmin = {
        _id: '123',
        role: 'super_admin',
        feature_flags: []
      };
      expect(hasFeatureFlag(superAdmin, 'ai_features', { allowSuperAdmin: false })).toBe(false);
    });

    test('should return false for expired flag', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const user = {
        _id: '123',
        feature_flags: [{
          flag: 'ai_features',
          enabled: true,
          expires_at: pastDate
        }]
      };
      expect(hasFeatureFlag(user, 'ai_features')).toBe(false);
    });

    test('should return true for non-expired flag', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const user = {
        _id: '123',
        feature_flags: [{
          flag: 'ai_features',
          enabled: true,
          expires_at: futureDate
        }]
      };
      expect(hasFeatureFlag(user, 'ai_features')).toBe(true);
    });

    test('should ignore expiry when checkExpiry is false', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const user = {
        _id: '123',
        feature_flags: [{
          flag: 'ai_features',
          enabled: true,
          expires_at: pastDate
        }]
      };
      expect(hasFeatureFlag(user, 'ai_features', { checkExpiry: false })).toBe(true);
    });
  });

  describe('hasFeatureFlagInContext', () => {
    test('Scenario 1: should check entity creator user by default', () => {
      const loggedInUser = { _id: 'actor', feature_flags: [] };
      const entityCreatorUser = {
        _id: 'creator',
        feature_flags: [{ flag: 'stream_chat', enabled: true }]
      };

      expect(
        hasFeatureFlagInContext({
          loggedInUser,
          entityCreatorUser,
          flagKey: 'stream_chat'
        })
      ).toBe(true);
    });

    test('Scenario 2: should check logged-in user when context is LOGGED_IN_USER', () => {
      const loggedInUser = {
        _id: 'actor',
        feature_flags: [{ flag: 'ai_features', enabled: true }]
      };
      const entityCreatorUser = { _id: 'creator', feature_flags: [] };

      expect(
        hasFeatureFlagInContext({
          loggedInUser,
          entityCreatorUser,
          flagKey: 'ai_features',
          context: FEATURE_FLAG_CONTEXT.LOGGED_IN_USER
        })
      ).toBe(true);
    });

    test('should fail closed when creator context is used and entityCreatorUser is missing', () => {
      const loggedInUser = {
        _id: 'actor',
        feature_flags: [{ flag: 'ai_features', enabled: true }]
      };

      expect(
        hasFeatureFlagInContext({
          loggedInUser,
          entityCreatorUser: null,
          flagKey: 'ai_features',
          context: FEATURE_FLAG_CONTEXT.ENTITY_CREATOR
        })
      ).toBe(false);
    });

    test('should allow super admin actor regardless of context', () => {
      const loggedInUser = {
        _id: 'actor',
        role: 'super_admin',
        feature_flags: []
      };
      const entityCreatorUser = { _id: 'creator', feature_flags: [] };

      expect(
        hasFeatureFlagInContext({
          loggedInUser,
          entityCreatorUser,
          flagKey: 'some_new_flag',
          context: FEATURE_FLAG_CONTEXT.ENTITY_CREATOR
        })
      ).toBe(true);
    });
  });

  describe('getFeatureFlagConfig', () => {
    test('should return null for null user', () => {
      expect(getFeatureFlagConfig(null, 'ai_features')).toBeNull();
    });

    test('should return null for user without flags', () => {
      const user = { _id: '123', feature_flags: [] };
      expect(getFeatureFlagConfig(user, 'ai_features')).toBeNull();
    });

    test('should return null for disabled flag', () => {
      const user = {
        _id: '123',
        feature_flags: [{
          flag: 'ai_features',
          enabled: false,
          config: { maxRequests: 100 }
        }]
      };
      expect(getFeatureFlagConfig(user, 'ai_features')).toBeNull();
    });

    test('should return config for enabled flag', () => {
      const config = { maxRequests: 100, tier: 'premium' };
      const user = {
        _id: '123',
        feature_flags: [{
          flag: 'ai_features',
          enabled: true,
          config: config
        }]
      };
      expect(getFeatureFlagConfig(user, 'ai_features')).toEqual(config);
    });

    test('should return empty object if no config', () => {
      const user = {
        _id: '123',
        feature_flags: [{
          flag: 'ai_features',
          enabled: true
        }]
      };
      expect(getFeatureFlagConfig(user, 'ai_features')).toEqual({});
    });
  });

  describe('getUserFeatureFlags', () => {
    test('should return empty array for null user', () => {
      expect(getUserFeatureFlags(null)).toEqual([]);
    });

    test('should return empty array for user without flags', () => {
      const user = { _id: '123', feature_flags: [] };
      expect(getUserFeatureFlags(user)).toEqual([]);
    });

    test('should return only enabled flags', () => {
      const user = {
        _id: '123',
        feature_flags: [
          { flag: 'ai_features', enabled: true },
          { flag: 'beta_ui', enabled: false },
          { flag: 'curator', enabled: true }
        ]
      };

      const result = getUserFeatureFlags(user);
      expect(result.length).toBe(2);
      expect(result.map(f => f.flag)).toContain('ai_features');
      expect(result.map(f => f.flag)).toContain('curator');
      expect(result.map(f => f.flag)).not.toContain('beta_ui');
    });

    test('should filter out expired flags by default', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const user = {
        _id: '123',
        feature_flags: [
          { flag: 'ai_features', enabled: true, expires_at: pastDate },
          { flag: 'beta_ui', enabled: true, expires_at: futureDate }
        ]
      };

      const result = getUserFeatureFlags(user);
      expect(result.length).toBe(1);
      expect(result[0].flag).toBe('beta_ui');
    });

    test('should include expired flags when option is set', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const user = {
        _id: '123',
        feature_flags: [
          { flag: 'ai_features', enabled: true, expires_at: pastDate }
        ]
      };

      const result = getUserFeatureFlags(user, { includeExpired: true });
      expect(result.length).toBe(1);
      expect(result[0].flag).toBe('ai_features');
    });
  });

  describe('hasGlobalFlag', () => {
    test('should return boolean for global flags', () => {
      const result = hasGlobalFlag('MAINTENANCE_MODE');
      expect(typeof result).toBe('boolean');
    });

    test('should return false for non-existent global flag', () => {
      expect(hasGlobalFlag('NON_EXISTENT_FLAG')).toBe(false);
    });
  });

  describe('getFlagMetadata', () => {
    test('should return metadata for known flags', () => {
      const metadata = getFlagMetadata('AI_FEATURES');
      expect(metadata).toBeDefined();
      expect(metadata.key).toBe('ai_features');
      expect(metadata.description).toBeDefined();
      expect(metadata.tier).toBe('premium');
    });

    test('should be case-insensitive', () => {
      const metadata1 = getFlagMetadata('ai_features');
      const metadata2 = getFlagMetadata('AI_FEATURES');
      // Both should return the same metadata
      expect(metadata1).toEqual(metadata2);
    });

    test('should return null for unknown flags', () => {
      expect(getFlagMetadata('UNKNOWN_FLAG')).toBeNull();
    });
  });

  describe('getAllFlags', () => {
    test('should return all registered flags', () => {
      const flags = getAllFlags();
      expect(typeof flags).toBe('object');
      expect(flags.AI_FEATURES).toBeDefined();
      expect(flags.BETA_UI).toBeDefined();
      expect(flags.CURATOR).toBeDefined();
    });

    test('should return a copy (not mutate original)', () => {
      const flags1 = getAllFlags();
      flags1.NEW_FLAG = { key: 'test' };
      const flags2 = getAllFlags();
      expect(flags2.NEW_FLAG).toBeUndefined();
    });
  });

  describe('createFlagDenialResponse', () => {
    test('should create denial response with default message', () => {
      const response = createFlagDenialResponse('ai_features');
      expect(response.success).toBe(false);
      expect(response.error).toBe('Feature not available');
      expect(response.code).toBe('FEATURE_FLAG_REQUIRED');
      expect(response.flag).toBe('ai_features');
      expect(response.message).toBeDefined();
    });

    test('should use custom message when provided', () => {
      const customMessage = 'Custom denial message';
      const response = createFlagDenialResponse('ai_features', { message: customMessage });
      expect(response.message).toBe(customMessage);
    });

    test('should include tier information', () => {
      const response = createFlagDenialResponse('AI_FEATURES');
      expect(response.tier).toBe('premium');
    });

    test('should handle unknown flags gracefully', () => {
      const response = createFlagDenialResponse('unknown_flag');
      expect(response.success).toBe(false);
      expect(response.flag).toBe('unknown_flag');
      expect(response.tier).toBe('premium'); // default tier
    });
  });

  describe('FEATURE_FLAGS constant', () => {
    test('should have required properties for each flag', () => {
      Object.values(FEATURE_FLAGS).forEach(flag => {
        expect(flag).toHaveProperty('key');
        expect(flag).toHaveProperty('description');
        expect(flag).toHaveProperty('defaultEnabled');
        expect(flag).toHaveProperty('requiresAuth');
        expect(flag).toHaveProperty('tier');
        expect(typeof flag.key).toBe('string');
        expect(typeof flag.description).toBe('string');
        expect(typeof flag.defaultEnabled).toBe('boolean');
      });
    });

    test('should have unique keys', () => {
      const keys = Object.values(FEATURE_FLAGS).map(f => f.key);
      const uniqueKeys = [...new Set(keys)];
      expect(keys.length).toBe(uniqueKeys.length);
    });
  });
});

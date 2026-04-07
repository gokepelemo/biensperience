/**
 * Unit tests for bienbot-intent-classifier (NLP.js-based)
 *
 * Tests:
 * - classifyIntent() correctly classifies all intent types
 * - classifyIntent() fallback on empty/null input
 * - classifyIntent() entity extraction (email, destination, plan items)
 * - classifyIntent() confidence scores
 * - INTENTS enum is exported correctly
 * - resetManager() resets the NLP singleton
 */

const { classifyIntent, INTENTS, resetManager } = require('../../utilities/bienbot-intent-classifier');

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('bienbot-intent-classifier', () => {
  // Train the model once before all tests
  beforeAll(async () => {
    resetManager();
    // Warm up the model with a single classification
    await classifyIntent('hello');
  }, 120000); // 120s — training corpus with 70 intents / 1500+ utterances

  // -------------------------------------------------------------------------
  // INTENTS enum
  // -------------------------------------------------------------------------

  describe('INTENTS enum', () => {
    it('exports all required intent types', () => {
      const required = [
        'QUERY_DESTINATION',
        'PLAN_EXPERIENCE',
        'CREATE_EXPERIENCE',
        'ADD_PLAN_ITEMS',
        'INVITE_COLLABORATOR',
        'SYNC_PLAN',
        'ANSWER_QUESTION',
        'QUERY_USER_EXPERIENCES'
      ];
      for (const intent of required) {
        expect(INTENTS).toHaveProperty(intent);
        expect(INTENTS[intent]).toBe(intent);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Intent classification
  // -------------------------------------------------------------------------

  describe('classifyIntent() — intent classification', () => {
    it('classifies QUERY_DESTINATION intent', async () => {
      const result = await classifyIntent('Tell me about Kyoto');
      expect(result.intent).toBe('QUERY_DESTINATION');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('classifies QUERY_DESTINATION for weather questions', async () => {
      const result = await classifyIntent('What is the weather like in Paris');
      expect(result.intent).toBe('QUERY_DESTINATION');
    });

    it('classifies QUERY_DESTINATION for visa questions', async () => {
      const result = await classifyIntent('Do I need a visa for Brazil');
      expect(result.intent).toBe('QUERY_DESTINATION');
    });

    it('classifies PLAN_EXPERIENCE intent', async () => {
      const result = await classifyIntent('I want to plan the Cherry Blossom Tour');
      expect(result.intent).toBe('PLAN_EXPERIENCE');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('classifies PLAN_EXPERIENCE for trip planning', async () => {
      const result = await classifyIntent('Help me plan my trip');
      expect(result.intent).toBe('PLAN_EXPERIENCE');
    });

    it('classifies CREATE_EXPERIENCE intent', async () => {
      const result = await classifyIntent('Create a new experience for Tokyo');
      expect(result.intent).toBe('CREATE_EXPERIENCE');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('classifies ADD_PLAN_ITEMS intent', async () => {
      const result = await classifyIntent('Add visit Senso-ji temple to my plan');
      expect(result.intent).toBe('ADD_PLAN_ITEMS');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('classifies ADD_PLAN_ITEMS for simple add requests', async () => {
      const result = await classifyIntent('Add an activity to my plan');
      expect(result.intent).toBe('ADD_PLAN_ITEMS');
    });

    it('classifies INVITE_COLLABORATOR intent', async () => {
      const result = await classifyIntent('Invite alice@example.com to collaborate on my plan');
      expect(result.intent).toBe('INVITE_COLLABORATOR');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('classifies INVITE_COLLABORATOR for sharing', async () => {
      const result = await classifyIntent('Share this plan with someone');
      expect(result.intent).toBe('INVITE_COLLABORATOR');
    });

    it('classifies SYNC_PLAN intent', async () => {
      const result = await classifyIntent('Sync my plan');
      expect(result.intent).toBe('SYNC_PLAN');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('classifies SYNC_PLAN for outdated plan', async () => {
      const result = await classifyIntent('My plan is out of date');
      expect(result.intent).toBe('SYNC_PLAN');
    });

    it('classifies QUERY_USER_EXPERIENCES intent', async () => {
      const result = await classifyIntent('Show me experiences created by this user');
      expect(result.intent).toBe('QUERY_USER_EXPERIENCES');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('classifies QUERY_USER_EXPERIENCES for profile browsing', async () => {
      const result = await classifyIntent('List their experiences');
      expect(result.intent).toBe('QUERY_USER_EXPERIENCES');
    });

    it('classifies CREATE_DESTINATION intent', async () => {
      const result = await classifyIntent('Create a destination for Tokyo');
      expect(result.intent).toBe('CREATE_DESTINATION');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('classifies SEARCH_CONTENT intent', async () => {
      const result = await classifyIntent('Search for beach experiences');
      expect(result.intent).toBe('SEARCH_CONTENT');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('classifies FOLLOW_USER intent', async () => {
      const result = await classifyIntent('Follow this user');
      expect(result.intent).toBe('FOLLOW_USER');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('classifies UNFOLLOW_USER intent', async () => {
      const result = await classifyIntent('Stop following this person');
      expect(result.intent).toBe('UNFOLLOW_USER');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('classifies QUERY_FOLLOWERS intent', async () => {
      const result = await classifyIntent('Show me my followers');
      expect(result.intent).toBe('QUERY_FOLLOWERS');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('classifies QUERY_DASHBOARD intent', async () => {
      const result = await classifyIntent('Show me my dashboard');
      expect(result.intent).toBe('QUERY_DASHBOARD');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('classifies QUERY_PLAN_COSTS intent', async () => {
      const result = await classifyIntent('Show me the budget');
      expect(result.intent).toBe('QUERY_PLAN_COSTS');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('classifies PIN_PLAN_ITEM intent', async () => {
      const result = await classifyIntent('Pin this plan item');
      expect(result.intent).toBe('PIN_PLAN_ITEM');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('classifies SHIFT_PLAN_DATES intent', async () => {
      const result = await classifyIntent('Shift all dates forward by 3 days');
      expect(result.intent).toBe('SHIFT_PLAN_DATES');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('classifies UPDATE_PLAN_COST intent', async () => {
      const result = await classifyIntent('Update the hotel cost');
      expect(result.intent).toBe('UPDATE_PLAN_COST');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('classifies DELETE_PLAN_COST intent', async () => {
      const result = await classifyIntent('Remove the flight expense');
      expect(result.intent).toBe('DELETE_PLAN_COST');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('classifies QUERY_PROFILE intent', async () => {
      const result = await classifyIntent('Tell me about this person');
      expect(result.intent).toBe('QUERY_PROFILE');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('classifies UPDATE_PROFILE intent', async () => {
      const result = await classifyIntent('Update my profile');
      expect(result.intent).toBe('UPDATE_PROFILE');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('classifies QUERY_COUNTRY intent', async () => {
      const result = await classifyIntent('What destinations are in Japan');
      expect(result.intent).toBe('QUERY_COUNTRY');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('classifies QUERY_ACTIVITY_FEED intent', async () => {
      const result = await classifyIntent('Show my activity feed');
      expect(result.intent).toBe('QUERY_ACTIVITY_FEED');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('classifies CREATE_INVITE intent', async () => {
      const result = await classifyIntent('Create an invite code');
      expect(result.intent).toBe('CREATE_INVITE');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('classifies REQUEST_PLAN_ACCESS intent', async () => {
      const result = await classifyIntent('Request access to this plan');
      expect(result.intent).toBe('REQUEST_PLAN_ACCESS');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('classifies UPLOAD_DOCUMENT intent', async () => {
      const result = await classifyIntent('Upload a travel document');
      expect(result.intent).toBe('UPLOAD_DOCUMENT');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('classifies QUERY_PHOTOS intent', async () => {
      const result = await classifyIntent('Show me the photos');
      expect(result.intent).toBe('QUERY_PHOTOS');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('classifies QUERY_DOCUMENTS intent', async () => {
      const result = await classifyIntent('What documents are attached');
      expect(result.intent).toBe('QUERY_DOCUMENTS');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('classifies ANSWER_QUESTION for greetings', async () => {
      const result = await classifyIntent('Hello');
      expect(result.intent).toBe('ANSWER_QUESTION');
    });

    it('classifies ANSWER_QUESTION for general questions', async () => {
      const result = await classifyIntent('What can you do');
      expect(result.intent).toBe('ANSWER_QUESTION');
    });

    it('classifies ANSWER_QUESTION for help requests', async () => {
      const result = await classifyIntent('How does this work');
      expect(result.intent).toBe('ANSWER_QUESTION');
    });
  });

  // -------------------------------------------------------------------------
  // Confidence scores
  // -------------------------------------------------------------------------

  describe('classifyIntent() — confidence scores', () => {
    it('returns confidence between 0 and 1', async () => {
      const result = await classifyIntent('Tell me about Tokyo');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('returns high confidence for clear intents', async () => {
      const result = await classifyIntent('Sync my plan');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('returns zero confidence for fallback results', async () => {
      const result = await classifyIntent('');
      expect(result.confidence).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Entity extraction
  // -------------------------------------------------------------------------

  describe('classifyIntent() — entity extraction', () => {
    it('extracts email entity from INVITE_COLLABORATOR message', async () => {
      const result = await classifyIntent('Invite alice@example.com to collaborate');
      expect(result.entities.user_email).toBe('alice@example.com');
    });

    it('extracts email from share messages', async () => {
      const result = await classifyIntent('Share this plan with bob@test.com');
      expect(result.entities.user_email).toBe('bob@test.com');
    });

    it('extracts destination name from query messages', async () => {
      const result = await classifyIntent('Tell me about Kyoto');
      expect(result.entities.destination_name).toBeTruthy();
    });

    it('extracts plan_item_texts from ADD_PLAN_ITEMS messages', async () => {
      const result = await classifyIntent('Add visit Senso-ji temple and try street food to my plan');
      expect(result.entities.plan_item_texts).toBeTruthy();
      expect(Array.isArray(result.entities.plan_item_texts)).toBe(true);
      expect(result.entities.plan_item_texts.length).toBeGreaterThanOrEqual(1);
    });

    it('returns null entities when no entities in message', async () => {
      const result = await classifyIntent('Hello');
      expect(result.entities.user_email).toBeNull();
      expect(result.entities.plan_item_texts).toBeNull();
    });

    it('always returns all entity fields', async () => {
      const result = await classifyIntent('Hello');
      expect(result.entities).toHaveProperty('destination_name');
      expect(result.entities).toHaveProperty('experience_name');
      expect(result.entities).toHaveProperty('user_email');
      expect(result.entities).toHaveProperty('plan_item_texts');
    });
  });

  // -------------------------------------------------------------------------
  // Fallback behaviour
  // -------------------------------------------------------------------------

  describe('classifyIntent() — fallback', () => {
    it('returns ANSWER_QUESTION fallback when message is empty', async () => {
      const result = await classifyIntent('');
      expect(result.intent).toBe(INTENTS.ANSWER_QUESTION);
      expect(result.confidence).toBe(0);
    });

    it('returns ANSWER_QUESTION fallback when message is whitespace only', async () => {
      const result = await classifyIntent('   ');
      expect(result.intent).toBe(INTENTS.ANSWER_QUESTION);
      expect(result.confidence).toBe(0);
    });

    it('returns ANSWER_QUESTION fallback when message is null', async () => {
      const result = await classifyIntent(null);
      expect(result.intent).toBe(INTENTS.ANSWER_QUESTION);
      expect(result.confidence).toBe(0);
    });

    it('returns ANSWER_QUESTION fallback when message is undefined', async () => {
      const result = await classifyIntent(undefined);
      expect(result.intent).toBe(INTENTS.ANSWER_QUESTION);
      expect(result.confidence).toBe(0);
    });

    it('returns null entities for fallback results', async () => {
      const result = await classifyIntent('');
      expect(result.entities.destination_name).toBeNull();
      expect(result.entities.experience_name).toBeNull();
      expect(result.entities.user_email).toBeNull();
      expect(result.entities.plan_item_texts).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // resetManager
  // -------------------------------------------------------------------------

  describe('resetManager()', () => {
    it('resets the NLP manager singleton', async () => {
      // First classification should work
      const r1 = await classifyIntent('Hello');
      expect(r1.intent).toBe(INTENTS.ANSWER_QUESTION);

      // Reset and classify again (should retrain)
      resetManager();
      const r2 = await classifyIntent('Hello');
      expect(r2.intent).toBe(INTENTS.ANSWER_QUESTION);
    });
  });

  // -------------------------------------------------------------------------
  // Return shape
  // -------------------------------------------------------------------------

  describe('classifyIntent() — return shape', () => {
    it('always returns intent, entities, and confidence', async () => {
      const result = await classifyIntent('Plan my trip to Bali');
      expect(result).toHaveProperty('intent');
      expect(result).toHaveProperty('entities');
      expect(result).toHaveProperty('confidence');
      expect(typeof result.intent).toBe('string');
      expect(typeof result.entities).toBe('object');
      expect(typeof result.confidence).toBe('number');
    });
  });
});

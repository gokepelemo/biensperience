/**
 * Unit tests for bienbot-intent-classifier
 *
 * Tests:
 * - classifyIntent() with valid AI responses
 * - classifyIntent() fallback when AI unavailable
 * - classifyIntent() fallback on malformed AI response
 * - classifyIntent() confidence clamping
 * - classifyIntent() entity normalisation
 * - INTENTS enum is exported correctly
 */

// Mock the AI provider layer before requiring the classifier
jest.mock('../../controllers/api/ai', () => ({
  callProvider: jest.fn(),
  getApiKey: jest.fn(),
  getProviderForTask: jest.fn().mockReturnValue('openai'),
  AI_TASKS: { GENERAL: 'general', FAST: 'fast' }
}));

const { classifyIntent, INTENTS } = require('../../utilities/bienbot-intent-classifier');
const { callProvider, getApiKey } = require('../../controllers/api/ai');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockLLMResponse(payload) {
  callProvider.mockResolvedValueOnce({
    content: typeof payload === 'string' ? payload : JSON.stringify(payload),
    usage: { prompt_tokens: 10, completion_tokens: 10 }
  });
}

function aiAvailable() {
  getApiKey.mockReturnValue('test-key');
}

function aiUnavailable() {
  getApiKey.mockReturnValue(null);
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('bienbot-intent-classifier', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    aiAvailable();
  });

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
        'ANSWER_QUESTION'
      ];
      for (const intent of required) {
        expect(INTENTS).toHaveProperty(intent);
        expect(INTENTS[intent]).toBe(intent);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Valid classification
  // -------------------------------------------------------------------------

  describe('classifyIntent() — valid responses', () => {
    it('returns correct intent from LLM JSON response', async () => {
      mockLLMResponse({
        intent: 'QUERY_DESTINATION',
        entities: { destination_name: 'Kyoto', experience_name: null, user_email: null, plan_item_texts: [] },
        confidence: 0.92
      });

      const result = await classifyIntent('Tell me about Kyoto');

      expect(result.intent).toBe('QUERY_DESTINATION');
      expect(result.entities.destination_name).toBe('Kyoto');
      expect(result.confidence).toBe(0.92);
    });

    it('classifies PLAN_EXPERIENCE intent', async () => {
      mockLLMResponse({
        intent: 'PLAN_EXPERIENCE',
        entities: { destination_name: 'Tokyo', experience_name: 'Cherry Blossom Tour', user_email: null, plan_item_texts: null },
        confidence: 0.88
      });

      const result = await classifyIntent('I want to plan the Cherry Blossom Tour in Tokyo');
      expect(result.intent).toBe('PLAN_EXPERIENCE');
      expect(result.entities.experience_name).toBe('Cherry Blossom Tour');
    });

    it('classifies ADD_PLAN_ITEMS with plan_item_texts', async () => {
      mockLLMResponse({
        intent: 'ADD_PLAN_ITEMS',
        entities: {
          destination_name: null,
          experience_name: null,
          user_email: null,
          plan_item_texts: ['Visit Senso-ji temple', 'Try street food']
        },
        confidence: 0.95
      });

      const result = await classifyIntent('Add visit Senso-ji temple and try street food to my plan');
      expect(result.intent).toBe('ADD_PLAN_ITEMS');
      expect(result.entities.plan_item_texts).toHaveLength(2);
    });

    it('classifies INVITE_COLLABORATOR with user email', async () => {
      mockLLMResponse({
        intent: 'INVITE_COLLABORATOR',
        entities: { destination_name: null, experience_name: null, user_email: 'alice@example.com', plan_item_texts: null },
        confidence: 0.97
      });

      const result = await classifyIntent('Invite alice@example.com to collaborate on my plan');
      expect(result.intent).toBe('INVITE_COLLABORATOR');
      expect(result.entities.user_email).toBe('alice@example.com');
    });

    it('strips markdown fences from JSON response', async () => {
      const jsonPayload = JSON.stringify({
        intent: 'ANSWER_QUESTION',
        entities: { destination_name: null, experience_name: null, user_email: null, plan_item_texts: null },
        confidence: 0.8
      });
      mockLLMResponse(`\`\`\`json\n${jsonPayload}\n\`\`\``);

      const result = await classifyIntent('What is the best time to visit Japan?');
      expect(result.intent).toBe('ANSWER_QUESTION');
    });
  });

  // -------------------------------------------------------------------------
  // Confidence clamping
  // -------------------------------------------------------------------------

  describe('classifyIntent() — confidence clamping', () => {
    it('clamps confidence above 1 to 1', async () => {
      mockLLMResponse({ intent: 'ANSWER_QUESTION', entities: {}, confidence: 1.5 });
      const result = await classifyIntent('Hello');
      expect(result.confidence).toBe(1);
    });

    it('clamps confidence below 0 to 0', async () => {
      mockLLMResponse({ intent: 'ANSWER_QUESTION', entities: {}, confidence: -0.3 });
      const result = await classifyIntent('Hello');
      expect(result.confidence).toBe(0);
    });

    it('defaults confidence to 0.5 when not a number', async () => {
      mockLLMResponse({ intent: 'ANSWER_QUESTION', entities: {}, confidence: 'high' });
      const result = await classifyIntent('Hello');
      expect(result.confidence).toBe(0.5);
    });
  });

  // -------------------------------------------------------------------------
  // Fallback behaviour
  // -------------------------------------------------------------------------

  describe('classifyIntent() — fallback', () => {
    it('returns ANSWER_QUESTION fallback when AI key not configured', async () => {
      aiUnavailable();

      const result = await classifyIntent('Hello BienBot');

      expect(result.intent).toBe(INTENTS.ANSWER_QUESTION);
      expect(result.confidence).toBe(0);
      expect(callProvider).not.toHaveBeenCalled();
    });

    it('returns ANSWER_QUESTION fallback when message is empty', async () => {
      const result = await classifyIntent('');
      expect(result.intent).toBe(INTENTS.ANSWER_QUESTION);
      expect(callProvider).not.toHaveBeenCalled();
    });

    it('returns ANSWER_QUESTION fallback when message is whitespace only', async () => {
      const result = await classifyIntent('   ');
      expect(result.intent).toBe(INTENTS.ANSWER_QUESTION);
    });

    it('returns ANSWER_QUESTION fallback when message is null/undefined', async () => {
      const r1 = await classifyIntent(null);
      const r2 = await classifyIntent(undefined);
      expect(r1.intent).toBe(INTENTS.ANSWER_QUESTION);
      expect(r2.intent).toBe(INTENTS.ANSWER_QUESTION);
    });

    it('returns ANSWER_QUESTION fallback when LLM returns malformed JSON', async () => {
      callProvider.mockResolvedValueOnce({ content: 'I cannot classify this', usage: {} });

      const result = await classifyIntent('Plan a trip');
      expect(result.intent).toBe(INTENTS.ANSWER_QUESTION);
      expect(result.confidence).toBe(0);
    });

    it('returns ANSWER_QUESTION fallback when LLM returns unknown intent', async () => {
      mockLLMResponse({ intent: 'DO_SOMETHING_UNKNOWN', entities: {}, confidence: 0.9 });

      const result = await classifyIntent('Do something unknown');
      expect(result.intent).toBe(INTENTS.ANSWER_QUESTION);
    });

    it('returns fallback when callProvider throws', async () => {
      callProvider.mockRejectedValueOnce(new Error('Network timeout'));

      const result = await classifyIntent('Plan my trip');
      expect(result.intent).toBe(INTENTS.ANSWER_QUESTION);
      expect(result.confidence).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Entity normalisation
  // -------------------------------------------------------------------------

  describe('classifyIntent() — entity normalisation', () => {
    it('normalises non-array plan_item_texts to null', async () => {
      mockLLMResponse({
        intent: 'ADD_PLAN_ITEMS',
        entities: { plan_item_texts: 'Visit temple' }, // string, not array
        confidence: 0.8
      });

      const result = await classifyIntent('Add visit temple to my plan');
      expect(result.entities.plan_item_texts).toBeNull();
    });

    it('filters non-string entries from plan_item_texts array', async () => {
      mockLLMResponse({
        intent: 'ADD_PLAN_ITEMS',
        entities: { plan_item_texts: ['Visit temple', 42, null, 'Try ramen'] },
        confidence: 0.8
      });

      const result = await classifyIntent('Add items to my plan');
      expect(result.entities.plan_item_texts).toEqual(['Visit temple', 'Try ramen']);
    });

    it('returns null entities when entities field is missing', async () => {
      mockLLMResponse({ intent: 'ANSWER_QUESTION', confidence: 0.7 });

      const result = await classifyIntent('Hello');
      expect(result.entities.destination_name).toBeNull();
      expect(result.entities.experience_name).toBeNull();
      expect(result.entities.user_email).toBeNull();
      expect(result.entities.plan_item_texts).toBeNull();
    });
  });
});

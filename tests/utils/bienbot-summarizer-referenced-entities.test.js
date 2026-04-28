/**
 * Tests for the referenced_entities path in bienbot-session-summarizer.
 *
 * Covers:
 * - extractCandidateEntities mines entity_ref_list blocks from message history
 * - Deduplicates by _id, preserves first-seen order
 * - Summarizer validates LLM-returned referenced_entities against the candidate list
 *   (dropping hallucinated IDs that didn't appear in the conversation)
 */

jest.mock('../../utilities/ai-gateway', () => {
  const { GatewayError: ActualGatewayError } = jest.requireActual('../../utilities/ai-gateway');
  return {
    executeAIRequest: jest.fn(),
    getProviderForTask: jest.fn(),
    GatewayError: ActualGatewayError
  };
});

jest.mock('../../controllers/api/ai', () => ({
  getApiKey: jest.fn(),
  getProviderForTask: jest.fn(),
  AI_TASKS: {}
}));

const { executeAIRequest } = require('../../utilities/ai-gateway');
const { getApiKey, getProviderForTask, AI_TASKS } = require('../../controllers/api/ai');

getProviderForTask.mockReturnValue('openai');
AI_TASKS.BIENBOT_SUMMARIZE = 'bienbot_summarize';
AI_TASKS.GENERAL = 'general';

const {
  summarizeSession,
  extractCandidateEntities
} = require('../../utilities/bienbot-session-summarizer');

beforeEach(() => {
  jest.clearAllMocks();
  getApiKey.mockReturnValue('test-api-key');
});

describe('extractCandidateEntities', () => {
  it('mines entity refs from entity_ref_list blocks across messages', () => {
    const messages = [
      {
        role: 'assistant',
        content: 'Found two Casablanca plans',
        structured_content: [
          {
            type: 'entity_ref_list',
            data: {
              refs: [
                { type: 'plan', _id: '693f214a2b3c4d5e6f7a8b9c', name: 'Casablanca A' },
                { type: 'plan', _id: '693f214a2b3c4d5e6f7a8b9d', name: 'Casablanca B' }
              ]
            }
          }
        ]
      },
      {
        role: 'assistant',
        content: 'Recent activity',
        structured_content: [
          {
            type: 'entity_ref_list',
            data: {
              refs: [
                { type: 'destination', _id: '693f214a2b3c4d5e6f7a8b9e', name: 'Casablanca' }
              ]
            }
          }
        ]
      }
    ];

    const result = extractCandidateEntities(messages);
    expect(result).toHaveLength(3);
    expect(result.map(r => r._id)).toEqual([
      '693f214a2b3c4d5e6f7a8b9c',
      '693f214a2b3c4d5e6f7a8b9d',
      '693f214a2b3c4d5e6f7a8b9e'
    ]);
  });

  it('deduplicates by _id, keeping first occurrence', () => {
    const messages = [
      {
        role: 'assistant',
        structured_content: [
          { type: 'entity_ref_list', data: { refs: [{ type: 'plan', _id: 'x', name: 'A' }] } }
        ]
      },
      {
        role: 'assistant',
        structured_content: [
          { type: 'entity_ref_list', data: { refs: [{ type: 'plan', _id: 'x', name: 'A again' }] } }
        ]
      }
    ];
    const result = extractCandidateEntities(messages);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('A'); // first occurrence wins
  });

  it('returns empty array for messages without entity_ref_list blocks', () => {
    expect(extractCandidateEntities([{ role: 'user', content: 'hi' }])).toEqual([]);
    expect(extractCandidateEntities([])).toEqual([]);
    expect(extractCandidateEntities(null)).toEqual([]);
    expect(extractCandidateEntities(undefined)).toEqual([]);
  });

  it('ignores non-entity_ref_list structured_content blocks', () => {
    const messages = [
      {
        role: 'assistant',
        structured_content: [
          { type: 'photo_gallery', data: { photos: [] } },
          { type: 'suggestion_list', data: { suggestions: [] } }
        ]
      }
    ];
    expect(extractCandidateEntities(messages)).toEqual([]);
  });
});

describe('summarizeSession — referenced_entities filtering', () => {
  function buildMessages() {
    return [
      { role: 'user', content: 'Show me plans' },
      {
        role: 'assistant',
        content: 'Here they are',
        structured_content: [
          {
            type: 'entity_ref_list',
            data: {
              refs: [
                { type: 'plan', _id: '693f214a2b3c4d5e6f7a8b9c', name: 'Casablanca A' }
              ]
            }
          }
        ]
      },
      { role: 'user', content: 'Tell me about A' }
    ];
  }

  it('keeps entities whose _id appears in the candidate list', async () => {
    executeAIRequest.mockResolvedValueOnce({
      content: {
        text: 'You were focused on Casablanca A.',
        suggested_next_steps: ['Add items', 'Set date'],
        referenced_entities: [
          { type: 'plan', _id: '693f214a2b3c4d5e6f7a8b9c', name: 'Casablanca A' }
        ]
      }
    });

    const result = await summarizeSession({ messages: buildMessages() });

    expect(result.referenced_entities).toHaveLength(1);
    expect(result.referenced_entities[0]._id).toBe('693f214a2b3c4d5e6f7a8b9c');
  });

  it('drops entities whose _id is NOT in the candidate list (anti-hallucination)', async () => {
    executeAIRequest.mockResolvedValueOnce({
      content: {
        text: 'Summary here.',
        suggested_next_steps: ['Step 1'],
        referenced_entities: [
          // Hallucinated — never appeared in messages
          { type: 'plan', _id: '000000000000000000000000', name: 'Fake Plan' }
        ]
      }
    });

    const result = await summarizeSession({ messages: buildMessages() });
    expect(result.referenced_entities).toEqual([]);
  });

  it('drops entities with malformed _id', async () => {
    executeAIRequest.mockResolvedValueOnce({
      content: {
        text: 'Summary.',
        suggested_next_steps: ['Step 1'],
        referenced_entities: [
          { type: 'plan', _id: 'not-an-objectid', name: 'Bad' }
        ]
      }
    });
    const result = await summarizeSession({ messages: buildMessages() });
    expect(result.referenced_entities).toEqual([]);
  });

  it('returns empty referenced_entities when LLM omits the field', async () => {
    executeAIRequest.mockResolvedValueOnce({
      content: {
        text: 'Summary.',
        suggested_next_steps: ['Step 1']
        // No referenced_entities field
      }
    });
    const result = await summarizeSession({ messages: buildMessages() });
    expect(result.referenced_entities).toEqual([]);
  });
});

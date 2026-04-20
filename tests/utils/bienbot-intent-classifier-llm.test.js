/**
 * LLM fallback test for bienbot-intent-classifier.
 * Kept in a dedicated file so jest.doMock of ai-gateway doesn't leak into
 * sibling suites that train the real NLP.js model.
 */

afterEach(() => {
  jest.resetModules();
});

describe('classifyWithLLM', () => {
  test('returns intent + confidence + entities from schema response', async () => {
    jest.isolateModules(async () => {
      jest.doMock('../../utilities/ai-gateway', () => ({
        executeAIRequest: jest.fn().mockResolvedValue({
          content: {
            intent: 'QUERY_DESTINATION',
            confidence: 0.92,
            entities: { destination_name: 'Tokyo' }
          }
        })
      }));
      const { classifyWithLLM } = require('../../utilities/bienbot-intent-classifier').__test__;

      const result = await classifyWithLLM('tell me about tokyo', null);
      expect(result).toEqual({
        intent: 'QUERY_DESTINATION',
        confidence: 0.92,
        entities: { destination_name: 'Tokyo' }
      });
    });
  });

  test('returns null when gateway response is missing required fields', async () => {
    jest.isolateModules(async () => {
      jest.doMock('../../utilities/ai-gateway', () => ({
        executeAIRequest: jest.fn().mockResolvedValue({
          content: { confidence: 0.5 }
        })
      }));
      const { classifyWithLLM } = require('../../utilities/bienbot-intent-classifier').__test__;

      const result = await classifyWithLLM('hi', null);
      expect(result).toBeNull();
    });
  });

  test('clamps confidence to [0,1]', async () => {
    jest.isolateModules(async () => {
      jest.doMock('../../utilities/ai-gateway', () => ({
        executeAIRequest: jest.fn().mockResolvedValue({
          content: { intent: 'ANSWER_QUESTION', confidence: 1.5 }
        })
      }));
      const { classifyWithLLM } = require('../../utilities/bienbot-intent-classifier').__test__;

      const result = await classifyWithLLM('hi', null);
      expect(result.confidence).toBe(1);
      expect(result.entities).toEqual({});
    });
  });
});

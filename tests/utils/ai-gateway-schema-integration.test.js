/**
 * Integration test: executeAIRequest forwards schema option to the provider
 * registry. Kept in a dedicated file so the jest.doMock calls don't leak
 * into sibling suites that exercise the registry's real handlers.
 */

afterEach(() => {
  jest.resetModules();
});

describe('executeAIRequest with schema', () => {
  test('forwards schema to callProvider', (done) => {
    jest.isolateModules(() => {
      jest.doMock('../../models/ai-policy', () => ({
        find: () => ({ lean: async () => [] })
      }));
      jest.doMock('../../models/ai-usage', () => ({
        trackRequest: async () => null
      }));
      jest.doMock('../../utilities/ai-provider-registry', () => ({
        callProvider: jest.fn().mockResolvedValue({
          content: { intent: 'TEST', confidence: 1 },
          model: 'test-model',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          provider: 'anthropic'
        }),
        getApiKeyForProvider: () => 'test-key',
        getAllProviderConfigs: async () => new Map([
          ['anthropic', { provider: 'anthropic', enabled: true, priority: 1 }]
        ])
      }));

      const providerRegistry = require('../../utilities/ai-provider-registry');
      const gateway = require('../../utilities/ai-gateway');

      gateway.executeAIRequest({
        messages: [{ role: 'user', content: 'hi' }],
        task: 'intent_classification',
        user: null,
        schema: { name: 'test', json_schema: { type: 'object' } }
      }).then(() => {
        try {
          expect(providerRegistry.callProvider).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(Array),
            expect.objectContaining({
              schema: { name: 'test', json_schema: { type: 'object' } }
            })
          );
          done();
        } catch (err) {
          done(err);
        }
      }).catch(done);
    });
  });
});

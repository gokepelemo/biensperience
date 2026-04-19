jest.mock('../../utilities/bienbot-intent-popularity-scorer', () => ({
  getTopEntities: jest.fn(),
  getCompositionFingerprint: jest.fn(() => 'fp-123')
}));

const scorer = require('../../utilities/bienbot-intent-popularity-scorer');
const registry = require('../../utilities/bienbot-intent-entity-registry');

function makeFakeNlp() {
  return {
    addNamedEntityText: jest.fn(),
    addRegexEntity: jest.fn()
  };
}

describe('bienbot-intent-entity-registry', () => {
  beforeEach(() => jest.clearAllMocks());

  test('registers addNamedEntityText for each destination with lowercase synonym', async () => {
    scorer.getTopEntities.mockResolvedValue({
      destinations: [{ _id: 'd1', name: 'Tokyo' }],
      experiences: []
    });
    const nlp = makeFakeNlp();

    await registry.registerEntities(nlp, { kDestinations: 10, kExperiences: 10 });

    expect(nlp.addNamedEntityText).toHaveBeenCalledWith(
      'destination_name', 'Tokyo', ['en'], expect.arrayContaining(['Tokyo', 'tokyo'])
    );
  });

  test('registers addNamedEntityText for each experience', async () => {
    scorer.getTopEntities.mockResolvedValue({
      destinations: [],
      experiences: [{ _id: 'e1', name: 'Cherry Blossom Tour' }]
    });
    const nlp = makeFakeNlp();

    await registry.registerEntities(nlp, { kDestinations: 10, kExperiences: 10 });

    expect(nlp.addNamedEntityText).toHaveBeenCalledWith(
      'experience_name', 'Cherry Blossom Tour', ['en'],
      expect.arrayContaining(['Cherry Blossom Tour', 'cherry blossom tour'])
    );
  });

  test('registers regex fallback for destination and experience', async () => {
    scorer.getTopEntities.mockResolvedValue({ destinations: [], experiences: [] });
    const nlp = makeFakeNlp();

    await registry.registerEntities(nlp, { kDestinations: 10, kExperiences: 10 });

    const entityNames = nlp.addRegexEntity.mock.calls.map(c => c[0]);
    expect(entityNames).toEqual(expect.arrayContaining(['destination_name', 'experience_name', 'user_email']));
  });

  test('returns fingerprint and counts', async () => {
    scorer.getTopEntities.mockResolvedValue({
      destinations: [{ _id: 'd1', name: 'Tokyo' }],
      experiences: [{ _id: 'e1', name: 'Tour' }]
    });
    const nlp = makeFakeNlp();

    const result = await registry.registerEntities(nlp, { kDestinations: 10, kExperiences: 10 });

    expect(result).toEqual({
      destinationCount: 1,
      experienceCount: 1,
      fingerprint: 'fp-123'
    });
  });
});

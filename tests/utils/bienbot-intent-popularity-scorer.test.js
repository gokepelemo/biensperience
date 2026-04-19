jest.mock('../../models/plan', () => ({ aggregate: jest.fn() }));
jest.mock('../../models/experience', () => ({ aggregate: jest.fn() }));
jest.mock('../../models/destination', () => ({ find: jest.fn() }));
jest.mock('../../models/activity', () => ({ aggregate: jest.fn() }));
jest.mock('../../models/user', () => ({ aggregate: jest.fn() }));

const Plan = require('../../models/plan');
const Experience = require('../../models/experience');
const Destination = require('../../models/destination');
const Activity = require('../../models/activity');
const User = require('../../models/user');
const scorer = require('../../utilities/bienbot-intent-popularity-scorer');

describe('bienbot-intent-popularity-scorer', () => {
  beforeEach(() => jest.clearAllMocks());

  test('composite score is plans*3 + activity*1 + favorites*1', async () => {
    Plan.aggregate.mockResolvedValue([
      { _id: 'exp1', plan_count: 10, destination: 'dest1' },
      { _id: 'exp2', plan_count: 5,  destination: 'dest2' }
    ]);
    Experience.aggregate.mockResolvedValue([
      { _id: 'exp1', name: 'Cherry Blossom Tour', destination: 'dest1' },
      { _id: 'exp2', name: 'Food Crawl',          destination: 'dest2' }
    ]);
    Destination.find.mockReturnValue({
      lean: () => Promise.resolve([
        { _id: 'dest1', name: 'Tokyo' },
        { _id: 'dest2', name: 'Paris' }
      ])
    });
    Activity.aggregate.mockResolvedValue([
      { _id: { entity_type: 'destination', entity_id: 'dest1' }, count: 4 },
      { _id: { entity_type: 'experience',  entity_id: 'exp1'  }, count: 2 }
    ]);
    User.aggregate.mockResolvedValue([
      { _id: 'dest1', count: 7 }
    ]);

    const { destinations, experiences } = await scorer.getTopEntities({
      kDestinations: 10,
      kExperiences: 10
    });

    const tokyo = destinations.find(d => d._id === 'dest1');
    // plans=10*3 + activity=4 + favorites=7 = 41
    expect(tokyo.score).toBe(41);

    const cherry = experiences.find(e => e._id === 'exp1');
    // plans=10*3 + activity=2 = 32
    expect(cherry.score).toBe(32);
  });

  test('caps results at K', async () => {
    const many = Array.from({ length: 50 }, (_, i) => ({
      _id: `exp${i}`, plan_count: 50 - i, destination: `dest${i}`
    }));
    Plan.aggregate.mockResolvedValue(many);
    Experience.aggregate.mockResolvedValue(many.map(m => ({ _id: m._id, name: `Exp${m._id}`, destination: m.destination })));
    Destination.find.mockReturnValue({ lean: () => Promise.resolve([]) });
    Activity.aggregate.mockResolvedValue([]);
    User.aggregate.mockResolvedValue([]);

    const { experiences } = await scorer.getTopEntities({ kDestinations: 0, kExperiences: 5 });
    expect(experiences).toHaveLength(5);
    expect(experiences[0]._id).toBe('exp0'); // highest score
  });
});

describe('getCompositionFingerprint', () => {
  const { getCompositionFingerprint } = require('../../utilities/bienbot-intent-popularity-scorer');

  test('stable across key order', () => {
    const a = getCompositionFingerprint({
      destinations: [{ _id: 'a' }, { _id: 'b' }],
      experiences:  [{ _id: 'x' }]
    });
    const b = getCompositionFingerprint({
      destinations: [{ _id: 'b' }, { _id: 'a' }],
      experiences:  [{ _id: 'x' }]
    });
    expect(a).toBe(b);
  });

  test('differs when composition differs', () => {
    const a = getCompositionFingerprint({ destinations: [{ _id: 'a' }], experiences: [] });
    const b = getCompositionFingerprint({ destinations: [{ _id: 'b' }], experiences: [] });
    expect(a).not.toBe(b);
  });
});

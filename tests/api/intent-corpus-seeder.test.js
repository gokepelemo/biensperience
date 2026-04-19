jest.mock('../../utilities/bienbot-intent-corpus.json', () => ({
  version: 'v2',
  data: [
    { intent: 'TEST_INTENT', utterances: ['plan %destination_name%'] }
  ]
}), { virtual: false });

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const IntentCorpus = require('../../models/intent-corpus');
const { seedIntentCorpus } = require('../../utilities/intent-corpus-seeder');

describe('intent-corpus-seeder version migration', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  beforeEach(async () => {
    await IntentCorpus.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  test('overwrites non-custom v1 entry with v2 content', async () => {
    await IntentCorpus.create({
      intent: 'TEST_INTENT',
      utterances: ['plan Tokyo'],
      is_custom: false,
      corpus_version: 'v1'
    });

    await seedIntentCorpus();

    const after = await IntentCorpus.findOne({ intent: 'TEST_INTENT' });
    expect(after.corpus_version).toBe('v2');
    expect(after.utterances).toContain('plan %destination_name%');
    expect(after.utterances).not.toContain('plan Tokyo');
  });

  test('preserves is_custom entries regardless of version', async () => {
    await IntentCorpus.create({
      intent: 'TEST_INTENT',
      utterances: ['custom user utterance'],
      is_custom: true,
      corpus_version: 'v1'
    });

    await seedIntentCorpus();

    const after = await IntentCorpus.findOne({ intent: 'TEST_INTENT', is_custom: true });
    expect(after.utterances).toEqual(['custom user utterance']);
    expect(after.corpus_version).toBe('v1');
  });
});

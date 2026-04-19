const IntentCorpus = require('../../models/intent-corpus');

describe('IntentCorpus model', () => {
  test('defines corpus_version field with default "v1"', () => {
    const doc = new IntentCorpus({ intent: 'TEST', utterances: ['hello'] });
    expect(doc.corpus_version).toBe('v1');
  });

  test('corpus_version accepts v2', () => {
    const doc = new IntentCorpus({
      intent: 'TEST_V2',
      utterances: ['hello %destination_name%'],
      corpus_version: 'v2'
    });
    expect(doc.corpus_version).toBe('v2');
  });
});

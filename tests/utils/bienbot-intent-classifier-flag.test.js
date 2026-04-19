describe('isSlotFillEnabled', () => {
  const originalEnv = process.env.NLP_SLOT_FILL_V2;
  afterEach(() => {
    if (originalEnv === undefined) delete process.env.NLP_SLOT_FILL_V2;
    else process.env.NLP_SLOT_FILL_V2 = originalEnv;
    jest.resetModules();
  });

  test('returns true when env is "true"', async () => {
    process.env.NLP_SLOT_FILL_V2 = 'true';
    const mod = require('../../utilities/bienbot-intent-classifier');
    expect(await mod.__test__.isSlotFillEnabled()).toBe(true);
  });

  test('returns false when env is "false"', async () => {
    process.env.NLP_SLOT_FILL_V2 = 'false';
    jest.resetModules();
    const mod = require('../../utilities/bienbot-intent-classifier');
    expect(await mod.__test__.isSlotFillEnabled()).toBe(false);
  });
});

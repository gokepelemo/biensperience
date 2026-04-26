const { createProviderContext } = require('../../utilities/bienbot-tool-registry/provider-context');

describe('createProviderContext', () => {
  let mockFetch;
  beforeEach(() => {
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });
  afterEach(() => { delete global.fetch; });

  const provider = {
    name: 'test',
    baseUrl: 'https://api.test',
    envKey: 'TEST_KEY',
    retryPolicy: { maxRetries: 2, baseDelayMs: 10, timeoutMs: 100 },
    budgetPerHour: 60
  };

  it('joins baseUrl + path correctly', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ x: 1 }) });
    const ctx = createProviderContext(provider, {});
    await ctx.httpRequest('/foo');
    expect(mockFetch).toHaveBeenCalledWith('https://api.test/foo', expect.any(Object));
  });

  it('handles trailing slash on baseUrl and leading slash on path', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    const p = { ...provider, baseUrl: 'https://api.test/' };
    const ctx = createProviderContext(p, {});
    await ctx.httpRequest('/foo');
    expect(mockFetch).toHaveBeenCalledWith('https://api.test/foo', expect.any(Object));
  });

  it('retries on transient failure up to maxRetries', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('boom'))
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) });
    const ctx = createProviderContext(provider, {});
    const result = await ctx.httpRequest('/foo');
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(result.body).toEqual({ ok: true });
  });

  it('returns null after maxRetries+1 failures', async () => {
    mockFetch.mockRejectedValue(new Error('boom'));
    const ctx = createProviderContext(provider, {});
    const result = await ctx.httpRequest('/foo');
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(result).toBeNull();
  });

  it('aborts when external signal triggers', async () => {
    const controller = new AbortController();
    mockFetch.mockImplementation((url, opts) => new Promise((_, reject) => {
      opts.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }));
    setTimeout(() => controller.abort(), 5);
    const ctx = createProviderContext(provider, { abortSignal: controller.signal });
    const result = await ctx.httpRequest('/foo');
    expect(result).toBeNull();
  });

  it('returns parsed JSON body and status', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 201, json: async () => ({ value: 42 }) });
    const ctx = createProviderContext(provider, {});
    const result = await ctx.httpRequest('/foo');
    expect(result.status).toBe(201);
    expect(result.body).toEqual({ value: 42 });
  });

  it('exposes the resolved env key', () => {
    process.env.TEST_KEY = 'secret-value';
    const ctx = createProviderContext(provider, {});
    expect(ctx.envKey).toBe('secret-value');
    delete process.env.TEST_KEY;
  });

  it('exposes a logger tagged with provider name', () => {
    const ctx = createProviderContext(provider, {});
    expect(ctx.logger).toBeDefined();
    expect(typeof ctx.logger.info).toBe('function');
  });
});

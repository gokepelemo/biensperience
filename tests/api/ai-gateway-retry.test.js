/**
 * Tests for AI Gateway retry logic with exponential backoff and jitter.
 *
 * @see utilities/ai-gateway.js
 */

const {
  callWithRetry,
  isRetryableError,
  calculateRetryDelay,
  DEFAULT_RETRY_CONFIG
} = require('../../utilities/ai-gateway');

// ---------------------------------------------------------------------------
// isRetryableError
// ---------------------------------------------------------------------------

describe('isRetryableError', () => {
  it('returns true for 429 status code (rate limit)', () => {
    const err = new Error('Too Many Requests');
    err.statusCode = 429;
    expect(isRetryableError(err)).toBe(true);
  });

  it('returns true for 500 status code', () => {
    const err = new Error('Internal Server Error');
    err.statusCode = 500;
    expect(isRetryableError(err)).toBe(true);
  });

  it('returns true for 502 status code', () => {
    const err = new Error('Bad Gateway');
    err.statusCode = 502;
    expect(isRetryableError(err)).toBe(true);
  });

  it('returns true for 503 status code', () => {
    const err = new Error('Service Unavailable');
    err.statusCode = 503;
    expect(isRetryableError(err)).toBe(true);
  });

  it('returns true for 504 status code', () => {
    const err = new Error('Gateway Timeout');
    err.statusCode = 504;
    expect(isRetryableError(err)).toBe(true);
  });

  it('returns true for 408 status code (timeout)', () => {
    const err = new Error('Request Timeout');
    err.statusCode = 408;
    expect(isRetryableError(err)).toBe(true);
  });

  it('returns true for status on .status property', () => {
    const err = new Error('Error');
    err.status = 503;
    expect(isRetryableError(err)).toBe(true);
  });

  it('returns false for 400 status code (client error)', () => {
    const err = new Error('Bad Request');
    err.statusCode = 400;
    expect(isRetryableError(err)).toBe(false);
  });

  it('returns false for 401 status code (auth error)', () => {
    const err = new Error('Unauthorized');
    err.statusCode = 401;
    expect(isRetryableError(err)).toBe(false);
  });

  it('returns false for 403 status code (forbidden)', () => {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    expect(isRetryableError(err)).toBe(false);
  });

  it('returns false for 404 status code', () => {
    const err = new Error('Not Found');
    err.statusCode = 404;
    expect(isRetryableError(err)).toBe(false);
  });

  // Message-based pattern matching
  it('returns true for "rate limit" in message', () => {
    expect(isRetryableError(new Error('Rate limit exceeded'))).toBe(true);
  });

  it('returns true for "timeout" in message', () => {
    expect(isRetryableError(new Error('Request timeout'))).toBe(true);
  });

  it('returns true for "timed out" in message', () => {
    expect(isRetryableError(new Error('Connection timed out'))).toBe(true);
  });

  it('returns true for ETIMEDOUT', () => {
    expect(isRetryableError(new Error('connect ETIMEDOUT'))).toBe(true);
  });

  it('returns true for ECONNRESET', () => {
    expect(isRetryableError(new Error('read ECONNRESET'))).toBe(true);
  });

  it('returns true for ECONNREFUSED', () => {
    expect(isRetryableError(new Error('connect ECONNREFUSED'))).toBe(true);
  });

  it('returns true for "socket hang up"', () => {
    expect(isRetryableError(new Error('socket hang up'))).toBe(true);
  });

  it('returns true for "too many requests" in message', () => {
    expect(isRetryableError(new Error('Too many requests, please slow down'))).toBe(true);
  });

  it('returns true for "service unavailable" in message', () => {
    expect(isRetryableError(new Error('The service is temporarily unavailable'))).toBe(true);
  });

  it('returns true for "overloaded" in message', () => {
    expect(isRetryableError(new Error('Model is currently overloaded'))).toBe(true);
  });

  it('returns false for non-retryable error messages', () => {
    expect(isRetryableError(new Error('Invalid API key'))).toBe(false);
    expect(isRetryableError(new Error('Content policy violation'))).toBe(false);
    expect(isRetryableError(new Error('Unknown model: gpt-999'))).toBe(false);
  });

  it('returns false for error with no message', () => {
    expect(isRetryableError(new Error())).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// calculateRetryDelay
// ---------------------------------------------------------------------------

describe('calculateRetryDelay', () => {
  it('returns a delay within expected bounds for attempt 0', () => {
    const delay = calculateRetryDelay(0, 1000, 30000);
    // For attempt 0: max = min(30000, 1000 * 2^0) = 1000
    // Jitter: random [0, 1000)
    expect(delay).toBeGreaterThanOrEqual(0);
    expect(delay).toBeLessThanOrEqual(1000);
  });

  it('returns a delay within expected bounds for attempt 1', () => {
    const delay = calculateRetryDelay(1, 1000, 30000);
    // For attempt 1: max = min(30000, 1000 * 2^1) = 2000
    expect(delay).toBeGreaterThanOrEqual(0);
    expect(delay).toBeLessThanOrEqual(2000);
  });

  it('returns a delay within expected bounds for attempt 2', () => {
    const delay = calculateRetryDelay(2, 1000, 30000);
    // For attempt 2: max = min(30000, 1000 * 2^2) = 4000
    expect(delay).toBeGreaterThanOrEqual(0);
    expect(delay).toBeLessThanOrEqual(4000);
  });

  it('caps delay at maxDelayMs', () => {
    const delay = calculateRetryDelay(10, 1000, 5000);
    // 1000 * 2^10 = 1024000, but capped at 5000
    expect(delay).toBeGreaterThanOrEqual(0);
    expect(delay).toBeLessThanOrEqual(5000);
  });

  it('returns 0 when baseDelayMs is 0', () => {
    const delay = calculateRetryDelay(5, 0, 30000);
    expect(delay).toBe(0);
  });

  it('produces varied delays (jitter)', () => {
    // Run multiple times and ensure not all results are identical
    const delays = new Set();
    for (let i = 0; i < 20; i++) {
      delays.add(calculateRetryDelay(2, 1000, 30000));
    }
    // With jitter, we should get at least a few different values
    expect(delays.size).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_RETRY_CONFIG
// ---------------------------------------------------------------------------

describe('DEFAULT_RETRY_CONFIG', () => {
  it('has sensible defaults', () => {
    expect(DEFAULT_RETRY_CONFIG.maxRetries).toBe(3);
    expect(DEFAULT_RETRY_CONFIG.baseDelayMs).toBe(1000);
    expect(DEFAULT_RETRY_CONFIG.maxDelayMs).toBe(30000);
  });
});

// ---------------------------------------------------------------------------
// callWithRetry
// ---------------------------------------------------------------------------

describe('callWithRetry', () => {
  // Use minimal delays to keep tests fast
  const fastConfig = { maxRetries: 3, baseDelayMs: 1, maxDelayMs: 10 };

  it('returns result on first success', async () => {
    const callFn = jest.fn().mockResolvedValue({ content: 'hello' });

    const result = await callWithRetry(callFn, fastConfig);

    expect(result).toEqual({ content: 'hello' });
    expect(callFn).toHaveBeenCalledTimes(1);
  });

  it('retries on transient error and succeeds', async () => {
    const transientError = new Error('Service Unavailable');
    transientError.statusCode = 503;

    const callFn = jest.fn()
      .mockRejectedValueOnce(transientError)
      .mockRejectedValueOnce(transientError)
      .mockResolvedValue({ content: 'recovered' });

    const result = await callWithRetry(callFn, fastConfig);

    expect(result).toEqual({ content: 'recovered' });
    expect(callFn).toHaveBeenCalledTimes(3);
  });

  it('throws immediately on non-retryable error', async () => {
    const authError = new Error('Invalid API key');
    authError.statusCode = 401;

    const callFn = jest.fn().mockRejectedValue(authError);

    await expect(callWithRetry(callFn, fastConfig)).rejects.toThrow('Invalid API key');
    expect(callFn).toHaveBeenCalledTimes(1);
  });

  it('throws after exhausting all retries', async () => {
    const transientError = new Error('Gateway Timeout');
    transientError.statusCode = 504;

    const callFn = jest.fn().mockRejectedValue(transientError);

    await expect(callWithRetry(callFn, fastConfig)).rejects.toThrow('Gateway Timeout');
    // 1 initial + 3 retries = 4 total calls
    expect(callFn).toHaveBeenCalledTimes(4);
  });

  it('retries on rate limit message without status code', async () => {
    const rateLimitError = new Error('Rate limit exceeded, please try again');

    const callFn = jest.fn()
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValue({ content: 'ok' });

    const result = await callWithRetry(callFn, fastConfig);

    expect(result).toEqual({ content: 'ok' });
    expect(callFn).toHaveBeenCalledTimes(2);
  });

  it('retries on connection errors (ECONNRESET)', async () => {
    const connError = new Error('read ECONNRESET');

    const callFn = jest.fn()
      .mockRejectedValueOnce(connError)
      .mockResolvedValue({ content: 'reconnected' });

    const result = await callWithRetry(callFn, fastConfig);

    expect(result).toEqual({ content: 'reconnected' });
    expect(callFn).toHaveBeenCalledTimes(2);
  });

  it('respects maxRetries=0 (no retries)', async () => {
    const transientError = new Error('Service Unavailable');
    transientError.statusCode = 503;

    const callFn = jest.fn().mockRejectedValue(transientError);
    const noRetryConfig = { maxRetries: 0, baseDelayMs: 1, maxDelayMs: 10 };

    await expect(callWithRetry(callFn, noRetryConfig)).rejects.toThrow('Service Unavailable');
    expect(callFn).toHaveBeenCalledTimes(1);
  });

  it('respects custom maxRetries', async () => {
    const transientError = new Error('Bad Gateway');
    transientError.statusCode = 502;

    const callFn = jest.fn().mockRejectedValue(transientError);
    const customConfig = { maxRetries: 1, baseDelayMs: 1, maxDelayMs: 10 };

    await expect(callWithRetry(callFn, customConfig)).rejects.toThrow('Bad Gateway');
    // 1 initial + 1 retry = 2 total
    expect(callFn).toHaveBeenCalledTimes(2);
  });

  it('uses default config when no retryConfig provided', async () => {
    const callFn = jest.fn().mockResolvedValue({ content: 'ok' });

    const result = await callWithRetry(callFn);

    expect(result).toEqual({ content: 'ok' });
    expect(callFn).toHaveBeenCalledTimes(1);
  });

  it('passes through the last error when all retries fail', async () => {
    const errors = [
      Object.assign(new Error('Error 1'), { statusCode: 503 }),
      Object.assign(new Error('Error 2'), { statusCode: 503 }),
      Object.assign(new Error('Error 3'), { statusCode: 503 }),
      Object.assign(new Error('Error 4 (final)'), { statusCode: 503 })
    ];

    let callCount = 0;
    const callFn = jest.fn(() => {
      return Promise.reject(errors[callCount++]);
    });

    await expect(callWithRetry(callFn, fastConfig)).rejects.toThrow('Error 4 (final)');
  });

  it('handles mixed transient then non-retryable error', async () => {
    const transientError = new Error('Temporarily unavailable');
    transientError.statusCode = 503;
    const authError = new Error('API key expired');
    authError.statusCode = 401;

    const callFn = jest.fn()
      .mockRejectedValueOnce(transientError)
      .mockRejectedValueOnce(authError);

    // Should stop at the non-retryable error (auth)
    await expect(callWithRetry(callFn, fastConfig)).rejects.toThrow('API key expired');
    expect(callFn).toHaveBeenCalledTimes(2);
  });

  it('retries on "overloaded" model error', async () => {
    const overloadedError = new Error('Model is currently overloaded. Please try again later.');

    const callFn = jest.fn()
      .mockRejectedValueOnce(overloadedError)
      .mockResolvedValue({ content: 'finally' });

    const result = await callWithRetry(callFn, fastConfig);

    expect(result).toEqual({ content: 'finally' });
    expect(callFn).toHaveBeenCalledTimes(2);
  });
});

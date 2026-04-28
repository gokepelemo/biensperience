const { APIError, isSafeToExpose } = require('../../utilities/api-error');

describe('APIError', () => {
  it('captures message, status, code, and isOperational', () => {
    const err = new APIError('Plan not found', 404, 'RESOURCE_NOT_FOUND');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('Plan not found');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('RESOURCE_NOT_FOUND');
    expect(err.isOperational).toBe(true);
    expect(err.name).toBe('APIError');
  });

  it('defaults statusCode to 500 and omits code when not given', () => {
    const err = new APIError('Boom');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBeUndefined();
    expect(err.isOperational).toBe(true);
  });

  it('captures a stack trace', () => {
    const err = new APIError('x', 400);
    expect(typeof err.stack).toBe('string');
    expect(err.stack).toContain('APIError');
  });
});

describe('isSafeToExpose', () => {
  it('returns true for APIError instances', () => {
    expect(isSafeToExpose(new APIError('safe', 500))).toBe(true);
  });

  it('returns true for plain errors marked isOperational', () => {
    const e = new Error('safe');
    e.isOperational = true;
    expect(isSafeToExpose(e)).toBe(true);
  });

  it('returns true for 4xx plain errors (validator-thrown)', () => {
    const e = new Error('bad input');
    e.statusCode = 400;
    expect(isSafeToExpose(e)).toBe(true);
    e.statusCode = 422;
    expect(isSafeToExpose(e)).toBe(true);
  });

  it('returns false for 5xx plain errors', () => {
    const e = new Error('mongo connection refused');
    e.statusCode = 500;
    expect(isSafeToExpose(e)).toBe(false);
  });

  it('returns false for plain errors without status or marker', () => {
    expect(isSafeToExpose(new Error('mystery'))).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isSafeToExpose(null)).toBe(false);
    expect(isSafeToExpose(undefined)).toBe(false);
  });

  it('honours `status` (not just `statusCode`) for 4xx', () => {
    const e = new Error('not found');
    e.status = 404;
    expect(isSafeToExpose(e)).toBe(true);
  });
});

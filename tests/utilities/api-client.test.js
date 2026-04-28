/**
 * Tests for the shared sendApi client and ApiError class.
 *
 * Run with:
 *   NODE_ENV=test bunx jest tests/utilities/api-client.test.js
 */

// Mock send-request before importing api-client.
jest.mock('../../src/utilities/send-request.js', () => ({
  sendRequest: jest.fn()
}));

// Mock logger to capture error logging without polluting output.
jest.mock('../../src/utilities/logger.js', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn()
  }
}));

const { sendRequest } = require('../../src/utilities/send-request.js');
const { logger } = require('../../src/utilities/logger.js');
const { sendApi, sendApiWithMeta, ApiError } = require('../../src/utilities/api-client.js');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ApiError', () => {
  it('extends Error and carries statusCode, code, message, requestId, body', () => {
    const err = new ApiError({
      statusCode: 422,
      code: 'VALIDATION_ERROR',
      message: 'Invalid input',
      requestId: 'req-abc-123',
      body: { success: false, error: 'Invalid input' }
    });

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.name).toBe('ApiError');
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('Invalid input');
    expect(err.requestId).toBe('req-abc-123');
    expect(err.body).toEqual({ success: false, error: 'Invalid input' });
  });

  it('provides safe defaults when no fields are passed', () => {
    const err = new ApiError({});
    expect(err.statusCode).toBe(0);
    expect(err.code).toBeNull();
    expect(err.message).toBe('API request failed');
    expect(err.requestId).toBeNull();
    expect(err.body).toBeNull();
  });
});

describe('sendApi success unwrap', () => {
  it('returns envelope.data on 2xx with { success: true, data }', async () => {
    sendRequest.mockResolvedValue({
      success: true,
      data: { _id: 'user_1', name: 'Alice' }
    });

    const result = await sendApi('GET', '/api/users/user_1');

    expect(result).toEqual({ _id: 'user_1', name: 'Alice' });
    expect(sendRequest).toHaveBeenCalledWith('/api/users/user_1', 'GET', null, {});
  });

  it('forwards method, path, body, and options to sendRequest', async () => {
    sendRequest.mockResolvedValue({ success: true, data: { ok: true } });

    await sendApi('POST', '/api/things', { foo: 'bar' }, { priority: 5, label: 'mytest' });

    expect(sendRequest).toHaveBeenCalledWith(
      '/api/things',
      'POST',
      { foo: 'bar' },
      { priority: 5, label: 'mytest' }
    );
  });

  it('returns the bare response when no envelope is present (legacy compat)', async () => {
    const bare = [{ _id: 'a' }, { _id: 'b' }];
    sendRequest.mockResolvedValue(bare);

    const result = await sendApi('GET', '/api/legacy');

    expect(result).toBe(bare);
  });

  it('returns the full envelope when unwrap=false', async () => {
    sendRequest.mockResolvedValue({
      success: true,
      data: [1, 2, 3],
      meta: { page: 1, total: 3 }
    });

    const result = await sendApi('GET', '/api/things', null, { unwrap: false });

    expect(result).toEqual({
      success: true,
      data: [1, 2, 3],
      meta: { page: 1, total: 3 }
    });
  });

  it('returns undefined data when envelope has success but no data field', async () => {
    sendRequest.mockResolvedValue({ success: true });

    const result = await sendApi('DELETE', '/api/things/abc');

    expect(result).toBeUndefined();
  });
});

describe('sendApi error handling', () => {
  function buildSendRequestError({ status, body, message }) {
    const err = new Error(message || 'Request failed');
    err.response = {
      status,
      statusText: 'Error',
      data: body
    };
    return err;
  }

  it('throws ApiError with statusCode + code + message + requestId on 4xx', async () => {
    sendRequest.mockRejectedValue(buildSendRequestError({
      status: 422,
      body: {
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        requestId: 'req-422-x'
      },
      message: 'Validation failed'
    }));

    await expect(sendApi('POST', '/api/things', { bad: true })).rejects.toMatchObject({
      name: 'ApiError',
      statusCode: 422,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      requestId: 'req-422-x'
    });

    // 4xx logs at warn level.
    expect(logger.warn).toHaveBeenCalledWith(
      '[api-client] Request failed',
      expect.objectContaining({
        method: 'POST',
        path: '/api/things',
        statusCode: 422,
        code: 'VALIDATION_ERROR',
        requestId: 'req-422-x'
      })
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('throws ApiError populated from structured error object (error: { code, userMessage })', async () => {
    sendRequest.mockRejectedValue(buildSendRequestError({
      status: 403,
      body: {
        success: false,
        error: {
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Verify your email',
          userMessage: 'Please verify your email to continue'
        },
        requestId: 'req-403-x'
      },
      message: 'Please verify your email to continue'
    }));

    const promise = sendApi('POST', '/api/something');
    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({
      statusCode: 403,
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Please verify your email to continue',
      requestId: 'req-403-x'
    });
  });

  it('throws ApiError with requestId logged at error level on 5xx', async () => {
    sendRequest.mockRejectedValue(buildSendRequestError({
      status: 500,
      body: {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        requestId: 'req-500-zzz'
      },
      message: 'Internal server error'
    }));

    await expect(sendApi('GET', '/api/boom')).rejects.toMatchObject({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      requestId: 'req-500-zzz'
    });

    expect(logger.error).toHaveBeenCalledWith(
      '[api-client] Request failed',
      expect.objectContaining({
        method: 'GET',
        path: '/api/boom',
        statusCode: 500,
        requestId: 'req-500-zzz'
      })
    );
  });

  it('throws ApiError with statusCode 0 for transport/network failures', async () => {
    // sendRequest throws with no .response attached (e.g. fetch failure normalized).
    sendRequest.mockRejectedValue(new Error('Network error. Please check your connection and try again.'));

    await expect(sendApi('GET', '/api/anything')).rejects.toMatchObject({
      name: 'ApiError',
      statusCode: 0,
      code: null,
      requestId: null,
      message: 'Network error. Please check your connection and try again.'
    });

    // Network errors are logged at error level (statusCode 0 is treated like 5xx).
    expect(logger.error).toHaveBeenCalledWith(
      '[api-client] Request failed',
      expect.objectContaining({
        statusCode: 0,
        message: 'Network error. Please check your connection and try again.'
      })
    );
  });

  it('passes through an ApiError thrown by sendRequest unchanged', async () => {
    const original = new ApiError({
      statusCode: 418,
      code: 'IM_A_TEAPOT',
      message: 'short and stout',
      requestId: 'req-418'
    });
    sendRequest.mockRejectedValue(original);

    await expect(sendApi('GET', '/api/teapot')).rejects.toBe(original);
  });
});

describe('sendApiWithMeta', () => {
  it('returns { data, meta } from a paginated envelope', async () => {
    sendRequest.mockResolvedValue({
      success: true,
      data: [{ id: 1 }, { id: 2 }],
      meta: { page: 1, limit: 50, total: 2 }
    });

    const result = await sendApiWithMeta('GET', '/api/things');

    expect(result).toEqual({
      data: [{ id: 1 }, { id: 2 }],
      meta: { page: 1, limit: 50, total: 2 }
    });
  });

  it('returns { data, meta: undefined } for legacy bare responses', async () => {
    const bare = [{ id: 1 }];
    sendRequest.mockResolvedValue(bare);

    const result = await sendApiWithMeta('GET', '/api/legacy');

    expect(result).toEqual({ data: bare, meta: undefined });
  });

  it('propagates ApiError on failure', async () => {
    const err = new Error('Boom');
    err.response = {
      status: 500,
      statusText: 'Server Error',
      data: { success: false, error: 'Boom', requestId: 'r1' }
    };
    sendRequest.mockRejectedValue(err);

    await expect(sendApiWithMeta('GET', '/api/boom')).rejects.toBeInstanceOf(ApiError);
  });
});

/**
 * Tests for useFormErrorHandling hook
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { useFormErrorHandling } from '../useFormErrorHandling';
import { handleError } from '../../utilities/error-handler';

jest.mock('../../utilities/error-handler');

describe('useFormErrorHandling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    handleError.mockReturnValue('Generic error message');
  });

  it('should handle email not verified error', () => {
    const setError = jest.fn();
    const onEmailNotVerified = jest.fn();

    const { result } = renderHook(() =>
      useFormErrorHandling(setError, { onEmailNotVerified })
    );

    const error = {
      response: {
        data: {
          code: 'EMAIL_NOT_VERIFIED',
          error: 'Please verify your email'
        }
      }
    };

    act(() => {
      result.current(error);
    });

    expect(setError).toHaveBeenCalledWith('Please verify your email');
    expect(onEmailNotVerified).toHaveBeenCalledWith(error.response.data);
  });

  it('should handle duplicate error', () => {
    const setError = jest.fn();
    const onDuplicateError = jest.fn();

    const { result } = renderHook(() =>
      useFormErrorHandling(setError, { onDuplicateError })
    );

    const error = {
      message: 'Destination already exists',
      response: { status: 409 }
    };

    act(() => {
      result.current(error);
    });

    expect(setError).toHaveBeenCalledWith('Destination already exists');
    expect(onDuplicateError).toHaveBeenCalledWith(error);
  });

  it('should handle validation error (400)', () => {
    const setError = jest.fn();
    const onValidationError = jest.fn();

    const { result } = renderHook(() =>
      useFormErrorHandling(setError, { onValidationError })
    );

    const error = {
      response: {
        status: 400,
        data: {
          error: 'Name is required'
        }
      }
    };

    act(() => {
      result.current(error);
    });

    expect(setError).toHaveBeenCalledWith('Name is required');
    expect(onValidationError).toHaveBeenCalledWith(error.response.data);
  });

  it('should handle generic error', () => {
    const setError = jest.fn();

    const { result } = renderHook(() =>
      useFormErrorHandling(setError)
    );

    const error = new Error('Network error');

    act(() => {
      result.current(error, { context: 'test' });
    });

    expect(handleError).toHaveBeenCalledWith(error, { context: 'test' });
    expect(setError).toHaveBeenCalledWith('Generic error message');
  });

  it('should handle error without callbacks', () => {
    const setError = jest.fn();

    const { result } = renderHook(() =>
      useFormErrorHandling(setError)
    );

    const error = {
      response: {
        data: {
          code: 'EMAIL_NOT_VERIFIED',
          error: 'Please verify your email'
        }
      }
    };

    act(() => {
      result.current(error);
    });

    expect(setError).toHaveBeenCalledWith('Please verify your email');
  });

  it('should use default message for email not verified', () => {
    const setError = jest.fn();

    const { result } = renderHook(() =>
      useFormErrorHandling(setError)
    );

    const error = {
      response: {
        data: {
          code: 'EMAIL_NOT_VERIFIED'
        }
      }
    };

    act(() => {
      result.current(error);
    });

    expect(setError).toHaveBeenCalledWith('Please verify your email before creating content.');
  });

  it('should handle 409 status without message', () => {
    const setError = jest.fn();

    const { result } = renderHook(() =>
      useFormErrorHandling(setError)
    );

    const error = {
      response: { status: 409 }
    };

    act(() => {
      result.current(error);
    });

    expect(setError).toHaveBeenCalledWith('This entry already exists.');
  });
});

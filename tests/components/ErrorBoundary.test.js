/**
 * Tests for ErrorBoundary component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary, { withErrorBoundary } from '../../src/components/ErrorBoundary/ErrorBoundary';

// Component that throws an error
const ThrowError = ({ shouldThrow = true }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

// Suppress console.error for these tests
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  console.error.mockRestore();
});

describe('ErrorBoundary', () => {
  it('should render children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('should catch errors and display fallback UI', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Oops! Something went wrong/)).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
    expect(screen.getByText('Reload Page')).toBeInTheDocument();
  });

  it('should display custom title and message', () => {
    render(
      <ErrorBoundary
        title="Custom Error"
        message="Custom error message"
      >
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom Error')).toBeInTheDocument();
    expect(screen.getByText('Custom error message')).toBeInTheDocument();
  });

  it('should show home button when showHomeButton is true', () => {
    render(
      <ErrorBoundary showHomeButton={true}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Go Home')).toBeInTheDocument();
  });

  it('should not show home button by default', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.queryByText('Go Home')).not.toBeInTheDocument();
  });

  it('should reset error state on "Try Again" click', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Oops! Something went wrong/)).toBeInTheDocument();

    const tryAgainButton = screen.getByText('Try Again');
    fireEvent.click(tryAgainButton);

    // After reset, error boundary should try to render children again
    // But our component will throw again, so fallback should still show
    expect(screen.getByText(/Oops! Something went wrong/)).toBeInTheDocument();
  });

  it('should call onError callback when error is caught', () => {
    const onError = jest.fn();

    render(
      <ErrorBoundary onError={onError}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) })
    );
  });

  it('should call onReset callback when reset button clicked', () => {
    const onReset = jest.fn();

    render(
      <ErrorBoundary onReset={onReset}>
        <ThrowError />
      </ErrorBoundary>
    );

    const tryAgainButton = screen.getByText('Try Again');
    fireEvent.click(tryAgainButton);

    expect(onReset).toHaveBeenCalled();
  });

  it('should render custom fallback', () => {
    const customFallback = <div>Custom fallback UI</div>;

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom fallback UI')).toBeInTheDocument();
    expect(screen.queryByText(/Oops! Something went wrong/)).not.toBeInTheDocument();
  });

  it('should track error count', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    // Click try again multiple times
    fireEvent.click(screen.getByText('Try Again'));
    fireEvent.click(screen.getByText('Try Again'));
    fireEvent.click(screen.getByText('Try Again'));

    // After 3 errors, should show recurring error warning
    expect(screen.getByText(/Recurring Error Detected/)).toBeInTheDocument();
    expect(screen.getByText(/This error has occurred 3 times/)).toBeInTheDocument();
  });
});

describe('withErrorBoundary HOC', () => {
  it('should wrap component with error boundary', () => {
    const TestComponent = () => <div>Test</div>;
    const WrappedComponent = withErrorBoundary(TestComponent);

    const { container } = render(<WrappedComponent />);
    expect(container.firstChild).toBeTruthy();
  });

  it('should pass props to ErrorBoundary', () => {
    const TestComponent = () => {
      throw new Error('Test error');
    };

    const WrappedComponent = withErrorBoundary(TestComponent, {
      title: 'HOC Error',
      showHomeButton: true
    });

    render(<WrappedComponent />);

    expect(screen.getByText('HOC Error')).toBeInTheDocument();
    expect(screen.getByText('Go Home')).toBeInTheDocument();
  });

  it('should pass props to wrapped component', () => {
    const TestComponent = ({ name }) => <div>Hello {name}</div>;
    const WrappedComponent = withErrorBoundary(TestComponent);

    render(<WrappedComponent name="World" />);

    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });
});

describe('ErrorBoundary in development mode', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeAll(() => {
    process.env.NODE_ENV = 'development';
  });

  afterAll(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('should show error details in development', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    // Look for details element
    const details = screen.getByText('Error Details (Development Only)');
    expect(details).toBeInTheDocument();
  });
});

describe('ErrorBoundary in production mode', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeAll(() => {
    process.env.NODE_ENV = 'production';
  });

  afterAll(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('should not show error details in production', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.queryByText('Error Details (Development Only)')).not.toBeInTheDocument();
  });
});

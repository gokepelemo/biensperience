import { renderHook, act } from '@testing-library/react';
import { useDataTransition } from '../../src/hooks/useDataTransition';

describe('useDataTransition', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns empty transitionClass on first render', () => {
    const { result } = renderHook(() => useDataTransition({ name: 'Test' }));
    expect(result.current.transitionClass).toBe('');
    expect(result.current.isTransitioning).toBe(false);
  });

  it('triggers animation when data changes', () => {
    const { result, rerender } = renderHook(
      ({ data }) => useDataTransition(data),
      { initialProps: { data: { name: 'Test', count: 1 } } }
    );

    expect(result.current.transitionClass).toBe('');

    rerender({ data: { name: 'Test', count: 2 } });

    expect(result.current.transitionClass).toBe('data-transition-pulse');
    expect(result.current.isTransitioning).toBe(true);
  });

  it('clears animation after duration', () => {
    const { result, rerender } = renderHook(
      ({ data }) => useDataTransition(data, { duration: 600 }),
      { initialProps: { data: { v: 1 } } }
    );

    rerender({ data: { v: 2 } });
    expect(result.current.isTransitioning).toBe(true);

    act(() => {
      jest.advanceTimersByTime(600);
    });

    expect(result.current.isTransitioning).toBe(false);
    expect(result.current.transitionClass).toBe('');
  });

  it('does not animate when data is unchanged', () => {
    const { result, rerender } = renderHook(
      ({ data }) => useDataTransition(data),
      { initialProps: { data: { name: 'Same' } } }
    );

    rerender({ data: { name: 'Same' } });
    expect(result.current.transitionClass).toBe('');
    expect(result.current.isTransitioning).toBe(false);
  });

  it('does not animate when key order differs but values are same', () => {
    const { result, rerender } = renderHook(
      ({ data }) => useDataTransition(data),
      { initialProps: { data: { a: 1, b: 2 } } }
    );

    rerender({ data: { b: 2, a: 1 } });
    expect(result.current.transitionClass).toBe('');
  });

  it('does not animate when enabled is false', () => {
    const { result, rerender } = renderHook(
      ({ data }) => useDataTransition(data, { enabled: false }),
      { initialProps: { data: { v: 1 } } }
    );

    rerender({ data: { v: 2 } });
    expect(result.current.transitionClass).toBe('');
  });

  it('uses custom animation type', () => {
    const { result, rerender } = renderHook(
      ({ data }) => useDataTransition(data, { animation: 'highlight' }),
      { initialProps: { data: { v: 1 } } }
    );

    rerender({ data: { v: 2 } });
    expect(result.current.transitionClass).toBe('data-transition-highlight');
  });

  it('uses selectFields for comparison', () => {
    const selectFields = (d) => ({ count: d.count });

    const { result, rerender } = renderHook(
      ({ data }) => useDataTransition(data, { selectFields }),
      { initialProps: { data: { count: 1, timestamp: 100 } } }
    );

    // Only timestamp changed — should not animate
    rerender({ data: { count: 1, timestamp: 200 } });
    expect(result.current.transitionClass).toBe('');

    // Count changed — should animate
    rerender({ data: { count: 2, timestamp: 300 } });
    expect(result.current.transitionClass).toBe('data-transition-pulse');
  });

  it('triggerTransition manually triggers animation', () => {
    const { result } = renderHook(() => useDataTransition({ v: 1 }));

    expect(result.current.isTransitioning).toBe(false);

    act(() => {
      result.current.triggerTransition();
    });

    expect(result.current.isTransitioning).toBe(true);

    act(() => {
      jest.advanceTimersByTime(600);
    });

    expect(result.current.isTransitioning).toBe(false);
  });

  it('cleans up timeout on unmount', () => {
    const { result, rerender, unmount } = renderHook(
      ({ data }) => useDataTransition(data),
      { initialProps: { data: { v: 1 } } }
    );

    rerender({ data: { v: 2 } });
    expect(result.current.isTransitioning).toBe(true);

    // Should not throw on unmount with active timeout
    unmount();
  });

  it('resets animation if data changes again during transition', () => {
    const { result, rerender } = renderHook(
      ({ data }) => useDataTransition(data, { duration: 600 }),
      { initialProps: { data: { v: 1 } } }
    );

    rerender({ data: { v: 2 } });
    expect(result.current.isTransitioning).toBe(true);

    // Advance halfway
    act(() => {
      jest.advanceTimersByTime(300);
    });

    // Data changes again — should restart
    rerender({ data: { v: 3 } });
    expect(result.current.isTransitioning).toBe(true);

    // Original timeout would have fired — but it was cleared
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current.isTransitioning).toBe(true);

    // New timeout fires
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current.isTransitioning).toBe(false);
  });
});

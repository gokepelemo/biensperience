/**
 * Tests for usePlanItemNavigation — keyboard arrows + horizontal swipe.
 *
 * Covers:
 * - keyboard ArrowLeft / ArrowRight wired only when show + handler present
 * - keyboard skip when focus is in an input / contentEditable / tab / option
 * - swipe threshold (60px) and horizontal-vs-vertical ratio (1.5x)
 * - cleanup on unmount or show -> false
 */

import { renderHook, act } from '@testing-library/react';
import usePlanItemNavigation from '../../src/hooks/usePlanItemNavigation';

function fireKey(key) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

function makeTouch(x, y) {
  return { clientX: x, clientY: y };
}

describe('usePlanItemNavigation', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('does not attach keyboard listener when show is false', () => {
    const onPrev = jest.fn();
    const onNext = jest.fn();
    renderHook(() => usePlanItemNavigation({ show: false, onPrev, onNext }));

    fireKey('ArrowLeft');
    fireKey('ArrowRight');

    expect(onPrev).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('calls onPrev on ArrowLeft and onNext on ArrowRight', () => {
    const onPrev = jest.fn();
    const onNext = jest.fn();
    renderHook(() => usePlanItemNavigation({ show: true, onPrev, onNext }));

    fireKey('ArrowLeft');
    expect(onPrev).toHaveBeenCalledTimes(1);

    fireKey('ArrowRight');
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('skips when focus is in an input', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const onPrev = jest.fn();
    renderHook(() => usePlanItemNavigation({ show: true, onPrev, onNext: jest.fn() }));

    fireKey('ArrowLeft');
    expect(onPrev).not.toHaveBeenCalled();
  });

  it('skips when focus has role="tab"', () => {
    const tab = document.createElement('div');
    tab.setAttribute('role', 'tab');
    tab.tabIndex = 0;
    document.body.appendChild(tab);
    tab.focus();

    const onPrev = jest.fn();
    renderHook(() => usePlanItemNavigation({ show: true, onPrev, onNext: jest.fn() }));

    fireKey('ArrowLeft');
    expect(onPrev).not.toHaveBeenCalled();
  });

  it('skips when an ancestor has data-bien-no-nav (Stream Chat / mention popover opt-out)', () => {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-bien-no-nav', '');
    const inner = document.createElement('span');
    inner.tabIndex = 0;
    wrapper.appendChild(inner);
    document.body.appendChild(wrapper);
    inner.focus();

    const onPrev = jest.fn();
    renderHook(() => usePlanItemNavigation({ show: true, onPrev, onNext: jest.fn() }));

    fireKey('ArrowLeft');
    expect(onPrev).not.toHaveBeenCalled();
  });

  it('skips when an ancestor is contentEditable even if focused descendant is a span', () => {
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    const inner = document.createElement('span');
    inner.tabIndex = 0;
    editable.appendChild(inner);
    document.body.appendChild(editable);
    inner.focus();

    const onPrev = jest.fn();
    renderHook(() => usePlanItemNavigation({ show: true, onPrev, onNext: jest.fn() }));

    fireKey('ArrowLeft');
    expect(onPrev).not.toHaveBeenCalled();
  });

  it('detaches keyboard listener on unmount', () => {
    const onPrev = jest.fn();
    const { unmount } = renderHook(() =>
      usePlanItemNavigation({ show: true, onPrev, onNext: jest.fn() })
    );
    unmount();

    fireKey('ArrowLeft');
    expect(onPrev).not.toHaveBeenCalled();
  });

  it('triggers onNext on a leftward swipe past the threshold', () => {
    const onNext = jest.fn();
    const { result } = renderHook(() =>
      usePlanItemNavigation({ show: true, onPrev: jest.fn(), onNext })
    );

    act(() => {
      result.current.handleTouchStart({ touches: [makeTouch(200, 100)] });
      result.current.handleTouchEnd({ changedTouches: [makeTouch(100, 105)] });
    });

    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('triggers onPrev on a rightward swipe past the threshold', () => {
    const onPrev = jest.fn();
    const { result } = renderHook(() =>
      usePlanItemNavigation({ show: true, onPrev, onNext: jest.fn() })
    );

    act(() => {
      result.current.handleTouchStart({ touches: [makeTouch(100, 100)] });
      result.current.handleTouchEnd({ changedTouches: [makeTouch(200, 105)] });
    });

    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it('ignores swipes shorter than the threshold', () => {
    const onPrev = jest.fn();
    const onNext = jest.fn();
    const { result } = renderHook(() =>
      usePlanItemNavigation({ show: true, onPrev, onNext })
    );

    act(() => {
      result.current.handleTouchStart({ touches: [makeTouch(100, 100)] });
      result.current.handleTouchEnd({ changedTouches: [makeTouch(140, 105)] });
    });

    expect(onPrev).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('ignores swipes that are predominantly vertical (likely scrolls)', () => {
    const onNext = jest.fn();
    const { result } = renderHook(() =>
      usePlanItemNavigation({ show: true, onPrev: jest.fn(), onNext })
    );

    act(() => {
      result.current.handleTouchStart({ touches: [makeTouch(100, 100)] });
      result.current.handleTouchEnd({ changedTouches: [makeTouch(0, 200)] });
    });

    expect(onNext).not.toHaveBeenCalled();
  });

  it('ignores multi-touch starts', () => {
    const onNext = jest.fn();
    const { result } = renderHook(() =>
      usePlanItemNavigation({ show: true, onPrev: jest.fn(), onNext })
    );

    act(() => {
      result.current.handleTouchStart({ touches: [makeTouch(200, 100), makeTouch(150, 100)] });
      result.current.handleTouchEnd({ changedTouches: [makeTouch(100, 100)] });
    });

    expect(onNext).not.toHaveBeenCalled();
  });
});

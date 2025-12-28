/**
 * Tests for useTravelTipsManager hook
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { useTravelTipsManager } from '../../src/hooks/useTravelTipsManager';

describe('useTravelTipsManager', () => {
  it('should initialize with empty tips', () => {
    const { result } = renderHook(() => useTravelTipsManager());

    expect(result.current.travelTips).toEqual([]);
    expect(result.current.newTravelTip).toBe('');
  });

  it('should initialize with provided tips', () => {
    const initialTips = ['Tip 1', 'Tip 2'];
    const { result } = renderHook(() => useTravelTipsManager(initialTips));

    expect(result.current.travelTips).toEqual(initialTips);
  });

  it('should add a new tip', () => {
    const { result } = renderHook(() => useTravelTipsManager());

    act(() => {
      result.current.handleNewTipChange({
        target: { value: 'Best time to visit is spring' }
      });
    });

    expect(result.current.newTravelTip).toBe('Best time to visit is spring');

    act(() => {
      result.current.addTravelTip();
    });

    expect(result.current.travelTips).toEqual(['Best time to visit is spring']);
    expect(result.current.newTravelTip).toBe('');
  });

  it('should not add empty tip', () => {
    const { result } = renderHook(() => useTravelTipsManager());

    act(() => {
      result.current.handleNewTipChange({ target: { value: '   ' } });
    });

    act(() => {
      result.current.addTravelTip();
    });

    expect(result.current.travelTips).toEqual([]);
  });

  it('should delete a tip by index', () => {
    const initialTips = ['Tip 1', 'Tip 2', 'Tip 3'];
    const { result } = renderHook(() => useTravelTipsManager(initialTips));

    act(() => {
      result.current.deleteTravelTip(1);
    });

    expect(result.current.travelTips).toEqual(['Tip 1', 'Tip 3']);
  });

  it('should update a tip at index', () => {
    const initialTips = ['Tip 1', 'Tip 2'];
    const { result } = renderHook(() => useTravelTipsManager(initialTips));

    act(() => {
      result.current.updateTravelTip(0, 'Updated Tip 1');
    });

    expect(result.current.travelTips).toEqual(['Updated Tip 1', 'Tip 2']);
  });

  it('should handle Enter key to add tip', () => {
    const { result } = renderHook(() => useTravelTipsManager());

    act(() => {
      result.current.handleNewTipChange({ target: { value: 'New tip' } });
    });

    act(() => {
      result.current.handleNewTipKeyPress({
        key: 'Enter',
        preventDefault: jest.fn()
      });
    });

    expect(result.current.travelTips).toEqual(['New tip']);
  });

  it('should not add on other key presses', () => {
    const { result } = renderHook(() => useTravelTipsManager());

    act(() => {
      result.current.handleNewTipChange({ target: { value: 'New tip' } });
    });

    act(() => {
      result.current.handleNewTipKeyPress({
        key: 'a',
        preventDefault: jest.fn()
      });
    });

    expect(result.current.travelTips).toEqual([]);
  });

  it('should reset tips', () => {
    const initialTips = ['Tip 1', 'Tip 2'];
    const { result } = renderHook(() => useTravelTipsManager(initialTips));

    act(() => {
      result.current.handleNewTipChange({ target: { value: 'Some text' } });
    });

    act(() => {
      result.current.resetTravelTips(['New Tip 1', 'New Tip 2', 'New Tip 3']);
    });

    expect(result.current.travelTips).toEqual(['New Tip 1', 'New Tip 2', 'New Tip 3']);
    expect(result.current.newTravelTip).toBe('');
  });
});

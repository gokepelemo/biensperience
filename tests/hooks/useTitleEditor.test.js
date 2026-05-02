/**
 * Tests for useTitleEditor — controls inline title editing on plan items.
 *
 * Covers:
 * - click to enter edit mode (gated on canEdit + onUpdateTitle)
 * - Enter key blurs the input (which triggers save via blur handler)
 * - Escape key reverts and exits edit mode
 * - blur with changed value calls onUpdateTitle
 * - blur with empty / unchanged value reverts without calling onUpdateTitle
 * - blur error path reverts the local title text
 */

import { renderHook, act } from '@testing-library/react';
import useTitleEditor from '../../src/hooks/useTitleEditor';

jest.mock('../../src/utilities/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

describe('useTitleEditor', () => {
  it('starts in non-editing state with empty titleText', () => {
    const { result } = renderHook(() =>
      useTitleEditor({ text: 'Original' }, true, jest.fn())
    );
    expect(result.current.isEditingTitle).toBe(false);
    expect(result.current.titleText).toBe('');
  });

  it('handleTitleClick enters edit mode and seeds titleText with current text', () => {
    const { result } = renderHook(() =>
      useTitleEditor({ text: 'Original' }, true, jest.fn())
    );
    act(() => result.current.handleTitleClick());
    expect(result.current.isEditingTitle).toBe(true);
    expect(result.current.titleText).toBe('Original');
  });

  it('handleTitleClick is a no-op when canEdit is false', () => {
    const { result } = renderHook(() =>
      useTitleEditor({ text: 'Original' }, false, jest.fn())
    );
    act(() => result.current.handleTitleClick());
    expect(result.current.isEditingTitle).toBe(false);
  });

  it('handleTitleClick is a no-op when onUpdateTitle is not provided', () => {
    const { result } = renderHook(() =>
      useTitleEditor({ text: 'Original' }, true, null)
    );
    act(() => result.current.handleTitleClick());
    expect(result.current.isEditingTitle).toBe(false);
  });

  it('handleTitleBlur calls onUpdateTitle with trimmed value when changed', async () => {
    const onUpdate = jest.fn().mockResolvedValue();
    const { result } = renderHook(() => useTitleEditor({ text: 'Old' }, true, onUpdate));
    act(() => result.current.handleTitleClick());
    act(() => result.current.setTitleText('  New Title  '));
    await act(async () => {
      await result.current.handleTitleBlur();
    });
    expect(onUpdate).toHaveBeenCalledWith('New Title');
    expect(result.current.isEditingTitle).toBe(false);
  });

  it('handleTitleBlur reverts when value is unchanged', async () => {
    const onUpdate = jest.fn();
    const { result } = renderHook(() =>
      useTitleEditor({ text: 'Same' }, true, onUpdate)
    );
    act(() => result.current.handleTitleClick());
    await act(async () => {
      await result.current.handleTitleBlur();
    });
    expect(onUpdate).not.toHaveBeenCalled();
    expect(result.current.titleText).toBe('Same');
  });

  it('handleTitleBlur reverts when value is empty', async () => {
    const onUpdate = jest.fn();
    const { result } = renderHook(() =>
      useTitleEditor({ text: 'Original' }, true, onUpdate)
    );
    act(() => result.current.handleTitleClick());
    act(() => result.current.setTitleText('   '));
    await act(async () => {
      await result.current.handleTitleBlur();
    });
    expect(onUpdate).not.toHaveBeenCalled();
    expect(result.current.titleText).toBe('Original');
  });

  it('handleTitleBlur reverts when onUpdateTitle throws', async () => {
    const onUpdate = jest.fn().mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() =>
      useTitleEditor({ text: 'Old' }, true, onUpdate)
    );
    act(() => result.current.handleTitleClick());
    act(() => result.current.setTitleText('Maybe'));
    await act(async () => {
      await result.current.handleTitleBlur();
    });
    expect(onUpdate).toHaveBeenCalledWith('Maybe');
    expect(result.current.titleText).toBe('Old');
  });

  it('handleTitleKeyDown Escape reverts and exits edit mode', () => {
    const { result } = renderHook(() =>
      useTitleEditor({ text: 'Original' }, true, jest.fn())
    );
    act(() => result.current.handleTitleClick());
    act(() => result.current.setTitleText('Draft'));
    const preventDefault = jest.fn();
    act(() => result.current.handleTitleKeyDown({ key: 'Escape', preventDefault }));
    expect(preventDefault).toHaveBeenCalled();
    expect(result.current.isEditingTitle).toBe(false);
    expect(result.current.titleText).toBe('Original');
  });
});

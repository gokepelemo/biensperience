/**
 * Tests for useBienBotEntityAction hook
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { useBienBotEntityAction } from './useBienBotEntityAction';

jest.mock('./useFeatureFlag', () => ({
  useFeatureFlag: jest.fn()
}));

jest.mock('./useBienBot', () => ({
  openWithAnalysis: jest.fn()
}));

const { useFeatureFlag } = require('./useFeatureFlag');
const { openWithAnalysis } = require('./useBienBot');

describe('useBienBotEntityAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useFeatureFlag.mockReturnValue({ enabled: true });
    openWithAnalysis.mockResolvedValue(undefined);
  });

  // --- label selection ---

  it('returns "Analyze" for destination entity', () => {
    const { result } = renderHook(() =>
      useBienBotEntityAction('destination', 'dest-id', 'Paris')
    );
    expect(result.current.label).toBe('Analyze');
  });

  it('returns "Analyze" for experience entity', () => {
    const { result } = renderHook(() =>
      useBienBotEntityAction('experience', 'exp-id', 'Weekend in Paris')
    );
    expect(result.current.label).toBe('Analyze');
  });

  it('returns "Discuss" for plan entity', () => {
    const { result } = renderHook(() =>
      useBienBotEntityAction('plan', 'plan-id', 'My Paris plan')
    );
    expect(result.current.label).toBe('Discuss');
  });

  it('returns "Discuss" for plan_item entity', () => {
    const { result } = renderHook(() =>
      useBienBotEntityAction('plan_item', 'item-id', 'Visit the Louvre')
    );
    expect(result.current.label).toBe('Discuss');
  });

  it('returns "Discuss" for user entity', () => {
    const { result } = renderHook(() =>
      useBienBotEntityAction('user', 'user-id', 'your travel plans')
    );
    expect(result.current.label).toBe('Discuss');
  });

  // --- hasAccess gate ---

  it('returns hasAccess true when ai_features flag is enabled', () => {
    useFeatureFlag.mockReturnValue({ enabled: true });
    const { result } = renderHook(() =>
      useBienBotEntityAction('plan', 'plan-id', 'My plan')
    );
    expect(result.current.hasAccess).toBe(true);
  });

  it('returns hasAccess false when ai_features flag is disabled', () => {
    useFeatureFlag.mockReturnValue({ enabled: false });
    const { result } = renderHook(() =>
      useBienBotEntityAction('plan', 'plan-id', 'My plan')
    );
    expect(result.current.hasAccess).toBe(false);
  });

  // --- loading state ---

  it('initialises with loading false', () => {
    const { result } = renderHook(() =>
      useBienBotEntityAction('experience', 'exp-id', 'Test')
    );
    expect(result.current.loading).toBe(false);
  });

  it('sets loading true during handleOpen and false after completion', async () => {
    let resolveAnalysis;
    openWithAnalysis.mockReturnValue(new Promise(res => { resolveAnalysis = res; }));

    const { result } = renderHook(() =>
      useBienBotEntityAction('experience', 'exp-id', 'Test')
    );

    act(() => { result.current.handleOpen(); });
    expect(result.current.loading).toBe(true);

    await act(async () => { resolveAnalysis(); });
    expect(result.current.loading).toBe(false);
  });

  it('resets loading to false even when openWithAnalysis rejects', async () => {
    openWithAnalysis.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() =>
      useBienBotEntityAction('experience', 'exp-id', 'Test')
    );

    await act(async () => {
      await result.current.handleOpen().catch(() => {});
    });

    expect(result.current.loading).toBe(false);
  });

  // --- handleOpen behaviour ---

  it('calls openWithAnalysis with correct args', async () => {
    const { result } = renderHook(() =>
      useBienBotEntityAction('destination', 'dest-123', 'Paris')
    );

    await act(async () => { await result.current.handleOpen(); });

    expect(openWithAnalysis).toHaveBeenCalledWith('destination', 'dest-123', 'Paris');
  });

  it('does not call openWithAnalysis when hasAccess is false', async () => {
    useFeatureFlag.mockReturnValue({ enabled: false });

    const { result } = renderHook(() =>
      useBienBotEntityAction('destination', 'dest-123', 'Paris')
    );

    await act(async () => { await result.current.handleOpen(); });

    expect(openWithAnalysis).not.toHaveBeenCalled();
  });

  it('does not call openWithAnalysis when entityId is empty', async () => {
    const { result } = renderHook(() =>
      useBienBotEntityAction('destination', '', 'Paris')
    );

    await act(async () => { await result.current.handleOpen(); });

    expect(openWithAnalysis).not.toHaveBeenCalled();
  });

  it('falls back to entity type as label arg when entityLabel is not provided', async () => {
    const { result } = renderHook(() =>
      useBienBotEntityAction('plan', 'plan-id', undefined)
    );

    await act(async () => { await result.current.handleOpen(); });

    expect(openWithAnalysis).toHaveBeenCalledWith('plan', 'plan-id', 'plan');
  });
});

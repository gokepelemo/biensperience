/**
 * Tests for usePlanItemActions — wraps the location/date save mutations
 * and the address copy logic with clipboard fallback.
 */

import { renderHook, act, waitFor } from '@testing-library/react';

const mockUpdatePlanItem = jest.fn();
jest.mock('../../src/utilities/plans-api', () => ({
  updatePlanItem: (...args) => mockUpdatePlanItem(...args),
}));

jest.mock('../../src/utilities/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), debug: jest.fn(), warn: jest.fn() },
}));

import usePlanItemActions from '../../src/hooks/usePlanItemActions';

beforeEach(() => {
  mockUpdatePlanItem.mockReset();
});

describe('usePlanItemActions', () => {
  it('saveLocation throws when plan or planItem id is missing', async () => {
    const { result } = renderHook(() => usePlanItemActions(null, null));
    await expect(result.current.saveLocation({ address: 'X' })).rejects.toThrow(
      /Missing plan or plan item ID/
    );
  });

  it('saveLocation calls updatePlanItem with location payload', async () => {
    mockUpdatePlanItem.mockResolvedValue({});
    const { result } = renderHook(() =>
      usePlanItemActions({ _id: 'p' }, { _id: 'i' })
    );
    await act(async () => {
      await result.current.saveLocation({ address: '1600 Penn Ave' });
    });
    expect(mockUpdatePlanItem).toHaveBeenCalledWith('p', 'i', {
      location: { address: '1600 Penn Ave' },
    });
  });

  it('saveLocation re-throws on failure so the modal can display the error', async () => {
    mockUpdatePlanItem.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() =>
      usePlanItemActions({ _id: 'p' }, { _id: 'i' })
    );
    await expect(result.current.saveLocation({ address: 'X' })).rejects.toThrow(
      'network'
    );
  });

  it('saveDate calls updatePlanItem with scheduled_date and scheduled_time', async () => {
    mockUpdatePlanItem.mockResolvedValue({});
    const { result } = renderHook(() =>
      usePlanItemActions({ _id: 'p' }, { _id: 'i' })
    );
    await act(async () => {
      await result.current.saveDate({
        scheduled_date: '2026-05-01',
        scheduled_time: '10:00',
      });
    });
    expect(mockUpdatePlanItem).toHaveBeenCalledWith('p', 'i', {
      scheduled_date: '2026-05-01',
      scheduled_time: '10:00',
    });
  });

  it('locationForMap prefers geo coordinates over address', () => {
    const planItem = {
      location: { geo: { coordinates: [-77.04, 38.89] }, address: 'White House' },
    };
    const { result } = renderHook(() => usePlanItemActions({}, planItem));
    expect(result.current.locationForMap).toBe('38.89,-77.04');
  });

  it('locationForMap falls back to address when geo is missing', () => {
    const planItem = { location: { address: '1600 Penn Ave' } };
    const { result } = renderHook(() => usePlanItemActions({}, planItem));
    expect(result.current.locationForMap).toBe('1600 Penn Ave');
  });

  it('locationForMap returns null when no location at all', () => {
    const { result } = renderHook(() => usePlanItemActions({}, {}));
    expect(result.current.locationForMap).toBeNull();
  });

  it('fullCopyableAddress assembles street + city/state/country + postalCode', () => {
    const planItem = {
      location: {
        address: '1600 Penn Ave',
        city: 'Washington',
        state: 'DC',
        country: 'USA',
        postalCode: '20500',
      },
    };
    const { result } = renderHook(() => usePlanItemActions({}, planItem));
    expect(result.current.fullCopyableAddress).toBe(
      '1600 Penn Ave, Washington, DC, USA, 20500'
    );
  });

  it('fullCopyableAddress skips missing pieces', () => {
    const planItem = { location: { address: '1600 Penn Ave', city: 'Washington' } };
    const { result } = renderHook(() => usePlanItemActions({}, planItem));
    expect(result.current.fullCopyableAddress).toBe(
      '1600 Penn Ave, Washington'
    );
  });

  it('copyAddress writes to clipboard and flips addressCopied to true', async () => {
    const writeText = jest.fn().mockResolvedValue();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const planItem = { location: { address: '1600 Penn Ave' } };
    const { result } = renderHook(() => usePlanItemActions({}, planItem));

    await act(async () => {
      await result.current.copyAddress();
    });

    expect(writeText).toHaveBeenCalledWith('1600 Penn Ave');
    await waitFor(() => expect(result.current.addressCopied).toBe(true));
  });

  it('copyAddress is a no-op when fullCopyableAddress is empty', async () => {
    const writeText = jest.fn();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const { result } = renderHook(() => usePlanItemActions({}, {}));

    await act(async () => {
      await result.current.copyAddress();
    });

    expect(writeText).not.toHaveBeenCalled();
  });
});

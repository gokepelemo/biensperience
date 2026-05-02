/**
 * Tests for useGroupedDetails — derives the categorized detail groups
 * (transport, accommodation, parking, discount, expense) plus a total count
 * for the tab badge.
 */

import { renderHook } from '@testing-library/react';

jest.mock('../../src/components/AddPlanItemDetailModal', () => ({
  DETAIL_TYPES: {
    HOTEL: 'hotel',
    PARKING: 'parking',
    DISCOUNT: 'discount',
    COST: 'cost',
  },
  DETAIL_TYPE_CONFIG: {
    flight: { label: 'Flight', icon: '✈️', category: 'transportation' },
    hotel: { label: 'Hotel', icon: '🏨', category: 'accommodation' },
    parking: { label: 'Parking', icon: '🅿️', category: 'parking' },
    discount: { label: 'Discount', icon: '🎟️', category: 'discount' },
    cost: { label: 'Expense', icon: '💵', category: 'expense' },
  },
  DETAIL_CATEGORIES: {
    transportation: { label: 'Transport', order: 1 },
    accommodation: { label: 'Lodging', order: 2 },
    parking: { label: 'Parking', order: 3 },
    discount: { label: 'Discounts', order: 4 },
    expense: { label: 'Expenses', order: 5 },
  },
}));

import useGroupedDetails from '../../src/hooks/useGroupedDetails';

describe('useGroupedDetails', () => {
  it('returns empty object and zero count when planItem has no details', () => {
    const { result } = renderHook(() => useGroupedDetails({ details: null }, []));
    expect(result.current.groupedDetails).toEqual({});
    expect(result.current.totalDetailsCount).toBe(0);
  });

  it('groups transport under its mode-specific category', () => {
    const planItem = {
      details: {
        transport: { mode: 'flight', vendor: 'United', trackingNumber: 'UA101' },
      },
    };
    const { result } = renderHook(() => useGroupedDetails(planItem, []));
    expect(result.current.groupedDetails).toHaveProperty('transportation');
    expect(result.current.groupedDetails.transportation.items).toHaveLength(1);
    expect(result.current.groupedDetails.transportation.items[0]._displayTitle).toBe(
      'UA101'
    );
  });

  it('groups accommodation only when meaningful fields are present', () => {
    const blank = { details: { accommodation: { rating: 5 } } };
    const meaningful = {
      details: { accommodation: { name: 'Grand Hotel' } },
    };
    expect(renderHook(() => useGroupedDetails(blank, [])).result.current.totalDetailsCount).toBe(0);
    const result = renderHook(() => useGroupedDetails(meaningful, [])).result.current;
    expect(result.totalDetailsCount).toBe(1);
    expect(result.groupedDetails.accommodation.items[0]._displayTitle).toBe(
      'Grand Hotel'
    );
  });

  it('groups parking when any of facilityName/address/confirmation/start/end is set', () => {
    const planItem = { details: { parking: { facilityName: 'Lot B' } } };
    const { result } = renderHook(() => useGroupedDetails(planItem, []));
    expect(result.current.groupedDetails.parking.items).toHaveLength(1);
  });

  it('groups discount when code/description/value is present', () => {
    const planItem = { details: { discount: { code: 'SAVE10' } } };
    const { result } = renderHook(() => useGroupedDetails(planItem, []));
    expect(result.current.groupedDetails.discount.items[0]._displayTitle).toBe(
      'SAVE10'
    );
  });

  it('rolls actualCosts into the expense group with stable synth keys', () => {
    const planItem = { details: {} };
    const costs = [{ _id: 'c1', amount: 10 }, { amount: 20 }];
    const { result } = renderHook(() => useGroupedDetails(planItem, costs));
    expect(result.current.groupedDetails.expense.items.map((i) => i._synthKey)).toEqual([
      'cost-c1',
      'cost-i-1',
    ]);
  });

  it('sorts categories by their declared order', () => {
    const planItem = {
      details: {
        transport: { mode: 'flight' },
        accommodation: { name: 'Hotel' },
        parking: { facilityName: 'Lot A' },
      },
    };
    const { result } = renderHook(() => useGroupedDetails(planItem, []));
    const keys = Object.keys(result.current.groupedDetails);
    expect(keys).toEqual(['transportation', 'accommodation', 'parking']);
  });

  it('totalDetailsCount sums across all category groups', () => {
    const planItem = {
      details: {
        transport: { mode: 'flight' },
        accommodation: { name: 'Hotel' },
      },
    };
    const costs = [{ _id: 'a' }, { _id: 'b' }];
    const { result } = renderHook(() => useGroupedDetails(planItem, costs));
    expect(result.current.totalDetailsCount).toBe(4);
  });
});

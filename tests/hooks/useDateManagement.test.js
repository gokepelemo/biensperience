/**
 * Tests for useDateManagement hook — two-phase date shift flow
 */
import { renderHook, act } from '@testing-library/react-hooks';
import { useDateManagement } from '../../src/hooks/useDateManagement';

jest.mock('../../src/utilities/plans-api', () => ({
  updatePlan: jest.fn(),
  shiftPlanItemDates: jest.fn()
}));
jest.mock('../../src/utilities/debug', () => ({ default: { log: jest.fn() } }));
jest.mock('../../src/utilities/error-handler', () => ({
  handleError: jest.fn((err) => err?.message || 'Error')
}));

const { updatePlan, shiftPlanItemDates } = require('../../src/utilities/plans-api');

function makeProps(overrides = {}) {
  return {
    user: { _id: 'user1' },
    experience: { _id: 'exp1' },
    userPlan: { _id: 'plan1' },
    userHasExperience: true,
    activeTab: 'myplan',
    selectedPlanId: 'plan1',
    sharedPlans: [{ _id: 'plan1', planned_date: '2026-05-01' }],
    plannedDate: '2026-05-08',
    setPlannedDate: jest.fn(),
    userPlannedDate: '2026-05-01',
    displayedPlannedDate: '2026-05-01',
    setDisplayedPlannedDate: jest.fn(),
    updatePlan: jest.fn(),
    handleAddExperience: jest.fn(),
    fetchUserPlan: jest.fn().mockResolvedValue(null),
    fetchSharedPlans: jest.fn().mockResolvedValue([]),
    fetchPlans: jest.fn().mockResolvedValue([]),
    fetchAllData: jest.fn().mockResolvedValue(null),
    setLoading: jest.fn(),
    closeModal: jest.fn(),
    showError: jest.fn(),
    idEquals: (a, b) => String(a) === String(b),
    isEditingDateState: true,
    setIsEditingDateState: jest.fn(),
    ...overrides
  };
}

describe('useDateManagement — pendingShift flow', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns pendingShift null initially', () => {
    const props = makeProps();
    const { result } = renderHook(() => useDateManagement(props));
    expect(result.current.pendingShift).toBeNull();
  });

  test('exposes onShiftDates and onKeepDates', () => {
    const props = makeProps();
    const { result } = renderHook(() => useDateManagement(props));
    expect(typeof result.current.onShiftDates).toBe('function');
    expect(typeof result.current.onKeepDates).toBe('function');
  });

  test('sets pendingShift when updatePlan returns _shift_meta', async () => {
    const mockUpdatePlan = jest.fn().mockResolvedValue({
      _id: 'plan1',
      planned_date: '2026-05-08',
      _shift_meta: {
        scheduled_items_count: 2,
        date_diff_days: 7,
        date_diff_ms: 7 * 24 * 60 * 60 * 1000,
        old_date: '2026-05-01',
        new_date: '2026-05-08'
      }
    });

    const props = makeProps({ updatePlan: mockUpdatePlan });
    const { result } = renderHook(() => useDateManagement(props));

    await act(async () => {
      // Simulate handleDateUpdate being called in edit mode for selectedPlanId
      await result.current.handleDateUpdate();
    });

    expect(result.current.pendingShift).toEqual({
      planId: 'plan1',
      count: 2,
      diffDays: 7,
      diffMs: 7 * 24 * 60 * 60 * 1000,
      oldDate: '2026-05-01',
      newDate: '2026-05-08'
    });
    // Modal should NOT be closed yet
    expect(props.closeModal).not.toHaveBeenCalled();
  });

  test('calls finalizeDateUpdate immediately when no _shift_meta', async () => {
    const mockUpdatePlan = jest.fn().mockResolvedValue({ _id: 'plan1', planned_date: '2026-05-08' });
    const props = makeProps({ updatePlan: mockUpdatePlan });
    const { result } = renderHook(() => useDateManagement(props));

    await act(async () => {
      await result.current.handleDateUpdate();
    });

    expect(result.current.pendingShift).toBeNull();
    expect(props.closeModal).toHaveBeenCalled();
  });

  test('onKeepDates closes modal and clears pendingShift', async () => {
    const mockUpdatePlan = jest.fn().mockResolvedValue({
      _id: 'plan1',
      _shift_meta: { scheduled_items_count: 1, date_diff_days: 7, date_diff_ms: 604800000, old_date: '2026-05-01', new_date: '2026-05-08' }
    });
    const props = makeProps({ updatePlan: mockUpdatePlan });
    const { result } = renderHook(() => useDateManagement(props));

    await act(async () => { await result.current.handleDateUpdate(); });
    expect(result.current.pendingShift).not.toBeNull();

    await act(async () => { result.current.onKeepDates(); });

    expect(result.current.pendingShift).toBeNull();
    expect(props.closeModal).toHaveBeenCalled();
  });

  test('onShiftDates calls shiftPlanItemDates then closes modal', async () => {
    shiftPlanItemDates.mockResolvedValue({ shifted_count: 1 });

    const mockUpdatePlan = jest.fn().mockResolvedValue({
      _id: 'plan1',
      _shift_meta: { scheduled_items_count: 1, date_diff_days: 7, date_diff_ms: 604800000, old_date: '2026-05-01', new_date: '2026-05-08' }
    });
    const props = makeProps({ updatePlan: mockUpdatePlan });
    const { result } = renderHook(() => useDateManagement(props));

    await act(async () => { await result.current.handleDateUpdate(); });
    await act(async () => { await result.current.onShiftDates(); });

    expect(shiftPlanItemDates).toHaveBeenCalledWith('plan1', 604800000);
    expect(result.current.pendingShift).toBeNull();
    expect(props.closeModal).toHaveBeenCalled();
  });

  test('onShiftDates calls showError and still closes modal when shift API fails', async () => {
    shiftPlanItemDates.mockRejectedValue(new Error('Network error'));

    const mockUpdatePlan = jest.fn().mockResolvedValue({
      _id: 'plan1',
      _shift_meta: { scheduled_items_count: 1, date_diff_days: 7, date_diff_ms: 604800000, old_date: '2026-05-01', new_date: '2026-05-08' }
    });
    const props = makeProps({ updatePlan: mockUpdatePlan });
    const { result } = renderHook(() => useDateManagement(props));

    await act(async () => { await result.current.handleDateUpdate(); });
    await act(async () => { await result.current.onShiftDates(); });

    expect(props.showError).toHaveBeenCalled();
    expect(props.closeModal).toHaveBeenCalled();
    expect(result.current.pendingShift).toBeNull();
  });
});

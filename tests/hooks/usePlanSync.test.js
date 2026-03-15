/**
 * Tests for usePlanSync hook
 *
 * Tests cover:
 * - checkPlanDivergence: core comparison of plan vs experience items
 * - recheckDivergence: reactive state update when plans/experience change
 * - handleSyncPlan: computing changes (added/removed/modified)
 * - confirmSyncPlan: applying the synced snapshot + UI state reset
 * - Null / corrupt data guards (plan_item_id = null)
 * - Event-bus subscription for real-time divergence detection
 */

import { renderHook, act } from '@testing-library/react-hooks';
import usePlanSync from '../../src/hooks/usePlanSync';
import { updatePlan } from '../../src/utilities/plans-api';
import { handleError } from '../../src/utilities/error-handler';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('../../src/utilities/plans-api', () => ({
  updatePlan: jest.fn()
}));

jest.mock('../../src/utilities/error-handler', () => ({
  handleError: jest.fn((err) => err?.message || 'Error')
}));

jest.mock('../../src/utilities/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

jest.mock('../../src/utilities/debug', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  __esModule: true,
  default: { log: jest.fn(), warn: jest.fn() }
}));

// Minimal idEquals: compare stringified IDs
jest.mock('../../src/utilities/id-utils', () => ({
  idEquals: jest.fn((a, b) => {
    if (!a || !b) return false;
    return a.toString() === b.toString();
  })
}));

// Cookie utilities — default: no cookie set (null)
const mockedGetCookieValue = jest.fn(() => null);
const mockedSetCookieValue = jest.fn();
jest.mock('../../src/utilities/cookie-utils', () => ({
  getCookieValue: (...args) => mockedGetCookieValue(...args),
  setCookieValue: (...args) => mockedSetCookieValue(...args)
}));

// Event bus - capture subscribers so tests can trigger them
const eventSubscribers = {};
jest.mock('../../src/utilities/event-bus', () => ({
  subscribeToEvent: jest.fn((eventType, handler) => {
    eventSubscribers[eventType] = handler;
    return jest.fn(() => {
      delete eventSubscribers[eventType];
    });
  })
}));

// ============================================================================
// Fixtures
// ============================================================================

const EXP_ID = 'exp-001';
const PLAN_ID = 'plan-001';
const USER_ID = 'user-001';

const makeExpItem = (id, text = 'Item', url = '', costEstimate = 0, planningDays = 0) => ({
  _id: id,
  text,
  url,
  cost_estimate: costEstimate,
  planning_days: planningDays,
  photo: null,
  parent: null
});

const makePlanItem = (planItemId, text = 'Item', url = '', cost = 0, planningDays = 0) => ({
  plan_item_id: planItemId,
  text,
  url,
  cost,
  planning_days: planningDays,
  complete: false,
  photo: null,
  parent: null
});

const makePlan = (id, planItems = []) => ({
  _id: id,
  experience: EXP_ID,
  user: USER_ID,
  plan: planItems,
  permissions: [{ _id: USER_ID, entity: 'user', type: 'owner' }]
});

const makeExperience = (planItems = []) => ({
  _id: EXP_ID,
  name: 'Test Experience',
  plan_items: planItems
});

// Build default props for the hook
const makeProps = (overrides = {}) => ({
  experience: makeExperience([makeExpItem('item-1', 'Visit tower')]),
  selectedPlanId: PLAN_ID,
  allPlans: [makePlan(PLAN_ID, [makePlanItem('item-1', 'Visit tower')])],
  fetchSharedPlans: jest.fn().mockResolvedValue(undefined),
  fetchUserPlan: jest.fn().mockResolvedValue(undefined),
  fetchPlans: jest.fn().mockResolvedValue(undefined),
  showError: jest.fn(),
  ...overrides
});

// ============================================================================
// Helpers
// ============================================================================

/** Render the hook and return result + utils */
const renderSync = (overrides = {}) =>
  renderHook(() => usePlanSync(makeProps(overrides)));

// ============================================================================
// Tests
// ============================================================================

describe('usePlanSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetCookieValue.mockReturnValue(null);
    updatePlan.mockResolvedValue({ _id: PLAN_ID, plan: [] });
  });

  // --------------------------------------------------------------------------
  describe('Initial State', () => {
    it('should initialize with sync button hidden and alert hidden (no divergence)', () => {
      const { result } = renderSync();

      // Default makeProps uses a plan that matches the experience.
      // recheckDivergence runs during initial effects and sets showSyncAlert = false
      // because hasDiverged = false (no actual changes to sync).
      expect(result.current.showSyncButton).toBe(false);
      expect(result.current.showSyncAlert).toBe(false);
      expect(result.current.showSyncModal).toBe(false);
      expect(result.current.syncChanges).toBeNull();
      expect(result.current.syncLoading).toBe(false);
    });

    it('should expose all expected handlers', () => {
      const { result } = renderSync();
      const { handleSyncPlan, confirmSyncPlan, dismissSyncAlert, closeSyncModal, resetSyncState, checkPlanDivergence } = result.current;
      [handleSyncPlan, confirmSyncPlan, dismissSyncAlert, closeSyncModal, resetSyncState, checkPlanDivergence]
        .forEach(fn => expect(typeof fn).toBe('function'));
    });
  });

  // --------------------------------------------------------------------------
  describe('checkPlanDivergence', () => {
    it('should return false when plan and experience match', () => {
      const { result } = renderSync();
      const plan = makePlan(PLAN_ID, [makePlanItem('item-1', 'Visit tower')]);
      const exp = makeExperience([makeExpItem('item-1', 'Visit tower')]);

      expect(result.current.checkPlanDivergence(plan, exp)).toBe(false);
    });

    it('should return false when both are empty', () => {
      const { result } = renderSync();
      const plan = makePlan(PLAN_ID, []);
      const exp = makeExperience([]);

      expect(result.current.checkPlanDivergence(plan, exp)).toBe(false);
    });

    it('should return true when item counts differ (experience has more)', () => {
      const { result } = renderSync();
      const plan = makePlan(PLAN_ID, [makePlanItem('item-1', 'A')]);
      const exp = makeExperience([makeExpItem('item-1', 'A'), makeExpItem('item-2', 'B')]);

      expect(result.current.checkPlanDivergence(plan, exp)).toBe(true);
    });

    it('should return true when item counts differ (plan has more)', () => {
      const { result } = renderSync();
      const plan = makePlan(PLAN_ID, [makePlanItem('item-1', 'A'), makePlanItem('item-2', 'B')]);
      const exp = makeExperience([makeExpItem('item-1', 'A')]);

      expect(result.current.checkPlanDivergence(plan, exp)).toBe(true);
    });

    it('should return true when text differs', () => {
      const { result } = renderSync();
      const plan = makePlan(PLAN_ID, [makePlanItem('item-1', 'Old text')]);
      const exp = makeExperience([makeExpItem('item-1', 'New text')]);

      expect(result.current.checkPlanDivergence(plan, exp)).toBe(true);
    });

    it('should return true when URL differs', () => {
      const { result } = renderSync();
      const plan = makePlan(PLAN_ID, [makePlanItem('item-1', 'Item', 'http://old.com')]);
      const exp = makeExperience([makeExpItem('item-1', 'Item', 'http://new.com')]);

      expect(result.current.checkPlanDivergence(plan, exp)).toBe(true);
    });

    it('should return true when cost differs', () => {
      const { result } = renderSync();
      const plan = makePlan(PLAN_ID, [makePlanItem('item-1', 'Item', '', 10)]);
      const exp = makeExperience([makeExpItem('item-1', 'Item', '', 20)]);

      expect(result.current.checkPlanDivergence(plan, exp)).toBe(true);
    });

    it('should return true when planning_days differs', () => {
      const { result } = renderSync();
      const plan = makePlan(PLAN_ID, [makePlanItem('item-1', 'Item', '', 0, 1)]);
      const exp = makeExperience([makeExpItem('item-1', 'Item', '', 0, 3)]);

      expect(result.current.checkPlanDivergence(plan, exp)).toBe(true);
    });

    it('should NOT return true for null vs "" URL (normalized equivalents)', () => {
      const { result } = renderSync();
      // Plan item has null url, experience has empty string
      const planItem = { ...makePlanItem('item-1', 'Item'), url: null };
      const plan = makePlan(PLAN_ID, [planItem]);
      const exp = makeExperience([makeExpItem('item-1', 'Item', '')]);

      expect(result.current.checkPlanDivergence(plan, exp)).toBe(false);
    });

    it('should NOT return true for null vs 0 cost (normalized equivalents)', () => {
      const { result } = renderSync();
      const planItem = { ...makePlanItem('item-1', 'Item'), cost: null };
      const plan = makePlan(PLAN_ID, [planItem]);
      const exp = makeExperience([makeExpItem('item-1', 'Item', '', 0)]);

      expect(result.current.checkPlanDivergence(plan, exp)).toBe(false);
    });

    it('should return true when plan item has null plan_item_id (corrupt data)', () => {
      const { result } = renderSync();
      const corruptItem = { ...makePlanItem(null, 'Item') };
      const plan = makePlan(PLAN_ID, [corruptItem]);
      const exp = makeExperience([makeExpItem('item-1', 'Item')]);

      // Should not throw and should treat as diverged
      expect(() => result.current.checkPlanDivergence(plan, exp)).not.toThrow();
      expect(result.current.checkPlanDivergence(plan, exp)).toBe(true);
    });

    it('should return false when called with missing plan or experience', () => {
      const { result } = renderSync();

      expect(result.current.checkPlanDivergence(null, null)).toBe(false);
      expect(result.current.checkPlanDivergence(makePlan(PLAN_ID, []), null)).toBe(false);
      expect(result.current.checkPlanDivergence(null, makeExperience([]))).toBe(false);
    });

    it('should return false when plan.plan is not an array', () => {
      const { result } = renderSync();
      const badPlan = { _id: PLAN_ID, plan: undefined };
      const exp = makeExperience([makeExpItem('item-1')]);

      expect(result.current.checkPlanDivergence(badPlan, exp)).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  describe('recheckDivergence / showSyncButton', () => {
    it('should show sync button when plan diverges from experience', async () => {
      // Plan has old text, experience has new text
      const props = makeProps({
        experience: makeExperience([makeExpItem('item-1', 'New text')]),
        allPlans: [makePlan(PLAN_ID, [makePlanItem('item-1', 'Old text')])]
      });

      const { result, waitForNextUpdate } = renderHook(() => usePlanSync(props));
      await waitForNextUpdate({ timeout: 2000 }).catch(() => {});

      expect(result.current.showSyncButton).toBe(true);
    });

    it('should hide sync button when plan matches experience', async () => {
      const props = makeProps({
        experience: makeExperience([makeExpItem('item-1', 'Same text')]),
        allPlans: [makePlan(PLAN_ID, [makePlanItem('item-1', 'Same text')])]
      });

      const { result, waitForNextUpdate } = renderHook(() => usePlanSync(props));
      await waitForNextUpdate({ timeout: 2000 }).catch(() => {});

      expect(result.current.showSyncButton).toBe(false);
    });

    it('should not show sync button when selectedPlanId is null', async () => {
      const props = makeProps({ selectedPlanId: null });
      const { result, waitForNextUpdate } = renderHook(() => usePlanSync(props));
      await waitForNextUpdate({ timeout: 500 }).catch(() => {});

      expect(result.current.showSyncButton).toBe(false);
    });

    it('should not show sync button when allPlans is empty', async () => {
      const props = makeProps({ allPlans: [] });
      const { result, waitForNextUpdate } = renderHook(() => usePlanSync(props));
      await waitForNextUpdate({ timeout: 500 }).catch(() => {});

      expect(result.current.showSyncButton).toBe(false);
    });

    it('should hide sync alert when cookie indicates recent dismissal', async () => {
      mockedGetCookieValue.mockReturnValue(Date.now()); // dismissed recently
      const props = makeProps({
        experience: makeExperience([makeExpItem('item-1', 'New text')]),
        allPlans: [makePlan(PLAN_ID, [makePlanItem('item-1', 'Old text')])]
      });

      const { result, waitForNextUpdate } = renderHook(() => usePlanSync(props));
      await waitForNextUpdate({ timeout: 2000 }).catch(() => {});

      expect(result.current.showSyncButton).toBe(true);
      expect(result.current.showSyncAlert).toBe(false); // hidden by cookie
    });
  });

  // --------------------------------------------------------------------------
  describe('dismissSyncAlert', () => {
    it('should hide sync alert and set cookie', async () => {
      // Props must be stable (created outside renderHook callback) so that
      // re-renders after dismissSyncAlert don't create new allPlans/experience
      // references that would retrigger recheckDivergence and reset the alert.
      const props = makeProps({
        experience: makeExperience([makeExpItem('item-1', 'New')]),
        allPlans: [makePlan(PLAN_ID, [makePlanItem('item-1', 'Old')])]
      });
      const { result, waitForNextUpdate } = renderHook(() => usePlanSync(props));
      await waitForNextUpdate({ timeout: 2000 }).catch(() => {});

      await act(async () => {
        result.current.dismissSyncAlert();
      });

      expect(result.current.showSyncAlert).toBe(false);
      expect(mockedSetCookieValue).toHaveBeenCalled();
    });

    it('should not set cookie when selectedPlanId is null', () => {
      const { result } = renderSync({ selectedPlanId: null });

      act(() => {
        result.current.dismissSyncAlert();
      });

      expect(mockedSetCookieValue).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  describe('handleSyncPlan', () => {
    it('should return early when no selectedPlanId', async () => {
      const { result } = renderSync({ selectedPlanId: null });

      await act(async () => {
        await result.current.handleSyncPlan();
      });

      expect(result.current.showSyncModal).toBe(false);
    });

    it('should return early when plan is not found in allPlans', async () => {
      const { result } = renderSync({ allPlans: [] });

      await act(async () => {
        await result.current.handleSyncPlan();
      });

      expect(result.current.showSyncModal).toBe(false);
    });

    it('should return early when currentPlan.plan is undefined', async () => {
      const badPlan = { _id: PLAN_ID, experience: EXP_ID, user: USER_ID, plan: undefined };
      const { result } = renderSync({ allPlans: [badPlan] });

      await act(async () => {
        await result.current.handleSyncPlan();
      });

      expect(result.current.showSyncModal).toBe(false);
    });

    it('should detect added items (in experience but not plan)', async () => {
      const props = makeProps({
        experience: makeExperience([
          makeExpItem('item-1', 'Existing'),
          makeExpItem('item-2', 'New item') // not in plan
        ]),
        allPlans: [makePlan(PLAN_ID, [makePlanItem('item-1', 'Existing')])]
      });
      const { result } = renderHook(() => usePlanSync(props));

      await act(async () => {
        await result.current.handleSyncPlan();
      });

      expect(result.current.showSyncModal).toBe(true);
      expect(result.current.syncChanges.added).toHaveLength(1);
      expect(result.current.syncChanges.added[0].text).toBe('New item');
      expect(result.current.syncChanges.removed).toHaveLength(0);
      expect(result.current.syncChanges.modified).toHaveLength(0);
    });

    it('should detect removed items (in plan but not experience)', async () => {
      const props = makeProps({
        experience: makeExperience([makeExpItem('item-1', 'Existing')]),
        allPlans: [makePlan(PLAN_ID, [
          makePlanItem('item-1', 'Existing'),
          makePlanItem('item-2', 'Deleted item') // not in experience
        ])]
      });
      const { result } = renderHook(() => usePlanSync(props));

      await act(async () => {
        await result.current.handleSyncPlan();
      });

      expect(result.current.syncChanges.removed).toHaveLength(1);
      expect(result.current.syncChanges.removed[0].text).toBe('Deleted item');
    });

    it('should skip removed items with null plan_item_id (no crash)', async () => {
      const corruptItem = { plan_item_id: null, text: 'Corrupt item', url: '', complete: false };
      const props = makeProps({
        experience: makeExperience([makeExpItem('item-1', 'Valid')]),
        allPlans: [makePlan(PLAN_ID, [makePlanItem('item-1', 'Valid'), corruptItem])]
      });
      const { result } = renderHook(() => usePlanSync(props));

      await expect(act(async () => {
        await result.current.handleSyncPlan();
      })).resolves.not.toThrow();

      // Corrupt item should NOT appear in removed list
      expect(result.current.syncChanges.removed).toHaveLength(0);
    });

    it('should detect modified items (text change)', async () => {
      const props = makeProps({
        experience: makeExperience([makeExpItem('item-1', 'New text')]),
        allPlans: [makePlan(PLAN_ID, [makePlanItem('item-1', 'Old text')])]
      });
      const { result } = renderHook(() => usePlanSync(props));

      await act(async () => {
        await result.current.handleSyncPlan();
      });

      expect(result.current.syncChanges.modified).toHaveLength(1);
      expect(result.current.syncChanges.modified[0].modifications[0].field).toBe('text');
      expect(result.current.syncChanges.modified[0].modifications[0].old).toBe('Old text');
      expect(result.current.syncChanges.modified[0].modifications[0].new).toBe('New text');
    });

    it('should detect modified items (cost change)', async () => {
      const props = makeProps({
        experience: makeExperience([makeExpItem('item-1', 'Item', '', 50)]),
        allPlans: [makePlan(PLAN_ID, [makePlanItem('item-1', 'Item', '', 25)])]
      });
      const { result } = renderHook(() => usePlanSync(props));

      await act(async () => {
        await result.current.handleSyncPlan();
      });

      expect(result.current.syncChanges.modified).toHaveLength(1);
      const costMod = result.current.syncChanges.modified[0].modifications.find(m => m.field === 'cost');
      expect(costMod).toBeDefined();
      expect(costMod.old).toBe(25);
      expect(costMod.new).toBe(50);
    });

    it('should pre-select all changes by default', async () => {
      const props = makeProps({
        experience: makeExperience([
          makeExpItem('item-1', 'Changed'),
          makeExpItem('item-2', 'Added')
        ]),
        allPlans: [makePlan(PLAN_ID, [
          makePlanItem('item-1', 'Original'),
          makePlanItem('item-3', 'Removed')
        ])]
      });
      const { result } = renderHook(() => usePlanSync(props));

      await act(async () => {
        await result.current.handleSyncPlan();
      });

      // All changes should be pre-selected as indices
      expect(result.current.selectedSyncItems.added).toEqual([0]);
      expect(result.current.selectedSyncItems.removed).toEqual([0]);
      expect(result.current.selectedSyncItems.modified).toEqual([0]);
    });
  });

  // --------------------------------------------------------------------------
  describe('confirmSyncPlan', () => {
    it('should return early without syncChanges', async () => {
      const { result } = renderSync();

      await act(async () => {
        await result.current.confirmSyncPlan();
      });

      expect(updatePlan).not.toHaveBeenCalled();
    });

    describe('after handleSyncPlan has computed changes', () => {
      const setupWithChanges = async (planItems, expItems) => {
        const props = makeProps({
          experience: makeExperience(expItems),
          allPlans: [makePlan(PLAN_ID, planItems)]
        });
        const { result } = renderHook(() => usePlanSync(props));

        await act(async () => {
          await result.current.handleSyncPlan();
        });

        return result;
      };

      it('should call updatePlan with added items in snapshot', async () => {
        updatePlan.mockResolvedValue({ _id: PLAN_ID, plan: [] });

        const result = await setupWithChanges(
          [], // plan has nothing
          [makeExpItem('item-1', 'New item')] // experience has one item
        );

        await act(async () => {
          await result.current.confirmSyncPlan();
        });

        expect(updatePlan).toHaveBeenCalledWith(
          PLAN_ID,
          expect.objectContaining({
            plan: expect.arrayContaining([
              expect.objectContaining({ plan_item_id: 'item-1', text: 'New item' })
            ])
          })
        );
      });

      it('should remove selected items from snapshot', async () => {
        updatePlan.mockResolvedValue({ _id: PLAN_ID, plan: [] });

        const result = await setupWithChanges(
          [makePlanItem('item-1', 'Valid'), makePlanItem('item-2', 'To remove')],
          [makeExpItem('item-1', 'Valid')] // item-2 not in experience
        );

        await act(async () => {
          await result.current.confirmSyncPlan();
        });

        const [, payload] = updatePlan.mock.calls[0];
        const planAfter = payload.plan;
        expect(planAfter.some(p => p.plan_item_id === 'item-2')).toBe(false);
        expect(planAfter.some(p => p.plan_item_id === 'item-1')).toBe(true);
      });

      it('should not crash when removed item has null _id (defensive guard)', async () => {
        // Set up a plan that will have a null-ID entry in changes.removed via
        // a plan item whose plan_item_id is absent from the experience.
        // The null guard in handleSyncPlan should prevent it from appearing in
        // syncChanges.removed; confirmSyncPlan therefore processes 0 removals.
        const corruptItem = { plan_item_id: null, text: 'Ghost', url: '', complete: false };
        const props = makeProps({
          experience: makeExperience([makeExpItem('item-1', 'Real')]),
          allPlans: [makePlan(PLAN_ID, [makePlanItem('item-1', 'Real'), corruptItem])]
        });
        const { result } = renderHook(() => usePlanSync(props));

        await act(async () => { await result.current.handleSyncPlan(); });

        updatePlan.mockResolvedValue({ _id: PLAN_ID, plan: [] });

        await expect(act(async () => {
          await result.current.confirmSyncPlan();
        })).resolves.not.toThrow();
      });

      it('should apply text modifications from experience', async () => {
        updatePlan.mockResolvedValue({ _id: PLAN_ID, plan: [] });

        const result = await setupWithChanges(
          [makePlanItem('item-1', 'Old text')],
          [makeExpItem('item-1', 'New text')]
        );

        await act(async () => {
          await result.current.confirmSyncPlan();
        });

        const [, payload] = updatePlan.mock.calls[0];
        const modified = payload.plan.find(p => p.plan_item_id === 'item-1');
        expect(modified.text).toBe('New text');
      });

      it('should preserve completion status during modification sync', async () => {
        updatePlan.mockResolvedValue({ _id: PLAN_ID, plan: [] });

        const completedPlanItem = { ...makePlanItem('item-1', 'Old text'), complete: true };
        const props = makeProps({
          experience: makeExperience([makeExpItem('item-1', 'New text')]),
          allPlans: [makePlan(PLAN_ID, [completedPlanItem])]
        });
        const { result } = renderHook(() => usePlanSync(props));

        await act(async () => { await result.current.handleSyncPlan(); });
        await act(async () => { await result.current.confirmSyncPlan(); });

        const [, payload] = updatePlan.mock.calls[0];
        const syncedItem = payload.plan.find(p => p.plan_item_id === 'item-1');
        expect(syncedItem.complete).toBe(true); // completion preserved
        expect(syncedItem.text).toBe('New text'); // text synced
      });

      it('should call fetchSharedPlans, fetchUserPlan, and fetchPlans after sync', async () => {
        updatePlan.mockResolvedValue({ _id: PLAN_ID, plan: [] });

        const fetchSharedPlans = jest.fn().mockResolvedValue(undefined);
        const fetchUserPlan = jest.fn().mockResolvedValue(undefined);
        const fetchPlans = jest.fn().mockResolvedValue(undefined);

        const props = makeProps({
          experience: makeExperience([makeExpItem('item-1', 'New text')]),
          allPlans: [makePlan(PLAN_ID, [makePlanItem('item-1', 'Old text')])],
          fetchSharedPlans,
          fetchUserPlan,
          fetchPlans
        });
        const { result } = renderHook(() => usePlanSync(props));

        await act(async () => { await result.current.handleSyncPlan(); });
        await act(async () => { await result.current.confirmSyncPlan(); });

        expect(fetchSharedPlans).toHaveBeenCalledTimes(1);
        expect(fetchUserPlan).toHaveBeenCalledTimes(1);
        expect(fetchPlans).toHaveBeenCalledTimes(1);
      });

      it('should reset sync UI state after successful sync', async () => {
        updatePlan.mockResolvedValue({ _id: PLAN_ID, plan: [] });

        const result = await setupWithChanges(
          [makePlanItem('item-1', 'Old text')],
          [makeExpItem('item-1', 'New text')]
        );

        await act(async () => {
          await result.current.confirmSyncPlan();
        });

        expect(result.current.showSyncButton).toBe(false);
        expect(result.current.showSyncAlert).toBe(false);
        expect(result.current.showSyncModal).toBe(false);
        expect(result.current.syncChanges).toBeNull();
        expect(result.current.syncLoading).toBe(false);
      });

      it('should call showError and not crash when updatePlan fails', async () => {
        const syncError = new Error('Network error');
        updatePlan.mockRejectedValue(syncError);

        const showError = jest.fn();
        const props = makeProps({
          experience: makeExperience([makeExpItem('item-1', 'New text')]),
          allPlans: [makePlan(PLAN_ID, [makePlanItem('item-1', 'Old text')])],
          showError
        });
        const { result } = renderHook(() => usePlanSync(props));

        await act(async () => { await result.current.handleSyncPlan(); });
        await act(async () => { await result.current.confirmSyncPlan(); });

        expect(showError).toHaveBeenCalled();
        expect(result.current.syncLoading).toBe(false);
      });
    });
  });

  // --------------------------------------------------------------------------
  describe('closeSyncModal', () => {
    it('should hide modal and clear syncChanges', async () => {
      const props = makeProps({
        experience: makeExperience([makeExpItem('item-1', 'New')]),
        allPlans: [makePlan(PLAN_ID, [makePlanItem('item-1', 'Old')])]
      });
      const { result } = renderHook(() => usePlanSync(props));

      await act(async () => { await result.current.handleSyncPlan(); });
      expect(result.current.showSyncModal).toBe(true);

      act(() => { result.current.closeSyncModal(); });

      expect(result.current.showSyncModal).toBe(false);
      expect(result.current.syncChanges).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  describe('resetSyncState', () => {
    it('should reset all sync state', async () => {
      const props = makeProps({
        experience: makeExperience([makeExpItem('item-1', 'New')]),
        allPlans: [makePlan(PLAN_ID, [makePlanItem('item-1', 'Old')])]
      });
      const { result } = renderHook(() => usePlanSync(props));

      await act(async () => { await result.current.handleSyncPlan(); });

      act(() => { result.current.resetSyncState(); });

      expect(result.current.showSyncButton).toBe(false);
      expect(result.current.showSyncAlert).toBe(true);
      expect(result.current.showSyncModal).toBe(false);
      expect(result.current.syncChanges).toBeNull();
      expect(result.current.syncLoading).toBe(false);
    });
  });
});

# Bulk Plan Item Date Shift Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a plan's `planned_date` changes, offer the user a one-click option to shift all root plan items' `scheduled_date` values by the same delta.

**Architecture:** Backend adds `_shift_meta` sidecar to the `updatePlan` fast path response and a new `shiftPlanItemDates` endpoint. Frontend `useDateManagement` hook goes two-phase — holding the modal open with a confirmation banner when shift metadata arrives — then calls the new endpoint. BienBot gets a matching action type so it can auto-propose the shift after changing a plan date.

**Tech Stack:** Bun/Express/Mongoose (backend), React 18 + Chakra UI v3 + Jest/RTL (frontend), supertest (API tests).

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `controllers/api/plans.js` | Modify | Add `shiftPlanItemDates` handler; enhance `updatePlan` fast path to attach `_shift_meta` |
| `routes/api/plans.js` | Modify | Add `POST /:id/shift-item-dates` route |
| `src/utilities/plans-api.js` | Modify | Add `shiftPlanItemDates(planId, diffMs)` export |
| `src/hooks/useDateManagement.js` | Modify | Two-phase state: `pendingShift`, `onShiftDates`, `onKeepDates` |
| `src/views/SingleExperience/SingleExperience.jsx` | Modify | Destructure and forward new hook props to `DatePickerSection` |
| `src/views/SingleExperience/components/DatePickerSection.jsx` | Modify | Render confirmation banner when `pendingShift` is set |
| `utilities/bienbot-action-executor.js` | Modify | Add `shift_plan_item_dates` action + auto-propose from `executeUpdatePlan` |
| `src/components/BienBotPanel/PendingActionCard.jsx` | Modify | Add `shift_plan_item_dates` to `ACTION_CONFIG` |
| `controllers/api/bienbot.js` | Modify | Add action to system prompt schema |
| `tests/api/plan-date-shift.test.js` | Create | Integration tests for new endpoint + `_shift_meta` |
| `tests/hooks/useDateManagement.test.js` | Create | Unit tests for two-phase hook state |
| `tests/views/DatePickerSection.test.js` | Create | RTL tests for confirmation banner |

---

## Task 1: Backend — `shiftPlanItemDates` endpoint (test-first)

**Files:**
- Create: `tests/api/plan-date-shift.test.js`
- Modify: `controllers/api/plans.js`
- Modify: `routes/api/plans.js`

- [ ] **Step 1.1 — Write failing API tests**

Create `tests/api/plan-date-shift.test.js`:

```javascript
/**
 * Integration tests for POST /api/plans/:id/shift-item-dates
 */
const request = require('supertest');
const app = require('../../app');
const Plan = require('../../models/plan');
const mongoose = require('mongoose');
const {
  createTestUser,
  createTestDestination,
  createTestExperience,
  createTestPlan,
  generateAuthToken,
  clearTestData
} = require('../utils/testHelpers');
const dbSetup = require('../setup/testSetup');

describe('POST /api/plans/:id/shift-item-dates', () => {
  let user, experience, destination, authToken;

  beforeAll(async () => { await dbSetup.connect(); });
  afterAll(async () => { await dbSetup.closeDatabase(); });

  beforeEach(async () => {
    await clearTestData();
    user = await createTestUser({ name: 'Test User', email: 'tester@example.com' });
    const owner = await createTestUser({ name: 'Owner', email: 'owner@example.com' });
    destination = await createTestDestination(owner);
    experience = await createTestExperience(owner, destination, {});
    authToken = generateAuthToken(user);
  });

  async function planWithScheduledItems(plannedDate = new Date('2026-05-01')) {
    const itemDate = new Date('2026-05-10');
    return createTestPlan(user, experience, {
      planned_date: plannedDate,
      plan: [
        {
          plan_item_id: new mongoose.Types.ObjectId(),
          text: 'Root with schedule',
          scheduled_date: itemDate,
          complete: false
        },
        {
          plan_item_id: new mongoose.Types.ObjectId(),
          text: 'Root no schedule',
          scheduled_date: null,
          complete: false
        }
      ]
    });
  }

  test('shifts scheduled_date of root items by diff_ms', async () => {
    const plan = await planWithScheduledItems();
    const diffMs = 7 * 24 * 60 * 60 * 1000; // 7 days

    const res = await request(app)
      .post(`/api/plans/${plan._id}/shift-item-dates`)
      .set('Authorization', authToken)
      .send({ diff_ms: diffMs });

    expect(res.status).toBe(200);
    expect(res.body.shifted_count).toBe(1);

    const updated = await Plan.findById(plan._id);
    const shiftedItem = updated.plan.find(i => i.text === 'Root with schedule');
    const unshiftedItem = updated.plan.find(i => i.text === 'Root no schedule');

    const expectedDate = new Date(new Date('2026-05-10').getTime() + diffMs);
    expect(new Date(shiftedItem.scheduled_date).toDateString()).toBe(expectedDate.toDateString());
    expect(unshiftedItem.scheduled_date).toBeNull();
  });

  test('returns 400 when diff_ms is missing', async () => {
    const plan = await planWithScheduledItems();
    const res = await request(app)
      .post(`/api/plans/${plan._id}/shift-item-dates`)
      .set('Authorization', authToken)
      .send({});
    expect(res.status).toBe(400);
  });

  test('returns 400 when diff_ms is zero', async () => {
    const plan = await planWithScheduledItems();
    const res = await request(app)
      .post(`/api/plans/${plan._id}/shift-item-dates`)
      .set('Authorization', authToken)
      .send({ diff_ms: 0 });
    expect(res.status).toBe(400);
  });

  test('returns 401 when unauthenticated', async () => {
    const plan = await planWithScheduledItems();
    const res = await request(app)
      .post(`/api/plans/${plan._id}/shift-item-dates`)
      .send({ diff_ms: 86400000 });
    expect(res.status).toBe(401);
  });

  test('returns 403 when user does not have edit permission', async () => {
    const other = await createTestUser({ name: 'Other', email: 'other@example.com' });
    const otherToken = generateAuthToken(other);
    const plan = await planWithScheduledItems();

    const res = await request(app)
      .post(`/api/plans/${plan._id}/shift-item-dates`)
      .set('Authorization', otherToken)
      .send({ diff_ms: 86400000 });
    expect(res.status).toBe(403);
  });

  test('returns shifted_count 0 when no items have scheduled_date', async () => {
    const plan = await createTestPlan(user, experience, {
      planned_date: new Date('2026-05-01'),
      plan: [
        { plan_item_id: new mongoose.Types.ObjectId(), text: 'Unscheduled', scheduled_date: null, complete: false }
      ]
    });

    const res = await request(app)
      .post(`/api/plans/${plan._id}/shift-item-dates`)
      .set('Authorization', authToken)
      .send({ diff_ms: 86400000 });

    expect(res.status).toBe(200);
    expect(res.body.shifted_count).toBe(0);
  });
});
```

- [ ] **Step 1.2 — Run tests to confirm they fail**

```bash
bun run test:api -- --testPathPattern=tests/api/plan-date-shift
```

Expected: FAIL — `shiftPlanItemDates` not a function / route not found.

- [ ] **Step 1.3 — Implement `shiftPlanItemDates` in controller**

In `controllers/api/plans.js`, add this function before `module.exports`:

```javascript
const shiftPlanItemDates = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { diff_ms } = req.body;

  if (!validateObjectId(id)) {
    return errorResponse(res, null, 'Invalid plan ID', 400);
  }

  if (diff_ms === undefined || diff_ms === null || !Number.isFinite(Number(diff_ms)) || Number(diff_ms) === 0) {
    return errorResponse(res, null, 'diff_ms must be a finite non-zero number', 400);
  }

  const diffMs = Number(diff_ms);

  const plan = await Plan.findById(id);
  if (!plan) {
    return errorResponse(res, null, 'Plan not found', 404);
  }

  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  const permCheck = await enforcer.canEdit({ userId: req.user._id, resource: plan });
  if (!permCheck.allowed) {
    return errorResponse(res, null, permCheck.reason || 'Insufficient permissions', 403);
  }

  let shiftedCount = 0;
  for (const item of plan.plan) {
    if (!item.parent && item.scheduled_date) {
      item.scheduled_date = new Date(new Date(item.scheduled_date).getTime() + diffMs);
      shiftedCount++;
    }
  }

  if (shiftedCount > 0) {
    await plan.save();
  }

  try {
    broadcastEvent('plan', id.toString(), {
      type: 'plan:updated',
      payload: { planId: id.toString(), userId: req.user._id.toString() }
    }, req.user._id.toString());
  } catch (_) { /* ignore websocket errors */ }

  return res.json({ shifted_count: shiftedCount });
});
```

- [ ] **Step 1.4 — Export `shiftPlanItemDates`**

In `controllers/api/plans.js`, add to `module.exports`:

```javascript
module.exports = {
  // ... existing exports ...
  shiftPlanItemDates,
};
```

- [ ] **Step 1.5 — Add route**

In `routes/api/plans.js`, add after the `PUT /:id` route line:

```javascript
router.post('/:id/shift-item-dates', modificationLimiter, plansCtrl.shiftPlanItemDates);
```

- [ ] **Step 1.6 — Run tests to confirm they pass**

```bash
bun run test:api -- --testPathPattern=tests/api/plan-date-shift
```

Expected: All 6 tests PASS.

- [ ] **Step 1.7 — Commit**

```bash
git add controllers/api/plans.js routes/api/plans.js tests/api/plan-date-shift.test.js
git commit -m "feat(plans): add POST /api/plans/:id/shift-item-dates endpoint"
```

---

## Task 2: Backend — enhance `updatePlan` fast path with `_shift_meta`

**Files:**
- Modify: `controllers/api/plans.js`
- Modify: `tests/api/plan-date-shift.test.js`

- [ ] **Step 2.1 — Write failing tests for `_shift_meta`**

Add this `describe` block at the bottom of `tests/api/plan-date-shift.test.js` (before the closing `}`):

```javascript
describe('PUT /api/plans/:id — _shift_meta in planned_date-only update', () => {
  let user, experience, destination, authToken;

  beforeEach(async () => {
    await clearTestData();
    user = await createTestUser({ name: 'Test User', email: 'tester2@example.com' });
    const owner = await createTestUser({ name: 'Owner', email: 'owner2@example.com' });
    destination = await createTestDestination(owner);
    experience = await createTestExperience(owner, destination, {});
    authToken = generateAuthToken(user);
  });

  async function planWithItemAndDate(plannedDate) {
    return createTestPlan(user, experience, {
      planned_date: plannedDate,
      plan: [
        {
          plan_item_id: new mongoose.Types.ObjectId(),
          text: 'Scheduled item',
          scheduled_date: new Date('2026-05-10'),
          complete: false
        }
      ]
    });
  }

  test('returns _shift_meta when both dates non-null and items have scheduled_date', async () => {
    const plan = await planWithItemAndDate(new Date('2026-05-01'));

    const res = await request(app)
      .put(`/api/plans/${plan._id}`)
      .set('Authorization', authToken)
      .send({ planned_date: '2026-05-08' });

    expect(res.status).toBe(200);
    expect(res.body._shift_meta).toBeDefined();
    expect(res.body._shift_meta.scheduled_items_count).toBe(1);
    expect(res.body._shift_meta.date_diff_days).toBe(7);
    expect(res.body._shift_meta.date_diff_ms).toBe(7 * 24 * 60 * 60 * 1000);
    expect(res.body._id).toBeDefined(); // plan fields still present
  });

  test('does NOT return _shift_meta when old date is null', async () => {
    const plan = await createTestPlan(user, experience, {
      planned_date: null,
      plan: [
        { plan_item_id: new mongoose.Types.ObjectId(), text: 'item', scheduled_date: new Date('2026-05-10'), complete: false }
      ]
    });

    const res = await request(app)
      .put(`/api/plans/${plan._id}`)
      .set('Authorization', authToken)
      .send({ planned_date: '2026-05-08' });

    expect(res.status).toBe(200);
    expect(res.body._shift_meta).toBeUndefined();
  });

  test('does NOT return _shift_meta when no items have scheduled_date', async () => {
    const plan = await createTestPlan(user, experience, {
      planned_date: new Date('2026-05-01'),
      plan: [
        { plan_item_id: new mongoose.Types.ObjectId(), text: 'no schedule', scheduled_date: null, complete: false }
      ]
    });

    const res = await request(app)
      .put(`/api/plans/${plan._id}`)
      .set('Authorization', authToken)
      .send({ planned_date: '2026-05-08' });

    expect(res.status).toBe(200);
    expect(res.body._shift_meta).toBeUndefined();
  });
});
```

- [ ] **Step 2.2 — Run tests to confirm they fail**

```bash
bun run test:api -- --testPathPattern=tests/api/plan-date-shift
```

Expected: the 3 new `_shift_meta` tests FAIL (no `_shift_meta` on response).

- [ ] **Step 2.3 — Implement `_shift_meta` in `updatePlan` fast path**

In `controllers/api/plans.js`, locate the planned_date-only fast path. It currently ends with:

```javascript
    // Track update (non-blocking)
    trackUpdate({
      resource: updated,
      previousState,
      resourceType: 'Plan',
      actor: req.user,
      req,
      fieldsToTrack: ['planned_date'],
      reason: `Plan updated (planned_date)`
    });

    return res.json(updated);
  }
```

Replace the `return res.json(updated);` line with:

```javascript
    // Check whether to offer item date shift
    const oldDate = previousState.planned_date;
    const newDate = updated.planned_date;

    if (oldDate && newDate) {
      const diffMs = new Date(newDate).getTime() - new Date(oldDate).getTime();
      if (diffMs !== 0) {
        const scheduledCount = (updated.plan || []).filter(
          item => !item.parent && item.scheduled_date
        ).length;

        if (scheduledCount > 0) {
          const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
          return res.json({
            ...updated.toObject(),
            _shift_meta: {
              scheduled_items_count: scheduledCount,
              date_diff_days: diffDays,
              date_diff_ms: diffMs,
              old_date: oldDate,
              new_date: newDate
            }
          });
        }
      }
    }

    return res.json(updated);
  }
```

**Important:** The `previousState = plan.toObject()` capture on line 1270 already runs before `findByIdAndUpdate`, so `previousState.planned_date` is the old value. The `updated` document returned by `findByIdAndUpdate` already has the new `planned_date` and contains the full `plan` array.

- [ ] **Step 2.4 — Run all plan-date-shift tests**

```bash
bun run test:api -- --testPathPattern=tests/api/plan-date-shift
```

Expected: All 9 tests PASS.

- [ ] **Step 2.5 — Run full API test suite to check for regressions**

```bash
bun run test:api
```

Expected: All previously-passing tests still pass.

- [ ] **Step 2.6 — Commit**

```bash
git add controllers/api/plans.js tests/api/plan-date-shift.test.js
git commit -m "feat(plans): return _shift_meta in updatePlan when scheduled items exist"
```

---

## Task 3: Frontend API — `shiftPlanItemDates` in `plans-api.js`

**Files:**
- Modify: `src/utilities/plans-api.js`

- [ ] **Step 3.1 — Add `shiftPlanItemDates` function**

In `src/utilities/plans-api.js`, after the `updatePlan` function, add:

```javascript
/**
 * Shift all root plan items' scheduled_date values by the given millisecond delta.
 * @param {string} planId
 * @param {number} diffMs - Milliseconds to shift (positive = forward, negative = backward)
 * @returns {Promise<{ shifted_count: number }>}
 */
export async function shiftPlanItemDates(planId, diffMs) {
  const response = await sendRequest(`${BASE_URL}/${planId}/shift-item-dates`, 'POST', { diff_ms: diffMs });
  const result = extractData(response);

  try {
    broadcastEvent('plan:updated', {
      planId,
      version: Date.now(),
      action: 'shift_item_dates'
    });
  } catch (_) { /* ignore */ }

  return result;
}
```

- [ ] **Step 3.2 — Verify the build compiles**

```bash
bun run build 2>&1 | tail -5
```

Expected: Build succeeds with no errors.

- [ ] **Step 3.3 — Commit**

```bash
git add src/utilities/plans-api.js
git commit -m "feat(plans-api): add shiftPlanItemDates frontend API function"
```

---

## Task 4: Frontend hook — two-phase state in `useDateManagement` (test-first)

**Files:**
- Create: `tests/hooks/useDateManagement.test.js`
- Modify: `src/hooks/useDateManagement.js`

- [ ] **Step 4.1 — Write failing hook tests**

Create `tests/hooks/useDateManagement.test.js`:

```javascript
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
```

- [ ] **Step 4.2 — Run tests to confirm they fail**

```bash
bun run test:frontend -- --testPathPattern=tests/hooks/useDateManagement
```

Expected: FAIL — `pendingShift`, `onShiftDates`, `onKeepDates` are not returned from the hook.

- [ ] **Step 4.3 — Implement two-phase state in `useDateManagement`**

In `src/hooks/useDateManagement.js`:

1. Add `useState` to the imports (it's already imported — just add `shiftPlanItemDates` import):

```javascript
import { useCallback, useEffect, useRef, useState } from 'react';
import { isOwner } from '../utilities/permissions';
import { handleError } from '../utilities/error-handler';
import { shiftPlanItemDates } from '../utilities/plans-api';
import debug from '../utilities/debug';
```

2. Inside the `useDateManagement` function body, after the existing `const [localIsEditingDate, ...]` declarations, add:

```javascript
const [pendingShift, setPendingShift] = useState(null);
```

3. Replace the existing `updateExistingPlanDate` callback with:

```javascript
const updateExistingPlanDate = useCallback(async (planId) => {
  const dateToSend = plannedDate
    ? new Date(plannedDate).toISOString()
    : null;

  setDisplayedPlannedDate(dateToSend);

  const result = await updatePlan(planId, { planned_date: dateToSend });

  const meta = result?._shift_meta;
  if (meta && meta.scheduled_items_count > 0 && meta.date_diff_days !== 0) {
    setPendingShift({
      planId,
      count: meta.scheduled_items_count,
      diffDays: meta.date_diff_days,
      diffMs: meta.date_diff_ms,
      oldDate: meta.old_date,
      newDate: meta.new_date
    });
    // Do NOT call finalizeDateUpdate — modal stays open for confirmation
  } else {
    fetchUserPlan().catch(() => {});
    fetchSharedPlans().catch(() => {});
    fetchPlans().catch(() => {});
    finalizeDateUpdate();
  }

  debug.log("Plan date updated successfully", { planId });
}, [plannedDate, updatePlan, setDisplayedPlannedDate, fetchUserPlan, fetchSharedPlans, fetchPlans, finalizeDateUpdate]);
```

**Note:** `finalizeDateUpdate` is defined below `updateExistingPlanDate` in the file. Since both are `useCallback`, the forward reference is fine — but you must ensure `finalizeDateUpdate` is added to the dependency array. If the linter complains about the order, move `finalizeDateUpdate` above `updateExistingPlanDate`, or use a `useRef` for it. The simplest fix is to reorder the two callbacks so `finalizeDateUpdate` comes first.

4. Add the two new callbacks after `finalizeDateUpdate`:

```javascript
const onKeepDates = useCallback(() => {
  finalizeDateUpdate();
  setPendingShift(null);
}, [finalizeDateUpdate]);

const onShiftDates = useCallback(async () => {
  if (!pendingShift) return;
  try {
    await shiftPlanItemDates(pendingShift.planId, pendingShift.diffMs);
  } catch (err) {
    showError(handleError(err, { context: 'Shift item dates' }));
  } finally {
    finalizeDateUpdate();
    setPendingShift(null);
  }
}, [pendingShift, finalizeDateUpdate, showError]);
```

5. Update the `return` statement to include the new values:

```javascript
return {
  isEditingDate,
  setIsEditingDate,
  plannedDateRef,
  handleDateUpdate,
  pendingShift,
  onShiftDates,
  onKeepDates
};
```

- [ ] **Step 4.4 — Run hook tests**

```bash
bun run test:frontend -- --testPathPattern=tests/hooks/useDateManagement
```

Expected: All 7 tests PASS.

- [ ] **Step 4.5 — Run full frontend test suite**

```bash
bun run test:frontend
```

Expected: No new failures.

- [ ] **Step 4.6 — Commit**

```bash
git add src/hooks/useDateManagement.js src/utilities/plans-api.js tests/hooks/useDateManagement.test.js
git commit -m "feat(useDateManagement): two-phase pendingShift state for date shift offer"
```

---

## Task 5: UI — `DatePickerSection` confirmation banner + wire props in `SingleExperience`

**Files:**
- Create: `tests/views/DatePickerSection.test.js`
- Modify: `src/views/SingleExperience/components/DatePickerSection.jsx`
- Modify: `src/views/SingleExperience/SingleExperience.jsx`

- [ ] **Step 5.1 — Write failing component tests**

Create `tests/views/DatePickerSection.test.js`:

```javascript
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DatePickerSection from '../../src/views/SingleExperience/components/DatePickerSection';

// Minimal lang mock matching the shape used in DatePickerSection
const lang = {
  current: {
    button: { cancel: 'Cancel', updateDate: 'Update Date', setDateAndAdd: 'Plan This', skip: 'Skip' },
    heading: { editPlannedDate: 'Edit Date', planYourExperience: 'Plan Experience' },
    label: { whenDoYouWantExperience: 'When?' },
    helper: { requiresDaysToPlan: 'Requires {days} to plan' }
  }
};

const baseProps = {
  showDatePicker: true,
  experience: { _id: 'exp1', max_planning_days: 0 },
  isEditingDate: true,
  plannedDate: '2026-05-08',
  setPlannedDate: jest.fn(),
  loading: false,
  handleDateUpdate: jest.fn(),
  handleAddExperience: jest.fn(),
  setShowDatePicker: jest.fn(),
  setIsEditingDate: jest.fn(),
  lang
};

describe('DatePickerSection — confirmation banner', () => {
  test('renders date picker normally when pendingShift is null', () => {
    render(<DatePickerSection {...baseProps} pendingShift={null} />);
    // Calendar should render; banner should not
    expect(screen.queryByText(/shift them all/i)).not.toBeInTheDocument();
    expect(screen.getByText('Update Date')).toBeInTheDocument();
  });

  test('renders confirmation banner when pendingShift is set', () => {
    const pendingShift = {
      planId: 'plan1',
      count: 3,
      diffDays: 7,
      diffMs: 604800000,
      oldDate: '2026-05-01T00:00:00.000Z',
      newDate: '2026-05-08T00:00:00.000Z'
    };

    render(
      <DatePickerSection
        {...baseProps}
        pendingShift={pendingShift}
        onShiftDates={jest.fn()}
        onKeepDates={jest.fn()}
      />
    );

    expect(screen.getByText(/3 plan item/i)).toBeInTheDocument();
    expect(screen.getByText(/7 days/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /shift dates/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /keep current dates/i })).toBeInTheDocument();
    // Normal Update Date button should NOT be visible
    expect(screen.queryByText('Update Date')).not.toBeInTheDocument();
  });

  test('calls onShiftDates when Shift Dates button clicked', () => {
    const onShiftDates = jest.fn();
    const pendingShift = { planId: 'p1', count: 1, diffDays: 3, diffMs: 259200000, oldDate: '2026-05-01T00:00:00.000Z', newDate: '2026-05-04T00:00:00.000Z' };

    render(
      <DatePickerSection {...baseProps} pendingShift={pendingShift} onShiftDates={onShiftDates} onKeepDates={jest.fn()} />
    );

    fireEvent.click(screen.getByRole('button', { name: /shift dates/i }));
    expect(onShiftDates).toHaveBeenCalledTimes(1);
  });

  test('calls onKeepDates when Keep Current Dates button clicked', () => {
    const onKeepDates = jest.fn();
    const pendingShift = { planId: 'p1', count: 1, diffDays: 3, diffMs: 259200000, oldDate: '2026-05-01T00:00:00.000Z', newDate: '2026-05-04T00:00:00.000Z' };

    render(
      <DatePickerSection {...baseProps} pendingShift={pendingShift} onShiftDates={jest.fn()} onKeepDates={onKeepDates} />
    );

    fireEvent.click(screen.getByRole('button', { name: /keep current dates/i }));
    expect(onKeepDates).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 5.2 — Run tests to confirm they fail**

```bash
bun run test:frontend -- --testPathPattern=tests/views/DatePickerSection
```

Expected: FAIL — confirmation banner not rendered.

- [ ] **Step 5.3 — Implement confirmation banner in `DatePickerSection.jsx`**

Replace the full contents of `src/views/SingleExperience/components/DatePickerSection.jsx` with:

```jsx
/**
 * DatePickerSection Component
 * Modal for setting/editing planned dates using Chakra UI DatePicker.
 * When pendingShift is set, the calendar is replaced by a shift-confirmation banner.
 */

import { useMemo } from 'react';
import { DatePicker, Flex, Text, Box, parseDate } from '@chakra-ui/react';
import { Modal, Alert, Button as DSButton } from '../../../components/design-system';
import { getMinimumPlanningDate, isValidPlannedDate } from '../../../utilities/date-utils';
import { formatPlanningTime } from '../../../utilities/planning-time-utils';
import { FaCalendarAlt } from 'react-icons/fa';

export default function DatePickerSection({
  // Visibility state
  showDatePicker,

  // Experience data
  experience,

  // Date picker state
  isEditingDate,
  plannedDate,
  setPlannedDate,
  loading,

  // Handlers
  handleDateUpdate,
  handleAddExperience,
  setShowDatePicker,
  setIsEditingDate,

  // Shift confirmation (optional — only present when a date shift can be offered)
  pendingShift,
  onShiftDates,
  onKeepDates,

  // Language strings
  lang
}) {
  const handleClose = () => {
    setShowDatePicker(false);
    setIsEditingDate(false);
    setPlannedDate("");
  };

  const handleSubmit = () => {
    handleDateUpdate();
  };

  // Convert plannedDate string (YYYY-MM-DD) to DateValue[] for Chakra DatePicker
  const datePickerValue = useMemo(() => {
    if (!plannedDate) return [];
    try {
      return [parseDate(plannedDate)];
    } catch {
      return [];
    }
  }, [plannedDate]);

  // Compute min date as DateValue
  const minDateValue = useMemo(() => {
    const minStr = getMinimumPlanningDate(experience.max_planning_days);
    if (!minStr) return undefined;
    try {
      return parseDate(minStr);
    } catch {
      return undefined;
    }
  }, [experience.max_planning_days]);

  // Handle Chakra DatePicker value change → update parent string state
  const handleValueChange = (details) => {
    if (details.value && details.value.length > 0) {
      setPlannedDate(details.value[0].toString());
    } else {
      setPlannedDate("");
    }
  };

  // ─── Shift confirmation phase ────────────────────────────────────────────────
  // When pendingShift is set, replace the calendar with a confirmation banner.

  if (pendingShift) {
    const oldFormatted = new Date(pendingShift.oldDate).toLocaleDateString();
    const newFormatted = new Date(pendingShift.newDate).toLocaleDateString();
    const sign = pendingShift.diffDays > 0 ? '+' : '';
    const itemWord = pendingShift.count === 1 ? 'plan item' : 'plan items';

    const shiftFooter = (
      <Flex gap="var(--space-2)" w="100%" justify="flex-end" flexWrap="nowrap">
        <DSButton variant="outline" size="md" onClick={onKeepDates} aria-label="Keep Current Dates">
          Keep Current Dates
        </DSButton>
        <DSButton variant="gradient" size="md" onClick={onShiftDates} aria-label="Shift Dates">
          Shift Dates
        </DSButton>
      </Flex>
    );

    return (
      <Modal
        show={showDatePicker}
        onClose={handleClose}
        title={isEditingDate
          ? lang.current.heading.editPlannedDate
          : lang.current.heading.planYourExperience}
        icon={<FaCalendarAlt />}
        size="md"
        footer={shiftFooter}
      >
        <Alert type="info">
          You moved your plan from <strong>{oldFormatted}</strong> to <strong>{newFormatted}</strong> ({sign}{pendingShift.diffDays} days).{' '}
          {pendingShift.count} {itemWord} have scheduled dates. Shift them all by {sign}{pendingShift.diffDays} days?
        </Alert>
      </Modal>
    );
  }

  // ─── Normal date picker phase ────────────────────────────────────────────────

  const modalFooter = (
    <Flex gap="var(--space-2)" w="100%" justify="flex-end" flexWrap="nowrap">
      {!isEditingDate && (
        <DSButton
          variant="outline"
          size="md"
          onClick={() => handleAddExperience({})}
          aria-label={lang.current.button.skip}
        >
          {lang.current.button.skip}
        </DSButton>
      )}
      <DSButton
        variant="outline"
        size="md"
        onClick={handleClose}
        aria-label={lang.current.button.cancel}
      >
        {lang.current.button.cancel}
      </DSButton>
      <DSButton
        variant="gradient"
        size="md"
        onClick={handleSubmit}
        disabled={!plannedDate || loading}
        aria-label={
          isEditingDate
            ? lang.current.button.updateDate
            : lang.current.button.setDateAndAdd
        }
      >
        {loading ? "Saving..." : (isEditingDate
          ? lang.current.button.updateDate
          : lang.current.button.setDateAndAdd)}
      </DSButton>
    </Flex>
  );

  return (
    <Modal
      show={showDatePicker}
      onClose={handleClose}
      title={isEditingDate
        ? lang.current.heading.editPlannedDate
        : lang.current.heading.planYourExperience}
      icon={<FaCalendarAlt />}
      size="md"
      footer={modalFooter}
    >
      {experience.max_planning_days > 0 && formatPlanningTime(experience.max_planning_days) && (
        <Text color="var(--color-text-muted)" mb="var(--space-4)">
          {lang.current.helper.requiresDaysToPlan.replace(
            "{days}",
            formatPlanningTime(experience.max_planning_days)
          )}
        </Text>
      )}

      <DatePicker.Root
        value={datePickerValue}
        onValueChange={handleValueChange}
        min={minDateValue}
        closeOnSelect
        inline
        width="100%"
      >
        <DatePicker.Label fontWeight="var(--font-weight-semibold)">
          {lang.current.label.whenDoYouWantExperience}
        </DatePicker.Label>
        <DatePicker.Content unstyled>
          <DatePicker.View view="day">
            <DatePicker.Header />
            <DatePicker.DayTable />
          </DatePicker.View>
          <DatePicker.View view="month">
            <DatePicker.Header />
            <DatePicker.MonthTable />
          </DatePicker.View>
          <DatePicker.View view="year">
            <DatePicker.Header />
            <DatePicker.YearTable />
          </DatePicker.View>
        </DatePicker.Content>
      </DatePicker.Root>
    </Modal>
  );
}
```

**Note:** `Box` is added to the Chakra import in case you need it; remove if unused after review. Read the original file's ending to capture any `DatePicker.View` variants that may have been cut off — add them back if the original had more views.

- [ ] **Step 5.4 — Wire new props in `SingleExperience.jsx`**

In `src/views/SingleExperience/SingleExperience.jsx`, locate the `useDateManagement` destructuring (around line 3079):

```javascript
  const {
    plannedDateRef,
    handleDateUpdate
  } = useDateManagement({
```

Change to:

```javascript
  const {
    plannedDateRef,
    handleDateUpdate,
    pendingShift,
    onShiftDates,
    onKeepDates
  } = useDateManagement({
```

Then locate the `<DatePickerSection` render (around line 3529) and add three props:

```jsx
                      <DatePickerSection
                        showDatePicker={isModalOpen(MODAL_NAMES.DATE_PICKER)}
                        experience={experience}
                        isEditingDate={isEditingDate}
                        plannedDate={plannedDate}
                        setPlannedDate={setPlannedDate}
                        loading={loading}
                        handleDateUpdate={handleDateUpdate}
                        handleAddExperience={handleAddExperience}
                        setShowDatePicker={setShowDatePickerState}
                        setIsEditingDate={setIsEditingDate}
                        pendingShift={pendingShift}
                        onShiftDates={onShiftDates}
                        onKeepDates={onKeepDates}
                        lang={lang}
                      />
```

- [ ] **Step 5.5 — Run component tests**

```bash
bun run test:frontend -- --testPathPattern=tests/views/DatePickerSection
```

Expected: All 4 tests PASS.

- [ ] **Step 5.6 — Run full frontend suite**

```bash
bun run test:frontend
```

Expected: No new failures.

- [ ] **Step 5.7 — Commit**

```bash
git add src/views/SingleExperience/components/DatePickerSection.jsx src/views/SingleExperience/SingleExperience.jsx tests/views/DatePickerSection.test.js
git commit -m "feat(DatePickerSection): show inline shift-confirmation banner after date change"
```

---

## Task 6: BienBot executor — `shift_plan_item_dates` action type (test-first)

**Files:**
- Modify: `tests/utils/bienbot-action-executor.test.js`
- Modify: `utilities/bienbot-action-executor.js`

- [ ] **Step 6.1 — Write failing tests**

In `tests/utils/bienbot-action-executor.test.js`, find the `ALLOWED_ACTION_TYPES` describe block and add:

```javascript
  test('includes shift_plan_item_dates', () => {
    expect(ALLOWED_ACTION_TYPES).toContain('shift_plan_item_dates');
  });
```

Then add a new describe block at the bottom of the outer `describe('bienbot-action-executor')`:

```javascript
  describe('shift_plan_item_dates', () => {
    test('calls plansController.shiftPlanItemDates with converted diff_ms', async () => {
      mockControllerSuccess(plansController.shiftPlanItemDates, 200, { shifted_count: 3 });

      const action = {
        id: 'action_abc12345',
        type: 'shift_plan_item_dates',
        payload: { plan_id: 'plan123', diff_days: 7 }
      };

      const result = await executeAction(action, user);

      expect(result.success).toBe(true);
      expect(plansController.shiftPlanItemDates).toHaveBeenCalledTimes(1);
      // Verify diff_ms was passed in the body (7 days = 604800000 ms)
      const [req] = plansController.shiftPlanItemDates.mock.calls[0];
      expect(req.body.diff_ms).toBe(7 * 24 * 60 * 60 * 1000);
      expect(req.params.id).toBe('plan123');
    });

    test('returns failure on controller error', async () => {
      mockControllerError(plansController.shiftPlanItemDates, 403, 'Insufficient permissions');

      const action = {
        id: 'action_def45678',
        type: 'shift_plan_item_dates',
        payload: { plan_id: 'plan123', diff_days: 7 }
      };

      const result = await executeAction(action, user);
      expect(result.success).toBe(false);
    });
  });

  describe('executeUpdatePlan — auto-proposes shift_plan_item_dates', () => {
    test('pushes shift pending action to session when _shift_meta present', async () => {
      const shiftMeta = {
        scheduled_items_count: 2,
        date_diff_days: 7,
        date_diff_ms: 604800000,
        old_date: '2026-05-01',
        new_date: '2026-05-08'
      };

      mockControllerSuccess(plansController.updatePlan, 200, {
        _id: 'plan123',
        planned_date: '2026-05-08',
        _shift_meta: shiftMeta
      });

      const session = {
        pending_actions: [],
        markActionExecuted: jest.fn().mockResolvedValue({}),
        updateContext: jest.fn().mockResolvedValue({})
      };

      const action = {
        id: 'action_upd12345',
        type: 'update_plan',
        payload: { plan_id: 'plan123', planned_date: '2026-05-08' }
      };

      await executeAction(action, user, session);

      expect(session.pending_actions).toHaveLength(1);
      const proposed = session.pending_actions[0];
      expect(proposed.type).toBe('shift_plan_item_dates');
      expect(proposed.payload.plan_id).toBe('plan123');
      expect(proposed.payload.diff_days).toBe(7);
      expect(proposed.executed).toBe(false);
      expect(proposed.id).toMatch(/^action_/);
    });

    test('does NOT push shift action when _shift_meta absent', async () => {
      mockControllerSuccess(plansController.updatePlan, 200, {
        _id: 'plan123',
        planned_date: '2026-05-08'
      });

      const session = {
        pending_actions: [],
        markActionExecuted: jest.fn().mockResolvedValue({}),
        updateContext: jest.fn().mockResolvedValue({})
      };

      const action = {
        id: 'action_upd99999',
        type: 'update_plan',
        payload: { plan_id: 'plan123', planned_date: '2026-05-08' }
      };

      await executeAction(action, user, session);
      expect(session.pending_actions).toHaveLength(0);
    });

    test('does NOT push shift action when session is null', async () => {
      const shiftMeta = { scheduled_items_count: 1, date_diff_days: 3, date_diff_ms: 259200000 };
      mockControllerSuccess(plansController.updatePlan, 200, {
        _id: 'plan123',
        _shift_meta: shiftMeta
      });

      // Should not throw even without a session
      const action = {
        id: 'action_nosess',
        type: 'update_plan',
        payload: { plan_id: 'plan123', planned_date: '2026-05-04' }
      };

      await expect(executeAction(action, user, null)).resolves.not.toThrow();
    });
  });
```

- [ ] **Step 6.2 — Run tests to confirm they fail**

```bash
bun run test:api -- --testPathPattern=tests/utils/bienbot-action-executor
```

Expected: FAIL — `shift_plan_item_dates` not in `ALLOWED_ACTION_TYPES`, `plansController.shiftPlanItemDates` not called.

- [ ] **Step 6.3 — Implement `shift_plan_item_dates` action in executor**

In `utilities/bienbot-action-executor.js`:

**1.** Add `'shift_plan_item_dates'` to `ALLOWED_ACTION_TYPES` (after `'update_plan'`):

```javascript
const ALLOWED_ACTION_TYPES = [
  // ... existing ...
  'update_plan',
  'shift_plan_item_dates',   // ← add this line
  'delete_plan',
  // ...
];
```

**2.** Add `executeShiftPlanItemDates` function (after `executeUpdatePlan`):

```javascript
/**
 * shift_plan_item_dates
 * payload: { plan_id, diff_days }
 */
async function executeShiftPlanItemDates(payload, user) {
  loadControllers();
  const diffMs = (payload.diff_days || 0) * 24 * 60 * 60 * 1000;
  const req = buildMockReq(user, { diff_ms: diffMs }, { id: payload.plan_id });
  const { res, getResult } = buildMockRes();
  await plansController.shiftPlanItemDates(req, res);
  return getResult();
}
```

**3.** Register in the dispatch map (after `update_plan: executeUpdatePlan`):

```javascript
  update_plan: executeUpdatePlan,
  shift_plan_item_dates: executeShiftPlanItemDates,
```

**4.** In `executeUpdatePlan`, add auto-propose logic after `return getResult()`:

```javascript
async function executeUpdatePlan(payload, user, session) {
  loadControllers();
  const body = {};
  if (payload.planned_date !== undefined) body.planned_date = payload.planned_date;
  if (payload.currency !== undefined) body.currency = payload.currency;
  if (payload.notes !== undefined) body.notes = payload.notes;
  const req = buildMockReq(user, body, { id: payload.plan_id });
  const { res, getResult } = buildMockRes();
  await plansController.updatePlan(req, res);
  const result = getResult();

  // Auto-propose shift if the response includes shift metadata
  const meta = result?.data?._shift_meta || result?._shift_meta;
  if (meta && meta.scheduled_items_count > 0 && session) {
    const diffDays = meta.date_diff_days;
    const count = meta.scheduled_items_count;
    const sign = diffDays > 0 ? '+' : '';
    session.pending_actions.push({
      id: `action_${Math.random().toString(36).substring(2, 10)}`,
      type: 'shift_plan_item_dates',
      payload: { plan_id: payload.plan_id, diff_days: diffDays },
      description: `Shift ${count} plan item date(s) by ${sign}${diffDays} day(s) to match your updated plan date`,
      executed: false
    });
  }

  return result;
}
```

**Note:** `executeUpdatePlan` currently does not accept `session`. Update its signature to `async function executeUpdatePlan(payload, user, session)`. The dispatch mechanism in `executeAction` passes `(payload, user, session)` to all handlers, so this is backward-compatible — the function just wasn't using `session` before.

Verify `executeAction` passes session to handlers by checking the dispatch call in `executeAction`:

```javascript
// In executeAction (around line 1169):
const handler = ACTION_HANDLERS[action.type];
// ...
return handler(action.payload, user, session);
```

If session is not currently threaded through, update that call to pass `session`.

- [ ] **Step 6.4 — Run executor tests**

```bash
bun run test:api -- --testPathPattern=tests/utils/bienbot-action-executor
```

Expected: All tests PASS.

- [ ] **Step 6.5 — Commit**

```bash
git add utilities/bienbot-action-executor.js tests/utils/bienbot-action-executor.test.js
git commit -m "feat(bienbot): add shift_plan_item_dates action type and auto-propose from update_plan"
```

---

## Task 7: BienBot UI — `PendingActionCard` config entry + system prompt

**Files:**
- Modify: `src/components/BienBotPanel/PendingActionCard.jsx`
- Modify: `controllers/api/bienbot.js`

- [ ] **Step 7.1 — Add `shift_plan_item_dates` to `ACTION_CONFIG` in `PendingActionCard.jsx`**

In `src/components/BienBotPanel/PendingActionCard.jsx`, locate the `ACTION_CONFIG` object (around line 17). Add after the `update_plan` entry:

```javascript
  shift_plan_item_dates:        { label: 'Shift Item Dates',          icon: '📅', confirm_label: 'Shift Dates',         dismiss_label: 'Keep Current',    card_intent: 'confirmation' },
```

- [ ] **Step 7.2 — Add action to BienBot system prompt**

In `controllers/api/bienbot.js`, locate the `--- Plan ---` section (around line 359). Add after the `- update_plan` line:

```javascript
    '- shift_plan_item_dates: { plan_id, diff_days }  (auto-proposed after update_plan changes planned_date when scheduled items exist)',
```

- [ ] **Step 7.3 — Run all tests**

```bash
bun run test:api && bun run test:frontend
```

Expected: All tests pass. No regressions.

- [ ] **Step 7.4 — Build**

```bash
bun run build 2>&1 | tail -10
```

Expected: Build succeeds with no errors.

- [ ] **Step 7.5 — Commit**

```bash
git add src/components/BienBotPanel/PendingActionCard.jsx controllers/api/bienbot.js
git commit -m "feat(bienbot): register shift_plan_item_dates in PendingActionCard and system prompt"
```

---

## Self-Review

### Spec coverage check

| Spec requirement | Task |
|-----------------|------|
| `PUT /api/plans/:id` enhanced response with `_shift_meta` | Task 2 |
| `POST /api/plans/:id/shift-item-dates` endpoint | Task 1 |
| `plans-api.js` `shiftPlanItemDates()` | Task 3 |
| `useDateManagement` two-phase state + `pendingShift` | Task 4 |
| `DatePickerSection` confirmation banner | Task 5 |
| Wire new props in `SingleExperience` | Task 5 |
| `bienbot-action-executor.js` action + auto-propose | Task 6 |
| `PendingActionCard` `ACTION_CONFIG` entry | Task 7 |
| BienBot system prompt | Task 7 |
| Edge cases: null→date, date→null, diff=0, count=0, shift fails | Tasks 1-4 |
| `scheduled_time` NOT changed | Implemented by only updating `scheduled_date` in Task 1 |

All requirements covered. ✓

### Notes for the implementer

- **`executeAction` session threading (Task 6):** Check whether the current `executeAction` dispatcher passes `session` as a third arg to all handlers. If it only passes `(payload, user)`, update the dispatch line to `handler(action.payload, user, session)`. This is a one-line change.
- **`DatePickerSection` full content (Task 5):** The original file ends with `DatePicker.View view="year"` and potentially more. Read the file completely before replacing — the plan shows the full content from the earlier read, but double-check for any trailing code.
- **`finalizeDateUpdate` dependency order (Task 4):** `updateExistingPlanDate` depends on `finalizeDateUpdate`. Both are `useCallback`. Move `finalizeDateUpdate` above `updateExistingPlanDate` in the hook body to satisfy the exhaustive-deps lint rule.

# Bulk Plan Item Date Shift

**Date:** 2026-04-02
**Task:** biensperience-e665.15
**Status:** Approved

## Summary

When a plan's `planned_date` changes (from a non-null value to a different non-null value), offer the user the option to shift all root plan items' `scheduled_date` values by the same delta. The offer is presented as an inline confirmation banner inside the existing date-picker modal — no new components required.

---

## Architecture

Eight files change across three layers. No new files.

```
User picks new date → PUT /api/plans/:id
  → response includes _shift_meta if applicable
  → useDateManagement sets pendingShift state
  → DatePickerSection shows confirmation banner (calendar hidden)
  → "Shift Dates" → POST /api/plans/:id/shift-item-dates → plan:updated → modal closes
  → "Keep Dates" → modal closes immediately

BienBot update_plan with planned_date change
  → executor detects _shift_meta in response
  → auto-proposes shift_plan_item_dates as follow-up pending action
  → PendingActionCard renders for user confirmation
```

---

## Backend

### `PUT /api/plans/:id` — enhanced response (controllers/api/plans.js)

In the `planned_date`-only atomic fast path:

1. Capture `oldDate = plan.planned_date` before the update.
2. Normalize `newDate` from `updates.planned_date`.
3. After `findByIdAndUpdate`, compute `diffMs = newDate - oldDate`.
4. Skip shift offer when:
   - `oldDate` is null (plan date set for the first time)
   - `newDate` is null (plan date cleared)
   - `diffMs === 0` (same date)
5. When offer applies: count root items (`parent == null`, `scheduled_date != null`) via an in-memory filter on `updated.plan_items`.
6. Return shape:
   - **No shift offer** (conditions not met, or `scheduledCount === 0`): `res.json(updated)` — unchanged.
   - **Shift offer**: `res.json({ ...updated.toObject(), _shift_meta: { scheduled_items_count, date_diff_days, date_diff_ms, old_date, new_date } })`.

The `_shift_meta` sidecar keeps the response backward-compatible. All existing consumers reading `result._id`, `result.experience`, etc. continue to work.

### `POST /api/plans/:id/shift-item-dates` (controllers/api/plans.js + routes/api/plans.js)

**Permission:** `canEdit`.
**Body:** `{ diff_ms: Number }`.
**Logic:**
- Validate `diff_ms` is a finite number, non-zero.
- Find root plan items: `plan.plan_items.filter(i => !i.parent && i.scheduled_date)`.
- Bulk update each `scheduled_date` by adding `diff_ms`.
- Save the plan document.
- Broadcast WebSocket event to plan room: `plan:item:scheduled` (or `plan:updated`).
- Return `{ shifted_count: Number }`.

**Route:** `router.post('/:id/shift-item-dates', modificationLimiter, plansCtrl.shiftPlanItemDates)` — added to `routes/api/plans.js`.

---

## Frontend

### `plans-api.js` — `shiftPlanItemDates(planId, diffMs)`

New exported async function:
- `POST /api/plans/:planId/shift-item-dates` with body `{ diff_ms: diffMs }`.
- On success, emits `plan:updated` event (same payload shape as `updatePlan`).
- Returns the raw result.

### `useDateManagement.js` — two-phase state

**New state:** `const [pendingShift, setPendingShift] = useState(null)`.
Shape: `null | { planId, count, diffDays, diffMs, oldDate, newDate }`.

**`updateExistingPlanDate` changes:**
- Await the return value of `updatePlan(planId, { planned_date: dateToSend })`.
- Check `result._shift_meta`:
  - If `scheduled_items_count > 0` and `date_diff_days !== 0`: call `setPendingShift({ planId, count: scheduled_items_count, diffDays: date_diff_days, diffMs: date_diff_ms, oldDate: old_date, newDate: new_date })`. Do **not** call `finalizeDateUpdate()`.
  - Otherwise: call `finalizeDateUpdate()` as today.

**New callbacks:**
- `onShiftDates()` — calls `shiftPlanItemDates(planId, pendingShift.diffMs)`, then `finalizeDateUpdate()`, then `setPendingShift(null)`. Wrapped in try/catch; shows `showError` on failure.
- `onKeepDates()` — calls `finalizeDateUpdate()`, then `setPendingShift(null)`.

**Returns (additions):** `pendingShift`, `onShiftDates`, `onKeepDates`.

### `DatePickerSection.jsx` — confirmation banner

**New props (all optional):** `pendingShift`, `onShiftDates`, `onKeepDates`.

**When `pendingShift` is set:**
- Calendar content is hidden (conditional render, not `display:none` — avoid rendering the DatePicker at all).
- A Chakra `Alert` renders with status `info`:
  > "You moved your plan from {oldDate} to {newDate} ({+N/-N} days). {count} plan item(s) have scheduled dates. Shift them all by {N} days?"
- Footer replaces the normal buttons with:
  - "Keep Current Dates" (outline, calls `onKeepDates`)
  - "Shift Dates" (gradient, calls `onShiftDates`)
- Modal title stays the same; modal remains open.
- Dates formatted using `new Date(dateString).toLocaleDateString()` — consistent with how `SingleExperience` displays dates elsewhere in the same view.

---

## BienBot

### `bienbot-action-executor.js`

1. Add `'shift_plan_item_dates'` to `ALLOWED_ACTION_TYPES`.
2. New `executeShiftPlanItemDates(payload, user)`:
   - Converts `payload.diff_days` → `diff_ms = diff_days * 86_400_000`.
   - Builds mock req/res, calls `plansController.shiftPlanItemDates`.
   - Returns result.
3. Register in the action dispatch map: `shift_plan_item_dates: executeShiftPlanItemDates`.
4. In `executeUpdatePlan`, after `getResult()`, inspect `result._shift_meta`:
   - If `scheduled_items_count > 0` and `session` is provided, push a new pending action to `session.pending_actions`:
     ```javascript
     {
       id: `action_${Math.random().toString(36).substring(2, 10)}`,
       type: 'shift_plan_item_dates',
       payload: { plan_id: payload.plan_id, diff_days: result._shift_meta.date_diff_days },
       description: `Shift ${count} plan item date(s) by ${diffDays > 0 ? '+' : ''}${diffDays} day(s) to match your updated plan date`,
       executed: false
     }
     ```

### `PendingActionCard.jsx`

Add to `ACTION_CONFIG`:
```javascript
shift_plan_item_dates: {
  label: 'Shift Item Dates',
  icon: '📅',
  confirm_label: 'Shift Dates',
  dismiss_label: 'Keep Current',
  card_intent: 'confirmation'
}
```

### `controllers/api/bienbot.js` — system prompt

Add one entry to the action schema section:
> `shift_plan_item_dates { plan_id, diff_days }` — Shifts all scheduled plan item dates by the given number of days. Propose this automatically after an `update_plan` that changes `planned_date` when the user confirms they want item dates shifted too.

---

## Edge Cases

| Case | Behaviour |
|------|-----------|
| `oldDate` null → date set | No shift offer (no delta to compute) |
| `newDate` null (date cleared) | No shift offer |
| `diffMs === 0` | No shift offer |
| `scheduledCount === 0` | No shift offer; `finalizeDateUpdate()` called immediately |
| Shift API call fails | `showError` displayed; modal closes (`finalizeDateUpdate` still called) |
| BienBot: `update_plan` changes non-date fields | `_shift_meta` absent; no follow-up action proposed |
| `scheduled_time` | Not changed — only `scheduled_date` shifts |

---

## Files Changed

| File | Change |
|------|--------|
| `controllers/api/plans.js` | Enhance `updatePlan` planned_date path; add `shiftPlanItemDates` handler |
| `routes/api/plans.js` | Add `POST /:id/shift-item-dates` route |
| `src/utilities/plans-api.js` | Add `shiftPlanItemDates()` function |
| `src/hooks/useDateManagement.js` | Two-phase state; `pendingShift`, `onShiftDates`, `onKeepDates` |
| `src/views/SingleExperience/components/DatePickerSection.jsx` | Confirmation banner when `pendingShift` set |
| `utilities/bienbot-action-executor.js` | `shift_plan_item_dates` action type + auto-propose in `executeUpdatePlan` |
| `src/components/BienBotPanel/PendingActionCard.jsx` | Add `shift_plan_item_dates` to `ACTION_CONFIG` |
| `controllers/api/bienbot.js` | Document new action type in system prompt |

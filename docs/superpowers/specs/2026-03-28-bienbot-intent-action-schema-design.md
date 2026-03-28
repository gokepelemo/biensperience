# BienBot Intent Action Schema

**Date:** 2026-03-28
**Status:** Approved
**Scope:** Dynamic per-action card rendering with LLM-overridable button verbiage

---

## Problem

All pending action cards in BienBot show **Approve** and **Update** as button labels regardless of action type. "Approve" is the wrong verb for actions like "Select an experience", "Create a plan", or "Add items to your itinerary". The mismatch erodes trust — users hesitate when the button label doesn't match the action being confirmed.

---

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Default labels | Backend `ACTION_CONFIG` per action type | Deterministic, versionable, no LLM call needed for defaults |
| LLM overrides | Optional fields in `pending_actions` response | LLM knows conversational context; can make buttons feel native to the exchange |
| `card_intent` | Backend-only, not LLM-overridable | Layout is a client concern; LLM should not control UI structure |
| Override scope | `confirm_label` and `dismiss_label` only | Keeps LLM influence narrow; avoids arbitrary button injection |

---

## Architecture

### 1. Backend Default Config (`ACTION_CONFIG`)

`ACTION_CONFIG` in `src/components/BienBotPanel/PendingActionCard.jsx` gains three new fields per action type entry:

```javascript
const ACTION_CONFIG = {
  create_plan: {
    label: 'Create Plan',
    icon: '📅',
    confirm_label: 'Create Plan',
    dismiss_label: 'Cancel',
    card_intent: 'confirmation'
  },
  // ...
};
```

**`card_intent` values and their layouts:**

| Value | Layout | Use Cases |
|---|---|---|
| `confirmation` | Primary button + secondary button | create_*, update_*, delete_*, add_*, invite_*, workflow |
| `selection` | Single primary button, no secondary | select_plan, select_experience, select_destination |
| `info` | Single dismiss button, no primary action | read-only informational cards |

**Full default config by action type:**

| Action type | confirm_label | dismiss_label | card_intent |
|---|---|---|---|
| `create_destination` | Create Destination | Cancel | confirmation |
| `create_experience` | Create Experience | Cancel | confirmation |
| `create_plan` | Create Plan | Cancel | confirmation |
| `add_plan_items` | Add Items | Edit | confirmation |
| `add_experience_plan_item` | Add Item | Edit | confirmation |
| `update_plan_item` | Update Item | Cancel | confirmation |
| `update_experience_plan_item` | Update Item | Cancel | confirmation |
| `update_plan` | Update Plan | Cancel | confirmation |
| `update_experience` | Update Experience | Cancel | confirmation |
| `update_destination` | Update Destination | Cancel | confirmation |
| `invite_collaborator` | Invite | Cancel | confirmation |
| `remove_collaborator` | Remove | Cancel | confirmation |
| `delete_plan` | Delete Plan | Cancel | confirmation |
| `delete_plan_item` | Delete Item | Cancel | confirmation |
| `delete_experience_plan_item` | Delete Item | Cancel | confirmation |
| `add_plan_cost` | Add Cost | Cancel | confirmation |
| `update_plan_cost` | Update Cost | Cancel | confirmation |
| `delete_plan_cost` | Delete Cost | Cancel | confirmation |
| `add_plan_item_note` | Add Note | Cancel | confirmation |
| `add_plan_item_detail` | Add Detail | Cancel | confirmation |
| `assign_plan_item` | Assign | Cancel | confirmation |
| `unassign_plan_item` | Unassign | Cancel | confirmation |
| `sync_plan` | Sync Plan | Cancel | confirmation |
| `toggle_favorite_destination` | Add to Favourites | Cancel | confirmation |
| `add_entity_photos` | Add Photos | Cancel | confirmation |
| `workflow` | Run All Steps | Cancel | confirmation |
| `select_plan` | Select | — | selection |
| `select_experience` | Select | — | selection |
| `select_destination` | Select | — | selection |
| `navigate_to_entity` | Go There | — | selection |

---

### 2. LLM Response Schema Override

The `pending_actions` schema in the system prompt gains two optional fields:

```
PENDING ACTIONS SCHEMA:
Each action in pending_actions may include optional override fields:
  "confirm_label": "Yes, plan it"     // overrides the primary button label
  "dismiss_label": "Not yet"          // overrides the secondary button label

Use overrides when the default button label doesn't match the conversational context.
Examples:
  - After asking "Would you like to create a plan for this?" → confirm_label: "Yes, create it"
  - After the user said "maybe later" about a plan → dismiss_label: "Remind me later"
  - For a delete action after the user confirms → confirm_label: "Yes, delete it"

Do NOT include overrides for routine actions — the default labels are correct in most cases.
Do NOT use overrides to change the action type or add new buttons beyond the two defined.
```

**Validation:** The backend strips any `confirm_label` or `dismiss_label` values that exceed 40 characters before persisting to the session, to prevent runaway LLM text in buttons.

---

### 3. `PendingActionCard` Rendering

Button label resolution (priority order):
1. `action.confirm_label` (LLM override, if present and ≤40 chars)
2. `ACTION_CONFIG[action.type].confirm_label` (backend default)
3. `"Approve"` (last-resort fallback for unknown action types)

Same resolution for `dismiss_label`.

`card_intent` comes from `ACTION_CONFIG[action.type].card_intent` only. If the action type is unknown, default to `confirmation`.

**Layout by `card_intent`:**

```jsx
// confirmation — two buttons
<>
  <Button variant="gradient" onClick={onApprove}>{confirmLabel}</Button>
  <Button variant="outline" onClick={onUpdate}>{dismissLabel}</Button>
</>

// selection — single button, no dismiss
<Button variant="gradient" onClick={onApprove}>{confirmLabel}</Button>

// info — single dismiss only
<Button variant="outline" onClick={onDismiss}>{dismissLabel || 'Dismiss'}</Button>
```

The "Update" behaviour (pre-fill input with correction prompt) is retained for `confirmation` cards only — it is the secondary button. `selection` and `info` cards have no update path.

---

## Files Changed

| File | Change |
|---|---|
| `src/components/BienBotPanel/PendingActionCard.jsx` | Add `confirm_label`, `dismiss_label`, `card_intent` to `ACTION_CONFIG` for all action types. Update button rendering to resolve labels with priority order above. Conditionally render buttons by `card_intent`. |
| `controllers/api/bienbot.js` | Add `confirm_label`/`dismiss_label` to the `pending_actions` schema block in `buildSystemPrompt()`. Add 40-char strip/truncation of override fields before session persistence. |
| `models/bienbot-session.js` | Add `confirm_label: String` and `dismiss_label: String` to the `pending_actions` subdocument schema (optional fields). |

## Files NOT Changed

- `utilities/bienbot-action-executor.js` — action execution logic is unaffected
- `src/hooks/useBienBot.js` — pending actions pipeline is unaffected; new fields pass through as-is
- Any context builders — this is purely a response schema and rendering concern

---

## Testing

- Unit test label resolution: LLM override present → override wins; LLM override absent → default; unknown type → fallback "Approve"
- Unit test 40-char truncation of LLM override fields in controller
- Snapshot test `PendingActionCard` for each `card_intent` value
- Integration test: send a chat message that produces a `create_plan` action, verify card renders "Create Plan" not "Approve"
- Integration test: LLM returns `confirm_label: "Yes, plan it"` — verify override is stored and rendered

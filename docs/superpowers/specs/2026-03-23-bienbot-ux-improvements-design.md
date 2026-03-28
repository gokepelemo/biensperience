# BienBot UX Improvements Design

**Date**: 2026-03-23
**Updated**: 2026-03-28
**Status**: Approved
**Scope**: Bug fix, system prompt improvements, session persistence, rich action cards, session history UI, input focus, message copyability

---

## Overview

Seven feedback items addressing BienBot usability issues: a schema validation bug, LLM behavior improvements (date resolution, entity IDs, currency defaults), session persistence across browser refresh, rich pending action cards, and an in-panel session history view.

---

## 1. Bug Fix: Structured Content Schema Validation

**Problem**: `structured_content.type` enum in `models/bienbot-session.js` only allows `photo_gallery` and `suggestion_list`. The backend already sends `discovery_result_list` and `tip_suggestion_list`, and the frontend renders both — but session persistence fails because Mongoose rejects these values on save.

**Fix**: Add both `discovery_result_list` and `tip_suggestion_list` to the enum array:
```javascript
enum: ['photo_gallery', 'suggestion_list', 'discovery_result_list', 'tip_suggestion_list']
```

**Files changed**: `models/bienbot-session.js`

---

## 2. System Prompt Improvements

Three additive changes to the LLM system prompt in `controllers/api/bienbot.js`. No structural changes to controller logic.

### 2a. Relative Date Resolution

Add instruction to the system prompt:
- When the user provides a relative time expression ("in 3 months", "next week", "this summer"), calculate the exact date based on today's date
- Include the resolved date in the pending action payload
- State the calculated date in the response message so the user can confirm or correct
- Inject today's date into the system prompt via `new Date().toISOString()`

### 2b. Entity ID Handling

Add instruction to the system prompt:
- Never fabricate or use placeholder IDs like `<experience_id>`
- Use real entity IDs from the provided context blocks
- If the needed entity isn't in context, ask the user to clarify
- For creation actions (`create_destination`, `create_experience`, `create_plan`), omit the `_id` field entirely — MongoDB generates it on save via the existing controllers

### 2c. Currency Preference

- Inject the user's `preferences.currency` value into the system prompt context (e.g., "User's preferred currency: USD")
- Instruct the LLM to default to this currency for cost-related actions unless the user explicitly specifies a different one
- Source: `req.user.preferences.currency`

**Files changed**: `controllers/api/bienbot.js`

---

## 3. Session Persistence Across Browser Refresh

**Problem**: The active session ID lives only in a React ref (`useBienBot.js`), so it's lost on page refresh. Users must manually find their session from history.

### Storage

- Persist active session ID using `secure-storage-lite.js` (`setObfuscatedJson`/`getObfuscatedJson`) under key `bien:bienbot_active_session`
- Stored value: `{ sessionId: string, userId: string }`

### Write Triggers

- When a session is created (via `sendMessage` `onSession` callback)
- When a session is loaded (via `loadSession`)

### Clear Triggers

- When the user starts a new chat (`clearSession`)
- When the user deletes the current session

### Resume Prompt on Panel Open

In `useBienBot` initialization:
1. Check localStorage for a persisted session ID
2. If found and `sessionId` is currently null (fresh mount), set a `hasSavedSession` state flag
3. BienBotPanel renders a prompt: "You have an unfinished conversation. Continue?" with **Continue** and **New Chat** buttons
4. **Continue** calls `loadSession(savedId)` which resumes via the existing `/resume` endpoint
5. **New Chat** clears the localStorage key and starts fresh

### Edge Cases

- **Deleted session**: If the saved session was deleted/archived server-side, `loadSession` will fail — catch the error, clear the key, and start fresh silently
- **User mismatch**: Compare `userId` in stored value with current user; ignore if mismatched

**Files changed**: `src/hooks/useBienBot.js`, `src/components/BienBotPanel/BienBotPanel.jsx`

---

## 4. Rich Pending Action Cards

**Problem**: Pending actions display raw JSON or plain description text. Users can't easily understand what they're approving.

### New Component: PendingActionCard

**Location**: `src/components/BienBotPanel/PendingActionCard.jsx` (colocated with panel)

**Card structure** (all action types):
- **Header**: Action type icon + human-readable label (e.g., "Create Plan", "Add Items")
- **Body**: Type-specific content preview
- **Footer**: Two buttons — **Approve** (gradient variant) and **Update** (outline variant)

### Type-Specific Body Templates

| Action Type | Card Body Shows |
|---|---|
| `create_destination` | Destination name, country |
| `create_experience` | Experience name, destination name |
| `create_plan` | Experience name, planned date, currency |
| `add_plan_items` / `add_experience_plan_item` | Bulleted list of item names |
| `update_plan_item` / `update_experience_plan_item` | Item name + changed fields |
| `invite_collaborator` | User name/email, role |
| `workflow` | Step count + overall description |
| **Fallback** | Action description text (current behavior) |

### Update Button Behavior

1. Clicking "Update" pre-fills the chat input with: `"Update this action: "` with cursor at end
2. User types their correction (e.g., "change the date to July 1st")
3. The original pending action is cancelled via `cancelAction` before sending
4. Sends as a normal message — BienBot responds with a revised action

### Data Source

All display fields come from `action.payload` and `action.description` — no additional API calls needed.

**Files changed**: `src/components/BienBotPanel/PendingActionCard.jsx` (new), `src/components/BienBotPanel/BienBotPanel.jsx`

---

## 5. Session History View

**Problem**: Session history exists server-side but there's no UI for users to browse past conversations.

### Navigation

- Panel header gets a **clock/history icon button** next to the existing "New Chat" button
- Clicking it switches the panel to history view
- A **back arrow** in the history view header returns to the current chat

### Layout

- **Grouped by date**: "Today", "Yesterday", "This Week", "This Month", "Older"
- Each session row shows:
  - **Title**: Auto-generated from first message (already exists in model)
  - **Context badge**: Small pill showing invoke context entity label (e.g., "Banff Beach")
  - **Timestamp**: Relative time ("2 hours ago", "Mar 15")
  - **Summary snippet**: First ~80 chars of cached summary text, or first user message if no summary
- Clicking a session row calls `loadSession(sessionId)` and switches back to chat view

### Data Source

The `GET /sessions` endpoint already returns all sessions with titles, context, timestamps, and summaries. No backend changes needed.

### States

- **Empty state**: "No past conversations yet."
- **Current session indicator**: If a listed session is the active one, show a subtle "Current" badge — clicking it returns to chat view
- **Panel state**: Add `viewMode: 'chat' | 'history'` state to BienBotPanel

### Component

- `SessionHistoryView` component colocated at `src/components/BienBotPanel/SessionHistoryView.jsx`
- Uses existing `sessions` array from `useBienBot` hook

**Files changed**: `src/components/BienBotPanel/SessionHistoryView.jsx` (new), `src/components/BienBotPanel/BienBotPanel.jsx`, `src/components/BienBotPanel/BienBotPanel.module.css`

---

## Files Summary

| File | Change Type |
|---|---|
| `models/bienbot-session.js` | Edit (add enum value) |
| `controllers/api/bienbot.js` | Edit (system prompt additions) |
| `src/hooks/useBienBot.js` | Edit (session persistence, resume state) |
| `src/components/BienBotPanel/BienBotPanel.jsx` | Edit (resume prompt, history toggle, viewMode state, Update button handler) |
| `src/components/BienBotPanel/BienBotPanel.module.css` | Edit (styles for new components) |
| `src/components/BienBotPanel/PendingActionCard.jsx` | New (rich action card component) |
| `src/components/BienBotPanel/SessionHistoryView.jsx` | New (session history list component) |
| `src/components/BienBotPanel/BienBotPanel.jsx` | Edit (auto-focus input after response, action execute, action cancel) |
| `src/components/BienBotPanel/BienBotPanel.module.css` | Edit (add `user-select: text` to message bubbles) |

---

## 6. Textbox Auto-Focus After Response

**Problem**: After BienBot finishes streaming a response, the user must manually click the chat input to type a follow-up. This interrupts conversational flow.

**Fix**: In `BienBotPanel.jsx`, call `inputRef.current?.focus()` in three places:
- After the SSE `done` event fires (streaming complete)
- After a pending action is executed (user approved an action and the result arrives)
- After a pending action is cancelled

All three are natural points where the user would type next. No changes to `useBienBot` hook needed — the `done` handler and action callbacks already exist in the panel.

**Files changed**: `src/components/BienBotPanel/BienBotPanel.jsx`

---

## 7. Message Copyability

**Problem**: Chat message bubbles block text selection, making it impossible for users to highlight and copy message content.

**Fix**: Add `user-select: text` and `-webkit-user-select: text` to the message content element in `BienBotPanel.module.css`. Applies to both user and assistant message bubbles — users may want to copy their own messages to reuse or edit them.

**Files changed**: `src/components/BienBotPanel/BienBotPanel.module.css`

---

## No Backend Endpoint Changes

All existing endpoints are sufficient. The only backend changes are the schema enum fix and system prompt text modifications.

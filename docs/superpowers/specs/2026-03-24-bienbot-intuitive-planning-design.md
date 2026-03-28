# BienBot Intuitive Experience Planning

**Date:** 2026-03-24
**Updated:** 2026-03-28
**Status:** Approved

## Problem

When a user asks BienBot to "plan Tokyo Temple Tour," BienBot:
1. Expects the user to provide raw entity IDs instead of searching by name
2. Proposes a `navigate_to_entity` action instead of creating a plan
3. Has no entity search/disambiguation when the user references entities by name

The experience planning flow should mirror clicking the "Plan an Experience" button — create a plan, ask for a date, suggest tips.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Plan creation timing | Propose `create_plan` immediately, ask date afterward | Matches the + button flow; reduces friction |
| Multiple matches | Show `select_experience` action cards | Tappable, interactive; consistent with existing `select_plan` pattern |
| Search strategy | Hybrid: pre-LLM deep search for high-confidence, LLM clarification for low | One round-trip for most cases; avoids new action types for search |
| Post-creation flow | Two sequential steps: date question, then suggestions | Guided conversation; doesn't overwhelm user |

## Architecture

### 1. Cascading Deep Search (`resolveExperienceDeep`)

New function in `utilities/bienbot-entity-resolver.js` that cascades across entity types when the intent is plan-related.

**Search cascade (in order, results merged and ranked):**

Note: the destination is always established before `resolveExperienceDeep` is called (see Section 3 destination gate). The destination fallback step is therefore removed — experience search is always scoped to the known destination via `options.destinationId`.

1. **Experiences by name** — existing `resolveExperience()`, scored by Levenshtein similarity, boosted if within `options.destinationId`
2. **Plan items & tips text** — search `plan_items.text` across public experiences for keyword matches (note: the Experience model uses `text`, not `content`, for plan item text). This requires a new MongoDB query since `searchExperiencesInternal` only searches `name`, `overview`, and `experience_type`. Query: `Experience.find({ public: true, destination: options.destinationId, 'plan_items.text': { $regex: buildRegexSearchQuery(query) } })`. Parent experiences returned, scored with max 0.75 since matching is on child content

All candidates are deduplicated by experience ID, merged, and sorted by score. Existing confidence thresholds apply (HIGH >0.90, MEDIUM 0.60-0.90, LOW <0.60).

Each candidate includes a `match_reason` field:
- `"name"` — direct name match
- `"content"` — found via plan item/tips text search

**Signature:**
```javascript
async function resolveExperienceDeep(query, user, options = {})
  // options.destinationId — required; destination context (always set before this is called)
  // Returns: { candidates: Array<{id, name, type, score, detail, match_reason}>, confidence }
```

**Cascade logic:**
- Always run step 1 (experience name search, scoped to destination)
- Run step 2 if step 1 returns fewer than 2 candidates above the disambiguate threshold (0.60)
- Final merge: deduplicate by experience ID, keep highest score per ID, sort descending

### 2. `select_experience` Action Type

New action type for experience disambiguation, following the `select_plan` pattern exactly.

**Payload schema:**
```javascript
{
  type: 'select_experience',
  payload: {
    experience_id: String,
    experience_name: String,
    destination_name: String,
    destination_id: String,
    match_reason: 'name' | 'destination' | 'content',
    item_count: Number,
    has_user_plan: Boolean
  },
  description: "Tokyo Temple Tour in Tokyo, Japan"
}
```

**Registration:**
- Add to `ALLOWED_ACTION_TYPES` in `bienbot-action-executor.js`
- Do NOT add to `READ_ONLY_ACTION_TYPES` — consistent with `select_plan`, which requires user interaction (tap to select). The controller streams these as disambiguation cards, not auto-executed actions.
- Handler: on execution, return `experience_id` and `destination_id` in the result body. The `executeAction` caller merges these into session context using the existing context update pattern (same as `select_plan`).

**Frontend (`BienBotPanel.jsx` + `PendingActionCard.jsx`):**
- Add `select_experience` to `ACTION_CONFIG` in `PendingActionCard.jsx`: `{ label: 'Select Experience', icon: '🎯' }`
- Card renderer shows: experience name (primary), destination name (secondary), match reason hint (e.g., "Matched by destination"), and a badge if `has_user_plan` is true ("You have a plan")
- Add routing logic in `BienBotPanel.jsx` to render `select_experience` actions, following the `select_plan` pattern

### 3. Controller Disambiguation Flow

In the `chat()` function of `controllers/api/bienbot.js`, add a `PLAN_EXPERIENCE` disambiguation path parallel to the existing plan disambiguation.

**Hard destination gate:** A destination must be established in session context before any experience search or listing occurs. This is a hard gate — the flow halts and waits for destination confirmation if none is set.

```
User message
  ↓
Intent classified as PLAN_EXPERIENCE
  ↓
Step A — Destination gate
  Check: is session.context.destination_id set?
  → YES: proceed to Step B
  → NO: run resolveDestination(query, user)
        HIGH (>0.90) → inject destination_id into context, proceed to Step B
        MEDIUM → stream select_destination action cards, halt
                 (user taps one → destination_id injected → next message resumes at Step B)
        LOW → call LLM; system prompt instructs it to ask
              "Which destination are you planning for?"
  ↓
Step B — Experience search (destination now known)
  Check: does session.context.experience_id already exist?
  → YES: skip search, proceed to LLM call (experience already known)
  → NO: extract search query from classification.entities.experience_name
        OR raw message text (fallback)
        Run resolveExperienceDeep(query, user, { destinationId: session.context.destination_id })
        HIGH (>0.90) → inject experience into session context, proceed to LLM call
        MEDIUM → stream select_experience action cards, halt
        LOW → call LLM (sees "unresolved" in context, asks user to clarify)
```

**`select_destination` action type** — new, follows the same pattern as `select_plan` and `select_experience`.

Payload schema:
```javascript
{
  type: 'select_destination',
  payload: {
    destination_id: String,
    destination_name: String,
    country: String,
    city: String
  },
  description: "Tokyo, Japan"
}
```

On execution: injects `destination_id` into session context. The next user message re-enters the `PLAN_EXPERIENCE` flow at Step B.

Registration:
- Add to `ALLOWED_ACTION_TYPES` in `bienbot-action-executor.js` (NOT `READ_ONLY_ACTION_TYPES`)
- Add to `PendingActionCard ACTION_CONFIG`: `card_intent: 'selection'`, `confirm_label: 'Select'`

**Populating `has_user_plan`:** After `resolveExperienceDeep` returns candidates, the controller disambiguation block queries the Plan collection to check if the user already has a plan for each candidate experience: `Plan.find({ user: userId, experience: { $in: candidateExperienceIds } }).select('experience').lean()`. The result is used to set `has_user_plan` on each `select_experience` action payload before streaming.

**Search query extraction:** The intent classifier may extract the name as `experience_name` (quoted strings) or `destination_name` (unquoted location names). `resolveExperienceDeep` accepts either — the cascade searches both entity types regardless. As a fallback, if neither field is extracted, use the raw user message text (stripped of common prefixes like "plan", "I want to plan", etc.) as the search query. This fallback should be verified during testing; if extraction proves unreliable for common phrasings, the classifier's heuristics may need enhancement as a follow-up.

**Where in the controller:** After intent classification (Step 2) and before context building (Step 3). The existing plan disambiguation block runs for plan-mutation intents; this new block runs specifically for `PLAN_EXPERIENCE`.

### 4. Plan Creation Post-Flow

After the experience is in session context and the LLM is called:

**Edge case — user already has a plan for the selected experience:**
When the `select_experience` card includes `has_user_plan: true` and the user selects it, the system prompt instructs the LLM to ask: "You already have a plan for [Experience Name]. Would you like to create a new plan or work on the existing one?" If the user wants the existing plan, the LLM proposes a `select_plan` disambiguation if there are multiple, or injects the single plan into context directly. This avoids silent duplicate plan creation.

**Step 1 — Plan creation:**
- LLM proposes `create_plan` with `experience_id` from context. No `planned_date`.
- User approves → plan created via existing executor path
- Plan ID injected into session context

**Step 2 — Date prompt:**
- LLM sends follow-up: "Your plan for [Experience Name] is ready! When are you planning to go?"
- User responds with date → LLM proposes `update_plan` with resolved `planned_date`

**Step 3 — Suggestions:**
- After date is set, LLM includes `suggest_plan_items` as a pending action in its response. Because `suggest_plan_items` is in `READ_ONLY_ACTION_TYPES`, the frontend auto-executes it without user confirmation, displaying popular items inline.
- Message: "Here are some suggestions to make it yours"

This flow is enforced via system prompt instructions, not hardcoded controller logic, so the LLM can adapt if the user changes topic or provides a date upfront.

### 5. System Prompt Changes

**Replace ENTITY IDs block** in `buildSystemPrompt()`:

Current:
```
ENTITY IDs:
- NEVER fabricate or use placeholder IDs like "<experience_id>" or "<destination_id>".
- Use real entity IDs from the context blocks provided below.
- If the needed entity is not in context, ask the user to clarify — do not guess.
- For creation actions, do NOT include an _id field — MongoDB generates it automatically.
```

New:
```
ENTITY IDs:
- NEVER fabricate or use placeholder IDs like "<experience_id>" or "<destination_id>".
- Use real entity IDs from the context blocks provided below.
- NEVER ask the user for an entity ID. Users don't know IDs. If no entity was resolved, ask the user to describe what they're looking for differently.
- NEVER show raw entity IDs in your messages to the user.
- For creation actions, do NOT include an _id field — MongoDB generates it automatically.
```

**Add PLAN_EXPERIENCE intent instruction** (injected conditionally when intent is `PLAN_EXPERIENCE`). Note: `buildSystemPrompt()` does not currently receive the intent as a parameter. Add `intent` to its parameter object so the conditional block can be injected:

```
PLANNING AN EXPERIENCE:
The user wants to plan an experience. Follow this flow:
1. A destination must be established before any experience can be discussed. If no destination is in context, ask: "Which destination are you planning for?" Do not list or suggest experiences until the user confirms a destination.
2. Once a destination is in context and an experience is resolved, propose a `create_plan` action with the `experience_id`. Do NOT include a `planned_date` — you will ask for that after creation.
3. After the plan is created, ask when they are planning to go. Convert relative dates to absolute ISO dates.
4. After the user provides a date, propose an `update_plan` action with the `planned_date`.
5. After the date is set, use `suggest_plan_items` to show popular items and suggestions from the experience.
Never propose a `navigate_to_entity` action when the user wants to plan — they want a plan created, not a redirect.
If the user selects an experience they already have a plan for (has_user_plan is true in context), ask whether they want to create a new plan or work on the existing one before proposing create_plan.
```

## Files Changed

| File | Change |
|------|--------|
| `utilities/bienbot-entity-resolver.js` | Add `resolveExperienceDeep()` with cascading search (including new `plan_items.text` MongoDB query). Add `match_reason` field to candidates. Update `formatResolutionBlock()` to display `match_reason` when present. Export new function. |
| `controllers/api/bienbot.js` | Add `PLAN_EXPERIENCE` disambiguation path using `resolveExperienceDeep()`. Stream `select_experience` cards for MEDIUM confidence. Update `buildSystemPrompt()`: add `intent` parameter, replace ENTITY IDs block, add conditional intent-specific planning instructions. |
| `utilities/bienbot-action-executor.js` | Add `select_experience` and `select_destination` to `ALLOWED_ACTION_TYPES` (NOT `READ_ONLY_ACTION_TYPES`). Add handlers that return entity IDs in result body for session context update. |
| `src/components/BienBotPanel/PendingActionCard.jsx` | Add `select_experience` and `select_destination` to `ACTION_CONFIG`. Add card renderers. |
| `src/components/BienBotPanel/BienBotPanel.jsx` | Add routing logic for `select_experience` and `select_destination` actions, following the `select_plan` rendering pattern. |

## Files NOT Changed

- **Intent classifier** — `PLAN_EXPERIENCE` intent and entity extraction already work correctly
- **`create_plan` / `update_plan` execution** — existing executor handles these
- **`suggest_plan_items`** — already auto-executes as a read-only action
- **`useBienBot` hook** — `select_experience` flows through existing pending actions pipeline
- **No new API endpoints** — all changes are internal to `/api/bienbot/chat`

## Testing

- Unit test `resolveExperienceDeep()` with mocked search functions: verify cascade triggers, deduplication, scoring, and match_reason values
- Unit test `select_experience` action execution: verify session context is updated correctly
- Integration test the disambiguation flow: send a PLAN_EXPERIENCE message with an ambiguous name, verify `select_experience` cards are streamed
- Integration test high-confidence flow: send a message matching a single experience, verify `create_plan` is proposed by LLM
- Manual test the full conversational flow: plan → date → suggestions

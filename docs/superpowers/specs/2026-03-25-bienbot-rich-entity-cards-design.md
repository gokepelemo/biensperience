# BienBot Rich Entity Cards

**Date:** 2026-03-25
**Updated:** 2026-03-28
**Status:** Approved

## Problem

When BienBot references entities (experiences, destinations, plans, etc.) in its responses, it shows raw IDs or plain text names. Users see things like "the experience ID is 693f21442d3e85842d1d26d0" or unnamed references. Entity IDs are meaningless to users and break the conversational experience.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Reference format | Inline JSON object `{"_id","name","type"}` in LLM message text | Consistent with how context is presented to the LLM; teaches a single entity representation pattern; self-describing |
| Entity types | All: destination, experience, plan, plan_item, user | Complete coverage from day one |
| Rendering | Inline rich card (full-width mini-card with icon, name, metadata) | Tappable, visually distinct from text; user requested cards over chips |
| Tap behavior | Navigate to entity page | Direct, fast; no intermediate preview |
| Raw ID fallback | Silently resolve to rich card via DB lookup | Never show IDs to users; graceful degradation when LLM ignores instructions |
| Enrichment location | Backend post-processing after LLM response | Single source of truth; frontend receives pre-resolved data |

## Architecture

### 1. System Prompt Changes

Replace the `ENTITY REFERENCES IN MESSAGES` block in `buildSystemPrompt()` with:

```
ENTITY REFERENCES IN MESSAGES:
When mentioning any entity in your message text, embed it as a compact JSON object:
  {"_id":"<id>","name":"<display_name>","type":"<entity_type>"}
Entity types: destination, experience, plan, plan_item, user

Examples:
  "I'll create a plan for {"_id":"693f214...","name":"Tokyo Temple Tour","type":"experience"}!"
  "Your plan lives in {"_id":"abc123...","name":"Tokyo, Japan","type":"destination"}."
  "{"_id":"user123...","name":"Sarah","type":"user"} has been invited as a collaborator."

Rules:
- ALWAYS use this format when referring to entities — never show raw IDs to the user.
- _id is for the system; name is what the user sees. Always include both.
- Use _id values only from the context blocks provided — never fabricate IDs.
- You may reference multiple entities in a single message.
- If you don't know the entity's name, use its type as the display name (e.g., "this experience").
```

**Input side — context blocks:** Wherever entity IDs appear in context blocks sent to the LLM (resolved entity refs, session context, system prompt entity sections), present them as the same JSON object format:
```
Active experience: {"_id":"693f214...","name":"Tokyo Temple Tour","type":"experience"}
```
This trains a single consistent entity representation pattern for both input and output.

### 2. Backend Post-Processing (`enrichEntityReferences`)

New function added to the LLM response processing pipeline in `controllers/api/bienbot.js`, called after `parseLLMResponse()`.

**JSON object extraction:** Parse inline `{"_id":"...","name":"...","type":"..."}` objects from message text using a JSON-aware regex that anchors on the `_id` and `type` fields:
```
/\{"_id"\s*:\s*"([a-f0-9]{24})"[^}]*"type"\s*:\s*"(destination|experience|plan|plan_item|user)"[^}]*\}/g
```
Extract `_id`, `name`, and `type` from each match. Whitespace-tolerant to handle minor LLM formatting variation.

**Raw ObjectId fallback:** Detects bare 24-char hex strings (`\b[a-f0-9]{24}\b`) not already inside a parsed JSON object. For each detected ID, queries all entity collections in parallel to identify the type and name, then constructs a proper JSON object for enrichment.

**Enrichment flow:**

```
parseLLMResponse(llmResult.content)
  → { message, pending_actions }
  ↓
enrichEntityReferences(message, session, userId)
  → { message (unchanged), entity_refs: [...] }
  ↓
Stream to frontend: { message, entity_refs, pending_actions }
```

**`enrichEntityReferences(message, session, userId)`:**

1. Extract all inline JSON entity objects from message text using the JSON-aware regex
2. Detect any bare ObjectId patterns not already inside a parsed JSON object (raw ID fallback)
3. For bare ObjectIds: query Destination, Experience, Plan, User collections in parallel to identify the entity type and name. Construct a proper JSON object `{"_id":"...","name":"...","type":"..."}` and note its position for enrichment.
4. Batch-fetch all referenced entities by type (one query per type using `$in`):
   - Destinations: `name, country, city, photos`
   - Experiences: `name, destination (populated: name, country), plan_items (count), photos`
   - Plans: `experience (populated: name), planned_date, plan (count)`
   - Users: `name, email`
   - Plan items: Look up from parent experience/plan
5. Build `entity_refs` array with enriched data for each token
6. Return `{ message, entity_refs }`

**Entity ref schema:**

```javascript
{
  token: '{"_id":"693f...","name":"Tokyo Temple Tour","type":"experience"}',  // original JSON string for frontend matching
  type: "experience",                                  // entity type
  id: "693f21442d3e85842d1d26d0",                    // entity ID
  name: "Tokyo Temple Tour",                           // display name
  url: "/experiences/693f21442d3e85842d1d26d0",       // navigation URL
  meta: {                                              // type-specific metadata for card rendering
    destination_name: "Tokyo, Japan",                  // experience: destination
    item_count: 5,                                     // experience: plan items count
    // plan: experience_name, planned_date, item_count
    // destination: country, city
    // user: email (if visible)
    // plan_item: parent experience/plan name, activity_type
  }
}
```

**URL generation by type:**

| Type | URL Pattern |
|------|------------|
| destination | `/destinations/{id}` |
| experience | `/experiences/{id}` |
| plan | `/experiences/{experienceId}#plan-{planId}` |
| plan_item | `/experiences/{experienceId}#plan-{planId}-item-{itemId}` |
| user | `/profile/{id}` |

**Permission check:** Each enrichment query respects `enforcer.canView()`. If the user can't view an entity, the ref falls back to `{ type, id, name: displayName, url: null, meta: {} }` — the card renders as a plain label with no link.

**Performance:** Batch queries with `$in` minimize DB round-trips. Typical message has 0-3 entity references. The enrichment adds ~10-50ms for most cases.

### 3. SSE Streaming Changes

Currently the SSE stream sends:
- `token` events (message text chunks)
- `actions` event (pending actions)
- `done` event

Add `entity_refs` to the `done` event payload:

```javascript
sendSSE(res, 'done', {
  intent: classification.intent,
  confidence: classification.confidence,
  entity_refs: enrichmentResult.entity_refs  // NEW
});
```

The frontend assembles the full message from token chunks, then uses `entity_refs` from the `done` event to render rich cards after streaming completes.

### 4. Session Storage

`entity_refs` are stored alongside the assistant message in the session:

```javascript
await session.addMessage('assistant', parsed.message, {
  intent: classification.intent,
  actions_taken: [...],
  entity_refs: enrichmentResult.entity_refs  // NEW
});
```

This means when loading session history, entity refs are already available without re-enrichment.

**Schema addition to BienBotSession message subdocument:**

```javascript
entity_refs: [{
  token: String,
  type: { type: String, enum: ['destination', 'experience', 'plan', 'plan_item', 'user'] },
  id: String,
  name: String,
  url: String,
  meta: Schema.Types.Mixed
}]
```

### 5. Frontend Entity Card Component

**New component: `EntityCard`** in `src/components/BienBotPanel/EntityCard.jsx`

Renders an inline rich card for an entity reference. Tapping navigates to the entity page.

**Card layout by type:**

| Type | Icon | Primary | Secondary | Tertiary |
|------|------|---------|-----------|----------|
| destination | pin icon | name | country, city | — |
| experience | star icon | name | destination name | `{n} items` |
| plan | calendar icon | experience name | planned date | `{n} items` |
| plan_item | checkbox icon | text (truncated) | parent experience/plan | activity type |
| user | person icon | name | — | — |

**Card styling:**
- Full-width within the message bubble
- Subtle border, rounded corners, slightly elevated
- Type-colored left accent bar (same color scheme as action cards)
- Cursor pointer, hover state
- Uses design tokens for spacing and typography

**No-permission fallback:** If `url` is null (user can't view), render as a plain styled label (no hover, no click, no link).

### 6. Message Rendering Changes

In `BienBotPanel.jsx`, replace the current `{msg.content}` rendering with a new `renderMessageContent(msg)` function that:

1. Takes the message text and `msg.entity_refs` array
2. Splits the text on inline JSON entity object boundaries
3. For each entity object, finds the matching ref in `entity_refs` and renders an `EntityCard`
4. For plain text segments, renders as-is
5. If `entity_refs` is empty/undefined (old messages), renders plain text as before (backward compatible)

```jsx
function renderMessageContent(msg) {
  if (!msg.entity_refs?.length) return msg.content;

  // Match inline JSON entity objects: {"_id":"...","name":"...","type":"..."}
  const ENTITY_RE = /\{"_id"\s*:\s*"[a-f0-9]{24}"[^}]*"type"\s*:\s*"(?:destination|experience|plan|plan_item|user)"[^}]*\}/g;
  const parts = [];
  let lastIndex = 0;

  for (const match of msg.content.matchAll(ENTITY_RE)) {
    if (match.index > lastIndex) {
      parts.push(msg.content.slice(lastIndex, match.index));
    }
    const ref = msg.entity_refs.find(r => r.token === match[0]);
    parts.push(ref ? <EntityCard key={match.index} ref={ref} /> : match[0]);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < msg.content.length) {
    parts.push(msg.content.slice(lastIndex));
  }

  return parts;
}
```

### 7. Action Payload Enrichment (Bonus)

When the LLM returns `pending_actions` with entity IDs in payloads (e.g., `experience_id`, `plan_id`), the existing `PendingActionCard` renderers already show names from the payload (e.g., `payload.experience_name`). The system prompt already instructs the LLM to include human-readable fields alongside IDs.

No change needed here — action cards already work. The enrichment is specifically for the **message text** where entity references appear conversationally.

## Files Changed

| File | Change |
|------|--------|
| `controllers/api/bienbot.js` | Add `enrichEntityReferences()` function. Call it after `parseLLMResponse()`. Add entity reference format instructions to `buildSystemPrompt()`. Pass `entity_refs` in SSE `done` event. Pass `entity_refs` to `session.addMessage()`. |
| `models/bienbot-session.js` | Add `entity_refs` array to message subdocument schema. |
| `src/components/BienBotPanel/EntityCard.jsx` | New component — renders inline rich card for entity references. |
| `src/components/BienBotPanel/EntityCard.module.css` | New styles for entity cards. |
| `src/components/BienBotPanel/BienBotPanel.jsx` | Replace `{msg.content}` with `renderMessageContent(msg)` that parses tokens and renders EntityCards. Update `done` SSE handler to store `entity_refs`. |
| `src/hooks/useBienBot.js` | Pass `entity_refs` from SSE `done` event to message state. |
| `tests/api/bienbot-entity-refs.test.js` | Unit tests for `enrichEntityReferences()`. |
| `tests/utils/bienbot-entity-refs.test.js` | Unit tests for token extraction and raw ID detection. |

## Files NOT Changed

- **Context builders** — they already provide entity names to the LLM; no change needed
- **Action executor** — action payloads already carry names; enrichment is for message text only
- **PendingActionCard** — already renders entity info from payload fields

## Testing

- Unit test `enrichEntityReferences()`: token extraction, batch DB lookup, raw ID fallback, permission gating, mixed tokens + raw IDs
- Unit test frontend `renderMessageContent()`: token splitting, EntityCard rendering, backward compat with old messages
- Integration test: send a chat message, verify SSE `done` event includes `entity_refs`
- Integration test: load session history, verify stored `entity_refs` render correctly
- Manual test: verify cards render inline, tap navigates, no raw IDs visible

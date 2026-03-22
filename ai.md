# Biensperience AI Architecture

This document covers the full AI stack powering the platform: the shared AI Gateway, the provider registry and routing engine, the policy framework, NLP.js for local intent classification, and the BienBot conversational assistant built on top of these layers.

---

## Table of Contents

- [Biensperience AI Architecture](#biensperience-ai-architecture)
  - [Table of Contents](#table-of-contents)
  - [Platform AI Overview](#platform-ai-overview)
    - [Architectural Layers](#architectural-layers)
    - [Layer Responsibilities](#layer-responsibilities)
  - [AI Gateway](#ai-gateway)
    - [Request Lifecycle](#request-lifecycle)
    - [Policy Resolution Chain](#policy-resolution-chain)
    - [Guardrails](#guardrails)
    - [Usage Tracking](#usage-tracking)
    - [Using the Gateway from Any Feature](#using-the-gateway-from-any-feature)
  - [AI Provider Registry](#ai-provider-registry)
    - [Built-in Providers](#built-in-providers)
    - [Registering a New Provider](#registering-a-new-provider)
    - [DB-Backed Configuration](#db-backed-configuration)
    - [Provider Seeding](#provider-seeding)
  - [AI Policy Framework](#ai-policy-framework)
    - [Policy Scopes](#policy-scopes)
    - [Policy Schema](#policy-schema)
    - [Task Routing Rules](#task-routing-rules)
    - [Content Filtering](#content-filtering)
    - [Admin API](#admin-api)
  - [NLP.js — Local Intent Classification](#nlpjs--local-intent-classification)
    - [Why NLP.js](#why-nlpjs)
    - [Architecture](#architecture)
    - [Training Corpus](#training-corpus)
    - [Entity Extraction](#entity-extraction)
    - [Extending the Classifier](#extending-the-classifier)
  - [AI Features — Frontend Integration](#ai-features--frontend-integration)
    - [Available AI Functions](#available-ai-functions)
    - [Frontend AI Adapter Pattern](#frontend-ai-adapter-pattern)
    - [AI Feature Flag Gating](#ai-feature-flag-gating)
    - [AI Admin Dashboard](#ai-admin-dashboard)
  - [Hooking New Features into the AI Layer](#hooking-new-features-into-the-ai-layer)
    - [Backend: Using the Gateway](#backend-using-the-gateway)
    - [Backend: Adding a BienBot Intent](#backend-adding-a-bienbot-intent)
    - [Backend: Adding a BienBot Action](#backend-adding-a-bienbot-action)
    - [Frontend: Creating an AI-Powered Component](#frontend-creating-an-ai-powered-component)
  - [Files Reference](#files-reference)
    - [Platform AI Layer](#platform-ai-layer)
    - [NLP.js](#nlpjs)
    - [BienBot](#bienbot)
    - [Frontend AI](#frontend-ai)
  - [BienBot API Architecture](#bienbot-api-architecture)
    - [Invocation Contexts](#invocation-contexts)
    - [Entry Points](#entry-points)
    - [How it works](#how-it-works)
    - [Context inheritance across entities](#context-inheritance-across-entities)
    - [Layer Diagram](#layer-diagram)
    - [Data Flow](#data-flow)
      - [Message Lifecycle](#message-lifecycle)
      - [SSE Streaming Protocol](#sse-streaming-protocol)
      - [Action Execution Flow](#action-execution-flow)
      - [Event Emission After Mutations](#event-emission-after-mutations)
    - [Session Management](#session-management)
      - [Session Lifecycle](#session-lifecycle)
      - [Session Creation](#session-creation)
      - [Session Context Accumulation](#session-context-accumulation)
      - [Session Archival (Soft Delete)](#session-archival-soft-delete)
      - [Session Ownership](#session-ownership)
    - [Conversation Compacting](#conversation-compacting)
      - [Multi-Turn History Window](#multi-turn-history-window)
      - [Session Summarization (Conversation Compressing)](#session-summarization-conversation-compressing)
      - [Token Budget Management](#token-budget-management)
      - [Summary Caching and Staleness](#summary-caching-and-staleness)
    - [Messages Integration](#messages-integration)
    - [Chat Drawer](#chat-drawer)
      - [BienBotTrigger (FAB)](#bienbottrigger-fab)
      - [BienBotPanel (Drawer/Sheet)](#bienbotpanel-drawersheet)
      - [Panel UI Elements](#panel-ui-elements)
      - [Lazy Loading](#lazy-loading)
    - [Notifications](#notifications)
      - [Notification-Only Mode (Without AI Feature Flag)](#notification-only-mode-without-ai-feature-flag)
      - [AI-Enabled Mode (With `ai_features` Flag)](#ai-enabled-mode-with-ai_features-flag)
      - [Notification Preference Gate](#notification-preference-gate)
    - [Files](#files)
      - [Backend](#backend)
      - [Frontend](#frontend)
    - [Session Model](#session-model)
    - [Intent Classifier](#intent-classifier)
      - [Intent Types](#intent-types)
      - [Training Corpus](#training-corpus-1)
      - [Entity Extraction Strategy](#entity-extraction-strategy)
    - [Context Builders](#context-builders)
    - [Session Resume \& Greeting](#session-resume--greeting)
      - [Session Summarizer prompt structure](#session-summarizer-prompt-structure)
      - [API endpoint](#api-endpoint)
      - [Summary staleness](#summary-staleness)
    - [Main LLM Call — Prompt Structure](#main-llm-call--prompt-structure)
      - [Clarifying Question Behaviour](#clarifying-question-behaviour)
    - [Action Executor](#action-executor)
      - [User Scoping](#user-scoping)
    - [API Endpoints](#api-endpoints)
      - [`POST /api/bienbot/chat` request body](#post-apibienbotchat-request-body)
    - [Feature Flag](#feature-flag)
    - [Security Considerations](#security-considerations)
    - [Frontend Hook](#frontend-hook)
    - [BienBot Trigger Component](#bienbot-trigger-component)
    - [End-to-End Example Flow](#end-to-end-example-flow)
      - [Scenario A — Standalone chat (Messages tab, no invokeContext)](#scenario-a--standalone-chat-messages-tab-no-invokecontext)
      - [Step 1 — Discover destination](#step-1--discover-destination)
      - [Step 2 — Select experience](#step-2--select-experience)
      - [Step 3 — User confirms](#step-3--user-confirms)
      - [Step 4 — Add plan items](#step-4--add-plan-items)
      - [Step 5 — Invite collaborator](#step-5--invite-collaborator)
      - [Scenario B — In-context invocation from a Plan page](#scenario-b--in-context-invocation-from-a-plan-page)
      - [Scenario C — In-context invocation from a Destination page](#scenario-c--in-context-invocation-from-a-destination-page)
      - [Scenario D — Resuming a past session](#scenario-d--resuming-a-past-session)
    - [Implementation Sequence](#implementation-sequence)

---

## Platform AI Overview

The Biensperience AI stack is designed as a layered architecture where **any feature** — current or future — can make AI-powered requests through a single gateway without coupling to a specific LLM provider.

### Architectural Layers

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Feature Layer                                 │
│  BienBot  │  Autocomplete  │  Summarize  │  Document AI  │  Future  │
└──────┬───────────┬──────────────┬──────────────┬──────────────┬──────┘
       │           │              │              │              │
       ▼           ▼              ▼              ▼              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     AI Gateway (ai-gateway.js)                       │
│  Policy Resolution → Content Filtering → Rate Limiting →             │
│  Token Budget Check → Provider/Model Routing → Usage Tracking        │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│              AI Provider Registry (ai-provider-registry.js)          │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌──────────┐           │
│  │  OpenAI  │  │ Anthropic │  │  Mistral  │  │  Gemini  │  + more   │
│  └──────────┘  └───────────┘  └──────────┘  └──────────┘           │
└──────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                   Data Layer (MongoDB)                                │
│  AIPolicy  │  AIProviderConfig  │  AIUsage  │  BienBotSession        │
└──────────────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

| Layer | File(s) | Purpose |
|-------|---------|---------|
| **Feature Layer** | `controllers/api/ai.js`, `controllers/api/bienbot.js`, `utilities/ai-document-utils.js` | Individual AI-powered features make requests via the gateway |
| **AI Gateway** | `utilities/ai-gateway.js` | Central entry point — resolves policies, enforces guardrails, routes to the right provider, tracks usage |
| **Provider Registry** | `utilities/ai-provider-registry.js` | Manages provider handlers, DB-backed config, API key resolution, provider calling logic |
| **Data Layer** | `models/ai-policy.js`, `models/ai-provider-config.js`, `models/ai-usage.js` | Persists policies, provider configs, and usage analytics |

**Key design principle**: Features never call LLM APIs directly. They call `executeAIRequest()` from the gateway, which handles all cross-cutting concerns uniformly.

---

## AI Gateway

**File:** `utilities/ai-gateway.js`

The gateway is the single entry point for all AI LLM requests on the platform.

### Request Lifecycle

```
executeAIRequest({ messages, task, user, options, entityContext })
    │
    ├── 1. resolvePolicy()      → Merge entity + user + global + env policies
    ├── 2. applyContentFiltering() → Block/redact disallowed content
    ├── 3. checkRateLimit()      → In-memory sliding window (super admins exempt)
    ├── 4. checkTokenBudget()    → Daily/monthly token limits via AIUsage model
    ├── 5. routeRequest()        → Determine provider + model
    ├── 6. callProvider()        → Dispatch to registered provider handler
    └── 7. trackUsage()          → Record in AIUsage model
```

### Policy Resolution Chain

Policies merge from lowest to highest priority. Higher-priority settings override lower:

| Priority | Source | Example |
|----------|--------|---------|
| 4 (lowest) | Environment variables | `AI_DEFAULT_PROVIDER=openai` |
| 3 | Global policy (DB) | Rate limits, token budgets for all users |
| 2 | User-scoped policy (DB) | Custom limits for specific user |
| 1 (highest) | Entity `ai_config` | Experience-level provider/model override |

### Guardrails

| Guardrail | Implementation | Bypass |
|-----------|---------------|--------|
| **Rate Limiting** | In-memory sliding window (per-minute, per-hour, per-day) | Super admins exempt |
| **Token Budgets** | Daily/monthly input+output token limits checked against AIUsage | Super admins exempt |
| **Content Filtering** | Regex-based block and redact patterns on user messages | N/A |
| **Provider Restrictions** | `allowed_providers` and `blocked_providers` lists | N/A |
| **Model Restrictions** | `allowed_models` per provider | N/A |
| **Max Tokens Cap** | `max_tokens_per_request` (hard cap, default 4000) | N/A |

### Usage Tracking

Every request (success, error, or filtered) is tracked in the `AIUsage` model:

- One document per user per day (daily aggregation)
- Per-provider and per-task breakdowns
- Individual request log (capped at 100 entries/day)
- 90-day auto-expiry via MongoDB TTL index

### Using the Gateway from Any Feature

```javascript
const { executeAIRequest } = require('../utilities/ai-gateway');

// Any backend feature can call the gateway
async function myNewAIFeature(req, res) {
  const result = await executeAIRequest({
    messages: [
      { role: 'system', content: 'You are a helpful travel assistant.' },
      { role: 'user', content: req.body.prompt }
    ],
    task: 'my_new_task',            // Task identifier for routing + analytics
    user: req.user,                  // Authenticated user (for policy + tracking)
    options: {                       // Optional overrides
      provider: 'anthropic',         // Override provider (policy still enforced)
      model: 'claude-3-haiku',       // Override model
      temperature: 0.7,
      maxTokens: 500
    },
    entityContext: {                  // Optional entity context
      entityType: 'experience',
      entityId: experience._id,
      aiConfig: experience.ai_config // Entity-level AI config (if any)
    }
  });

  return result.content;  // LLM response text
  // Also available: result.usage, result.model, result.provider, result.policyApplied
}
```

---

## AI Provider Registry

**File:** `utilities/ai-provider-registry.js`

Manages AI provider handlers with database-backed configuration and in-memory caching.

### Built-in Providers

| Provider | Default Model | Endpoint | Handler |
|----------|---------------|----------|---------|
| **OpenAI** | `gpt-4o-mini` | `api.openai.com/v1/chat/completions` | Standard chat completions |
| **Anthropic** | `claude-3-haiku-20240307` | `api.anthropic.com/v1/messages` | Anthropic messages API |
| **Mistral** | `mistral-small-latest` | `api.mistral.ai/v1/chat/completions` | OpenAI-compatible |
| **Gemini** | `gemini-1.5-flash` | `generativelanguage.googleapis.com` | Google generative API |

All providers are registered at startup via `ai-seed-providers.js` and can be enabled/disabled through the Admin UI.

### Registering a New Provider

```javascript
const { registerProvider } = require('../utilities/ai-provider-registry');

registerProvider('my-provider', async (messages, options, config) => {
  // config contains: endpoint, api_version, default_model, etc. from DB
  // options contains: model, temperature, maxTokens from gateway

  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: options.model || config.default_model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1000
    })
  });

  const data = await response.json();

  return {
    content: data.choices[0].message.content,
    usage: {
      inputTokens: data.usage.prompt_tokens,
      outputTokens: data.usage.completion_tokens
    },
    model: data.model,
    provider: 'my-provider'
  };
});
```

### DB-Backed Configuration

Provider configs are stored in the `AIProviderConfig` model:

```javascript
{
  provider: 'openai',           // Unique identifier
  display_name: 'OpenAI',       // UI label
  endpoint: 'https://...',      // API endpoint
  api_version: null,            // Optional version header
  default_model: 'gpt-4o-mini', // Fallback model
  valid_models: ['gpt-4o', 'gpt-4o-mini', ...],
  enabled: true,                // Can be toggled via admin UI
  priority: 0,                  // Fallback order (lower = higher priority)
  env_key_name: 'OPENAI_API_KEY'  // Which env var holds the API key
}
```

**API keys are never stored in the database** — only the env var name is stored, and the registry reads the actual key from `process.env` at call time.

### Provider Seeding

**File:** `utilities/ai-seed-providers.js`

On server startup, the four built-in providers and a default global policy are seeded into the database if absent. Uses upsert operations so it is safe to call repeatedly.

---

## AI Policy Framework

**File:** `models/ai-policy.js`

Policies define guardrails for AI usage — rate limits, token budgets, allowed providers/models, content filtering, and task-specific routing rules.

### Policy Scopes

| Scope | Target | Purpose |
|-------|--------|---------|
| `global` | `null` | Default policy for all users |
| `user` | `ObjectId (User)` | Custom policy for a specific user |

### Policy Schema

```javascript
{
  name: String,
  scope: 'global' | 'user',
  target: ObjectId,            // User ID for user-scoped policies
  allowed_providers: [String], // Empty = all allowed
  blocked_providers: [String],
  allowed_models: [{
    provider: String,
    models: [String]
  }],
  rate_limits: {
    requests_per_minute: Number,
    requests_per_hour: Number,
    requests_per_day: Number
  },
  token_budget: {
    daily_input_tokens: Number,
    daily_output_tokens: Number,
    monthly_input_tokens: Number,
    monthly_output_tokens: Number
  },
  task_routing: [{             // Route specific tasks to specific providers/models
    task: String,
    provider: String,
    model: String,
    max_tokens: Number,
    temperature: Number
  }],
  content_filtering: {
    enabled: Boolean,
    block_patterns: [String],  // Regex patterns that block requests
    redact_patterns: [String]  // Regex patterns that redact matched content
  },
  max_tokens_per_request: Number,
  active: Boolean
}
```

### Task Routing Rules

Task routing allows admins to direct specific AI tasks to specific providers/models:

```javascript
task_routing: [
  { task: 'autocomplete', provider: 'openai', model: 'gpt-4o-mini', max_tokens: 200 },
  { task: 'summarize', provider: 'anthropic', model: 'claude-3-haiku', max_tokens: 500 },
  { task: 'translate', provider: 'mistral', model: 'mistral-small-latest' },
  { task: 'bienbot_chat', provider: 'openai', model: 'gpt-4o', temperature: 0.8 }
]
```

When a feature requests a task, the gateway checks for a matching routing rule before falling back to env vars or the default provider.

### Content Filtering

Policies support regex-based content filtering on user messages:

- **Block patterns**: If any pattern matches, the request is rejected with a `CONTENT_FILTERED` error
- **Redact patterns**: Matched text is replaced with `[REDACTED]` before sending to the LLM

Usage is tracked with status `'filtered'` for blocked requests.

### Admin API

The AI Admin dashboard provides full CRUD for policies:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/ai/admin/policies` | List all policies |
| `POST /api/ai/admin/policies` | Create policy |
| `PUT /api/ai/admin/policies/:id` | Update policy |
| `DELETE /api/ai/admin/policies/:id` | Delete policy |
| `GET /api/ai/admin/providers` | List provider configs |
| `PUT /api/ai/admin/providers/:id` | Update provider config |
| `GET /api/ai/admin/usage` | Usage analytics |
| `GET /api/ai/admin/routing` | Get task routing |
| `PUT /api/ai/admin/routing` | Update task routing |

All admin endpoints require `super_admin` role + `ai_admin` feature flag.

---

## NLP.js — Local Intent Classification

**File:** `utilities/bienbot-intent-classifier.js`  
**Corpus:** `utilities/bienbot-intent-corpus.json`  
**Package:** `node-nlp-rn` (NLP.js for React Native / Node.js runtime)

### Why NLP.js

NLP.js provides **zero-latency intent classification** without requiring an LLM API call:

| Aspect | NLP.js (local) | LLM API call |
|--------|----------------|--------------|
| **Latency** | < 1ms | 200–2000ms |
| **Cost** | Free | Per-token billing |
| **Privacy** | Runs entirely on-server | Message sent to third party |
| **Accuracy** | Good for structured intents | Better for open-ended classification |
| **Setup** | Train once on startup | No training needed |

BienBot uses NLP.js as a lightweight first-pass classifier, reserving expensive LLM calls for response generation and complex reasoning.

### Architecture

```
Server Start
    │
    ├── 1. Load corpus from bienbot-intent-corpus.json
    ├── 2. Add regex entities (email detection)
    ├── 3. Train NLP.js neural network
    └── 4. Cache trained manager (singleton)

Message Arrives
    │
    ├── 1. classifyIntent(message)
    ├── 2. NLP.js processes message through trained model
    ├── 3. Returns { intent, entities, confidence }
    └── 4. Low-confidence fallback → ANSWER_QUESTION
```

The NLP.js manager is trained **once on first use** and cached as a singleton. The training takes ~100ms and the model persists in memory for the lifetime of the server process. `resetManager()` is available for testing.

### Training Corpus

The corpus (`bienbot-intent-corpus.json`) contains example utterances per intent:

```json
{
  "name": "BienBot Intent Corpus",
  "locale": "en",
  "data": [
    {
      "intent": "QUERY_DESTINATION",
      "utterances": [
        "Tell me about Tokyo",
        "What's popular in Paris?",
        "I want to know about destinations in Japan",
        "What can I do in Barcelona?"
      ]
    },
    {
      "intent": "PLAN_EXPERIENCE",
      "utterances": [
        "Plan a 3-day trip to Kyoto",
        "I want to plan the Cherry Blossom Day Trip",
        "Help me plan an experience"
      ]
    }
  ]
}
```

NLP.js generalises from training examples — the model learns word patterns and can classify novel phrasings that weren't in the training set.

### Entity Extraction

| Entity | Method | Notes |
|--------|--------|-------|
| `user_email` | NLP.js regex entity + fallback regex | Matches standard email patterns |
| `destination_name` | Heuristic regex patterns | Extracts capitalised nouns after prepositions (`about`, `in`, `to`, `for`) |
| `experience_name` | NLP.js slot filling + quoted string fallback | Looks for quoted strings |
| `plan_item_texts` | Comma/and-separated list parsing | Only for `ADD_PLAN_ITEMS` intent |
| `tip_content` | Content after "tip:"/"tip about" extraction | Only for `ADD_DESTINATION_TIP` intent |
| `cost_category` | Keyword + synonym mapping | Maps hotel→accommodation, flight→transport, dinner→food, tour→activities, gear→equipment |
| `cost_title` | Next word after cost/expense/charge | Extracts cost title from natural language |
| `visibility_value` | Keyword match (public/private) | For experience visibility setting |
| `experience_type` | Keyword match | Extracts type keywords (guided, self-guided, group, solo, etc.) |
| `currency_value` | Regex matching 20 currency codes | Supports USD, EUR, GBP, JPY, CAD, AUD, CHF, CNY, INR, MXN, BRL, KRW, SGD, HKD, SEK, NOK, DKK, NZD, ZAR, THB |
| `new_name` | Rename pattern extraction | Extracts target name from "rename to X" / "change name to X" patterns |

### Extending the Classifier

To add a new intent:

1. **Add utterances** to `utilities/bienbot-intent-corpus.json`:
   ```json
   {
     "intent": "MY_NEW_INTENT",
     "utterances": [
       "example phrase one",
       "another example phrase",
       "yet another phrasing"
     ]
   }
   ```

2. **Add the intent constant** to `utilities/bienbot-intent-classifier.js`:
   ```javascript
   const INTENTS = {
     // ... existing
     MY_NEW_INTENT: 'MY_NEW_INTENT'
   };
   ```

3. **Handle the intent** in the BienBot controller or context builder.

4. **Restart the server** — the model retrains automatically on startup.

Add at least 5–10 diverse utterances per intent for reliable classification.

---

## AI Features — Frontend Integration

### Available AI Functions

Frontend AI functions are in `src/utilities/ai/functions/`:

| Function | File | Task Key | Purpose |
|----------|------|----------|---------|
| `autocomplete` | `autocomplete.js` | `autocomplete` | Text autocompletion for plan items |
| `improveDescription` | `improve-description.js` | `improve_description` | Improve experience/destination descriptions |
| `editLanguage` | `edit-language.js` | `edit_language` | Adjust tone and style of text |
| `summarize` | `summarize.js` | `summarize` | Summarize long text |
| `generateTips` | `generate-tips.js` | `generate_tips` | Generate travel tips for destinations |
| `translate` | `translate.js` | `translate` | Translate text to a target language |

All functions call the backend `/api/ai/*` endpoints, which route through the AI Gateway. System prompts are centralized in `src/lang.constants.js` → `lang.en.prompts` and can be overridden per call via `options.prompts`.

### Frontend AI Adapter Pattern

Frontend adapters in `src/utilities/ai/adapters/` normalize provider-specific response formats:

```
Frontend AI Function (e.g. autocomplete)
    │
    └── POST /api/ai/complete (or /api/ai/{task})
            │
            └── Backend AI Controller
                    │
                    └── executeAIRequest() (AI Gateway)
                            │
                            └── callProvider() (Provider Registry)
```

The `useAI` hook (`src/utilities/ai/useAI.js`) provides React-friendly state management for AI operations.

### AI Feature Flag Gating

All AI features are gated behind the `ai_features` feature flag:

```jsx
// Component-level gating
import { FeatureFlag } from '../components/FeatureFlag';

<FeatureFlag flag="ai_features" fallback={<UpgradePrompt />}>
  <AIAutocomplete />
</FeatureFlag>

// Hook-level gating
import { useGatedAction } from '../hooks/useFeatureFlag';

const handleAI = useGatedAction('ai_features', async () => {
  return await autocomplete(text);
});
```

### AI Admin Dashboard

**File:** `src/views/AIAdmin/AIAdmin.jsx`  
**Route:** `/admin/ai`

The AI Admin dashboard (accessible via Admin > AI in the navigation) provides four tabs:

| Tab | Component | Purpose |
|-----|-----------|---------|
| **Providers** | `AIAdminProviders` | View/edit provider configs, toggle enabled state |
| **Policies** | `AIAdminPolicies` | CRUD for global and user-scoped policies |
| **Usage** | `AIAdminUsage` | Usage analytics, per-user/per-provider breakdowns |
| **Routing** | `AIAdminRouting` | Configure task-to-provider routing rules |

Requires `super_admin` role + `ai_admin` feature flag.

---

## Hooking New Features into the AI Layer

The AI stack is designed so any feature can plug in with minimal boilerplate.

### Backend: Using the Gateway

Any new backend feature that needs LLM capabilities should:

1. **Define a task key** (e.g., `'recommend_restaurant'`)
2. **Call `executeAIRequest()`** from the gateway
3. **Optionally add a routing rule** in the admin UI to direct the task to a specific provider/model

```javascript
const { executeAIRequest } = require('../utilities/ai-gateway');
const { requireFeatureFlag } = require('../utilities/feature-flag-middleware');

// In route definition
router.post('/api/recommendations',
  ensureLoggedIn,
  requireFeatureFlag('ai_features'),
  async (req, res) => {
    const result = await executeAIRequest({
      messages: [
        { role: 'system', content: 'You are a restaurant recommendation engine.' },
        { role: 'user', content: `Recommend restaurants near ${req.body.destination}` }
      ],
      task: 'recommend_restaurant',
      user: req.user
    });

    res.json({ recommendations: result.content });
  }
);
```

The gateway automatically handles:
- Policy enforcement (rate limits, token budgets, content filtering)
- Provider routing (respects admin-configured task routing)
- Usage tracking (appears in Admin > AI > Usage)
- Error handling (GatewayError with proper status codes)

### Backend: Adding a BienBot Intent

To make BienBot understand a new user intent:

1. Add utterances to `utilities/bienbot-intent-corpus.json`
2. Add the intent constant to `bienbot-intent-classifier.js`
3. Add a handler in the BienBot controller's intent-dispatch logic
4. Optionally add a context builder for the new intent's data needs

### Backend: Adding a BienBot Action

To let BienBot propose and execute a new type of write action:

1. Add the action type to `ALLOWED_ACTION_TYPES` in `utilities/bienbot-action-executor.js`
2. Implement the execution logic (reuse existing controller functions)
3. Update the LLM system prompt to describe the new action type
4. Add the action type to the event emission map in `src/utilities/bienbot-api.js`

### Frontend: Creating an AI-Powered Component

```jsx
import { useGatedAction } from '../hooks/useFeatureFlag';
import sendRequest from '../utilities/send-request';

function MyAIComponent({ destination }) {
  const [result, setResult] = useState(null);

  // Gate the action behind the feature flag
  const handleGenerate = useGatedAction('ai_features', async () => {
    const data = await sendRequest('/api/ai/my-task', 'POST', {
      prompt: `Generate tips for ${destination.name}`
    });
    setResult(data.content);
  });

  return (
    <FeatureFlag flag="ai_features">
      <button onClick={handleGenerate}>Generate Tips</button>
      {result && <div>{result}</div>}
    </FeatureFlag>
  );
}
```

---

## Files Reference

### Platform AI Layer

| File | Purpose |
|------|---------|
| `utilities/ai-gateway.js` | Central entry point — policy resolution, guardrails, routing, usage tracking |
| `utilities/ai-provider-registry.js` | Provider handler management, DB-backed config caching, provider dispatch |
| `utilities/ai-seed-providers.js` | Seeds default provider configs and global policy on startup |
| `models/ai-policy.js` | Guardrail policies (rate limits, token budgets, content filtering, task routing) |
| `models/ai-provider-config.js` | Provider configurations (endpoint, models, enabled state) |
| `models/ai-usage.js` | Per-user per-day usage analytics with 90-day TTL |
| `utilities/ai-document-utils.js` | Document upload, text extraction, AI-powered parsing |

### NLP.js

| File | Purpose |
|------|---------|
| `utilities/bienbot-intent-classifier.js` | NLP.js neural network for local intent classification |
| `utilities/bienbot-intent-corpus.json` | Training utterances for each intent |

### BienBot

| File | Purpose |
|------|---------|
| `models/bienbot-session.js` | Conversation sessions with context, messages, pending actions |
| `utilities/bienbot-context-builders.js` | Entity-aware context builders for LLM prompts |
| `utilities/bienbot-action-executor.js` | Action execution via existing controller logic |
| `utilities/bienbot-session-summarizer.js` | Session compression for resume greeting |
| `controllers/api/bienbot.js` | BienBot API controller (orchestration, SSE streaming) |
| `routes/api/bienbot.js` | Route definitions with auth, feature flags, rate limiting |

### Frontend AI

| File | Purpose |
|------|---------|
| `src/utilities/ai/` | AI functions, adapters, events, and config |
| `src/utilities/ai-admin-api.js` | Admin API calls for providers, policies, usage, routing |
| `src/utilities/bienbot-api.js` | BienBot frontend API calls with event emission |
| `src/hooks/useBienBot.js` | Conversation state, streaming, pending action management |
| `src/views/AIAdmin/` | AI Admin dashboard (Providers, Policies, Usage, Routing tabs) |

---

## BienBot API Architecture

BienBot is a stateful, intent-driven AI assistant built on top of the platform AI layer described above. It has two modes of access:

1. **Standalone chat** — a dedicated Messages-style conversation UI for open-ended, multi-entity planning.
2. **In-context invocation** — a floating trigger available on every entity page (Destination, Experience, Plan, etc.) that opens BienBot pre-loaded with awareness of the entity currently on screen.

In both modes the same pipeline runs: the bot classifies intent (via NLP.js), fetches entity context from MongoDB, constructs an augmented LLM prompt (via the AI Gateway), optionally executes write actions (with a confirmation step), and streams the response back.

---

### Invocation Contexts

BienBot can be opened from anywhere in the application. Each entry point passes an optional `invokeContext` object that pre-seeds the session's entity context before the user types a single word.

### Entry Points

| Surface | `invokeContext` payload | Bot opens knowing… |
|---|---|---|
| **Messages tab** (standalone) | `{}` | Nothing — open-ended |
| **SingleDestination page** | `{ entity: 'destination', id }` | The destination, its experiences, public plan items |
| **SingleExperience page** | `{ entity: 'experience', id }` | The experience, its destination, user's existing plan |
| **My Plan tab** | `{ entity: 'plan', id }` | The full plan, completion status, collaborators |
| **Plan item modal** | `{ entity: 'plan_item', planId, itemId }` | The specific plan item and its parent plan |
| **Profile / AppHome** | `{ entity: 'user', id }` | The user's plans, favourites, and recent activity |

### How it works

1. The `BienBotTrigger` component (a floating button rendered on every entity view) calls `openBienBot(invokeContext)`.
2. The frontend hook calls `POST /api/bienbot/chat` with `{ message, sessionId, invokeContext }`.
3. If a new session is created, the controller immediately calls the appropriate context builder(s) for the `invokeContext` entity and stores the result in `session.context` — so the very first LLM call already has rich entity data.
4. For subsequent turns the session's `context` is used; the `invokeContext` is only acted on at session creation time and when the user navigates to a new entity and re-opens the bot without an existing session.

### Context inheritance across entities

Because the session persists across pages, starting BienBot on a Destination and navigating to a specific Experience does not lose the destination context — the session holds all IDs that have been resolved during the conversation. The bot always has access to the full breadcrumb: *user → destination → experience → plan*.

---

### Layer Diagram

```
User Message  +  invokeContext (entity, id)
    │
    ▼
[POST /api/bienbot/chat]
    │
    ├─── 0. Resolve invokeContext (new sessions only)
    │         Run context builder(s) for the invokeContext entity
    │         Pre-populate session.context with resolved IDs
    │
    ├─── 1. Load Session (BienBotSession model)
    │         ↳ if RESUMING existing session (POST /sessions/:id/resume)
    │               Run Session Summarizer  ◄── fast/cheap model
    │               Generates: summary text + suggested_next_steps
    │               Caches result in session.summary (TTL 6 hours)
    │               Produces a greeting message → returned as first new message
    │               Skip remaining pipeline; return greeting immediately
    │
    │
    ├─── 2. Intent Classifier  ◄── NLP.js neural network (local, no API call)
    │         Emits: PLAN_EXPERIENCE | CREATE_EXPERIENCE | QUERY_DESTINATION |
    │                ADD_PLAN_ITEMS | INVITE_COLLABORATOR | ANSWER_QUESTION | ...
    │         Trained on startup from bienbot-intent-corpus.json
    │
    ├─── 3. Context Builder  ◄── MongoDB queries, uses existing models
    │         Fetches relevant entities and summarises them into LLM-safe text
    │         Starts from session.context (pre-seeded by invokeContext if present)
    │
    ├─── 4. Main LLM Call  ◄── Augmented prompt (system + context + history + user msg)
    │         Returns structured JSON {reply, actions[]}
    │
    ├─── 5. Action Executor
    │         • Dry-run actions → return preview (no DB writes yet)
    │         • User confirms → POST /api/bienbot/sessions/:id/execute → writes to DB
    │         • Reuses existing controllers' logic (not raw model calls)
    │
    └─── 6. Persist Session  →  Return response (SSE or JSON)
```

---

### Data Flow

#### Message Lifecycle

A single chat turn follows this data flow from the user's keypress to the rendered response:

```
1. User types message in BienBotPanel textarea
2. useBienBot.sendMessage(text) called
   ├── Optimistic: append user message to local messages[]
   ├── Optimistic: append empty assistant placeholder message
   └── POST /api/bienbot/chat via bienbot-api.postMessage() (SSE stream)

3. Backend receives request
   ├── Input validation (length, null bytes, sessionId format)
   ├── invokeContext handling (resolve label from DB, permission check)
   ├── Load or create BienBotSession
   ├── classifyIntent(message) → { intent, entities, confidence }
   ├── buildContextBlocks() → merged context string
   ├── Build system prompt + conversation history (last 10 turns)
   ├── callProvider() → LLM generates structured JSON response
   ├── parseLLMResponse() → { message, pending_actions }
   └── Persist: addMessage(user), addMessage(assistant), setPendingActions(), generateTitle()

4. SSE stream emitted
   ├── event: session   → { sessionId, title }
   ├── event: token     → { text } (repeated, ~50 char chunks)
   ├── event: actions   → { pending_actions }
   └── event: done      → { usage, intent, confidence }

5. Frontend receives SSE events
   ├── onSession: update sessionIdRef, set currentSession
   ├── onToken: append chunk to assistant placeholder message
   ├── onActions: setPendingActions
   └── onDone: setIsStreaming(false), setIsLoading(false)

6. broadcastEvent('bienbot:message_added', { sessionId, message })
```

#### SSE Streaming Protocol

The chat endpoint streams responses as Server-Sent Events to enable progressive rendering:

| Event | Data Shape | Purpose |
|---|---|---|
| `session` | `{ sessionId: string, title: string }` | Sent first — provides session ID for new sessions |
| `token` | `{ text: string }` | Repeated — message text in ~50 char chunks |
| `actions` | `{ pending_actions: Action[] }` | Sent once if LLM proposes actions |
| `done` | `{ usage: object, intent: string, confidence: number }` | Signals stream completion |

The frontend uses `fetch` + `ReadableStream` to parse SSE events. An `AbortController` allows the user to cancel in-flight streams.

#### Action Execution Flow

```
1. User clicks "Yes" on an ActionCard in BienBotPanel
2. useBienBot.executeActions([actionId])
3. bienbot-api.executeActions(sessionId, [actionId])
   └── POST /api/bienbot/sessions/:id/execute { actionIds: [...] }

4. Backend (bienbot controller)
   ├── Load session, validate action IDs exist and are not already executed
   └── bienbot-action-executor.executeActions(actions, user, session)
       ├── For each action:
       │   ├── Build mock req/res objects
       │   ├── Call existing controller function (e.g. plansController.createPlan)
       │   ├── Capture response from mock res
       │   └── session.markActionExecuted(actionId, result)
       └── session.updateContext(contextUpdates)  // e.g. new plan_id

5. Frontend receives results
   ├── Remove executed actions from pendingActions state
   ├── Broadcast entity events per action type:
   │   ├── create_destination → 'destination:created'
   │   ├── create_experience → 'experience:created'
   │   ├── create_plan → 'plan:created'
   │   ├── add_plan_items/update_plan_item/sync_plan → 'plan:updated'
   │   └── invite_collaborator → 'invite:created'
   └── broadcastEvent('bienbot:actions_executed', { sessionId, actionIds, results })
```

#### Event Emission After Mutations

All BienBot mutations emit events through the event bus so the rest of the UI stays in sync:

| API Function | Events Emitted |
|---|---|
| `postMessage()` | `bienbot:message_added` |
| `resumeSession()` | `bienbot:session_resumed` |
| `executeActions()` | Entity-specific events + `bienbot:actions_executed` |
| `cancelAction()` | `bienbot:action_cancelled` |
| `deleteSession()` | `bienbot:session_deleted` |

Entity-specific event mapping in `executeActions()` by action type:

| Action Type | Event Emitted |
|---|---|
| `create_destination` | `destination:created` |
| `update_destination`, `toggle_favorite_destination` | `destination:updated` |
| `create_experience` | `experience:created` |
| `update_experience`, `add_experience_plan_item`, `update_experience_plan_item`, `delete_experience_plan_item` | `experience:updated` |
| `create_plan` | `plan:created` |
| `delete_plan` | `plan:deleted` |
| `add_plan_items`, `update_plan_item`, `delete_plan_item`, `sync_plan`, `update_plan`, `add_plan_cost`, `update_plan_cost`, `delete_plan_cost`, `remove_collaborator`, `set_member_location`, `remove_member_location`, `add_plan_item_note`, `add_plan_item_detail`, `assign_plan_item`, `unassign_plan_item` | `plan:updated` |
| `invite_collaborator` | `invite:created` |

Entity-specific events are consumed by `DataContext` and component subscriptions, causing automatic re-renders throughout the app.

---

### Session Management

#### Session Lifecycle

```
┌──────────┐    sendMessage()     ┌──────────┐    archive()      ┌──────────┐
│          │  (no sessionId)      │          │  (DELETE request)  │          │
│  (none)  │ ─────────────────►   │  active  │ ─────────────────► │ archived │
│          │                      │          │                    │          │
└──────────┘                      └────┬─────┘                    └──────────┘
                                       │
                                       │ resume()
                                       │ (loads history, generates greeting)
                                       ▼
                                  ┌──────────┐
                                  │ resumed  │ (still status: 'active')
                                  │          │
                                  └──────────┘
```

#### Session Creation

Sessions are created automatically when `postMessage()` is called without a `sessionId`:

1. `BienBotSession.createSession(userId, invokeContext)` creates a new document
2. If `invokeContext` is present, `session.context` is pre-populated with resolved entity IDs
3. The session title is auto-generated from the first user message (truncated to 80 chars)
4. The `invokeContext` is stored permanently but only acted upon at creation time

#### Session Context Accumulation

The `session.context` object accumulates entity IDs as the conversation progresses:

```javascript
// Turn 1: User asks about Kyoto
session.context = { destination_id: '<kyotoId>' }

// Turn 2: User selects "Cherry Blossom Day Trip" experience
session.context = { destination_id: '<kyotoId>', experience_id: '<expId>' }

// Turn 3: User confirms plan creation → action executor creates plan
session.context = { destination_id: '<kyotoId>', experience_id: '<expId>', plan_id: '<planId>' }
```

Context is merged (never replaced) via `session.updateContext()`. This ensures the bot maintains awareness of the full entity chain across turns.

#### Session Archival (Soft Delete)

`DELETE /api/bienbot/sessions/:id` does **not** hard-delete the session. It calls `session.archive()` which sets `status: 'archived'`. Archived sessions:
- Are excluded from `listSessions()` by default (unless `?status=archived` is passed)
- Can still be retrieved by ID for audit/debugging
- Are never permanently deleted (data retention for compliance)

#### Session Ownership

Every session operation verifies `session.user.toString() === userId`. There is no shared session access — each session belongs to exactly one user. Super admins do not have access to other users' BienBot sessions.

---

### Conversation Compacting

BienBot uses multiple strategies to keep conversations manageable within LLM context windows.

#### Multi-Turn History Window

The main chat endpoint includes only the **last 10 messages** from `session.messages` in the LLM prompt. Older messages are not sent to the model but remain stored in the database for:
- Session resume summarization
- Audit trail
- Future conversation search

```javascript
// controllers/api/bienbot.js
const recentMessages = (session.messages || []).slice(-10);
```

User messages are delimited with `[USER MESSAGE]` tags to prevent prompt injection:

```
[USER MESSAGE]
Add a tea ceremony to day 2
[/USER MESSAGE]
```

#### Session Summarization (Conversation Compressing)

When a user resumes a past session via `POST /api/bienbot/sessions/:id/resume`, the **session summarizer** (`utilities/bienbot-session-summarizer.js`) compresses the full message history into a concise recap:

1. **Message truncation** — History is formatted as `role: content` lines and truncated from oldest to newest to fit within a **2000-token budget** (~8000 chars). The most recent messages are always preserved.

2. **Context enrichment** — Session metadata (title, invoke context, active entity IDs) is prepended to give the summarizer model awareness of the entities involved.

3. **LLM summarization** — A fast, cheap model generates:
   - `summary`: 1-3 sentence prose recap (under 100 words)
   - `next_steps`: 2-3 specific, actionable follow-ups

4. **Fallback** — If the LLM call fails, a static fallback is generated from the session title and invoke context label. This ensures resume never breaks.

#### Token Budget Management

Context builders and the summarizer each have independent token budgets to prevent cost explosions:

| Component | Budget | Purpose |
|---|---|---|
| Context builder (per entity) | 1500 tokens (~6000 chars) | Entity data for LLM prompt |
| Session summarizer (history) | 2000 tokens (~8000 chars) | Compressed message history for resume |
| Main LLM call (max_tokens) | 1500 tokens | Response generation |
| Intent classifier | N/A (local NLP.js) | No LLM tokens — runs locally |
| Summarizer LLM (max_tokens) | 300 tokens | Summary generation |

Token counting uses a rough estimate of **~4 chars per token** for English text. Text exceeding the budget is truncated with `...`.

#### Summary Caching and Staleness

Summaries are cached in `session.summary` to avoid redundant LLM calls:

| Condition | Behaviour |
|---|---|
| `session.summary` absent or `generated_at` is null | Always regenerate |
| `generated_at` < 6 hours ago | Use cached summary |
| `generated_at` >= 6 hours ago | Regenerate (plan state may have changed externally) |
| Session has < 3 messages | Skip summarizer entirely; return static "Welcome back!" greeting |

The TTL is defined as `SUMMARY_CACHE_TTL_MS = 6 * 60 * 60 * 1000` (6 hours).

---

### Messages Integration

The Messages tab (`MessagesModal`) uses Stream Chat for user-to-user and group messaging (DMs, plan channels, plan-item channels).

#### Chat Drawer

BienBot is accessed via the floating BienBotTrigger button on entity pages. It opens a slide-out panel with entity-aware context and uses SSE for streaming responses. See [Chat Drawer](#chat-drawer) for full details.

---

### Chat Drawer

#### BienBotTrigger (FAB)

**File:** `src/components/BienBotTrigger/BienBotTrigger.jsx`

A fixed-position floating action button (bottom-right) rendered on entity pages. Visibility conditions:

- User is authenticated (`useUser()`)
- `ai_features` feature flag is enabled (`useFeatureFlag('ai_features')`)
- Required props are present: `entity`, `entityId`, `entityLabel`

If any condition fails, the FAB returns `null` (not rendered).

#### BienBotPanel (Drawer/Sheet)

**File:** `src/components/BienBotPanel/BienBotPanel.jsx`

| Viewport | Behaviour |
|---|---|
| Desktop | Slides in from the right as a side drawer |
| Mobile | Slides up from the bottom as a full-screen sheet |

The panel is **lazy-loaded** — the BienBotPanel module is dynamically imported only when the FAB is clicked.

#### Panel UI Elements

| Element | Description |
|---|---|
| **Header** | BienBot icon, title, entity label breadcrumb, "New chat" button, close button |
| **Message thread** | Scrollable area with user/assistant messages, auto-scrolls to bottom |
| **Loading dots** | Three animated dots shown between user message and first assistant token |
| **Pending action cards** | Cards with action type, description, "Yes" and "Cancel" buttons |
| **Suggested next-step chips** | Tappable buttons from session resume that pre-fill the input |
| **Input area** | Auto-growing textarea with send button; Enter sends, Shift+Enter adds newline |

**Keyboard shortcuts:**
- `Enter` — Send message
- `Shift+Enter` — New line
- `Escape` — Close panel

#### Lazy Loading

`BienBotPanelLazy` is a wrapper inside `BienBotTrigger` that dynamically imports `BienBotPanel`:

```javascript
import('../BienBotPanel/BienBotPanel')
  .then(mod => setPanel(() => mod.default))
  .catch(err => setLoadError(true));
```

This ensures:
- The heavy `useBienBot` hook and SSE streaming code are not loaded until needed
- Failed imports are handled gracefully (trigger still renders, panel just doesn't open)

---

### Notifications

BienBot has a dual-mode architecture: it can serve as a **notification delivery channel** for all users, and as a **full AI assistant** for users with the `ai_features` feature flag.

#### Notification-Only Mode (Without AI Feature Flag)

For users without the `ai_features` flag, BienBot acts as a notification channel:

- System notifications (plan access requests, collaborator invites, plan updates) can be delivered through BienBot
- The notification preference gate (`utilities/notifications.js`) checks `user.preferences.notifications.channels` for `'bienbot'`
- Users receive read-only notification messages — no interactive AI capabilities
- The BienBotTrigger FAB is **not rendered** (requires `ai_features` flag)
- Notifications appear in the Messages tab as BienBot messages

#### AI-Enabled Mode (With `ai_features` Flag)

When the `ai_features` flag is enabled, BienBot provides the full AI assistant experience:

- Interactive multi-turn conversations
- Intent classification and context-aware responses
- Proposed actions with confirmation UI
- Session management (create, resume, archive)
- All notification capabilities plus AI-powered planning

#### Notification Preference Gate

Outbound notifications to BienBot use the standard `sendIfAllowed()` gate:

```javascript
const { sendIfAllowed } = require('../utilities/notifications');

await sendIfAllowed({
  user: recipientUser,
  channel: 'bienbot',
  type: 'activity',
  logContext: { feature: 'plan_update', planId },
  send: async () => {
    // Create a BienBot notification message
    await BienBotSession.createNotification(userId, {
      content: 'Your plan "Cherry Blossom Day Trip" was updated by Jane.',
      entityType: 'plan',
      entityId: planId
    });
  }
});
```

The notification is suppressed if:
- `user.preferences.notifications.enabled` is `false`
- `'bienbot'` is not in `user.preferences.notifications.channels`
- `'activity'` (or the relevant type) is not in `user.preferences.notifications.types`

---

### Files

#### Backend

| File | Purpose |
|---|---|
| `models/bienbot-session.js` | Persists conversation history, active context (destination/experience/plan IDs), and pending actions needing confirmation |
| `utilities/bienbot-context-builders.js` | One builder per entity type — queries DB and returns a formatted text block for the LLM prompt. Respects existing permission enforcement. |
| `utilities/bienbot-intent-classifier.js` | NLP.js-based local intent classifier — trains a neural network on startup from the corpus, classifies user messages and extracts entity references (destination name, experience name, user email, etc.) without an LLM API call |
| `utilities/bienbot-intent-corpus.json` | Training corpus with example utterances for each intent — add new utterances here to improve classification |
| `utilities/bienbot-action-executor.js` | Takes the structured `actions[]` array from the LLM and calls the existing controller logic (destinations, experiences, plans, invites). Returns results that update the session context. |
| `utilities/bienbot-session-summarizer.js` | Compresses session message history into a summary + suggested next steps for session resume. Never throws — always returns a usable object. |
| `controllers/api/bienbot.js` | Express controller — orchestrates the above layers, handles streaming via SSE, validates inputs |
| `routes/api/bienbot.js` | Route definitions, applies `ensureLoggedIn`, `requireFeatureFlag('ai_features')`, and a dedicated rate limiter |

#### Frontend

| File | Purpose |
|---|---|
| `src/utilities/bienbot-api.js` | `postMessage`, `getSessions`, `executeActions`, `deleteSession` — emits events via `broadcastEvent` on mutations |
| `src/hooks/useBienBot.js` | Manages conversation state, streaming, pending actions, and session lifecycle |
| `src/components/BienBotTrigger/BienBotTrigger.jsx` | Floating trigger button rendered on every entity view, passes `invokeContext` to `useBienBot` |
| `src/components/BienBotPanel/BienBotPanel.jsx` | Sliding/modal panel rendering the chat UI — mounts on top of any view, receives the hook's state |

---

### Session Model

**File:** `models/bienbot-session.js`

```javascript
{
  user: ObjectId,            // owner
  title: String,             // auto-generated from first message
  invoke_context: {          // the surface from which the session was started
    entity: String,          // 'destination' | 'experience' | 'plan' | 'plan_item' | 'user' | null
    entity_id: ObjectId,     // ID of the entity at open time
    entity_label: String     // human-readable label for display (e.g. "Cherry Blossom Day Trip")
  },
  messages: [{
    role: 'user' | 'assistant',
    content: String,
    timestamp: Date,
    intent: String,          // classifier output, stored for debugging
    actions_taken: [String]  // IDs of actions executed in this turn
  }],
  context: {
    destination_id: ObjectId,
    experience_id: ObjectId,
    plan_id: ObjectId,
    plan_item_id: ObjectId   // set when invoked from a plan item modal
  },
  summary: {                    // cached resume summary — regenerated when stale
    text: String,              // prose summary of the conversation so far
    suggested_next_steps: [String], // 2-3 realistic follow-up prompts
    generated_at: Date         // used to decide whether to regenerate on next resume
  },
  pending_actions: [{
    id: String,              // uuid
    type: String,            // Any of the 25 action types (see Action Executor section)
    payload: Object,         // structured params ready to execute
    description: String,     // human-readable summary shown to user for confirmation
    executed: Boolean,
    result: Object
  }],
  status: 'active' | 'archived',
  createdAt: Date,
  updatedAt: Date
}
```

---

### Intent Classifier

**File:** `utilities/bienbot-intent-classifier.js`
**Corpus:** `utilities/bienbot-intent-corpus.json`
**Engine:** [NLP.js](https://github.com/axa-group/nlp.js) via `node-nlp-rn`

Uses a locally-trained NLP.js neural network for fast, zero-latency intent classification — no LLM API call required. The model is trained once on startup from the corpus file and cached as a singleton. Classification typically completes in under 1ms.

**Entity extraction** uses a combination of:
- NLP.js built-in NER (regex entity for email detection)
- Heuristic regex patterns for destination/experience names
- Comma/and-separated list parsing for plan item texts

Returns:

```json
{
  "intent": "PLAN_EXPERIENCE",
  "entities": {
    "destination_name": "Kyoto",
    "experience_name": null,
    "user_email": null,
    "plan_item_texts": []
  },
  "confidence": 0.95
}
```

#### Intent Types

**Core Intents (Original)**

| Intent | Trigger |
|---|---|
| `QUERY_DESTINATION` | "Tell me about Tokyo", "What's popular in Paris?" |
| `PLAN_EXPERIENCE` | "Plan a 3-day trip to Kyoto", "I want to plan [experience]" |
| `CREATE_EXPERIENCE` | "Create a new experience for Barcelona" |
| `ADD_PLAN_ITEMS` | "Add visit Sagrada Familia to my plan", "I need to book a hotel" |
| `INVITE_COLLABORATOR` | "Invite alice@example.com to collaborate" |
| `SYNC_PLAN` | "Sync my plan with the latest changes" |
| `ANSWER_QUESTION` | Everything else — general Q&A, suggestions |
| `UPDATE_PLAN_ITEM` | "Mark the temple visit as done", "Change cost to $50" |
| `ADD_PLAN_ITEM_NOTE` | "Add a note about the reservation" |
| `ADD_PLAN_ITEM_DETAIL` | "Add parking details" |
| `ASSIGN_PLAN_ITEM` | "Assign the hotel booking to Jane" |
| `UNASSIGN_PLAN_ITEM` | "Unassign me from the airport transfer" |
| `CREATE_DESTINATION` | "Create a new destination for Bali" |
| `SCHEDULE_PLAN_ITEM` | "Schedule the museum visit for March 15" |

**Experience-Level Intents**

| Intent | Trigger |
|---|---|
| `UPDATE_EXPERIENCE` | "Rename the experience", "Change visibility to public", "Set the overview" |
| `ADD_EXPERIENCE_PLAN_ITEM` | "Add an item to the experience template", "Add snorkeling to the experience" |
| `UPDATE_EXPERIENCE_PLAN_ITEM` | "Edit the cost of the temple visit in the experience" |
| `DELETE_EXPERIENCE_PLAN_ITEM` | "Remove the spa item from the experience" |

**Destination-Level Intents**

| Intent | Trigger |
|---|---|
| `UPDATE_DESTINATION` | "Change the destination name", "Update the overview" |
| `ADD_DESTINATION_TIP` | "Add a tip about street food", "Save a safety tip" |
| `FAVORITE_DESTINATION` | "Favorite this destination", "Unfavorite Kyoto" |

**Plan-Level Intents**

| Intent | Trigger |
|---|---|
| `UPDATE_PLAN` | "Change the planned date", "Set currency to EUR", "Update notes" |
| `DELETE_PLAN` | "Delete my plan", "Remove the plan", "Cancel this trip" |
| `DELETE_PLAN_ITEM` | "Remove the hotel item from my plan" |
| `ADD_PLAN_COST` | "Add a $200 hotel cost", "Track the flight expense" |

**Collaboration & Location Intents**

| Intent | Trigger |
|---|---|
| `REMOVE_COLLABORATOR` | "Remove Jane from the plan", "Revoke access" |
| `SET_MEMBER_LOCATION` | "Set my departure from New York", "I'm traveling from London" |

#### Training Corpus

The corpus file (`bienbot-intent-corpus.json`) contains example utterances for each intent. To improve classification:

1. Add new utterances to the relevant intent's `utterances` array in the corpus
2. Restart the server (model retrains on startup)
3. Run the unit tests to verify classification accuracy

The NLP.js neural network generalises from training examples, so exact-match utterances are not required — the model learns word patterns and can classify novel phrasings.

#### Entity Extraction Strategy

| Entity | Method | Notes |
|---|---|---|
| `user_email` | NLP.js regex entity + fallback regex | Matches standard email patterns |
| `destination_name` | Heuristic regex patterns | Extracts capitalised nouns after prepositions (about, in, to, for) |
| `experience_name` | NLP.js slot filling + quoted string fallback | Looks for quoted strings in the message |
| `plan_item_texts` | Comma/and-separated list parsing | Only extracted when intent is ADD_PLAN_ITEMS |
| `tip_content` | Content after "tip:"/"tip about" extraction | Only for ADD_DESTINATION_TIP intent |
| `cost_category` | Keyword + synonym mapping | Maps hotel→accommodation, flight→transport, dinner→food, tour→activities, gear→equipment |
| `cost_title` | Next word after cost/expense/charge | Extracts cost title from natural language |
| `visibility_value` | Keyword match (public/private) | For experience visibility setting |
| `experience_type` | Keyword match | Extracts type keywords (guided, self-guided, group, solo, etc.) |
| `currency_value` | Regex matching 20 currency codes | USD, EUR, GBP, JPY, CAD, AUD, CHF, CNY, INR, MXN, BRL, KRW, SGD, HKD, SEK, NOK, DKK, NZD, ZAR, THB |
| `new_name` | Rename pattern extraction | Extracts target name from "rename to X" / "change name to X" patterns |

---

### Context Builders

**File:** `utilities/bienbot-context-builders.js`

One function per entity type, each querying the DB and returning concise structured text. The combined context block is injected between the system prompt and the user message.

```javascript
buildDestinationContext(destinationId, userId)     → string
buildExperienceContext(experienceId, userId)        → string
buildUserPlanContext(planId | experienceId, userId) → string
buildPlanItemContext(planId, itemId, userId)        → string  // invoked from plan item modal
buildUserProfileContext(userId)                     → string  // user's plans, favourites, recent activity
buildSearchContext(query, userId)                   → string  // fuzzy destination/experience search
```

**`buildContextForInvokeContext(invokeContext, userId)`** — convenience wrapper called at session creation time. Dispatches to the correct builder(s) based on `invokeContext.entity` and returns a pre-built context string stored in the session for the first turn. For example, `entity: 'plan'` calls both `buildExperienceContext` and `buildUserPlanContext` so the bot immediately understands both the template and the user's copy.

Each builder:
- Respects the permissions enforcer (`canView`)
- Trims to a configurable token budget (default 1500 tokens per context block)
- Returns `null` if the user has no access (silently omitted from prompt)

---

### Session Resume & Greeting

When a user opens a past session from the session list, the frontend calls `POST /api/bienbot/sessions/:id/resume`. The controller:

1. **Summarizes the message history** — a fast (cheap model) LLM call compresses `session.messages` into a short prose recap. The summary references which entities were discussed and what actions were taken.  
2. **Generates suggested next steps** — 2–3 short, actionable prompts extracted from the session's current `context` and any incomplete `pending_actions`.  
3. **Produces an initial greeting message** — the main model (or the same fast model) writes a warm re-engagement message in `assistant` role using the summary and next steps, e.g. *"Welcome back! Last time we were planning your Cherry Blossom Day Trip — you'd added a tea ceremony and invited Jane to collaborate. You might want to: sync the latest plan items, set a planned date, or add accommodation to day 2."*
4. **Caches the summary** — the result is written to `session.summary` with a `generated_at` timestamp. On subsequent resumes within **6 hours** the cached summary is reused; beyond that it is regenerated to pick up any plan changes that happened in the meantime.
5. **Returns the greeting** — the greeting is appended to `session.messages` (role `assistant`) and returned in the response. The frontend hook inserts it as the first visible message when the panel opens.

#### Session Summarizer prompt structure

```
[SYSTEM]
You are summarizing a planning conversation to help the user pick up where they left off.
Return valid JSON: { "summary": string, "next_steps": string[] (2-3 items) }
Be concise. Focus on what was decided, what is still pending, and what the user may want to do next.

[CONVERSATION HISTORY]
{session.messages compressed to last N turns or 2000 tokens}

[CURRENT CONTEXT]
Destination: {name or 'none'}
Experience:  {name or 'none'}
Plan:        {name + completion status or 'none'}
Pending actions: {count and types or 'none'}
```

#### API endpoint

```
POST /api/bienbot/sessions/:id/resume
```

- Requires auth + `ai_features` flag.
- Returns `{ session, greeting: { role: 'assistant', content: '...', suggested_next_steps: [...] } }`.
- The `greeting` message is also persisted to `session.messages` so it appears in the thread on subsequent loads.
- If the session has **fewer than 3 messages** (very short past session), the summarizer is skipped and a simple *"Welcome back!"* greeting with the session title is returned instead.

#### Summary staleness

| Condition | Behaviour |
|---|---|
| `session.summary` absent | Always regenerate |
| `generated_at` < 6 hours ago | Use cached summary |
| `generated_at` ≥ 6 hours ago | Regenerate (plan state may have changed) |
| Session has < 3 messages | Skip summarizer; return static greeting |

---

### Main LLM Call — Prompt Structure

The system prompt is built dynamically by `buildSystemPrompt()` and includes:

1. **Role and rules** — BienBot's identity, conciseness, and data integrity rules
2. **User scoping rules** — All actions are scoped to the authenticated user only; never accepts external user IDs for self-actions
3. **Clarifying question instructions** — BienBot must ask for missing required fields before proposing actions, confirm destructive operations, and disambiguate when context lacks entity IDs
4. **Viewing context** — The `invokeContext.entity_label` provides a natural-language hint about the user's current page
5. **Entity context block** — Injected by context builders with destination, experience, plan, and plan item data
6. **Response schema** — Strict JSON with `message` and `pending_actions` array
7. **All 25 action types** with payload schemas grouped by entity (Destination, Experience, Plan, Plan Items, Plan Costs, Collaboration, Member Location)

```
[SYSTEM]
You are BienBot, a helpful travel planning assistant for the Biensperience platform.
You help users explore destinations, plan experiences, manage plan items, track costs,
collaborate with others, and answer travel questions.

IMPORTANT RULES:
- Be concise and helpful.
- When the user asks you to perform an action, propose it as a pending action.
- Never fabricate data.
- ALL actions are scoped to the logged-in user ONLY.

CLARIFYING QUESTIONS:
- Before proposing a destructive action (delete_plan, delete_plan_item, etc.), ALWAYS confirm.
- If required fields are missing, ask a clarifying question BEFORE proposing the action.
- For ambiguous requests, ask which entity the user means.
- Never guess or fabricate IDs.

Viewing: {invokeContext.entity_label}   ← omitted when no invokeContext

Available action types:
  create_destination, create_experience, create_plan,
  update_experience, update_destination, update_plan,
  add_plan_items, update_plan_item, delete_plan_item, delete_plan,
  add_experience_plan_item, update_experience_plan_item, delete_experience_plan_item,
  add_plan_item_note, add_plan_item_detail, assign_plan_item, unassign_plan_item,
  add_plan_cost, update_plan_cost, delete_plan_cost,
  invite_collaborator, remove_collaborator, sync_plan,
  toggle_favorite_destination, set_member_location, remove_member_location

[Action payload schemas for all 25 types — grouped by entity]

[CONTEXT BLOCK — injected by context builders]
## Destination: Kyoto, Japan
Experiences: "3 Days in Kyoto" (5 plan items), "Cherry Blossom Day Trip" (8 plan items) ...
User's plan for "3 Days in Kyoto": 2/5 items completed, planned_date: 2026-04-01 ...

[CONVERSATION HISTORY — last N turns from session.messages]
user: I want to plan a trip to Kyoto
assistant: { "message": "...", "pending_actions": [...] }

[USER MESSAGE]
Add a tea ceremony to day 2
```

The `Viewing:` line gives the model a natural-language hint about the user's current page without exposing raw database IDs. Raw IDs remain server-side only and are never placed in the prompt.

#### Clarifying Question Behaviour

The system prompt instructs BienBot to ask clarifying questions rather than guessing when:
- **Required fields are missing** — e.g. no cost amount for `add_plan_cost`, no date for `update_plan`, no text for add-item actions
- **Destructive actions** — `delete_plan`, `delete_plan_item`, `delete_experience_plan_item`, `delete_plan_cost`, `remove_collaborator` always require explicit user confirmation before the action is proposed
- **Ambiguous references** — when context provides multiple matching entities (e.g. "delete the item" when the plan has 10 items), BienBot asks which one
- **Missing entity IDs** — when an ID cannot be determined from session context, BienBot asks rather than fabricating

When asking a clarifying question, BienBot returns `pending_actions: []` (empty) and uses the `message` field for the question.

---

### Action Executor

**File:** `utilities/bienbot-action-executor.js`

Maps `action.type` → existing service logic. **Does not call models directly** — reuses the same logic as the existing controllers to ensure permission checks, activity tracking, event emission, and WebSocket broadcasts all fire correctly.

**Core Actions**

| `action.type` | Calls |
|---|---|
| `create_destination` | `destinations` controller `create` logic |
| `create_experience` | `experiences` controller `create` logic |
| `create_plan` | `plans` controller `createPlan` logic |
| `add_plan_items` | `plans` controller `addPlanItem` logic (batch) |
| `update_plan_item` | `plans` controller `updatePlanItem` logic |
| `invite_collaborator` | `plans` or `experiences` controller collaborator invite logic |
| `sync_plan` | `plans` controller `syncPlan` logic |
| `add_plan_item_note` | `plans` controller `addPlanItemNote` logic |
| `add_plan_item_detail` | `plans` controller `addPlanItemDetail` logic |
| `assign_plan_item` | `plans` controller `assignPlanItem` logic |
| `unassign_plan_item` | `plans` controller `unassignPlanItem` logic |

**Experience-Level Actions**

| `action.type` | Calls |
|---|---|
| `update_experience` | `experiences` controller `update` — name, overview, visibility, type, destination, map_location |
| `add_experience_plan_item` | `experiences` controller `createPlanItem` — text, url, cost_estimate, planning_days, parent, activity_type, location |
| `update_experience_plan_item` | `experiences` controller `updatePlanItem` — partial updates to experience template items |
| `delete_experience_plan_item` | `experiences` controller `deletePlanItem` — removes item from experience template |

**Destination-Level Actions**

| `action.type` | Calls |
|---|---|
| `update_destination` | `destinations` controller `update` — name, country, state, overview, location, map_location, travel_tips |
| `toggle_favorite_destination` | `destinations` controller `toggleUserFavoriteDestination` — **always uses logged-in user's ID** |

**Plan-Level Actions**

| `action.type` | Calls |
|---|---|
| `update_plan` | `plans` controller `updatePlan` — planned_date, currency, notes |
| `delete_plan` | `plans` controller `deletePlan` — **requires user confirmation** |
| `delete_plan_item` | `plans` controller `deletePlanItem` — **requires user confirmation** |

**Cost Tracking Actions**

| `action.type` | Calls |
|---|---|
| `add_plan_cost` | `plans` controller `addCost` — title, cost, currency, category, description, date, plan_item, collaborator |
| `update_plan_cost` | `plans` controller `updateCost` — partial updates to existing cost entries |
| `delete_plan_cost` | `plans` controller `deleteCost` — **requires user confirmation** |

**Collaboration & Location Actions**

| `action.type` | Calls |
|---|---|
| `remove_collaborator` | `plans` controller `removeCollaborator` or `experiences` controller `removeExperiencePermission` — determined by plan_id vs experience_id |
| `set_member_location` | `plans` controller `setMemberLocation` — location, travel_cost_estimate, currency |
| `remove_member_location` | `plans` controller `removeMemberLocation` — **always uses logged-in user; no external user_id accepted** |

The executor returns `{ success, result, errors[] }` per action. Results are merged back into `session.context` (e.g. a newly created `experience_id` is stored for subsequent turns).

#### User Scoping

All action handlers enforce strict user scoping:
- The `user` parameter passed to every handler is the authenticated JWT user from the BienBot controller — never from the conversation payload.
- `toggle_favorite_destination` hardcodes `user._id` in the mock request params, ignoring any user_id in the payload.
- `remove_member_location` sets `req.query = {}`, ensuring only the logged-in user's location is removed.
- Underlying controller functions enforce permission checks (via `PermissionEnforcer`) using the mock request's `req.user`, which is always the authenticated user.

---

### API Endpoints

**File:** `routes/api/bienbot.js`

All routes require `ensureLoggedIn` + `requireFeatureFlag('ai_features')` + a BienBot-specific rate limiter (30 req/15 min — stricter than general AI to account for chained DB queries per turn).

```
POST   /api/bienbot/chat                              # Main chat turn (SSE or JSON)
GET    /api/bienbot/sessions                          # List user's sessions (paginated)
GET    /api/bienbot/sessions/:id                      # Get session + message history
DELETE /api/bienbot/sessions/:id                      # Delete/archive session
POST   /api/bienbot/sessions/:id/resume               # Summarize history + return greeting
POST   /api/bienbot/sessions/:id/execute              # Confirm and execute pending actions
DELETE /api/bienbot/sessions/:id/pending/:actionId    # Cancel a pending action
```

#### `POST /api/bienbot/chat` request body

```json
{
  "message": "Add a tea ceremony to day 1",
  "sessionId": "optional — omit to auto-create a new session",
  "invokeContext": {
    "entity": "plan",
    "id": "64f...abc",
    "label": "Cherry Blossom Day Trip"
  }
}
```

- `invokeContext` is **only acted on at session creation**. On an existing session it is stored for reference but does not overwrite `session.context`.
- `invokeContext.id` is validated server-side with `validateObjectId` and the entity is permission-checked before context building begins. Spoofed IDs that fail the permission check are silently ignored and logged.

---

### Feature Flag

BienBot reuses the existing `ai_features` flag. No new flag is introduced at this stage. A dedicated `bienbot` flag can be added later via the standard feature flag process if access needs to be scoped separately from other AI features.

---

### Security Considerations

1. **Prompt injection** — User messages are placed in a clearly-delimited `[USER MESSAGE]` section; the system prompt instructs the model to treat that section as data, not instructions.
2. **Action allowlist** — The executor validates `action.type` against a strict allowlist; unknown action types are silently dropped and logged.
3. **Permission enforcement** — Every database write in the executor runs through the existing `PermissionEnforcer`, exactly as the regular controllers do.
4. **Token budget** — Context blocks are capped individually and the total prompt size is validated before the LLM call to prevent cost explosions.
5. **Confirmation gate** — All write actions are proposed (`pending_actions`) and require a second `POST /execute` request from the user. This prevents a single hijacked message from creating or modifying data.
6. **No raw ObjectId exposure** — Session `context` IDs are validated with `validateObjectId` before any query.
7. **Input sanitization** — User messages are length-capped (8000 chars) and stripped of null bytes before being stored or forwarded to the LLM.
8. **invokeContext ID validation** — `invokeContext.id` is validated with `validateObjectId` and run through `PermissionEnforcer.canView()` before any context builder is called. An invalid or inaccessible ID results in `invoke_context` being stored with `entity_id: null` and a warning logged — the session continues without pre-seeded context.
9. **Label injection safety** — only `invokeContext.entity_label` (a human-readable string) is placed in the prompt, never raw IDs. Labels are server-resolved from the DB — the client-supplied label is never used verbatim.

---

### Frontend Hook

**File:** `src/hooks/useBienBot.js`

```javascript
const {
  sessions, currentSession,
  messages, pendingActions,
  isLoading, isStreaming,
  sendMessage,        // POST /api/bienbot/chat (accepts optional invokeContext)
  executeActions,     // POST /api/bienbot/sessions/:id/execute
  cancelAction,       // DELETE .../pending/:actionId
  loadSession,        // GET /api/bienbot/sessions/:id (fetches history; does not greet)
  resumeSession,      // POST /api/bienbot/sessions/:id/resume — call when user opens a past session;
                      //   returns { session, greeting } and prepends greeting to messages state
  clearSession        // DELETE /api/bienbot/sessions/:id
} = useBienBot({ sessionId, invokeContext });
```

- `invokeContext` is passed from the component that mounts the hook (e.g. `SingleExperience` passes `{ entity: 'experience', id: experienceId, label: experience.name }`).
- On the first `sendMessage` call, if `sessionId` is null a new session is created and the `invokeContext` is forwarded to the backend.
- The hook exposes `invokeContext` downstream so `BienBotPanel` can render a breadcrumb like *"Chatting about: Cherry Blossom Day Trip"*.
- When `resumeSession(id)` returns a `greeting`, the hook inserts it as the first message in the `messages` array. `BienBotPanel` renders it with a subtle *"Picking up where you left off"* timestamp label. `suggested_next_steps` from the greeting are rendered as tappable chip buttons directly above the input box so the user can resume in one tap.

Streaming uses `fetch` with `ReadableStream` parsing (SSE). After mutations, emits relevant entity events (`experience:created`, `plan:created`, etc.) through the existing `broadcastEvent` so all other UI components update automatically.

---

### BienBot Trigger Component

**File:** `src/components/BienBotTrigger/BienBotTrigger.jsx`

A small floating action button rendered in the bottom-right corner of every entity page. It opens `BienBotPanel` as a sliding side-drawer or modal.

```jsx
// Usage in any entity view
<BienBotTrigger invokeContext={{ entity: 'experience', id: experience._id, label: experience.name }} />
```

**Props:**

| Prop | Type | Description |
|---|---|---|
| `invokeContext` | `{ entity, id, label }` | Entity context to seed the session |
| `sessionId` | `string` (optional) | Resume an existing session |

**BienBotPanel** receives the same `invokeContext` + the full hook state and renders:
- A scrollable message thread
- Pending action cards with *Confirm* / *Cancel* buttons
- A *"Chatting about: {label}"* breadcrumb when `invokeContext` is set
- An input box with send button

The trigger is conditionally rendered — only shown when the `ai_features` feature flag is active for the current user (checked client-side via `useFeatureFlag`; enforced again server-side on every request).

---

### End-to-End Example Flow

#### Scenario A — Standalone chat (Messages tab, no invokeContext)

#### Step 1 — Discover destination

> **User:** "Plan a 3-day cherry blossom trip to Kyoto"

- Classifier → `PLAN_EXPERIENCE`, `{ destination_name: "Kyoto" }`
- Context builder → fuzzy-searches Destination, finds "Kyoto, Japan"; summarises related public experiences
- LLM → `{ reply: "I found Kyoto, Japan and 2 related experiences. Should I create a new one or plan an existing one?", actions: [] }`

#### Step 2 — Select experience

> **User:** "Use the existing 'Cherry Blossom Day Trip' experience"

- Classifier → `PLAN_EXPERIENCE`, `{ experience_name: "Cherry Blossom Day Trip" }`
- Context builder → fetches the experience's plan items
- LLM → proposes `create_plan` action: *"Create plan for Cherry Blossom Day Trip starting April 1, 2026"*

#### Step 3 — User confirms

> **User:** "Yes, go ahead"

- `POST /api/bienbot/sessions/:id/execute` → creates the plan via existing plans controller
- `broadcastEvent('plan:created', ...)` fires — UI updates automatically
- Session context updated: `{ plan_id: "..." }`

#### Step 4 — Add plan items

> **User:** "Add a matcha tea ceremony to day 1"

- Classifier → `ADD_PLAN_ITEMS`
- Context builder → fetches the user's newly created plan
- LLM → proposes `add_plan_items` action with `{ text: "Matcha tea ceremony", planning_days: 1 }`

#### Step 5 — Invite collaborator

> **User:** "Also invite jane@example.com to collaborate"

- Classifier → `INVITE_COLLABORATOR`, `{ user_email: "jane@example.com" }`
- LLM → proposes `invite_collaborator` action
- Execute → calls existing plan collaborator invite logic, triggers email notification via existing `email-service.js`

---

#### Scenario B — In-context invocation from a Plan page

User is viewing their plan for *"Cherry Blossom Day Trip"* and clicks the BienBot trigger button.

`invokeContext = { entity: 'plan', id: '<planId>', label: 'Cherry Blossom Day Trip' }`

A new session is created and the controller immediately runs `buildContextForInvokeContext` → calls `buildExperienceContext` + `buildUserPlanContext`. The session already knows the experience and plan IDs before the user types anything.

> **User:** "Mark the temple visit as done and add a sake tasting on day 3"

- Because `session.context.plan_id` is already set, the classifier receives the hint *"Viewing: Cherry Blossom Day Trip (plan)"* and correctly emits `UPDATE_PLAN_ITEM` + `ADD_PLAN_ITEMS` as two actions in a single turn.
- No disambiguation round-trip needed — the bot already knows which plan and which item.
- User confirms → executor runs `updatePlanItem` (mark complete) + `addPlanItem` (sake tasting, day 3) in sequence.

---

#### Scenario C — In-context invocation from a Destination page

User is browsing *"Kyoto, Japan"* and clicks the BienBot trigger.

`invokeContext = { entity: 'destination', id: '<destId>', label: 'Kyoto, Japan' }`

> **User:** "What experiences can I plan here?"

- Context already has destination data; classifier → `QUERY_DESTINATION`
- Bot answers with a summary of available experiences, no round-trip search needed

> **User:** "Create a new one focused on street food"

- Classifier → `CREATE_EXPERIENCE`; `destination_id` already in `session.context`
- LLM proposes `create_experience` action with `destination: 'Kyoto, Japan'` pre-filled

---

#### Scenario D — Resuming a past session

User returns to the app two days later and taps a session titled *"Cherry Blossom Day Trip planning"* from the session list.

`useBienBot.resumeSession(sessionId)` → `POST /api/bienbot/sessions/:id/resume`

1. Controller fetches session (12 messages, context has `experience_id` + `plan_id`).
2. Session Summarizer call (fast model, < 1 s):
   - Summary: *"We were planning Cherry Blossom Day Trip in Kyoto. You created a plan for April 1 2026, added a matcha tea ceremony on day 1, and invited Jane to collaborate. The sake tasting on day 3 is still a pending action waiting for your confirmation."*
   - `next_steps`: ["Confirm the sake tasting on day 3", "Set the planned date", "Add accommodation"]
3. Main greeting generated (or same fast model):
   > *"Welcome back! Last time we were working on your Cherry Blossom Day Trip — you've added a tea ceremony and invited Jane, and I'm still waiting on your say-so for the sake tasting on day 3. Ready to continue?"*
4. Greeting appended to `session.messages` and returned to the frontend.
5. BienBotPanel opens with the greeting as the newest message and three chip buttons above the input:
   - **"Confirm sake tasting"** → sends `executeActions([pendingActionId])`
   - **"Set the planned date"** → pre-fills input with *"Set planned date to…"*
   - **"Add accommodation"** → pre-fills input with *"Add accommodation to my plan"*

Summary is cached; re-opening the panel within 6 hours skips the LLM call and reuses the cached greeting.

---

### Implementation Sequence

| # | File | Notes |
|---|---|---|
| 1 | `models/bienbot-session.js` | Session schema with messages, context, pending_actions |
| 2 | `utilities/bienbot-intent-classifier.js` | Local NLP.js classification, returns intent + entities JSON |
| 2a | `utilities/bienbot-intent-corpus.json` | Training data for intent classifier (utterances per intent) |
| 3 | `utilities/bienbot-session-summarizer.js` | Compresses history + context into summary + next steps; used by `/resume` endpoint |
| 4 | `utilities/bienbot-context-builders.js` | One builder per entity type, respects permissions |
| 5 | `utilities/bienbot-action-executor.js` | Strict allowlist, reuses existing controller functions |
| 6 | `controllers/api/bienbot.js` | Orchestrates layers, SSE streaming, input validation |
| 7 | `routes/api/bienbot.js` | Routes + auth + rate limiter; register in `app.js` |
| 8 | `src/utilities/bienbot-api.js` | Frontend API calls, `broadcastEvent` on mutations |
| 9 | `src/hooks/useBienBot.js` | Conversation state, streaming, pending action management; `resumeSession` triggers greeting |
| 10 | `.env.example` | Document `BIENBOT_*` env vars (rate limits, token budgets) |

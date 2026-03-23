# User-Similarity Recommender for Discovery Engine

**Task**: biensperience-e665.7
**Date**: 2026-03-23
**Status**: Approved

## Summary

Add collaborative filtering to `buildDiscoveryContext` so BienBot can answer cross-dimensional queries like "What experiences are popular among culinary travelers?" The engine finds users who planned matching activity types, then surfaces other experiences those users planned, ranked by a signal-adaptive composite score personalized to the querying user's hidden signals.

## Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Computation model | Hybrid (live aggregation + cache) | Acceptable latency for conversational feature; cache avoids redundant aggregation |
| Ranking weights | Signal-adaptive | Hidden signals confidence modulates weight distribution for deeper personalization |
| Structured result fields | 12 fields including photo URL | Photo URL via $lookup; feeds downstream rich card rendering (e665.8) |
| Cache provider | Redis primary, MongoDB fallback | Redis for autoscaling; MongoDB fallback if REDIS_URL not configured |
| Cache scope | Query parameters only (not per-user) | Cache the expensive aggregation; apply cheap per-user ranking on every request |
| Cache TTL | 30 minutes | Acceptable staleness for exploratory discovery |
| Cross-destination | Implicit + explicit | No destination filter = platform-wide; `cross_destination: true` forces it |

## Architecture

### Approach: Two-Query Separation

Stage 1 and Stage 2 are separate MongoDB queries with a JS ranking layer in between. This gives us:
- Natural cache insertion point between aggregation and ranking
- Each query is simple and independently testable
- Signal-adaptive ranking fits naturally in the JS layer
- Easy upgrade path to precomputed co-occurrence if needed later

### Data Flow

```
Request: { activity_types, destination_id?, max_cost?, cross_destination? }
    |
    v
Compute cache key (filters only, no user ID)
    |
    v
Cache hit? ----yes----> Raw candidates
    |                        |
    no                       |
    |                        |
    v                        |
Stage 1: findSimilarUsers    |
    |                        |
    v                        |
Stage 2: findCoOccurring     |
    |                        |
    v                        |
Store in cache               |
    |                        |
    v                        v
Fetch user hidden signals (with decay)
    |
    v
computeAdaptiveWeights(signals)
    |
    v
Score + rank candidates (top 8)
    |
    v
generateMatchReason per result
    |
    v
Return { message (text), results (structured), query_metadata }
```

## Expanded SEMANTIC_ACTIVITY_MAP

From 5 to 13 categories:

```javascript
const SEMANTIC_ACTIVITY_MAP = {
  // Existing
  culinary:          ['food', 'drinks', 'coffee', 'market', 'local'],
  adventure:         ['adventure', 'nature', 'sports', 'tour'],
  cultural:          ['museum', 'sightseeing', 'religious', 'local'],
  wellness:          ['wellness', 'health', 'rest'],
  nightlife:         ['nightlife', 'drinks', 'entertainment'],
  // New
  'family-friendly': ['sightseeing', 'nature', 'entertainment', 'class', 'tour'],
  budget:            ['food', 'local', 'nature', 'sightseeing'],
  romantic:          ['food', 'drinks', 'wellness', 'sightseeing', 'entertainment'],
  solo:              ['museum', 'nature', 'coffee', 'adventure', 'photography'],
  photography:       ['photography', 'sightseeing', 'nature', 'museum'],
  historical:        ['museum', 'sightseeing', 'religious', 'tour'],
  beach:             ['nature', 'sports', 'wellness', 'rest', 'adventure'],
  mountain:          ['nature', 'adventure', 'sports', 'tour', 'photography'],
  urban:             ['sightseeing', 'food', 'nightlife', 'shopping', 'entertainment']
};
```

Overlapping activity types across categories are intentional. The co-occurrence ranking differentiates results by what actual users planned together.

## Stage 1: Find Similar Users

```javascript
async function findSimilarUsers(filters, userId)
```

**Input**: Expanded activity types from `SEMANTIC_ACTIVITY_MAP`, optional destination filter, optional cost filter.

**Query**: Aggregation on Plans collection:
1. `$lookup` to Experience collection
2. `$match`: plan items with matching activity types, exclude querying user, optional destination filter (omitted if cross-destination), optional cost ceiling
3. `$group` by user: count matching plans, collect experience IDs
4. `$sort` by matching plan count descending

**Destination filter logic**:
```javascript
const shouldFilterDestination =
  !filters.cross_destination &&
  (filters.destination_id || filters.destination_name);
```

**Returns**: `[{ userId, matchingPlanCount, experienceIds }]`

## Stage 2: Find Co-Occurring Experiences

```javascript
async function findCoOccurringExperiences(similarUsers, filters, userId)
```

**Input**: User IDs + experience IDs from Stage 1.

**Query**: Aggregation on Plans collection:
1. `$match`: plans by similar users, excluding Stage 1 experience IDs
2. `$lookup` to Experience (name, activity_type, cost_estimate, destination, visibility)
3. `$match`: visibility = 'public'
4. `$group` by experience:
   - `co_occurrence_count`: number of similar users who planned this
   - `avg_completion_rate`: average of plan completion percentage across those plans
   - `total_collaborator_count`: count of unique collaborators across plans (from permissions array)
   - `latest_planned_date`: most recent planned_date (for recency scoring)
5. `$lookup` destination name
6. `$lookup` default photo (first photo from experience or its plan items)
7. `$limit`: top 20 raw candidates

**Returns**: Raw candidate array with all computed signals.

## Signal-Adaptive Ranking

### Default Weights

```javascript
const DEFAULT_WEIGHTS = {
  plan_count:      0.30,  // co-occurrence frequency
  completion_rate: 0.25,  // plan quality
  recency:         0.20,  // freshness
  collaborators:   0.10,  // social proof
  cost_alignment:  0.15   // budget fit
};
```

### Adaptive Weight Shifts

Each shift is a symmetric +0.10/-0.10 swap. Weights always sum to 1.0. Only fires when the relevant signal dimension exceeds 0.7 (the "strong" threshold from `signalsToNaturalLanguage`).

| Signal | Condition | Boost | Reduce | Rationale |
|--------|-----------|-------|--------|-----------|
| `budget_sensitivity` | > 0.7 | `cost_alignment` +0.10 | `plan_count` -0.10 | Budget-conscious users care more about cost fit than raw popularity |
| `social` | > 0.7 | `collaborators` +0.10 | `recency` -0.10 | Social travelers value group experiences over freshness |
| `structure` | > 0.7 | `completion_rate` +0.10 | `plan_count` -0.10 | Structured planners value thorough plans over popular ones |
| `novelty` | > 0.7 | `recency` +0.10 | `completion_rate` -0.10 | Novelty-seekers want fresh experiences over proven ones |

Multiple shifts can compound if multiple signals are strong.

### Cost Alignment Score

```javascript
function computeCostAlignment(experienceCost, signals) {
  if (!experienceCost || !signals) return 0.5; // neutral

  const userBudgetLevel = 1 - signals.budget_sensitivity;
  const costPercentile = normalizeCostToPercentile(experienceCost);
  return 1 - Math.abs(userBudgetLevel - costPercentile);
}
```

`normalizeCostToPercentile` maps the experience cost against the distribution within the current candidate set (relative, not global).

### Recency Score

Exponential decay from planned_date. Plans within 30 days score ~1.0, 90 days ~0.7, 180+ days ~0.3. Uses the same decay constant approach as hidden signal decay.

### Composite Score

```javascript
candidate.relevance_score =
  weights.plan_count      * normalize(candidate.co_occurrence_count) +
  weights.completion_rate  * candidate.avg_completion_rate +
  weights.recency          * candidate.recency_score +
  weights.collaborators    * normalize(candidate.collaborator_count) +
  weights.cost_alignment   * computeCostAlignment(candidate.cost_estimate, signals);
```

Top 8 by `relevance_score` descending.

## match_reason Generation

Deterministic function. Finds the dominant signal (highest weighted contribution) for each result and fills a template:

```javascript
const templates = {
  plan_count:      (c) => `Planned by ${c.co_occurrence_count} similar travelers`,
  completion_rate: (c) => `${Math.round(c.avg_completion_rate * 100)}% plan completion rate`,
  recency:         (c) => `Recently trending among travelers`,
  collaborators:   (c) => `Popular group activity - ${c.collaborator_count} collaborators`,
  cost_alignment:  (c) => `Good budget fit for your travel style`
};
```

Combined with a category phrase from the matched semantic categories:
`"Popular among culinary travelers - 78% plan completion rate"`

## Cache Layer

### Provider Abstraction

```javascript
// utilities/discovery-cache.js
class DiscoveryCache {
  async get(key) {}
  async set(key, candidates, ttlMs) {}
}

class RedisDiscoveryCache extends DiscoveryCache { ... }
class MongoDiscoveryCache extends DiscoveryCache { ... }
```

Provider selection: `process.env.REDIS_URL` present -> Redis, else MongoDB.

### Redis Provider

- Key format: `bien:discovery:{hash}`
- TTL: 30 minutes via `SETEX`
- Serialization: JSON
- Connection: lazy-initialized, reconnect on failure
- Failover: if Redis unreachable at runtime, log warning and fall through to MongoDB for that request (retry Redis on next request)

### MongoDB Fallback Provider

- Collection: `discovery_cache`
- TTL index on `expiresAt` field (auto-cleanup)
- Schema: `{ _id: cacheKey, candidates: Array, expiresAt: Date }`
- Operations: `findOne` for reads, `updateOne` with upsert for writes

### Cache Key

```javascript
function getCacheKey(filters) {
  const parts = [
    (filters.activity_types || []).sort().join(','),
    filters.destination_id || filters.destination_name || 'all',
    filters.max_cost || 'none'
  ];
  return `discovery:${parts.join('|')}`;
}
```

Cross-destination queries (no destination + `cross_destination: true`) both resolve to `'all'` in the key.

### Cache Scope

Caches raw candidates (pre-ranking). Per-user signal-adaptive ranking is always computed fresh. Two users with different hidden signals querying the same filters get different orderings from the same cached data.

## Structured Response Format

```javascript
{
  statusCode: 200,
  body: {
    message: String,              // text context block for LLM
    results: [{
      experience_id: String,
      experience_name: String,
      destination_name: String,
      destination_id: String,
      activity_types: [String],
      cost_estimate: Number,
      plan_count: Number,
      completion_rate: Number,
      collaborator_count: Number,
      relevance_score: Number,
      match_reason: String,
      default_photo_url: String
    }],
    query_metadata: {
      filters_applied: Object,
      cache_hit: Boolean,
      result_count: Number,
      cross_destination: Boolean
    }
  }
}
```

## Cross-Destination Discovery

**Implicit**: No `destination_id` or `destination_name` in filters -> destination filter omitted from both stages. The session's `invoke_context.entity_id` is not auto-injected for discovery.

**Explicit**: `cross_destination: true` in payload forces platform-wide results even if a destination filter is present.

**LLM prompt guidance**:
```
discover_content: Search for popular experiences.
  - Pass activity_types for category filtering
  - Pass destination_id or destination_name to scope to a destination
  - Omit destination fields OR pass cross_destination: true for platform-wide results
```

## Files Changed

| File | Changes |
|------|---------|
| `utilities/bienbot-context-builders.js` | Expand `SEMANTIC_ACTIVITY_MAP` (5 -> 13). Rewrite `buildDiscoveryContext` with two-stage pipeline + cache + ranking. Add helpers: `findSimilarUsers`, `findCoOccurringExperiences`, `rankWithSignals`, `computeAdaptiveWeights`, `computeCostAlignment`, `generateMatchReason`, `getCacheKey`. |
| `utilities/bienbot-action-executor.js` | Update `executeDiscoverContent` to return structured results + text context + `query_metadata`. |

## New Files

| File | Purpose |
|------|---------|
| `utilities/discovery-cache.js` | Cache provider abstraction. `RedisDiscoveryCache` (primary) and `MongoDiscoveryCache` (fallback). Provider selection based on `REDIS_URL` env var. Failover logic. |
| `models/discovery-cache.js` | Mongoose schema for MongoDB fallback cache collection with TTL index. |

## Testing

| Test | Type | Validates |
|------|------|-----------|
| `computeAdaptiveWeights` | Unit | Weights sum to 1.0; correct signals trigger correct shifts; low-confidence returns defaults |
| `computeCostAlignment` | Unit | 1.0 for perfect match, 0.0 for worst mismatch, 0.5 for neutral/missing |
| `generateMatchReason` | Unit | Readable strings; dominant signal selection correct |
| `getCacheKey` | Unit | Deterministic; cross-destination normalization; sort stability |
| `findSimilarUsers` | Integration | Correct users for activity filters; destination scoping; excludes querying user |
| `findCoOccurringExperiences` | Integration | Excludes Stage 1 experiences; computes signals correctly; public-only |
| `executeDiscoverContent` | Integration | End-to-end structured response shape; cache hit/miss paths; cross-destination mode |
| `DiscoveryCache` | Integration | Redis works; MongoDB fallback works; TTL eviction; Redis -> MongoDB failover |

Test files:
- `tests/utils/bienbot-discovery.test.js` (unit tests)
- `tests/api/bienbot-discovery.test.js` (integration tests)

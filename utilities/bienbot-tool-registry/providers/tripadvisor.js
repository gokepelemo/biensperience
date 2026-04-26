/**
 * TripAdvisor provider — fetch_destination_attractions.
 *
 * Native registry implementation using providerCtx.httpRequest. Two-step
 * search:
 *   1. Resolve destination name → TripAdvisor location_id via location/search.
 *   2. Fetch nearby attractions via location/nearby_search at the location's
 *      lat/lng.
 *
 * Provider is env-keyed (TRIPADVISOR_API_KEY) with envKeyOptional: true so it
 * is silently disabled in environments without the key (dev/CI), instead of
 * failing boot.
 *
 * Free (non-commercial) tier requires a Referer header matching the registered
 * domain. BASE_URL env var is used (defaults to https://biensperience.com).
 *
 * Response shapes:
 *   200: { destination_name, attractions: [...], returned }
 *   503: { ok: false, error: 'provider_unavailable' }   (no env key)
 *   502: { ok: false, error: 'upstream_unavailable' }   (HTTP failure)
 */

async function executeFetchDestinationAttractions(payload, _user, providerCtx) {
  if (!providerCtx.envKey) {
    return { statusCode: 503, body: { ok: false, error: 'provider_unavailable' } };
  }

  const referer = process.env.BASE_URL || 'https://biensperience.com';
  const headers = { accept: 'application/json', Referer: referer };

  // Step 1 — resolve destination to lat/lng via location search.
  const search = await providerCtx.httpRequest('/api/v1/location/search', {
    headers,
    query: {
      searchQuery: payload.destination_name,
      key: providerCtx.envKey,
      language: 'en'
    }
  });
  if (!search || search.status !== 200 || !search.body) {
    return { statusCode: 502, body: { ok: false, error: 'upstream_unavailable' } };
  }

  const location = search.body.data?.[0];
  if (!location?.latitude || !location?.longitude) {
    return {
      statusCode: 200,
      body: {
        destination_name: payload.destination_name,
        attractions: [],
        returned: 0
      }
    };
  }

  const latLong = `${location.latitude},${location.longitude}`;

  // Step 2 — nearby attractions search.
  const nearby = await providerCtx.httpRequest('/api/v1/location/nearby_search', {
    headers,
    query: {
      latLong,
      key: providerCtx.envKey,
      category: 'attractions',
      language: 'en'
    }
  });
  if (!nearby || nearby.status !== 200 || !nearby.body) {
    return { statusCode: 502, body: { ok: false, error: 'upstream_unavailable' } };
  }

  const limit = Math.min(payload.limit || 10, 20);
  const results = (nearby.body.data || []).slice(0, limit);

  const attractions = results.map((poi) => ({
    name: poi.name,
    rating: poi.rating ? parseFloat(poi.rating) : null,
    num_reviews: poi.num_reviews ? parseInt(poi.num_reviews, 10) : null,
    web_url: `https://www.tripadvisor.com/Tourism-d${poi.location_id}`
  }));

  return {
    statusCode: 200,
    body: {
      destination_name: payload.destination_name,
      attractions,
      returned: attractions.length
    }
  };
}

module.exports = {
  name: 'tripadvisor',
  displayName: 'TripAdvisor',
  baseUrl: 'https://api.content.tripadvisor.com',
  authType: 'env_key',
  envKey: 'TRIPADVISOR_API_KEY',
  envKeyOptional: true,
  budgetPerHour: 30,
  retryPolicy: { maxRetries: 2, baseDelayMs: 500, timeoutMs: 8000 },
  tools: [
    {
      name: 'fetch_destination_attractions',
      mutating: false,
      description: 'Top attractions at a destination via the TripAdvisor Content API.',
      idRefs: [],
      payloadSchema: {
        destination_name: { type: 'string', required: true },
        limit: { type: 'number', optional: true }
      },
      label: 'Fetching attractions…',
      promptHints: [
        '"top attractions in X" / "what to see in X" → fetch_destination_attractions with destination_name'
      ],
      handler: executeFetchDestinationAttractions
    }
  ]
};

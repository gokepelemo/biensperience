/**
 * Google Maps provider — fetch_destination_places.
 *
 * New user-visible read tool that returns top places at a destination
 * (attractions, restaurants, hotels, parks, museums, cafes) via the
 * Google Maps Places Text Search API. Distinct from `fetch_destination_tips`
 * (Wikivoyage aggregator); this surfaces ratings, addresses, and place_ids
 * so the LLM can recommend specific spots rather than generic advice.
 *
 * Provider is env-keyed (GOOGLE_MAPS_API_KEY) with envKeyOptional: true so
 * it is silently disabled in environments without the key (dev/CI), instead
 * of failing boot.
 */

async function executeFetchDestinationPlaces(payload, user, providerCtx) {
  if (!providerCtx.envKey) {
    return { statusCode: 503, body: { ok: false, error: 'provider_unavailable' } };
  }

  const query = `${payload.category || 'attractions'} in ${payload.destination_name}`;
  const search = await providerCtx.httpRequest('/maps/api/place/textsearch/json', {
    query: { query, key: providerCtx.envKey }
  });
  if (!search || search.status !== 200 || !search.body?.results) {
    return { statusCode: 502, body: { ok: false, error: 'upstream_unavailable' } };
  }

  const limit = Math.min(payload.limit || 10, 20);
  const places = search.body.results.slice(0, limit).map((p) => ({
    name: p.name,
    address: p.formatted_address,
    rating: p.rating ?? null,
    price_level: p.price_level ?? null,
    place_id: p.place_id
  }));

  return {
    statusCode: 200,
    body: {
      destination_name: payload.destination_name,
      places,
      returned: places.length
    }
  };
}

module.exports = {
  name: 'googleMaps',
  displayName: 'Google Maps',
  baseUrl: 'https://maps.googleapis.com',
  authType: 'env_key',
  envKey: 'GOOGLE_MAPS_API_KEY',
  envKeyOptional: true,
  budgetPerHour: 100,
  retryPolicy: { maxRetries: 2, baseDelayMs: 500, timeoutMs: 10000 },
  tools: [
    {
      name: 'fetch_destination_places',
      mutating: false,
      description: 'Top places at a destination via Google Maps Places API.',
      idRefs: [],
      payloadSchema: {
        destination_name: { type: 'string', required: true },
        category: {
          type: 'string',
          optional: true,
          allowed: ['attractions', 'restaurants', 'hotels', 'parks', 'museums', 'cafes']
        },
        limit: { type: 'number', optional: true }
      },
      label: 'Fetching places…',
      promptHints: [
        '"top restaurants in X" / "best attractions in X" → fetch_destination_places with category and destination_name'
      ],
      handler: executeFetchDestinationPlaces
    }
  ]
};

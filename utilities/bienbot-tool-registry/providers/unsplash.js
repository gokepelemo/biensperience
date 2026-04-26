/**
 * Unsplash provider — fetch_destination_photos.
 *
 * Native registry implementation using providerCtx.httpRequest. Calls the
 * Unsplash search/photos endpoint with the destination name and returns a
 * normalized list of photo objects with attribution.
 *
 * Provider is env-keyed (UNSPLASH_ACCESS_KEY) with envKeyOptional: true so it
 * is silently disabled in environments without the key (dev/CI), instead of
 * failing boot.
 *
 * Distinct from `fetch_entity_photos` (the existing user-visible action that
 * returns photo gallery cards for any entity). `fetch_destination_photos` is
 * the LLM-only photo search keyed off destination_name.
 *
 * Response shapes:
 *   200: { destination_name, photos: [...], returned }
 *   503: { ok: false, error: 'provider_unavailable' }   (no env key)
 *   502: { ok: false, error: 'upstream_unavailable' }   (HTTP failure)
 */

async function executeFetchDestinationPhotos(payload, _user, providerCtx) {
  if (!providerCtx.envKey) {
    return { statusCode: 503, body: { ok: false, error: 'provider_unavailable' } };
  }

  const limit = Math.min(payload.count || 5, 20);

  const result = await providerCtx.httpRequest('/search/photos', {
    query: {
      query: payload.destination_name,
      per_page: limit,
      orientation: 'landscape'
    },
    headers: {
      Authorization: `Client-ID ${providerCtx.envKey}`,
      'Accept-Version': 'v1'
    }
  });

  if (!result || result.status !== 200 || !result.body?.results) {
    return { statusCode: 502, body: { ok: false, error: 'upstream_unavailable' } };
  }

  const photos = result.body.results.slice(0, limit).map((p) => ({
    url: p.urls?.regular || p.urls?.small || null,
    thumb: p.urls?.thumb || p.urls?.small || null,
    alt: p.alt_description || p.description || '',
    photographer: p.user?.name || null,
    photographer_url: p.user?.links?.html || null,
    source_url: p.links?.html || null
  }));

  return {
    statusCode: 200,
    body: {
      destination_name: payload.destination_name,
      photos,
      returned: photos.length
    }
  };
}

module.exports = {
  name: 'unsplash',
  displayName: 'Unsplash',
  baseUrl: 'https://api.unsplash.com',
  authType: 'env_key',
  envKey: 'UNSPLASH_ACCESS_KEY',
  envKeyOptional: true,
  budgetPerHour: 50,
  retryPolicy: { maxRetries: 2, baseDelayMs: 500, timeoutMs: 8000 },
  tools: [
    {
      name: 'fetch_destination_photos',
      mutating: false,
      description: 'Stock photos of a destination via Unsplash search.',
      idRefs: [],
      payloadSchema: {
        destination_name: { type: 'string', required: true },
        count: { type: 'number', optional: true }
      },
      label: 'Fetching photos…',
      promptHints: [
        '"show me photos of X" / "what does X look like" → fetch_destination_photos with destination_name'
      ],
      handler: executeFetchDestinationPhotos
    }
  ]
};

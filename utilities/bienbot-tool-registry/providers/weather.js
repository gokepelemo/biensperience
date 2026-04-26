/**
 * Weather provider — fetch_forecast.
 *
 * Native registry implementation using providerCtx.httpRequest. Calls the
 * OpenWeather 5-day/3-hour forecast endpoint and aggregates the 3-hour entries
 * into per-day summaries (temp_min, temp_max, weather description).
 *
 * Provider is env-keyed (OPENWEATHER_API_KEY) with envKeyOptional: true so it
 * is silently disabled in environments without the key (dev/CI), instead of
 * failing boot.
 *
 * Response shapes:
 *   200: { location, units, forecast: [{ date, temp_min, temp_max, weather }] }
 *   503: { ok: false, error: 'provider_unavailable' }   (no env key)
 *   502: { ok: false, error: 'upstream_unavailable' }   (HTTP failure)
 */

async function executeFetchForecast(payload, user, providerCtx) {
  if (!providerCtx.envKey) return { statusCode: 503, body: { ok: false, error: 'provider_unavailable' } };

  const days = Math.min(payload.days || 5, 7);
  const result = await providerCtx.httpRequest('/data/2.5/forecast', {
    query: {
      q: payload.location,
      cnt: days * 8,
      units: payload.units || 'metric',
      appid: providerCtx.envKey
    }
  });
  if (!result || result.status !== 200 || !result.body?.list) {
    return { statusCode: 502, body: { ok: false, error: 'upstream_unavailable' } };
  }

  const byDay = new Map();
  for (const entry of result.body.list) {
    const day = entry.dt_txt?.slice(0, 10);
    if (!byDay.has(day)) {
      byDay.set(day, {
        date: day,
        temp_min: entry.main.temp_min,
        temp_max: entry.main.temp_max,
        weather: entry.weather?.[0]?.description || ''
      });
    } else {
      const prev = byDay.get(day);
      prev.temp_min = Math.min(prev.temp_min, entry.main.temp_min);
      prev.temp_max = Math.max(prev.temp_max, entry.main.temp_max);
    }
  }

  return {
    statusCode: 200,
    body: {
      location: payload.location,
      units: payload.units || 'metric',
      forecast: Array.from(byDay.values()).slice(0, days)
    }
  };
}

module.exports = {
  name: 'weather',
  displayName: 'OpenWeather',
  baseUrl: 'https://api.openweathermap.org',
  authType: 'env_key',
  envKey: 'OPENWEATHER_API_KEY',
  envKeyOptional: true,
  budgetPerHour: 60,
  retryPolicy: { maxRetries: 2, baseDelayMs: 500, timeoutMs: 8000 },
  tools: [
    {
      name: 'fetch_forecast',
      mutating: false,
      description: 'Daily weather forecast for a location (1-7 days).',
      idRefs: [],
      payloadSchema: {
        location: { type: 'string', required: true },
        days:     { type: 'number', optional: true },
        units:    { type: 'string', optional: true, allowed: ['metric', 'imperial'] }
      },
      label: 'Fetching forecast…',
      promptHints: [
        '"weather in X" / "what is the forecast for X" → fetch_forecast with the location string from the destination'
      ],
      handler: executeFetchForecast
    }
  ]
};

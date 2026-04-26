async function executeFetchPublicHolidays(payload, user, providerCtx) {
  const year = Number(payload.year) || new Date().getFullYear();
  const cc = String(payload.country_code).toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) {
    return { statusCode: 400, body: { ok: false, error: 'invalid_country_code' } };
  }
  const result = await providerCtx.httpRequest(`/api/v3/PublicHolidays/${year}/${cc}`);
  if (!result || result.status !== 200 || !Array.isArray(result.body)) {
    return { statusCode: 502, body: { ok: false, error: 'upstream_unavailable' } };
  }
  const holidays = result.body.map(h => ({
    date: h.date,
    name: h.localName,
    name_en: h.name,
    types: h.types || []
  }));
  return { statusCode: 200, body: { country_code: cc, year, holidays, returned: holidays.length } };
}

module.exports = {
  name: 'holidays',
  displayName: 'Public Holidays',
  baseUrl: 'https://date.nager.at',
  authType: 'none',
  envKey: null,
  envKeyOptional: false,
  budgetPerHour: 60,
  retryPolicy: { maxRetries: 2, baseDelayMs: 500, timeoutMs: 5000 },
  tools: [
    {
      name: 'fetch_public_holidays',
      mutating: false,
      description: 'Public holidays for a country in a given year.',
      idRefs: [],
      payloadSchema: {
        country_code: { type: 'string', required: true },
        year:         { type: 'number', optional: true }
      },
      label: 'Fetching holidays…',
      promptHints: [
        '"public holidays in X" / "is this a holiday" → fetch_public_holidays with the destination country code (ISO 3166-1 alpha-2)'
      ],
      handler: executeFetchPublicHolidays
    }
  ]
};

/**
 * Webhook provider — send_trip_alert.
 *
 * First WRITE tool in the registry. Posts a JSON payload describing a trip
 * alert to an operator-configured webhook URL (Slack/Discord/Mattermost/etc.).
 *
 * The webhook URL is the env key itself (not a secret used to sign requests),
 * so the provider treats `TRIP_ALERT_WEBHOOK_URL` as both the auth surface and
 * the destination URL. Setting `baseUrl: 'about:blank'` because we don't use
 * providerCtx.httpRequest for this provider — we POST directly to the env URL.
 *
 * Marked irreversible: once a webhook delivers a notification, there's no way
 * to recall it. PendingActionCard renders danger styling and the user must
 * confirm before /execute is called.
 *
 * Response shapes:
 *   200: { ok: true, sent: true, alert: {...} }
 *   404: { ok: false, error: 'plan_not_found' }
 *   499: { ok: false, error: 'aborted' }
 *   502: { ok: false, error: 'webhook_unreachable' }
 *   503: { ok: false, error: 'provider_unavailable' }   (no env key)
 */

const Plan = require('../../../models/plan');

async function executeSendTripAlert(payload, user, providerCtx) {
  if (!providerCtx.envKey) {
    return { statusCode: 503, body: { ok: false, error: 'provider_unavailable' } };
  }

  const plan = await Plan.findById(payload.plan_id)
    .populate({
      path: 'experience',
      select: 'name destination',
      populate: { path: 'destination', select: 'name' }
    })
    .lean();
  if (!plan) {
    return { statusCode: 404, body: { ok: false, error: 'plan_not_found' } };
  }

  const tripName = plan.experience?.name || 'Untitled Trip';
  const destName = plan.experience?.destination?.name || '';
  const url = providerCtx.envKey;

  const { maxRetries = 1, baseDelayMs = 500, timeoutMs = 8000 } = { maxRetries: 1, baseDelayMs: 500, timeoutMs: 8000 };
  const body = {
    type: payload.alert_type,
    trip_name: tripName,
    destination: destName,
    note: payload.note || '',
    sent_by: user.name || user.email || String(user._id),
    sent_at: new Date().toISOString()
  };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (providerCtx.abortSignal?.aborted) {
      return { statusCode: 499, body: { ok: false, error: 'aborted' } };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      clearTimeout(timer);
      if (res.ok) {
        providerCtx.logger.info('trip alert sent', {
          alert_type: payload.alert_type,
          plan_id: payload.plan_id
        });
        return { statusCode: 200, body: { ok: true, sent: true, alert: body } };
      }
      providerCtx.logger.warn(`webhook responded ${res.status}`);
    } catch (err) {
      clearTimeout(timer);
      providerCtx.logger.warn(`attempt ${attempt + 1} failed: ${err.message}`);
    }
    if (attempt < maxRetries) {
      await new Promise(r => setTimeout(r, baseDelayMs * Math.pow(2, attempt)));
    }
  }
  return { statusCode: 502, body: { ok: false, error: 'webhook_unreachable' } };
}

module.exports = {
  name: 'webhook',
  displayName: 'Webhook',
  baseUrl: 'about:blank',
  authType: 'env_key',
  envKey: 'TRIP_ALERT_WEBHOOK_URL',
  envKeyOptional: true,
  budgetPerHour: 30,
  retryPolicy: { maxRetries: 1, baseDelayMs: 500, timeoutMs: 8000 },
  tools: [
    {
      name: 'send_trip_alert',
      mutating: true,
      description: 'Post a JSON trip alert to the configured webhook URL.',
      irreversible: true,
      confirmDescription: 'Send a "{alert_type}" alert about your trip to the configured webhook',
      requireRecentAuth: false,
      idRefs: [{ field: 'plan_id', model: 'plan', required: true }],
      payloadSchema: {
        plan_id:    { type: 'string', required: true, format: 'objectId' },
        alert_type: { type: 'string', required: true,
                      allowed: ['departure_reminder', 'itinerary_update', 'general'] },
        note:       { type: 'string', optional: true }
      },
      label: 'Send Trip Alert',
      promptHints: [
        '"send a trip alert" / "notify the team about this trip" → send_trip_alert with the active plan_id and an alert_type'
      ],
      handler: executeSendTripAlert
    }
  ]
};

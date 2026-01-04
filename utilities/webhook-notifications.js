const backendLogger = require('./backend-logger');
const crypto = require('crypto');
const http = require('http');
const https = require('https');

function safeUrlForLogs(rawUrl) {
  try {
    const u = new URL(rawUrl);
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    return 'invalid_url';
  }
}

function isPrivateIp(ip) {
  if (typeof ip !== 'string') return false;

  // IPv4
  const ipv4Match = ip.match(/^([0-9]{1,3}\.){3}[0-9]{1,3}$/);
  if (ipv4Match) {
    const parts = ip.split('.').map((p) => Number.parseInt(p, 10));
    if (parts.some((p) => !Number.isFinite(p) || p < 0 || p > 255)) return true;

    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }

  // IPv6 (basic block for loopback/link-local/unique-local)
  const normalized = ip.toLowerCase();
  if (normalized === '::1') return true;
  if (normalized.startsWith('fe80:')) return true; // link-local
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // unique local

  return false;
}

function isLikelyIpLiteral(hostname) {
  if (typeof hostname !== 'string') return false;
  const h = hostname.trim();
  if (!h) return false;
  if (h.includes(':')) return true; // likely IPv6 literal
  return /^([0-9]{1,3}\.){3}[0-9]{1,3}$/.test(h);
}

function getAllowedWebhookHosts() {
  const raw = process.env.NOTIFICATION_WEBHOOK_ALLOWED_HOSTS;
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowedHost(hostname) {
  const allowed = getAllowedWebhookHosts();
  if (allowed.length === 0) return true;
  const host = (hostname || '').toLowerCase();
  return allowed.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

function isValidWebhookUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);

    if (url.protocol !== 'https:') return { valid: false, reason: 'non_https' };

    const host = (url.hostname || '').toLowerCase();
    if (!host) return { valid: false, reason: 'missing_host' };

    if (host === 'localhost' || host.endsWith('.local')) {
      return { valid: false, reason: 'localhost_disallowed' };
    }

    if (isLikelyIpLiteral(host) && isPrivateIp(host)) {
      return { valid: false, reason: 'private_ip_disallowed' };
    }

    if (!isAllowedHost(host)) {
      return { valid: false, reason: 'host_not_allowed' };
    }

    return { valid: true, url: url.toString() };
  } catch {
    return { valid: false, reason: 'invalid_url' };
  }
}

function postJson(rawUrl, payload, { timeoutMs = 8000, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(rawUrl);
    const body = JSON.stringify(payload);

    const isHttps = url.protocol === 'https:';
    const transport = isHttps ? https : http;

    const req = transport.request(
      {
        method: 'POST',
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
          ...headers
        }
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const responseText = Buffer.concat(chunks).toString('utf8');
          resolve({ status: res.statusCode || 0, responseText });
        });
      }
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('Webhook request timeout'));
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function signPayload(payloadString, secret) {
  if (!secret || typeof secret !== 'string') return null;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payloadString, 'utf8');
  return `sha256=${hmac.digest('hex')}`;
}

async function sendWebhookNotification({
  urls,
  payload,
  timeoutMs,
  secret,
  logContext = {}
}) {
  const list = Array.from(new Set((Array.isArray(urls) ? urls : []).map((u) => u?.toString()).filter(Boolean)));
  if (list.length === 0) {
    return { sent: false, reason: 'no_endpoints', results: [] };
  }

  const validatedUrls = list
    .map((u) => ({ raw: u, validation: isValidWebhookUrl(u) }))
    .filter((u) => u.validation.valid)
    .map((u) => u.validation.url);

  if (validatedUrls.length === 0) {
    return { sent: false, reason: 'no_valid_endpoints', results: [] };
  }

  const payloadString = JSON.stringify(payload);
  const signature = signPayload(payloadString, secret);

  const headers = {
    ...(signature ? { 'x-biensperience-signature': signature } : {})
  };

  const results = await Promise.all(
    validatedUrls.map(async (url) => {
      const safeUrl = safeUrlForLogs(url);
      try {
        const res = await postJson(url, payload, { timeoutMs, headers });
        const ok = res.status >= 200 && res.status < 300;

        if (!ok) {
          backendLogger.warn('[notifications:webhook] Non-2xx response', {
            ...logContext,
            url: safeUrl,
            status: res.status
          });
        }

        return { url: safeUrl, ok, status: res.status };
      } catch (err) {
        backendLogger.warn('[notifications:webhook] Delivery failed', {
          ...logContext,
          url: safeUrl,
          error: err?.message || String(err)
        });
        return { url: safeUrl, ok: false, status: 0, error: err?.message || String(err) };
      }
    })
  );

  const anyOk = results.some((r) => r.ok);
  return {
    sent: anyOk,
    reason: anyOk ? undefined : 'delivery_failed',
    results
  };
}

module.exports = {
  isValidWebhookUrl,
  sendWebhookNotification
};

const baseLogger = require('../backend-logger');

function createProviderContext(provider, opts = {}) {
  const { abortSignal, session } = opts;
  const envKey = provider.envKey ? process.env[provider.envKey] || null : null;

  const tag = `[bienbot-tool:${provider.name}]`;
  const logger = {
    info:  (msg, meta) => baseLogger.info(`${tag} ${msg}`, meta),
    warn:  (msg, meta) => baseLogger.warn(`${tag} ${msg}`, meta),
    error: (msg, meta, err) => baseLogger.error(`${tag} ${msg}`, meta, err),
    debug: (msg, meta) => baseLogger.debug(`${tag} ${msg}`, meta)
  };

  function joinUrl(path) {
    const base = provider.baseUrl.replace(/\/+$/, '');
    const p = path.replace(/^\/+/, '');
    return `${base}/${p}`;
  }

  async function httpRequest(path, requestOpts = {}) {
    const { method = 'GET', headers = {}, body, query } = requestOpts;
    let url = joinUrl(path);
    if (query && Object.keys(query).length > 0) {
      const qs = new URLSearchParams(query).toString();
      url = `${url}?${qs}`;
    }
    const fetchOpts = { method, headers };
    if (body !== undefined) {
      fetchOpts.body = typeof body === 'string' ? body : JSON.stringify(body);
      if (!fetchOpts.headers['Content-Type']) {
        fetchOpts.headers['Content-Type'] = 'application/json';
      }
    }

    const { maxRetries = 2, baseDelayMs = 500, timeoutMs = 8000 } = provider.retryPolicy || {};

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (abortSignal?.aborted) {
        logger.warn(`request aborted before attempt ${attempt + 1}`);
        return null;
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const onExternalAbort = () => controller.abort();
      if (abortSignal) abortSignal.addEventListener('abort', onExternalAbort);

      try {
        const res = await fetch(url, { ...fetchOpts, signal: controller.signal });
        clearTimeout(timer);
        if (abortSignal) abortSignal.removeEventListener('abort', onExternalAbort);
        let parsed = null;
        try { parsed = await res.json(); } catch { /* non-JSON or empty */ }
        return { status: res.status, body: parsed };
      } catch (err) {
        clearTimeout(timer);
        if (abortSignal) abortSignal.removeEventListener('abort', onExternalAbort);
        if (err.name === 'AbortError') {
          if (abortSignal?.aborted) return null;
          logger.warn(`timeout on attempt ${attempt + 1}`);
        } else {
          logger.warn(`error on attempt ${attempt + 1}: ${err.message}`);
        }
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, baseDelayMs * Math.pow(2, attempt)));
        }
      }
    }
    logger.error(`all ${maxRetries + 1} attempts failed for ${url}`);
    return null;
  }

  return {
    httpRequest,
    envKey,
    logger,
    abortSignal,
    session
  };
}

module.exports = { createProviderContext };

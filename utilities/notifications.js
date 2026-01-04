const backendLogger = require('./backend-logger');
const crypto = require('crypto');

const { sendWebhookNotification } = require('./webhook-notifications');

/**
 * Notification preference gate
 *
 * User prefs live at user.preferences.notifications:
 * - enabled: boolean
 * - channels: ['email','push','sms','bienbot','webhook']
 * - types: ['activity','reminder','marketing','updates']
 * - webhooks: ['https://example.com/hook']
 */
function getNotificationPrefs(user) {
  return user?.preferences?.notifications || {
    enabled: true,
    channels: ['email', 'bienbot'],
    types: ['activity', 'reminder'],
    webhooks: []
  };
}

function shouldNotifyUser(user, { channel, type } = {}) {
  const prefs = getNotificationPrefs(user);

  if (!prefs?.enabled) return false;

  // BienBot is enabled by default unless explicitly disabled.
  // Do not require it to be present in channels[] to support older records.
  if (channel === 'bienbot' && prefs?.bienbotDisabled === true) {
    return false;
  }

  // SMS is never allowed unless the user has a verified phone number.
  if (channel === 'sms' && user?.phone?.verified !== true) {
    return false;
  }

  // For BienBot, channel membership is not required unless disabled above.
  if (channel && channel !== 'bienbot' && Array.isArray(prefs.channels) && !prefs.channels.includes(channel)) {
    return false;
  }

  if (type && Array.isArray(prefs.types) && !prefs.types.includes(type)) {
    return false;
  }

  return true;
}

function generateNotificationId() {
  return crypto.randomBytes(16).toString('hex');
}

async function sendViaBienBot({ user, message, data, logContext }) {
  // Lazy require to avoid pulling Stream Chat in tests/contexts that don't need it.
  // eslint-disable-next-line global-require
  const { sendBienBotMessageToUser } = require('./stream-chat');

  await sendBienBotMessageToUser({
    userId: user._id,
    text: message,
    data
  });

  backendLogger.debug('[notifications:bienbot] Delivered', {
    ...logContext,
    userId: user._id
  });
}

async function sendViaWebhook({ user, notificationId, channel, type, message, data, logContext }) {
  const prefs = getNotificationPrefs(user);
  const urls = Array.isArray(prefs.webhooks) ? prefs.webhooks : [];

  // If user has not configured webhook endpoints, treat as a no-op.
  if (!Array.isArray(urls) || urls.length === 0) {
    return { sent: false, reason: 'no_endpoints' };
  }

  const payload = {
    id: notificationId,
    channel,
    type,
    message,
    data: data && typeof data === 'object' ? data : {},
    user: { id: user._id?.toString?.() || user._id },
    timestamp: new Date().toISOString()
  };

  const timeoutMsRaw = process.env.NOTIFICATION_WEBHOOK_TIMEOUT_MS;
  const timeoutMsParsed = Number.parseInt(timeoutMsRaw || '', 10);
  const timeoutMs = Number.isFinite(timeoutMsParsed) && timeoutMsParsed > 0 ? timeoutMsParsed : 8000;

  const secret = process.env.NOTIFICATION_WEBHOOK_SECRET;
  return sendWebhookNotification({
    urls,
    payload,
    timeoutMs,
    secret,
    logContext: {
      ...logContext,
      userId: user._id,
      notificationId
    }
  });
}

/**
 * Standardized notification sender.
 *
 * This is preferred over ad-hoc `sendIfAllowed({ send: ... })` usage for
 * in-app channels like BienBot and webhooks.
 */
async function notifyUser({ user, channel, type = 'activity', message, data = {}, logContext = {}, send }) {
  if (!user) {
    backendLogger.warn('[notifications] notifyUser called without user', logContext);
    return { sent: false, reason: 'missing_user' };
  }

  if (!channel) {
    backendLogger.warn('[notifications] notifyUser called without channel', {
      ...logContext,
      userId: user._id
    });
    return { sent: false, reason: 'missing_channel' };
  }

  const notificationId = generateNotificationId();

  if (!shouldNotifyUser(user, { channel, type })) {
    backendLogger.info('[notifications] Notification suppressed by preferences', {
      ...logContext,
      userId: user._id,
      channel,
      type,
      notificationId
    });
    return { sent: false, reason: 'preferences' };
  }

  try {
    if (channel === 'email') {
      if (typeof send !== 'function') {
        backendLogger.warn('[notifications] notifyUser(email) called without send()', {
          ...logContext,
          userId: user._id,
          channel,
          type,
          notificationId
        });
        return { sent: false, reason: 'missing_send', channel, type, notificationId };
      }

      await send();
      backendLogger.debug('[notifications:email] Delivered', {
        ...logContext,
        userId: user._id,
        channel,
        type,
        notificationId
      });
      return { sent: true, channel, type, notificationId };
    }

    if (channel === 'bienbot') {
      await sendViaBienBot({ user, message, data, logContext: { ...logContext, notificationId } });
      return { sent: true, channel, type, notificationId };
    }

    if (channel === 'sms') {
      // Prefer explicit callback (lets callers control formatting/provider).
      if (typeof send === 'function') {
        await send();
        backendLogger.debug('[notifications:sms] Delivered (custom send)', {
          ...logContext,
          userId: user._id,
          channel,
          type,
          notificationId
        });
        return { sent: true, channel, type, notificationId };
      }

      const to = user?.phone?.number;
      if (!to) {
        return { sent: false, reason: 'missing_phone_number', channel, type, notificationId };
      }

      const from = process.env.SINCH_SMS_FROM || process.env.SINCH_SMS_SENDER || null;
      if (!from) {
        backendLogger.warn('[notifications] notifyUser(sms) missing SINCH_SMS_FROM', {
          ...logContext,
          userId: user._id,
          channel,
          type,
          notificationId
        });
        return { sent: false, reason: 'missing_sms_from', channel, type, notificationId };
      }

      // Lazy require to avoid pulling Sinch in tests/contexts that don't need it.
      // eslint-disable-next-line global-require
      const { sendSms } = require('./sinch');
      await sendSms({ to, from, body: message });

      backendLogger.debug('[notifications:sms] Delivered', {
        ...logContext,
        userId: user._id,
        channel,
        type,
        notificationId
      });
      return { sent: true, channel, type, notificationId };
    }

    if (channel === 'webhook') {
      const result = await sendViaWebhook({
        user,
        notificationId,
        channel,
        type,
        message,
        data,
        logContext
      });
      return { ...result, channel, type, notificationId };
    }

    backendLogger.warn('[notifications] Unsupported channel', {
      ...logContext,
      userId: user._id,
      channel,
      type,
      notificationId
    });
    return { sent: false, reason: 'unsupported_channel', channel, type, notificationId };
  } catch (err) {
    // Best-effort: do not break the main flow on notification failures.
    backendLogger.warn('[notifications] Failed to deliver notification (continuing)', {
      ...logContext,
      userId: user._id,
      channel,
      type,
      notificationId,
      error: err?.message || String(err),
      code: err?.code
    });
    return { sent: false, reason: 'delivery_failed', channel, type, notificationId };
  }
}

/**
 * Execute a notification sender only if user preferences allow it.
 *
 * @param {Object} options
 * @param {Object} options.user - User document (must include preferences)
 * @param {string} options.channel - 'email' | 'sms' | 'push' | 'bienbot'
 * @param {string} options.type - 'activity' | 'reminder' | 'marketing' | 'updates'
 * @param {Function} options.send - async function that performs the actual send
 * @param {Object} [options.logContext] - optional logging context
 */
async function sendIfAllowed({ user, channel, type, send, logContext = {} }) {
  if (!user) {
    backendLogger.warn('[notifications] sendIfAllowed called without user', logContext);
    return { sent: false, reason: 'missing_user' };
  }

  if (!shouldNotifyUser(user, { channel, type })) {
    backendLogger.info('[notifications] Notification suppressed by preferences', {
      ...logContext,
      userId: user._id,
      channel,
      type
    });
    return { sent: false, reason: 'preferences' };
  }

  await send();
  return { sent: true };
}

module.exports = {
  getNotificationPrefs,
  shouldNotifyUser,
  sendIfAllowed,
  notifyUser
};

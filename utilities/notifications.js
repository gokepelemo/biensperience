const backendLogger = require('./backend-logger');

/**
 * Notification preference gate
 *
 * User prefs live at user.preferences.notifications:
 * - enabled: boolean
 * - channels: ['email','push','sms']
 * - types: ['activity','reminder','marketing','updates']
 */
function getNotificationPrefs(user) {
  return user?.preferences?.notifications || {
    enabled: true,
    channels: ['email'],
    types: ['activity', 'reminder']
  };
}

function shouldNotifyUser(user, { channel, type } = {}) {
  const prefs = getNotificationPrefs(user);

  if (!prefs?.enabled) return false;

  if (channel && Array.isArray(prefs.channels) && !prefs.channels.includes(channel)) {
    return false;
  }

  if (type && Array.isArray(prefs.types) && !prefs.types.includes(type)) {
    return false;
  }

  return true;
}

/**
 * Execute a notification sender only if user preferences allow it.
 *
 * @param {Object} options
 * @param {Object} options.user - User document (must include preferences)
 * @param {string} options.channel - 'email' | 'sms' | 'push'
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
  sendIfAllowed
};

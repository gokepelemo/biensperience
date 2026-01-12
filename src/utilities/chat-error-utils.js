/**
 * Normalize Stream Chat + API errors into user-friendly messages.
 *
 * Stream errors can be overly technical (e.g. "ReadChannel" permission errors).
 * For known cases we return a more actionable message and avoid leaking internal IDs.
 */

function toNumberMaybe(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * @param {any} err
 * @param {object} [options]
 * @param {string} [options.defaultMessage]
 * @returns {string}
 */
export function getFriendlyChatErrorMessage(err, options = {}) {
  const { defaultMessage = 'Something went wrong with chat. Please try again.' } = options;

  if (!err) return defaultMessage;

  const message = typeof err?.message === 'string' ? err.message : '';

  // Stream client errors typically include a numeric code.
  // Example: "StreamChat error code 17: ... ReadChannel ..."
  const code =
    toNumberMaybe(err?.code) ??
    toNumberMaybe(err?.error?.code) ??
    toNumberMaybe(err?.response?.data?.code) ??
    null;

  const looksLikeReadDenied =
    code === 17 ||
    /\bReadChannel\b/i.test(message) ||
    /not allowed to perform action\s+ReadChannel/i.test(message);

  if (looksLikeReadDenied) {
    return "You don’t have access to this conversation. If this is a plan chat, ask the plan owner to add you as a collaborator.";
  }

  // For feature-flag denials and other API errors, the backend already returns a user-friendly message.
  if (message && message.trim()) return message;

  return defaultMessage;
}

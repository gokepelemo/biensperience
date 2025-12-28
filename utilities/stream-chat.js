const backendLogger = require('./backend-logger');

let cachedClient = null;

function getStreamChatConfig() {
  // Prefer the explicit STREAM_CHAT_* names, but allow common aliases.
  // This is especially useful when different deployment platforms expect different variable names.
  const apiKey = process.env.STREAM_CHAT_API_KEY || process.env.STREAM_API_KEY;
  const apiSecret =
    process.env.STREAM_CHAT_API_SECRET ||
    process.env.STREAM_SECRET_KEY ||
    process.env.STREAM_API_SECRET;

  return {
    apiKey,
    apiSecret,
    configured: Boolean(apiKey && apiSecret)
  };
}

function getStreamServerClient() {
  const { apiKey, apiSecret, configured } = getStreamChatConfig();

  if (!configured) {
    const missing = [
      !apiKey ? 'STREAM_CHAT_API_KEY (or STREAM_API_KEY)' : null,
      !apiSecret ? 'STREAM_CHAT_API_SECRET (or STREAM_SECRET_KEY)' : null
    ].filter(Boolean);

    const err = new Error(`Stream Chat is not configured (missing: ${missing.join(', ')})`);
    err.code = 'STREAM_CHAT_NOT_CONFIGURED';
    throw err;
  }

  if (cachedClient) return cachedClient;

  // Lazy require so tests that don't use chat don't need the module available.
  // eslint-disable-next-line global-require
  const { StreamChat } = require('stream-chat');

  const timeoutMsRaw = process.env.STREAM_CHAT_TIMEOUT_MS || process.env.STREAM_TIMEOUT_MS;
  const timeoutMsParsed = Number.parseInt(timeoutMsRaw || '', 10);
  const timeoutMs = Number.isFinite(timeoutMsParsed) && timeoutMsParsed > 0 ? timeoutMsParsed : 15000;

  // Stream Chat server SDK defaults to a 3000ms axios timeout, which is often too low
  // for network + cold start scenarios. Override with a safer default.
  cachedClient = StreamChat.getInstance(apiKey, apiSecret, { timeout: timeoutMs });
  backendLogger.info('Stream Chat server client initialized', { timeoutMs });
  return cachedClient;
}

async function ensureStreamUsersExist(userIds) {
  const client = getStreamServerClient();

  const uniqueIds = Array.from(
    new Set((Array.isArray(userIds) ? userIds : []).map((id) => id?.toString()).filter(Boolean))
  );

  if (uniqueIds.length === 0) return;

  // Best-effort: include display names if available.
  // Lazy require to avoid pulling models for code paths that don't need chat.
  let usersById = new Map();
  try {
    // eslint-disable-next-line global-require
    const User = require('../models/user');
    const users = await User.find({ _id: { $in: uniqueIds } }).select('name').lean();
    usersById = new Map(users.map((u) => [u._id.toString(), u]));
  } catch (err) {
    backendLogger.warn('Failed to fetch user names for Stream upsert (continuing)', {
      error: err.message
    });
  }

  const streamUsers = uniqueIds.map((id) => {
    const u = usersById.get(id);
    return {
      id,
      ...(u?.name ? { name: u.name } : {})
    };
  });

  try {
    await client.upsertUsers(streamUsers);
  } catch (err) {
    // If this fails, channel creation will likely fail anyway.
    // Still, throw so callers can return a useful error.
    backendLogger.error('Failed to upsert Stream users', {
      error: err.message
    });
    throw err;
  }
}

async function upsertMessagingChannel({ channelId, members, createdById, name, ...customData }) {
  if (!channelId || !Array.isArray(members) || members.length === 0 || !createdById) {
    const err = new Error('Missing required parameters for channel creation');
    err.code = 'STREAM_CHAT_INVALID_CHANNEL_PARAMS';
    throw err;
  }

  const client = getStreamServerClient();

  const createdByIdStr = createdById.toString();

  // Stream requires that all users referenced in channel membership exist.
  // Ensure creator + all members exist before creating/upserting the channel.
  await ensureStreamUsersExist([createdByIdStr, ...members]);

  // Use a single channel type for all in-app messaging.
  // Custom fields (e.g. planId) can be included in channel data for querying/sync.
  const channelData = {
    members,
    // Stream server-side auth requires the channel to include created_by or created_by_id.
    // (Without it, Stream returns: "either data.created_by or data.created_by_id must be provided when using server side auth.")
    created_by_id: createdByIdStr,
    ...(name ? { name } : {}),
    ...(customData && typeof customData === 'object' ? customData : {})
  };

  const channel = client.channel('messaging', channelId, channelData);

  try {
    // create() is idempotent if the channel already exists.
    // Prefer created_by_id (required for server-side auth). Keep user_id for backward compatibility.
    await channel.create({
      created_by_id: createdByIdStr,
      user_id: createdByIdStr
    });
  } catch (err) {
    // If the channel exists already, Stream may respond with 409.
    // In that case, we still want to return the channel reference.
    const status = err?.response?.status;
    if (status !== 409) {
      throw err;
    }
  }

  // Best-effort member sync: ensure the channel member list matches our desired list.
  try {
    await syncChannelMembers({ channel, desiredMembers: members });
  } catch (syncErr) {
    backendLogger.warn('Stream Chat member sync failed', {
      channelId,
      error: syncErr.message,
      code: syncErr.code
    });
  }

  // Best-effort metadata sync (e.g. name changes).
  try {
    if (name) {
      await channel.updatePartial({
        set: { name }
      });
    }
  } catch (updateErr) {
    backendLogger.warn('Stream Chat channel updatePartial failed', {
      channelId,
      error: updateErr.message,
      code: updateErr.code
    });
  }

  return channel;
}

async function syncChannelMembers({ channel, desiredMembers }) {
  if (!channel || !Array.isArray(desiredMembers) || desiredMembers.length === 0) return;

  // Query channel state without watching.
  const queryResult = await channel.query({
    state: true,
    watch: false
  });

  const membersState = queryResult?.members || queryResult?.channel?.members;
  const existingIds = new Set(
    Array.isArray(membersState)
      ? membersState.map(m => m?.user_id?.toString()).filter(Boolean)
      : []
  );

  const desiredIds = new Set(desiredMembers.map(m => m?.toString()).filter(Boolean));

  const toAdd = Array.from(desiredIds).filter(id => !existingIds.has(id));
  const toRemove = Array.from(existingIds).filter(id => !desiredIds.has(id));

  if (toAdd.length > 0) {
    // Ensure new members can see message history that pre-dates their membership.
    // Stream supports controlling this via the `hide_history` option.
    await channel.addMembers(toAdd, {}, { hide_history: false });
  }

  if (toRemove.length > 0 && desiredIds.size > 0) {
    // Keep at least one member; desiredIds already represents the safe target set.
    await channel.removeMembers(toRemove);
  }
}

function createUserToken(userId) {
  if (!userId) {
    const err = new Error('Missing userId for Stream token');
    err.code = 'STREAM_CHAT_INVALID_USER_ID';
    throw err;
  }

  const client = getStreamServerClient();
  return client.createToken(userId.toString());
}

module.exports = {
  getStreamChatConfig,
  getStreamServerClient,
  upsertMessagingChannel,
  syncChannelMembers,
  createUserToken
};

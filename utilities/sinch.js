const backendLogger = require('./backend-logger');

let cachedSinchClient = null;

// Common Sinch Conversation channel labels. Exact availability depends on your Sinch app configuration.
// This is a convenience for callers; the SDK ultimately passes through whatever channel string you provide.
const CONVERSATION_CHANNELS = Object.freeze({
  SMS: 'SMS',
  WHATSAPP: 'WHATSAPP',
  RCS: 'RCS',
  MESSENGER: 'MESSENGER',
  INSTAGRAM: 'INSTAGRAM',
  APPLE_MESSAGES_FOR_BUSINESS: 'APPLE_MESSAGES_FOR_BUSINESS'
});

function getOptionalEnv(name) {
  const raw = process.env[name];
  if (!raw) return null;
  const trimmed = String(raw).trim();
  return trimmed || null;
}

function getRequiredEnv(name) {
  const value = getOptionalEnv(name);
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function buildSinchClientConfig() {
  const projectId = getOptionalEnv('SINCH_PROJECT_ID');
  const keyId = getOptionalEnv('SINCH_KEY_ID');
  const keySecret = getOptionalEnv('SINCH_KEY_SECRET');

  const applicationKey = getOptionalEnv('SINCH_APPLICATION_KEY');
  const applicationSecret = getOptionalEnv('SINCH_APPLICATION_SECRET');

  const config = {};

  // Unified Project Authentication (Conversation/SMS/Numbers, etc.)
  if (projectId || keyId || keySecret) {
    if (!projectId || !keyId || !keySecret) {
      throw new Error(
        'Incomplete Sinch unified project authentication env vars: require SINCH_PROJECT_ID, SINCH_KEY_ID, SINCH_KEY_SECRET'
      );
    }
    config.projectId = projectId;
    config.keyId = keyId;
    config.keySecret = keySecret;
  }

  // Application Authentication (Voice/Verification, depending on your Sinch product setup)
  if (applicationKey || applicationSecret) {
    if (!applicationKey || !applicationSecret) {
      throw new Error(
        'Incomplete Sinch application authentication env vars: require SINCH_APPLICATION_KEY, SINCH_APPLICATION_SECRET'
      );
    }
    config.applicationKey = applicationKey;
    config.applicationSecret = applicationSecret;
  }

  if (Object.keys(config).length === 0) {
    throw new Error(
      'Missing Sinch credentials. Provide either unified project auth (SINCH_PROJECT_ID/SINCH_KEY_ID/SINCH_KEY_SECRET) and/or application auth (SINCH_APPLICATION_KEY/SINCH_APPLICATION_SECRET).'
    );
  }

  return config;
}

function getSinchClient() {
  if (cachedSinchClient) return cachedSinchClient;

  // Lazy-require so this module can be imported in test/dev without the dependency installed yet.
  // (But at runtime, package.json includes @sinch/sdk-core.)
  // eslint-disable-next-line global-require
  const { SinchClient } = require('@sinch/sdk-core');

  const config = buildSinchClientConfig();
  cachedSinchClient = new SinchClient(config);

  return cachedSinchClient;
}

function getSinchServices() {
  const client = getSinchClient();
  return {
    numbers: client.numbers,
    sms: client.sms,
    conversation: client.conversation,
    voice: client.voice,
    verification: client.verification
  };
}

function ensureSdkMethod(object, pathLabel, methodName) {
  const fn = object?.[methodName];
  if (typeof fn !== 'function') {
    throw new Error(
      `[sinch] SDK method not available: ${pathLabel}.${methodName} (check @sinch/sdk-core version and docs)`
    );
  }
  return fn;
}

/**
 * Send a Conversation API message.
 *
 * Supports all Sinch Conversation message bodies by accepting the raw `message` object.
 * Docs: POST /v1/projects/{project_id}/messages:send
 */
async function sendConversationMessage({
  appId,
  recipient,
  message,
  channelProperties,
  channelPriorityOrder,
  callbackUrl,
  messageMetadata,
  conversationMetadata,
  ttl,
  processingStrategy,
  correlationId,
  messageContentType
}) {
  const resolvedAppId = appId || process.env.SINCH_APP_ID;
  if (!resolvedAppId) {
    throw new Error('Missing required SINCH_APP_ID (or provide appId)');
  }

  const payload = {
    app_id: resolvedAppId,
    recipient,
    message
  };

  if (callbackUrl) payload.callback_url = callbackUrl;
  if (channelProperties) payload.channel_properties = channelProperties;
  if (Array.isArray(channelPriorityOrder)) payload.channel_priority_order = channelPriorityOrder;
  if (messageMetadata) payload.message_metadata = messageMetadata;
  if (conversationMetadata) payload.conversation_metadata = conversationMetadata;
  if (ttl) payload.ttl = ttl;
  if (processingStrategy) payload.processing_strategy = processingStrategy;
  if (correlationId) payload.correlation_id = correlationId;
  if (messageContentType) payload.message_content_type = messageContentType;

  const { conversation } = getSinchServices();
  const send = ensureSdkMethod(conversation?.messages, 'conversation.messages', 'send');

  return send({
    sendMessageRequestBody: payload
  });
}

/**
 * Convenience wrapper: send a text message to an identified recipient.
 * `channel` can be SMS / WHATSAPP / RCS / MESSENGER / INSTAGRAM / APPLE_MESSAGES_FOR_BUSINESS / etc
 * (must be configured in the Sinch app). Some channels require `channelProperties`.
 */
async function sendConversationTextMessage({ channel, identity, text, ...options }) {
  return sendConversationMessage({
    ...options,
    recipient: {
      identified_by: {
        channel_identities: [{ channel, identity }]
      }
    },
    message: {
      text_message: { text }
    }
  });
}

// SDK passthrough helpers: Conversation message types
async function sendConversationCardMessage(requestData) {
  const { conversation } = getSinchServices();
  const fn = ensureSdkMethod(conversation?.messages, 'conversation.messages', 'sendCardMessage');
  return fn(requestData);
}

async function sendConversationCarouselMessage(requestData) {
  const { conversation } = getSinchServices();
  const fn = ensureSdkMethod(conversation?.messages, 'conversation.messages', 'sendCarouselMessage');
  return fn(requestData);
}

async function sendConversationChoiceMessage(requestData) {
  const { conversation } = getSinchServices();
  const fn = ensureSdkMethod(conversation?.messages, 'conversation.messages', 'sendChoiceMessage');
  return fn(requestData);
}

async function sendConversationContactInfoMessage(requestData) {
  const { conversation } = getSinchServices();
  const fn = ensureSdkMethod(conversation?.messages, 'conversation.messages', 'sendContactInfoMessage');
  return fn(requestData);
}

async function sendConversationListMessage(requestData) {
  const { conversation } = getSinchServices();
  const fn = ensureSdkMethod(conversation?.messages, 'conversation.messages', 'sendListMessage');
  return fn(requestData);
}

async function sendConversationLocationMessage(requestData) {
  const { conversation } = getSinchServices();
  const fn = ensureSdkMethod(conversation?.messages, 'conversation.messages', 'sendLocationMessage');
  return fn(requestData);
}

async function sendConversationMediaMessage(requestData) {
  const { conversation } = getSinchServices();
  const fn = ensureSdkMethod(conversation?.messages, 'conversation.messages', 'sendMediaMessage');
  return fn(requestData);
}

async function sendConversationTemplateMessage(requestData) {
  const { conversation } = getSinchServices();
  const fn = ensureSdkMethod(conversation?.messages, 'conversation.messages', 'sendTemplateMessage');
  return fn(requestData);
}

async function sendConversationTextMessageSdk(requestData) {
  const { conversation } = getSinchServices();
  const fn = ensureSdkMethod(conversation?.messages, 'conversation.messages', 'sendTextMessage');
  return fn(requestData);
}

// SDK passthrough helpers: Conversation events
async function sendConversationEvent(requestData) {
  const { conversation } = getSinchServices();
  const fn = ensureSdkMethod(conversation?.events, 'conversation.events', 'send');
  return fn(requestData);
}

async function sendConversationComposingEvent(requestData) {
  const { conversation } = getSinchServices();
  const fn = ensureSdkMethod(conversation?.events, 'conversation.events', 'sendComposingEvent');
  return fn(requestData);
}

async function sendConversationComposingEndEvent(requestData) {
  const { conversation } = getSinchServices();
  const fn = ensureSdkMethod(conversation?.events, 'conversation.events', 'sendComposingEndEvent');
  return fn(requestData);
}

// SDK helpers: SMS
async function sendSms({ to, from, body, type = 'mt_text', ...rest }) {
  const { sms } = getSinchServices();
  const fn = ensureSdkMethod(sms?.batches, 'sms.batches', 'send');

  return fn({
    sendSMSRequestBody: {
      type,
      to: Array.isArray(to) ? to : [to],
      from,
      body,
      ...rest
    }
  });
}

// SDK helpers: Voice
async function voiceTtsCallout(requestData) {
  const { voice } = getSinchServices();
  const fn = ensureSdkMethod(voice?.callouts, 'voice.callouts', 'tts');
  return fn(requestData);
}

async function voiceConferenceCallout(requestData) {
  const { voice } = getSinchServices();
  const fn = ensureSdkMethod(voice?.callouts, 'voice.callouts', 'conference');
  return fn(requestData);
}

async function voiceCustomCallout(requestData) {
  const { voice } = getSinchServices();
  const fn = ensureSdkMethod(voice?.callouts, 'voice.callouts', 'custom');
  return fn(requestData);
}

// SDK helpers: Verification
async function startSmsVerification(phoneNumberOrRequestData) {
  const { verification } = getSinchServices();
  const fn = ensureSdkMethod(verification?.verifications, 'verification.verifications', 'startSms');

  let requestData = phoneNumberOrRequestData;

  // Preferred: accept an E.164 phone number and build the correct SDK request shape.
  if (typeof phoneNumberOrRequestData === 'string') {
    // eslint-disable-next-line global-require
    const { Verification } = require('@sinch/sdk-core');
    requestData = Verification.startVerificationHelper.buildSmsRequest(phoneNumberOrRequestData);
  }

  return fn(requestData);
}

async function reportSmsVerificationById(idOrRequestData, code) {
  const { verification } = getSinchServices();
  const fn = ensureSdkMethod(verification?.verifications, 'verification.verifications', 'reportSmsById');

  let requestData = idOrRequestData;

  // Preferred: accept (verificationId, code) and build the correct SDK request shape.
  if (typeof idOrRequestData === 'string') {
    if (typeof code !== 'string' || !code.trim()) {
      throw new Error('[sinch] reportSmsVerificationById requires code when called with an id');
    }
    // eslint-disable-next-line global-require
    const { Verification } = require('@sinch/sdk-core');
    requestData = Verification.reportVerificationByIdHelper.buildSmsRequest(idOrRequestData, code.trim());
  }

  return fn(requestData);
}

module.exports = {
  CONVERSATION_CHANNELS,
  getSinchClient,
  getSinchServices,
  sendConversationMessage,
  sendConversationTextMessage,
  // Conversation message-specific helpers (SDK)
  sendConversationCardMessage,
  sendConversationCarouselMessage,
  sendConversationChoiceMessage,
  sendConversationContactInfoMessage,
  sendConversationListMessage,
  sendConversationLocationMessage,
  sendConversationMediaMessage,
  sendConversationTemplateMessage,
  sendConversationTextMessageSdk,
  // Conversation events (SDK)
  sendConversationEvent,
  sendConversationComposingEvent,
  sendConversationComposingEndEvent,
  // SMS (SDK)
  sendSms,
  // Voice (SDK)
  voiceTtsCallout,
  voiceConferenceCallout,
  voiceCustomCallout,
  // Verification (SDK)
  startSmsVerification,
  reportSmsVerificationById
};

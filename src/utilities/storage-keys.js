/**
 * Canonical client storage keys.
 *
 * Naming rules:
 * - All keys are in the `bien:` namespace
 * - Key names use camelCase (no underscores)
 * - Dynamic keys are provided as helper functions
 */

export const STORAGE_KEYS = {
  // Plaintext exceptions (allowed)
  pendingHash: 'bien:pendingHash',

  // Auth (obfuscated, sync)
  token: 'bien:token',

  // Base preferences (obfuscated, sync)
  themeState: 'bien:themeState',
  currency: 'bien:currency',
  language: 'bien:language',
  timezone: 'bien:timezone',

  // Encrypted preference buckets
  encryptedPrefs: 'bien:encryptedPrefs',
  prefsMeta: 'bien:prefsMeta',

  // UI preferences (legacy sync fallback; stored obfuscated)
  uiPreferences: 'bien:uiPreferences',

  // App caches / stores
  planCache: 'bien:planCache',
  events: 'bien:events',
  sessionData: 'bien:sessionData',

  // Migration marker (encrypted)
  storageMigration: 'bien:storageMigration',

  // Consent
  cookieConsent: 'bien:cookieConsent',

  // Form drafts
  formDraftsPrefix: 'bien:formDrafts:',

  // Misc
  chunkReloadAttempted: 'bien:chunkReloadAttempted',

  // Dynamic helpers
  cookieData(name) {
    return `bien:cookieData:${name}`;
  },

  formDraftsBucket(bucketId) {
    return `${this.formDraftsPrefix}${bucketId}`;
  },

  emailVerificationResendCooldownPrefix: 'bien:emailVerificationResendCooldown:',
};

export const LEGACY_STORAGE_KEYS = {
  // Pending hash legacy variants
  pendingHash: ['biensperience:pendingHash', 'bien:pending_hash'],

  // Preferences legacy variants
  encryptedPrefs: ['biensperience:encrypted_prefs', 'bien:encrypted_prefs'],
  prefsMeta: ['biensperience:prefs_meta', 'bien:prefs_meta'],

  // Storage migration version legacy variants
  storageVersion: ['bien:storage_version', 'bien:storageVersion'],

  // Session legacy variants
  sessionData: ['bien_session_data', 'biensperience:sessionData'],

  // Token legacy variants
  token: ['token'],

  // Legacy preferences blob + base pref keys from older builds
  preferencesBlob: ['biensperience:preferences'],
  currency: ['biensperience:currency'],
  language: ['biensperience:language'],
  timezone: ['biensperience:timezone'],

  // Chunk reload guard legacy
  chunkReloadAttempted: ['bien:chunk_reload_attempted'],

  // Legacy UI preferences (plaintext JSON from older builds)
  uiPreferences: ['biensperience:ui_preferences', 'bien:ui_preferences'],
};

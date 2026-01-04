import React, { useState, useEffect, useMemo } from 'react';
import {
  Button,
  
} from '../design-system';
import { Form } from 'react-bootstrap';
import Checkbox from '../Checkbox/Checkbox';
import Modal from '../Modal/Modal';
import Alert from '../Alert/Alert';
import { useUser } from '../../contexts/UserContext';
import { useToast } from '../../contexts/ToastContext';
import { updateUser, startPhoneVerification, confirmPhoneVerification } from '../../utilities/users-api';
import { handleError } from '../../utilities/error-handler';
import themeManager from '../../utilities/theme-manager';
import { lang, getLanguageOptions } from '../../lang.constants';
import { getTimezoneOptions, detectUserTimezone, storePreferences } from '../../utilities/preferences-utils';
import { getCurrencyDropdownOptions } from '../../utilities/currency-utils';

export default function Preferences() {
  const { user, profile, fetchProfile } = useUser();
  const { success: showSuccess, error: showError } = useToast();
  const prefs = profile?.preferences || {};
  const detectedTimezone = useMemo(() => detectUserTimezone(), []);
  const [form, setForm] = useState({
    theme: prefs.theme || 'system-default',
    currency: prefs.currency || 'USD',
    language: prefs.language || 'en',
    timezone: prefs.timezone || detectedTimezone,
    profileVisibility: prefs.profileVisibility || (profile?.visibility || 'public'),
    notificationsEnabled: prefs.notifications?.enabled !== false,
    notificationChannels: prefs.notifications?.channels || ['email', 'bienbot'],
    notificationTypes: prefs.notifications?.types || ['activity','reminder'],
    notificationWebhooks: prefs.notifications?.webhooks || []
  });
  const [saving, setSaving] = useState(false);

  const normalizeWebhookText = (value) => {
    if (value == null) return '';
    const text = String(value);
    // Some browsers/clipboard sources or pastes can include literal "\n" sequences.
    // Convert those to actual newlines so we consistently split into per-line URLs.
    return text.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\r/g, '\n');
  };

  const [showSmsModal, setShowSmsModal] = useState(false);
  const [smsStep, setSmsStep] = useState('number'); // 'number' | 'code'
  const [smsPhoneNumber, setSmsPhoneNumber] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsError, setSmsError] = useState('');

  useEffect(() => {
    const p = profile?.preferences || {};

    // Normalize stored webhook endpoints that may include embedded newlines or literal "\n" sequences.
    const normalizedWebhooks = (() => {
      const raw = Array.isArray(p.notifications?.webhooks) ? p.notifications.webhooks : [];
      const expanded = raw
        .flatMap((entry) => normalizeWebhookText(entry).split(/\r?\n/))
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 10);
      return expanded;
    })();

    setForm(prev => ({
      ...prev,
      theme: p.theme || prev.theme,
      currency: p.currency || prev.currency,
      language: p.language || prev.language,
      timezone: p.timezone || prev.timezone,
      profileVisibility: p.profileVisibility || (profile?.visibility || prev.profileVisibility),
      notificationsEnabled: p.notifications?.enabled !== undefined ? p.notifications.enabled : prev.notificationsEnabled,
      notificationChannels: p.notifications?.channels || prev.notificationChannels,
      notificationTypes: p.notifications?.types || prev.notificationTypes,
      notificationWebhooks: normalizedWebhooks.length > 0 ? normalizedWebhooks : prev.notificationWebhooks,
    }));
    // Apply theme immediately when profile loads
    if (p.theme) {
      try { themeManager.applyTheme(p.theme); } catch (e) { /* ignore */ }
    }
  }, [profile]);

  if (!user) return null;

  const handleChange = (k, value) => setForm(prev => ({ ...prev, [k]: value }));

  const toggleChannel = (ch) => {
    if (ch === 'sms') {
      const isEnabled = form.notificationChannels.includes('sms');
      if (isEnabled) {
        setForm(prev => ({
          ...prev,
          notificationChannels: prev.notificationChannels.filter(c => c !== 'sms')
        }));
        return;
      }

      // Enabling SMS requires a verified phone number.
      if (profile?.phone?.verified === true) {
        setForm(prev => ({
          ...prev,
          notificationChannels: [...new Set([...prev.notificationChannels, 'sms'])]
        }));
        return;
      }

      setSmsError('');
      setSmsCode('');
      setSmsStep('number');
      setSmsPhoneNumber(profile?.phone?.number || '');
      setShowSmsModal(true);
      return;
    }

    setForm(prev => ({
      ...prev,
      notificationChannels: prev.notificationChannels.includes(ch) ? prev.notificationChannels.filter(c => c !== ch) : [...prev.notificationChannels, ch]
    }));
  };

  const toggleType = (t) => {
    setForm(prev => ({
      ...prev,
      notificationTypes: prev.notificationTypes.includes(t) ? prev.notificationTypes.filter(x => x !== t) : [...prev.notificationTypes, t]
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        preferences: {
          theme: form.theme,
          currency: form.currency,
          language: form.language,
          timezone: form.timezone,
          profileVisibility: form.profileVisibility,
          notifications: {
            enabled: !!form.notificationsEnabled,
            channels: form.notificationChannels,
            bienbotDisabled: !form.notificationChannels.includes('bienbot'),
            types: form.notificationTypes,
            webhooks: form.notificationWebhooks
          }
        }
      };

      await updateUser(user._id, payload);
      // refresh profile data
      // apply theme immediately for instant feedback
      try { themeManager.applyTheme(form.theme); } catch (e) { /* ignore */ }
      
      // Update local preferences immediately so other parts of the app render accordingly
      // Keep this minimal (no notification webhooks in local storage)
      try {
        storePreferences({
          currency: form.currency,
          language: form.language,
          theme: form.theme,
          timezone: form.timezone
        });
      } catch (e) { /* ignore */ }
      if (typeof fetchProfile === 'function') await fetchProfile();
      showSuccess(lang.current.success.preferencesSaved);
    } catch (err) {
      const errorMsg = handleError(err, { context: 'Save preferences', silent: true }) || 'Failed to save preferences. Please try again.';
      showError(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleSmsStart = async () => {
    setSmsLoading(true);
    setSmsError('');
    try {
      await startPhoneVerification(user._id, smsPhoneNumber);
      setSmsStep('code');
    } catch (err) {
      const msg = handleError(err, { context: 'Start SMS verification', silent: true }) || 'Failed to start SMS verification';
      setSmsError(msg);
    } finally {
      setSmsLoading(false);
    }
  };

  const handleSmsConfirm = async () => {
    setSmsLoading(true);
    setSmsError('');
    try {
      const result = await confirmPhoneVerification(user._id, smsCode);
      const status = result?.status || result?.data?.status;
      if (status !== 'SUCCESSFUL') {
        setSmsError('Verification failed. Please check the code and try again.');
        return;
      }

      setForm(prev => ({
        ...prev,
        notificationChannels: [...new Set([...prev.notificationChannels, 'sms'])]
      }));

      setShowSmsModal(false);
      setSmsStep('number');
      setSmsCode('');
      if (typeof fetchProfile === 'function') await fetchProfile();
      showSuccess('Phone number verified. SMS notifications enabled.');
    } catch (err) {
      const msg = handleError(err, { context: 'Confirm SMS verification', silent: true }) || 'Failed to confirm SMS verification';
      setSmsError(msg);
    } finally {
      setSmsLoading(false);
    }
  };

  return (
    <>
      <div className="row animation-fade-in">
        <div className="col-12">
          <h1 className="form-title">Preferences</h1>
          <p className="text-muted text-center mb-0">Platform preferences and notification settings</p>
        </div>
      </div>

      <div className="row my-4 animation-fade-in justify-content-center">
        <div className="col-12">
          <Form onSubmit={handleSave} className="form-unified" autoComplete="off">
            <div className="form-section">
              <div className="form-section-title">General</div>

              <Form.Group className="mb-4">
                <Form.Label htmlFor="theme-select">Theme</Form.Label>
                <Form.Select
                  id="theme-select"
                  value={form.theme}
                  onChange={e => handleChange('theme', e.target.value)}
                >
                  <option value="system-default">System Default</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-4">
                <Form.Label htmlFor="timezone-select">Timezone</Form.Label>
                <Form.Select
                  id="timezone-select"
                  value={form.timezone}
                  onChange={e => handleChange('timezone', e.target.value)}
                >
                  {getTimezoneOptions().map(tz => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-4">
                <Form.Label htmlFor="language-select">Language</Form.Label>
                <Form.Select
                  id="language-select"
                  value={form.language}
                  onChange={e => handleChange('language', e.target.value)}
                >
                  {getLanguageOptions().map(opt => (
                    <option key={opt.code} value={opt.code}>{opt.name}</option>
                  ))}
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-4">
                <Form.Label htmlFor="currency-select">Currency</Form.Label>
                <Form.Select
                  id="currency-select"
                  value={form.currency}
                  onChange={e => handleChange('currency', e.target.value)}
                >
                  {getCurrencyDropdownOptions({ format: 'full' }).map(curr => (
                    <option key={curr.value} value={curr.value}>{curr.label}</option>
                  ))}
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-0">
                <Form.Label htmlFor="visibility-select">Profile Visibility</Form.Label>
                <Form.Select
                  id="visibility-select"
                  value={form.profileVisibility}
                  onChange={e => handleChange('profileVisibility', e.target.value)}
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </Form.Select>
              </Form.Group>
            </div>

            <div className="form-section">
              <div className="form-section-title">Notifications</div>

              <div className="mb-4">
                <Checkbox
                  id="notifications-enabled"
                  checked={form.notificationsEnabled}
                  onChange={(e) => handleChange('notificationsEnabled', e.target.checked)}
                  label="Enable Notifications"
                  size="md"
                />
              </div>

              {form.notificationsEnabled && (
                <>
                  <div className="mb-4">
                    <Form.Label>Notification Channels</Form.Label>
                    <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                      <Checkbox
                        id="channel-email"
                        checked={form.notificationChannels.includes('email')}
                        onChange={() => toggleChannel('email')}
                        label="Email"
                        size="sm"
                      />
                      <Checkbox
                        id="channel-bienbot"
                        checked={form.notificationChannels.includes('bienbot')}
                        onChange={() => toggleChannel('bienbot')}
                        label="BienBot"
                        size="sm"
                      />
                      <Checkbox
                        id="channel-push"
                        checked={form.notificationChannels.includes('push')}
                        onChange={() => toggleChannel('push')}
                        label="Push"
                        size="sm"
                      />
                      <Checkbox
                        id="channel-sms"
                        checked={form.notificationChannels.includes('sms')}
                        onChange={() => toggleChannel('sms')}
                        label="SMS"
                        size="sm"
                      />
                      <Checkbox
                        id="channel-webhook"
                        checked={form.notificationChannels.includes('webhook')}
                        onChange={() => toggleChannel('webhook')}
                        label="Webhooks"
                        size="sm"
                      />
                    </div>
                  </div>

                  {profile?.phone?.number && (
                    <div className="form-text mb-4">
                      SMS number: {profile.phone.number} ({profile.phone.verified ? 'verified' : 'not verified'})
                    </div>
                  )}

                  {form.notificationChannels.includes('webhook') && (
                    <Form.Group className="mb-4">
                      <Form.Label htmlFor="webhook-endpoints">Webhook Endpoints</Form.Label>
                      <Form.Control
                        as="textarea"
                        id="webhook-endpoints"
                        rows={4}
                        value={(form.notificationWebhooks || []).join('\n')}
                        onChange={(e) => {
                          const endpoints = normalizeWebhookText(e.target.value || '')
                            .split(/\r?\n/)
                            .map((line) => line.trim())
                            .filter(Boolean)
                            .slice(0, 10);

                          handleChange('notificationWebhooks', endpoints);
                        }}
                        placeholder="https://example.com/biensperience/webhook\nhttps://hooks.example.com/events"
                      />
                      <div className="form-text mt-2">One HTTPS URL per line. Up to 10 endpoints.</div>
                    </Form.Group>
                  )}

                  <div className="mb-0">
                    <Form.Label>Notification Types</Form.Label>
                    <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                      <Checkbox
                        id="type-activity"
                        checked={form.notificationTypes.includes('activity')}
                        onChange={() => toggleType('activity')}
                        label="Activity"
                        size="sm"
                      />
                      <Checkbox
                        id="type-reminder"
                        checked={form.notificationTypes.includes('reminder')}
                        onChange={() => toggleType('reminder')}
                        label="Reminders"
                        size="sm"
                      />
                      <Checkbox
                        id="type-marketing"
                        checked={form.notificationTypes.includes('marketing')}
                        onChange={() => toggleType('marketing')}
                        label="Marketing"
                        size="sm"
                      />
                      <Checkbox
                        id="type-updates"
                        checked={form.notificationTypes.includes('updates')}
                        onChange={() => toggleType('updates')}
                        label="Updates"
                        size="sm"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            <div style={{ paddingTop: 'var(--space-2)' }}>
              <Button
                type="submit"
                variant="gradient"
                size="lg"
                disabled={saving}
                rounded
                shadow
              >
                {saving ? 'Saving...' : 'Save Preferences'}
              </Button>
            </div>
          </Form>

          <Modal
            show={showSmsModal}
            onClose={() => {
              if (smsLoading) return;
              setShowSmsModal(false);
              setSmsError('');
              setSmsStep('number');
              setSmsCode('');
            }}
            title="Verify mobile number"
            footer={
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <Button
                  variant="outline-secondary"
                  onClick={() => {
                    if (smsLoading) return;
                    setShowSmsModal(false);
                    setSmsError('');
                    setSmsStep('number');
                    setSmsCode('');
                  }}
                  disabled={smsLoading}
                >
                  Cancel
                </Button>
                {smsStep === 'number' ? (
                  <Button
                    variant="primary"
                    onClick={handleSmsStart}
                    disabled={smsLoading || !smsPhoneNumber?.trim()}
                    style={{ background: 'var(--gradient-primary)', border: 'none' }}
                  >
                    {smsLoading ? 'Sending...' : 'Send Code'}
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    onClick={handleSmsConfirm}
                    disabled={smsLoading || !smsCode?.trim()}
                    style={{ background: 'var(--gradient-primary)', border: 'none' }}
                  >
                    {smsLoading ? 'Verifying...' : 'Verify'}
                  </Button>
                )}
              </div>
            }
          >
            <div className="mb-3 text-muted">
              Enter your mobile number to enable SMS notifications.
            </div>

            {smsError && <Alert type="danger" message={smsError} />}

            {smsStep === 'number' ? (
              <Form.Group className="mb-0">
                <Form.Label htmlFor="sms-phone-number">Mobile number</Form.Label>
                <Form.Control
                  id="sms-phone-number"
                  type="text"
                  value={smsPhoneNumber}
                  onChange={(e) => setSmsPhoneNumber(e.target.value)}
                  placeholder="+15551234567"
                  disabled={smsLoading}
                />
              </Form.Group>
            ) : (
              <Form.Group className="mb-0">
                <Form.Label htmlFor="sms-code">Verification code</Form.Label>
                <Form.Control
                  id="sms-code"
                  type="text"
                  value={smsCode}
                  onChange={(e) => setSmsCode(e.target.value)}
                  placeholder="123456"
                  disabled={smsLoading}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
              </Form.Group>
            )}
          </Modal>
        </div>
      </div>
    </>
  );
}

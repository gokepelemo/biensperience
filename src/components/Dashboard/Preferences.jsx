import React, { useState, useEffect } from 'react';
import {
  Heading,
  Text,
  Button,
  Form,
  FormGroup,
  FormLabel,
  FormControl,
  FormCheck,
  Container,
  SpaceY,
  FadeIn
} from '../design-system';
import { useUser } from '../../contexts/UserContext';
import { updateUser } from '../../utilities/users-api';
import themeManager from '../../utilities/theme-manager';
import { getLanguageOptions } from '../../lang.constants';

export default function Preferences() {
  const { user, profile, fetchProfile } = useUser();
  const prefs = profile?.preferences || {};
  const [form, setForm] = useState({
    theme: prefs.theme || 'system-default',
    currency: prefs.currency || 'USD',
    language: prefs.language || 'en',
    profileVisibility: prefs.profileVisibility || (profile?.visibility || 'public'),
    notificationsEnabled: prefs.notifications?.enabled !== false,
    notificationChannels: prefs.notifications?.channels || ['email'],
    notificationTypes: prefs.notifications?.types || ['activity','reminder']
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const p = profile?.preferences || {};
    setForm(prev => ({
      ...prev,
      theme: p.theme || prev.theme,
      currency: p.currency || prev.currency,
      language: p.language || prev.language,
      profileVisibility: p.profileVisibility || (profile?.visibility || prev.profileVisibility),
      notificationsEnabled: p.notifications?.enabled !== undefined ? p.notifications.enabled : prev.notificationsEnabled,
      notificationChannels: p.notifications?.channels || prev.notificationChannels,
      notificationTypes: p.notifications?.types || prev.notificationTypes,
    }));
    // Apply theme immediately when profile loads
    if (p.theme) {
      try { themeManager.applyTheme(p.theme); } catch (e) { /* ignore */ }
    }
  }, [profile]);

  if (!user) return null;

  const handleChange = (k, value) => setForm(prev => ({ ...prev, [k]: value }));

  const toggleChannel = (ch) => {
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
          profileVisibility: form.profileVisibility,
          notifications: {
            enabled: !!form.notificationsEnabled,
            channels: form.notificationChannels,
            types: form.notificationTypes
          }
        }
      };

      await updateUser(user._id, payload);
      // refresh profile data
      // apply theme immediately for instant feedback
      try { themeManager.applyTheme(form.theme); } catch (e) { /* ignore */ }
      
        // Update localStorage preferences immediately so other parts of the app render accordingly
        try {
          const storageObj = { currency: form.currency, language: form.language, theme: form.theme };
          localStorage.setItem('biensperience:preferences', JSON.stringify(storageObj));
          localStorage.setItem('biensperience:currency', form.currency);
          localStorage.setItem('biensperience:language', form.language);
        } catch (e) { /* ignore */ }
      if (typeof fetchProfile === 'function') await fetchProfile();
    } catch (err) {
      // ignore or use toast
    } finally {
      setSaving(false);
    }
  };

  return (
    <FadeIn>
      <Container
        className="preferences-card"
        style={{
          height: '100%',
          padding: 'var(--space-6)',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-light)',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <Heading level={4} className="mb-2">Preferences</Heading>
        <Text size="sm" variant="secondary" className="mb-4">
          Platform preferences and notification settings
        </Text>

        <Form onSubmit={handleSave}>
          <SpaceY spacing="4">
            <FormGroup>
              <FormLabel htmlFor="theme-select">Theme</FormLabel>
              <FormControl
                as="select"
                id="theme-select"
                value={form.theme}
                onChange={e => handleChange('theme', e.target.value)}
              >
                <option value="system-default">System Default</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </FormControl>
            </FormGroup>

            <FormGroup>
              <FormLabel htmlFor="currency-input">Currency</FormLabel>
              <FormControl
                id="currency-input"
                type="text"
                value={form.currency}
                onChange={e => handleChange('currency', e.target.value)}
                placeholder="USD"
              />
            </FormGroup>

            <FormGroup>
              <FormLabel htmlFor="language-select">Language</FormLabel>
              <FormControl
                as="select"
                id="language-select"
                value={form.language}
                onChange={e => handleChange('language', e.target.value)}
              >
                {getLanguageOptions().map(opt => (
                  <option key={opt.code} value={opt.code}>{opt.name}</option>
                ))}
              </FormControl>
            </FormGroup>

            <FormGroup>
              <FormLabel htmlFor="visibility-select">Profile Visibility</FormLabel>
              <FormControl
                as="select"
                id="visibility-select"
                value={form.profileVisibility}
                onChange={e => handleChange('profileVisibility', e.target.value)}
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </FormControl>
            </FormGroup>

            <FormGroup>
              <FormCheck
                type="checkbox"
                id="notifications-enabled"
                checked={form.notificationsEnabled}
                onChange={e => handleChange('notificationsEnabled', e.target.checked)}
              >
                Enable notifications
              </FormCheck>
            </FormGroup>

            {form.notificationsEnabled && (
              <>
                <FormGroup>
                  <FormLabel>Notification Channels</FormLabel>
                  <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                    <FormCheck
                      type="checkbox"
                      id="channel-email"
                      checked={form.notificationChannels.includes('email')}
                      onChange={() => toggleChannel('email')}
                    >
                      Email
                    </FormCheck>
                    <FormCheck
                      type="checkbox"
                      id="channel-push"
                      checked={form.notificationChannels.includes('push')}
                      onChange={() => toggleChannel('push')}
                    >
                      Push
                    </FormCheck>
                    <FormCheck
                      type="checkbox"
                      id="channel-sms"
                      checked={form.notificationChannels.includes('sms')}
                      onChange={() => toggleChannel('sms')}
                    >
                      SMS
                    </FormCheck>
                  </div>
                </FormGroup>

                <FormGroup>
                  <FormLabel>Notification Types</FormLabel>
                  <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                    <FormCheck
                      type="checkbox"
                      id="type-activity"
                      checked={form.notificationTypes.includes('activity')}
                      onChange={() => toggleType('activity')}
                    >
                      Activity
                    </FormCheck>
                    <FormCheck
                      type="checkbox"
                      id="type-reminder"
                      checked={form.notificationTypes.includes('reminder')}
                      onChange={() => toggleType('reminder')}
                    >
                      Reminders
                    </FormCheck>
                    <FormCheck
                      type="checkbox"
                      id="type-marketing"
                      checked={form.notificationTypes.includes('marketing')}
                      onChange={() => toggleType('marketing')}
                    >
                      Marketing
                    </FormCheck>
                    <FormCheck
                      type="checkbox"
                      id="type-updates"
                      checked={form.notificationTypes.includes('updates')}
                      onChange={() => toggleType('updates')}
                    >
                      Updates
                    </FormCheck>
                  </div>
                </FormGroup>
              </>
            )}

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
          </SpaceY>
        </Form>
      </Container>
    </FadeIn>
  );
}

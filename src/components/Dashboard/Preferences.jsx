import React, { useState, useEffect } from 'react';
import { Card, Form, Button } from 'react-bootstrap';
import { Heading, Text } from '../design-system';
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
      if (typeof fetchProfile === 'function') await fetchProfile();
    } catch (err) {
      // ignore or use toast
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={{ height: '100%', padding: 'var(--space-4)' }}>
      <Heading level={4}>Preferences</Heading>
      <Text size="sm" className="mb-3">Platform preferences and notification settings</Text>

      <Form onSubmit={handleSave}>
        <Form.Group className="mb-3">
          <Form.Label>Theme</Form.Label>
          <Form.Select value={form.theme} onChange={e => handleChange('theme', e.target.value)}>
            <option value="system-default">System Default</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </Form.Select>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Currency</Form.Label>
          <Form.Control value={form.currency} onChange={e => handleChange('currency', e.target.value)} />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Language</Form.Label>
          <Form.Select value={form.language} onChange={e => handleChange('language', e.target.value)}>
            {getLanguageOptions().map(opt => (
              <option key={opt.code} value={opt.code}>{opt.name}</option>
            ))}
          </Form.Select>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Profile Visibility</Form.Label>
          <Form.Select value={form.profileVisibility} onChange={e => handleChange('profileVisibility', e.target.value)}>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </Form.Select>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Check type="checkbox" label="Enable notifications" checked={form.notificationsEnabled} onChange={e => handleChange('notificationsEnabled', e.target.checked)} />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Notification Channels</Form.Label>
          <div>
            <Form.Check inline label="Email" type="checkbox" checked={form.notificationChannels.includes('email')} onChange={() => toggleChannel('email')} />
            <Form.Check inline label="Push" type="checkbox" checked={form.notificationChannels.includes('push')} onChange={() => toggleChannel('push')} />
            <Form.Check inline label="SMS" type="checkbox" checked={form.notificationChannels.includes('sms')} onChange={() => toggleChannel('sms')} />
          </div>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Notification Types</Form.Label>
          <div>
            <Form.Check inline label="Activity" type="checkbox" checked={form.notificationTypes.includes('activity')} onChange={() => toggleType('activity')} />
            <Form.Check inline label="Reminders" type="checkbox" checked={form.notificationTypes.includes('reminder')} onChange={() => toggleType('reminder')} />
            <Form.Check inline label="Marketing" type="checkbox" checked={form.notificationTypes.includes('marketing')} onChange={() => toggleType('marketing')} />
            <Form.Check inline label="Updates" type="checkbox" checked={form.notificationTypes.includes('updates')} onChange={() => toggleType('updates')} />
          </div>
        </Form.Group>

        <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Preferences'}</Button>
      </Form>
    </Card>
  );
}

const { notifyUser, shouldNotifyUser } = require('../../utilities/notifications');

describe('notifications utility', () => {
  describe('shouldNotifyUser', () => {
    it('should allow bienbot by default unless explicitly disabled', () => {
      const user = {
        _id: 'u1',
        preferences: {
          notifications: {
            enabled: true,
            channels: ['email'],
            types: []
          }
        }
      };

      expect(shouldNotifyUser(user, { channel: 'bienbot' })).toBe(true);

      user.preferences.notifications.bienbotDisabled = true;
      expect(shouldNotifyUser(user, { channel: 'bienbot' })).toBe(false);
    });

    it('should deny sms when phone is not verified', () => {
      const user = {
        _id: 'u1',
        phone: { number: '+15551234567', verified: false },
        preferences: {
          notifications: {
            enabled: true,
            channels: ['sms'],
            types: ['activity']
          }
        }
      };

      expect(shouldNotifyUser(user, { channel: 'sms', type: 'activity' })).toBe(false);

      user.phone.verified = true;
      expect(shouldNotifyUser(user, { channel: 'sms', type: 'activity' })).toBe(true);
    });

    it('should deny all channels when notifications are disabled', () => {
      const user = {
        _id: 'u1',
        preferences: {
          notifications: {
            enabled: false,
            channels: ['email', 'bienbot'],
            types: ['activity']
          }
        }
      };

      expect(shouldNotifyUser(user, { channel: 'bienbot', type: 'activity' })).toBe(false);
      expect(shouldNotifyUser(user, { channel: 'email', type: 'activity' })).toBe(false);
    });
  });

  describe('notifyUser(email)', () => {
    it('should call send() when preferences allow email', async () => {
      const send = jest.fn(async () => undefined);
      const user = {
        _id: 'u1',
        preferences: {
          notifications: {
            enabled: true,
            channels: ['email', 'bienbot'],
            types: ['activity']
          }
        }
      };

      const result = await notifyUser({
        user,
        channel: 'email',
        type: 'activity',
        message: 'Test email notification',
        data: { kind: 'test' },
        send
      });

      expect(send).toHaveBeenCalledTimes(1);
      expect(result.sent).toBe(true);
      expect(result.channel).toBe('email');
      expect(result.type).toBe('activity');
      expect(result.notificationId).toBeDefined();
    });

    it('should suppress email when user has disabled email channel', async () => {
      const send = jest.fn(async () => undefined);
      const user = {
        _id: 'u1',
        preferences: {
          notifications: {
            enabled: true,
            channels: ['bienbot'],
            types: ['activity']
          }
        }
      };

      const result = await notifyUser({
        user,
        channel: 'email',
        type: 'activity',
        message: 'Test email notification',
        send
      });

      expect(send).toHaveBeenCalledTimes(0);
      expect(result.sent).toBe(false);
      expect(result.reason).toBe('preferences');
    });

    it('should return missing_send when send() is not provided', async () => {
      const user = {
        _id: 'u1',
        preferences: {
          notifications: {
            enabled: true,
            channels: ['email', 'bienbot'],
            types: ['activity']
          }
        }
      };

      const result = await notifyUser({
        user,
        channel: 'email',
        type: 'activity',
        message: 'Test email notification'
      });

      expect(result.sent).toBe(false);
      expect(result.reason).toBe('missing_send');
    });
  });
});

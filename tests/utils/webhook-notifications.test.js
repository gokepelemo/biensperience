const crypto = require('crypto');
const { EventEmitter } = require('events');

jest.mock('https', () => ({
  request: jest.fn()
}));

const https = require('https');

const {
  isValidWebhookUrl,
  sendWebhookNotification
} = require('../../utilities/webhook-notifications');

describe('webhook-notifications', () => {
  const originalEnv = process.env.NOTIFICATION_WEBHOOK_ALLOWED_HOSTS;

  afterEach(() => {
    process.env.NOTIFICATION_WEBHOOK_ALLOWED_HOSTS = originalEnv;
    jest.clearAllMocks();
  });

  describe('isValidWebhookUrl', () => {
    it('rejects non-https URLs', () => {
      expect(isValidWebhookUrl('http://example.com').valid).toBe(false);
      expect(isValidWebhookUrl('http://example.com').reason).toBe('non_https');
    });

    it('rejects localhost and .local', () => {
      expect(isValidWebhookUrl('https://localhost/hook').valid).toBe(false);
      expect(isValidWebhookUrl('https://localhost/hook').reason).toBe('localhost_disallowed');

      expect(isValidWebhookUrl('https://myapp.local/hook').valid).toBe(false);
      expect(isValidWebhookUrl('https://myapp.local/hook').reason).toBe('localhost_disallowed');
    });

    it('rejects private IPv4 literals', () => {
      expect(isValidWebhookUrl('https://192.168.0.10/hook').valid).toBe(false);
      expect(isValidWebhookUrl('https://192.168.0.10/hook').reason).toBe('private_ip_disallowed');

      expect(isValidWebhookUrl('https://10.0.0.5/hook').valid).toBe(false);
      expect(isValidWebhookUrl('https://10.0.0.5/hook').reason).toBe('private_ip_disallowed');
    });

    it('enforces optional host allowlist (suffix match)', () => {
      process.env.NOTIFICATION_WEBHOOK_ALLOWED_HOSTS = 'example.com';

      const ok = isValidWebhookUrl('https://hooks.example.com/notify');
      expect(ok.valid).toBe(true);

      const blocked = isValidWebhookUrl('https://example.net/notify');
      expect(blocked.valid).toBe(false);
      expect(blocked.reason).toBe('host_not_allowed');
    });
  });

  describe('sendWebhookNotification', () => {
    it('returns no_endpoints when urls list is empty', async () => {
      const res = await sendWebhookNotification({ urls: [], payload: { hello: 'world' } });
      expect(res.sent).toBe(false);
      expect(res.reason).toBe('no_endpoints');
      expect(res.results).toEqual([]);
    });

    it('filters invalid endpoints and returns no_valid_endpoints', async () => {
      const res = await sendWebhookNotification({
        urls: ['http://example.com/hook', 'https://localhost/hook'],
        payload: { hello: 'world' }
      });

      expect(res.sent).toBe(false);
      expect(res.reason).toBe('no_valid_endpoints');
      expect(res.results).toEqual([]);
    });

    it('posts JSON to valid endpoints and includes HMAC signature header when secret is set', async () => {
      process.env.NOTIFICATION_WEBHOOK_ALLOWED_HOSTS = 'example.com';

      const captured = [];

      https.request.mockImplementation((options, callback) => {
        captured.push(options);

        const req = new EventEmitter();
        req.setTimeout = jest.fn();
        req.write = jest.fn();
        req.destroy = jest.fn();
        req.end = jest.fn(() => {
          const res = new EventEmitter();
          res.statusCode = 204;
          callback(res);
          process.nextTick(() => {
            res.emit('data', Buffer.from(''));
            res.emit('end');
          });
        });

        return req;
      });

      const payload = { kind: 'test', nested: { a: 1 } };
      const secret = 'unit-test-secret';

      const res = await sendWebhookNotification({
        urls: ['https://example.com/hook'],
        payload,
        timeoutMs: 1000,
        secret,
        logContext: { feature: 'unit_test' }
      });

      expect(res.sent).toBe(true);
      expect(res.results).toHaveLength(1);
      expect(res.results[0].ok).toBe(true);

      expect(captured).toHaveLength(1);
      const headers = captured[0].headers || {};

      const expectedSig = `sha256=${crypto.createHmac('sha256', secret).update(JSON.stringify(payload), 'utf8').digest('hex')}`;
      expect(headers['x-biensperience-signature']).toBe(expectedSig);
      expect(headers['content-type']).toBe('application/json');
    });
  });
});

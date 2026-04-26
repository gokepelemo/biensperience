/**
 * Coverage for the buildApiErrorHandler factory used in app.js. We mount it on
 * a tiny isolated express app (no DB, no app.js boot cost) so we can exercise
 * dev-vs-prod sanitization rules and the X-Request-Id contract.
 */

const express = require('express');
const request = require('supertest');
const { randomUUID } = require('crypto');
const { APIError, buildApiErrorHandler } = require('../../utilities/api-error');

function makeApp() {
  const app = express();
  app.use((req, res, next) => {
    const inbound = req.get('X-Request-Id');
    req.id = (typeof inbound === 'string' && inbound.length > 0 && inbound.length <= 128)
      ? inbound
      : randomUUID();
    res.setHeader('X-Request-Id', req.id);
    next();
  });
  app.get('/api/throw_internal', (req, res, next) =>
    next(new Error('mongo connection refused: super-secret-host:27017'))
  );
  app.get('/api/throw_operational', (req, res, next) =>
    next(new APIError('Plan not found', 404, 'RESOURCE_NOT_FOUND'))
  );
  app.get('/api/throw_4xx_plain', (req, res, next) => {
    const e = new Error('Invalid email');
    e.statusCode = 400;
    next(e);
  });
  const logger = { error: jest.fn() };
  app.use('/api', buildApiErrorHandler({ logger }));
  return { app, logger };
}

describe('buildApiErrorHandler', () => {
  const prevEnv = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = prevEnv; });

  describe('non-production', () => {
    beforeEach(() => { process.env.NODE_ENV = 'test'; });

    it('surfaces the raw message for internal errors (verbose for debugging)', async () => {
      const { app, logger } = makeApp();
      const res = await request(app).get('/api/throw_internal');
      expect(res.status).toBe(500);
      expect(res.body.error).toContain('mongo connection refused');
      expect(res.body.requestId).toMatch(/^[0-9a-f-]{36}$/);
      expect(res.headers['x-request-id']).toBe(res.body.requestId);
      expect(logger.error).toHaveBeenCalledTimes(1);
    });

    it('surfaces APIError messages with correct status and code', async () => {
      const { app } = makeApp();
      const res = await request(app).get('/api/throw_operational');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Plan not found');
      expect(res.body.code).toBe('RESOURCE_NOT_FOUND');
    });
  });

  describe('production', () => {
    beforeEach(() => { process.env.NODE_ENV = 'production'; });

    it('replaces internal-error message with a generic one + correlation id', async () => {
      const { app, logger } = makeApp();
      const res = await request(app).get('/api/throw_internal');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Internal server error');
      expect(res.body.error).not.toContain('mongo');
      expect(res.body.error).not.toContain('super-secret-host');
      expect(res.body.requestId).toMatch(/^[0-9a-f-]{36}$/);
      // Full message + stack still logged for support
      expect(logger.error).toHaveBeenCalledWith(
        'Unhandled API error',
        expect.objectContaining({ error: expect.stringContaining('mongo connection refused') })
      );
    });

    it('still surfaces APIError messages (operational, safe)', async () => {
      const { app } = makeApp();
      const res = await request(app).get('/api/throw_operational');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Plan not found');
    });

    it('still surfaces plain 4xx errors (client-error semantics)', async () => {
      const { app } = makeApp();
      const res = await request(app).get('/api/throw_4xx_plain');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid email');
    });
  });

  describe('correlation id', () => {
    it('honours an inbound X-Request-Id', async () => {
      const { app } = makeApp();
      const inbound = 'caller-supplied-id-12345';
      const res = await request(app)
        .get('/api/throw_operational')
        .set('X-Request-Id', inbound);
      expect(res.body.requestId).toBe(inbound);
      expect(res.headers['x-request-id']).toBe(inbound);
    });

    it('rejects oversized inbound ids and generates one instead', async () => {
      const { app } = makeApp();
      const huge = 'x'.repeat(200);
      const res = await request(app)
        .get('/api/throw_operational')
        .set('X-Request-Id', huge);
      expect(res.body.requestId).not.toBe(huge);
      expect(res.body.requestId).toMatch(/^[0-9a-f-]{36}$/);
    });
  });
});

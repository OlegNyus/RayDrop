// @vitest-environment node
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../server/src/app.js';

describe('Express app routing', () => {
  describe('TC-App-U001 — API routes are not caught by SPA catch-all', () => {
    it('GET /api/health returns JSON with status ok', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('timestamp');
    });

    it('GET /api/nonexistent returns 404, not 200', async () => {
      const res = await request(app).get('/api/nonexistent');
      expect(res.status).toBe(404);
    });

    it('GET /api/config returns JSON content-type', async () => {
      const res = await request(app).get('/api/config');
      expect(res.headers['content-type']).toMatch(/json/);
    });
  });

  describe('TC-App-U002 — SPA catch-all regex excludes /api paths', () => {
    const spaRegex = /^\/(?!api\/).*/;

    it('matches non-API paths', () => {
      expect(spaRegex.test('/')).toBe(true);
      expect(spaRegex.test('/settings')).toBe(true);
      expect(spaRegex.test('/dashboard')).toBe(true);
      expect(spaRegex.test('/some/deep/route')).toBe(true);
    });

    it('does not match /api/ paths', () => {
      expect(spaRegex.test('/api/health')).toBe(false);
      expect(spaRegex.test('/api/config')).toBe(false);
      expect(spaRegex.test('/api/xray/tests')).toBe(false);
    });
  });
});

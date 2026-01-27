import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import the Express app
import app from '../../server/src/app';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, '../../config/xray-config.json');
const CONFIG_BACKUP_PATH = path.join(__dirname, '../../config/xray-config.backup.json');

describe('Config API', () => {
  // Backup and restore config around tests
  beforeAll(() => {
    if (fs.existsSync(CONFIG_PATH)) {
      fs.copyFileSync(CONFIG_PATH, CONFIG_BACKUP_PATH);
    }
  });

  afterAll(() => {
    if (fs.existsSync(CONFIG_BACKUP_PATH)) {
      fs.copyFileSync(CONFIG_BACKUP_PATH, CONFIG_PATH);
      fs.unlinkSync(CONFIG_BACKUP_PATH);
    } else if (fs.existsSync(CONFIG_PATH)) {
      fs.unlinkSync(CONFIG_PATH);
    }
  });

  beforeEach(() => {
    // Clear config before each test
    if (fs.existsSync(CONFIG_PATH)) {
      fs.unlinkSync(CONFIG_PATH);
    }
  });

  // ============================================
  // GET /api/config
  // ============================================
  describe('GET /api/config', () => {
    it('returns configured: false when no config file exists', async () => {
      const response = await request(app).get('/api/config');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ configured: false });
    });

    it('returns configured: false when config file is empty object', async () => {
      fs.writeFileSync(CONFIG_PATH, '{}');

      const response = await request(app).get('/api/config');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ configured: false });
    });

    it('returns configured: false when credentials are missing', async () => {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify({
        jiraBaseUrl: 'https://company.atlassian.net/',
      }));

      const response = await request(app).get('/api/config');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ configured: false });
    });

    it('returns configured: true with valid config', async () => {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify({
        xrayClientId: 'client-id',
        xrayClientSecret: 'client-secret',
        jiraBaseUrl: 'https://company.atlassian.net/',
      }));

      const response = await request(app).get('/api/config');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        configured: true,
        jiraBaseUrl: 'https://company.atlassian.net/',
        hasCredentials: true,
      });
    });

    it('does not expose credentials in response', async () => {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify({
        xrayClientId: 'secret-client-id',
        xrayClientSecret: 'super-secret',
        jiraBaseUrl: 'https://company.atlassian.net/',
      }));

      const response = await request(app).get('/api/config');

      expect(response.body.xrayClientId).toBeUndefined();
      expect(response.body.xrayClientSecret).toBeUndefined();
      expect(JSON.stringify(response.body)).not.toContain('secret-client-id');
      expect(JSON.stringify(response.body)).not.toContain('super-secret');
    });
  });

  // ============================================
  // POST /api/config - Validation
  // ============================================
  describe('POST /api/config - Validation', () => {
    it('returns 400 when xrayClientId is missing', async () => {
      const response = await request(app)
        .post('/api/config')
        .send({
          xrayClientSecret: 'secret',
          jiraBaseUrl: 'https://company.atlassian.net/',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('xrayClientId');
    });

    it('returns 400 when xrayClientId is empty string', async () => {
      const response = await request(app)
        .post('/api/config')
        .send({
          xrayClientId: '',
          xrayClientSecret: 'secret',
          jiraBaseUrl: 'https://company.atlassian.net/',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('xrayClientId');
    });

    it('returns 400 when xrayClientId is whitespace only', async () => {
      const response = await request(app)
        .post('/api/config')
        .send({
          xrayClientId: '   ',
          xrayClientSecret: 'secret',
          jiraBaseUrl: 'https://company.atlassian.net/',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('xrayClientId');
    });

    it('returns 400 when xrayClientSecret is missing', async () => {
      const response = await request(app)
        .post('/api/config')
        .send({
          xrayClientId: 'client-id',
          jiraBaseUrl: 'https://company.atlassian.net/',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('xrayClientSecret');
    });

    it('returns 400 when jiraBaseUrl is missing', async () => {
      const response = await request(app)
        .post('/api/config')
        .send({
          xrayClientId: 'client-id',
          xrayClientSecret: 'secret',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('jiraBaseUrl');
    });

    it('returns 400 when jiraBaseUrl is invalid', async () => {
      const response = await request(app)
        .post('/api/config')
        .send({
          xrayClientId: 'client-id',
          xrayClientSecret: 'secret',
          jiraBaseUrl: 'not-a-valid-url',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('valid URL');
    });
  });

  // ============================================
  // POST /api/config/test-connection - Validation
  // ============================================
  describe('POST /api/config/test-connection - Validation', () => {
    it('returns 400 when xrayClientId is missing', async () => {
      const response = await request(app)
        .post('/api/config/test-connection')
        .send({
          xrayClientSecret: 'secret',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Client ID');
    });

    it('returns 400 when xrayClientSecret is missing', async () => {
      const response = await request(app)
        .post('/api/config/test-connection')
        .send({
          xrayClientId: 'client-id',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Client Secret');
    });
  });

  // ============================================
  // DELETE /api/config
  // ============================================
  describe('DELETE /api/config', () => {
    it('returns success when config exists', async () => {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify({ test: true }));

      const response = await request(app).delete('/api/config');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(fs.existsSync(CONFIG_PATH)).toBe(false);
    });

    it('returns success when config does not exist', async () => {
      const response = await request(app).delete('/api/config');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});

// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import app from '../../server/src/app.js';
import { SNAPSHOTS_DIR, saveSnapshot } from '../../server/src/utils/fileOperations';
import type { CoverageTestCase } from '../../server/src/utils/fileOperations';

const TEST_PROJECT = '__ROUTE_TEST__';
const TEST_PROJECT_DIR = path.join(SNAPSHOTS_DIR, TEST_PROJECT);

function makeTestCase(overrides: Partial<CoverageTestCase> = {}): CoverageTestCase {
  return {
    key: 'WCP-100',
    issueId: '12345',
    folderPath: '/WCP/UI/Feature/Login',
    summary: 'Login with valid credentials',
    description: 'Test description',
    testType: 'Manual',
    priority: 'High',
    automation_status: 'Manual',
    labels: ['LOGIN'],
    steps: [{ action: 'Enter email', data: 'user@test.com', result: 'Email entered' }],
    ...overrides,
  };
}

describe('Coverage API Routes', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_PROJECT_DIR)) {
      fs.rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(TEST_PROJECT_DIR)) {
      fs.rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
    }
  });

  // ---- POST /api/xray/coverage/sync ----

  describe('POST /api/xray/coverage/sync', () => {
    it('AC-COV-063: returns 400 when projectId is missing', async () => {
      const res = await request(app)
        .post('/api/xray/coverage/sync')
        .send({ folderPath: '/WCP/UI', projectKey: 'WCP' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/projectId.*required/i);
    });

    it('AC-COV-063: returns 400 when folderPath is missing', async () => {
      const res = await request(app)
        .post('/api/xray/coverage/sync')
        .send({ projectId: '12345', projectKey: 'WCP' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/folderPath.*required/i);
    });

    it('AC-COV-063: returns 400 when projectKey is missing', async () => {
      const res = await request(app)
        .post('/api/xray/coverage/sync')
        .send({ projectId: '12345', folderPath: '/WCP/UI' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/projectKey.*required/i);
    });
  });

  // ---- GET /api/xray/coverage/snapshot ----

  describe('GET /api/xray/coverage/snapshot', () => {
    it('AC-COV-065: returns stored snapshot for a synced folder', async () => {
      const testCases = [makeTestCase(), makeTestCase({ key: 'WCP-101' })];
      saveSnapshot(TEST_PROJECT, '/WCP/UI/Feature/Login', testCases);

      const res = await request(app)
        .get('/api/xray/coverage/snapshot')
        .query({ projectKey: TEST_PROJECT, folderPath: '/WCP/UI/Feature/Login' });

      expect(res.status).toBe(200);
      expect(res.body.tests).toHaveLength(2);
      expect(res.body.metadata.testCount).toBe(2);
      expect(res.body.metadata.folderPath).toBe('/WCP/UI/Feature/Login');
    });

    it('AC-COV-066: returns null for non-synced folder', async () => {
      const res = await request(app)
        .get('/api/xray/coverage/snapshot')
        .query({ projectKey: TEST_PROJECT, folderPath: '/nonexistent' });

      expect(res.status).toBe(200);
      expect(res.body).toBeNull();
    });

    it('returns 400 when projectKey is missing', async () => {
      const res = await request(app)
        .get('/api/xray/coverage/snapshot')
        .query({ folderPath: '/WCP/UI' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when folderPath is missing', async () => {
      const res = await request(app)
        .get('/api/xray/coverage/snapshot')
        .query({ projectKey: TEST_PROJECT });

      expect(res.status).toBe(400);
    });
  });

  // ---- GET /api/xray/coverage/snapshots ----

  describe('GET /api/xray/coverage/snapshots', () => {
    it('AC-COV-067: returns metadata for all synced folders', async () => {
      saveSnapshot(TEST_PROJECT, '/WCP/UI/Feature/Login', [makeTestCase()]);
      saveSnapshot(TEST_PROJECT, '/WCP/UI/Feature/Signup', [makeTestCase({ key: 'WCP-200' }), makeTestCase({ key: 'WCP-201' })]);

      const res = await request(app)
        .get('/api/xray/coverage/snapshots')
        .query({ projectKey: TEST_PROJECT });

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);

      const login = res.body.find((s: { folderPath: string }) => s.folderPath === '/WCP/UI/Feature/Login');
      const signup = res.body.find((s: { folderPath: string }) => s.folderPath === '/WCP/UI/Feature/Signup');
      expect(login.testCount).toBe(1);
      expect(signup.testCount).toBe(2);
    });

    it('AC-COV-068: returns empty array when no snapshots exist', async () => {
      const res = await request(app)
        .get('/api/xray/coverage/snapshots')
        .query({ projectKey: TEST_PROJECT });

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns 400 when projectKey is missing', async () => {
      const res = await request(app)
        .get('/api/xray/coverage/snapshots');

      expect(res.status).toBe(400);
    });
  });

  // ---- GET /api/xray/coverage/export ----

  describe('GET /api/xray/coverage/export', () => {
    it('AC-COV-069: returns single folder when folderPath provided', async () => {
      saveSnapshot(TEST_PROJECT, '/WCP/UI/Feature/Login', [makeTestCase({ key: 'WCP-100' })]);
      saveSnapshot(TEST_PROJECT, '/WCP/UI/Feature/Signup', [makeTestCase({ key: 'WCP-200' })]);

      const res = await request(app)
        .get('/api/xray/coverage/export')
        .query({ projectKey: TEST_PROJECT, folderPath: '/WCP/UI/Feature/Login' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].key).toBe('WCP-100');
    });

    it('AC-COV-070: returns flat array of all synced folders without folderPath', async () => {
      saveSnapshot(TEST_PROJECT, '/WCP/UI/Feature/Login', [makeTestCase({ key: 'WCP-100', folderPath: '/WCP/UI/Feature/Login' })]);
      saveSnapshot(TEST_PROJECT, '/WCP/UI/Feature/Signup', [makeTestCase({ key: 'WCP-200', folderPath: '/WCP/UI/Feature/Signup' })]);

      const res = await request(app)
        .get('/api/xray/coverage/export')
        .query({ projectKey: TEST_PROJECT });

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      const keys = res.body.map((t: { key: string }) => t.key).sort();
      expect(keys).toEqual(['WCP-100', 'WCP-200']);
    });

    it('AC-COV-071: returns empty array when no snapshots exist', async () => {
      const res = await request(app)
        .get('/api/xray/coverage/export')
        .query({ projectKey: TEST_PROJECT });

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns 400 when projectKey is missing', async () => {
      const res = await request(app)
        .get('/api/xray/coverage/export');

      expect(res.status).toBe(400);
    });
  });
});

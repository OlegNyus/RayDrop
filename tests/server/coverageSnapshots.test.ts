// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  slugifyFolderPath,
  saveSnapshot,
  loadSnapshot,
  listSnapshotStatuses,
  loadAllSnapshotTests,
  SNAPSHOTS_DIR,
} from '../../server/src/utils/fileOperations';
import type { CoverageTestCase } from '../../server/src/utils/fileOperations';

const TEST_PROJECT = '__TEST_COV__';
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

describe('Coverage Snapshots', () => {
  beforeEach(() => {
    // Clean up test project dir
    if (fs.existsSync(TEST_PROJECT_DIR)) {
      fs.rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(TEST_PROJECT_DIR)) {
      fs.rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
    }
  });

  describe('slugifyFolderPath', () => {
    it('AC-COV-064: converts folder path to slug', () => {
      expect(slugifyFolderPath('/WCP/UI/Feature/Login')).toBe('wcp-ui-feature-login');
    });

    it('handles leading slash removal', () => {
      expect(slugifyFolderPath('/Root/Child')).toBe('root-child');
    });

    it('handles special characters', () => {
      expect(slugifyFolderPath('/Help (support)')).toBe('helpsupport');
    });

    it('handles empty path', () => {
      expect(slugifyFolderPath('')).toBe('root');
    });

    it('collapses multiple hyphens', () => {
      expect(slugifyFolderPath('/A//B///C')).toBe('a-b-c');
    });
  });

  describe('saveSnapshot + loadSnapshot', () => {
    it('AC-COV-060/061: saves tests.json and metadata.json to correct path', () => {
      const testCases = [makeTestCase()];
      const metadata = saveSnapshot(TEST_PROJECT, '/WCP/UI/Feature/Login', testCases);

      expect(metadata.folderPath).toBe('/WCP/UI/Feature/Login');
      expect(metadata.testCount).toBe(1);
      expect(metadata.lastSyncedAt).toBeTruthy();

      const slugDir = path.join(TEST_PROJECT_DIR, 'wcp-ui-feature-login');
      expect(fs.existsSync(path.join(slugDir, 'tests.json'))).toBe(true);
      expect(fs.existsSync(path.join(slugDir, 'metadata.json'))).toBe(true);
    });

    it('AC-COV-013: loads stored snapshot correctly', () => {
      const testCases = [makeTestCase(), makeTestCase({ key: 'WCP-101', summary: 'Second test' })];
      saveSnapshot(TEST_PROJECT, '/WCP/UI/Feature/Login', testCases);

      const snapshot = loadSnapshot(TEST_PROJECT, '/WCP/UI/Feature/Login');
      expect(snapshot).not.toBeNull();
      expect(snapshot!.tests).toHaveLength(2);
      expect(snapshot!.tests[0].key).toBe('WCP-100');
      expect(snapshot!.tests[1].key).toBe('WCP-101');
      expect(snapshot!.metadata.testCount).toBe(2);
      expect(snapshot!.metadata.folderPath).toBe('/WCP/UI/Feature/Login');
    });

    it('returns null for non-existent snapshot', () => {
      const snapshot = loadSnapshot(TEST_PROJECT, '/nonexistent/path');
      expect(snapshot).toBeNull();
    });

    it('AC-COV-014: stored JSON follows Sarah-compatible format', () => {
      const tc = makeTestCase({
        automation_status: 'Planned for Automation',
        labels: ['LOGIN', 'SECURITY'],
        steps: [
          { action: 'Step 1', data: 'Data 1', result: 'Result 1' },
          { action: 'Step 2', data: '', result: 'Result 2' },
        ],
      });
      saveSnapshot(TEST_PROJECT, '/WCP/UI/Feature/Login', [tc]);

      const slugDir = path.join(TEST_PROJECT_DIR, 'wcp-ui-feature-login');
      const stored = JSON.parse(fs.readFileSync(path.join(slugDir, 'tests.json'), 'utf8'));

      expect(stored[0]).toHaveProperty('key');
      expect(stored[0]).toHaveProperty('issueId');
      expect(stored[0]).toHaveProperty('folderPath');
      expect(stored[0]).toHaveProperty('summary');
      expect(stored[0]).toHaveProperty('description');
      expect(stored[0]).toHaveProperty('testType');
      expect(stored[0]).toHaveProperty('priority');
      expect(stored[0]).toHaveProperty('automation_status'); // snake_case
      expect(stored[0]).toHaveProperty('labels');
      expect(stored[0]).toHaveProperty('steps');
      expect(stored[0].steps[0]).not.toHaveProperty('id'); // no step id in Sarah format
      expect(stored[0].automation_status).toBe('Planned for Automation');
    });

    it('overwrites previous snapshot on re-sync', () => {
      saveSnapshot(TEST_PROJECT, '/WCP/UI/Feature/Login', [makeTestCase()]);
      const first = loadSnapshot(TEST_PROJECT, '/WCP/UI/Feature/Login');
      expect(first!.tests).toHaveLength(1);

      saveSnapshot(TEST_PROJECT, '/WCP/UI/Feature/Login', [makeTestCase(), makeTestCase({ key: 'WCP-102' })]);
      const second = loadSnapshot(TEST_PROJECT, '/WCP/UI/Feature/Login');
      expect(second!.tests).toHaveLength(2);
    });

    it('handles empty folder sync (0 test cases)', () => {
      const metadata = saveSnapshot(TEST_PROJECT, '/WCP/UI/Feature/Empty', []);
      expect(metadata.testCount).toBe(0);

      const snapshot = loadSnapshot(TEST_PROJECT, '/WCP/UI/Feature/Empty');
      expect(snapshot!.tests).toHaveLength(0);
      expect(snapshot!.metadata.testCount).toBe(0);
    });
  });

  describe('listSnapshotStatuses', () => {
    it('AC-COV-067: returns metadata for all synced folders', () => {
      saveSnapshot(TEST_PROJECT, '/WCP/UI/Feature/Login', [makeTestCase()]);
      saveSnapshot(TEST_PROJECT, '/WCP/UI/Feature/Signup', [makeTestCase(), makeTestCase({ key: 'WCP-200' })]);

      const statuses = listSnapshotStatuses(TEST_PROJECT);
      expect(statuses).toHaveLength(2);

      const loginStatus = statuses.find(s => s.folderPath === '/WCP/UI/Feature/Login');
      const signupStatus = statuses.find(s => s.folderPath === '/WCP/UI/Feature/Signup');
      expect(loginStatus).toBeTruthy();
      expect(loginStatus!.testCount).toBe(1);
      expect(signupStatus).toBeTruthy();
      expect(signupStatus!.testCount).toBe(2);
    });

    it('AC-COV-068: returns empty array when no snapshots exist', () => {
      const statuses = listSnapshotStatuses(TEST_PROJECT);
      expect(statuses).toEqual([]);
    });
  });

  describe('loadAllSnapshotTests', () => {
    it('AC-COV-070: returns flat array of all synced folders', () => {
      saveSnapshot(TEST_PROJECT, '/WCP/UI/Feature/Login', [
        makeTestCase({ key: 'WCP-100', folderPath: '/WCP/UI/Feature/Login' }),
      ]);
      saveSnapshot(TEST_PROJECT, '/WCP/UI/Feature/Signup', [
        makeTestCase({ key: 'WCP-200', folderPath: '/WCP/UI/Feature/Signup' }),
        makeTestCase({ key: 'WCP-201', folderPath: '/WCP/UI/Feature/Signup' }),
      ]);

      const all = loadAllSnapshotTests(TEST_PROJECT);
      expect(all).toHaveLength(3);
      expect(all.map(t => t.key).sort()).toEqual(['WCP-100', 'WCP-200', 'WCP-201']);
    });

    it('AC-COV-069: returns single folder when folderPath provided', () => {
      saveSnapshot(TEST_PROJECT, '/WCP/UI/Feature/Login', [makeTestCase({ key: 'WCP-100' })]);
      saveSnapshot(TEST_PROJECT, '/WCP/UI/Feature/Signup', [makeTestCase({ key: 'WCP-200' })]);

      const login = loadAllSnapshotTests(TEST_PROJECT, '/WCP/UI/Feature/Login');
      expect(login).toHaveLength(1);
      expect(login[0].key).toBe('WCP-100');
    });

    it('AC-COV-071: returns empty array when no snapshots exist', () => {
      const tests = loadAllSnapshotTests(TEST_PROJECT);
      expect(tests).toEqual([]);
    });
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { configApi, settingsApi, draftsApi, labelsApi, functionalAreasApi, xrayApi, fetchLabels, fetchFunctionalAreas, saveLabels, saveFunctionalAreas } from '../../client/src/services/api';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('API Service', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('configApi', () => {
    describe('get', () => {
      it('fetches config successfully', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ configured: true, jiraBaseUrl: 'https://test.atlassian.net/' }),
        });

        const result = await configApi.get();

        expect(mockFetch).toHaveBeenCalledWith('/api/config', expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
        }));
        expect(result).toEqual({ configured: true, jiraBaseUrl: 'https://test.atlassian.net/' });
      });

      it('throws error on failure', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: 'Not found' }),
        });

        await expect(configApi.get()).rejects.toThrow('Not found');
      });

      it('handles JSON parse error', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          json: () => Promise.reject(new Error('Parse error')),
        });

        await expect(configApi.get()).rejects.toThrow('Request failed');
      });
    });

    describe('save', () => {
      it('saves config successfully', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

        const config = {
          xrayClientId: 'test-id',
          xrayClientSecret: 'test-secret',
          jiraSubdomain: 'company',
        };

        const result = await configApi.save(config);

        expect(mockFetch).toHaveBeenCalledWith('/api/config', expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(config),
        }));
        expect(result).toEqual({ success: true });
      });
    });

    describe('delete', () => {
      it('deletes config successfully', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

        const result = await configApi.delete();

        expect(mockFetch).toHaveBeenCalledWith('/api/config', expect.objectContaining({
          method: 'DELETE',
        }));
        expect(result).toEqual({ success: true });
      });
    });

    describe('test', () => {
      it('tests connection successfully', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

        const result = await configApi.test();

        expect(mockFetch).toHaveBeenCalledWith('/api/config/test', expect.any(Object));
        expect(result).toEqual({ success: true });
      });
    });

    describe('testConnection', () => {
      it('tests credentials successfully', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

        const credentials = { xrayClientId: 'id', xrayClientSecret: 'secret' };
        const result = await configApi.testConnection(credentials);

        expect(mockFetch).toHaveBeenCalledWith('/api/config/test-connection', expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(credentials),
        }));
        expect(result).toEqual({ success: true });
      });

      it('throws error on invalid credentials', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: 'Invalid credentials' }),
        });

        await expect(configApi.testConnection({ xrayClientId: 'bad', xrayClientSecret: 'bad' }))
          .rejects.toThrow('Invalid credentials');
      });
    });
  });

  describe('settingsApi', () => {
    describe('get', () => {
      it('fetches settings successfully', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ projects: [], activeProject: null }),
        });

        const result = await settingsApi.get();

        expect(result).toEqual({ projects: [], activeProject: null });
      });
    });

    describe('update', () => {
      it('updates settings successfully', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, settings: {} }),
        });

        const settings = { projects: ['TEST'], activeProject: 'TEST', hiddenProjects: [], projectSettings: {} };
        await settingsApi.update(settings);

        expect(mockFetch).toHaveBeenCalledWith('/api/settings', expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(settings),
        }));
      });
    });

    describe('addProject', () => {
      it('adds project with color', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

        await settingsApi.addProject('TEST', '#FF0000');

        expect(mockFetch).toHaveBeenCalledWith('/api/settings/projects', expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ projectKey: 'TEST', color: '#FF0000' }),
        }));
      });
    });

    describe('hideProject', () => {
      it('hides project', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

        await settingsApi.hideProject('TEST');

        expect(mockFetch).toHaveBeenCalledWith('/api/settings/projects/TEST/hide', expect.objectContaining({
          method: 'POST',
        }));
      });
    });

    describe('unhideProject', () => {
      it('unhides project', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

        await settingsApi.unhideProject('TEST');

        expect(mockFetch).toHaveBeenCalledWith('/api/settings/projects/TEST/unhide', expect.objectContaining({
          method: 'POST',
        }));
      });
    });

    describe('removeProject', () => {
      it('removes project', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

        await settingsApi.removeProject('TEST');

        expect(mockFetch).toHaveBeenCalledWith('/api/settings/projects/TEST', expect.objectContaining({
          method: 'DELETE',
        }));
      });
    });

    describe('setActiveProject', () => {
      it('sets active project', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

        await settingsApi.setActiveProject('TEST');

        expect(mockFetch).toHaveBeenCalledWith('/api/settings/active-project', expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ projectKey: 'TEST' }),
        }));
      });
    });

    describe('getProjectSettings', () => {
      it('fetches project settings', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ defaultFolder: '/Test' }),
        });

        const result = await settingsApi.getProjectSettings('TEST');

        expect(mockFetch).toHaveBeenCalledWith('/api/settings/projects/TEST', expect.any(Object));
        expect(result).toEqual({ defaultFolder: '/Test' });
      });
    });

    describe('updateProjectSettings', () => {
      it('updates project settings', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

        const settings = { defaultFolder: '/Test', defaultLabels: [] };
        await settingsApi.updateProjectSettings('TEST', settings);

        expect(mockFetch).toHaveBeenCalledWith('/api/settings/projects/TEST', expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(settings),
        }));
      });
    });
  });

  describe('draftsApi', () => {
    describe('list', () => {
      it('fetches all drafts', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ id: '1', summary: 'Test' }]),
        });

        const result = await draftsApi.list();

        expect(mockFetch).toHaveBeenCalledWith('/api/drafts', expect.any(Object));
        expect(result).toHaveLength(1);
      });

      it('fetches drafts by project', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });

        await draftsApi.list('TEST');

        expect(mockFetch).toHaveBeenCalledWith('/api/drafts?project=TEST', expect.any(Object));
      });
    });

    describe('get', () => {
      it('fetches draft by id', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: '1', summary: 'Test' }),
        });

        const result = await draftsApi.get('1');

        expect(mockFetch).toHaveBeenCalledWith('/api/drafts/1', expect.any(Object));
        expect(result.id).toBe('1');
      });
    });

    describe('create', () => {
      it('creates a draft', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, draft: { id: '1' } }),
        });

        const draft = { id: '1', summary: 'Test', steps: [], projectKey: 'TEST', labels: [], status: 'draft' as const, createdAt: '', updatedAt: '' };
        await draftsApi.create(draft);

        expect(mockFetch).toHaveBeenCalledWith('/api/drafts', expect.objectContaining({
          method: 'POST',
        }));
      });
    });

    describe('update', () => {
      it('updates a draft', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, draft: { id: '1' } }),
        });

        const draft = { id: '1', summary: 'Updated', steps: [], projectKey: 'TEST', labels: [], status: 'draft' as const, createdAt: '', updatedAt: '' };
        await draftsApi.update('1', draft);

        expect(mockFetch).toHaveBeenCalledWith('/api/drafts/1', expect.objectContaining({
          method: 'PUT',
        }));
      });
    });

    describe('delete', () => {
      it('deletes a draft', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

        await draftsApi.delete('1');

        expect(mockFetch).toHaveBeenCalledWith('/api/drafts/1', expect.objectContaining({
          method: 'DELETE',
        }));
      });
    });

    describe('deleteAll', () => {
      it('deletes all drafts', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

        await draftsApi.deleteAll();

        expect(mockFetch).toHaveBeenCalledWith('/api/drafts', expect.objectContaining({
          method: 'DELETE',
        }));
      });
    });
  });

  describe('labelsApi', () => {
    it('fetches labels', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, labels: ['smoke', 'regression'] }),
      });

      const result = await labelsApi.get();

      expect(result.labels).toEqual(['smoke', 'regression']);
    });

    it('saves labels', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await labelsApi.save(['smoke', 'regression']);

      expect(mockFetch).toHaveBeenCalledWith('/api/settings/labels', expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ labels: ['smoke', 'regression'] }),
      }));
    });
  });

  describe('functionalAreasApi', () => {
    it('fetches functional areas', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, areas: ['Auth', 'Cart'] }),
      });

      const result = await functionalAreasApi.get();

      expect(result.areas).toEqual(['Auth', 'Cart']);
    });

    it('saves functional areas', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await functionalAreasApi.save(['Auth', 'Cart']);

      expect(mockFetch).toHaveBeenCalledWith('/api/settings/functional-areas', expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ areas: ['Auth', 'Cart'] }),
      }));
    });
  });

  describe('helper functions', () => {
    describe('fetchLabels', () => {
      it('returns labels on success', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, labels: ['smoke'] }),
        });

        const result = await fetchLabels();

        expect(result.labels).toEqual(['smoke']);
      });

      it('returns empty on error', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: 'Failed' }),
        });

        const result = await fetchLabels();

        expect(result).toEqual({ success: false, labels: [] });
      });
    });

    describe('fetchFunctionalAreas', () => {
      it('returns areas on success', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, areas: ['Auth'] }),
        });

        const result = await fetchFunctionalAreas();

        expect(result.areas).toEqual(['Auth']);
      });

      it('returns empty on error', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: 'Failed' }),
        });

        const result = await fetchFunctionalAreas();

        expect(result).toEqual({ success: false, areas: [] });
      });
    });

    describe('saveLabels', () => {
      it('saves labels', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

        const result = await saveLabels(['smoke']);

        expect(result).toEqual({ success: true });
      });
    });

    describe('saveFunctionalAreas', () => {
      it('saves areas', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

        const result = await saveFunctionalAreas(['Auth']);

        expect(result).toEqual({ success: true });
      });
    });
  });

  describe('xrayApi', () => {
    describe('import', () => {
      it('imports drafts', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, imported: [] }),
        });

        await xrayApi.import(['1', '2'], 'TEST');

        expect(mockFetch).toHaveBeenCalledWith('/api/xray/import', expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ draftIds: ['1', '2'], projectKey: 'TEST' }),
        }));
      });
    });

    describe('getTestPlans', () => {
      it('fetches test plans', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ key: 'TEST-1' }]),
        });

        const result = await xrayApi.getTestPlans('TEST');

        expect(mockFetch).toHaveBeenCalledWith('/api/xray/test-plans/TEST', expect.any(Object));
        expect(result).toHaveLength(1);
      });
    });

    describe('getTestExecutions', () => {
      it('fetches test executions', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });

        await xrayApi.getTestExecutions('TEST');

        expect(mockFetch).toHaveBeenCalledWith('/api/xray/test-executions/TEST', expect.any(Object));
      });
    });

    describe('getTestSets', () => {
      it('fetches test sets', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });

        await xrayApi.getTestSets('TEST');

        expect(mockFetch).toHaveBeenCalledWith('/api/xray/test-sets/TEST', expect.any(Object));
      });
    });

    describe('getPreconditions', () => {
      it('fetches preconditions', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });

        await xrayApi.getPreconditions('TEST');

        expect(mockFetch).toHaveBeenCalledWith('/api/xray/preconditions/TEST', expect.any(Object));
      });
    });

    describe('getProjectId', () => {
      it('fetches project id', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ projectId: '12345' }),
        });

        const result = await xrayApi.getProjectId('TEST');

        expect(result.projectId).toBe('12345');
      });
    });

    describe('getFolders', () => {
      it('fetches folders', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ name: 'root', path: '/', folders: [] }),
        });

        await xrayApi.getFolders('12345', '/');

        expect(mockFetch).toHaveBeenCalledWith('/api/xray/folders/12345?path=%2F', expect.any(Object));
      });
    });

    describe('getTestsByStatus', () => {
      it('fetches tests by status', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ key: 'TEST-1', status: 'Under Review' }]),
        });

        const result = await xrayApi.getTestsByStatus('TEST', 'Under Review');

        expect(mockFetch).toHaveBeenCalledWith(
          '/api/xray/tests/by-status/TEST?status=Under%20Review',
          expect.any(Object)
        );
        expect(result).toHaveLength(1);
      });
    });

    describe('getAllFolders', () => {
      it('flattens nested folder structure and returns projectId', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ projectId: '12345' }),
        });
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            name: 'root',
            path: '/',
            folders: [
              { name: 'Auth', path: '/Auth', folders: [
                { name: 'Login', path: '/Auth/Login', folders: [] }
              ]},
              { name: 'Cart', path: '/Cart', folders: [] }
            ]
          }),
        });

        const result = await xrayApi.getAllFolders('TEST');

        expect(result.projectId).toBe('12345');
        expect(result.folders).toHaveLength(3);
        expect(result.folders).toContainEqual({ path: '/Auth', name: 'Auth' });
        expect(result.folders).toContainEqual({ path: '/Auth/Login', name: 'Login' });
        expect(result.folders).toContainEqual({ path: '/Cart', name: 'Cart' });
      });

      it('returns empty folders and projectId on error', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: 'Failed' }),
        });

        const result = await xrayApi.getAllFolders('TEST');

        expect(result).toEqual({ folders: [], projectId: '' });
      });
    });
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, renderWithRouter, fireEvent } from '../helpers/render';
import { CoveragePage } from '../../client/src/components/features/coverage/CoveragePage';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';

// MSW handlers for configured app with active project
function setupConfiguredHandlers() {
  server.use(
    http.get('*/api/config', () => {
      return HttpResponse.json({
        configured: true,
        jiraBaseUrl: 'https://test.atlassian.net/',
        hasCredentials: true,
      });
    }),
    http.get('*/api/settings', () => {
      return HttpResponse.json({
        projects: ['WCP'],
        hiddenProjects: [],
        activeProject: 'WCP',
        projectSettings: {
          WCP: { color: '#3B82F6', functionalAreas: [], labels: [], collections: [], reusablePrefix: 'REUSE' },
        },
      });
    }),
    http.get('*/api/drafts', () => {
      return HttpResponse.json([]);
    }),
    http.get('*/api/xray/tests/by-status/*', () => {
      return HttpResponse.json([]);
    }),
    http.get('*/api/xray/project-id/WCP', () => {
      return HttpResponse.json({ projectId: 'proj-123' });
    }),
    http.get('*/api/xray/folders/*', () => {
      return HttpResponse.json({
        name: 'Test Repository',
        path: '/',
        testsCount: 50,
        folders: [
          {
            name: 'WCP',
            path: '/WCP',
            testsCount: 0,
            folders: [
              {
                name: 'Login',
                path: '/WCP/Login',
                testsCount: 16,
                folders: [],
              },
              {
                name: 'Signup',
                path: '/WCP/Signup',
                testsCount: 8,
                folders: [],
              },
            ],
          },
        ],
      });
    }),
    http.get('*/api/xray/coverage/snapshots', () => {
      return HttpResponse.json([]);
    }),
  );
}

function setupConfiguredWithSyncedFolder() {
  setupConfiguredHandlers();
  server.use(
    http.get('*/api/xray/coverage/snapshots', () => {
      return HttpResponse.json([
        { folderPath: '/WCP/Login', lastSyncedAt: '2026-03-24T14:30:00Z', testCount: 16 },
      ]);
    }),
    http.get('*/api/xray/coverage/snapshot', () => {
      return HttpResponse.json({
        tests: [
          {
            key: 'WCP-7074',
            issueId: '12345',
            folderPath: '/WCP/Login',
            summary: 'Login with valid credentials',
            description: '',
            testType: 'Manual',
            priority: 'High',
            automation_status: 'Planned for Automation',
            labels: ['LOGIN'],
            steps: [],
          },
          {
            key: 'WCP-7075',
            issueId: '12346',
            folderPath: '/WCP/Login',
            summary: 'Login with invalid email',
            description: '',
            testType: 'Manual',
            priority: 'Medium',
            automation_status: 'Automated',
            labels: ['LOGIN', 'NEGATIVE'],
            steps: [],
          },
        ],
        metadata: { folderPath: '/WCP/Login', lastSyncedAt: '2026-03-24T14:30:00Z', testCount: 2 },
      });
    }),
  );
}

function setupNoProjectHandlers() {
  server.use(
    http.get('*/api/config', () => {
      return HttpResponse.json({ configured: true, hasCredentials: true });
    }),
    http.get('*/api/settings', () => {
      return HttpResponse.json({
        projects: [],
        hiddenProjects: [],
        activeProject: null,
        projectSettings: {},
      });
    }),
    http.get('*/api/drafts', () => {
      return HttpResponse.json([]);
    }),
    http.get('*/api/xray/tests/by-status/*', () => {
      return HttpResponse.json([]);
    }),
  );
}

describe('CoveragePage', () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  describe('AC-COV-008: No active project', () => {
    it('shows "Select a project" when no active project', async () => {
      setupNoProjectHandlers();
      renderWithRouter(<CoveragePage />);

      await waitFor(() => {
        expect(screen.getByText('Select a project to view coverage')).toBeInTheDocument();
      });
    });
  });

  describe('AC-COV-001/002: Folder tree loads', () => {
    it('shows page container after config loads', async () => {
      setupConfiguredHandlers();
      renderWithRouter(<CoveragePage />);

      await waitFor(() => {
        expect(screen.getByTestId('coverage-page')).toBeInTheDocument();
      });
    });

    it('displays folder tree with hierarchy after loading', async () => {
      setupConfiguredHandlers();
      renderWithRouter(<CoveragePage />);

      await waitFor(() => {
        expect(screen.getByText('WCP')).toBeInTheDocument();
      });

      expect(screen.getByText('Login')).toBeInTheDocument();
      expect(screen.getByText('Signup')).toBeInTheDocument();
    });

    it('AC-COV-005: shows folder count badge', async () => {
      setupConfiguredHandlers();
      renderWithRouter(<CoveragePage />);

      await waitFor(() => {
        // 3 folders total (WCP, Login, Signup)
        expect(screen.getByText('3')).toBeInTheDocument();
      });
    });
  });

  describe('AC-COV-003/004: Sync status indicators', () => {
    it('AC-COV-003: shows "not synced" count when no folders synced', async () => {
      setupConfiguredHandlers();
      renderWithRouter(<CoveragePage />);

      await waitFor(() => {
        expect(screen.getByText(/3 not synced/)).toBeInTheDocument();
      });
    });

    it('AC-COV-004: shows synced count when folders are synced', async () => {
      setupConfiguredWithSyncedFolder();
      renderWithRouter(<CoveragePage />);

      await waitFor(() => {
        expect(screen.getByText(/1 synced/)).toBeInTheDocument();
        expect(screen.getByText(/2 not synced/)).toBeInTheDocument();
      });
    });
  });

  describe('AC-COV-040: No folder selected', () => {
    it('shows "Select a folder" empty state', async () => {
      setupConfiguredHandlers();
      renderWithRouter(<CoveragePage />);

      await waitFor(() => {
        expect(screen.getByText('Select a folder')).toBeInTheDocument();
        expect(screen.getByText('Choose a folder from the tree to view its test cases')).toBeInTheDocument();
      });
    });
  });

  describe('AC-COV-039: Selecting not-synced folder', () => {
    it('shows "Folder not synced" with Sync Now button', async () => {
      setupConfiguredHandlers();
      renderWithRouter(<CoveragePage />);

      await waitFor(() => {
        expect(screen.getByText('Login')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Login'));

      await waitFor(() => {
        expect(screen.getByText('Folder not synced')).toBeInTheDocument();
        expect(screen.getByText('Sync Now')).toBeInTheDocument();
      });
    });
  });

  describe('AC-COV-028/030: Preview table with synced folder', () => {
    it('shows preview table when synced folder is selected', async () => {
      setupConfiguredWithSyncedFolder();
      renderWithRouter(<CoveragePage />);

      await waitFor(() => {
        expect(screen.getByText('Login')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Login'));

      await waitFor(() => {
        expect(screen.getByTestId('coverage-preview-table')).toBeInTheDocument();
      });
    });

    it('AC-COV-030: shows folder name and test count in preview header', async () => {
      setupConfiguredWithSyncedFolder();
      renderWithRouter(<CoveragePage />);

      await waitFor(() => {
        expect(screen.getByText('Login')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Login'));

      await waitFor(() => {
        expect(screen.getByText('2 tests')).toBeInTheDocument();
      });
    });

    it('AC-COV-028: shows test cases in table rows', async () => {
      setupConfiguredWithSyncedFolder();
      renderWithRouter(<CoveragePage />);

      await waitFor(() => {
        expect(screen.getByText('Login')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Login'));

      await waitFor(() => {
        expect(screen.getByTestId('coverage-preview-row-WCP-7074')).toBeInTheDocument();
        expect(screen.getByTestId('coverage-preview-row-WCP-7075')).toBeInTheDocument();
      });

      expect(screen.getByText('Login with valid credentials')).toBeInTheDocument();
      expect(screen.getByText('Login with invalid email')).toBeInTheDocument();
    });

    it('AC-COV-032: shows priority badges', async () => {
      setupConfiguredWithSyncedFolder();
      renderWithRouter(<CoveragePage />);

      await waitFor(() => {
        expect(screen.getByText('Login')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Login'));

      await waitFor(() => {
        expect(screen.getByText('High')).toBeInTheDocument();
        expect(screen.getByText('Medium')).toBeInTheDocument();
      });
    });

    it('AC-COV-033/034: shows automation status badges', async () => {
      setupConfiguredWithSyncedFolder();
      renderWithRouter(<CoveragePage />);

      await waitFor(() => {
        expect(screen.getByText('Login')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Login'));

      await waitFor(() => {
        expect(screen.getByText('Planned for Automation')).toBeInTheDocument();
        expect(screen.getByText('Automated')).toBeInTheDocument();
      });
    });
  });

  describe('AC-COV-042-048: Search functionality', () => {
    it('AC-COV-042: renders search input', async () => {
      setupConfiguredWithSyncedFolder();
      renderWithRouter(<CoveragePage />);

      await waitFor(() => {
        expect(screen.getByText('Login')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Login'));

      await waitFor(() => {
        expect(screen.getByTestId('coverage-preview-search-input')).toBeInTheDocument();
      });
    });

    it('AC-COV-043: filters rows by summary text', async () => {
      setupConfiguredWithSyncedFolder();
      renderWithRouter(<CoveragePage />);

      await waitFor(() => {
        expect(screen.getByText('Login')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Login'));

      await waitFor(() => {
        expect(screen.getByTestId('coverage-preview-search-input')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('coverage-preview-search-input'), {
        target: { value: 'invalid' },
      });

      await waitFor(() => {
        expect(screen.getByText('Login with invalid email')).toBeInTheDocument();
        expect(screen.queryByText('Login with valid credentials')).not.toBeInTheDocument();
      });
    });

    it('AC-COV-045: updates footer count when filtering', async () => {
      setupConfiguredWithSyncedFolder();
      renderWithRouter(<CoveragePage />);

      await waitFor(() => {
        expect(screen.getByText('Login')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Login'));

      await waitFor(() => {
        expect(screen.getByText(/Showing 2 of 2/)).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('coverage-preview-search-input'), {
        target: { value: 'invalid' },
      });

      await waitFor(() => {
        expect(screen.getByText(/Showing 1 of 2 test cases \(filtered\)/)).toBeInTheDocument();
      });
    });

    it('AC-COV-047: shows "No test cases match" when no results', async () => {
      setupConfiguredWithSyncedFolder();
      renderWithRouter(<CoveragePage />);

      await waitFor(() => {
        expect(screen.getByText('Login')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Login'));

      await waitFor(() => {
        expect(screen.getByTestId('coverage-preview-search-input')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('coverage-preview-search-input'), {
        target: { value: 'xyznonexistent' },
      });

      await waitFor(() => {
        expect(screen.getByText('No test cases match your search')).toBeInTheDocument();
      });
    });
  });

  describe('AC-COV-057: Download All button state', () => {
    it('disables Download All when no folders synced', async () => {
      setupConfiguredHandlers();
      renderWithRouter(<CoveragePage />);

      await waitFor(() => {
        expect(screen.getByTestId('coverage-download-all-btn')).toBeInTheDocument();
      });

      expect(screen.getByTestId('coverage-download-all-btn')).toBeDisabled();
    });

    it('AC-COV-058: enables Download All when at least one folder synced', async () => {
      setupConfiguredWithSyncedFolder();
      renderWithRouter(<CoveragePage />);

      // Wait for folder tree to load (indicates snapshots statuses have been fetched)
      await waitFor(() => {
        expect(screen.getByText('Login')).toBeInTheDocument();
      });

      // Wait for synced count to appear (confirms syncMap is populated)
      await waitFor(() => {
        expect(screen.getByText(/1 synced/)).toBeInTheDocument();
      });

      expect(screen.getByTestId('coverage-download-all-btn')).not.toBeDisabled();
    });
  });

  describe('AC-COV-027: Sync All button', () => {
    it('renders Sync All button', async () => {
      setupConfiguredHandlers();
      renderWithRouter(<CoveragePage />);

      await waitFor(() => {
        expect(screen.getByTestId('coverage-sync-all-btn')).toBeInTheDocument();
      });

      expect(screen.getByText('Sync All')).toBeInTheDocument();
    });
  });

  describe('Page header', () => {
    it('renders page title and subtitle', async () => {
      setupConfiguredHandlers();
      renderWithRouter(<CoveragePage />);

      await waitFor(() => {
        expect(screen.getByText('Coverage')).toBeInTheDocument();
        expect(screen.getByText('Sync and export Xray test cases by folder')).toBeInTheDocument();
      });
    });
  });
});

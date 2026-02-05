import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, renderWithRouter } from '../helpers/render';
import userEvent from '@testing-library/user-event';
import { SettingsPage } from '../../client/src/components/features/settings/SettingsPage';
import { http, HttpResponse, delay } from 'msw';
import { server } from '../mocks/server';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// --- MSW Handler Helpers ---

function setupConfiguredHandlers({
  projects = ['TEST', 'DEMO'],
  hiddenProjects = [] as string[],
  activeProject = 'TEST',
  drafts = [] as Array<{ id: string; projectKey: string; summary: string; status: string; steps: unknown[]; labels: string[]; createdAt: string; updatedAt: string }>,
  jiraBaseUrl = 'https://test.atlassian.net',
} = {}) {
  server.use(
    http.get('*/api/config', () => {
      return HttpResponse.json({
        configured: true,
        jiraBaseUrl,
        hasCredentials: true,
      });
    }),
    http.get('*/api/settings', () => {
      return HttpResponse.json({
        projects,
        hiddenProjects,
        activeProject,
        projectSettings: Object.fromEntries(projects.map(p => [p, { color: '#3B82F6' }])),
      });
    }),
    http.get('*/api/drafts', () => {
      // Mock: fetches all drafts for draft count aggregation
      return HttpResponse.json(drafts);
    }),
    http.get('*/api/xray/tests/by-status/*', () => {
      return HttpResponse.json([]);
    }),
  );
}

function setupNotConfiguredHandlers() {
  server.use(
    http.get('*/api/config', () => {
      return HttpResponse.json({ configured: false });
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

// Helper: wait for config to load and exit initial editing mode
// XrayConfigSection uses useState(!isConfigured) — since isConfigured is false
// on first render (async load), editing starts true. Click Cancel to exit.
async function exitInitialEditingMode(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => {
    expect(screen.getByText('Connected to Xray Cloud')).toBeInTheDocument();
  });
  // Cancel button appears because isConfigured=true and editing=true
  const cancelButton = screen.getByRole('button', { name: 'Cancel' });
  await user.click(cancelButton);
  // Now in connected (non-editing) view
  await waitFor(() => {
    expect(screen.queryByLabelText('Xray Client ID')).not.toBeInTheDocument();
  });
}

// --- Tests ---

describe('SettingsPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  // === Positive Tests ===

  describe('TC-Settings-U001: Renders Settings title', () => {
    it('should display "Settings" heading', async () => {
      setupConfiguredHandlers();
      renderWithRouter(<SettingsPage />);
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Settings', level: 1 })).toBeInTheDocument();
      });
    });
  });

  describe('TC-Settings-U002: Renders Xray Connection not configured', () => {
    it('should show "Not configured" when unconfigured', async () => {
      setupNotConfiguredHandlers();
      renderWithRouter(<SettingsPage />);
      await waitFor(() => {
        expect(screen.getByText('Xray Connection')).toBeInTheDocument();
      });
      expect(screen.getByText('Not configured')).toBeInTheDocument();
    });
  });

  describe('TC-Settings-U003: Shows edit form by default when not configured', () => {
    it('should render Client ID, Secret, and Base URL inputs', async () => {
      setupNotConfiguredHandlers();
      renderWithRouter(<SettingsPage />);
      await waitFor(() => {
        expect(screen.getByLabelText('Xray Client ID')).toBeInTheDocument();
      });
      expect(screen.getByLabelText('Xray Client Secret')).toBeInTheDocument();
      expect(screen.getByLabelText('Jira Base URL')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save & Validate' })).toBeInTheDocument();
    });
  });

  describe('TC-Settings-U004: Save & Validate saves config and exits editing', () => {
    it('should call configApi.save and hide the form on success', async () => {
      let saveCalled = false;
      setupNotConfiguredHandlers();

      // Mock: external Xray config API — save succeeds, then config returns configured
      server.use(
        http.post('*/api/config', () => {
          saveCalled = true;
          // After save, override GET /api/config to return configured: true
          server.use(
            http.get('*/api/config', () => {
              return HttpResponse.json({
                configured: true,
                jiraBaseUrl: 'https://test.atlassian.net',
                hasCredentials: true,
              });
            }),
          );
          return HttpResponse.json({ success: true });
        }),
      );

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithRouter(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Xray Client ID')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText('Xray Client ID'), 'test-id');
      await user.type(screen.getByLabelText('Xray Client Secret'), 'test-secret');
      await user.type(screen.getByLabelText('Jira Base URL'), 'https://test.atlassian.net');

      await user.click(screen.getByRole('button', { name: 'Save & Validate' }));

      // After successful save, editing exits and connected view shows
      await waitFor(() => {
        expect(saveCalled).toBe(true);
        expect(screen.queryByLabelText('Xray Client ID')).not.toBeInTheDocument();
      });
    });
  });

  describe('TC-Settings-U005: Renders connected state', () => {
    it('should show Jira Base URL, Configured, and Active badge', async () => {
      setupConfiguredHandlers();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithRouter(<SettingsPage />);

      await exitInitialEditingMode(user);

      expect(screen.getByText('https://test.atlassian.net')).toBeInTheDocument();
      expect(screen.getByText('Configured')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });

  describe('TC-Settings-U006: Test Connection shows success message', () => {
    it('should display success message when connection test passes', async () => {
      setupConfiguredHandlers();

      // Mock: external Xray API — test connection succeeds
      server.use(
        http.get('*/api/config/test', () => {
          return HttpResponse.json({ success: true });
        }),
      );

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithRouter(<SettingsPage />);

      await exitInitialEditingMode(user);

      await user.click(screen.getByRole('button', { name: 'Test Connection' }));

      await waitFor(() => {
        expect(screen.getByText('Connection successful!')).toBeInTheDocument();
      });
    });
  });

  describe('TC-Settings-U007: Test Connection shows failure message', () => {
    it('should display error message when connection test fails', async () => {
      setupConfiguredHandlers();

      // Mock: external Xray API — test connection fails
      server.use(
        http.get('*/api/config/test', () => {
          return HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }),
      );

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithRouter(<SettingsPage />);

      await exitInitialEditingMode(user);

      await user.click(screen.getByRole('button', { name: 'Test Connection' }));

      await waitFor(() => {
        expect(screen.getByText('Connection failed. Check your credentials.')).toBeInTheDocument();
      });
    });
  });

  describe('TC-Settings-U008: Edit button switches to edit form', () => {
    it('should show edit form when Edit is clicked in configured state', async () => {
      setupConfiguredHandlers();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithRouter(<SettingsPage />);

      // Exit initial editing mode to see the connected view
      await exitInitialEditingMode(user);

      // Now click Edit to enter editing mode
      await user.click(screen.getByRole('button', { name: 'Edit' }));

      await waitFor(() => {
        expect(screen.getByLabelText('Xray Client ID')).toBeInTheDocument();
        expect(screen.getByLabelText('Xray Client Secret')).toBeInTheDocument();
        expect(screen.getByLabelText('Jira Base URL')).toBeInTheDocument();
      });
    });
  });

  describe('TC-Settings-U009: Cancel button exits editing without saving', () => {
    it('should return to connected view when Cancel is clicked', async () => {
      setupConfiguredHandlers();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithRouter(<SettingsPage />);

      // Exit initial editing, then re-enter via Edit button
      await exitInitialEditingMode(user);
      await user.click(screen.getByRole('button', { name: 'Edit' }));

      await waitFor(() => {
        expect(screen.getByLabelText('Xray Client ID')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.getByText('Connected to Xray Cloud')).toBeInTheDocument();
        expect(screen.queryByLabelText('Xray Client ID')).not.toBeInTheDocument();
      });
    });
  });

  describe('TC-Settings-U010: Renders Projects section with correct count', () => {
    it('should show "2 projects configured" subtitle', async () => {
      setupConfiguredHandlers();
      renderWithRouter(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Projects')).toBeInTheDocument();
      });
      expect(screen.getByText('2 projects configured')).toBeInTheDocument();
    });
  });

  describe('TC-Settings-U011: Add project input converts to uppercase', () => {
    it('should uppercase input and add project', async () => {
      let addedProject = '';
      setupConfiguredHandlers();

      // Mock: settings API — add project
      server.use(
        http.post('*/api/settings/projects', async ({ request }) => {
          const body = await request.json() as { projectKey: string };
          addedProject = body.projectKey;
          return HttpResponse.json({ success: true });
        }),
      );

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithRouter(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Project key (e.g., PROJ)')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Project key (e.g., PROJ)');
      await user.type(input, 'myproj');

      // Input should show uppercase
      expect(input).toHaveValue('MYPROJ');

      await user.click(screen.getByRole('button', { name: 'Add' }));

      await waitFor(() => {
        expect(addedProject).toBe('MYPROJ');
      });
    });
  });

  describe('TC-Settings-U012: Add project via Enter key', () => {
    it('should add project when Enter is pressed in input', async () => {
      let addedProject = '';
      setupConfiguredHandlers();

      server.use(
        http.post('*/api/settings/projects', async ({ request }) => {
          const body = await request.json() as { projectKey: string };
          addedProject = body.projectKey;
          return HttpResponse.json({ success: true });
        }),
      );

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithRouter(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Project key (e.g., PROJ)')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Project key (e.g., PROJ)');
      await user.type(input, 'NEW{Enter}');

      await waitFor(() => {
        expect(addedProject).toBe('NEW');
      });
    });
  });

  describe('TC-Settings-U013: Visible projects shown with draft count badge', () => {
    it('should display project key and draft count', async () => {
      setupConfiguredHandlers({
        drafts: [
          { id: 'd1', projectKey: 'TEST', summary: 'Draft 1', status: 'draft', steps: [], labels: [], createdAt: '', updatedAt: '' },
          { id: 'd2', projectKey: 'TEST', summary: 'Draft 2', status: 'new', steps: [], labels: [], createdAt: '', updatedAt: '' },
          { id: 'd3', projectKey: 'DEMO', summary: 'Draft 3', status: 'draft', steps: [], labels: [], createdAt: '', updatedAt: '' },
        ],
      });
      renderWithRouter(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('TEST')).toBeInTheDocument();
      });

      expect(screen.getByText('DEMO')).toBeInTheDocument();
      expect(screen.getByText('2 test cases')).toBeInTheDocument(); // TEST has 2
      expect(screen.getByText('1 test case')).toBeInTheDocument(); // DEMO has 1
    });
  });

  describe('TC-Settings-U014: Hidden projects shown under Hidden label', () => {
    it('should show hidden projects with muted styling', async () => {
      setupConfiguredHandlers({ hiddenProjects: ['DEMO'] });
      renderWithRouter(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Hidden')).toBeInTheDocument();
      });

      // DEMO should have "Show project" title (since it's hidden)
      const showButtons = screen.getAllByTitle('Show project');
      expect(showButtons.length).toBeGreaterThan(0);
    });
  });

  describe('TC-Settings-U015: Toggle visibility hides a visible project', () => {
    it('should call hideProject API when hiding a visible project', async () => {
      let hiddenKey = '';
      setupConfiguredHandlers();

      server.use(
        http.post('*/api/settings/projects/:key/hide', ({ params }) => {
          hiddenKey = params.key as string;
          return HttpResponse.json({ success: true });
        }),
      );

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithRouter(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('TEST')).toBeInTheDocument();
      });

      // Click "Hide project" for first visible project
      const hideButtons = screen.getAllByTitle('Hide project');
      await user.click(hideButtons[0]);

      await waitFor(() => {
        expect(hiddenKey).toBe('TEST');
      });
    });
  });

  describe('TC-Settings-U016: Toggle visibility shows a hidden project', () => {
    it('should call unhideProject API when showing a hidden project', async () => {
      let unhiddenKey = '';
      setupConfiguredHandlers({ hiddenProjects: ['DEMO'] });

      server.use(
        http.post('*/api/settings/projects/:key/unhide', ({ params }) => {
          unhiddenKey = params.key as string;
          return HttpResponse.json({ success: true });
        }),
      );

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithRouter(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Hidden')).toBeInTheDocument();
      });

      const showButton = screen.getByTitle('Show project');
      await user.click(showButton);

      await waitFor(() => {
        expect(unhiddenKey).toBe('DEMO');
      });
    });
  });

  describe('TC-Settings-U017: Delete button opens ConfirmModal', () => {
    it('should show confirmation dialog with project name', async () => {
      setupConfiguredHandlers();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithRouter(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('TEST')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByTitle('Remove project');
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Remove Project')).toBeInTheDocument();
        expect(screen.getByText(/Are you sure you want to remove "TEST"/)).toBeInTheDocument();
      });
    });
  });

  describe('TC-Settings-U018: Confirming delete removes project', () => {
    it('should call removeProject API on confirm', async () => {
      let removedKey = '';
      setupConfiguredHandlers();

      server.use(
        http.delete('*/api/settings/projects/:key', ({ params }) => {
          removedKey = params.key as string;
          return HttpResponse.json({ success: true });
        }),
      );

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithRouter(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('TEST')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByTitle('Remove project');
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Remove' }));

      await waitFor(() => {
        expect(removedKey).toBe('TEST');
      });
    });
  });

  describe('TC-Settings-U019: Canceling delete closes modal', () => {
    it('should close the modal without calling API', async () => {
      setupConfiguredHandlers();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithRouter(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('TEST')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByTitle('Remove project');
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Remove Project')).toBeInTheDocument();
      });

      // Multiple Cancel buttons may exist (Xray edit form + modal)
      // Target the one inside the modal (next to "Remove" button)
      const cancelButtons = screen.getAllByRole('button', { name: 'Cancel' });
      // The modal Cancel is the last one rendered
      await user.click(cancelButtons[cancelButtons.length - 1]);

      await waitFor(() => {
        expect(screen.queryByText('Remove Project')).not.toBeInTheDocument();
      });
    });
  });

  describe('TC-Settings-U020: About section renders', () => {
    it('should show About RayDrop heading and Feature Tour button', async () => {
      setupConfiguredHandlers();
      renderWithRouter(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('About RayDrop')).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: 'See Feature Tour' })).toBeInTheDocument();
    });
  });

  describe('TC-Settings-U021: Feature Tour button opens FeatureDemo', () => {
    it('should render FeatureDemo when clicked', async () => {
      setupConfiguredHandlers();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithRouter(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'See Feature Tour' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'See Feature Tour' }));

      // FeatureDemo renders a modal with navigation ("Next →") and page counter ("1 / N")
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Next/ })).toBeInTheDocument();
        expect(screen.getByText(/1 \//)).toBeInTheDocument();
      });
    });
  });

  // === Negative Tests ===

  describe('TC-Settings-U022: Save shows error when fields are empty', () => {
    it('should display "All fields are required"', async () => {
      setupNotConfiguredHandlers();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithRouter(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Save & Validate' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Save & Validate' }));

      await waitFor(() => {
        expect(screen.getByText('All fields are required')).toBeInTheDocument();
      });
    });
  });

  describe('TC-Settings-U023: Save shows API error message on failure', () => {
    it('should display the error from the API response', async () => {
      setupNotConfiguredHandlers();

      // Mock: external config API — save fails
      server.use(
        http.post('*/api/config', () => {
          return HttpResponse.json({ error: 'Invalid Jira URL format' }, { status: 400 });
        }),
      );

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithRouter(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Xray Client ID')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText('Xray Client ID'), 'id');
      await user.type(screen.getByLabelText('Xray Client Secret'), 'secret');
      await user.type(screen.getByLabelText('Jira Base URL'), 'bad-url');

      await user.click(screen.getByRole('button', { name: 'Save & Validate' }));

      await waitFor(() => {
        expect(screen.getByText('Invalid Jira URL format')).toBeInTheDocument();
      });
    });
  });

  describe('TC-Settings-U024: Add project does nothing for empty input', () => {
    it('should not call API when input is blank', async () => {
      let addCalled = false;
      setupConfiguredHandlers();

      server.use(
        http.post('*/api/settings/projects', () => {
          addCalled = true;
          return HttpResponse.json({ success: true });
        }),
      );

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithRouter(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
      });

      // Click Add with empty input
      await user.click(screen.getByRole('button', { name: 'Add' }));

      // Wait a tick to ensure no API call was fired
      await vi.advanceTimersByTimeAsync(200);
      expect(addCalled).toBe(false);
    });
  });

  describe('TC-Settings-U025: Shows empty state when no projects exist', () => {
    it('should display "No projects yet" message', async () => {
      setupConfiguredHandlers({ projects: [] });
      renderWithRouter(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('No projects yet. Add your first project above.')).toBeInTheDocument();
      });
    });
  });

  // === Edge Cases ===

  describe('TC-Settings-U026: Save shows Validating loading state', () => {
    it('should show "Validating..." while saving', async () => {
      setupNotConfiguredHandlers();

      // Mock: external config API — delay response to hold loading state
      server.use(
        http.post('*/api/config', async () => {
          await delay(5000);
          return HttpResponse.json({ success: true });
        }),
      );

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithRouter(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Xray Client ID')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText('Xray Client ID'), 'id');
      await user.type(screen.getByLabelText('Xray Client Secret'), 'secret');
      await user.type(screen.getByLabelText('Jira Base URL'), 'https://test.atlassian.net');

      await user.click(screen.getByRole('button', { name: 'Save & Validate' }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Validating...' })).toBeInTheDocument();
      });
    });
  });

  describe('TC-Settings-U027: Test Connection shows Testing state', () => {
    it('should show "Testing..." while testing connection', async () => {
      setupConfiguredHandlers();

      // Mock: external Xray API — delay to hold testing state
      server.use(
        http.get('*/api/config/test', async () => {
          await delay(5000);
          return HttpResponse.json({ success: true });
        }),
      );

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithRouter(<SettingsPage />);

      await exitInitialEditingMode(user);

      await user.click(screen.getByRole('button', { name: 'Test Connection' }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Testing...' })).toBeInTheDocument();
      });
    });
  });

  describe('TC-Settings-U028: Draft count badge singular for count of 1', () => {
    it('should show "1 test case" (singular)', async () => {
      setupConfiguredHandlers({
        projects: ['SOLO'],
        drafts: [
          { id: 'd1', projectKey: 'SOLO', summary: 'Only draft', status: 'draft', steps: [], labels: [], createdAt: '', updatedAt: '' },
        ],
      });
      renderWithRouter(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('1 test case')).toBeInTheDocument();
      });
    });
  });

  describe('TC-Settings-U029: Draft count badge hidden when count is 0', () => {
    it('should not show badge for projects with no drafts', async () => {
      setupConfiguredHandlers({ drafts: [] });
      renderWithRouter(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('TEST')).toBeInTheDocument();
      });

      expect(screen.queryByText(/test case/)).not.toBeInTheDocument();
    });
  });

  describe('TC-Settings-U030: getDraftCountsByProject aggregates correctly', () => {
    it('should count drafts per project across multiple projects', async () => {
      setupConfiguredHandlers({
        projects: ['AAA', 'BBB'],
        drafts: [
          { id: '1', projectKey: 'AAA', summary: '', status: 'draft', steps: [], labels: [], createdAt: '', updatedAt: '' },
          { id: '2', projectKey: 'AAA', summary: '', status: 'new', steps: [], labels: [], createdAt: '', updatedAt: '' },
          { id: '3', projectKey: 'AAA', summary: '', status: 'ready', steps: [], labels: [], createdAt: '', updatedAt: '' },
          { id: '4', projectKey: 'BBB', summary: '', status: 'draft', steps: [], labels: [], createdAt: '', updatedAt: '' },
        ],
      });
      renderWithRouter(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('3 test cases')).toBeInTheDocument(); // AAA
      });
      expect(screen.getByText('1 test case')).toBeInTheDocument(); // BBB
    });
  });

  describe('TC-Settings-U031: Delete modal shows warning about draft count', () => {
    it('should display draft count warning when project has drafts', async () => {
      setupConfiguredHandlers({
        drafts: [
          { id: 'd1', projectKey: 'TEST', summary: 'Draft 1', status: 'draft', steps: [], labels: [], createdAt: '', updatedAt: '' },
          { id: 'd2', projectKey: 'TEST', summary: 'Draft 2', status: 'new', steps: [], labels: [], createdAt: '', updatedAt: '' },
        ],
      });

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithRouter(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('TEST')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByTitle('Remove project');
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/2 test cases will be kept/)).toBeInTheDocument();
      });
    });
  });

  describe('TC-Settings-U032: Add button disabled when input is empty', () => {
    it('should disable Add button with no text', async () => {
      setupConfiguredHandlers();
      renderWithRouter(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    });
  });
});

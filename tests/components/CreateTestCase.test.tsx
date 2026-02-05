import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '../helpers/render';
import { CreateTestCase } from '../../client/src/components/features/create/CreateTestCase';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '../../client/src/context/ThemeContext';
import { AppProvider } from '../../client/src/context/AppContext';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock Xray entities
const mockTestPlans = [
  { issueId: '10001', key: 'WCP-7067', summary: 'Sprint 1 Test Plan' },
  { issueId: '10002', key: 'WCP-7068', summary: 'Sprint 2 Test Plan' },
];

const mockTestExecutions = [
  { issueId: '10003', key: 'WCP-7069', summary: 'Release 1.0 Execution' },
];

const mockTestSets = [
  { issueId: '10004', key: 'WCP-7154', summary: 'Smoke Tests' },
  { issueId: '10005', key: 'WCP-7155', summary: 'Regression Tests' },
];

const mockPreconditions = [
  { issueId: '10006', key: 'WCP-9209', summary: 'User is logged in' },
];

const mockFolders = {
  name: 'Root',
  path: '/',
  folders: [
    { name: 'UI', path: '/UI', folders: [] },
    { name: 'API', path: '/API', folders: [] },
  ],
};

// Helper to render CreateTestCase
function renderCreateTestCase() {
  return render(
    <MemoryRouter initialEntries={['/create']}>
      <ThemeProvider>
        <AppProvider>
          <Routes>
            <Route path="/create" element={<CreateTestCase />} />
            <Route path="/test-cases" element={<div>Test Cases List</div>} />
          </Routes>
        </AppProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

// Helper to navigate to step 3 (Xray Linking) using Next buttons
// Note: Direct step navigation requires validation, but Next allows free navigation
async function navigateToStep3() {
  // Click Next from step 1 to step 2
  const nextButton1 = screen.getByText('Next →');
  fireEvent.click(nextButton1);

  // Wait for step 2 to appear
  await waitFor(() => {
    expect(screen.getByText('+ Add Step')).toBeInTheDocument();
  });

  // Click Next from step 2 to step 3
  const nextButton2 = screen.getByText('Next →');
  fireEvent.click(nextButton2);

  // Wait for step 3 to appear
  await waitFor(() => {
    expect(screen.getByText('Import to Xray')).toBeInTheDocument();
  });
}

describe('CreateTestCase', () => {
  beforeEach(() => {
    // Setup default MSW handlers
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
          projectSettings: { WCP: { color: '#3B82F6', functionalAreas: ['UI', 'API'] } },
        });
      }),
      http.get('*/api/settings/projects/:projectKey', () => {
        return HttpResponse.json({
          color: '#3B82F6',
          functionalAreas: ['UI', 'API'],
        });
      }),
      http.get('*/api/drafts', () => HttpResponse.json([])),
    );
  });

  describe('Xray Entities Loading', () => {
    beforeEach(() => {
      // Setup Xray entity endpoints
      server.use(
        http.get('*/api/xray/test-plans/:projectKey', () => {
          return HttpResponse.json(mockTestPlans);
        }),
        http.get('*/api/xray/test-executions/:projectKey', () => {
          return HttpResponse.json(mockTestExecutions);
        }),
        http.get('*/api/xray/test-sets/:projectKey', () => {
          return HttpResponse.json(mockTestSets);
        }),
        http.get('*/api/xray/preconditions/:projectKey', () => {
          return HttpResponse.json(mockPreconditions);
        }),
        http.get('*/api/xray/project-id/:projectKey', () => {
          return HttpResponse.json({ projectId: 'proj-123' });
        }),
        http.get('*/api/xray/folders/:projectId', () => {
          return HttpResponse.json(mockFolders);
        }),
      );
    });

    it('loads Xray entities on mount and shows options in dropdowns', async () => {
      const user = userEvent.setup();
      renderCreateTestCase();

      // Wait for page to load
      await waitFor(() => {
        expect(screen.getByText('Create Test Case')).toBeInTheDocument();
      });

      // Navigate to Xray Linking step
      await navigateToStep3();

      // Wait for Xray entities to load (the dropdown should no longer show "Loading...")
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Click on Test Plans dropdown (first combobox) to open it
      const comboboxes = screen.getAllByRole('combobox');
      await user.click(comboboxes[0]); // Test Plans is the first dropdown

      // Should show test plan options (not "No options available")
      await waitFor(() => {
        expect(screen.getByText('WCP-7067')).toBeInTheDocument();
      });
    });

    it('shows test executions in dropdown', async () => {
      const user = userEvent.setup();
      renderCreateTestCase();

      await waitFor(() => {
        expect(screen.getByText('Create Test Case')).toBeInTheDocument();
      });

      await navigateToStep3();

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Click on Test Executions dropdown (second combobox)
      const comboboxes = screen.getAllByRole('combobox');
      await user.click(comboboxes[1]); // Test Executions is the second dropdown

      await waitFor(() => {
        expect(screen.getByText('WCP-7069')).toBeInTheDocument();
      });
    });

    it('shows test sets in dropdown', async () => {
      const user = userEvent.setup();
      renderCreateTestCase();

      await waitFor(() => {
        expect(screen.getByText('Create Test Case')).toBeInTheDocument();
      });

      await navigateToStep3();

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Click on Test Sets dropdown (third combobox)
      const comboboxes = screen.getAllByRole('combobox');
      await user.click(comboboxes[2]); // Test Sets is the third dropdown

      await waitFor(() => {
        expect(screen.getByText('WCP-7154')).toBeInTheDocument();
      });
    });

    it('shows preconditions in dropdown', async () => {
      const user = userEvent.setup();
      renderCreateTestCase();

      await waitFor(() => {
        expect(screen.getByText('Create Test Case')).toBeInTheDocument();
      });

      await navigateToStep3();

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Click on Preconditions dropdown (fourth combobox)
      const comboboxes = screen.getAllByRole('combobox');
      await user.click(comboboxes[3]); // Preconditions is the fourth dropdown

      await waitFor(() => {
        expect(screen.getByText('WCP-9209')).toBeInTheDocument();
      });
    });

    it('shows folders in folder selector', async () => {
      renderCreateTestCase();

      await waitFor(() => {
        expect(screen.getByText('Create Test Case')).toBeInTheDocument();
      });

      await navigateToStep3();

      // Folder path should show root by default or folder options should be available
      await waitFor(() => {
        // Check that folder input exists and has loaded
        expect(screen.getByText('Folder Path')).toBeInTheDocument();
      });
    });
  });

  describe('Xray Entities Loading Failure', () => {
    it('handles API failure gracefully and shows empty dropdowns', async () => {
      const user = userEvent.setup();

      // Setup failing endpoints
      server.use(
        http.get('*/api/xray/test-plans/:projectKey', () => {
          return HttpResponse.json({ error: 'Failed' }, { status: 500 });
        }),
        http.get('*/api/xray/test-executions/:projectKey', () => {
          return HttpResponse.json({ error: 'Failed' }, { status: 500 });
        }),
        http.get('*/api/xray/test-sets/:projectKey', () => {
          return HttpResponse.json({ error: 'Failed' }, { status: 500 });
        }),
        http.get('*/api/xray/preconditions/:projectKey', () => {
          return HttpResponse.json({ error: 'Failed' }, { status: 500 });
        }),
        http.get('*/api/xray/project-id/:projectKey', () => {
          return HttpResponse.json({ error: 'Failed' }, { status: 500 });
        }),
        http.get('*/api/xray/folders/:projectId', () => {
          return HttpResponse.json({ error: 'Failed' }, { status: 500 });
        }),
      );

      renderCreateTestCase();

      await waitFor(() => {
        expect(screen.getByText('Create Test Case')).toBeInTheDocument();
      });

      await navigateToStep3();

      // Wait for loading to complete (even if failed)
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      }, { timeout: 3000 });

      // Click on Test Plans dropdown (first combobox)
      const comboboxes = screen.getAllByRole('combobox');
      await user.click(comboboxes[0]);

      // Should show "No options available" since API failed
      await waitFor(() => {
        expect(screen.getByText('No options available')).toBeInTheDocument();
      });
    });
  });

  describe('Page Rendering', () => {
    it('renders create test case page with step indicator', async () => {
      server.use(
        http.get('*/api/xray/test-plans/:projectKey', () => HttpResponse.json([])),
        http.get('*/api/xray/test-executions/:projectKey', () => HttpResponse.json([])),
        http.get('*/api/xray/test-sets/:projectKey', () => HttpResponse.json([])),
        http.get('*/api/xray/preconditions/:projectKey', () => HttpResponse.json([])),
        http.get('*/api/xray/project-id/:projectKey', () => HttpResponse.json({ projectId: 'proj-123' })),
        http.get('*/api/xray/folders/:projectId', () => HttpResponse.json({ folders: [] })),
      );

      renderCreateTestCase();

      await waitFor(() => {
        expect(screen.getByText('Create Test Case')).toBeInTheDocument();
        expect(screen.getByText('Basic Info')).toBeInTheDocument();
        expect(screen.getByText('Test Steps')).toBeInTheDocument();
        expect(screen.getByText('Xray Linking')).toBeInTheDocument();
      });
    });

    it('shows New status badge', async () => {
      server.use(
        http.get('*/api/xray/test-plans/:projectKey', () => HttpResponse.json([])),
        http.get('*/api/xray/test-executions/:projectKey', () => HttpResponse.json([])),
        http.get('*/api/xray/test-sets/:projectKey', () => HttpResponse.json([])),
        http.get('*/api/xray/preconditions/:projectKey', () => HttpResponse.json([])),
        http.get('*/api/xray/project-id/:projectKey', () => HttpResponse.json({ projectId: 'proj-123' })),
        http.get('*/api/xray/folders/:projectId', () => HttpResponse.json({ folders: [] })),
      );

      renderCreateTestCase();

      await waitFor(() => {
        expect(screen.getByText('New')).toBeInTheDocument();
      });
    });
  });
});

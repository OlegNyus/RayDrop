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

// Helper to skip the choice screen by clicking "From Scratch"
async function skipChoiceScreen() {
  await waitFor(() => {
    expect(screen.getByText('From Scratch')).toBeInTheDocument();
  });
  fireEvent.click(screen.getByText('From Scratch'));
  // Wait for the editor to appear
  await waitFor(() => {
    expect(screen.getByText('Next →')).toBeInTheDocument();
  });
}

// Helper to navigate to step 3 (Xray Linking) using Next buttons
// Note: Direct step navigation requires validation, but Next allows free navigation
async function navigateToStep3() {
  // First skip the choice screen
  await skipChoiceScreen();

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
    it('renders choice screen first with two options', async () => {
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
        expect(screen.getByText('From Scratch')).toBeInTheDocument();
        expect(screen.getByText('From Reusable TC')).toBeInTheDocument();
      });
    });

    it('renders step indicator after choosing From Scratch', async () => {
      server.use(
        http.get('*/api/xray/test-plans/:projectKey', () => HttpResponse.json([])),
        http.get('*/api/xray/test-executions/:projectKey', () => HttpResponse.json([])),
        http.get('*/api/xray/test-sets/:projectKey', () => HttpResponse.json([])),
        http.get('*/api/xray/preconditions/:projectKey', () => HttpResponse.json([])),
        http.get('*/api/xray/project-id/:projectKey', () => HttpResponse.json({ projectId: 'proj-123' })),
        http.get('*/api/xray/folders/:projectId', () => HttpResponse.json({ folders: [] })),
      );

      renderCreateTestCase();

      await skipChoiceScreen();

      await waitFor(() => {
        expect(screen.getByText('Basic Info')).toBeInTheDocument();
        expect(screen.getByText('Test Steps')).toBeInTheDocument();
        expect(screen.getByText('Xray Linking')).toBeInTheDocument();
      });
    });

    it('shows New status badge after choosing From Scratch', async () => {
      server.use(
        http.get('*/api/xray/test-plans/:projectKey', () => HttpResponse.json([])),
        http.get('*/api/xray/test-executions/:projectKey', () => HttpResponse.json([])),
        http.get('*/api/xray/test-sets/:projectKey', () => HttpResponse.json([])),
        http.get('*/api/xray/preconditions/:projectKey', () => HttpResponse.json([])),
        http.get('*/api/xray/project-id/:projectKey', () => HttpResponse.json({ projectId: 'proj-123' })),
        http.get('*/api/xray/folders/:projectId', () => HttpResponse.json({ folders: [] })),
      );

      renderCreateTestCase();

      await skipChoiceScreen();

      await waitFor(() => {
        expect(screen.getByText('New')).toBeInTheDocument();
      });
    });
  });

  describe('TC-Create-U001: Reusable TC with ADF description', () => {
    const adfDescription = {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'ADF paragraph text' }],
        },
      ],
    };

    const mockReusableTests = [
      {
        issueId: '99001',
        key: 'WCP-9999',
        summary: 'Organization | UI | REUSE Login Test',
        description: adfDescription,
        testType: 'Manual',
        priority: 'High',
        labels: ['Regression'],
        steps: [
          { id: 'step-1', action: 'Open login page', data: '', result: 'Login page is displayed' },
        ],
      },
    ];

    const mockTestLinks = {
      issueId: '99001',
      key: 'WCP-9999',
      testPlans: [{ issueId: '10001', key: 'WCP-7067', summary: 'Sprint 1 Test Plan' }],
      testExecutions: [{ issueId: '10003', key: 'WCP-7069', summary: 'Release 1.0 Execution' }],
      testSets: [{ issueId: '10004', key: 'WCP-7154', summary: 'Smoke Tests' }],
      preconditions: [{ issueId: '10006', key: 'WCP-9209', summary: 'User is logged in' }],
      folder: '/WCP/UI/Feature',
    };

    beforeEach(() => {
      server.use(
        http.get('*/api/xray/test-plans/:projectKey', () => HttpResponse.json(mockTestPlans)),
        http.get('*/api/xray/test-executions/:projectKey', () => HttpResponse.json(mockTestExecutions)),
        http.get('*/api/xray/test-sets/:projectKey', () => HttpResponse.json(mockTestSets)),
        http.get('*/api/xray/preconditions/:projectKey', () => HttpResponse.json(mockPreconditions)),
        http.get('*/api/xray/project-id/:projectKey', () => HttpResponse.json({ projectId: 'proj-123' })),
        http.get('*/api/xray/folders/:projectId', () => HttpResponse.json(mockFolders)),
        http.get('*/api/settings/projects/:projectKey', () => {
          return HttpResponse.json({
            color: '#3B82F6',
            functionalAreas: ['UI', 'API'],
            reusablePrefix: 'REUSE',
          });
        }),
        http.get('*/api/xray/tests/by-prefix/:projectKey', () => {
          return HttpResponse.json(mockReusableTests);
        }),
        http.get('*/api/xray/tests/:issueId/links', () => {
          return HttpResponse.json(mockTestLinks);
        }),
      );
    });

    it('does not crash when selecting a reusable TC with ADF object description', async () => {
      const user = userEvent.setup();
      renderCreateTestCase();

      // Wait for choice screen
      await waitFor(() => {
        expect(screen.getByText('From Reusable TC')).toBeInTheDocument();
      });

      // Click "From Reusable TC"
      fireEvent.click(screen.getByText('From Reusable TC'));

      // Wait for selector to load tests
      await waitFor(() => {
        expect(screen.getByText('WCP-9999')).toBeInTheDocument();
      });

      // Click on the reusable test
      await user.click(screen.getByText(/REUSE Login Test/));

      // Should navigate to editor without crash — verify step indicator renders
      await waitFor(() => {
        expect(screen.getByText('Basic Info')).toBeInTheDocument();
        expect(screen.getByText('Test Steps')).toBeInTheDocument();
      });
    });

    it('does not crash when selecting a reusable TC with null description', async () => {
      const user = userEvent.setup();

      // Override to return null description
      server.use(
        http.get('*/api/xray/tests/by-prefix/:projectKey', () => {
          return HttpResponse.json([
            {
              ...mockReusableTests[0],
              description: null,
            },
          ]);
        }),
      );

      renderCreateTestCase();

      await waitFor(() => {
        expect(screen.getByText('From Reusable TC')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('From Reusable TC'));

      await waitFor(() => {
        expect(screen.getByText('WCP-9999')).toBeInTheDocument();
      });

      await user.click(screen.getByText(/REUSE Login Test/));

      // Should navigate to editor without crash
      await waitFor(() => {
        expect(screen.getByText('Basic Info')).toBeInTheDocument();
      });
    });

    it('pre-populates Xray links from the selected reusable TC', async () => {
      const user = userEvent.setup();
      renderCreateTestCase();

      // Wait for choice screen
      await waitFor(() => {
        expect(screen.getByText('From Reusable TC')).toBeInTheDocument();
      });

      // Click "From Reusable TC"
      fireEvent.click(screen.getByText('From Reusable TC'));

      // Wait for selector to load tests
      await waitFor(() => {
        expect(screen.getByText('WCP-9999')).toBeInTheDocument();
      });

      // Click on the reusable test
      await user.click(screen.getByText(/REUSE Login Test/));

      // Should navigate to editor mode
      await waitFor(() => {
        expect(screen.getByText('Basic Info')).toBeInTheDocument();
      });

      // Navigate to step 3 (Xray Linking)
      // Click Next from step 1 to step 2
      fireEvent.click(screen.getByText('Next →'));
      await waitFor(() => {
        expect(screen.getByText('+ Add Step')).toBeInTheDocument();
      });

      // Click Next from step 2 to step 3
      fireEvent.click(screen.getByText('Next →'));
      await waitFor(() => {
        // Reusable TC shows "Update in Xray" instead of "Import to Xray"
        expect(screen.getByText('Update in Xray')).toBeInTheDocument();
      });

      // Wait for Xray loading to complete
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Verify pre-populated Xray links appear as tags (tags show key before colon)
      expect(screen.getByText('WCP-7067')).toBeInTheDocument(); // Test Plan
      expect(screen.getByText('WCP-7069')).toBeInTheDocument(); // Test Execution
      expect(screen.getByText('WCP-7154')).toBeInTheDocument(); // Test Set
      expect(screen.getByText('WCP-9209')).toBeInTheDocument(); // Precondition
    });

    it('does not crash when selecting a reusable TC with undefined description', async () => {
      const user = userEvent.setup();

      server.use(
        http.get('*/api/xray/tests/by-prefix/:projectKey', () => {
          return HttpResponse.json([
            {
              issueId: '99001',
              key: 'WCP-9999',
              summary: 'Organization | UI | REUSE Login Test',
              // description omitted entirely
              testType: 'Manual',
              priority: 'High',
              labels: [],
              steps: [
                { id: 'step-1', action: 'Open page', data: '', result: 'Page displayed' },
              ],
            },
          ]);
        }),
      );

      renderCreateTestCase();

      await waitFor(() => {
        expect(screen.getByText('From Reusable TC')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('From Reusable TC'));

      await waitFor(() => {
        expect(screen.getByText('WCP-9999')).toBeInTheDocument();
      });

      await user.click(screen.getByText(/REUSE Login Test/));

      // Should navigate to editor without crash
      await waitFor(() => {
        expect(screen.getByText('Basic Info')).toBeInTheDocument();
      });
    });
  });

  describe('TC-Create-U002: Reusable TC Xray link pre-population', () => {
    const mockReusableTests = [
      {
        issueId: '99001',
        key: 'WCP-9999',
        summary: 'Organization | UI | REUSE Login Test',
        description: 'Login test description',
        testType: 'Manual',
        priority: 'High',
        labels: ['Regression'],
        steps: [
          { id: 'step-1', action: 'Open login page', data: '', result: 'Login page is displayed' },
        ],
      },
    ];

    const fullMockTestLinks = {
      issueId: '99001',
      key: 'WCP-9999',
      testPlans: [{ issueId: '10001', key: 'WCP-7067', summary: 'Sprint 1 Test Plan' }],
      testExecutions: [{ issueId: '10003', key: 'WCP-7069', summary: 'Release 1.0 Execution' }],
      testSets: [{ issueId: '10004', key: 'WCP-7154', summary: 'Smoke Tests' }],
      preconditions: [{ issueId: '10006', key: 'WCP-9209', summary: 'User is logged in' }],
      folder: '/WCP/UI/Feature',
    };

    // Shared setup for all tests in this block
    beforeEach(() => {
      server.use(
        http.get('*/api/xray/test-plans/:projectKey', () => HttpResponse.json(mockTestPlans)),
        http.get('*/api/xray/test-executions/:projectKey', () => HttpResponse.json(mockTestExecutions)),
        http.get('*/api/xray/test-sets/:projectKey', () => HttpResponse.json(mockTestSets)),
        http.get('*/api/xray/preconditions/:projectKey', () => HttpResponse.json(mockPreconditions)),
        http.get('*/api/xray/project-id/:projectKey', () => HttpResponse.json({ projectId: 'proj-123' })),
        http.get('*/api/xray/folders/:projectId', () => HttpResponse.json(mockFolders)),
        http.get('*/api/settings/projects/:projectKey', () => {
          return HttpResponse.json({
            color: '#3B82F6',
            functionalAreas: ['UI', 'API'],
            reusablePrefix: 'REUSE',
          });
        }),
        http.get('*/api/xray/tests/by-prefix/:projectKey', () => {
          return HttpResponse.json(mockReusableTests);
        }),
        http.get('*/api/xray/tests/:issueId/links', () => {
          return HttpResponse.json(fullMockTestLinks);
        }),
      );
    });

    // Helper: select the reusable TC and wait for editor
    async function selectReusableTC(user: ReturnType<typeof userEvent.setup>) {
      await waitFor(() => {
        expect(screen.getByText('From Reusable TC')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('From Reusable TC'));
      await waitFor(() => {
        expect(screen.getByText('WCP-9999')).toBeInTheDocument();
      });
      await user.click(screen.getByText(/REUSE Login Test/));
      await waitFor(() => {
        expect(screen.getByText('Basic Info')).toBeInTheDocument();
      });
    }

    // Helper: navigate from step 1 to step 3
    async function goToStep3Reusable() {
      fireEvent.click(screen.getByText('Next →'));
      await waitFor(() => {
        expect(screen.getByText('+ Add Step')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Next →'));
      await waitFor(() => {
        expect(screen.getByText('Update in Xray')).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });
    }

    it('shows "Editing WCP-9999" badge after selecting reusable TC', async () => {
      const user = userEvent.setup();
      renderCreateTestCase();
      await selectReusableTC(user);

      expect(screen.getByText('Editing WCP-9999')).toBeInTheDocument();
    });

    it('shows "Update in Xray" button instead of "Import to Xray" for reusable TC', async () => {
      const user = userEvent.setup();
      renderCreateTestCase();
      await selectReusableTC(user);
      await goToStep3Reusable();

      expect(screen.getByText('Update in Xray')).toBeInTheDocument();
      expect(screen.queryByText('Import to Xray')).not.toBeInTheDocument();
    });

    it('pre-populates folder path from linked test', async () => {
      const user = userEvent.setup();
      renderCreateTestCase();
      await selectReusableTC(user);
      await goToStep3Reusable();

      // Folder path displays inside a button as text content
      expect(screen.getByText('/WCP/UI/Feature')).toBeInTheDocument();
    });

    it('keeps empty xray links when getTestLinks API fails', async () => {
      const user = userEvent.setup();

      // Override links endpoint to fail
      server.use(
        http.get('*/api/xray/tests/:issueId/links', () => {
          return HttpResponse.json({ error: 'Not found' }, { status: 500 });
        }),
      );

      renderCreateTestCase();
      await selectReusableTC(user);
      await goToStep3Reusable();

      // No link tags should be visible — dropdowns should be empty
      const comboboxes = screen.getAllByRole('combobox');
      // Open the test plans dropdown
      await user.click(comboboxes[0]);

      // Options should be available (from xray cache), but no tags pre-selected
      await waitFor(() => {
        expect(screen.getByText('WCP-7067')).toBeInTheDocument();
      });

      // The selected tags would be inside span elements inside the combobox container
      // Since no links were fetched, there should be no selected tag spans
      // Verify the folder path is still default "/" not a fetched value
      expect(screen.queryByText('/WCP/UI/Feature')).not.toBeInTheDocument();
    });

    it('handles partial links — only test plans and folder, no other entities', async () => {
      const user = userEvent.setup();

      server.use(
        http.get('*/api/xray/tests/:issueId/links', () => {
          return HttpResponse.json({
            issueId: '99001',
            key: 'WCP-9999',
            testPlans: [{ issueId: '10001', key: 'WCP-7067', summary: 'Sprint 1 Test Plan' }],
            testExecutions: [],
            testSets: [],
            preconditions: [],
            folder: '/WCP/Partial',
          });
        }),
      );

      renderCreateTestCase();
      await selectReusableTC(user);
      await goToStep3Reusable();

      // Test plan tag should be visible
      expect(screen.getByText('WCP-7067')).toBeInTheDocument();
      // Folder should be the partial one
      expect(screen.getByText('/WCP/Partial')).toBeInTheDocument();
      // No test execution, test set, or precondition tags
      expect(screen.queryByText('WCP-7069')).not.toBeInTheDocument();
      expect(screen.queryByText('WCP-7154')).not.toBeInTheDocument();
      expect(screen.queryByText('WCP-9209')).not.toBeInTheDocument();
    });

    it('handles multiple links per category', async () => {
      const user = userEvent.setup();

      server.use(
        http.get('*/api/xray/tests/:issueId/links', () => {
          return HttpResponse.json({
            issueId: '99001',
            key: 'WCP-9999',
            testPlans: [
              { issueId: '10001', key: 'WCP-7067', summary: 'Sprint 1 Test Plan' },
              { issueId: '10002', key: 'WCP-7068', summary: 'Sprint 2 Test Plan' },
            ],
            testExecutions: [{ issueId: '10003', key: 'WCP-7069', summary: 'Release 1.0 Execution' }],
            testSets: [
              { issueId: '10004', key: 'WCP-7154', summary: 'Smoke Tests' },
              { issueId: '10005', key: 'WCP-7155', summary: 'Regression Tests' },
            ],
            preconditions: [],
            folder: '/WCP/Multi',
          });
        }),
      );

      renderCreateTestCase();
      await selectReusableTC(user);
      await goToStep3Reusable();

      // Both test plan tags should appear
      expect(screen.getByText('WCP-7067')).toBeInTheDocument();
      expect(screen.getByText('WCP-7068')).toBeInTheDocument();
      // Both test set tags should appear
      expect(screen.getByText('WCP-7154')).toBeInTheDocument();
      expect(screen.getByText('WCP-7155')).toBeInTheDocument();
      // Single test execution tag
      expect(screen.getByText('WCP-7069')).toBeInTheDocument();
    });

    it('preserves default folder path when links have no folder', async () => {
      const user = userEvent.setup();

      server.use(
        http.get('*/api/xray/tests/:issueId/links', () => {
          return HttpResponse.json({
            issueId: '99001',
            key: 'WCP-9999',
            testPlans: [{ issueId: '10001', key: 'WCP-7067', summary: 'Sprint 1 Test Plan' }],
            testExecutions: [],
            testSets: [],
            preconditions: [],
            // folder is undefined — should keep whatever default the draft has
          });
        }),
      );

      renderCreateTestCase();
      await selectReusableTC(user);
      await goToStep3Reusable();

      // Link tag should still appear
      expect(screen.getByText('WCP-7067')).toBeInTheDocument();
      // Folder should NOT be set to a fetched value — remains as empty/default
      expect(screen.queryByText('/WCP/UI/Feature')).not.toBeInTheDocument();
    });
  });
});

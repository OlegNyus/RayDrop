import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '../helpers/render';
import { EditTestCase } from '../../client/src/components/features/create/EditTestCase';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '../../client/src/context/ThemeContext';
import { AppProvider } from '../../client/src/context/AppContext';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const DRAFT_ID = 'test-draft-001';

const REUSABLE_DRAFT_ID = 'test-draft-reusable';

const mockDraft = {
  id: DRAFT_ID,
  summary: 'Alert | UI | Test Login Flow',
  description: 'Verify login works',
  testType: 'Manual',
  priority: 'Medium',
  labels: [],
  collectionId: null,
  steps: [{ id: 's1', action: 'Open login', data: '', result: 'Login page shown' }],
  xrayLinking: {
    testPlanIds: [],
    testPlanDisplays: [],
    testExecutionIds: [],
    testExecutionDisplays: [],
    testSetIds: [],
    testSetDisplays: [],
    preconditionIds: [],
    preconditionDisplays: [],
    folderPath: '/',
    projectId: '',
  },
  status: 'draft',
  updatedAt: Date.now(),
  createdAt: Date.now(),
  isComplete: false,
  projectKey: 'WCP',
};

// Reusable TC draft with empty xrayLinking (saved before link pre-population fix)
const mockReusableDraft = {
  ...mockDraft,
  id: REUSABLE_DRAFT_ID,
  summary: 'Organization | UI | REUSE Login Test',
  isReusable: true,
  sourceTestKey: 'WCP-9448',
  sourceTestIssueId: '99001',
};

// Reusable TC draft that already has saved links
const mockReusableDraftWithLinks = {
  ...mockReusableDraft,
  id: 'test-draft-with-links',
  xrayLinking: {
    testPlanIds: ['20001'],
    testPlanDisplays: [{ id: '20001', display: 'WCP-8000: Saved Plan' }],
    testExecutionIds: ['20002'],
    testExecutionDisplays: [{ id: '20002', display: 'WCP-8001: Saved Execution' }],
    testSetIds: ['20003'],
    testSetDisplays: [{ id: '20003', display: 'WCP-8002: Saved Set' }],
    preconditionIds: [],
    preconditionDisplays: [],
    folderPath: '/Saved/Path',
    projectId: 'proj-123',
  },
};

const mockTestLinks = {
  issueId: '99001',
  key: 'WCP-9448',
  testPlans: [{ issueId: '10001', key: 'WCP-7067', summary: 'Sprint 1 Test Plan' }],
  testExecutions: [{ issueId: '10003', key: 'WCP-7069', summary: 'Release 1.0 Execution' }],
  testSets: [{ issueId: '10004', key: 'WCP-7154', summary: 'Smoke Tests' }],
  preconditions: [{ issueId: '10006', key: 'WCP-9209', summary: 'User is logged in' }],
  folder: '/WCP/UI/Feature',
};

const mockTestPlans = [
  { issueId: '10001', key: 'WCP-7067', summary: 'Sprint 1 Test Plan' },
  { issueId: '10002', key: 'WCP-7068', summary: 'Sprint 2 Test Plan' },
];

const mockTestExecutions = [
  { issueId: '10003', key: 'WCP-7069', summary: 'Release 1.0 Execution' },
];

const mockTestSets = [
  { issueId: '10004', key: 'WCP-7154', summary: 'Smoke Tests' },
];

const mockPreconditions = [
  { issueId: '10006', key: 'WCP-9209', summary: 'User is logged in' },
];

const mockFolders = {
  name: 'Root',
  path: '/',
  folders: [
    { name: 'UI', path: '/UI', folders: [] },
  ],
  projectId: 'proj-123',
};

function renderEditTestCase(draftId: string = DRAFT_ID) {
  return render(
    <MemoryRouter initialEntries={[`/test-cases/${draftId}/edit`]}>
      <ThemeProvider>
        <AppProvider>
          <Routes>
            <Route path="/test-cases/:id/edit" element={<EditTestCase />} />
            <Route path="/test-cases" element={<div>Test Cases List</div>} />
          </Routes>
        </AppProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

async function navigateToStep3() {
  // Click Next from step 1 to step 2
  await waitFor(() => {
    expect(screen.getByText('Next →')).toBeInTheDocument();
  });
  fireEvent.click(screen.getByText('Next →'));

  // Wait for step 2
  await waitFor(() => {
    expect(screen.getByText('+ Add Step')).toBeInTheDocument();
  });

  // Click Next from step 2 to step 3
  fireEvent.click(screen.getByText('Next →'));

  // Wait for step 3 — look for the Folder Path label which only appears in step 3 content
  await waitFor(() => {
    expect(screen.getByText('Folder Path')).toBeInTheDocument();
  });
}

describe('EditTestCase', () => {
  beforeEach(() => {
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
      http.get('*/api/drafts', () => HttpResponse.json([mockDraft])),
      http.get(`*/api/drafts/${DRAFT_ID}`, () => HttpResponse.json(mockDraft)),
    );
  });

  describe('TC-Edit-U001: Xray entities load in Edit mode', () => {
    beforeEach(() => {
      server.use(
        http.get('*/api/xray/test-plans/:projectKey', () => HttpResponse.json(mockTestPlans)),
        http.get('*/api/xray/test-executions/:projectKey', () => HttpResponse.json(mockTestExecutions)),
        http.get('*/api/xray/test-sets/:projectKey', () => HttpResponse.json(mockTestSets)),
        http.get('*/api/xray/preconditions/:projectKey', () => HttpResponse.json(mockPreconditions)),
        http.get('*/api/xray/project-id/:projectKey', () => HttpResponse.json({ projectId: 'proj-123' })),
        http.get('*/api/xray/folders/:projectId', () => HttpResponse.json(mockFolders)),
      );
    });

    it('loads and displays test plans in dropdown on step 3', async () => {
      const user = userEvent.setup();
      renderEditTestCase();

      // Wait for draft to load
      await waitFor(() => {
        expect(screen.getByText('Edit Test Case')).toBeInTheDocument();
      });

      await navigateToStep3();

      // Wait for Xray entities to load
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Open Test Plans dropdown
      const comboboxes = screen.getAllByRole('combobox');
      await user.click(comboboxes[0]);

      // Should show test plan options
      await waitFor(() => {
        expect(screen.getByText('WCP-7067')).toBeInTheDocument();
      });
    });

    it('loads and displays test executions in dropdown', async () => {
      const user = userEvent.setup();
      renderEditTestCase();

      await waitFor(() => {
        expect(screen.getByText('Edit Test Case')).toBeInTheDocument();
      });

      await navigateToStep3();

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      const comboboxes = screen.getAllByRole('combobox');
      await user.click(comboboxes[1]);

      await waitFor(() => {
        expect(screen.getByText('WCP-7069')).toBeInTheDocument();
      });
    });

    it('loads and displays test sets in dropdown', async () => {
      const user = userEvent.setup();
      renderEditTestCase();

      await waitFor(() => {
        expect(screen.getByText('Edit Test Case')).toBeInTheDocument();
      });

      await navigateToStep3();

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      const comboboxes = screen.getAllByRole('combobox');
      await user.click(comboboxes[2]);

      await waitFor(() => {
        expect(screen.getByText('WCP-7154')).toBeInTheDocument();
      });
    });

    it('loads and displays preconditions in dropdown', async () => {
      const user = userEvent.setup();
      renderEditTestCase();

      await waitFor(() => {
        expect(screen.getByText('Edit Test Case')).toBeInTheDocument();
      });

      await navigateToStep3();

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      const comboboxes = screen.getAllByRole('combobox');
      await user.click(comboboxes[3]);

      await waitFor(() => {
        expect(screen.getByText('WCP-9209')).toBeInTheDocument();
      });
    });
  });

  describe('TC-Edit-U002: Reusable TC Xray link pre-population on Edit', () => {
    beforeEach(() => {
      // Xray cache endpoints (dropdown options)
      server.use(
        http.get('*/api/xray/test-plans/:projectKey', () => HttpResponse.json(mockTestPlans)),
        http.get('*/api/xray/test-executions/:projectKey', () => HttpResponse.json(mockTestExecutions)),
        http.get('*/api/xray/test-sets/:projectKey', () => HttpResponse.json(mockTestSets)),
        http.get('*/api/xray/preconditions/:projectKey', () => HttpResponse.json(mockPreconditions)),
        http.get('*/api/xray/project-id/:projectKey', () => HttpResponse.json({ projectId: 'proj-123' })),
        http.get('*/api/xray/folders/:projectId', () => HttpResponse.json(mockFolders)),
        // Test links endpoint
        http.get('*/api/xray/tests/:issueId/links', () => HttpResponse.json(mockTestLinks)),
      );
    });

    it('fetches and displays Xray links as tags for reusable TC with empty linking', async () => {
      // Serve the reusable draft with empty xrayLinking
      server.use(
        http.get(`*/api/drafts/${REUSABLE_DRAFT_ID}`, () => HttpResponse.json(mockReusableDraft)),
        http.get('*/api/drafts', () => HttpResponse.json([mockReusableDraft])),
      );

      renderEditTestCase(REUSABLE_DRAFT_ID);

      await waitFor(() => {
        expect(screen.getByText('Edit Test Case')).toBeInTheDocument();
      });

      await navigateToStep3();

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Verify all 4 link tags are pre-populated from Xray
      await waitFor(() => {
        expect(screen.getByText('WCP-7067')).toBeInTheDocument(); // Test Plan
        expect(screen.getByText('WCP-7069')).toBeInTheDocument(); // Test Execution
        expect(screen.getByText('WCP-7154')).toBeInTheDocument(); // Test Set
        expect(screen.getByText('WCP-9209')).toBeInTheDocument(); // Precondition
      });
    });

    it('pre-populates folder path from Xray links', async () => {
      server.use(
        http.get(`*/api/drafts/${REUSABLE_DRAFT_ID}`, () => HttpResponse.json(mockReusableDraft)),
        http.get('*/api/drafts', () => HttpResponse.json([mockReusableDraft])),
      );

      renderEditTestCase(REUSABLE_DRAFT_ID);

      await waitFor(() => {
        expect(screen.getByText('Edit Test Case')).toBeInTheDocument();
      });

      await navigateToStep3();

      // Folder path should be set from fetched links
      await waitFor(() => {
        expect(screen.getByText('/WCP/UI/Feature')).toBeInTheDocument();
      });
    });

    it('shows "Editing WCP-9448" badge for reusable TC', async () => {
      server.use(
        http.get(`*/api/drafts/${REUSABLE_DRAFT_ID}`, () => HttpResponse.json(mockReusableDraft)),
        http.get('*/api/drafts', () => HttpResponse.json([mockReusableDraft])),
      );

      renderEditTestCase(REUSABLE_DRAFT_ID);

      await waitFor(() => {
        expect(screen.getByText('Editing WCP-9448')).toBeInTheDocument();
      });
    });

    it('shows "Update in Xray" button for reusable TC on step 3', async () => {
      server.use(
        http.get(`*/api/drafts/${REUSABLE_DRAFT_ID}`, () => HttpResponse.json(mockReusableDraft)),
        http.get('*/api/drafts', () => HttpResponse.json([mockReusableDraft])),
      );

      renderEditTestCase(REUSABLE_DRAFT_ID);

      await waitFor(() => {
        expect(screen.getByText('Edit Test Case')).toBeInTheDocument();
      });

      await navigateToStep3();

      expect(screen.getByText('Update in Xray')).toBeInTheDocument();
      expect(screen.queryByText('Import to Xray')).not.toBeInTheDocument();
    });

    it('does NOT overwrite existing saved links', async () => {
      const draftId = mockReusableDraftWithLinks.id;
      server.use(
        http.get(`*/api/drafts/${draftId}`, () => HttpResponse.json(mockReusableDraftWithLinks)),
        http.get('*/api/drafts', () => HttpResponse.json([mockReusableDraftWithLinks])),
      );

      renderEditTestCase(draftId);

      await waitFor(() => {
        expect(screen.getByText('Edit Test Case')).toBeInTheDocument();
      });

      await navigateToStep3();

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Should show the SAVED links, not the Xray-fetched ones
      expect(screen.getByText('WCP-8000')).toBeInTheDocument(); // Saved Plan
      expect(screen.getByText('WCP-8001')).toBeInTheDocument(); // Saved Execution
      expect(screen.getByText('WCP-8002')).toBeInTheDocument(); // Saved Set
      expect(screen.getByText('/Saved/Path')).toBeInTheDocument();

      // Should NOT show Xray-fetched links
      expect(screen.queryByText('WCP-7067')).not.toBeInTheDocument();
      expect(screen.queryByText('WCP-7069')).not.toBeInTheDocument();
    });

    it('handles getTestLinks API failure gracefully — no crash, links stay empty', async () => {
      server.use(
        http.get(`*/api/drafts/${REUSABLE_DRAFT_ID}`, () => HttpResponse.json(mockReusableDraft)),
        http.get('*/api/drafts', () => HttpResponse.json([mockReusableDraft])),
        // Override links endpoint to fail
        http.get('*/api/xray/tests/:issueId/links', () => {
          return HttpResponse.json({ error: 'Server error' }, { status: 500 });
        }),
      );

      renderEditTestCase(REUSABLE_DRAFT_ID);

      await waitFor(() => {
        expect(screen.getByText('Edit Test Case')).toBeInTheDocument();
      });

      await navigateToStep3();

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // No link tags should be shown since API failed
      expect(screen.queryByText('WCP-7067')).not.toBeInTheDocument();
      expect(screen.queryByText('WCP-7069')).not.toBeInTheDocument();
      expect(screen.queryByText('WCP-7154')).not.toBeInTheDocument();
      expect(screen.queryByText('WCP-9209')).not.toBeInTheDocument();
    });

    it('does NOT fetch links for non-reusable drafts', async () => {
      // mockDraft is non-reusable — should not attempt to fetch links
      // If it did, it would crash since sourceTestIssueId is undefined
      renderEditTestCase();

      await waitFor(() => {
        expect(screen.getByText('Edit Test Case')).toBeInTheDocument();
      });

      await navigateToStep3();

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // No link tags — the non-reusable draft has empty xrayLinking
      expect(screen.queryByText('WCP-7067')).not.toBeInTheDocument();
    });
  });
});

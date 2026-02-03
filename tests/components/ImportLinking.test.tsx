import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, fireEvent } from '../helpers/render';
import { EditTestCase } from '../../client/src/components/features/create/EditTestCase';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '../../client/src/context/ThemeContext';
import { AppProvider } from '../../client/src/context/AppContext';
import { render } from '@testing-library/react';

// Mock draft with xray linking - status 'draft' so user can navigate steps
const mockDraft = {
  id: 'test-draft-1',
  summary: 'Test Case Summary',
  description: 'Test description',
  testType: 'Manual' as const,
  priority: 'Medium',
  labels: ['regression'],
  collectionId: null,
  steps: [
    { id: 'step-1', action: 'Do something', data: '', result: 'Something happens' },
  ],
  xrayLinking: {
    testPlanIds: ['10001', '10002'],
    testPlanDisplays: [
      { id: '10001', display: 'WCP-7067: Sprint 1 Plan' },
      { id: '10002', display: 'WCP-7068: Sprint 2 Plan' },
    ],
    testExecutionIds: ['10003'],
    testExecutionDisplays: [
      { id: '10003', display: 'WCP-7069: Execution 1' },
    ],
    testSetIds: ['10004'],
    testSetDisplays: [
      { id: '10004', display: 'WCP-7154: Test Set 1' },
    ],
    preconditionIds: ['10005'],
    preconditionDisplays: [
      { id: '10005', display: 'WCP-9209: Precondition 1' },
    ],
    folderPath: '/WCP/UI/Feature',
    projectId: 'proj-123',
  },
  status: 'draft' as const,
  updatedAt: Date.now(),
  createdAt: Date.now() - 100000,
  isComplete: false,
  projectKey: 'WCP',
};

// Helper to render EditTestCase with route params
function renderEditTestCase(draftId: string = 'test-draft-1') {
  return render(
    <MemoryRouter initialEntries={[`/test-cases/${draftId}`]}>
      <ThemeProvider>
        <AppProvider>
          <Routes>
            <Route path="/test-cases/:id" element={<EditTestCase />} />
            <Route path="/test-cases" element={<div>Test Cases List</div>} />
          </Routes>
        </AppProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

// Helper to navigate to step 3 (Xray Linking)
async function navigateToStep3() {
  // Click on "Xray Linking" step indicator directly
  const xrayLinkingButton = screen.getByText('Xray Linking');
  fireEvent.click(xrayLinkingButton);

  await waitFor(() => {
    expect(screen.getByText('Import to Xray')).toBeInTheDocument();
  });
}

// Helper to click Import (starts immediately, no confirmation needed)
async function clickImport() {
  // Click "Import to Xray" button - import starts immediately
  fireEvent.click(screen.getByText('Import to Xray'));

  // Wait for progress modal to appear
  await waitFor(() => {
    expect(screen.getByText('One-Click Import')).toBeInTheDocument();
  });
}

describe('Import and Linking', () => {
  beforeEach(() => {
    // Setup default MSW handlers
    server.use(
      // Config
      http.get('*/api/config', () => {
        return HttpResponse.json({
          configured: true,
          jiraBaseUrl: 'https://test.atlassian.net/',
          hasCredentials: true,
        });
      }),
      // Settings
      http.get('*/api/settings', () => {
        return HttpResponse.json({
          projects: ['WCP'],
          hiddenProjects: [],
          activeProject: 'WCP',
          projectSettings: { WCP: { color: '#3B82F6' } },
        });
      }),
      // Draft
      http.get('*/api/drafts/:id', () => {
        return HttpResponse.json(mockDraft);
      }),
      // All drafts
      http.get('*/api/drafts', () => {
        return HttpResponse.json([mockDraft]);
      }),
      // Update draft
      http.put('*/api/drafts/:id', () => {
        return HttpResponse.json({ success: true, draft: mockDraft });
      }),
      // Project settings
      http.get('*/api/settings/projects/:key', () => {
        return HttpResponse.json({ color: '#3B82F6' });
      }),
      // Xray entities
      http.get('*/api/xray/test-plans/*', () => {
        return HttpResponse.json([
          { issueId: '10001', key: 'WCP-7067', summary: 'Sprint 1 Plan', testCount: 5 },
          { issueId: '10002', key: 'WCP-7068', summary: 'Sprint 2 Plan', testCount: 3 },
        ]);
      }),
      http.get('*/api/xray/test-executions/*', () => {
        return HttpResponse.json([
          { issueId: '10003', key: 'WCP-7069', summary: 'Execution 1', totalTests: 10, statuses: [] },
        ]);
      }),
      http.get('*/api/xray/test-sets/*', () => {
        return HttpResponse.json([
          { issueId: '10004', key: 'WCP-7154', summary: 'Test Set 1', testCount: 8 },
        ]);
      }),
      http.get('*/api/xray/preconditions/*', () => {
        return HttpResponse.json([
          { issueId: '10005', key: 'WCP-9209', summary: 'Precondition 1' },
        ]);
      }),
      http.get('*/api/xray/folders/*', () => {
        return HttpResponse.json({ path: '/', name: 'Root', children: [] });
      }),
      http.get('*/api/xray/project-id/*', () => {
        return HttpResponse.json({ projectId: 'proj-123' });
      }),
      http.get('*/api/xray/tests/by-status/*', () => {
        return HttpResponse.json([]);
      }),
    );
  });

  describe('Successful Import with All Links', () => {
    it('imports test case and creates all links successfully', async () => {
      const linkingCalls: string[] = [];

      server.use(
        // Import endpoint
        http.post('*/api/xray/import', () => {
          return HttpResponse.json({
            success: true,
            testIssueIds: ['new-test-123'],
            testKeys: ['WCP-9999'],
          });
        }),
        // Test plan linking
        http.post('*/api/xray/test-plans/:id/add-tests', ({ params }) => {
          linkingCalls.push(`test-plan-${params.id}`);
          return HttpResponse.json({ addedTests: 1 });
        }),
        // Test execution linking
        http.post('*/api/xray/test-executions/:id/add-tests', ({ params }) => {
          linkingCalls.push(`test-execution-${params.id}`);
          return HttpResponse.json({ addedTests: 1 });
        }),
        // Test set linking
        http.post('*/api/xray/test-sets/:id/add-tests', ({ params }) => {
          linkingCalls.push(`test-set-${params.id}`);
          return HttpResponse.json({ addedTests: 1 });
        }),
        // Folder linking
        http.post('*/api/xray/folders/add-tests', () => {
          linkingCalls.push('folder');
          return HttpResponse.json({ addedTests: 1 });
        }),
        // Precondition linking
        http.post('*/api/xray/tests/:id/add-preconditions', () => {
          linkingCalls.push('preconditions');
          return HttpResponse.json({ addedPreconditions: 1 });
        }),
      );

      renderEditTestCase();

      // Wait for draft to load
      await waitFor(() => {
        expect(screen.getByText('Test Case Summary')).toBeInTheDocument();
      });

      // Navigate to step 3 (Xray Linking)
      await navigateToStep3();

      // Click Import and confirm in modal
      await clickImport();

      // Wait for success
      await waitFor(() => {
        expect(screen.getAllByText(/WCP-9999/).length).toBeGreaterThan(0);
      }, { timeout: 5000 });

      // Verify all linking endpoints were called
      expect(linkingCalls).toContain('test-plan-10001');
      expect(linkingCalls).toContain('test-plan-10002');
      expect(linkingCalls).toContain('test-execution-10003');
      expect(linkingCalls).toContain('test-set-10004');
      expect(linkingCalls).toContain('folder');
      expect(linkingCalls).toContain('preconditions');
    });
  });

  describe('Partial Linking Failures', () => {
    it('shows warning when some linking operations fail but continues with others', async () => {
      const linkingCalls: string[] = [];

      server.use(
        http.post('*/api/xray/import', () => {
          return HttpResponse.json({
            success: true,
            testIssueIds: ['new-test-123'],
            testKeys: ['WCP-9999'],
          });
        }),
        // First test plan succeeds
        http.post('*/api/xray/test-plans/10001/add-tests', () => {
          linkingCalls.push('test-plan-10001');
          return HttpResponse.json({ addedTests: 1 });
        }),
        // Second test plan fails
        http.post('*/api/xray/test-plans/10002/add-tests', () => {
          linkingCalls.push('test-plan-10002-failed');
          return HttpResponse.json({ error: 'Permission denied' }, { status: 500 });
        }),
        // Test execution succeeds
        http.post('*/api/xray/test-executions/:id/add-tests', () => {
          linkingCalls.push('test-execution');
          return HttpResponse.json({ addedTests: 1 });
        }),
        // Test set succeeds
        http.post('*/api/xray/test-sets/:id/add-tests', () => {
          linkingCalls.push('test-set');
          return HttpResponse.json({ addedTests: 1 });
        }),
        // Folder succeeds
        http.post('*/api/xray/folders/add-tests', () => {
          linkingCalls.push('folder');
          return HttpResponse.json({ addedTests: 1 });
        }),
        // Preconditions succeed
        http.post('*/api/xray/tests/:id/add-preconditions', () => {
          linkingCalls.push('preconditions');
          return HttpResponse.json({ addedPreconditions: 1 });
        }),
      );

      renderEditTestCase();

      await waitFor(() => {
        expect(screen.getByText('Test Case Summary')).toBeInTheDocument();
      });

      // Navigate to step 3
      await navigateToStep3();

      // Click Import and confirm in modal
      await clickImport();

      // Should still show success (TC was created)
      await waitFor(() => {
        expect(screen.getAllByText(/WCP-9999/).length).toBeGreaterThan(0);
      }, { timeout: 5000 });

      // Other links should have been attempted
      expect(linkingCalls).toContain('test-plan-10001');
      expect(linkingCalls).toContain('test-execution');
      expect(linkingCalls).toContain('test-set');
    });

    it('attempts all linking operations even when first one fails (Promise.allSettled behavior)', async () => {
      const linkingCalls: string[] = [];

      server.use(
        http.post('*/api/xray/import', () => {
          return HttpResponse.json({
            success: true,
            testIssueIds: ['new-test-123'],
            testKeys: ['WCP-9999'],
          });
        }),
        // ALL test plan calls fail
        http.post('*/api/xray/test-plans/:id/add-tests', ({ params }) => {
          linkingCalls.push(`test-plan-${params.id}`);
          return HttpResponse.json({ error: 'Failed' }, { status: 500 });
        }),
        // Test execution should still be called
        http.post('*/api/xray/test-executions/:id/add-tests', ({ params }) => {
          linkingCalls.push(`test-execution-${params.id}`);
          return HttpResponse.json({ addedTests: 1 });
        }),
        // Test set should still be called
        http.post('*/api/xray/test-sets/:id/add-tests', ({ params }) => {
          linkingCalls.push(`test-set-${params.id}`);
          return HttpResponse.json({ addedTests: 1 });
        }),
        // Folder should still be called
        http.post('*/api/xray/folders/add-tests', () => {
          linkingCalls.push('folder');
          return HttpResponse.json({ addedTests: 1 });
        }),
        // Preconditions should still be called
        http.post('*/api/xray/tests/:id/add-preconditions', () => {
          linkingCalls.push('preconditions');
          return HttpResponse.json({ addedPreconditions: 1 });
        }),
      );

      renderEditTestCase();

      await waitFor(() => {
        expect(screen.getByText('Test Case Summary')).toBeInTheDocument();
      });

      // Navigate to step 3
      await navigateToStep3();

      // Click Import and confirm in modal
      await clickImport();

      // Wait for import to complete
      await waitFor(() => {
        expect(screen.getAllByText(/WCP-9999/).length).toBeGreaterThan(0);
      }, { timeout: 5000 });

      // Verify ALL linking operations were attempted despite failures
      // This is the key test for Promise.allSettled behavior
      expect(linkingCalls).toContain('test-plan-10001');
      expect(linkingCalls).toContain('test-plan-10002');
      expect(linkingCalls).toContain('test-execution-10003');
      expect(linkingCalls).toContain('test-set-10004');
      expect(linkingCalls).toContain('folder');
      expect(linkingCalls).toContain('preconditions');
    });
  });

  describe('Zero Added Items Warning', () => {
    it('handles API returning addedTests: 0 gracefully', async () => {
      server.use(
        http.post('*/api/xray/import', () => {
          return HttpResponse.json({
            success: true,
            testIssueIds: ['new-test-123'],
            testKeys: ['WCP-9999'],
          });
        }),
        // Returns success but addedTests: 0 (already linked)
        http.post('*/api/xray/test-plans/:id/add-tests', () => {
          return HttpResponse.json({ addedTests: 0, warning: 'Test already linked' });
        }),
        http.post('*/api/xray/test-executions/:id/add-tests', () => {
          return HttpResponse.json({ addedTests: 1 });
        }),
        http.post('*/api/xray/test-sets/:id/add-tests', () => {
          return HttpResponse.json({ addedTests: 1 });
        }),
        http.post('*/api/xray/folders/add-tests', () => {
          return HttpResponse.json({ addedTests: 1 });
        }),
        http.post('*/api/xray/tests/:id/add-preconditions', () => {
          return HttpResponse.json({ addedPreconditions: 1 });
        }),
      );

      renderEditTestCase();

      await waitFor(() => {
        expect(screen.getByText('Test Case Summary')).toBeInTheDocument();
      });

      // Navigate to step 3 and import
      await navigateToStep3();

      // Click Import and confirm in modal
      await clickImport();

      // Should still succeed
      await waitFor(() => {
        expect(screen.getAllByText(/WCP-9999/).length).toBeGreaterThan(0);
      }, { timeout: 5000 });
    });
  });

  describe('Import Failure', () => {
    it('shows error when import fails', async () => {
      server.use(
        http.post('*/api/xray/import', () => {
          return HttpResponse.json({
            success: false,
            error: 'Xray API unavailable',
          });
        }),
      );

      renderEditTestCase();

      await waitFor(() => {
        expect(screen.getByText('Test Case Summary')).toBeInTheDocument();
      });

      // Navigate to step 3
      await navigateToStep3();

      // Click Import and confirm in modal
      await clickImport();

      // Should show error in the modal's complete state (Import Failed)
      await waitFor(() => {
        expect(screen.getByText('Import Failed')).toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });

  describe('Optional Preconditions', () => {
    it('skips precondition linking when none selected', async () => {
      const linkingCalls: string[] = [];

      // Draft without preconditions
      const draftNoPreconditions = {
        ...mockDraft,
        xrayLinking: {
          ...mockDraft.xrayLinking,
          preconditionIds: [],
          preconditionDisplays: [],
        },
      };

      server.use(
        http.get('*/api/drafts/:id', () => {
          return HttpResponse.json(draftNoPreconditions);
        }),
        http.get('*/api/drafts', () => {
          return HttpResponse.json([draftNoPreconditions]);
        }),
        http.post('*/api/xray/import', () => {
          return HttpResponse.json({
            success: true,
            testIssueIds: ['new-test-123'],
            testKeys: ['WCP-9999'],
          });
        }),
        http.post('*/api/xray/test-plans/:id/add-tests', () => {
          linkingCalls.push('test-plan');
          return HttpResponse.json({ addedTests: 1 });
        }),
        http.post('*/api/xray/test-executions/:id/add-tests', () => {
          linkingCalls.push('test-execution');
          return HttpResponse.json({ addedTests: 1 });
        }),
        http.post('*/api/xray/test-sets/:id/add-tests', () => {
          linkingCalls.push('test-set');
          return HttpResponse.json({ addedTests: 1 });
        }),
        http.post('*/api/xray/folders/add-tests', () => {
          linkingCalls.push('folder');
          return HttpResponse.json({ addedTests: 1 });
        }),
        http.post('*/api/xray/tests/:id/add-preconditions', () => {
          linkingCalls.push('preconditions');
          return HttpResponse.json({ addedPreconditions: 1 });
        }),
      );

      renderEditTestCase();

      await waitFor(() => {
        expect(screen.getByText('Test Case Summary')).toBeInTheDocument();
      });

      // Navigate to step 3 and import
      await navigateToStep3();

      // Click Import and confirm in modal
      await clickImport();

      await waitFor(() => {
        expect(screen.getAllByText(/WCP-9999/).length).toBeGreaterThan(0);
      }, { timeout: 5000 });

      // Preconditions should NOT have been called
      expect(linkingCalls).not.toContain('preconditions');
      // But other links should have been made
      expect(linkingCalls).toContain('test-plan');
      expect(linkingCalls).toContain('test-execution');
      expect(linkingCalls).toContain('test-set');
      expect(linkingCalls).toContain('folder');
    });
  });

  describe('Summary Title Validation', () => {
    it('disables Save & Mark Ready when Title is missing (only Area + Layer)', async () => {
      // Draft with summary that has Area | Layer but no Title
      const draftNoTitle = {
        ...mockDraft,
        summary: 'Organization | UI', // Missing title - should fail validation
      };

      server.use(
        http.get('*/api/drafts/:id', () => {
          return HttpResponse.json(draftNoTitle);
        }),
        http.get('*/api/drafts', () => {
          return HttpResponse.json([draftNoTitle]);
        }),
      );

      renderEditTestCase();

      await waitFor(() => {
        expect(screen.getByText('Edit Test Case')).toBeInTheDocument();
      });

      // Navigate to step 3
      await navigateToStep3();

      // "Save & Mark Ready" button should be disabled because Title is missing
      const saveReadyButton = screen.getByText('Save & Mark Ready');
      expect(saveReadyButton).toBeDisabled();
    });

    it('disables Import when Title is missing', async () => {
      const draftNoTitle = {
        ...mockDraft,
        summary: 'Feature | API', // Missing title
      };

      server.use(
        http.get('*/api/drafts/:id', () => {
          return HttpResponse.json(draftNoTitle);
        }),
        http.get('*/api/drafts', () => {
          return HttpResponse.json([draftNoTitle]);
        }),
      );

      renderEditTestCase();

      await waitFor(() => {
        expect(screen.getByText('Edit Test Case')).toBeInTheDocument();
      });

      // Navigate to step 3
      await navigateToStep3();

      // "Import to Xray" button should be disabled because Title is missing
      const importButton = screen.getByText('Import to Xray');
      expect(importButton).toBeDisabled();
    });

    it('allows Save & Mark Ready when Title is present (full summary)', async () => {
      // Draft with complete summary: Area | Layer | Title
      const draftWithTitle = {
        ...mockDraft,
        summary: 'Organization | UI | Login Form Validation',
      };

      server.use(
        http.get('*/api/drafts/:id', () => {
          return HttpResponse.json(draftWithTitle);
        }),
        http.get('*/api/drafts', () => {
          return HttpResponse.json([draftWithTitle]);
        }),
        http.put('*/api/drafts/:id', () => {
          return HttpResponse.json({ success: true, draft: { ...draftWithTitle, status: 'ready' } });
        }),
      );

      renderEditTestCase();

      await waitFor(() => {
        expect(screen.getByText('Edit Test Case')).toBeInTheDocument();
      });

      // Navigate to step 3
      await navigateToStep3();

      // Click "Save & Mark Ready" - should NOT show validation error
      const saveReadyButton = screen.getByText('Save & Mark Ready');
      fireEvent.click(saveReadyButton);

      // Should not show "Title is required" error
      await waitFor(() => {
        // Check that we don't get redirected to step 1 with error
        // The button should be in saving state or navigation should happen
        const titleError = screen.queryByText('Title is required');
        expect(titleError).not.toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('allows summary with just a Title (no Functional Area)', async () => {
      // Draft with just a title (valid - no area selected)
      const draftJustTitle = {
        ...mockDraft,
        summary: 'Login Form Validation Test',
      };

      server.use(
        http.get('*/api/drafts/:id', () => {
          return HttpResponse.json(draftJustTitle);
        }),
        http.get('*/api/drafts', () => {
          return HttpResponse.json([draftJustTitle]);
        }),
        http.put('*/api/drafts/:id', () => {
          return HttpResponse.json({ success: true, draft: { ...draftJustTitle, status: 'ready' } });
        }),
      );

      renderEditTestCase();

      await waitFor(() => {
        expect(screen.getByText('Edit Test Case')).toBeInTheDocument();
      });

      // Navigate to step 3
      await navigateToStep3();

      // Click "Save & Mark Ready"
      const saveReadyButton = screen.getByText('Save & Mark Ready');
      fireEvent.click(saveReadyButton);

      // Should NOT show validation error - single-part summary is valid
      await waitFor(() => {
        const titleError = screen.queryByText('Title is required');
        expect(titleError).not.toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('disables buttons with Area | Layer | empty Title', async () => {
      // Draft with empty title portion
      const draftEmptyTitle = {
        ...mockDraft,
        summary: 'Organization | UI | ', // Empty title portion
      };

      server.use(
        http.get('*/api/drafts/:id', () => {
          return HttpResponse.json(draftEmptyTitle);
        }),
        http.get('*/api/drafts', () => {
          return HttpResponse.json([draftEmptyTitle]);
        }),
      );

      renderEditTestCase();

      await waitFor(() => {
        expect(screen.getByText('Edit Test Case')).toBeInTheDocument();
      });

      // Navigate to step 3
      await navigateToStep3();

      // Both buttons should be disabled because Title is empty
      const saveReadyButton = screen.getByText('Save & Mark Ready');
      const importButton = screen.getByText('Import to Xray');
      expect(saveReadyButton).toBeDisabled();
      expect(importButton).toBeDisabled();
    });
  });

  describe('Linking Operation Labels', () => {
    it('completes import with all linking operations', async () => {
      server.use(
        http.post('*/api/xray/import', () => {
          return HttpResponse.json({
            success: true,
            testIssueIds: ['new-test-123'],
            testKeys: ['WCP-9999'],
          });
        }),
        // All linking succeeds
        http.post('*/api/xray/test-plans/:id/add-tests', () => {
          return HttpResponse.json({ addedTests: 1 });
        }),
        http.post('*/api/xray/test-executions/:id/add-tests', () => {
          return HttpResponse.json({ addedTests: 1 });
        }),
        http.post('*/api/xray/test-sets/:id/add-tests', () => {
          return HttpResponse.json({ addedTests: 1 });
        }),
        http.post('*/api/xray/folders/add-tests', () => {
          return HttpResponse.json({ addedTests: 1 });
        }),
        http.post('*/api/xray/tests/:id/add-preconditions', () => {
          return HttpResponse.json({ addedPreconditions: 1 });
        }),
      );

      renderEditTestCase();

      await waitFor(() => {
        expect(screen.getByText('Test Case Summary')).toBeInTheDocument();
      });

      // Navigate and import
      await navigateToStep3();

      // Click Import and confirm in modal
      await clickImport();

      // Success - test key shown
      await waitFor(() => {
        expect(screen.getAllByText(/WCP-9999/).length).toBeGreaterThan(0);
      }, { timeout: 5000 });
    });
  });

  describe('Save Draft Validation', () => {
    it('enables Update Draft when at least one required field has content', async () => {
      // Draft with only summary filled
      const draftWithSummary = {
        ...mockDraft,
        summary: 'Test Summary',
        description: '',
        steps: [{ id: 'step-1', action: '', data: '', result: '' }],
      };

      server.use(
        http.get('*/api/drafts/:id', () => {
          return HttpResponse.json(draftWithSummary);
        }),
        http.get('*/api/drafts', () => {
          return HttpResponse.json([draftWithSummary]);
        }),
      );

      renderEditTestCase();

      await waitFor(() => {
        expect(screen.getByText('Edit Test Case')).toBeInTheDocument();
      });

      // Make a change to enable hasChanges
      const descField = screen.getByPlaceholderText('Detailed description of the test case...');
      fireEvent.change(descField, { target: { value: 'x' } });
      fireEvent.change(descField, { target: { value: '' } });

      // Update Draft button should be enabled because summary has content
      const updateDraftButton = screen.getByText('Update Draft');
      expect(updateDraftButton).not.toBeDisabled();
    });

    it('disables Update Draft when ALL required fields are empty', async () => {
      // Draft with all fields empty
      const emptyDraft = {
        ...mockDraft,
        summary: '',
        description: '',
        steps: [{ id: 'step-1', action: '', data: '', result: '' }],
      };

      server.use(
        http.get('*/api/drafts/:id', () => {
          return HttpResponse.json(emptyDraft);
        }),
        http.get('*/api/drafts', () => {
          return HttpResponse.json([emptyDraft]);
        }),
      );

      renderEditTestCase();

      await waitFor(() => {
        expect(screen.getByText('Edit Test Case')).toBeInTheDocument();
      });

      // Update Draft button should be disabled because all required fields are empty
      const updateDraftButton = screen.getByText('Update Draft');
      expect(updateDraftButton).toBeDisabled();
    });

    it('enables Update Draft when only description has content', async () => {
      const draftWithDesc = {
        ...mockDraft,
        summary: '',
        description: 'Test description only',
        steps: [{ id: 'step-1', action: '', data: '', result: '' }],
      };

      server.use(
        http.get('*/api/drafts/:id', () => {
          return HttpResponse.json(draftWithDesc);
        }),
        http.get('*/api/drafts', () => {
          return HttpResponse.json([draftWithDesc]);
        }),
      );

      renderEditTestCase();

      await waitFor(() => {
        expect(screen.getByText('Edit Test Case')).toBeInTheDocument();
      });

      // Make a small change
      const descField = screen.getByPlaceholderText('Detailed description of the test case...');
      fireEvent.change(descField, { target: { value: 'Test description only!' } });

      const updateDraftButton = screen.getByText('Update Draft');
      expect(updateDraftButton).not.toBeDisabled();
    });

    it('enables Update Draft when only step has content', async () => {
      const draftWithStep = {
        ...mockDraft,
        summary: '',
        description: '',
        steps: [{ id: 'step-1', action: 'Do something', data: '', result: '' }],
      };

      server.use(
        http.get('*/api/drafts/:id', () => {
          return HttpResponse.json(draftWithStep);
        }),
        http.get('*/api/drafts', () => {
          return HttpResponse.json([draftWithStep]);
        }),
      );

      renderEditTestCase();

      await waitFor(() => {
        expect(screen.getByText('Edit Test Case')).toBeInTheDocument();
      });

      // Step 2 button is not clickable because Step 1 is invalid (empty summary/description),
      // but canSaveDraft() checks step content from the draft data regardless of current form step.
      // We can verify the button state by making a change on Step 1 to trigger hasChanges.
      const descField = screen.getByPlaceholderText('Detailed description of the test case...');
      fireEvent.change(descField, { target: { value: 'x' } });
      fireEvent.change(descField, { target: { value: '' } }); // Back to empty to keep step content as only filled field

      // Update Draft button should be enabled because step has content (action: 'Do something')
      const updateDraftButton = screen.getByText('Update Draft');
      expect(updateDraftButton).not.toBeDisabled();
    });
  });

  describe('Import Progress Modal', () => {
    it('shows modal with title and subtitle when import starts', async () => {
      server.use(
        http.post('*/api/xray/import', () => {
          return HttpResponse.json({
            success: true,
            testIssueIds: ['new-test-123'],
            testKeys: ['WCP-9999'],
          });
        }),
        http.post('*/api/xray/test-plans/:id/add-tests', () => HttpResponse.json({ addedTests: 1 })),
        http.post('*/api/xray/test-executions/:id/add-tests', () => HttpResponse.json({ addedTests: 1 })),
        http.post('*/api/xray/test-sets/:id/add-tests', () => HttpResponse.json({ addedTests: 1 })),
        http.post('*/api/xray/folders/add-tests', () => HttpResponse.json({ addedTests: 1 })),
        http.post('*/api/xray/tests/:id/add-preconditions', () => HttpResponse.json({ addedPreconditions: 1 })),
      );

      renderEditTestCase();

      await waitFor(() => {
        expect(screen.getByText('Test Case Summary')).toBeInTheDocument();
      });

      await navigateToStep3();

      // Click Import - modal should open immediately
      fireEvent.click(screen.getByText('Import to Xray'));

      // Modal should be visible with title and subtitle
      await waitFor(() => {
        expect(screen.getByText('One-Click Import')).toBeInTheDocument();
        expect(screen.getByText('Seamless sync to Xray Cloud')).toBeInTheDocument();
      });
    });

    it('shows Import Complete with test key on success', async () => {
      server.use(
        http.post('*/api/xray/import', () => {
          return HttpResponse.json({
            success: true,
            testIssueIds: ['new-test-123'],
            testKeys: ['WCP-9999'],
          });
        }),
        http.post('*/api/xray/test-plans/:id/add-tests', () => HttpResponse.json({ addedTests: 1 })),
        http.post('*/api/xray/test-executions/:id/add-tests', () => HttpResponse.json({ addedTests: 1 })),
        http.post('*/api/xray/test-sets/:id/add-tests', () => HttpResponse.json({ addedTests: 1 })),
        http.post('*/api/xray/folders/add-tests', () => HttpResponse.json({ addedTests: 1 })),
        http.post('*/api/xray/tests/:id/add-preconditions', () => HttpResponse.json({ addedPreconditions: 1 })),
      );

      renderEditTestCase();

      await waitFor(() => {
        expect(screen.getByText('Test Case Summary')).toBeInTheDocument();
      });

      await navigateToStep3();
      await clickImport();

      // Should show success state
      await waitFor(() => {
        expect(screen.getByText('Import Complete!')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Should show test key
      expect(screen.getAllByText(/WCP-9999/).length).toBeGreaterThan(0);

      // Should show "created in Jira" message
      expect(screen.getByText(/created in Jira/)).toBeInTheDocument();

      // Should show Done button
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });

    it('shows Imported with Warnings on partial failure', async () => {
      server.use(
        http.post('*/api/xray/import', () => {
          return HttpResponse.json({
            success: true,
            testIssueIds: ['new-test-123'],
            testKeys: ['WCP-9999'],
          });
        }),
        // First test plan succeeds
        http.post('*/api/xray/test-plans/10001/add-tests', () => HttpResponse.json({ addedTests: 1 })),
        // Second test plan fails
        http.post('*/api/xray/test-plans/10002/add-tests', () => {
          return HttpResponse.json({ error: 'Permission denied' }, { status: 500 });
        }),
        http.post('*/api/xray/test-executions/:id/add-tests', () => HttpResponse.json({ addedTests: 1 })),
        http.post('*/api/xray/test-sets/:id/add-tests', () => HttpResponse.json({ addedTests: 1 })),
        http.post('*/api/xray/folders/add-tests', () => HttpResponse.json({ addedTests: 1 })),
        http.post('*/api/xray/tests/:id/add-preconditions', () => HttpResponse.json({ addedPreconditions: 1 })),
      );

      renderEditTestCase();

      await waitFor(() => {
        expect(screen.getByText('Test Case Summary')).toBeInTheDocument();
      });

      await navigateToStep3();
      await clickImport();

      // Should show partial success state
      await waitFor(() => {
        expect(screen.getByText('Imported with Warnings')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Should still show test key
      expect(screen.getAllByText(/WCP-9999/).length).toBeGreaterThan(0);

      // Should show "Failed to link" section
      expect(screen.getByText('Failed to link:')).toBeInTheDocument();
    });

    it('closes modal and shows imported view when Done is clicked', async () => {
      server.use(
        http.post('*/api/xray/import', () => {
          return HttpResponse.json({
            success: true,
            testIssueIds: ['new-test-123'],
            testKeys: ['WCP-9999'],
          });
        }),
        http.post('*/api/xray/test-plans/:id/add-tests', () => HttpResponse.json({ addedTests: 1 })),
        http.post('*/api/xray/test-executions/:id/add-tests', () => HttpResponse.json({ addedTests: 1 })),
        http.post('*/api/xray/test-sets/:id/add-tests', () => HttpResponse.json({ addedTests: 1 })),
        http.post('*/api/xray/folders/add-tests', () => HttpResponse.json({ addedTests: 1 })),
        http.post('*/api/xray/tests/:id/add-preconditions', () => HttpResponse.json({ addedPreconditions: 1 })),
      );

      renderEditTestCase();

      await waitFor(() => {
        expect(screen.getByText('Test Case Summary')).toBeInTheDocument();
      });

      await navigateToStep3();
      await clickImport();

      // Wait for success
      await waitFor(() => {
        expect(screen.getByText('Import Complete!')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Click Done button
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));

      // Modal should close and imported view should show
      await waitFor(() => {
        expect(screen.queryByText('One-Click Import')).not.toBeInTheDocument();
      });
    });

    it('shows linked items badges on success', async () => {
      server.use(
        http.post('*/api/xray/import', () => {
          return HttpResponse.json({
            success: true,
            testIssueIds: ['new-test-123'],
            testKeys: ['WCP-9999'],
          });
        }),
        http.post('*/api/xray/test-plans/:id/add-tests', () => HttpResponse.json({ addedTests: 1 })),
        http.post('*/api/xray/test-executions/:id/add-tests', () => HttpResponse.json({ addedTests: 1 })),
        http.post('*/api/xray/test-sets/:id/add-tests', () => HttpResponse.json({ addedTests: 1 })),
        http.post('*/api/xray/folders/add-tests', () => HttpResponse.json({ addedTests: 1 })),
        http.post('*/api/xray/tests/:id/add-preconditions', () => HttpResponse.json({ addedPreconditions: 1 })),
      );

      renderEditTestCase();

      await waitFor(() => {
        expect(screen.getByText('Test Case Summary')).toBeInTheDocument();
      });

      await navigateToStep3();
      await clickImport();

      // Wait for success
      await waitFor(() => {
        expect(screen.getByText('Import Complete!')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Should show linked items as badges (test plan displays from mock)
      await waitFor(() => {
        // Check for at least one linked item badge
        const badges = screen.getAllByText(/WCP-7067|WCP-7069|WCP-7154/);
        expect(badges.length).toBeGreaterThan(0);
      });
    });
  });
});

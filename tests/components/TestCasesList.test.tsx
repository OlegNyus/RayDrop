import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, renderWithRouter, fireEvent } from '../helpers/render';
import userEvent from '@testing-library/user-event';
import { TestCasesList } from '../../client/src/components/features/test-cases/TestCasesList';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';

describe('TestCasesList', () => {
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
          projects: ['TEST'],
          hiddenProjects: [],
          activeProject: 'TEST',
          projectSettings: { TEST: { color: '#3B82F6' } },
        });
      }),
      http.get('*/api/drafts', () => {
        return HttpResponse.json([
          {
            id: '1',
            summary: 'Ready Test Case 1',
            description: 'Description 1',
            status: 'ready',
            projectKey: 'TEST',
            steps: [{ id: 's1', action: 'Step action', result: 'Step result', data: '' }],
            labels: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
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
            },
          },
          {
            id: '2',
            summary: 'Ready Test Case 2',
            description: 'Description 2',
            status: 'ready',
            projectKey: 'TEST',
            steps: [{ id: 's2', action: 'Step action', result: 'Step result', data: '' }],
            labels: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
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
            },
          },
          {
            id: '3',
            summary: 'Draft Test Case',
            description: 'Draft Description',
            status: 'draft',
            projectKey: 'TEST',
            steps: [{ id: 's3', action: 'Step action', result: 'Step result', data: '' }],
            labels: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
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
            },
          },
        ]);
      }),
      // Xray endpoints for dashboard
      http.get('*/api/xray/test-executions/*', () => HttpResponse.json([])),
      http.get('*/api/xray/tests/by-status/*', () => HttpResponse.json([]))
    );
  });

  describe('Bulk Import Progress Modal', () => {
    it('shows progress modal when bulk importing', async () => {
      const user = userEvent.setup();

      server.use(
        http.post('*/api/xray/import', async () => {
          // Simulate a slight delay for progress visibility
          await new Promise(resolve => setTimeout(resolve, 100));
          return HttpResponse.json({
            success: true,
            testIssueIds: ['test-123'],
            testKeys: ['TEST-100'],
          });
        })
      );

      renderWithRouter(<TestCasesList />);

      // Wait for list to load
      await waitFor(() => {
        expect(screen.getByText('Ready Test Case 1')).toBeInTheDocument();
      });

      // Select a ready test case
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]); // First test case checkbox

      // Click import button
      await waitFor(() => {
        expect(screen.getByText(/Import 1 to Xray/)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/Import 1 to Xray/));

      // Should show progress modal
      await waitFor(() => {
        expect(screen.getByText('Bulk Import to Xray')).toBeInTheDocument();
      });
    });

    it('shows success state with clickable Jira links after import', async () => {
      const user = userEvent.setup();

      server.use(
        http.post('*/api/xray/import', () => {
          return HttpResponse.json({
            success: true,
            testIssueIds: ['test-123'],
            testKeys: ['TEST-100'],
          });
        })
      );

      renderWithRouter(<TestCasesList />);

      // Wait for list to load
      await waitFor(() => {
        expect(screen.getByText('Ready Test Case 1')).toBeInTheDocument();
      });

      // Select a ready test case
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);

      // Click import button
      await user.click(screen.getByText(/Import 1 to Xray/));

      // Wait for success
      await waitFor(() => {
        expect(screen.getByText('Import Complete!')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Should show test key as clickable link
      await waitFor(() => {
        const links = screen.getAllByRole('link');
        const jiraLink = links.find(link =>
          link.getAttribute('href')?.includes('test.atlassian.net/browse/TEST-100')
        );
        expect(jiraLink).toBeInTheDocument();
        expect(jiraLink).toHaveAttribute('target', '_blank');
        expect(jiraLink).toHaveAttribute('rel', 'noopener noreferrer');
      });
    });

    it('shows partial success when some imports fail', async () => {
      const user = userEvent.setup();
      let importCount = 0;

      server.use(
        http.post('*/api/xray/import', () => {
          importCount++;
          if (importCount === 1) {
            return HttpResponse.json({
              success: true,
              testIssueIds: ['test-123'],
              testKeys: ['TEST-100'],
            });
          }
          // Second import fails
          return HttpResponse.json(
            { error: 'Import failed' },
            { status: 500 }
          );
        })
      );

      renderWithRouter(<TestCasesList />);

      // Wait for list to load
      await waitFor(() => {
        expect(screen.getByText('Ready Test Case 1')).toBeInTheDocument();
      });

      // Select both ready test cases
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]); // First ready case
      await user.click(checkboxes[2]); // Second ready case

      // Click import button
      await waitFor(() => {
        expect(screen.getByText(/Import 2 to Xray/)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/Import 2 to Xray/));

      // Wait for partial success
      await waitFor(() => {
        expect(screen.getByText('Completed with Warnings')).toBeInTheDocument();
      }, { timeout: 10000 });

      // Should show successful import count
      expect(screen.getByText(/1 of 2 imported/)).toBeInTheDocument();
    });

    it('closes modal when Done button is clicked', async () => {
      const user = userEvent.setup();

      server.use(
        http.post('*/api/xray/import', () => {
          return HttpResponse.json({
            success: true,
            testIssueIds: ['test-123'],
            testKeys: ['TEST-100'],
          });
        })
      );

      renderWithRouter(<TestCasesList />);

      // Wait for list to load
      await waitFor(() => {
        expect(screen.getByText('Ready Test Case 1')).toBeInTheDocument();
      });

      // Select a ready test case
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);

      // Click import button
      await user.click(screen.getByText(/Import 1 to Xray/));

      // Wait for success
      await waitFor(() => {
        expect(screen.getByText('Import Complete!')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Click Done button
      await user.click(screen.getByText('Done'));

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByText('Bulk Import to Xray')).not.toBeInTheDocument();
      });
    });

    it('shows all imported test keys as clickable links without truncation', async () => {
      const user = userEvent.setup();
      let importCount = 0;

      server.use(
        http.post('*/api/xray/import', () => {
          importCount++;
          return HttpResponse.json({
            success: true,
            testIssueIds: [`test-${importCount}`],
            testKeys: [`TEST-${100 + importCount}`],
          });
        })
      );

      renderWithRouter(<TestCasesList />);

      // Wait for list to load
      await waitFor(() => {
        expect(screen.getByText('Ready Test Case 1')).toBeInTheDocument();
      });

      // Select both ready test cases
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);
      await user.click(checkboxes[2]);

      // Click import button
      await user.click(screen.getByText(/Import 2 to Xray/));

      // Wait for success
      await waitFor(() => {
        expect(screen.getByText('Import Complete!')).toBeInTheDocument();
      }, { timeout: 10000 });

      // Should show all test keys without "+X more" truncation
      expect(screen.queryByText(/\+\d+ more/)).not.toBeInTheDocument();

      // Both test keys should be visible as links
      await waitFor(() => {
        const links = screen.getAllByRole('link');
        const jiraLinks = links.filter(link =>
          link.getAttribute('href')?.includes('test.atlassian.net/browse/')
        );
        expect(jiraLinks.length).toBe(2);
      });
    });

    it('passes projectKey to xrayApi.import for each draft', async () => {
      const user = userEvent.setup();
      const importCalls: { draftIds: string[]; projectKey?: string }[] = [];

      server.use(
        http.post('*/api/xray/import', async ({ request }) => {
          const body = await request.json() as { draftIds: string[]; projectKey?: string };
          importCalls.push(body);
          return HttpResponse.json({
            success: true,
            testIssueIds: [`test-${importCalls.length}`],
            testKeys: [`TEST-${100 + importCalls.length}`],
          });
        })
      );

      renderWithRouter(<TestCasesList />);

      await waitFor(() => {
        expect(screen.getByText('Ready Test Case 1')).toBeInTheDocument();
      });

      // Select both ready test cases
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);
      await user.click(checkboxes[2]);

      await user.click(screen.getByText(/Import 2 to Xray/));

      // Wait for completion
      await waitFor(() => {
        expect(screen.getByText('Import Complete!')).toBeInTheDocument();
      }, { timeout: 10000 });

      // Each import call should include the projectKey from the draft
      expect(importCalls).toHaveLength(2);
      expect(importCalls[0].projectKey).toBe('TEST');
      expect(importCalls[1].projectKey).toBe('TEST');
    });

    it('imports test cases one by one with progress', async () => {
      const user = userEvent.setup();
      const importedKeys: string[] = [];

      server.use(
        http.post('*/api/xray/import', async () => {
          const key = `TEST-${100 + importedKeys.length + 1}`;
          importedKeys.push(key);
          return HttpResponse.json({
            success: true,
            testIssueIds: [`test-${importedKeys.length}`],
            testKeys: [key],
          });
        })
      );

      renderWithRouter(<TestCasesList />);

      // Wait for list to load
      await waitFor(() => {
        expect(screen.getByText('Ready Test Case 1')).toBeInTheDocument();
      });

      // Select both ready test cases
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);
      await user.click(checkboxes[2]);

      // Click import button
      await user.click(screen.getByText(/Import 2 to Xray/));

      // Should show progress modal with both items
      await waitFor(() => {
        expect(screen.getByText('Bulk Import to Xray')).toBeInTheDocument();
        expect(screen.getByText(/Importing 2 test cases/)).toBeInTheDocument();
      });

      // Wait for completion
      await waitFor(() => {
        expect(screen.getByText('Import Complete!')).toBeInTheDocument();
      }, { timeout: 10000 });

      // Both imports should have been called
      expect(importedKeys.length).toBe(2);
    });
  });

  describe('Test Cases List Display', () => {
    it('renders test cases list', async () => {
      renderWithRouter(<TestCasesList />);

      await waitFor(() => {
        expect(screen.getByText('Test Cases')).toBeInTheDocument();
        expect(screen.getByText('Ready Test Case 1')).toBeInTheDocument();
        expect(screen.getByText('Ready Test Case 2')).toBeInTheDocument();
        expect(screen.getByText('Draft Test Case')).toBeInTheDocument();
      });
    });

    it('shows bulk action bar when items are selected', async () => {
      const user = userEvent.setup();

      renderWithRouter(<TestCasesList />);

      await waitFor(() => {
        expect(screen.getByText('Ready Test Case 1')).toBeInTheDocument();
      });

      // Select a test case
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);

      // Should show selection count
      await waitFor(() => {
        expect(screen.getByText('1 selected')).toBeInTheDocument();
      });
    });

    it('filters by status', async () => {
      const user = userEvent.setup();

      renderWithRouter(<TestCasesList />);

      await waitFor(() => {
        expect(screen.getByText('Ready Test Case 1')).toBeInTheDocument();
      });

      // Filter by draft status
      const statusSelect = screen.getByRole('combobox');
      await user.selectOptions(statusSelect, 'draft');

      // Should only show draft test case
      await waitFor(() => {
        expect(screen.getByText('Draft Test Case')).toBeInTheDocument();
        expect(screen.queryByText('Ready Test Case 1')).not.toBeInTheDocument();
      });
    });
  });

  describe('TC-TCList-U002: Bulk import uses updateTest for reusable TCs', () => {
    const reusableDraft = {
      id: 'reusable-1',
      summary: 'Live Map | UI | REUSE Login Test',
      description: 'Reusable test description',
      status: 'ready',
      projectKey: 'TEST',
      steps: [{ id: 's-r1', action: 'Open login', result: 'Login shown', data: '' }],
      labels: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isReusable: true,
      sourceTestKey: 'TEST-500',
      sourceTestIssueId: '50001',
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
    };

    it('calls /xray/update for reusable TC instead of /xray/import', async () => {
      const user = userEvent.setup();
      const updateCalls: { draftId: string }[] = [];
      const importCalls: { draftIds: string[] }[] = [];

      server.use(
        http.get('*/api/drafts', () => HttpResponse.json([reusableDraft])),
        http.post('*/api/xray/update', async ({ request }) => {
          const body = await request.json() as { draftId: string };
          updateCalls.push(body);
          return HttpResponse.json({
            success: true,
            testIssueIds: ['50001'],
            testKeys: ['TEST-500'],
          });
        }),
        http.post('*/api/xray/import', async ({ request }) => {
          const body = await request.json() as { draftIds: string[] };
          importCalls.push(body);
          return HttpResponse.json({
            success: true,
            testIssueIds: ['new-123'],
            testKeys: ['TEST-999'],
          });
        }),
      );

      renderWithRouter(<TestCasesList />);

      await waitFor(() => {
        expect(screen.getByText('Live Map | UI | REUSE Login Test')).toBeInTheDocument();
      });

      // Select the reusable test case
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);

      // Click import button
      await waitFor(() => {
        expect(screen.getByText(/Import 1 to Xray/)).toBeInTheDocument();
      });
      await user.click(screen.getByText(/Import 1 to Xray/));

      // Wait for completion
      await waitFor(() => {
        expect(screen.getByText('Import Complete!')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Should have called /xray/update, NOT /xray/import
      expect(updateCalls).toHaveLength(1);
      expect(updateCalls[0].draftId).toBe('reusable-1');
      expect(importCalls).toHaveLength(0);
    });

    it('calls /xray/import for non-reusable TC (not /xray/update)', async () => {
      const user = userEvent.setup();
      const updateCalls: { draftId: string }[] = [];
      const importCalls: { draftIds: string[] }[] = [];

      server.use(
        http.post('*/api/xray/update', async ({ request }) => {
          const body = await request.json() as { draftId: string };
          updateCalls.push(body);
          return HttpResponse.json({
            success: true,
            testIssueIds: ['new-123'],
            testKeys: ['TEST-999'],
          });
        }),
        http.post('*/api/xray/import', async ({ request }) => {
          const body = await request.json() as { draftIds: string[] };
          importCalls.push(body);
          return HttpResponse.json({
            success: true,
            testIssueIds: ['new-123'],
            testKeys: ['TEST-101'],
          });
        }),
      );

      renderWithRouter(<TestCasesList />);

      await waitFor(() => {
        expect(screen.getByText('Ready Test Case 1')).toBeInTheDocument();
      });

      // Select a non-reusable ready test case
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);

      await user.click(screen.getByText(/Import 1 to Xray/));

      await waitFor(() => {
        expect(screen.getByText('Import Complete!')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Should have called /xray/import, NOT /xray/update
      expect(importCalls).toHaveLength(1);
      expect(updateCalls).toHaveLength(0);
    });

    it('uses correct endpoint for each TC in a mixed batch', async () => {
      const user = userEvent.setup();
      const updateCalls: { draftId: string }[] = [];
      const importCalls: { draftIds: string[] }[] = [];

      // List with both reusable and non-reusable ready drafts
      server.use(
        http.get('*/api/drafts', () => HttpResponse.json([
          {
            id: '1',
            summary: 'Regular Ready TC',
            description: 'Regular description',
            status: 'ready',
            projectKey: 'TEST',
            steps: [{ id: 's1', action: 'Step', result: 'Result', data: '' }],
            labels: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            xrayLinking: {
              testPlanIds: [], testPlanDisplays: [],
              testExecutionIds: [], testExecutionDisplays: [],
              testSetIds: [], testSetDisplays: [],
              preconditionIds: [], preconditionDisplays: [],
              folderPath: '/', projectId: '',
            },
          },
          reusableDraft,
        ])),
        http.post('*/api/xray/update', async ({ request }) => {
          const body = await request.json() as { draftId: string };
          updateCalls.push(body);
          return HttpResponse.json({
            success: true,
            testIssueIds: ['50001'],
            testKeys: ['TEST-500'],
          });
        }),
        http.post('*/api/xray/import', async ({ request }) => {
          const body = await request.json() as { draftIds: string[] };
          importCalls.push(body);
          return HttpResponse.json({
            success: true,
            testIssueIds: ['new-123'],
            testKeys: ['TEST-101'],
          });
        }),
      );

      renderWithRouter(<TestCasesList />);

      await waitFor(() => {
        expect(screen.getByText('Regular Ready TC')).toBeInTheDocument();
        expect(screen.getByText('Live Map | UI | REUSE Login Test')).toBeInTheDocument();
      });

      // Select all via "Select All" checkbox
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]); // Select All

      // Click import button — both are ready
      await waitFor(() => {
        expect(screen.getByText(/Import 2 to Xray/)).toBeInTheDocument();
      });
      await user.click(screen.getByText(/Import 2 to Xray/));

      // Wait for completion
      await waitFor(() => {
        expect(screen.getByText('Import Complete!')).toBeInTheDocument();
      }, { timeout: 10000 });

      // Regular TC should use /xray/import
      expect(importCalls).toHaveLength(1);
      expect(importCalls[0].draftIds).toContain('1');

      // Reusable TC should use /xray/update
      expect(updateCalls).toHaveLength(1);
      expect(updateCalls[0].draftId).toBe('reusable-1');
    });
  });

  describe('TC-TCList-U001: Non-string description handling', () => {
    it('renders without crashing when draft has ADF object description', async () => {
      server.use(
        http.get('*/api/drafts', () => {
          return HttpResponse.json([
            {
              id: 'adf-1',
              summary: 'Test with ADF description',
              description: {
                type: 'doc',
                version: 1,
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'ADF paragraph' }],
                  },
                ],
              },
              status: 'draft',
              projectKey: 'TEST',
              steps: [{ id: 's1', action: 'Step action', result: 'Step result', data: '' }],
              labels: [],
              createdAt: Date.now(),
              updatedAt: Date.now(),
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
              },
            },
          ]);
        }),
      );

      renderWithRouter(<TestCasesList />);

      await waitFor(() => {
        expect(screen.getByText('Test with ADF description')).toBeInTheDocument();
      });
    });

    it('renders without crashing when draft has null description', async () => {
      server.use(
        http.get('*/api/drafts', () => {
          return HttpResponse.json([
            {
              id: 'null-desc-1',
              summary: 'Test with null description',
              description: null,
              status: 'draft',
              projectKey: 'TEST',
              steps: [{ id: 's1', action: 'Step action', result: 'Step result', data: '' }],
              labels: [],
              createdAt: Date.now(),
              updatedAt: Date.now(),
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
              },
            },
          ]);
        }),
      );

      renderWithRouter(<TestCasesList />);

      await waitFor(() => {
        expect(screen.getByText('Test with null description')).toBeInTheDocument();
      });
    });

    it('search filters work with non-string description drafts', async () => {
      const user = userEvent.setup();

      server.use(
        http.get('*/api/drafts', () => {
          return HttpResponse.json([
            {
              id: 'adf-search-1',
              summary: 'Searchable TC',
              description: { type: 'doc', version: 1, content: [] },
              status: 'draft',
              projectKey: 'TEST',
              steps: [],
              labels: [],
              createdAt: Date.now(),
              updatedAt: Date.now(),
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
              },
            },
          ]);
        }),
      );

      renderWithRouter(<TestCasesList />);

      await waitFor(() => {
        expect(screen.getByText('Searchable TC')).toBeInTheDocument();
      });

      // Type in search — should not crash
      const searchInput = screen.getByPlaceholderText('Search test cases...');
      await user.type(searchInput, 'Searchable');

      await waitFor(() => {
        expect(screen.getByText('Searchable TC')).toBeInTheDocument();
      });
    });

    it('isTestCaseComplete handles non-string description as incomplete', async () => {
      const user = userEvent.setup();

      server.use(
        http.get('*/api/drafts', () => {
          return HttpResponse.json([
            {
              id: 'adf-complete-1',
              summary: 'ADF Draft',
              description: { type: 'doc', version: 1, content: [] },
              status: 'draft',
              projectKey: 'TEST',
              steps: [{ id: 's1', action: 'Step', result: 'Result', data: '' }],
              labels: [],
              createdAt: Date.now(),
              updatedAt: Date.now(),
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
              },
            },
          ]);
        }),
      );

      renderWithRouter(<TestCasesList />);

      await waitFor(() => {
        expect(screen.getByText('ADF Draft')).toBeInTheDocument();
      });

      // Select the draft
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);

      // "Mark as Ready" should appear but show missing fields since description is not a string
      await waitFor(() => {
        expect(screen.getByText(/Missing Required Fields/)).toBeInTheDocument();
      });
    });
  });
});

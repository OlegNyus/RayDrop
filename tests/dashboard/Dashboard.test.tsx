import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, renderWithRouter } from '../helpers/render';
import { Dashboard } from '../../client/src/components/features/dashboard/Dashboard';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';

describe('Dashboard', () => {
  beforeEach(() => {
    // Setup default MSW handlers for dashboard
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
          projectSettings: {
            TEST: { color: '#3B82F6' },
          },
        });
      }),
      http.get('*/api/drafts', () => {
        return HttpResponse.json([
          {
            id: '1',
            summary: 'Test Case 1',
            status: 'new',
            projectKey: 'TEST',
            steps: [],
            labels: [],
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-15T00:00:00Z',
          },
          {
            id: '2',
            summary: 'Test Case 2',
            status: 'draft',
            projectKey: 'TEST',
            steps: [],
            labels: [],
            createdAt: '2024-01-02T00:00:00Z',
            updatedAt: '2024-01-14T00:00:00Z',
          },
          {
            id: '3',
            summary: 'Test Case 3',
            status: 'ready',
            projectKey: 'TEST',
            steps: [],
            labels: [],
            createdAt: '2024-01-03T00:00:00Z',
            updatedAt: '2024-01-13T00:00:00Z',
          },
          {
            id: '4',
            summary: 'Test Case 4',
            status: 'imported',
            projectKey: 'TEST',
            testKey: 'TEST-100',
            steps: [],
            labels: [],
            createdAt: '2024-01-04T00:00:00Z',
            updatedAt: '2024-01-12T00:00:00Z',
          },
        ]);
      }),
      http.get('*/api/xray/test-executions/*', () => {
        return HttpResponse.json([
          { issueId: 'exec-1', key: 'TEST-E1', summary: 'Sprint 1 Execution' },
          { issueId: 'exec-2', key: 'TEST-E2', summary: 'Sprint 2 Execution' },
        ]);
      }),
      http.get('*/api/xray/test-execution/*/status', () => {
        return HttpResponse.json({
          issueId: 'exec-1',
          key: 'TEST-E1',
          summary: 'Sprint 1 Execution',
          totalTests: 10,
          statuses: [
            { status: 'PASS', count: 6, color: '#22C55E' },
            { status: 'FAIL', count: 2, color: '#EF4444' },
            { status: 'TODO', count: 2, color: '#6B7280' },
          ],
        });
      }),
      http.get('*/api/xray/tests/by-status/*', () => {
        return HttpResponse.json([]);
      })
    );
  });

  describe('Header', () => {
    it('renders dashboard title', async () => {
      renderWithRouter(<Dashboard />);
      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
      });
    });

    it('displays active project name', async () => {
      renderWithRouter(<Dashboard />);
      await waitFor(() => {
        expect(screen.getByText('TEST')).toBeInTheDocument();
      });
    });
  });

  describe('Stats Overview', () => {
    it('renders status distribution label', async () => {
      renderWithRouter(<Dashboard />);
      await waitFor(() => {
        expect(screen.getByText('Status Distribution')).toBeInTheDocument();
      });
    });

    it('displays all status cards', async () => {
      renderWithRouter(<Dashboard />);
      await waitFor(() => {
        expect(screen.getByText('New')).toBeInTheDocument();
        expect(screen.getByText('Draft')).toBeInTheDocument();
        expect(screen.getByText('Ready')).toBeInTheDocument();
        expect(screen.getByText('Imported')).toBeInTheDocument();
      });
    });

    it('shows correct count for each status', async () => {
      renderWithRouter(<Dashboard />);
      await waitFor(() => {
        // Each status has 1 draft in our mock data
        const ones = screen.getAllByText('1');
        expect(ones.length).toBeGreaterThanOrEqual(4);
      });
    });
  });

  describe('Import Progress', () => {
    it('renders progress section', async () => {
      renderWithRouter(<Dashboard />);
      await waitFor(() => {
        expect(screen.getByText('Import Progress')).toBeInTheDocument();
      });
    });

    it('displays imported count', async () => {
      renderWithRouter(<Dashboard />);
      await waitFor(() => {
        expect(screen.getByText('1 of 4 imported')).toBeInTheDocument();
      });
    });

    it('shows percentage complete', async () => {
      renderWithRouter(<Dashboard />);
      await waitFor(() => {
        expect(screen.getByText('25% Complete')).toBeInTheDocument();
      });
    });
  });

  describe('Test Execution Status', () => {
    it('renders test execution section', async () => {
      renderWithRouter(<Dashboard />);
      await waitFor(() => {
        expect(screen.getByText('Test Execution Status')).toBeInTheDocument();
      });
    });

    it('displays execution selector', async () => {
      renderWithRouter(<Dashboard />);
      await waitFor(() => {
        const select = screen.getByRole('combobox');
        expect(select).toBeInTheDocument();
      });
    });

    it('shows execution options', async () => {
      renderWithRouter(<Dashboard />);
      await waitFor(() => {
        expect(screen.getByText(/TEST-E1/)).toBeInTheDocument();
      });
    });

    it('displays pass rate when execution is selected', async () => {
      renderWithRouter(<Dashboard />);
      await waitFor(() => {
        // Multiple elements may show 60% (pass rate + progress bar)
        const percentages = screen.getAllByText('60%');
        expect(percentages.length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Pass Rate')).toBeInTheDocument();
      });
    });

    it('displays status breakdown', async () => {
      renderWithRouter(<Dashboard />);
      await waitFor(() => {
        expect(screen.getByText('PASS')).toBeInTheDocument();
        expect(screen.getByText('FAIL')).toBeInTheDocument();
        expect(screen.getByText('TODO')).toBeInTheDocument();
      });
    });

    it('shows total tests count', async () => {
      renderWithRouter(<Dashboard />);
      await waitFor(() => {
        expect(screen.getByText('Total Tests')).toBeInTheDocument();
        expect(screen.getByText('10')).toBeInTheDocument();
      });
    });
  });

  describe('Recent Test Cases', () => {
    it('renders recent test cases section', async () => {
      renderWithRouter(<Dashboard />);
      await waitFor(() => {
        expect(screen.getByText('Recent Test Cases')).toBeInTheDocument();
      });
    });

    it('displays test case summaries', async () => {
      renderWithRouter(<Dashboard />);
      await waitFor(() => {
        expect(screen.getByText('Test Case 1')).toBeInTheDocument();
        expect(screen.getByText('Test Case 2')).toBeInTheDocument();
      });
    });

    it('shows status badges for test cases', async () => {
      renderWithRouter(<Dashboard />);
      await waitFor(() => {
        // StatusBadge displays status text
        const newBadges = screen.getAllByText('New');
        expect(newBadges.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('displays test key link for imported tests', async () => {
      renderWithRouter(<Dashboard />);
      await waitFor(() => {
        expect(screen.getByText(/TEST-100/)).toBeInTheDocument();
      });
    });
  });

  describe('Empty States', () => {
    it('shows empty message when no drafts exist', async () => {
      server.use(
        http.get('*/api/drafts', () => {
          return HttpResponse.json([]);
        })
      );

      renderWithRouter(<Dashboard />);
      await waitFor(() => {
        expect(screen.getByText('No test cases yet. Create your first one!')).toBeInTheDocument();
      });
    });

    it('shows empty donut chart with 0 total when no drafts', async () => {
      server.use(
        http.get('*/api/drafts', () => {
          return HttpResponse.json([]);
        })
      );

      renderWithRouter(<Dashboard />);
      await waitFor(() => {
        const zeros = screen.getAllByText('0');
        expect(zeros.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('shows no executions message when none exist', async () => {
      server.use(
        http.get('*/api/xray/test-executions/*', () => {
          return HttpResponse.json([]);
        })
      );

      renderWithRouter(<Dashboard />);
      await waitFor(() => {
        expect(screen.getByText(/No test executions found/)).toBeInTheDocument();
      });
    });
  });

  describe('Not Configured State', () => {
    it('does not show test execution section when not configured', async () => {
      server.use(
        http.get('*/api/config', () => {
          return HttpResponse.json({ configured: false });
        })
      );

      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
      });

      // Test execution section should not be visible
      expect(screen.queryByText('Test Execution Status')).not.toBeInTheDocument();
    });
  });
});

describe('DonutChart', () => {
  beforeEach(() => {
    server.use(
      http.get('*/api/config', () => {
        return HttpResponse.json({ configured: true, jiraBaseUrl: 'https://test.atlassian.net/' });
      }),
      http.get('*/api/settings', () => {
        return HttpResponse.json({
          projects: ['TEST'],
          hiddenProjects: [],
          activeProject: 'TEST',
          projectSettings: {},
        });
      }),
      http.get('*/api/drafts', () => {
        return HttpResponse.json([
          { id: '1', summary: 'Test 1', status: 'new', projectKey: 'TEST', steps: [], labels: [], createdAt: '', updatedAt: '' },
          { id: '2', summary: 'Test 2', status: 'new', projectKey: 'TEST', steps: [], labels: [], createdAt: '', updatedAt: '' },
          { id: '3', summary: 'Test 3', status: 'draft', projectKey: 'TEST', steps: [], labels: [], createdAt: '', updatedAt: '' },
        ]);
      }),
      http.get('*/api/xray/test-executions/*', () => HttpResponse.json([])),
      http.get('*/api/xray/tests/by-status/*', () => HttpResponse.json([]))
    );
  });

  it('renders SVG donut chart', async () => {
    renderWithRouter(<Dashboard />);
    await waitFor(() => {
      const svgs = document.querySelectorAll('svg');
      expect(svgs.length).toBeGreaterThan(0);
    });
  });

  it('displays total count in center', async () => {
    renderWithRouter(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('Total')).toBeInTheDocument();
    });
  });
});

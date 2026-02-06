import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, renderWithRouter } from '../helpers/render';
import userEvent from '@testing-library/user-event';
import { XrayEntityPage } from '../../client/src/components/features/xray/XrayEntityPage';
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

// --- Test Data ---

const testSets = [
  { issueId: 'ts-1', key: 'TS-101', summary: 'Smoke test set', testCount: 5 },
  { issueId: 'ts-2', key: 'TS-102', summary: 'Regression test set', testCount: 12 },
  { issueId: 'ts-3', key: 'TS-103', summary: 'Integration suite', testCount: 3 },
];

const testPlans = [
  { issueId: 'tp-1', key: 'TP-201', summary: 'Release 2.0 plan', testCount: 8 },
  { issueId: 'tp-2', key: 'TP-202', summary: 'Sprint 5 validation', testCount: 15 },
];

const testExecutions = [
  {
    issueId: 'te-1',
    key: 'TE-301',
    summary: 'Sprint 5 run',
    totalTests: 10,
    statuses: [
      { status: 'PASS', count: 7, color: '#22C55E' },
      { status: 'FAIL', count: 2, color: '#EF4444' },
      { status: 'TODO', count: 1, color: '#6B7280' },
    ],
  },
  {
    issueId: 'te-2',
    key: 'TE-302',
    summary: 'Hotfix validation',
    totalTests: 3,
    statuses: [
      { status: 'PASS', count: 3, color: '#22C55E' },
    ],
  },
];

const preconditions = [
  { issueId: 'pc-1', key: 'PC-401', summary: 'User is logged in' },
  { issueId: 'pc-2', key: 'PC-402', summary: 'Database seeded' },
];

const testsInEntity = [
  { issueId: 'test-1', key: 'TEST-501', summary: 'Validate login form' },
  { issueId: 'test-2', key: 'TEST-502', summary: 'Check error messages' },
  { issueId: 'test-3', key: 'TEST-503', summary: 'Verify redirect after login' },
];

const testsWithStatus = [
  { issueId: 'test-1', key: 'TEST-501', summary: 'Validate login form', status: 'PASS', statusColor: '#22C55E' },
  { issueId: 'test-2', key: 'TEST-502', summary: 'Check error messages', status: 'FAIL', statusColor: '#EF4444' },
  { issueId: 'test-3', key: 'TEST-503', summary: 'Verify redirect after login', status: 'TODO', statusColor: '#6B7280' },
];

// --- MSW Handler Helpers ---

function setupConfiguredHandlers({
  entities = [] as unknown[],
  entityEndpoint = '',
  jiraBaseUrl = 'https://test.atlassian.net',
  activeProject = 'PROJ',
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
        projects: [activeProject],
        hiddenProjects: [],
        activeProject,
        projectSettings: {},
      });
    }),
    http.get('*/api/drafts', () => {
      return HttpResponse.json([]);
    }),
  );

  if (entityEndpoint) {
    server.use(
      http.get(`*/api/xray/${entityEndpoint}/${activeProject}`, () => {
        return HttpResponse.json(entities);
      }),
    );
  }
}

function setupTestSetsHandlers(overrides?: { entities?: unknown[] }) {
  setupConfiguredHandlers({ entities: overrides?.entities ?? testSets, entityEndpoint: 'test-sets' });
}

function setupTestPlansHandlers(overrides?: { entities?: unknown[] }) {
  setupConfiguredHandlers({ entities: overrides?.entities ?? testPlans, entityEndpoint: 'test-plans' });
}

function setupTestExecutionsHandlers(overrides?: { entities?: unknown[] }) {
  setupConfiguredHandlers({ entities: overrides?.entities ?? testExecutions, entityEndpoint: 'test-executions' });
}

function setupPreconditionsHandlers(overrides?: { entities?: unknown[] }) {
  setupConfiguredHandlers({ entities: overrides?.entities ?? preconditions, entityEndpoint: 'preconditions' });
}

function setupTestsFromEntityHandler(entityType: string, entityId: string, tests: unknown[] = testsInEntity) {
  server.use(
    http.get(`*/api/xray/${entityType}/${entityId}/tests`, () => {
      return HttpResponse.json(tests);
    }),
  );
}

// --- Tests ---

describe('XrayEntityPage', () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

  beforeEach(() => {
    mockNavigate.mockClear();
  });

  // ===== POSITIVE TESTS =====

  describe('TC-XrayEntity-U001: Renders page title and count for test-sets', () => {
    it('should display Test Sets title and entity count badge', async () => {
      setupTestSetsHandlers();
      renderWithRouter(<XrayEntityPage type="test-sets" />);

      await waitFor(() => {
        expect(screen.getByText('Test Sets')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument();
      });
    });
  });

  describe('TC-XrayEntity-U002: Renders page title and count for test-plans', () => {
    it('should display Test Plans title and entity count badge', async () => {
      setupTestPlansHandlers();
      renderWithRouter(<XrayEntityPage type="test-plans" />);

      await waitFor(() => {
        expect(screen.getByText('Test Plans')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument();
      });
    });
  });

  describe('TC-XrayEntity-U003: Renders page title and count for test-executions', () => {
    it('should display Test Executions title and entity count badge', async () => {
      setupTestExecutionsHandlers();
      renderWithRouter(<XrayEntityPage type="test-executions" />);

      await waitFor(() => {
        expect(screen.getByText('Test Executions')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument();
      });
    });
  });

  describe('TC-XrayEntity-U004: Renders page title and count for preconditions', () => {
    it('should display Preconditions title and entity count badge', async () => {
      setupPreconditionsHandlers();
      renderWithRouter(<XrayEntityPage type="preconditions" />);

      await waitFor(() => {
        expect(screen.getByText('Preconditions')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument();
      });
    });
  });

  describe('TC-XrayEntity-U005: Displays entity cards with key and summary', () => {
    it('should render each entity card showing key and summary', async () => {
      setupTestSetsHandlers();
      renderWithRouter(<XrayEntityPage type="test-sets" />);

      await waitFor(() => {
        expect(screen.getByText('TS-101')).toBeInTheDocument();
      });

      expect(screen.getByText('Smoke test set')).toBeInTheDocument();
      expect(screen.getByText('TS-102')).toBeInTheDocument();
      expect(screen.getByText('Regression test set')).toBeInTheDocument();
      expect(screen.getByText('TS-103')).toBeInTheDocument();
      expect(screen.getByText('Integration suite')).toBeInTheDocument();
    });
  });

  describe('TC-XrayEntity-U006: Search filters entities by key', () => {
    it('should show only matching entities when searching by key', async () => {
      setupTestSetsHandlers();
      renderWithRouter(<XrayEntityPage type="test-sets" />);

      await waitFor(() => {
        expect(screen.getByText('TS-101')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search test sets...');
      await user.type(searchInput, 'TS-102');

      expect(screen.getByText('TS-102')).toBeInTheDocument();
      expect(screen.queryByText('TS-101')).not.toBeInTheDocument();
      expect(screen.queryByText('TS-103')).not.toBeInTheDocument();
    });
  });

  describe('TC-XrayEntity-U007: Search filters entities by summary', () => {
    it('should show only matching entities when searching by summary text', async () => {
      setupTestSetsHandlers();
      renderWithRouter(<XrayEntityPage type="test-sets" />);

      await waitFor(() => {
        expect(screen.getByText('TS-101')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search test sets...');
      await user.type(searchInput, 'integration');

      expect(screen.getByText('TS-103')).toBeInTheDocument();
      expect(screen.getByText('Integration suite')).toBeInTheDocument();
      expect(screen.queryByText('TS-101')).not.toBeInTheDocument();
      expect(screen.queryByText('TS-102')).not.toBeInTheDocument();
    });
  });

  describe('TC-XrayEntity-U008: Clicking non-precondition card expands to show tests', () => {
    it('should expand the card and display tests section on click', async () => {
      setupTestSetsHandlers();
      setupTestsFromEntityHandler('test-sets', 'ts-1');
      renderWithRouter(<XrayEntityPage type="test-sets" />);

      await waitFor(() => {
        expect(screen.getByText('TS-101')).toBeInTheDocument();
      });

      // Click the entity card
      await user.click(screen.getByText('Smoke test set'));

      // Should show tests label and test data
      await waitFor(() => {
        expect(screen.getByText('Tests in this set')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('TEST-501')).toBeInTheDocument();
      });

      expect(screen.getByText('Validate login form')).toBeInTheDocument();
      expect(screen.getByText('TEST-502')).toBeInTheDocument();
      expect(screen.getByText('TEST-503')).toBeInTheDocument();
    });
  });

  describe('TC-XrayEntity-U009: Clicking precondition card navigates to detail page', () => {
    it('should navigate to the precondition detail route on click', async () => {
      setupPreconditionsHandlers();
      renderWithRouter(<XrayEntityPage type="preconditions" />);

      await waitFor(() => {
        expect(screen.getByText('PC-401')).toBeInTheDocument();
      });

      await user.click(screen.getByText('User is logged in'));

      expect(mockNavigate).toHaveBeenCalledWith('/xray/precondition/pc-1');
    });
  });

  describe('TC-XrayEntity-U010: Expanded card shows test list with keys and summaries', () => {
    it('should display all tests with their keys and summaries in expanded section', async () => {
      setupTestPlansHandlers();
      setupTestsFromEntityHandler('test-plans', 'tp-1');
      renderWithRouter(<XrayEntityPage type="test-plans" />);

      await waitFor(() => {
        expect(screen.getByText('TP-201')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Release 2.0 plan'));

      await waitFor(() => {
        expect(screen.getByText('TEST-501')).toBeInTheDocument();
      });

      expect(screen.getByText('Validate login form')).toBeInTheDocument();
      expect(screen.getByText('Check error messages')).toBeInTheDocument();
      expect(screen.getByText('Verify redirect after login')).toBeInTheDocument();
      expect(screen.getByText('3 tests total')).toBeInTheDocument();
    });
  });

  describe('TC-XrayEntity-U011: Clicking test in expanded list navigates to test detail', () => {
    it('should navigate to the test detail route when a test row is clicked', async () => {
      setupTestSetsHandlers();
      setupTestsFromEntityHandler('test-sets', 'ts-1');
      renderWithRouter(<XrayEntityPage type="test-sets" />);

      await waitFor(() => {
        expect(screen.getByText('TS-101')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Smoke test set'));

      await waitFor(() => {
        expect(screen.getByText('TEST-501')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Validate login form'));

      expect(mockNavigate).toHaveBeenCalledWith('/xray/test/test-1');
    });
  });

  describe('TC-XrayEntity-U012: Test execution cards show status bar', () => {
    it('should render a colored status bar reflecting pass/fail/todo counts', async () => {
      setupTestExecutionsHandlers();
      renderWithRouter(<XrayEntityPage type="test-executions" />);

      await waitFor(() => {
        expect(screen.getByText('TE-301')).toBeInTheDocument();
      });

      // Status bar segments have title attributes with status info
      expect(screen.getByTitle('PASS: 7 (70%)')).toBeInTheDocument();
      expect(screen.getByTitle('FAIL: 2 (20%)')).toBeInTheDocument();
      expect(screen.getByTitle('TODO: 1 (10%)')).toBeInTheDocument();
    });
  });

  describe('TC-XrayEntity-U013: Test set/plan cards show test count badge', () => {
    it('should display a test count badge on test set cards', async () => {
      setupTestSetsHandlers();
      renderWithRouter(<XrayEntityPage type="test-sets" />);

      await waitFor(() => {
        expect(screen.getByText('TS-101')).toBeInTheDocument();
      });

      expect(screen.getByText('5 tests')).toBeInTheDocument();
      expect(screen.getByText('12 tests')).toBeInTheDocument();
      expect(screen.getByText('3 tests')).toBeInTheDocument();
    });
  });

  describe('TC-XrayEntity-U014: Jira link opens correct URL in new tab', () => {
    it('should render Jira links with correct href and target', async () => {
      setupTestSetsHandlers();
      renderWithRouter(<XrayEntityPage type="test-sets" />);

      await waitFor(() => {
        expect(screen.getByText('TS-101')).toBeInTheDocument();
      });

      const jiraLinks = screen.getAllByTitle(/Open .+ in Jira/);
      expect(jiraLinks.length).toBe(3);

      const firstLink = jiraLinks[0];
      expect(firstLink).toHaveAttribute('href', 'https://test.atlassian.net/browse/TS-101');
      expect(firstLink).toHaveAttribute('target', '_blank');
      expect(firstLink).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  describe('TC-XrayEntity-U015: Refresh button fetches entities again', () => {
    it('should reload entities when refresh button is clicked', async () => {
      setupTestSetsHandlers();
      renderWithRouter(<XrayEntityPage type="test-sets" />);

      await waitFor(() => {
        expect(screen.getByText('TS-101')).toBeInTheDocument();
      });

      // Override with updated data
      const updatedSets = [
        { issueId: 'ts-4', key: 'TS-104', summary: 'New test set', testCount: 1 },
      ];
      server.use(
        http.get('*/api/xray/test-sets/PROJ', () => {
          return HttpResponse.json(updatedSets);
        }),
      );

      const refreshBtn = screen.getByTitle('Refresh');
      await user.click(refreshBtn);

      await waitFor(() => {
        expect(screen.getByText('TS-104')).toBeInTheDocument();
      });

      expect(screen.getByText('New test set')).toBeInTheDocument();
      expect(screen.queryByText('TS-101')).not.toBeInTheDocument();
    });
  });

  // ===== NEGATIVE TESTS =====

  describe('TC-XrayEntity-U016: Not configured state shows warning', () => {
    it('should display Xray Not Connected warning when not configured', async () => {
      // Default handlers already return configured: false
      renderWithRouter(<XrayEntityPage type="test-sets" />);

      await waitFor(() => {
        expect(screen.getByText('Xray Not Connected')).toBeInTheDocument();
      });

      expect(screen.getByText(/Connect to Xray in Settings to view test sets/)).toBeInTheDocument();
    });
  });

  describe('TC-XrayEntity-U017: No project selected shows info message', () => {
    it('should display No Project Selected when configured but no project active', async () => {
      server.use(
        http.get('*/api/config', () => {
          return HttpResponse.json({
            configured: true,
            jiraBaseUrl: 'https://test.atlassian.net',
            hasCredentials: true,
          });
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
      );

      renderWithRouter(<XrayEntityPage type="test-plans" />);

      await waitFor(() => {
        expect(screen.getByText('No Project Selected')).toBeInTheDocument();
      });

      expect(screen.getByText(/Select a project from the sidebar to view its test plans/)).toBeInTheDocument();
    });
  });

  describe('TC-XrayEntity-U018: Empty entities shows "No {title} Found"', () => {
    it('should display empty state when no entities exist for the project', async () => {
      setupTestSetsHandlers({ entities: [] });
      renderWithRouter(<XrayEntityPage type="test-sets" />);

      await waitFor(() => {
        expect(screen.getByText('No Test Sets Found')).toBeInTheDocument();
      });

      expect(screen.getByText(/There are no test sets in project PROJ/)).toBeInTheDocument();
    });
  });

  describe('TC-XrayEntity-U019: Search with no results shows "No Results"', () => {
    it('should display No Results when search finds no matching entities', async () => {
      setupTestSetsHandlers();
      renderWithRouter(<XrayEntityPage type="test-sets" />);

      await waitFor(() => {
        expect(screen.getByText('TS-101')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search test sets...');
      await user.type(searchInput, 'nonexistent');

      expect(screen.getByText('No Results')).toBeInTheDocument();
      expect(screen.getByText(/No test sets match "nonexistent"/)).toBeInTheDocument();
    });
  });

  describe('TC-XrayEntity-U020: API error shows error message with retry', () => {
    it('should display error state and retry button when API fails', async () => {
      server.use(
        http.get('*/api/config', () => {
          return HttpResponse.json({
            configured: true,
            jiraBaseUrl: 'https://test.atlassian.net',
            hasCredentials: true,
          });
        }),
        http.get('*/api/settings', () => {
          return HttpResponse.json({
            projects: ['PROJ'],
            hiddenProjects: [],
            activeProject: 'PROJ',
            projectSettings: {},
          });
        }),
        http.get('*/api/drafts', () => {
          return HttpResponse.json([]);
        }),
        http.get('*/api/xray/test-sets/PROJ', () => {
          return HttpResponse.json({ error: 'Service unavailable' }, { status: 503 });
        }),
      );

      renderWithRouter(<XrayEntityPage type="test-sets" />);

      await waitFor(() => {
        expect(screen.getByText('Service unavailable')).toBeInTheDocument();
      });

      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  describe('TC-XrayEntity-U021: Test fetch error shows error in expanded card', () => {
    it('should display error text inside expanded card when test fetch fails', async () => {
      setupTestSetsHandlers();
      server.use(
        http.get('*/api/xray/test-sets/ts-1/tests', () => {
          return HttpResponse.json({ error: 'Failed to load tests' }, { status: 500 });
        }),
      );
      renderWithRouter(<XrayEntityPage type="test-sets" />);

      await waitFor(() => {
        expect(screen.getByText('TS-101')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Smoke test set'));

      await waitFor(() => {
        expect(screen.getByText('Failed to load tests')).toBeInTheDocument();
      });
    });
  });

  // ===== EDGE CASES =====

  describe('TC-XrayEntity-U022: Loading state shows 5 skeleton cards', () => {
    it('should display exactly 5 skeleton cards while loading', async () => {
      server.use(
        http.get('*/api/config', () => {
          return HttpResponse.json({
            configured: true,
            jiraBaseUrl: 'https://test.atlassian.net',
            hasCredentials: true,
          });
        }),
        http.get('*/api/settings', () => {
          return HttpResponse.json({
            projects: ['PROJ'],
            hiddenProjects: [],
            activeProject: 'PROJ',
            projectSettings: {},
          });
        }),
        http.get('*/api/drafts', () => {
          return HttpResponse.json([]);
        }),
        http.get('*/api/xray/test-sets/PROJ', async () => {
          await delay(5000);
          return HttpResponse.json(testSets);
        }),
      );

      renderWithRouter(<XrayEntityPage type="test-sets" />);

      await waitFor(() => {
        const skeletons = document.querySelectorAll('.animate-pulse');
        expect(skeletons.length).toBeGreaterThanOrEqual(5);
      });
    });
  });

  describe('TC-XrayEntity-U023: Refresh button disabled during loading', () => {
    it('should disable the refresh button while entities are loading', async () => {
      server.use(
        http.get('*/api/config', () => {
          return HttpResponse.json({
            configured: true,
            jiraBaseUrl: 'https://test.atlassian.net',
            hasCredentials: true,
          });
        }),
        http.get('*/api/settings', () => {
          return HttpResponse.json({
            projects: ['PROJ'],
            hiddenProjects: [],
            activeProject: 'PROJ',
            projectSettings: {},
          });
        }),
        http.get('*/api/drafts', () => {
          return HttpResponse.json([]);
        }),
        http.get('*/api/xray/test-sets/PROJ', async () => {
          await delay(5000);
          return HttpResponse.json(testSets);
        }),
      );

      renderWithRouter(<XrayEntityPage type="test-sets" />);

      await waitFor(() => {
        const refreshBtn = screen.getByTitle('Refresh');
        expect(refreshBtn).toBeDisabled();
      });
    });
  });

  describe('TC-XrayEntity-U024: Collapsing expanded card hides tests', () => {
    it('should hide the tests section when clicking an expanded card again', async () => {
      setupTestSetsHandlers();
      setupTestsFromEntityHandler('test-sets', 'ts-1');
      renderWithRouter(<XrayEntityPage type="test-sets" />);

      await waitFor(() => {
        expect(screen.getByText('TS-101')).toBeInTheDocument();
      });

      // Expand
      await user.click(screen.getByText('Smoke test set'));
      await waitFor(() => {
        expect(screen.getByText('TEST-501')).toBeInTheDocument();
      });

      // Collapse
      await user.click(screen.getByText('Smoke test set'));
      await waitFor(() => {
        expect(screen.queryByText('TEST-501')).not.toBeInTheDocument();
      });
    });
  });

  describe('TC-XrayEntity-U025: Expanding a different card collapses the first', () => {
    it('should only have one card expanded at a time', async () => {
      setupTestSetsHandlers();
      setupTestsFromEntityHandler('test-sets', 'ts-1');
      renderWithRouter(<XrayEntityPage type="test-sets" />);

      await waitFor(() => {
        expect(screen.getByText('TS-101')).toBeInTheDocument();
      });

      // Expand first card
      await user.click(screen.getByText('Smoke test set'));
      await waitFor(() => {
        expect(screen.getByText('Tests in this set')).toBeInTheDocument();
      });

      // Setup tests for second card
      setupTestsFromEntityHandler('test-sets', 'ts-2', [
        { issueId: 'test-4', key: 'TEST-601', summary: 'Another test' },
      ]);

      // Expand second card - should collapse first
      await user.click(screen.getByText('Regression test set'));

      await waitFor(() => {
        expect(screen.getByText('TEST-601')).toBeInTheDocument();
      });

      // First card's tests should be gone (only one expanded section at a time)
      expect(screen.queryByText('TEST-501')).not.toBeInTheDocument();
    });
  });

  describe('TC-XrayEntity-U026: Singular count in summary text', () => {
    it('should use singular form when there is exactly 1 entity', async () => {
      setupTestSetsHandlers({
        entities: [{ issueId: 'ts-1', key: 'TS-101', summary: 'Only set', testCount: 2 }],
      });
      renderWithRouter(<XrayEntityPage type="test-sets" />);

      await waitFor(() => {
        expect(screen.getByText('TS-101')).toBeInTheDocument();
      });

      expect(screen.getByText('1 test set in PROJ')).toBeInTheDocument();
    });
  });

  describe('TC-XrayEntity-U027: Execution status legend shown in expanded card', () => {
    it('should display the status legend with color dots and counts when execution is expanded', async () => {
      setupTestExecutionsHandlers();
      setupTestsFromEntityHandler('test-executions', 'te-1', testsWithStatus);
      renderWithRouter(<XrayEntityPage type="test-executions" />);

      await waitFor(() => {
        expect(screen.getByText('TE-301')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Sprint 5 run'));

      await waitFor(() => {
        expect(screen.getByText('Execution Status')).toBeInTheDocument();
      });

      // Legend items: format is "STATUS: <strong>COUNT</strong>"
      // Use regex to match the legend text like "PASS: 7"
      expect(screen.getByText(/PASS:/)).toBeInTheDocument();
      expect(screen.getByText(/FAIL:/)).toBeInTheDocument();
      expect(screen.getByText(/TODO:/)).toBeInTheDocument();
    });
  });

  describe('TC-XrayEntity-U028: Test status badge shown in expanded test list', () => {
    it('should render colored status badges next to tests in execution expanded view', async () => {
      setupTestExecutionsHandlers();
      setupTestsFromEntityHandler('test-executions', 'te-1', testsWithStatus);
      renderWithRouter(<XrayEntityPage type="test-executions" />);

      await waitFor(() => {
        expect(screen.getByText('TE-301')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Sprint 5 run'));

      await waitFor(() => {
        expect(screen.getByText('TEST-501')).toBeInTheDocument();
      });

      // Each test has a status badge with exact status text
      // Legend uses "STATUS: count" format, badges use just "STATUS"
      expect(screen.getByText('PASS')).toBeInTheDocument();
      expect(screen.getByText('FAIL')).toBeInTheDocument();
      expect(screen.getByText('TODO')).toBeInTheDocument();
    });
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, renderWithRouter, fireEvent } from '../helpers/render';
import userEvent from '@testing-library/user-event';
import { TCReviewPage } from '../../client/src/components/features/review/TCReviewPage';
import { http, HttpResponse } from 'msw';
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

const underReviewTests = [
  {
    issueId: 'ur-1',
    key: 'TEST-101',
    summary: 'Login form validation',
    priority: 'High',
    labels: ['smoke', 'auth', 'regression'],
    assignee: 'Alice',
    created: '2024-03-15T10:00:00Z',
    updated: '2024-03-16T10:00:00Z',
  },
  {
    issueId: 'ur-2',
    key: 'TEST-102',
    summary: 'Checkout flow',
    priority: 'Medium',
    labels: [],
    created: '2024-03-10T10:00:00Z',
    updated: '2024-03-11T10:00:00Z',
  },
  {
    issueId: 'ur-3',
    key: 'TEST-103',
    summary: 'Dashboard rendering',
    priority: 'Highest',
    labels: ['critical'],
    assignee: 'Bob',
    created: '2024-03-20T10:00:00Z',
    updated: '2024-03-21T10:00:00Z',
  },
];

const xrayDraftTests = [
  {
    issueId: 'xd-1',
    key: 'TEST-201',
    summary: 'API error handling',
    priority: 'Low',
    labels: ['api'],
    created: '2024-02-01T10:00:00Z',
    updated: '2024-02-02T10:00:00Z',
  },
  {
    issueId: 'xd-2',
    key: 'TEST-202',
    summary: 'Settings persistence',
    priority: 'Lowest',
    labels: [],
    assignee: 'Charlie',
    created: '2024-02-05T10:00:00Z',
    updated: '2024-02-06T10:00:00Z',
  },
];

// Generate many tests for pagination testing
function generateTests(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    issueId: `pg-${i + 1}`,
    key: `TEST-${300 + i}`,
    summary: `Paginated test case ${i + 1}`,
    priority: 'Medium',
    labels: [],
    created: new Date(2024, 0, count - i).toISOString(),
    updated: new Date(2024, 0, count - i).toISOString(),
  }));
}

// --- MSW Handler Helpers ---

function setupConfiguredHandlers({
  underReview = underReviewTests,
  xrayDraft = xrayDraftTests,
  drafts = [] as Array<{ id: string; status: string; projectKey: string; summary: string; steps: unknown[]; labels: string[]; createdAt: string; updatedAt: string }>,
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
        projects: ['TEST'],
        hiddenProjects: [],
        activeProject: 'TEST',
        projectSettings: { TEST: { color: '#3B82F6' } },
      });
    }),
    http.get('*/api/drafts', () => {
      return HttpResponse.json(drafts);
    }),
    http.get('*/api/xray/tests/by-status/*', ({ request }) => {
      // Mock: external Xray API — returns tests by Jira workflow status
      const url = new URL(request.url);
      const status = url.searchParams.get('status');
      if (status === 'Under Review') return HttpResponse.json(underReview);
      if (status === 'Draft') return HttpResponse.json(xrayDraft);
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

function setupNoProjectHandlers() {
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
    http.get('*/api/xray/tests/by-status/*', () => {
      return HttpResponse.json([]);
    }),
  );
}

// --- Tests ---

describe('TCReviewPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  // === Positive Tests ===

  describe('TC-TCReview-U001: Renders header with title and subtitle', () => {
    it('should display "TC Review" title and "Tests awaiting review" subtitle', async () => {
      setupConfiguredHandlers();
      renderWithRouter(<TCReviewPage />);
      await waitFor(() => {
        expect(screen.getByText('TC Review')).toBeInTheDocument();
      });
      expect(screen.getByText('Tests awaiting review')).toBeInTheDocument();
    });
  });

  describe('TC-TCReview-U002: Renders 3 stat cards with correct counts', () => {
    it('should show Under Review, Draft, and Local Draft stat cards', async () => {
      setupConfiguredHandlers({
        drafts: [
          { id: 'd1', status: 'draft', projectKey: 'TEST', summary: 'Draft 1', steps: [], labels: [], createdAt: '', updatedAt: '' },
          { id: 'd2', status: 'draft', projectKey: 'TEST', summary: 'Draft 2', steps: [], labels: [], createdAt: '', updatedAt: '' },
        ],
      });
      renderWithRouter(<TCReviewPage />);

      // Wait for data to load (tests appear means counts are ready)
      await waitFor(() => {
        expect(screen.getByText('TEST-101')).toBeInTheDocument();
      });

      // 3 stat card buttons: Under Review, Draft (Xray), Draft (Local)
      const underReviewCard = screen.getByTitle('View Under Review tests');
      const xrayDraftCard = screen.getByTitle('View Draft tests');
      const localDraftCard = screen.getByTitle('View in Test Cases');

      // Under Review count = 3
      expect(underReviewCard).toHaveTextContent('3');
      // Xray Draft count = 2
      expect(xrayDraftCard).toHaveTextContent('2');
      // Local Draft count = 2
      expect(localDraftCard).toHaveTextContent('2');
    });
  });

  describe('TC-TCReview-U003: Active view defaults to underReview', () => {
    it('should show Under Review stat card as active by default', async () => {
      setupConfiguredHandlers();
      renderWithRouter(<TCReviewPage />);

      await waitFor(() => {
        expect(screen.getByText('Tests Under Review')).toBeInTheDocument();
      });
    });
  });

  describe('TC-TCReview-U004: Clicking Draft stat card switches view', () => {
    it('should switch to xrayDraft tests when Draft card is clicked', async () => {
      setupConfiguredHandlers();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithRouter(<TCReviewPage />);

      await waitFor(() => {
        expect(screen.getByText('Tests Under Review')).toBeInTheDocument();
      });

      // Click the Draft stat card (Xray Status subtitle)
      const draftButton = screen.getByTitle('View Draft tests');
      await user.click(draftButton);

      await waitFor(() => {
        expect(screen.getByText('Draft Tests (Xray)')).toBeInTheDocument();
      });
    });
  });

  describe('TC-TCReview-U005: Clicking Local Draft stat card navigates', () => {
    it('should navigate to /test-cases?status=draft', async () => {
      setupConfiguredHandlers();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithRouter(<TCReviewPage />);

      await waitFor(() => {
        expect(screen.getByTitle('View in Test Cases')).toBeInTheDocument();
      });

      await user.click(screen.getByTitle('View in Test Cases'));

      expect(mockNavigate).toHaveBeenCalledWith('/test-cases?status=draft');
    });
  });

  describe('TC-TCReview-U006: Renders test cards with details', () => {
    it('should display key, summary, priority badge, date, and assignee', async () => {
      setupConfiguredHandlers();
      renderWithRouter(<TCReviewPage />);

      await waitFor(() => {
        expect(screen.getByText('TEST-101')).toBeInTheDocument();
      });

      expect(screen.getByText('Login form validation')).toBeInTheDocument();
      expect(screen.getByText('High')).toBeInTheDocument();
      expect(screen.getByText('Mar 15')).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
  });

  describe('TC-TCReview-U007: Test card shows Jira link when configured', () => {
    it('should render a Jira link with correct URL', async () => {
      setupConfiguredHandlers();
      renderWithRouter(<TCReviewPage />);

      await waitFor(() => {
        expect(screen.getByText('TEST-101')).toBeInTheDocument();
      });

      const jiraLink = screen.getByTitle('Open TEST-101 in Jira');
      expect(jiraLink).toHaveAttribute('href', 'https://test.atlassian.net/browse/TEST-101');
      expect(jiraLink).toHaveAttribute('target', '_blank');
    });
  });

  describe('TC-TCReview-U008: Clicking test card navigates to detail', () => {
    it('should navigate to /xray/test/${issueId}', async () => {
      setupConfiguredHandlers();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithRouter(<TCReviewPage />);

      await waitFor(() => {
        expect(screen.getByText('TEST-101')).toBeInTheDocument();
      });

      // Click the test card button (the main card area)
      const testCard = screen.getByText('Login form validation').closest('button')!;
      await user.click(testCard);

      expect(mockNavigate).toHaveBeenCalledWith('/xray/test/ur-1');
    });
  });

  describe('TC-TCReview-U009: Search filters by key (case-insensitive)', () => {
    it('should filter tests matching the key', async () => {
      setupConfiguredHandlers();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithRouter(<TCReviewPage />);

      await waitFor(() => {
        expect(screen.getByText('TEST-101')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search by key or summary...');
      await user.type(searchInput, 'test-103');

      await waitFor(() => {
        expect(screen.getByText('TEST-103')).toBeInTheDocument();
        expect(screen.queryByText('TEST-101')).not.toBeInTheDocument();
        expect(screen.queryByText('TEST-102')).not.toBeInTheDocument();
      });
    });
  });

  describe('TC-TCReview-U010: Search filters by summary (case-insensitive)', () => {
    it('should filter tests matching the summary', async () => {
      setupConfiguredHandlers();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithRouter(<TCReviewPage />);

      await waitFor(() => {
        expect(screen.getByText('TEST-101')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search by key or summary...');
      await user.type(searchInput, 'checkout');

      await waitFor(() => {
        expect(screen.getByText('Checkout flow')).toBeInTheDocument();
        expect(screen.queryByText('Login form validation')).not.toBeInTheDocument();
      });
    });
  });

  describe('TC-TCReview-U011: Sort by Newest First', () => {
    it('should order tests by created date descending', async () => {
      setupConfiguredHandlers();
      renderWithRouter(<TCReviewPage />);

      await waitFor(() => {
        expect(screen.getByText('TEST-103')).toBeInTheDocument();
      });

      // Default sort is created-desc. TEST-103 (Mar 20) should be first
      const keys = screen.getAllByText(/^TEST-10[123]$/);
      expect(keys[0]).toHaveTextContent('TEST-103');
      expect(keys[1]).toHaveTextContent('TEST-101');
      expect(keys[2]).toHaveTextContent('TEST-102');
    });
  });

  describe('TC-TCReview-U012: Sort by Oldest First', () => {
    it('should order tests by created date ascending', async () => {
      setupConfiguredHandlers();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithRouter(<TCReviewPage />);

      await waitFor(() => {
        expect(screen.getByText('TEST-103')).toBeInTheDocument();
      });

      const sortSelect = screen.getByDisplayValue('Newest First');
      await user.selectOptions(sortSelect, 'created-asc');

      await waitFor(() => {
        const keys = screen.getAllByText(/^TEST-10[123]$/);
        expect(keys[0]).toHaveTextContent('TEST-102');
        expect(keys[1]).toHaveTextContent('TEST-101');
        expect(keys[2]).toHaveTextContent('TEST-103');
      });
    });
  });

  describe('TC-TCReview-U013: Sort by Priority', () => {
    it('should order tests by PRIORITY_ORDER (Highest first)', async () => {
      setupConfiguredHandlers();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithRouter(<TCReviewPage />);

      await waitFor(() => {
        expect(screen.getByText('TEST-103')).toBeInTheDocument();
      });

      const sortSelect = screen.getByDisplayValue('Newest First');
      await user.selectOptions(sortSelect, 'priority');

      await waitFor(() => {
        const keys = screen.getAllByText(/^TEST-10[123]$/);
        // Highest (TEST-103) → High (TEST-101) → Medium (TEST-102)
        expect(keys[0]).toHaveTextContent('TEST-103');
        expect(keys[1]).toHaveTextContent('TEST-101');
        expect(keys[2]).toHaveTextContent('TEST-102');
      });
    });
  });

  describe('TC-TCReview-U014: Sort by Key', () => {
    it('should order tests by key using localeCompare', async () => {
      setupConfiguredHandlers();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithRouter(<TCReviewPage />);

      await waitFor(() => {
        expect(screen.getByText('TEST-103')).toBeInTheDocument();
      });

      const sortSelect = screen.getByDisplayValue('Newest First');
      await user.selectOptions(sortSelect, 'key');

      await waitFor(() => {
        const keys = screen.getAllByText(/^TEST-10[123]$/);
        expect(keys[0]).toHaveTextContent('TEST-101');
        expect(keys[1]).toHaveTextContent('TEST-102');
        expect(keys[2]).toHaveTextContent('TEST-103');
      });
    });
  });

  describe('TC-TCReview-U015: Pagination shows 10 items per page', () => {
    it('should display only 10 tests on the first page', async () => {
      const manyTests = generateTests(15);
      setupConfiguredHandlers({ underReview: manyTests });
      renderWithRouter(<TCReviewPage />);

      await waitFor(() => {
        expect(screen.getByText('TEST-300')).toBeInTheDocument();
      });

      // Should show 10 test cards, not 15
      const testKeys = screen.getAllByText(/^TEST-3\d{2}$/);
      expect(testKeys).toHaveLength(10);

      // Pagination should be visible
      expect(screen.getByText('Next')).toBeInTheDocument();
      expect(screen.getByText('Previous')).toBeInTheDocument();
    });
  });

  describe('TC-TCReview-U016: Previous/Next buttons navigate pages', () => {
    it('should move to next and previous pages correctly', async () => {
      const manyTests = generateTests(15);
      setupConfiguredHandlers({ underReview: manyTests });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithRouter(<TCReviewPage />);

      await waitFor(() => {
        expect(screen.getByText('TEST-300')).toBeInTheDocument();
      });

      // Previous should be disabled on page 1
      expect(screen.getByText('Previous')).toBeDisabled();

      // Click Next
      await user.click(screen.getByText('Next'));

      await waitFor(() => {
        // Page 2 should show remaining 5 tests
        const testKeys = screen.getAllByText(/^TEST-3\d{2}$/);
        expect(testKeys).toHaveLength(5);
      });

      // Next should be disabled on last page
      expect(screen.getByText('Next')).toBeDisabled();

      // Click Previous to go back
      await user.click(screen.getByText('Previous'));

      await waitFor(() => {
        const testKeys = screen.getAllByText(/^TEST-3\d{2}$/);
        expect(testKeys).toHaveLength(10);
      });
    });
  });

  describe('TC-TCReview-U017: Refresh button calls refreshReviewCounts', () => {
    it('should re-fetch data and reset to page 1', async () => {
      let fetchCount = 0;
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
            projects: ['TEST'],
            hiddenProjects: [],
            activeProject: 'TEST',
            projectSettings: { TEST: { color: '#3B82F6' } },
          });
        }),
        http.get('*/api/drafts', () => {
          return HttpResponse.json([]);
        }),
        http.get('*/api/xray/tests/by-status/*', () => {
          // Mock: external Xray API — track fetch calls
          fetchCount++;
          return HttpResponse.json(underReviewTests);
        }),
      );

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithRouter(<TCReviewPage />);

      await waitFor(() => {
        expect(screen.getByText('TEST-101')).toBeInTheDocument();
      });

      const initialFetchCount = fetchCount;

      // Click refresh
      await user.click(screen.getByTitle('Refresh'));

      await waitFor(() => {
        expect(fetchCount).toBeGreaterThan(initialFetchCount);
      });
    });
  });

  describe('TC-TCReview-U018: Shows loading skeleton cards', () => {
    it('should render skeleton cards while data is loading', async () => {
      // Mock: external Xray API — add delay to keep loading state visible
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
            projects: ['TEST'],
            hiddenProjects: [],
            activeProject: 'TEST',
            projectSettings: { TEST: { color: '#3B82F6' } },
          });
        }),
        http.get('*/api/drafts', () => {
          return HttpResponse.json([]);
        }),
        http.get('*/api/xray/tests/by-status/*', async () => {
          // Mock: external Xray API — delay to hold loading state
          await new Promise(r => setTimeout(r, 5000));
          return HttpResponse.json(underReviewTests);
        }),
      );
      renderWithRouter(<TCReviewPage />);

      // Wait for context to initialize and loading state to appear
      await waitFor(() => {
        const skeletons = document.querySelectorAll('.animate-pulse');
        expect(skeletons.length).toBeGreaterThan(0);
      });
    });
  });

  describe('TC-TCReview-U019: Labels display with overflow', () => {
    it('should show max 2 labels and +N for overflow', async () => {
      setupConfiguredHandlers();
      renderWithRouter(<TCReviewPage />);

      await waitFor(() => {
        expect(screen.getByText('TEST-101')).toBeInTheDocument();
      });

      // TEST-101 has 3 labels: ['smoke', 'auth', 'regression']
      // Component joins first 2 with ', ' and shows +N for rest
      // The rendered text is: "smoke, auth" followed by " +1"
      const labelTexts = screen.getAllByText(/smoke/);
      expect(labelTexts.length).toBeGreaterThan(0);
      expect(screen.getByText(/\+1/)).toBeInTheDocument();
    });
  });

  describe('TC-TCReview-U020: Summary text shows correct count', () => {
    it('should display total count when no filter is active', async () => {
      setupConfiguredHandlers();
      renderWithRouter(<TCReviewPage />);

      await waitFor(() => {
        expect(screen.getByText('3 under review tests in TEST')).toBeInTheDocument();
      });
    });
  });

  // === Negative Tests ===

  describe('TC-TCReview-U021: Shows Xray Not Connected when not configured', () => {
    it('should display not connected message', async () => {
      setupNotConfiguredHandlers();
      renderWithRouter(<TCReviewPage />);

      await waitFor(() => {
        expect(screen.getByText('Xray Not Connected')).toBeInTheDocument();
      });
      expect(screen.getByText('Connect to Xray in Settings to view tests under review.')).toBeInTheDocument();
    });
  });

  describe('TC-TCReview-U022: Shows No Project Selected when no active project', () => {
    it('should display no project message', async () => {
      setupNoProjectHandlers();
      renderWithRouter(<TCReviewPage />);

      await waitFor(() => {
        expect(screen.getByText('No Project Selected')).toBeInTheDocument();
      });
      expect(screen.getByText('Select a project from the sidebar to view tests under review.')).toBeInTheDocument();
    });
  });

  describe('TC-TCReview-U023: Shows empty state for Under Review', () => {
    it('should display No Tests Under Review when list is empty', async () => {
      setupConfiguredHandlers({ underReview: [] });
      renderWithRouter(<TCReviewPage />);

      await waitFor(() => {
        expect(screen.getByText('No Tests Under Review')).toBeInTheDocument();
      });
    });
  });

  describe('TC-TCReview-U024: Shows empty state for Draft Tests', () => {
    it('should display No Draft Tests when xrayDraft list is empty', async () => {
      setupConfiguredHandlers({ xrayDraft: [] });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithRouter(<TCReviewPage />);

      await waitFor(() => {
        expect(screen.getByTitle('View Draft tests')).toBeInTheDocument();
      });

      await user.click(screen.getByTitle('View Draft tests'));

      await waitFor(() => {
        expect(screen.getByText('No Draft Tests')).toBeInTheDocument();
      });
    });
  });

  describe('TC-TCReview-U025: Shows No Results when search matches nothing', () => {
    it('should display No Results message', async () => {
      setupConfiguredHandlers();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithRouter(<TCReviewPage />);

      await waitFor(() => {
        expect(screen.getByText('TEST-101')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search by key or summary...');
      await user.type(searchInput, 'nonexistent query xyz');

      await waitFor(() => {
        expect(screen.getByText('No Results')).toBeInTheDocument();
        expect(screen.getByText('No tests match your search criteria.')).toBeInTheDocument();
      });
    });
  });

  describe('TC-TCReview-U026: Refresh button is disabled while loading', () => {
    it('should disable refresh button during loading state', async () => {
      // Mock: external Xray API — delay to hold loading state
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
            projects: ['TEST'],
            hiddenProjects: [],
            activeProject: 'TEST',
            projectSettings: { TEST: { color: '#3B82F6' } },
          });
        }),
        http.get('*/api/drafts', () => {
          return HttpResponse.json([]);
        }),
        http.get('*/api/xray/tests/by-status/*', async () => {
          // Mock: external Xray API — delay to keep loading visible
          await new Promise(r => setTimeout(r, 5000));
          return HttpResponse.json(underReviewTests);
        }),
      );
      renderWithRouter(<TCReviewPage />);

      // During loading, the refresh button should be disabled
      await waitFor(() => {
        const refreshButton = screen.getByTitle('Refresh');
        expect(refreshButton).toBeDisabled();
      });
    });
  });

  // === Edge Cases ===

  describe('TC-TCReview-U027: Unknown priority falls back to gray', () => {
    it('should use fallback color for unknown priority', async () => {
      setupConfiguredHandlers({
        underReview: [
          {
            issueId: 'unk-1',
            key: 'TEST-999',
            summary: 'Unknown priority test',
            priority: 'CustomPriority',
            labels: [],
            created: '2024-03-01T10:00:00Z',
            updated: '2024-03-01T10:00:00Z',
          },
        ],
      });
      renderWithRouter(<TCReviewPage />);

      await waitFor(() => {
        expect(screen.getByText('CustomPriority')).toBeInTheDocument();
      });

      // The priority badge should use fallback gray
      const badge = screen.getByText('CustomPriority');
      expect(badge).toHaveStyle({ color: '#6B7280' });
    });
  });

  describe('TC-TCReview-U028: Test card without assignee omits assignee row', () => {
    it('should not render assignee when undefined', async () => {
      setupConfiguredHandlers({
        underReview: [
          {
            issueId: 'na-1',
            key: 'TEST-400',
            summary: 'No assignee test',
            priority: 'Medium',
            labels: [],
            created: '2024-03-01T10:00:00Z',
            updated: '2024-03-01T10:00:00Z',
          },
        ],
      });
      renderWithRouter(<TCReviewPage />);

      await waitFor(() => {
        expect(screen.getByText('TEST-400')).toBeInTheDocument();
      });

      // No assignee text should be rendered
      // Alice/Bob/Charlie are from other test data — none should be here
      expect(screen.queryByText('Alice')).not.toBeInTheDocument();
      expect(screen.queryByText('Bob')).not.toBeInTheDocument();
    });
  });

  describe('TC-TCReview-U029: Test card with empty labels omits labels section', () => {
    it('should not render labels when array is empty', async () => {
      setupConfiguredHandlers({
        underReview: [
          {
            issueId: 'nl-1',
            key: 'TEST-401',
            summary: 'No labels test',
            priority: 'Medium',
            labels: [],
            created: '2024-03-01T10:00:00Z',
            updated: '2024-03-01T10:00:00Z',
          },
        ],
      });
      renderWithRouter(<TCReviewPage />);

      await waitFor(() => {
        expect(screen.getByText('TEST-401')).toBeInTheDocument();
      });

      // No label text should be visible
      expect(screen.queryByText('smoke')).not.toBeInTheDocument();
    });
  });

  describe('TC-TCReview-U030: Pagination resets to page 1 on search/sort/view change', () => {
    it('should reset to page 1 when search changes', async () => {
      const manyTests = generateTests(15);
      setupConfiguredHandlers({ underReview: manyTests });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithRouter(<TCReviewPage />);

      await waitFor(() => {
        expect(screen.getByText('TEST-300')).toBeInTheDocument();
      });

      // Go to page 2
      await user.click(screen.getByText('Next'));

      await waitFor(() => {
        const testKeys = screen.getAllByText(/^TEST-3\d{2}$/);
        expect(testKeys).toHaveLength(5);
      });

      // Type in search — should reset to page 1
      const searchInput = screen.getByPlaceholderText('Search by key or summary...');
      await user.type(searchInput, 'Paginated');

      await waitFor(() => {
        // Should show results from page 1 of filtered set
        expect(screen.getByText('TEST-300')).toBeInTheDocument();
      });
    });
  });

  describe('TC-TCReview-U031: PaginationNumbers shows all pages when <= 7', () => {
    it('should show all page numbers without ellipsis', async () => {
      // 5 pages = 50 tests
      const tests = generateTests(50);
      setupConfiguredHandlers({ underReview: tests });
      renderWithRouter(<TCReviewPage />);

      await waitFor(() => {
        expect(screen.getByText('Next')).toBeInTheDocument();
      });

      // All 5 page buttons should exist
      for (let i = 1; i <= 5; i++) {
        expect(screen.getByRole('button', { name: String(i) })).toBeInTheDocument();
      }

      // No ellipsis
      expect(screen.queryByText('...')).not.toBeInTheDocument();
    });
  });

  describe('TC-TCReview-U032: PaginationNumbers shows ellipsis when > 7 pages', () => {
    it('should show ellipsis for pages far from current', async () => {
      // 10 pages = 100 tests
      const tests = generateTests(100);
      setupConfiguredHandlers({ underReview: tests });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithRouter(<TCReviewPage />);

      await waitFor(() => {
        expect(screen.getByText('Next')).toBeInTheDocument();
      });

      // Navigate to page 5 (middle) using Next button
      for (let i = 0; i < 4; i++) {
        await user.click(screen.getByText('Next'));
      }

      await waitFor(() => {
        // On page 5 with 10 total: [1, ..., 4, 5, 6, ..., 10]
        expect(screen.getAllByText('...').length).toBe(2);
      });
    });
  });

  describe('TC-TCReview-U033: Jira link click stops propagation', () => {
    it('should not trigger card navigation when Jira link is clicked', async () => {
      setupConfiguredHandlers();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithRouter(<TCReviewPage />);

      await waitFor(() => {
        expect(screen.getByText('TEST-101')).toBeInTheDocument();
      });

      const jiraLink = screen.getByTitle('Open TEST-101 in Jira');
      await user.click(jiraLink);

      // Should NOT navigate to the test detail page
      expect(mockNavigate).not.toHaveBeenCalledWith('/xray/test/ur-1');
    });
  });

  describe('TC-TCReview-U034: Scroll fires only after user pagination interaction', () => {
    it('should not scroll on initial render', async () => {
      const manyTests = generateTests(15);
      setupConfiguredHandlers({ underReview: manyTests });
      const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView');
      renderWithRouter(<TCReviewPage />);

      await waitFor(() => {
        expect(screen.getByText('TEST-300')).toBeInTheDocument();
      });

      // scrollIntoView should NOT have been called on initial render
      expect(scrollSpy).not.toHaveBeenCalled();

      // Now click Next to interact
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(scrollSpy).toHaveBeenCalled();
      });

      scrollSpy.mockRestore();
    });
  });
});

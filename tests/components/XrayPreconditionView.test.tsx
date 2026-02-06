import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '../helpers/render';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { XrayPreconditionView } from '../../client/src/components/features/xray/XrayPreconditionView';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '../../client/src/context/ThemeContext';
import { AppProvider } from '../../client/src/context/AppContext';

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

const fullPrecondition = {
  issueId: 'pc-1',
  key: 'PC-101',
  summary: 'User must be authenticated',
  description: 'The user must have a valid session before this test can run.',
  preconditionType: 'Manual',
  definition: 'Login with valid credentials\nVerify session cookie is set',
  priority: 'High',
  labels: ['auth', 'smoke'],
};

const minimalPrecondition = {
  issueId: 'pc-2',
  key: 'PC-102',
  summary: 'Minimal precondition',
  description: '',
  preconditionType: 'Generic',
  definition: '',
  priority: '',
  labels: [],
};

// --- Helpers ---

function renderPreconditionView(issueId: string = 'pc-1') {
  return render(
    <MemoryRouter initialEntries={[`/xray/precondition/${issueId}`]}>
      <ThemeProvider>
        <AppProvider>
          <Routes>
            <Route path="/xray/precondition/:issueId" element={<XrayPreconditionView />} />
          </Routes>
        </AppProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

function setupSuccessHandler(data = fullPrecondition) {
  server.use(
    http.get('*/api/xray/precondition/:issueId', () => {
      return HttpResponse.json(data);
    }),
  );
}

function setupErrorHandler(message = 'Server error', status = 500) {
  server.use(
    http.get('*/api/xray/precondition/:issueId', () => {
      return HttpResponse.json({ error: message }, { status });
    }),
  );
}

// --- Tests ---

describe('XrayPreconditionView', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    // Mock: config API — provide jiraBaseUrl for Jira link tests
    server.use(
      http.get('*/api/config', () => {
        return HttpResponse.json({
          configured: true,
          jiraBaseUrl: 'https://mycompany.atlassian.net',
          hasCredentials: true,
        });
      }),
    );
  });

  // ===== POSITIVE TESTS =====

  describe('TC-XrayPrecondView-U001: Renders loading skeleton on initial mount', () => {
    it('should show animated pulse placeholders while loading', () => {
      setupSuccessHandler();
      renderPreconditionView();

      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  describe('TC-XrayPrecondView-U002: Renders precondition key, type badge, and summary after fetch', () => {
    it('should display key, type badge, and summary text', async () => {
      setupSuccessHandler();
      renderPreconditionView();

      await waitFor(() => {
        expect(screen.getByText('PC-101')).toBeInTheDocument();
      });
      expect(screen.getByText('Manual')).toBeInTheDocument();
      expect(screen.getByText('User must be authenticated')).toBeInTheDocument();
    });
  });

  describe('TC-XrayPrecondView-U003: Renders priority badge when priority is present', () => {
    it('should display priority badge', async () => {
      setupSuccessHandler();
      renderPreconditionView();

      await waitFor(() => {
        expect(screen.getByText('High')).toBeInTheDocument();
      });
    });
  });

  describe('TC-XrayPrecondView-U004: Renders description card with text content', () => {
    it('should show description heading and content', async () => {
      setupSuccessHandler();
      renderPreconditionView();

      await waitFor(() => {
        expect(screen.getByText('Description')).toBeInTheDocument();
      });
      expect(screen.getByText(/The user must have a valid session/)).toBeInTheDocument();
    });
  });

  describe('TC-XrayPrecondView-U005: Renders Jira wiki markup links as clickable anchors', () => {
    it('should convert [text|url] to anchor elements', async () => {
      const precondition = {
        ...fullPrecondition,
        description: 'See [Jira docs|https://docs.example.com] for details',
      };
      setupSuccessHandler(precondition);
      renderPreconditionView();

      await waitFor(() => {
        expect(screen.getByText('Jira docs')).toBeInTheDocument();
      });
      const link = screen.getByText('Jira docs');
      expect(link.tagName).toBe('A');
      expect(link).toHaveAttribute('href', 'https://docs.example.com');
      expect(link).toHaveAttribute('target', '_blank');
    });
  });

  describe('TC-XrayPrecondView-U006: Renders plain URLs in description as clickable anchors', () => {
    it('should convert plain URLs to anchor elements', async () => {
      const precondition = {
        ...fullPrecondition,
        description: 'Visit https://example.com/setup for instructions',
      };
      setupSuccessHandler(precondition);
      renderPreconditionView();

      await waitFor(() => {
        expect(screen.getByText('https://example.com/setup')).toBeInTheDocument();
      });
      const link = screen.getByText('https://example.com/setup');
      expect(link.tagName).toBe('A');
      expect(link).toHaveAttribute('href', 'https://example.com/setup');
    });
  });

  describe('TC-XrayPrecondView-U007: Renders labels as badge chips', () => {
    it('should display all labels as styled badges', async () => {
      setupSuccessHandler();
      renderPreconditionView();

      await waitFor(() => {
        expect(screen.getByText('auth')).toBeInTheDocument();
      });
      expect(screen.getByText('smoke')).toBeInTheDocument();
    });
  });

  describe('TC-XrayPrecondView-U008: Renders precondition definition in code block', () => {
    it('should show definition content in a pre element', async () => {
      setupSuccessHandler();
      renderPreconditionView();

      await waitFor(() => {
        expect(screen.getByText('Precondition Definition')).toBeInTheDocument();
      });
      expect(screen.getByText(/Login with valid credentials/)).toBeInTheDocument();
    });
  });

  describe('TC-XrayPrecondView-U009: Renders Open in Jira link with correct URL', () => {
    it('should show Jira link with base URL and key', async () => {
      setupSuccessHandler();
      renderPreconditionView();

      await waitFor(() => {
        expect(screen.getByText('Open in Jira')).toBeInTheDocument();
      });
      const jiraLink = screen.getByText('Open in Jira').closest('a');
      expect(jiraLink).toHaveAttribute('href', 'https://mycompany.atlassian.net/browse/PC-101');
      expect(jiraLink).toHaveAttribute('target', '_blank');
    });
  });

  describe('TC-XrayPrecondView-U010: Back button calls navigate(-1)', () => {
    it('should navigate back when back button is clicked', async () => {
      setupSuccessHandler();
      renderPreconditionView();

      await waitFor(() => {
        expect(screen.getByText('PC-101')).toBeInTheDocument();
      });

      const backButton = screen.getByTitle('Go back');
      await userEvent.click(backButton);

      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });
  });

  // ===== NEGATIVE TESTS =====

  describe('TC-XrayPrecondView-U011: Shows error card with message when API call fails', () => {
    it('should display error message from failed request', async () => {
      setupErrorHandler('Precondition not accessible');
      renderPreconditionView();

      await waitFor(() => {
        expect(screen.getByText('Failed to Load Precondition')).toBeInTheDocument();
      });
      expect(screen.getByText('Precondition not accessible')).toBeInTheDocument();
    });
  });

  describe('TC-XrayPrecondView-U012: Shows "Precondition not found" when precondition is null', () => {
    it('should display fallback message when no error but null data', async () => {
      server.use(
        http.get('*/api/xray/precondition/:issueId', () => {
          return HttpResponse.json(null);
        }),
      );
      renderPreconditionView();

      await waitFor(() => {
        expect(screen.getByText('Failed to Load Precondition')).toBeInTheDocument();
      });
      expect(screen.getByText('Precondition not found')).toBeInTheDocument();
    });
  });

  describe('TC-XrayPrecondView-U013: Error card Go Back button calls navigate(-1)', () => {
    it('should navigate back from error state', async () => {
      setupErrorHandler();
      renderPreconditionView();

      await waitFor(() => {
        expect(screen.getByText('Failed to Load Precondition')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: 'Go Back' }));

      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });
  });

  // ===== EDGE CASES =====

  describe('TC-XrayPrecondView-U014: Does not render description card when description is empty', () => {
    it('should omit description section for empty description', async () => {
      setupSuccessHandler(minimalPrecondition);
      renderPreconditionView('pc-2');

      await waitFor(() => {
        expect(screen.getByText('PC-102')).toBeInTheDocument();
      });
      expect(screen.queryByText('Description')).not.toBeInTheDocument();
    });
  });

  describe('TC-XrayPrecondView-U015: Does not render labels card when labels array is empty', () => {
    it('should omit labels section for empty labels', async () => {
      setupSuccessHandler(minimalPrecondition);
      renderPreconditionView('pc-2');

      await waitFor(() => {
        expect(screen.getByText('PC-102')).toBeInTheDocument();
      });
      expect(screen.queryByText('Labels')).not.toBeInTheDocument();
    });
  });

  describe('TC-XrayPrecondView-U016: Renders "No precondition definition provided" when definition is empty', () => {
    it('should show placeholder text for missing definition', async () => {
      setupSuccessHandler(minimalPrecondition);
      renderPreconditionView('pc-2');

      await waitFor(() => {
        expect(screen.getByText('No precondition definition provided')).toBeInTheDocument();
      });
    });
  });

  describe('TC-XrayPrecondView-U017: Does not render priority badge when priority is empty string', () => {
    it('should omit priority badge for empty priority', async () => {
      setupSuccessHandler(minimalPrecondition);
      renderPreconditionView('pc-2');

      await waitFor(() => {
        expect(screen.getByText('PC-102')).toBeInTheDocument();
      });
      // Only type badge should be present, not priority
      expect(screen.getByText('Generic')).toBeInTheDocument();
      // No priority badge — check there's no element between type badge and summary
      expect(screen.queryByText('High')).not.toBeInTheDocument();
    });
  });

  describe('TC-XrayPrecondView-U018: Does not render Open in Jira link when jiraBaseUrl is not configured', () => {
    it('should omit Jira link when config has no jiraBaseUrl', async () => {
      server.use(
        http.get('*/api/config', () => {
          return HttpResponse.json({ configured: false });
        }),
      );
      setupSuccessHandler();
      renderPreconditionView();

      await waitFor(() => {
        expect(screen.getByText('PC-101')).toBeInTheDocument();
      });
      expect(screen.queryByText('Open in Jira')).not.toBeInTheDocument();
    });
  });

  describe('TC-XrayPrecondView-U019: parseJiraMarkup handles mixed text, wiki links, and plain URLs', () => {
    it('should render mixed content with links and text interleaved', async () => {
      const precondition = {
        ...fullPrecondition,
        description: 'Start here [Guide|https://guide.com] then go to https://next.com and done.',
      };
      setupSuccessHandler(precondition);
      renderPreconditionView();

      await waitFor(() => {
        expect(screen.getByText('Guide')).toBeInTheDocument();
      });
      expect(screen.getByText('Guide')).toHaveAttribute('href', 'https://guide.com');
      expect(screen.getByText('https://next.com')).toHaveAttribute('href', 'https://next.com');
      expect(screen.getByText(/Start here/)).toBeInTheDocument();
      expect(screen.getByText(/and done/)).toBeInTheDocument();
    });
  });

  describe('TC-XrayPrecondView-U020: parseJiraMarkup returns original text when no links present', () => {
    it('should render plain text without any anchor elements', async () => {
      const precondition = {
        ...fullPrecondition,
        description: 'Just plain text with no links whatsoever',
      };
      setupSuccessHandler(precondition);
      renderPreconditionView();

      await waitFor(() => {
        expect(screen.getByText('Just plain text with no links whatsoever')).toBeInTheDocument();
      });
      // Verify no anchor elements in the description area
      const descriptionSection = screen.getByText('Just plain text with no links whatsoever');
      expect(descriptionSection.querySelector('a')).toBeNull();
    });
  });
});

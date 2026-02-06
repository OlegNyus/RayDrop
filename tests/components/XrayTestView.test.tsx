import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '../helpers/render';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { XrayTestView } from '../../client/src/components/features/xray/XrayTestView';
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

const fullTest = {
  issueId: 't-1',
  key: 'TEST-101',
  summary: 'Verify user login flow',
  description: 'End-to-end login test covering valid credentials.',
  testType: 'Manual',
  priority: 'High',
  labels: ['smoke', 'regression'],
  steps: [
    { id: 's1', action: 'Open login page', data: '', result: 'Login form is displayed' },
    { id: 's2', action: 'Enter credentials', data: '{"username": "admin", "password": "pass123"}', result: 'Fields populated' },
    { id: 's3', action: 'Click submit', data: '', result: 'Dashboard is shown' },
  ],
};

const minimalTest = {
  issueId: 't-2',
  key: 'TEST-102',
  summary: 'Minimal test',
  description: '',
  testType: 'Automated',
  priority: '',
  labels: [],
  steps: [],
};

// --- Helpers ---

function renderTestView(issueId: string = 't-1') {
  return render(
    <MemoryRouter initialEntries={[`/xray/test/${issueId}`]}>
      <ThemeProvider>
        <AppProvider>
          <Routes>
            <Route path="/xray/test/:issueId" element={<XrayTestView />} />
          </Routes>
        </AppProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

function setupSuccessHandler(data = fullTest) {
  server.use(
    http.get('*/api/xray/tests/:issueId', () => {
      return HttpResponse.json(data);
    }),
  );
}

function setupErrorHandler(message = 'Server error', status = 500) {
  server.use(
    http.get('*/api/xray/tests/:issueId', () => {
      return HttpResponse.json({ error: message }, { status });
    }),
  );
}

// --- Tests ---

describe('XrayTestView', () => {
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

  describe('TC-XrayTestView-U001: Renders loading skeleton on initial mount', () => {
    it('should show animated pulse placeholders while loading', () => {
      setupSuccessHandler();
      renderTestView();

      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  describe('TC-XrayTestView-U002: Renders test key, type badge, and summary after fetch', () => {
    it('should display key, type badge, and summary text', async () => {
      setupSuccessHandler();
      renderTestView();

      await waitFor(() => {
        expect(screen.getByText('TEST-101')).toBeInTheDocument();
      });
      expect(screen.getByText('Manual')).toBeInTheDocument();
      expect(screen.getByText('Verify user login flow')).toBeInTheDocument();
    });
  });

  describe('TC-XrayTestView-U003: Renders priority badge when priority is present', () => {
    it('should display priority badge', async () => {
      setupSuccessHandler();
      renderTestView();

      await waitFor(() => {
        expect(screen.getByText('High')).toBeInTheDocument();
      });
    });
  });

  describe('TC-XrayTestView-U004: Renders description card with text content', () => {
    it('should show description heading and content', async () => {
      setupSuccessHandler();
      renderTestView();

      await waitFor(() => {
        expect(screen.getByText('Description')).toBeInTheDocument();
      });
      expect(screen.getByText(/End-to-end login test/)).toBeInTheDocument();
    });
  });

  describe('TC-XrayTestView-U005: Renders Jira wiki markup links as clickable anchors in description', () => {
    it('should convert [text|url] to anchor elements', async () => {
      const testData = {
        ...fullTest,
        description: 'Refer to [test guide|https://wiki.example.com/guide] for setup',
      };
      setupSuccessHandler(testData);
      renderTestView();

      await waitFor(() => {
        expect(screen.getByText('test guide')).toBeInTheDocument();
      });
      const link = screen.getByText('test guide');
      expect(link.tagName).toBe('A');
      expect(link).toHaveAttribute('href', 'https://wiki.example.com/guide');
      expect(link).toHaveAttribute('target', '_blank');
    });
  });

  describe('TC-XrayTestView-U006: Renders plain URLs in description as clickable anchors', () => {
    it('should convert plain URLs to anchor elements', async () => {
      const testData = {
        ...fullTest,
        description: 'See https://example.com/docs for more info',
      };
      setupSuccessHandler(testData);
      renderTestView();

      await waitFor(() => {
        expect(screen.getByText('https://example.com/docs')).toBeInTheDocument();
      });
      const link = screen.getByText('https://example.com/docs');
      expect(link.tagName).toBe('A');
      expect(link).toHaveAttribute('href', 'https://example.com/docs');
    });
  });

  describe('TC-XrayTestView-U007: Renders labels as badge chips', () => {
    it('should display all labels as styled badges', async () => {
      setupSuccessHandler();
      renderTestView();

      await waitFor(() => {
        expect(screen.getByText('smoke')).toBeInTheDocument();
      });
      expect(screen.getByText('regression')).toBeInTheDocument();
    });
  });

  describe('TC-XrayTestView-U008: Renders test steps with numbered headers, action, data, and expected result', () => {
    it('should display all steps with their content', async () => {
      setupSuccessHandler();
      renderTestView();

      await waitFor(() => {
        expect(screen.getByText('Test Steps (3)')).toBeInTheDocument();
      });

      // Step numbers
      expect(screen.getByText('Step 1')).toBeInTheDocument();
      expect(screen.getByText('Step 2')).toBeInTheDocument();
      expect(screen.getByText('Step 3')).toBeInTheDocument();

      // Actions
      expect(screen.getByText('Open login page')).toBeInTheDocument();
      expect(screen.getByText('Enter credentials')).toBeInTheDocument();
      expect(screen.getByText('Click submit')).toBeInTheDocument();

      // Expected results
      expect(screen.getByText('Login form is displayed')).toBeInTheDocument();
      expect(screen.getByText('Fields populated')).toBeInTheDocument();
      expect(screen.getByText('Dashboard is shown')).toBeInTheDocument();
    });
  });

  describe('TC-XrayTestView-U009: Renders Open in Jira link with correct URL', () => {
    it('should show Jira link with base URL and key', async () => {
      setupSuccessHandler();
      renderTestView();

      await waitFor(() => {
        expect(screen.getByText('Open in Jira')).toBeInTheDocument();
      });
      const jiraLink = screen.getByText('Open in Jira').closest('a');
      expect(jiraLink).toHaveAttribute('href', 'https://mycompany.atlassian.net/browse/TEST-101');
      expect(jiraLink).toHaveAttribute('target', '_blank');
    });
  });

  describe('TC-XrayTestView-U010: Back button calls navigate(-1)', () => {
    it('should navigate back when back button is clicked', async () => {
      setupSuccessHandler();
      renderTestView();

      await waitFor(() => {
        expect(screen.getByText('TEST-101')).toBeInTheDocument();
      });

      const backButton = screen.getByTitle('Go back');
      await userEvent.click(backButton);

      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });
  });

  describe('TC-XrayTestView-U011: Step data renders as CodeBlock when content is detected as code', () => {
    it('should render JSON step data in a code block', async () => {
      setupSuccessHandler();
      renderTestView();

      await waitFor(() => {
        expect(screen.getByText('Test Steps (3)')).toBeInTheDocument();
      });

      // Step 2 has JSON data — detectCode should identify it as code
      // CodeBlock renders a <pre> element with the code content
      const codeBlocks = document.querySelectorAll('pre');
      const jsonBlock = Array.from(codeBlocks).find(el =>
        el.textContent?.includes('"username"')
      );
      expect(jsonBlock).toBeTruthy();
    });
  });

  describe('TC-XrayTestView-U012: Step data strips Xray wiki {code:lang}...{code} format and renders as CodeBlock', () => {
    it('should strip wiki code tags and render content as code block', async () => {
      const testData = {
        ...fullTest,
        steps: [
          { id: 's1', action: 'Send request', data: '{code:json}\n{"key": "value"}\n{code}', result: '200 OK' },
        ],
      };
      setupSuccessHandler(testData);
      renderTestView();

      await waitFor(() => {
        expect(screen.getByText('Test Steps (1)')).toBeInTheDocument();
      });

      // The wiki tags should be stripped, only the content rendered
      expect(screen.queryByText('{code:json}')).not.toBeInTheDocument();
      expect(screen.queryByText('{code}')).not.toBeInTheDocument();
      const codeBlocks = document.querySelectorAll('pre');
      const jsonBlock = Array.from(codeBlocks).find(el =>
        el.textContent?.includes('"key"')
      );
      expect(jsonBlock).toBeTruthy();
    });
  });

  // ===== NEGATIVE TESTS =====

  describe('TC-XrayTestView-U013: Shows error card with message when API call fails', () => {
    it('should display error message from failed request', async () => {
      setupErrorHandler('Test not accessible');
      renderTestView();

      await waitFor(() => {
        expect(screen.getByText('Failed to Load Test')).toBeInTheDocument();
      });
      expect(screen.getByText('Test not accessible')).toBeInTheDocument();
    });
  });

  describe('TC-XrayTestView-U014: Shows "Test not found" when test is null', () => {
    it('should display fallback message when no error but null data', async () => {
      server.use(
        http.get('*/api/xray/tests/:issueId', () => {
          return HttpResponse.json(null);
        }),
      );
      renderTestView();

      await waitFor(() => {
        expect(screen.getByText('Failed to Load Test')).toBeInTheDocument();
      });
      expect(screen.getByText('Test not found')).toBeInTheDocument();
    });
  });

  describe('TC-XrayTestView-U015: Error card Go Back button calls navigate(-1)', () => {
    it('should navigate back from error state', async () => {
      setupErrorHandler();
      renderTestView();

      await waitFor(() => {
        expect(screen.getByText('Failed to Load Test')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: 'Go Back' }));

      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });
  });

  // ===== EDGE CASES =====

  describe('TC-XrayTestView-U016: Does not render description card when description is empty', () => {
    it('should omit description section for empty description', async () => {
      setupSuccessHandler(minimalTest);
      renderTestView('t-2');

      await waitFor(() => {
        expect(screen.getByText('TEST-102')).toBeInTheDocument();
      });
      expect(screen.queryByText('Description')).not.toBeInTheDocument();
    });
  });

  describe('TC-XrayTestView-U017: Does not render labels card when labels array is empty', () => {
    it('should omit labels section for empty labels', async () => {
      setupSuccessHandler(minimalTest);
      renderTestView('t-2');

      await waitFor(() => {
        expect(screen.getByText('TEST-102')).toBeInTheDocument();
      });
      expect(screen.queryByText('Labels')).not.toBeInTheDocument();
    });
  });

  describe('TC-XrayTestView-U018: Renders "No test steps defined" when steps array is empty', () => {
    it('should show placeholder text for missing steps', async () => {
      setupSuccessHandler(minimalTest);
      renderTestView('t-2');

      await waitFor(() => {
        expect(screen.getByText('No test steps defined')).toBeInTheDocument();
      });
    });
  });

  describe('TC-XrayTestView-U019: Does not render priority badge when priority is empty string', () => {
    it('should omit priority badge for empty priority', async () => {
      setupSuccessHandler(minimalTest);
      renderTestView('t-2');

      await waitFor(() => {
        expect(screen.getByText('TEST-102')).toBeInTheDocument();
      });
      expect(screen.getByText('Automated')).toBeInTheDocument();
      expect(screen.queryByText('High')).not.toBeInTheDocument();
    });
  });

  describe('TC-XrayTestView-U020: Does not render Open in Jira link when jiraBaseUrl is not configured', () => {
    it('should omit Jira link when config has no jiraBaseUrl', async () => {
      server.use(
        http.get('*/api/config', () => {
          return HttpResponse.json({ configured: false });
        }),
      );
      setupSuccessHandler();
      renderTestView();

      await waitFor(() => {
        expect(screen.getByText('TEST-101')).toBeInTheDocument();
      });
      expect(screen.queryByText('Open in Jira')).not.toBeInTheDocument();
    });
  });

  describe('TC-XrayTestView-U021: Step action shows "-" when action is empty', () => {
    it('should display dash for empty action', async () => {
      const testData = {
        ...fullTest,
        steps: [{ id: 's1', action: '', data: '', result: 'Expected outcome' }],
      };
      setupSuccessHandler(testData);
      renderTestView();

      await waitFor(() => {
        expect(screen.getByText('Test Steps (1)')).toBeInTheDocument();
      });

      // The action field should show "-" as fallback
      const actionHeaders = screen.getAllByText('Action');
      const actionSection = actionHeaders[0].closest('div');
      expect(actionSection?.textContent).toContain('-');
    });
  });

  describe('TC-XrayTestView-U022: Step expected result shows "-" when result is empty', () => {
    it('should display dash for empty result', async () => {
      const testData = {
        ...fullTest,
        steps: [{ id: 's1', action: 'Do something', data: '', result: '' }],
      };
      setupSuccessHandler(testData);
      renderTestView();

      await waitFor(() => {
        expect(screen.getByText('Test Steps (1)')).toBeInTheDocument();
      });

      const resultHeaders = screen.getAllByText('Expected Result');
      const resultSection = resultHeaders[0].closest('div');
      expect(resultSection?.textContent).toContain('-');
    });
  });

  describe('TC-XrayTestView-U023: Step data field hidden when data is empty string', () => {
    it('should not render data section when step data is empty', async () => {
      const testData = {
        ...fullTest,
        steps: [{ id: 's1', action: 'Click button', data: '', result: 'Success' }],
      };
      setupSuccessHandler(testData);
      renderTestView();

      await waitFor(() => {
        expect(screen.getByText('Test Steps (1)')).toBeInTheDocument();
      });

      // "Data" label should not appear when data is empty
      expect(screen.queryByText('Data')).not.toBeInTheDocument();
    });
  });

  describe('TC-XrayTestView-U024: parseJiraMarkup converts multiple wiki links in a single description', () => {
    it('should render two separate clickable anchors from two [text|url] links', async () => {
      const testData = {
        ...fullTest,
        description: 'See [setup guide|https://wiki.example.com/setup] and [API docs|https://wiki.example.com/api] for details',
      };
      setupSuccessHandler(testData);
      renderTestView();

      await waitFor(() => {
        expect(screen.getByText('setup guide')).toBeInTheDocument();
      });

      const setupLink = screen.getByText('setup guide');
      expect(setupLink.tagName).toBe('A');
      expect(setupLink).toHaveAttribute('href', 'https://wiki.example.com/setup');

      const apiLink = screen.getByText('API docs');
      expect(apiLink.tagName).toBe('A');
      expect(apiLink).toHaveAttribute('href', 'https://wiki.example.com/api');
    });
  });

  describe('TC-XrayTestView-U025: parseJiraMarkup handles mixed wiki markup and plain URL in same description', () => {
    it('should convert both [text|url] and plain https:// into anchors', async () => {
      const testData = {
        ...fullTest,
        description: 'Refer to [test guide|https://wiki.example.com/guide] and also https://example.com/docs',
      };
      setupSuccessHandler(testData);
      renderTestView();

      await waitFor(() => {
        expect(screen.getByText('test guide')).toBeInTheDocument();
      });

      const wikiLink = screen.getByText('test guide');
      expect(wikiLink.tagName).toBe('A');
      expect(wikiLink).toHaveAttribute('href', 'https://wiki.example.com/guide');

      const plainLink = screen.getByText('https://example.com/docs');
      expect(plainLink.tagName).toBe('A');
      expect(plainLink).toHaveAttribute('href', 'https://example.com/docs');
    });
  });

  describe('TC-XrayTestView-U026: TestDataDisplay renders non-code step data as plain paragraph text', () => {
    it('should render plain text data without CodeBlock', async () => {
      const testData = {
        ...fullTest,
        steps: [{ id: 's1', action: 'Enter input', data: 'user input: hello world', result: 'Accepted' }],
      };
      setupSuccessHandler(testData);
      renderTestView();

      await waitFor(() => {
        expect(screen.getByText('Test Steps (1)')).toBeInTheDocument();
      });

      // Plain text data should render as a <p>, not a <pre> (CodeBlock)
      const dataText = screen.getByText('user input: hello world');
      expect(dataText.tagName).toBe('P');
    });
  });

  describe('TC-XrayTestView-U027: TestDataDisplay strips wiki {code} tags without language specifier', () => {
    it('should strip {code}...{code} tags and render content as CodeBlock', async () => {
      const testData = {
        ...fullTest,
        steps: [
          { id: 's1', action: 'Send request', data: '{code}\nsome code content\n{code}', result: '200 OK' },
        ],
      };
      setupSuccessHandler(testData);
      renderTestView();

      await waitFor(() => {
        expect(screen.getByText('Test Steps (1)')).toBeInTheDocument();
      });

      // Wiki tags should be stripped
      expect(screen.queryByText('{code}')).not.toBeInTheDocument();
      // Content should be rendered in a CodeBlock (<pre>)
      const codeBlocks = document.querySelectorAll('pre');
      const codeBlock = Array.from(codeBlocks).find(el =>
        el.textContent?.includes('some code content')
      );
      expect(codeBlock).toBeTruthy();
    });
  });
});

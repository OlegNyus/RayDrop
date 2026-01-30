import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithTheme, screen, waitFor, act } from '../helpers/render';
import userEvent from '@testing-library/user-event';
import { SetupForm } from '../../client/src/components/features/setup/SetupForm';
import { server } from '../mocks/server';
import { errorHandlers } from '../mocks/handlers';
import {
  validFormInput,
  invalidConfigs,
  subdomainTestCases,
} from '../fixtures/config';

// Configure userEvent to work with fake timers
const setupUser = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

describe('SetupForm', () => {
  const mockOnComplete = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    mockOnComplete.mockClear();
    mockOnCancel.mockClear();
  });

  // ============================================
  // P1-P9: Positive Scenarios (Happy Path)
  // ============================================
  describe('Positive Scenarios', () => {
    it('P1: displays welcome form for new users', () => {
      renderWithTheme(<SetupForm onComplete={mockOnComplete} />);

      expect(screen.getByText('Welcome to RayDrop')).toBeInTheDocument();
      expect(screen.getByText(/Enter your Xray Cloud API credentials/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Validate & Save Configuration/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Cancel/i })).not.toBeInTheDocument();
    });

    it('P2: displays edit form with pre-populated values', () => {
      renderWithTheme(
        <SetupForm
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          isEditing
          initialConfig={{
            xrayClientId: 'existing-client-id',
            xrayClientSecret: 'existing-secret',
            jiraBaseUrl: 'https://mycompany.atlassian.net/',
          }}
        />
      );

      expect(screen.getByText('Edit Configuration')).toBeInTheDocument();
      expect(screen.getByDisplayValue('existing-client-id')).toBeInTheDocument();
      expect(screen.getByDisplayValue('mycompany')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    });

    it('P3: stores Client ID in form state', async () => {
      const user = setupUser();
      renderWithTheme(<SetupForm onComplete={mockOnComplete} />);

      const input = screen.getByPlaceholderText(/Enter your Xray Client ID/i);
      await user.type(input, validFormInput.xrayClientId);

      await waitFor(() => {
        expect(input).toHaveValue(validFormInput.xrayClientId);
      });
    });

    it('P4: stores Client Secret in form state', async () => {
      const user = setupUser();
      renderWithTheme(<SetupForm onComplete={mockOnComplete} />);

      const input = screen.getByPlaceholderText(/Enter your Xray Client Secret/i);
      await user.type(input, validFormInput.xrayClientSecret);

      await waitFor(() => {
        expect(input).toHaveValue(validFormInput.xrayClientSecret);
      });
    });

    it('P5: shows URL preview when subdomain is entered', async () => {
      const user = setupUser();
      renderWithTheme(<SetupForm onComplete={mockOnComplete} />);

      const input = screen.getByPlaceholderText('your-company');
      await user.type(input, 'mycompany');

      await waitFor(() => {
        expect(screen.getByText('https://mycompany.atlassian.net/')).toBeInTheDocument();
      });
    });

    it('P6: shows success message after valid test connection', async () => {
      const user = setupUser();
      renderWithTheme(<SetupForm onComplete={mockOnComplete} />);

      await user.type(screen.getByPlaceholderText(/Client ID/i), validFormInput.xrayClientId);
      await user.type(screen.getByPlaceholderText(/Client Secret/i), validFormInput.xrayClientSecret);
      await user.click(screen.getByRole('button', { name: /Test Connection/i }));

      await waitFor(() => {
        expect(screen.getByText(/Connection successful/i)).toBeInTheDocument();
      });
    });

    it('P7: calls onComplete with form data on successful submit', async () => {
      const user = setupUser();
      renderWithTheme(<SetupForm onComplete={mockOnComplete} />);

      await user.type(screen.getByPlaceholderText(/Client ID/i), validFormInput.xrayClientId);
      await user.type(screen.getByPlaceholderText(/Client Secret/i), validFormInput.xrayClientSecret);
      await user.type(screen.getByPlaceholderText('your-company'), validFormInput.jiraSubdomain);
      await user.click(screen.getByRole('button', { name: /Validate & Save/i }));

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith({
          xrayClientId: validFormInput.xrayClientId,
          xrayClientSecret: validFormInput.xrayClientSecret,
          jiraBaseUrl: 'https://mycompany.atlassian.net/',
        });
      });
    });

    it('P8: clears error when user starts typing', async () => {
      const user = setupUser();
      renderWithTheme(<SetupForm onComplete={mockOnComplete} />);

      // Trigger validation error
      await user.click(screen.getByRole('button', { name: /Validate & Save/i }));
      expect(screen.getByText(/Client ID is required/i)).toBeInTheDocument();

      // Start typing
      await user.type(screen.getByPlaceholderText(/Client ID/i), 'a');

      // Error should clear
      expect(screen.queryByText(/Client ID is required/i)).not.toBeInTheDocument();
    });

    it('P9: calls onCancel when Cancel is clicked in edit mode', async () => {
      const user = setupUser();
      renderWithTheme(
        <SetupForm
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          isEditing
        />
      );

      await user.click(screen.getByRole('button', { name: /Cancel/i }));

      expect(mockOnCancel).toHaveBeenCalled();
      expect(mockOnComplete).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // N1-N14: Negative Scenarios (Error Paths)
  // ============================================
  describe('Negative Scenarios', () => {
    it('N1: shows error for empty Client ID on submit', async () => {
      const user = setupUser();
      renderWithTheme(<SetupForm onComplete={mockOnComplete} />);

      await user.type(screen.getByPlaceholderText(/Client Secret/i), 'secret');
      await user.type(screen.getByPlaceholderText('your-company'), 'company');
      await user.click(screen.getByRole('button', { name: /Validate & Save/i }));

      expect(screen.getByText(/Client ID is required/i)).toBeInTheDocument();
      expect(mockOnComplete).not.toHaveBeenCalled();
    });

    it('N2: shows error for whitespace-only Client ID', async () => {
      const user = setupUser();
      renderWithTheme(<SetupForm onComplete={mockOnComplete} />);

      await user.type(screen.getByPlaceholderText(/Client ID/i), '   ');
      await user.type(screen.getByPlaceholderText(/Client Secret/i), 'secret');
      await user.type(screen.getByPlaceholderText('your-company'), 'company');
      await user.click(screen.getByRole('button', { name: /Validate & Save/i }));

      expect(screen.getByText(/Client ID is required/i)).toBeInTheDocument();
    });

    it('N3: shows error for empty Client Secret on submit', async () => {
      const user = setupUser();
      renderWithTheme(<SetupForm onComplete={mockOnComplete} />);

      await user.type(screen.getByPlaceholderText(/Client ID/i), 'clientid');
      await user.type(screen.getByPlaceholderText('your-company'), 'company');
      await user.click(screen.getByRole('button', { name: /Validate & Save/i }));

      expect(screen.getByText(/Client Secret is required/i)).toBeInTheDocument();
    });

    it('N5: shows error for empty subdomain on submit', async () => {
      const user = setupUser();
      renderWithTheme(<SetupForm onComplete={mockOnComplete} />);

      await user.type(screen.getByPlaceholderText(/Client ID/i), 'clientid');
      await user.type(screen.getByPlaceholderText(/Client Secret/i), 'secret');
      await user.click(screen.getByRole('button', { name: /Validate & Save/i }));

      expect(screen.getByText(/Jira subdomain is required/i)).toBeInTheDocument();
    });

    it('N6: shows error for invalid subdomain characters', async () => {
      const user = setupUser();
      renderWithTheme(<SetupForm onComplete={mockOnComplete} />);

      await user.type(screen.getByPlaceholderText(/Client ID/i), 'clientid');
      await user.type(screen.getByPlaceholderText(/Client Secret/i), 'secret');
      await user.type(screen.getByPlaceholderText('your-company'), 'my_company!');
      await user.click(screen.getByRole('button', { name: /Validate & Save/i }));

      expect(screen.getByText(/can only contain letters, numbers, and hyphens/i)).toBeInTheDocument();
    });

    it('N7: shows error for subdomain less than 2 characters', async () => {
      const user = setupUser();
      renderWithTheme(<SetupForm onComplete={mockOnComplete} />);

      await user.type(screen.getByPlaceholderText(/Client ID/i), 'clientid');
      await user.type(screen.getByPlaceholderText(/Client Secret/i), 'secret');
      await user.type(screen.getByPlaceholderText('your-company'), 'a');
      await user.click(screen.getByRole('button', { name: /Validate & Save/i }));

      expect(screen.getByText(/at least 2 characters/i)).toBeInTheDocument();
    });

    it('N8: shows error for invalid credentials on test connection', async () => {
      server.use(errorHandlers.invalidCredentials);

      const user = setupUser();
      renderWithTheme(<SetupForm onComplete={mockOnComplete} />);

      await user.type(screen.getByPlaceholderText(/Client ID/i), 'invalid-id');
      await user.type(screen.getByPlaceholderText(/Client Secret/i), 'invalid-secret');
      await user.click(screen.getByRole('button', { name: /Test Connection/i }));

      await waitFor(() => {
        expect(screen.getByText(/Invalid Client ID or Client Secret/i)).toBeInTheDocument();
      });
    });

    it('N14: shows rate limit error on test connection', async () => {
      server.use(errorHandlers.rateLimited);

      const user = setupUser();
      renderWithTheme(<SetupForm onComplete={mockOnComplete} />);

      await user.type(screen.getByPlaceholderText(/Client ID/i), 'clientid');
      await user.type(screen.getByPlaceholderText(/Client Secret/i), 'secret');
      await user.click(screen.getByRole('button', { name: /Test Connection/i }));

      await waitFor(() => {
        expect(screen.getByText(/Too many attempts/i)).toBeInTheDocument();
      });
    });
  });

  // ============================================
  // UI States
  // ============================================
  describe('UI States', () => {
    it('shows loading state during form submission', async () => {
      const user = setupUser();
      renderWithTheme(<SetupForm onComplete={mockOnComplete} />);

      await user.type(screen.getByPlaceholderText(/Client ID/i), validFormInput.xrayClientId);
      await user.type(screen.getByPlaceholderText(/Client Secret/i), validFormInput.xrayClientSecret);
      await user.type(screen.getByPlaceholderText('your-company'), validFormInput.jiraSubdomain);
      await user.click(screen.getByRole('button', { name: /Validate & Save/i }));

      expect(screen.getByText(/Validating/i)).toBeInTheDocument();
    });

    it('shows testing state during connection test', async () => {
      const user = setupUser();
      renderWithTheme(<SetupForm onComplete={mockOnComplete} />);

      await user.type(screen.getByPlaceholderText(/Client ID/i), validFormInput.xrayClientId);
      await user.type(screen.getByPlaceholderText(/Client Secret/i), validFormInput.xrayClientSecret);
      await user.click(screen.getByRole('button', { name: /Test Connection/i }));

      expect(screen.getByText(/Validating/i)).toBeInTheDocument();
    });

    it('disables Test Connection when credentials are empty', () => {
      renderWithTheme(<SetupForm onComplete={mockOnComplete} />);

      const testButton = screen.getByRole('button', { name: /Test Connection/i });
      expect(testButton).toBeDisabled();
    });

    it('enables Test Connection when both credentials are filled', async () => {
      const user = setupUser();
      renderWithTheme(<SetupForm onComplete={mockOnComplete} />);

      await user.type(screen.getByPlaceholderText(/Client ID/i), 'clientid');
      await user.type(screen.getByPlaceholderText(/Client Secret/i), 'secret');

      await waitFor(() => {
        const testButton = screen.getByRole('button', { name: /Test Connection/i });
        expect(testButton).not.toBeDisabled();
      });
    });
  });

  // ============================================
  // Theme Toggle
  // ============================================
  describe('Theme Toggle', () => {
    it('renders theme toggle button', () => {
      renderWithTheme(<SetupForm onComplete={mockOnComplete} />);

      const themeButton = screen.getByTitle(/Switch to.*mode/i);
      expect(themeButton).toBeInTheDocument();
    });

    it('toggles theme on click', async () => {
      const user = setupUser();
      renderWithTheme(<SetupForm onComplete={mockOnComplete} />);

      const themeButton = screen.getByTitle(/Switch to.*mode/i);
      const initialTitle = themeButton.getAttribute('title');

      await user.click(themeButton);

      // Title should change after toggle
      await waitFor(() => {
        const newTitle = themeButton.getAttribute('title');
        expect(newTitle).not.toBe(initialTitle);
      });
    });
  });

  // ============================================
  // Subdomain Validation (from requirements)
  // ============================================
  describe('Subdomain Validation', () => {
    it.each(subdomainTestCases.valid)(
      'accepts valid subdomain: $input',
      async ({ input, expected }) => {
        const user = setupUser();
        renderWithTheme(<SetupForm onComplete={mockOnComplete} />);

        await user.type(screen.getByPlaceholderText('your-company'), input);

        await waitFor(() => {
          expect(screen.getByText(expected)).toBeInTheDocument();
        });
      }
    );

    it.each(subdomainTestCases.invalid)(
      'rejects invalid subdomain: $input ($reason)',
      async ({ input }) => {
        const user = setupUser();
        renderWithTheme(<SetupForm onComplete={mockOnComplete} />);

        await user.type(screen.getByPlaceholderText(/Client ID/i), 'clientid');
        await user.type(screen.getByPlaceholderText(/Client Secret/i), 'secret');
        await user.type(screen.getByPlaceholderText('your-company'), input);
        await user.click(screen.getByRole('button', { name: /Validate & Save/i }));

        // Should show validation error (either "at least 2 characters" or "letters, numbers, and hyphens")
        await waitFor(() => {
          const shortError = screen.queryByText(/at least 2 characters/i);
          const formatError = screen.queryByText(/letters, numbers, and hyphens/i);
          expect(shortError || formatError).toBeTruthy();
        });
      }
    );
  });
});

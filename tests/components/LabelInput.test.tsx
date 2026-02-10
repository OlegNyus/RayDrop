import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, renderWithTheme, fireEvent } from '../helpers/render';
import { LabelInput } from '../../client/src/components/ui/LabelInput';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';

describe('LabelInput', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    mockOnChange.mockClear();

    // Setup MSW handlers for labels API
    server.use(
      http.get('*/api/settings/labels', () => {
        return HttpResponse.json({
          success: true,
          labels: ['bug', 'feature', 'regression', 'smoke', 'critical'],
        });
      }),
      http.put('*/api/settings/labels', () => {
        return HttpResponse.json({ success: true });
      })
    );
  });

  describe('Initial Rendering', () => {
    it('renders with default placeholder when no labels', () => {
      renderWithTheme(<LabelInput labels={[]} onChange={mockOnChange} />);
      expect(screen.getByText('Search or create...')).toBeInTheDocument();
    });

    it('renders with custom placeholder', () => {
      renderWithTheme(
        <LabelInput labels={[]} onChange={mockOnChange} placeholder="Add labels..." />
      );
      expect(screen.getByText('Add labels...')).toBeInTheDocument();
    });

    it('displays existing labels', () => {
      renderWithTheme(
        <LabelInput labels={['bug', 'feature']} onChange={mockOnChange} />
      );
      expect(screen.getByText('bug')).toBeInTheDocument();
      expect(screen.getByText('feature')).toBeInTheDocument();
    });

    it('renders remove buttons for each label', () => {
      renderWithTheme(
        <LabelInput labels={['bug', 'feature']} onChange={mockOnChange} />
      );
      const removeButtons = screen.getAllByRole('button');
      expect(removeButtons.length).toBe(2);
    });

    it('applies disabled styles when disabled', () => {
      renderWithTheme(
        <LabelInput labels={[]} onChange={mockOnChange} disabled />
      );
      const container = screen.getByText('Search or create...').closest('div');
      expect(container).toHaveClass('opacity-60', 'cursor-not-allowed');
    });

    it('does not show remove buttons when disabled', () => {
      renderWithTheme(
        <LabelInput labels={['bug']} onChange={mockOnChange} disabled />
      );
      expect(screen.getByText('bug')).toBeInTheDocument();
      const buttons = screen.queryAllByRole('button');
      expect(buttons.length).toBe(0);
    });
  });

  describe('Dropdown Behavior', () => {
    it('opens dropdown on container click', async () => {
      renderWithTheme(<LabelInput labels={[]} onChange={mockOnChange} />);

      const combobox = screen.getByRole('combobox');
      fireEvent.click(combobox);

      await waitFor(() => {
        expect(combobox).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
    });

    it('does not open dropdown when disabled', () => {
      renderWithTheme(<LabelInput labels={[]} onChange={mockOnChange} disabled />);

      const combobox = screen.getByRole('combobox');
      fireEvent.click(combobox);

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('shows listbox when dropdown is open', async () => {
      renderWithTheme(<LabelInput labels={[]} onChange={mockOnChange} />);

      const container = screen.getByText('Search or create...').closest('div');
      fireEvent.click(container!);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
    });

    it('loads and displays available labels from API', async () => {
      renderWithTheme(<LabelInput labels={[]} onChange={mockOnChange} />);

      const container = screen.getByText('Search or create...').closest('div');
      fireEvent.click(container!);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Wait for labels to load
      await waitFor(() => {
        expect(screen.getByText('bug')).toBeInTheDocument();
      });
    });

    it('filters labels based on input', async () => {
      renderWithTheme(<LabelInput labels={[]} onChange={mockOnChange} />);

      const combobox = screen.getByRole('combobox');
      fireEvent.click(combobox);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Wait for labels to load
      await waitFor(() => {
        expect(screen.getByText('bug')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Search or create...');
      fireEvent.change(input, { target: { value: 'reg' } });

      await waitFor(() => {
        expect(screen.getByText('regression')).toBeInTheDocument();
        expect(screen.queryByText('bug')).not.toBeInTheDocument();
      });
    });

    it('shows "Create" option for new labels', async () => {
      renderWithTheme(<LabelInput labels={[]} onChange={mockOnChange} />);

      const combobox = screen.getByRole('combobox');
      fireEvent.click(combobox);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Search or create...');
      fireEvent.change(input, { target: { value: 'newlabel' } });

      await waitFor(() => {
        expect(screen.getByText(/Create/)).toBeInTheDocument();
      });
    });

    it('shows hint to create new label when dropdown is open', async () => {
      renderWithTheme(<LabelInput labels={[]} onChange={mockOnChange} />);

      const container = screen.getByText('Search or create...').closest('div');
      fireEvent.click(container!);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Wait for labels to load - hint shows when labels are available
      await waitFor(() => {
        expect(screen.getByText('Type to create a new label')).toBeInTheDocument();
      });
    });

    it('closes dropdown on Escape key', async () => {
      renderWithTheme(<LabelInput labels={[]} onChange={mockOnChange} />);

      const combobox = screen.getByRole('combobox');
      fireEvent.click(combobox);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Search or create...');
      fireEvent.keyDown(input, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });

    it('closes dropdown on Tab key', async () => {
      renderWithTheme(<LabelInput labels={[]} onChange={mockOnChange} />);

      const combobox = screen.getByRole('combobox');
      fireEvent.click(combobox);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Search or create...');
      fireEvent.keyDown(input, { key: 'Tab' });

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });
  });

  describe('Label Selection', () => {
    it('calls onChange when clicking a label in dropdown', async () => {
      renderWithTheme(<LabelInput labels={[]} onChange={mockOnChange} />);

      const container = screen.getByText('Search or create...').closest('div');
      fireEvent.click(container!);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Wait for labels to load
      await waitFor(() => {
        const options = screen.getAllByRole('option');
        expect(options.length).toBeGreaterThan(0);
      });

      // Click the first option
      const options = screen.getAllByRole('option');
      fireEvent.click(options[0]);

      expect(mockOnChange).toHaveBeenCalled();
    });

    it('creates new label on Enter with input text', async () => {
      renderWithTheme(<LabelInput labels={[]} onChange={mockOnChange} />);

      const combobox = screen.getByRole('combobox');
      fireEvent.click(combobox);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Search or create...');
      fireEvent.change(input, { target: { value: 'newlabel' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnChange).toHaveBeenCalledWith(['newlabel']);
    });

    it('removes label on remove button click', () => {
      renderWithTheme(
        <LabelInput labels={['bug', 'feature']} onChange={mockOnChange} />
      );

      const removeButtons = screen.getAllByRole('button');
      fireEvent.click(removeButtons[0]);

      expect(mockOnChange).toHaveBeenCalledWith(['feature']);
    });

    it('removes second label when clicking its remove button', () => {
      renderWithTheme(
        <LabelInput labels={['bug', 'feature']} onChange={mockOnChange} />
      );

      const removeButtons = screen.getAllByRole('button');
      fireEvent.click(removeButtons[1]);

      expect(mockOnChange).toHaveBeenCalledWith(['bug']);
    });
  });

  describe('Keyboard Navigation', () => {
    it('keeps dropdown open on ArrowDown', async () => {
      renderWithTheme(<LabelInput labels={[]} onChange={mockOnChange} />);

      const combobox = screen.getByRole('combobox');
      fireEvent.click(combobox);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Search or create...');
      fireEvent.keyDown(input, { key: 'ArrowDown' });

      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('responds to Enter key', async () => {
      renderWithTheme(<LabelInput labels={[]} onChange={mockOnChange} />);

      const combobox = screen.getByRole('combobox');
      fireEvent.click(combobox);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Wait for labels
      await waitFor(() => {
        const options = screen.getAllByRole('option');
        expect(options.length).toBeGreaterThan(0);
      });

      const input = screen.getByPlaceholderText('Search or create...');
      // Type something to create new label (simpler than keyboard nav)
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnChange).toHaveBeenCalledWith(['test']);
    });
  });

  describe('Empty States', () => {
    it('shows "No labels available" when no labels exist', async () => {
      server.use(
        http.get('*/api/settings/labels', () => {
          return HttpResponse.json({ success: true, labels: [] });
        })
      );

      renderWithTheme(<LabelInput labels={[]} onChange={mockOnChange} />);

      const container = screen.getByText('Search or create...').closest('div');
      fireEvent.click(container!);

      await waitFor(() => {
        expect(screen.getByText('No labels available')).toBeInTheDocument();
      });
    });

  });

  describe('Label Persistence', () => {
    it('saves new label to server when created', async () => {
      let savedLabels: string[] = [];
      server.use(
        http.get('*/api/settings/labels', () => {
          return HttpResponse.json({ success: true, labels: ['existing'] });
        }),
        http.put('*/api/settings/labels', async ({ request }) => {
          const body = await request.json() as { labels: string[] };
          savedLabels = body.labels;
          return HttpResponse.json({ success: true });
        })
      );

      renderWithTheme(<LabelInput labels={[]} onChange={mockOnChange} />);

      const combobox = screen.getByRole('combobox');
      fireEvent.click(combobox);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Search or create...');
      fireEvent.change(input, { target: { value: 'brandnew' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(savedLabels).toContain('brandnew');
      });
    });
  });

  describe('Accessibility', () => {
    it('has combobox role when open', async () => {
      renderWithTheme(<LabelInput labels={[]} onChange={mockOnChange} />);

      const container = screen.getByText('Search or create...').closest('div');
      fireEvent.click(container!);

      await waitFor(() => {
        const combobox = screen.getByRole('combobox');
        expect(combobox).toHaveAttribute('aria-expanded', 'true');
        expect(combobox).toHaveAttribute('aria-haspopup', 'listbox');
      });
    });

    it('has listbox role for dropdown', async () => {
      renderWithTheme(<LabelInput labels={[]} onChange={mockOnChange} />);

      const container = screen.getByText('Search or create...').closest('div');
      fireEvent.click(container!);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
    });

    it('has option role for each label', async () => {
      renderWithTheme(<LabelInput labels={[]} onChange={mockOnChange} />);

      const container = screen.getByText('Search or create...').closest('div');
      fireEvent.click(container!);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      await waitFor(() => {
        const options = screen.getAllByRole('option');
        expect(options.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Edge Cases', () => {
    it('trims whitespace from new labels', async () => {
      renderWithTheme(<LabelInput labels={[]} onChange={mockOnChange} />);

      const combobox = screen.getByRole('combobox');
      fireEvent.click(combobox);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Search or create...');
      fireEvent.change(input, { target: { value: '  newlabel  ' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnChange).toHaveBeenCalledWith(['newlabel']);
    });

    it('handles API error gracefully', async () => {
      server.use(
        http.get('*/api/settings/labels', () => {
          return HttpResponse.error();
        })
      );

      renderWithTheme(<LabelInput labels={[]} onChange={mockOnChange} />);

      const container = screen.getByText('Search or create...').closest('div');
      fireEvent.click(container!);

      // Should still open and show listbox
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
    });

    it('processes input on Enter key', async () => {
      renderWithTheme(<LabelInput labels={[]} onChange={mockOnChange} />);

      const combobox = screen.getByRole('combobox');
      fireEvent.click(combobox);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Search or create...');
      fireEvent.change(input, { target: { value: 'newlabel' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // onChange should have been called
      expect(mockOnChange).toHaveBeenCalled();
    });
  });
});

import { describe, it, expect, vi } from 'vitest';
import { screen, renderWithTheme, fireEvent } from '../helpers/render';
import { Badge } from '../../client/src/components/ui/Badge';
import { StatusBadge } from '../../client/src/components/ui/StatusBadge';
import { Spinner } from '../../client/src/components/ui/Spinner';
import { Button } from '../../client/src/components/ui/Button';
import { Card } from '../../client/src/components/ui/Card';
import { Input } from '../../client/src/components/ui/Input';
import { ConfirmModal } from '../../client/src/components/ui/ConfirmModal';

describe('UI Components', () => {
  describe('Badge', () => {
    it('renders children content', () => {
      renderWithTheme(<Badge>Test Label</Badge>);
      expect(screen.getByText('Test Label')).toBeInTheDocument();
    });

    it('applies default variant styles', () => {
      renderWithTheme(<Badge>Default</Badge>);
      const badge = screen.getByText('Default');
      expect(badge).toHaveClass('bg-badge-bg', 'text-badge-text');
    });

    it('applies success variant styles', () => {
      renderWithTheme(<Badge variant="success">Success</Badge>);
      const badge = screen.getByText('Success');
      expect(badge).toHaveClass('bg-green-100', 'text-green-800');
    });

    it('applies warning variant styles', () => {
      renderWithTheme(<Badge variant="warning">Warning</Badge>);
      const badge = screen.getByText('Warning');
      expect(badge).toHaveClass('bg-yellow-100', 'text-yellow-800');
    });

    it('applies error variant styles', () => {
      renderWithTheme(<Badge variant="error">Error</Badge>);
      const badge = screen.getByText('Error');
      expect(badge).toHaveClass('bg-red-100', 'text-red-800');
    });

    it('applies info variant styles', () => {
      renderWithTheme(<Badge variant="info">Info</Badge>);
      const badge = screen.getByText('Info');
      expect(badge).toHaveClass('bg-blue-100', 'text-blue-800');
    });

    it('applies custom className', () => {
      renderWithTheme(<Badge className="custom-class">Custom</Badge>);
      const badge = screen.getByText('Custom');
      expect(badge).toHaveClass('custom-class');
    });

    it('has correct base styles', () => {
      renderWithTheme(<Badge>Base</Badge>);
      const badge = screen.getByText('Base');
      expect(badge).toHaveClass('inline-flex', 'items-center', 'px-2', 'py-0.5', 'rounded', 'text-xs', 'font-medium');
    });
  });

  describe('StatusBadge', () => {
    it('renders "New" status correctly', () => {
      renderWithTheme(<StatusBadge status="new" />);
      const badge = screen.getByText('New');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-blue-500', 'text-white');
    });

    it('renders "Draft" status correctly', () => {
      renderWithTheme(<StatusBadge status="draft" />);
      const badge = screen.getByText('Draft');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-amber-500', 'text-white');
    });

    it('renders "Ready" status correctly', () => {
      renderWithTheme(<StatusBadge status="ready" />);
      const badge = screen.getByText('Ready');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-green-500', 'text-white');
    });

    it('renders "Imported" status correctly', () => {
      renderWithTheme(<StatusBadge status="imported" />);
      const badge = screen.getByText('Imported');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-emerald-600', 'text-white');
    });

    it('renders unknown status with fallback styles', () => {
      renderWithTheme(<StatusBadge status="unknown" />);
      const badge = screen.getByText('unknown');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-gray-500', 'text-white');
    });

    it('applies sm size correctly', () => {
      renderWithTheme(<StatusBadge status="new" size="sm" />);
      const badge = screen.getByText('New');
      expect(badge).toHaveClass('px-2', 'py-0.5', 'text-xs');
    });

    it('applies md size correctly (default)', () => {
      renderWithTheme(<StatusBadge status="new" size="md" />);
      const badge = screen.getByText('New');
      expect(badge).toHaveClass('px-2.5', 'py-1', 'text-xs');
    });

    it('has rounded-full class', () => {
      renderWithTheme(<StatusBadge status="draft" />);
      const badge = screen.getByText('Draft');
      expect(badge).toHaveClass('rounded-full');
    });
  });

  describe('Spinner', () => {
    it('renders with default size (md)', () => {
      renderWithTheme(<Spinner />);
      const spinner = document.querySelector('svg');
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveClass('w-6', 'h-6');
    });

    it('renders with small size', () => {
      renderWithTheme(<Spinner size="sm" />);
      const spinner = document.querySelector('svg');
      expect(spinner).toHaveClass('w-4', 'h-4');
    });

    it('renders with large size', () => {
      renderWithTheme(<Spinner size="lg" />);
      const spinner = document.querySelector('svg');
      expect(spinner).toHaveClass('w-8', 'h-8');
    });

    it('has animation class', () => {
      renderWithTheme(<Spinner />);
      const spinner = document.querySelector('svg');
      expect(spinner).toHaveClass('animate-spin');
    });

    it('has accent color class', () => {
      renderWithTheme(<Spinner />);
      const spinner = document.querySelector('svg');
      expect(spinner).toHaveClass('text-accent');
    });

    it('applies custom className', () => {
      renderWithTheme(<Spinner className="custom-spinner" />);
      const spinner = document.querySelector('svg');
      expect(spinner).toHaveClass('custom-spinner');
    });
  });

  describe('Button', () => {
    it('renders children content', () => {
      renderWithTheme(<Button>Click Me</Button>);
      expect(screen.getByRole('button', { name: 'Click Me' })).toBeInTheDocument();
    });

    it('applies primary variant by default', () => {
      renderWithTheme(<Button>Primary</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-accent', 'text-white');
    });

    it('applies secondary variant', () => {
      renderWithTheme(<Button variant="secondary">Secondary</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-card', 'border', 'border-border');
    });

    it('applies danger variant', () => {
      renderWithTheme(<Button variant="danger">Danger</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-error', 'text-white');
    });

    it('applies ghost variant', () => {
      renderWithTheme(<Button variant="ghost">Ghost</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('text-text-secondary');
    });

    it('applies md size by default', () => {
      renderWithTheme(<Button>Medium</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('px-4', 'py-2', 'text-sm');
    });

    it('applies sm size', () => {
      renderWithTheme(<Button size="sm">Small</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('px-3', 'py-1.5', 'text-sm');
    });

    it('applies lg size', () => {
      renderWithTheme(<Button size="lg">Large</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('px-6', 'py-3', 'text-base');
    });

    it('can be disabled', () => {
      renderWithTheme(<Button disabled>Disabled</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('has disabled styles in class', () => {
      renderWithTheme(<Button>Enabled</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('disabled:opacity-50', 'disabled:cursor-not-allowed');
    });

    it('applies custom className', () => {
      renderWithTheme(<Button className="custom-btn">Custom</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-btn');
    });

    it('passes through other props', () => {
      renderWithTheme(<Button type="submit" data-testid="submit-btn">Submit</Button>);
      const button = screen.getByTestId('submit-btn');
      expect(button).toHaveAttribute('type', 'submit');
    });

    it('has base transition and focus styles', () => {
      renderWithTheme(<Button>Styled</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('transition-colors', 'focus:outline-none', 'focus:ring-2');
    });
  });

  describe('Card', () => {
    it('renders children content', () => {
      renderWithTheme(<Card>Card Content</Card>);
      expect(screen.getByText('Card Content')).toBeInTheDocument();
    });

    it('has correct base styles', () => {
      renderWithTheme(<Card>Content</Card>);
      const card = screen.getByText('Content').closest('div');
      expect(card).toHaveClass('bg-card', 'rounded-lg', 'border', 'border-border');
    });

    it('applies custom className', () => {
      renderWithTheme(<Card className="custom-card">Content</Card>);
      const card = screen.getByText('Content').closest('.custom-card');
      expect(card).toBeInTheDocument();
    });

    it('applies md padding by default', () => {
      renderWithTheme(<Card>Padded</Card>);
      const card = screen.getByText('Padded').closest('div');
      expect(card).toHaveClass('p-4');
    });

    it('applies sm padding', () => {
      renderWithTheme(<Card padding="sm">Small Padding</Card>);
      const card = screen.getByText('Small Padding').closest('div');
      expect(card).toHaveClass('p-3');
    });

    it('applies lg padding', () => {
      renderWithTheme(<Card padding="lg">Large Padding</Card>);
      const card = screen.getByText('Large Padding').closest('div');
      expect(card).toHaveClass('p-6');
    });

    it('can have no padding', () => {
      renderWithTheme(<Card padding="none">No Padding</Card>);
      const card = screen.getByText('No Padding').closest('div');
      expect(card).not.toHaveClass('p-3');
      expect(card).not.toHaveClass('p-4');
      expect(card).not.toHaveClass('p-6');
    });

    it('supports onClick handler', () => {
      const handleClick = vi.fn();
      renderWithTheme(<Card onClick={handleClick}>Clickable</Card>);
      const card = screen.getByText('Clickable').closest('div');
      card?.click();
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Input', () => {
    it('renders with label', () => {
      renderWithTheme(<Input label="Email" />);
      expect(screen.getByText('Email')).toBeInTheDocument();
    });

    it('renders input element', () => {
      renderWithTheme(<Input label="Name" />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('associates label with input via id', () => {
      renderWithTheme(<Input label="Username" />);
      const input = screen.getByRole('textbox');
      const label = screen.getByText('Username');
      expect(input).toHaveAttribute('id', 'username');
      expect(label).toHaveAttribute('for', 'username');
    });

    it('displays error message', () => {
      renderWithTheme(<Input label="Email" error="Invalid email" />);
      expect(screen.getByText('Invalid email')).toBeInTheDocument();
    });

    it('applies error styles when error prop is present', () => {
      renderWithTheme(<Input label="Email" error="Required" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('border-error');
    });

    it('passes through input props', () => {
      renderWithTheme(<Input label="Password" type="password" placeholder="Enter password" />);
      const input = screen.getByPlaceholderText('Enter password');
      expect(input).toHaveAttribute('type', 'password');
    });

    it('can be disabled', () => {
      renderWithTheme(<Input label="Disabled" disabled />);
      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
    });

    it('applies custom className', () => {
      renderWithTheme(<Input label="Custom" className="custom-input" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('custom-input');
    });

    it('uses custom id when provided', () => {
      renderWithTheme(<Input label="Field" id="custom-id" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('id', 'custom-id');
    });

    it('has base input styles', () => {
      renderWithTheme(<Input label="Styled" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('w-full', 'px-3', 'py-2', 'rounded-lg', 'transition-colors');
    });
  });

  describe('ConfirmModal', () => {
    const defaultProps = {
      isOpen: true,
      title: 'Confirm Action',
      message: 'Are you sure you want to proceed?',
      onConfirm: vi.fn(),
      onCancel: vi.fn(),
    };

    it('renders when isOpen is true', () => {
      renderWithTheme(<ConfirmModal {...defaultProps} />);
      expect(screen.getByText('Confirm Action')).toBeInTheDocument();
      expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      renderWithTheme(<ConfirmModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('Confirm Action')).not.toBeInTheDocument();
    });

    it('displays default button labels', () => {
      renderWithTheme(<ConfirmModal {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('displays custom button labels', () => {
      renderWithTheme(
        <ConfirmModal {...defaultProps} confirmLabel="Yes, Delete" cancelLabel="No, Keep" />
      );
      expect(screen.getByRole('button', { name: 'Yes, Delete' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'No, Keep' })).toBeInTheDocument();
    });

    it('displays warning when provided', () => {
      renderWithTheme(
        <ConfirmModal {...defaultProps} warning="This action cannot be undone!" />
      );
      expect(screen.getByText('This action cannot be undone!')).toBeInTheDocument();
    });

    it('calls onConfirm when confirm button is clicked', () => {
      const onConfirm = vi.fn();
      renderWithTheme(<ConfirmModal {...defaultProps} onConfirm={onConfirm} />);
      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when cancel button is clicked', () => {
      const onCancel = vi.fn();
      renderWithTheme(<ConfirmModal {...defaultProps} onCancel={onCancel} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when backdrop is clicked', () => {
      const onCancel = vi.fn();
      renderWithTheme(<ConfirmModal {...defaultProps} onCancel={onCancel} />);
      const backdrop = document.querySelector('.bg-black\\/50');
      fireEvent.click(backdrop!);
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when Escape key is pressed', () => {
      const onCancel = vi.fn();
      renderWithTheme(<ConfirmModal {...defaultProps} onCancel={onCancel} />);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('applies danger variant styles', () => {
      renderWithTheme(<ConfirmModal {...defaultProps} variant="danger" />);
      const confirmButton = screen.getByRole('button', { name: 'Confirm' });
      expect(confirmButton).toHaveClass('bg-red-600');
    });
  });

  // Note: TestKeyLink requires AppContext with async data loading.
  // It's tested indirectly through integration tests.
});

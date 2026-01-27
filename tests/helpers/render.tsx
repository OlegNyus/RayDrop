import { render as rtlRender, RenderOptions } from '@testing-library/react';
import { ReactElement, ReactNode } from 'react';
import { ThemeProvider } from '../../client/src/context/ThemeContext';
import { AppProvider } from '../../client/src/context/AppContext';

interface WrapperProps {
  children: ReactNode;
}

// Default wrapper with all providers
function AllProviders({ children }: WrapperProps) {
  return (
    <ThemeProvider>
      <AppProvider>
        {children}
      </AppProvider>
    </ThemeProvider>
  );
}

// Theme-only wrapper (for setup form before app context exists)
function ThemeOnlyProvider({ children }: WrapperProps) {
  return (
    <ThemeProvider>
      {children}
    </ThemeProvider>
  );
}

// Custom render with all providers
export function render(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return rtlRender(ui, { wrapper: AllProviders, ...options });
}

// Render with theme only (for setup form tests)
export function renderWithTheme(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return rtlRender(ui, { wrapper: ThemeOnlyProvider, ...options });
}

// Re-export everything from testing-library
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';

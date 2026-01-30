import { render as rtlRender, RenderOptions } from '@testing-library/react';
import { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
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

// Full providers with router (for components using useNavigate)
function AllProvidersWithRouter({ children }: WrapperProps) {
  return (
    <MemoryRouter>
      <ThemeProvider>
        <AppProvider>
          {children}
        </AppProvider>
      </ThemeProvider>
    </MemoryRouter>
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

// Render with router (for components using useNavigate)
export function renderWithRouter(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return rtlRender(ui, { wrapper: AllProvidersWithRouter, ...options });
}

// Re-export everything from testing-library
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';

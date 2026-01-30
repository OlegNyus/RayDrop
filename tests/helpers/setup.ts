import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll, beforeEach, vi } from 'vitest';

// Only setup MSW and DOM-related things in jsdom environment
const isJsdom = typeof window !== 'undefined';

// Configure React act environment for React 18+
// This ensures React Testing Library properly handles state updates
if (isJsdom) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
}

// Use fake timers to prevent setTimeout callbacks from causing act warnings
if (isJsdom) {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });
}

// Suppress React act warnings - these are false positives with React 18 concurrent features
// when using userEvent which properly handles async state updates
if (isJsdom) {
  const originalError = console.error;
  beforeAll(() => {
    console.error = (...args: unknown[]) => {
      const message = typeof args[0] === 'string' ? args[0] : '';
      if (message.includes('not wrapped in act')) {
        return;
      }
      originalError.call(console, ...args);
    };
  });

  afterAll(() => {
    console.error = originalError;
  });
}

// Cleanup after each test
afterEach(() => {
  if (isJsdom) {
    cleanup();
  }
  vi.clearAllMocks();
});

// MSW setup - only in jsdom environment
if (isJsdom) {
  const { server } = await import('../mocks/server');

  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'bypass' });
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });
}

// Mock window APIs - only in jsdom environment
if (isJsdom) {
  // Mock window.matchMedia for theme tests
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  Object.defineProperty(window, 'localStorage', { value: localStorageMock });

  // Mock scrollIntoView for tests (not available in jsdom)
  Element.prototype.scrollIntoView = vi.fn();
}

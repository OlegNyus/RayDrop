/**
 * Setup file for API tests (no MSW - tests real server)
 */
import { vi } from 'vitest';

// Just clear mocks between tests
afterEach(() => {
  vi.clearAllMocks();
});

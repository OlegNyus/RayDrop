import { http, HttpResponse, delay } from 'msw';
import { apiResponses, apiErrors } from '../fixtures/config';

// Use wildcard to match any origin (handles both relative and absolute URLs)
const API_BASE = '*/api';

/**
 * Default handlers - successful responses
 */
export const handlers = [
  // GET /api/config - Check configuration status
  http.get(`${API_BASE}/config`, () => {
    return HttpResponse.json(apiResponses.configuredFalse);
  }),

  // POST /api/config - Save configuration
  http.post(`${API_BASE}/config`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;

    // Validate required fields
    if (!body.xrayClientId) {
      return HttpResponse.json(apiErrors.missingClientId, { status: 400 });
    }
    if (!body.xrayClientSecret) {
      return HttpResponse.json(apiErrors.missingClientSecret, { status: 400 });
    }
    if (!body.jiraBaseUrl) {
      return HttpResponse.json({ error: 'jiraBaseUrl is required' }, { status: 400 });
    }

    // Simulate network delay
    await delay(100);

    return HttpResponse.json(apiResponses.saveSuccess);
  }),

  // POST /api/config/test-connection - Test credentials
  http.post(`${API_BASE}/config/test-connection`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;

    if (!body.xrayClientId) {
      return HttpResponse.json(apiErrors.missingClientId, { status: 400 });
    }
    if (!body.xrayClientSecret) {
      return HttpResponse.json(apiErrors.missingClientSecret, { status: 400 });
    }

    await delay(100);

    return HttpResponse.json(apiResponses.testConnectionSuccess);
  }),

  // DELETE /api/config - Delete configuration
  http.delete(`${API_BASE}/config`, () => {
    return HttpResponse.json({ success: true });
  }),

  // GET /api/settings - Get settings
  http.get(`${API_BASE}/settings`, () => {
    return HttpResponse.json({
      projects: [],
      hiddenProjects: [],
      activeProject: null,
      projectSettings: {},
    });
  }),

  // GET /api/drafts - Get drafts
  http.get(`${API_BASE}/drafts`, () => {
    return HttpResponse.json([]);
  }),
];

/**
 * Error scenario handlers - use with server.use() in specific tests
 */
export const errorHandlers = {
  // Invalid credentials
  invalidCredentials: http.post(`${API_BASE}/config/test-connection`, async () => {
    await delay(100);
    return HttpResponse.json(apiErrors.invalidCredentials, { status: 401 });
  }),

  // Rate limited
  rateLimited: http.post(`${API_BASE}/config/test-connection`, () => {
    return HttpResponse.json(apiErrors.rateLimited, { status: 429 });
  }),

  // Server error
  serverError: http.post(`${API_BASE}/config`, () => {
    return HttpResponse.json(apiErrors.serverError, { status: 500 });
  }),

  // Network error
  networkError: http.post(`${API_BASE}/config`, () => {
    return HttpResponse.error();
  }),

  // Slow response (for testing loading states)
  slowResponse: http.post(`${API_BASE}/config`, async () => {
    await delay(5000);
    return HttpResponse.json(apiResponses.saveSuccess);
  }),

  // Already configured
  alreadyConfigured: http.get(`${API_BASE}/config`, () => {
    return HttpResponse.json(apiResponses.configuredTrue);
  }),
};

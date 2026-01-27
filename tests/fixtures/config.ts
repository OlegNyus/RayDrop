/**
 * Test fixtures for configuration data
 */

// Valid configuration
export const validConfig = {
  xrayClientId: 'ABC123DEF456GHI789',
  xrayClientSecret: 'secret-key-abc-123-def-456',
  jiraBaseUrl: 'https://mycompany.atlassian.net/',
};

// Valid form input (subdomain format)
export const validFormInput = {
  xrayClientId: 'ABC123DEF456GHI789',
  xrayClientSecret: 'secret-key-abc-123-def-456',
  jiraSubdomain: 'mycompany',
};

// Invalid configurations for negative tests
export const invalidConfigs = {
  emptyClientId: {
    xrayClientId: '',
    xrayClientSecret: 'secret-key-abc-123-def-456',
    jiraSubdomain: 'mycompany',
  },
  emptyClientSecret: {
    xrayClientId: 'ABC123DEF456GHI789',
    xrayClientSecret: '',
    jiraSubdomain: 'mycompany',
  },
  emptySubdomain: {
    xrayClientId: 'ABC123DEF456GHI789',
    xrayClientSecret: 'secret-key-abc-123-def-456',
    jiraSubdomain: '',
  },
  shortSubdomain: {
    xrayClientId: 'ABC123DEF456GHI789',
    xrayClientSecret: 'secret-key-abc-123-def-456',
    jiraSubdomain: 'a', // Too short
  },
  invalidSubdomainChars: {
    xrayClientId: 'ABC123DEF456GHI789',
    xrayClientSecret: 'secret-key-abc-123-def-456',
    jiraSubdomain: 'my_company!', // Invalid characters
  },
  whitespaceOnly: {
    xrayClientId: '   ',
    xrayClientSecret: '   ',
    jiraSubdomain: '   ',
  },
};

// API response fixtures
export const apiResponses = {
  configuredTrue: {
    configured: true,
    jiraBaseUrl: 'https://mycompany.atlassian.net/',
    hasCredentials: true,
  },
  configuredFalse: {
    configured: false,
  },
  saveSuccess: {
    success: true,
  },
  testConnectionSuccess: {
    success: true,
  },
};

// API error responses
export const apiErrors = {
  invalidCredentials: {
    error: 'Invalid Client ID or Client Secret',
  },
  rateLimited: {
    error: 'Too many attempts. Please wait 45 seconds.',
    waitSeconds: 45,
  },
  serverError: {
    error: 'Failed to save configuration',
  },
  missingClientId: {
    error: 'Client ID is required',
  },
  missingClientSecret: {
    error: 'Client Secret is required',
  },
  invalidUrl: {
    error: 'jiraBaseUrl must be a valid URL',
  },
};

// Subdomain test cases
export const subdomainTestCases = {
  valid: [
    { input: 'mycompany', expected: 'https://mycompany.atlassian.net/' },
    { input: 'my-company', expected: 'https://my-company.atlassian.net/' },
    { input: 'Company123', expected: 'https://company123.atlassian.net/' },
    { input: 'ab', expected: 'https://ab.atlassian.net/' },
  ],
  invalid: [
    { input: 'a', reason: 'Too short' },
    { input: '-mycompany', reason: 'Starts with hyphen' },
    { input: 'mycompany-', reason: 'Ends with hyphen' },
    { input: 'my_company', reason: 'Contains underscore' },
    { input: 'my.company', reason: 'Contains dot' },
    { input: 'my company', reason: 'Contains space' },
  ],
};

// URL extraction test cases
export const urlExtractionTestCases = [
  { url: 'https://mycompany.atlassian.net/', subdomain: 'mycompany' },
  { url: 'https://my-company.atlassian.net/', subdomain: 'my-company' },
  { url: 'https://mycompany.atlassian.com/', subdomain: 'mycompany' },
  { url: 'https://mycompany.atlassian.net/jira', subdomain: 'mycompany' },
  { url: 'invalid-url', subdomain: '' },
  { url: 'https://example.com/', subdomain: '' },
];

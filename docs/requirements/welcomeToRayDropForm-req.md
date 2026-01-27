# SetupForm ("Welcome to RayDrop") - Requirements Documentation

## Overview
The SetupForm is a configuration component that collects Xray Cloud API credentials and Jira base URL. It operates in two modes: initial setup mode ("Welcome to RayDrop") and edit mode ("Edit Configuration").

**Files:**
- Frontend: `src/components/SetupForm.jsx`
- Backend: `server/routes/config.js`
- API Client: `src/utils/api.js`

---

## 1. Functional Requirements

### Positive Scenarios (Happy Path)

| ID | Scenario | Expected Behavior |
|----|----------|-------------------|
| P1 | Initial load (new user) | Form displays with empty fields, title "Welcome to RayDrop", submit button text "Validate & Save Configuration" |
| P2 | Initial load (editing existing config) | Form pre-populates with `initialConfig` values, title "Edit Configuration", shows Cancel button |
| P3 | Enter valid Client ID | Value stored in form state, no error displayed |
| P4 | Enter valid Client Secret | Value stored in form state, no error displayed |
| P5 | Enter valid subdomain | Value stored, full URL preview shown in green (e.g., "whelen" → `https://whelen.atlassian.net/`) |
| P6 | Test Connection with valid credentials | Shows "Validating..." spinner, then success message with checkmark |
| P7 | Submit with all valid fields + valid Xray credentials | Shows loading state, calls API, on success calls `onComplete(formData)` |
| P8 | Clear error by typing | When field has error and user types, error clears immediately |
| P9 | Cancel in edit mode | Calls `onCancel()` callback, no data saved |

### Negative Scenarios (Error Paths)

| ID | Scenario | Expected Behavior |
|----|----------|-------------------|
| N1 | Submit with empty Client ID | Validation error: "Client ID is required" |
| N2 | Submit with whitespace-only Client ID | Validation error: "Client ID is required" (trims value) |
| N3 | Submit with empty Client Secret | Validation error: "Client Secret is required" |
| N4 | Submit with whitespace-only Client Secret | Validation error: "Client Secret is required" (trims value) |
| N5 | Submit with empty subdomain | Validation error: "Jira subdomain is required" |
| N6 | Submit with invalid subdomain characters | Validation error: "Subdomain can only contain letters, numbers, and hyphens" |
| N7 | Submit with subdomain < 2 chars | Validation error: "Subdomain must be at least 2 characters" |
| N8 | Test Connection with invalid credentials | Shows error message with X symbol: "Invalid Client ID or Client Secret" |
| N9 | Test Connection - network failure | Shows error message from caught exception |
| N10 | Save Config - API returns `{success: false, error: "..."}` | Displays error message in submit error area |
| N11 | Save Config - API throws exception | Displays exception message or "Failed to save configuration" |
| N12 | Save Config - server validation fails (400) | Displays validation error details |
| N13 | Save Config - credentials invalid (401) | Displays "Invalid credentials" error |
| N14 | Test Connection - rate limited (429) | Displays "Too many attempts. Please wait X seconds." |

---

## 2. Validations

### Client-Side Validations (SetupForm.jsx)

| Field | Validation | Error Message | Applied On |
|-------|------------|---------------|------------|
| xrayClientId | Required, non-empty after trim | "Client ID is required" | Submit, Test Connection |
| xrayClientSecret | Required, non-empty after trim | "Client Secret is required" | Submit, Test Connection |
| jiraSubdomain | Required, non-empty after trim | "Jira subdomain is required" | Submit only |
| jiraSubdomain | Must match pattern `^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$` | "Subdomain can only contain letters, numbers, and hyphens" | Submit only |
| jiraSubdomain | Minimum 2 characters | "Subdomain must be at least 2 characters" | Submit only |

### Server-Side Validations (config.js)

**POST /api/config (Save Config)**:

| Field | Validation | Error Response |
|-------|------------|----------------|
| xrayClientId | Required, string type, non-empty after trim | 400: "xrayClientId is required" |
| xrayClientSecret | Required, string type, non-empty after trim | 400: "xrayClientSecret is required" |
| jiraBaseUrl | Required, string type, valid URL format | 400: "jiraBaseUrl is required" or "jiraBaseUrl must be a valid URL" |
| Credentials | Must authenticate successfully with Xray API | 401: "Invalid credentials" or specific error |

**POST /api/config/test-connection**:

| Field | Validation | Error Response |
|-------|------------|----------------|
| xrayClientId | Required, string type, non-empty after trim | 400: "Client ID is required" |
| xrayClientSecret | Required, string type, non-empty after trim | 400: "Client Secret is required" |
| Rate limit | Max 5 attempts per minute per IP | 429: "Too many attempts. Please wait X seconds." |

---

## 3. Data Requirements

### Form Data Structure (Internal State)
```javascript
{
  xrayClientId: string,      // Required
  xrayClientSecret: string,  // Required
  jiraSubdomain: string      // Required - user enters only subdomain (e.g., "whelen")
}
```

### Auto-Generated Jira URL

The form automatically constructs the full Jira URL from the subdomain:

| User Input | Generated URL |
|------------|---------------|
| `whelen` | `https://whelen.atlassian.net/` |
| `my-company` | `https://my-company.atlassian.net/` |
| `Acme123` | `https://acme123.atlassian.net/` |

**URL Construction Logic:**
```javascript
function buildJiraUrl(subdomain) {
  return `https://${subdomain.toLowerCase().trim()}.atlassian.net/`;
}
```

**Subdomain Extraction (for editing):**
```javascript
// When loading existing config, extract subdomain from full URL
// "https://whelen.atlassian.net/" → "whelen"
function extractSubdomain(url) {
  const match = hostname.match(/^([^.]+)\.atlassian\.(net|com)$/);
  return match ? match[1] : '';
}
```

### Config File Structure (persisted)
```javascript
// Stored at: config/xray-config.json
{
  xrayClientId: string,
  xrayClientSecret: string,
  jiraBaseUrl: string,
  tokenData: {               // Added after successful auth
    token: string,
    timestamp: number,
    expiresAt: string
  }
}
```

### Props Interface
```javascript
{
  onComplete: (formData) => void,  // Required - called on successful save
  onCancel: () => void,            // Optional - called when Cancel clicked
  initialConfig: {                 // Optional - pre-populates form
    xrayClientId?: string,
    xrayClientSecret?: string,
    jiraBaseUrl?: string
  },
  isEditing: boolean               // Optional - toggles edit mode UI
}
```

---

## 4. UI States and Transitions

### State Machine

```
[Initial]
    |
    v
[Idle] <----------------------------------+
    |                                     |
    +---(Test Connection clicked)-------->|
    |       |                             |
    |       v                             |
    |   [Testing]                         |
    |       |                             |
    |       +---(success)---> [Test Success] ---(timeout/interact)---> [Idle]
    |       |                             |
    |       +---(failure)---> [Test Failure] ---(timeout/interact)---> [Idle]
    |                                     |
    +---(Submit clicked)----------------->\
            |                             |
            v                             |
        [Loading]                         |
            |                             |
            +---(success)---> [Complete] (calls onComplete)
            |
            +---(failure)---> [Error] ---(user types)---> [Idle]
```

### Loading Message Progression

| Delay | Message |
|-------|---------|
| 0ms | "Validating..." |
| 3000ms | "Still connecting to Xray..." |
| 8000ms | "This is taking longer than usual..." |

### Button States

| Condition | Submit Button | Test Button |
|-----------|---------------|-------------|
| Idle | Enabled | Enabled |
| Loading (submitting) | Disabled, shows spinner + message | Disabled |
| Testing | Disabled | Disabled, shows spinner + message |

---

## 5. API Interactions

### Test Connection Flow
```
Client                    Server                      Xray Cloud
  |--POST /config/test--->|                               |
  |     connection        |                               |
  |                       |---POST /authenticate--------->|
  |                       |<--200 (token) or 401----------|
  |<--200/401/429---------|                               |
```

### Save Config Flow
```
Client                    Server                      Xray Cloud         File System
  |--POST /config-------->|                               |                   |
  |                       |---POST /authenticate--------->|                   |
  |                       |<--200 (token) or 401----------|                   |
  |                       |                               |                   |
  |                       |---Write config.json------------------------>|
  |<--200/400/401/500-----|                               |                   |
```

---

## 6. Rate Limiting Behavior

**Endpoint**: POST /api/config/test-connection

| Parameter | Value |
|-----------|-------|
| Window | 60 seconds (1 minute) |
| Max attempts | 5 per IP |
| Storage | In-memory Map (testConnectionAttempts) |
| Reset | Sliding window (oldest attempts expire) |
| Response | 429 with wait time in seconds |

**Note**: Rate limiting is per-IP and stored in memory. Server restart clears rate limit state.

---

## 7. Edge Cases

| ID | Edge Case | Current Behavior | Notes |
|----|-----------|------------------|-------|
| E1 | URL with trailing slash | Accepted and stored as-is | No normalization |
| E2 | URL without trailing slash | Accepted | Works correctly |
| E3 | URL with path (e.g., `https://foo.atlassian.net/jira`) | Accepted | Only hostname validated |
| E4 | URL with port number | Accepted | URL parsing handles it |
| E5 | HTTP URL (not HTTPS) | Accepted | No HTTPS enforcement |
| E6 | Component unmount during API call | Timer cleanup via useEffect | Prevents memory leak |
| E7 | Double-click submit | First click starts loading, subsequent clicks disabled | Safe |
| E8 | Form re-render with new initialConfig | Values not updated | useState only uses initialConfig once |
| E9 | Very long credentials | No max length validation | Could cause issues |
| E10 | Unicode in credentials | Passed through as-is | Should work |
| E11 | XSS in credentials | React escapes output | Safe |
| E12 | Atlassian server (non-cloud) URL | Rejected | Only .atlassian.net/.atlassian.com allowed |

---

## 8. Gaps and Potential Improvements

| ID | Gap | Impact | Recommendation |
|----|-----|--------|----------------|
| G1 | Client Secret displayed as plain text | Security concern | Use `type="password"` input |
| G2 | No maximum length validation | Potential for very large payloads | Add max length (e.g., 500 chars) |
| G3 | No minimum length validation | Users might enter partial credentials | Add sensible minimums |
| G4 | Rate limiting only on test-connection, not on save | Could abuse save endpoint | Apply rate limiting to save endpoint |
| G5 | In-memory rate limiting resets on server restart | Can bypass with restart | Use Redis or persistent storage |
| G6 | No HTTPS enforcement on Jira URL | Insecure connections possible | Validate protocol is HTTPS |
| G7 | Server validates URL format but not Atlassian domain | Inconsistent with client | Add Atlassian domain check server-side |
| G8 | initialConfig changes not reflected | Stale data if parent updates config | Use useEffect to sync or key prop |
| G9 | No timeout on API calls (client-side) | UI could hang indefinitely | Add fetch timeout |
| G10 | Xray API timeout is 30 seconds | Long wait for users | Consider shorter timeout with retry |
| G11 | No credential masking in stored config | Secrets in plain text on disk | Consider encryption at rest |
| G12 | Test result persists until next action | Could be confusing | Auto-clear after timeout |

---

## 9. Connection Status Indicator ("Connected to Xray")

The connection status indicator appears in the application header after successful configuration.

**Files:**
- Header Component: `src/components/Header.jsx`
- Config Modal: `src/components/ConfigModal.jsx`
- Tests: `src/components/Header.test.jsx`

### Visual States

| State | Indicator | Text | Visibility |
|-------|-----------|------|------------|
| Configured | Green dot (`bg-emerald-500`) | "Connected to Xray" | Dot always visible, text hidden on mobile (`sm:inline`) |
| Not Configured | Gray dot (`bg-gray-400`) | "Not configured" | Dot always visible, text hidden on mobile |

### Props Required

```javascript
{
  isConfigured: boolean,  // Determines indicator state
  config: {               // Passed to ConfigModal
    xrayClientId: string,
    xrayClientSecret: string,
    jiraBaseUrl: string
  },
  onReconfigure: () => void  // Called when Edit clicked in modal
}
```

### Functional Requirements

| ID | Scenario | Expected Behavior |
|----|----------|-------------------|
| CI1 | App configured | Green dot + "Connected to Xray" text displayed |
| CI2 | App not configured | Gray dot + "Not configured" text displayed |
| CI3 | Mobile view (< 640px) | Only dot visible, text hidden |
| CI4 | Hover on dot | Shows tooltip with full status |
| CI5 | Config button visible | Only when `isConfigured` is true |
| CI6 | Click config button | Opens Configuration modal |
| CI7 | Modal shows credentials | Client ID and Secret truncated (first 6...last 6 chars) |
| CI8 | Modal shows Jira URL | Full URL displayed |
| CI9 | Click "Close" in modal | Modal closes, no changes |
| CI10 | Click "Edit" in modal | Modal closes, `onReconfigure()` called, returns to SetupForm |

### Configuration Modal Structure

```
┌─────────────────────────────────┐
│         [Gear Icon]             │
│        Configuration            │
│  Your current Xray Cloud settings│
├─────────────────────────────────┤
│  Client ID      abc123...xyz789 │
│  Client Secret  def456...uvw012 │
│  Jira Base URL  https://x.atla..│
├─────────────────────────────────┤
│   [Close]           [Edit]      │
└─────────────────────────────────┘
```

### Credential Masking in Modal

| Field | Display Format | Example |
|-------|----------------|---------|
| Client ID | First 6 + "..." + Last 6 | `BDF6BD...60DED0` |
| Client Secret | First 6 + "..." + Last 6 | `035c4c...a576d` |
| Jira Base URL | Full URL | `https://company.atlassian.net` |

### Test Coverage

| Test ID | Description |
|---------|-------------|
| T1 | Renders "Connected to Xray" when configured |
| T2 | Renders "Not configured" when not configured |
| T3 | Config button visible when configured |
| T4 | Config button hidden when not configured |
| T5 | Config modal opens on button click |
| T6 | Modal closes on "Close" click |
| T7 | `onReconfigure` called on "Edit" click |
| T8 | Modal closes after "Edit" click |

---

## 10. Open Questions

1. **E8 Behavior**: Is it intentional that `initialConfig` changes after mount are not reflected in the form? Should the form re-sync when `initialConfig` prop changes?

2. **G6 HTTP URLs**: Should HTTP URLs be explicitly rejected, or is this acceptable for local development/testing scenarios?

3. **G7 Domain Validation**: The client validates for Atlassian domains but the server does not. Should server-side validation match?

4. **G11 Credential Storage**: Are there security requirements for encrypting credentials at rest in the config file?

5. **Rate Limiting Scope**: Should the `/api/config` (save) endpoint also have rate limiting to prevent credential brute-forcing?

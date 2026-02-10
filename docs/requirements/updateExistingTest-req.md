# Update Existing Test Case in Xray Cloud — Requirements

## Overview

The current `updateExistingTest` function uses the Xray Cloud bulk import endpoint (`POST /api/v1/import/test/bulk`) with `update_key` to update an existing test. This approach **does not work in Xray Cloud** — links update correctly (via separate GraphQL mutations), but Jira fields (summary, description, labels) and test steps are not updated.

**Root cause:** In Xray Cloud, tests are Jira issues. Xray Cloud runs on a separate server from Jira Cloud. The bulk import `update_key` parameter is a Server/DC feature and does not reliably update Jira fields or steps in Cloud.

**Goal:** Rewrite `updateExistingTest` to properly update all test fields using the correct APIs for Xray Cloud.

---

## Architecture Constraint: Separate Auth Systems

Xray Cloud and Jira Cloud use completely independent authentication:

| System | Auth Method | Endpoints |
|---|---|---|
| Xray Cloud | OAuth client credentials (`client_id`/`client_secret`) → JWT bearer token | `xray.cloud.getxray.app/*` |
| Jira Cloud | Basic auth (`email:apiToken` base64-encoded) | `{site}.atlassian.net/rest/api/3/*` |

The Xray bearer token **cannot** be used for Jira REST API calls. New Jira credentials are required.

---

## What Needs Updating Per Field

| Field | Owner | API to Use | Auth |
|---|---|---|---|
| Summary | Jira | Jira REST API `PUT /rest/api/3/issue/{key}` | Jira basic auth |
| Description | Jira | Jira REST API `PUT /rest/api/3/issue/{key}` | Jira basic auth |
| Labels | Jira | Jira REST API `PUT /rest/api/3/issue/{key}` | Jira basic auth |
| Test Steps | Xray | Xray GraphQL `removeAllTestSteps` + `addTestStep` | Existing Xray token |
| Test Type | Xray | Xray GraphQL `updateTestType` | Existing Xray token |
| Linking | Xray | Existing GraphQL mutations (already works) | Existing Xray token |

---

## Implementation Plan

### 1. Add Jira Credentials to Config

**File: `server/src/types.ts`**

Add optional Jira auth fields to `Config`:

```typescript
export interface Config {
  xrayClientId: string;
  xrayClientSecret: string;
  jiraBaseUrl: string;
  jiraEmail?: string;       // NEW — Atlassian account email
  jiraApiToken?: string;    // NEW — Atlassian API token
  tokenData?: TokenData;
}
```

Fields are optional so existing configs without Jira creds still work. Update feature will require them.

### 2. Add Jira Credentials to Settings UI

**File: `client/src/components/features/settings/SettingsPage.tsx`**

In the `XrayConfigSection`, add two new input fields:

- **Jira Email** — `<Input label="Jira Email" />` — the Atlassian account email
- **Jira API Token** — `<Input label="Jira API Token" type="password" />` — from [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)

These fields should be:
- Displayed below the existing Xray fields in the config form
- Shown as optional (with helper text: "Required for updating existing test cases")
- Saved alongside existing config fields
- Displayed in read-only mode when configured (masked, like the existing Client Secret)

**File: `server/src/routes/config.ts`**

Update the save endpoint to accept and persist `jiraEmail` and `jiraApiToken`. No validation call needed — these will be validated on first use during update.

**File: `client/src/services/api.ts`**

Update the `configApi.save()` payload type to include `jiraEmail` and `jiraApiToken`.

### 3. Add Jira REST API Helper

**File: `server/src/utils/xrayClient.ts`**

Add a helper function for Jira REST API calls:

```typescript
async function updateJiraIssue(
  issueKey: string,
  fields: { summary?: string; description?: string; labels?: string[] }
): Promise<void> {
  const config = readConfig();
  if (!config?.jiraEmail || !config?.jiraApiToken) {
    throw new Error('Jira credentials not configured. Add Jira Email and API Token in Settings.');
  }

  const auth = Buffer.from(`${config.jiraEmail}:${config.jiraApiToken}`).toString('base64');
  const baseUrl = config.jiraBaseUrl.replace(/\/$/, '');

  await axios.put(
    `${baseUrl}/rest/api/3/issue/${issueKey}`,
    { fields },
    {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );
}
```

**Note on description format:** Jira REST API v3 expects ADF (Atlassian Document Format) for the `description` field, not plain text. The description must be converted to ADF before sending. If the draft description is plain text, wrap it in a minimal ADF document:

```typescript
function toAdfDocument(text: string): object {
  return {
    version: 1,
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: text || '' }],
      },
    ],
  };
}
```

### 4. Add Xray GraphQL Step Mutations

**File: `server/src/utils/xrayClient.ts`**

Add two new GraphQL functions:

#### removeAllTestSteps

```typescript
export async function removeAllSteps(testIssueId: string): Promise<void> {
  const mutation = `
    mutation RemoveAllTestSteps($issueId: String!) {
      removeAllTestSteps(issueId: $issueId)
    }
  `;
  await executeGraphQL(mutation, { issueId: testIssueId });
}
```

#### addTestStep

```typescript
export async function addTestStep(
  testIssueId: string,
  step: { action: string; data: string; result: string }
): Promise<void> {
  const mutation = `
    mutation AddTestStep($issueId: String!, $step: CreateStepInput!) {
      addTestStep(issueId: $issueId, step: $step) {
        id
      }
    }
  `;
  await executeGraphQL(mutation, {
    issueId: testIssueId,
    step: {
      action: step.action,
      data: step.data,
      result: step.result,
    },
  });
}
```

Steps must be added sequentially (in order) to preserve step ordering.

### 5. Rewrite updateExistingTest

**File: `server/src/utils/xrayClient.ts`**

Replace the current `updateExistingTest` (lines 1505–1574) with a hybrid approach:

```typescript
export async function updateExistingTest(draft: Draft): Promise<ImportResult> {
  if (!draft.sourceTestKey || !draft.sourceTestIssueId) {
    return { success: false, error: 'Missing source test key or issue ID' };
  }

  try {
    // Step 1: Update Jira fields (summary, description, labels)
    const description = typeof draft.description === 'string'
      ? toAdfDocument(draft.description)
      : draft.description || toAdfDocument('');

    await updateJiraIssue(draft.sourceTestKey, {
      summary: draft.summary,
      description,
      labels: draft.labels || [],
    });

    // Step 2: Update test steps via Xray GraphQL
    await removeAllSteps(draft.sourceTestIssueId);

    for (const step of draft.steps || []) {
      await addTestStep(draft.sourceTestIssueId, {
        action: step.action || '',
        data: formatDataForXray(step.data || ''),
        result: step.result || '',
      });
    }

    return {
      success: true,
      testIssueIds: [draft.sourceTestIssueId],
      testKeys: [draft.sourceTestKey],
    };
  } catch (error) {
    const axiosError = error as { response?: { data?: { error?: string; message?: string } }; message?: string };
    const errorMsg = axiosError.response?.data?.message ||
                     axiosError.response?.data?.error ||
                     axiosError.message;
    return {
      success: false,
      error: `Update failed: ${errorMsg}`,
    };
  }
}
```

### 6. Update Route (No Changes Needed)

**File: `server/src/routes/xray.ts`**

The existing `/api/xray/update` route (lines 124–156) already calls `updateExistingTest(draft)` and handles the result. No changes needed — the route is a thin wrapper and the logic change is entirely in `xrayClient.ts`.

Linking is handled separately by the client after the update call (same flow as import).

---

## Error Handling

- If Jira credentials are missing → return `{ success: false, error: 'Jira credentials not configured...' }`
- If Jira REST API returns 401 → surface "Invalid Jira credentials" error
- If Jira field update succeeds but step update fails → partial update (Jira fields saved, steps not). Error message should indicate which part failed.
- If Jira field update fails → return error immediately, skip step update

---

## Files to Modify

| File | Change |
|---|---|
| `server/src/types.ts` | Add `jiraEmail?`, `jiraApiToken?` to `Config` |
| `server/src/utils/xrayClient.ts` | Add `updateJiraIssue()`, `removeAllSteps()`, `addTestStep()`, `toAdfDocument()`. Rewrite `updateExistingTest()` |
| `server/src/routes/config.ts` | Accept and persist `jiraEmail`, `jiraApiToken` in save endpoint |
| `client/src/services/api.ts` | Update config save payload type to include Jira fields |
| `client/src/components/features/settings/SettingsPage.tsx` | Add Jira Email and API Token inputs to config form |
| `client/src/types/index.ts` | Update client-side Config type if it exists |

## New File

None.

---

## Xray GraphQL API Reference

Mutations used (all confirmed available in Xray Cloud):

| Mutation | Signature |
|---|---|
| `removeAllTestSteps` | `removeAllTestSteps(issueId: String!, versionId: Int): String` |
| `addTestStep` | `addTestStep(issueId: String!, versionId: Int, step: CreateStepInput!): Step` |

`CreateStepInput` fields: `action: String`, `data: String`, `result: String`

GraphQL endpoint: `https://xray.cloud.getxray.app/api/v2/graphql`
Auth: `Bearer {xray_token}` (existing)

## Jira REST API Reference

| Endpoint | Method | Purpose |
|---|---|---|
| `/rest/api/3/issue/{issueIdOrKey}` | `PUT` | Update issue fields |

Auth: `Basic base64(email:apiToken)`

Payload for field update:
```json
{
  "fields": {
    "summary": "Updated summary",
    "description": { "version": 1, "type": "doc", "content": [...] },
    "labels": ["label1", "label2"]
  }
}
```

---

## Testing Considerations

- Mock `updateJiraIssue` and GraphQL step mutations in unit tests
- Test partial failure scenarios (Jira succeeds, steps fail and vice versa)
- Test missing Jira credentials error path
- Test ADF description conversion
- Existing linking tests remain valid (linking is unchanged)

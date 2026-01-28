# RayDrop Regression Test Cases

> **Last Updated:** January 27, 2026  
> **Version:** 1.0.0  
> **Purpose:** Living regression test document. Update with every feature implementation or modification.

---

## TC-001: Dashboard loads with correct URL

**Priority:** High  
**Module:** Navigation / Dashboard

**Preconditions:**
- Application is running at localhost:5173
- At least one test case exists in the system

**Steps:**
1. Navigate to the application root or click "Dashboard" in sidebar
2. Observe the URL in browser address bar
3. Observe the page content

**Expected Results:**
- URL shows `/dashboard`
- Dashboard title is displayed
- Statistics cards show: Total Test Cases, New, Draft, Ready
- Recent Test Cases section displays
- "Dashboard" sidebar item is highlighted (orange background)

---

## TC-002: Test Cases list loads with correct URL

**Priority:** High  
**Module:** Navigation / Test Cases

**Preconditions:**
- Application is running

**Steps:**
1. Click "Test Cases" in sidebar
2. Observe the URL in browser address bar
3. Observe the page content

**Expected Results:**
- URL shows `/test-cases`
- "Test Cases" title is displayed
- Search input is present
- Status filter dropdown is present
- Sort buttons (Date, Name) are present
- "+ New Test Case" button is present
- Test case list displays with summary, description, status badge, date
- "Test Cases" sidebar item is highlighted

---

## TC-003: Create Test Case - Step 1 form displays correctly

**Priority:** High  
**Module:** Create Test Case

**Preconditions:**
- Application is running

**Steps:**
1. Click "Create Test Case" in sidebar OR click "+ New Test Case" button
2. Observe the URL
3. Observe the form content

**Expected Results:**
- URL shows `/test-cases/new`
- Title shows "Create Test Case" with "New" status badge
- Step indicator shows Step 1 (Basic Info) as active (orange)
- Form displays: Summary section (Functional Area, Layer toggle, Title), Description textarea, Test Type (read-only), Priority (read-only), Labels input
- Bottom buttons: Reset, Save Draft, Next →
- "Create Test Case" sidebar item is highlighted

---

## TC-004: Create Test Case - Step 2 Test Steps displays correctly

**Priority:** High  
**Module:** Create Test Case

**Preconditions:**
- On Create Test Case page
- Step 1 fields are filled (Title and Description have values)

**Steps:**
1. Fill in Title field with any text
2. Fill in Description field with any text
3. Click "Next →" button
4. Observe the page

**Expected Results:**
- Step indicator shows Step 1 as completed (green checkmark)
- Step indicator shows Step 2 (Test Steps) as active (orange)
- "Test Steps" card displays with "+ Add Step" button
- One step card (Step 1) is present by default
- Step card has: drag handle (≡), Action textarea (required), Test Data textarea (optional), Expected Result textarea (required)
- Bottom buttons: ← Previous, Reset, Save Draft, Next →

---

## TC-005: Create Test Case - Add Step functionality works

**Priority:** High  
**Module:** Create Test Case

**Preconditions:**
- On Create Test Case, Step 2 (Test Steps)

**Steps:**
1. Click "+ Add Step" button
2. Observe the result
3. Click "+ Add Step" button again
4. Observe the result

**Expected Results:**
- First click: Step 2 card appears below Step 1
- Second click: Step 3 card appears below Step 2
- Each step card has X button to remove
- Steps are numbered sequentially (Step 1, Step 2, Step 3)
- All step cards have drag handles for reordering

---

## TC-006: Edit Test Case - Loads existing data correctly

**Priority:** High  
**Module:** Edit Test Case

**Preconditions:**
- At least one test case (draft) exists in the system

**Steps:**
1. Navigate to Test Cases list (`/test-cases`)
2. Click on an existing test case row
3. Observe the URL
4. Observe the form content

**Expected Results:**
- URL shows `/test-cases/{uuid}/edit` (where uuid is the test case ID)
- Title shows "Edit Test Case" with status badge (e.g., "Draft")
- All fields are populated with existing data:
  - Summary preview shows the saved summary
  - Functional Area shows saved value
  - Layer toggle shows saved value (UI or API)
  - Title field shows saved title
  - Description shows saved description
  - Labels show saved labels
- "Create Test Case" sidebar item is NOT highlighted

---

## TC-007: Edit Test Case - Update Draft button disabled when no changes

**Priority:** High  
**Module:** Edit Test Case

**Preconditions:**
- On Edit Test Case page (just opened, no changes made)

**Steps:**
1. Observe the "Update Draft" button immediately after page load
2. Observe the header area for any unsaved indicator

**Expected Results:**
- "Update Draft" button is disabled (grayed out, not clickable)
- No "• Unsaved" indicator is shown in header
- "Next →" button is enabled

---

## TC-008: Edit Test Case - Update Draft button enabled after changes

**Priority:** High  
**Module:** Edit Test Case

**Preconditions:**
- On Edit Test Case page

**Steps:**
1. Make any change to the form (e.g., edit description text)
2. Observe the "Update Draft" button
3. Observe the header area

**Expected Results:**
- "Update Draft" button becomes enabled (clickable, normal styling)
- "• Unsaved" indicator appears in header next to status badge
- Indicator text is orange/warning color

---

## TC-009: Validation errors display correctly

**Priority:** High  
**Module:** Create/Edit Test Case

**Preconditions:**
- On Create or Edit Test Case, Step 2 (Test Steps)
- At least one step has empty required fields

**Steps:**
1. Leave Action field empty on any step
2. Leave Expected Result field empty on any step
3. Click "Next →" button
4. Observe the form

**Expected Results:**
- Form does NOT proceed to Step 3
- Error message "Action is required" appears below empty Action field
- Error message "Expected result is required" appears below empty Expected Result field
- Error fields have red border highlighting
- Error messages are in red/error color

---

## TC-010: Settings page loads correctly

**Priority:** Medium  
**Module:** Settings

**Preconditions:**
- Application is running and configured

**Steps:**
1. Click "Settings" in sidebar (bottom of sidebar)
2. Observe the URL
3. Observe the page content

**Expected Results:**
- URL shows `/settings`
- "Settings" title is displayed
- Xray Configuration section shows: Status (Connected/Disconnected), Jira Base URL, Edit Configuration button
- Appearance section shows: Theme label, Theme toggle (sun/moon/auto icons)
- Projects section shows: Add project input, List of existing projects with active indicator
- "Settings" sidebar item is highlighted

---

## TC-011: Xray Entity pages load correctly (Test Sets example)

**Priority:** Medium  
**Module:** Xray Entities

**Preconditions:**
- Application is running

**Steps:**
1. Click "Test Sets" in sidebar (under XRAY ENTITIES section)
2. Observe the URL
3. Observe the page content
4. Repeat for: Test Plans, Test Executions, Preconditions

**Expected Results:**
- Test Sets: URL `/test-sets`, title "Test Sets", sidebar highlighted
- Test Plans: URL `/test-plans`, title "Test Plans", sidebar highlighted
- Test Executions: URL `/test-executions`, title "Test Executions", sidebar highlighted
- Preconditions: URL `/preconditions`, title "Preconditions", sidebar highlighted
- Each page shows placeholder content "View and manage [entity] from Xray. Feature coming soon..."

---

## TC-012: Step indicator shows progress correctly

**Priority:** Medium  
**Module:** Create/Edit Test Case

**Preconditions:**
- On Create Test Case page

**Steps:**
1. Observe Step indicator on Step 1 (initial state)
2. Fill required fields and click Next to go to Step 2
3. Observe Step indicator
4. Fill required fields and click Next to go to Step 3
5. Observe Step indicator
6. Click on Step 1 indicator
7. Observe navigation

**Expected Results:**
- Initial: Step 1 is orange (active), Steps 2 and 3 are gray (inactive), Imported is faded
- After Step 1 complete: Step 1 is green with checkmark, Step 2 is orange (active)
- After Step 2 complete: Steps 1 and 2 are green with checkmarks, Step 3 is orange (active)
- Clicking on completed step indicator navigates back to that step
- Progress line connects all step indicators
- Cannot click on future uncompleted steps

---

## Revision History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-01-27 | 1.0.0 | Initial creation with 12 test cases covering React Router implementation and refactoring | Claude |

---

## Notes

- These test cases cover the core functionality after implementing React Router for URL-based navigation
- Update this document whenever new features are added or existing functionality is modified
- Each test case should be re-executed after significant code changes

import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '../helpers/render';
import { CreateTestCase } from '../../client/src/components/features/create/CreateTestCase';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '../../client/src/context/ThemeContext';
import { AppProvider } from '../../client/src/context/AppContext';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

function renderCreateTestCase() {
  return render(
    <MemoryRouter initialEntries={['/create']}>
      <ThemeProvider>
        <AppProvider>
          <Routes>
            <Route path="/create" element={<CreateTestCase />} />
            <Route path="/test-cases" element={<div>Test Cases List</div>} />
          </Routes>
        </AppProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

async function skipChoiceScreen() {
  await waitFor(() => {
    expect(screen.getByText('From Scratch')).toBeInTheDocument();
  });
  fireEvent.click(screen.getByText('From Scratch'));
  await waitFor(() => {
    expect(screen.getByText('Next →')).toBeInTheDocument();
  });
}

describe('TC-FormFields-U001: Test Type, Priority, and Automation Status dropdowns', () => {
  beforeEach(() => {
    server.use(
      http.get('*/api/config', () => {
        return HttpResponse.json({
          configured: true,
          jiraBaseUrl: 'https://test.atlassian.net/',
          hasCredentials: true,
        });
      }),
      http.get('*/api/settings', () => {
        return HttpResponse.json({
          projects: ['WCP'],
          hiddenProjects: [],
          activeProject: 'WCP',
          projectSettings: { WCP: { color: '#3B82F6', functionalAreas: ['UI', 'API'] } },
        });
      }),
      http.get('*/api/settings/projects/:projectKey', () => {
        return HttpResponse.json({
          color: '#3B82F6',
          functionalAreas: ['UI', 'API'],
        });
      }),
      http.get('*/api/drafts', () => HttpResponse.json([])),
      http.get('*/api/xray/test-plans/:projectKey', () => HttpResponse.json([])),
      http.get('*/api/xray/test-executions/:projectKey', () => HttpResponse.json([])),
      http.get('*/api/xray/test-sets/:projectKey', () => HttpResponse.json([])),
      http.get('*/api/xray/preconditions/:projectKey', () => HttpResponse.json([])),
      http.get('*/api/xray/project-id/:projectKey', () => HttpResponse.json({ projectId: 'proj-123' })),
      http.get('*/api/xray/folders/:projectId', () => HttpResponse.json({ folders: [] })),
    );
  });

  it('renders Test Type as static read-only field defaulting to Manual', async () => {
    renderCreateTestCase();
    await skipChoiceScreen();

    const testTypeLabel = screen.getByText('Test Type');
    expect(testTypeLabel).toBeInTheDocument();

    // Test Type should be a static div (not a select dropdown)
    // The label's sibling div should contain "Manual" as plain text
    const testTypeContainer = testTypeLabel.closest('.space-y-1');
    expect(testTypeContainer).toBeDefined();
    const staticDiv = testTypeContainer!.querySelector('.bg-sidebar');
    expect(staticDiv).not.toBeNull();
    expect(staticDiv!.textContent).toBe('Manual');
  });

  it('renders Priority dropdown with five options', async () => {
    renderCreateTestCase();
    await skipChoiceScreen();

    const priorityLabel = screen.getByText('Priority');
    expect(priorityLabel).toBeInTheDocument();

    // Find the priority select
    const selects = screen.getAllByRole('combobox');
    const prioritySelect = selects.find(s => {
      const options = Array.from(s.querySelectorAll('option'));
      return options.some(o => o.textContent === 'Highest') && options.some(o => o.textContent === 'Lowest');
    });
    expect(prioritySelect).toBeDefined();

    // Verify all priority options
    const options = Array.from(prioritySelect!.querySelectorAll('option')).map(o => o.textContent);
    expect(options).toEqual(['Highest', 'High', 'Medium', 'Low', 'Lowest']);

    // Default is Medium
    expect(prioritySelect).toHaveValue('Medium');
  });

  it('renders Automation Status dropdown with all options', async () => {
    renderCreateTestCase();
    await skipChoiceScreen();

    const autoLabel = screen.getByText('Automation Status');
    expect(autoLabel).toBeInTheDocument();

    // Find the automation status select
    const selects = screen.getAllByRole('combobox');
    const autoSelect = selects.find(s => {
      const options = Array.from(s.querySelectorAll('option'));
      return options.some(o => o.textContent === 'Planned For Automation');
    });
    expect(autoSelect).toBeDefined();

    const options = Array.from(autoSelect!.querySelectorAll('option')).map(o => o.textContent);
    expect(options).toEqual(['Not Set', 'Manual', 'Planned For Automation', 'In Progress', 'Automated', 'Maintenance']);

    // Default is empty (Not Set)
    expect(autoSelect).toHaveValue('');
  });

  it('allows changing Priority', async () => {
    const user = userEvent.setup();
    renderCreateTestCase();
    await skipChoiceScreen();

    const selects = screen.getAllByRole('combobox');
    const prioritySelect = selects.find(s => {
      const options = Array.from(s.querySelectorAll('option'));
      return options.some(o => o.textContent === 'Highest') && options.some(o => o.textContent === 'Lowest');
    })!;

    await user.selectOptions(prioritySelect, 'High');
    expect(prioritySelect).toHaveValue('High');
  });

  it('allows changing Automation Status', async () => {
    const user = userEvent.setup();
    renderCreateTestCase();
    await skipChoiceScreen();

    const selects = screen.getAllByRole('combobox');
    const autoSelect = selects.find(s => {
      const options = Array.from(s.querySelectorAll('option'));
      return options.some(o => o.textContent === 'Planned For Automation');
    })!;

    await user.selectOptions(autoSelect, 'In Progress');
    expect(autoSelect).toHaveValue('In Progress');
  });
});

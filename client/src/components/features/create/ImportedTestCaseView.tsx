import { useNavigate } from 'react-router-dom';
import { Card, Button, StatusBadge, TestKeyLink } from '../../ui';
import { useApp } from '../../../context/AppContext';
import type { Draft } from '../../../types';

// Extract issue key from display text (e.g., "WCP-7067: Sprint 115 | Smoke" -> "WCP-7067")
function extractKey(display: string): string | null {
  const match = display.match(/^([A-Z]+-\d+)/);
  return match ? match[1] : null;
}

// Clickable link for Xray entities
function XrayEntityLink({ display, jiraBaseUrl }: { display: string; jiraBaseUrl?: string }) {
  const issueKey = extractKey(display);

  if (issueKey && jiraBaseUrl) {
    return (
      <a
        href={`${jiraBaseUrl}/browse/${issueKey}`}
        target="_blank"
        rel="noopener noreferrer"
        className="px-2 py-1 bg-sidebar hover:bg-sidebar-hover rounded text-sm text-text-primary transition-colors inline-flex items-center gap-1"
      >
        {display} <span className="text-text-muted text-xs">↗</span>
      </a>
    );
  }

  return (
    <span className="px-2 py-1 bg-sidebar rounded text-sm text-text-primary">
      {display}
    </span>
  );
}

interface ImportedTestCaseViewProps {
  draft: Draft;
}

export function ImportedTestCaseView({ draft }: ImportedTestCaseViewProps) {
  const navigate = useNavigate();
  const { config } = useApp();
  const jiraBaseUrl = config?.jiraBaseUrl;

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-text-primary">View Test Case</h1>
          <StatusBadge status={draft.status} />
          {draft.testKey && <TestKeyLink testKey={draft.testKey} />}
        </div>
        <Button variant="ghost" onClick={() => navigate('/test-cases')}>
          ← Back to Test Cases
        </Button>
      </div>

      {/* Basic Information */}
      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-text-primary border-b border-border pb-2">
          Basic Information
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Summary</label>
            <p className="text-text-primary">{draft.summary}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Description</label>
            <p className="text-text-primary whitespace-pre-wrap">{draft.description}</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Test Type</label>
              <p className="text-text-primary">{draft.testType}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Priority</label>
              <p className="text-text-primary">{draft.priority}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Project</label>
              <p className="text-text-primary">{draft.projectKey}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Imported</label>
              <p className="text-text-primary">{new Date(draft.updatedAt).toLocaleDateString()}</p>
            </div>
          </div>

          {draft.labels.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Labels</label>
              <div className="flex flex-wrap gap-2">
                {draft.labels.map(label => (
                  <span
                    key={label}
                    className="px-2 py-1 bg-accent/20 text-accent rounded text-sm"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Test Steps */}
      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-text-primary border-b border-border pb-2">
          Test Steps ({draft.steps.length})
        </h2>

        <div className="space-y-3">
          {draft.steps.map((step, index) => (
            <div
              key={step.id}
              className="p-4 bg-background rounded-lg border border-border"
            >
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </span>
                <div className="flex-1 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Action</label>
                    <p className="text-text-primary">{step.action}</p>
                  </div>
                  {step.data && (
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Test Data</label>
                      <p className="text-text-primary">{step.data}</p>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Expected Result</label>
                    <p className="text-text-primary">{step.result}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Xray Linking */}
      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-text-primary border-b border-border pb-2">
          Xray Linking
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {draft.xrayLinking.testPlanDisplays.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">Test Plans</label>
              <div className="flex flex-wrap gap-2">
                {draft.xrayLinking.testPlanDisplays.map(item => (
                  <XrayEntityLink key={item.id} display={item.display} jiraBaseUrl={jiraBaseUrl} />
                ))}
              </div>
            </div>
          )}

          {draft.xrayLinking.testExecutionDisplays.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">Test Executions</label>
              <div className="flex flex-wrap gap-2">
                {draft.xrayLinking.testExecutionDisplays.map(item => (
                  <XrayEntityLink key={item.id} display={item.display} jiraBaseUrl={jiraBaseUrl} />
                ))}
              </div>
            </div>
          )}

          {draft.xrayLinking.testSetDisplays.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">Test Sets</label>
              <div className="flex flex-wrap gap-2">
                {draft.xrayLinking.testSetDisplays.map(item => (
                  <XrayEntityLink key={item.id} display={item.display} jiraBaseUrl={jiraBaseUrl} />
                ))}
              </div>
            </div>
          )}

          {draft.xrayLinking.preconditionDisplays.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">Preconditions</label>
              <div className="flex flex-wrap gap-2">
                {draft.xrayLinking.preconditionDisplays.map(item => (
                  <XrayEntityLink key={item.id} display={item.display} jiraBaseUrl={jiraBaseUrl} />
                ))}
              </div>
            </div>
          )}

          {draft.xrayLinking.folderPath && (
            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">Folder</label>
              <span className="px-2 py-1 bg-sidebar rounded text-sm text-text-primary inline-flex items-center gap-1">
                📁 {draft.xrayLinking.folderPath}
              </span>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

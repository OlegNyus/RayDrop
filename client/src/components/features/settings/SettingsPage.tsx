import { useState, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import { Card, Button, Input, ConfirmModal } from '../../ui';
import { configApi, settingsApi, draftsApi } from '../../../services/api';
import type { Draft } from '../../../types';

export function SettingsPage() {
  const { config, isConfigured, refreshConfig, settings, refreshSettings } = useApp();
  const [allDrafts, setAllDrafts] = useState<Draft[]>([]);

  // Fetch ALL drafts (not filtered by project) for accurate counts
  useEffect(() => {
    const loadAllDrafts = async () => {
      try {
        const drafts = await draftsApi.list(); // No project filter
        setAllDrafts(drafts);
      } catch (err) {
        console.error('Failed to load drafts:', err);
      }
    };
    loadAllDrafts();
  }, []);

  return (
    <div className="space-y-6 max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-text-primary">Settings</h1>

      <XrayConfigSection
        isConfigured={isConfigured}
        jiraBaseUrl={config?.jiraBaseUrl}
        onSave={refreshConfig}
      />

      <ProjectsSection
        settings={settings}
        onUpdate={refreshSettings}
        draftCounts={getDraftCountsByProject(allDrafts)}
      />
    </div>
  );
}

// Helper to count drafts per project
function getDraftCountsByProject(drafts: import('../../../types').Draft[]): Record<string, number> {
  const counts: Record<string, number> = {};
  drafts.forEach(d => {
    counts[d.projectKey] = (counts[d.projectKey] || 0) + 1;
  });
  return counts;
}

function XrayConfigSection({
  isConfigured,
  jiraBaseUrl,
  onSave,
}: {
  isConfigured: boolean;
  jiraBaseUrl?: string;
  onSave: () => void;
}) {
  const [editing, setEditing] = useState(!isConfigured);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [baseUrl, setBaseUrl] = useState(jiraBaseUrl || '');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const handleSave = async () => {
    if (!clientId || !clientSecret || !baseUrl) {
      setError('All fields are required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await configApi.save({
        xrayClientId: clientId,
        xrayClientSecret: clientSecret,
        jiraBaseUrl: baseUrl,
      });
      setEditing(false);
      setClientId('');
      setClientSecret('');
      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await configApi.test();
      setTestResult('success');
    } catch {
      setTestResult('error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            isConfigured ? 'bg-success/20' : 'bg-warning/20'
          }`}>
            <svg className={`w-5 h-5 ${isConfigured ? 'text-success' : 'text-warning'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Xray Connection</h2>
            <p className="text-sm text-text-muted">
              {isConfigured ? 'Connected to Xray Cloud' : 'Not configured'}
            </p>
          </div>
        </div>
        {isConfigured && !editing && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-sm text-success">Active</span>
          </div>
        )}
      </div>

      {isConfigured && !editing ? (
        <div className="space-y-4">
          <div className="p-3 bg-background rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Jira Base URL</span>
              <span className="text-text-primary font-mono">{jiraBaseUrl}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Credentials</span>
              <span className="text-text-primary">Configured</span>
            </div>
          </div>

          {testResult && (
            <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
              testResult === 'success'
                ? 'bg-green-50 dark:bg-green-900/40 border border-green-300 dark:border-green-600'
                : 'bg-red-50 dark:bg-red-900/40 border border-red-300 dark:border-red-600'
            }`}>
              {testResult === 'success' ? (
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <span className="text-black dark:text-white">
                {testResult === 'success' ? 'Connection successful!' : 'Connection failed. Check your credentials.'}
              </span>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleTestConnection} disabled={testing}>
              {testing ? 'Testing...' : 'Test Connection'}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(true)}>
              Edit
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            Enter your Xray Cloud API credentials. You can find these in Xray Settings → API Keys.
          </p>
          <Input
            label="Xray Client ID"
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            placeholder="Enter Client ID"
          />
          <Input
            label="Xray Client Secret"
            type="password"
            value={clientSecret}
            onChange={e => setClientSecret(e.target.value)}
            placeholder="Enter Client Secret"
          />
          <Input
            label="Jira Base URL"
            value={baseUrl}
            onChange={e => setBaseUrl(e.target.value)}
            placeholder="https://your-domain.atlassian.net"
          />
          {error && <p className="text-sm text-error">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={loading}>
              {loading ? 'Validating...' : 'Save & Validate'}
            </Button>
            {isConfigured && (
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function ProjectsSection({
  settings,
  onUpdate,
  draftCounts,
}: {
  settings: import('../../../types').Settings | null;
  onUpdate: () => void;
  draftCounts: Record<string, number>;
}) {
  const [newProject, setNewProject] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleAddProject = async () => {
    if (!newProject.trim()) return;

    setLoading(true);
    try {
      await settingsApi.addProject(newProject.trim());
      setNewProject('');
      onUpdate();
    } catch (err) {
      console.error('Failed to add project:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVisibility = async (projectKey: string, isCurrentlyHidden: boolean) => {
    try {
      if (isCurrentlyHidden) {
        await settingsApi.unhideProject(projectKey);
      } else {
        await settingsApi.hideProject(projectKey);
      }
      onUpdate();
    } catch (err) {
      console.error('Failed to toggle project visibility:', err);
    }
  };

  const handleDeleteProject = async () => {
    if (!deleteTarget) return;
    try {
      await settingsApi.removeProject(deleteTarget);
      onUpdate();
      setDeleteTarget(null);
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  const visibleProjects = settings?.projects.filter(p => !settings.hiddenProjects.includes(p)) || [];
  const hiddenProjects = settings?.projects.filter(p => settings.hiddenProjects.includes(p)) || [];

  return (
    <Card>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Projects</h2>
          <p className="text-sm text-text-muted">
            {settings?.projects.length || 0} project{(settings?.projects.length || 0) !== 1 ? 's' : ''} configured
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Add Project */}
        <div className="flex gap-2">
          <Input
            placeholder="Project key (e.g., PROJ)"
            value={newProject}
            onChange={e => setNewProject(e.target.value.toUpperCase())}
            className="flex-1"
            onKeyDown={e => e.key === 'Enter' && handleAddProject()}
          />
          <Button onClick={handleAddProject} disabled={loading || !newProject.trim()}>
            Add
          </Button>
        </div>

        {/* Visible Projects */}
        {visibleProjects.length > 0 && (
          <div className="space-y-2">
            {visibleProjects.map((project: string) => (
              <ProjectRow
                key={project}
                project={project}
                isHidden={false}
                draftCount={draftCounts[project] || 0}
                onToggleVisibility={() => handleToggleVisibility(project, false)}
                onDelete={() => setDeleteTarget(project)}
              />
            ))}
          </div>
        )}

        {/* Hidden Projects */}
        {hiddenProjects.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-text-muted uppercase tracking-wider pt-2">Hidden</p>
            {hiddenProjects.map((project: string) => (
              <ProjectRow
                key={project}
                project={project}
                isHidden={true}
                draftCount={draftCounts[project] || 0}
                onToggleVisibility={() => handleToggleVisibility(project, true)}
                onDelete={() => setDeleteTarget(project)}
              />
            ))}
          </div>
        )}

        {(!settings?.projects || settings.projects.length === 0) && (
          <p className="text-text-muted text-center py-4">
            No projects yet. Add your first project above.
          </p>
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Remove Project"
        message={`Are you sure you want to remove "${deleteTarget}" from your projects?`}
        warning={
          (draftCounts[deleteTarget || ''] || 0) > 0
            ? `${draftCounts[deleteTarget || '']} test case${draftCounts[deleteTarget || ''] !== 1 ? 's' : ''} will be kept. Re-add the project to access them again.`
            : undefined
        }
        confirmLabel="Remove"
        variant="danger"
        onConfirm={handleDeleteProject}
        onCancel={() => setDeleteTarget(null)}
      />
    </Card>
  );
}

function ProjectRow({
  project,
  isHidden,
  draftCount,
  onToggleVisibility,
  onDelete,
}: {
  project: string;
  isHidden: boolean;
  draftCount: number;
  onToggleVisibility: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-lg ${
      isHidden ? 'bg-background/50' : 'bg-background'
    }`}>
      <div className="flex items-center gap-3">
        <span className={`font-mono ${isHidden ? 'text-text-muted' : 'text-text-primary'}`}>
          {project}
        </span>
        {draftCount > 0 && (
          <span className="text-xs text-text-muted bg-sidebar px-2 py-0.5 rounded-full">
            {draftCount} test case{draftCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onToggleVisibility}
          className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-sidebar-hover transition-colors"
          title={isHidden ? 'Show project' : 'Hide project'}
        >
          {isHidden ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          )}
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
          title="Remove project"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}

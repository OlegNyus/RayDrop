import { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { useTheme } from '../../../context/ThemeContext';
import { Card, Button, Input } from '../../ui';
import { configApi, settingsApi } from '../../../services/api';

export function SettingsPage() {
  const { config, isConfigured, refreshConfig, settings, refreshSettings } = useApp();

  return (
    <div className="space-y-6 max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-text-primary">Settings</h1>

      <XrayConfigSection
        isConfigured={isConfigured}
        jiraBaseUrl={config?.jiraBaseUrl}
        onSave={refreshConfig}
      />

      <AppearanceSection />

      <ProjectsSection settings={settings} onUpdate={refreshSettings} />
    </div>
  );
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
  const [error, setError] = useState('');

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

  return (
    <Card>
      <h2 className="text-lg font-semibold text-text-primary mb-4">Xray Configuration</h2>

      {isConfigured && !editing ? (
        <div className="space-y-4">
          <div>
            <p className="text-sm text-text-secondary">Status</p>
            <p className="text-text-primary">Connected</p>
          </div>
          <div>
            <p className="text-sm text-text-secondary">Jira Base URL</p>
            <p className="text-text-primary">{jiraBaseUrl}</p>
          </div>
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Edit Configuration
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
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
              {loading ? 'Saving...' : 'Save & Validate'}
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

function AppearanceSection() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Card>
      <h2 className="text-lg font-semibold text-text-primary mb-4">Appearance</h2>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-text-primary">Theme</p>
          <p className="text-sm text-text-secondary">
            {theme === 'dark' ? 'Dark mode is enabled' : 'Light mode is enabled'}
          </p>
        </div>
        <button
          onClick={toggleTheme}
          className={`relative w-14 h-7 rounded-full transition-colors ${
            theme === 'dark' ? 'bg-accent' : 'bg-input-border'
          }`}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <span
            className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              theme === 'dark' ? 'translate-x-8' : 'translate-x-1'
            }`}
          />
          <span className="absolute inset-0 flex items-center justify-between px-1.5">
            <svg className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-white/50' : 'text-yellow-500'}`} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
            </svg>
            <svg className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-white' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>
          </span>
        </button>
      </div>
    </Card>
  );
}

function ProjectsSection({
  settings,
  onUpdate,
}: {
  settings: import('../../../types').Settings | null;
  onUpdate: () => void;
}) {
  const [newProject, setNewProject] = useState('');
  const [loading, setLoading] = useState(false);

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

  const handleHideProject = async (projectKey: string) => {
    try {
      await settingsApi.hideProject(projectKey);
      onUpdate();
    } catch (err) {
      console.error('Failed to hide project:', err);
    }
  };

  return (
    <Card>
      <h2 className="text-lg font-semibold text-text-primary mb-4">Projects</h2>

      <div className="space-y-4">
        {/* Add Project */}
        <div className="flex gap-2">
          <Input
            placeholder="Project key (e.g., PROJ)"
            value={newProject}
            onChange={e => setNewProject(e.target.value.toUpperCase())}
            className="flex-1"
          />
          <Button onClick={handleAddProject} disabled={loading || !newProject.trim()}>
            Add
          </Button>
        </div>

        {/* Project List */}
        <div className="space-y-2">
          {settings?.projects.map((project: string) => {
            const isHidden = settings.hiddenProjects.includes(project);
            const color = settings.projectSettings[project]?.color;

            return (
              <div
                key={project}
                className="flex items-center justify-between p-3 bg-background rounded-lg"
              >
                <div className="flex items-center gap-2">
                  {color && (
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  )}
                  <span className={isHidden ? 'text-text-muted' : 'text-text-primary'}>
                    {project}
                  </span>
                  {isHidden && (
                    <span className="text-xs text-text-muted">(hidden)</span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleHideProject(project)}
                >
                  {isHidden ? 'Show' : 'Hide'}
                </Button>
              </div>
            );
          })}

          {(!settings?.projects || settings.projects.length === 0) && (
            <p className="text-text-muted text-center py-4">
              No projects yet. Add your first project above.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

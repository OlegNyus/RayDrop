import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../ui';
import type { NavItem } from '../../types';

const mainNavItems: { id: NavItem; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'test-cases', label: 'Test Cases', icon: '📋' },
  { id: 'create', label: 'Create Test Case', icon: '➕' },
];

const xrayNavItems: { id: NavItem; label: string; icon: string }[] = [
  { id: 'test-sets', label: 'Test Sets', icon: '📁' },
  { id: 'test-plans', label: 'Test Plans', icon: '📅' },
  { id: 'test-executions', label: 'Test Executions', icon: '▶️' },
  { id: 'preconditions', label: 'Preconditions', icon: '⚡' },
];

// Truncate credential for display (first 6...last 6)
function truncateCredential(value: string): string {
  if (!value || value.length <= 12) return value || '';
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

export function Sidebar() {
  const { activeNav, setActiveNav, settings, activeProject, setActiveProject, isConfigured, config, onReconfigure } = useApp();
  const { theme, toggleTheme } = useTheme();
  const [showConfigModal, setShowConfigModal] = useState(false);

  const visibleProjects = settings?.projects.filter(
    p => !settings.hiddenProjects.includes(p)
  ) || [];

  return (
    <aside className="w-64 h-screen bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <h1 className="text-xl font-bold text-text-primary">RayDrop</h1>
        <p className="text-xs text-text-muted mt-1">Xray Test Case Manager</p>
      </div>

      {/* Project Selector */}
      {visibleProjects.length > 0 && (
        <div className="p-3 border-b border-sidebar-border">
          <select
            value={activeProject || ''}
            onChange={e => setActiveProject(e.target.value)}
            className="w-full px-3 py-2 bg-input-bg border border-input-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {visibleProjects.map(project => (
              <option key={project} value={project}>
                {project}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Main Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="mb-4">
          {mainNavItems.map(item => (
            <NavButton
              key={item.id}
              item={item}
              isActive={activeNav === item.id}
              onClick={() => setActiveNav(item.id)}
            />
          ))}
        </div>

        <div className="pt-4 border-t border-sidebar-border">
          <p className="px-3 py-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
            Xray Entities
          </p>
          {xrayNavItems.map(item => (
            <NavButton
              key={item.id}
              item={item}
              isActive={activeNav === item.id}
              onClick={() => setActiveNav(item.id)}
            />
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        {/* Connection Status */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${isConfigured ? 'bg-success' : 'bg-text-muted'}`}
              title={isConfigured ? 'Connected to Xray' : 'Not configured'}
            />
            <span className="text-xs text-text-secondary hidden sm:inline">
              {isConfigured ? 'Connected to Xray' : 'Not configured'}
            </span>
          </div>
          {isConfigured && (
            <button
              onClick={() => setShowConfigModal(true)}
              className="p-1 text-text-muted hover:text-text-primary rounded transition-colors"
              title="View configuration"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}
        </div>

        <NavButton
          item={{ id: 'settings', label: 'Settings', icon: '⚙️' }}
          isActive={activeNav === 'settings'}
          onClick={() => setActiveNav('settings')}
        />
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-text-secondary hover:bg-sidebar-hover rounded-lg transition-colors"
        >
          <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
      </div>

      {/* Configuration Modal */}
      {showConfigModal && (
        <ConfigModal
          config={config}
          onClose={() => setShowConfigModal(false)}
          onEdit={() => {
            setShowConfigModal(false);
            onReconfigure?.();
          }}
        />
      )}
    </aside>
  );
}

// Configuration Modal Component
function ConfigModal({
  config,
  onClose,
  onEdit,
}: {
  config: { jiraBaseUrl?: string } | null;
  onClose: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-md mx-4">
        {/* Header */}
        <div className="p-4 border-b border-border text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-accent/10 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-text-primary">Configuration</h2>
          <p className="text-sm text-text-secondary">Your current Xray Cloud settings</p>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-text-secondary">Client ID</span>
            <span className="text-sm text-text-primary font-mono">
              {truncateCredential('(hidden)')}
            </span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-text-secondary">Client Secret</span>
            <span className="text-sm text-text-primary font-mono">
              {truncateCredential('(hidden)')}
            </span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-text-secondary">Jira Base URL</span>
            <span className="text-sm text-text-primary truncate max-w-[200px]">
              {config?.jiraBaseUrl || '(not set)'}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-border flex gap-3">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Close
          </Button>
          <Button onClick={onEdit} className="flex-1">
            Edit
          </Button>
        </div>
      </div>
    </div>
  );
}

function NavButton({
  item,
  isActive,
  onClick,
}: {
  item: { id: string; label: string; icon: string };
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
        isActive
          ? 'bg-accent text-white'
          : 'text-text-secondary hover:bg-sidebar-hover hover:text-text-primary'
      }`}
    >
      <span>{item.icon}</span>
      <span>{item.label}</span>
    </button>
  );
}

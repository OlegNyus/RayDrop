import { useApp } from '../../context/AppContext';
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

export function Sidebar() {
  const { activeNav, setActiveNav, settings, activeProject, setActiveProject, isConfigured } = useApp();

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
        <NavButton
          item={{ id: 'settings', label: 'Settings', icon: '⚙️' }}
          isActive={activeNav === 'settings'}
          onClick={() => setActiveNav('settings')}
        />
        <div className="flex items-center gap-2 px-3 py-2">
          <span
            className={`w-2 h-2 rounded-full ${isConfigured ? 'bg-success' : 'bg-warning'}`}
            title={isConfigured ? 'Connected' : 'Not configured'}
          />
          <span className="text-xs text-text-muted">
            {isConfigured ? 'Connected' : 'Not configured'}
          </span>
        </div>
      </div>

    </aside>
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

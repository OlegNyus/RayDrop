import { NavLink, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';

interface NavItemConfig {
  path: string;
  label: string;
  icon: string;
}

const mainNavItems: NavItemConfig[] = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/test-cases', label: 'Test Cases', icon: '📋' },
  { path: '/test-cases/new', label: 'Create Test Case', icon: '➕' },
];

const xrayNavItems: NavItemConfig[] = [
  { path: '/test-sets', label: 'Test Sets', icon: '📁' },
  { path: '/test-plans', label: 'Test Plans', icon: '📅' },
  { path: '/test-executions', label: 'Test Executions', icon: '▶️' },
  { path: '/preconditions', label: 'Preconditions', icon: '⚡' },
];

export function Sidebar() {
  const { settings, activeProject, setActiveProject, isConfigured } = useApp();
  const location = useLocation();

  const visibleProjects = settings?.projects.filter(
    p => !settings.hiddenProjects.includes(p)
  ) || [];

  // Check if we're on an edit page (should not highlight "Create Test Case")
  const isEditPage = location.pathname.includes('/edit');

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
            <SidebarLink
              key={item.path}
              item={item}
              isEditPage={isEditPage}
            />
          ))}
        </div>

        <div className="pt-4 border-t border-sidebar-border">
          <p className="px-3 py-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
            Xray Entities
          </p>
          {xrayNavItems.map(item => (
            <SidebarLink key={item.path} item={item} />
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        <SidebarLink
          item={{ path: '/settings', label: 'Settings', icon: '⚙️' }}
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

function SidebarLink({
  item,
  isEditPage = false,
}: {
  item: NavItemConfig;
  isEditPage?: boolean;
}) {
  const location = useLocation();
  
  // Special handling for "Create Test Case" - don't highlight when on edit page
  const isCreateLink = item.path === '/test-cases/new';
  
  // Custom active check
  const isActive = isCreateLink
    ? location.pathname === item.path && !isEditPage
    : location.pathname === item.path || 
      (item.path === '/test-cases' && location.pathname.startsWith('/test-cases') && 
       !location.pathname.includes('/new') && !location.pathname.includes('/edit'));

  return (
    <NavLink
      to={item.path}
      className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
        isActive
          ? 'bg-accent text-white'
          : 'text-text-secondary hover:bg-sidebar-hover hover:text-text-primary'
      }`}
    >
      <span>{item.icon}</span>
      <span>{item.label}</span>
    </NavLink>
  );
}

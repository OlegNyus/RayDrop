import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { ProjectSelector } from '../ui';
import { draftsApi } from '../../services/api';
import { SIDEBAR_BADGE_COLORS } from '../../constants/colors';
import type { Draft } from '../../types';

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

const reviewNavItems: NavItemConfig[] = [
  { path: '/tc-review', label: 'TC Review', icon: '🔍' },
];

const xrayNavItems: NavItemConfig[] = [
  { path: '/test-sets', label: 'Test Sets', icon: '📁' },
  { path: '/test-plans', label: 'Test Plans', icon: '📅' },
  { path: '/test-executions', label: 'Test Executions', icon: '▶️' },
  { path: '/preconditions', label: 'Preconditions', icon: '⚡' },
];

export function Sidebar() {
  const { settings, activeProject, setActiveProject, isConfigured, reviewCounts } = useApp();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [draftCounts, setDraftCounts] = useState<Record<string, number>>({});

  const visibleProjects = settings?.projects.filter(
    p => !settings.hiddenProjects.includes(p)
  ) || [];

  // Extract project colors from settings
  const projectColors: Record<string, string | undefined> = {};
  if (settings?.projectSettings) {
    Object.entries(settings.projectSettings).forEach(([key, value]) => {
      projectColors[key] = value?.color;
    });
  }

  // Check if we're on an edit page (should not highlight "Create Test Case")
  const isEditPage = location.pathname.includes('/edit');

  // Fetch all drafts for counts
  useEffect(() => {
    const loadDraftCounts = async () => {
      try {
        const allDrafts = await draftsApi.list();
        const counts: Record<string, number> = {};
        allDrafts.forEach((d: Draft) => {
          counts[d.projectKey] = (counts[d.projectKey] || 0) + 1;
        });
        setDraftCounts(counts);
      } catch (err) {
        console.error('Failed to load draft counts:', err);
      }
    };
    loadDraftCounts();
  }, [activeProject]); // Refresh when project changes

  return (
    <aside className="w-64 h-screen bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <svg className="w-8 h-8 flex-shrink-0" viewBox="0 0 64 64" fill="none">
            {/* Rays */}
            <g opacity="0.9">
              <path d="M32 8L30 2L34 2Z" fill="#fbbf24"/>
              <path d="M44 16L50 10L48 14Z" fill="#f97316"/>
              <path d="M50 26L58 22L54 28Z" fill="#ef4444"/>
              <path d="M20 16L14 10L16 14Z" fill="#a855f7"/>
              <path d="M14 26L6 22L10 28Z" fill="#6366f1"/>
            </g>
            {/* Droplet */}
            <path d="M32 12C32 12 16 30 16 42C16 50.837 23.163 58 32 58C40.837 58 48 50.837 48 42C48 30 32 12 32 12Z" fill="url(#sidebarGradient)"/>
            <path d="M32 16C32 16 20 32 20 42C20 48.627 25.373 54 32 54C38.627 54 44 48.627 44 42C44 32 32 16 32 16Z" fill="url(#sidebarGlow)" opacity="0.6"/>
            {/* Shine */}
            <ellipse cx="24" cy="36" rx="4" ry="6" fill="white" opacity="0.4"/>
            <circle cx="23" cy="33" r="2" fill="white" opacity="0.6"/>
            {/* Face */}
            <ellipse cx="26" cy="42" rx="3" ry="3.5" fill="#1e293b"/>
            <ellipse cx="38" cy="42" rx="3" ry="3.5" fill="#1e293b"/>
            <circle cx="27" cy="41" r="1.2" fill="white"/>
            <circle cx="39" cy="41" r="1.2" fill="white"/>
            <path d="M28 48Q32 52 36 48" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" fill="none"/>
            <defs>
              <linearGradient id="sidebarGradient" x1="16" y1="12" x2="48" y2="58" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#22d3ee"/>
                <stop offset="50%" stopColor="#818cf8"/>
                <stop offset="100%" stopColor="#c084fc"/>
              </linearGradient>
              <radialGradient id="sidebarGlow" cx="32" cy="35" r="20" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#ffffff"/>
                <stop offset="100%" stopColor="#818cf8" stopOpacity="0"/>
              </radialGradient>
            </defs>
          </svg>
          <h1 className="text-xl font-bold text-text-primary">RayDrop</h1>
        </div>
        <p className="text-xs text-text-muted mt-1">Xray Test Case Manager</p>
      </div>

      {/* Project Selector */}
      {visibleProjects.length > 0 && (
        <div className="p-3 border-b border-sidebar-border">
          <ProjectSelector
            projects={visibleProjects}
            activeProject={activeProject}
            onSelect={setActiveProject}
            draftCounts={draftCounts}
            projectColors={projectColors}
          />
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

        <div className="pt-4 border-t border-sidebar-border">
          <p className="px-3 py-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
            Test Review
          </p>
          <TCReviewLink reviewCounts={reviewCounts} />
        </div>
      </nav>

      {/* Footer - Compact icon row */}
      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center justify-between">
          {/* Settings */}
          <button
            onClick={() => navigate('/settings')}
            className={`p-2 rounded-lg transition-colors ${
              location.pathname === '/settings'
                ? 'bg-accent text-white'
                : 'text-text-secondary hover:bg-sidebar-hover hover:text-text-primary'
            }`}
            title="Settings"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          {/* Connection Status */}
          <div
            className="p-2 flex items-center gap-2"
            title={isConfigured ? 'Connected to Xray' : 'Not configured'}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${isConfigured ? 'bg-success' : 'bg-warning'}`}
            />
            <span className="text-xs text-text-muted">
              {isConfigured ? 'Connected' : 'Offline'}
            </span>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-text-secondary hover:bg-sidebar-hover hover:text-text-primary transition-colors"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
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

function TCReviewLink({
  reviewCounts,
}: {
  reviewCounts: { underReview: number; xrayDraft: number };
}) {
  const location = useLocation();
  const isActive = location.pathname === '/tc-review';

  return (
    <NavLink
      to="/tc-review"
      className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
        isActive
          ? 'bg-accent text-white'
          : 'text-text-secondary hover:bg-sidebar-hover hover:text-text-primary'
      }`}
    >
      <span>🔍</span>
      <span className="flex-1">TC Review</span>
      {(reviewCounts.underReview > 0 || reviewCounts.xrayDraft > 0) && (
        <div className="flex items-center gap-1">
          {reviewCounts.underReview > 0 && (
            <span
              className={`px-1.5 py-0.5 text-xs font-medium rounded-full ${SIDEBAR_BADGE_COLORS.underReview.bg} ${SIDEBAR_BADGE_COLORS.underReview.text}`}
              title="Under Review"
            >
              {reviewCounts.underReview}
            </span>
          )}
          {reviewCounts.xrayDraft > 0 && (
            <span
              className={`px-1.5 py-0.5 text-xs font-medium rounded-full ${SIDEBAR_BADGE_COLORS.xrayDraft.bg} ${SIDEBAR_BADGE_COLORS.xrayDraft.text}`}
              title="Draft"
            >
              {reviewCounts.xrayDraft}
            </span>
          )}
        </div>
      )}
    </NavLink>
  );
}

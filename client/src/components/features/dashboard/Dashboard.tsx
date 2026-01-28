import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import { Card, StatusBadge, TestKeyLink } from '../../ui';

// Status configuration with colors, icons, and descriptions
const STATUS_CONFIG = {
  new: {
    label: 'New',
    color: '#3B82F6',
    bgClass: 'bg-blue-500',
    lightBg: 'bg-blue-500/10',
    hoverBg: 'hover:bg-blue-500/20',
    description: 'Just created',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    ),
  },
  draft: {
    label: 'Draft',
    color: '#F59E0B',
    bgClass: 'bg-amber-500',
    lightBg: 'bg-amber-500/10',
    hoverBg: 'hover:bg-amber-500/20',
    description: 'Work in progress',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  ready: {
    label: 'Ready',
    color: '#22C55E',
    bgClass: 'bg-green-500',
    lightBg: 'bg-green-500/10',
    hoverBg: 'hover:bg-green-500/20',
    description: 'Ready to import',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  imported: {
    label: 'Imported',
    color: '#059669',
    bgClass: 'bg-emerald-600',
    lightBg: 'bg-emerald-600/10',
    hoverBg: 'hover:bg-emerald-600/20',
    description: 'In Xray',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    ),
  },
} as const;

export function Dashboard() {
  const navigate = useNavigate();
  const { drafts, activeProject, settings } = useApp();

  const stats = {
    new: drafts.filter(d => d.status === 'new').length,
    draft: drafts.filter(d => d.status === 'draft').length,
    ready: drafts.filter(d => d.status === 'ready').length,
    imported: drafts.filter(d => d.status === 'imported').length,
  };

  const total = drafts.length;
  const recentDrafts = drafts.slice(0, 5);
  const projectColor = activeProject
    ? settings?.projectSettings[activeProject]?.color
    : undefined;

  // Calculate workflow progress (imported / total)
  const progressPercent = total > 0 ? Math.round((stats.imported / total) * 100) : 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
          {activeProject && (
            <div className="flex items-center gap-2 mt-1">
              {projectColor && (
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: projectColor }} />
              )}
              <span className="text-text-secondary">{activeProject}</span>
            </div>
          )}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Donut Chart */}
        <Card className="flex flex-col items-center justify-center py-6">
          <DonutChart stats={stats} total={total} />
          <p className="text-sm text-text-muted mt-4">Status Distribution</p>
        </Card>

        {/* Status Cards */}
        <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4 content-start">
          {(Object.keys(STATUS_CONFIG) as Array<keyof typeof STATUS_CONFIG>).map(status => (
            <StatusCard
              key={status}
              value={stats[status]}
              total={total}
              config={STATUS_CONFIG[status]}
              onClick={() => navigate(`/test-cases?status=${status}`)}
            />
          ))}
        </div>
      </div>

      {/* Workflow Progress */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-text-primary">Import Progress</h3>
          <span className="text-sm text-text-muted">{stats.imported} of {total} imported</span>
        </div>
        <div className="h-3 bg-sidebar rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-600 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-text-muted">
          <span>0%</span>
          <span className="text-emerald-600 font-medium">{progressPercent}% Complete</span>
          <span>100%</span>
        </div>
      </Card>

      {/* Recent Test Cases */}
      <Card>
        <h2 className="text-lg font-semibold text-text-primary mb-4">Recent Test Cases</h2>
        {recentDrafts.length === 0 ? (
          <p className="text-text-muted text-center py-8">
            No test cases yet. Create your first one!
          </p>
        ) : (
          <div className="space-y-2">
            {recentDrafts.map(draft => (
              <div
                key={draft.id}
                onClick={() => navigate(`/test-cases/${draft.id}/edit`)}
                className="flex items-center justify-between p-3 bg-background rounded-lg hover:bg-sidebar-hover cursor-pointer transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {draft.summary || 'Untitled'}
                    </p>
                    {draft.testKey && <TestKeyLink testKey={draft.testKey} />}
                  </div>
                  <p className="text-xs text-text-muted">
                    {new Date(draft.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <StatusBadge status={draft.status} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// Interactive status card with improved UX
function StatusCard({
  value,
  total,
  config,
  onClick,
}: {
  value: number;
  total: number;
  config: {
    label: string;
    color: string;
    bgClass: string;
    lightBg: string;
    hoverBg: string;
    description: string;
    icon: React.ReactNode;
  };
  onClick: () => void;
}) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
  const hasItems = value > 0;

  return (
    <button
      onClick={onClick}
      className={`relative w-full text-left rounded-xl border border-border bg-card px-3 py-2.5 transition-all duration-200
        hover:shadow-lg hover:scale-[1.02] hover:border-transparent
        ${config.hoverBg} group cursor-pointer`}
      style={{
        boxShadow: hasItems ? `0 0 0 1px ${config.color}20` : undefined,
      }}
    >
      {/* Colored accent line */}
      <div
        className={`absolute top-0 left-0 w-1 h-full rounded-l-xl transition-all duration-200 group-hover:w-1.5`}
        style={{ backgroundColor: config.color }}
      />

      {/* Icon badge */}
      <div
        className={`absolute top-2 right-2 p-1 rounded-lg ${config.lightBg} transition-transform duration-200 group-hover:scale-110`}
        style={{ color: config.color }}
      >
        {config.icon}
      </div>

      {/* Content */}
      <div className="pl-2">
        <p
          className="text-2xl font-bold transition-colors duration-200"
          style={{ color: hasItems ? config.color : undefined }}
        >
          {value}
        </p>
        <p className="text-sm font-medium text-text-primary">{config.label}</p>

        {/* Percentage bar */}
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1 bg-sidebar rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${percentage}%`,
                backgroundColor: config.color,
              }}
            />
          </div>
          <span className="text-xs text-text-muted min-w-[28px] text-right">{percentage}%</span>
        </div>
      </div>
    </button>
  );
}

// Simple SVG Donut Chart
function DonutChart({
  stats,
  total,
}: {
  stats: { new: number; draft: number; ready: number; imported: number };
  total: number;
}) {
  const size = 140;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // If no data, show empty state
  if (total === 0) {
    return (
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-sidebar"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-text-primary">0</span>
          <span className="text-xs text-text-muted">Total</span>
        </div>
      </div>
    );
  }

  // Calculate segments
  const segments = [
    { key: 'new', value: stats.new, color: STATUS_CONFIG.new.color },
    { key: 'draft', value: stats.draft, color: STATUS_CONFIG.draft.color },
    { key: 'ready', value: stats.ready, color: STATUS_CONFIG.ready.color },
    { key: 'imported', value: stats.imported, color: STATUS_CONFIG.imported.color },
  ].filter(s => s.value > 0);

  let currentOffset = 0;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {segments.map(segment => {
          const percent = segment.value / total;
          const strokeDasharray = `${percent * circumference} ${circumference}`;
          const strokeDashoffset = -currentOffset * circumference;
          currentOffset += percent;

          return (
            <circle
              key={segment.key}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-text-primary">{total}</span>
        <span className="text-xs text-text-muted">Total</span>
      </div>
    </div>
  );
}

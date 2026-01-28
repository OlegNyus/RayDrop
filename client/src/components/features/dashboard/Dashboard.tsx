import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import { Card, StatusBadge, TestKeyLink } from '../../ui';

// Status configuration with colors matching StatusBadge
const STATUS_CONFIG = {
  new: { label: 'New', color: '#3B82F6', bgClass: 'bg-blue-500' },
  draft: { label: 'Draft', color: '#F59E0B', bgClass: 'bg-amber-500' },
  ready: { label: 'Ready', color: '#22C55E', bgClass: 'bg-green-500' },
  imported: { label: 'Imported', color: '#059669', bgClass: 'bg-emerald-600' },
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Donut Chart */}
        <Card className="flex flex-col items-center justify-center py-6">
          <DonutChart stats={stats} total={total} />
          <p className="text-sm text-text-muted mt-4">Status Distribution</p>
        </Card>

        {/* Status Cards */}
        <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
          {(Object.keys(STATUS_CONFIG) as Array<keyof typeof STATUS_CONFIG>).map(status => (
            <StatusCard
              key={status}
              value={stats[status]}
              config={STATUS_CONFIG[status]}
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

// Color-coded status card
function StatusCard({
  value,
  config,
}: {
  value: number;
  config: { label: string; color: string; bgClass: string };
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className={`absolute top-0 left-0 w-1 h-full ${config.bgClass}`} />
      <div className="pl-3">
        <p className="text-2xl font-bold text-text-primary">{value}</p>
        <p className="text-sm text-text-secondary">{config.label}</p>
      </div>
    </Card>
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

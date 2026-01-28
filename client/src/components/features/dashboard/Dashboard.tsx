import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import { Card, StatusBadge, TestKeyLink } from '../../ui';

export function Dashboard() {
  const navigate = useNavigate();
  const { drafts, activeProject, settings } = useApp();

  const stats = {
    total: drafts.length,
    new: drafts.filter(d => d.status === 'new').length,
    draft: drafts.filter(d => d.status === 'draft').length,
    ready: drafts.filter(d => d.status === 'ready').length,
  };

  const recentDrafts = drafts.slice(0, 5);
  const projectColor = activeProject
    ? settings?.projectSettings[activeProject]?.color
    : undefined;

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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Test Cases" value={stats.total} />
        <StatCard label="New" value={stats.new} />
        <StatCard label="Draft" value={stats.draft} />
        <StatCard label="Ready" value={stats.ready} />
      </div>

      {/* Recent Drafts */}
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

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="text-center">
      <p className="text-3xl font-bold text-text-primary">{value}</p>
      <p className="text-sm text-text-secondary mt-1">{label}</p>
    </Card>
  );
}

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import { xrayApi } from '../../../services/api';
import { Card, Input } from '../../ui';
import type { TestWithDetails } from '../../../types';

type SortOption = 'created-desc' | 'created-asc' | 'priority' | 'key';
type PriorityFilter = 'all' | 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest';

const PRIORITY_COLORS: Record<string, string> = {
  Highest: '#DC2626', // red-600
  High: '#EA580C',    // orange-600
  Medium: '#F59E0B',  // amber-500
  Low: '#22C55E',     // green-500
  Lowest: '#6B7280',  // gray-500
};

const PRIORITY_ORDER: Record<string, number> = {
  Highest: 0,
  High: 1,
  Medium: 2,
  Low: 3,
  Lowest: 4,
};

export function TCReviewPage() {
  const { activeProject, isConfigured, config } = useApp();
  const navigate = useNavigate();
  const [tests, setTests] = useState<TestWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('created-desc');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');

  const jiraBaseUrl = config?.jiraBaseUrl;

  // Fetch tests under review when project changes
  useEffect(() => {
    if (!activeProject || !isConfigured) {
      setTests([]);
      return;
    }

    const fetchTests = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await xrayApi.getTestsByStatus(activeProject, 'Under Review');
        setTests(data);
      } catch (err) {
        console.error('Failed to fetch tests under review:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchTests();
  }, [activeProject, isConfigured]);

  // Priority stats
  const priorityStats = useMemo(() => {
    const stats: Record<string, number> = {
      total: tests.length,
      Highest: 0,
      High: 0,
      Medium: 0,
      Low: 0,
      Lowest: 0,
    };
    tests.forEach(t => {
      if (stats[t.priority] !== undefined) {
        stats[t.priority]++;
      }
    });
    return stats;
  }, [tests]);

  // Filter and sort tests
  const filteredAndSortedTests = useMemo(() => {
    let result = [...tests];

    // Apply priority filter
    if (priorityFilter !== 'all') {
      result = result.filter(t => t.priority === priorityFilter);
    }

    // Apply search filter
    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(
        t => t.key.toLowerCase().includes(lower) || t.summary.toLowerCase().includes(lower)
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'created-desc':
          return new Date(b.created).getTime() - new Date(a.created).getTime();
        case 'created-asc':
          return new Date(a.created).getTime() - new Date(b.created).getTime();
        case 'priority':
          return (PRIORITY_ORDER[a.priority] ?? 5) - (PRIORITY_ORDER[b.priority] ?? 5);
        case 'key':
          return a.key.localeCompare(b.key);
        default:
          return 0;
      }
    });

    return result;
  }, [tests, search, sortBy, priorityFilter]);

  const handleRefresh = async () => {
    if (!activeProject || !isConfigured) return;

    setLoading(true);
    setError(null);
    try {
      const data = await xrayApi.getTestsByStatus(activeProject, 'Under Review');
      setTests(data);
    } catch (err) {
      console.error('Failed to fetch tests under review:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Not configured state
  if (!isConfigured) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto px-4 py-6">
        <Header count={0} />
        <Card className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-warning/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-text-primary mb-2">Xray Not Connected</h3>
          <p className="text-text-muted mb-4">
            Connect to Xray in Settings to view tests under review.
          </p>
        </Card>
      </div>
    );
  }

  // No project selected state
  if (!activeProject) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto px-4 py-6">
        <Header count={0} />
        <Card className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-text-primary mb-2">No Project Selected</h3>
          <p className="text-text-muted">
            Select a project from the sidebar to view tests under review.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <Header count={loading ? undefined : tests.length} />

      {/* Stats Cards */}
      {!loading && tests.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          <StatCard
            label="Total"
            value={priorityStats.total}
            color="#3B82F6"
            isActive={priorityFilter === 'all'}
            onClick={() => setPriorityFilter('all')}
          />
          <StatCard
            label="Highest"
            value={priorityStats.Highest}
            color={PRIORITY_COLORS.Highest}
            isActive={priorityFilter === 'Highest'}
            onClick={() => setPriorityFilter(priorityFilter === 'Highest' ? 'all' : 'Highest')}
          />
          <StatCard
            label="High"
            value={priorityStats.High}
            color={PRIORITY_COLORS.High}
            isActive={priorityFilter === 'High'}
            onClick={() => setPriorityFilter(priorityFilter === 'High' ? 'all' : 'High')}
          />
          <StatCard
            label="Medium"
            value={priorityStats.Medium}
            color={PRIORITY_COLORS.Medium}
            isActive={priorityFilter === 'Medium'}
            onClick={() => setPriorityFilter(priorityFilter === 'Medium' ? 'all' : 'Medium')}
          />
          <StatCard
            label="Low"
            value={priorityStats.Low + priorityStats.Lowest}
            color={PRIORITY_COLORS.Low}
            isActive={priorityFilter === 'Low' || priorityFilter === 'Lowest'}
            onClick={() => setPriorityFilter(priorityFilter === 'Low' ? 'all' : 'Low')}
          />
        </div>
      )}

      {/* Search and Actions Bar */}
      <Card padding="sm">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1">
            <Input
              placeholder="Search by key or summary..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortOption)}
              className="px-3 py-2 rounded-lg border border-border bg-card text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              <option value="created-desc">Newest First</option>
              <option value="created-asc">Oldest First</option>
              <option value="priority">By Priority</option>
              <option value="key">By Key</option>
            </select>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-2 rounded-lg text-text-secondary hover:bg-sidebar-hover hover:text-text-primary transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <svg
                className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </Card>

      {/* Error State */}
      {error && (
        <Card className="border-error/50 bg-error/5">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-error flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm text-error">{error}</p>
            </div>
            <button
              onClick={handleRefresh}
              className="text-sm text-error hover:underline"
            >
              Retry
            </button>
          </div>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <div className="grid gap-3">
          {[...Array(5)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredAndSortedTests.length === 0 && (
        <Card className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          {tests.length === 0 ? (
            <>
              <h3 className="text-lg font-medium text-text-primary mb-2">No Tests Under Review</h3>
              <p className="text-text-muted">
                There are no tests with "Under Review" status in project {activeProject}.
              </p>
            </>
          ) : (
            <>
              <h3 className="text-lg font-medium text-text-primary mb-2">No Results</h3>
              <p className="text-text-muted">
                No tests match your search or filter criteria.
              </p>
            </>
          )}
        </Card>
      )}

      {/* Test List */}
      {!loading && !error && filteredAndSortedTests.length > 0 && (
        <div className="grid gap-3">
          {filteredAndSortedTests.map(test => (
            <TestCard
              key={test.issueId}
              test={test}
              jiraBaseUrl={jiraBaseUrl}
              formatDate={formatDate}
              onNavigate={() => navigate(`/xray/test/${test.issueId}`)}
            />
          ))}
        </div>
      )}

      {/* Summary */}
      {!loading && tests.length > 0 && (
        <p className="text-sm text-text-muted text-center">
          {filteredAndSortedTests.length !== tests.length
            ? `Showing ${filteredAndSortedTests.length} of ${tests.length} tests under review`
            : `${tests.length} test${tests.length !== 1 ? 's' : ''} under review in ${activeProject}`}
        </p>
      )}
    </div>
  );
}

// Header component
function Header({ count }: { count?: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/20 text-blue-500">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-text-primary">TC Review</h1>
          {count !== undefined && (
            <span className="px-2 py-0.5 text-sm font-medium rounded-full bg-blue-500/20 text-blue-500">
              {count}
            </span>
          )}
        </div>
        <p className="text-sm text-text-muted">Tests awaiting review</p>
      </div>
    </div>
  );
}

// Stat card component
function StatCard({
  label,
  value,
  color,
  isActive,
  onClick,
}: {
  label: string;
  value: number;
  color: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-lg border transition-all ${
        isActive
          ? 'ring-2 ring-offset-2 ring-offset-card'
          : 'hover:bg-sidebar-hover/50'
      }`}
      style={{
        borderColor: isActive ? color : 'var(--border)',
        backgroundColor: isActive ? `${color}10` : 'var(--card)',
        ...(isActive ? { ['--tw-ring-color' as string]: color } : {}),
      }}
    >
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      <div className="text-xs text-text-muted">{label}</div>
    </button>
  );
}

// Test card component
function TestCard({
  test,
  jiraBaseUrl,
  formatDate,
  onNavigate,
}: {
  test: TestWithDetails;
  jiraBaseUrl?: string;
  formatDate: (dateString: string) => string;
  onNavigate: () => void;
}) {
  const jiraUrl = jiraBaseUrl ? `${jiraBaseUrl}/browse/${test.key}` : null;
  const priorityColor = PRIORITY_COLORS[test.priority] || '#6B7280';

  return (
    <Card padding="none" className="overflow-hidden">
      <button
        onClick={onNavigate}
        className="w-full flex items-start gap-4 p-4 text-left hover:bg-sidebar-hover/50 transition-colors group"
      >
        {/* Priority indicator */}
        <div
          className="w-1 h-full min-h-[60px] rounded-full flex-shrink-0"
          style={{ backgroundColor: priorityColor }}
        />

        {/* Content */}
        <div className="flex-1 min-w-0 py-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-accent group-hover:underline">
              {test.key}
            </span>
            <span
              className="px-2 py-0.5 text-xs font-medium rounded"
              style={{
                backgroundColor: `${priorityColor}20`,
                color: priorityColor,
              }}
            >
              {test.priority}
            </span>
          </div>
          <p className="text-text-primary mt-1 line-clamp-2" title={test.summary}>
            {test.summary}
          </p>

          {/* Metadata row */}
          <div className="flex items-center gap-4 mt-2 text-xs text-text-muted flex-wrap">
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {formatDate(test.created)}
            </span>
            {test.assignee && (
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {test.assignee}
              </span>
            )}
            {test.labels.length > 0 && (
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                {test.labels.slice(0, 2).join(', ')}
                {test.labels.length > 2 && ` +${test.labels.length - 2}`}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {jiraUrl && (
            <a
              href={jiraUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-muted hover:text-text-primary hover:bg-sidebar-hover rounded-lg transition-colors"
              title={`Open ${test.key} in Jira`}
            >
              <span className="hidden sm:inline">Jira</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
          <svg
            className="w-5 h-5 text-text-muted group-hover:text-text-primary transition-colors"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>
    </Card>
  );
}

// Skeleton loading card
function SkeletonCard() {
  return (
    <Card padding="sm">
      <div className="flex items-start gap-4 animate-pulse">
        <div className="w-1 h-16 rounded-full bg-sidebar" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-4 w-20 bg-sidebar rounded" />
            <div className="h-4 w-16 bg-sidebar rounded" />
          </div>
          <div className="h-4 w-3/4 bg-sidebar rounded" />
          <div className="flex items-center gap-4">
            <div className="h-3 w-16 bg-sidebar rounded" />
            <div className="h-3 w-24 bg-sidebar rounded" />
          </div>
        </div>
        <div className="h-8 w-16 bg-sidebar rounded" />
      </div>
    </Card>
  );
}

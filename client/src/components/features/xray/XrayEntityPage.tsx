import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import { xrayApi } from '../../../services/api';
import { Card, Input } from '../../ui';
import type { XrayEntity, TestExecutionWithStatus } from '../../../types';

interface XrayEntityPageProps {
  type: 'test-sets' | 'test-plans' | 'test-executions' | 'preconditions';
}

const CONFIG: Record<string, { title: string; singular: string; icon: React.ReactNode; color: string; testsLabel: string }> = {
  'test-sets': {
    title: 'Test Sets',
    singular: 'Test Set',
    color: '#8B5CF6', // purple
    testsLabel: 'Tests in this set',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  'test-plans': {
    title: 'Test Plans',
    singular: 'Test Plan',
    color: '#F59E0B', // amber
    testsLabel: 'Tests in this plan',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  'test-executions': {
    title: 'Test Executions',
    singular: 'Test Execution',
    color: '#10B981', // emerald
    testsLabel: 'Tests in this execution',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  'preconditions': {
    title: 'Preconditions',
    singular: 'Precondition',
    color: '#EC4899', // pink
    testsLabel: 'Tests using this precondition',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
};

export function XrayEntityPage({ type }: XrayEntityPageProps) {
  const { activeProject, isConfigured, config } = useApp();
  const [entities, setEntities] = useState<(XrayEntity | TestExecutionWithStatus)[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { title, singular, icon, color, testsLabel } = CONFIG[type];
  const isTestExecutionPage = type === 'test-executions';

  // Fetch entities when project changes
  useEffect(() => {
    if (!activeProject || !isConfigured) {
      setEntities([]);
      return;
    }

    const fetchEntities = async () => {
      setLoading(true);
      setError(null);
      try {
        let data: XrayEntity[];
        switch (type) {
          case 'test-sets':
            data = await xrayApi.getTestSets(activeProject);
            break;
          case 'test-plans':
            data = await xrayApi.getTestPlans(activeProject);
            break;
          case 'test-executions':
            data = await xrayApi.getTestExecutions(activeProject);
            break;
          case 'preconditions':
            data = await xrayApi.getPreconditions(activeProject);
            break;
          default:
            data = [];
        }
        setEntities(data);
      } catch (err) {
        console.error(`Failed to fetch ${type}:`, err);
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchEntities();
  }, [activeProject, isConfigured, type]);

  // Filter entities by search
  const filteredEntities = useMemo(() => {
    if (!search) return entities;
    const lower = search.toLowerCase();
    return entities.filter(
      e => e.key.toLowerCase().includes(lower) || e.summary.toLowerCase().includes(lower)
    );
  }, [entities, search]);

  const handleRefresh = async () => {
    if (!activeProject || !isConfigured) return;

    setLoading(true);
    setError(null);
    setExpandedId(null);
    try {
      let data: XrayEntity[];
      switch (type) {
        case 'test-sets':
          data = await xrayApi.getTestSets(activeProject);
          break;
        case 'test-plans':
          data = await xrayApi.getTestPlans(activeProject);
          break;
        case 'test-executions':
          data = await xrayApi.getTestExecutions(activeProject);
          break;
        case 'preconditions':
          data = await xrayApi.getPreconditions(activeProject);
          break;
        default:
          data = [];
      }
      setEntities(data);
    } catch (err) {
      console.error(`Failed to fetch ${type}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const jiraBaseUrl = config?.jiraBaseUrl;

  // Not configured state
  if (!isConfigured) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto px-4 py-6">
        <Header title={title} icon={icon} color={color} count={0} />
        <Card className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-warning/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-text-primary mb-2">Xray Not Connected</h3>
          <p className="text-text-muted mb-4">
            Connect to Xray in Settings to view {title.toLowerCase()}.
          </p>
        </Card>
      </div>
    );
  }

  // No project selected state
  if (!activeProject) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto px-4 py-6">
        <Header title={title} icon={icon} color={color} count={0} />
        <Card className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-text-primary mb-2">No Project Selected</h3>
          <p className="text-text-muted">
            Select a project from the sidebar to view its {title.toLowerCase()}.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <Header
        title={title}
        icon={icon}
        color={color}
        count={loading ? undefined : entities.length}
      />

      {/* Search and Actions Bar */}
      <Card padding="sm">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Input
              placeholder={`Search ${title.toLowerCase()}...`}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
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
      {!loading && !error && filteredEntities.length === 0 && (
        <Card className="text-center py-12">
          <div
            className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${color}15` }}
          >
            <div style={{ color }}>{icon}</div>
          </div>
          {entities.length === 0 ? (
            <>
              <h3 className="text-lg font-medium text-text-primary mb-2">No {title} Found</h3>
              <p className="text-text-muted">
                There are no {title.toLowerCase()} in project {activeProject}.
              </p>
            </>
          ) : (
            <>
              <h3 className="text-lg font-medium text-text-primary mb-2">No Results</h3>
              <p className="text-text-muted">
                No {title.toLowerCase()} match "{search}".
              </p>
            </>
          )}
        </Card>
      )}

      {/* Entity List */}
      {!loading && !error && filteredEntities.length > 0 && (
        <div className="grid gap-3">
          {filteredEntities.map(entity => (
            <EntityCard
              key={entity.issueId}
              entity={entity}
              type={type}
              singular={singular}
              color={color}
              icon={icon}
              testsLabel={testsLabel}
              jiraBaseUrl={jiraBaseUrl}
              isExpanded={expandedId === entity.issueId}
              onToggleExpand={() => setExpandedId(expandedId === entity.issueId ? null : entity.issueId)}
            />
          ))}
        </div>
      )}

      {/* Summary */}
      {!loading && entities.length > 0 && (
        <p className="text-sm text-text-muted text-center">
          {search && filteredEntities.length !== entities.length
            ? `Showing ${filteredEntities.length} of ${entities.length} ${title.toLowerCase()}`
            : `${entities.length} ${entities.length === 1 ? singular.toLowerCase() : title.toLowerCase()} in ${activeProject}`}
        </p>
      )}
    </div>
  );
}

// Header component
function Header({
  title,
  icon,
  color,
  count,
}: {
  title: string;
  icon: React.ReactNode;
  color: string;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: `${color}20`, color }}
      >
        {icon}
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
          {count !== undefined && (
            <span
              className="px-2 py-0.5 text-sm font-medium rounded-full"
              style={{ backgroundColor: `${color}20`, color }}
            >
              {count}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Entity card component with expandable tests
function EntityCard({
  entity,
  type,
  singular,
  color,
  icon,
  testsLabel,
  jiraBaseUrl,
  isExpanded,
  onToggleExpand,
}: {
  entity: XrayEntity | TestExecutionWithStatus;
  type: string;
  singular: string;
  color: string;
  icon: React.ReactNode;
  testsLabel: string;
  jiraBaseUrl?: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const navigate = useNavigate();
  const [tests, setTests] = useState<XrayEntity[]>([]);
  const [loadingTests, setLoadingTests] = useState(false);
  const [testsError, setTestsError] = useState<string | null>(null);

  const jiraUrl = jiraBaseUrl ? `${jiraBaseUrl}/browse/${entity.key}` : null;
  const isPrecondition = type === 'preconditions';
  const isTestExecution = type === 'test-executions';

  // Get status data from entity if it's a test execution
  const executionStatus = isTestExecution && 'statuses' in entity
    ? { totalTests: entity.totalTests, statuses: entity.statuses }
    : null;

  // Fetch tests when expanded (only for non-preconditions, or when explicitly expanded)
  useEffect(() => {
    if (!isExpanded) return;

    const fetchTests = async () => {
      setLoadingTests(true);
      setTestsError(null);
      try {
        let data: XrayEntity[];
        switch (type) {
          case 'test-sets':
            data = await xrayApi.getTestsFromTestSet(entity.issueId);
            break;
          case 'test-plans':
            data = await xrayApi.getTestsFromTestPlan(entity.issueId);
            break;
          case 'test-executions':
            data = await xrayApi.getTestsFromTestExecution(entity.issueId);
            break;
          case 'preconditions':
            data = await xrayApi.getTestsFromPrecondition(entity.issueId);
            break;
          default:
            data = [];
        }
        setTests(data);
      } catch (err) {
        console.error('Failed to fetch tests:', err);
        setTestsError(err instanceof Error ? err.message : 'Failed to load tests');
      } finally {
        setLoadingTests(false);
      }
    };

    fetchTests();
  }, [isExpanded, entity.issueId, type]);

  const handleMainClick = () => {
    if (isPrecondition) {
      navigate(`/xray/precondition/${entity.issueId}`);
    } else {
      onToggleExpand();
    }
  };

  return (
    <Card padding="none" className="overflow-hidden">
      {/* Main Row - Clickable */}
      <button
        onClick={handleMainClick}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-sidebar-hover/50 transition-colors group"
      >
        {/* Icon */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${color}15`, color }}
        >
          {icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold" style={{ color }}>
              {entity.key}
            </span>
            <span className="text-xs text-text-muted">{singular}</span>
            {/* Test count badge for test executions */}
            {isTestExecution && executionStatus && (
              <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-sidebar text-text-secondary">
                {executionStatus.totalTests} tests
              </span>
            )}
          </div>
          <p className="text-text-primary truncate" title={entity.summary}>
            {entity.summary}
          </p>

          {/* Execution Status Bar for Test Executions */}
          {isTestExecution && executionStatus && executionStatus.totalTests > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-2 bg-sidebar rounded-full overflow-hidden flex">
                {executionStatus.statuses.map((s, idx) => {
                  const widthPercent = (s.count / executionStatus.totalTests) * 100;
                  return (
                    <div
                      key={`${s.status}-${idx}`}
                      className="h-full"
                      style={{ width: `${widthPercent}%`, backgroundColor: s.color }}
                      title={`${s.status}: ${s.count} (${Math.round(widthPercent)}%)`}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {jiraUrl && (
            <a
              href={jiraUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-muted hover:text-text-primary hover:bg-sidebar-hover rounded-lg transition-colors"
              title={`Open ${entity.key} in Jira`}
            >
              <span className="hidden sm:inline">Jira</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}

          {isPrecondition ? (
            /* Arrow indicator for preconditions (navigates to details) */
            <svg
              className="w-5 h-5 text-text-muted group-hover:text-text-primary transition-colors"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          ) : (
            /* Expand/Collapse chevron for other entities */
            <svg
              className={`w-5 h-5 text-text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
      </button>

      {/* Expanded Tests Section */}
      {isExpanded && (
        <div className="border-t border-border bg-sidebar/30">
          <div className="px-4 py-3">
            {/* Execution Status Legend for Test Executions */}
            {isTestExecution && executionStatus && executionStatus.totalTests > 0 && (
              <div className="mb-4 pb-3 border-b border-border">
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                  Execution Status
                </p>
                <div className="flex flex-wrap gap-3">
                  {executionStatus.statuses.map((s, idx) => (
                    <div key={`legend-${s.status}-${idx}`} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="text-sm text-text-secondary">{s.status}: <strong>{s.count}</strong></span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">
              {testsLabel}
            </p>

            {/* Loading */}
            {loadingTests && (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="w-6 h-6 rounded bg-sidebar" />
                    <div className="flex-1 space-y-1">
                      <div className="h-3 w-20 bg-sidebar rounded" />
                      <div className="h-3 w-48 bg-sidebar rounded" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Error */}
            {testsError && (
              <p className="text-sm text-error">{testsError}</p>
            )}

            {/* Empty */}
            {!loadingTests && !testsError && tests.length === 0 && (
              <p className="text-sm text-text-muted py-2">No tests found</p>
            )}

            {/* Tests List */}
            {!loadingTests && !testsError && tests.length > 0 && (
              <TestsList tests={tests} jiraBaseUrl={jiraBaseUrl} />
            )}

            {/* Tests count */}
            {!loadingTests && tests.length > 0 && (
              <p className="text-xs text-text-muted mt-3 pt-2 border-t border-border">
                {tests.length} test{tests.length !== 1 ? 's' : ''} total
              </p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

// Tests list component with navigation
function TestsList({ tests, jiraBaseUrl }: { tests: XrayEntity[]; jiraBaseUrl?: string }) {
  const navigate = useNavigate();

  return (
    <div className="space-y-1">
      {tests.map(test => (
        <div
          key={test.issueId}
          onClick={() => navigate(`/xray/test/${test.issueId}`)}
          className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-sidebar-hover transition-colors cursor-pointer group"
        >
          {/* Test icon */}
          <svg className="w-4 h-4 text-accent flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>

          {/* Test info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-accent group-hover:underline">
                {test.key}
              </span>
            </div>
            <p className="text-sm text-text-secondary truncate">{test.summary}</p>
          </div>

          {/* Jira link */}
          {jiraBaseUrl && (
            <a
              href={`${jiraBaseUrl}/browse/${test.key}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-sidebar transition-all"
              title={`Open ${test.key} in Jira`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}

          {/* Arrow indicator */}
          <svg className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      ))}
    </div>
  );
}

// Skeleton loading card
function SkeletonCard() {
  return (
    <Card padding="sm">
      <div className="flex items-center gap-4 animate-pulse">
        <div className="w-10 h-10 rounded-lg bg-sidebar" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-4 w-20 bg-sidebar rounded" />
            <div className="h-3 w-16 bg-sidebar rounded" />
          </div>
          <div className="h-4 w-3/4 bg-sidebar rounded" />
        </div>
        <div className="h-8 w-24 bg-sidebar rounded" />
      </div>
    </Card>
  );
}

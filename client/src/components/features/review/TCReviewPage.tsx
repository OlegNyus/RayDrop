import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import { Card, Input } from '../../ui';
import { PRIORITY_COLORS, PRIORITY_ORDER, REVIEW_COLORS } from '../../../constants/colors';

type SortOption = 'created-desc' | 'created-asc' | 'priority' | 'key';

export function TCReviewPage() {
  const { activeProject, isConfigured, config, drafts, reviewTests, reviewTestsLoading, refreshReviewCounts } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('created-desc');
  const [activeView, setActiveView] = useState<'underReview' | 'xrayDraft'>('underReview');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const jiraBaseUrl = config?.jiraBaseUrl;

  // Use shared data from context
  const underReviewTests = reviewTests.underReview;
  const xrayDraftTests = reviewTests.xrayDraft;
  const loading = reviewTestsLoading;

  // Stats - tests under review, Xray drafts, and local RayDrop drafts
  const stats = useMemo(() => {
    const localDraftCount = drafts.filter(d => d.status === 'draft').length;
    return {
      underReview: underReviewTests.length,
      xrayDraft: xrayDraftTests.length,
      localDraft: localDraftCount,
    };
  }, [underReviewTests, xrayDraftTests, drafts]);

  // Get current tests based on active view
  const currentTests = activeView === 'underReview' ? underReviewTests : xrayDraftTests;

  // Filter and sort tests
  const filteredAndSortedTests = useMemo(() => {
    let result = [...currentTests];

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
  }, [currentTests, search, sortBy]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedTests.length / ITEMS_PER_PAGE);
  const paginatedTests = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedTests.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAndSortedTests, currentPage]);

  // Reset page when search/sort/view changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, sortBy, activeView]);

  // Track if user has interacted with pagination
  const [hasInteracted, setHasInteracted] = useState(false);

  // Scroll to test list when page changes (after user interaction)
  useEffect(() => {
    if (hasInteracted) {
      document.getElementById('test-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [currentPage, hasInteracted]);

  const handlePageChange = (page: number) => {
    setHasInteracted(true);
    setCurrentPage(page);
  };

  const handleRefresh = async () => {
    if (!activeProject || !isConfigured) return;
    await refreshReviewCounts();
    setCurrentPage(1);
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
        <Header />
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
        <Header />
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
      <Header />

      {/* Stats Cards */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3 max-w-2xl">
          <StatCard
            label="Under Review"
            subtitle="Xray Status"
            value={stats.underReview}
            color={REVIEW_COLORS.underReview}
            isActive={activeView === 'underReview'}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            }
            onClick={() => setActiveView('underReview')}
            tooltip="View Under Review tests"
          />
          <StatCard
            label="Draft"
            subtitle="Xray Status"
            value={stats.xrayDraft}
            color={REVIEW_COLORS.xrayDraft}
            isActive={activeView === 'xrayDraft'}
            icon={
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.571 11.513H0a5.218 5.218 0 005.232 5.215h2.13v2.057A5.215 5.215 0 0012.574 24V12.518a1.005 1.005 0 00-1.003-1.005zm5.723-5.756H5.736a5.215 5.215 0 005.215 5.214h2.129v2.058a5.218 5.218 0 005.215 5.214V6.758a1.001 1.001 0 00-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 005.215 5.215h2.129v2.057A5.215 5.215 0 0024 12.483V1.005A1.001 1.001 0 0023.013 0z"/>
              </svg>
            }
            onClick={() => setActiveView('xrayDraft')}
            tooltip="View Draft tests"
          />
          <StatCard
            label="Draft"
            subtitle="RayDrop Local"
            value={stats.localDraft}
            color={REVIEW_COLORS.localDraft}
            icon={
              <svg className="w-5 h-5" viewBox="0 0 64 64" fill="none">
                <path d="M32 12C32 12 16 30 16 42C16 50.837 23.163 58 32 58C40.837 58 48 50.837 48 42C48 30 32 12 32 12Z" fill="currentColor"/>
              </svg>
            }
            onClick={() => navigate('/test-cases?status=draft')}
            tooltip="View in Test Cases"
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

      {/* Loading State */}
      {loading && (
        <div className="grid gap-3">
          {[...Array(5)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredAndSortedTests.length === 0 && (
        <Card className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${activeView === 'underReview' ? REVIEW_COLORS.underReview : REVIEW_COLORS.xrayDraft}10` }}
          >
            <svg
              className="w-8 h-8"
              style={{ color: activeView === 'underReview' ? REVIEW_COLORS.underReview : REVIEW_COLORS.xrayDraft }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          {currentTests.length === 0 ? (
            <>
              <h3 className="text-lg font-medium text-text-primary mb-2">
                No {activeView === 'underReview' ? 'Tests Under Review' : 'Draft Tests'}
              </h3>
              <p className="text-text-muted">
                There are no tests with "{activeView === 'underReview' ? 'Under Review' : 'Draft'}" status in project {activeProject}.
              </p>
            </>
          ) : (
            <>
              <h3 className="text-lg font-medium text-text-primary mb-2">No Results</h3>
              <p className="text-text-muted">
                No tests match your search criteria.
              </p>
            </>
          )}
        </Card>
      )}

      {/* View Header */}
      {!loading && currentTests.length > 0 && (
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            {activeView === 'underReview' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                Tests Under Review
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                Draft Tests (Xray)
              </>
            )}
            <span className="text-sm font-normal text-text-muted">
              ({filteredAndSortedTests.length})
            </span>
          </h2>
        </div>
      )}

      {/* Test List */}
      {!loading && paginatedTests.length > 0 && (
        <div id="test-list" className="grid gap-3">
          {paginatedTests.map(test => (
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

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 text-sm rounded-lg border border-border bg-card hover:bg-sidebar-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <div className="flex items-center gap-1">
            <PaginationNumbers currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
          </div>
          <button
            onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 text-sm rounded-lg border border-border bg-card hover:bg-sidebar-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}

      {/* Summary */}
      {!loading && currentTests.length > 0 && (
        <p className="text-sm text-text-muted text-center">
          {filteredAndSortedTests.length !== currentTests.length
            ? `Showing ${filteredAndSortedTests.length} of ${currentTests.length} ${activeView === 'underReview' ? 'under review' : 'draft'} tests`
            : `${currentTests.length} ${activeView === 'underReview' ? 'under review' : 'draft'} test${currentTests.length !== 1 ? 's' : ''} in ${activeProject}`}
        </p>
      )}
    </div>
  );
}

// Header component
function Header() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/20 text-blue-500">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-text-primary">TC Review</h1>
        <p className="text-sm text-text-muted">Tests awaiting review</p>
      </div>
    </div>
  );
}

// Stat card component
function StatCard({
  label,
  subtitle,
  value,
  color,
  icon,
  onClick,
  tooltip,
  isActive,
}: {
  label: string;
  subtitle?: string;
  value: number;
  color: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  tooltip?: string;
  isActive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      className={`p-4 rounded-lg border relative overflow-hidden text-left transition-all hover:scale-[1.02] hover:shadow-md cursor-pointer ${
        isActive ? 'ring-2 ring-offset-2 ring-offset-background' : ''
      }`}
      style={{
        borderColor: isActive ? color : `${color}40`,
        backgroundColor: isActive ? `${color}10` : 'var(--card)',
        ['--tw-ring-color' as string]: color,
      }}
    >
      {icon && (
        <div
          className="absolute top-2 right-2 opacity-20"
          style={{ color }}
        >
          {icon}
        </div>
      )}
      <div className="text-3xl font-bold" style={{ color }}>{value}</div>
      <div className="text-sm font-medium text-text-primary">{label}</div>
      {subtitle && <div className="text-xs text-text-muted">{subtitle}</div>}
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

// Smart pagination numbers with ellipsis
function PaginationNumbers({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];

    if (totalPages <= 7) {
      // Show all pages if 7 or fewer
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage > 3) {
        pages.push('ellipsis');
      }

      // Show pages around current page
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('ellipsis');
      }

      // Always show last page
      if (!pages.includes(totalPages)) pages.push(totalPages);
    }

    return pages;
  };

  return (
    <>
      {getPageNumbers().map((page, idx) =>
        page === 'ellipsis' ? (
          <span key={`ellipsis-${idx}`} className="px-2 text-text-muted">
            ...
          </span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`w-8 h-8 text-sm rounded-lg transition-colors ${
              currentPage === page
                ? 'bg-accent text-white'
                : 'hover:bg-sidebar-hover text-text-secondary'
            }`}
          >
            {page}
          </button>
        )
      )}
    </>
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

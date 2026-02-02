import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import { Card, StatusBadge, TestKeyLink } from '../../ui';
import { xrayApi } from '../../../services/api';
import type { XrayEntity } from '../../../types';

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

interface TestExecutionStatus {
  issueId: string;
  key: string;
  summary: string;
  totalTests: number;
  statuses: Array<{ status: string; count: number; color: string }>;
}

export function Dashboard() {
  const navigate = useNavigate();
  const { drafts, activeProject, settings, isConfigured } = useApp();

  // Test Execution status state
  const [testExecutions, setTestExecutions] = useState<XrayEntity[]>([]);
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const [executionStatus, setExecutionStatus] = useState<TestExecutionStatus | null>(null);
  const [loadingExecutions, setLoadingExecutions] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);

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

  // Fetch test executions when project changes - with proper cleanup
  useEffect(() => {
    // Reset state immediately when project changes
    setTestExecutions([]);
    setSelectedExecutionId(null);
    setExecutionStatus(null);

    if (!activeProject || !isConfigured) {
      return;
    }

    let cancelled = false;

    const fetchExecutions = async () => {
      setLoadingExecutions(true);
      try {
        const data = await xrayApi.getTestExecutions(activeProject);
        // Only update state if this fetch wasn't cancelled
        if (!cancelled) {
          setTestExecutions(data);
          // Auto-select first execution if available
          if (data.length > 0) {
            setSelectedExecutionId(data[0].issueId);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to fetch test executions:', err);
          setTestExecutions([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingExecutions(false);
        }
      }
    };

    fetchExecutions();

    // Cleanup function to cancel if project changes mid-fetch
    return () => {
      cancelled = true;
    };
  }, [activeProject, isConfigured]);

  // Fetch execution status when selection changes
  useEffect(() => {
    if (!selectedExecutionId) {
      setExecutionStatus(null);
      return;
    }

    const fetchStatus = async () => {
      setLoadingStatus(true);
      try {
        const data = await xrayApi.getTestExecutionStatus(selectedExecutionId);
        setExecutionStatus(data);
      } catch (err) {
        console.error('Failed to fetch execution status:', err);
        setExecutionStatus(null);
      } finally {
        setLoadingStatus(false);
      }
    };

    fetchStatus();
  }, [selectedExecutionId]);

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

      {/* Test Execution Status */}
      {isConfigured && activeProject && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-lg font-semibold text-text-primary">Test Execution Status</h3>
                <p className="text-xs text-text-muted flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                  Live from Xray
                </p>
              </div>
            </div>

            {/* Execution Selector - Custom Dropdown */}
            <ExecutionSelector
              executions={testExecutions}
              selectedId={selectedExecutionId}
              onSelect={setSelectedExecutionId}
              loading={loadingExecutions}
            />
          </div>

          {/* Status Content */}
          {loadingStatus ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
            </div>
          ) : executionStatus ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              {/* Donut Chart */}
              <div className="flex flex-col items-center">
                <ExecutionDonutChart statuses={executionStatus.statuses} total={executionStatus.totalTests} />
                <div className="mt-3">
                  <TestKeyLink testKey={executionStatus.key} />
                </div>
              </div>

              {/* Status Legend */}
              <div className="space-y-2">
                {executionStatus.statuses.map((s) => {
                  const percent = executionStatus.totalTests > 0
                    ? Math.round((s.count / executionStatus.totalTests) * 100)
                    : 0;
                  return (
                    <div key={s.status} className="flex items-center justify-between p-2 rounded-lg hover:bg-sidebar-hover transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="text-sm font-medium text-text-primary">{s.status}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-text-muted">{s.count}</span>
                        <span className="text-xs text-text-muted w-10 text-right">{percent}%</span>
                      </div>
                    </div>
                  );
                })}
                <div className="border-t border-border pt-2 mt-2">
                  <div className="flex items-center justify-between p-2">
                    <span className="text-sm font-semibold text-text-primary">Total Tests</span>
                    <span className="text-sm font-semibold text-text-primary">{executionStatus.totalTests}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : testExecutions.length === 0 ? (
            <p className="text-text-muted text-center py-8">
              No test executions found in {activeProject}
            </p>
          ) : (
            <p className="text-text-muted text-center py-8">
              Select a test execution to view status
            </p>
          )}
        </Card>
      )}

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

// Custom Execution Selector Dropdown with Search
function ExecutionSelector({
  executions,
  selectedId,
  onSelect,
  loading,
}: {
  executions: XrayEntity[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  loading: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedExec = executions.find(e => e.issueId === selectedId);

  // Filter executions by search term
  const filteredExecutions = search.trim()
    ? executions.filter(exec =>
        exec.key.toLowerCase().includes(search.toLowerCase()) ||
        exec.summary.toLowerCase().includes(search.toLowerCase())
      )
    : executions;

  // Reset highlighted index when filtered results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [search]);

  // Close dropdown and handle keyboard navigation
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
        setHighlightedIndex(0);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      switch (event.key) {
        case 'Escape':
          setIsOpen(false);
          setSearch('');
          setHighlightedIndex(0);
          break;
        case 'ArrowDown':
          event.preventDefault();
          setHighlightedIndex(prev =>
            prev < filteredExecutions.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
          break;
        case 'Enter':
          event.preventDefault();
          if (filteredExecutions[highlightedIndex]) {
            onSelect(filteredExecutions[highlightedIndex].issueId);
            setIsOpen(false);
            setSearch('');
            setHighlightedIndex(0);
          }
          break;
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, filteredExecutions, highlightedIndex, onSelect]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  const displayText = loading
    ? 'Loading...'
    : executions.length === 0
    ? 'No executions'
    : selectedExec
    ? `${selectedExec.key} - ${selectedExec.summary}`
    : 'Select execution...';

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => !loading && executions.length > 0 && setIsOpen(!isOpen)}
        disabled={loading || executions.length === 0}
        aria-label="Select test execution"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-sidebar border border-border rounded-lg text-text-primary hover:bg-sidebar-hover focus:outline-none focus:ring-2 focus:ring-accent/50 max-w-xs disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <span className="truncate max-w-[200px]">{displayText}</span>
        <svg
          className={`w-4 h-4 text-text-muted flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && executions.length > 0 && (
        <div
          className="absolute top-full right-0 mt-1 w-80 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden"
          role="listbox"
          aria-label="Test executions"
        >
          {/* Search Input */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search executions..."
                aria-label="Search executions"
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-sidebar border border-border rounded-md text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
              />
            </div>
          </div>

          {/* Options List */}
          <div ref={listRef} className="max-h-56 overflow-y-auto py-1">
            {filteredExecutions.length === 0 ? (
              <div className="px-3 py-4 text-sm text-text-muted text-center">
                No executions match "{search}"
              </div>
            ) : (
              filteredExecutions.map((exec, index) => {
                const isSelected = exec.issueId === selectedId;
                const isHighlighted = index === highlightedIndex;
                return (
                  <button
                    key={exec.issueId}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onSelect(exec.issueId);
                      setIsOpen(false);
                      setSearch('');
                      setHighlightedIndex(0);
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                      isHighlighted ? 'bg-sidebar-hover' : ''
                    } ${isSelected ? 'bg-accent/10 text-accent' : 'text-text-primary'}`}
                  >
                    <span className="font-mono text-xs text-accent flex-shrink-0">{exec.key}</span>
                    <span className="truncate flex-1">{exec.summary}</span>
                    {isSelected && (
                      <svg className="w-4 h-4 text-accent flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Test Execution Donut Chart
function ExecutionDonutChart({
  statuses,
  total,
}: {
  statuses: Array<{ status: string; count: number; color: string }>;
  total: number;
}) {
  const size = 160;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Calculate pass rate for center display
  const passCount = statuses.find(s => s.status.toUpperCase() === 'PASS' || s.status.toUpperCase() === 'PASSED')?.count || 0;
  const passRate = total > 0 ? Math.round((passCount / total) * 100) : 0;

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
          <span className="text-xs text-text-muted">Tests</span>
        </div>
      </div>
    );
  }

  let currentOffset = 0;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {statuses.map((s, index) => {
          const percent = s.count / total;
          const strokeDasharray = `${percent * circumference} ${circumference}`;
          const strokeDashoffset = -currentOffset * circumference;
          currentOffset += percent;

          return (
            <circle
              key={`${s.status}-${index}`}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-text-primary">{passRate}%</span>
        <span className="text-xs text-text-muted">Pass Rate</span>
      </div>
    </div>
  );
}

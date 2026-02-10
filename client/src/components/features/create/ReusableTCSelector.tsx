import { useState, useEffect, useMemo } from 'react';
import { Card, Button, Input } from '../../ui';
import { xrayApi, settingsApi } from '../../../services/api';
import type { TestDetails } from '../../../types';

const PAGE_SIZE = 10;

interface ReusableTCSelectorProps {
  projectKey: string;
  onSelect: (test: TestDetails) => void;
  onSwitchToScratch: () => void;
}

export function ReusableTCSelector({ projectKey, onSelect, onSwitchToScratch }: ReusableTCSelectorProps) {
  const [tests, setTests] = useState<TestDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [prefix, setPrefix] = useState('REUSE');
  const [editingPrefix, setEditingPrefix] = useState(false);
  const [prefixInput, setPrefixInput] = useState('');

  useEffect(() => {
    loadPrefix();
  }, [projectKey]);

  const loadPrefix = async () => {
    try {
      const ps = await settingsApi.getProjectSettings(projectKey);
      const p = ps.reusablePrefix || 'REUSE';
      setPrefix(p);
      setPrefixInput(p);
      await fetchTests(p);
    } catch {
      await fetchTests('REUSE');
    }
  };

  const fetchTests = async (pfx: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await xrayApi.getTestsByPrefix(projectKey, pfx);
      setTests(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch reusable tests');
      setTests([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePrefixSave = async () => {
    const newPrefix = prefixInput.trim().toUpperCase();
    if (!newPrefix) return;
    setPrefix(newPrefix);
    setEditingPrefix(false);
    try {
      const ps = await settingsApi.getProjectSettings(projectKey);
      await settingsApi.updateProjectSettings(projectKey, { ...ps, reusablePrefix: newPrefix });
    } catch {
      // Prefix still updated locally
    }
    await fetchTests(newPrefix);
  };

  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return tests.filter(t => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return t.key.toLowerCase().includes(q) || t.summary.toLowerCase().includes(q);
    });
  }, [tests, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset to page 1 when search changes
  useEffect(() => { setPage(1); }, [search]);

  return (
    <div className="space-y-4">
      {/* Header with prefix control */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-text-primary">
            Select Reusable Test Case
            {!loading && tests.length > 0 && (
              <span className="ml-2 text-sm font-normal text-text-muted">({tests.length})</span>
            )}
          </h2>
          {editingPrefix ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={prefixInput}
                onChange={e => setPrefixInput(e.target.value.toUpperCase())}
                className="w-24 px-2 py-1 text-xs border border-border rounded bg-background text-text-primary"
                onKeyDown={e => e.key === 'Enter' && handlePrefixSave()}
                autoFocus
              />
              <button
                onClick={handlePrefixSave}
                className="text-xs text-accent hover:text-accent/80"
              >
                Save
              </button>
              <button
                onClick={() => { setEditingPrefix(false); setPrefixInput(prefix); }}
                className="text-xs text-text-muted hover:text-text-primary"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingPrefix(true)}
              className="px-2 py-0.5 text-xs bg-accent/10 text-accent rounded hover:bg-accent/20 transition-colors"
              title="Change prefix"
            >
              {prefix}
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <Input
        placeholder="Search by key or summary..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
            <p className="text-text-muted text-sm">Searching for reusable tests...</p>
          </div>
        </div>
      ) : error ? (
        <Card className="text-center py-8">
          <p className="text-error mb-2">Failed to load tests</p>
          <p className="text-text-muted text-sm mb-4">{error}</p>
          <Button variant="secondary" onClick={() => fetchTests(prefix)}>Retry</Button>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="text-text-primary font-medium mb-1">
            {tests.length === 0
              ? `No reusable TCs found in ${projectKey}`
              : 'No results match your search'}
          </p>
          <p className="text-text-muted text-sm mb-4">
            {tests.length === 0
              ? `Tests with "${prefix}" in their summary will appear here`
              : 'Try a different search term'}
          </p>
          <Button variant="ghost" onClick={onSwitchToScratch}>
            Create from scratch instead
          </Button>
        </Card>
      ) : (
        <>
          {/* Showing count when search is active */}
          {search.trim() && (
            <p className="text-xs text-text-muted">
              {filtered.length} of {tests.length} test{tests.length !== 1 ? 's' : ''} match
            </p>
          )}

          <div className="space-y-2">
            {paged.map(test => (
              <button
                key={test.issueId}
                onClick={() => onSelect(test)}
                className="w-full text-left p-3 rounded-lg bg-card border border-border hover:border-accent/50 hover:bg-accent/5 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-mono text-accent bg-accent/10 px-1.5 py-0.5 rounded flex-shrink-0">
                      {test.key}
                    </span>
                    <span className="text-sm text-text-primary truncate">{test.summary}</span>
                  </div>
                  <svg className="w-4 h-4 text-text-muted group-hover:text-accent flex-shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-xs text-text-muted">{test.steps.length} step{test.steps.length !== 1 ? 's' : ''}</span>
                  {test.priority && (
                    <span className="text-xs text-text-muted">{test.priority}</span>
                  )}
                  {test.labels.length > 0 && (
                    <div className="flex gap-1">
                      {test.labels.slice(0, 3).map(l => (
                        <span key={l} className="text-xs bg-sidebar px-1.5 py-0.5 rounded text-text-muted">{l}</span>
                      ))}
                      {test.labels.length > 3 && (
                        <span className="text-xs text-text-muted">+{test.labels.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-text-muted">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-2.5 py-1 text-xs rounded border border-border text-text-muted hover:text-text-primary hover:border-accent/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | 'ellipsis')[]>((acc, p, i, arr) => {
                    if (i > 0 && p - (arr[i - 1]) > 1) acc.push('ellipsis');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === 'ellipsis' ? (
                      <span key={`e-${i}`} className="px-1 text-xs text-text-muted">...</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-7 h-7 text-xs rounded transition-colors ${
                          p === page
                            ? 'bg-accent text-white'
                            : 'text-text-muted hover:text-text-primary hover:bg-sidebar-hover'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-2.5 py-1 text-xs rounded border border-border text-text-muted hover:text-text-primary hover:border-accent/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

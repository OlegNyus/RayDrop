import { useState, useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import { Card, Button, Badge, Input } from '../../ui';
import type { Draft, TestCaseStatus } from '../../../types';

type SortField = 'updatedAt' | 'summary' | 'status';
type SortOrder = 'asc' | 'desc';

export function TestCasesList() {
  const { drafts, setActiveNav } = useApp();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TestCaseStatus | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const filteredDrafts = useMemo(() => {
    let result = [...drafts];

    // Filter by search
    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(
        d =>
          d.summary.toLowerCase().includes(lower) ||
          d.description.toLowerCase().includes(lower)
      );
    }

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter(d => d.status === statusFilter);
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'updatedAt':
          cmp = a.updatedAt - b.updatedAt;
          break;
        case 'summary':
          cmp = a.summary.localeCompare(b.summary);
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
      }
      return sortOrder === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [drafts, search, statusFilter, sortField, sortOrder]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(o => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Test Cases</h1>
        <Button onClick={() => setActiveNav('create')}>+ New Test Case</Button>
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search test cases..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as TestCaseStatus | 'all')}
            className="px-3 py-2 bg-input-bg border border-input-border rounded-lg text-sm text-text-primary"
          >
            <option value="all">All Status</option>
            <option value="new">New</option>
            <option value="draft">Draft</option>
            <option value="ready">Ready</option>
            <option value="imported">Imported</option>
          </select>
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <span>Sort:</span>
            <button
              onClick={() => toggleSort('updatedAt')}
              className={`px-2 py-1 rounded ${sortField === 'updatedAt' ? 'bg-accent text-white' : 'hover:bg-sidebar-hover'}`}
            >
              Date {sortField === 'updatedAt' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
            <button
              onClick={() => toggleSort('summary')}
              className={`px-2 py-1 rounded ${sortField === 'summary' ? 'bg-accent text-white' : 'hover:bg-sidebar-hover'}`}
            >
              Name {sortField === 'summary' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
          </div>
        </div>
      </Card>

      {/* List */}
      {filteredDrafts.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-text-muted">
            {drafts.length === 0
              ? 'No test cases yet. Create your first one!'
              : 'No test cases match your filters.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredDrafts.map(draft => (
            <TestCaseRow key={draft.id} draft={draft} />
          ))}
        </div>
      )}

      {/* Summary */}
      <p className="text-sm text-text-muted text-center">
        Showing {filteredDrafts.length} of {drafts.length} test cases
      </p>
    </div>
  );
}

function TestCaseRow({ draft }: { draft: Draft }) {
  const statusVariants: Record<TestCaseStatus, 'default' | 'success' | 'warning' | 'info'> = {
    new: 'info',
    draft: 'warning',
    ready: 'success',
    imported: 'success',
  };

  return (
    <Card padding="sm" className="hover:border-accent transition-colors cursor-pointer">
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-text-primary truncate">
              {draft.summary || 'Untitled'}
            </h3>
            {draft.testKey && (
              <span className="text-xs text-accent font-mono">{draft.testKey}</span>
            )}
          </div>
          <p className="text-sm text-text-muted truncate mt-1">
            {draft.description || 'No description'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={statusVariants[draft.status]}>
            {draft.status.charAt(0).toUpperCase() + draft.status.slice(1)}
          </Badge>
          <span className="text-xs text-text-muted whitespace-nowrap">
            {new Date(draft.updatedAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    </Card>
  );
}

import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import { Card, Button, StatusBadge, Input, TestKeyLink, ConfirmModal } from '../../ui';
import { draftsApi } from '../../../services/api';
import type { Draft, TestCaseStatus } from '../../../types';

type SortField = 'updatedAt' | 'summary' | 'status';
type SortOrder = 'asc' | 'desc';

const VALID_STATUSES: TestCaseStatus[] = ['new', 'draft', 'ready', 'imported'];

export function TestCasesList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { drafts, refreshDrafts } = useApp();
  const [search, setSearch] = useState('');

  // Initialize status filter from URL query param
  const initialStatus = searchParams.get('status');
  const [statusFilter, setStatusFilter] = useState<TestCaseStatus | 'all'>(
    initialStatus && VALID_STATUSES.includes(initialStatus as TestCaseStatus)
      ? (initialStatus as TestCaseStatus)
      : 'all'
  );

  // Sync URL when filter changes
  useEffect(() => {
    if (statusFilter === 'all') {
      searchParams.delete('status');
    } else {
      searchParams.set('status', statusFilter);
    }
    setSearchParams(searchParams, { replace: true });
  }, [statusFilter, searchParams, setSearchParams]);
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [deleteTarget, setDeleteTarget] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  const filteredDrafts = useMemo(() => {
    let result = [...drafts];

    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(d =>
        d.summary.toLowerCase().includes(lower) ||
        d.description.toLowerCase().includes(lower)
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter(d => d.status === statusFilter);
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'updatedAt': cmp = a.updatedAt - b.updatedAt; break;
        case 'summary': cmp = a.summary.localeCompare(b.summary); break;
        case 'status': cmp = a.status.localeCompare(b.status); break;
      }
      return sortOrder === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [drafts, search, statusFilter, sortField, sortOrder]);

  // Clear selection when filters change
  const filteredIds = useMemo(() => new Set(filteredDrafts.map(d => d.id)), [filteredDrafts]);
  const validSelectedIds = useMemo(() => {
    const valid = new Set<string>();
    selectedIds.forEach(id => {
      if (filteredIds.has(id)) valid.add(id);
    });
    return valid;
  }, [selectedIds, filteredIds]);

  const allSelected = filteredDrafts.length > 0 && validSelectedIds.size === filteredDrafts.length;
  const someSelected = validSelectedIds.size > 0 && validSelectedIds.size < filteredDrafts.length;

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(o => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDrafts.map(d => d.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await draftsApi.delete(deleteTarget.id);
      await refreshDrafts();
      setDeleteTarget(null);
      // Remove from selection if selected
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(deleteTarget.id);
        return next;
      });
    } catch (err) {
      console.error('Failed to delete:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    setDeleting(true);
    try {
      // Delete all selected items
      await Promise.all(
        Array.from(validSelectedIds).map(id => draftsApi.delete(id))
      );
      await refreshDrafts();
      setSelectedIds(new Set());
      setShowBulkDeleteModal(false);
    } catch (err) {
      console.error('Failed to bulk delete:', err);
    } finally {
      setDeleting(false);
    }
  };

  // Count imported items in selection for warning
  const selectedImportedCount = useMemo(() => {
    return filteredDrafts.filter(d => validSelectedIds.has(d.id) && d.status === 'imported').length;
  }, [filteredDrafts, validSelectedIds]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Test Cases</h1>
        <Button onClick={() => navigate('/test-cases/new')}>+ New Test Case</Button>
      </div>

      {/* Bulk Action Bar */}
      {validSelectedIds.size > 0 && (
        <Card padding="sm" className="bg-accent/10 border-accent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-text-primary">
                {validSelectedIds.size} selected
              </span>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-sm text-text-muted hover:text-text-primary"
              >
                Clear selection
              </button>
            </div>
            <Button
              variant="secondary"
              className="bg-red-600 hover:bg-red-700 text-white border-red-600"
              onClick={() => setShowBulkDeleteModal(true)}
            >
              Delete {validSelectedIds.size} item{validSelectedIds.size > 1 ? 's' : ''}
            </Button>
          </div>
        </Card>
      )}

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
          {/* Select All Header */}
          <div className="flex items-center gap-3 pl-[13px] pr-3 py-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allSelected}
                ref={el => {
                  if (el) el.indeterminate = someSelected;
                }}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-input-border text-accent focus:ring-accent cursor-pointer"
              />
              <span className="text-sm text-text-muted">
                {allSelected ? 'Deselect all' : 'Select all'}
              </span>
            </label>
          </div>

          {filteredDrafts.map(draft => (
            <TestCaseRow
              key={draft.id}
              draft={draft}
              selected={validSelectedIds.has(draft.id)}
              onToggleSelect={() => toggleSelect(draft.id)}
              onClick={() => navigate(`/test-cases/${draft.id}/edit`)}
              onDelete={() => setDeleteTarget(draft)}
            />
          ))}
        </div>
      )}

      {/* Summary */}
      <p className="text-sm text-text-muted text-center">
        Showing {filteredDrafts.length} of {drafts.length} test cases
      </p>

      {/* Single Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Test Case"
        message={`Are you sure you want to delete "${deleteTarget?.summary || 'Untitled'}"?`}
        warning={
          deleteTarget?.status === 'imported' && deleteTarget?.testKey
            ? `This will only remove it from RayDrop. The test case (${deleteTarget.testKey}) still exists in Xray.`
            : undefined
        }
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showBulkDeleteModal}
        title="Delete Multiple Test Cases"
        message={`Are you sure you want to delete ${validSelectedIds.size} test case${validSelectedIds.size > 1 ? 's' : ''}?`}
        warning={
          selectedImportedCount > 0
            ? `${selectedImportedCount} of these ${selectedImportedCount === 1 ? 'is an imported test case that' : 'are imported test cases that'} will only be removed from RayDrop. The Xray copies will remain.`
            : undefined
        }
        confirmLabel={deleting ? 'Deleting...' : `Delete ${validSelectedIds.size} item${validSelectedIds.size > 1 ? 's' : ''}`}
        variant="danger"
        onConfirm={handleBulkDelete}
        onCancel={() => setShowBulkDeleteModal(false)}
      />
    </div>
  );
}

function TestCaseRow({
  draft,
  selected,
  onToggleSelect,
  onClick,
  onDelete,
}: {
  draft: Draft;
  selected: boolean;
  onToggleSelect: () => void;
  onClick: () => void;
  onDelete: () => void;
}) {
  return (
    <Card
      padding="sm"
      className={`hover:border-accent transition-colors cursor-pointer ${selected ? 'border-accent bg-accent/5' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-4">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={selected}
          onChange={e => {
            e.stopPropagation();
            onToggleSelect();
          }}
          onClick={e => e.stopPropagation()}
          className="w-4 h-4 rounded border-input-border text-accent focus:ring-accent cursor-pointer"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-text-primary truncate">
              {draft.summary || 'Untitled'}
            </h3>
            {draft.testKey && <TestKeyLink testKey={draft.testKey} />}
          </div>
          <p className="text-sm text-text-muted truncate mt-1">
            {draft.description || 'No description'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={draft.status} />
          <span className="text-xs text-text-muted whitespace-nowrap">
            {new Date(draft.updatedAt).toLocaleDateString()}
          </span>
          {/* Delete button */}
          <button
            onClick={e => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1.5 rounded text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </Card>
  );
}

import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import { Card, Button, StatusBadge, Input, TestKeyLink, ConfirmModal } from '../../ui';
import { draftsApi, xrayApi } from '../../../services/api';
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

  // Bulk action states
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

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
    setValidationError(null);
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDrafts.map(d => d.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setValidationError(null);
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

  // Analyze selected items by status
  const selectedByStatus = useMemo(() => {
    const result = {
      ready: [] as Draft[],
      draft: [] as Draft[],
      newStatus: [] as Draft[],
      imported: [] as Draft[],
    };
    filteredDrafts.forEach(d => {
      if (!validSelectedIds.has(d.id)) return;
      switch (d.status) {
        case 'ready': result.ready.push(d); break;
        case 'draft': result.draft.push(d); break;
        case 'new': result.newStatus.push(d); break;
        case 'imported': result.imported.push(d); break;
      }
    });
    return result;
  }, [filteredDrafts, validSelectedIds]);

  // Validate if a test case has all required fields
  const isTestCaseComplete = (draft: Draft): boolean => {
    // Check required basic fields
    if (!draft.summary.trim()) return false;
    if (!draft.description.trim()) return false;

    // Check that there's at least one step
    if (draft.steps.length === 0) return false;

    // Check all steps have required fields
    for (const step of draft.steps) {
      if (!step.action.trim()) return false;
      if (!step.result.trim()) return false;
    }

    return true;
  };

  // Count how many draft/new items are complete (can be marked as ready)
  const completeDraftNewCount = useMemo(() => {
    const toCheck = [...selectedByStatus.draft, ...selectedByStatus.newStatus];
    return toCheck.filter(d => isTestCaseComplete(d)).length;
  }, [selectedByStatus.draft, selectedByStatus.newStatus]);

  const handleBulkMarkReady = async () => {
    setValidationError(null);

    // Check which items can be marked as ready
    const toUpdate = [...selectedByStatus.draft, ...selectedByStatus.newStatus];
    const complete = toUpdate.filter(d => isTestCaseComplete(d));
    const incomplete = toUpdate.filter(d => !isTestCaseComplete(d));

    if (complete.length === 0) {
      setValidationError(
        `Cannot mark as Ready: ${incomplete.length} test case${incomplete.length > 1 ? 's are' : ' is'} missing required fields (summary, description, or test steps).`
      );
      return;
    }

    setBulkUpdating(true);
    try {
      // Only mark complete items as ready
      await Promise.all(
        complete.map(d => draftsApi.update(d.id, { ...d, status: 'ready' }))
      );
      await refreshDrafts();
      setSelectedIds(new Set());

      // Show warning if some items couldn't be updated
      if (incomplete.length > 0) {
        setValidationError(
          `${complete.length} marked as Ready. ${incomplete.length} skipped (missing required fields).`
        );
      }
    } catch (err) {
      console.error('Failed to mark as ready:', err);
      setValidationError('Failed to update test cases. Please try again.');
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleBulkImport = async () => {
    setBulkImporting(true);
    try {
      // Import all ready items to Xray using the existing bulk import API
      const draftIds = selectedByStatus.ready.map(d => d.id);
      await xrayApi.import(draftIds);
      await refreshDrafts();
      setSelectedIds(new Set());
      setShowBulkImportModal(false);
    } catch (err) {
      console.error('Failed to bulk import:', err);
    } finally {
      setBulkImporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Test Cases</h1>
        <Button onClick={() => navigate('/test-cases/new')}>+ New Test Case</Button>
      </div>

      {/* Validation Error Toast */}
      {validationError && (
        <div className="fixed top-4 right-4 z-50 max-w-md p-4 bg-card border border-yellow-500/50 rounded-lg shadow-lg animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm text-text-primary">{validationError}</p>
            </div>
            <button
              onClick={() => setValidationError(null)}
              className="text-text-muted hover:text-text-primary"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Bulk Action Bar */}
      {validSelectedIds.size > 0 && (
        <Card padding="sm" className="bg-accent/10 border-accent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-text-primary">
                {validSelectedIds.size} selected
              </span>
              {/* Show breakdown by status */}
              <div className="flex items-center gap-2 text-xs text-text-muted">
                {selectedByStatus.ready.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">
                    {selectedByStatus.ready.length} ready
                  </span>
                )}
                {selectedByStatus.draft.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">
                    {selectedByStatus.draft.length} draft
                  </span>
                )}
                {selectedByStatus.newStatus.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                    {selectedByStatus.newStatus.length} new
                  </span>
                )}
                {selectedByStatus.imported.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                    {selectedByStatus.imported.length} imported
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-sm text-text-muted hover:text-text-primary"
              >
                Clear
              </button>
            </div>
            <div className="flex items-center gap-2">
              {/* Show "Mark as Ready" for draft/new items */}
              {(selectedByStatus.draft.length > 0 || selectedByStatus.newStatus.length > 0) && (
                <Button
                  variant="secondary"
                  onClick={handleBulkMarkReady}
                  disabled={bulkUpdating || completeDraftNewCount === 0}
                  title={completeDraftNewCount === 0 ? 'Selected test cases are missing required fields' : undefined}
                >
                  {bulkUpdating
                    ? 'Updating...'
                    : completeDraftNewCount === 0
                      ? 'Missing Required Fields'
                      : `Mark ${completeDraftNewCount} as Ready`
                  }
                </Button>
              )}
              {/* Show "Import to Xray" for ready items */}
              {selectedByStatus.ready.length > 0 && (
                <Button
                  onClick={() => setShowBulkImportModal(true)}
                  disabled={bulkImporting}
                >
                  {bulkImporting ? 'Importing...' : `Import ${selectedByStatus.ready.length} to Xray`}
                </Button>
              )}
            </div>
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

      {/* Bulk Import Confirmation Modal */}
      <ConfirmModal
        isOpen={showBulkImportModal}
        title="Import to Xray"
        message={`Import ${selectedByStatus.ready.length} test case${selectedByStatus.ready.length > 1 ? 's' : ''} to Xray?`}
        confirmLabel={bulkImporting ? 'Importing...' : `Import ${selectedByStatus.ready.length} Test${selectedByStatus.ready.length > 1 ? 's' : ''}`}
        variant="default"
        onConfirm={handleBulkImport}
        onCancel={() => setShowBulkImportModal(false)}
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
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="w-20 flex justify-center">
            <StatusBadge status={draft.status} />
          </div>
          <span className="text-xs text-text-muted whitespace-nowrap w-20 text-right">
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

import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import { Card, Button, StatusBadge, Input, TestKeyLink, ConfirmModal } from '../../ui';
import { draftsApi, xrayApi } from '../../../services/api';
import { executeLinking, countLinks } from '../../../hooks/useImportToXray';
import type { LinkedItem, FailedItem, ValidationResult } from '../../../hooks/useImportToXray';
import type { Draft, TestCaseStatus } from '../../../types';

type SortField = 'updatedAt' | 'summary' | 'status';
type SortOrder = 'asc' | 'desc';

const VALID_STATUSES: TestCaseStatus[] = ['new', 'draft', 'ready', 'imported'];

// Bulk Import progress tracking types
interface BulkImportItem {
  id: string;
  summary: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  testKey?: string;
  error?: string;
  // Linking fields
  linkingStatus: 'none' | 'pending' | 'linking' | 'done';
  totalLinks: number;
  linkedItems: LinkedItem[];
  failedItems: FailedItem[];
  hasLinkingErrors: boolean;
  validation: ValidationResult | null;
}

interface BulkImportProgress {
  isOpen: boolean;
  phase: 'importing' | 'linking' | 'complete';
  items: BulkImportItem[];
  currentIndex: number;
  isComplete: boolean;
  hasErrors: boolean;
}

export function TestCasesList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { drafts, refreshDrafts, config } = useApp();
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
  const [validationError, setValidationError] = useState<string | null>(null);

  // Bulk import progress modal state
  const [bulkImportProgress, setBulkImportProgress] = useState<BulkImportProgress>({
    isOpen: false,
    phase: 'importing',
    items: [],
    currentIndex: -1,
    isComplete: false,
    hasErrors: false,
  });

  const filteredDrafts = useMemo(() => {
    let result = [...drafts];

    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(d =>
        d.summary.toLowerCase().includes(lower) ||
        (typeof d.description === 'string' ? d.description : '').toLowerCase().includes(lower)
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
    if (!(typeof draft.description === 'string' ? draft.description : '').trim()) return false;

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
    const itemsToImport = selectedByStatus.ready;
    if (itemsToImport.length === 0) return;

    // Initialize progress modal
    const initialItems: BulkImportItem[] = itemsToImport.map(d => ({
      id: d.id,
      summary: d.summary || 'Untitled',
      status: 'pending' as const,
      linkingStatus: countLinks(d.xrayLinking) > 0 ? 'pending' as const : 'none' as const,
      totalLinks: countLinks(d.xrayLinking),
      linkedItems: [],
      failedItems: [],
      hasLinkingErrors: false,
      validation: null,
    }));

    setBulkImportProgress({
      isOpen: true,
      phase: 'importing',
      items: initialItems,
      currentIndex: 0,
      isComplete: false,
      hasErrors: false,
    });

    setBulkImporting(true);
    let hasErrors = false;

    // Import each item one by one
    for (let i = 0; i < itemsToImport.length; i++) {
      const draft = itemsToImport[i];

      // Update current item to in-progress
      setBulkImportProgress(prev => ({
        ...prev,
        currentIndex: i,
        items: prev.items.map((item, idx) =>
          idx === i ? { ...item, status: 'in-progress' as const } : item
        ),
      }));

      try {
        // Import single draft
        const result = await xrayApi.import([draft.id], draft.projectKey);
        const testKey = result.testKeys?.[0];
        const testIssueId = result.testIssueIds?.[0];

        // Update item to completed (import phase)
        setBulkImportProgress(prev => ({
          ...prev,
          items: prev.items.map((item, idx) =>
            idx === i ? { ...item, status: 'completed' as const, testKey } : item
          ),
        }));

        // Execute linking if there are links configured and we have a testIssueId
        if (testIssueId && countLinks(draft.xrayLinking) > 0) {
          // Update linking status
          setBulkImportProgress(prev => ({
            ...prev,
            phase: 'linking',
            items: prev.items.map((item, idx) =>
              idx === i ? { ...item, linkingStatus: 'linking' as const } : item
            ),
          }));

          const linkingResult = await executeLinking(testIssueId, draft.xrayLinking);

          if (linkingResult.hasErrors) {
            hasErrors = true;
          }

          // Update item with linking results
          setBulkImportProgress(prev => ({
            ...prev,
            // Restore phase to importing if more items to go
            phase: i < itemsToImport.length - 1 ? 'importing' : prev.phase,
            items: prev.items.map((item, idx) =>
              idx === i ? {
                ...item,
                linkingStatus: 'done' as const,
                linkedItems: linkingResult.linkedItems,
                failedItems: linkingResult.failedItems,
                hasLinkingErrors: linkingResult.hasErrors,
                validation: linkingResult.validation,
              } : item
            ),
          }));
        }
      } catch (err) {
        hasErrors = true;
        const errorMsg = err instanceof Error ? err.message : String(err);

        // Update item to failed
        setBulkImportProgress(prev => ({
          ...prev,
          items: prev.items.map((item, idx) =>
            idx === i ? { ...item, status: 'failed' as const, error: errorMsg } : item
          ),
        }));
        console.error(`Failed to import "${draft.summary}":`, err);
      }

      // Small delay between imports for visual feedback
      if (i < itemsToImport.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    // Mark as complete
    setBulkImportProgress(prev => ({
      ...prev,
      phase: 'complete',
      isComplete: true,
      hasErrors,
    }));

    await refreshDrafts();
    setSelectedIds(new Set());
    setBulkImporting(false);
  };

  const closeBulkImportModal = () => {
    setBulkImportProgress(prev => ({ ...prev, isOpen: false }));
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
                  onClick={handleBulkImport}
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

      {/* Bulk Import Progress Modal */}
      <BulkImportProgressModal
        progress={bulkImportProgress}
        onClose={closeBulkImportModal}
        jiraBaseUrl={config?.jiraBaseUrl}
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
            {(typeof draft.description === 'string' ? draft.description : '') || 'No description'}
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

// Bulk Import Progress Modal Component
function BulkImportProgressModal({
  progress,
  onClose,
  jiraBaseUrl,
}: {
  progress: BulkImportProgress;
  onClose: () => void;
  jiraBaseUrl?: string;
}) {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  if (!progress.isOpen) return null;

  const completedCount = progress.items.filter(i => i.status === 'completed').length;
  const totalCount = progress.items.length;
  // For progress: count items that are fully done (import + linking complete or no links)
  const fullyDoneCount = progress.items.filter(i =>
    (i.status === 'completed' && (i.linkingStatus === 'done' || i.linkingStatus === 'none')) ||
    i.status === 'failed'
  ).length;
  const percentComplete = totalCount > 0 ? Math.round((fullyDoneCount / totalCount) * 100) : 0;

  const successItems = progress.items.filter(i => i.status === 'completed' && i.testKey);
  const importFailedItems = progress.items.filter(i => i.status === 'failed');
  const itemsWithLinkingErrors = progress.items.filter(i => i.hasLinkingErrors);
  const totalLinked = progress.items.reduce((sum, i) => sum + i.linkedItems.length, 0);
  const totalLinkFailed = progress.items.reduce((sum, i) => sum + i.failedItems.length, 0);
  const hasAnyLinks = progress.items.some(i => i.totalLinks > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal */}
      <div className="relative bg-card rounded-xl shadow-2xl w-full max-w-lg border border-border animate-scaleIn">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border text-center">
          <h2 className="text-lg font-semibold text-text-primary">Bulk Import to Xray</h2>
          <p className="text-sm text-accent">
            {progress.phase === 'complete'
              ? `${totalCount} test case${totalCount > 1 ? 's' : ''} processed`
              : `Importing ${totalCount} test case${totalCount > 1 ? 's' : ''}`
            }
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-6 h-[380px] flex flex-col">
          {progress.phase !== 'complete' ? (
            /* Importing/linking phase */
            <>
              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-text-muted">
                    {progress.phase === 'linking' ? 'Linking...' : 'Progress'}
                  </span>
                  <span className="text-accent font-medium">{percentComplete}%</span>
                </div>
                <div className="h-2 bg-sidebar rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all duration-300"
                    style={{ width: `${percentComplete}%` }}
                  />
                </div>
              </div>

              {/* Items list */}
              <div className="flex-1 overflow-y-auto space-y-2">
                {progress.items.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                      item.status === 'in-progress' || item.linkingStatus === 'linking' ? 'bg-accent/10' : ''
                    }`}
                  >
                    {/* Status icon */}
                    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                      {item.status === 'pending' && (
                        <div className="w-2 h-2 rounded-full bg-text-muted" />
                      )}
                      {(item.status === 'in-progress' || item.linkingStatus === 'linking') && (
                        <svg className="w-5 h-5 text-accent animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      )}
                      {item.status === 'completed' && item.linkingStatus !== 'linking' && (
                        <svg className={`w-5 h-5 ${item.hasLinkingErrors ? 'text-amber-500' : 'text-success'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {item.status === 'failed' && (
                        <svg className="w-5 h-5 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </div>

                    {/* Item info */}
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm truncate block ${
                        item.status === 'in-progress' ? 'text-accent font-medium' :
                        item.linkingStatus === 'linking' ? 'text-accent font-medium' :
                        item.status === 'completed' && item.hasLinkingErrors ? 'text-amber-500' :
                        item.status === 'completed' ? 'text-success' :
                        item.status === 'failed' ? 'text-error' :
                        'text-text-muted'
                      }`}>
                        {item.summary}
                      </span>
                      <div className="flex items-center gap-2">
                        {item.testKey && (
                          <span className="text-xs text-text-muted">{item.testKey}</span>
                        )}
                        {item.linkingStatus === 'linking' && (
                          <span className="text-xs text-accent">Linking...</span>
                        )}
                        {item.linkingStatus === 'done' && !item.hasLinkingErrors && item.linkedItems.length > 0 && (
                          <span className="text-xs text-success">{item.linkedItems.length} linked</span>
                        )}
                        {item.linkingStatus === 'done' && item.hasLinkingErrors && (
                          <span className="text-xs text-amber-500">
                            {item.linkedItems.length} linked, {item.failedItems.length} failed
                          </span>
                        )}
                      </div>
                      {item.error && (
                        <span className="text-xs text-error block">{item.error}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* Complete phase */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Summary header */}
              <div className="flex flex-col items-center text-center mb-4 flex-shrink-0">
                {progress.hasErrors ? (
                  <>
                    <div className="w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center mb-3">
                      <svg className="w-7 h-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <span className="text-lg font-semibold text-amber-500">Completed with Warnings</span>
                    <span className="text-sm text-text-muted mt-1">
                      {completedCount} of {totalCount} imported
                      {hasAnyLinks && ` | ${totalLinked} linked${totalLinkFailed > 0 ? `, ${totalLinkFailed} link error${totalLinkFailed > 1 ? 's' : ''}` : ''}`}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-full bg-success/20 flex items-center justify-center mb-3">
                      <svg className="w-7 h-7 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-lg font-semibold text-success">Import Complete!</span>
                    <span className="text-sm text-text-muted mt-1">
                      {completedCount} test case{completedCount > 1 ? 's' : ''} imported
                      {hasAnyLinks && ` | ${totalLinked} link${totalLinked !== 1 ? 's' : ''} created`}
                    </span>
                  </>
                )}
              </div>

              {/* Scrollable results */}
              <div className="flex-1 overflow-y-auto space-y-3">
                {/* Success links */}
                {successItems.length > 0 && (
                  <div className="flex flex-wrap gap-2 justify-center">
                    {successItems.map((item, i) => (
                      item.testKey && jiraBaseUrl ? (
                        <a
                          key={i}
                          href={`${jiraBaseUrl}browse/${item.testKey}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 bg-accent/10 text-accent text-xs rounded hover:bg-accent/20 transition-colors"
                        >
                          {item.testKey}
                        </a>
                      ) : (
                        <span key={i} className="px-2 py-1 bg-accent/10 text-accent text-xs rounded">
                          {item.testKey}
                        </span>
                      )
                    ))}
                  </div>
                )}

                {/* Import failures */}
                {importFailedItems.length > 0 && (
                  <div className="w-full">
                    <p className="text-xs text-red-500 font-medium mb-2">Failed to import:</p>
                    <div className="space-y-1 text-left">
                      {importFailedItems.map((item, i) => (
                        <div key={i} className="text-xs text-red-400 flex items-start gap-2">
                          <span className="flex-shrink-0">•</span>
                          <span>{item.summary}{item.error ? `: ${item.error}` : ''}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Linking errors per item */}
                {itemsWithLinkingErrors.length > 0 && (
                  <div className="w-full">
                    <p className="text-xs text-amber-500 font-medium mb-2">Linking issues:</p>
                    <div className="space-y-2 text-left">
                      {itemsWithLinkingErrors.map((item) => (
                        <div key={item.id} className="border border-amber-500/20 rounded-lg overflow-hidden">
                          <button
                            onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                            className="w-full flex items-center justify-between p-2 text-left hover:bg-amber-500/5 transition-colors"
                          >
                            <span className="text-xs text-amber-400 font-medium truncate">
                              {item.testKey || item.summary}
                              <span className="text-text-muted font-normal ml-1">
                                ({item.linkedItems.length} linked, {item.failedItems.length} failed)
                              </span>
                            </span>
                            <svg
                              className={`w-3.5 h-3.5 text-text-muted flex-shrink-0 transition-transform ${expandedItem === item.id ? 'rotate-180' : ''}`}
                              fill="none" viewBox="0 0 24 24" stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {expandedItem === item.id && (
                            <div className="px-2 pb-2 space-y-1">
                              {item.failedItems.map((fi, j) => (
                                <div key={j} className="text-xs text-red-400 flex items-start gap-2">
                                  <span className="flex-shrink-0">•</span>
                                  <span>{fi.label}: {fi.error}</span>
                                </div>
                              ))}
                              {item.validation && !item.validation.isValidated && (
                                <div className="text-xs text-amber-400 flex items-start gap-2">
                                  <span className="flex-shrink-0">!</span>
                                  <span>Validation could not be completed</span>
                                </div>
                              )}
                              {item.validation?.isValidated && (
                                <>
                                  {item.validation.testPlans.missing.length > 0 && (
                                    <div className="text-xs text-amber-400 flex items-start gap-2">
                                      <span className="flex-shrink-0">!</span>
                                      <span>Missing test plans: {item.validation.testPlans.missing.length}</span>
                                    </div>
                                  )}
                                  {item.validation.testExecutions.missing.length > 0 && (
                                    <div className="text-xs text-amber-400 flex items-start gap-2">
                                      <span className="flex-shrink-0">!</span>
                                      <span>Missing test executions: {item.validation.testExecutions.missing.length}</span>
                                    </div>
                                  )}
                                  {item.validation.testSets.missing.length > 0 && (
                                    <div className="text-xs text-amber-400 flex items-start gap-2">
                                      <span className="flex-shrink-0">!</span>
                                      <span>Missing test sets: {item.validation.testSets.missing.length}</span>
                                    </div>
                                  )}
                                  {item.validation.preconditions.missing.length > 0 && (
                                    <div className="text-xs text-amber-400 flex items-start gap-2">
                                      <span className="flex-shrink-0">!</span>
                                      <span>Missing preconditions: {item.validation.preconditions.missing.length}</span>
                                    </div>
                                  )}
                                  {!item.validation.folder.valid && (
                                    <div className="text-xs text-amber-400 flex items-start gap-2">
                                      <span className="flex-shrink-0">!</span>
                                      <span>Folder not verified: expected {item.validation.folder.expected}</span>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer - Only show when complete */}
        {progress.phase === 'complete' && (
          <div className="px-6 py-4 border-t border-border flex justify-center">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors font-medium"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

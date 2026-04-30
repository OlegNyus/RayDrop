import { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import { xrayApi, coverageApi } from '../../../services/api';
import type { FolderNode } from '../../../services/api';
import { Card } from '../../ui';
import type { CoverageTestCase } from '../../../types';

type SyncState = 'not-synced' | 'synced' | 'syncing' | 'error';

interface SyncInfo {
  state: SyncState;
  lastSyncedAt?: string;
  testCount?: number;
}

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function slugifyPath(p: string): string {
  return p.toLowerCase().replace(/^\//, '').replace(/\//g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-');
}

function countLeafFolders(nodes: FolderNode[]): number {
  let count = 0;
  for (const n of nodes) {
    if (!n.folders?.length) count++;
    else count += countLeafFolders(n.folders);
  }
  return count;
}

function collectLeafPaths(nodes: FolderNode[], projectKey?: string): string[] {
  const paths: string[] = [];
  for (const n of nodes) {
    if (!n.folders?.length) {
      if (!projectKey || n.path.includes(`/${projectKey}`)) {
        paths.push(n.path);
      }
    } else {
      paths.push(...collectLeafPaths(n.folders, projectKey));
    }
  }
  return paths;
}

export function CoveragePage() {
  const { activeProject, isConfigured } = useApp();

  const [folderTree, setFolderTree] = useState<FolderNode[]>([]);
  const [projectId, setProjectId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedFolderName, setSelectedFolderName] = useState('');
  const [previewTests, setPreviewTests] = useState<CoverageTestCase[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [syncingAll, setSyncingAll] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [lastFullSync, setLastFullSync] = useState<string | null>(null);

  // Sync status per folder path
  const [syncMap, setSyncMap] = useState<Map<string, SyncInfo>>(new Map());

  // Expanded tree nodes
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Load folder tree + snapshot statuses
  useEffect(() => {
    if (!activeProject || !isConfigured) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      setSelectedFolder(null);
      setPreviewTests([]);
      setSearchQuery('');

      try {
        const [{ projectId: pid }, statuses] = await Promise.all([
          xrayApi.getProjectId(activeProject),
          coverageApi.getSnapshotStatuses(activeProject),
        ]);

        setProjectId(pid);

        const rootFolder = await xrayApi.getFolders(pid, '/');
        setFolderTree(rootFolder.folders || []);

        // Build sync status map from stored snapshots
        const map = new Map<string, SyncInfo>();
        for (const s of statuses) {
          map.set(s.folderPath, {
            state: 'synced',
            lastSyncedAt: s.lastSyncedAt,
            testCount: s.testCount,
          });
        }
        setSyncMap(map);

        // Derive last full sync from stored snapshots
        const leafSet = new Set(collectLeafPaths(rootFolder.folders || [], activeProject));
        const allLeafsSynced = leafSet.size > 0 && [...leafSet].every(p => map.has(p));
        if (allLeafsSynced) {
          const oldest = Math.min(...[...leafSet].map(p => new Date(map.get(p)!.lastSyncedAt!).getTime()));
          setLastFullSync(new Date(oldest).toISOString());
        }

        // Auto-expand first level
        const firstLevel = new Set<string>();
        for (const node of rootFolder.folders || []) {
          if (node.folders?.length) firstLevel.add(node.path);
        }
        setExpanded(firstLevel);
      } catch (err) {
        setError('Failed to load folders. Check your Xray connection.');
        console.error('Failed to load coverage data:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [activeProject, isConfigured]);

  const getSyncInfo = useCallback((path: string): SyncInfo => {
    return syncMap.get(path) || { state: 'not-synced' };
  }, [syncMap]);

  // Toggle tree node expansion
  const toggleExpand = useCallback((path: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  // Sync a single folder
  const syncFolder = useCallback(async (folderPath: string) => {
    if (!activeProject || !projectId) return false;

    setSyncMap(prev => {
      const next = new Map(prev);
      next.set(folderPath, { ...prev.get(folderPath), state: 'syncing' });
      return next;
    });

    try {
      const result = await coverageApi.syncFolder(projectId, folderPath, activeProject);

      setSyncMap(prev => {
        const next = new Map(prev);
        next.set(folderPath, {
          state: 'synced',
          lastSyncedAt: result.metadata.lastSyncedAt,
          testCount: result.metadata.testCount,
        });
        return next;
      });

      if (selectedFolder === folderPath) {
        setPreviewTests(result.tests);
      }

      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setSyncMap(prev => {
        const next = new Map(prev);
        const existing = prev.get(folderPath);
        next.set(folderPath, {
          state: existing?.lastSyncedAt ? 'synced' : 'error',
          lastSyncedAt: existing?.lastSyncedAt,
          testCount: existing?.testCount,
        });
        return next;
      });
      showToast(`Failed to sync: ${errorMsg}`, 'error');
      return false;
    }
  }, [activeProject, projectId, selectedFolder, showToast]);

  const syncAll = useCallback(async () => {
    if (!activeProject || !projectId || syncingAll) return;
    setSyncingAll(true);

    const allPaths = collectLeafPaths(folderTree, activeProject);
    let success = 0;
    let failed = 0;
    const CONCURRENCY = 3;

    for (let i = 0; i < allPaths.length; i += CONCURRENCY) {
      const batch = allPaths.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(batch.map(p => syncFolder(p)));
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) success++;
        else failed++;
      }
    }

    setSyncingAll(false);
    if (failed === 0) {
      setLastFullSync(new Date().toISOString());
      showToast(`Synced ${success}/${allPaths.length} folders.`, 'success');
    } else {
      showToast(`Synced ${success}/${allPaths.length} folders. ${failed} failed.`, 'info');
    }
  }, [activeProject, projectId, syncingAll, folderTree, syncFolder, showToast]);

  // Select folder and load preview
  const selectFolder = useCallback(async (folderPath: string, folderName: string) => {
    setSelectedFolder(folderPath);
    setSelectedFolderName(folderName);
    setSearchQuery('');

    const info = syncMap.get(folderPath);
    if (!info || info.state !== 'synced' || !activeProject) {
      setPreviewTests([]);
      return;
    }

    try {
      const snapshot = await coverageApi.getSnapshot(activeProject, folderPath);
      if (snapshot) {
        setPreviewTests(snapshot.tests);
      } else {
        setPreviewTests([]);
      }
    } catch {
      setPreviewTests([]);
    }
  }, [syncMap, activeProject]);

  // Download helpers
  const downloadJson = useCallback((data: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  const downloadFolder = useCallback(async (folderPath: string) => {
    if (!activeProject) return;
    try {
      const tests = await coverageApi.exportFolder(activeProject, folderPath);
      downloadJson(tests, `${slugifyPath(folderPath)}.json`);
    } catch {
      showToast('Failed to download', 'error');
    }
  }, [activeProject, downloadJson, showToast]);

  const exportJson = useCallback(async () => {
    if (!activeProject) return;
    try {
      const tests = await coverageApi.exportAll(activeProject);
      downloadJson(tests, `${activeProject}-coverage.json`);
      showToast(`Exported ${tests.length} test cases`, 'success');
    } catch {
      showToast('Failed to export', 'error');
    }
  }, [activeProject, downloadJson, showToast]);

  // Filtered preview tests
  const filteredTests = useMemo(() => {
    if (!searchQuery) return previewTests;
    const q = searchQuery.toLowerCase();
    return previewTests.filter(t =>
      t.key.toLowerCase().includes(q) || t.summary.toLowerCase().includes(q)
    );
  }, [previewTests, searchQuery]);

  const leafPaths = useMemo(() => new Set(collectLeafPaths(folderTree, activeProject ?? undefined)), [folderTree, activeProject]);
  const leafFolderCount = leafPaths.size;
  const syncedCount = useMemo(() => {
    let count = 0;
    syncMap.forEach((v, path) => { if (v.state === 'synced' && leafPaths.has(path)) count++; });
    return count;
  }, [syncMap, leafPaths]);
  const hasSynced = syncedCount > 0;
  const failedCount = useMemo(() => {
    let count = 0;
    syncMap.forEach((v, path) => { if (v.state === 'error' && leafPaths.has(path)) count++; });
    return count;
  }, [syncMap, leafPaths]);
  const totalTestCasesSynced = useMemo(() => {
    let count = 0;
    syncMap.forEach((v, path) => { if (v.state === 'synced' && v.testCount && leafPaths.has(path)) count += v.testCount; });
    return count;
  }, [syncMap, leafPaths]);
  const syncProgress = leafFolderCount > 0 ? Math.round((syncedCount / leafFolderCount) * 100) : 0;

  const selectedSyncInfo = selectedFolder ? getSyncInfo(selectedFolder) : undefined;

  // No config or no project
  if (!isConfigured) return null;
  if (!activeProject) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="coverage-page">
        <div className="text-center" data-testid="coverage-empty-state">
          <p className="text-lg font-medium text-text-primary mb-2">Select a project to view coverage</p>
          <p className="text-sm text-text-secondary">Choose a project from the sidebar to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-6 py-6" data-testid="coverage-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Coverage</h1>
          <p className="text-sm text-text-secondary mt-1">Sync Xray test cases by folder</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            data-testid="coverage-sync-all-btn"
            onClick={syncAll}
            disabled={syncingAll || loading || leafFolderCount === 0}
            className={`px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white transition-colors flex items-center gap-2 ${
              syncingAll || loading ? 'opacity-75 cursor-not-allowed' : 'hover:bg-accent-hover'
            }`}
          >
            {syncingAll ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            )}
            {syncingAll ? 'Syncing...' : 'Sync All'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex gap-6" style={{ minHeight: 'calc(100vh - 180px)' }}>
        {/* Left Panel: Folder Tree */}
        <div className="w-80 flex-shrink-0">
          <div className="bg-card border border-border rounded-lg" data-testid="coverage-folder-tree">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-text-primary">Folders</span>
                {leafFolderCount > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-badge-bg text-badge-text">{leafFolderCount}</span>
                )}
              </div>
            </div>

            <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <svg className="w-6 h-6 animate-spin text-accent" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                </div>
              ) : error ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-error mb-3">{error}</p>
                  <button onClick={() => window.location.reload()} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent-hover">Retry</button>
                </div>
              ) : folderTree.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-text-muted">No folders found</p>
                </div>
              ) : (
                <div className="py-1">
                  {folderTree.map(node => (
                    <FolderTreeNode
                      key={node.path}
                      node={node}
                      depth={0}
                      expanded={expanded}
                      toggleExpand={toggleExpand}
                      selectedFolder={selectedFolder}
                      selectFolder={selectFolder}
                      syncFolder={syncFolder}
                      downloadFolder={downloadFolder}
                      getSyncInfo={getSyncInfo}
                    />
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Sync Summary — separate card below folder tree */}
          {leafFolderCount > 0 && (
            <div className="mt-3 bg-card border border-border rounded-lg" data-testid="coverage-sync-summary">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-xs font-semibold text-text-primary uppercase tracking-wider">Sync Summary</p>
              </div>
              <div className="px-4 py-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary">Xray folders</span>
                  <span className="text-text-primary font-medium tabular-nums">{leafFolderCount}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary">Folders synced</span>
                  <span className="text-text-primary font-medium tabular-nums">{syncedCount} / {leafFolderCount}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary">Test cases synced</span>
                  {syncingAll ? (
                    <span className="text-accent text-[10px] animate-pulse">syncing...</span>
                  ) : (
                    <span className="text-text-primary font-medium tabular-nums">{totalTestCasesSynced}</span>
                  )}
                </div>
                {failedCount > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-secondary">Failed</span>
                    <span className="text-error font-medium tabular-nums">{failedCount}</span>
                  </div>
                )}
                <div className="w-full h-1.5 bg-sidebar rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-success rounded-full transition-all" style={{ width: `${syncProgress}%` }} />
                </div>
              </div>
              <div className="px-4 py-2.5 border-t border-border flex items-center justify-between text-[10px] text-text-muted">
                <span>{lastFullSync ? `Last full sync: ${formatRelativeTime(lastFullSync)}` : 'Last full sync: never'}</span>
                {hasSynced && (
                  <button
                    onClick={exportJson}
                    className="text-accent hover:underline"
                    data-testid="coverage-export-json-btn"
                  >
                    Export JSON
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Preview Table */}
        <div className="flex-1 min-w-0">
          {!selectedFolder ? (
            <Card padding="none">
              <div className="flex flex-col items-center justify-center py-24 text-center" data-testid="coverage-empty-state">
                <svg className="w-12 h-12 text-text-muted mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
                <p className="text-lg font-medium text-text-primary mb-2">Select a folder</p>
                <p className="text-sm text-text-secondary">Choose a folder from the tree to view its test cases</p>
              </div>
            </Card>
          ) : selectedSyncInfo?.state === 'not-synced' || selectedSyncInfo?.state === 'error' ? (
            <Card padding="none">
              <div className="flex flex-col items-center justify-center py-24 text-center" data-testid="coverage-empty-state">
                <svg className="w-12 h-12 text-text-muted mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                <p className="text-lg font-medium text-text-primary mb-2">Folder not synced</p>
                <p className="text-sm text-text-secondary mb-4">Click the sync button to pull test cases from Xray</p>
                <button onClick={() => syncFolder(selectedFolder)} className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors">Sync Now</button>
              </div>
            </Card>
          ) : selectedSyncInfo?.state === 'syncing' ? (
            <Card padding="none">
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <svg className="w-8 h-8 animate-spin text-accent mb-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                <p className="text-sm text-text-secondary">Syncing {selectedFolderName}...</p>
              </div>
            </Card>
          ) : (
            <div className="bg-card border border-border rounded-lg" data-testid="coverage-preview-table">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-semibold text-text-primary">{selectedFolderName}</span>
                  <span className="text-xs text-text-muted hidden sm:inline">{selectedFolder}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-badge-bg text-badge-text">{previewTests.length} tests</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    <input
                      type="text"
                      placeholder="Search tests..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      data-testid="coverage-preview-search-input"
                      className="w-48 pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-card text-text-primary placeholder-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                    />
                  </div>
                  <button
                    onClick={() => downloadFolder(selectedFolder)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-card text-text-primary border border-border hover:bg-sidebar-hover transition-colors flex items-center gap-1.5"
                    data-testid={`coverage-folder-download-${slugifyPath(selectedFolder)}-btn`}
                    title={`Download ${selectedFolderName} as JSON`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                    Download
                  </button>
                </div>
              </div>

              {previewTests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="coverage-empty-state">
                  <p className="text-lg font-medium text-text-primary mb-2">No test cases</p>
                  <p className="text-sm text-text-secondary">This folder has no test cases in Xray</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-sidebar border-b border-border">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider w-28">Key</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Summary</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider w-24">Priority</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider w-44">Automation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTests.length === 0 ? (
                          <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-text-muted">No test cases match your search</td></tr>
                        ) : (
                          filteredTests.map(tc => (
                            <tr key={tc.key} data-testid={`coverage-preview-row-${tc.key}`} className="border-b border-border last:border-b-0 hover:bg-sidebar-hover transition-colors">
                              <td className="px-4 py-2.5 text-sm"><span className="text-accent font-medium">{tc.key}</span></td>
                              <td className="px-4 py-2.5 text-sm text-text-primary">{tc.summary}</td>
                              <td className="px-4 py-2.5"><PriorityBadge priority={tc.priority} /></td>
                              <td className="px-4 py-2.5"><AutomationBadge status={tc.automation_status} /></td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="px-4 py-3 border-t border-border flex items-center justify-between text-xs text-text-muted">
                    <span>
                      {searchQuery
                        ? `Showing ${filteredTests.length} of ${previewTests.length} test cases (filtered)`
                        : `${previewTests.length} test cases`
                      }
                    </span>
                    {selectedSyncInfo?.lastSyncedAt && (
                      <span>Last synced: {new Date(selectedSyncInfo.lastSyncedAt).toLocaleString()}</span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-fadeIn">
          <div className={`px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm text-white ${
            toast.type === 'success' ? 'bg-success' : toast.type === 'error' ? 'bg-error' : 'bg-info'
          }`}>
            {toast.type === 'success' && <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>}
            {toast.type === 'error' && <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>}
            {toast.type === 'info' && <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

    </div>
  );
}

// ============ Folder Tree Node (recursive) ============

interface FolderTreeNodeProps {
  node: FolderNode;
  depth: number;
  expanded: Set<string>;
  toggleExpand: (path: string) => void;
  selectedFolder: string | null;
  selectFolder: (path: string, name: string) => void;
  syncFolder: (path: string) => void;
  downloadFolder: (path: string) => void;
  getSyncInfo: (path: string) => SyncInfo;
}

function FolderTreeNode({ node, depth, expanded, toggleExpand, selectedFolder, selectFolder, syncFolder, downloadFolder, getSyncInfo }: FolderTreeNodeProps) {
  const hasChildren = node.folders && node.folders.length > 0;
  const isExpanded = expanded.has(node.path);
  const isSelected = selectedFolder === node.path;
  const info = getSyncInfo(node.path);
  const slug = slugifyPath(node.path);

  return (
    <>
      <div
        data-testid={`coverage-folder-${slug}`}
        onClick={() => selectFolder(node.path, node.name)}
        className={`group flex items-center py-1.5 pr-3 cursor-pointer transition-colors ${
          isSelected ? 'bg-accent/10 border-l-2 border-accent' : 'hover:bg-sidebar-hover border-l-2 border-transparent'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {/* Expand/collapse arrow */}
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); toggleExpand(node.path); }}
            className="p-0.5 rounded text-text-muted hover:text-text-primary flex-shrink-0 mr-1.5"
          >
            <svg className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <span className="w-5 flex-shrink-0 mr-1.5" />
        )}

        {/* Sync status dot */}
        {info.state === 'syncing' ? (
          <span className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin flex-shrink-0 mr-2" data-testid={`coverage-folder-status-${slug}`} />
        ) : (
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 mr-2 ${
              info.state === 'synced' ? 'bg-success' :
              info.state === 'error' ? 'bg-error' :
              'bg-gray-400 dark:bg-gray-600'
            }`}
            data-testid={`coverage-folder-status-${slug}`}
          />
        )}

        {/* Folder name */}
        <span className={`text-sm flex-1 truncate ${isSelected ? 'text-text-primary font-medium' : 'text-text-secondary'}`}>
          {node.name}
        </span>

        {/* Right side: test count + actions (show on hover) */}
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          {/* Test count */}
          {(node.testsCount ?? 0) > 0 && (
            <span className="text-[10px] text-text-muted tabular-nums">{node.testsCount}</span>
          )}

          {/* Error label */}
          {info.state === 'error' && (
            <span className="text-[10px] text-error">failed</span>
          )}

          {/* Sync button — visible on hover */}
          {info.state !== 'syncing' && (
            <button
              data-testid={`coverage-folder-sync-${slug}-btn`}
              onClick={(e) => { e.stopPropagation(); syncFolder(node.path); }}
              className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                info.state === 'error' ? 'text-error hover:bg-sidebar-hover' : 'text-text-muted hover:text-accent hover:bg-sidebar-hover'
              }`}
              title={info.state === 'error' ? 'Retry' : info.state === 'synced' ? 'Re-sync' : 'Sync'}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            </button>
          )}

          {/* Download — visible on hover, synced only */}
          {info.state === 'synced' && (
            <button
              data-testid={`coverage-folder-download-${slug}-btn`}
              onClick={(e) => { e.stopPropagation(); downloadFolder(node.path); }}
              className="p-1 rounded text-text-muted hover:text-accent hover:bg-sidebar-hover transition-opacity opacity-0 group-hover:opacity-100"
              title="Download JSON"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        node.folders.map(child => (
          <FolderTreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            toggleExpand={toggleExpand}
            selectedFolder={selectedFolder}
            selectFolder={selectFolder}
            syncFolder={syncFolder}
            downloadFolder={downloadFolder}
            getSyncInfo={getSyncInfo}
          />
        ))
      )}
    </>
  );
}

// ============ Badge Components ============

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    Highest: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    High: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    Medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    Low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    Lowest: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full ${colors[priority] || colors.Medium}`}>{priority}</span>;
}

function AutomationBadge({ status }: { status: string }) {
  if (status === 'Automated') {
    return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Automated</span>;
  }
  if (status === 'Planned for Automation') {
    return <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Planned</span>;
  }
  return <span className="text-xs px-2 py-0.5 rounded-full bg-badge-bg text-badge-text">{status}</span>;
}

import { useState, useCallback } from 'react';
import { xrayApi } from '../services/api';
import type { Draft } from '../types';

// Import progress tracking types
export interface ImportStep {
  id: string;
  label: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  error?: string;
}

export interface ValidationResult {
  isValidated: boolean;
  testPlans: { expected: string[]; found: string[]; missing: string[] };
  testExecutions: { expected: string[]; found: string[]; missing: string[] };
  testSets: { expected: string[]; found: string[]; missing: string[] };
  preconditions: { expected: string[]; found: string[]; missing: string[] };
  folder: { expected: string | null; found: string | null; valid: boolean };
}

export interface LinkedItem {
  label: string;
  key?: string;
  type: 'plan' | 'execution' | 'set' | 'folder' | 'precondition';
}

export interface FailedItem {
  label: string;
  error: string;
}

export interface ImportProgress {
  isOpen: boolean;
  phase: 'importing' | 'validating' | 'complete';
  steps: ImportStep[];
  currentStepIndex: number;
  testKey: string | null;
  testIssueId: string | null;
  linkedItems: LinkedItem[];
  failedItems: FailedItem[];
  isComplete: boolean;
  hasErrors: boolean;
  validation: ValidationResult | null;
  isReusable?: boolean;
}

export interface LinkingResult {
  linkedItems: LinkedItem[];
  failedItems: FailedItem[];
  hasErrors: boolean;
  validation: ValidationResult | null;
}

export interface ImportResult {
  success: boolean;
  testKey?: string;
  testIssueId?: string;
  error?: string;
}

const initialProgress: ImportProgress = {
  isOpen: false,
  phase: 'importing',
  steps: [],
  currentStepIndex: -1,
  testKey: null,
  testIssueId: null,
  linkedItems: [],
  failedItems: [],
  isComplete: false,
  hasErrors: false,
  validation: null,
};

// Helper to count total links configured in xrayLinking
export function countLinks(xrayLinking: Draft['xrayLinking']): number {
  let count = 0;
  count += xrayLinking.testPlanIds.length;
  count += xrayLinking.testExecutionIds.length;
  count += xrayLinking.testSetIds.length;
  if (xrayLinking.folderPath && xrayLinking.projectId) count += 1;
  if (xrayLinking.preconditionIds.length > 0) count += 1;
  return count;
}

// Standalone helper for link creation + validation (no React state)
export async function executeLinking(
  testIssueId: string,
  xrayLinking: Draft['xrayLinking'],
): Promise<LinkingResult> {
  const linkedItems: LinkedItem[] = [];
  const failedItems: FailedItem[] = [];
  let hasErrors = false;

  // Link to test plans
  for (let i = 0; i < xrayLinking.testPlanIds.length; i++) {
    const testPlanId = xrayLinking.testPlanIds[i];
    const display = xrayLinking.testPlanDisplays[i]?.display || testPlanId;
    const key = display.split(':')[0]?.trim();
    try {
      await xrayApi.addTestsToTestPlan(testPlanId, [testIssueId]);
      linkedItems.push({ label: display, key, type: 'plan' });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      failedItems.push({ label: `Test Plan: ${display}`, error: errorMsg });
      hasErrors = true;
    }
  }

  // Link to test executions
  for (let i = 0; i < xrayLinking.testExecutionIds.length; i++) {
    const testExecutionId = xrayLinking.testExecutionIds[i];
    const display = xrayLinking.testExecutionDisplays[i]?.display || testExecutionId;
    const key = display.split(':')[0]?.trim();
    try {
      await xrayApi.addTestsToTestExecution(testExecutionId, [testIssueId]);
      linkedItems.push({ label: display, key, type: 'execution' });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      failedItems.push({ label: `Test Execution: ${display}`, error: errorMsg });
      hasErrors = true;
    }
  }

  // Link to test sets
  for (let i = 0; i < xrayLinking.testSetIds.length; i++) {
    const testSetId = xrayLinking.testSetIds[i];
    const display = xrayLinking.testSetDisplays[i]?.display || testSetId;
    const key = display.split(':')[0]?.trim();
    try {
      await xrayApi.addTestsToTestSet(testSetId, [testIssueId]);
      linkedItems.push({ label: display, key, type: 'set' });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      failedItems.push({ label: `Test Set: ${display}`, error: errorMsg });
      hasErrors = true;
    }
  }

  // Link to folder
  if (xrayLinking.folderPath && xrayLinking.projectId) {
    try {
      await xrayApi.addTestsToFolder(
        xrayLinking.projectId,
        xrayLinking.folderPath,
        [testIssueId]
      );
      linkedItems.push({ label: xrayLinking.folderPath, type: 'folder' });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      failedItems.push({ label: `Folder: ${xrayLinking.folderPath}`, error: errorMsg });
      hasErrors = true;
    }
  }

  // Link preconditions
  if (xrayLinking.preconditionIds.length > 0) {
    try {
      await xrayApi.addPreconditionsToTest(testIssueId, xrayLinking.preconditionIds);
      linkedItems.push({ label: `${xrayLinking.preconditionIds.length} precondition(s)`, type: 'precondition' });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      failedItems.push({ label: 'Preconditions', error: errorMsg });
      hasErrors = true;
    }
  }

  // Validation
  let validation: ValidationResult | null = null;
  try {
    const testLinks = await xrayApi.getTestLinks(testIssueId);

    const expectedPlanIds = xrayLinking.testPlanIds;
    const expectedExecIds = xrayLinking.testExecutionIds;
    const expectedSetIds = xrayLinking.testSetIds;
    const expectedPreconditionIds = xrayLinking.preconditionIds;
    const expectedFolder = xrayLinking.folderPath !== '/' ? xrayLinking.folderPath : null;

    const foundPlanIds = testLinks.testPlans.map(p => p.issueId);
    const foundExecIds = testLinks.testExecutions.map(e => e.issueId);
    const foundSetIds = testLinks.testSets.map(s => s.issueId);
    const foundPreconditionIds = testLinks.preconditions.map(p => p.issueId);
    const foundFolder = testLinks.folder || null;

    const missingPlanIds = expectedPlanIds.filter(id => !foundPlanIds.includes(id));
    const missingExecIds = expectedExecIds.filter(id => !foundExecIds.includes(id));
    const missingSetIds = expectedSetIds.filter(id => !foundSetIds.includes(id));
    const missingPreconditionIds = expectedPreconditionIds.filter(id => !foundPreconditionIds.includes(id));

    validation = {
      isValidated: true,
      testPlans: { expected: expectedPlanIds, found: foundPlanIds, missing: missingPlanIds },
      testExecutions: { expected: expectedExecIds, found: foundExecIds, missing: missingExecIds },
      testSets: { expected: expectedSetIds, found: foundSetIds, missing: missingSetIds },
      preconditions: { expected: expectedPreconditionIds, found: foundPreconditionIds, missing: missingPreconditionIds },
      folder: {
        expected: expectedFolder,
        found: foundFolder,
        valid: !expectedFolder || (foundFolder?.includes(expectedFolder) ?? false),
      },
    };

    const hasMissingLinks =
      missingPlanIds.length > 0 ||
      missingExecIds.length > 0 ||
      missingSetIds.length > 0 ||
      missingPreconditionIds.length > 0 ||
      (expectedFolder && !validation.folder.valid);

    if (hasMissingLinks) {
      hasErrors = true;
    }
  } catch (validationErr) {
    console.error('Validation failed:', validationErr);
    validation = {
      isValidated: false,
      testPlans: { expected: [], found: [], missing: [] },
      testExecutions: { expected: [], found: [], missing: [] },
      testSets: { expected: [], found: [], missing: [] },
      preconditions: { expected: [], found: [], missing: [] },
      folder: { expected: null, found: null, valid: true },
    };
  }

  return { linkedItems, failedItems, hasErrors, validation };
}

export function useImportToXray() {
  const [importProgress, setImportProgress] = useState<ImportProgress>(initialProgress);
  const [importing, setImporting] = useState(false);

  // Build the steps list for progress tracking
  const buildProgressSteps = useCallback((xrayLinking: Draft['xrayLinking'], isReusable?: boolean): ImportStep[] => {
    const progressSteps: ImportStep[] = [
      { id: 'create', label: isReusable ? 'Updating test in Jira...' : 'Creating test in Jira...', status: 'pending' },
    ];

    // Add test plan steps
    xrayLinking.testPlanIds.forEach((_, i) => {
      const display = xrayLinking.testPlanDisplays[i]?.display || 'Test Plan';
      progressSteps.push({
        id: `plan-${i}`,
        label: `Linking to ${display}...`,
        status: 'pending',
      });
    });

    // Add test execution steps
    xrayLinking.testExecutionIds.forEach((_, i) => {
      const display = xrayLinking.testExecutionDisplays[i]?.display || 'Test Execution';
      progressSteps.push({
        id: `exec-${i}`,
        label: `Linking to ${display}...`,
        status: 'pending',
      });
    });

    // Add test set steps
    xrayLinking.testSetIds.forEach((_, i) => {
      const display = xrayLinking.testSetDisplays[i]?.display || 'Test Set';
      progressSteps.push({
        id: `set-${i}`,
        label: `Linking to ${display}...`,
        status: 'pending',
      });
    });

    // Add folder step if configured
    if (xrayLinking.folderPath && xrayLinking.projectId) {
      progressSteps.push({
        id: 'folder',
        label: `Adding to folder ${xrayLinking.folderPath}...`,
        status: 'pending',
      });
    }

    // Add preconditions step if any
    if (xrayLinking.preconditionIds.length > 0) {
      progressSteps.push({
        id: 'preconditions',
        label: `Linking ${xrayLinking.preconditionIds.length} precondition(s)...`,
        status: 'pending',
      });
    }

    return progressSteps;
  }, []);

  // Helper to update a specific step
  const updateStep = useCallback((stepId: string, status: ImportStep['status'], error?: string) => {
    setImportProgress(prev => ({
      ...prev,
      steps: prev.steps.map(s => s.id === stepId ? { ...s, status, error } : s),
    }));
  }, []);

  // Helper to advance to next step
  const advanceStep = useCallback(() => {
    setImportProgress(prev => ({
      ...prev,
      currentStepIndex: prev.currentStepIndex + 1,
    }));
  }, []);

  // Start import with progress tracking
  const startImport = useCallback((xrayLinking: Draft['xrayLinking'], isReusable?: boolean) => {
    setImporting(true);
    setImportProgress({
      isOpen: true,
      phase: 'importing',
      steps: buildProgressSteps(xrayLinking, isReusable),
      currentStepIndex: 0,
      testKey: null,
      testIssueId: null,
      linkedItems: [],
      failedItems: [],
      isComplete: false,
      hasErrors: false,
      validation: null,
      isReusable,
    });
  }, [buildProgressSteps]);

  // Execute the import and linking operations
  const executeImport = useCallback(async (
    draftId: string,
    projectKey: string,
    xrayLinking: Draft['xrayLinking'],
    isReusable?: boolean
  ): Promise<ImportResult> => {
    try {
      // Step: Create or update test in Jira
      updateStep('create', 'in-progress');
      const importResult = isReusable
        ? await xrayApi.updateTest(draftId)
        : await xrayApi.import([draftId], projectKey);

      if (!importResult.success || !importResult.testIssueIds || !importResult.testKeys) {
        updateStep('create', 'failed', importResult.error || (isReusable ? 'Update failed' : 'Import failed'));
        throw new Error(importResult.error || (isReusable ? 'Update failed' : 'Import failed'));
      }

      const testIssueId = importResult.testIssueIds[0];
      const testKey = importResult.testKeys[0];

      updateStep('create', 'completed');
      setImportProgress(prev => ({ ...prev, testKey, testIssueId }));
      advanceStep();

      // Mark linking steps as in-progress/completed/failed in the UI
      // while delegating actual work to executeLinking helper
      const stepIds: string[] = [];
      xrayLinking.testPlanIds.forEach((_, i) => stepIds.push(`plan-${i}`));
      xrayLinking.testExecutionIds.forEach((_, i) => stepIds.push(`exec-${i}`));
      xrayLinking.testSetIds.forEach((_, i) => stepIds.push(`set-${i}`));
      if (xrayLinking.folderPath && xrayLinking.projectId) stepIds.push('folder');
      if (xrayLinking.preconditionIds.length > 0) stepIds.push('preconditions');

      // Mark all linking steps as in-progress
      stepIds.forEach(id => updateStep(id, 'in-progress'));

      // Delegate linking + validation to the standalone helper
      const linkingResult = await executeLinking(testIssueId, xrayLinking);

      // Map linking results back to step UI status
      const failedLabels = new Map(linkingResult.failedItems.map(f => [f.label, f.error]));

      // Update plan steps
      xrayLinking.testPlanIds.forEach((_, i) => {
        const display = xrayLinking.testPlanDisplays[i]?.display || xrayLinking.testPlanIds[i];
        const failedLabel = `Test Plan: ${display}`;
        if (failedLabels.has(failedLabel)) {
          updateStep(`plan-${i}`, 'failed', failedLabels.get(failedLabel));
        } else {
          updateStep(`plan-${i}`, 'completed');
        }
        advanceStep();
      });

      // Update execution steps
      xrayLinking.testExecutionIds.forEach((_, i) => {
        const display = xrayLinking.testExecutionDisplays[i]?.display || xrayLinking.testExecutionIds[i];
        const failedLabel = `Test Execution: ${display}`;
        if (failedLabels.has(failedLabel)) {
          updateStep(`exec-${i}`, 'failed', failedLabels.get(failedLabel));
        } else {
          updateStep(`exec-${i}`, 'completed');
        }
        advanceStep();
      });

      // Update set steps
      xrayLinking.testSetIds.forEach((_, i) => {
        const display = xrayLinking.testSetDisplays[i]?.display || xrayLinking.testSetIds[i];
        const failedLabel = `Test Set: ${display}`;
        if (failedLabels.has(failedLabel)) {
          updateStep(`set-${i}`, 'failed', failedLabels.get(failedLabel));
        } else {
          updateStep(`set-${i}`, 'completed');
        }
        advanceStep();
      });

      // Update folder step
      if (xrayLinking.folderPath && xrayLinking.projectId) {
        const failedLabel = `Folder: ${xrayLinking.folderPath}`;
        if (failedLabels.has(failedLabel)) {
          updateStep('folder', 'failed', failedLabels.get(failedLabel));
        } else {
          updateStep('folder', 'completed');
        }
        advanceStep();
      }

      // Update preconditions step
      if (xrayLinking.preconditionIds.length > 0) {
        if (failedLabels.has('Preconditions')) {
          updateStep('preconditions', 'failed', failedLabels.get('Preconditions'));
        } else {
          updateStep('preconditions', 'completed');
        }
        advanceStep();
      }

      // Update final progress state
      setImportProgress(prev => ({
        ...prev,
        phase: 'complete',
        linkedItems: linkingResult.linkedItems,
        failedItems: linkingResult.failedItems,
        isComplete: true,
        hasErrors: linkingResult.hasErrors,
        validation: linkingResult.validation,
      }));

      setImporting(false);
      return { success: true, testKey, testIssueId };
    } catch (err) {
      console.error('Failed to import to Xray:', err);
      setImportProgress(prev => ({
        ...prev,
        phase: 'complete',
        isComplete: true,
        hasErrors: true,
      }));
      setImporting(false);
      return { success: false, error: err instanceof Error ? err.message : 'Import failed' };
    }
  }, [updateStep, advanceStep]);

  // Close the modal
  const closeModal = useCallback(() => {
    setImportProgress(prev => ({ ...prev, isOpen: false }));
  }, []);

  // Reset to initial state
  const reset = useCallback(() => {
    setImportProgress(initialProgress);
    setImporting(false);
  }, []);

  return {
    importProgress,
    importing,
    startImport,
    executeImport,
    closeModal,
    reset,
  };
}

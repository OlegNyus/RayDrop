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

export function useImportToXray() {
  const [importProgress, setImportProgress] = useState<ImportProgress>(initialProgress);
  const [importing, setImporting] = useState(false);

  // Build the steps list for progress tracking
  const buildProgressSteps = useCallback((xrayLinking: Draft['xrayLinking']): ImportStep[] => {
    const progressSteps: ImportStep[] = [
      { id: 'create', label: 'Creating test in Jira...', status: 'pending' },
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
  const startImport = useCallback((xrayLinking: Draft['xrayLinking']) => {
    setImporting(true);
    setImportProgress({
      isOpen: true,
      phase: 'importing',
      steps: buildProgressSteps(xrayLinking),
      currentStepIndex: 0,
      testKey: null,
      testIssueId: null,
      linkedItems: [],
      failedItems: [],
      isComplete: false,
      hasErrors: false,
      validation: null,
    });
  }, [buildProgressSteps]);

  // Execute the import and linking operations
  const executeImport = useCallback(async (
    draftId: string,
    projectKey: string,
    xrayLinking: Draft['xrayLinking']
  ): Promise<ImportResult> => {
    const linkedItems: LinkedItem[] = [];
    const failedItems: FailedItem[] = [];
    let hasErrors = false;

    try {
      // Step: Create test in Jira
      updateStep('create', 'in-progress');
      const importResult = await xrayApi.import([draftId], projectKey);

      if (!importResult.success || !importResult.testIssueIds || !importResult.testKeys) {
        updateStep('create', 'failed', importResult.error || 'Import failed');
        throw new Error(importResult.error || 'Import failed');
      }

      const testIssueId = importResult.testIssueIds[0];
      const testKey = importResult.testKeys[0];

      updateStep('create', 'completed');
      setImportProgress(prev => ({ ...prev, testKey, testIssueId }));
      advanceStep();

      // Link to test plans
      for (let i = 0; i < xrayLinking.testPlanIds.length; i++) {
        const stepId = `plan-${i}`;
        const testPlanId = xrayLinking.testPlanIds[i];
        const display = xrayLinking.testPlanDisplays[i]?.display || testPlanId;

        updateStep(stepId, 'in-progress');
        const key = display.split(':')[0]?.trim();
        try {
          await xrayApi.addTestsToTestPlan(testPlanId, [testIssueId]);
          updateStep(stepId, 'completed');
          linkedItems.push({ label: display, key, type: 'plan' });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          updateStep(stepId, 'failed', errorMsg);
          failedItems.push({ label: `Test Plan: ${display}`, error: errorMsg });
          hasErrors = true;
        }
        advanceStep();
      }

      // Link to test executions
      for (let i = 0; i < xrayLinking.testExecutionIds.length; i++) {
        const stepId = `exec-${i}`;
        const testExecutionId = xrayLinking.testExecutionIds[i];
        const display = xrayLinking.testExecutionDisplays[i]?.display || testExecutionId;

        updateStep(stepId, 'in-progress');
        const key = display.split(':')[0]?.trim();
        try {
          await xrayApi.addTestsToTestExecution(testExecutionId, [testIssueId]);
          updateStep(stepId, 'completed');
          linkedItems.push({ label: display, key, type: 'execution' });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          updateStep(stepId, 'failed', errorMsg);
          failedItems.push({ label: `Test Execution: ${display}`, error: errorMsg });
          hasErrors = true;
        }
        advanceStep();
      }

      // Link to test sets
      for (let i = 0; i < xrayLinking.testSetIds.length; i++) {
        const stepId = `set-${i}`;
        const testSetId = xrayLinking.testSetIds[i];
        const display = xrayLinking.testSetDisplays[i]?.display || testSetId;

        updateStep(stepId, 'in-progress');
        const key = display.split(':')[0]?.trim();
        try {
          await xrayApi.addTestsToTestSet(testSetId, [testIssueId]);
          updateStep(stepId, 'completed');
          linkedItems.push({ label: display, key, type: 'set' });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          updateStep(stepId, 'failed', errorMsg);
          failedItems.push({ label: `Test Set: ${display}`, error: errorMsg });
          hasErrors = true;
        }
        advanceStep();
      }

      // Link to folder
      if (xrayLinking.folderPath && xrayLinking.projectId) {
        updateStep('folder', 'in-progress');
        try {
          await xrayApi.addTestsToFolder(
            xrayLinking.projectId,
            xrayLinking.folderPath,
            [testIssueId]
          );
          updateStep('folder', 'completed');
          linkedItems.push({ label: xrayLinking.folderPath, type: 'folder' });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          updateStep('folder', 'failed', errorMsg);
          failedItems.push({ label: `Folder: ${xrayLinking.folderPath}`, error: errorMsg });
          hasErrors = true;
        }
        advanceStep();
      }

      // Link preconditions
      if (xrayLinking.preconditionIds.length > 0) {
        updateStep('preconditions', 'in-progress');
        try {
          await xrayApi.addPreconditionsToTest(testIssueId, xrayLinking.preconditionIds);
          updateStep('preconditions', 'completed');
          linkedItems.push({ label: `${xrayLinking.preconditionIds.length} precondition(s)`, type: 'precondition' });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          updateStep('preconditions', 'failed', errorMsg);
          failedItems.push({ label: 'Preconditions', error: errorMsg });
          hasErrors = true;
        }
        advanceStep();
      }

      // Validation phase
      setImportProgress(prev => ({
        ...prev,
        phase: 'validating',
        linkedItems,
        failedItems,
        hasErrors,
      }));

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

      // Update final progress state
      setImportProgress(prev => ({
        ...prev,
        phase: 'complete',
        linkedItems,
        failedItems,
        isComplete: true,
        hasErrors,
        validation,
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

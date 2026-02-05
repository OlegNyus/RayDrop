import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { arrayMove } from '@dnd-kit/sortable';
import type { DragEndEvent } from '@dnd-kit/core';
import { useApp } from '../../../context/AppContext';
import { Button, StatusBadge } from '../../ui';
import { draftsApi, xrayApi, settingsApi } from '../../../services/api';
import type { Draft, TestStep, ProjectSettings } from '../../../types';
import {
  type Step,
  type XrayCache,
  StepIndicator,
  Step1BasicInfo,
  Step2TestSteps,
  Step3XrayLinking,
  createEmptyStep,
  createEmptyDraft,
  useStepSensors,
} from './TestCaseFormComponents';

// Import progress tracking types
interface ImportStep {
  id: string;
  label: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  error?: string;
}

interface ValidationResult {
  isValidated: boolean;
  testPlans: { expected: string[]; found: string[]; missing: string[] };
  testExecutions: { expected: string[]; found: string[]; missing: string[] };
  testSets: { expected: string[]; found: string[]; missing: string[] };
  preconditions: { expected: string[]; found: string[]; missing: string[] };
  folder: { expected: string | null; found: string | null; valid: boolean };
}

interface ImportProgress {
  isOpen: boolean;
  phase: 'importing' | 'validating' | 'complete';
  steps: ImportStep[];
  currentStepIndex: number;
  testKey: string | null;
  testIssueId: string | null;
  linkedItems: { label: string; key?: string; type: 'plan' | 'execution' | 'set' | 'folder' | 'precondition' }[];
  failedItems: { label: string; error: string }[];
  isComplete: boolean;
  hasErrors: boolean;
  validation: ValidationResult | null;
}

export function CreateTestCase() {
  const navigate = useNavigate();
  const { activeProject, refreshDrafts, config } = useApp();
  const sensors = useStepSensors();

  const [draft, setDraft] = useState<Draft>(() => createEmptyDraft(activeProject || ''));
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [hasChanges, setHasChanges] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const [projectSettings, setProjectSettings] = useState<ProjectSettings | null>(null);
  const [xrayCache, setXrayCache] = useState<XrayCache>({
    testPlans: [], testExecutions: [], testSets: [], preconditions: [], folders: [],
  });
  const [loadingXray, setLoadingXray] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showXrayValidation, setShowXrayValidation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState<{ testKey: string } | null>(null);
  const [importProgress, setImportProgress] = useState<ImportProgress>({
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
  });

  useEffect(() => {
    if (activeProject) {
      loadProjectSettings();
      loadXrayEntities();
    }
  }, [activeProject]);

  const loadProjectSettings = async () => {
    if (!activeProject) return;
    try {
      const settings = await settingsApi.getProjectSettings(activeProject);
      setProjectSettings(settings);
    } catch (err) {
      console.error('Failed to load project settings:', err);
    }
  };

  const loadXrayEntities = async () => {
    if (!activeProject) return;
    setLoadingXray(true);
    try {
      const [testPlans, testExecutions, testSets, preconditions, foldersResult] = await Promise.all([
        xrayApi.getTestPlans(activeProject).catch(() => []),
        xrayApi.getTestExecutions(activeProject).catch(() => []),
        xrayApi.getTestSets(activeProject).catch(() => []),
        xrayApi.getPreconditions(activeProject).catch(() => []),
        xrayApi.getAllFolders(activeProject).catch(() => ({ folders: [], projectId: '' })),
      ]);
      setXrayCache({
        testPlans, testExecutions, testSets, preconditions,
        folders: [{ path: '/', name: '/ (Root)' }, ...foldersResult.folders],
      });
      // Store projectId for folder linking
      if (foldersResult.projectId) {
        setDraft(d => ({ ...d, xrayLinking: { ...d.xrayLinking, projectId: foldersResult.projectId } }));
      }
    } catch (err) {
      console.error('Failed to load Xray entities:', err);
    } finally {
      setLoadingXray(false);
    }
  };

  const updateDraft = useCallback((updates: Partial<Draft>) => {
    setDraft(d => ({ ...d, ...updates, updatedAt: Date.now() }));
    setHasChanges(true);
  }, []);

  const updateXrayLinking = useCallback((updates: Partial<Draft['xrayLinking']>) => {
    setDraft(d => ({ ...d, xrayLinking: { ...d.xrayLinking, ...updates }, updatedAt: Date.now() }));
    setHasChanges(true);
  }, []);

  const addStep = () => updateDraft({ steps: [...draft.steps, createEmptyStep()] });

  const removeStep = (id: string) => {
    if (draft.steps.length > 1) updateDraft({ steps: draft.steps.filter(s => s.id !== id) });
  };

  const updateStep = (id: string, field: keyof TestStep, value: string) => {
    updateDraft({ steps: draft.steps.map(s => (s.id === id ? { ...s, [field]: value } : s)) });
    setErrors(e => {
      const key = `step_${draft.steps.findIndex(s => s.id === id)}_${field}`;
      const { [key]: _, ...rest } = e;
      return rest;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = draft.steps.findIndex(s => s.id === active.id);
      const newIndex = draft.steps.findIndex(s => s.id === over.id);
      updateDraft({ steps: arrayMove(draft.steps, oldIndex, newIndex) });
    }
  };

  const updateFunctionalAreas = async (areas: string[]) => {
    if (!activeProject || !projectSettings) return;
    const updated = { ...projectSettings, functionalAreas: areas };
    setProjectSettings(updated);
    try {
      await settingsApi.updateProjectSettings(activeProject, updated);
    } catch (err) {
      console.error('Failed to save functional areas:', err);
    }
  };

  // Helper to check if summary has a valid Title (not just Functional Area + Layer)
  const summaryHasTitle = (summary: string): boolean => {
    const parts = summary.split(' | ');
    // If 2 parts (Area | Layer), title is missing
    if (parts.length === 2) return false;
    // If 3 parts, third part (Title) must not be empty
    if (parts.length === 3 && !parts[2].trim()) return false;
    // 1 part = just a title (valid), or 3 parts with non-empty title (valid)
    return summary.trim().length > 0;
  };

  const isStep1Valid = () => summaryHasTitle(draft.summary) && draft.description.trim().length > 0;
  const isStep2Valid = () => draft.steps.every(s => s.action.trim() && s.result.trim());

  // Can import/mark ready only if all steps are valid
  const canImport = () => isStep1Valid() && isStep2Valid() && isStep3Valid();

  // Can save draft if at least ONE required field has content
  const canSaveDraft = () => {
    const hasSummary = draft.summary.trim().length > 0;
    const hasDescription = draft.description.trim().length > 0;
    const hasStepContent = draft.steps.some(s => s.action.trim().length > 0 || s.result.trim().length > 0);
    return hasSummary || hasDescription || hasStepContent;
  };
  const isStep3Valid = () => {
    const { xrayLinking } = draft;
    return xrayLinking.testPlanIds.length > 0 && xrayLinking.testExecutionIds.length > 0 &&
           xrayLinking.testSetIds.length > 0 && xrayLinking.folderPath.trim().length > 0;
  };

  const validateStep1 = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!draft.summary.trim()) {
      newErrors.summary = 'Summary is required';
    } else if (!summaryHasTitle(draft.summary)) {
      newErrors.summary = 'Title is required';
    }
    if (!draft.description.trim()) newErrors.description = 'Description is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const newErrors: Record<string, string> = {};
    draft.steps.forEach((step, index) => {
      if (!step.action.trim()) newErrors[`step_${index}_action`] = 'Action is required';
      if (!step.result.trim()) newErrors[`step_${index}_result`] = 'Expected result is required';
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const goToStep = (step: Step) => {
    if (step < currentStep || (step === 2 && isStep1Valid()) || (step === 3 && isStep2Valid())) {
      setCurrentStep(step);
    }
  };

  const nextStep = () => {
    // Allow free navigation between steps - validation only happens on Mark Ready / Import
    if (currentStep < 3) setCurrentStep((currentStep + 1) as Step);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep((currentStep - 1) as Step);
  };

  const handleSaveDraft = async () => {
    // Draft can be saved with partial data - no validation required
    setSaving(true);
    try {
      const toSave: Draft = { ...draft, status: 'draft', projectKey: activeProject || '' };
      if (savedId) {
        await draftsApi.update(savedId, toSave);
      } else {
        const result = await draftsApi.create(toSave);
        setSavedId(result.draft.id);
      }
      setHasChanges(false);
      await refreshDrafts();
    } catch (err) {
      console.error('Failed to save draft:', err);
      setErrors({ save: err instanceof Error ? err.message : 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveReady = async () => {
    if (!validateStep1()) { setCurrentStep(1); return; }
    if (!validateStep2()) { setCurrentStep(2); return; }
    setShowXrayValidation(true);
    if (!isStep3Valid()) { setCurrentStep(3); return; }

    setSaving(true);
    try {
      const toSave: Draft = { ...draft, status: 'ready', isComplete: true, projectKey: activeProject || '' };
      if (savedId) {
        await draftsApi.update(savedId, toSave);
      } else {
        await draftsApi.create(toSave);
      }
      await refreshDrafts();
      navigate('/test-cases');
    } catch (err) {
      console.error('Failed to save:', err);
      setErrors({ save: err instanceof Error ? err.message : 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  // Build the steps list for progress tracking
  const buildProgressSteps = useCallback((): ImportStep[] => {
    const progressSteps: ImportStep[] = [
      { id: 'create', label: 'Creating test in Jira...', status: 'pending' },
    ];

    // Add test plan steps
    draft.xrayLinking.testPlanIds.forEach((_, i) => {
      const display = draft.xrayLinking.testPlanDisplays[i]?.display || 'Test Plan';
      progressSteps.push({
        id: `plan-${i}`,
        label: `Linking to ${display}...`,
        status: 'pending',
      });
    });

    // Add test execution steps
    draft.xrayLinking.testExecutionIds.forEach((_, i) => {
      const display = draft.xrayLinking.testExecutionDisplays[i]?.display || 'Test Execution';
      progressSteps.push({
        id: `exec-${i}`,
        label: `Linking to ${display}...`,
        status: 'pending',
      });
    });

    // Add test set steps
    draft.xrayLinking.testSetIds.forEach((_, i) => {
      const display = draft.xrayLinking.testSetDisplays[i]?.display || 'Test Set';
      progressSteps.push({
        id: `set-${i}`,
        label: `Linking to ${display}...`,
        status: 'pending',
      });
    });

    // Add folder step if configured
    if (draft.xrayLinking.folderPath && draft.xrayLinking.projectId) {
      progressSteps.push({
        id: 'folder',
        label: `Adding to folder ${draft.xrayLinking.folderPath}...`,
        status: 'pending',
      });
    }

    // Add preconditions step if any
    if (draft.xrayLinking.preconditionIds.length > 0) {
      progressSteps.push({
        id: 'preconditions',
        label: `Linking ${draft.xrayLinking.preconditionIds.length} precondition(s)...`,
        status: 'pending',
      });
    }

    return progressSteps;
  }, [draft]);

  // Start import immediately with progress modal
  const handleImportToXray = async () => {
    if (!activeProject) return;
    if (!validateStep1()) { setCurrentStep(1); return; }
    if (!validateStep2()) { setCurrentStep(2); return; }
    setShowXrayValidation(true);
    if (!isStep3Valid()) { setCurrentStep(3); return; }

    setImporting(true);
    setErrors({});
    setImportSuccess(null);

    // Open modal and start importing immediately
    setImportProgress({
      isOpen: true,
      phase: 'importing',
      steps: buildProgressSteps(),
      currentStepIndex: 0,
      testKey: null,
      testIssueId: null,
      linkedItems: [],
      failedItems: [],
      isComplete: false,
      hasErrors: false,
      validation: null,
    });

    // Helper to update a specific step
    const updateStep = (stepId: string, status: ImportStep['status'], error?: string) => {
      setImportProgress(prev => ({
        ...prev,
        steps: prev.steps.map(s => s.id === stepId ? { ...s, status, error } : s),
      }));
    };

    // Helper to advance to next step
    const advanceStep = () => {
      setImportProgress(prev => ({
        ...prev,
        currentStepIndex: prev.currentStepIndex + 1,
      }));
    };

    const linkedItems: ImportProgress['linkedItems'] = [];
    const failedItems: ImportProgress['failedItems'] = [];
    let hasErrors = false;

    try {
      // First save/create the draft as ready
      let draftId = savedId;
      const toSave: Draft = { ...draft, status: 'ready', isComplete: true, projectKey: activeProject };

      if (savedId) {
        await draftsApi.update(savedId, toSave);
      } else {
        const result = await draftsApi.create(toSave);
        draftId = result.draft.id;
        setSavedId(draftId);
      }

      if (!draftId) {
        throw new Error('Failed to save draft before import');
      }

      // Step: Create test in Jira
      updateStep('create', 'in-progress');
      const importResult = await xrayApi.import([draftId], activeProject);

      if (!importResult.success || !importResult.testIssueIds || !importResult.testKeys) {
        updateStep('create', 'failed', importResult.error || 'Import failed');
        throw new Error(importResult.error || 'Import failed');
      }

      const testIssueId = importResult.testIssueIds[0];
      const testKey = importResult.testKeys[0];

      updateStep('create', 'completed');
      setImportProgress(prev => ({ ...prev, testKey }));
      advanceStep();

      // Link to test plans
      for (let i = 0; i < draft.xrayLinking.testPlanIds.length; i++) {
        const stepId = `plan-${i}`;
        const testPlanId = draft.xrayLinking.testPlanIds[i];
        const display = draft.xrayLinking.testPlanDisplays[i]?.display || testPlanId;

        updateStep(stepId, 'in-progress');
        // Extract Jira key from display (format: "KEY: Summary")
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
          console.error(`Linking failed for Test Plan ${display}:`, err);
        }
        advanceStep();
      }

      // Link to test executions
      for (let i = 0; i < draft.xrayLinking.testExecutionIds.length; i++) {
        const stepId = `exec-${i}`;
        const testExecutionId = draft.xrayLinking.testExecutionIds[i];
        const display = draft.xrayLinking.testExecutionDisplays[i]?.display || testExecutionId;

        updateStep(stepId, 'in-progress');
        // Extract Jira key from display (format: "KEY: Summary")
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
          console.error(`Linking failed for Test Execution ${display}:`, err);
        }
        advanceStep();
      }

      // Link to test sets
      for (let i = 0; i < draft.xrayLinking.testSetIds.length; i++) {
        const stepId = `set-${i}`;
        const testSetId = draft.xrayLinking.testSetIds[i];
        const display = draft.xrayLinking.testSetDisplays[i]?.display || testSetId;

        updateStep(stepId, 'in-progress');
        // Extract Jira key from display (format: "KEY: Summary")
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
          console.error(`Linking failed for Test Set ${display}:`, err);
        }
        advanceStep();
      }

      // Link to folder
      if (draft.xrayLinking.folderPath && draft.xrayLinking.projectId) {
        updateStep('folder', 'in-progress');
        try {
          await xrayApi.addTestsToFolder(
            draft.xrayLinking.projectId,
            draft.xrayLinking.folderPath,
            [testIssueId]
          );
          updateStep('folder', 'completed');
          linkedItems.push({ label: draft.xrayLinking.folderPath, type: 'folder' });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          updateStep('folder', 'failed', errorMsg);
          failedItems.push({ label: `Folder: ${draft.xrayLinking.folderPath}`, error: errorMsg });
          hasErrors = true;
          console.error(`Linking failed for Folder ${draft.xrayLinking.folderPath}:`, err);
        }
        advanceStep();
      }

      // Link preconditions
      if (draft.xrayLinking.preconditionIds.length > 0) {
        updateStep('preconditions', 'in-progress');
        try {
          await xrayApi.addPreconditionsToTest(testIssueId, draft.xrayLinking.preconditionIds);
          updateStep('preconditions', 'completed');
          linkedItems.push({ label: `${draft.xrayLinking.preconditionIds.length} precondition(s)`, type: 'precondition' });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          updateStep('preconditions', 'failed', errorMsg);
          failedItems.push({ label: 'Preconditions', error: errorMsg });
          hasErrors = true;
          console.error('Linking failed for Preconditions:', err);
        }
        advanceStep();
      }

      // Validation phase - verify links exist in Xray
      setImportProgress(prev => ({
        ...prev,
        phase: 'validating',
        testIssueId,
      }));

      let validation: ValidationResult | null = null;
      try {
        const testLinks = await xrayApi.getTestLinks(testIssueId);

        // Build expected lists from what we tried to link (excluding failed items)
        const expectedTestPlans = draft.xrayLinking.testPlanIds.filter((_, i) =>
          !failedItems.some(f => f.label.includes(draft.xrayLinking.testPlanDisplays[i]?.display || ''))
        );
        const expectedTestExecutions = draft.xrayLinking.testExecutionIds.filter((_, i) =>
          !failedItems.some(f => f.label.includes(draft.xrayLinking.testExecutionDisplays[i]?.display || ''))
        );
        const expectedTestSets = draft.xrayLinking.testSetIds.filter((_, i) =>
          !failedItems.some(f => f.label.includes(draft.xrayLinking.testSetDisplays[i]?.display || ''))
        );
        const expectedPreconditions = draft.xrayLinking.preconditionIds.filter(() =>
          !failedItems.some(f => f.label === 'Preconditions')
        );
        const expectedFolder = !failedItems.some(f => f.label.startsWith('Folder:'))
          ? draft.xrayLinking.folderPath || null
          : null;

        // Extract found IDs from the response
        const foundTestPlanIds = testLinks.testPlans.map(p => p.issueId);
        const foundTestExecutionIds = testLinks.testExecutions.map(e => e.issueId);
        const foundTestSetIds = testLinks.testSets.map(s => s.issueId);
        const foundPreconditionIds = testLinks.preconditions.map(p => p.issueId);
        const foundFolder = testLinks.folder || null;

        validation = {
          isValidated: true,
          testPlans: {
            expected: expectedTestPlans,
            found: foundTestPlanIds,
            missing: expectedTestPlans.filter(id => !foundTestPlanIds.includes(id)),
          },
          testExecutions: {
            expected: expectedTestExecutions,
            found: foundTestExecutionIds,
            missing: expectedTestExecutions.filter(id => !foundTestExecutionIds.includes(id)),
          },
          testSets: {
            expected: expectedTestSets,
            found: foundTestSetIds,
            missing: expectedTestSets.filter(id => !foundTestSetIds.includes(id)),
          },
          preconditions: {
            expected: expectedPreconditions,
            found: foundPreconditionIds,
            missing: expectedPreconditions.filter(id => !foundPreconditionIds.includes(id)),
          },
          folder: {
            expected: expectedFolder,
            found: foundFolder,
            valid: expectedFolder === foundFolder || (expectedFolder === '/' && foundFolder === null),
          },
        };

        // Check if validation found missing links
        const hasMissingLinks = validation.testPlans.missing.length > 0 ||
          validation.testExecutions.missing.length > 0 ||
          validation.testSets.missing.length > 0 ||
          validation.preconditions.missing.length > 0 ||
          !validation.folder.valid;

        if (hasMissingLinks) {
          hasErrors = true;
        }
      } catch (err) {
        console.error('Validation failed:', err);
        // Validation failure shouldn't fail the whole import
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

      // Update local state with imported info
      setDraft({
        ...draft,
        status: 'imported',
        testKey,
        testIssueId,
      });
      setHasChanges(false);
      setImportSuccess({ testKey });

      await refreshDrafts();
    } catch (err) {
      console.error('Failed to import to Xray:', err);
      setErrors({ import: err instanceof Error ? err.message : 'Failed to import to Xray' });
      setImportProgress(prev => ({
        ...prev,
        phase: 'complete',
        isComplete: true,
        hasErrors: true,
      }));
    } finally {
      setImporting(false);
    }
  };

  const resetForm = () => {
    if (hasChanges && !confirm('You have unsaved changes. Are you sure you want to reset?')) return;
    setDraft(createEmptyDraft(activeProject || ''));
    setSavedId(null);
    setCurrentStep(1);
    setHasChanges(false);
    setErrors({});
    setShowXrayValidation(false);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-text-primary">Create Test Case</h1>
          <StatusBadge status={draft.status} />
          {hasChanges && <span className="text-sm text-warning">• Unsaved</span>}
        </div>
      </div>

      <StepIndicator
        currentStep={currentStep}
        onStepClick={goToStep}
        step1Valid={isStep1Valid()}
        step2Valid={isStep2Valid()}
        step3Valid={isStep3Valid()}
        status={draft.status}
      />

      {errors.save && (
        <div className="p-3 bg-red-100 dark:bg-red-900/30 text-error rounded-lg text-sm">{errors.save}</div>
      )}

      {errors.import && (
        <div className="p-3 bg-red-100 dark:bg-red-900/30 text-error rounded-lg text-sm">{errors.import}</div>
      )}

      {errors.linking && (
        <div className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg text-sm">
          <strong>Warning:</strong> {errors.linking}
        </div>
      )}

      {importSuccess && (
        <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg text-sm flex items-center gap-2">
          <span className="text-green-500">✓</span>
          Successfully imported as <strong>{importSuccess.testKey}</strong>
        </div>
      )}

      {currentStep === 1 && (
        <Step1BasicInfo
          draft={draft}
          updateDraft={updateDraft}
          errors={errors}
          projectSettings={projectSettings}
          onAreasChange={updateFunctionalAreas}
        />
      )}
      {currentStep === 2 && (
        <Step2TestSteps
          draft={draft}
          sensors={sensors}
          onDragEnd={handleDragEnd}
          addStep={addStep}
          removeStep={removeStep}
          updateStep={updateStep}
          errors={errors}
        />
      )}
      {currentStep === 3 && (
        <Step3XrayLinking
          draft={draft}
          updateXrayLinking={updateXrayLinking}
          xrayCache={xrayCache}
          loadingXray={loadingXray}
          onRefresh={loadXrayEntities}
          showValidation={showXrayValidation}
        />
      )}

      <div className="flex justify-between pt-4 border-t border-border">
        {currentStep > 1 ? (
          <Button variant="ghost" onClick={prevStep} disabled={importing}>← Previous</Button>
        ) : <div />}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={resetForm} disabled={importing}>Reset</Button>
          {draft.status !== 'imported' && (
            <Button variant="secondary" onClick={handleSaveDraft} disabled={saving || importing || !canSaveDraft()}>
              {savedId ? 'Update Draft' : 'Save Draft'}
            </Button>
          )}
          {currentStep < 3 ? (
            <Button onClick={nextStep} disabled={importing}>Next →</Button>
          ) : draft.status === 'imported' ? (
            <Button disabled>
              ✓ Imported as {draft.testKey}
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={handleSaveReady} disabled={saving || importing || !canImport()}>
                {saving ? 'Saving...' : 'Save & Mark Ready'}
              </Button>
              <Button onClick={handleImportToXray} disabled={saving || importing || !canImport()}>
                {importing ? 'Importing...' : 'Import to Xray'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Import Progress Modal */}
      <ImportProgressModal
        progress={importProgress}
        onClose={() => setImportProgress(prev => ({ ...prev, isOpen: false }))}
        jiraBaseUrl={config?.jiraBaseUrl}
      />
    </div>
  );
}

// Import Progress Modal Component
function ImportProgressModal({
  progress,
  onClose,
  jiraBaseUrl,
}: {
  progress: ImportProgress;
  onClose: () => void;
  jiraBaseUrl?: string;
}) {
  if (!progress.isOpen) return null;

  const completedSteps = progress.steps.filter(s => s.status === 'completed').length;
  const failedSteps = progress.steps.filter(s => s.status === 'failed').length;
  const totalSteps = progress.steps.length;
  const percentComplete = totalSteps > 0 ? Math.round(((completedSteps + failedSteps) / totalSteps) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-xl border border-border shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border text-center">
          <h2 className="text-lg font-semibold text-text-primary">One-Click Import</h2>
          <p className="text-sm text-accent">Seamless sync to Xray Cloud</p>
        </div>

        {/* Content - Fixed height */}
        <div className="p-6 h-[280px] flex flex-col">
          {progress.phase === 'importing' || progress.phase === 'validating' ? (
            /* Importing/Validating State */
            <div className="flex flex-col h-full">
              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-text-muted mb-2">
                  <span>{progress.phase === 'validating' ? 'Validating links...' : 'Importing...'}</span>
                  <span>{progress.phase === 'validating' ? '100%' : `${percentComplete}%`}</span>
                </div>
                <div className="h-2 bg-sidebar rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all duration-300 ease-out rounded-full"
                    style={{ width: progress.phase === 'validating' ? '100%' : `${percentComplete}%` }}
                  />
                </div>
              </div>

              {/* Steps - Scrollable */}
              <div className="flex-1 space-y-2 overflow-y-auto">
                {progress.steps.map((step, index) => {
                  // Only show steps that are in-progress, completed, or failed
                  if (step.status === 'pending' && index > progress.currentStepIndex) return null;

                  return (
                    <div
                      key={step.id}
                      className="flex items-center gap-3 animate-fadeIn"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      {step.status === 'completed' ? (
                        <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      ) : step.status === 'failed' ? (
                        <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                      ) : step.status === 'in-progress' ? (
                        <div className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin flex-shrink-0" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-text-muted flex-shrink-0" />
                      )}
                      <span className={`text-sm ${
                        step.status === 'completed' ? 'text-accent' :
                        step.status === 'failed' ? 'text-red-500' :
                        step.status === 'in-progress' ? 'text-text-primary font-medium' :
                        'text-text-muted'
                      }`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
                {/* Validating step indicator */}
                {progress.phase === 'validating' && (
                  <div className="flex items-center gap-3 animate-fadeIn">
                    <div className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin flex-shrink-0" />
                    <span className="text-sm text-text-primary font-medium">Verifying links in Xray...</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Complete State */
            <div className="flex flex-col items-center justify-center text-center h-full animate-scaleIn">
              {progress.hasErrors && !progress.testKey ? (
                /* Full failure - Test creation failed */
                <>
                  <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <span className="text-lg font-semibold text-red-500">Import Failed</span>
                  <span className="text-sm text-text-muted mt-2">
                    Failed to create test case in Jira. Please check your connection and try again.
                  </span>
                </>
              ) : progress.hasErrors && progress.testKey ? (
                /* Partial success - Test created but some links failed */
                <>
                  <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <span className="text-lg font-semibold text-amber-500">Imported with Warnings</span>
                  <span className="text-sm text-text-muted mt-1">
                    <span className="font-mono text-accent">{progress.testKey}</span> created in Jira
                  </span>

                  {/* Success badges */}
                  {progress.linkedItems.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3 justify-center max-h-[60px] overflow-y-auto">
                      {progress.linkedItems.map((item, i) => (
                        item.key && jiraBaseUrl ? (
                          <a
                            key={i}
                            href={`${jiraBaseUrl}browse/${item.key}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 bg-accent/10 text-accent text-xs rounded hover:bg-accent/20 transition-colors"
                          >
                            {item.key}
                          </a>
                        ) : (
                          <span key={i} className="px-2 py-1 bg-accent/10 text-accent text-xs rounded">
                            {item.label}
                          </span>
                        )
                      ))}
                    </div>
                  )}

                  {/* Failed items */}
                  {progress.failedItems.length > 0 && (
                    <div className="mt-3 w-full">
                      <p className="text-xs text-red-500 font-medium mb-2">Failed to link:</p>
                      <div className="space-y-1 text-left max-h-[80px] overflow-y-auto">
                        {progress.failedItems.map((item, i) => (
                          <div key={i} className="text-xs text-red-400 flex items-start gap-2">
                            <span className="flex-shrink-0">•</span>
                            <span>{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Validation status for partial success */}
                  {progress.validation?.isValidated && (
                    <span className="text-xs text-text-muted mt-2 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      Links verified in Xray
                    </span>
                  )}
                </>
              ) : (
                /* Full success */
                <>
                  <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-lg font-semibold text-success">Import Complete!</span>
                  {progress.testKey && (
                    <span className="text-sm text-text-muted mt-1">
                      <span className="font-mono text-accent">{progress.testKey}</span> created in Jira
                    </span>
                  )}

                  {/* Linked items badges */}
                  {progress.linkedItems.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4 justify-center max-h-[80px] overflow-y-auto">
                      {progress.linkedItems.map((item, i) => (
                        item.key && jiraBaseUrl ? (
                          <a
                            key={i}
                            href={`${jiraBaseUrl}browse/${item.key}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 bg-accent/10 text-accent text-xs rounded hover:bg-accent/20 transition-colors"
                          >
                            {item.key}
                          </a>
                        ) : (
                          <span key={i} className="px-2 py-1 bg-accent/10 text-accent text-xs rounded">
                            {item.label}
                          </span>
                        )
                      ))}
                    </div>
                  )}

                  {/* Validation status */}
                  {progress.validation?.isValidated ? (
                    <span className="text-xs text-success mt-3 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      Links verified in Xray
                    </span>
                  ) : (
                    <span className="text-xs text-text-muted mt-3">Verification pending</span>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer - Only show when complete */}
        {progress.phase === 'complete' && (
          <div className="px-6 py-4 border-t border-border flex justify-center">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors font-medium"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

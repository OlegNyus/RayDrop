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

export function CreateTestCase() {
  const navigate = useNavigate();
  const { activeProject, refreshDrafts } = useApp();
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
      const [testPlans, testExecutions, testSets, preconditions, folders] = await Promise.all([
        xrayApi.getTestPlans(activeProject).catch(() => []),
        xrayApi.getTestExecutions(activeProject).catch(() => []),
        xrayApi.getTestSets(activeProject).catch(() => []),
        xrayApi.getPreconditions(activeProject).catch(() => []),
        xrayApi.getAllFolders(activeProject).catch(() => []),
      ]);
      setXrayCache({
        testPlans, testExecutions, testSets, preconditions,
        folders: [{ path: '/', name: '/ (Root)' }, ...folders],
      });
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

  const handleImportToXray = async () => {
    if (!activeProject) return;
    if (!validateStep1()) { setCurrentStep(1); return; }
    if (!validateStep2()) { setCurrentStep(2); return; }
    setShowXrayValidation(true);
    if (!isStep3Valid()) { setCurrentStep(3); return; }

    setImporting(true);
    setErrors({});
    setImportSuccess(null);

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

      // Import to Xray
      const importResult = await xrayApi.import([draftId], activeProject);

      if (!importResult.success || !importResult.testIssueIds || !importResult.testKeys) {
        throw new Error(importResult.error || 'Import failed');
      }

      const testIssueId = importResult.testIssueIds[0];
      const testKey = importResult.testKeys[0];

      // Build linking operations with descriptive labels for error reporting
      interface LinkingOperation {
        label: string;
        promise: Promise<{ addedTests?: number; addedPreconditions?: number; warning?: string }>;
      }

      const linkingOperations: LinkingOperation[] = [
        // Link to test plans
        ...draft.xrayLinking.testPlanIds.map((testPlanId, i) => ({
          label: `Test Plan ${draft.xrayLinking.testPlanDisplays[i]?.display || testPlanId}`,
          promise: xrayApi.addTestsToTestPlan(testPlanId, [testIssueId]),
        })),
        // Link to test executions
        ...draft.xrayLinking.testExecutionIds.map((testExecutionId, i) => ({
          label: `Test Execution ${draft.xrayLinking.testExecutionDisplays[i]?.display || testExecutionId}`,
          promise: xrayApi.addTestsToTestExecution(testExecutionId, [testIssueId]),
        })),
        // Link to test sets
        ...draft.xrayLinking.testSetIds.map((testSetId, i) => ({
          label: `Test Set ${draft.xrayLinking.testSetDisplays[i]?.display || testSetId}`,
          promise: xrayApi.addTestsToTestSet(testSetId, [testIssueId]),
        })),
      ];

      // Add folder linking if configured
      if (draft.xrayLinking.folderPath && draft.xrayLinking.projectId) {
        linkingOperations.push({
          label: `Folder ${draft.xrayLinking.folderPath}`,
          promise: xrayApi.addTestsToFolder(
            draft.xrayLinking.projectId,
            draft.xrayLinking.folderPath,
            [testIssueId]
          ),
        });
      }

      // Add preconditions linking if any
      if (draft.xrayLinking.preconditionIds.length > 0) {
        linkingOperations.push({
          label: `Preconditions (${draft.xrayLinking.preconditionIds.length})`,
          promise: xrayApi.addPreconditionsToTest(testIssueId, draft.xrayLinking.preconditionIds),
        });
      }

      // Execute all linking operations in parallel using allSettled to capture all results
      const results = await Promise.allSettled(linkingOperations.map(op => op.promise));

      // Check for failures and warnings
      const failures: string[] = [];
      const warnings: string[] = [];

      results.forEach((result, index) => {
        const op = linkingOperations[index];
        if (result.status === 'rejected') {
          const errorMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
          failures.push(`${op.label}: ${errorMsg}`);
          console.error(`Linking failed for ${op.label}:`, result.reason);
        } else if (result.status === 'fulfilled') {
          const value = result.value;
          if (value.warning) {
            warnings.push(`${op.label}: ${value.warning}`);
          }
          // Check if anything was actually added
          const addedCount = value.addedTests ?? value.addedPreconditions ?? 0;
          if (addedCount === 0) {
            warnings.push(`${op.label}: No items were linked (already linked or not found)`);
          }
        }
      });

      // Log warnings but don't fail the import
      if (warnings.length > 0) {
        console.warn('Linking warnings:', warnings);
      }

      // If there were failures, show them but still mark as imported since the TC was created
      if (failures.length > 0) {
        console.error('Some linking operations failed:', failures);
        setErrors({ linking: `Some links failed: ${failures.join('; ')}` });
      }

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
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { arrayMove } from '@dnd-kit/sortable';
import type { DragEndEvent } from '@dnd-kit/core';
import { useApp } from '../../../context/AppContext';
import { Button, StatusBadge, ImportProgressModal } from '../../ui';
import { draftsApi, xrayApi, settingsApi } from '../../../services/api';
import { safeString } from '../../../types';
import type { Draft, TestStep, ProjectSettings, TestDetails, TestLinks } from '../../../types';
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
import { ReusableTCSelector } from './ReusableTCSelector';
import { useImportToXray } from '../../../hooks/useImportToXray';

type CreateMode = 'choice' | 'scratch' | 'reusable';

export function CreateTestCase() {
  const navigate = useNavigate();
  const { activeProject, refreshDrafts, config } = useApp();
  const sensors = useStepSensors();

  // Import hook
  const { importProgress, importing, startImport, executeImport, closeModal } = useImportToXray();

  const [mode, setMode] = useState<CreateMode>('choice');
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

  const isStep1Valid = () => summaryHasTitle(draft.summary) && safeString(draft.description).trim().length > 0;
  const isStep2Valid = () => draft.steps.every(s => s.action.trim() && s.result.trim());

  // Can import/mark ready only if all steps are valid
  const canImport = () => isStep1Valid() && isStep2Valid() && isStep3Valid();

  // Can save draft if at least ONE required field has content
  const canSaveDraft = () => {
    const hasSummary = draft.summary.trim().length > 0;
    const hasDescription = safeString(draft.description).trim().length > 0;
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
    if (!safeString(draft.description).trim()) newErrors.description = 'Description is required';
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

  // Start import immediately with progress modal
  const handleImportToXray = async () => {
    if (!activeProject) return;
    if (!validateStep1()) { setCurrentStep(1); return; }
    if (!validateStep2()) { setCurrentStep(2); return; }
    setShowXrayValidation(true);
    if (!isStep3Valid()) { setCurrentStep(3); return; }

    setErrors({});
    setImportSuccess(null);

    // First save/create the draft as ready
    let draftId = savedId;
    const toSave: Draft = { ...draft, status: 'ready', isComplete: true, projectKey: activeProject };

    try {
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

      // Start import with progress tracking
      startImport(draft.xrayLinking, draft.isReusable);
      const result = await executeImport(draftId, activeProject, draft.xrayLinking, draft.isReusable);

      if (result.success && result.testKey && result.testIssueId) {
        // Update local state with imported info
        setDraft({
          ...draft,
          status: 'imported',
          testKey: result.testKey,
          testIssueId: result.testIssueId,
        });
        setHasChanges(false);
        setImportSuccess({ testKey: result.testKey });
        await refreshDrafts();
      } else if (result.error) {
        setErrors({ import: result.error });
      }
    } catch (err) {
      console.error('Failed to import to Xray:', err);
      setErrors({ import: err instanceof Error ? err.message : 'Failed to import to Xray' });
    }
  };

  const handleSelectReusableTC = async (test: TestDetails) => {
    // Pre-fill draft with all TC fields
    const steps = test.steps.length > 0
      ? test.steps.map(s => ({ ...s, id: crypto.randomUUID() }))
      : [createEmptyStep()];

    // Fetch existing Xray links for this test
    let links: TestLinks | null = null;
    try {
      links = await xrayApi.getTestLinks(test.issueId);
    } catch (err) {
      console.error('Failed to fetch test links:', err);
    }

    const mapDisplays = (items: Array<{ issueId: string; key: string; summary: string }>) =>
      items.map(i => ({ id: i.issueId, display: `${i.key}: ${i.summary}` }));

    setDraft(d => ({
      ...d,
      summary: test.summary,
      description: safeString(test.description),
      testType: (test.testType === 'Manual' || test.testType === 'Automated') ? test.testType : 'Manual',
      priority: test.priority || 'Medium',
      labels: test.labels || [],
      steps,
      isReusable: true,
      sourceTestKey: test.key,
      sourceTestIssueId: test.issueId,
      xrayLinking: links ? {
        ...d.xrayLinking,
        testPlanIds: links.testPlans.map(t => t.issueId),
        testPlanDisplays: mapDisplays(links.testPlans),
        testExecutionIds: links.testExecutions.map(t => t.issueId),
        testExecutionDisplays: mapDisplays(links.testExecutions),
        testSetIds: links.testSets.map(t => t.issueId),
        testSetDisplays: mapDisplays(links.testSets),
        preconditionIds: links.preconditions.map(t => t.issueId),
        preconditionDisplays: mapDisplays(links.preconditions),
        folderPath: links.folder || d.xrayLinking.folderPath,
      } : d.xrayLinking,
      updatedAt: Date.now(),
    }));
    setMode('scratch');
    setHasChanges(true);
  };

  const resetForm = () => {
    if (hasChanges && !confirm('You have unsaved changes. Are you sure you want to reset?')) return;
    setDraft(createEmptyDraft(activeProject || ''));
    setSavedId(null);
    setCurrentStep(1);
    setHasChanges(false);
    setErrors({});
    setShowXrayValidation(false);
    setMode('choice');
  };

  // Choice screen
  if (mode === 'choice') {
    return (
      <div className="space-y-6 max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-text-primary">Create Test Case</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setMode('scratch')}
            className="text-left p-6 rounded-xl bg-card border border-border hover:border-accent/50 hover:bg-accent/5 transition-all group"
          >
            <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
              <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-1">From Scratch</h3>
            <p className="text-sm text-text-muted">Create a new test case with a blank template</p>
          </button>

          <button
            onClick={() => setMode('reusable')}
            className="text-left p-6 rounded-xl bg-card border border-border hover:border-accent/50 hover:bg-accent/5 transition-all group"
          >
            <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
              <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-1">From Reusable TC</h3>
            <p className="text-sm text-text-muted">Edit and update an existing test case from Xray</p>
          </button>
        </div>
      </div>
    );
  }

  // Reusable TC selector screen
  if (mode === 'reusable') {
    return (
      <div className="space-y-6 max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMode('choice')}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-sidebar-hover transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-text-primary">Create Test Case</h1>
        </div>
        {activeProject && (
          <ReusableTCSelector
            projectKey={activeProject}
            onSelect={handleSelectReusableTC}
            onSwitchToScratch={() => setMode('scratch')}
          />
        )}
      </div>
    );
  }

  // Editor (scratch or post-reusable-selection)
  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-text-primary">Create Test Case</h1>
          <StatusBadge status={draft.status} />
          {draft.isReusable && draft.sourceTestKey && (
            <span className="px-2 py-0.5 text-xs font-mono bg-accent/10 text-accent rounded">
              Editing {draft.sourceTestKey}
            </span>
          )}
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
          Successfully {draft.isReusable ? 'updated' : 'imported as'} <strong>{importSuccess.testKey}</strong>
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
              ✓ {draft.isReusable ? 'Updated' : 'Imported as'} {draft.testKey}
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={handleSaveReady} disabled={saving || importing || !canImport()}>
                {saving ? 'Saving...' : 'Save & Mark Ready'}
              </Button>
              <Button onClick={handleImportToXray} disabled={saving || importing || !canImport()}>
                {importing
                  ? (draft.isReusable ? 'Updating...' : 'Importing...')
                  : (draft.isReusable ? 'Update in Xray' : 'Import to Xray')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Import Progress Modal */}
      <ImportProgressModal
        progress={importProgress}
        onClose={closeModal}
        jiraBaseUrl={config?.jiraBaseUrl}
      />
    </div>
  );
}

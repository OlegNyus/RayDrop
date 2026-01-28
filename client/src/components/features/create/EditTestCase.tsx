import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import type { DragEndEvent } from '@dnd-kit/core';
import { useApp } from '../../../context/AppContext';
import { Button, Card, StatusBadge, ConfirmModal } from '../../ui';
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
  useStepSensors,
} from './TestCaseFormComponents';
import { ImportedTestCaseView } from './ImportedTestCaseView';

export function EditTestCase() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeProject, refreshDrafts } = useApp();
  const sensors = useStepSensors();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [_originalDraft, setOriginalDraft] = useState<Draft | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Load draft directly from API by ID
  useEffect(() => {
    const loadDraft = async () => {
      if (!id) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const fetchedDraft = await draftsApi.get(id);
        setDraft(fetchedDraft);
        setOriginalDraft(fetchedDraft);
        setNotFound(false);
      } catch (err) {
        console.error('Failed to load draft:', err);
        if (err instanceof Error && err.message.includes('not found')) {
          setNotFound(true);
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load test case');
        }
      } finally {
        setLoading(false);
      }
    };

    loadDraft();
  }, [id]);

  // Navigate away if project changes and draft belongs to different project
  useEffect(() => {
    if (draft && activeProject && draft.projectKey !== activeProject) {
      navigate('/test-cases');
    }
  }, [activeProject, draft, navigate]);

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
    setDraft(d => d ? { ...d, ...updates, updatedAt: Date.now() } : null);
    setHasChanges(true);
  }, []);

  const updateXrayLinking = useCallback((updates: Partial<Draft['xrayLinking']>) => {
    setDraft(d => d ? { ...d, xrayLinking: { ...d.xrayLinking, ...updates }, updatedAt: Date.now() } : null);
    setHasChanges(true);
  }, []);

  const addStep = () => {
    if (!draft) return;
    updateDraft({ steps: [...draft.steps, createEmptyStep()] });
  };

  const removeStep = (stepId: string) => {
    if (!draft || draft.steps.length <= 1) return;
    updateDraft({ steps: draft.steps.filter(s => s.id !== stepId) });
  };

  const updateStep = (stepId: string, field: keyof TestStep, value: string) => {
    if (!draft) return;
    updateDraft({ steps: draft.steps.map(s => (s.id === stepId ? { ...s, [field]: value } : s)) });
    setErrors(e => {
      const key = `step_${draft.steps.findIndex(s => s.id === stepId)}_${field}`;
      const { [key]: _, ...rest } = e;
      return rest;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (!draft) return;
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

  const isStep1Valid = () => draft ? draft.summary.trim().length > 0 && draft.description.trim().length > 0 : false;
  const isStep2Valid = () => draft ? draft.steps.every(s => s.action.trim() && s.result.trim()) : false;
  const isStep3Valid = () => {
    if (!draft) return false;
    const { xrayLinking } = draft;
    return xrayLinking.testPlanIds.length > 0 && xrayLinking.testExecutionIds.length > 0 &&
           xrayLinking.testSetIds.length > 0 && xrayLinking.folderPath.trim().length > 0;
  };

  const validateStep1 = (): boolean => {
    if (!draft) return false;
    const newErrors: Record<string, string> = {};
    if (!draft.summary.trim()) newErrors.summary = 'Summary is required';
    if (!draft.description.trim()) newErrors.description = 'Description is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    if (!draft) return false;
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
    if (currentStep === 1 && validateStep1()) setCurrentStep(2);
    else if (currentStep === 2 && validateStep2()) setCurrentStep(3);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep((currentStep - 1) as Step);
  };

  const handleSaveDraft = async () => {
    if (!draft) return;
    // Draft can be saved with partial data - no validation required
    setSaving(true);
    try {
      const savedDraft = await draftsApi.update(draft.id, { ...draft, status: 'draft', projectKey: activeProject || '' });
      setDraft(savedDraft.draft);
      setOriginalDraft(savedDraft.draft);
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
    if (!draft) return;
    if (!validateStep1()) { setCurrentStep(1); return; }
    if (!validateStep2()) { setCurrentStep(2); return; }
    setShowXrayValidation(true);
    if (!isStep3Valid()) { setCurrentStep(3); return; }

    setSaving(true);
    try {
      await draftsApi.update(draft.id, { ...draft, status: 'ready', isComplete: true, projectKey: activeProject || '' });
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
    if (!draft || !activeProject) return;
    if (!validateStep1()) { setCurrentStep(1); return; }
    if (!validateStep2()) { setCurrentStep(2); return; }
    setShowXrayValidation(true);
    if (!isStep3Valid()) { setCurrentStep(3); return; }

    setImporting(true);
    setErrors({});
    setImportSuccess(null);

    try {
      // First save the draft as ready
      await draftsApi.update(draft.id, {
        ...draft,
        status: 'ready',
        isComplete: true,
        projectKey: activeProject,
      });

      // Import to Xray
      const importResult = await xrayApi.import([draft.id], activeProject);

      if (!importResult.success || !importResult.testIssueIds || !importResult.testKeys) {
        throw new Error(importResult.error || 'Import failed');
      }

      const testIssueId = importResult.testIssueIds[0];
      const testKey = importResult.testKeys[0];

      // Link to test plans
      for (const testPlanId of draft.xrayLinking.testPlanIds) {
        await xrayApi.addTestsToTestPlan(testPlanId, [testIssueId]);
      }

      // Link to test executions
      for (const testExecutionId of draft.xrayLinking.testExecutionIds) {
        await xrayApi.addTestsToTestExecution(testExecutionId, [testIssueId]);
      }

      // Link to test sets
      for (const testSetId of draft.xrayLinking.testSetIds) {
        await xrayApi.addTestsToTestSet(testSetId, [testIssueId]);
      }

      // Add to folder
      if (draft.xrayLinking.folderPath && draft.xrayLinking.projectId) {
        await xrayApi.addTestsToFolder(
          draft.xrayLinking.projectId,
          draft.xrayLinking.folderPath,
          [testIssueId]
        );
      }

      // Link preconditions
      if (draft.xrayLinking.preconditionIds.length > 0) {
        await xrayApi.addPreconditionsToTest(testIssueId, draft.xrayLinking.preconditionIds);
      }

      // Update local state with imported info
      setDraft({
        ...draft,
        status: 'imported',
        testKey,
        testIssueId,
      });
      setOriginalDraft({
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

  const handleBack = () => {
    if (hasChanges && !confirm('You have unsaved changes. Discard and go back?')) return;
    navigate('/test-cases');
  };

  const handleDelete = async () => {
    if (!draft) return;
    setDeleting(true);
    try {
      await draftsApi.delete(draft.id);
      await refreshDrafts();
      navigate('/test-cases');
    } catch (err) {
      console.error('Failed to delete:', err);
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
          <p className="text-text-muted">Loading test case...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto px-4 py-6">
        <Card className="text-center py-12">
          <p className="text-error mb-2">Error loading test case</p>
          <p className="text-text-muted text-sm">{error}</p>
          <Button className="mt-4" onClick={() => navigate('/test-cases')}>Back to Test Cases</Button>
        </Card>
      </div>
    );
  }

  if (notFound || !draft) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto px-4 py-6">
        <Card className="text-center py-12">
          <p className="text-text-muted">Test case not found.</p>
          <p className="text-text-muted text-sm mt-1">ID: {id}</p>
          <Button className="mt-4" onClick={() => navigate('/test-cases')}>Back to Test Cases</Button>
        </Card>
      </div>
    );
  }

  // Show read-only view for imported test cases
  if (draft.status === 'imported') {
    return <ImportedTestCaseView draft={draft} />;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-text-primary">Edit Test Case</h1>
          <StatusBadge status={draft.status} />
          {hasChanges && <span className="text-sm text-warning">• Unsaved</span>}
        </div>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="p-2 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
          title="Delete test case"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
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
        ) : (
          <Button variant="ghost" onClick={handleBack} disabled={importing}>← Back</Button>
        )}
        <div className="flex gap-2">
          {draft.status !== 'ready' && (
            <Button variant="secondary" onClick={handleSaveDraft} disabled={saving || importing || !hasChanges}>
              Update Draft
            </Button>
          )}
          {currentStep < 3 ? (
            <Button onClick={nextStep} disabled={importing}>Next →</Button>
          ) : (
            <>
              {draft.status === 'ready' ? (
                <Button variant="secondary" onClick={handleSaveReady} disabled={saving || importing || !hasChanges}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              ) : (
                <Button variant="secondary" onClick={handleSaveReady} disabled={saving || importing}>
                  {saving ? 'Saving...' : 'Save & Mark Ready'}
                </Button>
              )}
              <Button onClick={handleImportToXray} disabled={saving || importing}>
                {importing ? 'Importing...' : 'Import to Xray'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        title="Delete Test Case"
        message={`Are you sure you want to delete "${draft.summary || 'Untitled'}"?`}
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  );
}

import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import type { DragEndEvent } from '@dnd-kit/core';
import { useApp } from '../../../context/AppContext';
import { Button, Card, StatusBadge } from '../../ui';
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

export function EditTestCase() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeProject, refreshDrafts, drafts } = useApp();
  const sensors = useStepSensors();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [projectSettings, setProjectSettings] = useState<ProjectSettings | null>(null);
  const [xrayCache, setXrayCache] = useState<XrayCache>({
    testPlans: [], testExecutions: [], testSets: [], preconditions: [], folders: [],
  });
  const [loadingXray, setLoadingXray] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showXrayValidation, setShowXrayValidation] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load draft by ID
  useEffect(() => {
    if (id && drafts.length > 0) {
      const found = drafts.find(d => d.id === id);
      if (found) {
        setDraft(found);
        setNotFound(false);
      } else {
        setNotFound(true);
      }
      setLoading(false);
    } else if (drafts.length > 0) {
      setLoading(false);
      setNotFound(true);
    }
  }, [id, drafts]);

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
      const [testPlans, testExecutions, testSets, preconditions] = await Promise.all([
        xrayApi.getTestPlans(activeProject).catch(() => []),
        xrayApi.getTestExecutions(activeProject).catch(() => []),
        xrayApi.getTestSets(activeProject).catch(() => []),
        xrayApi.getPreconditions(activeProject).catch(() => []),
      ]);
      setXrayCache({
        testPlans, testExecutions, testSets, preconditions,
        folders: [{ path: '/', name: '/ (Root)' }],
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
    if (!draft || !validateStep1()) { setCurrentStep(1); return; }

    setSaving(true);
    try {
      await draftsApi.update(draft.id, { ...draft, status: 'draft', projectKey: activeProject || '' });
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

  const handleBack = () => {
    if (hasChanges && !confirm('You have unsaved changes. Discard and go back?')) return;
    navigate('/test-cases');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-text-muted">Loading...</p>
      </div>
    );
  }

  if (notFound || !draft) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto px-4 py-6">
        <Card className="text-center py-12">
          <p className="text-text-muted">Test case not found.</p>
          <Button className="mt-4" onClick={() => navigate('/test-cases')}>Back to Test Cases</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-text-primary">Edit Test Case</h1>
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
          <Button variant="ghost" onClick={prevStep}>← Previous</Button>
        ) : (
          <Button variant="ghost" onClick={handleBack}>← Back</Button>
        )}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleSaveDraft} disabled={saving || !hasChanges}>
            Update Draft
          </Button>
          {currentStep < 3 ? (
            <Button onClick={nextStep}>Next →</Button>
          ) : (
            <Button onClick={handleSaveReady} disabled={saving}>{saving ? 'Saving...' : 'Save & Mark Ready'}</Button>
          )}
        </div>
      </div>
    </div>
  );
}

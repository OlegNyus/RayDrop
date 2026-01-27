import { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useApp } from '../../../context/AppContext';
import { Button, Card, Input, SummaryInput, SortableStepCard, SearchableMultiSelect, FolderInput } from '../../ui';
import { draftsApi, xrayApi, settingsApi } from '../../../services/api';
import type { Draft, TestStep, XrayEntity, ProjectSettings } from '../../../types';

type Step = 1 | 2 | 3;

function generateId(): string {
  return crypto.randomUUID();
}

function createEmptyStep(): TestStep {
  return { id: generateId(), action: '', data: '', result: '' };
}

function createEmptyDraft(projectKey: string): Draft {
  return {
    id: generateId(),
    summary: '',
    description: '',
    testType: 'Manual',
    priority: 'Medium',
    labels: [],
    collectionId: null,
    steps: [createEmptyStep()],
    xrayLinking: {
      testPlanIds: [],
      testPlanDisplays: [],
      testExecutionIds: [],
      testExecutionDisplays: [],
      testSetIds: [],
      testSetDisplays: [],
      preconditionIds: [],
      preconditionDisplays: [],
      folderPath: '/',
      projectId: '',
    },
    status: 'new',
    updatedAt: Date.now(),
    createdAt: Date.now(),
    isComplete: false,
    projectKey,
  };
}

interface XrayCache {
  testPlans: XrayEntity[];
  testExecutions: XrayEntity[];
  testSets: XrayEntity[];
  preconditions: XrayEntity[];
  folders: { path: string; name: string }[];
}

export function CreateTestCase() {
  const { activeProject, refreshDrafts, setActiveNav } = useApp();

  // Form state
  const [draft, setDraft] = useState<Draft>(() => createEmptyDraft(activeProject || ''));
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [hasChanges, setHasChanges] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Project settings
  const [projectSettings, setProjectSettings] = useState<ProjectSettings | null>(null);

  // Xray entities cache
  const [xrayCache, setXrayCache] = useState<XrayCache>({
    testPlans: [],
    testExecutions: [],
    testSets: [],
    preconditions: [],
    folders: [],
  });
  const [loadingXray, setLoadingXray] = useState(false);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showXrayValidation, setShowXrayValidation] = useState(false);

  // Saving state
  const [saving, setSaving] = useState(false);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Load project settings and Xray entities
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
        testPlans,
        testExecutions,
        testSets,
        preconditions,
        folders: [{ path: '/', name: '/ (Root)' }], // TODO: Load from API
      });
    } catch (err) {
      console.error('Failed to load Xray entities:', err);
    } finally {
      setLoadingXray(false);
    }
  };

  // Update draft helper
  const updateDraft = useCallback((updates: Partial<Draft>) => {
    setDraft(d => ({ ...d, ...updates, updatedAt: Date.now() }));
    setHasChanges(true);
  }, []);

  const updateXrayLinking = useCallback((updates: Partial<Draft['xrayLinking']>) => {
    setDraft(d => ({
      ...d,
      xrayLinking: { ...d.xrayLinking, ...updates },
      updatedAt: Date.now(),
    }));
    setHasChanges(true);
  }, []);

  // Step management
  const addStep = () => {
    updateDraft({ steps: [...draft.steps, createEmptyStep()] });
  };

  const removeStep = (id: string) => {
    if (draft.steps.length > 1) {
      updateDraft({ steps: draft.steps.filter(s => s.id !== id) });
    }
  };

  const updateStep = (id: string, field: keyof TestStep, value: string) => {
    updateDraft({
      steps: draft.steps.map(s => (s.id === id ? { ...s, [field]: value } : s)),
    });
    // Clear error on edit
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

  // Labels management
  const addLabel = (label: string) => {
    if (label.trim() && !draft.labels.includes(label.trim())) {
      updateDraft({ labels: [...draft.labels, label.trim()] });
    }
  };

  const removeLabel = (label: string) => {
    updateDraft({ labels: draft.labels.filter(l => l !== label) });
  };

  // Functional areas management
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

  // Validation
  const isStep1Valid = () => {
    return draft.summary.trim().length > 0 && draft.description.trim().length > 0;
  };

  const isStep2Valid = () => {
    return draft.steps.every(s => s.action.trim() && s.result.trim());
  };

  const isStep3Valid = () => {
    const { xrayLinking } = draft;
    return (
      xrayLinking.testPlanIds.length > 0 &&
      xrayLinking.testExecutionIds.length > 0 &&
      xrayLinking.testSetIds.length > 0 &&
      xrayLinking.folderPath.trim().length > 0
    );
  };

  const validateStep1 = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!draft.summary.trim()) newErrors.summary = 'Summary is required';
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

  const validateForImport = (): boolean => {
    if (!validateStep1()) {
      setCurrentStep(1);
      return false;
    }
    if (!validateStep2()) {
      setCurrentStep(2);
      return false;
    }
    setShowXrayValidation(true);
    if (!isStep3Valid()) {
      setCurrentStep(3);
      return false;
    }
    return true;
  };

  // Navigation
  const goToStep = (step: Step) => {
    if (step < currentStep || (step === 2 && isStep1Valid()) || (step === 3 && isStep2Valid())) {
      setCurrentStep(step);
    }
  };

  const nextStep = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
    } else if (currentStep === 2 && validateStep2()) {
      setCurrentStep(3);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as Step);
    }
  };

  // Save draft
  const handleSaveDraft = async () => {
    if (!validateStep1()) {
      setCurrentStep(1);
      return;
    }

    setSaving(true);
    try {
      const toSave: Draft = {
        ...draft,
        status: 'draft',
        projectKey: activeProject || '',
      };

      if (editingId) {
        await draftsApi.update(editingId, toSave);
      } else {
        const result = await draftsApi.create(toSave);
        setEditingId(result.draft.id);
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

  // Save as ready
  const handleSaveReady = async () => {
    if (!validateForImport()) return;

    setSaving(true);
    try {
      const toSave: Draft = {
        ...draft,
        status: 'ready',
        isComplete: true,
        projectKey: activeProject || '',
      };

      if (editingId) {
        await draftsApi.update(editingId, toSave);
      } else {
        await draftsApi.create(toSave);
      }

      await refreshDrafts();
      setActiveNav('test-cases');
    } catch (err) {
      console.error('Failed to save:', err);
      setErrors({ save: err instanceof Error ? err.message : 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  // Reset form
  const resetForm = () => {
    if (hasChanges && !confirm('You have unsaved changes. Are you sure you want to reset?')) {
      return;
    }
    setDraft(createEmptyDraft(activeProject || ''));
    setEditingId(null);
    setCurrentStep(1);
    setHasChanges(false);
    setErrors({});
    setShowXrayValidation(false);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {editingId ? 'Edit Test Case' : 'Create Test Case'}
          </h1>
          {hasChanges && (
            <span className="text-sm text-warning">• Unsaved changes</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={resetForm}>
            Reset
          </Button>
          <Button variant="secondary" onClick={handleSaveDraft} disabled={saving}>
            {editingId ? 'Update Draft' : 'Save Draft'}
          </Button>
          <Button onClick={handleSaveReady} disabled={saving}>
            {saving ? 'Saving...' : 'Save & Mark Ready'}
          </Button>
        </div>
      </div>

      {/* Progress Steps */}
      <StepIndicator
        currentStep={currentStep}
        onStepClick={goToStep}
        step1Valid={isStep1Valid()}
        step2Valid={isStep2Valid()}
        step3Valid={isStep3Valid()}
      />

      {/* Global Error */}
      {errors.save && (
        <div className="p-3 bg-red-100 dark:bg-red-900/30 text-error rounded-lg text-sm">
          {errors.save}
        </div>
      )}

      {/* Step Content */}
      {currentStep === 1 && (
        <Step1BasicInfo
          draft={draft}
          updateDraft={updateDraft}
          errors={errors}
          projectSettings={projectSettings}
          onAreasChange={updateFunctionalAreas}
          addLabel={addLabel}
          removeLabel={removeLabel}
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

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-border">
        <Button variant="secondary" onClick={prevStep} disabled={currentStep === 1}>
          ← Previous
        </Button>
        {currentStep < 3 ? (
          <Button onClick={nextStep}>
            Next →
          </Button>
        ) : (
          <Button onClick={handleSaveReady} disabled={saving}>
            Complete & Save
          </Button>
        )}
      </div>
    </div>
  );
}

// Step Indicator Component
function StepIndicator({
  currentStep,
  onStepClick,
  step1Valid,
  step2Valid,
  step3Valid,
}: {
  currentStep: Step;
  onStepClick: (step: Step) => void;
  step1Valid: boolean;
  step2Valid: boolean;
  step3Valid: boolean;
}) {
  const steps = [
    { num: 1 as Step, label: 'Basic Info', valid: step1Valid },
    { num: 2 as Step, label: 'Test Steps', valid: step2Valid },
    { num: 3 as Step, label: 'Xray Linking', valid: step3Valid },
  ];

  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((step, i) => {
        const isComplete = step.num < currentStep && step.valid;
        const isCurrent = step.num === currentStep;

        return (
          <div key={step.num} className="flex items-center">
            <button
              onClick={() => onStepClick(step.num)}
              disabled={step.num > currentStep && !steps[step.num - 2]?.valid}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isCurrent
                  ? 'bg-accent text-white'
                  : isComplete
                  ? 'bg-success/20 text-success hover:bg-success/30'
                  : 'bg-sidebar text-text-secondary hover:bg-sidebar-hover disabled:opacity-50'
              }`}
            >
              <span className="w-6 h-6 flex items-center justify-center rounded-full bg-white/20 text-sm font-medium">
                {isComplete ? '✓' : step.num}
              </span>
              <span className="text-sm font-medium hidden sm:inline">{step.label}</span>
            </button>
            {i < steps.length - 1 && (
              <div className={`w-8 h-0.5 mx-2 ${isComplete ? 'bg-success' : 'bg-border'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Step 1: Basic Info
function Step1BasicInfo({
  draft,
  updateDraft,
  errors,
  projectSettings,
  onAreasChange,
  addLabel,
  removeLabel,
}: {
  draft: Draft;
  updateDraft: (updates: Partial<Draft>) => void;
  errors: Record<string, string>;
  projectSettings: ProjectSettings | null;
  onAreasChange: (areas: string[]) => void;
  addLabel: (label: string) => void;
  removeLabel: (label: string) => void;
}) {
  const [labelInput, setLabelInput] = useState('');

  const handleAddLabel = () => {
    if (labelInput.trim()) {
      addLabel(labelInput.trim());
      setLabelInput('');
    }
  };

  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-semibold text-text-primary">Basic Information</h2>

      <SummaryInput
        value={draft.summary}
        onChange={summary => updateDraft({ summary })}
        functionalAreas={projectSettings?.functionalAreas || []}
        onAreasChange={onAreasChange}
        error={errors.summary}
      />

      <div className="space-y-1">
        <label className="block text-sm font-medium text-text-primary">
          Description <span className="text-error">*</span>
        </label>
        <textarea
          value={draft.description}
          onChange={e => updateDraft({ description: e.target.value })}
          placeholder="Detailed description of the test case..."
          className={`w-full px-3 py-2 bg-input-bg border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent min-h-[100px] ${
            errors.description ? 'border-error' : 'border-input-border'
          }`}
        />
        {errors.description && <p className="text-xs text-error">{errors.description}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-text-primary">Test Type</label>
          <div className="px-3 py-2 bg-sidebar rounded-lg text-text-secondary text-sm">
            {draft.testType}
          </div>
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-text-primary">Priority</label>
          <div className="px-3 py-2 bg-sidebar rounded-lg text-text-secondary text-sm">
            {draft.priority}
          </div>
        </div>
      </div>

      {/* Labels */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-text-primary">Labels</label>
        <div className="flex gap-2">
          <Input
            value={labelInput}
            onChange={e => setLabelInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddLabel())}
            placeholder="Add a label..."
            className="flex-1"
          />
          <Button variant="secondary" onClick={handleAddLabel}>Add</Button>
        </div>
        {draft.labels.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {draft.labels.map(label => (
              <span
                key={label}
                className="inline-flex items-center gap-1 px-2 py-1 bg-badge-bg text-badge-text rounded text-sm"
              >
                {label}
                <button onClick={() => removeLabel(label)} className="hover:text-error">×</button>
              </span>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

// Step 2: Test Steps
function Step2TestSteps({
  draft,
  sensors,
  onDragEnd,
  addStep,
  removeStep,
  updateStep,
  errors,
}: {
  draft: Draft;
  sensors: ReturnType<typeof useSensors>;
  onDragEnd: (event: DragEndEvent) => void;
  addStep: () => void;
  removeStep: (id: string) => void;
  updateStep: (id: string, field: keyof TestStep, value: string) => void;
  errors: Record<string, string>;
}) {
  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Test Steps</h2>
        <Button onClick={addStep}>+ Add Step</Button>
      </div>

      <p className="text-sm text-text-muted">
        Drag steps to reorder. Each step requires an action and expected result.
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={draft.steps.map(s => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {draft.steps.map((step, index) => (
              <SortableStepCard
                key={step.id}
                step={step}
                index={index}
                totalSteps={draft.steps.length}
                onChange={(field, value) => updateStep(step.id, field, value)}
                onRemove={() => removeStep(step.id)}
                errors={{
                  action: errors[`step_${index}_action`],
                  result: errors[`step_${index}_result`],
                }}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </Card>
  );
}

// Step 3: Xray Linking
function Step3XrayLinking({
  draft,
  updateXrayLinking,
  xrayCache,
  loadingXray,
  onRefresh,
  showValidation,
}: {
  draft: Draft;
  updateXrayLinking: (updates: Partial<Draft['xrayLinking']>) => void;
  xrayCache: XrayCache;
  loadingXray: boolean;
  onRefresh: () => void;
  showValidation: boolean;
}) {
  const { xrayLinking } = draft;

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Xray Linking</h2>
        <Button variant="ghost" onClick={onRefresh} disabled={loadingXray}>
          {loadingXray ? 'Loading...' : '↻ Refresh'}
        </Button>
      </div>

      <p className="text-sm text-text-muted">
        Link this test case to Xray entities. All fields except Preconditions are required for import.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SearchableMultiSelect
          label="Test Plans"
          options={xrayCache.testPlans}
          selectedIds={xrayLinking.testPlanIds}
          selectedDisplays={xrayLinking.testPlanDisplays}
          onChange={(ids, displays) => updateXrayLinking({ testPlanIds: ids, testPlanDisplays: displays })}
          placeholder="Search test plans..."
          loading={loadingXray}
          required
          error={showValidation && xrayLinking.testPlanIds.length === 0 ? 'At least one test plan required' : undefined}
        />

        <SearchableMultiSelect
          label="Test Executions"
          options={xrayCache.testExecutions}
          selectedIds={xrayLinking.testExecutionIds}
          selectedDisplays={xrayLinking.testExecutionDisplays}
          onChange={(ids, displays) => updateXrayLinking({ testExecutionIds: ids, testExecutionDisplays: displays })}
          placeholder="Search test executions..."
          loading={loadingXray}
          required
          error={showValidation && xrayLinking.testExecutionIds.length === 0 ? 'At least one test execution required' : undefined}
        />

        <SearchableMultiSelect
          label="Test Sets"
          options={xrayCache.testSets}
          selectedIds={xrayLinking.testSetIds}
          selectedDisplays={xrayLinking.testSetDisplays}
          onChange={(ids, displays) => updateXrayLinking({ testSetIds: ids, testSetDisplays: displays })}
          placeholder="Search test sets..."
          loading={loadingXray}
          required
          error={showValidation && xrayLinking.testSetIds.length === 0 ? 'At least one test set required' : undefined}
        />

        <SearchableMultiSelect
          label="Preconditions"
          options={xrayCache.preconditions}
          selectedIds={xrayLinking.preconditionIds}
          selectedDisplays={xrayLinking.preconditionDisplays}
          onChange={(ids, displays) => updateXrayLinking({ preconditionIds: ids, preconditionDisplays: displays })}
          placeholder="Search preconditions..."
          loading={loadingXray}
        />
      </div>

      <FolderInput
        value={xrayLinking.folderPath}
        onChange={folderPath => updateXrayLinking({ folderPath })}
        folders={xrayCache.folders}
        loading={loadingXray}
        required
        error={showValidation && !xrayLinking.folderPath.trim() ? 'Folder path is required' : undefined}
      />

      {/* Summary */}
      <div className="mt-6 p-4 bg-background rounded-lg">
        <h3 className="text-sm font-medium text-text-primary mb-2">Test Case Summary</h3>
        <div className="text-sm text-text-secondary space-y-1">
          <p><strong>Summary:</strong> {draft.summary || '(not set)'}</p>
          <p><strong>Steps:</strong> {draft.steps.length}</p>
          <p><strong>Test Plans:</strong> {xrayLinking.testPlanIds.length}</p>
          <p><strong>Test Executions:</strong> {xrayLinking.testExecutionIds.length}</p>
          <p><strong>Test Sets:</strong> {xrayLinking.testSetIds.length}</p>
          <p><strong>Folder:</strong> {xrayLinking.folderPath || '(not set)'}</p>
        </div>
      </div>
    </Card>
  );
}

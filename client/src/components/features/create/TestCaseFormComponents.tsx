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
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Button, Card, SummaryInput, LabelInput, SortableStepCard, SearchableMultiSelect, FolderInput } from '../../ui';
import type { Draft, TestStep, XrayEntity, ProjectSettings } from '../../../types';

// Types
export type Step = 1 | 2 | 3;

export interface XrayCache {
  testPlans: XrayEntity[];
  testExecutions: XrayEntity[];
  testSets: XrayEntity[];
  preconditions: XrayEntity[];
  folders: { path: string; name: string }[];
}

// Helper functions
export function createEmptyStep(): TestStep {
  return { id: crypto.randomUUID(), action: '', data: '', result: '' };
}

export function createEmptyDraft(projectKey: string): Draft {
  return {
    id: crypto.randomUUID(),
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

// Custom hook for DnD sensors
export function useStepSensors() {
  return useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
}

// Step Indicator Component
interface StepIndicatorProps {
  currentStep: Step;
  onStepClick: (step: Step) => void;
  step1Valid: boolean;
  step2Valid: boolean;
  step3Valid: boolean;
  status: string;
}

export function StepIndicator({ currentStep, onStepClick, step1Valid, step2Valid, step3Valid, status }: StepIndicatorProps) {
  const steps = [
    { num: 1 as Step, label: 'Basic Info', valid: step1Valid },
    { num: 2 as Step, label: 'Test Steps', valid: step2Valid },
    { num: 3 as Step, label: 'Xray Linking', valid: step3Valid },
  ];
  const isImported = status === 'imported';

  return (
    <div className="relative">
      <div className="absolute top-5 left-0 right-0 h-0.5 bg-border" />
      <div className="relative flex justify-between">
        {steps.map(step => {
          // Step is complete if: (before current AND valid) OR (step 3 with all required fields filled)
          const isComplete = (step.num < currentStep && step.valid) || (step.num === 3 && step.valid);
          const isCurrent = step.num === currentStep && !isComplete;
          const isClickable = step.num <= currentStep || (step.num === 2 && step1Valid) || (step.num === 3 && step2Valid);

          return (
            <button
              key={step.num}
              onClick={() => isClickable && onStepClick(step.num)}
              disabled={!isClickable}
              className={`flex flex-col items-center gap-2 group ${!isClickable ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all border-2 ${
                isComplete ? 'bg-success border-success text-white' :
                isCurrent ? 'bg-accent border-accent text-white' :
                'bg-card border-border text-text-muted group-hover:border-text-muted'
              }`}>
                {isComplete ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : step.num}
              </div>
              <span className={`text-xs font-medium transition-colors ${
                isComplete ? 'text-success' : isCurrent ? 'text-accent' : 'text-text-muted'
              }`}>{step.label}</span>
            </button>
          );
        })}

        {/* Imported indicator */}
        <div className={`flex flex-col items-center gap-2 ${isImported ? '' : 'opacity-30'}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold border-2 ${
            isImported ? 'bg-success border-success text-white' : 'bg-card border-border text-text-muted'
          }`}>
            {isImported ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            )}
          </div>
          <span className={`text-xs font-medium ${isImported ? 'text-success' : 'text-text-muted'}`}>Imported</span>
        </div>
      </div>
    </div>
  );
}

// Step 1: Basic Info
interface Step1Props {
  draft: Draft;
  updateDraft: (updates: Partial<Draft>) => void;
  errors: Record<string, string>;
  projectSettings: ProjectSettings | null;
  onAreasChange: (areas: string[]) => void;
}

export function Step1BasicInfo({ draft, updateDraft, errors, projectSettings, onAreasChange }: Step1Props) {
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
          <div className="px-3 py-2 bg-sidebar rounded-lg text-text-secondary text-sm">{draft.testType}</div>
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-text-primary">Priority</label>
          <div className="px-3 py-2 bg-sidebar rounded-lg text-text-secondary text-sm">{draft.priority}</div>
        </div>
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-text-primary">Labels</label>
        <LabelInput
          labels={draft.labels}
          onChange={labels => updateDraft({ labels })}
          placeholder="Search or create labels..."
        />
      </div>
    </Card>
  );
}

// Step 2: Test Steps
interface Step2Props {
  draft: Draft;
  sensors: ReturnType<typeof useSensors>;
  onDragEnd: (event: DragEndEvent) => void;
  addStep: () => void;
  removeStep: (id: string) => void;
  updateStep: (id: string, field: keyof TestStep, value: string) => void;
  errors: Record<string, string>;
}

export function Step2TestSteps({ draft, sensors, onDragEnd, addStep, removeStep, updateStep, errors }: Step2Props) {
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
interface Step3Props {
  draft: Draft;
  updateXrayLinking: (updates: Partial<Draft['xrayLinking']>) => void;
  xrayCache: XrayCache;
  loadingXray: boolean;
  onRefresh: () => void;
  showValidation: boolean;
}

export function Step3XrayLinking({ draft, updateXrayLinking, xrayCache, loadingXray, onRefresh, showValidation }: Step3Props) {
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
    </Card>
  );
}

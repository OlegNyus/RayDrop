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

export function EditTestCase() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeProject, refreshDrafts, config } = useApp();
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

  const loadProjectSettings = useCallback(async () => {
    if (!activeProject) return;
    try {
      const settings = await settingsApi.getProjectSettings(activeProject);
      setProjectSettings(settings);
    } catch (err) {
      console.error('Failed to load project settings:', err);
    }
  }, [activeProject]);

  const loadXrayEntities = useCallback(async () => {
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
        setDraft(d => d ? { ...d, xrayLinking: { ...d.xrayLinking, projectId: foldersResult.projectId } } : null);
      }
    } catch (err) {
      console.error('Failed to load Xray entities:', err);
    } finally {
      setLoadingXray(false);
    }
  }, [activeProject]);

  useEffect(() => {
    if (activeProject) {
      loadProjectSettings();
      loadXrayEntities();
    }
  }, [activeProject, loadProjectSettings, loadXrayEntities]);

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

  const isStep1Valid = () => draft ? summaryHasTitle(draft.summary) && draft.description.trim().length > 0 : false;
  const isStep2Valid = () => draft ? draft.steps.every(s => s.action.trim() && s.result.trim()) : false;

  // Can import/mark ready only if all steps are valid
  const canImport = () => isStep1Valid() && isStep2Valid() && isStep3Valid();

  // Can save draft if at least ONE required field has content
  const canSaveDraft = () => {
    if (!draft) return false;
    const hasSummary = draft.summary.trim().length > 0;
    const hasDescription = draft.description.trim().length > 0;
    const hasStepContent = draft.steps.some(s => s.action.trim().length > 0 || s.result.trim().length > 0);
    return hasSummary || hasDescription || hasStepContent;
  };
  const isStep3Valid = () => {
    if (!draft) return false;
    const { xrayLinking } = draft;
    return xrayLinking.testPlanIds.length > 0 && xrayLinking.testExecutionIds.length > 0 &&
           xrayLinking.testSetIds.length > 0 && xrayLinking.folderPath.trim().length > 0;
  };

  const validateStep1 = (): boolean => {
    if (!draft) return false;
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
    // Allow free navigation between steps - validation only happens on Mark Ready / Import
    if (currentStep < 3) setCurrentStep((currentStep + 1) as Step);
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

  // Build the steps list for progress tracking
  const buildProgressSteps = useCallback((): ImportStep[] => {
    if (!draft) return [];

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
    if (!draft || !activeProject) return;
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
      linkedItems: [],
      failedItems: [],
      isComplete: false,
      hasErrors: false,
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
      // Step 1: Save draft as ready
      await draftsApi.update(draft.id, {
        ...draft,
        status: 'ready',
        isComplete: true,
        projectKey: activeProject,
      });

      // Step 2: Create test in Jira
      updateStep('create', 'in-progress');
      const importResult = await xrayApi.import([draft.id], activeProject);

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

      // Update progress to validation phase
      setImportProgress(prev => ({
        ...prev,
        phase: 'validating',
        linkedItems,
        failedItems,
        hasErrors,
      }));

      // Validate links by fetching test from Xray
      let validation: ValidationResult | null = null;
      try {
        const testLinks = await xrayApi.getTestLinks(testIssueId);

        // Build expected arrays from what we tried to link
        const expectedPlanIds = draft.xrayLinking.testPlanIds;
        const expectedExecIds = draft.xrayLinking.testExecutionIds;
        const expectedSetIds = draft.xrayLinking.testSetIds;
        const expectedPreconditionIds = draft.xrayLinking.preconditionIds;
        const expectedFolder = draft.xrayLinking.folderPath !== '/' ? draft.xrayLinking.folderPath : null;

        // Get found IDs from Xray response
        const foundPlanIds = testLinks.testPlans.map(p => p.issueId);
        const foundExecIds = testLinks.testExecutions.map(e => e.issueId);
        const foundSetIds = testLinks.testSets.map(s => s.issueId);
        const foundPreconditionIds = testLinks.preconditions.map(p => p.issueId);
        const foundFolder = testLinks.folder || null;

        // Calculate missing (expected but not found)
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

        // Check if validation found any missing links
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
        // Validation failed but import may have succeeded - don't mark as error
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

  // Show read-only view for imported test cases (but keep modal visible until closed)
  if (draft.status === 'imported' && !importProgress.isOpen) {
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
        ) : (
          <Button variant="ghost" onClick={handleBack} disabled={importing}>← Back</Button>
        )}
        <div className="flex gap-2">
          {draft.status !== 'ready' && (
            <Button variant="secondary" onClick={handleSaveDraft} disabled={saving || importing || !hasChanges || !canSaveDraft()}>
              Update Draft
            </Button>
          )}
          {currentStep < 3 ? (
            <Button onClick={nextStep} disabled={importing}>Next →</Button>
          ) : (
            <>
              {draft.status === 'ready' ? (
                <Button variant="secondary" onClick={handleSaveReady} disabled={saving || importing || !hasChanges || !canImport()}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              ) : (
                <Button variant="secondary" onClick={handleSaveReady} disabled={saving || importing || !canImport()}>
                  {saving ? 'Saving...' : 'Save & Mark Ready'}
                </Button>
              )}
              <Button onClick={handleImportToXray} disabled={saving || importing || !canImport()}>
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
          <p className="text-sm text-accent">Sync to Xray Cloud</p>
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
                  {progress.validation && (
                    <div className="mt-3 text-xs">
                      {progress.validation.isValidated ? (
                        <span className="flex items-center justify-center gap-1 text-success">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                          Links verified in Xray
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-1 text-text-muted">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Verification pending
                        </span>
                      )}
                    </div>
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

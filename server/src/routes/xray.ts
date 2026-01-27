import { Router, Request, Response } from 'express';
import {
  importToXrayAndWait,
  getTestPlans,
  getTestExecutions,
  getTestSets,
  getPreconditions,
  getFolders,
  getProjectId,
  addTestsToTestPlan,
  addTestsToTestExecution,
  addTestsToTestSet,
  addTestsToFolder,
  addPreconditionsToTest,
  removeTestsFromTestPlan,
  removeTestsFromTestExecution,
  removeTestsFromTestSet,
  removeTestsFromFolder,
  removePreconditionsFromTest,
} from '../utils/xrayClient.js';
import { readDraft, writeDraft } from '../utils/fileOperations.js';
import type { Draft } from '../types.js';

const router = Router();

/**
 * @swagger
 * /api/xray/import:
 *   post:
 *     summary: Import test cases to Xray
 *     tags: [Xray]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [draftIds]
 *             properties:
 *               draftIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               projectKey:
 *                 type: string
 *     responses:
 *       200:
 *         description: Import result
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ImportResult'
 */
router.post('/import', async (req: Request, res: Response) => {
  try {
    const { draftIds, projectKey } = req.body;

    if (!draftIds || !Array.isArray(draftIds) || draftIds.length === 0) {
      return res.status(400).json({ error: 'draftIds array is required' });
    }

    const drafts: Draft[] = [];
    for (const id of draftIds) {
      const draft = readDraft(id);
      if (draft) {
        drafts.push(draft);
      }
    }

    if (drafts.length === 0) {
      return res.status(404).json({ error: 'No valid drafts found' });
    }

    const result = await importToXrayAndWait(drafts, projectKey);

    if (result.success && result.testKeys && result.testIssueIds) {
      for (let i = 0; i < drafts.length && i < result.testKeys.length; i++) {
        drafts[i].status = 'imported';
        drafts[i].testKey = result.testKeys[i];
        drafts[i].testIssueId = result.testIssueIds[i];
        drafts[i].updatedAt = Date.now();
        writeDraft(drafts[i].id, drafts[i]);
      }
    }

    return res.json(result);
  } catch (error) {
    console.error('Error importing to Xray:', error);
    return res.status(500).json({ error: 'Failed to import to Xray' });
  }
});

/**
 * @swagger
 * /api/xray/test-plans/{projectKey}:
 *   get:
 *     summary: Get test plans for a project
 *     tags: [Xray]
 *     parameters:
 *       - in: path
 *         name: projectKey
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of test plans
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/XrayEntity'
 */
router.get('/test-plans/:projectKey', async (req: Request, res: Response) => {
  try {
    const { projectKey } = req.params;
    const testPlans = await getTestPlans(projectKey);
    return res.json(testPlans);
  } catch (error) {
    console.error('Error fetching test plans:', error);
    return res.status(500).json({ error: 'Failed to fetch test plans' });
  }
});

/**
 * @swagger
 * /api/xray/test-executions/{projectKey}:
 *   get:
 *     summary: Get test executions for a project
 *     tags: [Xray]
 *     parameters:
 *       - in: path
 *         name: projectKey
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of test executions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/XrayEntity'
 */
router.get('/test-executions/:projectKey', async (req: Request, res: Response) => {
  try {
    const { projectKey } = req.params;
    const testExecutions = await getTestExecutions(projectKey);
    return res.json(testExecutions);
  } catch (error) {
    console.error('Error fetching test executions:', error);
    return res.status(500).json({ error: 'Failed to fetch test executions' });
  }
});

/**
 * @swagger
 * /api/xray/test-sets/{projectKey}:
 *   get:
 *     summary: Get test sets for a project
 *     tags: [Xray]
 *     parameters:
 *       - in: path
 *         name: projectKey
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of test sets
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/XrayEntity'
 */
router.get('/test-sets/:projectKey', async (req: Request, res: Response) => {
  try {
    const { projectKey } = req.params;
    const testSets = await getTestSets(projectKey);
    return res.json(testSets);
  } catch (error) {
    console.error('Error fetching test sets:', error);
    return res.status(500).json({ error: 'Failed to fetch test sets' });
  }
});

/**
 * @swagger
 * /api/xray/preconditions/{projectKey}:
 *   get:
 *     summary: Get preconditions for a project
 *     tags: [Xray]
 *     parameters:
 *       - in: path
 *         name: projectKey
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of preconditions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/XrayEntity'
 */
router.get('/preconditions/:projectKey', async (req: Request, res: Response) => {
  try {
    const { projectKey } = req.params;
    const preconditions = await getPreconditions(projectKey);
    return res.json(preconditions);
  } catch (error) {
    console.error('Error fetching preconditions:', error);
    return res.status(500).json({ error: 'Failed to fetch preconditions' });
  }
});

/**
 * @swagger
 * /api/xray/project-id/{projectKey}:
 *   get:
 *     summary: Get project ID from key
 *     tags: [Xray]
 *     parameters:
 *       - in: path
 *         name: projectKey
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Project ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 projectId:
 *                   type: string
 */
router.get('/project-id/:projectKey', async (req: Request, res: Response) => {
  try {
    const { projectKey } = req.params;
    const projectId = await getProjectId(projectKey);
    return res.json({ projectId });
  } catch (error) {
    console.error('Error fetching project ID:', error);
    return res.status(500).json({ error: 'Failed to fetch project ID' });
  }
});

/**
 * @swagger
 * /api/xray/folders/{projectId}:
 *   get:
 *     summary: Get folders for a project
 *     tags: [Xray]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: path
 *         schema:
 *           type: string
 *         description: Folder path (default "/")
 *     responses:
 *       200:
 *         description: Folder structure
 */
router.get('/folders/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const path = (req.query.path as string) || '/';
    const folder = await getFolders(projectId, path);
    return res.json(folder);
  } catch (error) {
    console.error('Error fetching folders:', error);
    return res.status(500).json({ error: 'Failed to fetch folders' });
  }
});

/**
 * @swagger
 * /api/xray/test-plans/{testPlanId}/add-tests:
 *   post:
 *     summary: Add tests to a test plan
 *     tags: [Xray]
 *     parameters:
 *       - in: path
 *         name: testPlanId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [testIssueIds]
 *             properties:
 *               testIssueIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Tests added
 */
router.post('/test-plans/:testPlanId/add-tests', async (req: Request, res: Response) => {
  try {
    const { testPlanId } = req.params;
    const { testIssueIds } = req.body;

    if (!testIssueIds || !Array.isArray(testIssueIds)) {
      return res.status(400).json({ error: 'testIssueIds array is required' });
    }

    const result = await addTestsToTestPlan(testPlanId, testIssueIds);
    return res.json(result);
  } catch (error) {
    console.error('Error adding tests to test plan:', error);
    return res.status(500).json({ error: 'Failed to add tests to test plan' });
  }
});

/**
 * @swagger
 * /api/xray/test-executions/{testExecutionId}/add-tests:
 *   post:
 *     summary: Add tests to a test execution
 *     tags: [Xray]
 *     parameters:
 *       - in: path
 *         name: testExecutionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [testIssueIds]
 *             properties:
 *               testIssueIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Tests added
 */
router.post('/test-executions/:testExecutionId/add-tests', async (req: Request, res: Response) => {
  try {
    const { testExecutionId } = req.params;
    const { testIssueIds } = req.body;

    if (!testIssueIds || !Array.isArray(testIssueIds)) {
      return res.status(400).json({ error: 'testIssueIds array is required' });
    }

    const result = await addTestsToTestExecution(testExecutionId, testIssueIds);
    return res.json(result);
  } catch (error) {
    console.error('Error adding tests to test execution:', error);
    return res.status(500).json({ error: 'Failed to add tests to test execution' });
  }
});

/**
 * @swagger
 * /api/xray/test-sets/{testSetId}/add-tests:
 *   post:
 *     summary: Add tests to a test set
 *     tags: [Xray]
 *     parameters:
 *       - in: path
 *         name: testSetId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [testIssueIds]
 *             properties:
 *               testIssueIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Tests added
 */
router.post('/test-sets/:testSetId/add-tests', async (req: Request, res: Response) => {
  try {
    const { testSetId } = req.params;
    const { testIssueIds } = req.body;

    if (!testIssueIds || !Array.isArray(testIssueIds)) {
      return res.status(400).json({ error: 'testIssueIds array is required' });
    }

    const result = await addTestsToTestSet(testSetId, testIssueIds);
    return res.json(result);
  } catch (error) {
    console.error('Error adding tests to test set:', error);
    return res.status(500).json({ error: 'Failed to add tests to test set' });
  }
});

/**
 * @swagger
 * /api/xray/folders/add-tests:
 *   post:
 *     summary: Add tests to a folder
 *     tags: [Xray]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [projectId, folderPath, testIssueIds]
 *             properties:
 *               projectId:
 *                 type: string
 *               folderPath:
 *                 type: string
 *               testIssueIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Tests added
 */
router.post('/folders/add-tests', async (req: Request, res: Response) => {
  try {
    const { projectId, folderPath, testIssueIds } = req.body;

    if (!projectId || !folderPath || !testIssueIds || !Array.isArray(testIssueIds)) {
      return res.status(400).json({ error: 'projectId, folderPath, and testIssueIds are required' });
    }

    const result = await addTestsToFolder(projectId, folderPath, testIssueIds);
    return res.json(result);
  } catch (error) {
    console.error('Error adding tests to folder:', error);
    return res.status(500).json({ error: 'Failed to add tests to folder' });
  }
});

/**
 * @swagger
 * /api/xray/tests/{testIssueId}/add-preconditions:
 *   post:
 *     summary: Add preconditions to a test
 *     tags: [Xray]
 *     parameters:
 *       - in: path
 *         name: testIssueId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [preconditionIssueIds]
 *             properties:
 *               preconditionIssueIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Preconditions added
 */
router.post('/tests/:testIssueId/add-preconditions', async (req: Request, res: Response) => {
  try {
    const { testIssueId } = req.params;
    const { preconditionIssueIds } = req.body;

    if (!preconditionIssueIds || !Array.isArray(preconditionIssueIds)) {
      return res.status(400).json({ error: 'preconditionIssueIds array is required' });
    }

    const result = await addPreconditionsToTest(testIssueId, preconditionIssueIds);
    return res.json(result);
  } catch (error) {
    console.error('Error adding preconditions to test:', error);
    return res.status(500).json({ error: 'Failed to add preconditions to test' });
  }
});

/**
 * @swagger
 * /api/xray/test-plans/{testPlanId}/remove-tests:
 *   delete:
 *     summary: Remove tests from a test plan
 *     tags: [Xray]
 *     parameters:
 *       - in: path
 *         name: testPlanId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [testIssueIds]
 *             properties:
 *               testIssueIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Tests removed
 */
router.delete('/test-plans/:testPlanId/remove-tests', async (req: Request, res: Response) => {
  try {
    const { testPlanId } = req.params;
    const { testIssueIds } = req.body;

    if (!testIssueIds || !Array.isArray(testIssueIds)) {
      return res.status(400).json({ error: 'testIssueIds array is required' });
    }

    const result = await removeTestsFromTestPlan(testPlanId, testIssueIds);
    return res.json(result);
  } catch (error) {
    console.error('Error removing tests from test plan:', error);
    return res.status(500).json({ error: 'Failed to remove tests from test plan' });
  }
});

/**
 * @swagger
 * /api/xray/test-executions/{testExecutionId}/remove-tests:
 *   delete:
 *     summary: Remove tests from a test execution
 *     tags: [Xray]
 *     parameters:
 *       - in: path
 *         name: testExecutionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [testIssueIds]
 *             properties:
 *               testIssueIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Tests removed
 */
router.delete('/test-executions/:testExecutionId/remove-tests', async (req: Request, res: Response) => {
  try {
    const { testExecutionId } = req.params;
    const { testIssueIds } = req.body;

    if (!testIssueIds || !Array.isArray(testIssueIds)) {
      return res.status(400).json({ error: 'testIssueIds array is required' });
    }

    const result = await removeTestsFromTestExecution(testExecutionId, testIssueIds);
    return res.json(result);
  } catch (error) {
    console.error('Error removing tests from test execution:', error);
    return res.status(500).json({ error: 'Failed to remove tests from test execution' });
  }
});

/**
 * @swagger
 * /api/xray/test-sets/{testSetId}/remove-tests:
 *   delete:
 *     summary: Remove tests from a test set
 *     tags: [Xray]
 *     parameters:
 *       - in: path
 *         name: testSetId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [testIssueIds]
 *             properties:
 *               testIssueIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Tests removed
 */
router.delete('/test-sets/:testSetId/remove-tests', async (req: Request, res: Response) => {
  try {
    const { testSetId } = req.params;
    const { testIssueIds } = req.body;

    if (!testIssueIds || !Array.isArray(testIssueIds)) {
      return res.status(400).json({ error: 'testIssueIds array is required' });
    }

    const result = await removeTestsFromTestSet(testSetId, testIssueIds);
    return res.json(result);
  } catch (error) {
    console.error('Error removing tests from test set:', error);
    return res.status(500).json({ error: 'Failed to remove tests from test set' });
  }
});

/**
 * @swagger
 * /api/xray/folders/remove-tests:
 *   delete:
 *     summary: Remove tests from a folder
 *     tags: [Xray]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [projectId, folderPath, testIssueIds]
 *             properties:
 *               projectId:
 *                 type: string
 *               folderPath:
 *                 type: string
 *               testIssueIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Tests removed
 */
router.delete('/folders/remove-tests', async (req: Request, res: Response) => {
  try {
    const { projectId, folderPath, testIssueIds } = req.body;

    if (!projectId || !folderPath || !testIssueIds || !Array.isArray(testIssueIds)) {
      return res.status(400).json({ error: 'projectId, folderPath, and testIssueIds are required' });
    }

    const result = await removeTestsFromFolder(projectId, folderPath, testIssueIds);
    return res.json(result);
  } catch (error) {
    console.error('Error removing tests from folder:', error);
    return res.status(500).json({ error: 'Failed to remove tests from folder' });
  }
});

/**
 * @swagger
 * /api/xray/tests/{testIssueId}/remove-preconditions:
 *   delete:
 *     summary: Remove preconditions from a test
 *     tags: [Xray]
 *     parameters:
 *       - in: path
 *         name: testIssueId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [preconditionIssueIds]
 *             properties:
 *               preconditionIssueIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Preconditions removed
 */
router.delete('/tests/:testIssueId/remove-preconditions', async (req: Request, res: Response) => {
  try {
    const { testIssueId } = req.params;
    const { preconditionIssueIds } = req.body;

    if (!preconditionIssueIds || !Array.isArray(preconditionIssueIds)) {
      return res.status(400).json({ error: 'preconditionIssueIds array is required' });
    }

    const result = await removePreconditionsFromTest(testIssueId, preconditionIssueIds);
    return res.json(result);
  } catch (error) {
    console.error('Error removing preconditions from test:', error);
    return res.status(500).json({ error: 'Failed to remove preconditions from test' });
  }
});

export default router;

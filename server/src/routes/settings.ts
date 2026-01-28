import { Router, Request, Response } from 'express';
import {
  getSettingsSynced,
  writeSettings,
  addProject,
  removeProject,
  hideProject,
  unhideProject,
  setActiveProject,
  getProjectSettings,
  saveProjectSettings,
} from '../utils/fileOperations.js';
import type { Settings, ProjectSettings } from '../types.js';

const router = Router();

/**
 * @swagger
 * /api/settings:
 *   get:
 *     summary: Get current settings
 *     tags: [Settings]
 *     responses:
 *       200:
 *         description: Current settings
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Settings'
 */
router.get('/', (_req: Request, res: Response) => {
  try {
    const settings = getSettingsSynced();
    return res.json(settings);
  } catch (error) {
    console.error('Error reading settings:', error);
    return res.status(500).json({ error: 'Failed to read settings' });
  }
});

/**
 * @swagger
 * /api/settings:
 *   put:
 *     summary: Update settings
 *     tags: [Settings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Settings'
 *     responses:
 *       200:
 *         description: Settings updated
 */
router.put('/', (req: Request, res: Response) => {
  try {
    const settings: Settings = req.body;
    writeSettings(settings);
    return res.json({ success: true, settings });
  } catch (error) {
    console.error('Error updating settings:', error);
    return res.status(500).json({ error: 'Failed to update settings' });
  }
});

/**
 * @swagger
 * /api/settings/projects:
 *   post:
 *     summary: Add a project
 *     tags: [Settings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [projectKey]
 *             properties:
 *               projectKey:
 *                 type: string
 *               color:
 *                 type: string
 *     responses:
 *       200:
 *         description: Project added
 *       400:
 *         description: Project key is required
 */
router.post('/projects', (req: Request, res: Response) => {
  try {
    const { projectKey, color } = req.body;

    if (!projectKey) {
      return res.status(400).json({ error: 'Project key is required' });
    }

    const result = addProject(projectKey, color);
    return res.json(result);
  } catch (error) {
    console.error('Error adding project:', error);
    return res.status(500).json({ error: 'Failed to add project' });
  }
});

/**
 * @swagger
 * /api/settings/projects/{projectKey}/hide:
 *   post:
 *     summary: Hide a project
 *     tags: [Settings]
 *     parameters:
 *       - in: path
 *         name: projectKey
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Project hidden
 */
router.post('/projects/:projectKey/hide', (req: Request, res: Response) => {
  try {
    const { projectKey } = req.params;
    const result = hideProject(projectKey);
    return res.json(result);
  } catch (error) {
    console.error('Error hiding project:', error);
    return res.status(500).json({ error: 'Failed to hide project' });
  }
});

/**
 * @swagger
 * /api/settings/projects/{projectKey}/unhide:
 *   post:
 *     summary: Unhide a project
 *     tags: [Settings]
 *     parameters:
 *       - in: path
 *         name: projectKey
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Project unhidden
 */
router.post('/projects/:projectKey/unhide', (req: Request, res: Response) => {
  try {
    const { projectKey } = req.params;
    const result = unhideProject(projectKey);
    return res.json(result);
  } catch (error) {
    console.error('Error unhiding project:', error);
    return res.status(500).json({ error: 'Failed to unhide project' });
  }
});

/**
 * @swagger
 * /api/settings/active-project:
 *   post:
 *     summary: Set active project
 *     tags: [Settings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [projectKey]
 *             properties:
 *               projectKey:
 *                 type: string
 *     responses:
 *       200:
 *         description: Active project set
 *       400:
 *         description: Project key is required or not found
 */
router.post('/active-project', (req: Request, res: Response) => {
  try {
    const { projectKey } = req.body;

    if (!projectKey) {
      return res.status(400).json({ error: 'Project key is required' });
    }

    const result = setActiveProject(projectKey);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json(result);
  } catch (error) {
    console.error('Error setting active project:', error);
    return res.status(500).json({ error: 'Failed to set active project' });
  }
});

/**
 * @swagger
 * /api/settings/projects/{projectKey}:
 *   get:
 *     summary: Get project settings
 *     tags: [Settings]
 *     parameters:
 *       - in: path
 *         name: projectKey
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Project settings
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProjectSettings'
 */
router.get('/projects/:projectKey', (req: Request, res: Response) => {
  try {
    const { projectKey } = req.params;
    const projectSettings = getProjectSettings(projectKey);
    return res.json(projectSettings);
  } catch (error) {
    console.error('Error reading project settings:', error);
    return res.status(500).json({ error: 'Failed to read project settings' });
  }
});

/**
 * @swagger
 * /api/settings/projects/{projectKey}:
 *   put:
 *     summary: Update project settings
 *     tags: [Settings]
 *     parameters:
 *       - in: path
 *         name: projectKey
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProjectSettings'
 *     responses:
 *       200:
 *         description: Project settings updated
 */
router.put('/projects/:projectKey', (req: Request, res: Response) => {
  try {
    const { projectKey } = req.params;
    const projectSettings: ProjectSettings = req.body;
    saveProjectSettings(projectKey, projectSettings);
    return res.json({ success: true, projectSettings });
  } catch (error) {
    console.error('Error updating project settings:', error);
    return res.status(500).json({ error: 'Failed to update project settings' });
  }
});

/**
 * @swagger
 * /api/settings/projects/{projectKey}:
 *   delete:
 *     summary: Remove a project
 *     tags: [Settings]
 *     parameters:
 *       - in: path
 *         name: projectKey
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Project removed
 */
router.delete('/projects/:projectKey', (req: Request, res: Response) => {
  try {
    const { projectKey } = req.params;
    const result = removeProject(projectKey);
    return res.json(result);
  } catch (error) {
    console.error('Error removing project:', error);
    return res.status(500).json({ error: 'Failed to remove project' });
  }
});

// ============ Functional Areas ============

/**
 * @swagger
 * /api/settings/functional-areas:
 *   get:
 *     summary: Get functional areas for active project
 *     tags: [Settings]
 *     responses:
 *       200:
 *         description: List of functional areas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 areas:
 *                   type: array
 *                   items:
 *                     type: string
 */
router.get('/functional-areas', (_req: Request, res: Response) => {
  try {
    const settings = getSettingsSynced();
    const activeProject = settings.activeProject;
    
    if (!activeProject) {
      return res.json({ success: true, areas: [] });
    }
    
    const projectSettings = getProjectSettings(activeProject);
    return res.json({ success: true, areas: projectSettings.functionalAreas || [] });
  } catch (error) {
    console.error('Error reading functional areas:', error);
    return res.status(500).json({ error: 'Failed to read functional areas' });
  }
});

/**
 * @swagger
 * /api/settings/functional-areas:
 *   put:
 *     summary: Update functional areas for active project
 *     tags: [Settings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [areas]
 *             properties:
 *               areas:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Functional areas updated
 *       400:
 *         description: No active project
 */
router.put('/functional-areas', (req: Request, res: Response) => {
  try {
    const { areas } = req.body;
    const settings = getSettingsSynced();
    const activeProject = settings.activeProject;
    
    if (!activeProject) {
      return res.status(400).json({ error: 'No active project' });
    }
    
    const projectSettings = getProjectSettings(activeProject);
    projectSettings.functionalAreas = areas || [];
    saveProjectSettings(activeProject, projectSettings);
    
    return res.json({ success: true });
  } catch (error) {
    console.error('Error updating functional areas:', error);
    return res.status(500).json({ error: 'Failed to update functional areas' });
  }
});

// ============ Labels ============

/**
 * @swagger
 * /api/settings/labels:
 *   get:
 *     summary: Get labels for active project
 *     tags: [Settings]
 *     responses:
 *       200:
 *         description: List of labels
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 labels:
 *                   type: array
 *                   items:
 *                     type: string
 */
router.get('/labels', (_req: Request, res: Response) => {
  try {
    const settings = getSettingsSynced();
    const activeProject = settings.activeProject;
    
    if (!activeProject) {
      return res.json({ success: true, labels: [] });
    }
    
    const projectSettings = getProjectSettings(activeProject);
    return res.json({ success: true, labels: projectSettings.labels || [] });
  } catch (error) {
    console.error('Error reading labels:', error);
    return res.status(500).json({ error: 'Failed to read labels' });
  }
});

/**
 * @swagger
 * /api/settings/labels:
 *   put:
 *     summary: Update labels for active project
 *     tags: [Settings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [labels]
 *             properties:
 *               labels:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Labels updated
 *       400:
 *         description: No active project
 */
router.put('/labels', (req: Request, res: Response) => {
  try {
    const { labels } = req.body;
    const settings = getSettingsSynced();
    const activeProject = settings.activeProject;
    
    if (!activeProject) {
      return res.status(400).json({ error: 'No active project' });
    }
    
    const projectSettings = getProjectSettings(activeProject);
    projectSettings.labels = labels || [];
    saveProjectSettings(activeProject, projectSettings);
    
    return res.json({ success: true });
  } catch (error) {
    console.error('Error updating labels:', error);
    return res.status(500).json({ error: 'Failed to update labels' });
  }
});

export default router;

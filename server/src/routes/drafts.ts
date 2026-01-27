import { Router, Request, Response } from 'express';
import {
  listDrafts,
  readDraft,
  writeDraft,
  deleteDraft,
  deleteAllDrafts,
} from '../utils/fileOperations.js';
import type { Draft } from '../types.js';

const router = Router();

/**
 * @swagger
 * /api/drafts:
 *   get:
 *     summary: List all drafts
 *     tags: [Drafts]
 *     parameters:
 *       - in: query
 *         name: project
 *         schema:
 *           type: string
 *         description: Filter by project key
 *     responses:
 *       200:
 *         description: List of drafts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Draft'
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const projectKey = req.query.project as string | undefined;
    const drafts = listDrafts(projectKey || null);
    return res.json(drafts);
  } catch (error) {
    console.error('Error listing drafts:', error);
    return res.status(500).json({ error: 'Failed to list drafts' });
  }
});

/**
 * @swagger
 * /api/drafts/{id}:
 *   get:
 *     summary: Get a draft by ID
 *     tags: [Drafts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Draft found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Draft'
 *       404:
 *         description: Draft not found
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const draft = readDraft(id);

    if (!draft) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    return res.json(draft);
  } catch (error) {
    console.error('Error reading draft:', error);
    return res.status(500).json({ error: 'Failed to read draft' });
  }
});

/**
 * @swagger
 * /api/drafts:
 *   post:
 *     summary: Create a new draft
 *     tags: [Drafts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Draft'
 *     responses:
 *       200:
 *         description: Draft created
 *       400:
 *         description: Draft must have an id
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const draft: Draft = req.body;

    if (!draft.id) {
      return res.status(400).json({ error: 'Draft must have an id' });
    }

    const filePath = writeDraft(draft.id, draft);
    return res.json({ success: true, filePath, draft });
  } catch (error) {
    console.error('Error creating draft:', error);
    return res.status(500).json({ error: 'Failed to create draft' });
  }
});

/**
 * @swagger
 * /api/drafts/{id}:
 *   put:
 *     summary: Update a draft
 *     tags: [Drafts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Draft'
 *     responses:
 *       200:
 *         description: Draft updated
 *       400:
 *         description: Draft id mismatch
 */
router.put('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const draft: Draft = req.body;

    if (draft.id !== id) {
      return res.status(400).json({ error: 'Draft id mismatch' });
    }

    const filePath = writeDraft(id, draft);
    return res.json({ success: true, filePath, draft });
  } catch (error) {
    console.error('Error updating draft:', error);
    return res.status(500).json({ error: 'Failed to update draft' });
  }
});

/**
 * @swagger
 * /api/drafts/{id}:
 *   delete:
 *     summary: Delete a draft
 *     tags: [Drafts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Draft deleted
 *       404:
 *         description: Draft not found
 */
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = deleteDraft(id);

    if (!success) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting draft:', error);
    return res.status(500).json({ error: 'Failed to delete draft' });
  }
});

/**
 * @swagger
 * /api/drafts:
 *   delete:
 *     summary: Delete all drafts
 *     tags: [Drafts]
 *     responses:
 *       200:
 *         description: All drafts deleted
 */
router.delete('/', (_req: Request, res: Response) => {
  try {
    deleteAllDrafts();
    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting all drafts:', error);
    return res.status(500).json({ error: 'Failed to delete all drafts' });
  }
});

export default router;

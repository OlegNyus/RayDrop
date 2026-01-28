import { Router, Request, Response } from 'express';
import { readConfig, writeConfig, configExists, CONFIG_PATH } from '../utils/fileOperations.js';
import fs from 'fs';
import { validateCredentials } from '../utils/xrayClient.js';
import type { Config } from '../types.js';

const router = Router();

// Rate limiting for test-connection endpoint
const testConnectionAttempts = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 5; // 5 attempts per minute

function checkRateLimit(ip: string): { allowed: boolean; waitSeconds?: number } {
  const now = Date.now();
  const attempts = testConnectionAttempts.get(ip) || [];

  // Remove attempts outside the window
  const validAttempts = attempts.filter(time => now - time < RATE_LIMIT_WINDOW);
  testConnectionAttempts.set(ip, validAttempts);

  if (validAttempts.length >= RATE_LIMIT_MAX) {
    const oldestAttempt = Math.min(...validAttempts);
    const waitSeconds = Math.ceil((oldestAttempt + RATE_LIMIT_WINDOW - now) / 1000);
    return { allowed: false, waitSeconds };
  }

  return { allowed: true };
}

function recordAttempt(ip: string): void {
  const attempts = testConnectionAttempts.get(ip) || [];
  attempts.push(Date.now());
  testConnectionAttempts.set(ip, attempts);
}

/**
 * @swagger
 * /api/config:
 *   get:
 *     summary: Get current configuration
 *     tags: [Config]
 *     responses:
 *       200:
 *         description: Configuration status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Config'
 */
router.get('/', (_req: Request, res: Response) => {
  try {
    if (!configExists()) {
      return res.json({ configured: false });
    }

    const config = readConfig();
    if (!config || !config.xrayClientId || !config.xrayClientSecret) {
      return res.json({ configured: false });
    }

    // Don't expose secrets
    return res.json({
      configured: true,
      jiraBaseUrl: config.jiraBaseUrl,
      hasCredentials: true,
    });
  } catch (error) {
    console.error('Error reading config:', error);
    return res.status(500).json({ error: 'Failed to read config' });
  }
});

/**
 * @swagger
 * /api/config/test-connection:
 *   post:
 *     summary: Test Xray credentials without saving
 *     tags: [Config]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - xrayClientId
 *               - xrayClientSecret
 *             properties:
 *               xrayClientId:
 *                 type: string
 *               xrayClientSecret:
 *                 type: string
 *     responses:
 *       200:
 *         description: Credentials valid
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Rate limited
 */
router.post('/test-connection', async (req: Request, res: Response) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

    // Check rate limit
    const rateCheck = checkRateLimit(clientIp);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: `Too many attempts. Please wait ${rateCheck.waitSeconds} seconds.`,
        waitSeconds: rateCheck.waitSeconds,
      });
    }

    const { xrayClientId, xrayClientSecret } = req.body;

    // Validate required fields
    if (!xrayClientId || typeof xrayClientId !== 'string' || !xrayClientId.trim()) {
      return res.status(400).json({ error: 'Client ID is required' });
    }

    if (!xrayClientSecret || typeof xrayClientSecret !== 'string' || !xrayClientSecret.trim()) {
      return res.status(400).json({ error: 'Client Secret is required' });
    }

    // Record the attempt
    recordAttempt(clientIp);

    // Validate credentials with Xray
    const validation = await validateCredentials({
      xrayClientId: xrayClientId.trim(),
      xrayClientSecret: xrayClientSecret.trim(),
    });

    if (!validation.success) {
      return res.status(401).json({ error: validation.error || 'Invalid Client ID or Client Secret' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Error testing connection:', error);
    return res.status(500).json({ error: 'Failed to test connection' });
  }
});

/**
 * @swagger
 * /api/config/test:
 *   get:
 *     summary: Test connection with stored credentials
 *     tags: [Config]
 *     responses:
 *       200:
 *         description: Connection successful
 *       401:
 *         description: Invalid credentials or not configured
 */
router.get('/test', async (_req: Request, res: Response) => {
  try {
    if (!configExists()) {
      return res.status(401).json({ error: 'Not configured' });
    }

    const config = readConfig();
    if (!config || !config.xrayClientId || !config.xrayClientSecret) {
      return res.status(401).json({ error: 'Not configured' });
    }

    const validation = await validateCredentials({
      xrayClientId: config.xrayClientId,
      xrayClientSecret: config.xrayClientSecret,
    });

    if (!validation.success) {
      return res.status(401).json({ error: validation.error || 'Connection failed' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Error testing connection:', error);
    return res.status(500).json({ error: 'Failed to test connection' });
  }
});

/**
 * @swagger
 * /api/config:
 *   post:
 *     summary: Save configuration
 *     tags: [Config]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ConfigInput'
 *     responses:
 *       200:
 *         description: Configuration saved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Missing required fields or invalid format
 *       401:
 *         description: Invalid credentials
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { xrayClientId, xrayClientSecret, jiraBaseUrl } = req.body;

    // Validate xrayClientId
    if (!xrayClientId || typeof xrayClientId !== 'string' || !xrayClientId.trim()) {
      return res.status(400).json({ error: 'xrayClientId is required' });
    }

    // Validate xrayClientSecret
    if (!xrayClientSecret || typeof xrayClientSecret !== 'string' || !xrayClientSecret.trim()) {
      return res.status(400).json({ error: 'xrayClientSecret is required' });
    }

    // Validate jiraBaseUrl
    if (!jiraBaseUrl || typeof jiraBaseUrl !== 'string' || !jiraBaseUrl.trim()) {
      return res.status(400).json({ error: 'jiraBaseUrl is required' });
    }

    // Validate URL format
    try {
      const url = new URL(jiraBaseUrl.trim());
      if (!url.hostname) {
        return res.status(400).json({ error: 'jiraBaseUrl must be a valid URL' });
      }
    } catch {
      return res.status(400).json({ error: 'jiraBaseUrl must be a valid URL' });
    }

    // Validate credentials with Xray
    const validation = await validateCredentials({
      xrayClientId: xrayClientId.trim(),
      xrayClientSecret: xrayClientSecret.trim(),
    });
    if (!validation.success) {
      return res.status(401).json({ error: validation.error || 'Invalid credentials' });
    }

    const config: Config = {
      xrayClientId: xrayClientId.trim(),
      xrayClientSecret: xrayClientSecret.trim(),
      jiraBaseUrl: jiraBaseUrl.trim(),
    };

    writeConfig(config);
    return res.json({ success: true });
  } catch (error) {
    console.error('Error saving config:', error);
    return res.status(500).json({ error: 'Failed to save configuration' });
  }
});

/**
 * @swagger
 * /api/config:
 *   delete:
 *     summary: Delete configuration
 *     tags: [Config]
 *     responses:
 *       200:
 *         description: Configuration deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 */
router.delete('/', (_req: Request, res: Response) => {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      fs.unlinkSync(CONFIG_PATH);
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting config:', error);
    return res.status(500).json({ error: 'Failed to delete config' });
  }
});

export default router;

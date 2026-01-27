import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';

import configRoutes from './routes/config.js';
import draftsRoutes from './routes/drafts.js';
import settingsRoutes from './routes/settings.js';
import xrayRoutes from './routes/xray.js';
import { swaggerSpec } from './swagger.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use('/api/config', configRoutes);
app.use('/api/drafts', draftsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/xray', xrayRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;

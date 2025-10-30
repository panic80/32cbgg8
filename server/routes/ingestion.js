import { Router } from 'express';
import axios from 'axios';
import { validateRequest } from '../middleware/validate.js';
import { ingestionRequestSchema } from './schemas/ingestionSchemas.js';
import { getLogger } from '../services/logger.js';
import { createIngestionController } from '../controllers/ingestionController.js';

const createIngestionRoutes = ({
  rateLimiter,
  requireAdminAuth,
  validateIngestionUrl,
  getRagAuthHeaders,
  buildSseCorsHeaders,
  setSseHeaders,
  httpClient = axios,
  config = {},
}) => {
  const router = Router();
  const logger = getLogger('routes:ingestion');

  const controller = createIngestionController({
    httpClient,
    validateIngestionUrl,
    getRagAuthHeaders,
    buildSseCorsHeaders,
    setSseHeaders,
    config,
    logger,
  });

  const validateIngestionPayload = validateRequest(ingestionRequestSchema);

  router.post(
    '/api/rag/ingest',
    requireAdminAuth,
    rateLimiter,
    validateIngestionPayload,
    controller.handleIngest,
  );

  router.post(
    '/api/v2/ingest',
    requireAdminAuth,
    rateLimiter,
    validateIngestionPayload,
    controller.handleIngest,
  );

  router.post(
    '/api/v2/ingest/canada-ca',
    requireAdminAuth,
    rateLimiter,
    controller.handleCanadaCaIngest,
  );

  router.get('/api/rag/ingest/progress', requireAdminAuth, controller.handleProgress);
  router.get('/api/v2/ingest/progress', requireAdminAuth, controller.handleProgress);

  return router;
};

export default createIngestionRoutes;

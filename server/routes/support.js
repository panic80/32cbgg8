import { Router } from 'express';
import { validateRequest } from '../middleware/validate.js';
import { followUpRequestSchema } from './schemas/supportSchemas.js';
import { createSupportController } from '../controllers/supportController.js';

const createSupportRoutes = ({
  rateLimiter,
  cache,
  config,
  processContent,
  geminiClient,
  openaiClient,
  anthropicClient,
  httpClient,
}) => {
  const router = Router();
  const controller = createSupportController({
    geminiClient,
    openaiClient,
    anthropicClient,
    processContent,
    cache,
    config,
    httpClient,
  });

  router.post(
    '/api/v2/followup',
    rateLimiter,
    validateRequest(followUpRequestSchema),
    controller.handleFollowUp,
  );

  router.get('/api/travel-instructions', rateLimiter, controller.handleTravelInstructions);

  return router;
};

export default createSupportRoutes;

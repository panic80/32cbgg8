import { Router } from 'express';
import { validateRequest } from '../middleware/validate.js';
import { distanceRequestSchema } from './schemas/mapsSchemas.js';
import { getLogger } from '../services/logger.js';
import { createMapsController } from '../controllers/mapsController.js';

const createMapsRoutes = ({ rateLimiter, googleMapsClient, config = {} }) => {
  const router = Router();
  const logger = getLogger('routes:maps');
  const controller = createMapsController({ googleMapsClient, config, logger });

  const validateDistance = validateRequest(distanceRequestSchema);

  router.post('/api/maps/distance', rateLimiter, validateDistance, controller.handleDistance);

  router.get('/api/maps/autocomplete', rateLimiter, controller.handleAutocomplete);
  router.get('/api/maps/place-details', rateLimiter, controller.handlePlaceDetails);

  return router;
};

export default createMapsRoutes;

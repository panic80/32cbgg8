import { Router } from 'express';
import { validateRequest } from '../middleware/validate.js';
import { distanceRequestSchema } from './schemas/mapsSchemas.js';
import { getLogger } from '../services/logger.js';
import { createMapsController } from '../controllers/mapsController.js';
import { Client } from '@googlemaps/google-maps-services-js';

interface MapsRoutesConfig {
  rateLimiter: import('express').RequestHandler;
  googleMapsClient: Client | null;
  config?: { mapsTimeout?: number };
}

const createMapsRoutes = ({ rateLimiter, googleMapsClient, config = {} }: MapsRoutesConfig) => {
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

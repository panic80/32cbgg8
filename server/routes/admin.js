import { Router } from 'express';
import { getLogger } from '../services/logger.js';
import { respondWithError } from '../utils/http.js';

const toStringOrUndefined = (value) =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const logger = getLogger('routes:admin');

const createAdminRoutes = ({ rateLimiter, performanceHandler, chatLogger }) => {
  const router = Router();

  logger.info('Registering /api/admin/performance route');
  router.get('/performance', rateLimiter, (req, res, next) => performanceHandler(req, res, next));
  router.all('/performance', (_req, res) => res.status(405).json({ error: 'Method Not Allowed' }));

  logger.info('Registering admin analytics visits route');
  router.get('/analytics/visits', rateLimiter, (req, res) => {
    logger.debug('Handling GET /api/admin/analytics/visits');
    if (process.env.ENABLE_LOGGING !== 'true') {
      return respondWithError(res, {
        status: 503,
        error: 'LoggingDisabled',
        message: 'Analytics logging is disabled. Enable ENABLE_LOGGING to access visit analytics.',
        logger,
        level: 'warn',
      });
    }

    const filters = {
      startAt: toStringOrUndefined(req.query.startAt),
      endAt: toStringOrUndefined(req.query.endAt),
      path: toStringOrUndefined(req.query.path),
    };

    const summary = chatLogger.getVisitSummary(filters);
    return res.json({
      data: summary,
      filters: {
        startAt: filters.startAt ?? null,
        endAt: filters.endAt ?? null,
        path: filters.path ?? null,
      },
    });
  });

  return router;
};

export default createAdminRoutes;

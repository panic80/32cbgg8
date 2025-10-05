import { Router } from 'express';

const toStringOrUndefined = (value) =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const createAdminRoutes = ({ rateLimiter, performanceHandler, chatLogger }) => {
  const router = Router();

  console.log('Registering /api/admin/performance route');
  router.get('/performance', rateLimiter, (req, res, next) => performanceHandler(req, res, next));
  router.all('/performance', (_req, res) => res.status(405).json({ error: 'Method Not Allowed' }));

  console.log('Registering admin analytics visits route');
  router.get('/analytics/visits', rateLimiter, (req, res) => {
    console.log('Handling GET /api/admin/analytics/visits');
    if (process.env.ENABLE_LOGGING !== 'true') {
      return res.status(503).json({
        error: 'LoggingDisabled',
        message: 'Analytics logging is disabled. Enable ENABLE_LOGGING to access visit analytics.',
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

import { Router } from 'express';

const createAnalyticsRoutes = ({ rateLimiter, chatLogger }) => {
  const router = Router();

  router.post('/api/analytics/visit', rateLimiter, (req, res) => {
    console.log('Handling POST /api/analytics/visit');
    if (process.env.ENABLE_LOGGING !== 'true') {
      return res.status(503).json({
        error: 'LoggingDisabled',
        message: 'Analytics logging is disabled. Visit events will not be recorded.',
      });
    }

    const {
      path: visitPath,
      referrer,
      sessionId,
      locale,
      title,
      viewport,
      metadata,
    } = req.body || {};
    const p = typeof visitPath === 'string' ? visitPath.trim() : '';
    const cleanMetadata = metadata && typeof metadata === 'object' ? metadata : undefined;

    chatLogger.logVisit({
      path: p,
      referrer: typeof referrer === 'string' ? referrer : null,
      sessionId: typeof sessionId === 'string' ? sessionId : null,
      locale: typeof locale === 'string' ? locale : null,
      title: typeof title === 'string' ? title : null,
      viewport: typeof viewport === 'string' ? viewport : null,
      metadata: cleanMetadata,
      userAgent: req.get('user-agent') || null,
    });

    return res.status(202).json({ ok: true });
  });

  return router;
};

export default createAnalyticsRoutes;

import { Router } from 'express';
import { validateRequest } from '../middleware/validate.js';
import { visitEventSchema } from './schemas/analyticsSchemas.js';
const createAnalyticsRoutes = ({ rateLimiter, chatLogger }) => {
    const router = Router();
    const validateVisit = validateRequest(visitEventSchema);
    router.post('/api/analytics/visit', rateLimiter, validateVisit, (req, res) => {
        if (process.env.ENABLE_LOGGING !== 'true') {
            return res.status(503).json({
                error: 'LoggingDisabled',
                message: 'Analytics logging is disabled. Visit events will not be recorded.',
            });
        }
        const { path, referrer, sessionId, locale, title, viewport, metadata } = req.body;
        chatLogger.logVisit({
            path,
            referrer: referrer || null,
            sessionId: sessionId || null,
            locale: locale || null,
            title: title || null,
            viewport: viewport || null,
            metadata: metadata && typeof metadata === 'object' ? metadata : undefined,
            userAgent: req.get('user-agent') || undefined,
        });
        return res.status(202).json({ ok: true });
    });
    return router;
};
export default createAnalyticsRoutes;
//# sourceMappingURL=analytics.js.map
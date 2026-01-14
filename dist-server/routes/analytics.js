import { Router } from 'express';
import { validateRequest } from '../middleware/validate.js';
import { visitEventSchema } from './schemas/analyticsSchemas.js';
import { requireLogging } from '../middleware/requireLogging.js';
const createAnalyticsRoutes = ({ rateLimiter, chatLogger }) => {
    const router = Router();
    const validateVisit = validateRequest(visitEventSchema);
    router.post('/api/analytics/visit', rateLimiter, requireLogging, validateVisit, (req, res) => {
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
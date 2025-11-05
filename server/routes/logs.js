import { Router } from 'express';
import chatLogger from '../services/logger.js';
import { parseNumber, sanitizeString } from '../utils/validation.js';

const createLogsRoutes = ({ rateLimiter, requireAdminAuth }) => {
  const router = Router();

  const adminMiddleware = requireAdminAuth ? [requireAdminAuth, rateLimiter] : [rateLimiter];

  router.get('/api/admin/chat-logs', ...adminMiddleware, (req, res) => {
    if (process.env.ENABLE_LOGGING !== 'true') {
      return res.status(503).json({
        error: 'LoggingDisabled',
        message: 'Analytics logging is disabled. Enable ENABLE_LOGGING to access chat logs.',
      });
    }

    const pageSize = parseNumber(req.query.limit, { fallback: 50, min: 1, max: 200 });
    const pageOffset = parseNumber(req.query.offset, { fallback: 0, min: 0 });

    const filters = {
      limit: pageSize + 1,
      offset: pageOffset,
      startAt: sanitizeString(req.query.startAt),
      endAt: sanitizeString(req.query.endAt),
      conversationId: sanitizeString(req.query.conversationId),
      model: sanitizeString(req.query.model),
      provider: sanitizeString(req.query.provider),
      ragEnabled: sanitizeString(req.query.ragEnabled),
      shortAnswerMode: sanitizeString(req.query.shortAnswerMode),
      search: sanitizeString(req.query.search),
    };

    const rows = chatLogger.getChatLogs(filters);
    const hasMore = rows.length > pageSize;
    const data = hasMore ? rows.slice(0, pageSize) : rows;

    res.json({
      data,
      pagination: {
        limit: pageSize,
        offset: pageOffset,
        hasMore,
        nextOffset: hasMore ? pageOffset + pageSize : null,
      },
      filters: {
        startAt: filters.startAt ?? null,
        endAt: filters.endAt ?? null,
        conversationId: filters.conversationId ?? null,
        model: filters.model ?? null,
        provider: filters.provider ?? null,
        ragEnabled: filters.ragEnabled ?? null,
        shortAnswerMode: filters.shortAnswerMode ?? null,
        search: filters.search ?? null,
      },
    });
  });

  router.get('/api/admin/analytics/visits', ...adminMiddleware, (req, res) => {
    if (process.env.ENABLE_LOGGING !== 'true') {
      return res.status(503).json({
        error: 'LoggingDisabled',
        message: 'Analytics logging is disabled. Enable ENABLE_LOGGING to access visit analytics.',
      });
    }

    const filters = {
      startAt: sanitizeString(req.query.startAt),
      endAt: sanitizeString(req.query.endAt),
      path: sanitizeString(req.query.path),
    };

    const summary = chatLogger.getVisitSummary(filters);

    res.json({
      data: summary,
      filters: {
        startAt: filters.startAt ?? null,
        endAt: filters.endAt ?? null,
        path: filters.path ?? null,
      },
    });
  });

  router.post('/api/analytics/visit', rateLimiter, (req, res) => {
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

    const sanitizedPath = typeof visitPath === 'string' ? visitPath.trim() : '';
    const cleanMetadata = metadata && typeof metadata === 'object' ? metadata : undefined;

    chatLogger.logVisit({
      path: sanitizedPath,
      referrer: typeof referrer === 'string' ? referrer : null,
      sessionId: typeof sessionId === 'string' ? sessionId : null,
      locale: typeof locale === 'string' ? locale : null,
      title: typeof title === 'string' ? title : null,
      viewport: typeof viewport === 'string' ? viewport : null,
      metadata: cleanMetadata,
      userAgent: req.get('user-agent') || null,
    });

    res.status(202).json({ ok: true });
  });

  return router;
};

export default createLogsRoutes;

import { Router, Request, Response } from 'express';
import chatLogger from '../services/logger.js';

interface LogsRoutesConfig {
  rateLimiter: any;
  requireAdminAuth: any;
}

const parseNumber = (value: unknown, { fallback, min = 0, max = Number.MAX_SAFE_INTEGER }: { fallback: number; min?: number; max?: number }): number => {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
};

const sanitizeString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const createLogsRoutes = ({ rateLimiter, requireAdminAuth }: LogsRoutesConfig) => {
  const router = Router();

  const adminMiddleware = requireAdminAuth ? [requireAdminAuth, rateLimiter] : [rateLimiter];

  router.get('/api/admin/chat-logs', ...adminMiddleware, (req: Request, res: Response) => {
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
      ragEnabled: req.query.ragEnabled === 'true' ? true : req.query.ragEnabled === 'false' ? false : undefined,
      shortAnswerMode: req.query.shortAnswerMode === 'true' ? true : req.query.shortAnswerMode === 'false' ? false : undefined,
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

  router.get('/api/admin/analytics/visits', ...adminMiddleware, (req: Request, res: Response) => {
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

  router.post('/api/analytics/visit', rateLimiter, (req: Request, res: Response) => {
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
      referrer: typeof referrer === 'string' ? referrer : undefined,
      sessionId: typeof sessionId === 'string' ? sessionId : undefined,
      locale: typeof locale === 'string' ? locale : undefined,
      title: typeof title === 'string' ? title : undefined,
      viewport: typeof viewport === 'string' ? viewport : undefined,
      metadata: cleanMetadata,
      userAgent: req.get('user-agent') || undefined,
    });

    res.status(202).json({ ok: true });
  });

  return router;
};

export default createLogsRoutes;

import type { Request, Response } from 'express';
import { respondWithError } from '../utils/http.js';

interface IngestionControllerConfig {
  validateIngestionUrl?: (url: string) => Promise<string>;
  buildSseCorsHeaders?: (origin?: string) => Record<string, string>;
  setSseHeaders?: (res: Response, headers?: Record<string, string | number>) => void;
  ragService: any;
  logger: any;
}

export const createIngestionController = ({
  validateIngestionUrl,
  buildSseCorsHeaders,
  setSseHeaders,
  ragService,
  logger,
}: IngestionControllerConfig) => {
  const scopedLogger = logger?.child ? logger.child({ scope: 'controller:ingestion' }) : logger;
  const emit = (level: string, message: string, meta?: any) => scopedLogger?.[level]?.(message, meta);

  const sanitizeUrl = async (rawUrl: string | undefined, contextMessage: string): Promise<string | null> => {
    if (!rawUrl) return null;
    if (!validateIngestionUrl) return rawUrl;

    try {
      const sanitized = await validateIngestionUrl(rawUrl);
      emit('debug', 'ingestion.urlValidated', { rawUrl, sanitized });
      return sanitized;
    } catch (error: any) {
      emit('warn', 'ingestion.urlRejected', { rawUrl, error: error?.message });
      throw error;
    }
  };

  const handleIngest = async (req: Request, res: Response) => {
    const { url, content, type = 'web', metadata = {}, forceRefresh = false } = req.body ?? {};

    if (!url && !content) {
      return respondWithError(res, {
        status: 400,
        error: 'InvalidIngestionRequest',
        message: 'Either URL or content must be provided.',
        logger: scopedLogger,
        level: 'warn',
      });
    }

    let sanitizedUrl: string | null = null;
    if (url) {
      try {
        sanitizedUrl = await sanitizeUrl(url, 'ingest');
      } catch (validationError: any) {
        return respondWithError(res, {
          status: validationError.statusCode || 400,
          error: 'InvalidIngestionUrl',
          message: validationError.message,
          logger: scopedLogger,
          level: 'warn',
        });
      }
    }

    try {
      const response = await ragService.ingest({
        url: sanitizedUrl,
        content,
        type,
        metadata,
        forceRefresh
      });

      emit('info', 'ingestion.forwardSuccess', {
        hasUrl: Boolean(sanitizedUrl),
        hasContent: Boolean(content),
        type,
      });

      return res.json(response.data);
    } catch (error: any) {
      emit('error', 'ingestion.forwardFailed', {
        error: error?.message,
        status: error?.response?.status,
      });

      if (error.response) {
        return res.status(error.response.status).json(error.response.data);
      }

      return respondWithError(res, {
        status: 500,
        error: 'IngestionUpstreamFailure',
        message: 'Failed to ingest document.',
        logger: scopedLogger,
        cause: error,
      });
    }
  };

  const handleCanadaCaIngest = async (_req: Request, res: Response) => {
    try {
      const response = await ragService.ingestCanadaCa();
      emit('info', 'ingestion.canadaCaSuccess');
      return res.json(response.data);
    } catch (error: any) {
      emit('error', 'ingestion.canadaCaFailed', {
         error: error?.message,
         status: error?.response?.status,
      });

      if (error.response) {
        return res.status(error.response.status).json(error.response.data);
      }

      return respondWithError(res, {
        status: 500,
        error: 'CanadaCaIngestionFailure',
        message: 'Failed to ingest Canada.ca content.',
        logger: scopedLogger,
        cause: error,
      });
    }
  };

  const handleProgress = async (req: Request, res: Response) => {
    const { url } = req.query;
    const targetUrl = Array.isArray(url) ? (url[0] as string) : (url as string);

    if (!targetUrl) {
      return respondWithError(res, {
        status: 400,
        error: 'MissingUrlParameter',
        message: 'URL parameter required',
        logger: scopedLogger,
        level: 'warn',
      });
    }

    let sanitizedTargetUrl;
    try {
      sanitizedTargetUrl = await sanitizeUrl(targetUrl, 'progress');
    } catch (validationError: any) {
      return respondWithError(res, {
        status: validationError.statusCode || 400,
        error: 'InvalidIngestionUrl',
        message: validationError.message,
        logger: scopedLogger,
        level: 'warn',
      });
    }

    try {
      // sanitizedTargetUrl is guaranteed string here due to sanitizeUrl logic on valid input
      const response = await ragService.getProgressStream(sanitizedTargetUrl as string);

      const corsHeaders = buildSseCorsHeaders?.(req.headers.origin) || {};
      setSseHeaders?.(res, {
        ...corsHeaders,
        'X-Accel-Buffering': 'no',
      });

      emit('info', 'ingestion.progressProxy', { url: sanitizedTargetUrl });
      response.data.pipe(res);

      req.on('close', () => {
        response.data.destroy();
      });
    } catch (error: any) {
      emit('error', 'ingestion.progressFailed', {
        error: error?.message,
        status: error?.response?.status,
      });
      return respondWithError(res, {
        status: 500,
        error: 'ProgressStreamError',
        message: 'Failed to connect to progress stream',
        logger: scopedLogger,
        cause: error,
      });
    }
  };

  return {
    handleIngest,
    handleCanadaCaIngest,
    handleProgress,
  };
};

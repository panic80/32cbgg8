import axios from 'axios';
import {
  DEFAULT_INGEST_TIMEOUT_MS,
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRY_DELAY_MS,
  DEFAULT_RAG_SERVICE_URL,
} from '../config/constants.js';
import { respondWithError } from '../utils/http.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const createIngestionController = ({
  httpClient = axios,
  validateIngestionUrl,
  getRagAuthHeaders,
  buildSseCorsHeaders,
  setSseHeaders,
  config = {},
  logger,
}) => {
  const ragServiceUrl = config.ragServiceUrl || DEFAULT_RAG_SERVICE_URL;
  const ingestTimeout = config.ingestTimeout ?? DEFAULT_INGEST_TIMEOUT_MS;
  const maxRetries = config.ingestMaxRetries ?? config.maxRetries ?? DEFAULT_MAX_RETRIES;
  const retryDelayMs = config.ingestRetryDelay ?? config.retryDelay ?? DEFAULT_RETRY_DELAY_MS;

  const scopedLogger = logger?.child ? logger.child({ scope: 'controller:ingestion' }) : logger;
  const emit = (level, message, meta) => scopedLogger?.[level]?.(message, meta);

  const normalizeHttpClient = () => {
    if (httpClient?.request || (httpClient?.post && httpClient?.get)) {
      return httpClient;
    }
    return axios;
  };

  const client = normalizeHttpClient();

  const sanitizeUrl = async (rawUrl, contextMessage) => {
    if (!rawUrl) return null;
    if (!validateIngestionUrl) return rawUrl;

    try {
      const sanitized = await validateIngestionUrl(rawUrl);
      emit('debug', 'ingestion.urlValidated', { rawUrl, sanitized });
      return sanitized;
    } catch (error) {
      emit('warn', 'ingestion.urlRejected', { rawUrl, error: error?.message });
      throw error;
    }
  };

  const prepareHeaders = () => ({
    'Content-Type': 'application/json',
    ...(typeof getRagAuthHeaders === 'function' ? getRagAuthHeaders() : {}),
  });

  const postWithRetry = async (endpoint, payload) => {
    let lastError;
    for (let attempt = 1; attempt <= Math.max(1, maxRetries); attempt += 1) {
      try {
        const response = await client.post(endpoint, payload, {
          timeout: ingestTimeout,
          headers: prepareHeaders(),
        });
        return response;
      } catch (error) {
        lastError = error;
        const status = error?.response?.status;
        emit('warn', 'ingestion.postFailed', {
          endpoint,
          attempt,
          status,
          error: error?.message,
        });
        if (status && status < 500) {
          break;
        }
        if (attempt < Math.max(1, maxRetries)) {
          await wait(retryDelayMs * attempt);
        }
      }
    }
    throw lastError;
  };

  const handleIngest = async (req, res) => {
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

    let sanitizedUrl = null;
    if (url) {
      try {
        sanitizedUrl = await sanitizeUrl(url, 'ingest');
      } catch (validationError) {
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
      const response = await postWithRetry(`${ragServiceUrl}/api/v1/ingest`, {
        url: sanitizedUrl,
        content,
        type,
        metadata: metadata || {},
        force_refresh: Boolean(forceRefresh),
      });

      emit('info', 'ingestion.forwardSuccess', {
        hasUrl: Boolean(sanitizedUrl),
        hasContent: Boolean(content),
        type,
      });

      return res.json(response.data);
    } catch (error) {
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

  const handleCanadaCaIngest = async (_req, res) => {
    try {
      const response = await postWithRetry(`${ragServiceUrl}/api/v1/ingest/canada-ca`, {});

      emit('info', 'ingestion.canadaCaSuccess');
      return res.json(response.data);
    } catch (error) {
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

  const handleProgress = async (req, res) => {
    const { url } = req.query;
    const targetUrl = Array.isArray(url) ? url[0] : url;

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
    } catch (validationError) {
      return respondWithError(res, {
        status: validationError.statusCode || 400,
        error: 'InvalidIngestionUrl',
        message: validationError.message,
        logger: scopedLogger,
        level: 'warn',
      });
    }

    try {
      const response = await client.get(`${ragServiceUrl}/api/v1/ingest/progress`, {
        params: { url: sanitizedTargetUrl },
        responseType: 'stream',
        headers: {
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
          ...(typeof getRagAuthHeaders === 'function' ? getRagAuthHeaders() : {}),
        },
        timeout: ingestTimeout,
      });

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
    } catch (error) {
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

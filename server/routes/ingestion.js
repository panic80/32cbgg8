import { Router } from 'express';
import axios from 'axios';
import { validateRequest } from '../middleware/validate.js';
import { ingestionRequestSchema } from './schemas/ingestionSchemas.js';

const DEFAULT_RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || 'http://localhost:8000';

const createIngestionRoutes = ({
  rateLimiter,
  requireAdminAuth,
  validateIngestionUrl,
  getRagAuthHeaders,
  buildSseCorsHeaders,
  setSseHeaders,
}) => {
  const router = Router();

  const forwardIngestionRequest = async ({ req, res, bodyOverride }) => {
    const { url, content, type = 'web', metadata, forceRefresh = false } = bodyOverride ?? req.body;
    const ingestionUrl = typeof url === 'string' ? url : undefined;

    if (!ingestionUrl && !content) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Either URL or content must be provided.',
      });
    }

    let sanitizedIngestionUrl;

    try {
      if (ingestionUrl) {
        sanitizedIngestionUrl = await validateIngestionUrl(ingestionUrl);
      }
    } catch (validationError) {
      console.error('Rejected ingestion URL:', validationError.message);
      return res.status(validationError.statusCode || 400).json({
        error: 'Bad Request',
        message: validationError.message,
      });
    }

    try {
      const response = await axios.post(
        `${DEFAULT_RAG_SERVICE_URL}/api/v1/ingest`,
        {
          url: sanitizedIngestionUrl,
          content,
          type,
          metadata: metadata || {},
          force_refresh: forceRefresh,
        },
        {
          timeout: 300000,
          headers: {
            'Content-Type': 'application/json',
            ...getRagAuthHeaders(),
          },
        },
      );

      return res.json(response.data);
    } catch (error) {
      console.error('Document ingestion error:', error);
      if (error.response) {
        return res.status(error.response.status).json(error.response.data);
      }
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to ingest document.',
      });
    }
  };

  const proxyIngestionProgress = async (req, res) => {
    const { url } = req.query;
    const targetUrl = Array.isArray(url) ? url[0] : url;

    if (!targetUrl) {
      return res.status(400).json({ error: 'URL parameter required' });
    }

    let sanitizedTargetUrl;

    try {
      sanitizedTargetUrl = await validateIngestionUrl(targetUrl);
    } catch (validationError) {
      console.error('Rejected ingestion progress URL:', validationError.message);
      return res.status(validationError.statusCode || 400).json({
        error: 'Bad Request',
        message: validationError.message,
      });
    }

    try {
      const response = await axios.get(`${DEFAULT_RAG_SERVICE_URL}/api/v1/ingest/progress`, {
        params: { url: sanitizedTargetUrl },
        responseType: 'stream',
        headers: {
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
          ...getRagAuthHeaders(),
        },
      });

      const corsHeaders = buildSseCorsHeaders(req.headers.origin);
      setSseHeaders(res, {
        ...corsHeaders,
        'X-Accel-Buffering': 'no',
      });

      response.data.pipe(res);

      req.on('close', () => {
        response.data.destroy();
      });
    } catch (error) {
      console.error('Progress streaming error:', error);
      res.status(500).json({ error: 'Failed to connect to progress stream' });
    }
  };

  const validateIngestionPayload = validateRequest(ingestionRequestSchema);

  router.post('/api/rag/ingest', requireAdminAuth, rateLimiter, validateIngestionPayload, (req, res) =>
    forwardIngestionRequest({ req, res }),
  );
  router.post('/api/v2/ingest', requireAdminAuth, rateLimiter, validateIngestionPayload, (req, res) =>
    forwardIngestionRequest({ req, res }),
  );

  router.post('/api/v2/ingest/canada-ca', requireAdminAuth, rateLimiter, async (req, res) => {
    try {
      const response = await axios.post(
        `${DEFAULT_RAG_SERVICE_URL}/api/v1/ingest/canada-ca`,
        {},
        {
          timeout: 300000,
          headers: {
            'Content-Type': 'application/json',
            ...getRagAuthHeaders(),
          },
        },
      );

      return res.json(response.data);
    } catch (error) {
      console.error('Canada.ca ingestion error:', error);
      if (error.response) {
        return res.status(error.response.status).json(error.response.data);
      }
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to ingest Canada.ca content.',
      });
    }
  });

  router.get('/api/rag/ingest/progress', requireAdminAuth, proxyIngestionProgress);
  router.get('/api/v2/ingest/progress', requireAdminAuth, proxyIngestionProgress);

  return router;
};

export default createIngestionRoutes;

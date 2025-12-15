import express from 'express';
import axios from 'axios';
import { getLogger } from '../services/logger.js';
import { respondWithError } from '../utils/http.js';

export function createSourcesRoutes({ rateLimiter, requireAdminAuth, getRagAuthHeaders }) {
  const router = express.Router();
  const adminMiddleware =
    typeof requireAdminAuth === 'function' ? requireAdminAuth : (req, res, next) => next();
  const buildRagAuthHeaders =
    typeof getRagAuthHeaders === 'function' ? getRagAuthHeaders : () => ({});
  const logger = getLogger('routes:sources');

  // List indexed sources
  router.get('/api/v2/sources', adminMiddleware, rateLimiter, async (req, res) => {
    try {
      const ragServiceUrl = process.env.RAG_SERVICE_URL || 'http://localhost:8000';
      const ragResponse = await axios.get(`${ragServiceUrl}/api/v1/sources`, {
        params: req.query,
        timeout: 10000,
        headers: { ...buildRagAuthHeaders() },
      });

      res.json(ragResponse.data);
    } catch (error) {
      if (error.response) {
        return respondWithError(res, {
          status: error.response.status,
          error: 'SourcesUpstreamError',
          message: error.response.data?.message || 'Failed to list sources.',
          logger,
          cause: error,
        });
      }
      return respondWithError(res, {
        status: 500,
        error: 'SourcesListFailed',
        message: 'Failed to list sources.',
        logger,
        cause: error,
      });
    }
  });

  // Get source statistics
  router.get('/api/v2/sources/stats', adminMiddleware, rateLimiter, async (req, res) => {
    try {
      const ragServiceUrl = process.env.RAG_SERVICE_URL || 'http://localhost:8000';
      const ragResponse = await axios.get(`${ragServiceUrl}/api/v1/sources/stats`, {
        timeout: 10000,
        headers: { ...buildRagAuthHeaders() },
      });

      res.json(ragResponse.data);
    } catch (error) {
      if (error.response) {
        return respondWithError(res, {
          status: error.response.status,
          error: 'SourcesStatsUpstreamError',
          message: error.response.data?.message || 'Failed to get source statistics.',
          logger,
          cause: error,
        });
      }
      return respondWithError(res, {
        status: 500,
        error: 'SourcesStatsFailed',
        message: 'Failed to get source statistics.',
        logger,
        cause: error,
      });
    }
  });

  // Get source count
  router.get('/api/v2/sources/count', adminMiddleware, rateLimiter, async (req, res) => {
    try {
      const ragServiceUrl = process.env.RAG_SERVICE_URL || 'http://localhost:8000';
      const ragResponse = await axios.get(`${ragServiceUrl}/api/v1/sources/count`, {
        timeout: 10000,
        headers: { ...buildRagAuthHeaders() },
      });

      res.json(ragResponse.data);
    } catch (error) {
      logger.warn('Source count error', { error });
      res.json({ count: 0, status: 'error', message: 'Unable to get count' });
    }
  });

  // Purge database endpoint
  router.post('/api/v2/database/purge', adminMiddleware, rateLimiter, async (req, res) => {
    try {
      logger.info('Database purge requested');
      const ragServiceUrl = process.env.RAG_SERVICE_URL || 'http://localhost:8000';
      const ragResponse = await axios.post(
        `${ragServiceUrl}/api/v1/database/purge`,
        {},
        {
          timeout: 30000,
          headers: { 'Content-Type': 'application/json', ...buildRagAuthHeaders() },
        },
      );
      logger.info('Database purge completed', { result: ragResponse.data });
      res.json(ragResponse.data);
    } catch (error) {
      if (error.response) {
        return respondWithError(res, {
          status: error.response.status,
          error: 'DatabasePurgeUpstreamError',
          message: error.response.data?.message || 'Failed to purge database.',
          logger,
          cause: error,
        });
      }
      return respondWithError(res, {
        status: 500,
        error: 'DatabasePurgeFailed',
        message: 'Failed to purge database.',
        logger,
        cause: error,
      });
    }
  });

  // Build BM25 index endpoint
  router.post('/api/v2/database/build-bm25', adminMiddleware, rateLimiter, async (req, res) => {
    try {
      logger.info('BM25 index build requested');
      const ragServiceUrl = process.env.RAG_SERVICE_URL || 'http://localhost:8000';
      const ragResponse = await axios.post(
        `${ragServiceUrl}/api/v1/admin/bm25/rebuild`,
        {},
        {
          timeout: 30000,
          headers: { 'Content-Type': 'application/json', ...buildRagAuthHeaders() },
        },
      );
      logger.info('BM25 index build initiated', { result: ragResponse.data });
      res.json(ragResponse.data);
    } catch (error) {
      if (error.response) {
        return respondWithError(res, {
          status: error.response.status,
          error: 'BM25BuildUpstreamError',
          message: error.response.data?.message || 'Failed to build BM25 index.',
          logger,
          cause: error,
        });
      }
      return respondWithError(res, {
        status: 500,
        error: 'BM25BuildFailed',
        message: 'Failed to build BM25 index.',
        logger,
        cause: error,
      });
    }
  });

  return router;
}

export default createSourcesRoutes;

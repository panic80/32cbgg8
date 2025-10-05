import express from 'express';
import axios from 'axios';

export function createSourcesRoutes({ rateLimiter, requireAdminAuth, getRagAuthHeaders }) {
  const router = express.Router();
  const adminMiddleware =
    typeof requireAdminAuth === 'function' ? requireAdminAuth : (req, res, next) => next();
  const buildRagAuthHeaders =
    typeof getRagAuthHeaders === 'function' ? getRagAuthHeaders : () => ({});

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
      console.error('Sources listing error:', error);
      if (error.response) {
        return res.status(error.response.status).json(error.response.data);
      }
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to list sources.',
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
      console.error('Source stats error:', error);
      if (error.response) {
        return res.status(error.response.status).json(error.response.data);
      }
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get source statistics.',
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
      console.error('Source count error:', error);
      // Keep existing behavior: return default response instead of erroring
      res.json({ count: 0, status: 'error', message: 'Unable to get count' });
    }
  });

  // Purge database endpoint
  router.post('/api/v2/database/purge', adminMiddleware, rateLimiter, async (req, res) => {
    try {
      console.log('Database purge requested');
      const ragServiceUrl = process.env.RAG_SERVICE_URL || 'http://localhost:8000';
      const ragResponse = await axios.post(
        `${ragServiceUrl}/api/v1/database/purge`,
        {},
        {
          timeout: 30000,
          headers: { 'Content-Type': 'application/json', ...buildRagAuthHeaders() },
        },
      );
      console.log('Database purge completed:', ragResponse.data);
      res.json(ragResponse.data);
    } catch (error) {
      console.error('Database purge error:', error);
      if (error.response) {
        return res.status(error.response.status).json(error.response.data);
      }
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to purge database.',
      });
    }
  });

  return router;
}

export default createSourcesRoutes;

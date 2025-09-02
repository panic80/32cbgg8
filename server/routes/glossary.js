import express from 'express';
import axios from 'axios';

export function createGlossaryRoutes({ rateLimiter }) {
  const router = express.Router();

  // Glossary list
  router.get('/api/v2/glossary/', rateLimiter, async (req, res) => {
    try {
      const ragServiceUrl = process.env.RAG_SERVICE_URL || 'http://localhost:8000';
      const ragResponse = await axios.get(`${ragServiceUrl}/api/glossary/`, {
        params: req.query,
        timeout: 10000,
      });
      res.json(ragResponse.data);
    } catch (error) {
      console.error('Glossary listing error:', error);
      if (error.response) {
        return res.status(error.response.status).json(error.response.data);
      }
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to list glossary terms.',
      });
    }
  });

  // Search glossary
  router.get('/api/v2/glossary/search', rateLimiter, async (req, res) => {
    try {
      const ragServiceUrl = process.env.RAG_SERVICE_URL || 'http://localhost:8000';
      const ragResponse = await axios.get(`${ragServiceUrl}/api/glossary/search`, {
        params: req.query,
        timeout: 10000,
      });
      res.json(ragResponse.data);
    } catch (error) {
      console.error('Glossary search error:', error);
      if (error.response) {
        return res.status(error.response.status).json(error.response.data);
      }
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to search glossary.',
      });
    }
  });

  // Get specific term
  router.get('/api/v2/glossary/term/:term', rateLimiter, async (req, res) => {
    try {
      const ragServiceUrl = process.env.RAG_SERVICE_URL || 'http://localhost:8000';
      const ragResponse = await axios.get(`${ragServiceUrl}/api/glossary/term/${req.params.term}`, {
        timeout: 10000,
      });
      res.json(ragResponse.data);
    } catch (error) {
      console.error('Glossary term error:', error);
      if (error.response) {
        return res.status(error.response.status).json(error.response.data);
      }
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get glossary term.',
      });
    }
  });

  // Expand text with glossary
  router.post('/api/v2/glossary/expand', rateLimiter, async (req, res) => {
    try {
      const ragServiceUrl = process.env.RAG_SERVICE_URL || 'http://localhost:8000';
      const ragResponse = await axios.post(`${ragServiceUrl}/api/glossary/expand`, req.body, {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' },
      });
      res.json(ragResponse.data);
    } catch (error) {
      console.error('Glossary expand error:', error);
      if (error.response) {
        return res.status(error.response.status).json(error.response.data);
      }
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to expand glossary terms.',
      });
    }
  });

  // Categories
  router.get('/api/v2/glossary/categories', rateLimiter, async (req, res) => {
    try {
      const ragServiceUrl = process.env.RAG_SERVICE_URL || 'http://localhost:8000';
      const ragResponse = await axios.get(`${ragServiceUrl}/api/glossary/categories`, {
        timeout: 10000,
      });
      res.json(ragResponse.data);
    } catch (error) {
      console.error('Glossary categories error:', error);
      if (error.response) {
        return res.status(error.response.status).json(error.response.data);
      }
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get glossary categories.',
      });
    }
  });

  // Abbreviations
  router.get('/api/v2/glossary/abbreviations', rateLimiter, async (req, res) => {
    try {
      const ragServiceUrl = process.env.RAG_SERVICE_URL || 'http://localhost:8000';
      const ragResponse = await axios.get(`${ragServiceUrl}/api/glossary/abbreviations`, {
        timeout: 10000,
      });
      res.json(ragResponse.data);
    } catch (error) {
      console.error('Glossary abbreviations error:', error);
      if (error.response) {
        return res.status(error.response.status).json(error.response.data);
      }
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get glossary abbreviations.',
      });
    }
  });

  // Update glossary data
  router.post('/api/v2/glossary/update', rateLimiter, async (req, res) => {
    try {
      const ragServiceUrl = process.env.RAG_SERVICE_URL || 'http://localhost:8000';
      const ragResponse = await axios.post(`${ragServiceUrl}/api/glossary/update`, req.body, {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' },
      });
      res.json(ragResponse.data);
    } catch (error) {
      console.error('Glossary update error:', error);
      if (error.response) {
        return res.status(error.response.status).json(error.response.data);
      }
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to update glossary.',
      });
    }
  });

  return router;
}

export default createGlossaryRoutes;


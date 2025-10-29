import { Router } from 'express';
import { TRAVEL_PLANNER_ADDITIONAL_INSTRUCTIONS } from '../constants/travelPlannerInstructions.js';
import { DEFAULT_RAG_STREAM_TIMEOUT_MS, getEnvNumber } from '../config/constants.js';
import { pipeStreamingResponse } from '../services/streaming.js';
import { createChatController } from '../controllers/chatController.js';

const DEFAULT_RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || 'http://localhost:8000';

const createChatRoutes = ({
  rateLimiter,
  config,
  chatLogger,
  getRagAuthHeaders,
  decodeUrlParams,
  geminiClient,
  openaiClient,
  anthropicClient,
  buildOpenAIParams,
  buildSseCorsHeaders,
  setSseHeaders,
}) => {
  const router = Router();
  const controller = createChatController({
    chatLogger,
    getRagAuthHeaders,
    geminiClient,
    openaiClient,
    anthropicClient,
    buildOpenAIParams,
    config,
    pipeStreamingResponse,
    buildSseCorsHeaders,
    getEnvNumber,
    DEFAULT_RAG_STREAM_TIMEOUT_MS,
    TRAVEL_PLANNER_ADDITIONAL_INSTRUCTIONS,
  });

  router.use('/api/chat', async (req, res, next) => {
    if (req.method === 'POST') {
      console.log('Legacy /api/chat endpoint called, redirecting to /api/gemini/generateContent');
      if (req.body) {
        req.body = decodeUrlParams(req.body);
      }
      if (req.body.query && !req.body.prompt) {
        req.body.prompt = req.body.query;
      }
      return controller.handleGeminiGenerateContent(req, res);
    }
    return next();
  });

  router.post('/api/gemini/generateContent', rateLimiter, controller.handleGeminiGenerateContent);

  router.post('/api/v2/chat/rag', rateLimiter, async (req, res) => {
    return controller.handleRagChat(req, res);
  });

  router.post('/api/v2/chat', rateLimiter, controller.handleStandardChat);

  router.post('/api/v2/chat/stream', rateLimiter, controller.handleStreamingChat);

  return router;
};

export default createChatRoutes;

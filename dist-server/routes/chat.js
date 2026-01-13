import { Router } from 'express';
import { TRAVEL_PLANNER_ADDITIONAL_INSTRUCTIONS } from '../constants/travelPlannerInstructions.js';
import { DEFAULT_RAG_STREAM_TIMEOUT_MS, getEnvNumber } from '../config/constants.js';
import { pipeStreamingResponse } from '../services/streaming.js';
import { createChatController } from '../controllers/chatController.js';
import { validateRequest } from '../middleware/validate.js';
import { getLogger } from '../services/logger.js';
import { geminiGenerationSchema, standardChatSchema, ragChatSchema, streamingChatSchema, } from './schemas/chatSchemas.js';
const logger = getLogger('routes:chat');
const createChatRoutes = ({ rateLimiter, config, chatLogger, getRagAuthHeaders, decodeUrlParams, aiService, buildSseCorsHeaders, }) => {
    const router = Router();
    const controller = createChatController({
        chatLogger,
        getRagAuthHeaders,
        aiService,
        config,
        pipeStreamingResponse,
        buildSseCorsHeaders,
        getEnvNumber,
        DEFAULT_RAG_STREAM_TIMEOUT_MS,
        TRAVEL_PLANNER_ADDITIONAL_INSTRUCTIONS,
    });
    const validateGemini = validateRequest(geminiGenerationSchema);
    router.use('/api/chat', async (req, res, next) => {
        if (req.method === 'POST') {
            logger.info('Legacy /api/chat endpoint called, redirecting to /api/gemini/generateContent');
            if (req.body) {
                req.body = decodeUrlParams(req.body);
            }
            if (req.body.query && !req.body.prompt) {
                req.body.prompt = req.body.query;
            }
            // Assuming validateGemini is an async middleware or returns a promise, but it's defined as synchronous in previous step.
            // However, it calls `next()` which is standard express.
            // The issue is `controller.handleGeminiGenerateContent` expects `(req, res)`
            // and `validateRequest` returns a middleware `(req, res, next)`.
            // We need to manually chain them here or rewrite how `use` works.
            // Simpler approach: call middleware logic then controller.
            // Let's use the middleware as intended by Express
            return validateGemini(req, res, () => controller.handleGeminiGenerateContent(req, res));
        }
        return next();
    });
    router.post('/api/gemini/generateContent', rateLimiter, validateRequest(geminiGenerationSchema), controller.handleGeminiGenerateContent);
    router.post('/api/v2/chat/rag', rateLimiter, validateRequest(ragChatSchema), controller.handleRagChat);
    router.post('/api/v2/chat', rateLimiter, validateRequest(standardChatSchema), controller.handleStandardChat);
    router.post('/api/v2/chat/stream', rateLimiter, validateRequest(streamingChatSchema), controller.handleStreamingChat);
    return router;
};
export default createChatRoutes;
//# sourceMappingURL=chat.js.map
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

  router.post('/api/v2/chat/stream', rateLimiter, async (req, res) => {
    const {
      message,
      model,
      provider,
      chatHistory,
      conversationId,
      useRAG = true,
      shortAnswerMode = false,
      useHybridSearch = false,
      reasoningEffort,
      responseVerbosity,
      audience,
    } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Message must be a non-empty string.',
      });
    }

    const isTripPlannerMessage = message?.startsWith('📋 **Trip Plan Request**');
    const forcedModel = 'gpt-5-mini';
    const forcedProvider = 'openai';
    const effectiveModel = isTripPlannerMessage ? forcedModel : model;
    const effectiveProvider = isTripPlannerMessage ? forcedProvider : provider;

    try {

      console.log('Processing streaming chat request', {
        message: message?.substring(0, 50),
        model: effectiveModel,
        provider: effectiveProvider,
        hasHistory: !!chatHistory,
        conversationId,
      });

      // Infer jurisdiction (province) from Trip Planner content to bias retrieval
      let jurisdiction = undefined;
      if (isTripPlannerMessage && typeof message === 'string') {
        try {
          const text = message;
          const provinceMatchers = [
            { name: 'Alberta', re: /\b(AB|Alberta)\b/i },
            { name: 'British Columbia', re: /\b(BC|British\s+Columbia)\b/i },
            { name: 'Manitoba', re: /\b(MB|Manitoba)\b/i },
            { name: 'New Brunswick', re: /\b(NB|New\s+Brunswick)\b/i },
            { name: 'Newfoundland and Labrador', re: /\b(NL|Newfoundland(?:\s+and\s+Labrador)?|Nfld)\b/i },
            { name: 'Nova Scotia', re: /\b(NS|Nova\s+Scotia)\b/i },
            { name: 'Ontario', re: /\b(ON|Ont|Ontario)\b/i },
            { name: 'Prince Edward Island', re: /\b(PE|PEI|Prince\s+Edward\s+Island)\b/i },
            { name: 'Quebec', re: /\b(QC|Quebec|Québec)\b/i },
            { name: 'Saskatchewan', re: /\b(SK|Saskatchewan)\b/i },
            { name: 'Yukon', re: /\b(YT|Yukon)\b/i },
            { name: 'Northwest Territories', re: /\b(NT|NWT|Northwest\s+Territories?)\b/i },
            { name: 'Nunavut', re: /\b(NU|Nunavut)\b/i },
          ];
          const found = provinceMatchers.find((p) => p.re.test(text));
          if (found) {
            jurisdiction = `${found.name}, Canada`;
          }
        } catch {}
      }

      const ragServiceUrl = DEFAULT_RAG_SERVICE_URL;
      const ragStreamTimeout =
        getEnvNumber('RAG_STREAM_TIMEOUT', DEFAULT_RAG_STREAM_TIMEOUT_MS) ||
        DEFAULT_RAG_STREAM_TIMEOUT_MS;
      const upstreamAbortController = new AbortController();

      // Add targeted retrieval hints for Trip Planner to improve rate/table recall
      let messageForRetrieval = (message || '').trim();
      if (isTripPlannerMessage) {
        try {
          const hints = [];
          if (jurisdiction) {
            const prov = String(jurisdiction).split(',')[0];
            hints.push(`${prov} private vehicle kilometric rate cents per kilometre Appendix B`);
            hints.push(`meal allowance rates ${prov}`);
            hints.push(`incidental allowance daily rate`);
          } else {
            hints.push(`Ontario private vehicle kilometric rate cents per kilometre Appendix B`);
          }
          messageForRetrieval = `${messageForRetrieval}\n\nRetrieval focus: ${hints.join(' | ')}`;
        } catch {}
      }

      const response = await axios.post(
        `${ragServiceUrl}/api/v1/streaming_chat`,
        {
          message: messageForRetrieval,
          chat_history: chatHistory || [],
          conversation_id: conversationId,
          provider: effectiveProvider || 'openai',
          model: effectiveModel,
          use_rag: useRAG,
          include_sources: true,
          short_answer_mode: shortAnswerMode,
          // Force hybrid retrieval for Trip Planner to improve table/rate recall
          use_hybrid_search: isTripPlannerMessage ? true : useHybridSearch,
          ...(isTripPlannerMessage
            ? { additionalInstructions: TRAVEL_PLANNER_ADDITIONAL_INSTRUCTIONS }
            : {}),
          ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
          ...(responseVerbosity ? { response_verbosity: responseVerbosity } : {}),
          ...(jurisdiction ? { jurisdiction } : {}),
          ...(audience ? { audience } : {}),
        },
        {
          responseType: 'stream',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            ...getRagAuthHeaders(),
          },
          timeout: ragStreamTimeout,
          signal: upstreamAbortController.signal,
        },
      );

      const streamingCorsHeaders = buildSseCorsHeaders(req.headers.origin);
      let aggregatedAnswer = '';
      let remoteConversationId = conversationId || null;
      let aggregatedSources = [];
      let aggregatedFollowUps = [];
      let streamStart = Date.now();

      pipeStreamingResponse({
        req,
        res,
        upstream: response,
        corsHeaders: {
          ...streamingCorsHeaders,
          'X-Accel-Buffering': 'no',
        },
        logger: (event, payload) => {
          console.error('Streaming chat error', event, payload);
        },
        onMetadata: (event) => {
          if (event.conversation_id) {
            remoteConversationId = event.conversation_id;
          }
          if (Array.isArray(event.sources)) {
            aggregatedSources = event.sources;
          }
          if (Array.isArray(event.follow_up_questions)) {
            aggregatedFollowUps = event.follow_up_questions;
          }
        },
        onComplete: () => {
          if (config.loggingEnabled) {
            chatLogger.logChat(req, {
              timestamp: new Date().toISOString(),
              question: message.trim(),
              answer: aggregatedAnswer,
              model: effectiveModel,
              provider: effectiveProvider,
              ragEnabled: useRAG,
              conversationId: remoteConversationId,
              latencyMs: Date.now() - streamStart,
              metadata: {
                route: '/api/v2/chat/stream',
                sources: aggregatedSources,
                followUpQuestions: aggregatedFollowUps,
                ...(reasoningEffort ? { reasoningEffort } : {}),
                ...(responseVerbosity ? { responseVerbosity } : {}),
              },
            });
          }
        },
      });

      response.data.on('data', (chunk) => {
        const fragment = chunk.toString();
        const lines = fragment.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data || data === '[DONE]') continue;

          try {
            const event = JSON.parse(data);
            if (event.type === 'token' && typeof event.content === 'string') {
              aggregatedAnswer += event.content;
            }
          } catch (error) {
            console.error('Error parsing SSE event:', error, 'Data:', data.substring(0, 100));
          }
        }
      });

      req.on('close', () => {
        upstreamAbortController.abort();
      });
    } catch (error) {
      console.error('Error with streaming chat:', error);

      if (config.loggingEnabled) {
        chatLogger.logChat(req, {
          timestamp: new Date().toISOString(),
          question: message.trim(),
          answer: null,
          model: effectiveModel,
          provider: effectiveProvider,
          ragEnabled: useRAG,
          metadata: {
            route: '/api/v2/chat/stream',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }

      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'An error occurred while processing your streaming request.',
      });
    }
  });

  return router;
};

export default createChatRoutes;

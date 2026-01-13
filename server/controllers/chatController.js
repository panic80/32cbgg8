import axios from 'axios';
import { RAG_SERVICE_URL, TRIP_PLANNER_MODEL, TRIP_PLANNER_PREFIX } from '../config/constants.js';
import { inferJurisdiction, buildTripPlannerHints } from '../services/tripPlannerService.js';

export const createChatController = ({
  chatLogger,
  getRagAuthHeaders,
  aiService,
  config,
  pipeStreamingResponse,
  buildSseCorsHeaders,
  getEnvNumber,
  DEFAULT_RAG_STREAM_TIMEOUT_MS,
  TRAVEL_PLANNER_ADDITIONAL_INSTRUCTIONS,
}) => {
  const { geminiClient, openaiClient, anthropicClient, buildOpenAIParams } = aiService;

  const handleGeminiGenerateContent = async (req, res) => {
    try {
      const { prompt, model: modelId } = req.body;

      if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Prompt is required and must be a non-empty string',
        });
      }

      if (!geminiClient) {
        return res.status(500).json({
          error: 'Configuration Error',
          message: 'Gemini API key is not configured.',
        });
      }

      const model = geminiClient.getGenerativeModel({ model: modelId || 'gemini-2.5-flash' });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return res.json({ response: text });
    } catch (error) {
      chatLogger?.error?.('Gemini API error', { error });
      return res.status(500).json({
        error: 'Internal Server Error',
        message: error.message,
      });
    }
  };

  const handleStandardChat = async (req, res) => {
    const { message, model, provider } = req.body;

    const isTripPlannerMessage = message?.startsWith(TRIP_PLANNER_PREFIX);
    const effectiveModel = isTripPlannerMessage ? TRIP_PLANNER_MODEL : model;
    const effectiveProvider = isTripPlannerMessage ? 'openai' : provider;

    if (!effectiveModel) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Model parameter is required.',
      });
    }

    if (!effectiveProvider) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Provider parameter is required.',
      });
    }

    try {
      let responseText = '';

      switch (effectiveProvider) {
        case 'google': {
          if (!geminiClient) {
            return res.status(500).json({
              error: 'Configuration Error',
              message: 'Google API key is not configured.',
            });
          }
          responseText = await geminiClient
            .getGenerativeModel({ model: effectiveModel })
            .generateContent(message.trim())
            .then((result) => result.response.text());
          break;
        }
        case 'openai': {
          if (!openaiClient) {
            return res.status(500).json({
              error: 'Configuration Error',
              message: 'OpenAI API key is not configured.',
            });
          }
          responseText = await openaiClient.chat.completions
            .create(buildOpenAIParams(effectiveModel, [{ role: 'user', content: message.trim() }]))
            .then((completion) => completion.choices[0].message.content);
          break;
        }
        case 'anthropic': {
          if (!anthropicClient) {
            return res.status(500).json({
              error: 'Configuration Error',
              message: 'Anthropic API key is not configured.',
            });
          }
          responseText = await anthropicClient.messages
            .create({
              model: effectiveModel,
              max_tokens: 4096,
              messages: [{ role: 'user', content: message.trim() }],
            })
            .then((anthropicMessage) => anthropicMessage.content[0].text);
          break;
        }
        default:
          return res.status(400).json({
            error: 'Bad Request',
            message: `Unsupported provider: ${effectiveProvider}`,
          });
      }

      if (config?.loggingEnabled) {
        const loggedAt = new Date().toISOString();
        chatLogger.logChat?.(req, {
          timestamp: loggedAt,
          question: message.trim(),
          answer: responseText,
          model: effectiveModel,
          provider: effectiveProvider,
          ragEnabled: false,
          metadata: { route: '/api/v2/chat' },
        });
      }

      return res.json({
        response: responseText,
        sources: [],
        conversation_id: null,
        model: effectiveModel,
      });
    } catch (error) {
      chatLogger?.error?.('Error processing chat request', { error });

      if (config?.loggingEnabled) {
        chatLogger.logChat?.(req, {
          timestamp: new Date().toISOString(),
          question: message.trim(),
          answer: null,
          model: effectiveModel,
          provider: effectiveProvider,
          ragEnabled: false,
          metadata: {
            route: '/api/v2/chat',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }

      if (error.status === 429) {
        return res.status(429).json({
          error: 'Rate Limit Exceeded',
          message: 'Too many requests to the AI provider. Please try again later.',
        });
      }

      if (error.status === 401) {
        return res.status(500).json({
          error: 'Configuration Error',
          message: 'Invalid API key for the selected provider.',
        });
      }

      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'An error occurred while processing your request.',
      });
    }
  };

  const handleRagChat = async (req, res) => {
    const {
      message,
      model,
      provider,
      chatHistory,
      conversationId,
      useRAG = true,
      audience,
    } = req.body;

    const isTripPlannerMessage = message?.startsWith(TRIP_PLANNER_PREFIX);
    const effectiveModel = isTripPlannerMessage ? TRIP_PLANNER_MODEL : model;
    const effectiveProvider = isTripPlannerMessage ? 'openai' : provider;

    try {
      chatLogger?.info?.('Processing RAG chat request', {
        message: message?.substring(0, 50),
        model: effectiveModel,
        provider: effectiveProvider,
        hasHistory: !!chatHistory,
        conversationId,
      });

      const ragResponse = await axios.post(
        `${RAG_SERVICE_URL}/api/v1/chat`,
        {
          message: message.trim(),
          chat_history: chatHistory || [],
          conversation_id: conversationId,
          provider: effectiveProvider || 'openai',
          model: effectiveModel,
          use_rag: useRAG,
          include_sources: true,
          ...(audience ? { audience } : {}),
        },
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json',
            ...getRagAuthHeaders(),
          },
        },
      );

      return res.json(ragResponse.data);
    } catch (error) {
      chatLogger?.error?.('RAG chat error', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status,
        stack: error.stack,
      });

      if (error.response) {
        return res.status(error.response.status).json(error.response.data);
      }

      return res.status(502).json({
        error: 'RAG Service Unavailable',
        message: 'Upstream retrieval service failed and no fallback is configured.',
      });
    }
  };

  const handleStreamingChat = async (req, res) => {
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
      modelMode,
    } = req.body;

    const isTripPlannerMessage = message?.startsWith(TRIP_PLANNER_PREFIX);
    const effectiveModel = isTripPlannerMessage ? TRIP_PLANNER_MODEL : model;
    const effectiveProvider = isTripPlannerMessage ? 'openai' : provider;

    try {
      chatLogger?.info?.('Processing streaming chat request', {
        message: message?.substring(0, 50),
        model: effectiveModel,
        provider: effectiveProvider,
        hasHistory: !!chatHistory,
        conversationId,
      });

      const jurisdiction = isTripPlannerMessage ? inferJurisdiction(message) : undefined;
      let messageForRetrieval = message.trim();
      if (isTripPlannerMessage) {
        const hints = buildTripPlannerHints(jurisdiction);
        messageForRetrieval = `${messageForRetrieval}\n\nRetrieval focus: ${hints.join(' | ')}`;
      }

      const ragStreamTimeout =
        getEnvNumber?.('RAG_STREAM_TIMEOUT', DEFAULT_RAG_STREAM_TIMEOUT_MS) ||
        DEFAULT_RAG_STREAM_TIMEOUT_MS;
      const upstreamAbortController = new AbortController();

      const response = await axios.post(
        `${RAG_SERVICE_URL}/api/v1/streaming_chat`,
        {
          message: messageForRetrieval,
          chat_history: chatHistory || [],
          conversation_id: conversationId,
          provider: effectiveProvider || 'openai',
          model: effectiveModel,
          use_rag: useRAG,
          include_sources: true,
          short_answer_mode: shortAnswerMode,
          use_hybrid_search: isTripPlannerMessage ? true : useHybridSearch,
          ...(isTripPlannerMessage
            ? { additionalInstructions: TRAVEL_PLANNER_ADDITIONAL_INSTRUCTIONS }
            : {}),
          ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
          ...(responseVerbosity ? { response_verbosity: responseVerbosity } : {}),
          ...(jurisdiction ? { jurisdiction } : {}),
          ...(audience ? { audience } : {}),
          ...(modelMode ? { mode: modelMode } : {}),
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

      const streamingCorsHeaders = buildSseCorsHeaders?.(req.headers.origin) || {};
      let aggregatedAnswer = '';
      let remoteConversationId = conversationId || null;
      let aggregatedSources = [];
      let aggregatedFollowUps = [];
      const streamStart = Date.now();
      const streamLogger = chatLogger?.child
        ? chatLogger.child({
            scope: 'routes:chat:stream',
            conversationId: conversationId || null,
          })
        : null;

      pipeStreamingResponse({
        req,
        res,
        upstream: response,
        corsHeaders: {
          ...streamingCorsHeaders,
          'X-Accel-Buffering': 'no',
        },
        logger: streamLogger,
        heartbeatIntervalMs: 15000,
        idleTimeoutMs: DEFAULT_RAG_STREAM_TIMEOUT_MS,
        traceId: req.headers['x-request-id'],
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
          if (config?.loggingEnabled) {
            chatLogger.logChat?.(req, {
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
            chatLogger?.error?.('Error parsing SSE event', {
              error,
              sample: data.substring(0, 100),
            });
          }
        }
      });

      req.on('close', () => {
        upstreamAbortController.abort();
      });
    } catch (error) {
      chatLogger?.error?.('Error with streaming chat', { error });

      if (config?.loggingEnabled) {
        chatLogger.logChat?.(req, {
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
  };

  return {
    handleGeminiGenerateContent,
    handleStandardChat,
    handleRagChat,
    handleStreamingChat,
  };
};

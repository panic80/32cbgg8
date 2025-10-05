import { Router } from 'express';
import axios from 'axios';
import { PassThrough } from 'stream';

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

  const handleGeminiGenerateContent = async (req, res) => {
    try {
      const { prompt } = req.body;

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

      const model = geminiClient.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return res.json({ response: text });
    } catch (error) {
      console.error('Gemini API error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: error.message,
      });
    }
  };

  router.use('/api/chat', async (req, res, next) => {
    if (req.method === 'POST') {
      console.log('Legacy /api/chat endpoint called, redirecting to /api/gemini/generateContent');
      if (req.body) {
        req.body = decodeUrlParams(req.body);
      }
      if (req.body.query && !req.body.prompt) {
        req.body.prompt = req.body.query;
      }
      return handleGeminiGenerateContent(req, res);
    }
    return next();
  });

  router.post('/api/gemini/generateContent', rateLimiter, handleGeminiGenerateContent);

  router.post('/api/v2/chat/rag', rateLimiter, async (req, res) => {
    const { message, model, provider, chatHistory, conversationId, useRAG = true } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Message must be a non-empty string.',
      });
    }

    try {
      console.log('Processing RAG chat request', {
        message: message?.substring(0, 50),
        model,
        provider,
        hasHistory: !!chatHistory,
        conversationId,
      });

      const ragResponse = await axios.post(
        `${DEFAULT_RAG_SERVICE_URL}/api/v1/chat`,
        {
          message: message.trim(),
          chat_history: chatHistory || [],
          conversation_id: conversationId,
          provider: provider || 'openai',
          model,
          use_rag: useRAG,
          include_sources: true,
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
      console.error('RAG chat error:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status,
        stack: error.stack,
      });

      if (error.response) {
        return res.status(error.response.status).json(error.response.data);
      }

      console.log('RAG service unavailable, falling back to regular chat');

      try {
        let responseText = '';

        switch (provider) {
          case 'google':
            if (!geminiClient) {
              return res.status(500).json({
                error: 'Configuration Error',
                message: 'Google API key is not configured.',
              });
            }
            responseText = await geminiClient
              .getGenerativeModel({ model })
              .generateContent(message.trim())
              .then((result) => result.response.text());
            break;

          case 'openai':
            if (!openaiClient) {
              return res.status(500).json({
                error: 'Configuration Error',
                message: 'OpenAI API key is not configured.',
              });
            }
            responseText = await openaiClient.chat.completions
              .create(buildOpenAIParams(model, [{ role: 'user', content: message.trim() }]))
              .then((completion) => completion.choices[0].message.content);
            break;

          case 'anthropic':
            if (!anthropicClient) {
              return res.status(500).json({
                error: 'Configuration Error',
                message: 'Anthropic API key is not configured.',
              });
            }
            responseText = await anthropicClient.messages
              .create({
                model,
                max_tokens: 4096,
                messages: [{ role: 'user', content: message.trim() }],
              })
              .then((anthropicMessage) => anthropicMessage.content[0].text);
            break;

          default:
            return res.status(400).json({
              error: 'Bad Request',
              message: `Unsupported provider: ${provider}`,
            });
        }

        return res.json({
          response: responseText,
          sources: [],
          conversation_id: null,
          model,
        });
      } catch (fallbackError) {
        console.error('Fallback chat error:', fallbackError);
        return res.status(500).json({
          error: 'Internal Server Error',
          message: 'Both RAG and fallback chat services failed.',
        });
      }
    }
  });

  router.post('/api/v2/chat', rateLimiter, async (req, res) => {
    const { message, model, provider } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Message must be a non-empty string.',
      });
    }

    if (!model) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Model parameter is required.',
      });
    }

    if (!provider) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Provider parameter is required.',
      });
    }

    try {
      let responseText = '';

      switch (provider) {
        case 'google':
          if (!geminiClient) {
            return res.status(500).json({
              error: 'Configuration Error',
              message: 'Google API key is not configured.',
            });
          }
          responseText = await geminiClient
            .getGenerativeModel({ model })
            .generateContent(message.trim())
            .then((result) => result.response.text());
          break;

        case 'openai':
          if (!openaiClient) {
            return res.status(500).json({
              error: 'Configuration Error',
              message: 'OpenAI API key is not configured.',
            });
          }
          responseText = await openaiClient.chat.completions
            .create(buildOpenAIParams(model, [{ role: 'user', content: message.trim() }]))
            .then((completion) => completion.choices[0].message.content);
          break;

        case 'anthropic':
          if (!anthropicClient) {
            return res.status(500).json({
              error: 'Configuration Error',
              message: 'Anthropic API key is not configured.',
            });
          }
          responseText = await anthropicClient.messages
            .create({
              model,
              max_tokens: 4096,
              messages: [{ role: 'user', content: message.trim() }],
            })
            .then((anthropicMessage) => anthropicMessage.content[0].text);
          break;

        default:
          return res.status(400).json({
            error: 'Bad Request',
            message: `Unsupported provider: ${provider}`,
          });
      }

      if (config.loggingEnabled) {
        const loggedAt = new Date().toISOString();
        chatLogger.logChat(req, {
          timestamp: loggedAt,
          question: message.trim(),
          answer: responseText,
          model,
          provider,
          ragEnabled: false,
          metadata: { route: '/api/v2/chat' },
        });
      }

      return res.json({
        response: responseText,
        sources: [],
        conversation_id: null,
        model,
      });
    } catch (error) {
      console.error('Error processing chat request:', error);

      if (config.loggingEnabled) {
        chatLogger.logChat(req, {
          timestamp: new Date().toISOString(),
          question: message.trim(),
          answer: null,
          model,
          provider,
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
  });

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
    } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Message must be a non-empty string.',
      });
    }

    try {
      console.log('Processing streaming chat request', {
        message: message?.substring(0, 50),
        model,
        provider,
        hasHistory: !!chatHistory,
        conversationId,
      });

      const recentHistoryText = Array.isArray(chatHistory)
        ? chatHistory
            .slice(-5)
            .map((h) => (h && typeof h.content === 'string' ? h.content : ''))
            .join(' \n ')
        : '';
      const combinedText = `${message}\n${recentHistoryText}`.toLowerCase();
      const locationRegex =
        /\b(ontario|canada|alberta|british columbia|manitoba|saskatchewan|qu[eé]bec|nova scotia|new brunswick|newfoundland|labrador|prince edward island|pei|yukon|nunavut|northwest territories|toronto|ottawa|vancouver|calgary|edmonton|montreal|winnipeg|regina|halifax|saint john|st\.?\s*john'?s|charlottetown)\b/;
      const hasExplicitLocation = locationRegex.test(combinedText);
      const jurisdiction = hasExplicitLocation
        ? undefined
        : { region: 'Ontario', country: 'Canada' };

      const ragServiceUrl = DEFAULT_RAG_SERVICE_URL;
      const ragStreamTimeout = parseInt(process.env.RAG_STREAM_TIMEOUT || '120000', 10);
      const upstreamAbortController = new AbortController();

      const response = await axios.post(
        `${ragServiceUrl}/api/v1/streaming_chat`,
        {
          message: (message || '').trim(),
          chat_history: chatHistory || [],
          conversation_id: conversationId,
          provider: provider || 'openai',
          model,
          use_rag: useRAG,
          include_sources: true,
          short_answer_mode: shortAnswerMode,
          use_hybrid_search: useHybridSearch,
          ...(jurisdiction ? { jurisdiction } : {}),
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
      setSseHeaders(res, {
        ...streamingCorsHeaders,
        'X-Accel-Buffering': 'no',
      });

      const passThrough = new PassThrough();
      passThrough.pipe(res);

      let buffer = '';
      let aggregatedAnswer = '';
      let remoteConversationId = conversationId || null;
      let aggregatedSources = [];
      let aggregatedFollowUps = [];
      let streamStart = Date.now();

      response.data.on('data', (chunk) => {
        const fragment = chunk.toString();
        passThrough.write(fragment);
        buffer += fragment;

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '' || data === '[DONE]') continue;

          try {
            const event = JSON.parse(data);
            if (event.type === 'token' && typeof event.content === 'string') {
              aggregatedAnswer += event.content;
            }
            if (event.type === 'metadata') {
              if (event.conversation_id) {
                remoteConversationId = event.conversation_id;
              }
              if (Array.isArray(event.sources)) {
                aggregatedSources = event.sources;
              }
              if (Array.isArray(event.follow_up_questions)) {
                aggregatedFollowUps = event.follow_up_questions;
              }
            }
          } catch (parseError) {
            if (data !== '') {
              console.error(
                'Error parsing SSE event:',
                parseError,
                'Data:',
                data.substring(0, 100),
              );
            }
          }
        }
      });

      response.data.on('end', () => {
        passThrough.end();

        if (config.loggingEnabled) {
          chatLogger.logChat(req, {
            timestamp: new Date().toISOString(),
            question: message.trim(),
            answer: aggregatedAnswer,
            model,
            provider,
            ragEnabled: useRAG,
            conversationId: remoteConversationId,
            latencyMs: Date.now() - streamStart,
            metadata: {
              route: '/api/v2/chat/stream',
              sources: aggregatedSources,
              followUpQuestions: aggregatedFollowUps,
            },
          });
        }
      });

      req.on('close', () => {
        upstreamAbortController.abort();
        response.data.destroy();
        passThrough.end();
      });
    } catch (error) {
      console.error('Error with streaming chat:', error);

      if (config.loggingEnabled) {
        chatLogger.logChat(req, {
          timestamp: new Date().toISOString(),
          question: message.trim(),
          answer: null,
          model,
          provider,
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

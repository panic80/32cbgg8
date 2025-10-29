import axios from 'axios';

const DEFAULT_RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || 'http://localhost:8000';

export const createChatController = ({
  chatLogger,
  getRagAuthHeaders,
  geminiClient,
  openaiClient,
  anthropicClient,
  buildOpenAIParams,
  config,
}) => {
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
      chatLogger?.error?.('Gemini API error', { error });
      return res.status(500).json({
        error: 'Internal Server Error',
        message: error.message,
      });
    }
  };

  const handleStandardChat = async (req, res) => {
    const { message, model, provider } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Message must be a non-empty string.',
      });
    }

    const isTripPlannerMessage = message?.startsWith('📋 **Trip Plan Request**');
    const forcedModel = 'gpt-4.1-mini';
    const forcedProvider = 'openai';
    const effectiveModel = isTripPlannerMessage ? forcedModel : model;
    const effectiveProvider = isTripPlannerMessage ? forcedProvider : provider;

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
            .create(
              buildOpenAIParams(effectiveModel, [{ role: 'user', content: message.trim() }]),
            )
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
    const { message, model, provider, chatHistory, conversationId, useRAG = true, audience } =
      req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Message must be a non-empty string.',
      });
    }

    const isTripPlannerMessage = message?.startsWith('📋 **Trip Plan Request**');
    const forcedModel = 'gpt-4.1-mini';
    const forcedProvider = 'openai';
    const effectiveModel = isTripPlannerMessage ? forcedModel : model;
    const effectiveProvider = isTripPlannerMessage ? forcedProvider : provider;

    try {
      chatLogger?.info?.('Processing RAG chat request', {
        message: message?.substring(0, 50),
        model: effectiveModel,
        provider: effectiveProvider,
        hasHistory: !!chatHistory,
        conversationId,
      });

      const ragResponse = await axios.post(
        `${DEFAULT_RAG_SERVICE_URL}/api/v1/chat`,
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

  return {
    handleGeminiGenerateContent,
    handleStandardChat,
    handleRagChat,
  };
};

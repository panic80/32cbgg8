import axios from 'axios';

const FALLBACK_FOLLOW_UPS = [
  {
    question: 'Can you provide more specific examples?',
    category: 'clarification',
    confidence: 0.5,
  },
  {
    question: 'What are the next steps I should take?',
    category: 'practical',
    confidence: 0.5,
  },
];

const parseQuestions = (text) => {
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [];
    }
    const questions = JSON.parse(jsonMatch[0]);
    return questions
      .map((q, idx) => ({
        id: `followup-${Date.now()}-${idx}`,
        question: typeof q === 'string' ? q : (q?.question ?? ''),
        category: q?.category || 'related',
        confidence: q?.confidence || 0.7,
      }))
      .filter((q) => q.question.trim().length > 0);
  } catch (error) {
    return [];
  }
};

export const createSupportController = ({
  geminiClient,
  openaiClient,
  anthropicClient,
  processContent,
  cache,
  config,
  httpClient = axios,
}) => {
  const API_TIMEOUT_MS = 30000; // 30 second timeout for AI API calls

  const handleFollowUp = async (req, res) => {
    const { userQuestion, aiResponse, model = 'gemini-2.0-flash', provider = 'google' } = req.body;

    try {
      const prompt = `Based on this conversation, generate 2-3 relevant follow-up questions:\n\nUser Question: "${userQuestion}"\nAI Response: "${aiResponse}"\n\nGenerate follow-up questions that would help the user learn more or get specific information. Return as a JSON array of questions.`;

      let followUpQuestions = [];

      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('AI API request timed out')), API_TIMEOUT_MS);
      });

      switch (provider) {
        case 'google':
          if (geminiClient) {
            const modelInstance = geminiClient.getGenerativeModel({ model });
            const result = await Promise.race([
              modelInstance.generateContent(prompt),
              timeoutPromise,
            ]);
            const text = await result.response.text();
            followUpQuestions = parseQuestions(text);
          }
          break;
        case 'openai':
          if (openaiClient) {
            const completion = await Promise.race([
              openaiClient.chat.completions.create({
                model,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                timeout: API_TIMEOUT_MS,
              }),
              timeoutPromise,
            ]);
            const text = completion.choices?.[0]?.message?.content ?? '';
            followUpQuestions = parseQuestions(text);
          }
          break;
        case 'anthropic':
          if (anthropicClient) {
            const response = await Promise.race([
              anthropicClient.messages.create({
                model,
                max_tokens: 4096,
                messages: [{ role: 'user', content: prompt }],
                timeout: API_TIMEOUT_MS,
              }),
              timeoutPromise,
            ]);
            const text = response.content?.[0]?.text ?? '';
            followUpQuestions = parseQuestions(text);
          }
          break;
        default:
          break;
      }

      if (followUpQuestions.length === 0) {
        followUpQuestions = FALLBACK_FOLLOW_UPS.map((item, idx) => ({
          id: `followup-${Date.now()}-${idx}`,
          ...item,
        }));
      }

      return res.json({ followUpQuestions });
    } catch (error) {
      // Log error instead of swallowing it silently
      console.error('Error generating follow-up questions:', error.message);
      return res.json({
        followUpQuestions: FALLBACK_FOLLOW_UPS.map((item, idx) => ({
          id: `followup-${Date.now()}-${idx}`,
          ...item,
        })),
      });
    }
  };

  const handleTravelInstructions = async (req, res) => {
    try {
      const startTime = Date.now();
      const ifNoneMatch = req.headers['if-none-match'];

      if (cache) {
        const cachedData = await cache.get('travel-instructions');
        if (cachedData?.content && cachedData.etag) {
          if (ifNoneMatch && ifNoneMatch === cachedData.etag) {
            return res.status(304).send();
          }

          res.setHeader('Cache-Control', 'public, max-age=3600');
          res.setHeader('ETag', cachedData.etag);
          if (cachedData.lastModified) {
            res.setHeader('Last-Modified', cachedData.lastModified);
          }

          return res.json({
            content: cachedData.content,
            fresh: false,
            cacheAge: Date.now() - cachedData.timestamp,
            timestamp: new Date(cachedData.timestamp).toISOString(),
          });
        }
      }

      let response;
      let lastError;

      for (let attempt = 1; attempt <= config.maxRetries; attempt += 1) {
        try {
          response = await httpClient.get(config.canadaCaUrl, {
            timeout: config.requestTimeout,
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; CFTravelBot/1.0)',
              Accept: 'text/html,application/xhtml+xml',
              'Accept-Language': 'en-CA,en;q=0.9',
              'Cache-Control': 'no-cache',
            },
            validateStatus: (status) => status < 500,
          });

          if (response.status === 200) {
            break;
          }

          if (response.status >= 400 && response.status < 500) {
            throw new Error(`Canada.ca returned status ${response.status}`);
          }
        } catch (error) {
          lastError = error;
          if (attempt < config.maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, config.retryDelay * attempt));
          }
        }
      }

      if (!response || response.status !== 200) {
        throw lastError || new Error('Failed to fetch travel instructions after all retries');
      }

      const content = processContent(response.data);
      const etag = `"${Buffer.from(content).toString('base64').substring(0, 27)}"`;

      if (cache) {
        await cache.set('travel-instructions', {
          content,
          timestamp: Date.now(),
          lastModified: response.headers['last-modified'],
          etag,
          source: 'canada.ca',
          fetchTime: Date.now() - startTime,
        });
      }

      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('ETag', etag);
      if (response.headers['last-modified']) {
        res.setHeader('Last-Modified', response.headers['last-modified']);
      }

      return res.json({
        content,
        fresh: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return res.status(500).json({
        error: 'Failed to fetch travel instructions',
        message: error.message,
      });
    }
  };

  return {
    handleFollowUp,
    handleTravelInstructions,
  };
};

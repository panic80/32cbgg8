import { Router } from 'express';
const createSupportRoutes = ({
  rateLimiter,
  cache,
  config,
  processContent,
  geminiClient,
  openaiClient,
  anthropicClient,
}) => {
  const router = Router();

  router.post('/api/v2/followup', rateLimiter, async (req, res) => {
    const { userQuestion, aiResponse, model, provider } = req.body;

    if (!userQuestion || !aiResponse) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'userQuestion and aiResponse are required.',
      });
    }

    try {
      const prompt = `Based on this conversation, generate 2-3 relevant follow-up questions:\n\nUser Question: "${userQuestion}"\nAI Response: "${aiResponse}"\n\nGenerate follow-up questions that would help the user learn more or get specific information. Return as a JSON array of questions.`;

      const actualProvider = provider || 'google';
      const actualModel = model || 'gemini-2.0-flash';

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
          console.error('Failed to parse follow-up questions:', error);
          return [];
        }
      };

      let followUpQuestions = [];

      switch (actualProvider) {
        case 'google':
          if (geminiClient) {
            const modelInstance = geminiClient.getGenerativeModel({ model: actualModel });
            const result = await modelInstance.generateContent(prompt);
            const text = await result.response.text();
            followUpQuestions = parseQuestions(text);
          }
          break;
        case 'openai':
          if (openaiClient) {
            const completion = await openaiClient.chat.completions.create({
              model: actualModel,
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.7,
            });
            const text = completion.choices[0].message.content;
            followUpQuestions = parseQuestions(text);
          }
          break;
        case 'anthropic':
          if (anthropicClient) {
            const response = await anthropicClient.messages.create({
              model: actualModel,
              max_tokens: 4096,
              messages: [{ role: 'user', content: prompt }],
            });
            const text = response.content?.[0]?.text ?? '';
            followUpQuestions = parseQuestions(text);
          }
          break;
        default:
          break;
      }

      if (followUpQuestions.length === 0) {
        followUpQuestions = [
          {
            id: `followup-${Date.now()}-0`,
            question: 'Can you provide more specific examples?',
            category: 'clarification',
            confidence: 0.5,
          },
          {
            id: `followup-${Date.now()}-1`,
            question: 'What are the next steps I should take?',
            category: 'practical',
            confidence: 0.5,
          },
        ];
      }

      return res.json({ followUpQuestions });
    } catch (error) {
      console.error('Error generating follow-up questions:', error);
      return res.json({ followUpQuestions: [] });
    }
  });

  router.get('/api/travel-instructions', rateLimiter, async (req, res) => {
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

      console.log('Fetching fresh travel instructions from:', config.canadaCaUrl);
      let response;
      let lastError;

      for (let attempt = 1; attempt <= config.maxRetries; attempt += 1) {
        try {
          response = await axios.get(config.canadaCaUrl, {
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
          console.log(`Attempt ${attempt} failed:`, error.message);
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
      console.error('Proxy error:', error.message, '\nStack:', error.stack);

      const errorDetail = {
        message: error.message,
        code: error.code,
        isAxiosError: error.isAxiosError,
        status: error.response?.status,
        endpoint: '/api/travel-instructions',
        timestamp: new Date().toISOString(),
      };
      console.error('Structured error log:', JSON.stringify(errorDetail));

      const cachedData = cache ? await cache.get('travel-instructions') : null;
      if (cachedData) {
        console.log(
          'Serving stale cache due to error, cache age:',
          Date.now() - cachedData.timestamp,
          'ms',
        );
        res.setHeader('Cache-Control', 'max-age=0, must-revalidate');
        if (cachedData.etag) {
          res.setHeader('ETag', `W/"${cachedData.etag}-stale"`);
        }

        return res.json({
          content: cachedData.content,
          stale: true,
          cacheAge: Date.now() - cachedData.timestamp,
          timestamp: new Date(cachedData.timestamp).toISOString(),
        });
      }

      return res.status(502).json({
        error: 'UpstreamError',
        message: 'Unable to fetch travel instructions at this time.',
      });
    }
  });

  return router;
};

export default createSupportRoutes;

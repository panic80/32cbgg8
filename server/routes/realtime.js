import { Router } from 'express';

const REALTIME_SESSION_ENDPOINT = 'https://api.openai.com/v1/realtime/sessions';
const buildRealtimeConnectEndpoint = (model) =>
  `https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`;

const isValidApiKey = (key) => {
  if (!key || typeof key !== 'string') {
    return false;
  }
  if (key.includes('your-') || key.includes('-key-here')) {
    return false;
  }
  return key.trim().length > 20;
};

const resolveOpenAiApiKey = () => {
  const candidates = [
    process.env.OPENAI_API_KEY,
    process.env.RAG_OPENAI_API_KEY,
    process.env.RAG_SERVICE_OPENAI_API_KEY,
  ];
  return candidates.find(isValidApiKey) || null;
};

const createRealtimeRoutes = ({ rateLimiter, chatLogger }) => {
  const router = Router();

  router.post('/api/v2/realtime/session', rateLimiter, async (req, res) => {
    const apiKey = resolveOpenAiApiKey();

    if (!apiKey) {
      return res.status(500).json({
        error: 'Configuration Error',
        message: 'OpenAI API key is not configured on the server.',
      });
    }

    try {
      const model = req.body?.model || 'gpt-realtime-mini';
      const voice = req.body?.voice || 'verse';
      const inputAudioFormat = req.body?.inputAudioFormat || 'pcm16';
      const outputAudioFormat = req.body?.outputAudioFormat || 'pcm16';

      const sessionResponse = await fetch(REALTIME_SESSION_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'realtime=v1',
        },
        body: JSON.stringify({
          model,
          voice,
          input_audio_format: inputAudioFormat,
          output_audio_format: outputAudioFormat,
        }),
      });

      if (!sessionResponse.ok) {
        const errorText = await sessionResponse.text();
        if (chatLogger) {
          chatLogger.log({
            type: 'realtime-session-error',
            status: sessionResponse.status,
            message: errorText,
            timestamp: new Date().toISOString(),
          });
        }

        return res.status(502).json({
          error: 'Upstream Error',
          message: 'Failed to create realtime session.',
          details: errorText,
        });
      }

      const sessionData = await sessionResponse.json();
      return res.json(sessionData);
    } catch (error) {
      console.error('Realtime session error:', error);
      if (chatLogger) {
        chatLogger.log({
          type: 'realtime-session-error',
          message: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString(),
        });
      }
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Unable to create realtime session.',
      });
    }
  });

  router.post('/api/v2/realtime/answer', rateLimiter, async (req, res) => {
    const { clientSecret, sdp, model = 'gpt-realtime-mini' } = req.body || {};

    if (!clientSecret || !sdp) {
      console.warn('Realtime answer missing required fields', { hasClientSecret: !!clientSecret, hasSdp: !!sdp });
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing client secret or SDP offer.',
      });
    }

    try {
      console.log('Exchanging realtime SDP with OpenAI', { model });
      const answerResponse = await fetch(buildRealtimeConnectEndpoint(model), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${clientSecret}`,
          'Content-Type': 'application/sdp',
          'OpenAI-Beta': 'realtime=v1',
        },
        body: sdp,
      });

      if (!answerResponse.ok) {
        const errorText = await answerResponse.text();
        if (chatLogger) {
          chatLogger.log({
            type: 'realtime-answer-error',
            status: answerResponse.status,
            timestamp: new Date().toISOString(),
            message: 'Failed to exchange realtime SDP.',
            details: errorText,
          });
        }
        console.error('Realtime answer exchange failed', {
          status: answerResponse.status,
          error: errorText,
        });

        return res.status(502).json({
          error: 'Upstream Error',
          message: 'Failed to exchange realtime SDP.',
          details: errorText,
        });
      }

      const answer = await answerResponse.text();
      console.log('Realtime SDP exchange succeeded');
      res.setHeader('Content-Type', 'application/sdp');
      return res.send(answer);
    } catch (error) {
      console.error('Realtime answer error:', error);
      if (chatLogger) {
        chatLogger.log({
          type: 'realtime-answer-error',
          message: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Unable to exchange realtime SDP.',
      });
    }
  });

  return router;
};

export default createRealtimeRoutes;

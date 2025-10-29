import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import createChatRoutes from '../chat.js';

const buildApp = ({ geminiClient } = {}) => {
  const app = express();
  app.use(express.json());

  const chatLogger = { error: vi.fn(), info: vi.fn(), logChat: vi.fn() };

  app.use(
    createChatRoutes({
      rateLimiter: (_req, _res, next) => next(),
      config: { loggingEnabled: false },
      chatLogger,
      getRagAuthHeaders: () => ({}),
      decodeUrlParams: (body) => body,
      geminiClient,
      openaiClient: null,
      anthropicClient: null,
      buildOpenAIParams: vi.fn(),
      buildSseCorsHeaders: () => ({}),
      setSseHeaders: () => {},
    }),
  );

  return app;
};

describe('/api/gemini/generateContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when prompt is missing', async () => {
    const app = buildApp();

    const response = await request(app).post('/api/gemini/generateContent').send({});

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/prompt is required/i);
  });

  it('returns 500 when Gemini client is not configured', async () => {
    const app = buildApp({ geminiClient: null });

    const response = await request(app)
      .post('/api/gemini/generateContent')
      .send({ prompt: 'Hello Gemini' });

    expect(response.status).toBe(500);
    expect(response.body.message).toMatch(/not configured/i);
  });

  it('returns generated content when Gemini client succeeds', async () => {
    const generateContent = vi.fn().mockResolvedValue({
      response: { text: () => 'mock-gemini-response' },
    });
    const mockGeminiClient = {
      getGenerativeModel: vi.fn().mockReturnValue({ generateContent }),
    };

    const app = buildApp({ geminiClient: mockGeminiClient });

    const response = await request(app)
      .post('/api/gemini/generateContent')
      .send({ prompt: 'Hello Gemini' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ response: 'mock-gemini-response' });
    expect(mockGeminiClient.getGenerativeModel).toHaveBeenCalledWith({ model: 'gemini-2.0-flash' });
    expect(generateContent).toHaveBeenCalledWith('Hello Gemini');
  });
});

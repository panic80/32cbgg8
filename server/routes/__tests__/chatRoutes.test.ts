import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: class {
      getGenerativeModel() {
        return {
          generateContent: vi.fn().mockResolvedValue({
            response: { text: () => 'mock-response' },
          }),
        };
      }
    },
  };
});

vi.mock('openai', () => {
  class MockOpenAI {
    chat = {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'mock-openai' } }],
        }),
      },
    };
  }
  return { default: MockOpenAI };
});

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = {
      create: vi.fn().mockResolvedValue({ content: [{ text: 'mock-anthropic' }] }),
    };
  }
  return { default: MockAnthropic };
});

const axiosPostMock = vi.fn();

vi.mock('axios', () => ({
  default: {
    post: axiosPostMock,
  },
}));

let app: import('express').Express;

describe('chat routes', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.ENABLE_CACHE = 'false';
    process.env.ENABLE_LOGGING = 'false';
    process.env.CONFIG_PANEL_USER = 'admin';
    process.env.CONFIG_PANEL_PASSWORD = 'password';
    process.env.ADMIN_API_TOKEN = 'test-admin-token';
    process.env.SKIP_SECURE_ENV = 'true';
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    process.env.GOOGLE_MAPS_API_KEY = 'test-maps-key';
    process.env.RAG_SERVICE_URL = 'http://mock-rag.test';

    const module = await import('../../main.js');
    app = module.default;
  });

  beforeEach(() => {
    axiosPostMock.mockReset();
  });

  it('rejects RAG requests without a message', async () => {
    const response = await request(app).post('/api/v2/chat/rag').send({ model: 'gpt-4.1-mini' });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/Message must be a non-empty string/i);
  });

  it('proxies valid RAG requests to the upstream service', async () => {
    axiosPostMock.mockResolvedValueOnce({ data: { reply: 'rag-response' } });

    const payload = {
      message: 'Hello RAG',
      model: 'gpt-4.1-mini',
      provider: 'openai',
      chatHistory: [],
      conversationId: 'conv-42',
    };

    const response = await request(app).post('/api/v2/chat/rag').send(payload);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ reply: 'rag-response' });

    expect(axiosPostMock).toHaveBeenCalledTimes(1);
    const [url, body] = axiosPostMock.mock.calls[0];
    expect(url).toContain('/api/v1/chat');
    expect(body).toMatchObject({
      message: payload.message,
      conversation_id: payload.conversationId,
      include_sources: true,
    });
  });
});

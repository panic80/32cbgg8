import request from 'supertest';
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';

const mockGenerateContent = vi.fn();
const axiosGet = vi.fn();
const axiosPost = vi.fn();
const logChatSpy = vi.fn();
const logSpy = vi.fn();

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return {
        generateContent: mockGenerateContent,
      };
    }
  }
}));

vi.mock('axios', () => ({
  default: {
    get: (...args: unknown[]) => axiosGet(...args),
    post: (...args: unknown[]) => axiosPost(...args),
  },
  get: (...args: unknown[]) => axiosGet(...args),
  post: (...args: unknown[]) => axiosPost(...args),
}));

vi.mock('../services/logger.js', () => ({
  default: {
    logChat: logChatSpy,
    log: logSpy,
  },
}));

const realSetInterval = global.setInterval;
const timers: NodeJS.Timeout[] = [];
const originalEnv = { ...process.env };

let app: import('express').Express;
let testing: typeof import('../proxy.js')['__testing'];

describe('proxy server', () => {
  beforeAll(async () => {
    vi.spyOn(global, 'setInterval').mockImplementation((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      const timer = realSetInterval(handler, timeout as number, ...args);
      if (typeof (timer as NodeJS.Timeout).unref === 'function') {
        (timer as NodeJS.Timeout).unref();
      }
      timers.push(timer as NodeJS.Timeout);
      return timer as unknown as ReturnType<typeof setInterval>;
    });

    process.env.NODE_ENV = 'test';
    process.env.ENABLE_LOGGING = 'true';
    const module = await import('../proxy.js');
    app = module.default;
    testing = module.__testing;
  });

  afterAll(() => {
    timers.forEach(clearInterval);
    (global.setInterval as unknown as { mockRestore?: () => void }).mockRestore?.();
    process.env = originalEnv;
  });

  beforeEach(() => {
    mockGenerateContent.mockReset();
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => 'Answer: default',
      },
    });
    axiosGet.mockReset();
    axiosPost.mockReset();
    logChatSpy.mockReset();
    logSpy.mockReset();
    testing.cache.clear();
    testing.apiRequestCounts.clear();
    delete process.env.VITE_GEMINI_API_KEY;
  });

  it('rejects Gemini requests when API key is missing', async () => {
    const response = await request(app)
      .post('/api/gemini/generateContent')
      .send({ prompt: 'Question: Hello?' });

    expect(response.status).toBe(500);
    expect(response.body.error).toContain('API key');
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('rejects Gemini requests when API key format is invalid', async () => {
    process.env.VITE_GEMINI_API_KEY = 'not-a-valid-key';

    const response = await request(app)
      .post('/api/gemini/generateContent')
      .send({ prompt: 'Question: Hello?' });

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Invalid API key format in environment variables');
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('returns generated content when Gemini key is valid', async () => {
    process.env.VITE_GEMINI_API_KEY = 'AIza' + 'A'.repeat(24);
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => 'Answer: Generated insight',
      },
    });

    const response = await request(app)
      .post('/api/gemini/generateContent')
      .send({ prompt: 'Question: Provide guidance\nAnswer: ' });

    expect(response.status).toBe(200);
    expect(response.body.candidates?.[0]?.content?.parts?.[0]?.text).toContain('Generated insight');
    expect(logChatSpy).toHaveBeenCalled();
  });

  it('decodes URL parameters for the testing endpoint', async () => {
    const response = await request(app)
      .post('/api/test-url-encoding?stage=Ready%20Set')
      .set('Content-Type', 'application/json')
      .send({ note: 'Hello%20World', tags: ['Alpha%2BBeta'] });

    expect(response.status).toBe(200);
    expect(response.body.decodedBody.note).toBe('Hello World');
    expect(response.body.decodedBody.tags).toEqual(['Alpha+Beta']);
    expect(response.body.decodedQuery.stage).toBe('Ready Set');
  });

  it('fetches and returns processed travel instructions', async () => {
    process.env.VITE_GEMINI_API_KEY = 'AIza' + 'B'.repeat(24); // prevent cascade checks
    const html = `<main>${'Travel guidance '.repeat(20)}</main>`;
    axiosGet.mockResolvedValue({
      status: 200,
      data: html,
      headers: {
        etag: '"abc"',
        'last-modified': 'Thu, 01 Jan 1970 00:00:00 GMT',
      },
    });

    const response = await request(app)
      .get('/api/travel-instructions')
      .set('Accept', 'application/json');

    expect(response.status).toBe(200);
    expect(response.body.fresh).toBe(true);
    expect(typeof response.body.content).toBe('string');
    expect(response.body.content.length).toBeGreaterThan(100);
    expect(axiosGet).toHaveBeenCalledTimes(1);
  });
});

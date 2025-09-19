import express from 'express';
import request from 'supertest';
import createLogsRoutes from '../routes/logs.js';
import chatLogger from '../services/logger.js';

const noopRateLimiter = (_req, _res, next) => next();

describe('admin chat log routes', () => {
  const app = express();
  app.use(express.json());
  app.use(createLogsRoutes({ rateLimiter: noopRateLimiter }));

  const originalLoggingFlag = process.env.ENABLE_LOGGING;

  beforeAll(() => {
    process.env.ENABLE_LOGGING = 'true';
  });

  beforeEach(() => {
    chatLogger.clearAllLogs();
  });

  afterAll(() => {
    chatLogger.clearAllLogs();
    if (originalLoggingFlag === undefined) {
      delete process.env.ENABLE_LOGGING;
    } else {
      process.env.ENABLE_LOGGING = originalLoggingFlag;
    }
  });

  it('returns service unavailable when logging is disabled', async () => {
    process.env.ENABLE_LOGGING = 'false';

    const response = await request(app).get('/api/admin/chat-logs');

    expect(response.status).toBe(503);
    expect(response.body.error).toBe('LoggingDisabled');

    process.env.ENABLE_LOGGING = 'true';
  });

  it('returns paginated chat logs with filters', async () => {
    process.env.ENABLE_LOGGING = 'true';

    chatLogger.logChat(null, {
      timestamp: '2024-01-01T00:00:00.000Z',
      question: 'First question about travel',
      answer: 'First answer',
      model: 'gpt-4o',
      provider: 'openai',
      conversationId: 'conv-1',
      ragEnabled: true,
    });

    chatLogger.logChat(null, {
      timestamp: '2024-01-02T00:00:00.000Z',
      question: 'Second question regarding visas',
      answer: 'Second answer',
      model: 'gpt-5-mini',
      provider: 'openai',
      conversationId: 'conv-2',
      ragEnabled: false,
      shortAnswerMode: true,
    });

    const response = await request(app)
      .get('/api/admin/chat-logs')
      .query({
        limit: 1,
        offset: 0,
        search: 'visa',
        ragEnabled: 'false',
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].conversationId).toBe('conv-2');
    expect(response.body.pagination.hasMore).toBe(false);
    expect(response.body.filters.ragEnabled).toBe('false');
  });
});

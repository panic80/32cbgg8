import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import createIngestionRoutes from '../ingestion.js';

vi.mock('axios');

const axiosPostMock = axios.post as unknown as ReturnType<typeof vi.fn>;

const buildApp = ({ validateUrlResult = 'https://example.com/doc' } = {}) => {
  const app = express();
  app.use(express.json());

  const validateIngestionUrl = vi.fn().mockResolvedValue(validateUrlResult);

  app.use(
    createIngestionRoutes({
      rateLimiter: (_req, _res, next) => next(),
      requireAdminAuth: (_req, _res, next) => next(),
      validateIngestionUrl,
      getRagAuthHeaders: () => ({}),
      buildSseCorsHeaders: () => ({}),
      setSseHeaders: () => {},
    }),
  );

  return { app, validateIngestionUrl };
};

describe('ingestion routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when neither url nor content provided', async () => {
    const { app } = buildApp();

    const response = await request(app).post('/api/rag/ingest').send({});

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Validation failed');
    expect(response.body.details?.[0]?.message).toMatch(/Either URL or content must be provided/i);
  });

  it('forwards payload when url is provided', async () => {
    axiosPostMock.mockResolvedValueOnce({ data: { status: 'ok' } });
    const { app, validateIngestionUrl } = buildApp();

    const response = await request(app)
      .post('/api/rag/ingest')
      .send({ url: ' https://example.com/doc ', metadata: { source: 'test' } });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(validateIngestionUrl).toHaveBeenCalledWith('https://example.com/doc');
    expect(axiosPostMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/ingest'),
      expect.objectContaining({
        url: 'https://example.com/doc',
        metadata: { source: 'test' },
        force_refresh: false,
      }),
      expect.any(Object),
    );
  });

  it('passes content bodies through when provided', async () => {
    axiosPostMock.mockResolvedValueOnce({ data: { status: 'ok' } });
    const { app } = buildApp({ validateUrlResult: 'https://example.com/doc' });

    const response = await request(app)
      .post('/api/v2/ingest')
      .send({ content: ' Document body ', forceRefresh: true });

    expect(response.status).toBe(200);
    expect(axiosPostMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/ingest'),
      expect.objectContaining({
        content: 'Document body',
        force_refresh: true,
      }),
      expect.any(Object),
    );
  });
});

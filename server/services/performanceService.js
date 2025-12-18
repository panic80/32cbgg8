import axios from 'axios';
import { RAG_SERVICE_URL } from '../config/constants.js';

const DEFAULT_TIMEOUT_MS = 7000;
const DEFAULT_CACHE_MS = 5000;

const cacheState = {
  data: null,
  expiresAt: 0,
};

const parseDuration = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  if (Number.isNaN(parsed) || !Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
};

const normaliseNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
};

const normaliseMetric = (metric) => {
  if (!metric || typeof metric !== 'object') {
    return {
      count: 0,
      mean: 0,
      min: 0,
      max: 0,
      p50: 0,
      p75: 0,
      p95: 0,
      p99: 0,
      rate_per_minute: 0,
      window_size: 0,
      recent: [],
    };
  }

  return {
    count: normaliseNumber(metric.count),
    mean: normaliseNumber(metric.mean),
    min: normaliseNumber(metric.min),
    max: normaliseNumber(metric.max),
    p50: normaliseNumber(metric.p50),
    p75: normaliseNumber(metric.p75),
    p95: normaliseNumber(metric.p95),
    p99: normaliseNumber(metric.p99),
    rate_per_minute: normaliseNumber(metric.rate_per_minute),
    window_size: normaliseNumber(metric.window_size),
    recent: Array.isArray(metric.recent) ? metric.recent : [],
  };
};

const normalisePayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return {
      latency: {},
      quality: {},
      throughput: {},
      cache: {},
      retrievers: {},
      tokenUsage: {},
      meta: {},
      gatewayMeta: {},
    };
  }

  const latencies = payload.latency || {};
  const quality = payload.quality || {};
  const retrievalScores = quality.retrievalScores || {};

  return {
    latency: {
      answerTime: normaliseMetric(latencies.answerTime),
      searchTime: normaliseMetric(latencies.searchTime),
      retrievalTime: normaliseMetric(latencies.retrievalTime),
      answerGeneration: normaliseMetric(latencies.answerGeneration),
      firstToken: normaliseMetric(latencies.firstToken),
    },
    quality: {
      contextCoverage: normaliseMetric(quality.contextCoverage),
      contextSupport: normaliseMetric(quality.contextSupport),
      answerToContext: normaliseMetric(quality.answerToContext),
      hallucinationRate: normaliseMetric(quality.hallucinationRate),
      answerTokens: normaliseMetric(quality.answerTokens),
      sourceTokens: normaliseMetric(quality.sourceTokens),
      sourceCount: normaliseMetric(quality.sourceCount),
      retrievalScores: {
        avg: normaliseMetric(retrievalScores.avg),
        max: normaliseMetric(retrievalScores.max),
        min: normaliseMetric(retrievalScores.min),
        std: normaliseMetric(retrievalScores.std),
        gap: normaliseMetric(retrievalScores.gap),
      },
      errorRate: {
        total_requests: normaliseNumber(quality.errorRate?.total_requests),
        failed_requests: normaliseNumber(quality.errorRate?.failed_requests),
        error_rate: normaliseNumber(quality.errorRate?.error_rate),
        errors_by_type: quality.errorRate?.errors_by_type ?? {},
      },
    },
    throughput: payload.throughput || {},
    cache: payload.cache || {},
    retrievers: payload.retrievers || {},
    tokenUsage: payload.tokenUsage || {},
    meta: payload.meta || {},
    gatewayMeta: payload.gatewayMeta || {},
  };
};

const performanceService = {
  async fetchMetrics({ forceRefresh = false } = {}) {
    const now = Date.now();
    const ttl = parseDuration(process.env.PERFORMANCE_METRICS_CACHE_MS, DEFAULT_CACHE_MS);

    if (!forceRefresh && cacheState.data && cacheState.expiresAt > now) {
      return {
        ...cacheState.data,
        gatewayMeta: {
          ...cacheState.data.gatewayMeta,
          cached: true,
          fetchedAt: cacheState.data.gatewayMeta?.fetchedAt,
        },
      };
    }

    const baseUrl = RAG_SERVICE_URL;
    const endpoint = `${baseUrl.replace(/\/$/, '')}/api/v1/metrics/summary`;
    const timeout = parseDuration(process.env.RAG_METRICS_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);

    const headers = {};
    if (process.env.RAG_METRICS_TOKEN) {
      headers.Authorization = `Bearer ${process.env.RAG_METRICS_TOKEN}`;
    }

    const response = await axios.get(endpoint, {
      timeout,
      headers,
    });

    const payload = normalisePayload(response.data);
    const enriched = {
      ...payload,
      gatewayMeta: {
        cached: false,
        fetchedAt: new Date(now).toISOString(),
        ragEndpoint: endpoint,
      },
    };

    cacheState.data = enriched;
    cacheState.expiresAt = now + Math.max(ttl, 0);

    return enriched;
  },

  clearCache() {
    cacheState.data = null;
    cacheState.expiresAt = 0;
  },
};

export default performanceService;

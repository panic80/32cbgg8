import { apiClient, ApiError } from '@/api/client';
import type {
  ErrorRateSummary,
  MetricSample,
  MetricStats,
  PerformanceMetrics,
  ThroughputMetrics,
  PerformanceMeta,
  GatewayMeta,
} from '@/types/performance';

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

const mapSamples = (raw: unknown): MetricSample[] => {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((sample) => {
      if (!sample || typeof sample !== 'object') {
        return null;
      }
      const value = toNumber((sample as Record<string, unknown>).value, NaN);
      const timestamp = (sample as Record<string, unknown>).timestamp;
      if (!Number.isFinite(value) || typeof timestamp !== 'string') {
        return null;
      }
      return { value, timestamp };
    })
    .filter((sample): sample is MetricSample => sample !== null);
};

const mapMetric = (raw: unknown): MetricStats => {
  const source = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {};

  return {
    count: toNumber(source.count),
    mean: toNumber(source.mean),
    min: toNumber(source.min),
    max: toNumber(source.max),
    p50: toNumber(source.p50),
    p75: toNumber(source.p75),
    p95: toNumber(source.p95),
    p99: toNumber(source.p99),
    ratePerMinute: toNumber(source.rate_per_minute ?? source.ratePerMinute),
    windowSize: toNumber(source.window_size ?? source.windowSize),
    recent: mapSamples(source.recent),
  };
};

const mapErrorRate = (raw: unknown): ErrorRateSummary => {
  const source = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {};
  return {
    totalRequests: toNumber(source.total_requests ?? source.totalRequests),
    failedRequests: toNumber(source.failed_requests ?? source.failedRequests),
    errorRate: toNumber(source.error_rate ?? source.errorRate),
    errorsByType: (source.errors_by_type ?? source.errorsByType ?? {}) as Record<string, number>,
  };
};

const mapThroughput = (raw: unknown): ThroughputMetrics => {
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  const source = raw as Record<string, unknown>;
  const resolve = (value: unknown) => {
    const numeric = toNumber(value, Number.NaN);
    return Number.isNaN(numeric) ? undefined : numeric;
  };
  return {
    requestsPerMinute: resolve(source.requestsPerMinute ?? source.requests_per_minute),
    totalRequests: resolve(source.totalRequests ?? source.total_requests),
    successfulRequests: resolve(source.successfulRequests ?? source.successful_requests),
    failedRequests: resolve(source.failedRequests ?? source.failed_requests),
  };
};

const mapMeta = (raw: unknown): PerformanceMeta => {
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  const source = raw as Record<string, unknown>;
  return {
    windowSize: (() => {
      const value = toNumber(source.windowSize ?? source.window_size, Number.NaN);
      return Number.isNaN(value) ? undefined : value;
    })(),
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : undefined,
    uptimeSeconds: (() => {
      const value = toNumber(source.uptimeSeconds ?? source.uptime_seconds, Number.NaN);
      return Number.isNaN(value) ? undefined : value;
    })(),
  };
};

const mapGatewayMeta = (raw: unknown): GatewayMeta | undefined => {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const source = raw as Record<string, unknown>;
  return {
    cached: typeof source.cached === 'boolean' ? source.cached : undefined,
    fetchedAt: typeof source.fetchedAt === 'string' ? source.fetchedAt : undefined,
    ragEndpoint: typeof source.ragEndpoint === 'string' ? source.ragEndpoint : undefined,
  };
};

export interface FetchPerformanceOptions {
  signal?: AbortSignal;
  forceRefresh?: boolean;
}

export async function fetchPerformanceMetrics(options: FetchPerformanceOptions = {}): Promise<PerformanceMetrics> {
  const { signal, forceRefresh = false } = options;
  const query = forceRefresh ? '?forceRefresh=true' : '';
  let payload: any;
  try {
    payload = await apiClient.getJson<any>(`/api/admin/performance${query}`, {
      signal,
      parseErrorResponse: true,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      const detail = typeof (error.data as any)?.message === 'string' ? (error.data as any).message : error.statusText;
      throw new Error(`Failed to load performance metrics (${error.status}): ${detail}`);
    }
    throw error;
  }

  return {
    latency: {
      answerTime: mapMetric(payload?.latency?.answerTime),
      searchTime: mapMetric(payload?.latency?.searchTime),
      retrievalTime: mapMetric(payload?.latency?.retrievalTime),
      answerGeneration: mapMetric(payload?.latency?.answerGeneration),
      firstToken: mapMetric(payload?.latency?.firstToken),
    },
    quality: {
      contextCoverage: mapMetric(payload?.quality?.contextCoverage),
      contextSupport: mapMetric(payload?.quality?.contextSupport),
      answerToContext: mapMetric(payload?.quality?.answerToContext),
      hallucinationRate: mapMetric(payload?.quality?.hallucinationRate),
      answerTokens: mapMetric(payload?.quality?.answerTokens),
      sourceTokens: mapMetric(payload?.quality?.sourceTokens),
      sourceCount: mapMetric(payload?.quality?.sourceCount),
      retrievalScores: {
        avg: mapMetric(payload?.quality?.retrievalScores?.avg),
        max: mapMetric(payload?.quality?.retrievalScores?.max),
        min: mapMetric(payload?.quality?.retrievalScores?.min),
        std: mapMetric(payload?.quality?.retrievalScores?.std),
        gap: mapMetric(payload?.quality?.retrievalScores?.gap),
      },
      errorRate: mapErrorRate(payload?.quality?.errorRate),
    },
    throughput: mapThroughput(payload?.throughput),
    cache: payload?.cache ?? {},
    retrievers: payload?.retrievers ?? {},
    tokenUsage: payload?.tokenUsage ?? {},
    meta: mapMeta(payload?.meta),
    gatewayMeta: mapGatewayMeta(payload?.gatewayMeta),
  };
}

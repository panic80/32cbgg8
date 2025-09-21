import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PerformanceDashboard from '../PerformanceDashboard';
import type { PerformanceMetrics } from '@/types/performance';

defineGlobalMocks();

const metricsSample: PerformanceMetrics = {
  latency: {
    answerTime: { count: 5, mean: 1500, min: 1000, max: 2000, p50: 1400, p75: 1600, p95: 1900, p99: 2100, ratePerMinute: 2, windowSize: 5, recent: [] },
    searchTime: { count: 5, mean: 400, min: 200, max: 600, p50: 380, p75: 420, p95: 500, p99: 520, ratePerMinute: 2, windowSize: 5, recent: [] },
    retrievalTime: { count: 5, mean: 250, min: 120, max: 400, p50: 220, p75: 260, p95: 320, p99: 350, ratePerMinute: 2, windowSize: 5, recent: [] },
    answerGeneration: { count: 5, mean: 900, min: 600, max: 1100, p50: 850, p75: 930, p95: 1080, p99: 1100, ratePerMinute: 2, windowSize: 5, recent: [] },
    firstToken: { count: 5, mean: 450, min: 250, max: 600, p50: 420, p75: 480, p95: 560, p99: 580, ratePerMinute: 2, windowSize: 5, recent: [] },
  },
  quality: {
    contextCoverage: { count: 5, mean: 0.92, min: 0.9, max: 0.95, p50: 0.92, p75: 0.93, p95: 0.95, p99: 0.95, ratePerMinute: 0, windowSize: 5, recent: [] },
    hallucinationRate: { count: 5, mean: 0.04, min: 0.03, max: 0.06, p50: 0.04, p75: 0.05, p95: 0.06, p99: 0.06, ratePerMinute: 0, windowSize: 5, recent: [] },
    errorRate: { totalRequests: 50, failedRequests: 2, errorRate: 0.04, errorsByType: { llm: 1, retrieval: 1 } },
  },
  throughput: { requestsPerMinute: 3.5, totalRequests: 50, successfulRequests: 48, failedRequests: 2 },
  cache: {},
  retrievers: {},
  tokenUsage: {},
  meta: { windowSize: 100, updatedAt: '2024-01-01T00:00:00Z' },
  gatewayMeta: { cached: false, fetchedAt: '2024-01-01T00:00:10Z', ragEndpoint: 'http://rag/api/v1/metrics/summary' },
};

vi.mock('@/hooks/usePerformanceMetrics', () => ({
  __esModule: true,
  default: () => ({
    status: 'success',
    data: metricsSample,
    error: undefined,
    isLoading: false,
    isError: false,
    refresh: vi.fn(),
    lastUpdated: metricsSample.gatewayMeta?.fetchedAt,
  }),
}));

function defineGlobalMocks() {
  if (!(global as { ResizeObserver?: unknown }).ResizeObserver) {
    (global as { ResizeObserver?: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
}

describe('PerformanceDashboard', () => {
  it('renders metrics summary', () => {
    render(<PerformanceDashboard />);

    expect(screen.getByText('Performance Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Answer Time')).toBeInTheDocument();
    expect(screen.getByText(/Context Coverage/i)).toBeInTheDocument();
    expect(screen.getByText(/Requests \//i)).toBeInTheDocument();
  });
});

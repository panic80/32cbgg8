import { useState, useMemo, useCallback } from 'react';
import { apiClient, ApiError } from '@/api/client';
import type { DatabaseSource, DatabaseStats } from '../types';

type SourceSort = 'date' | 'count' | 'name';

const MAX_CAPACITY = 100_000;

const normaliseString = (value: string | null | undefined) => (value ?? '').toLowerCase();

const compareBy = (sortBy: SourceSort) => {
  switch (sortBy) {
    case 'name':
      return (a: DatabaseSource, b: DatabaseSource) => a.label.localeCompare(b.label);
    case 'count':
      return (a: DatabaseSource, b: DatabaseSource) => (b.chunkCount || 0) - (a.chunkCount || 0);
    case 'date':
    default:
      return (a: DatabaseSource, b: DatabaseSource) => {
        const dateA = a.lastIngestedAt ? new Date(a.lastIngestedAt).getTime() : 0;
        const dateB = b.lastIngestedAt ? new Date(b.lastIngestedAt).getTime() : 0;
        return (Number.isFinite(dateB) ? dateB : 0) - (Number.isFinite(dateA) ? dateA : 0);
      };
  }
};

const normaliseSources = (list: any[]): DatabaseSource[] =>
  list
    .filter(Boolean)
    .map((item) => ({
      id:
        item.id ??
        item.source_id ??
        `${normaliseString(item.label ?? item.title ?? item.name ?? '')}-${normaliseString(
          item.canonicalUrl ?? item.canonical_url ?? item.url ?? '',
        )}`,
      label: item.label ?? item.title ?? item.name ?? 'Untitled Source',
      canonicalUrl: item.canonicalUrl ?? item.canonical_url ?? item.url ?? null,
      chunkCount: typeof item.chunkCount === 'number' ? item.chunkCount : (item.chunk_count ?? 0),
      documentCount:
        typeof item.documentCount === 'number' ? item.documentCount : (item.document_count ?? 0),
      lastIngestedAt: item.lastIngestedAt ?? item.last_ingested_at ?? null,
      searchText:
        normaliseString(item.label ?? item.title ?? item.name ?? '') +
        normaliseString(item.canonicalUrl ?? item.canonical_url ?? item.url ?? ''),
    }))
    .filter((source) => Boolean(source.id));

const fetchDatabaseStats = async (): Promise<DatabaseStats> => {
  const empty: DatabaseStats = {
    totalDocuments: 0,
    totalChunks: 0,
    totalSources: 0,
    lastIngestedAt: null,
  };

  try {
    const data = await apiClient.getJson<any>('/api/v2/sources/stats');
    if (data) {
      return {
        totalDocuments:
          typeof data.total_documents === 'number'
            ? data.total_documents
            : (data.totalDocuments ?? 0),
        totalChunks:
          typeof data.total_chunks === 'number' ? data.total_chunks : (data.totalChunks ?? 0),
        totalSources:
          typeof data.total_sources === 'number' ? data.total_sources : (data.totalSources ?? 0),
        lastIngestedAt:
          typeof data.last_ingested_at === 'string'
            ? data.last_ingested_at
            : typeof data.lastIngestedAt === 'string'
              ? data.lastIngestedAt
              : null,
      };
    }
  } catch (error) {
    if (error instanceof ApiError) {
      console.error('Source stats error response:', {
        status: error.status,
        body: error.data,
      });
    } else {
      console.error('Source stats request failed:', error);
    }
  }

  try {
    const countData = await apiClient.getJson<any>('/api/v2/sources/count');
    const count = typeof countData.count === 'number' ? countData.count : 0;
    const totalSources =
      typeof countData.total_sources === 'number'
        ? countData.total_sources
        : typeof countData.totalSources === 'number'
          ? countData.totalSources
          : 0;

    return {
      totalDocuments: count,
      totalChunks: typeof countData.total_chunks === 'number' ? countData.total_chunks : count,
      totalSources: totalSources || count,
      lastIngestedAt: null,
    };
  } catch (error) {
    if (!(error instanceof ApiError)) {
      console.error('Source count request failed:', error);
    }
  }

  try {
    const healthData = await apiClient.getJson<any>('/health?checkRag=true');
    const vectorStore = healthData?.ragService?.components?.vector_store;
    if (vectorStore) {
      const documentCount =
        typeof vectorStore.document_count === 'number' ? vectorStore.document_count : 0;
      return {
        totalDocuments: documentCount,
        totalChunks: documentCount,
        totalSources: 0,
        lastIngestedAt: null,
      };
    }
  } catch (error) {
    if (!(error instanceof ApiError)) {
      console.error('Health endpoint request failed:', error);
    }
  }

  return empty;
};

const fetchDatabaseSources = async (): Promise<DatabaseSource[]> => {
  try {
    const payload = await apiClient.getJson<any>('/api/v2/sources?page=1&page_size=100');
    if (Array.isArray(payload?.data)) {
      return normaliseSources(payload.data);
    }

    if (Array.isArray(payload?.items)) {
      return normaliseSources(payload.items);
    }

    if (Array.isArray(payload)) {
      return normaliseSources(payload);
    }

    return [];
  } catch (error) {
    console.error('Source fetch failed:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to load sources');
  }
};

export const useDatabasePanel = (
  formatDateDisplay: (value: string | null, includeTime?: boolean) => string | null,
) => {
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [sources, setSources] = useState<DatabaseSource[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SourceSort>('date');

  const refreshMetrics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [nextStats, nextSources] = await Promise.all([
        fetchDatabaseStats(),
        fetchDatabaseSources(),
      ]);
      setStats(nextStats);
      setSources(nextSources);
    } catch (refreshError) {
      console.error('Failed to refresh database metrics', refreshError);
      setError(
        refreshError instanceof Error ? refreshError.message : 'Failed to load database metrics',
      );
      setSources([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const filteredSources = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const base = query
      ? sources.filter((source) => source.searchText.includes(query))
      : [...sources];

    return base.sort(compareBy(sortBy));
  }, [sources, searchQuery, sortBy]);

  const usagePercentage = useMemo(() => {
    if (!stats) return 0;
    return Math.min((stats.totalChunks / MAX_CAPACITY) * 100, 100);
  }, [stats]);

  const lastIngestedLabel = useMemo(
    () => formatDateDisplay(stats?.lastIngestedAt ?? null, true),
    [stats?.lastIngestedAt, formatDateDisplay],
  );

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const cycleSourceSort = useCallback(() => {
    setSortBy((current) => (current === 'date' ? 'count' : current === 'count' ? 'name' : 'date'));
  }, []);

  return {
    stats,
    sources,
    isLoading,
    error,
    searchQuery,
    sortBy,
    filteredSources,
    usagePercentage,
    lastIngestedLabel,
    setSearchQuery: handleSearchChange,
    cycleSourceSort,
    refreshMetrics,
  };
};

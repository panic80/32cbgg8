import { useState, useCallback, useMemo } from 'react';
import type { ChatLogEntry, LogFilters } from '../types';

const LOGS_PAGE_SIZE = 20;

const normaliseFilters = (filters: LogFilters): LogFilters => ({
  search: filters.search.trim(),
  startAt: filters.startAt,
  endAt: filters.endAt,
  provider: filters.provider,
  model: filters.model.trim(),
  conversationId: filters.conversationId.trim(),
  ragEnabled: filters.ragEnabled,
  shortAnswerMode: filters.shortAnswerMode,
});

const buildQueryParams = (offset: number, filters: LogFilters) => {
  const params = new URLSearchParams();
  params.set('limit', LOGS_PAGE_SIZE.toString());
  params.set('offset', Math.max(offset, 0).toString());

  if (filters.search) params.set('search', filters.search);
  if (filters.startAt) params.set('startAt', filters.startAt);
  if (filters.endAt) params.set('endAt', filters.endAt);
  if (filters.provider && filters.provider !== 'all') params.set('provider', filters.provider);
  if (filters.model) params.set('model', filters.model);
  if (filters.conversationId) params.set('conversationId', filters.conversationId);
  if (filters.ragEnabled !== 'all') params.set('ragEnabled', filters.ragEnabled);
  if (filters.shortAnswerMode !== 'all') params.set('shortAnswerMode', filters.shortAnswerMode);

  return params.toString();
};

export const useLogsPanel = (initialFilters: LogFilters) => {
  const [filters, setFilters] = useState<LogFilters>(normaliseFilters(initialFilters));
  const [logs, setLogs] = useState<ChatLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    limit: LOGS_PAGE_SIZE,
    offset: 0,
    hasMore: false,
    nextOffset: null as number | null,
  });

  const fetchLogs = useCallback(async (offset: number, overrideFilters?: LogFilters) => {
    const appliedFilters = normaliseFilters(overrideFilters ?? filters);
    const query = buildQueryParams(offset, appliedFilters);

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v2/logs?${query}`);
      if (!response.ok) {
        if (response.status === 503) {
          setLogs([]);
          setPagination((prev) => ({ ...prev, hasMore: false, nextOffset: null }));
          throw new Error('Logging is disabled on the server. Enable ENABLE_LOGGING to view analytics.');
        }
        throw new Error(`Failed to load logs (status ${response.status})`);
      }

      const body = await response.json();
      const rows: ChatLogEntry[] = Array.isArray(body?.rows) ? body.rows : [];

      setLogs(rows);
      setPagination({
        limit: LOGS_PAGE_SIZE,
        offset: Math.max(offset, 0),
        hasMore: Boolean(body?.hasMore) || rows.length === LOGS_PAGE_SIZE,
        nextOffset: rows.length === LOGS_PAGE_SIZE ? Math.max(offset, 0) + LOGS_PAGE_SIZE : null,
      });
      setFilters(appliedFilters);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load chat logs';
      setError(message);
      setLogs([]);
      setPagination((prev) => ({ ...prev, hasMore: false, nextOffset: null }));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const applyFilters = useCallback((nextFilters: LogFilters) => {
    const normalised = normaliseFilters(nextFilters);
    setFilters(normalised);
    void fetchLogs(0, normalised);
  }, [fetchLogs]);

  const resetFilters = useCallback((defaults: LogFilters) => {
    const normalised = normaliseFilters(defaults);
    setFilters(normalised);
    void fetchLogs(0, normalised);
  }, [fetchLogs]);

  const refresh = useCallback(() => {
    void fetchLogs(pagination.offset, filters);
  }, [fetchLogs, filters, pagination.offset]);

  const nextPage = useCallback(() => {
    if (!pagination.hasMore || pagination.nextOffset === null || loading) return;
    void fetchLogs(pagination.nextOffset, filters);
  }, [fetchLogs, filters, loading, pagination.hasMore, pagination.nextOffset]);

  const previousPage = useCallback(() => {
    if (loading || pagination.offset === 0) return;
    const previousOffset = Math.max(pagination.offset - LOGS_PAGE_SIZE, 0);
    void fetchLogs(previousOffset, filters);
  }, [fetchLogs, filters, loading, pagination.offset]);

  const filteredLogs = useMemo(() => logs, [logs]);

  return {
    filters,
    setFilters,
    logs: filteredLogs,
    loading,
    error,
    pagination,
    fetchLogs,
    applyFilters,
    resetFilters,
    refresh,
    nextPage,
    previousPage,
  };
};

import { useState, useEffect, useCallback } from 'react';
import { StorageKeys } from '@/constants/storage';
import { getLocalStorageJSON, removeLocalStorageItem, setLocalStorageJSON } from '@/utils/storage';
import type { IngestionHistoryEntry } from '../types';

const MAX_HISTORY_ENTRIES = 10;

export const useIngestionHistory = () => {
  const [ingestionHistory, setIngestionHistory] = useState<IngestionHistoryEntry[]>([]);

  useEffect(() => {
    const saved = getLocalStorageJSON<unknown>(StorageKeys.ingestionHistory, []);
    if (Array.isArray(saved)) {
      setIngestionHistory(saved as IngestionHistoryEntry[]);
    }
  }, []);

  const recordHistoryEntry = useCallback((entry: IngestionHistoryEntry) => {
    setIngestionHistory((previous) => {
      const next = [entry, ...previous].slice(0, MAX_HISTORY_ENTRIES);
      setLocalStorageJSON(StorageKeys.ingestionHistory, next);
      return next;
    });
  }, []);

  const clearIngestionHistory = useCallback(() => {
    setIngestionHistory([]);
    removeLocalStorageItem(StorageKeys.ingestionHistory);
  }, []);

  return {
    ingestionHistory,
    recordHistoryEntry,
    clearIngestionHistory,
  };
};

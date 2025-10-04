import { useState, useEffect, useCallback } from 'react';
import type { IngestionHistoryEntry } from '../types';

const STORAGE_KEY = 'ingestionHistory';
const MAX_HISTORY_ENTRIES = 10;

export const useIngestionHistory = () => {
  const [ingestionHistory, setIngestionHistory] = useState<IngestionHistoryEntry[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setIngestionHistory(parsed as IngestionHistoryEntry[]);
        }
      }
    } catch (error) {
      console.warn('Failed to load ingestion history from storage', error);
    }
  }, []);

  const recordHistoryEntry = useCallback((entry: IngestionHistoryEntry) => {
    setIngestionHistory((previous) => {
      const next = [entry, ...previous].slice(0, MAX_HISTORY_ENTRIES);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (error) {
        console.warn('Failed to persist ingestion history', error);
      }
      return next;
    });
  }, []);

  const clearIngestionHistory = useCallback(() => {
    setIngestionHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear ingestion history', error);
    }
  }, []);

  return {
    ingestionHistory,
    recordHistoryEntry,
    clearIngestionHistory,
  };
};

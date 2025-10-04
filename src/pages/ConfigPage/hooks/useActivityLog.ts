import { useState, useEffect, useCallback } from 'react';
import type { ActivityLogEntry } from '../types';

const STORAGE_KEY = 'databaseActivityLog';
const MAX_ACTIVITY_ENTRIES = 20;

export const useActivityLog = () => {
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setActivityLog(parsed as ActivityLogEntry[]);
        }
      }
    } catch (error) {
      console.warn('Failed to load activity log from storage', error);
    }
  }, []);

  const appendActivityLog = useCallback((action: string, details: string) => {
    const entry: ActivityLogEntry = {
      timestamp: new Date().toISOString(),
      action,
      details,
    };

    setActivityLog((previous) => {
      const next = [entry, ...previous].slice(0, MAX_ACTIVITY_ENTRIES);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (error) {
        console.warn('Failed to persist activity log', error);
      }
      return next;
    });
  }, []);

  const clearActivityLog = useCallback(() => {
    setActivityLog([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear activity log', error);
    }
  }, []);

  return {
    activityLog,
    appendActivityLog,
    clearActivityLog,
  };
};

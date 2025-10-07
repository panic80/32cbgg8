import { useState, useEffect, useCallback } from 'react';
import { StorageKeys } from '@/constants/storage';
import { getLocalStorageJSON, removeLocalStorageItem, setLocalStorageJSON } from '@/utils/storage';
import type { ActivityLogEntry } from '../types';

const MAX_ACTIVITY_ENTRIES = 20;

export const useActivityLog = () => {
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);

  useEffect(() => {
    const saved = getLocalStorageJSON<unknown>(StorageKeys.activityLog, []);
    if (Array.isArray(saved)) {
      setActivityLog(saved as ActivityLogEntry[]);
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
      setLocalStorageJSON(StorageKeys.activityLog, next);
      return next;
    });
  }, []);

  const clearActivityLog = useCallback(() => {
    setActivityLog([]);
    removeLocalStorageItem(StorageKeys.activityLog);
  }, []);

  return {
    activityLog,
    appendActivityLog,
    clearActivityLog,
  };
};

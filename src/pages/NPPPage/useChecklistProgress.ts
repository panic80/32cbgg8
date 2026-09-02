import { useCallback, useEffect, useState } from 'react';

const STORAGE_PREFIX = 'npp-progress:';

const readStored = (key: string): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
};

const writeStored = (key: string, ids: string[]) => {
  if (typeof window === 'undefined') return;
  try {
    if (ids.length === 0) window.localStorage.removeItem(STORAGE_PREFIX + key);
    else window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(ids));
  } catch {
    // Storage may be unavailable (private mode, quota); progress then lives in memory only.
  }
};

/**
 * Tracks which checklist items are complete for one section and persists them on this device,
 * so a member can leave the guide and come back to where they were.
 */
export const useChecklistProgress = (key: string) => {
  const [completed, setCompleted] = useState<Set<string>>(() => new Set(readStored(key)));

  useEffect(() => {
    setCompleted(new Set(readStored(key)));
  }, [key]);

  const setItem = useCallback(
    (id: string, checked: boolean) => {
      setCompleted((current) => {
        const next = new Set(current);
        if (checked) next.add(id);
        else next.delete(id);
        writeStored(key, [...next]);
        return next;
      });
    },
    [key],
  );

  const reset = useCallback(() => {
    writeStored(key, []);
    setCompleted(new Set());
  }, [key]);

  return { completed, setItem, reset };
};

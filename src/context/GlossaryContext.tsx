import React, { createContext, useCallback, useMemo, useRef, useState, useContext } from 'react';

export interface GlossaryTerm {
  term: string;
  expansion: string;
  description: string;
  category: string;
  variations: string[];
}

type GlossaryDataset = Record<string, GlossaryTerm[]>;

type GlossaryContextValue = {
  glossary: GlossaryDataset | null;
  glossaryLoading: boolean;
  glossaryError: string | null;
  ensureGlossary: () => Promise<void>;
  getCachedTerm: (term: string) => GlossaryTerm | null;
  lookupTerm: (term: string) => Promise<GlossaryTerm | null>;
};

const GlossaryContext = createContext<GlossaryContextValue | undefined>(undefined);

const getApiBaseUrl = () => import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export const GlossaryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [glossary, setGlossary] = useState<GlossaryDataset | null>(null);
  const [glossaryLoading, setGlossaryLoading] = useState(false);
  const [glossaryError, setGlossaryError] = useState<string | null>(null);
  const [termCache, setTermCache] = useState<Record<string, GlossaryTerm>>({});
  const failedTermsRef = useRef<Set<string>>(new Set());
  const fetchGlossaryPromiseRef = useRef<Promise<void> | null>(null);

  const normaliseKey = useCallback((term: string) => term.trim().toUpperCase(), []);

  const mergeTermsIntoCache = useCallback((dataset: GlossaryDataset) => {
    setTermCache(prev => {
      const updated = { ...prev };
      Object.values(dataset).forEach(group => {
        group.forEach(item => {
          const key = normaliseKey(item.term);
          updated[key] = item;
        });
      });
      return updated;
    });
  }, [normaliseKey]);

  const ensureGlossary = useCallback(async () => {
    if (glossary) return;
    if (fetchGlossaryPromiseRef.current) {
      await fetchGlossaryPromiseRef.current;
      return;
    }

    const fetchPromise = (async () => {
      setGlossaryLoading(true);
      setGlossaryError(null);
      try {
        const response = await fetch(`${getApiBaseUrl()}/api/v2/glossary/`);
        if (!response.ok) {
          throw new Error('Failed to fetch glossary data');
        }
        const data: GlossaryDataset = await response.json();
        setGlossary(data);
        mergeTermsIntoCache(data);
      } catch (error) {
        console.error('Error loading glossary dataset:', error);
        setGlossaryError('Failed to load glossary. Please try again later.');
      } finally {
        setGlossaryLoading(false);
        fetchGlossaryPromiseRef.current = null;
      }
    })();

    fetchGlossaryPromiseRef.current = fetchPromise;
    await fetchPromise;
  }, [glossary, mergeTermsIntoCache]);

  const getCachedTerm = useCallback((term: string) => {
    const key = normaliseKey(term);
    return termCache[key] ?? null;
  }, [normaliseKey, termCache]);

  const lookupTerm = useCallback(async (term: string) => {
    const key = normaliseKey(term);
    if (!key) return null;

    if (termCache[key]) {
      return termCache[key];
    }

    if (failedTermsRef.current.has(key)) {
      return null;
    }

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v2/glossary/term/${encodeURIComponent(term)}`);
      if (!response.ok) {
        if (response.status === 404) {
          failedTermsRef.current.add(key);
          return null;
        }
        throw new Error(`Failed to fetch glossary term: ${response.status}`);
      }

      const data: GlossaryTerm | null = await response.json();
      if (data) {
        setTermCache(prev => ({ ...prev, [key]: data }));
        return data;
      }
      return null;
    } catch (error) {
      console.error('Error fetching glossary term:', error);
      return null;
    }
  }, [normaliseKey, termCache]);

  const value = useMemo<GlossaryContextValue>(() => ({
    glossary,
    glossaryLoading,
    glossaryError,
    ensureGlossary,
    getCachedTerm,
    lookupTerm,
  }), [glossary, glossaryLoading, glossaryError, ensureGlossary, getCachedTerm, lookupTerm]);

  return (
    <GlossaryContext.Provider value={value}>
      {children}
    </GlossaryContext.Provider>
  );
};

export const useGlossary = (): GlossaryContextValue => {
  const context = useContext(GlossaryContext);
  if (!context) {
    throw new Error('useGlossary must be used within a GlossaryProvider');
  }
  return context;
};

export const useGlossaryTerm = (term: string) => {
  const { getCachedTerm, lookupTerm } = useGlossary();
  const cached = getCachedTerm(term);
  const loadTerm = useCallback(() => lookupTerm(term), [lookupTerm, term]);
  return { cached, loadTerm };
};

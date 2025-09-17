import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { GlossaryProvider, useGlossary } from '@/context/GlossaryContext';

const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <GlossaryProvider>{children}</GlossaryProvider>
);

describe('GlossaryContext', () => {
  const originalFetch = global.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('loads the glossary dataset once via ensureGlossary', async () => {
    const dataset = {
      travel: [
        {
          term: 'TD',
          expansion: 'Temporary Duty',
          description: 'Duty travel assignment',
          category: 'travel',
          variations: [],
        },
      ],
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => dataset,
    });

    const { result } = renderHook(() => useGlossary(), { wrapper });

    await act(async () => {
      await result.current.ensureGlossary();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/api/v2/glossary/');
    expect(result.current.glossary).toEqual(dataset);
    expect(result.current.getCachedTerm('TD')?.expansion).toBe('Temporary Duty');
  });

  it('fetches and caches individual terms via lookupTerm', async () => {
    const dataset = {};
    const termResponse = {
      term: 'CBI',
      expansion: 'Compensation and Benefits Instructions',
      description: 'Benefits reference',
      category: 'policy',
      variations: [],
    };

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => dataset })
      .mockResolvedValueOnce({ ok: true, json: async () => termResponse });

    const { result } = renderHook(() => useGlossary(), { wrapper });

    await act(async () => {
      await result.current.ensureGlossary();
    });

    await act(async () => {
      const term = await result.current.lookupTerm('CBI');
      expect(term?.term).toBe('CBI');
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.getCachedTerm('CBI')?.expansion).toBe(termResponse.expansion);

    await act(async () => {
      const cached = await result.current.lookupTerm('CBI');
      expect(cached?.expansion).toBe(termResponse.expansion);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('avoids refetching terms that return 404', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 404 });

    const { result } = renderHook(() => useGlossary(), { wrapper });

    await act(async () => {
      await result.current.ensureGlossary();
    });

    await act(async () => {
      const missing = await result.current.lookupTerm('UNKNOWN');
      expect(missing).toBeNull();
    });

    await act(async () => {
      const second = await result.current.lookupTerm('UNKNOWN');
      expect(second).toBeNull();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

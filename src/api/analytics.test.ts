import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchVisitSummary, sendVisitEvent } from './analytics';

// The issue references "capturePageView" and "captureEvent". In the actual codebase,
// these correspond to fetchVisitSummary and sendVisitEvent respectively.
const capturePageView = fetchVisitSummary;
const captureEvent = sendVisitEvent;

declare const global: typeof globalThis;

describe('analytics API', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('capturePageView', () => {
    it('handles error path when fetch rejects', async () => {
      const error = new Error('Network failure');
      vi.spyOn(global, 'fetch').mockRejectedValue(error);

      await expect(capturePageView()).rejects.toThrow('Network failure');
    });

    it('handles ApiError correctly', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ message: 'Custom error' }),
        headers: new Headers({ 'content-type': 'application/json' }),
        clone: function() { return this; },
      } as unknown as Response);

      await expect(capturePageView()).rejects.toThrow('Custom error');
    });
  });

  describe('captureEvent', () => {
    it('handles error path when fetch rejects', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const error = new Error('Network failure');
      vi.spyOn(global, 'fetch').mockRejectedValue(error);

      const result = await captureEvent({ path: '/' });
      expect(result).toBe(false);
      expect(console.warn).toHaveBeenCalledWith('Unable to record visit event', error);
    });
  });
});

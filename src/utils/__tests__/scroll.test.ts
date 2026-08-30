import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { forceScrollToTop, forceScrollToTopDeferred } from '../scroll';

describe('scroll utilities', () => {
  describe('forceScrollToTop', () => {
    let originalWindow: any;
    let originalDocument: any;

    beforeEach(() => {
      originalWindow = globalThis.window;
      originalDocument = globalThis.document;
      vi.clearAllMocks();
    });

    afterEach(() => {
      globalThis.window = originalWindow;
      globalThis.document = originalDocument;
      vi.unstubAllGlobals();
    });

    it('should call window.scrollTo and set pageYOffset when window is defined', () => {
      const mockScrollTo = vi.fn();

      const mockWindow = {
        scrollTo: mockScrollTo,
        pageYOffset: 100,
      };

      vi.stubGlobal('window', mockWindow);

      forceScrollToTop();

      expect(mockScrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'auto' });
      expect(mockWindow.pageYOffset).toBe(0);
    });

    it('should catch errors when window.scrollTo fails and continue to fallbacks', () => {
      const mockScrollTo = vi.fn().mockImplementation(() => {
        throw new Error('scrollTo failed');
      });

      const mockWindow = {
        scrollTo: mockScrollTo,
        pageYOffset: 100,
      };

      vi.stubGlobal('window', mockWindow);

      expect(() => forceScrollToTop()).not.toThrow();
      expect(mockScrollTo).toHaveBeenCalled();
    });

    it('should set document.documentElement.scrollTop and document.body.scrollTop when document is defined', () => {
      const mockDocument = {
        documentElement: { scrollTop: 100 },
        body: { scrollTop: 100 },
        getElementById: vi.fn().mockReturnValue(null),
        scrollingElement: null,
      };

      vi.stubGlobal('document', mockDocument);
      vi.stubGlobal('window', undefined);

      forceScrollToTop();

      expect(mockDocument.documentElement.scrollTop).toBe(0);
      expect(mockDocument.body.scrollTop).toBe(0);
    });

    it('should process candidate elements correctly', () => {
      const mockElement1 = {
        scrollTo: vi.fn(),
        scrollTop: 50,
      };

      const mockDocument = {
        documentElement: { scrollTop: 100 },
        body: { scrollTop: 100 },
        getElementById: vi.fn().mockReturnValue(mockElement1),
        scrollingElement: null,
      };

      vi.stubGlobal('document', mockDocument);
      vi.stubGlobal('window', undefined);

      forceScrollToTop();

      expect(mockElement1.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'auto' });
      expect(mockElement1.scrollTop).toBe(0);
    });

    it('should fallback to scrollTop if scrollTo throws in candidates loop', () => {
      const mockElement1 = {
        scrollTo: vi.fn().mockImplementation(() => {
          throw new Error('scrollTo failed');
        }),
        scrollTop: 50,
      };

      const mockDocument = {
        documentElement: { scrollTop: 100 },
        body: { scrollTop: 100 },
        getElementById: vi.fn().mockReturnValue(mockElement1),
        scrollingElement: null,
      };

      vi.stubGlobal('document', mockDocument);
      vi.stubGlobal('window', undefined);

      forceScrollToTop();

      expect(mockElement1.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'auto' });
      expect(mockElement1.scrollTop).toBe(0);
    });
  });

  describe('forceScrollToTopDeferred', () => {
    beforeEach(() => {
      vi.useFakeTimers();

      // We need to properly mock requestAnimationFrame and cancelAnimationFrame
      // within the window object, and globally if they are called directly
      const mockWindow = {
        requestAnimationFrame: vi.fn((cb) => {
          return setTimeout(cb, 16);
        }),
        cancelAnimationFrame: vi.fn((id) => clearTimeout(id)),
        scrollTo: vi.fn(),
      };

      vi.stubGlobal('window', mockWindow);
      vi.stubGlobal('cancelAnimationFrame', mockWindow.cancelAnimationFrame);
    });

    afterEach(() => {
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    it('should schedule multiple scroll attempts over time', () => {
      forceScrollToTopDeferred();

      // Ensure window is set properly in fake timer context
      const currentWindow = globalThis.window as any;

      // Advance to first immediate pass
      vi.advanceTimersByTime(0);
      expect(currentWindow.scrollTo).toHaveBeenCalled();

      const callsAfterImmediate = currentWindow.scrollTo.mock.calls.length;

      // Advance to 50ms pass
      vi.advanceTimersByTime(50);
      expect(currentWindow.scrollTo.mock.calls.length).toBeGreaterThan(callsAfterImmediate);

      const callsAfter50 = currentWindow.scrollTo.mock.calls.length;

      // Advance to 200ms pass
      vi.advanceTimersByTime(200);
      expect(currentWindow.scrollTo.mock.calls.length).toBeGreaterThan(callsAfter50);
    });

    it('should return a cleanup function that clears timeouts and animation frames', () => {
      const cleanup = forceScrollToTopDeferred();

      const currentWindow = globalThis.window as any;
      const initialCallCount = currentWindow.scrollTo.mock.calls.length;

      cleanup();

      vi.advanceTimersByTime(1000);

      expect(currentWindow.scrollTo.mock.calls.length).toBe(initialCallCount);
    });
  });
});

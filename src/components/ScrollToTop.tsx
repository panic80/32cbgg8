import { useEffect, useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { forceScrollToTop, forceScrollToTopDeferred } from '@/utils/scroll';

const restoreHashTarget = (hash: string): void => {
  if (!hash || typeof document === 'undefined') return;

  const target = document.getElementById(hash.slice(1));
  target?.scrollIntoView({ behavior: 'auto', block: 'start' });
};

export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  // Ensure browser doesn't restore scroll automatically between navigations
  useEffect(() => {
    try {
      if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'manual';
      }
    } catch {}
  }, []);

  // Immediate scroll reset before paint
  useLayoutEffect(() => {
    if (hash) {
      restoreHashTarget(hash);
      return;
    }

    forceScrollToTop();
  }, [pathname, hash]);

  // Additional deferred scroll attempts for content-heavy pages
  useEffect(() => {
    const scrollAction = hash ? () => restoreHashTarget(hash) : forceScrollToTop;
    const cleanup = forceScrollToTopDeferred(scrollAction);

    // Extra scroll attempt for pages that might have delayed content loading
    const extraDelay = setTimeout(scrollAction, 200);

    return () => {
      cleanup();
      clearTimeout(extraDelay);
    };
  }, [pathname, hash]);

  return null;
}

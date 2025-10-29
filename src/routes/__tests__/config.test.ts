import { describe, expect, it } from 'vitest';
import { appRoutes, isLazyRoute } from '../config';

describe('appRoutes configuration', () => {
  it('includes chat route with theme-aware props and prefetch hint', () => {
    const chatRoute = appRoutes.find((route) => route.path === '/chat');
    expect(chatRoute).toBeDefined();
    expect(isLazyRoute(chatRoute!)).toBe(true);

    if (isLazyRoute(chatRoute!)) {
      expect(chatRoute.prefetch).toBe(true);
      expect(typeof chatRoute.loader).toBe('function');
      expect(typeof chatRoute.getProps).toBe('function');

      const context = { theme: 'light', toggleTheme: () => {} };
      expect(chatRoute.getProps?.(context)).toMatchObject({
        theme: 'light',
      });
    }
  });

  it('flags only lazy routes for prefetching', () => {
    const lazyRoutesWithPrefetch = appRoutes.filter(
      (route) => isLazyRoute(route) && route.prefetch,
    );
    const nonLazyRoutesWithPrefetch = appRoutes.filter(
      (route) => !isLazyRoute(route) && 'prefetch' in route,
    );

    expect(lazyRoutesWithPrefetch.length).toBeGreaterThanOrEqual(1);
    expect(nonLazyRoutesWithPrefetch.length).toBe(0);
  });

  it('provides JSX elements for static coming soon routes', () => {
    const staticRoute = appRoutes.find((route) => route.path === '/coming-soon-1');
    expect(staticRoute).toBeDefined();
    expect(isLazyRoute(staticRoute!)).toBe(false);

    if (!isLazyRoute(staticRoute!)) {
      expect(staticRoute.element).toBeTruthy();
    }
  });
});

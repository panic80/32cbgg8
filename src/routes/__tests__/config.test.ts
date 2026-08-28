import { describe, expect, it } from 'vitest';
import { appRoutes, isLazyRoute } from '../config';

describe('appRoutes configuration', () => {
  it('keeps retired chat routes as static unavailable pages', () => {
    const chatRoute = appRoutes.find((route) => route.path === '/chat');
    const chatConfigRoute = appRoutes.find((route) => route.path === '/chat/config');

    expect(chatRoute).toBeDefined();
    expect(chatConfigRoute).toBeDefined();
    expect(isLazyRoute(chatRoute!)).toBe(false);
    expect(isLazyRoute(chatConfigRoute!)).toBe(false);

    if (!isLazyRoute(chatRoute!) && !isLazyRoute(chatConfigRoute!)) {
      expect(chatRoute.element).toBeTruthy();
      expect(chatConfigRoute.element).toBeTruthy();
    }
  });

  it('keeps the OPI route disabled as a static unavailable page', () => {
    const opiRoute = appRoutes.find((route) => route.path === '/opi');

    expect(opiRoute).toBeDefined();
    expect(isLazyRoute(opiRoute!)).toBe(false);

    if (!isLazyRoute(opiRoute!)) {
      expect(opiRoute.element).toBeTruthy();
    }
  });

  it('does not attach prefetch metadata to static routes', () => {
    const nonLazyRoutesWithPrefetch = appRoutes.filter(
      (route) => !isLazyRoute(route) && 'prefetch' in route,
    );

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

  it('registers NPP as a lazy route without an NPF alias', () => {
    const nppRoute = appRoutes.find((route) => route.path === '/npp');

    expect(nppRoute).toBeDefined();
    expect(isLazyRoute(nppRoute!)).toBe(true);
    expect(appRoutes.some((route) => route.path === '/npf')).toBe(false);

    if (isLazyRoute(nppRoute!)) {
      expect(nppRoute.component).toBeDefined();
      expect(nppRoute.loader).toBeDefined();
    }
  });
});

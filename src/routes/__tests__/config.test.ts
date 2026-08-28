import { describe, expect, it } from 'vitest';
import { appRoutes, isLazyRoute } from '../config';

const getRoute = (path: string) => {
  const route = appRoutes.find((candidate) => candidate.path === path);

  expect(route).toBeDefined();
  if (!route) throw new Error(`Expected route ${path} to be registered.`);

  return route;
};

describe('appRoutes configuration', () => {
  it.each(['/opi', '/chat', '/chat/config', '/config'])(
    'keeps the current-main %s route lazy with a loader',
    (path) => {
      const route = getRoute(path);

      expect(isLazyRoute(route)).toBe(true);
      if (isLazyRoute(route)) {
        expect(typeof route.loader).toBe('function');
        expect(route.component).toBeDefined();
      }
    },
  );

  it('does not add prefetch to non-lazy routes', () => {
    const nonLazyRoutesWithPrefetch = appRoutes.filter(
      (route) => !isLazyRoute(route) && 'prefetch' in route,
    );

    expect(nonLazyRoutesWithPrefetch).toHaveLength(0);
  });

  it('registers NPP as a lazy public route without an NPF alias', () => {
    const nppRoute = getRoute('/npp');

    expect(isLazyRoute(nppRoute)).toBe(true);
    expect(appRoutes.some((route) => route.path === '/npf')).toBe(false);

    if (isLazyRoute(nppRoute)) {
      expect(nppRoute.component).toBeDefined();
      expect(typeof nppRoute.loader).toBe('function');
    }
  });
});

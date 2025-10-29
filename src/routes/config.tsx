import { lazy } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';
import type { ThemeMode } from '@/utils/theme';

type RouteLoader<T extends ComponentType<any> = ComponentType<any>> = () => Promise<{
  default: T;
}>;

export interface RouteContext {
  theme: ThemeMode;
  toggleTheme: () => void;
}

export interface LazyRouteDefinition<TProps extends Record<string, unknown> = Record<string, unknown>> {
  kind: 'lazy';
  path: string;
  component: LazyExoticComponent<ComponentType<TProps>>;
  loader: RouteLoader<ComponentType<TProps>>;
  prefetch?: boolean;
  getProps?: (context: RouteContext) => TProps;
}

export interface ElementRouteDefinition {
  kind: 'element';
  path: string;
  element: JSX.Element;
}

export type AppRouteDefinition = LazyRouteDefinition | ElementRouteDefinition;

const createComingSoonElement = (message: string) => (
  <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{message}</h1>
  </div>
);

const loadLandingPage = () => import('@/pages/LandingPage');
const loadOpiPage = () => import('@/pages/OPIPage');
const loadOpiPageTest = () => import('@/pages/OPIPageTest');
const loadAdminToolsPage = () => import('@/pages/AdminToolsPage');
const loadChatPage = () => import('@/pages/ChatPage');
const loadConfigPage = () => import('@/pages/ConfigPage');
const loadPrivacyPage = () => import('@/pages/PrivacyPage');
const loadFaqPage = () => import('@/pages/FAQPage');
const loadLoadingDebugPage = () => import('@/pages/LoadingDebugPage');
const loadUiShowcase = () => import('@/components/UIShowcase');
const loadPerformanceDashboard = () => import('@/pages/PerformanceDashboard');

export const appRoutes: AppRouteDefinition[] = [
  {
    kind: 'lazy',
    path: '/',
    component: lazy(loadLandingPage),
    loader: loadLandingPage,
  },
  {
    kind: 'lazy',
    path: '/opi',
    component: lazy(loadOpiPage),
    loader: loadOpiPage,
  },
  {
    kind: 'lazy',
    path: '/opi-test',
    component: lazy(loadOpiPageTest),
    loader: loadOpiPageTest,
  },
  {
    kind: 'lazy',
    path: '/admin-tools',
    component: lazy(loadAdminToolsPage),
    loader: loadAdminToolsPage,
  },
  {
    kind: 'lazy',
    path: '/chat',
    component: lazy(loadChatPage),
    loader: loadChatPage,
    prefetch: true,
    getProps: ({ theme, toggleTheme }) => ({ theme, toggleTheme }),
  },
  {
    kind: 'lazy',
    path: '/chat/config',
    component: lazy(loadConfigPage),
    loader: loadConfigPage,
  },
  {
    kind: 'lazy',
    path: '/privacy',
    component: lazy(loadPrivacyPage),
    loader: loadPrivacyPage,
  },
  {
    kind: 'lazy',
    path: '/home-v2',
    component: lazy(loadLandingPage),
    loader: loadLandingPage,
  },
  {
    kind: 'lazy',
    path: '/landing-test',
    component: lazy(loadLandingPage),
    loader: loadLandingPage,
  },
  {
    kind: 'lazy',
    path: '/faq',
    component: lazy(loadFaqPage),
    loader: loadFaqPage,
  },
  {
    kind: 'element',
    path: '/coming-soon-1',
    element: createComingSoonElement('Coming Soon'),
  },
  {
    kind: 'element',
    path: '/coming-soon-2',
    element: createComingSoonElement('Coming Soon'),
  },
  {
    kind: 'lazy',
    path: '/loading-debug',
    component: lazy(loadLoadingDebugPage),
    loader: loadLoadingDebugPage,
  },
  {
    kind: 'lazy',
    path: '/ui-showcase',
    component: lazy(loadUiShowcase),
    loader: loadUiShowcase,
  },
  {
    kind: 'lazy',
    path: '/admin/performance',
    component: lazy(loadPerformanceDashboard),
    loader: loadPerformanceDashboard,
  },
];

export const isLazyRoute = (route: AppRouteDefinition): route is LazyRouteDefinition =>
  route.kind === 'lazy';

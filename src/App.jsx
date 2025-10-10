import React, { lazy, Suspense, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import './index.css';
import { useTheme } from '@/context/ThemeContext';
import ScrollToTop from '@/components/ScrollToTop';
import useRoutePrefetch from '@/hooks/useRoutePrefetch';
import useMobileFlag from '@/hooks/useMobileFlag';
import useVisitAnalytics from '@/hooks/useVisitAnalytics';

function VisitAnalyticsListener() {
  useVisitAnalytics();
  return null;
}

// Lazy load components
const FAQPage = lazy(() => import('@/pages/FAQPage'));
const LandingPage = lazy(() => import('@/pages/LandingPage.jsx'));
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage'));
const ChatPage = lazy(() => import('@/pages/ChatPage'));
const LoadingDebugPage = lazy(() => import('@/pages/LoadingDebugPage'));
const OPIPage = lazy(() => import('@/pages/OPIPage'));
const OPIPageTest = lazy(() => import('@/pages/OPIPageTest'));
const AdminToolsPage = lazy(() => import('@/pages/AdminToolsPage'));
const ConfigPage = lazy(() => import('@/pages/ConfigPage'));
const UIShowcase = lazy(() => import('@/components/UIShowcase'));
const LandingPageV2 = lazy(() => import('@/pages/LandingPageV2.jsx'));
const LandingPageTest = lazy(() => import('@/pages/LandingPageTest.jsx'));
const PerformanceDashboard = lazy(() => import('@/pages/PerformanceDashboard'));


import RouteSkeleton from '@/components/RouteSkeleton';

function App() {
  // Use global theme context
  const { theme, toggleTheme } = useTheme();
  const prefetchTargets = useMemo(() => [() => import('@/pages/ChatPage')], []);

  useRoutePrefetch(prefetchTargets);
  useMobileFlag();

  return (
    <Router>
      <VisitAnalyticsListener />
      <ScrollToTop />
      <div
        id="app-scroll-root"
        className="w-screen min-h-screen overflow-x-hidden overflow-y-auto m-0 p-0 max-w-[100vw]"
      >
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: theme === 'dark' ? '#1f2937' : '#ffffff',
              color: theme === 'dark' ? '#f3f4f6' : '#111827',
              border: theme === 'dark' ? '1px solid #374151' : '1px solid #e5e7eb',
            },
          }}
        />
        <Suspense fallback={<RouteSkeleton />}>
          <Routes>
            <Route path="/" element={<LandingPageTest />} />
            <Route path="/opi" element={<OPIPage />} />
            <Route path="/opi-test" element={<OPIPageTest />} />
            <Route path="/admin-tools" element={<AdminToolsPage />} />
            <Route path="/chat" element={<ChatPage theme={theme} toggleTheme={toggleTheme} />} />
            <Route path="/chat/config" element={<ConfigPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/home-v2" element={<LandingPageV2 />} />
            <Route path="/landing-test" element={<LandingPage />} />
            <Route path="/faq" element={<FAQPage />} />
            <Route
              path="/coming-soon-1"
              element={
                <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Coming Soon</h1>
                </div>
              }
            />
            <Route
              path="/coming-soon-2"
              element={
                <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Coming Soon</h1>
                </div>
              }
            />
            <Route path="/loading-debug" element={<LoadingDebugPage />} />
            <Route path="/ui-showcase" element={<UIShowcase />} />
            <Route path="/admin/performance" element={<PerformanceDashboard />} />
          </Routes>
          {/* MobileNavBar removed per request */}
        </Suspense>
      </div>
    </Router>
  );
}

export default App;

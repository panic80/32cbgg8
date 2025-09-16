import React, { useState, useEffect, lazy, Suspense, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import './index.css';
import { useTheme } from './context/ThemeContext';
import ScrollToTop from './components/ScrollToTop';

// Lazy load components
const Hero = lazy(() => import('./components/Hero'));
const ThemeToggle = lazy(() => import('./components/ThemeToggle'));
const FAQPage = lazy(() => import('./pages/FAQPage'));
const LandingPage = lazy(() => import('./pages/LandingPage.jsx'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const LoadingDebugPage = lazy(() => import('./pages/LoadingDebugPage'));
const OPIPage = lazy(() => import('./pages/OPIPage'));
const AdminToolsPage = lazy(() => import('./pages/AdminToolsPage'));
const ConfigPage = lazy(() => import('./pages/ConfigPage'));
const UIShowcase = lazy(() => import('./components/UIShowcase'));
const LandingPageV2 = lazy(() => import('./pages/LandingPageV2.jsx'));
import RouteSkeleton from './components/RouteSkeleton'

// Prefetch components
const prefetchComponent = (importFn) => {
  // Prefer idle time and avoid prefetch on slow connections or when Save-Data is enabled
  const conn = typeof navigator !== 'undefined'
    ? (navigator.connection || navigator.mozConnection || navigator.webkitConnection)
    : undefined;
  const saveData = conn && 'saveData' in conn ? conn.saveData : false;
  const isSlow = conn && conn.effectiveType ? /2g/.test(conn.effectiveType) : false;
  if (saveData || isSlow) return () => {};

  let cancelled = false;
  const run = () => { if (!cancelled) importFn().catch(() => {}); };
  const idle = typeof window !== 'undefined' && 'requestIdleCallback' in window ? window.requestIdleCallback.bind(window) : null;
  const idleId = idle ? idle(run, { timeout: 1500 }) : window.setTimeout(run, 0);
  return () => {
    cancelled = true;
    if (idle && idleId && 'cancelIdleCallback' in window) window.cancelIdleCallback(idleId);
    else clearTimeout(idleId);
  };
};

function App() {
  // Use global theme context
  const { theme, toggleTheme } = useTheme();
  // Local UI state
  const [state, setState] = useState({
    input: '',
    sidebarCollapsed: false,
    isMobile: false,
    isLoading: false,
    isTyping: false,
    typingTimeout: null,
    isFirstInteraction: true,
    isSimplified: false,
    model: 'models/gemini-2.0-flash-001'
  });


  // Prefetch components on mount
  const prefetchCleanupRef = useRef(null);
  const prefetchTriggeredRef = useRef(false);

  useEffect(() => {
    const startPrefetch = () => {
      if (prefetchTriggeredRef.current) return;
      prefetchTriggeredRef.current = true;
      prefetchCleanupRef.current = [
        prefetchComponent(() => import('./components/Hero')),
        prefetchComponent(() => import('./pages/ChatPage')),
        prefetchComponent(() => import('./components/MobileToggle'))
      ];
    };

    const interactionEvents = ['pointerdown', 'keydown'];
    interactionEvents.forEach(event => {
      document.addEventListener(event, startPrefetch, { once: true });
    });

    return () => {
      interactionEvents.forEach(event => {
        document.removeEventListener(event, startPrefetch);
      });
      if (prefetchCleanupRef.current) {
        prefetchCleanupRef.current.forEach(cleanup => cleanup());
        prefetchCleanupRef.current = null;
      }
    };
  }, []);


  // Theme updates are handled by ThemeProvider

  // Mobile updates only
  useEffect(() => {
    
    
    const root = document.documentElement;
    root.setAttribute('data-mobile', state.manualMobileToggle || state.isMobile);
  }, [state.manualMobileToggle, state.isMobile]);

  // Resize handler with debounce
  useEffect(() => {
    let resizeTimeout;
    const handleResize = () => {
      
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const newIsMobile = window.innerWidth <= 768;
        
        setState(prev => ({ ...prev, isMobile: newIsMobile }));
      }, 150);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, []);

  return (
    <Router>
      <ScrollToTop />
      <div id="app-scroll-root" className="w-screen min-h-screen overflow-x-hidden overflow-y-auto m-0 p-0 max-w-[100vw]">
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
        <Suspense fallback={<RouteSkeleton /> }>
          <Routes>
            <Route path="/" element={
              <Suspense fallback={<RouteSkeleton /> }>
                <LandingPage />
              </Suspense>
            } />
            <Route path="/opi" element={
              <Suspense fallback={<RouteSkeleton /> }>
                <OPIPage />
              </Suspense>
            } />
            <Route path="/admin-tools" element={
              <Suspense fallback={<RouteSkeleton /> }>
                <AdminToolsPage />
              </Suspense>
            } />
            <Route
              path="/chat"
              element={
                <Suspense fallback={<RouteSkeleton /> }>
                  <ChatPage theme={theme} toggleTheme={toggleTheme} />
                </Suspense>
              }
            />
            <Route path="/chat/config" element={
              <Suspense fallback={<RouteSkeleton /> }>
                <ConfigPage />
              </Suspense>
            } />
            <Route path="/privacy" element={
                          <Suspense fallback={<RouteSkeleton /> }>
                            <PrivacyPage />
                          </Suspense>
                        } />
            <Route path="/home-v2" element={
              <Suspense fallback={<RouteSkeleton /> }>
                <LandingPageV2 />
              </Suspense>
            } />
            <Route path="/faq" element={
              <Suspense fallback={<RouteSkeleton /> }>
                <FAQPage />
              </Suspense>
            } />
            <Route path="/coming-soon-1" element={
              <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Coming Soon</h1>
              </div>
            } />
            <Route path="/coming-soon-2" element={
              <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Coming Soon</h1>
              </div>
            } />
            <Route path="/loading-debug" element={
              <Suspense fallback={<RouteSkeleton /> }>
                <LoadingDebugPage />
              </Suspense>
            } />
            <Route path="/ui-showcase" element={
              <Suspense fallback={<RouteSkeleton /> }>
                <UIShowcase />
              </Suspense>
            } />
          </Routes>
          {/* MobileNavBar removed per request */}
        </Suspense>
      </div>
    </Router>
  );
}

export default App;

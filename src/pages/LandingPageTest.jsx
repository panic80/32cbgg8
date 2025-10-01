import React, { useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CircleHelp,
  FileText,
  Users,
  Info,
  Mail,
  ShieldCheck,
  ChevronDown,
  Crown,
  BookOpen,
  Send,
  Sparkles,
  Zap,
  ExternalLink
} from 'lucide-react';
import LogoImage from '../components/LogoImage';
import '../styles/landing-test.css';
import { SITE_CONFIG, getCopyrightText, getLastUpdatedText } from '../constants/siteConfig';
import { useTheme } from '../context/ThemeContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';

export default function LandingPageTest() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [query, setQuery] = useState('');
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showSCIPConfirmation, setShowSCIPConfirmation] = useState(false);
  const [isLinkCopied, setIsLinkCopied] = useState(false);
  const [isNavigatingToSCIP, setIsNavigatingToSCIP] = useState(false);
  const [showPrivacyScrollIndicator, setShowPrivacyScrollIndicator] = useState(true);
  const [showAboutScrollIndicator, setShowAboutScrollIndicator] = useState(true);

  const spotlightRef = useRef(null);
  const heroRef = useRef(null);

  // Spotlight effect
  const handleMouseMove = useCallback((e) => {
    if (!spotlightRef.current || !heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    spotlightRef.current.style.left = `${x - 300}px`;
    spotlightRef.current.style.top = `${y - 300}px`;
  }, []);

  // Quick ask submit
  const handleAskSubmit = (e) => {
    e.preventDefault();
    const q = (query || '').trim();
    navigate(q.length === 0 ? '/chat' : `/chat?q=${encodeURIComponent(q)}`);
  };

  // SCIP handlers
  const handleSCIPClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowSCIPConfirmation(true);
  };

  const confirmSCIPNavigation = () => {
    if (isNavigatingToSCIP) return;
    setIsNavigatingToSCIP(true);
    setShowSCIPConfirmation(false);
    setIsLinkCopied(false);
    window.location.assign(SITE_CONFIG.SCIP_PORTAL_URL);
  };

  const copySCIPLink = () => {
    navigator.clipboard.writeText(SITE_CONFIG.SCIP_PORTAL_URL).then(() => {
      setIsLinkCopied(true);
    }).catch(err => {
      console.error('Failed to copy link:', err);
    });
  };

  const handleScroll = (e, setShowIndicator) => {
    const element = e.target;
    const isAtBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 10;
    setShowIndicator(!isAtBottom);
  };

  return (
    <div className="lpt-root">
      {/* Animated Background */}
      <div className="lpt-bg-gradient" aria-hidden="true" />

      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="lpt-theme-toggle"
        aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      >
        {theme === 'light' ? (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 14.12A7.78 7.78 0 019.88 4a7.78 7.78 0 002.9 15.1 7.78 7.78 0 007.22-5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
            <path d="M12 2v2m0 16v2M2 12h2m16 0h2m-3-7l-1.5 1.5M4.93 4.93l1.5 1.5m11.14 11.14l1.5 1.5M4.93 19.07l1.5-1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {/* Main Content */}
      <div className="lpt-content">
        {/* Hero Section */}
        <section
          ref={heroRef}
          className="lpt-hero"
          onMouseMove={handleMouseMove}
          aria-labelledby="lpt-hero-title"
        >
          <div className="lpt-spotlight" ref={spotlightRef} aria-hidden="true" />

          <div className="lpt-hero-content">
            {/* Logo */}
            <div className="lpt-logo-wrapper">
              <LogoImage size="xl" />
            </div>

            {/* Title */}
            <h1 id="lpt-hero-title" className="lpt-title">
              32 CBG G8<br />Administration Hub
            </h1>

            <p className="lpt-subtitle">
              Streamlined Military Administration Portal
            </p>

            <p className="lpt-description">
              Your comprehensive digital gateway to administrative resources, claims processing, and policy information.
              Designed to simplify and expedite your financial administrative tasks.
            </p>

            {/* Quick Ask */}
            <div className="lpt-quick-ask">
              <form onSubmit={handleAskSubmit} className="lpt-ask-form">
                <input
                  type="text"
                  className="lpt-ask-input"
                  placeholder="Ask a policy question..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Ask a policy question"
                />
                <button type="submit" className="lpt-ask-button">
                  <span>Ask Now</span>
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>

            {/* Scroll Indicator */}
            <div className="lpt-scroll-indicator" aria-hidden="true">
              <ChevronDown className="w-8 h-8 text-[var(--text-secondary)]" />
            </div>
          </div>
        </section>

        {/* Bento Grid Section */}
        <section className="lpt-bento-section" aria-label="Features and Tools">
          <h2 className="lpt-section-title">Essential Tools & Resources</h2>

          <div className="lpt-bento-grid">
            {/* Policy Assistant - Large Featured Card */}
            <Link
              to="/chat"
              className="lpt-bento-card lpt-bento-large"
              aria-label="Policy Assistant - AI-powered guidance"
            >
              <div>
                <CircleHelp className="lpt-card-icon" aria-hidden="true" />
                <h3 className="lpt-card-title">
                  Policy Assistant
                  <Crown className="w-5 h-5 text-yellow-500" aria-hidden="true" />
                </h3>
                <p className="lpt-card-description">
                  Interactive AI-powered guide for policy inquiries and administrative procedures.
                  Get instant answers to your questions about CFTDTI, NJC, CBI, and FAM policies.
                </p>
              </div>
              <div>
                <Badge className="lpt-card-badge">Featured</Badge>
                <p className="lpt-card-note">Currently serving CFTDTI, NJC, CBI and FAM</p>
              </div>
            </Link>

            {/* SCIP Portal */}
            <Link
              to="#"
              onClick={handleSCIPClick}
              className="lpt-bento-card lpt-bento-wide"
              aria-label="SCIP Portal - Claims submission"
            >
              <div>
                <FileText className="lpt-card-icon" aria-hidden="true" />
                <h3 className="lpt-card-title">
                  SCIP Portal
                  <ExternalLink className="w-4 h-4" aria-hidden="true" />
                </h3>
                <p className="lpt-card-description">
                  Streamlined Claims Interface Platform for efficient digital submission and processing of administrative claims.
                </p>
              </div>
              <div>
                <Badge className="lpt-card-badge">External</Badge>
              </div>
            </Link>

            {/* OPI Contact */}
            <Link
              to="/opi"
              className="lpt-bento-card lpt-bento-tall"
              aria-label="Office of Primary Interest - Contact directory"
            >
              <div>
                <Users className="lpt-card-icon" aria-hidden="true" />
                <h3 className="lpt-card-title">Office of Primary Interest</h3>
                <p className="lpt-card-description">
                  Find FSC & FMC contact information for your unit's financial services and management.
                </p>
              </div>
            </Link>

            {/* Resource Library - Coming Soon */}
            <div
              className="lpt-bento-card"
              style={{ opacity: 0.6, cursor: 'not-allowed' }}
              aria-label="Resource Library - Under update"
            >
              <div>
                <BookOpen className="lpt-card-icon" aria-hidden="true" />
                <h3 className="lpt-card-title">Resource Library</h3>
                <p className="lpt-card-description">
                  Access SOPs, how-to guides, FAQs, templates, and comprehensive administrative documentation.
                </p>
              </div>
              <div>
                <Badge className="lpt-card-badge" style={{ background: 'var(--text-secondary)' }}>
                  Under Update
                </Badge>
              </div>
            </div>

            {/* Quick Links */}
            <div className="lpt-bento-card">
              <div>
                <Sparkles className="lpt-card-icon" aria-hidden="true" />
                <h3 className="lpt-card-title">Quick Links</h3>
                <div className="flex flex-col gap-2">
                  <a
                    href={SITE_CONFIG.CFTDTI_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[var(--primary)] hover:underline flex items-center gap-1"
                  >
                    CFTDTI <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href={SITE_CONFIG.NJC_TRAVEL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[var(--primary)] hover:underline flex items-center gap-1"
                  >
                    NJC Travel <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>

            {/* Performance Metrics */}
            <Link
              to="/admin/performance"
              className="lpt-bento-card"
              aria-label="Performance metrics dashboard"
            >
              <div>
                <Zap className="lpt-card-icon" aria-hidden="true" />
                <h3 className="lpt-card-title">Performance Metrics</h3>
                <p className="lpt-card-description">
                  View detailed analytics and performance metrics for the RAG service.
                </p>
              </div>
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="lpt-footer" role="contentinfo">
          <div className="lpt-footer-content">
            <div className="lpt-footer-links">
              <button
                type="button"
                onClick={() => setShowAboutModal(true)}
                className="lpt-footer-link"
              >
                <Info className="w-4 h-4" aria-hidden="true" />
                <span>About</span>
              </button>
              <a
                href={`mailto:${SITE_CONFIG.CONTACT_EMAIL}?subject=Contacting%20from%20G8%20homepage`}
                className="lpt-footer-link"
              >
                <Mail className="w-4 h-4" aria-hidden="true" />
                <span>Contact</span>
              </a>
              <button
                type="button"
                onClick={() => setShowPrivacyModal(true)}
                className="lpt-footer-link"
              >
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                <span>Privacy Policy</span>
              </button>
            </div>

            <div className="lpt-footer-meta">
              <p>{getCopyrightText()}</p>
              <p>{getLastUpdatedText()}</p>
              <p style={{ marginTop: '0.5rem' }}>
                Unofficial site. Not affiliated with DND or CAF. Use at your discretion.
              </p>
            </div>
          </div>
        </footer>
      </div>

      {/* Privacy Modal */}
      <Dialog open={showPrivacyModal} onOpenChange={setShowPrivacyModal}>
        <DialogContent className="max-w-[32rem] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Privacy Policy</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <div
              className="space-y-4 sm:space-y-6 overflow-y-auto max-h-[60vh] pr-2"
              onScroll={(e) => handleScroll(e, setShowPrivacyScrollIndicator)}
            >
              <h3 className="text-base sm:text-lg font-semibold">General Privacy Notice</h3>
              <p className="text-sm sm:text-base text-[var(--text)] leading-relaxed">
                We prioritize the protection of your personal information and are committed to maintaining your trust.
              </p>
              <h3 className="text-base sm:text-lg font-semibold mt-4 sm:mt-6">Data Collection & Usage</h3>
              <ul className="list-disc pl-5 space-y-2 text-sm sm:text-base text-[var(--text)] opacity-80">
                <li>We collect only essential information needed for the service</li>
                <li>Your data is encrypted and stored securely</li>
                <li>We do not sell or share your personal information</li>
                <li>You have control over your data and can request its deletion</li>
              </ul>
              <h3 className="text-base sm:text-lg font-semibold mt-4 sm:mt-6">AI Processing (OpenAI)</h3>
              <p className="text-sm sm:text-base text-[var(--text)] leading-relaxed">
                This application uses OpenAI's GPT models. When you interact with our AI features:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-sm sm:text-base text-[var(--text)] opacity-80">
                <li>Your conversations may be processed to improve responses</li>
                <li>No personally identifiable information is retained by the AI</li>
                <li>Conversations are not used to train the core AI model</li>
                <li>You can opt out of AI features at any time</li>
              </ul>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-4 sm:mt-6">
                For more details about OpenAI's data handling, please visit OpenAI's privacy policy at https://openai.com/policies/privacy-policy.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setShowPrivacyModal(false)}
                  className="w-full px-4 py-2 sm:py-3 text-center text-sm sm:text-base text-[var(--text)] bg-[var(--card)] hover:bg-[var(--primary)] hover:text-white rounded-lg transition-colors duration-300 h-10 sm:h-12"
                >
                  Close
                </button>
              </div>
            </div>
            {showPrivacyScrollIndicator && (
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[var(--background)] to-transparent pointer-events-none flex items-end justify-center pb-2">
                <ChevronDown className="w-5 h-5 text-[var(--primary)] animate-bounce" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* About Modal */}
      <Dialog open={showAboutModal} onOpenChange={setShowAboutModal}>
        <DialogContent className="max-w-lg max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>About This Page</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <div
              className="overflow-y-auto max-h-[60vh] pr-2"
              onScroll={(e) => handleScroll(e, setShowAboutScrollIndicator)}
            >
              <h3 className="text-base sm:text-lg font-semibold mb-2 text-[var(--primary)]">
                32 CBG G8 Admin Hub
              </h3>
              <p className="mb-3 sm:mb-4 text-sm sm:text-base">
                A comprehensive digital platform designed to streamline administrative processes for Canadian Armed Forces personnel,
                with a focus on travel claims, policy guidance, and financial services.
              </p>
              <h3 className="text-base sm:text-lg font-semibold mb-2">Key Features</h3>
              <ul className="list-disc list-inside mb-3 sm:mb-4 text-sm sm:text-base space-y-1">
                <li><strong className="text-[var(--primary)]">Policy Assistant</strong> – AI-powered chatbot providing instant guidance on CFTDTI policies, travel claims, and administrative procedures</li>
                <li><strong className="text-[var(--primary)]">SCIP Portal</strong> – Direct access to the Streamlined Claims Interface Platform for digital claim submission</li>
                <li><strong className="text-[var(--primary)]">OPI Contacts</strong> – Comprehensive directory of Financial Services (FSC) and Financial Management (FMC) personnel across 32 CBG units</li>
                <li><strong className="text-[var(--primary)]">Administrative Tools</strong> – SOPs, onboarding guides, and essential resources for efficient unit administration</li>
              </ul>
              <h3 className="text-base sm:text-lg font-semibold mb-2">Built for Efficiency</h3>
              <p className="mb-3 sm:mb-4 text-sm sm:text-base">
                This portal consolidates multiple resources into a single, user-friendly interface, reducing the time spent searching for
                information and ensuring consistent access to up-to-date policies and contacts.
              </p>
              <h3 className="text-base sm:text-lg font-semibold mb-2">Disclaimer</h3>
              <p className="mb-3 sm:mb-4 text-sm sm:text-base text-[var(--text-secondary)]">
                This is an unofficial site not affiliated with DND, CAF, or any government department. Information provided is for reference only.
                Always verify critical information through official channels.
              </p>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
                Not supported by the Defence Wide Area Network (DWAN). Use at your own discretion.
              </p>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-4 pt-4 border-t border-[var(--border)]">
                Maintained by the 32 CBG G8 Team
              </p>
              <div className="pt-4">
                <button
                  onClick={() => setShowAboutModal(false)}
                  className="w-full px-4 py-2 sm:py-3 text-center text-sm sm:text-base text-[var(--text)] bg-[var(--card)] hover:bg-[var(--primary)] hover:text-white rounded-lg transition-colors duration-300 h-10 sm:h-12"
                >
                  Close
                </button>
              </div>
            </div>
            {showAboutScrollIndicator && (
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[var(--background)] to-transparent pointer-events-none flex items-end justify-center pb-2">
                <ChevronDown className="w-5 h-5 text-[var(--primary)] animate-bounce" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* SCIP Confirmation Modal */}
      <Dialog open={showSCIPConfirmation} onOpenChange={(open) => { setShowSCIPConfirmation(open); if (!open) setIsLinkCopied(false); }}>
        <DialogContent className="w-[92vw] sm:max-w-lg md:max-w-xl lg:max-w-2xl break-words">
          <DialogHeader>
            <DialogTitle>SCIP Portal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm sm:text-base break-words">
              You are about to navigate to the SCIP Portal, which is an external Microsoft PowerApps platform.
              Have your D365 login (@ecn.forces.gc.ca) ready.
            </p>
            <p className="text-sm sm:text-base text-[var(--text-secondary)] break-words">
              This will open in a new tab. Do you want to continue?
            </p>
            <div className="mb-2 p-3 bg-[var(--background-secondary)] rounded-lg border border-[var(--border)] w-full">
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] mb-3">
                If the portal does not open, please copy the URL below and paste it directly into your browser:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-2 items-center">
                <div className="min-w-0 w-full p-2 bg-[var(--background)] rounded text-xs font-mono text-[var(--text-secondary)] overflow-hidden">
                  <div className="block truncate max-w-full">
                    {SITE_CONFIG.SCIP_PORTAL_URL.substring(0, 50)}...
                  </div>
                </div>
                <button
                  onClick={copySCIPLink}
                  disabled={isLinkCopied}
                  className={`px-3 py-2 text-xs sm:text-sm rounded-lg transition-all duration-300 flex items-center gap-2 whitespace-nowrap shrink-0 mt-2 sm:mt-0 justify-center ${
                    isLinkCopied
                      ? 'bg-green-600/20 text-green-600 cursor-not-allowed'
                      : 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]'
                  }`}
                >
                  {isLinkCopied ? 'Link Copied' : 'Copy Link'}
                </button>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowSCIPConfirmation(false); setIsLinkCopied(false); }}
                className="px-4 py-2 text-sm sm:text-base text-[var(--text)] bg-[var(--background-secondary)] hover:bg-[var(--background)] rounded-lg transition-colors duration-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSCIPNavigation}
                disabled={isNavigatingToSCIP}
                className={`px-4 py-2 text-sm sm:text-base rounded-lg transition-colors duration-300 ${
                  isNavigatingToSCIP
                    ? 'bg-[var(--primary)]/60 text-white cursor-not-allowed'
                    : 'text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)]'
                }`}
              >
                {isNavigatingToSCIP ? 'Opening…' : 'Continue'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

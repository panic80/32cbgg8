import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ExternalLink, Send, Shield, Users, MessageSquare, FileText } from 'lucide-react';
import LogoImage from '../components/LogoImage';
import { useTheme } from '../context/ThemeContext';
import { SITE_CONFIG, getLastUpdatedText } from '../constants/siteConfig';
import '../styles/landing-v2.css';

export default function LandingPageV2() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [query, setQuery] = useState('');
  const lastUpdated = useMemo(() => getLastUpdatedText(), []);

  const handleAskSubmit = (e) => {
    e.preventDefault();
    const q = (query || '').trim();
    navigate(q.length === 0 ? '/chat' : `/chat?q=${encodeURIComponent(q)}`);
  };

  const quickAsk = (q) => navigate(`/chat?q=${encodeURIComponent(q)}`);

  return (
    <div className="lpv2-root">
      <header className="lpv2-header" role="banner">
        <div className="lpv2-header-inner">
          <Link to="/" className="lpv2-brand" aria-label="Go to home">
            <LogoImage size="sm" />
            <span className="lpv2-brand-text">32 CBG G8</span>
          </Link>
          <nav className="lpv2-nav" aria-label="Primary">
            <Link to="/chat" className="lpv2-nav-link">Chat</Link>
            <a href={SITE_CONFIG.SCIP_PORTAL_URL} target="_blank" rel="noopener noreferrer" className="lpv2-nav-link">
              SCIP <ExternalLink size={14} aria-hidden="true" />
            </a>
            <Link to="/opi" className="lpv2-nav-link">OPI</Link>
            <Link to="/faq" className="lpv2-nav-link">FAQ</Link>
          </nav>
          <button
            type="button"
            onClick={toggleTheme}
            className="lpv2-theme-toggle"
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            title="Toggle theme"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </header>

      <main className="lpv2-main" role="main">
        <section className="lpv2-hero" aria-labelledby="lpv2-hero-title">
          <div className="lpv2-hero-inner">
            <h1 id="lpv2-hero-title" className="lpv2-hero-title">32 CBG G8 Administration Hub</h1>
            <p className="lpv2-hero-sub">Ask policy questions, submit claims, find contacts.</p>

            <form className="lpv2-ask" onSubmit={handleAskSubmit} role="search" aria-label="Ask policy">
              <input
                type="text"
                className="lpv2-ask-input"
                placeholder="Ask a policy question…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Ask a policy question"
              />
              <button type="submit" className="lpv2-ask-btn">
                Ask now
                <Send size={16} aria-hidden="true" />
              </button>
            </form>

            <div className="lpv2-chips" role="list">
              <button type="button" className="lpv2-chip" onClick={() => quickAsk('What are the current mileage rates under CFTDTI?')} role="listitem">Mileage rates</button>
              <button type="button" className="lpv2-chip" onClick={() => quickAsk('What are the meal per diem rates (CFTDTI)?')} role="listitem">Per diem</button>
              <button type="button" className="lpv2-chip" onClick={() => quickAsk('How do I request a travel advance?')} role="listitem">Travel advance</button>
              <button type="button" className="lpv2-chip" onClick={() => quickAsk('What receipt documentation do I need for travel claims?')} role="listitem">Receipts needed</button>
            </div>

            <div className="lpv2-cards" role="group" aria-label="Primary actions">
              <Link to="/chat" className="lpv2-card">
                <MessageSquare size={18} />
                <span>Policy Assistant</span>
              </Link>
              <a href={SITE_CONFIG.SCIP_PORTAL_URL} target="_blank" rel="noopener noreferrer" className="lpv2-card">
                <FileText size={18} />
                <span>SCIP Portal</span>
                <ExternalLink size={14} aria-hidden="true" />
              </a>
              <Link to="/opi" className="lpv2-card">
                <Users size={18} />
                <span>OPI Contacts</span>
              </Link>
            </div>

            <div className="lpv2-inline-meta">
              <div className="lpv2-links-inline">
                <a href={SITE_CONFIG.CFTDTI_URL} target="_blank" rel="noopener noreferrer">CFTDTI</a>
                <span className="sep">•</span>
                <a href={SITE_CONFIG.NJC_TRAVEL_URL} target="_blank" rel="noopener noreferrer">NJC Travel</a>
                <span className="sep">•</span>
                <Link to="/privacy">Privacy</Link>
              </div>
              <p className="lpv2-trust">Unofficial resource. Verify via official channels. {lastUpdated}</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="lpv2-footer" role="contentinfo">
        <div className="lpv2-footer-inner">
          <div className="lpv2-footer-text">Unofficial site. Not affiliated with DND or CAF. Use at your discretion.</div>
          <div className="lpv2-footer-links">
            <Link to="/privacy" className="lpv2-footer-link">Privacy</Link>
            <a href={`mailto:${SITE_CONFIG.CONTACT_EMAIL}`} className="lpv2-footer-link">Contact</a>
            <span className="lpv2-footer-link muted">{lastUpdated}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}


import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  ClipboardList,
  Clock3,
  Compass,
  GitBranch,
  Layers3,
  LifeBuoy,
  LineChart,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Target,
  UsersRound
} from 'lucide-react';
import LogoImage from '../components/LogoImage';
import { useTheme } from '../context/ThemeContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { SITE_CONFIG, getLastUpdatedText } from '../constants/siteConfig';
import '../styles/sticky-footer.css';

const missionPillars = [
  {
    title: 'Financial Stewardship',
    description: 'Protect spending authority and deliver transparent funding visibility across the brigade.',
    icon: ShieldCheck,
  },
  {
    title: 'Operational Tempo',
    description: 'Synchronize planning cycles, battle rhythms, and readiness reporting without chasing spreadsheets.',
    icon: Clock3,
  },
  {
    title: 'Human Focus',
    description: 'Support members with accurate, timely answers on claims, benefits, and deployments.',
    icon: UsersRound,
  },
];

const capabilityMatrix = [
  {
    title: 'Policy Intelligence',
    description: 'Conversational guidance grounded in CAF policies, CFTDTI, NJC, and regional directives.',
    icon: MessageCircle,
  },
  {
    title: 'Mission Packages',
    description: 'Pre-built checklists and trackers for exercises, courses, and domestic deployments.',
    icon: ClipboardList,
  },
  {
    title: 'Budget Oversight',
    description: 'Live view of commitments, burn rate, and variance alerts aligned to fiscal guardrails.',
    icon: LineChart,
  },
  {
    title: 'Force Generation',
    description: 'Monitor readiness states, task assignments, and training gates across units.',
    icon: Target,
  },
  {
    title: 'Integration Toolkit',
    description: 'Connect MAP, DRMIS, and bespoke trackers into a single operational picture.',
    icon: Layers3,
  },
  {
    title: 'Rapid Coordination',
    description: 'Signal updates to staff, adjutants, and finance teams with one-click broadcasts.',
    icon: GitBranch,
  },
];

const operationsTimeline = [
  {
    phase: '01',
    title: 'Intake & Triage',
    description: 'Capture requests from units, classify urgency, and assign owners with transparent SLAs.',
  },
  {
    phase: '02',
    title: 'Decision Ready',
    description: 'Surface policy references, past rulings, and financial impacts to support quick approvals.',
  },
  {
    phase: '03',
    title: 'Execution Tracking',
    description: 'Follow claims, reimbursements, and allocations through every step with automated nudges.',
  },
  {
    phase: '04',
    title: 'After Action',
    description: 'Package insights, outstanding risks, and audit documentation for the next rotation.',
  },
];

const quickLinks = [
  {
    label: 'Launch Policy Assistant',
    to: '/chat',
    description: 'Ask real-world questions and receive cited responses in seconds.',
  },
  {
    label: 'Access SCIP Portal',
    to: SITE_CONFIG.SCIP_PORTAL_URL,
    description: 'Transition to PowerApps for approvals and submissions.',
    external: true,
  },
  {
    label: 'Browse Admin Tools',
    to: '/admin-tools',
    description: 'Explore dashboards, intake forms, and data sync utilities.',
  },
  {
    label: 'FAQ Library',
    to: '/faq',
    description: 'Review guidance on travel, courses, and benefits.',
  },
];

function DecorativeOrb({ className, style }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute rounded-full blur-3xl opacity-20 ${className}`}
      style={style}
    />
  );
}

export default function LandingConceptPage() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="root-container">
      <div className="relative min-h-screen bg-[var(--background)] text-[var(--text)] overflow-hidden">
        <DecorativeOrb
          className="w-[480px] h-[480px] -top-32 -left-32"
          style={{ background: 'radial-gradient(circle, var(--primary) 0%, transparent 70%)' }}
        />
        <DecorativeOrb
          className="w-[520px] h-[520px] top-1/3 -right-40"
          style={{ background: 'radial-gradient(circle, var(--primary) 0%, transparent 70%)' }}
        />

        <div className="absolute top-4 right-4 z-50">
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center h-11 w-11 rounded-full border border-[var(--border)] bg-[var(--card)] text-[var(--text)] shadow-lg transition-transform duration-300 hover:scale-105 hover:shadow-xl"
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 14.12A7.78 7.78 0 019.88 4a7.78 7.78 0 002.9 15.1 7.78 7.78 0 007.22-5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
                <path d="M12 2v2m0 16v2M2 12h2m16 0h2m-3-7l-1.5 1.5M4.93 4.93l1.5 1.5m11.14 11.14l1.5 1.5M4.93 19.07l1.5-1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>

        <main className="relative z-10 pb-24">
          <section className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 pt-24 text-center sm:px-6 lg:pt-32">
            <Badge className="mb-6 bg-[var(--primary)]/15 text-[var(--primary)]">
              Reimagined G8 Operations Hub
            </Badge>
            <div className="mb-10 flex justify-center">
              <LogoImage size="xl" className="drop-shadow-2xl" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Command the Administrative Battlespace
            </h1>
            <p className="mt-6 max-w-3xl text-lg text-[var(--text-secondary)] sm:text-xl">
              A strategic dashboard for 32 CBG G8 to triage requests, accelerate decisions, and keep members supported—from intake to audit.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Button asChild size="lg" className="shadow-xl hover:shadow-2xl">
                <Link to="/chat">
                  Launch Operations Portal
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="border-[var(--primary)]/40 bg-[var(--background-secondary)] text-[var(--text)] hover:border-[var(--primary)] hover:text-[var(--primary)]">
                <a href={SITE_CONFIG.SCIP_PORTAL_URL} target="_blank" rel="noreferrer">
                  Access SCIP
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </Button>
            </div>
            <div className="mt-14 grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {missionPillars.map(({ title, description, icon: Icon }) => (
                <Card key={title} className="border-[var(--border)] bg-[var(--card)]/90 backdrop-blur">
                  <CardHeader className="items-center space-y-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
                      <Icon className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-lg text-[var(--text)]">{title}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <CardDescription className="text-center text-[var(--text-secondary)]">
                      {description}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section className="mx-auto mt-24 w-full max-w-6xl px-4 sm:px-6">
            <div className="flex flex-col gap-4 text-center sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.35em] text-[var(--text-secondary)]">Situational Awareness</p>
                <h2 className="mt-2 text-3xl font-semibold text-[var(--text)] sm:text-4xl">
                  Operational Capabilities At A Glance
                </h2>
              </div>
              <div className="text-sm text-[var(--text-secondary)]">{getLastUpdatedText()}</div>
            </div>
            <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {capabilityMatrix.map(({ title, description, icon: Icon }) => (
                <Card key={title} className="border-[var(--border)] bg-[var(--background-secondary)]/60 shadow-lg shadow-black/5">
                  <CardHeader className="flex-row items-center gap-4">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <CardTitle className="text-left text-xl text-[var(--text)]">
                      {title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <CardDescription className="text-left text-[var(--text-secondary)]">
                      {description}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section className="mx-auto mt-24 w-full max-w-5xl px-4 sm:px-6">
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)]/80 p-8 shadow-xl backdrop-blur-lg sm:p-12">
              <div className="flex flex-col gap-4 text-center sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.35em] text-[var(--text-secondary)]">Battle Rhythm</p>
                  <h2 className="mt-2 text-3xl font-semibold text-[var(--text)] sm:text-4xl">Mission Workflow</h2>
                </div>
                <Badge className="self-center bg-[var(--primary)]/15 text-[var(--primary)]">End-to-End View</Badge>
              </div>
              <div className="mt-10 space-y-6">
                {operationsTimeline.map(({ phase, title, description }) => (
                  <div key={phase} className="relative border-l border-[var(--border)] pl-8 sm:pl-10">
                    <span className="absolute -left-3 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--primary)] bg-[var(--background)] text-lg font-semibold text-[var(--primary)]">
                      {phase}
                    </span>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <h3 className="text-xl font-semibold text-[var(--text)]">{title}</h3>
                      <p className="max-w-2xl text-[var(--text-secondary)]">
                        {description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mx-auto mt-24 w-full max-w-6xl px-4 sm:px-6">
            <div className="grid gap-10 lg:grid-cols-[2fr,1fr]">
              <div className="rounded-3xl border border-[var(--border)] bg-[var(--background-secondary)]/70 p-8 shadow-lg">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.35em] text-[var(--text-secondary)]">Mission Support</p>
                    <h2 className="mt-2 text-3xl font-semibold text-[var(--text)] sm:text-4xl">Quick Access</h2>
                  </div>
                  <Compass className="h-10 w-10 text-[var(--primary)]" />
                </div>
                <div className="mt-10 grid gap-4 sm:grid-cols-2">
                  {quickLinks.map(({ label, to, description, external }) => (
                    <Card key={label} className="group border-[var(--border)] bg-[var(--card)]/80 transition-transform duration-200 hover:-translate-y-1 hover:border-[var(--primary)]">
                      <CardHeader className="flex-row items-start justify-between gap-4">
                        <div>
                          <CardTitle className="text-left text-lg text-[var(--text)]">
                            {label}
                          </CardTitle>
                          <CardDescription className="mt-2 text-left text-[var(--text-secondary)]">
                            {description}
                          </CardDescription>
                        </div>
                        <ArrowUpRight className="mt-1 h-5 w-5 text-[var(--primary)] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                      </CardHeader>
                      <CardContent className="pt-0">
                        {external ? (
                          <a
                            className="text-sm font-medium text-[var(--primary)] hover:underline"
                            href={to}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open external portal
                          </a>
                        ) : (
                          <Link
                            className="text-sm font-medium text-[var(--primary)] hover:underline"
                            to={to}
                          >
                            Jump inside hub
                          </Link>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-6">
                <Card className="border-[var(--border)] bg-[var(--card)]/80 p-6 shadow-lg">
                  <div className="mb-4 flex items-center gap-3">
                    <LifeBuoy className="h-6 w-6 text-[var(--primary)]" />
                    <h3 className="text-lg font-semibold text-[var(--text)]">Help Desk Signals</h3>
                  </div>
                  <p className="text-[var(--text-secondary)]">
                    Need escalation or policy confirmation? Contact the G8 duty desk and we will route your request to finance, logistics, or legal support as required.
                  </p>
                  <a
                    className="mt-4 inline-flex items-center gap-2 text-[var(--primary)] hover:underline"
                    href={`mailto:${SITE_CONFIG.CONTACT_EMAIL}`}
                  >
                    {SITE_CONFIG.CONTACT_EMAIL}
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                </Card>
                <Card className="border-[var(--border)] bg-[var(--background-secondary)]/60 p-6 shadow-lg">
                  <div className="mb-4 flex items-center gap-3">
                    <Sparkles className="h-6 w-6 text-[var(--primary)]" />
                    <h3 className="text-lg font-semibold text-[var(--text)]">What\'s Coming</h3>
                  </div>
                  <ul className="space-y-3 text-sm text-[var(--text-secondary)]">
                    <li>• Automated budget drill-downs tied to directorate roll-ups.</li>
                    <li>• Member-facing claim intake with status tracking.</li>
                    <li>• Power BI export kit and briefing deck generator.</li>
                  </ul>
                </Card>
              </div>
            </div>
          </section>
        </main>

        <footer className="relative z-10 mt-24 border-t border-[var(--border)] bg-[var(--background-secondary)]/70">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-[var(--text-secondary)]">
              <div>© {new Date().getFullYear()} G8 Administration Hub</div>
              <div>Prototype concept — not yet deployed to production.</div>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <Link className="text-[var(--primary)] hover:underline" to="/privacy">
                Privacy
              </Link>
              <Link className="text-[var(--primary)] hover:underline" to="/faq">
                FAQ
              </Link>
              <Link className="text-[var(--primary)] hover:underline" to="/">
                Return to live site
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

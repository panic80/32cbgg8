import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  ClipboardList,
  Compass,
  Filter,
  Layers3,
  Mail,
  Phone,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  UsersRound
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import LogoImage from '../components/LogoImage';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import '../styles/sticky-footer.css';

const unitContacts = {
  '2 Int': {
    fsc: 'Cpl Downes',
    fscEmail: 'william.downes@forces.gc.ca',
    fmc: 'MCpl Angela McDonald',
    fmcEmail: 'ANGELA.MCDONALD@forces.gc.ca',
  },
  '32 CBG HQ': {
    fsc: 'Cpl Downes',
    fscEmail: 'william.downes@forces.gc.ca',
    fmc: 'Sgt Gordon Brown',
    fmcEmail: 'GORDON.BROWN2@forces.gc.ca',
  },
  '32 CER': {
    fsc: 'Cpl Downes',
    fscEmail: 'william.downes@forces.gc.ca',
    fmc: 'Sgt Gordon Brown',
    fmcEmail: 'GORDON.BROWN2@forces.gc.ca',
  },
  '32 Svc Bn': {
    fsc: 'Cpl Downes',
    fscEmail: 'william.downes@forces.gc.ca',
    fmc: 'Sgt Gordon Brown',
    fmcEmail: 'GORDON.BROWN2@forces.gc.ca',
  },
  GGHG: {
    fsc: 'Cpl Downes',
    fscEmail: 'william.downes@forces.gc.ca',
    fmc: 'Sgt Jennifer Wood',
    fmcEmail: 'JENNIFER.WOOD@forces.gc.ca',
  },
  '48th Highrs': {
    fsc: 'Sgt Ro',
    fscEmail: 'eugene.ro@forces.gc.ca',
    fmc: 'Sgt Jennifer Wood',
    fmcEmail: 'JENNIFER.WOOD@forces.gc.ca',
  },
  '7 Tor': {
    fsc: 'Sgt Ro',
    fscEmail: 'eugene.ro@forces.gc.ca',
    fmc: 'Sgt Jennifer Wood',
    fmcEmail: 'JENNIFER.WOOD@forces.gc.ca',
  },
  'Tor Scots': {
    fsc: 'Sgt Ro',
    fscEmail: 'eugene.ro@forces.gc.ca',
    fmc: 'MCpl Angela McDonald',
    fmcEmail: 'ANGELA.MCDONALD@forces.gc.ca',
  },
  QOR: {
    fsc: 'Sgt Ro',
    fscEmail: 'eugene.ro@forces.gc.ca',
    fmc: 'Sgt Gordon Brown',
    fmcEmail: 'GORDON.BROWN2@forces.gc.ca',
  },
  '32 Sig Regt': {
    fsc: 'Sgt Zeng',
    fscEmail: 'aidi.zeng@forces.gc.ca',
    fmc: 'MCpl Angela McDonald',
    fmcEmail: 'ANGELA.MCDONALD@forces.gc.ca',
  },
  'Lorne Scots': {
    fsc: 'Sgt Zeng',
    fscEmail: 'aidi.zeng@forces.gc.ca',
    fmc: 'MCpl Angela McDonald',
    fmcEmail: 'ANGELA.MCDONALD@forces.gc.ca',
  },
  'QY Rang': {
    fsc: 'Sgt Zeng',
    fscEmail: 'aidi.zeng@forces.gc.ca',
    fmc: 'Sgt Jennifer Wood',
    fmcEmail: 'JENNIFER.WOOD@forces.gc.ca',
  },
  'R Regt C': {
    fsc: 'Sgt Zeng',
    fscEmail: 'aidi.zeng@forces.gc.ca',
    fmc: 'Sgt Gordon Brown',
    fmcEmail: 'GORDON.BROWN2@forces.gc.ca',
  },
  'Linc & Welld': {
    fsc: 'N/A',
    fscEmail: '',
    fmc: 'Sgt Mabel James',
    fmcEmail: 'MABEL.JAMES@forces.gc.ca',
  },
  '56 Fd': {
    fsc: 'N/A',
    fscEmail: '',
    fmc: 'Sgt Mabel James',
    fmcEmail: 'MABEL.JAMES@forces.gc.ca',
  },
};

const fscContacts = [
  {
    name: 'PO 1 Salehi',
    role: 'FSC Warrant Officer',
    email: 'Amir.Salehi@forces.gc.ca',
    focus: 'Director, Financial Support Centre',
    icon: ShieldCheck,
  },
  {
    name: 'Sgt Zeng',
    role: 'FSC Second-in-Command',
    email: 'aidi.zeng@forces.gc.ca',
    focus: 'Operations lead and complex case escalation',
    icon: Radar,
  },
  {
    name: 'Cpl Downes',
    role: 'FSC 1 Section',
    email: 'william.downes@forces.gc.ca',
    focus: 'HQ, engineers, service battalion, household cavalry',
    icon: Compass,
  },
  {
    name: 'Sgt Ro',
    role: 'FSC 2 Section',
    email: 'eugene.ro@forces.gc.ca',
    focus: 'Urban infantry regiments and ceremonial units',
    icon: Users,
  },
  {
    name: 'Sgt Zeng',
    role: 'FSC 3 Section',
    email: 'aidi.zeng@forces.gc.ca',
    focus: 'Signals, light infantry, and northern detachments',
    icon: Layers3,
  },
];

const fmcContacts = [
  {
    name: 'Sgt Peter Cuprys',
    role: 'FMC Warrant Officer',
    email: 'Peter.Cuprys@forces.gc.ca',
  },
  {
    name: 'Sgt Gordon Brown',
    role: 'FMC 1 Support',
    email: 'GORDON.BROWN2@forces.gc.ca',
  },
  {
    name: 'Sgt Jennifer Wood',
    role: 'FMC 2 Support',
    email: 'JENNIFER.WOOD@forces.gc.ca',
  },
  {
    name: 'MCpl Angela McDonald',
    role: 'FMC 3 Support',
    email: 'ANGELA.MCDONALD@forces.gc.ca',
  },
  {
    name: 'Sgt Mabel James',
    role: 'FMC 4 Support',
    email: 'MABEL.JAMES@forces.gc.ca',
  },
];

const readinessMilestones = [
  {
    phase: '01',
    title: 'Request Intake',
    detail: 'Unit submits requirements, triaged by FSC and validated against funding lines.',
    icon: ClipboardList,
  },
  {
    phase: '02',
    title: 'Decision Support',
    detail: 'Policy references and precedent research packaged for the approving authority.',
    icon: ShieldCheck,
  },
  {
    phase: '03',
    title: 'Execution Sync',
    detail: 'Status tracked weekly; variances surfaced for commanders and adjutants.',
    icon: CalendarClock,
  },
  {
    phase: '04',
    title: 'Closeout & Audit',
    detail: 'Lessons learned, outstanding risk, and documentation compiled for audit readiness.',
    icon: Sparkles,
  },
];

const quickActions = [
  {
    label: 'Back to live OPI tools',
    to: '/opi',
    description: 'View the current production experience.',
  },
  {
    label: 'Launch Policy Assistant',
    to: '/chat',
    description: 'Ask financial policy questions with cited references.',
  },
  {
    label: 'Admin Tools',
    to: '/admin-tools',
    description: 'Access dashboards, forms, and automation utilities.',
  },
  {
    label: 'FAQ Library',
    to: '/faq',
    description: 'Browse curated answers for common scenarios.',
  },
];

const supportChannels = [
  {
    title: 'Duty Desk',
    description: 'Immediate escalation for urgent cases or command direction.',
    icon: Phone,
    contact: '416-555-0101',
  },
  {
    title: 'Shared Inbox',
    description: 'Trackable inquiries for policy clarifications and status updates.',
    icon: Mail,
    contact: 'G8-Duty@forces.gc.ca',
  },
  {
    title: 'Battle Rhythm Sync',
    description: 'Weekly sync to align readiness, budget posture, and pending claims.',
    icon: UsersRound,
    contact: 'Wed 1900 hrs, G8 Ops Room',
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

export default function OPIPageConcept() {
  const { theme, toggleTheme } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');

  const allUnits = useMemo(() => Object.keys(unitContacts).sort(), []);

  const filteredUnits = useMemo(() => {
    if (!searchTerm) return allUnits;
    return allUnits.filter((unit) => unit.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [allUnits, searchTerm]);

  useEffect(() => {
    if (filteredUnits.length === 0) {
      setSelectedUnit('');
      return;
    }
    if (!selectedUnit || !filteredUnits.includes(selectedUnit)) {
      setSelectedUnit(filteredUnits[0]);
    }
  }, [filteredUnits, selectedUnit]);

  const selectedContacts = selectedUnit ? unitContacts[selectedUnit] : null;

  return (
    <div className="root-container">
      <div className="relative min-h-screen bg-[var(--background)] text-[var(--text)] overflow-hidden">
        <DecorativeOrb
          className="h-[460px] w-[460px] -top-20 -left-32"
          style={{ background: 'radial-gradient(circle, var(--primary) 0%, transparent 70%)' }}
        />
        <DecorativeOrb
          className="h-[520px] w-[520px] top-1/3 -right-40"
          style={{ background: 'radial-gradient(circle, var(--primary) 0%, transparent 70%)' }}
        />

        <div className="absolute top-4 right-4 z-50 flex gap-2">
          <Button variant="outline" size="sm" asChild className="border-[var(--border)] bg-[var(--card)]/80 text-[var(--text)]">
            <Link to="/opi">
              Original OPI Experience
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <button
            onClick={toggleTheme}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] text-[var(--text)] shadow-lg transition-transform duration-300 hover:scale-105 hover:shadow-xl"
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
              OPI / Unit Liaison Concept
            </Badge>
            <div className="mb-8 flex justify-center">
              <LogoImage size="xl" className="drop-shadow-2xl" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Operational Partners Interface
            </h1>
            <p className="mt-6 max-w-3xl text-lg text-[var(--text-secondary)] sm:text-xl">
              A reimagined command centre for 32 CBG financial support and coordination. Locate the right point of contact, understand the workflow, and keep operations synchronized.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Button asChild size="lg" className="shadow-xl hover:shadow-2xl">
                <Link to="/chat">
                  Ask Policy Intelligence
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="border-[var(--primary)]/40 bg-[var(--background-secondary)] text-[var(--text)] hover:border-[var(--primary)] hover:text-[var(--primary)]">
                <Link to="/admin-tools">
                  Explore Admin Tools
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </section>

          <section className="mx-auto mt-24 w-full max-w-6xl px-4 sm:px-6">
            <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
              <Card className="border-[var(--border)] bg-[var(--card)]/80 shadow-xl backdrop-blur">
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.35em] text-[var(--text-secondary)]">Directory</p>
                    <CardTitle className="text-2xl text-[var(--text)]">Unit Contact Navigator</CardTitle>
                    <CardDescription className="text-[var(--text-secondary)]">
                      Search by unit to see assigned FSC and FMC leads.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background-secondary)] px-3 py-1 text-sm text-[var(--text-secondary)]">
                    <Filter className="h-4 w-4" />
                    {filteredUnits.length} units available
                  </div>
                </CardHeader>
                <CardContent className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--background-secondary)] px-4 py-3 shadow-sm">
                      <Search className="h-5 w-5 text-[var(--primary)]" />
                      <input
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Search unit or abbreviation"
                        className="w-full bg-transparent text-[var(--text)] placeholder:text-[var(--text-secondary)] focus:outline-none"
                        type="text"
                      />
                    </div>
                    <div className="grid max-h-[320px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                      {filteredUnits.map((unit) => (
                        <button
                          key={unit}
                          type="button"
                          onClick={() => setSelectedUnit(unit)}
                          className={`rounded-xl border px-4 py-3 text-left transition-all duration-200 hover:border-[var(--primary)] hover:-translate-y-0.5 ${
                            selectedUnit === unit
                              ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] shadow-md'
                              : 'border-[var(--border)] bg-[var(--background-secondary)] text-[var(--text)] shadow-sm'
                          }`}
                        >
                          <div className="text-sm font-semibold">{unit}</div>
                          <div className="text-xs text-[var(--text-secondary)]">View liaison details</div>
                        </button>
                      ))}
                      {filteredUnits.length === 0 && (
                        <div className="col-span-full rounded-xl border border-dashed border-[var(--border)] bg-[var(--background-secondary)]/70 p-6 text-center text-sm text-[var(--text-secondary)]">
                          No matches found. Adjust your search terms.
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--background-secondary)]/70 p-6 shadow-sm">
                    {selectedContacts ? (
                      <>
                        <div className="space-y-2">
                          <p className="text-xs uppercase tracking-[0.35em] text-[var(--text-secondary)]">Selected Unit</p>
                          <h3 className="text-2xl font-semibold text-[var(--text)]">{selectedUnit}</h3>
                        </div>
                        <div className="space-y-4 text-sm">
                          <div>
                            <p className="text-xs uppercase tracking-[0.35em] text-[var(--text-secondary)]">FSC Lead</p>
                            <p className="mt-1 text-[var(--text)]">{selectedContacts.fsc}</p>
                            {selectedContacts.fscEmail && (
                              <a
                                className="mt-1 inline-flex items-center gap-1 text-[var(--primary)] hover:underline"
                                href={`mailto:${selectedContacts.fscEmail}`}
                              >
                                {selectedContacts.fscEmail.toLowerCase()}
                                <ArrowUpRight className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.35em] text-[var(--text-secondary)]">FMC Lead</p>
                            <p className="mt-1 text-[var(--text)]">{selectedContacts.fmc}</p>
                            {selectedContacts.fmcEmail && (
                              <a
                                className="mt-1 inline-flex items-center gap-1 text-[var(--primary)] hover:underline"
                                href={`mailto:${selectedContacts.fmcEmail}`}
                              >
                                {selectedContacts.fmcEmail.toLowerCase()}
                                <ArrowUpRight className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center text-center text-sm text-[var(--text-secondary)]">
                        <Layers3 className="mb-3 h-8 w-8 text-[var(--primary)]" />
                        Select a unit to view liaison information.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-[var(--border)] bg-[var(--background-secondary)]/70 p-6 shadow-lg">
                <div className="mb-4 flex items-center gap-3">
                  <Radar className="h-6 w-6 text-[var(--primary)]" />
                  <h3 className="text-lg font-semibold text-[var(--text)]">Support Channels</h3>
                </div>
                <div className="space-y-4 text-sm">
                  {supportChannels.map(({ title, description, icon: Icon, contact }) => (
                    <div key={title} className="rounded-xl border border-[var(--border)] bg-[var(--card)]/70 p-4">
                      <div className="mb-2 flex items-center gap-2 text-[var(--text)]">
                        <Icon className="h-4 w-4 text-[var(--primary)]" />
                        <span className="font-medium">{title}</span>
                      </div>
                      <p className="text-[var(--text-secondary)]">{description}</p>
                      <div className="mt-2 text-sm text-[var(--primary)]">{contact}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </section>

          <section className="mx-auto mt-24 w-full max-w-6xl px-4 sm:px-6">
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)]/80 p-8 shadow-xl backdrop-blur">
              <div className="flex flex-col gap-4 text-center sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.35em] text-[var(--text-secondary)]">Battle Rhythm</p>
                  <h2 className="mt-2 text-3xl font-semibold text-[var(--text)] sm:text-4xl">Mission Workflow</h2>
                </div>
                <Badge className="self-center bg-[var(--primary)]/15 text-[var(--primary)]">
                  FSC + FMC Alignment
                </Badge>
              </div>
              <div className="mt-10 space-y-6">
                {readinessMilestones.map(({ phase, title, detail, icon: Icon }) => (
                  <div key={phase} className="relative border-l border-[var(--border)] pl-8 sm:pl-10">
                    <span className="absolute -left-3 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--primary)] bg-[var(--background)] text-lg font-semibold text-[var(--primary)]">
                      {phase}
                    </span>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-center gap-3 text-[var(--text)]">
                        <Icon className="h-5 w-5 text-[var(--primary)]" />
                        <h3 className="text-xl font-semibold">{title}</h3>
                      </div>
                      <p className="max-w-2xl text-[var(--text-secondary)]">{detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mx-auto mt-24 w-full max-w-6xl px-4 sm:px-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border-[var(--border)] bg-[var(--background-secondary)]/70 p-8 shadow-lg">
                <CardHeader className="mb-4 border-b border-[var(--border)] pb-4">
                  <CardTitle className="flex items-center gap-3 text-2xl text-[var(--text)]">
                    <ShieldCheck className="h-6 w-6 text-[var(--primary)]" />
                    Financial Support Centre
                  </CardTitle>
                  <CardDescription className="text-[var(--text-secondary)]">
                    Section leads and focus areas.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  {fscContacts.map(({ name, role, email, focus, icon: Icon }) => (
                    <div key={name} className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/80 p-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
                          <Icon className="h-5 w-5" />
                        </span>
                        <div>
                          <div className="text-[var(--text)] font-semibold">{name}</div>
                          <div className="text-xs uppercase tracking-[0.28em] text-[var(--text-secondary)]">{role}</div>
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-[var(--text-secondary)]">{focus}</p>
                      <a className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)] hover:underline" href={`mailto:${email}`}>
                        {email.toLowerCase()}
                        <ArrowUpRight className="h-3 w-3" />
                      </a>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card className="border-[var(--border)] bg-[var(--background-secondary)]/70 p-8 shadow-lg">
                <CardHeader className="mb-4 border-b border-[var(--border)] pb-4">
                  <CardTitle className="flex items-center gap-3 text-2xl text-[var(--text)]">
                    <UsersRound className="h-6 w-6 text-[var(--primary)]" />
                    Financial Management Cell
                  </CardTitle>
                  <CardDescription className="text-[var(--text-secondary)]">
                    Contacts aligned to support groupings.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {fmcContacts.map(({ name, role, email }) => (
                    <div key={name} className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/80 p-4">
                      <div className="flex items-center justify-between text-[var(--text)]">
                        <div>
                          <div className="font-semibold">{name}</div>
                          <div className="text-xs uppercase tracking-[0.28em] text-[var(--text-secondary)]">{role}</div>
                        </div>
                        <Button asChild size="sm" variant="outline" className="border-[var(--primary)]/40 text-[var(--primary)] hover:border-[var(--primary)]">
                          <a href={`mailto:${email}`}>
                            Email
                            <ArrowUpRight className="h-3 w-3" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="mx-auto mt-24 w-full max-w-6xl px-4 sm:px-6">
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)]/80 p-8 shadow-xl backdrop-blur">
              <div className="flex flex-col gap-4 text-center sm:flex-row sm:items-center sm:justify-between">
                <div className="text-left">
                  <p className="text-sm uppercase tracking-[0.35em] text-[var(--text-secondary)]">Navigation</p>
                  <h2 className="mt-2 text-3xl font-semibold text-[var(--text)] sm:text-4xl">Quick Actions</h2>
                  <p className="mt-2 max-w-xl text-sm text-[var(--text-secondary)]">
                    Jump directly into the tools that keep operations moving.
                  </p>
                </div>
                <Compass className="hidden h-12 w-12 text-[var(--primary)] sm:block" />
              </div>
              <div className="mt-10 grid gap-4 sm:grid-cols-2">
                {quickActions.map(({ label, to, description }) => (
                  <Card key={label} className="group border-[var(--border)] bg-[var(--background-secondary)]/70 transition-transform duration-200 hover:-translate-y-1 hover:border-[var(--primary)]">
                    <CardHeader className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-left text-lg text-[var(--text)]">{label}</CardTitle>
                        <CardDescription className="mt-2 text-left text-[var(--text-secondary)]">{description}</CardDescription>
                      </div>
                      <ArrowUpRight className="mt-1 h-5 w-5 text-[var(--primary)] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Link className="text-sm font-medium text-[var(--primary)] hover:underline" to={to}>
                        Go now
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>
        </main>

        <footer className="relative z-10 mt-24 border-t border-[var(--border)] bg-[var(--background-secondary)]/70">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 text-sm text-[var(--text-secondary)] sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div>© {new Date().getFullYear()} G8 Administration Hub</div>
              <div>OPI concept prototype — for internal review.</div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Link className="text-[var(--primary)] hover:underline" to="/privacy">
                Privacy
              </Link>
              <Link className="text-[var(--primary)] hover:underline" to="/faq">
                FAQ
              </Link>
              <Link className="text-[var(--primary)] hover:underline" to="/landing-concept">
                Landing concept
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

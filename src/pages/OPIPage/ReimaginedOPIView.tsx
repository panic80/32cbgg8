import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import { useMemo, useState } from 'react';
import {
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronRight,
  Mail,
  Search,
  UserCheck,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ContactType = 'FSC' | 'FMC';
type ViewId = 'all' | 'fsc' | 'fmc';

interface Contact {
  name: string;
  role: string;
  email?: string;
  units?: string[];
  isLeadership?: boolean;
}

interface UnitContact {
  fsc: string;
  fscEmail?: string;
  fmc: string;
  fmcEmail?: string;
}

interface ReimaginedOPIViewProps {
  unitContacts?: Record<string, UnitContact>;
  fscContacts?: Contact[];
  fmcContacts?: Contact[];
  contactView?: string;
  selectedUnit?: string;
  searchTerm?: string;
  setSelectedUnit?: Dispatch<SetStateAction<string>>;
  setSearchTerm?: Dispatch<SetStateAction<string>>;
  setContactView?: Dispatch<SetStateAction<string>>;
}

interface ContactStyle {
  label: ContactType;
  dot: string;
  border: string;
  bg: string;
  text: string;
  emphasis: string;
}

const VIEW_OPTIONS: ReadonlyArray<{ id: ViewId; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'fsc', label: 'FSC' },
  { id: 'fmc', label: 'FMC' },
];

const CONTACT_TYPE_STYLE: Record<ContactType, ContactStyle> = {
  FSC: {
    label: 'FSC',
    dot: 'bg-cyan-400',
    border: 'border-l-cyan-400',
    bg: 'bg-cyan-400/18',
    text: 'text-cyan-500 dark:text-cyan-300',
    emphasis: 'text-cyan-400',
  },
  FMC: {
    label: 'FMC',
    dot: 'bg-lime-400',
    border: 'border-l-lime-400',
    bg: 'bg-lime-400/18',
    text: 'text-lime-500 dark:text-lime-300',
    emphasis: 'text-lime-400',
  },
};

const POSITIONAL_INBOXES: ReadonlyArray<{
  type: ContactType;
  label: string;
  detail: string;
  email: string;
}> = [
  {
    type: 'FSC',
    label: '32 CBG HQ Financial Services',
    detail: 'QG 32 GBC Services financiers',
    email: 'DND.GTA.B32.FinancialServices-Servicesfinanciers.MDN@forces.gc.ca',
  },
  {
    type: 'FMC',
    label: '32 CBG HQ Financial Management',
    detail: 'QG 32 GBC Gest Fin',
    email: 'DND.GTA.B32.FinMgt-GestFin.MDN@forces.gc.ca',
  },
];

function getContactType(contact: Contact): ContactType {
  if (contact.role?.includes('FSC')) return 'FSC';
  if (contact.role?.includes('FMC')) return 'FMC';
  return 'FSC';
}

function getInitials(name = ''): string {
  if (name === 'N/A') return 'NA';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function EmailLink({ email, compact = false }: { email?: string; compact?: boolean }) {
  if (!email) {
    return <span className="text-sm text-muted-foreground">No direct email listed</span>;
  }

  return (
    <a
      href={`mailto:${email}`}
      className={cn(
        'inline-flex min-w-0 items-center gap-2 rounded-md text-sm font-medium text-primary underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background',
        compact ? 'max-w-full' : 'max-w-[20rem]',
      )}
    >
      <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{email}</span>
    </a>
  );
}

function ContactPanel({
  title,
  contact,
  type,
}: {
  title: string;
  contact: Contact;
  type: ContactType;
}) {
  const style = CONTACT_TYPE_STYLE[type];

  return (
    <article
      className={cn(
        'rounded-lg border border-border bg-card p-4 shadow-sm',
        'border-l-4',
        style.border,
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className={cn('text-xs font-bold uppercase tracking-wide', style.emphasis)}>{title}</p>
          <h3 className="mt-1 text-xl font-semibold leading-tight text-foreground">
            {contact.name}
          </h3>
        </div>
        <span
          className={cn(
            'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
            style.bg,
            style.emphasis,
          )}
        >
          {getInitials(contact.name)}
        </span>
      </div>

      <p className="mb-3 text-sm text-muted-foreground">{contact.role}</p>
      <EmailLink email={contact.email} />
    </article>
  );
}

function ContactRow({ contact }: { contact: Contact }) {
  const type = getContactType(contact);
  const style = CONTACT_TYPE_STYLE[type];

  return (
    <li className="border-b border-border last:border-b-0">
      <div className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(11rem,16rem)_minmax(0,1.25fr)] sm:items-center sm:px-5">
        <div className="min-w-0">
          <div className="grid grid-cols-[0.625rem_minmax(0,1fr)_auto] items-start gap-x-2">
            <span
              className={cn('mt-[0.45rem] h-2.5 w-2.5 rounded-full', style.dot)}
              aria-hidden="true"
            />
            <h3 className="truncate text-base font-semibold leading-6 text-foreground">
              {contact.name}
            </h3>
            {contact.isLeadership && (
              <span className="mt-0.5 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                Lead
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{contact.role}</p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {contact.units?.length ? (
            contact.units.map((unit) => (
              <span
                key={`${contact.email}-${unit}`}
                className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground"
              >
                {unit}
              </span>
            ))
          ) : (
            <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
              Leadership
            </span>
          )}
        </div>

        <div className="min-w-0 sm:justify-self-end">
          <EmailLink email={contact.email} compact />
        </div>
      </div>
    </li>
  );
}

export default function ReimaginedOPIView({
  unitContacts = {},
  fscContacts = [],
  fmcContacts = [],
  contactView: initialView = 'all',
  selectedUnit = '',
  searchTerm = '',
  setSelectedUnit = () => {},
  setSearchTerm = () => {},
  setContactView = () => {},
}: ReimaginedOPIViewProps) {
  const [activeView, setActiveView] = useState<ViewId>(
    VIEW_OPTIONS.some((option) => option.id === initialView) ? (initialView as ViewId) : 'all',
  );

  const allUnits = useMemo(() => Object.keys(unitContacts).sort(), [unitContacts]);
  const allContacts = useMemo(() => [...fscContacts, ...fmcContacts], [fscContacts, fmcContacts]);

  const filteredUnits = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return allUnits;
    return allUnits.filter((unit) => unit.toLowerCase().includes(term));
  }, [allUnits, searchTerm]);

  const selectedContact = selectedUnit ? unitContacts[selectedUnit] : null;

  const rosterContacts = useMemo(() => {
    if (activeView === 'fsc') return fscContacts;
    if (activeView === 'fmc') return fmcContacts;
    return allContacts;
  }, [activeView, allContacts, fmcContacts, fscContacts]);

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextTerm = event.target.value;
    setSearchTerm(nextTerm);

    if (
      nextTerm.trim() &&
      selectedUnit &&
      !selectedUnit.toLowerCase().includes(nextTerm.trim().toLowerCase())
    ) {
      setSelectedUnit('');
    }
  };

  const handleViewChange = (view: ViewId) => {
    setActiveView(view);
    setContactView(view);
  };

  return (
    <main className="mx-auto w-full max-w-6xl">
      <section className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(20rem,0.95fr)] lg:items-start">
        <div className="space-y-5">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
              32 CBG Contact Directory
            </div>
            <h1 className="max-w-3xl text-3xl font-bold tracking-normal text-foreground sm:text-4xl">
              Find the right financial contact without sorting through every section.
            </h1>
          </div>

          <div className="grid gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)]">
            <label className="min-w-0">
              <span className="mb-2 block text-sm font-medium text-foreground">Unit search</span>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="h-11 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-base text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="Search unit"
                  type="search"
                />
              </div>
            </label>

            <label>
              <span className="mb-2 block text-sm font-medium text-foreground">Select unit</span>
              <select
                value={selectedUnit}
                onChange={(event) => setSelectedUnit(event.target.value)}
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Choose a unit</option>
                {filteredUnits.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {searchTerm && filteredUnits.length === 0 && (
            <p className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
              No unit matches "{searchTerm}".
            </p>
          )}
        </div>

        <aside className="rounded-xl border border-border bg-muted/35 p-4">
          {selectedContact ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                Contacts for <span className="text-foreground">{selectedUnit}</span>
              </div>
              <div className="grid gap-4">
                <ContactPanel
                  title="Financial Services Cell"
                  type="FSC"
                  contact={{
                    name: selectedContact.fsc,
                    role: 'Financial Services Cell (FSC)',
                    email: selectedContact.fscEmail,
                  }}
                />
                <ContactPanel
                  title="Financial Management Cell"
                  type="FMC"
                  contact={{
                    name: selectedContact.fmc,
                    role: 'Financial Management Cell (FMC)',
                    email: selectedContact.fmcEmail,
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="flex min-h-[17rem] flex-col justify-center rounded-lg border border-dashed border-border bg-background/60 p-6 text-center">
              <Users className="mx-auto mb-4 h-10 w-10 text-muted-foreground" aria-hidden="true" />
              <h2 className="text-xl font-semibold text-foreground">Start with a unit</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                The matched FSC and FMC contacts appear here as soon as a unit is selected.
              </p>
            </div>
          )}
        </aside>
      </section>

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <Briefcase className="h-4 w-4" aria-hidden="true" />
              Contact roster
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {rosterContacts.length} contacts shown across {allUnits.length} units
            </p>
          </div>

          <div className="inline-flex rounded-lg border border-border bg-muted p-1">
            {VIEW_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => handleViewChange(option.id)}
                className={cn(
                  'inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background',
                  activeView === option.id
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {option.id === 'fsc' && (
                  <span className="h-2 w-2 rounded-full bg-cyan-400" aria-hidden="true" />
                )}
                {option.id === 'fmc' && (
                  <span className="h-2 w-2 rounded-full bg-lime-400" aria-hidden="true" />
                )}
                {option.id === 'all' && <UserCheck className="h-4 w-4" aria-hidden="true" />}
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <ul>
          {rosterContacts.map((contact) => (
            <ContactRow key={`${contact.email}-${contact.role}`} contact={contact} />
          ))}
        </ul>

        <div className="grid gap-3 border-t border-border px-4 py-4 text-sm sm:px-5 lg:grid-cols-2">
          {POSITIONAL_INBOXES.map((inbox) => {
            const style = CONTACT_TYPE_STYLE[inbox.type];

            return (
              <a
                key={inbox.email}
                href={`mailto:${inbox.email}`}
                className="group grid min-w-0 gap-2 rounded-lg border border-border bg-muted/35 p-3 transition hover:border-primary/50 hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className={cn('h-2.5 w-2.5 rounded-full', style.dot)} aria-hidden="true" />
                  <span className={cn('font-semibold', style.emphasis)}>{inbox.label}</span>
                </span>
                <span className="text-xs text-muted-foreground">{inbox.detail}</span>
                <span className="inline-flex min-w-0 items-center gap-2 font-medium text-primary underline-offset-4 group-hover:underline">
                  <span className="truncate">{inbox.email}</span>
                  <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                </span>
              </a>
            );
          })}
        </div>
      </section>
    </main>
  );
}

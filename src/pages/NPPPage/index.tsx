import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  BriefcaseBusiness,
  BookOpen,
  Building2,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  ExternalLink,
  FileText,
  Gift,
  HandCoins,
  Handshake,
  Info,
  Landmark,
  Library,
  Mail,
  Moon,
  ReceiptText,
  Scale,
  Search,
  SearchCheck,
  ShoppingCart,
  Sun,
  Users,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import brigadeBadge from '@/assets/logo.png';
import { LocaleToggle } from '@/components/LocaleToggle';
import { Checkbox } from '@/components/ui/checkbox';
import { SITE_CONFIG } from '@/constants/siteConfig';
import { useTheme } from '@/context/ThemeContext';
import { useLocale } from '@/i18n/LocaleContext';
import '@/styles/npp.css';
import { nppGuideContent } from './nppContent';
import { getNextSteps, nppTasks } from './nppTasks';
import { ReimbursementChecklist } from './ReimbursementChecklist';
import { useChecklistProgress } from './useChecklistProgress';
import type {
  GrantEntitlementStatus,
  GrantGuide,
  GuideAudience,
  GuideSection,
  Locale,
  OfficialSource,
  TaskAudienceFilter,
  TaskBand,
  TaskDefinition,
} from './types';

const pageUi = {
  en: {
    skip: 'Skip to guide',
    returnToLanding: 'Return to landing',
    switchTheme: {
      light: 'Switch to dark mode',
      dark: 'Switch to light mode',
    },
    unit: '32 Canadian Brigade Group · G8',
    publication: 'NPP field guide · Public edition',
    scope: 'Public · Unclassified · Guidance only',
    audience: 'Audience',
    audienceValue: '32 CBG members and NPP operators',
    sourceStatus: 'Source status',
    fieldNote: 'Field note',
    allMembers: 'All members',
    operators: 'NPP operators',
    caution: 'Stop and confirm',
    sourceReferences: 'Official references for this field note',
    grantRecord: 'Funding record',
    grantSelectorLabel: 'Select a grant or funding record',
    grantSelectorHelper: 'Choose one option to view its amount or formula and requirements.',
    grantStatus: (index: number, total: number) => `Showing record ${index} of ${total}`,
    grantAmount: 'Grant amount or calculation',
    requirementsAtGlance: 'Requirements at a glance',
    examplesHeading: 'Key examples—not exhaustive',
    fundingSource: 'Funding source',
    nppFunding: 'NPP funding',
    publicFunding: 'Public grant administered through NPP',
    eligibleApplicant: 'Eligible organization',
    purpose: 'Authorized purpose',
    timing: 'Request or claim timing',
    evidence: 'Evidence to retain',
    claimOwner: 'Claim owner',
    approval: 'Approval and submission route',
    accountTreatment: 'Grant or trust-account treatment',
    unspentBalance: 'Unspent-balance rule',
    officialSources: 'Official sources',
    sourceLedgerIntro:
      'Open the current official document before acting. Language availability is shown exactly as published.',
    publisher: 'Publisher',
    checked: 'Checked',
    openSource: 'Open source',
    englishOnly: 'English source only',
    draftWatermark: 'DRAFT',
    draftStatus: 'Draft document',
    contactLabel: 'Report a broken link through the public 32 CBG G8 contact',
    hubEyebrow: 'NPP field guide · public edition',
    hubHeading: 'What do you need to do?',
    hubIntro:
      'Guidance for 32 CBG members on Non-Public Property and Non-Public Funds. Pick a task — the guide opens at that step, not at page one.',
    searchLabel: 'Search tasks, grants, documents',
    searchClear: 'Clear',
    audienceGroupLabel: 'Filter by audience',
    audienceEveryone: 'Everyone',
    taskCount: (count: number) => `${count} ${count === 1 ? 'task' : 'tasks'}`,
    noResultsHeading: 'Nothing matches that search.',
    noResultsBody: 'Clear the box, or widen the audience filter.',
    backToHub: 'All tasks',
    nextStepsHeading: 'Next, most people need',
    progress: (completed: number, total: number) => `${completed} of ${total} complete`,
    progressLabel: 'Your progress',
    progressSaved: 'Ticks are saved on this device only.',
    progressReset: 'Reset',
    stepLabel: (index: number) => `Step ${index}`,
    itemLabel: (index: number) => `Item ${index}`,
  },
  fr: {
    skip: 'Aller au guide',
    returnToLanding: 'Retour à l’accueil',
    switchTheme: {
      light: 'Passer au mode sombre',
      dark: 'Passer au mode clair',
    },
    unit: '32e Groupe-brigade du Canada · G8',
    publication: 'Guide pratique des BNP · Édition publique',
    scope: 'Public · Non classifié · À titre indicatif seulement',
    audience: 'Public cible',
    audienceValue: 'Membres du 32 GBC et opérateurs des BNP',
    sourceStatus: 'État des sources',
    fieldNote: 'Fiche',
    allMembers: 'Tous les membres',
    operators: 'Opérateurs BNP',
    caution: 'Arrêtez-vous et confirmez',
    sourceReferences: 'Références officielles pour cette fiche',
    grantRecord: 'Dossier de financement',
    grantSelectorLabel: 'Sélectionner une subvention ou un dossier de financement',
    grantSelectorHelper:
      'Choisissez une option pour afficher son montant ou sa formule ainsi que ses exigences.',
    grantStatus: (index: number, total: number) => `Dossier ${index} sur ${total} affiché`,
    grantAmount: 'Montant ou calcul de la subvention',
    requirementsAtGlance: 'Exigences en bref',
    examplesHeading: 'Exemples clés — liste non exhaustive',
    fundingSource: 'Source de financement',
    nppFunding: 'Financement BNP',
    publicFunding: 'Subvention publique administrée par les BNP',
    eligibleApplicant: 'Organisation admissible',
    purpose: 'Objet autorisé',
    timing: 'Calendrier de demande ou de réclamation',
    evidence: 'Preuves à conserver',
    claimOwner: 'Responsable de la réclamation',
    approval: 'Voie d’approbation et de présentation',
    accountTreatment: 'Traitement de la subvention ou du compte fiduciaire',
    unspentBalance: 'Règle relative au solde non dépensé',
    officialSources: 'Sources officielles',
    sourceLedgerIntro:
      'Consultez le document officiel actuel avant d’agir. La disponibilité linguistique correspond exactement à la publication.',
    publisher: 'Éditeur',
    checked: 'Vérifiée',
    openSource: 'Ouvrir la source',
    englishOnly: 'Source en anglais seulement',
    draftWatermark: 'ÉBAUCHE',
    draftStatus: 'Document à l’état d’ébauche',
    contactLabel: 'Signaler un lien brisé au moyen du contact public du G8 du 32 GBC',
    hubEyebrow: 'Guide pratique des BNP · édition publique',
    hubHeading: 'De quoi avez-vous besoin?',
    hubIntro:
      'Indications à l’intention des membres du 32 GBC sur les biens non publics et les fonds non publics. Choisissez une tâche — le guide s’ouvre à cette étape, pas à la première page.',
    searchLabel: 'Rechercher des tâches, subventions, documents',
    searchClear: 'Effacer',
    audienceGroupLabel: 'Filtrer par public',
    audienceEveryone: 'Tout le monde',
    taskCount: (count: number) => `${count} ${count === 1 ? 'tâche' : 'tâches'}`,
    noResultsHeading: 'Aucun résultat pour cette recherche.',
    noResultsBody: 'Effacez le champ ou élargissez le filtre de public.',
    backToHub: 'Toutes les tâches',
    nextStepsHeading: 'Ensuite, la plupart des gens ont besoin de',
    progress: (completed: number, total: number) =>
      `${completed} sur ${total} ${completed === 1 ? 'terminée' : 'terminées'}`,
    progressLabel: 'Votre progression',
    progressSaved: 'Les cases cochées sont enregistrées sur cet appareil seulement.',
    progressReset: 'Réinitialiser',
    stepLabel: (index: number) => `Étape ${index}`,
    itemLabel: (index: number) => `Élément ${index}`,
  },
} as const;

const entitlementStatusLabels: Record<Locale, Record<GrantEntitlementStatus, string>> = {
  en: {
    'published-amount-or-ceiling': 'Published amount or ceiling',
    'published-formula': 'Published formula',
    'current-or-local-rate-unavailable': 'Current or local rate unavailable',
  },
  fr: {
    'published-amount-or-ceiling': 'Montant ou plafond publié',
    'published-formula': 'Formule publiée',
    'current-or-local-rate-unavailable': 'Taux actuel ou local non disponible',
  },
};

const sectionIcons = {
  'npp-and-npf': Scale,
  'before-spending': CircleDollarSign,
  'spending-npf': WalletCards,
  'alienation-of-funds': ArrowRightLeft,
  grants: Landmark,
  'existing-vendor': ReceiptText,
  'create-vendor': FileText,
  'pay-individual': Users,
  'reimbursement-checklist': ClipboardList,
  'sources-help': BookOpen,
} as const;

const sourceById = new Map(nppGuideContent.sources.map((source) => [source.id, source] as const));

const sectionsById = new Map(
  nppGuideContent.sections.map((section, index) => [section.id, { section, index }] as const),
);

const tasksById = new Map(nppTasks.map((task) => [task.id, task] as const));

const taskBandLabels: Record<Locale, Record<TaskBand, string>> = {
  en: {
    'start-here': 'Start here',
    'spend-and-pay': 'Spend and pay',
    'claim-and-reference': 'Claim and reference',
  },
  fr: {
    'start-here': 'Commencez ici',
    'spend-and-pay': 'Dépenser et payer',
    'claim-and-reference': 'Réclamer et consulter',
  },
};

const taskMatchesQuery = (
  task: TaskDefinition,
  locale: Locale,
  normalizedQuery: string,
): boolean => {
  if (!normalizedQuery) return true;

  const entry = sectionsById.get(task.sectionId);
  const haystack = [
    task.title[locale],
    task.when[locale],
    entry?.section.heading[locale] ?? '',
    ...(entry?.section.paragraphs.map((paragraph) => paragraph[locale]) ?? []),
    ...(entry?.section.bullets.map((bullet) => bullet[locale]) ?? []),
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(normalizedQuery);
};

const languageNames: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
};

const formatDate = (date: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));

const AudienceBadge = ({ audience, locale }: { audience: GuideAudience; locale: Locale }) => {
  const ui = pageUi[locale];
  const isOperator = audience === 'operators';

  return (
    <span className={`npp-audience-badge ${isOperator ? 'is-operator' : 'is-member'}`}>
      {isOperator ? <BriefcaseBusiness aria-hidden="true" /> : <Users aria-hidden="true" />}
      {isOperator ? ui.operators : ui.allMembers}
    </span>
  );
};

const AudienceTabs = ({
  value,
  onChange,
  locale,
}: {
  value: TaskAudienceFilter;
  onChange: (value: TaskAudienceFilter) => void;
  locale: Locale;
}) => {
  const ui = pageUi[locale];
  const options: { value: TaskAudienceFilter; label: string }[] = [
    { value: 'all', label: ui.audienceEveryone },
    { value: 'all-members', label: ui.allMembers },
    { value: 'operators', label: ui.operators },
  ];

  return (
    <div className="npp-audience-tabs" role="group" aria-label={ui.audienceGroupLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

const TaskSearch = ({
  value,
  onChange,
  locale,
}: {
  value: string;
  onChange: (value: string) => void;
  locale: Locale;
}) => {
  const ui = pageUi[locale];
  const inputId = 'npp-task-search';

  return (
    <div className="npp-task-search">
      <Search aria-hidden="true" />
      <label htmlFor={inputId} className="sr-only">
        {ui.searchLabel}
      </label>
      <input
        id={inputId}
        type="search"
        placeholder={ui.searchLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {value ? (
        <button type="button" onClick={() => onChange('')}>
          {ui.searchClear}
        </button>
      ) : null}
    </div>
  );
};

const taskIcons: Record<string, LucideIcon> = {
  't-understand': BookOpen,
  't-before': SearchCheck,
  't-spend': ShoppingCart,
  't-vendor': Building2,
  't-newvendor': Handshake,
  't-person': HandCoins,
  't-alienation': Gift,
  't-reimburse': ReceiptText,
  't-grants': Landmark,
  't-sources': Library,
};

const TaskCard = ({
  task,
  locale,
  onOpen,
}: {
  task: TaskDefinition;
  locale: Locale;
  onOpen: (task: TaskDefinition) => void;
}) => {
  const ui = pageUi[locale];
  const Icon = taskIcons[task.id] ?? FileText;

  return (
    <li>
      <button type="button" className="npp-task-card" onClick={() => onOpen(task)}>
        <Icon className="npp-task-card-icon" aria-hidden="true" />
        <span className="npp-task-card-body">
          <span className="npp-task-card-title">{task.title[locale]}</span>
          <span className="npp-task-card-when">{task.when[locale]}</span>
          <span className="npp-task-card-tag">
            {task.audience === 'operators' ? ui.operators : ui.allMembers}
          </span>
        </span>
      </button>
    </li>
  );
};

const TaskBandSection = ({
  band,
  tasks,
  locale,
  onOpenTask,
}: {
  band: TaskBand;
  tasks: TaskDefinition[];
  locale: Locale;
  onOpenTask: (task: TaskDefinition) => void;
}) => {
  const ui = pageUi[locale];

  if (tasks.length === 0) return null;

  return (
    <div className="npp-task-band">
      <div className="npp-task-band-heading">
        <h3>{taskBandLabels[locale][band]}</h3>
        <span>{ui.taskCount(tasks.length)}</span>
      </div>
      <ul className="npp-task-grid">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} locale={locale} onOpen={onOpenTask} />
        ))}
      </ul>
    </div>
  );
};

const TASK_BAND_ORDER: TaskBand[] = ['start-here', 'spend-and-pay', 'claim-and-reference'];

const TaskHub = ({
  locale,
  audienceFilter,
  query,
  onAudienceChange,
  onQueryChange,
  onOpenTask,
  headingRef,
}: {
  locale: Locale;
  audienceFilter: TaskAudienceFilter;
  query: string;
  onAudienceChange: (value: TaskAudienceFilter) => void;
  onQueryChange: (value: string) => void;
  onOpenTask: (task: TaskDefinition) => void;
  headingRef: RefObject<HTMLHeadingElement>;
}) => {
  const ui = pageUi[locale];
  const normalizedQuery = query.trim().toLowerCase();
  const visibleTasks = nppTasks.filter(
    (task) =>
      (audienceFilter === 'all' || task.audience === audienceFilter) &&
      taskMatchesQuery(task, locale, normalizedQuery),
  );
  const hasResults = visibleTasks.length > 0;

  return (
    <div className="npp-task-hub">
      <div className="npp-hub-hero">
        <p>{ui.hubEyebrow}</p>
        <h2 ref={headingRef} tabIndex={-1}>
          {ui.hubHeading}
        </h2>
        <p className="npp-hub-intro">{ui.hubIntro}</p>
        <div className="npp-hub-controls npp-screen-only">
          <AudienceTabs value={audienceFilter} onChange={onAudienceChange} locale={locale} />
          <TaskSearch value={query} onChange={onQueryChange} locale={locale} />
        </div>
      </div>

      {hasResults ? (
        TASK_BAND_ORDER.map((band) => (
          <TaskBandSection
            key={band}
            band={band}
            tasks={visibleTasks.filter((task) => task.band === band)}
            locale={locale}
            onOpenTask={onOpenTask}
          />
        ))
      ) : (
        <div className="npp-no-results">
          <p>{ui.noResultsHeading}</p>
          <p>{ui.noResultsBody}</p>
        </div>
      )}
    </div>
  );
};

const NextSteps = ({
  sectionId,
  locale,
  onOpenTask,
}: {
  sectionId: string;
  locale: Locale;
  onOpenTask: (task: TaskDefinition) => void;
}) => {
  const ui = pageUi[locale];
  const nextTasks = getNextSteps(sectionId)
    .map((id) => tasksById.get(id))
    .filter((task): task is TaskDefinition => Boolean(task));

  if (nextTasks.length === 0) return null;

  return (
    <div className="npp-next-steps npp-screen-only">
      <p>{ui.nextStepsHeading}</p>
      <ul>
        {nextTasks.map((task) => (
          <li key={task.id}>
            <button type="button" onClick={() => onOpenTask(task)}>
              {task.title[locale]}
              <ArrowRight aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

const TaskBackLink = ({
  locale,
  onBack,
  backRef,
}: {
  locale: Locale;
  onBack: () => void;
  backRef: RefObject<HTMLButtonElement>;
}) => {
  const ui = pageUi[locale];

  return (
    <button
      type="button"
      className="npp-detail-back npp-screen-only"
      onClick={onBack}
      ref={backRef}
    >
      <ArrowLeft aria-hidden="true" />
      {ui.backToHub}
    </button>
  );
};

const SourceReferences = ({ sourceIds, locale }: { sourceIds: string[]; locale: Locale }) => {
  const ui = pageUi[locale];

  return (
    <div className="npp-reference-strip">
      <BookOpen aria-hidden="true" />
      <div>
        <p>{ui.sourceReferences}</p>
        <ul>
          {sourceIds.map((sourceId) => {
            const source = sourceById.get(sourceId);

            return source ? (
              <li key={sourceId}>
                <a href={`#source-${sourceId}`}>{source.title[locale]}</a>
              </li>
            ) : null;
          })}
        </ul>
      </div>
    </div>
  );
};

const GuidanceChecklist = ({ section, locale }: { section: GuideSection; locale: Locale }) => {
  const ui = pageUi[locale];
  const { completed, setItem, reset } = useChecklistProgress(section.id);
  const isSteps = section.listPresentation === 'steps';
  const total = section.bullets.length;
  const completedCount = section.bullets.filter((_, index) => completed.has(String(index))).length;
  const percent = total === 0 ? 0 : Math.round((completedCount / total) * 100);
  const List = isSteps ? 'ol' : 'ul';

  return (
    <div className="npp-track" data-complete={completedCount === total ? 'true' : undefined}>
      <div className="npp-track-header">
        <p className="npp-track-label">{ui.progressLabel}</p>
        <p role="status" aria-live="polite" className="npp-track-status">
          {ui.progress(completedCount, total)}
        </p>
      </div>
      <div
        className="npp-track-bar"
        role="progressbar"
        aria-label={ui.progressLabel}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={completedCount}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      <List className="npp-track-list">
        {section.bullets.map((bullet, index) => {
          const id = String(index);
          const inputId = `${section.id}-item-${index}`;
          const done = completed.has(id);
          return (
            <li key={bullet.en} data-done={done ? 'true' : undefined}>
              <label htmlFor={inputId} className="npp-track-item">
                <Checkbox
                  id={inputId}
                  checked={done}
                  aria-label={bullet[locale]}
                  onCheckedChange={(checked) => setItem(id, checked === true)}
                />
                <span className="npp-track-marker" aria-hidden="true">
                  {isSteps ? String(index + 1).padStart(2, '0') : '—'}
                </span>
                <span className="npp-track-text">{bullet[locale]}</span>
              </label>
            </li>
          );
        })}
      </List>
      <div className="npp-track-footer">
        <p>{ui.progressSaved}</p>
        <button type="button" onClick={reset} disabled={completedCount === 0}>
          {ui.progressReset}
        </button>
      </div>
    </div>
  );
};

const GuidanceBody = ({ section, locale }: { section: GuideSection; locale: Locale }) => {
  const ui = pageUi[locale];
  const GuidanceList = section.listPresentation === 'steps' ? 'ol' : 'ul';

  return (
    <>
      {section.paragraphs.map((paragraph) => (
        <p className="npp-lede" key={paragraph.en}>
          {paragraph[locale]}
        </p>
      ))}

      {section.examples?.length ? (
        <div className="npp-examples-block">
          <h3>{ui.examplesHeading}</h3>
          <ul className="npp-examples-list">
            {section.examples.map((example) => (
              <li key={example.en}>{example[locale]}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {section.bullets.length > 0 && section.trackable ? (
        <GuidanceChecklist section={section} locale={locale} />
      ) : section.bullets.length > 0 ? (
        <GuidanceList className="npp-guidance-list">
          {section.bullets.map((bullet) => (
            <li key={bullet.en}>{bullet[locale]}</li>
          ))}
        </GuidanceList>
      ) : null}

      {section.warnings.map((warning) => (
        <div className="npp-warning" key={warning.en}>
          <AlertTriangle aria-hidden="true" />
          <div>
            <strong>{ui.caution}</strong>
            <p>{warning[locale]}</p>
          </div>
        </div>
      ))}
    </>
  );
};

const GrantField = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="npp-grant-field">
    <dt>{label}</dt>
    <dd>{children}</dd>
  </div>
);

const GrantCard = ({
  grant,
  locale,
  index,
  isHidden,
}: {
  grant: GrantGuide;
  locale: Locale;
  index: number;
  isHidden: boolean;
}) => {
  const ui = pageUi[locale];
  const entitlement = grant.entitlement;
  const requirements = grant.requirements;

  return (
    <article
      className="npp-grant-card"
      id={`grant-${grant.id}`}
      aria-labelledby={`grant-${grant.id}-heading`}
      hidden={isHidden}
    >
      <header>
        <p>
          {ui.grantRecord} {String(index + 1).padStart(2, '0')}
        </p>
        <h3 id={`grant-${grant.id}-heading`}>{grant.name[locale]}</h3>
      </header>
      {entitlement && requirements ? (
        <div className="npp-grant-summary">
          <section
            className="npp-entitlement-summary"
            aria-labelledby={`grant-${grant.id}-amount-heading`}
          >
            <p className="npp-entitlement-status">
              {entitlementStatusLabels[locale][entitlement.status]}
            </p>
            <h4 id={`grant-${grant.id}-amount-heading`}>{ui.grantAmount}</h4>
            <p className="npp-entitlement-amount">{entitlement.amountOrFormula[locale]}</p>
            <p className="npp-entitlement-note">{entitlement.note[locale]}</p>
          </section>
          <section
            className="npp-requirements-summary"
            aria-labelledby={`grant-${grant.id}-requirements-heading`}
          >
            <h4 id={`grant-${grant.id}-requirements-heading`}>{ui.requirementsAtGlance}</h4>
            <ul>
              {requirements.map((requirement) => (
                <li key={requirement.en}>{requirement[locale]}</li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
      <dl>
        <GrantField label={ui.fundingSource}>
          <span className={`npp-funding-tag is-${grant.fundingSource}`}>
            {grant.fundingSource === 'npp' ? ui.nppFunding : ui.publicFunding}
          </span>
        </GrantField>
        <GrantField label={ui.eligibleApplicant}>{grant.eligibleApplicant[locale]}</GrantField>
        <GrantField label={ui.purpose}>{grant.purpose[locale]}</GrantField>
        <GrantField label={ui.timing}>{grant.timing[locale]}</GrantField>
        <GrantField label={ui.evidence}>
          <ul>
            {grant.evidence.map((evidence) => (
              <li key={evidence.en}>{evidence[locale]}</li>
            ))}
          </ul>
        </GrantField>
        <GrantField label={ui.claimOwner}>{grant.claimOwner[locale]}</GrantField>
        <GrantField label={ui.approval}>{grant.approvalAndSubmission[locale]}</GrantField>
        <GrantField label={ui.accountTreatment}>{grant.accountTreatment[locale]}</GrantField>
        <GrantField label={ui.unspentBalance}>{grant.unspentBalanceRule[locale]}</GrantField>
      </dl>
      <SourceReferences sourceIds={grant.sourceIds} locale={locale} />
      <p className="npp-grant-checked">
        {nppGuideContent.officialSourcesCheckedLabel[locale]}:{' '}
        <time dateTime={nppGuideContent.officialSourcesCheckedOn}>
          {formatDate(nppGuideContent.officialSourcesCheckedOn, locale)}
        </time>
      </p>
    </article>
  );
};

const GrantExplorer = ({ locale }: { locale: Locale }) => {
  const ui = pageUi[locale];
  const [selectedGrantId, setSelectedGrantId] = useState(() => nppGuideContent.grants[0]?.id ?? '');
  const selectedGrantIndex = nppGuideContent.grants.findIndex(
    (grant) => grant.id === selectedGrantId,
  );
  const selectedGrant = nppGuideContent.grants[selectedGrantIndex];
  const selectorHelperId = 'npp-grant-selector-helper';
  const selectorStatusId = 'npp-grant-selector-status';

  return (
    <>
      <div className="npp-grant-selector npp-screen-only">
        <label htmlFor="npp-grant-selector">{ui.grantSelectorLabel}</label>
        <p className="npp-grant-selector-helper" id={selectorHelperId}>
          {ui.grantSelectorHelper}
        </p>
        <div className="npp-grant-select-frame">
          <select
            id="npp-grant-selector"
            value={selectedGrantId}
            aria-controls={selectedGrant ? `grant-${selectedGrant.id}` : undefined}
            aria-describedby={`${selectorHelperId} ${selectorStatusId}`}
            disabled={nppGuideContent.grants.length === 0}
            onChange={(event) => setSelectedGrantId(event.target.value)}
          >
            {nppGuideContent.grants.map((grant) => (
              <option key={grant.id} value={grant.id}>
                {grant.name[locale]}
              </option>
            ))}
          </select>
          <span className="npp-grant-select-endcap" aria-hidden="true">
            <ChevronDown aria-hidden="true" />
          </span>
        </div>
        <p
          className="npp-grant-selector-status"
          id={selectorStatusId}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {ui.grantStatus(selectedGrantIndex + 1, nppGuideContent.grants.length)}
        </p>
      </div>
      <div className="npp-grant-grid">
        {nppGuideContent.grants.map((grant, grantIndex) => (
          <GrantCard
            key={grant.id}
            grant={grant}
            locale={locale}
            index={grantIndex}
            isHidden={grant.id !== selectedGrantId}
          />
        ))}
      </div>
    </>
  );
};

const OfficialSourceEntry = ({ source, locale }: { source: OfficialSource; locale: Locale }) => {
  const ui = pageUi[locale];
  const availableLanguages = (Object.keys(source.urls) as Locale[]).filter(
    (language) => source.urls[language],
  );

  return (
    <li className="npp-source-entry" id={`source-${source.id}`}>
      <div className="npp-source-copy">
        <h3>{source.title[locale]}</h3>
        <dl>
          <div>
            <dt>{ui.publisher}</dt>
            <dd>{source.publisher[locale]}</dd>
          </div>
          <div>
            <dt>{ui.checked}</dt>
            <dd>
              <time dateTime={source.checkedOn}>{formatDate(source.checkedOn, locale)}</time>
            </dd>
          </div>
        </dl>
        {availableLanguages.length === 1 && availableLanguages[0] === 'en' ? (
          <p className="npp-language-note">{ui.englishOnly}</p>
        ) : null}
      </div>
      <div className="npp-source-links">
        {availableLanguages.map((language) => (
          <a key={language} href={source.urls[language]} target="_blank" rel="noopener noreferrer">
            <span>{`${ui.openSource} — ${languageNames[language]}`}</span>
            <ExternalLink aria-hidden="true" />
          </a>
        ))}
      </div>
    </li>
  );
};

const OfficialSources = ({ locale }: { locale: Locale }) => {
  const ui = pageUi[locale];

  return (
    <footer className="npp-source-ledger" aria-labelledby="official-sources-heading">
      <div className="npp-source-ledger-heading">
        <p>{nppGuideContent.officialSourcesCheckedLabel[locale]}</p>
        <h2 id="official-sources-heading">{ui.officialSources}</h2>
        <p>{ui.sourceLedgerIntro}</p>
      </div>
      <ol>
        {nppGuideContent.sources.map((source) => (
          <OfficialSourceEntry key={source.id} source={source} locale={locale} />
        ))}
      </ol>
      <a
        className="npp-contact-link"
        href={`mailto:${SITE_CONFIG.CONTACT_EMAIL}?subject=32%20CBG%20G8%20website%20broken%20link`}
      >
        <Mail aria-hidden="true" />
        {ui.contactLabel}
      </a>
    </footer>
  );
};

const StandardSection = ({
  section,
  locale,
  index,
}: {
  section: GuideSection;
  locale: Locale;
  index: number;
}) => {
  const ui = pageUi[locale];
  const SectionIcon = sectionIcons[section.id as keyof typeof sectionIcons] ?? FileText;

  return (
    <section
      id={section.id}
      className="npp-guide-section"
      aria-labelledby={`${section.id}-heading`}
    >
      <div className="npp-section-heading">
        <div className="npp-section-icon" aria-hidden="true">
          <SectionIcon />
        </div>
        <div className="npp-section-title">
          <p>
            {ui.fieldNote} {String(index + 1).padStart(2, '0')}
          </p>
          <h2 id={`${section.id}-heading`}>{section.heading[locale]}</h2>
        </div>
        <AudienceBadge audience={section.audience} locale={locale} />
      </div>
      <div className="npp-section-body">
        <GuidanceBody section={section} locale={locale} />
        {section.id === 'grants' ? <GrantExplorer locale={locale} /> : null}
        <SourceReferences sourceIds={section.sourceIds} locale={locale} />
        {section.id === 'sources-help' ? <OfficialSources locale={locale} /> : null}
      </div>
    </section>
  );
};

const ChecklistSection = ({
  section,
  locale,
  index,
}: {
  section: GuideSection;
  locale: Locale;
  index: number;
}) => {
  const ui = pageUi[locale];

  return (
    <div id={section.id} className="npp-guide-section npp-checklist-shell">
      <div className="npp-section-heading npp-checklist-marker">
        <div className="npp-section-icon" aria-hidden="true">
          <ClipboardList />
        </div>
        <p>
          {ui.fieldNote} {String(index + 1).padStart(2, '0')}
        </p>
        <AudienceBadge audience={section.audience} locale={locale} />
      </div>
      <div className="npp-section-body">
        <ReimbursementChecklist />
        {section.bullets.length > 0 || section.warnings.length > 0 ? (
          <div className="npp-checklist-notes">
            {section.bullets.length > 0 ? (
              <ul className="npp-guidance-list">
                {section.bullets.map((bullet) => (
                  <li key={bullet.en}>{bullet[locale]}</li>
                ))}
              </ul>
            ) : null}
            {section.warnings.map((warning) => (
              <div className="npp-warning" key={warning.en}>
                <AlertTriangle aria-hidden="true" />
                <div>
                  <strong>{ui.caution}</strong>
                  <p>{warning[locale]}</p>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        <SourceReferences sourceIds={section.sourceIds} locale={locale} />
      </div>
    </div>
  );
};

const NPPPage = () => {
  const { locale } = useLocale();
  const { theme, toggleTheme } = useTheme();
  const { hash } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const ui = pageUi[locale];

  const taskId = searchParams.get('task');
  const audienceFilter: TaskAudienceFilter =
    (searchParams.get('aud') as TaskAudienceFilter | null) ?? 'all';
  const query = searchParams.get('q') ?? '';
  const activeTask = taskId ? tasksById.get(taskId) : undefined;
  const activeSectionEntry = activeTask ? sectionsById.get(activeTask.sectionId) : undefined;

  const backRef = useRef<HTMLButtonElement>(null);
  const hubHeadingRef = useRef<HTMLHeadingElement>(null);
  const hasMountedRef = useRef(false);

  useLayoutEffect(() => {
    if (hash) return;

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });

    const appRoot = document.getElementById('root');
    if (appRoot) appRoot.scrollTop = 0;
  }, [hash]);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    if (activeTask) backRef.current?.focus();
    else hubHeadingRef.current?.focus();
  }, [taskId, activeTask]);

  const openTask = (task: TaskDefinition) => {
    const next = new URLSearchParams(searchParams);
    next.set('task', task.id);
    setSearchParams(next);
  };

  const backToHub = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('task');
    setSearchParams(next);
  };

  const setAudienceFilter = (value: TaskAudienceFilter) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'all') next.delete('aud');
    else next.set('aud', value);
    setSearchParams(next, { replace: true });
  };

  const setQuery = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('q', value);
    else next.delete('q');
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="npp-page" id="npp-top">
      <div className="npp-draft-watermark" aria-hidden="true">
        {ui.draftWatermark}
      </div>

      <a className="npp-skip-link" href="#npp-main">
        {ui.skip}
      </a>

      <header className="npp-masthead">
        <div className="npp-command-bar npp-screen-only">
          <Link to={`/?lang=${locale}`} className="npp-return-control">
            <ArrowLeft aria-hidden="true" />
            <span>{ui.returnToLanding}</span>
          </Link>
          <div
            className="npp-page-controls"
            aria-label={locale === 'fr' ? 'Commandes de page' : 'Page controls'}
          >
            <LocaleToggle />
            <button
              type="button"
              className="npp-theme-control"
              onClick={toggleTheme}
              aria-label={ui.switchTheme[theme]}
            >
              {theme === 'light' ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
            </button>
          </div>
        </div>

        <div className="npp-masthead-grid">
          <img
            className="npp-publication-mark"
            src={brigadeBadge}
            alt=""
            width="865"
            height="1006"
          />
          <div className="npp-hero-copy">
            <p className="npp-unit-line">{ui.unit}</p>
            <p className="npp-publication-line">{ui.publication}</p>
            <p className="sr-only">{ui.draftStatus}</p>
            <h1>{nppGuideContent.title[locale]}</h1>
            <p className="npp-hero-description">{nppGuideContent.description[locale]}</p>
          </div>
          <dl className="npp-issue-data">
            <div>
              <dt>{ui.audience}</dt>
              <dd>{ui.audienceValue}</dd>
            </div>
            <div>
              <dt>{ui.sourceStatus}</dt>
              <dd>
                {nppGuideContent.officialSourcesCheckedLabel[locale]}{' '}
                <time dateTime={nppGuideContent.officialSourcesCheckedOn}>
                  {formatDate(nppGuideContent.officialSourcesCheckedOn, locale)}
                </time>
              </dd>
            </div>
          </dl>
        </div>

        <div className="npp-scope-strip">
          <Info aria-hidden="true" />
          <strong>{ui.scope}</strong>
          <span>{nppGuideContent.disclaimer[locale]}</span>
        </div>
      </header>

      <main id="npp-main" tabIndex={-1}>
        <div className="npp-guide-layout">
          <div className="npp-guide-document">
            {activeTask && activeSectionEntry ? (
              <>
                <TaskBackLink locale={locale} onBack={backToHub} backRef={backRef} />
                {activeTask.view === 'checklist' ? (
                  <ChecklistSection
                    section={activeSectionEntry.section}
                    locale={locale}
                    index={activeSectionEntry.index}
                  />
                ) : (
                  <StandardSection
                    section={activeSectionEntry.section}
                    locale={locale}
                    index={activeSectionEntry.index}
                  />
                )}
                {activeTask.view === 'section' ? (
                  <NextSteps
                    sectionId={activeTask.sectionId}
                    locale={locale}
                    onOpenTask={openTask}
                  />
                ) : null}
              </>
            ) : (
              <TaskHub
                locale={locale}
                audienceFilter={audienceFilter}
                query={query}
                onAudienceChange={setAudienceFilter}
                onQueryChange={setQuery}
                onOpenTask={openTask}
                headingRef={hubHeadingRef}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default NPPPage;

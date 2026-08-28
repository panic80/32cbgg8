import type { ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowUp,
  BookOpen,
  Check,
  ExternalLink,
  FileCheck2,
  FileText,
  Landmark,
  Mail,
  Moon,
  Scale,
  ShieldCheck,
  Sun,
  Users,
  WalletCards,
} from 'lucide-react';
import { LocaleToggle } from '@/components/LocaleToggle';
import { EnhancedBackButton } from '@/components/ui/enhanced-back-button';
import { SITE_CONFIG } from '@/constants/siteConfig';
import { useTheme } from '@/context/ThemeContext';
import { useLocale } from '@/i18n/LocaleContext';
import '@/styles/npp.css';
import { nppGuideContent } from './nppContent';
import { ReimbursementChecklist } from './ReimbursementChecklist';
import type { GrantGuide, GuideAudience, GuideSection, Locale, OfficialSource } from './types';

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
    guideContents: 'Guide contents',
    guideJumpLinks: 'Guide jump links',
    contentsHeading: 'In this guide',
    jumpHeading: 'Jump to a field note',
    fieldNote: 'Field note',
    allMembers: 'All members',
    operators: 'NPP operators',
    caution: 'Stop and confirm',
    sourceReferences: 'Official references for this field note',
    grantRecord: 'Funding record',
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
    contactLabel: 'Report a broken link through the public 32 CBG G8 contact',
    backToTop: 'Back to top',
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
    guideContents: 'Sommaire du guide',
    guideJumpLinks: 'Liens rapides du guide',
    contentsHeading: 'Dans ce guide',
    jumpHeading: 'Accéder à une fiche',
    fieldNote: 'Fiche',
    allMembers: 'Tous les membres',
    operators: 'Opérateurs BNP',
    caution: 'Arrêtez-vous et confirmez',
    sourceReferences: 'Références officielles pour cette fiche',
    grantRecord: 'Dossier de financement',
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
    contactLabel: 'Signaler un lien brisé au moyen du contact public du G8 du 32 GBC',
    backToTop: 'Retour en haut',
  },
} as const;

const sectionIcons = {
  'npp-and-npf': Scale,
  'before-spending': ShieldCheck,
  'spending-npf': WalletCards,
  grants: Landmark,
  'existing-vendor': FileCheck2,
  'create-vendor': FileText,
  'pay-individual': Users,
  'reimbursement-checklist': Check,
  'sources-help': BookOpen,
} as const;

const sourceById = new Map(nppGuideContent.sources.map((source) => [source.id, source] as const));

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
      {isOperator ? <ShieldCheck aria-hidden="true" /> : <Users aria-hidden="true" />}
      {isOperator ? ui.operators : ui.allMembers}
    </span>
  );
};

const GuideNavigation = ({
  locale,
  ariaLabel,
  className,
}: {
  locale: Locale;
  ariaLabel: string;
  className: string;
}) => (
  <nav aria-label={ariaLabel} className={className}>
    <ol>
      {nppGuideContent.sections.map((section, index) => (
        <li key={section.id}>
          <a href={`#${section.id}`}>
            <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            <span>{section.heading[locale]}</span>
          </a>
        </li>
      ))}
    </ol>
  </nav>
);

const SourceReferences = ({ sourceIds, locale }: { sourceIds: string[]; locale: Locale }) => {
  const ui = pageUi[locale];

  return (
    <aside className="npp-reference-strip" aria-label={ui.sourceReferences}>
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
    </aside>
  );
};

const GuidanceBody = ({ section, locale }: { section: GuideSection; locale: Locale }) => {
  const ui = pageUi[locale];

  return (
    <>
      {section.paragraphs.map((paragraph) => (
        <p className="npp-lede" key={paragraph.en}>
          {paragraph[locale]}
        </p>
      ))}

      {section.bullets.length > 0 ? (
        <ul className="npp-task-list">
          {section.bullets.map((bullet) => (
            <li key={bullet.en}>
              <span aria-hidden="true">
                <Check />
              </span>
              <span>{bullet[locale]}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {section.warnings.map((warning) => (
        <aside className="npp-warning" key={warning.en} aria-label={ui.caution}>
          <AlertTriangle aria-hidden="true" />
          <div>
            <strong>{ui.caution}</strong>
            <p>{warning[locale]}</p>
          </div>
        </aside>
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
}: {
  grant: GrantGuide;
  locale: Locale;
  index: number;
}) => {
  const ui = pageUi[locale];

  return (
    <article className="npp-grant-card" id={`grant-${grant.id}`}>
      <header>
        <p>
          {ui.grantRecord} {String(index + 1).padStart(2, '0')}
        </p>
        <h3>{grant.name[locale]}</h3>
      </header>
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
        {section.id === 'grants' ? (
          <div className="npp-grant-grid">
            {nppGuideContent.grants.map((grant, grantIndex) => (
              <GrantCard key={grant.id} grant={grant} locale={locale} index={grantIndex} />
            ))}
          </div>
        ) : null}
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
    <section
      id={section.id}
      className="npp-guide-section npp-checklist-shell"
      aria-labelledby="reimbursement-checklist-heading"
    >
      <div className="npp-section-heading npp-checklist-marker">
        <div className="npp-section-icon" aria-hidden="true">
          <Check />
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
              <ul className="npp-task-list">
                {section.bullets.map((bullet) => (
                  <li key={bullet.en}>
                    <span aria-hidden="true">
                      <Check />
                    </span>
                    <span>{bullet[locale]}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {section.warnings.map((warning) => (
              <aside className="npp-warning" key={warning.en} aria-label={ui.caution}>
                <AlertTriangle aria-hidden="true" />
                <div>
                  <strong>{ui.caution}</strong>
                  <p>{warning[locale]}</p>
                </div>
              </aside>
            ))}
          </div>
        ) : null}
        <SourceReferences sourceIds={section.sourceIds} locale={locale} />
      </div>
    </section>
  );
};

const NPPPage = () => {
  const { locale } = useLocale();
  const { theme, toggleTheme } = useTheme();
  const ui = pageUi[locale];

  return (
    <div className="npp-page" id="npp-top">
      <a className="npp-skip-link" href="#npp-main">
        {ui.skip}
      </a>

      <header className="npp-masthead">
        <div className="npp-command-bar npp-screen-only">
          <EnhancedBackButton
            to={`/?lang=${locale}`}
            label={ui.returnToLanding}
            variant="minimal"
            size="sm"
            className="npp-return-control"
          />
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
          <div className="npp-publication-mark" aria-hidden="true">
            <span>32</span>
            <span>CBG</span>
            <span>G8</span>
          </div>
          <div className="npp-hero-copy">
            <p className="npp-unit-line">{ui.unit}</p>
            <p className="npp-publication-line">{ui.publication}</p>
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
          <ShieldCheck aria-hidden="true" />
          <strong>{ui.scope}</strong>
          <span>{nppGuideContent.disclaimer[locale]}</span>
        </div>
      </header>

      <main id="npp-main" tabIndex={-1}>
        <div className="npp-guide-layout">
          <aside className="npp-contents-rail npp-screen-only">
            <div>
              <p>{ui.publication}</p>
              <h2>{ui.contentsHeading}</h2>
              <GuideNavigation
                locale={locale}
                ariaLabel={ui.guideContents}
                className="npp-guide-navigation"
              />
            </div>
          </aside>

          <div className="npp-guide-document">
            <div className="npp-mobile-jumps npp-screen-only">
              <p>{ui.jumpHeading}</p>
              <GuideNavigation
                locale={locale}
                ariaLabel={ui.guideJumpLinks}
                className="npp-jump-navigation"
              />
            </div>

            {nppGuideContent.sections.map((section, index) =>
              section.id === 'reimbursement-checklist' ? (
                <ChecklistSection
                  key={section.id}
                  section={section}
                  locale={locale}
                  index={index}
                />
              ) : (
                <StandardSection key={section.id} section={section} locale={locale} index={index} />
              ),
            )}

            <a className="npp-back-to-top npp-screen-only" href="#npp-top">
              <ArrowUp aria-hidden="true" />
              {ui.backToTop}
            </a>
          </div>
        </div>
      </main>
    </div>
  );
};

export default NPPPage;

import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/context/ThemeContext';
import NPPPage from '..';

const localeState = vi.hoisted(() => ({ current: 'en' as 'en' | 'fr' }));
let scrollToSpy: ReturnType<typeof vi.spyOn>;

vi.mock('@/i18n/LocaleContext', () => ({
  useLocale: () => ({
    locale: localeState.current,
    setLocale: (locale: 'en' | 'fr') => {
      localeState.current = locale;
    },
  }),
}));

const renderGuide = (locale: 'en' | 'fr', hash = '') => {
  localeState.current = locale;

  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[`/npp?lang=${locale}${hash}`]}>
        <NPPPage />
      </MemoryRouter>
    </ThemeProvider>,
  );
};

const localeCases = [
  {
    locale: 'en' as const,
    title: 'NPP / NPF Guide',
    skipLabel: 'Skip to guide',
    contentsLabel: 'Guide contents',
    jumpLinksLabel: 'Guide jump links',
    returnLabel: 'Return to landing',
    disclaimer:
      'This page is a plain-language aid, not financial authority or approval. Current legislation, CDS delegations, CFMWS policy, grant-specific instructions, and local NPP Accounting direction prevail.',
    openSource: 'Open source',
    grantSelectorLabel: 'Choose a funding record',
    audienceLabels: ['All members', 'NPP operators'],
    sectionHeadings: [
      ['npp-and-npf', 'What NPP and NPF are—and are not'],
      ['before-spending', 'Before spending'],
      ['spending-npf', 'How to spend NPF'],
      ['alienation-of-funds', 'Alienation of NPP: a separate approval path'],
      ['grants', 'Grant explorer'],
      ['existing-vendor', 'Pay an existing vendor'],
      ['create-vendor', 'Create a vendor'],
      ['pay-individual', 'Pay an individual'],
      ['reimbursement-checklist', 'Reimbursement checklist'],
      ['sources-help', 'Sources and help'],
    ],
    contentChecks: [
      ['npp-and-npf', 'Non-Public Funds (NPF) are only the money component of NPP'],
      ['before-spending', 'Confirm the activity provides a collective authorized NPP benefit'],
      ['spending-npf', 'Execute any required contract before work starts'],
      ['alienation-of-funds', 'Alienation is not routine purchasing'],
      ['existing-vendor', 'internal NPP-to-NPP payment'],
      ['create-vendor', 'This site does not collect supplier or payment information'],
      [
        'pay-individual',
        'did the individual purchase something from a third party, or did the individual personally provide goods or services?',
      ],
      [
        'reimbursement-checklist',
        'Completion is not approval, proof of submission, or a guarantee of reimbursement',
      ],
      [
        'sources-help',
        'Local 32 CBG forms and routing will be added only after approved documents are supplied',
      ],
    ],
    grantNames: [
      'Unit internal NPP funding',
      'CANEX/SISIP dividend distribution',
      'Reserve PFMG',
      'Reserve Organizational Grant',
      'Reserve Contingency Grant',
      'Band Grant',
      'Band Uniform Grant',
      'Kilted Order Grant',
      'Other applicable ceremonial grant',
    ],
    progress: '0 of 15 complete',
    sourceHeading: 'Official sources',
  },
  {
    locale: 'fr' as const,
    title: 'Guide des BNP / FNP',
    skipLabel: 'Aller au guide',
    contentsLabel: 'Sommaire du guide',
    jumpLinksLabel: 'Liens rapides du guide',
    returnLabel: 'Retour à l’accueil',
    disclaimer:
      'Cette page est un outil en langage clair; elle ne constitue ni une autorité financière ni une approbation. Les lois en vigueur, les délégations du CEMD, les politiques des SBMFC, les directives propres aux subventions et les directives comptables locales des BNP ont préséance.',
    openSource: 'Ouvrir la source',
    grantSelectorLabel: 'Choisir un dossier de financement',
    audienceLabels: ['Tous les membres', 'Opérateurs BNP'],
    sectionHeadings: [
      ['npp-and-npf', 'Ce que sont les BNP et les FNP — et ce qu’ils ne sont pas'],
      ['before-spending', 'Avant de dépenser'],
      ['spending-npf', 'Comment dépenser les FNP'],
      ['alienation-of-funds', 'Aliénation des BNP : une voie d’approbation distincte'],
      ['grants', 'Répertoire des subventions'],
      ['existing-vendor', 'Payer un fournisseur existant'],
      ['create-vendor', 'Créer un fournisseur'],
      ['pay-individual', 'Payer une personne'],
      ['reimbursement-checklist', 'Liste de contrôle pour le remboursement'],
      ['sources-help', 'Sources et aide'],
    ],
    contentChecks: [
      ['npp-and-npf', 'Les fonds non publics (FNP) ne sont que la composante monétaire des BNP'],
      ['before-spending', 'Confirmez que l’activité procure un avantage collectif autorisé'],
      ['spending-npf', 'Signez tout contrat requis avant le début des travaux'],
      ['alienation-of-funds', 'L’aliénation n’est pas un achat courant'],
      ['existing-vendor', 'paiement interne entre entités BNP'],
      [
        'create-vendor',
        'Ce site ne recueille aucun renseignement sur les fournisseurs ni sur les paiements',
      ],
      [
        'pay-individual',
        'la personne a-t-elle acheté quelque chose auprès d’un tiers ou a-t-elle elle-même fourni des biens ou des services?',
      ],
      [
        'reimbursement-checklist',
        'Son achèvement ne constitue ni une approbation, ni une preuve de présentation, ni une garantie de remboursement',
      ],
      [
        'sources-help',
        'Les formulaires et les voies d’acheminement locaux du 32 GBC seront ajoutés seulement après la fourniture de documents approuvés',
      ],
    ],
    grantNames: [
      'Financement interne BNP de l’unité',
      'Distribution de dividendes CANEX/SISIP',
      'PFMG de la Réserve',
      'Subvention organisationnelle de la Réserve',
      'Subvention pour imprévus de la Réserve',
      'Subvention aux musiques',
      'Subvention pour les uniformes de musique',
      'Subvention pour la tenue écossaise',
      'Autre subvention cérémonielle applicable',
    ],
    progress: '0 sur 15 terminées',
    sourceHeading: 'Sources officielles',
  },
];

const expectedSources = [
  {
    id: 'national-defence-act',
    title: {
      en: 'National Defence Act, sections 38–41',
      fr: 'Loi sur la défense nationale, articles 38 à 41',
    },
    links: [
      {
        language: 'English',
        href: 'https://laws-lois.justice.gc.ca/eng/acts/N-5/page-4.html',
      },
      {
        language: 'Français',
        href: 'https://laws-lois.justice.gc.ca/fra/lois/n-5/page-4.html',
      },
    ],
  },
  {
    id: 'daod-9003-1',
    title: {
      en: 'DAOD 9003-1, Non-Public Property',
      fr: 'DOAD 9003-1, Biens non publics',
    },
    links: [
      {
        language: 'English',
        href: 'https://www.canada.ca/en/department-national-defence/corporate/policies-standards/defence-administrative-orders-directives/9000-series/9003/9003-1-non-public-property.html',
      },
      {
        language: 'Français',
        href: 'https://www.canada.ca/fr/ministere-defense-nationale/organisation/politiques-normes/directives-ordonnances-administratives-defense/serie-9000/9003/9003-1-biens-non-publics.html',
      },
    ],
  },
  {
    id: 'cds-npp-delegation',
    title: {
      en: 'CDS Delegation of Authorities for Financial Administration of NPP',
      fr: 'Délégation des pouvoirs du CEMD pour l’administration financière des BNP',
    },
    links: [
      {
        language: 'English',
        href: 'https://cfmws.ca/CFMWS/media/images/documents/8.0%20About%20Us/8.4%20Policies%20and%20Publications/8.4.5/Policies/DelegationofAuthorities_e-18Jun26.pdf',
      },
      {
        language: 'Français',
        href: 'https://cfmws.ca/CFMWS/media/images/documents/8.0%20About%20Us/8.4%20Policies%20and%20Publications/8.4.5/Policies/DelegationofAuthorities_e-18Jun26.pdf',
      },
    ],
  },
  {
    id: 'afn105-grants',
    title: {
      en: 'A-FN-105 Chapter 10, Grants',
      fr: 'A-FN-105, chapitre 10, Subventions',
    },
    links: [
      {
        language: 'English',
        href: 'https://cfmws.ca/CFMWS/media/images/documents/8.0%20About%20Us/8.4%20Policies%20and%20Publications/8.4.5/Policies/AF-N-105/Chap10_e.pdf',
      },
    ],
  },
  {
    id: 'afn105-accounts-payable',
    title: {
      en: 'A-FN-105 Chapter 19, Accounts Payable',
      fr: 'A-FN-105, chapitre 19, Comptes créditeurs',
    },
    links: [
      {
        language: 'English',
        href: 'https://cfmws.ca/CFMWS/media/images/documents/8.0%20About%20Us/8.4%20Policies%20and%20Publications/8.4.5/Policies/AF-N-105/Chap19_e.pdf',
      },
    ],
  },
  {
    id: 'afn105-non-employer-payments',
    title: {
      en: 'A-FN-105 Chapter 32, Non-employer Payments',
      fr: 'A-FN-105, chapitre 32, Paiements à des non-employés',
    },
    links: [
      {
        language: 'English',
        href: 'https://cfmws.ca/CFMWS/media/images/documents/8.0%20About%20Us/8.4%20Policies%20and%20Publications/8.4.5/Policies/AF-N-105/chap32_e.pdf',
      },
    ],
  },
  {
    id: 'npp-contracting-policy',
    title: {
      en: 'Current Non-Public Property Contracting Policy',
      fr: 'Politique actuelle de passation des marchés des biens non publics',
    },
    links: [
      {
        language: 'English',
        href: 'https://cfmws.ca/about-us/policies-and-publications/procurement-and-contracting/non-public-property-contracting-policy',
      },
      {
        language: 'Français',
        href: 'https://sbmfc.ca/a-propos/politiques-et-publications/approvisionnement-et-passation-de-marches/politique-de-passation-de-marches-des-biens-non-publics',
      },
    ],
  },
  {
    id: 'contract-for-services',
    title: {
      en: 'Current Contract for Services operational page',
      fr: 'Page opérationnelle actuelle sur le contrat de services',
    },
    links: [
      {
        language: 'English',
        href: 'https://cfmws.ca/about-us/policies-and-publications/procurement-and-contracting/contract-for-services',
      },
      {
        language: 'Français',
        href: 'https://sbmfc.ca/a-propos/politiques-et-publications/approvisionnement-et-passation-de-marches/contrats-de-services',
      },
    ],
  },
  {
    id: 'afn105-credit-cards',
    title: {
      en: 'A-FN-105 Chapter 12, Credit Cards',
      fr: 'A-FN-105, chapitre 12, Cartes de crédit',
    },
    links: [
      {
        language: 'English',
        href: 'https://cfmws.ca/CFMWS/media/images/documents/8.0%20About%20Us/8.4%20Policies%20and%20Publications/8.4.5/Policies/AF-N-105/Chap12_e.pdf',
      },
    ],
  },
] as const;

beforeEach(() => {
  scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
});

afterEach(() => {
  document.getElementById('root')?.remove();
  localeState.current = 'en';
  window.localStorage.clear();
  scrollToSpy.mockRestore();
});

describe('NPPPage scroll position', () => {
  it('resets the window and application root scroll when mounted without a hash', () => {
    const appRoot = document.createElement('div');
    appRoot.id = 'root';
    appRoot.scrollTop = 320;
    document.body.appendChild(appRoot);

    renderGuide('en');

    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'auto' });
    expect(appRoot.scrollTop).toBe(0);
  });

  it('preserves scroll state when mounted with a section hash', () => {
    const appRoot = document.createElement('div');
    appRoot.id = 'root';
    appRoot.scrollTop = 320;
    document.body.appendChild(appRoot);

    renderGuide('en', '#before-spending');

    expect(scrollToSpy).not.toHaveBeenCalled();
    expect(appRoot.scrollTop).toBe(320);
  });
});

describe('NPPPage visual semantics', () => {
  it('uses the canonical decorative 32 CBG badge with intrinsic dimensions', () => {
    const { container } = renderGuide('en');
    const badge = container.querySelector('img.npp-publication-mark');

    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('alt', '');
    expect(badge).toHaveAttribute('width', '865');
    expect(badge).toHaveAttribute('height', '1006');
    expect(badge?.getAttribute('src')).toMatch(/logo.*\.png$/);
  });

  it('renders guidance as ordinary or ordered lists without checkbox-like decoration', () => {
    const { container } = renderGuide('en');

    expect(container.querySelector('#npp-and-npf ul.npp-guidance-list')).toBeInTheDocument();

    for (const sectionId of ['spending-npf', 'alienation-of-funds', 'existing-vendor']) {
      expect(container.querySelector(`#${sectionId} ol.npp-guidance-list`)).toBeInTheDocument();
    }

    const guidanceLists = container.querySelectorAll('.npp-guidance-list');
    expect(guidanceLists.length).toBeGreaterThan(0);

    for (const list of guidanceLists) {
      expect(list.querySelector('svg')).not.toBeInTheDocument();
      expect(within(list as HTMLElement).queryByRole('checkbox')).not.toBeInTheDocument();
      expect(within(list as HTMLElement).queryByRole('button')).not.toBeInTheDocument();
    }

    const alienationIcon = container.querySelector('#alienation-of-funds .npp-section-icon svg');
    expect(alienationIcon).toBeInTheDocument();
    expect(alienationIcon).not.toHaveClass('lucide-check');
  });

  it('confines all fifteen checkbox controls to the reimbursement checklist', () => {
    const { container } = renderGuide('en');
    const checkboxes = screen.getAllByRole('checkbox');
    const checklist = container.querySelector('#reimbursement-checklist');

    expect(checkboxes).toHaveLength(15);
    for (const checkbox of checkboxes) {
      expect(checklist).toContainElement(checkbox);
    }
  });
});

describe.each(localeCases)('NPPPage ($locale)', (copy) => {
  it('renders one semantic, continuously readable field guide', () => {
    const { container } = renderGuide(copy.locale);

    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: copy.title })).toBeInTheDocument();
    expect(container.querySelector('header')).toBeInTheDocument();
    expect(container.querySelector('main#npp-main')).toBeInTheDocument();
    expect(container.querySelector('footer')).toBeInTheDocument();
    expect(screen.getByText(copy.disclaimer)).toBeVisible();
    expect(screen.getByRole('link', { name: copy.skipLabel })).toHaveAttribute('href', '#npp-main');

    for (const [id, heading] of copy.sectionHeadings) {
      const section = container.querySelector(
        id === 'reimbursement-checklist' ? `div#${id}` : `section#${id}`,
      );

      expect(section).toBeInTheDocument();
      expect(within(section as HTMLElement).getByRole('heading', { name: heading })).toBeVisible();
    }
  });

  it('exposes one contents landmark and only one labelled checklist region', () => {
    const { container } = renderGuide(copy.locale);

    expect(screen.getAllByRole('complementary')).toHaveLength(1);

    const checklistAnchor = container.querySelector('#reimbursement-checklist');
    expect(checklistAnchor?.tagName).toBe('DIV');
    expect(within(checklistAnchor as HTMLElement).getAllByRole('region')).toHaveLength(1);
  });

  it('provides desktop contents and mobile jump links for every guide anchor', () => {
    renderGuide(copy.locale);

    for (const navigationLabel of [copy.contentsLabel, copy.jumpLinksLabel]) {
      const navigation = screen.getByRole('navigation', { name: navigationLabel });

      for (const [id, heading] of copy.sectionHeadings) {
        expect(within(navigation).getByRole('link', { name: heading })).toHaveAttribute(
          'href',
          `#${id}`,
        );
      }
    }
  });

  it('shows the required member workflow, operator guidance, grants, and checklist', () => {
    const { container } = renderGuide(copy.locale);

    for (const audienceLabel of copy.audienceLabels) {
      expect(screen.getAllByText(audienceLabel).length).toBeGreaterThan(0);
    }

    for (const [id, text] of copy.contentChecks) {
      expect(container.querySelector(`#${id}`)).toHaveTextContent(text);
    }

    expect(screen.getByText(copy.progress)).toHaveAttribute('aria-live', 'polite');
  });

  it('offers every grant through one localized native selector and shows one record at a time', () => {
    const { container } = renderGuide(copy.locale);
    const grantSection = container.querySelector('section#grants') as HTMLElement;
    const selector = within(grantSection).getByRole('combobox', {
      name: copy.grantSelectorLabel,
    });
    const options = within(selector).getAllByRole('option');
    const grantCards = grantSection.querySelectorAll('article.npp-grant-card');

    expect(options.map((option) => option.textContent)).toEqual(copy.grantNames);
    expect(selector).toHaveValue('unit-internal-npp');
    expect(grantCards).toHaveLength(9);
    expect(grantSection.querySelector('#grant-unit-internal-npp')).not.toHaveAttribute('hidden');
    expect(grantSection.querySelector('#grant-band-grant')).toHaveAttribute('hidden');
    expect(within(grantSection).getByRole('heading', { name: copy.grantNames[0] })).toBeVisible();

    fireEvent.change(selector, { target: { value: 'band-grant' } });

    expect(selector).toHaveValue('band-grant');
    expect(grantSection.querySelector('#grant-unit-internal-npp')).toHaveAttribute('hidden');
    expect(grantSection.querySelector('#grant-band-grant')).not.toHaveAttribute('hidden');
    expect(within(grantSection).getByRole('heading', { name: copy.grantNames[5] })).toBeVisible();
  });

  it('renders hardened official links with explicit language availability', () => {
    const { container } = renderGuide(copy.locale);
    const sourceFooter = container.querySelector('footer');

    expect(
      within(sourceFooter as HTMLElement).getByRole('heading', { name: copy.sourceHeading }),
    ).toBeVisible();

    for (const expectedSource of expectedSources) {
      const sourceEntry = container.querySelector(`#source-${expectedSource.id}`);

      expect(sourceEntry).toBeInTheDocument();
      expect(
        within(sourceEntry as HTMLElement).getByRole('heading', {
          name: expectedSource.title[copy.locale],
        }),
      ).toBeVisible();

      const sourceLinks = within(sourceEntry as HTMLElement).getAllByRole('link');
      expect(sourceLinks).toHaveLength(expectedSource.links.length);

      for (const expectedLink of expectedSource.links) {
        const link = within(sourceEntry as HTMLElement).getByRole('link', {
          name: `${copy.openSource} — ${expectedLink.language}`,
        });
        expect(link).toHaveAttribute('href', expectedLink.href);
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      }
    }
  });

  it('does not collect or submit personal, supplier, or payment information', () => {
    const { container } = renderGuide(copy.locale);

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(container.querySelector('form')).not.toBeInTheDocument();
    expect(container.querySelector('input[type="file"]')).not.toBeInTheDocument();
    expect(container.querySelector('input[type="text"]')).not.toBeInTheDocument();
    expect(container.querySelector('input[type="email"]')).not.toBeInTheDocument();
    expect(container.querySelector('input[type="number"]')).not.toBeInTheDocument();
    expect(container.querySelector('input[name*="bank" i]')).not.toBeInTheDocument();
    expect(container.querySelector('input[name*="sin" i]')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /submit|upload|téléverser|soumettre/i }),
    ).not.toBeInTheDocument();
  });

  it('preserves the selected locale when returning to the landing page', () => {
    renderGuide(copy.locale);

    const returnLink = screen.getByRole('link', { name: copy.returnLabel });

    expect(returnLink).toHaveAttribute('href', `/?lang=${copy.locale}`);
    returnLink.focus();
    expect(returnLink).toHaveFocus();
  });
});

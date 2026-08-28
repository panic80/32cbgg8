import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ThemeProvider } from '@/context/ThemeContext';
import NPPPage from '..';

const localeState = vi.hoisted(() => ({ current: 'en' as 'en' | 'fr' }));

vi.mock('@/i18n/LocaleContext', () => ({
  useLocale: () => ({
    locale: localeState.current,
    setLocale: (locale: 'en' | 'fr') => {
      localeState.current = locale;
    },
  }),
}));

const LocationProbe = () => {
  const location = useLocation();

  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};

const renderGuide = (locale: 'en' | 'fr') => {
  localeState.current = locale;

  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[`/npp?lang=${locale}`]}>
        <NPPPage />
        <LocationProbe />
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
    audienceLabels: ['All members', 'NPP operators'],
    sectionHeadings: [
      ['npp-and-npf', 'What NPP and NPF are—and are not'],
      ['before-spending', 'Before spending'],
      ['spending-npf', 'How to spend NPF'],
      ['grants', 'Grant explorer'],
      ['existing-vendor', 'Pay an existing vendor'],
      ['create-vendor', 'Create a vendor'],
      ['pay-individual', 'Pay an individual'],
      ['reimbursement-checklist', 'Reimbursement checklist'],
      ['sources-help', 'Sources and help'],
    ],
    contentChecks: [
      ['npp-and-npf', 'Non-Public Funds (NPF) are only the money component of NPP'],
      ['before-spending', 'Obtain approval before committing funds'],
      ['spending-npf', 'Execute any required contract before work starts'],
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
    audienceLabels: ['Tous les membres', 'Opérateurs BNP'],
    sectionHeadings: [
      ['npp-and-npf', 'Ce que sont les BNP et les FNP — et ce qu’ils ne sont pas'],
      ['before-spending', 'Avant de dépenser'],
      ['spending-npf', 'Comment dépenser les FNP'],
      ['grants', 'Répertoire des subventions'],
      ['existing-vendor', 'Payer un fournisseur existant'],
      ['create-vendor', 'Créer un fournisseur'],
      ['pay-individual', 'Payer une personne'],
      ['reimbursement-checklist', 'Liste de contrôle pour le remboursement'],
      ['sources-help', 'Sources et aide'],
    ],
    contentChecks: [
      ['npp-and-npf', 'Les fonds non publics (FNP) ne sont que la composante monétaire des BNP'],
      ['before-spending', 'Obtenez l’approbation avant d’engager des fonds'],
      ['spending-npf', 'Signez tout contrat requis avant le début des travaux'],
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

afterEach(() => {
  localeState.current = 'en';
  window.localStorage.clear();
});

describe.each(localeCases)('NPPPage ($locale)', (copy) => {
  it('renders one semantic, continuously readable field guide', () => {
    const { container } = renderGuide(copy.locale);

    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: copy.title })).toBeInTheDocument();
    expect(container.querySelector('header')).toBeInTheDocument();
    expect(container.querySelector('main#npp-main')).toBeInTheDocument();
    expect(container.querySelector('footer')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: copy.skipLabel })).toHaveAttribute('href', '#npp-main');

    for (const [id, heading] of copy.sectionHeadings) {
      const section = container.querySelector(`section#${id}`);

      expect(section).toBeInTheDocument();
      expect(within(section as HTMLElement).getByRole('heading', { name: heading })).toBeVisible();
    }
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
      expect(container.querySelector(`section#${id}`)).toHaveTextContent(text);
    }

    const grantSection = container.querySelector('section#grants');
    for (const grantName of copy.grantNames) {
      expect(
        within(grantSection as HTMLElement).getByRole('heading', { name: grantName }),
      ).toBeVisible();
    }

    expect(screen.getByText(copy.progress)).toHaveAttribute('aria-live', 'polite');
  });

  it('renders hardened official links with explicit language availability', () => {
    const { container } = renderGuide(copy.locale);
    const sourceFooter = container.querySelector('footer');

    expect(
      within(sourceFooter as HTMLElement).getByRole('heading', { name: copy.sourceHeading }),
    ).toBeVisible();

    const externalLinks = within(sourceFooter as HTMLElement)
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href')?.startsWith('http'));

    expect(externalLinks.length).toBeGreaterThan(0);
    for (const link of externalLinks) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link).toHaveAccessibleName(/English|Français/);
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

    fireEvent.click(screen.getByRole('button', { name: new RegExp(copy.returnLabel, 'i') }));

    expect(screen.getByTestId('location')).toHaveTextContent(`/?lang=${copy.locale}`);
  });
});

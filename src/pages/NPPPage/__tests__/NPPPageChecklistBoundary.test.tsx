import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
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

const renderGuide = (locale: 'en' | 'fr') => {
  localeState.current = locale;

  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[`/npp?lang=${locale}&task=t-reimburse`]}>
        <NPPPage />
      </MemoryRouter>
    </ThemeProvider>,
  );
};

const progressText = {
  en: '0 of 15 complete',
  fr: '0 sur 15 terminées',
} as const;

const checklistFixture = [
  {
    id: 'approval-before-purchase',
    en: 'I received approval before purchasing.',
    fr: 'J’ai reçu l’approbation avant d’effectuer l’achat.',
  },
  {
    id: 'authorized-purpose',
    en: 'The expense supports an authorized NPP purpose and beneficiaries.',
    fr: 'La dépense appuie un objet et des bénéficiaires BNP autorisés.',
  },
  {
    id: 'correct-funding',
    en: 'The correct entity, budget, grant, or trust was identified.',
    fr: 'L’entité, le budget, la subvention ou la fiducie appropriés ont été identifiés.',
  },
  {
    id: 'corporate-card-unavailable',
    en: 'The NPP corporate card was unavailable or infeasible.',
    fr: 'La carte de crédit d’entreprise des BNP était indisponible ou non réalisable.',
  },
  {
    id: 'itemized-receipt',
    en: 'I have an itemized invoice or receipt.',
    fr: 'J’ai une facture ou un reçu détaillé.',
  },
  {
    id: 'proof-of-payment',
    en: 'I have proof of payment if required.',
    fr: 'J’ai une preuve de paiement, si elle est requise.',
  },
  {
    id: 'acceptance',
    en: 'The goods or services were received and accepted.',
    fr: 'Les biens ou les services ont été reçus et acceptés.',
  },
  {
    id: 'declaration',
    en: 'I completed a signed declaration if the receipt was genuinely unobtainable.',
    fr: 'J’ai rempli une déclaration signée si le reçu était réellement impossible à obtenir.',
  },
  {
    id: 'payment-form',
    en: 'I completed the current reimbursement/payment form.',
    fr: 'J’ai rempli le formulaire actuel de remboursement ou de paiement.',
  },
  {
    id: 'supplier-record',
    en: 'My supplier/payee record exists, or I completed the current setup package.',
    fr: 'Mon dossier de fournisseur ou de bénéficiaire existe, ou j’ai rempli le dossier de création actuel.',
  },
  {
    id: 'eft-secure-channel',
    en: 'EFT information was provided through the approved secure channel, if required.',
    fr: 'Les renseignements de TEF ont été fournis par la voie sécurisée approuvée, s’ils sont requis.',
  },
  {
    id: 'independent-approval',
    en: 'A separate delegated authority approved the claim.',
    fr: 'Un pouvoir délégué distinct a approuvé la réclamation.',
  },
  {
    id: 'no-self-approval',
    en: 'I did not approve my own reimbursement.',
    fr: 'Je n’ai pas approuvé mon propre remboursement.',
  },
  {
    id: 'approved-submission-route',
    en: 'I am using the approved NPP Accounting submission route.',
    fr: 'J’utilise la voie de présentation approuvée de la comptabilité des BNP.',
  },
  {
    id: 'masked-payment-cards',
    en: 'Full payment-card numbers were removed or masked.',
    fr: 'Les numéros complets de cartes de paiement ont été supprimés ou masqués.',
  },
] as const;

afterEach(() => {
  localeState.current = 'en';
  window.localStorage.clear();
});

describe.each(['en', 'fr'] as const)('NPPPage checklist boundary ($locale)', (locale) => {
  it('exposes exactly fifteen localized checkbox controls within the reimbursement section', () => {
    const { container } = renderGuide(locale);
    const checklist = container.querySelector('#reimbursement-checklist');
    const checkboxes = screen.getAllByRole('checkbox');

    expect(checkboxes).toHaveLength(15);
    expect(checklist).toBeInTheDocument();
    expect(within(checklist as HTMLElement).getAllByRole('checkbox')).toHaveLength(15);

    checklistFixture.forEach((item, index) => {
      const checkbox = checkboxes[index];

      expect(checklist).toContainElement(checkbox);
      expect(checkbox).toHaveAttribute('id', `reimbursement-${item.id}`);
      expect(checkbox).toHaveAccessibleName(item[locale]);
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });
  });

  it('changes progress only for an actual reimbursement item activated by click', () => {
    const { container } = renderGuide(locale);
    const checklist = container.querySelector('#reimbursement-checklist') as HTMLElement;
    const checkboxes = within(checklist).getAllByRole('checkbox');
    const first = checkboxes[0];
    const second = checkboxes[1];
    const status = within(checklist).getByRole('status');

    fireEvent.click(first);
    expect(status).toHaveTextContent(locale === 'fr' ? '1 sur 15' : '1 of 15');
    expect(first).toHaveAttribute('aria-checked', 'true');
    expect(second).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(second);

    expect(status).toHaveTextContent(locale === 'fr' ? '2 sur 15' : '2 of 15');
    expect(first).toHaveAttribute('aria-checked', 'true');
    expect(second).toHaveAttribute('aria-checked', 'true');
    expect(
      checkboxes.slice(2).every((checkbox) => checkbox.getAttribute('aria-checked') === 'false'),
    ).toBe(true);

    const guidanceItems = container.querySelectorAll('.npp-guidance-list li');
    expect(guidanceItems.length).toBeGreaterThan(0);

    guidanceItems.forEach((guidanceItem) => {
      fireEvent.click(guidanceItem);
      expect(status).toHaveTextContent(locale === 'fr' ? '2 sur 15' : '2 of 15');
    });
  });

  it('renders checkbox-role controls as native buttons for browser keyboard activation', () => {
    const { container } = renderGuide(locale);
    const checklist = container.querySelector('#reimbursement-checklist') as HTMLElement;
    const checkboxes = within(checklist).getAllByRole('checkbox');

    checkboxes.forEach((checkbox) => {
      expect(checkbox.tagName).toBe('BUTTON');
      expect(checkbox).toHaveAttribute('type', 'button');
    });
  });

  it('keeps static guidance lists free of checkmark SVGs and controls', () => {
    const { container } = renderGuide(locale);
    const guidanceLists = container.querySelectorAll('.npp-guidance-list');

    expect(guidanceLists.length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.npp-task-list')).toHaveLength(0);

    guidanceLists.forEach((list) => {
      expect(list.querySelectorAll('svg')).toHaveLength(0);
      expect(list.querySelectorAll('button, input, [role="checkbox"]')).toHaveLength(0);
    });
    const checklist = container.querySelector('#reimbursement-checklist') as HTMLElement;
    expect(within(checklist).getByRole('status')).toHaveTextContent(progressText[locale]);
  });
});

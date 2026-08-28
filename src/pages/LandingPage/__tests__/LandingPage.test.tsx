import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import LandingPage from '..';
import { ThemeProvider } from '@/context/ThemeContext';
import { LocaleProvider } from '@/i18n/LocaleContext';
import { landingCopy } from '@/i18n/landingCopy';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const clipboardWriteText = vi.fn();

const renderLandingPage = (initialEntry = '/?lang=en') =>
  render(
    <ThemeProvider>
      <LocaleProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <LandingPage />
        </MemoryRouter>
      </LocaleProvider>
    </ThemeProvider>,
  );

beforeEach(() => {
  window.history.replaceState({}, '', '/?lang=en');
  document.documentElement.lang = 'en';
  window.localStorage.clear();
  clipboardWriteText.mockReset();
  clipboardWriteText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: clipboardWriteText },
  });
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});

describe('LandingPage', () => {
  it('renders the resource hub without chatbot search controls', () => {
    renderLandingPage();

    expect(
      screen.getByRole('heading', { name: /32 CBG G8 Administration Hub/i }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('textbox', { name: /ask a policy question/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^ask$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mileage rates/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /per diem rates/i })).not.toBeInTheDocument();
  });

  it('exposes key feature links', () => {
    renderLandingPage();

    expect(
      screen.getByRole('link', {
        name: /32 CBG DOA List – Access the current 32 CBG Delegation of Authority list/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /SCIP Portal/i })).toBeInTheDocument();
    const npfLink = screen.getByRole('link', {
      name: /NPF – Read the public NPP \/ NPF Guide/i,
    });
    expect(npfLink).toHaveAttribute('href', '/npp?lang=en');
    expect(npfLink).not.toHaveAttribute('target');
    expect(screen.queryByText(/Policy Assistant/i)).not.toBeInTheDocument();
  });

  it('shows factual privacy copy without OpenAI or broad personal data claims', () => {
    renderLandingPage();

    fireEvent.click(screen.getByRole('button', { name: /Privacy/i }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent(/This landing page is a navigation hub/i);
    expect(dialog).toHaveTextContent(/basic visit analytics/i);
    expect(dialog).toHaveTextContent(/does not send your activity to any AI model/i);
    expect(dialog).not.toHaveTextContent(/OpenAI|GPT models|AI Processing/i);
    expect(dialog).not.toHaveTextContent(
      /personal information|encrypted and stored securely|request its deletion/i,
    );
  });

  it('describes the about modal as a link hub without AI service claims', () => {
    renderLandingPage();

    fireEvent.click(screen.getByRole('button', { name: /About/i }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent(/navigation hub for 32 CBG G8 administrative resources/i);
    expect(dialog).toHaveTextContent(/does not provide AI-generated advice/i);
    expect(dialog).not.toHaveTextContent(/policy guidance/i);
  });

  it('localizes landing, About, Privacy, footer, theme, and SCIP copy after switching to French', async () => {
    renderLandingPage();

    fireEvent.click(screen.getByRole('button', { name: 'Français' }));

    expect(
      screen.getByRole('heading', { name: 'Portail administratif G8 du 32 GBC' }),
    ).toBeVisible();
    expect(screen.getByText('Portail central des ressources financières')).toBeVisible();
    expect(screen.getByRole('button', { name: 'À propos' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Contact' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Confidentialité' })).toBeVisible();
    expect(screen.getByRole('button', { name: /Passer au mode (sombre|clair)/ })).toBeVisible();
    expect(
      screen.getByRole('link', {
        name: /NPF – Consultez le Guide des BNP \/ FNP/i,
      }),
    ).toHaveAttribute('href', '/npp?lang=fr');

    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveTextContent(
      `© ${new Date().getFullYear()} Portail administratif G8. Tous droits réservés. Non affilié au MDN ni aux FAC.`,
    );
    expect(footer).toHaveTextContent('Dernière mise à jour : 1 octobre 2025');
    expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute(
      'href',
      'mailto:g8@sent.com?subject=Contact%20depuis%20la%20page%20d%E2%80%99accueil%20du%20G8',
    );

    fireEvent.click(screen.getByRole('button', { name: 'À propos' }));
    const aboutDialog = screen.getByRole('dialog');
    expect(aboutDialog).toHaveTextContent('À propos de cette page');
    expect(aboutDialog).toHaveTextContent('Portail administratif G8 du 32 GBC');
    expect(aboutDialog).toHaveTextContent('Fonctions principales');
    const aboutCloseButtons = within(aboutDialog).getAllByRole('button', { name: 'Fermer' });
    const aboutIconClose = aboutCloseButtons.find((button) => button.querySelector('svg'));
    const aboutTextClose = aboutCloseButtons.find((button) => !button.querySelector('svg'));
    expect(aboutIconClose).toHaveClass('h-11', 'w-11');
    expect(aboutTextClose).toHaveClass('min-h-11');
    fireEvent.click(aboutIconClose!);

    fireEvent.click(screen.getByRole('button', { name: 'Confidentialité' }));
    const privacyDialog = screen.getByRole('dialog');
    expect(privacyDialog).toHaveTextContent('Politique de confidentialité');
    expect(privacyDialog).toHaveTextContent(
      'Cette page est un portail vers des liens et des ressources administratifs',
    );
    expect(privacyDialog).toHaveTextContent('statistiques de visite de base');
    const privacyCloseButtons = within(privacyDialog).getAllByRole('button', { name: 'Fermer' });
    const privacyIconClose = privacyCloseButtons.find((button) => button.querySelector('svg'));
    const privacyTextClose = privacyCloseButtons.find((button) => !button.querySelector('svg'));
    expect(privacyIconClose).toHaveClass('h-11', 'w-11');
    expect(privacyTextClose).toHaveClass('min-h-11');
    fireEvent.click(privacyIconClose!);

    fireEvent.click(screen.getByRole('button', { name: /Portail SCIP/i }));
    const scipDialog = screen.getByRole('dialog');
    expect(scipDialog).toHaveTextContent('Vous êtes sur le point d’accéder au portail SCIP');
    expect(scipDialog).toHaveTextContent('Copier le lien');
    expect(scipDialog).toHaveTextContent('Cette page s’ouvrira dans un nouvel onglet');
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Continuer' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Fermer' })).toHaveClass('h-11', 'w-11');
    expect(screen.getByRole('button', { name: 'Copier le lien' })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: 'Annuler' })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: 'Continuer' })).toHaveClass('min-h-11');
    expect(landingCopy.fr.navigationStatus.opening).toBe('Ouverture…');

    fireEvent.click(screen.getByRole('button', { name: 'Copier le lien' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Lien copié' })).toBeDisabled();
    });
    expect(toast.success).toHaveBeenCalledWith('Lien copié');
    await waitFor(
      () => expect(screen.getByRole('button', { name: 'Copier le lien' })).toBeEnabled(),
      { timeout: 3000 },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    fireEvent.click(screen.getByRole('button', { name: /Portail SCIP/i }));
    clipboardWriteText.mockRejectedValueOnce(new Error('clipboard unavailable'));
    fireEvent.click(screen.getByRole('button', { name: 'Copier le lien' }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Échec de la copie du lien.');
    });
  });

  it('shows a disabled French opening state before navigating to SCIP', () => {
    vi.useFakeTimers();
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => undefined);

    try {
      renderLandingPage();
      fireEvent.click(screen.getByRole('button', { name: 'Français' }));
      fireEvent.click(screen.getByRole('button', { name: /Portail SCIP/i }));
      fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

      const openingButton = screen.getByRole('button', { name: 'Ouverture…' });
      expect(openingButton).toBeDisabled();
      expect(openingButton).toHaveClass('min-h-11');
      expect(screen.getByRole('button', { name: 'Annuler' })).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Fermer' })).not.toBeInTheDocument();
      expect(assign).not.toHaveBeenCalled();

      fireEvent.click(openingButton);
      fireEvent.keyDown(document, { key: 'Escape' });
      fireEvent.pointerDown(document.body);
      expect(screen.getByRole('dialog')).toBeVisible();

      vi.runOnlyPendingTimers();
      expect(assign).toHaveBeenCalledTimes(1);
    } finally {
      assign.mockRestore();
      vi.useRealTimers();
    }
  });

  it('clears a pending SCIP navigation when the landing page unmounts', () => {
    vi.useFakeTimers();
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => undefined);

    try {
      const { unmount } = renderLandingPage();
      fireEvent.click(screen.getByRole('button', { name: /SCIP Portal/i }));
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

      unmount();
      vi.runOnlyPendingTimers();

      expect(assign).not.toHaveBeenCalled();
    } finally {
      assign.mockRestore();
      vi.useRealTimers();
    }
  });
});

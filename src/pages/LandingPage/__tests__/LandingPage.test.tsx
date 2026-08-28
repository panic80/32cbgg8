import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from '..';
import { ThemeProvider } from '@/context/ThemeContext';
import { LocaleProvider } from '@/i18n/LocaleContext';

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

  it('localizes landing, About, Privacy, footer, theme, and SCIP copy after switching to French', () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'À propos' }));
    const aboutDialog = screen.getByRole('dialog');
    expect(aboutDialog).toHaveTextContent('À propos de cette page');
    expect(aboutDialog).toHaveTextContent('Portail administratif G8 du 32 GBC');
    expect(aboutDialog).toHaveTextContent('Fonctions principales');
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));

    fireEvent.click(screen.getByRole('button', { name: 'Confidentialité' }));
    const privacyDialog = screen.getByRole('dialog');
    expect(privacyDialog).toHaveTextContent('Politique de confidentialité');
    expect(privacyDialog).toHaveTextContent(
      'Cette page est un portail vers des liens et des ressources administratifs',
    );
    expect(privacyDialog).toHaveTextContent('statistiques de visite de base');
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));

    fireEvent.click(screen.getByRole('button', { name: /Portail SCIP/i }));
    const scipDialog = screen.getByRole('dialog');
    expect(scipDialog).toHaveTextContent('Vous êtes sur le point d’accéder au portail SCIP');
    expect(scipDialog).toHaveTextContent('Copier le lien');
    expect(scipDialog).toHaveTextContent('Cette page s’ouvrira dans un nouvel onglet');
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Continuer' })).toBeVisible();
  });
});

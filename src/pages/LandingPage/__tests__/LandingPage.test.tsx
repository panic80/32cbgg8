import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from '..';
import { ThemeProvider } from '@/context/ThemeContext';

const renderLandingPage = () =>
  render(
    <ThemeProvider>
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    </ThemeProvider>,
  );

describe('LandingPage', () => {
  it('renders the resource hub without chatbot search controls', () => {
    renderLandingPage();

    expect(
      screen.getByRole('heading', { name: /32 CBG G8 Administration Hub/i }),
    ).toBeInTheDocument();

    expect(screen.queryByRole('textbox', { name: /ask a policy question/i })).not.toBeInTheDocument();
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
    expect(dialog).not.toHaveTextContent(/personal information|encrypted and stored securely|request its deletion/i);
  });

  it('describes the about modal as a link hub without AI service claims', () => {
    renderLandingPage();

    fireEvent.click(screen.getByRole('button', { name: /About/i }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent(/navigation hub for 32 CBG G8 administrative resources/i);
    expect(dialog).toHaveTextContent(/does not provide AI-generated advice/i);
    expect(dialog).not.toHaveTextContent(/policy guidance/i);
  });
});

import { render, screen } from '@testing-library/react';
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
});

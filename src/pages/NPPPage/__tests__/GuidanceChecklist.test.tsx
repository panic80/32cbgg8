import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/context/ThemeContext';
import NPPPage from '..';
import { nppGuideContent } from '../nppContent';

const localeState = vi.hoisted(() => ({ current: 'en' as 'en' | 'fr' }));

vi.mock('@/i18n/LocaleContext', () => ({
  useLocale: () => ({
    locale: localeState.current,
    setLocale: (locale: 'en' | 'fr') => {
      localeState.current = locale;
    },
  }),
}));

const renderTask = (taskId: string, locale: 'en' | 'fr' = 'en') => {
  localeState.current = locale;
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[`/npp?lang=${locale}&task=${taskId}`]}>
        <NPPPage />
      </MemoryRouter>
    </ThemeProvider>,
  );
};

const spending = nppGuideContent.sections.find((section) => section.id === 'spending-npf')!;
const definitions = nppGuideContent.sections.find((section) => section.id === 'npp-and-npf')!;

describe('trackable field-note checklists', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });

  it('renders every step of a procedural section as a checkbox with a progress indicator', () => {
    renderTask('t-spend');

    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(spending.bullets.length);
    expect(screen.getByRole('status')).toHaveTextContent(
      `0 of ${spending.bullets.length} complete`,
    );
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('keeps definitional sections as plain lists', () => {
    renderTask('t-understand');

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(definitions.trackable).toBeFalsy();
  });

  it('updates progress on tick, persists it across a reload, and clears on reset', () => {
    const first = renderTask('t-spend');
    fireEvent.click(screen.getByRole('checkbox', { name: spending.bullets[0].en }));
    fireEvent.click(screen.getByRole('checkbox', { name: spending.bullets[1].en }));

    expect(screen.getByRole('status')).toHaveTextContent(
      `2 of ${spending.bullets.length} complete`,
    );
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
    expect(JSON.parse(window.localStorage.getItem('npp-progress:spending-npf') ?? '[]')).toEqual([
      '0',
      '1',
    ]);

    first.unmount();
    renderTask('t-spend');
    expect(screen.getByRole('status')).toHaveTextContent(
      `2 of ${spending.bullets.length} complete`,
    );
    expect(screen.getByRole('checkbox', { name: spending.bullets[0].en })).toHaveAttribute(
      'data-state',
      'checked',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByRole('status')).toHaveTextContent(
      `0 of ${spending.bullets.length} complete`,
    );
    expect(window.localStorage.getItem('npp-progress:spending-npf')).toBeNull();
  });

  it('scopes progress per section', () => {
    window.localStorage.setItem('npp-progress:spending-npf', JSON.stringify(['0']));
    renderTask('t-before');

    expect(screen.getByRole('status')).toHaveTextContent('0 of');
  });

  it('localizes the progress copy in French', () => {
    renderTask('t-spend', 'fr');
    fireEvent.click(screen.getByRole('checkbox', { name: spending.bullets[0].fr }));

    expect(screen.getByRole('status')).toHaveTextContent(
      `1 sur ${spending.bullets.length} terminée`,
    );
    expect(screen.getByRole('button', { name: 'Réinitialiser' })).toBeInTheDocument();
  });
});

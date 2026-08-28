import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

const renderGuide = (locale: 'en' | 'fr') => {
  localeState.current = locale;

  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[`/npp?lang=${locale}`]}>
        <NPPPage />
      </MemoryRouter>
    </ThemeProvider>,
  );
};

const progressText = {
  en: '0 of 15 complete',
  fr: '0 sur 15 terminées',
} as const;

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

    nppGuideContent.checklist.forEach((item, index) => {
      const checkbox = checkboxes[index];

      expect(checklist).toContainElement(checkbox);
      expect(checkbox).toHaveAttribute('id', `reimbursement-${item.id}`);
      expect(checkbox).toHaveAccessibleName(item.label[locale]);
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });
  });

  it('changes progress only for a reimbursement item activated by click or Space', () => {
    const { container } = renderGuide(locale);
    const checklist = container.querySelector('#reimbursement-checklist') as HTMLElement;
    const checkboxes = within(checklist).getAllByRole('checkbox');
    const first = checkboxes[0];
    const second = checkboxes[1];
    const status = screen.getByRole('status');

    fireEvent.click(first);
    expect(status).toHaveTextContent(locale === 'fr' ? '1 sur 15' : '1 of 15');
    expect(first).toHaveAttribute('aria-checked', 'true');
    expect(second).toHaveAttribute('aria-checked', 'false');

    second.focus();
    fireEvent.keyDown(second, { key: ' ', code: 'Space', charCode: 32 });
    fireEvent.keyUp(second, { key: ' ', code: 'Space', charCode: 32 });
    fireEvent.click(second);

    expect(status).toHaveTextContent(locale === 'fr' ? '2 sur 15' : '2 of 15');
    expect(first).toHaveAttribute('aria-checked', 'true');
    expect(second).toHaveAttribute('aria-checked', 'true');
    expect(
      checkboxes.slice(2).every((checkbox) => checkbox.getAttribute('aria-checked') === 'false'),
    ).toBe(true);

    const guidanceItem = container.querySelector('.npp-guidance-list li');
    expect(guidanceItem).toBeInTheDocument();
    fireEvent.click(guidanceItem as HTMLElement);
    expect(status).toHaveTextContent(locale === 'fr' ? '2 sur 15' : '2 of 15');
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
    expect(screen.getByRole('status')).toHaveTextContent(progressText[locale]);
  });
});

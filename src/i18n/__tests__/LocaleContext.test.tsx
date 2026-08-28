import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { LocaleProvider, parseLocale, useLocale } from '@/i18n/LocaleContext';
import { landingCopy } from '@/i18n/landingCopy';
import { LocaleToggle } from '@/components/LocaleToggle';

const LocaleProbe = () => {
  const { locale } = useLocale();

  return <output aria-label="current locale">{locale}</output>;
};

const expectNonEmptyLocalizedStrings = (value: unknown, path: string): void => {
  if (typeof value === 'string') {
    expect(value.trim(), path).not.toBe('');
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      expectNonEmptyLocalizedStrings(item, `${path}[${index}]`);
    });
    return;
  }

  if (value !== null && typeof value === 'object') {
    Object.entries(value).forEach(([key, nestedValue]) => {
      expectNonEmptyLocalizedStrings(nestedValue, `${path}.${key}`);
    });
  }
};

describe('locale foundation', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    document.documentElement.lang = 'en';
  });

  it('parses only supported URL locales and defaults to English', () => {
    expect(parseLocale('?lang=fr')).toBe('fr');
    expect(parseLocale('?lang=en')).toBe('en');
    expect(parseLocale('?lang=de')).toBe('en');
    expect(parseLocale('')).toBe('en');
  });

  it('switches locale in place and updates the document language', () => {
    render(
      <LocaleProvider>
        <LocaleToggle />
        <LocaleProbe />
      </LocaleProvider>,
    );

    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Français' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Français' }));

    expect(window.location.search).toBe('?lang=fr');
    expect(document.documentElement.lang).toBe('fr');
    expect(screen.getByRole('button', { name: 'Français' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('status', { name: 'current locale' })).toHaveTextContent('fr');
  });

  it('preserves existing query parameters, path, and hash when changing locale', () => {
    window.history.replaceState({}, '', '/npp?ref=guide#checklist');

    const LocaleSetter = () => {
      const { setLocale } = useLocale();
      return <button onClick={() => setLocale('fr')}>set French</button>;
    };

    render(
      <LocaleProvider>
        <LocaleSetter />
      </LocaleProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'set French' }));

    expect(window.location.pathname).toBe('/npp');
    expect(window.location.search).toBe('?ref=guide&lang=fr');
    expect(window.location.hash).toBe('#checklist');
  });

  it('provides complete bilingual landing copy for every interactive surface', () => {
    for (const locale of ['en', 'fr'] as const) {
      const copy = landingCopy[locale];

      expectNonEmptyLocalizedStrings(copy, `${locale} landing copy`);
      expect(copy.heading).not.toBe('');
      expect(copy.subtitle).not.toBe('');
      expect(copy.footer.about).not.toBe('');
      expect(copy.footer.contact).not.toBe('');
      expect(copy.footer.privacy).not.toBe('');
      expect(copy.theme.switchToDark).not.toBe('');
      expect(copy.theme.switchToLight).not.toBe('');
      expect(copy.features.doaList.description).not.toBe('');
      expect(copy.features.scipPortal.description).not.toBe('');
      expect(copy.features.npf.description).not.toBe('');
      expect(copy.about.close).not.toBe('');
      expect(copy.privacy.close).not.toBe('');
      expect(copy.navigationStatus.continue).not.toBe('');
      expect(copy.copyLinkStatus.copied).not.toBe('');
      expect(copy.navigationStatus.opening).not.toBe('');
    }

    expect(landingCopy.en.features.scipPortal.title).toBe('SCIP Portal');
    expect(landingCopy.en.features.npf.title).toBe('NPF');
    expect(landingCopy.fr.features.npf.title).toBe('NPF');
    expect(
      landingCopy.fr.about.keyFeatures.find((feature) => feature.description.includes('BNP'))
        ?.title,
    ).toBe('NPF');
  });

  it('localizes the toggle group and live announcement in French', () => {
    window.history.replaceState({}, '', '/?lang=fr');

    render(
      <LocaleProvider>
        <LocaleToggle />
      </LocaleProvider>,
    );

    expect(screen.getByRole('group', { name: 'Langue' })).toBeInTheDocument();
    expect(screen.getByText('Français sélectionné')).toBeInTheDocument();
    expect(screen.queryByText('Français selected')).not.toBeInTheDocument();
  });
});

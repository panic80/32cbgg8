import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Locale, LocaleContextValue } from './types';

export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'fr'];

export const parseLocale = (search: string): Locale =>
  new URLSearchParams(search).get('lang') === 'fr' ? 'fr' : 'en';

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

const updateDocumentLanguage = (locale: Locale) => {
  document.documentElement.lang = locale;
};

export const LocaleProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocaleState] = useState<Locale>(() => parseLocale(window.location.search));

  useEffect(() => {
    updateDocumentLanguage(locale);
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    const url = new URL(window.location.href);
    url.searchParams.set('lang', nextLocale);

    const nextSearch = url.searchParams.toString();
    const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}${url.hash}`;
    window.history.replaceState(window.history.state, '', nextUrl);
    setLocaleState(nextLocale);
    updateDocumentLanguage(nextLocale);
  }, []);

  return <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>;
};

export const useLocale = (): LocaleContextValue => {
  const context = useContext(LocaleContext);

  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }

  return context;
};

export type Locale = 'en' | 'fr';

export interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

import { useLocale } from '@/i18n/LocaleContext';

export const LocaleToggle = () => {
  const { locale, setLocale } = useLocale();
  const accessibilityCopy =
    locale === 'fr'
      ? { groupLabel: 'Langue', selected: 'Français sélectionné' }
      : { groupLabel: 'Language', selected: 'English selected' };

  return (
    <div
      role="group"
      aria-label={accessibilityCopy.groupLabel}
      className="inline-flex gap-1 rounded-md"
    >
      <button
        type="button"
        className="min-h-11 min-w-11 rounded-md px-3 py-2 text-sm font-medium underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-pressed={locale === 'en'}
        onClick={() => setLocale('en')}
      >
        English
      </button>
      <button
        type="button"
        className="min-h-11 min-w-11 rounded-md px-3 py-2 text-sm font-medium underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-pressed={locale === 'fr'}
        onClick={() => setLocale('fr')}
      >
        Français
      </button>
      <span className="sr-only" aria-live="polite">
        {accessibilityCopy.selected}
      </span>
    </div>
  );
};

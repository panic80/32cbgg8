import { useEffect } from 'react';

export const useTheme = (theme: string, propTheme?: string) => {
  // Apply theme changes to document only if not managed by parent
  useEffect(() => {
    if (!propTheme) {
      document.documentElement.classList.toggle('dark', theme === 'dark');
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme, propTheme]);
};

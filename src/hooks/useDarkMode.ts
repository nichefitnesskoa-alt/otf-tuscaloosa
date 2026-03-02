import { useState, useEffect } from 'react';

export function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem('otf-dark-mode');
    return stored === null ? true : stored === 'true';
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('otf-dark-mode', String(isDark));
  }, [isDark]);

  return { isDark, toggle: () => setIsDark(v => !v) };
}

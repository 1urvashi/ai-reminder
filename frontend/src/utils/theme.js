// Light/dark theme handling. Persists the choice and reflects it on <html>
// via data-theme, which the CSS design tokens key off of.

const STORAGE_KEY = 'remindai-theme';

export function storedTheme() {
  return localStorage.getItem(STORAGE_KEY); // 'light' | 'dark' | null (=system)
}

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') {
    root.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  } else {
    root.removeAttribute('data-theme');
    localStorage.removeItem(STORAGE_KEY);
  }
}

// Resolve the currently visible theme, accounting for the system preference.
export function resolvedTheme() {
  const saved = storedTheme();
  if (saved) {
    return saved;
  }
  const prefersDark =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

export function initTheme() {
  const saved = storedTheme();
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
  }
}

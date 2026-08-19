import { useState } from 'react';
import { applyTheme, resolvedTheme } from '../utils/theme';

// Toggles between light and dark, persisting the choice.
export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => resolvedTheme());

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
  }

  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={toggle}
      title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}

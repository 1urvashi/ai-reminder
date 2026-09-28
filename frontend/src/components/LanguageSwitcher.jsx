import { useI18n } from '../i18n/I18nContext';
import { LANGUAGE_OPTIONS } from '../i18n/translations';

// Standalone language picker for pages outside the logged-in Navbar (login,
// register, landing) — a non-English-first user needs to switch language
// before they can even read the form labels.
export default function LanguageSwitcher({ style }) {
  const { lang, setLang } = useI18n();
  return (
    <select
      className="select"
      style={{ width: 'auto', padding: '0.35rem 0.5rem', ...style }}
      value={lang}
      onChange={(e) => setLang(e.target.value)}
      title="Language"
    >
      {LANGUAGE_OPTIONS.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}

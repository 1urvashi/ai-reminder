import { createContext, useContext, useMemo, useState } from 'react';
import { translations } from './translations';

const I18nContext = createContext(null);
const STORAGE_KEY = 'ui-language';

function readStoredLanguage() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored && translations[stored] ? stored : 'en';
}

function interpolate(template, params) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in params ? String(params[key]) : match));
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(readStoredLanguage);

  function setLang(next) {
    if (!translations[next]) return;
    localStorage.setItem(STORAGE_KEY, next);
    setLangState(next);
  }

  const t = useMemo(() => {
    const dict = translations[lang] || translations.en;
    return (key, params) => interpolate(dict[key] ?? translations.en[key] ?? key, params);
  }, [lang]);

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

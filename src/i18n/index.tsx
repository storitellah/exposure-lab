/**
 * Tiny i18n layer: a React context with a `t()` lookup. Language switches
 * without a page reload; the choice is stored locally.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { en, type TranslationKey } from './en';
import { sw } from './sw';

export type Language = 'en' | 'sw';
const DICTS: Record<Language, Record<TranslationKey, string>> = { en, sw };

interface I18nValue {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: TranslationKey) => string;
  /** Pick a bilingual field from content objects such as lessons. */
  pick: (obj: { en: string; sw: string }) => string;
}

const I18nContext = createContext<I18nValue>({
  lang: 'en',
  setLang: () => undefined,
  t: (k) => en[k],
  pick: (o) => o.en,
});

const STORAGE_KEY = 'tatu-lang';

function initialLang(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'sw') return saved;
    if (navigator.language.toLowerCase().startsWith('sw')) return 'sw';
  } catch {
    /* storage unavailable — default to English */
  }
  return 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(initialLang);

  const setLang = useCallback((l: Language) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* non-fatal */ }
    document.documentElement.lang = l;
  }, []);

  const value = useMemo<I18nValue>(() => ({
    lang,
    setLang,
    t: (key: TranslationKey) => DICTS[lang][key] ?? en[key],
    pick: (obj) => obj[lang] ?? obj.en,
  }), [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import esTranslations from './locales/es.json';
import enTranslations from './locales/en.json';

export type Language = 'es' | 'en';

export interface LanguageOption {
  code: Language;
  name: string;
  flag: string;
}

export const AVAILABLE_LANGUAGES: LanguageOption[] = [
  { code: 'es', name: 'Español', flag: '🧉' },
  { code: 'en', name: 'English', flag: '🇺🇸' }
];

const translationsMap: Record<Language, any> = {
  es: esTranslations,
  en: enTranslations
};

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  availableLanguages: LanguageOption[];
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const STORAGE_KEY = 'mariatomamate_lang';

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'es' || saved === 'en') return saved;
    const navLang = navigator.language.slice(0, 2);
    return navLang === 'es' ? 'es' : 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  };

  const t = (path: string, params?: Record<string, string | number>): string => {
    const currentDict = translationsMap[language] || translationsMap.es;
    const fallbackDict = translationsMap.es;

    const resolvePath = (dict: any, p: string): any => {
      return p.split('.').reduce((obj, key) => (obj && obj[key] !== undefined ? obj[key] : undefined), dict);
    };

    let val = resolvePath(currentDict, path);
    if (val === undefined) {
      val = resolvePath(fallbackDict, path);
    }

    if (typeof val !== 'string') {
      return path;
    }

    if (params) {
      return Object.entries(params).reduce((str, [k, v]) => {
        return str.replace(new RegExp(`{${k}}`, 'g'), String(v));
      }, val);
    }

    return val;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, availableLanguages: AVAILABLE_LANGUAGES, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
};

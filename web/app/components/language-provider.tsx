"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  DEFAULT_LANGUAGE,
  LANGUAGE_OPTIONS,
  LANGUAGE_STORAGE_KEY,
  type LanguageCode,
  tFromLanguage,
  toHtmlLanguage,
  toLanguageCode,
} from "@/utils/i18n";

interface LanguageContextValue {
  language: LanguageCode;
  setLanguage: (next: LanguageCode) => void;
  t: (keyPath: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    if (typeof window === "undefined") return DEFAULT_LANGUAGE;
    try {
      const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      return toLanguageCode(stored);
    } catch {
      return DEFAULT_LANGUAGE;
    }
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
      } catch {
        // Ignore storage write failures.
      }
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = toHtmlLanguage(language);
    }
  }, [language]);

  const setLanguage = useCallback((next: LanguageCode) => {
    setLanguageState(toLanguageCode(next));
  }, []);

  const t = useCallback((keyPath: string, fallback = "") => {
    return tFromLanguage(language, keyPath, fallback);
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    t,
  }), [language, setLanguage, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }
  return context;
}

export { LANGUAGE_OPTIONS };

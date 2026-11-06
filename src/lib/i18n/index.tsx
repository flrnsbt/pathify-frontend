'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import en from './locales/en.json';
import fr from './locales/fr.json';
import es from './locales/es.json';
import it from './locales/it.json';
import de from './locales/de.json';
import pt from './locales/pt.json';
import zh from './locales/zh.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';

/**
 * Lightweight i18n layer.
 *
 * Locale resolution priority:
 *   1. `?lang=` query parameter (persisted as an explicit choice)
 *   2. Stored preference in localStorage
 *   3. System/browser language
 *   4. English (default)
 *
 * To add a locale: create `locales/<code>.json` with the same key structure
 * as en.json, then add the code to SUPPORTED_LOCALES. Missing keys fall back
 * to English automatically.
 */

export const DEFAULT_LOCALE = 'en';
export const SUPPORTED_LOCALES = [
  'en',
  'fr',
  'es',
  'it',
  'de',
  'pt',
  'zh',
  'ja',
  'ko',
] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/** Native display names for each supported locale. */
export const LOCALE_NAMES: Record<string, string> = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
  it: 'Italiano',
  de: 'Deutsch',
  pt: 'Português',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
};

/** Flag emoji shown next to each locale in the language picker. */
export const LOCALE_FLAGS: Record<string, string> = {
  en: '🇺🇸',
  fr: '🇫🇷',
  es: '🇪🇸',
  it: '🇮🇹',
  de: '🇩🇪',
  pt: '🇧🇷',
  zh: '🇨🇳',
  ja: '🇯🇵',
  ko: '🇰🇷',
};

const LOCALE_STORAGE_KEY = 'vtracer_locale';
const LANG_QUERY_PARAM = 'lang';

type Messages = Record<string, unknown>;

const MESSAGES: Record<string, Messages> = {
  en,
  fr,
  es,
  it,
  de,
  pt,
  zh,
  ja,
  ko,
};

function isSupportedLocale(value: string | null | undefined): value is string {
  if (!value) return false;
  const short = value.split('-')[0].toLowerCase();
  return (SUPPORTED_LOCALES as readonly string[]).includes(short);
}

function normalizeLocale(value: string): string {
  return value.split('-')[0].toLowerCase();
}

function detectSystemLocale(): string {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE;
  const candidates = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  for (const candidate of candidates) {
    if (candidate && isSupportedLocale(candidate)) {
      return normalizeLocale(candidate);
    }
  }
  return DEFAULT_LOCALE;
}

/**
 * Resolves the active locale. Only runs on the client.
 */
function resolveLocale(): string {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;

  // 1. URL query param — explicit choice, persisted below
  const param = new URLSearchParams(window.location.search).get(LANG_QUERY_PARAM);
  if (isSupportedLocale(param)) {
    return normalizeLocale(param!);
  }

  // 2. Stored preference
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isSupportedLocale(stored)) {
      return normalizeLocale(stored!);
    }
  } catch {
    // storage unavailable — fall through
  }

  // 3. System language
  return detectSystemLocale();
}

function lookup(messages: Messages, key: string): string | undefined {
  const parts = key.split('.');
  let node: unknown = messages;
  for (const part of parts) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Messages)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

export type TranslateParams = Record<string, string | number>;

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    params[name] !== undefined ? String(params[name]) : match,
  );
}

interface I18nContextValue {
  locale: string;
  setLocale: (locale: string) => void;
  t: (key: string, params?: TranslateParams) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key) => key,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Always render 'en' on the server/first paint to avoid hydration mismatch;
  // the real locale is resolved in an effect on the client.
  const [locale, setLocaleState] = useState<string>(DEFAULT_LOCALE);

  useEffect(() => {
    const resolved = resolveLocale();
    if (resolved !== DEFAULT_LOCALE) {
      // Deferred so the state update isn't synchronous within the effect body
      queueMicrotask(() => setLocaleState(resolved));
    }
    // Persist an explicit query-param choice so it survives navigation
    const param = new URLSearchParams(window.location.search).get(LANG_QUERY_PARAM);
    if (isSupportedLocale(param)) {
      try {
        localStorage.setItem(LOCALE_STORAGE_KEY, normalizeLocale(param!));
      } catch {
        // ignore
      }
    }
  }, []);

  const setLocale = useCallback((next: string) => {
    const short = normalizeLocale(next);
    setLocaleState(short);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, short);
    } catch {
      // ignore
    }
  }, []);

  const t = useCallback(
    (key: string, params?: TranslateParams): string => {
      const template =
        lookup(MESSAGES[locale] ?? {}, key) ??
        lookup(MESSAGES[DEFAULT_LOCALE] ?? {}, key) ??
        key;
      return interpolate(template, params);
    },
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}

import { describe, it, expect } from 'vitest';

/**
 * i18n pure-function tests.
 *
 * The two key internal helpers — `interpolate` and `lookup` — are not exported
 * from src/lib/i18n/index.tsx, so we replicate their logic here verbatim and
 * test the contracts. This gives us fast, React-free coverage of the i18n core.
 */

// --- Replicated pure functions (verbatim from src/lib/i18n/index.tsx) ---

type Messages = Record<string, unknown>;
type TranslateParams = Record<string, string | number>;

function lookup(messages: Messages, key: string): string | undefined {
  const parts = key.split('.');
  let node: unknown = messages;
  for (const part of parts) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Messages)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    params[name] !== undefined ? String(params[name]) : match,
  );
}

// --- Module-level constants exported from i18n ---
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  LOCALE_NAMES,
  LOCALE_FLAGS,
} from '../lib/i18n/index';

// --- Tests ---

describe('interpolate', () => {
  it('replaces a single placeholder', () => {
    expect(interpolate('Hello {name}', { name: 'World' })).toBe('Hello World');
  });

  it('replaces multiple placeholders', () => {
    expect(interpolate('{greeting}, {name}!', { greeting: 'Hi', name: 'Alice' })).toBe('Hi, Alice!');
  });

  it('leaves unmatched placeholders as-is', () => {
    expect(interpolate('Hello {unknown}', { name: 'World' })).toBe('Hello {unknown}');
  });

  it('returns template unchanged when params is undefined', () => {
    expect(interpolate('No params here')).toBe('No params here');
  });

  it('supports numeric param values', () => {
    expect(interpolate('Count: {n}', { n: 42 })).toBe('Count: 42');
  });

  it('handles empty string template', () => {
    expect(interpolate('', { name: 'x' })).toBe('');
  });
});

describe('lookup', () => {
  const messages: Messages = {
    greeting: 'Hello',
    nested: {
      deep: {
        value: 'Found it',
      },
    },
    array: ['not', 'a', 'string'],
  };

  it('looks up a top-level key', () => {
    expect(lookup(messages, 'greeting')).toBe('Hello');
  });

  it('looks up a deeply nested key with dot notation', () => {
    expect(lookup(messages, 'nested.deep.value')).toBe('Found it');
  });

  it('returns undefined for a missing key', () => {
    expect(lookup(messages, 'missing')).toBeUndefined();
  });

  it('returns undefined for a partial path that hits a non-string leaf', () => {
    expect(lookup(messages, 'nested.deep')).toBeUndefined();
  });

  it('returns undefined when traversal hits a non-object node', () => {
    expect(lookup(messages, 'greeting.sub')).toBeUndefined();
  });
});

describe('i18n module constants', () => {
  it('DEFAULT_LOCALE is "en"', () => {
    expect(DEFAULT_LOCALE).toBe('en');
  });

  it('SUPPORTED_LOCALES contains "en", "fr", "es", "de"', () => {
    expect(SUPPORTED_LOCALES).toContain('en');
    expect(SUPPORTED_LOCALES).toContain('fr');
    expect(SUPPORTED_LOCALES).toContain('es');
    expect(SUPPORTED_LOCALES).toContain('de');
  });

  it('LOCALE_NAMES has an entry for each supported locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(LOCALE_NAMES).toHaveProperty(locale);
      expect(typeof LOCALE_NAMES[locale]).toBe('string');
    }
  });

  it('LOCALE_FLAGS has an entry for each supported locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(LOCALE_FLAGS).toHaveProperty(locale);
    }
  });

  it('LOCALE_NAMES["en"] is "English"', () => {
    expect(LOCALE_NAMES['en']).toBe('English');
  });
});

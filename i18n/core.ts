/**
 * Nucleo i18n SENZA React: utilizzabile ovunque (servizi, utility, store).
 *
 * Scelta architetturale: soluzione minimale fatta in casa invece di i18next/lingui.
 *  - peso ≈ 1 KB contro 15-40 KB, nessuna dipendenza nuova (il lockfile non cambia);
 *  - chiavi tipizzate: TranslationKey deriva dal dizionario italiano e en/fr devono avere le stesse chiavi;
 *  - plurali con Intl.PluralRules, interpolazione {nome}, date/numeri con Intl;
 *  - dizionari caricati in lazy (import dinamico): solo la lingua attiva finisce nel download iniziale.
 */
import { STORAGE_KEYS } from '../config/appConfig';
import { safeStorage } from '../utils/safeStorage';
import {
  FALLBACK_LANGUAGE,
  Language,
  LanguagePreference,
  isLanguagePreference,
  resolveLanguage,
} from './resolve';
import type { Dictionary, Params, PluralBase, TranslationKey } from './types';

const loaders: Record<Language, () => Promise<{ default: Dictionary }>> = {
  it: () => import('./locales/it'),
  en: () => import('./locales/en'),
  fr: () => import('./locales/fr'),
};

const cache = new Map<Language, Dictionary>();
const listeners = new Set<() => void>();

let currentLanguage: Language = FALLBACK_LANGUAGE;
let currentDictionary: Dictionary | null = null;

export async function loadDictionary(lang: Language): Promise<Dictionary> {
  const cached = cache.get(lang);
  if (cached) return cached;
  const mod = await loaders[lang]();
  cache.set(lang, mod.default);
  return mod.default;
}

/** Carica il dizionario e lo rende attivo per t()/tp(). */
export async function activateLanguage(lang: Language): Promise<void> {
  const dict = await loadDictionary(lang);
  currentLanguage = lang;
  currentDictionary = dict;
  listeners.forEach((l) => l());
}

export const getLanguage = (): Language => currentLanguage;

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

/** Traduce una chiave nella lingua attiva. */
export function t(key: TranslationKey, params?: Params): string {
  const template = currentDictionary?.[key];
  return template === undefined ? key : interpolate(template, params);
}

/** Traduce una chiave plurale ("base_one" / "base_other") in base a `count`. `count` è disponibile come {count}. */
export function tp(base: PluralBase, count: number, params?: Params): string {
  const category = getPluralRules(currentLanguage).select(count) === 'one' ? 'one' : 'other';
  const key = `${base}_${category}` as TranslationKey;
  return t(key, { count, ...params });
}

export const getLocale = (): string => currentLanguage;

// --- Formattatori Intl riusati ---
// Costruire un Intl.DateTimeFormat costa ~80 µs, riusarlo ~1,5 µs: le card lo chiamano a ogni render. Le chiavi contengono il
// locale (letto a ogni chiamata, come prima), quindi un cambio lingua non richiede alcuna invalidazione. Le opzioni sono poche
// e fisse; il tetto evita una crescita illimitata se qualcuno passasse opzioni sempre diverse.
// Nota: il formattatore fissa il fuso orario predefinito al momento della creazione (un cambio di fuso a app aperta si vede al
// ricaricamento, non subito).

const FORMATTER_CACHE_LIMIT = 50;
const dateFormatters = new Map<string, Intl.DateTimeFormat>();
const numberFormatters = new Map<string, Intl.NumberFormat>();
const pluralRules = new Map<Language, Intl.PluralRules>();

/** Restituisce il valore in cache per `key` o lo crea; oltre il tetto elimina la voce più vecchia. */
function memoize<T>(cache: Map<string, T>, key: string, create: () => T): T {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const made = create();
  if (cache.size >= FORMATTER_CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, made);
  return made;
}

function getPluralRules(lang: Language): Intl.PluralRules {
  let rules = pluralRules.get(lang);
  if (!rules) {
    rules = new Intl.PluralRules(lang);
    pluralRules.set(lang, rules);
  }
  return rules;
}

const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = { dateStyle: 'medium' };

export function formatDate(value: string | number | Date, options: Intl.DateTimeFormatOptions = DEFAULT_DATE_OPTIONS): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const locale = getLocale();
  // Caso predefinito: chiave diretta (niente serializzazione). Le altre contengono sempre '|', quindi non possono collidere.
  const key = options === DEFAULT_DATE_OPTIONS ? locale : `${locale}|${JSON.stringify(options)}`;
  return memoize(dateFormatters, key, () => new Intl.DateTimeFormat(locale, options)).format(date);
}

export const formatNumber = (value: number, options?: Intl.NumberFormatOptions): string => {
  const locale = getLocale();
  const key = options === undefined ? locale : `${locale}|${JSON.stringify(options)}`;
  return memoize(numberFormatters, key, () => new Intl.NumberFormat(locale, options)).format(value);
};

// --- Preferenza salvata e lingue del dispositivo ---

export function readLanguagePreference(): LanguagePreference {
  const raw = safeStorage.get(STORAGE_KEYS.language);
  return isLanguagePreference(raw) ? raw : 'system';
}

export function getDeviceLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  if (navigator.languages && navigator.languages.length > 0) return [...navigator.languages];
  return navigator.language ? [navigator.language] : [];
}

/** Da chiamare prima del primo render: la UI parte già nella lingua giusta, senza "flash". */
export async function initI18n(): Promise<Language> {
  const lang = resolveLanguage(readLanguagePreference(), getDeviceLanguages());
  await activateLanguage(lang);
  return lang;
}

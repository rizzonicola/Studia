/** Logica pura (senza DOM) per la scelta della lingua: facilmente testabile. */

export type Language = 'it' | 'en' | 'fr';
export type LanguagePreference = 'system' | Language;

export const SUPPORTED_LANGUAGES: readonly Language[] = ['it', 'en', 'fr'];

/** Lingua di ripiego quando nessuna lingua del dispositivo è supportata. */
export const FALLBACK_LANGUAGE: Language = 'en';

/** Nomi nativi (non si traducono mai: l'utente deve riconoscere la propria lingua). */
export const LANGUAGE_NATIVE_NAMES: Record<Language, string> = {
  it: 'Italiano',
  en: 'English',
  fr: 'Français',
};

/** Nome inglese, usato nelle istruzioni per il modello ("Write the output in French"). */
export const LANGUAGE_ENGLISH_NAMES: Record<Language, string> = {
  it: 'Italian',
  en: 'English',
  fr: 'French',
};

export const isLanguage = (value: unknown): value is Language =>
  typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);

export const isLanguagePreference = (value: unknown): value is LanguagePreference =>
  value === 'system' || isLanguage(value);

/**
 * Sceglie la prima lingua supportata tra quelle del dispositivo (in ordine di preferenza),
 * riconoscendo le varianti regionali ("fr-CA", "en-GB", "it-CH", "FR_ca").
 * Se nessuna è supportata → English.
 */
export function resolveSystemLanguage(deviceLanguages: readonly string[] | undefined | null): Language {
  for (const raw of deviceLanguages ?? []) {
    const primary = String(raw).toLowerCase().split(/[-_]/)[0];
    if (isLanguage(primary)) return primary;
  }
  return FALLBACK_LANGUAGE;
}

export function resolveLanguage(preference: LanguagePreference, deviceLanguages: readonly string[] | undefined | null): Language {
  return preference === 'system' ? resolveSystemLanguage(deviceLanguages) : preference;
}

/** Lingua dei contenuti generati: "source" = come il testo/documento, "app" = come l'interfaccia. */
export type ContentLanguageMode = 'source' | 'app';
export const isContentLanguageMode = (v: unknown): v is ContentLanguageMode => v === 'source' || v === 'app';

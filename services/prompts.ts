import { LANGUAGE_ENGLISH_NAMES, Language, ContentLanguageMode } from '../i18n/resolve';

export type PromptKey = 'notes' | 'image' | 'quiz' | 'map';

/** Ordine di visualizzazione dei prompt in Impostazioni (nomi e descrizioni sono nel dizionario i18n: prompt.<key>.label / .description). */
export const PROMPT_KEYS: readonly PromptKey[] = ['notes', 'image', 'quiz', 'map'];

/** Testi delle richieste inviate insieme al materiale (nella lingua del prompt predefinito). */
export interface PromptRequests {
  /** Contiene il segnaposto {names} (nomi dei file). */
  notes: string;
  image: string;
  textHeader: string;
}

export interface PromptPack {
  prompts: Record<PromptKey, string>;
  requests: PromptRequests;
}

const loaders: Record<Language, () => Promise<{ default: PromptPack }>> = {
  it: () => import('./prompts/it'),
  en: () => import('./prompts/en'),
  fr: () => import('./prompts/fr'),
};

const packCache = new Map<Language, PromptPack>();

/** Carica (in lazy) i prompt predefiniti della lingua indicata. */
export async function loadPromptPack(lang: Language): Promise<PromptPack> {
  const cached = packCache.get(lang);
  if (cached) return cached;
  const mod = await loaders[lang]();
  packCache.set(lang, mod.default);
  return mod.default;
}

/**
 * Regola di risoluzione del prompt (pura, testabile):
 *  1. prompt personalizzato non vuoto → si usa SOLO quello, in qualunque lingua;
 *  2. altrimenti → prompt predefinito nella lingua attiva dell'app.
 */
export function pickPrompt(custom: string | undefined | null, defaultPrompt: string): string {
  return custom && custom.trim() ? custom : defaultPrompt;
}

export async function resolvePrompt(key: PromptKey, language: Language, custom: string | undefined | null): Promise<string> {
  if (custom && custom.trim()) return custom;
  const pack = await loadPromptPack(language);
  return pack.prompts[key];
}

/**
 * Unica istruzione "tecnica" aggiunta alla richiesta (NON al prompt di sistema): la lingua di risposta.
 *  - 'source' → stessa lingua del materiale (o degli appunti, per quiz e mappe);
 *  - 'app'    → lingua dell'app.
 * Vale anche con i prompt personalizzati; è dichiarata in Impostazioni → Lingua dei contenuti generati.
 */
export function languageDirective(mode: ContentLanguageMode, appLanguage: Language): string {
  return mode === 'app'
    ? `Language: write the entire output in ${LANGUAGE_ENGLISH_NAMES[appLanguage]}.`
    : 'Language: write the entire output in the same language as the source material.';
}

/** Per quiz e mappe: ribadisce che lo schema JSON (chiavi e tipi) non si traduce. */
export const JSON_DIRECTIVE = 'Keep the JSON keys and structure exactly as defined by the schema: translate only the text values.';
